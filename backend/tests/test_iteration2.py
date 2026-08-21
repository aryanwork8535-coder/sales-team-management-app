"""Iteration 2 backend tests: Attendance, Expenses, Complaints, Admin, Offline idempotency."""
import os
import uuid
import time
import pytest
import requests
from datetime import datetime, timezone

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


@pytest.fixture(scope="session")
def sp_token():
    r = _login("EMP003", "sales@123")
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_token():
    r = _login("EMP001", "admin@123")
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def manager_token():
    r = _login("EMP002", "manager@123")
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ---------- Attendance ----------
class TestAttendance:
    def test_start_and_get_today(self, sp_token):
        # Try to start; may already be started for EMP003
        r = requests.post(f"{BASE_URL}/api/attendance/start", headers=_h(sp_token),
                          json={"latitude": 16.7050, "longitude": 74.2433}, timeout=TIMEOUT)
        assert r.status_code in (200, 400), r.text
        t = requests.get(f"{BASE_URL}/api/attendance/today", headers=_h(sp_token), timeout=TIMEOUT)
        assert t.status_code == 200
        doc = t.json()
        assert doc is not None
        assert "start_time" in doc

    def test_duplicate_start_rejected(self, sp_token):
        # Already started (from previous test), should now be rejected
        r = requests.post(f"{BASE_URL}/api/attendance/start", headers=_h(sp_token),
                          json={"latitude": 16.7050, "longitude": 74.2433}, timeout=TIMEOUT)
        assert r.status_code == 400
        assert "already" in r.text.lower()

    def test_end_computes_duration(self, sp_token):
        r = requests.post(f"{BASE_URL}/api/attendance/end", headers=_h(sp_token),
                          json={"latitude": 16.7050, "longitude": 74.2433}, timeout=TIMEOUT)
        # If already ended by previous run: expect 400
        assert r.status_code in (200, 400), r.text
        if r.status_code == 200:
            j = r.json()
            assert "end_time" in j
            assert "duration_minutes" in j
            assert isinstance(j["duration_minutes"], int)

    def test_end_again_rejected(self, sp_token):
        r = requests.post(f"{BASE_URL}/api/attendance/end", headers=_h(sp_token),
                          json={}, timeout=TIMEOUT)
        assert r.status_code == 400

    def test_admin_sees_all_attendance(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/attendance", headers=_h(admin_token), timeout=TIMEOUT)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_salesperson_sees_own_only(self, sp_token):
        r = requests.get(f"{BASE_URL}/api/attendance", headers=_h(sp_token), timeout=TIMEOUT)
        assert r.status_code == 200
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(sp_token), timeout=TIMEOUT).json()
        for d in r.json():
            assert d["salesperson_id"] == me["id"]


# ---------- Expenses ----------
class TestExpenses:
    _expense_id = None

    def test_create_expense(self, sp_token):
        r = requests.post(
            f"{BASE_URL}/api/expenses",
            headers=_h(sp_token),
            json={"category": "Fuel", "amount": 150, "remarks": "TEST_expense"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["status"] == "Pending"
        assert j["amount"] == 150
        TestExpenses._expense_id = j["id"]

    def test_zero_amount_rejected(self, sp_token):
        r = requests.post(
            f"{BASE_URL}/api/expenses",
            headers=_h(sp_token),
            json={"category": "Fuel", "amount": 0, "remarks": "invalid"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 400

    def test_list_status_filter(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/expenses?status=Pending", headers=_h(admin_token), timeout=TIMEOUT)
        assert r.status_code == 200
        for e in r.json():
            assert e["status"] == "Pending"

    def test_salesperson_cannot_review(self, sp_token):
        eid = TestExpenses._expense_id
        r = requests.put(f"{BASE_URL}/api/expenses/{eid}/review", headers=_h(sp_token),
                         json={"status": "Approved"}, timeout=TIMEOUT)
        assert r.status_code == 403

    def test_invalid_status_400(self, admin_token):
        eid = TestExpenses._expense_id
        r = requests.put(f"{BASE_URL}/api/expenses/{eid}/review", headers=_h(admin_token),
                         json={"status": "Cancelled"}, timeout=TIMEOUT)
        assert r.status_code == 400

    def test_manager_can_approve(self, manager_token, sp_token):
        # Create fresh expense to approve via manager
        c = requests.post(f"{BASE_URL}/api/expenses", headers=_h(sp_token),
                         json={"category": "Travel", "amount": 200, "remarks": "TEST_mgr"}, timeout=TIMEOUT)
        eid = c.json()["id"]
        r = requests.put(f"{BASE_URL}/api/expenses/{eid}/review", headers=_h(manager_token),
                         json={"status": "Approved", "comment": "ok"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "Approved"

    def test_admin_can_reject(self, admin_token):
        eid = TestExpenses._expense_id
        r = requests.put(f"{BASE_URL}/api/expenses/{eid}/review", headers=_h(admin_token),
                         json={"status": "Rejected", "comment": "no bill"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "Rejected"


# ---------- Complaints ----------
class TestComplaints:
    _cid = None

    def test_create_requires_valid_retailer(self, sp_token):
        r = requests.post(f"{BASE_URL}/api/complaints", headers=_h(sp_token),
                         json={"retailer_id": "does-not-exist", "category": "Delivery", "description": "TEST"},
                         timeout=TIMEOUT)
        assert r.status_code == 404

    def test_create_ok(self, sp_token):
        rs = requests.get(f"{BASE_URL}/api/retailers", headers=_h(sp_token), timeout=TIMEOUT).json()
        rid = rs[0]["id"]
        r = requests.post(f"{BASE_URL}/api/complaints", headers=_h(sp_token),
                         json={"retailer_id": rid, "category": "Delivery", "description": "TEST_late"},
                         timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["status"] == "Open"
        assert j["complaint_no"].startswith("CMP")
        TestComplaints._cid = j["id"]

    def test_status_filter(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/complaints?status=Open", headers=_h(admin_token), timeout=TIMEOUT)
        assert r.status_code == 200
        for c in r.json():
            assert c["status"] == "Open"

    def test_sp_forbidden_review(self, sp_token):
        r = requests.put(f"{BASE_URL}/api/complaints/{TestComplaints._cid}/review",
                         headers=_h(sp_token), json={"status": "In Progress"}, timeout=TIMEOUT)
        assert r.status_code == 403

    def test_in_progress_then_resolved(self, admin_token):
        cid = TestComplaints._cid
        p = requests.put(f"{BASE_URL}/api/complaints/{cid}/review", headers=_h(admin_token),
                         json={"status": "In Progress"}, timeout=TIMEOUT)
        assert p.status_code == 200
        assert p.json()["status"] == "In Progress"
        r = requests.put(f"{BASE_URL}/api/complaints/{cid}/review", headers=_h(admin_token),
                         json={"status": "Resolved", "comment": "handled"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["status"] == "Resolved"
        assert j.get("resolution_note") == "handled"
        assert j.get("resolved_by")


# ---------- Admin Overview ----------
class TestAdminOverview:
    def test_overview_ranges(self, admin_token):
        for rng in ["today", "7d", "30d", "all"]:
            r = requests.get(f"{BASE_URL}/api/admin/overview?range={rng}", headers=_h(admin_token), timeout=TIMEOUT)
            assert r.status_code == 200, f"{rng}: {r.text}"
            j = r.json()
            for k in ["total_sales", "total_orders", "total_visits", "total_collection",
                      "total_outstanding", "active_retailers", "pending_expenses", "open_complaints",
                      "salesperson_summary", "brand_summary", "recent_orders"]:
                assert k in j, f"{rng} missing {k}"
            assert isinstance(j["salesperson_summary"], list)
            assert isinstance(j["brand_summary"], list)

    def test_salesperson_forbidden(self, sp_token):
        r = requests.get(f"{BASE_URL}/api/admin/overview", headers=_h(sp_token), timeout=TIMEOUT)
        assert r.status_code == 403


# ---------- Admin Products ----------
class TestAdminProducts:
    _pid = None
    _sku = f"TEST-{uuid.uuid4().hex[:6].upper()}"

    def test_list(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/products", headers=_h(admin_token), timeout=TIMEOUT)
        assert r.status_code == 200
        assert len(r.json()) >= 14

    def test_create(self, admin_token):
        payload = {"brand": "TESTBRAND", "name": "TEST Soap", "sku_code": TestAdminProducts._sku,
                   "mrp": 50, "distributor_rate": 30, "retailer_rate": 40, "salesperson_rate": 45}
        r = requests.post(f"{BASE_URL}/api/admin/products", headers=_h(admin_token), json=payload, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        TestAdminProducts._pid = r.json()["id"]

    def test_duplicate_sku(self, admin_token):
        payload = {"brand": "TESTBRAND", "name": "Other", "sku_code": TestAdminProducts._sku, "mrp": 60}
        r = requests.post(f"{BASE_URL}/api/admin/products", headers=_h(admin_token), json=payload, timeout=TIMEOUT)
        assert r.status_code == 400

    def test_update_rate_and_toggle(self, admin_token):
        pid = TestAdminProducts._pid
        r = requests.put(f"{BASE_URL}/api/admin/products/{pid}", headers=_h(admin_token),
                         json={"retailer_rate": 42}, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["retailer_rate"] == 42
        # Toggle active off
        r = requests.put(f"{BASE_URL}/api/admin/products/{pid}", headers=_h(admin_token),
                         json={"active": False}, timeout=TIMEOUT)
        assert r.status_code == 200 and r.json()["active"] is False
        # Toggle back on
        r = requests.put(f"{BASE_URL}/api/admin/products/{pid}", headers=_h(admin_token),
                         json={"active": True}, timeout=TIMEOUT)
        assert r.status_code == 200 and r.json()["active"] is True

    def test_salesperson_forbidden(self, sp_token):
        r = requests.get(f"{BASE_URL}/api/admin/products", headers=_h(sp_token), timeout=TIMEOUT)
        assert r.status_code == 403


# ---------- Admin Users ----------
class TestAdminUsers:
    _emp_id = f"EMP{int(time.time()) % 100000:05d}"
    _uid = None

    def test_list_no_password_hash(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=_h(admin_token), timeout=TIMEOUT)
        assert r.status_code == 200
        users = r.json()
        assert len(users) >= 6
        for u in users:
            assert "password_hash" not in u

    def test_create_new_user_login(self, admin_token):
        payload = {"employee_id": TestAdminUsers._emp_id, "name": "TEST_User",
                   "role": "salesperson", "password": "test@123"}
        r = requests.post(f"{BASE_URL}/api/admin/users", headers=_h(admin_token), json=payload, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "password_hash" not in j
        TestAdminUsers._uid = j["id"]
        # Login with new user
        lo = _login(TestAdminUsers._emp_id, "test@123")
        assert lo.status_code == 200, lo.text

    def test_duplicate_id(self, admin_token):
        payload = {"employee_id": TestAdminUsers._emp_id, "name": "Dup",
                   "role": "salesperson", "password": "test@123"}
        r = requests.post(f"{BASE_URL}/api/admin/users", headers=_h(admin_token), json=payload, timeout=TIMEOUT)
        assert r.status_code == 400

    def test_invalid_role(self, admin_token):
        payload = {"employee_id": f"EMP{uuid.uuid4().hex[:5].upper()}", "name": "X",
                   "role": "hacker", "password": "test@123"}
        r = requests.post(f"{BASE_URL}/api/admin/users", headers=_h(admin_token), json=payload, timeout=TIMEOUT)
        assert r.status_code == 400

    def test_short_password(self, admin_token):
        payload = {"employee_id": f"EMP{uuid.uuid4().hex[:5].upper()}", "name": "X",
                   "role": "salesperson", "password": "12345"}
        r = requests.post(f"{BASE_URL}/api/admin/users", headers=_h(admin_token), json=payload, timeout=TIMEOUT)
        assert r.status_code == 400

    def test_update_name_and_password_reset(self, admin_token):
        uid = TestAdminUsers._uid
        r = requests.put(f"{BASE_URL}/api/admin/users/{uid}", headers=_h(admin_token),
                         json={"name": "TEST_User_Renamed", "password": "newpw@123"}, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_User_Renamed"
        lo = _login(TestAdminUsers._emp_id, "newpw@123")
        assert lo.status_code == 200

    def test_deactivate_blocks_login(self, admin_token):
        uid = TestAdminUsers._uid
        r = requests.put(f"{BASE_URL}/api/admin/users/{uid}", headers=_h(admin_token),
                         json={"active": False}, timeout=TIMEOUT)
        assert r.status_code == 200
        lo = _login(TestAdminUsers._emp_id, "newpw@123")
        assert lo.status_code == 403

    def test_salesperson_forbidden(self, sp_token):
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=_h(sp_token), timeout=TIMEOUT)
        assert r.status_code == 403


# ---------- Offline idempotency ----------
class TestOfflineIdempotency:
    def test_order_same_client_id(self, sp_token):
        rs = requests.get(f"{BASE_URL}/api/retailers", headers=_h(sp_token), timeout=TIMEOUT).json()
        rid = rs[0]["id"]
        prods = requests.get(f"{BASE_URL}/api/products", headers=_h(sp_token), timeout=TIMEOUT).json()
        p = prods[0]
        client_id = str(uuid.uuid4())
        payload = {
            "retailer_id": rid,
            "client_id": client_id,
            "items": [{"product_id": p["id"], "quantity": 1, "rate": p["retailer_rate"], "discount": 0}],
        }
        r1 = requests.post(f"{BASE_URL}/api/orders", headers=_h(sp_token), json=payload, timeout=TIMEOUT)
        assert r1.status_code == 200, r1.text
        r2 = requests.post(f"{BASE_URL}/api/orders", headers=_h(sp_token), json=payload, timeout=TIMEOUT)
        assert r2.status_code == 200, r2.text
        assert r1.json()["id"] == r2.json()["id"], "Duplicate client_id must return the same order"
        # verify only one exists
        all_orders = requests.get(f"{BASE_URL}/api/orders", headers=_h(sp_token), timeout=TIMEOUT).json()
        matching = [o for o in all_orders if o.get("client_id") == client_id]
        assert len(matching) == 1

    def test_visit_start_same_client_id_and_client_time(self, sp_token):
        rs = requests.get(f"{BASE_URL}/api/retailers", headers=_h(sp_token), timeout=TIMEOUT).json()
        rid = rs[0]["id"]
        client_id = str(uuid.uuid4())
        client_time = "2026-01-05T04:30:00Z"
        payload = {"retailer_id": rid, "client_id": client_id, "client_time": client_time}
        r1 = requests.post(f"{BASE_URL}/api/visits/start", headers=_h(sp_token), json=payload, timeout=TIMEOUT)
        assert r1.status_code == 200, r1.text
        assert r1.json()["id"] == client_id
        # start_time should honor client_time
        ist_iso = r1.json()["start_time"]
        # Parse and compare hour/minute
        parsed = datetime.fromisoformat(ist_iso.replace("Z", "+00:00"))
        assert parsed.year == 2026 and parsed.month == 1 and parsed.day == 5
        r2 = requests.post(f"{BASE_URL}/api/visits/start", headers=_h(sp_token), json=payload, timeout=TIMEOUT)
        assert r2.status_code == 200
        assert r2.json()["id"] == client_id

    def test_visit_complete_client_time(self, sp_token):
        rs = requests.get(f"{BASE_URL}/api/retailers", headers=_h(sp_token), timeout=TIMEOUT).json()
        rid = rs[0]["id"]
        s = requests.post(f"{BASE_URL}/api/visits/start", headers=_h(sp_token),
                          json={"retailer_id": rid, "client_id": str(uuid.uuid4())}, timeout=TIMEOUT)
        vid = s.json()["id"]
        client_time = "2026-01-05T09:15:00Z"
        c = requests.post(
            f"{BASE_URL}/api/visits/complete", headers=_h(sp_token),
            json={"visit_id": vid, "result": "NO_ORDER", "no_order_reason": "closed", "client_time": client_time},
            timeout=TIMEOUT,
        )
        assert c.status_code == 200, c.text
        # Verify end_time in list
        vs = requests.get(f"{BASE_URL}/api/visits?retailer_id={rid}", headers=_h(sp_token), timeout=TIMEOUT).json()
        v = next((x for x in vs if x["id"] == vid), None)
        assert v is not None
        et = v.get("end_time")
        assert et
        parsed = datetime.fromisoformat(et.replace("Z", "+00:00"))
        assert parsed.year == 2026 and parsed.month == 1 and parsed.day == 5
