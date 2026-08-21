"""Iteration 4 security hardening tests for FMCG FieldForce Pro.

Covers:
1. GET /api/orders/{id} BOLA fix (owner-or-admin, distributor scoping)
2. POST /api/collections validation + ownership
3. GET /api/files/{path} owner-or-admin
4. GET /api/collections distributor 403
5. POST /api/seed removed (404)
6. Brute-force login limiter (run LAST — blocks IP)
7. Login still works for all roles after JWT rotation

Regex escape retailer-search regression: GET /api/retailers?q=Anand.
"""
import os
import time
import uuid

import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or "https://retail-force-mgmt.preview.emergentagent.com"
).rstrip("/")

TIMEOUT = 30


def _login(emp_id, pw):
    return requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"employee_id": emp_id, "password": pw},
        timeout=TIMEOUT,
    )


def _h(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


# ---------- Session fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = _login("EMP001", "admin@123")
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def sp3_token():
    r = _login("EMP003", "sales@123")
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def sp5_token():
    """Login as EMP005; reset password via admin first if the default doesn't work."""
    r = _login("EMP005", "sales@123")
    if r.status_code == 200:
        return r.json()["token"]
    # Reset EMP005 password via admin
    admin_r = _login("EMP001", "admin@123")
    assert admin_r.status_code == 200
    a_tok = admin_r.json()["token"]
    users = requests.get(f"{BASE_URL}/api/admin/users", headers=_h(a_tok), timeout=TIMEOUT).json()
    emp5 = next((u for u in users if u.get("employee_id") == "EMP005"), None)
    assert emp5, "EMP005 must exist"
    upd = requests.put(
        f"{BASE_URL}/api/admin/users/{emp5['id']}",
        headers=_h(a_tok),
        json={"password": "sales@123"},
        timeout=TIMEOUT,
    )
    assert upd.status_code == 200, upd.text
    r = _login("EMP005", "sales@123")
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def dist_token():
    r = _login("EMP004", "dist@123")
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def sp5_user(admin_token):
    users = requests.get(f"{BASE_URL}/api/admin/users", headers=_h(admin_token), timeout=TIMEOUT).json()
    return next(u for u in users if u.get("employee_id") == "EMP005")


@pytest.fixture(scope="session")
def sp3_user(admin_token):
    users = requests.get(f"{BASE_URL}/api/admin/users", headers=_h(admin_token), timeout=TIMEOUT).json()
    return next(u for u in users if u.get("employee_id") == "EMP003")


# Retailer owned by EMP003 (seeded retailers are EMP003's)
@pytest.fixture(scope="session")
def emp3_retailer(sp3_token):
    r = requests.get(f"{BASE_URL}/api/retailers", headers=_h(sp3_token), timeout=TIMEOUT)
    assert r.status_code == 200
    rl = r.json()
    assert len(rl) > 0
    return rl[0]


# A product for creating orders
@pytest.fixture(scope="session")
def a_product(sp3_token):
    r = requests.get(f"{BASE_URL}/api/products", headers=_h(sp3_token), timeout=TIMEOUT)
    assert r.status_code == 200
    ps = r.json()
    assert ps, "products must be seeded"
    return ps[0]


# Retailer assigned to EMP005 (created via direct Mongo write since no admin PUT retailer endpoint exists)
@pytest.fixture(scope="session")
def emp5_retailer(sp5_user, admin_token, sp3_token):
    # Use admin to POST a retailer (salesperson_id will be None), then rewrite salesperson_id to EMP005 via Mongo
    import pymongo

    # find an existing distributor to pair with (optional)
    body = {
        "shop_name": f"TEST_EMP5_SHOP_{uuid.uuid4().hex[:6]}",
        "owner_name": "Test Owner",
        "mobile": f"9{uuid.uuid4().int % 1000000000:09d}",
        "address": "Test Address",
        "gst_no": "",
        "shop_type": "General",
        "credit_limit": 0,
    }
    admin_r = requests.post(f"{BASE_URL}/api/retailers", headers=_h(admin_token), json=body, timeout=TIMEOUT)
    assert admin_r.status_code == 200, admin_r.text
    retailer = admin_r.json()
    # Reassign to EMP005 directly in Mongo
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")
    client = pymongo.MongoClient(mongo_url)
    client[db_name].retailers.update_one(
        {"id": retailer["id"]},
        {"$set": {"salesperson_id": sp5_user["id"]}},
    )
    client.close()
    retailer["salesperson_id"] = sp5_user["id"]
    yield retailer
    # Cleanup
    client = pymongo.MongoClient(mongo_url)
    client[db_name].retailers.delete_one({"id": retailer["id"]})
    client.close()


# ---------- 1) Order BOLA ----------
class TestOrderBOLA:
    """GET /api/orders/{id} - owner-or-admin only."""

    def test_emp3_can_fetch_own_order(self, sp3_token, emp3_retailer, a_product):
        # Create order as EMP003
        order = {
            "retailer_id": emp3_retailer["id"],
            "items": [{"product_id": a_product["id"], "quantity": 1, "rate": 10.0, "discount": 0}],
            "remarks": "TEST iter4 own",
        }
        c = requests.post(f"{BASE_URL}/api/orders", headers=_h(sp3_token), json=order, timeout=TIMEOUT)
        assert c.status_code == 200, c.text
        oid = c.json()["id"]

        g = requests.get(f"{BASE_URL}/api/orders/{oid}", headers=_h(sp3_token), timeout=TIMEOUT)
        assert g.status_code == 200
        assert g.json()["id"] == oid
        assert g.json()["salesperson_id"] == c.json()["salesperson_id"]

    def test_emp3_cannot_fetch_emp5_order(self, sp3_token, sp5_token, emp5_retailer, a_product):
        # EMP005 creates an order on EMP5's retailer
        order = {
            "retailer_id": emp5_retailer["id"],
            "items": [{"product_id": a_product["id"], "quantity": 1, "rate": 10.0, "discount": 0}],
            "remarks": "TEST iter4 emp5",
        }
        c = requests.post(f"{BASE_URL}/api/orders", headers=_h(sp5_token), json=order, timeout=TIMEOUT)
        assert c.status_code == 200, c.text
        oid = c.json()["id"]

        # EMP003 must NOT fetch EMP005's order
        g = requests.get(f"{BASE_URL}/api/orders/{oid}", headers=_h(sp3_token), timeout=TIMEOUT)
        assert g.status_code == 403, g.text

        # Admin CAN fetch any order
        admin_r = _login("EMP001", "admin@123")
        a_tok = admin_r.json()["token"]
        ga = requests.get(f"{BASE_URL}/api/orders/{oid}", headers=_h(a_tok), timeout=TIMEOUT)
        assert ga.status_code == 200
        assert ga.json()["id"] == oid


# ---------- 2) Collections validation + ownership ----------
class TestCollections:
    def test_reject_amount_zero(self, sp3_token, emp3_retailer):
        r = requests.post(
            f"{BASE_URL}/api/collections",
            headers=_h(sp3_token),
            json={"retailer_id": emp3_retailer["id"], "amount": 0, "mode": "Cash"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 400

    def test_reject_amount_negative(self, sp3_token, emp3_retailer):
        r = requests.post(
            f"{BASE_URL}/api/collections",
            headers=_h(sp3_token),
            json={"retailer_id": emp3_retailer["id"], "amount": -100, "mode": "Cash"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 400

    def test_reject_amount_over_limit(self, sp3_token, emp3_retailer):
        r = requests.post(
            f"{BASE_URL}/api/collections",
            headers=_h(sp3_token),
            json={"retailer_id": emp3_retailer["id"], "amount": 10_000_001, "mode": "Cash"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 400

    def test_reject_distributor(self, dist_token, emp3_retailer):
        r = requests.post(
            f"{BASE_URL}/api/collections",
            headers=_h(dist_token),
            json={"retailer_id": emp3_retailer["id"], "amount": 100, "mode": "Cash"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 403

    def test_reject_cross_salesperson(self, sp3_token, emp5_retailer):
        """EMP003 cannot collect for a retailer assigned to EMP005."""
        r = requests.post(
            f"{BASE_URL}/api/collections",
            headers=_h(sp3_token),
            json={"retailer_id": emp5_retailer["id"], "amount": 100, "mode": "Cash"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 403, r.text

    def test_accept_valid_and_outstanding_decreases(self, sp3_token, emp3_retailer):
        # Snapshot outstanding
        rid = emp3_retailer["id"]
        r1 = requests.get(f"{BASE_URL}/api/retailers/{rid}", headers=_h(sp3_token), timeout=TIMEOUT)
        assert r1.status_code == 200
        before = r1.json().get("outstanding", 0)

        c = requests.post(
            f"{BASE_URL}/api/collections",
            headers=_h(sp3_token),
            json={"retailer_id": rid, "amount": 250, "mode": "Cash", "remarks": "TEST iter4"},
            timeout=TIMEOUT,
        )
        assert c.status_code == 200, c.text
        assert c.json()["amount"] == 250

        r2 = requests.get(f"{BASE_URL}/api/retailers/{rid}", headers=_h(sp3_token), timeout=TIMEOUT)
        after = r2.json().get("outstanding", 0)
        assert round(after, 2) == round(before - 250, 2)

    def test_list_collections_distributor_403(self, dist_token):
        r = requests.get(f"{BASE_URL}/api/collections", headers=_h(dist_token), timeout=TIMEOUT)
        assert r.status_code == 403

    def test_list_collections_sp_scoped(self, sp3_token, sp3_user):
        r = requests.get(f"{BASE_URL}/api/collections", headers=_h(sp3_token), timeout=TIMEOUT)
        assert r.status_code == 200
        arr = r.json()
        # All must belong to EMP003
        for c in arr:
            assert c["salesperson_id"] == sp3_user["id"]

    def test_list_collections_admin_all(self, admin_token, sp3_token, sp3_user):
        # Ensure at least one EMP003 collection exists (created above) — but session isolation may vary.
        r = requests.get(f"{BASE_URL}/api/collections", headers=_h(admin_token), timeout=TIMEOUT)
        assert r.status_code == 200
        # Admin can see all; simply confirm it returns a list
        assert isinstance(r.json(), list)


# ---------- 3) File download owner-or-admin ----------
class TestFileDownload:
    def test_owner_can_download_other_salesperson_403_admin_ok(self, sp3_token, sp5_token, admin_token):
        # EMP003 uploads
        files = {"file": ("hello.txt", b"hello iter4 test", "text/plain")}
        headers = {"Authorization": f"Bearer {sp3_token}"}  # no content-type; requests sets multipart
        up = requests.post(f"{BASE_URL}/api/upload", headers=headers, files=files, timeout=TIMEOUT)
        assert up.status_code == 200, up.text
        path = up.json()["path"]

        # Owner (EMP003) downloads OK
        g_owner = requests.get(f"{BASE_URL}/api/files/{path}", headers=_h(sp3_token), timeout=TIMEOUT)
        assert g_owner.status_code == 200
        assert g_owner.content == b"hello iter4 test"

        # Other salesperson (EMP005) 403
        g_other = requests.get(f"{BASE_URL}/api/files/{path}", headers=_h(sp5_token), timeout=TIMEOUT)
        assert g_other.status_code == 403, g_other.text

        # Admin 200
        g_admin = requests.get(f"{BASE_URL}/api/files/{path}", headers=_h(admin_token), timeout=TIMEOUT)
        assert g_admin.status_code == 200


# ---------- 5) /api/seed removed ----------
class TestSeedRemoved:
    def test_seed_endpoint_404(self):
        r = requests.post(f"{BASE_URL}/api/seed", timeout=TIMEOUT)
        assert r.status_code == 404


# ---------- 7) Valid login all roles (after JWT rotation) ----------
class TestLoginAllRoles:
    @pytest.mark.parametrize("emp,pw,role", [
        ("EMP001", "admin@123", "super_admin"),
        ("EMP002", "manager@123", "sales_manager"),
        ("EMP003", "sales@123", "salesperson"),
        ("EMP004", "dist@123", "distributor"),
    ])
    def test_login_role(self, emp, pw, role):
        r = _login(emp, pw)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "token" in j and "user" in j
        assert j["user"]["employee_id"] == emp
        assert j["user"]["role"] == role
        assert "password_hash" not in j["user"], "password_hash must NOT be in response"


# ---------- Regex escape regression ----------
class TestRetailerSearch:
    def test_retailer_search_regex_escape(self, sp3_token):
        r = requests.get(f"{BASE_URL}/api/retailers?q=Anand", headers=_h(sp3_token), timeout=TIMEOUT)
        assert r.status_code == 200
        # returns list (may be empty but should not error)
        assert isinstance(r.json(), list)

    def test_retailer_search_special_chars_no_500(self, sp3_token):
        # These would have crashed if regex weren't escaped
        for q in ["*+?", "(unclosed", "[abc"]:
            r = requests.get(f"{BASE_URL}/api/retailers", headers=_h(sp3_token), params={"q": q}, timeout=TIMEOUT)
            assert r.status_code == 200, f"q={q} -> {r.status_code}: {r.text}"


# ---------- 6) Brute-force limiter (MUST RUN LAST) ----------
# Use zzz_ prefix so pytest -v runs it after everything else alphabetically.
class TestZZZBruteForce:
    """MUST run last — blocks IP for 5 minutes."""

    def test_5_fails_then_429(self):
        fake_emp = f"EMPZZZ{uuid.uuid4().hex[:4].upper()}"
        codes = []
        for _ in range(5):
            r = _login(fake_emp, "wrong-pw")
            codes.append(r.status_code)
        # First 5 attempts return 401
        assert all(c == 401 for c in codes), f"expected all 401, got {codes}"

        # 6th attempt returns 429
        r6 = _login(fake_emp, "wrong-pw")
        assert r6.status_code == 429, r6.text
        assert "Retry-After" in r6.headers, "Retry-After header must be present"
        retry = int(r6.headers["Retry-After"])
        assert retry > 0
