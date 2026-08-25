"""Iteration 3 backend tests: Targets, Performance, Distributor, Scheme Claims, Attendance Report."""
import os
import pytest
import requests
from datetime import datetime

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
def admin_token():
    r = _login("EMP001", "admin@123")
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def sp_token():
    r = _login("EMP003", "sales@123")
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def dist_token():
    r = _login("EMP004", "dist@123")
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ================= Targets =================
class TestAdminTargets:
    def test_sp_forbidden(self, sp_token):
        r = requests.get(f"{BASE_URL}/api/admin/targets", headers=_h(sp_token), timeout=TIMEOUT)
        assert r.status_code == 403

    def test_list_returns_all_salespersons(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/targets", headers=_h(admin_token), timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict)
        assert set(data.keys()) >= {"salespersons", "distributors", "territories"}
        assert len(data["salespersons"]) >= 3
        for row in data["salespersons"]:
            assert "id" in row and "daily_target" in row and "monthly_target" in row
            assert "employee_id" in row and "name" in row

    def test_upsert_target_and_reflect(self, admin_token):
        # Pick EMP005 (per instructions) to avoid disrupting EMP003 performance data
        r = requests.get(f"{BASE_URL}/api/admin/targets", headers=_h(admin_token), timeout=TIMEOUT)
        rows = r.json()["salespersons"]
        emp005 = next((x for x in rows if x["employee_id"] == "EMP005"), None)
        assert emp005 is not None
        sp_id = emp005["id"]

        # Set daily 15000
        p = requests.post(
            f"{BASE_URL}/api/admin/targets", headers=_h(admin_token),
            json={"salesperson_id": sp_id, "period": "daily", "value": 15000},
            timeout=TIMEOUT,
        )
        assert p.status_code == 200, p.text
        # Set monthly 300000
        p2 = requests.post(
            f"{BASE_URL}/api/admin/targets", headers=_h(admin_token),
            json={"salesperson_id": sp_id, "period": "monthly", "value": 300000},
            timeout=TIMEOUT,
        )
        assert p2.status_code == 200, p2.text

        # Verify GET reflects new values
        r2 = requests.get(f"{BASE_URL}/api/admin/targets", headers=_h(admin_token), timeout=TIMEOUT)
        rows2 = r2.json()["salespersons"]
        emp005_new = next((x for x in rows2 if x["employee_id"] == "EMP005"), None)
        assert emp005_new["daily_target"] == 15000
        assert emp005_new["monthly_target"] == 300000

        # Upsert again with different value -> old deactivated, new one active
        p3 = requests.post(
            f"{BASE_URL}/api/admin/targets", headers=_h(admin_token),
            json={"salesperson_id": sp_id, "period": "daily", "value": 18000},
            timeout=TIMEOUT,
        )
        assert p3.status_code == 200
        r3 = requests.get(f"{BASE_URL}/api/admin/targets", headers=_h(admin_token), timeout=TIMEOUT)
        emp005_v3 = next((x for x in r3.json()["salespersons"] if x["employee_id"] == "EMP005"), None)
        assert emp005_v3["daily_target"] == 18000

    def test_invalid_period(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/targets", headers=_h(admin_token), timeout=TIMEOUT)
        sp_id = r.json()["salespersons"][0]["id"]
        p = requests.post(
            f"{BASE_URL}/api/admin/targets", headers=_h(admin_token),
            json={"salesperson_id": sp_id, "period": "weekly", "value": 100},
            timeout=TIMEOUT,
        )
        assert p.status_code == 400

    def test_negative_value(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/targets", headers=_h(admin_token), timeout=TIMEOUT)
        sp_id = r.json()["salespersons"][0]["id"]
        p = requests.post(
            f"{BASE_URL}/api/admin/targets", headers=_h(admin_token),
            json={"salesperson_id": sp_id, "period": "daily", "value": -50},
            timeout=TIMEOUT,
        )
        assert p.status_code == 400

    def test_unknown_salesperson(self, admin_token):
        p = requests.post(
            f"{BASE_URL}/api/admin/targets", headers=_h(admin_token),
            json={"salesperson_id": "does-not-exist", "period": "daily", "value": 1000},
            timeout=TIMEOUT,
        )
        assert p.status_code == 404


# ================= Performance =================
class TestPerformance:
    def test_shape_and_values(self, sp_token):
        r = requests.get(f"{BASE_URL}/api/performance", headers=_h(sp_token), timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ["today_sales", "daily_target", "month_sales", "monthly_target",
                  "month_orders", "month_visits", "month_collection", "rank",
                  "total_salespersons", "trend", "leaderboard"]:
            assert k in j, f"missing {k}"
        assert isinstance(j["trend"], list) and len(j["trend"]) == 6
        # Last trend entry should be current month
        now = datetime.utcnow()
        assert j["trend"][-1]["month"] == f"{now.year}-{now.month:02d}"
        # EMP003 has current-month sales; last trend must be > 0
        assert j["trend"][-1]["sales"] > 0, f"expected EMP003 current month sales>0, got {j['trend'][-1]}"
        assert isinstance(j["rank"], int) and j["rank"] >= 1
        assert isinstance(j["leaderboard"], list) and len(j["leaderboard"]) >= 1
        assert any(x.get("is_me") is True for x in j["leaderboard"])

    def test_reflects_new_monthly_target(self, admin_token, sp_token):
        # Get EMP003 id
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(sp_token), timeout=TIMEOUT).json()
        emp003_id = me["id"]
        # Read current
        cur = requests.get(f"{BASE_URL}/api/performance", headers=_h(sp_token), timeout=TIMEOUT).json()
        original = cur["monthly_target"]
        new_val = 777777
        p = requests.post(
            f"{BASE_URL}/api/admin/targets", headers=_h(admin_token),
            json={"salesperson_id": emp003_id, "period": "monthly", "value": new_val},
            timeout=TIMEOUT,
        )
        assert p.status_code == 200
        try:
            r2 = requests.get(f"{BASE_URL}/api/performance", headers=_h(sp_token), timeout=TIMEOUT).json()
            assert r2["monthly_target"] == new_val
        finally:
            # Restore original target to keep seed data intact
            requests.post(
                f"{BASE_URL}/api/admin/targets", headers=_h(admin_token),
                json={"salesperson_id": emp003_id, "period": "monthly", "value": original or 500000},
                timeout=TIMEOUT,
            )


# ================= Distributor Dashboard =================
class TestDistributor:
    def test_sp_forbidden(self, sp_token):
        r = requests.get(f"{BASE_URL}/api/distributor/dashboard", headers=_h(sp_token), timeout=TIMEOUT)
        assert r.status_code == 403

    def test_dashboard_counts(self, dist_token):
        r = requests.get(f"{BASE_URL}/api/distributor/dashboard", headers=_h(dist_token), timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ["pending_orders", "dispatched_orders", "delivered_orders", "pending_claims"]:
            assert k in j and isinstance(j[k], int)


# ================= Scheme Claims =================
class TestSchemeClaims:
    def test_sp_forbidden(self, sp_token):
        r = requests.get(f"{BASE_URL}/api/scheme-claims", headers=_h(sp_token), timeout=TIMEOUT)
        assert r.status_code == 403

    def test_list_enriched(self, dist_token):
        r = requests.get(f"{BASE_URL}/api/scheme-claims", headers=_h(dist_token), timeout=TIMEOUT)
        assert r.status_code == 200
        docs = r.json()
        assert isinstance(docs, list)
        for d in docs:
            assert "retailer_name" in d

    def test_status_filter(self, dist_token):
        r = requests.get(f"{BASE_URL}/api/scheme-claims?status=Pending", headers=_h(dist_token), timeout=TIMEOUT)
        assert r.status_code == 200
        for d in r.json():
            assert d["status"] == "Pending"

    def test_fulfil_and_double_fulfil(self, dist_token, sp_token):
        # Get a pending claim
        r = requests.get(f"{BASE_URL}/api/scheme-claims?status=Pending", headers=_h(dist_token), timeout=TIMEOUT)
        pending = r.json()
        if not pending:
            pytest.skip("No pending claims to test fulfil")
        cid = pending[0]["id"]
        # SP forbidden
        f_sp = requests.put(f"{BASE_URL}/api/scheme-claims/{cid}/fulfil", headers=_h(sp_token), timeout=TIMEOUT)
        assert f_sp.status_code == 403
        # Fulfil by dist
        f = requests.put(f"{BASE_URL}/api/scheme-claims/{cid}/fulfil", headers=_h(dist_token), timeout=TIMEOUT)
        assert f.status_code == 200, f.text
        j = f.json()
        assert j["status"] == "Fulfilled"
        assert j.get("fulfilled_by")
        # Double fulfil -> 400
        f2 = requests.put(f"{BASE_URL}/api/scheme-claims/{cid}/fulfil", headers=_h(dist_token), timeout=TIMEOUT)
        assert f2.status_code == 400


# ================= Order Status (Distributor flow) =================
class TestOrderStatus:
    def test_invalid_status(self, dist_token):
        r = requests.get(f"{BASE_URL}/api/orders", headers=_h(dist_token), timeout=TIMEOUT)
        orders = r.json()
        if not orders:
            pytest.skip("No orders available for status test")
        oid = orders[0]["id"]
        u = requests.put(f"{BASE_URL}/api/orders/{oid}/status", headers=_h(dist_token),
                         json={"status": "Cancelled"}, timeout=TIMEOUT)
        assert u.status_code == 400

    def test_sp_forbidden(self, sp_token, dist_token):
        r = requests.get(f"{BASE_URL}/api/orders", headers=_h(dist_token), timeout=TIMEOUT)
        orders = r.json()
        if not orders:
            pytest.skip()
        oid = orders[0]["id"]
        u = requests.put(f"{BASE_URL}/api/orders/{oid}/status", headers=_h(sp_token),
                         json={"status": "Dispatched"}, timeout=TIMEOUT)
        assert u.status_code == 403

    def test_flow_submitted_to_dispatched_to_delivered(self, dist_token):
        r = requests.get(f"{BASE_URL}/api/orders", headers=_h(dist_token), timeout=TIMEOUT)
        submitted = [o for o in r.json() if o.get("status") == "Submitted"]
        if not submitted:
            pytest.skip("No submitted orders for distributor")
        oid = submitted[0]["id"]
        u1 = requests.put(f"{BASE_URL}/api/orders/{oid}/status", headers=_h(dist_token),
                          json={"status": "Dispatched"}, timeout=TIMEOUT)
        assert u1.status_code == 200
        assert u1.json()["status"] == "Dispatched"
        u2 = requests.put(f"{BASE_URL}/api/orders/{oid}/status", headers=_h(dist_token),
                          json={"status": "Delivered"}, timeout=TIMEOUT)
        assert u2.status_code == 200
        assert u2.json()["status"] == "Delivered"


# ================= Attendance Report =================
class TestAttendanceReport:
    def test_sp_forbidden(self, sp_token):
        r = requests.get(f"{BASE_URL}/api/admin/attendance-report", headers=_h(sp_token), timeout=TIMEOUT)
        assert r.status_code == 403

    def test_default_current_month(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/attendance-report", headers=_h(admin_token), timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "month" in j and "days_in_month" in j and "rows" in j
        assert isinstance(j["rows"], list)
        assert 28 <= j["days_in_month"] <= 31
        # Check row shape
        for row in j["rows"]:
            assert "id" in row and "name" in row and "employee_id" in row and "days" in row
            assert isinstance(row["days"], dict)
            for _, day_data in row["days"].items():
                # start_time should be ISO string with tz
                if day_data.get("start_time"):
                    assert "T" in day_data["start_time"]

    def test_explicit_month(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/attendance-report?month=2026-07",
                         headers=_h(admin_token), timeout=TIMEOUT)
        assert r.status_code == 200
        j = r.json()
        assert j["month"] == "2026-07"
        assert j["days_in_month"] == 31

    def test_bad_month_format(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/attendance-report?month=bad-month",
                         headers=_h(admin_token), timeout=TIMEOUT)
        assert r.status_code == 400
