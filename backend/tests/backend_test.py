"""Backend regression tests for FMCG FieldForce Pro."""
import os
import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or "https://retail-force-mgmt.preview.emergentagent.com"
).rstrip("/")

TIMEOUT = 30


def _login(emp_id, pw):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"employee_id": emp_id, "password": pw}, timeout=TIMEOUT)
    return r


@pytest.fixture(scope="session")
def sp_token():
    r = _login("EMP003", "sales@123")
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def sp5_token():
    r = _login("EMP005", "sales@123")
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _h(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


# ---------- Auth ----------
class TestAuth:
    def test_login_success(self):
        r = _login("EMP003", "sales@123")
        assert r.status_code == 200
        j = r.json()
        assert "token" in j and "user" in j
        assert j["user"]["employee_id"] == "EMP003"
        assert j["user"]["role"] == "salesperson"

    def test_login_invalid(self):
        r = _login("EMP003", "wrong")
        assert r.status_code == 401

    def test_me_with_token(self, sp_token):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(sp_token), timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["employee_id"] == "EMP003"

    def test_me_without_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=TIMEOUT)
        assert r.status_code == 401


# ---------- Dashboard ----------
class TestDashboard:
    def test_salesperson_dashboard(self, sp_token):
        r = requests.get(f"{BASE_URL}/api/dashboard/salesperson", headers=_h(sp_token), timeout=TIMEOUT)
        assert r.status_code == 200
        j = r.json()
        for k in ["today_sales", "today_orders", "today_visits", "new_retailers", "today_collection", "today_target", "beat"]:
            assert k in j, f"missing {k}"
        assert isinstance(j["beat"].get("retailers"), list)


# ---------- Retailers ----------
class TestRetailers:
    def test_list_own_retailers(self, sp_token):
        r = requests.get(f"{BASE_URL}/api/retailers", headers=_h(sp_token), timeout=TIMEOUT)
        assert r.status_code == 200
        docs = r.json()
        assert isinstance(docs, list) and len(docs) > 0
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(sp_token), timeout=TIMEOUT).json()
        assert all(d.get("salesperson_id") == me["id"] for d in docs)

    def test_retailer_detail(self, sp_token):
        r = requests.get(f"{BASE_URL}/api/retailers", headers=_h(sp_token), timeout=TIMEOUT)
        rid = r.json()[0]["id"]
        d = requests.get(f"{BASE_URL}/api/retailers/{rid}", headers=_h(sp_token), timeout=TIMEOUT)
        assert d.status_code == 200
        j = d.json()
        assert "stats" in j and "recent_orders" in j and "recent_visits" in j

    def test_create_and_duplicate(self, sp_token):
        import time
        mob = f"9{int(time.time()) % 1000000000:09d}"
        payload = {"shop_name": "TEST_Shop", "owner_name": "TEST_Owner", "mobile": mob, "address": "TEST addr"}
        c = requests.post(f"{BASE_URL}/api/retailers", json=payload, headers=_h(sp_token), timeout=TIMEOUT)
        assert c.status_code == 200, c.text
        new = c.json()
        assert new["shop_name"] == "TEST_Shop"
        # duplicate
        dup = requests.post(f"{BASE_URL}/api/retailers", json=payload, headers=_h(sp_token), timeout=TIMEOUT)
        assert dup.status_code == 400
        # Verify persistence via GET
        g = requests.get(f"{BASE_URL}/api/retailers/{new['id']}", headers=_h(sp_token), timeout=TIMEOUT)
        assert g.status_code == 200
        return new["id"]


# ---------- Products / Brands ----------
class TestCatalog:
    def test_products(self, sp_token):
        r = requests.get(f"{BASE_URL}/api/products", headers=_h(sp_token), timeout=TIMEOUT)
        assert r.status_code == 200
        assert len(r.json()) == 14

    def test_brands(self, sp_token):
        r = requests.get(f"{BASE_URL}/api/brands", headers=_h(sp_token), timeout=TIMEOUT)
        assert r.status_code == 200
        brands = set(r.json())
        assert brands == {"DHAMAL", "FOAMATIC", "PRISTYN", "SCRUB & SHINE"}


# ---------- Schemes ----------
class TestSchemes:
    def test_dhamal_scheme(self, sp_token):
        prods = requests.get(f"{BASE_URL}/api/products", headers=_h(sp_token), params={"brand": "DHAMAL"}, timeout=TIMEOUT).json()
        pid = prods[0]["id"]
        r = requests.post(
            f"{BASE_URL}/api/schemes/calculate",
            headers=_h(sp_token),
            json={"items": [{"product_id": pid, "quantity": 10}]},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        schemes = r.json()["schemes"]
        assert len(schemes) == 1
        assert schemes[0]["brand"] == "DHAMAL"
        assert schemes[0]["slab"]["article"] == "Insulated Tiffin"


# ---------- Visits ----------
class TestVisits:
    def test_start_and_complete(self, sp_token):
        rs = requests.get(f"{BASE_URL}/api/retailers", headers=_h(sp_token), timeout=TIMEOUT).json()
        rid = rs[0]["id"]
        s = requests.post(f"{BASE_URL}/api/visits/start", headers=_h(sp_token), json={"retailer_id": rid}, timeout=TIMEOUT)
        assert s.status_code == 200, s.text
        vid = s.json()["id"]
        c = requests.post(
            f"{BASE_URL}/api/visits/complete",
            headers=_h(sp_token),
            json={"visit_id": vid, "result": "NO_ORDER", "no_order_reason": "Shop closed"},
            timeout=TIMEOUT,
        )
        assert c.status_code == 200, c.text
        assert c.json().get("ok") is True


# ---------- Orders ----------
class TestOrders:
    def test_create_order_with_scheme(self, sp_token):
        rs = requests.get(f"{BASE_URL}/api/retailers", headers=_h(sp_token), timeout=TIMEOUT).json()
        rid = rs[0]["id"]
        prods = requests.get(f"{BASE_URL}/api/products", headers=_h(sp_token), params={"brand": "DHAMAL"}, timeout=TIMEOUT).json()
        p = prods[0]
        payload = {
            "retailer_id": rid,
            "items": [{"product_id": p["id"], "quantity": 10, "rate": p["retailer_rate"], "discount": 0}],
        }
        r = requests.post(f"{BASE_URL}/api/orders", headers=_h(sp_token), json=payload, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["order_no"].startswith("ORD")
        assert j["net_value"] == round(10 * p["retailer_rate"], 2)
        assert len(j["schemes"]) == 1
        # Visible in list
        lst = requests.get(f"{BASE_URL}/api/orders", headers=_h(sp_token), timeout=TIMEOUT).json()
        assert any(o["id"] == j["id"] for o in lst)


# ---------- Collections ----------
class TestCollections:
    def test_collection_reduces_outstanding(self, sp_token):
        rs = requests.get(f"{BASE_URL}/api/retailers", headers=_h(sp_token), timeout=TIMEOUT).json()
        target = next((r for r in rs if r.get("outstanding", 0) > 0), rs[0])
        rid = target["id"]
        before = requests.get(f"{BASE_URL}/api/retailers/{rid}", headers=_h(sp_token), timeout=TIMEOUT).json()
        prev_out = before.get("outstanding", 0)
        c = requests.post(
            f"{BASE_URL}/api/collections",
            headers=_h(sp_token),
            json={"retailer_id": rid, "amount": 500, "mode": "Cash"},
            timeout=TIMEOUT,
        )
        assert c.status_code == 200, c.text
        after = requests.get(f"{BASE_URL}/api/retailers/{rid}", headers=_h(sp_token), timeout=TIMEOUT).json()
        assert after["outstanding"] == prev_out - 500


# ---------- Role isolation ----------
class TestRoleIsolation:
    def test_emp003_cannot_see_emp005_retailers(self, sp_token, sp5_token):
        sp3 = requests.get(f"{BASE_URL}/api/retailers", headers=_h(sp_token), timeout=TIMEOUT).json()
        sp5 = requests.get(f"{BASE_URL}/api/retailers", headers=_h(sp5_token), timeout=TIMEOUT).json()
        ids3 = {r["id"] for r in sp3}
        ids5 = {r["id"] for r in sp5}
        assert ids3.isdisjoint(ids5)
        # 403 when accessing other's retailer
        if ids5:
            other_id = next(iter(ids5))
            f = requests.get(f"{BASE_URL}/api/retailers/{other_id}", headers=_h(sp_token), timeout=TIMEOUT)
            assert f.status_code == 403

    def test_order_isolation(self, sp_token, sp5_token):
        sp3 = requests.get(f"{BASE_URL}/api/orders", headers=_h(sp_token), timeout=TIMEOUT).json()
        sp5 = requests.get(f"{BASE_URL}/api/orders", headers=_h(sp5_token), timeout=TIMEOUT).json()
        me3 = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(sp_token), timeout=TIMEOUT).json()
        assert all(o["salesperson_id"] == me3["id"] for o in sp3)
        me5 = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(sp5_token), timeout=TIMEOUT).json()
        assert all(o["salesperson_id"] == me5["id"] for o in sp5)
