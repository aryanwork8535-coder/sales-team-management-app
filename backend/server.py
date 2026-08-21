from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Header, Request
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import time
import logging
import bcrypt
import jwt
import uuid
import calendar
import requests
from collections import defaultdict, deque
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', '')
if len(JWT_SECRET.encode()) < 32:
    raise RuntimeError("JWT_SECRET env var must be set to at least 32 bytes")
JWT_ALG = 'HS256'
JWT_EXPIRE_HOURS = 24 * 30

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "fmcg-fieldforce-pro"
storage_key: Optional[str] = None


def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------- Utils ----------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid or expired token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


# ---------- Models ----------
class LoginRequest(BaseModel):
    employee_id: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


class RetailerCreate(BaseModel):
    shop_name: str
    owner_name: str
    mobile: str
    address: str
    area: Optional[str] = ""
    city: Optional[str] = ""
    retailer_type: Optional[str] = "Kirana"
    potential: Optional[str] = "Medium"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    photo_path: Optional[str] = None
    distributor_id: Optional[str] = None
    remarks: Optional[str] = ""


class OrderItemIn(BaseModel):
    product_id: str
    quantity: int
    rate: float
    discount: float = 0.0


class OrderCreate(BaseModel):
    retailer_id: str
    items: List[OrderItemIn]
    remarks: Optional[str] = ""
    client_id: Optional[str] = None  # for offline sync idempotency


class VisitStartRequest(BaseModel):
    retailer_id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    gps_accuracy: Optional[float] = None
    client_id: Optional[str] = None  # for offline sync idempotency
    client_time: Optional[str] = None  # ISO timestamp captured offline


class VisitCompleteRequest(BaseModel):
    visit_id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    result: str  # ORDER_BOOKED | NO_ORDER | PAYMENT_COLLECTED | COMPLAINT | NEW_RETAILER | OTHER
    no_order_reason: Optional[str] = None
    remarks: Optional[str] = ""
    client_time: Optional[str] = None  # ISO timestamp captured offline


class CollectionCreate(BaseModel):
    retailer_id: str
    amount: float
    mode: str  # Cash | UPI | Bank Transfer | Cheque | Other
    reference_no: Optional[str] = ""
    remarks: Optional[str] = ""
    receipt_photo: Optional[str] = None


# ---------- Auth ----------
# Brute-force protection: in-process fixed-window limiter (per employee ID + per IP).
LOGIN_MAX_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 60
LOGIN_BLOCK_SECONDS = 300
_login_failures: dict = defaultdict(deque)
_login_blocked_until: dict = {}
DUMMY_HASH = bcrypt.hashpw(b"dummy-password-for-constant-timing", bcrypt.gensalt()).decode()


def _login_blocked(keys: list) -> int:
    now = time.monotonic()
    remaining = max((_login_blocked_until.get(k, 0) - now for k in keys), default=0)
    return max(0, int(remaining))


def _login_failure(keys: list) -> None:
    now = time.monotonic()
    for key in keys:
        q = _login_failures[key]
        while q and q[0] <= now - LOGIN_WINDOW_SECONDS:
            q.popleft()
        q.append(now)
        if len(q) >= LOGIN_MAX_ATTEMPTS:
            _login_blocked_until[key] = now + LOGIN_BLOCK_SECONDS
            q.clear()


def _login_success(keys: list) -> None:
    for key in keys:
        _login_failures.pop(key, None)
        _login_blocked_until.pop(key, None)


@api_router.post("/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest, request: Request):
    emp_id = req.employee_id.strip().upper()
    fwd = request.headers.get("x-forwarded-for")
    ip = fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")
    keys = [f"ip:{ip}", f"emp:{emp_id[:64]}"]

    retry_after = _login_blocked(keys)
    if retry_after:
        raise HTTPException(
            429,
            "Too many login attempts. Try again in a few minutes.",
            headers={"Retry-After": str(retry_after)},
        )

    user = await db.users.find_one({"employee_id": emp_id})
    # Always run bcrypt (dummy hash for unknown IDs) to prevent user enumeration via timing.
    stored = user.get("password_hash") if user else DUMMY_HASH
    valid = await run_in_threadpool(verify_password, req.password, stored or DUMMY_HASH)
    if not user or not valid:
        _login_failure(keys)
        raise HTTPException(401, "Invalid Employee ID or password")
    if not user.get("active", True):
        raise HTTPException(403, "Account inactive")
    _login_success(keys)
    token = create_token(user["id"], user["role"])
    user.pop("_id", None)
    user.pop("password_hash", None)
    return {"token": token, "user": user}


@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


# ---------- Dashboard ----------
@api_router.get("/dashboard/salesperson")
async def salesperson_dashboard(user=Depends(get_current_user)):
    sp_id = user["id"]
    today_start = datetime.combine(datetime.now(timezone.utc).date(), datetime.min.time(), tzinfo=timezone.utc)

    # Today's target - fetch salesperson daily target
    target_doc = await db.targets.find_one(
        {"salesperson_id": sp_id, "period": "daily", "active": True},
        {"_id": 0},
    )
    today_target = target_doc["value"] if target_doc else 20000

    # Orders today
    orders_cursor = db.orders.find({"salesperson_id": sp_id, "created_at": {"$gte": today_start}}, {"_id": 0})
    orders = await orders_cursor.to_list(1000)
    todays_sales = sum(o.get("net_value", 0) for o in orders)

    visits_cursor = db.visits.find({"salesperson_id": sp_id, "start_time": {"$gte": today_start}}, {"_id": 0})
    visits = await visits_cursor.to_list(1000)

    new_retailers = await db.retailers.count_documents(
        {"created_by": sp_id, "created_at": {"$gte": today_start}}
    )

    coll_cursor = db.collections.find({"salesperson_id": sp_id, "created_at": {"$gte": today_start}}, {"_id": 0})
    collections_today = await coll_cursor.to_list(1000)
    today_collection = sum(c.get("amount", 0) for c in collections_today)

    # Today's beat
    weekday_name = datetime.now(timezone.utc).strftime("%A")
    beat = await db.beats.find_one({"salesperson_id": sp_id, "day": weekday_name}, {"_id": 0})
    beat_retailers = []
    if beat:
        rids = beat.get("retailer_ids", [])
        retailer_docs = await db.retailers.find({"id": {"$in": rids}}, {"_id": 0}).to_list(1000)
        rmap = {r["id"]: r for r in retailer_docs}
        visited_rids = {v["retailer_id"] for v in visits if v.get("end_time")}
        for rid in rids:
            r = rmap.get(rid)
            if not r:
                continue
            beat_retailers.append({
                "id": r["id"],
                "shop_name": r["shop_name"],
                "address": r.get("address", ""),
                "area": r.get("area", ""),
                "status": "Visited" if rid in visited_rids else "Pending",
            })

    return {
        "salesperson_name": user.get("name", ""),
        "today_target": today_target,
        "today_sales": round(todays_sales, 2),
        "today_orders": len(orders),
        "today_visits": len(visits),
        "new_retailers": new_retailers,
        "today_collection": round(today_collection, 2),
        "beat": {"day": weekday_name, "territory": beat.get("territory", "") if beat else "", "retailers": beat_retailers},
    }


# ---------- Retailers ----------
@api_router.get("/retailers")
async def list_retailers(user=Depends(get_current_user), q: Optional[str] = None):
    filt: dict = {}
    if user["role"] == "salesperson":
        filt["salesperson_id"] = user["id"]
    elif user["role"] == "distributor":
        filt["distributor_id"] = user["id"]
    if q:
        safe_q = re.escape(q)
        filt["$or"] = [
            {"shop_name": {"$regex": safe_q, "$options": "i"}},
            {"mobile": {"$regex": safe_q}},
            {"owner_name": {"$regex": safe_q, "$options": "i"}},
        ]
    docs = await db.retailers.find(filt, {"_id": 0}).sort("shop_name", 1).to_list(500)
    return docs


@api_router.get("/retailers/{retailer_id}")
async def get_retailer(retailer_id: str, user=Depends(get_current_user)):
    r = await db.retailers.find_one({"id": retailer_id}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Retailer not found")
    if user["role"] == "salesperson" and r.get("salesperson_id") != user["id"]:
        raise HTTPException(403, "Not permitted")
    if user["role"] == "distributor" and r.get("distributor_id") != user["id"]:
        raise HTTPException(403, "Not permitted")

    # Stats
    orders = await db.orders.find({"retailer_id": retailer_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    total_sales = sum(o.get("net_value", 0) for o in orders)
    now = datetime.now(timezone.utc)
    cm_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

    def _aware(dt):
        if dt and dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt

    current_month = sum(o.get("net_value", 0) for o in orders if o.get("created_at") and _aware(o["created_at"]) >= cm_start)
    recent_orders = orders[:5]
    recent_visits = await db.visits.find({"retailer_id": retailer_id}, {"_id": 0}).sort("start_time", -1).to_list(5)
    outstanding = r.get("outstanding", 0)
    r["stats"] = {
        "total_sales": round(total_sales, 2),
        "current_month_sales": round(current_month, 2),
        "outstanding": outstanding,
        "total_orders": len(orders),
        "avg_order_value": round(total_sales / len(orders), 2) if orders else 0,
        "last_order_date": orders[0]["created_at"].isoformat() if orders else None,
    }
    r["recent_orders"] = recent_orders
    r["recent_visits"] = recent_visits
    return r


@api_router.post("/retailers")
async def create_retailer(req: RetailerCreate, user=Depends(get_current_user)):
    # Duplicate detection
    existing = await db.retailers.find_one({"mobile": req.mobile}, {"_id": 0, "id": 1, "shop_name": 1})
    if existing:
        raise HTTPException(400, f"Retailer with mobile {req.mobile} already exists: {existing['shop_name']}")

    rid = str(uuid.uuid4())
    retailer_code = f"RTL{int(datetime.now(timezone.utc).timestamp() * 1000) % 1000000:06d}"
    doc = {
        "id": rid,
        "retailer_code": retailer_code,
        **req.dict(),
        "salesperson_id": user["id"] if user["role"] == "salesperson" else None,
        "classification": "C",
        "outstanding": 0,
        "status": "Active",
        "created_by": user["id"],
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.retailers.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------- Products ----------
@api_router.get("/products")
async def list_products(user=Depends(get_current_user), brand: Optional[str] = None):
    filt = {"active": True}
    if brand:
        filt["brand"] = brand
    docs = await db.products.find(filt, {"_id": 0}).sort("brand", 1).to_list(500)
    return docs


@api_router.get("/brands")
async def list_brands(user=Depends(get_current_user)):
    brands = await db.products.distinct("brand", {"active": True})
    return brands


# ---------- Visits ----------
@api_router.post("/visits/start")
async def start_visit(req: VisitStartRequest, user=Depends(get_current_user)):
    retailer = await db.retailers.find_one({"id": req.retailer_id}, {"_id": 0})
    if not retailer:
        raise HTTPException(404, "Retailer not found")
    if req.client_id:
        existing = await db.visits.find_one({"id": req.client_id}, {"_id": 0})
        if existing:
            return existing
    vid = req.client_id or str(uuid.uuid4())
    start_time = now_utc()
    if req.client_time:
        try:
            start_time = datetime.fromisoformat(req.client_time.replace("Z", "+00:00"))
        except ValueError:
            pass
    doc = {
        "id": vid,
        "retailer_id": req.retailer_id,
        "retailer_name": retailer.get("shop_name"),
        "salesperson_id": user["id"],
        "start_time": start_time,
        "start_lat": req.latitude,
        "start_lng": req.longitude,
        "gps_accuracy": req.gps_accuracy,
        "gps_verified": bool(req.latitude and req.longitude),
        "created_at": now_utc(),
    }
    await db.visits.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.post("/visits/complete")
async def complete_visit(req: VisitCompleteRequest, user=Depends(get_current_user)):
    v = await db.visits.find_one({"id": req.visit_id})
    if not v:
        raise HTTPException(404, "Visit not found")
    if v.get("salesperson_id") != user["id"]:
        raise HTTPException(403, "Not permitted")
    if req.result == "NO_ORDER" and not req.no_order_reason:
        raise HTTPException(400, "No-order reason required")
    end = now_utc()
    if req.client_time:
        try:
            end = datetime.fromisoformat(req.client_time.replace("Z", "+00:00"))
        except ValueError:
            pass
    duration = (end - v["start_time"].replace(tzinfo=timezone.utc)).total_seconds() // 60 if v.get("start_time") else 0
    await db.visits.update_one(
        {"id": req.visit_id},
        {"$set": {
            "end_time": end,
            "end_lat": req.latitude,
            "end_lng": req.longitude,
            "result": req.result,
            "no_order_reason": req.no_order_reason,
            "remarks": req.remarks,
            "duration_minutes": duration,
            "updated_at": end,
        }},
    )
    return {"ok": True, "duration_minutes": duration}


@api_router.get("/visits")
async def list_visits(user=Depends(get_current_user), retailer_id: Optional[str] = None):
    filt = {"salesperson_id": user["id"]} if user["role"] == "salesperson" else {}
    if retailer_id:
        filt["retailer_id"] = retailer_id
    docs = await db.visits.find(filt, {"_id": 0}).sort("start_time", -1).to_list(200)
    return docs


# ---------- Schemes ----------
async def calculate_scheme(brand: str, total_qty_for_brand: int):
    scheme = await db.schemes.find_one({"brand": brand, "active": True}, {"_id": 0})
    if not scheme:
        return None
    eligible = None
    for slab in sorted(scheme.get("slabs", []), key=lambda s: s["min_qty"]):
        if total_qty_for_brand >= slab["min_qty"]:
            eligible = slab
    if eligible:
        return {"scheme_name": scheme["name"], "brand": brand, "slab": eligible, "qty": total_qty_for_brand}
    return None


@api_router.post("/schemes/calculate")
async def scheme_calc(payload: dict, user=Depends(get_current_user)):
    # payload = {"items":[{product_id, quantity}]}
    items = payload.get("items", [])
    brand_totals: dict = {}
    for it in items:
        p = await db.products.find_one({"id": it["product_id"]}, {"_id": 0})
        if not p:
            continue
        brand_totals[p["brand"]] = brand_totals.get(p["brand"], 0) + int(it.get("quantity", 0))
    results = []
    for brand, qty in brand_totals.items():
        s = await calculate_scheme(brand, qty)
        if s:
            results.append(s)
    return {"schemes": results}


# ---------- Orders ----------
@api_router.post("/orders")
async def create_order(req: OrderCreate, user=Depends(get_current_user)):
    if not req.items:
        raise HTTPException(400, "Order must have at least one item")
    if req.client_id:
        existing = await db.orders.find_one({"client_id": req.client_id}, {"_id": 0})
        if existing:
            return existing
    retailer = await db.retailers.find_one({"id": req.retailer_id}, {"_id": 0})
    if not retailer:
        raise HTTPException(404, "Retailer not found")

    order_items = []
    subtotal = 0.0
    discount_total = 0.0
    brand_qty: dict = {}
    for it in req.items:
        p = await db.products.find_one({"id": it.product_id}, {"_id": 0})
        if not p:
            raise HTTPException(400, f"Product not found: {it.product_id}")
        amt = it.quantity * it.rate
        disc = it.discount or 0
        subtotal += amt
        discount_total += disc
        brand_qty[p["brand"]] = brand_qty.get(p["brand"], 0) + it.quantity
        order_items.append({
            "product_id": p["id"],
            "brand": p["brand"],
            "product_name": p["name"],
            "pack_size": p.get("pack_size", ""),
            "sku_code": p.get("sku_code", ""),
            "mrp": p.get("mrp", 0),
            "quantity": it.quantity,
            "rate": it.rate,
            "discount": disc,
            "amount": amt - disc,
        })

    schemes = []
    for brand, qty in brand_qty.items():
        s = await calculate_scheme(brand, qty)
        if s:
            schemes.append(s)

    net_value = subtotal - discount_total
    order_no = f"ORD{int(datetime.now(timezone.utc).timestamp())}"
    oid = str(uuid.uuid4())
    doc = {
        "id": oid,
        "order_no": order_no,
        "client_id": req.client_id,
        "retailer_id": req.retailer_id,
        "retailer_name": retailer.get("shop_name"),
        "salesperson_id": user["id"],
        "salesperson_name": user.get("name"),
        "distributor_id": retailer.get("distributor_id"),
        "items": order_items,
        "subtotal": round(subtotal, 2),
        "discount": round(discount_total, 2),
        "net_value": round(net_value, 2),
        "schemes": schemes,
        "status": "Submitted",
        "remarks": req.remarks,
        "created_by": user["id"],
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.orders.insert_one(doc)
    doc.pop("_id", None)

    # Audit log
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "entity": "order",
        "entity_id": oid,
        "action": "create",
        "user_id": user["id"],
        "created_at": now_utc(),
    })

    # Scheme claims
    for s in schemes:
        await db.scheme_claims.insert_one({
            "id": str(uuid.uuid4()),
            "retailer_id": req.retailer_id,
            "order_id": oid,
            "brand": s["brand"],
            "scheme_name": s["scheme_name"],
            "article": s["slab"].get("article"),
            "qty": s["qty"],
            "distributor_id": retailer.get("distributor_id"),
            "status": "Pending",
            "created_at": now_utc(),
        })

    return doc


@api_router.get("/orders")
async def list_orders(user=Depends(get_current_user), retailer_id: Optional[str] = None):
    filt: dict = {}
    if user["role"] == "salesperson":
        filt["salesperson_id"] = user["id"]
    elif user["role"] == "distributor":
        filt["distributor_id"] = user["id"]
    if retailer_id:
        filt["retailer_id"] = retailer_id
    docs = await db.orders.find(filt, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, user=Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    if user["role"] == "salesperson" and o.get("salesperson_id") != user["id"]:
        raise HTTPException(403, "Not permitted")
    if user["role"] == "distributor" and o.get("distributor_id") != user["id"]:
        raise HTTPException(403, "Not permitted")
    return o


# ---------- Collections ----------
@api_router.post("/collections")
async def create_collection(req: CollectionCreate, user=Depends(get_current_user)):
    if user["role"] not in ("salesperson", "super_admin", "sales_manager"):
        raise HTTPException(403, "Not permitted")
    if req.amount <= 0:
        raise HTTPException(400, "Amount must be greater than zero")
    if req.amount > 10_000_000:
        raise HTTPException(400, "Amount exceeds allowed limit")
    retailer = await db.retailers.find_one({"id": req.retailer_id})
    if not retailer:
        raise HTTPException(404, "Retailer not found")
    if user["role"] == "salesperson" and retailer.get("salesperson_id") not in (None, user["id"]):
        raise HTTPException(403, "Retailer is not assigned to you")
    cid = str(uuid.uuid4())
    doc = {
        "id": cid,
        "retailer_id": req.retailer_id,
        "retailer_name": retailer.get("shop_name"),
        "salesperson_id": user["id"],
        "amount": req.amount,
        "mode": req.mode,
        "reference_no": req.reference_no,
        "remarks": req.remarks,
        "receipt_photo": req.receipt_photo,
        "created_at": now_utc(),
    }
    await db.collections.insert_one(doc)
    # Reduce outstanding
    await db.retailers.update_one(
        {"id": req.retailer_id},
        {"$inc": {"outstanding": -req.amount}, "$set": {"updated_at": now_utc()}},
    )
    doc.pop("_id", None)
    return doc


@api_router.get("/collections")
async def list_collections(user=Depends(get_current_user), retailer_id: Optional[str] = None):
    if user["role"] == "distributor":
        raise HTTPException(403, "Not permitted")
    filt: dict = {}
    if user["role"] == "salesperson":
        filt["salesperson_id"] = user["id"]
    if retailer_id:
        filt["retailer_id"] = retailer_id
    docs = await db.collections.find(filt, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


# ---------- Uploads ----------
@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), user=Depends(get_current_user)):
    ext = (file.filename or "bin").split(".")[-1].lower()
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    result = await run_in_threadpool(put_object, path, data, file.content_type or "application/octet-stream")
    await db.uploads.insert_one({
        "id": str(uuid.uuid4()),
        "path": result["path"],
        "owner_id": user["id"],
        "content_type": file.content_type,
        "size": result.get("size"),
        "created_at": now_utc(),
    })
    return {"path": result["path"], "size": result.get("size")}


@api_router.get("/files/{path:path}")
async def download_file(path: str, user=Depends(get_current_user)):
    rec = await db.uploads.find_one({"path": path}, {"_id": 0})
    if not rec:
        raise HTTPException(404, "File not found")
    if rec.get("owner_id") != user["id"] and user["role"] not in ("super_admin", "sales_manager"):
        raise HTTPException(403, "Not permitted")
    content, ctype = await run_in_threadpool(get_object, path)
    return Response(content=content, media_type=ctype)


# ---------- Seeder (startup only — no public endpoint) ----------
async def seed_data():
    # Users
    if await db.users.count_documents({}) > 0:
        return {"ok": True, "message": "Data already seeded"}

    users = [
        {"employee_id": "EMP001", "name": "Rajesh Patel", "role": "super_admin", "mobile": "9800000001", "password": "admin@123"},
        {"employee_id": "EMP002", "name": "Anita Deshmukh", "role": "sales_manager", "mobile": "9800000002", "password": "manager@123", "territory": "Kolhapur Zone"},
        {"employee_id": "EMP003", "name": "Suresh Kumar", "role": "salesperson", "mobile": "9800000003", "password": "sales@123", "territory": "Kolhapur City"},
        {"employee_id": "EMP004", "name": "Mahesh Traders", "role": "distributor", "mobile": "9800000004", "password": "dist@123", "territory": "Kolhapur"},
        {"employee_id": "EMP005", "name": "Prakash Jadhav", "role": "salesperson", "mobile": "9800000005", "password": "sales@123", "territory": "Kagal"},
        {"employee_id": "EMP006", "name": "Vikram Shinde", "role": "salesperson", "mobile": "9800000006", "password": "sales@123", "territory": "Ichalkaranji"},
    ]
    user_ids: dict = {}
    for u in users:
        uid = str(uuid.uuid4())
        user_ids[u["employee_id"]] = uid
        doc = {
            "id": uid,
            "employee_id": u["employee_id"],
            "name": u["name"],
            "role": u["role"],
            "mobile": u["mobile"],
            "territory": u.get("territory", ""),
            "password_hash": hash_password(u["password"]),
            "active": True,
            "created_at": now_utc(),
        }
        await db.users.insert_one(doc)

    # Products - brands: DHAMAL, FOAMATIC, PRISTYN, SCRUB & SHINE
    products = [
        # DHAMAL - Detergent Powder
        {"brand": "DHAMAL", "name": "DHAMAL Detergent Powder", "category": "Detergent Powder", "pack_size": "500g", "sku_code": "DHM-DP-500", "mrp": 55, "distributor_rate": 42, "retailer_rate": 46, "salesperson_rate": 48},
        {"brand": "DHAMAL", "name": "DHAMAL Detergent Powder", "category": "Detergent Powder", "pack_size": "1kg", "sku_code": "DHM-DP-1K", "mrp": 105, "distributor_rate": 80, "retailer_rate": 88, "salesperson_rate": 92},
        {"brand": "DHAMAL", "name": "DHAMAL Detergent Powder", "category": "Detergent Powder", "pack_size": "1.4kg", "sku_code": "DHM-DP-14", "mrp": 145, "distributor_rate": 110, "retailer_rate": 120, "salesperson_rate": 125},
        {"brand": "DHAMAL", "name": "DHAMAL Detergent Bar", "category": "Detergent Bar", "pack_size": "250g", "sku_code": "DHM-DB-250", "mrp": 30, "distributor_rate": 22, "retailer_rate": 25, "salesperson_rate": 27},

        # FOAMATIC
        {"brand": "FOAMATIC", "name": "FOAMATIC Detergent Powder", "category": "Detergent Powder", "pack_size": "1kg", "sku_code": "FOM-DP-1K", "mrp": 115, "distributor_rate": 90, "retailer_rate": 98, "salesperson_rate": 102},
        {"brand": "FOAMATIC", "name": "FOAMATIC Liquid Detergent", "category": "Liquid Detergent", "pack_size": "500ml", "sku_code": "FOM-LD-500", "mrp": 145, "distributor_rate": 110, "retailer_rate": 120, "salesperson_rate": 128},
        {"brand": "FOAMATIC", "name": "FOAMATIC Liquid Detergent", "category": "Liquid Detergent", "pack_size": "1L", "sku_code": "FOM-LD-1L", "mrp": 270, "distributor_rate": 210, "retailer_rate": 230, "salesperson_rate": 245},

        # PRISTYN - Floor & Cleaning
        {"brand": "PRISTYN", "name": "PRISTYN Floor Cleaner", "category": "Floor Cleaner", "pack_size": "500ml", "sku_code": "PRS-FC-500", "mrp": 85, "distributor_rate": 60, "retailer_rate": 68, "salesperson_rate": 72},
        {"brand": "PRISTYN", "name": "PRISTYN Floor Cleaner", "category": "Floor Cleaner", "pack_size": "1L", "sku_code": "PRS-FC-1L", "mrp": 160, "distributor_rate": 118, "retailer_rate": 130, "salesperson_rate": 138},
        {"brand": "PRISTYN", "name": "PRISTYN Glass Cleaner", "category": "Glass Cleaner", "pack_size": "500ml", "sku_code": "PRS-GC-500", "mrp": 120, "distributor_rate": 90, "retailer_rate": 100, "salesperson_rate": 105},
        {"brand": "PRISTYN", "name": "PRISTYN Multipurpose Cleaner", "category": "Multipurpose Cleaner", "pack_size": "500ml", "sku_code": "PRS-MP-500", "mrp": 110, "distributor_rate": 82, "retailer_rate": 92, "salesperson_rate": 98},

        # SCRUB & SHINE
        {"brand": "SCRUB & SHINE", "name": "Scrub & Shine Dishwash Liquid", "category": "Dishwash", "pack_size": "500ml", "sku_code": "SNS-DW-500", "mrp": 125, "distributor_rate": 92, "retailer_rate": 102, "salesperson_rate": 108},
        {"brand": "SCRUB & SHINE", "name": "Scrub & Shine Dishwash Bar", "category": "Dishwash", "pack_size": "200g", "sku_code": "SNS-DB-200", "mrp": 25, "distributor_rate": 18, "retailer_rate": 21, "salesperson_rate": 23},
        {"brand": "SCRUB & SHINE", "name": "Scrub & Shine Dishwash Gel", "category": "Dishwash", "pack_size": "1L", "sku_code": "SNS-DG-1L", "mrp": 220, "distributor_rate": 168, "retailer_rate": 185, "salesperson_rate": 195},
    ]
    for p in products:
        await db.products.insert_one({
            "id": str(uuid.uuid4()),
            **p,
            "gst": 18,
            "active": True,
            "created_at": now_utc(),
        })

    # Schemes
    await db.schemes.insert_one({
        "id": str(uuid.uuid4()),
        "name": "DHAMAL Retailer Scheme",
        "brand": "DHAMAL",
        "start_date": now_utc(),
        "end_date": now_utc() + timedelta(days=90),
        "active": True,
        "slabs": [
            {"min_qty": 3, "article": "Masala Box"},
            {"min_qty": 5, "article": "Travelling Bag"},
            {"min_qty": 10, "article": "Insulated Tiffin"},
            {"min_qty": 15, "article": "Sitting Stool"},
            {"min_qty": 20, "article": "Trolley Bag"},
        ],
        "created_at": now_utc(),
    })
    await db.schemes.insert_one({
        "id": str(uuid.uuid4()),
        "name": "FOAMATIC Retailer Bonanza",
        "brand": "FOAMATIC",
        "active": True,
        "start_date": now_utc(),
        "end_date": now_utc() + timedelta(days=60),
        "slabs": [
            {"min_qty": 5, "article": "Steel Tumbler Set"},
            {"min_qty": 10, "article": "Casserole"},
            {"min_qty": 20, "article": "Pressure Cooker"},
        ],
        "created_at": now_utc(),
    })

    # Retailers (50)
    sp_ids = [user_ids["EMP003"], user_ids["EMP005"], user_ids["EMP006"]]
    dist_id = user_ids["EMP004"]
    areas = ["Rajaram Rd", "Shivaji Peth", "Mahadwar Rd", "Rankala", "Tarabai Park", "Kasba Bawada", "Nagala Park", "Laxmipuri"]
    cities = ["Kolhapur", "Kagal", "Ichalkaranji"]
    shop_types = ["Kirana", "General Store", "Supermarket", "Cleaning Material Store", "Hardware"]
    potentials = ["High", "Medium", "Low"]
    sample_owners = ["Ramesh", "Sunil", "Ganesh", "Ajay", "Mohan", "Deepak", "Amar", "Kishor", "Vinod", "Sachin"]
    sample_shops = ["Shree Traders", "Ganesh Stores", "ABC General Store", "Balaji Kirana", "Om Sai Store", "Laxmi Traders", "Datta Stores", "Sai Kirana", "Krishna Mart", "Jyoti General", "Anand Store", "Vijay Traders", "Rajesh Stores", "Sneha Kirana", "Vaibhav Mart"]

    import random
    random.seed(42)
    retailer_ids: List[str] = []
    for i in range(50):
        rid = str(uuid.uuid4())
        sp_idx = i % 3
        sp = sp_ids[sp_idx]
        outstanding = random.choice([0, 1500, 3200, 4800, 7500, 12500, 0, 0])
        retailer_code = f"RTL{1001+i:06d}"
        doc = {
            "id": rid,
            "retailer_code": retailer_code,
            "shop_name": f"{random.choice(sample_shops)} {i+1}",
            "owner_name": random.choice(sample_owners) + " " + random.choice(["Patil", "Kulkarni", "Sharma", "Joshi", "Kadam"]),
            "mobile": f"98{random.randint(10000000, 99999999)}",
            "address": f"{random.randint(1, 200)}, {random.choice(areas)}",
            "area": random.choice(areas),
            "city": cities[sp_idx],
            "district": "Kolhapur",
            "state": "Maharashtra",
            "pincode": f"41{random.randint(1000, 9999)}",
            "latitude": 16.7050 + random.uniform(-0.05, 0.05),
            "longitude": 74.2433 + random.uniform(-0.05, 0.05),
            "retailer_type": random.choice(shop_types),
            "potential": random.choice(potentials),
            "salesperson_id": sp,
            "distributor_id": dist_id,
            "classification": random.choice(["A", "B", "C"]),
            "outstanding": outstanding,
            "status": "Active",
            "created_by": user_ids["EMP001"],
            "created_at": now_utc() - timedelta(days=random.randint(1, 200)),
            "updated_at": now_utc(),
        }
        await db.retailers.insert_one(doc)
        retailer_ids.append(rid)

    # Beat plan for salesperson EMP003 for each weekday
    weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    territories = ["Kolhapur City", "Kagal", "Ichalkaranji", "Gadhinglaj", "Radhanagari", "Kolhapur City"]
    sp003_retailers = [r for r in retailer_ids[:30]]  # first 30 belong roughly to sp003
    # Build beats: 5 retailers per weekday for EMP003
    for i, day in enumerate(weekdays):
        chunk = sp003_retailers[i * 5:(i + 1) * 5]
        await db.beats.insert_one({
            "id": str(uuid.uuid4()),
            "salesperson_id": user_ids["EMP003"],
            "day": day,
            "territory": territories[i],
            "retailer_ids": chunk,
            "created_at": now_utc(),
        })

    # Daily target for EMP003
    await db.targets.insert_one({
        "id": str(uuid.uuid4()),
        "salesperson_id": user_ids["EMP003"],
        "period": "daily",
        "metric": "sales_value",
        "value": 20000,
        "active": True,
        "created_at": now_utc(),
    })
    await db.targets.insert_one({
        "id": str(uuid.uuid4()),
        "salesperson_id": user_ids["EMP003"],
        "period": "monthly",
        "metric": "sales_value",
        "value": 500000,
        "active": True,
        "created_at": now_utc(),
    })

    return {"ok": True, "users": len(users), "products": len(products), "retailers": 50}


# ---------- Attendance / Expenses / Complaints / Admin ----------
IST = timezone(timedelta(hours=5, minutes=30))


def ist_date_str() -> str:
    return datetime.now(IST).strftime("%Y-%m-%d")


def require_admin(user: dict):
    if user["role"] not in ("super_admin", "sales_manager"):
        raise HTTPException(403, "Admin access required")


def _aware_dt(dt):
    if dt and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


class GpsPunch(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ExpenseCreate(BaseModel):
    category: str  # Travel | Fuel | Food | Lodging | Other
    amount: float
    expense_date: Optional[str] = None  # YYYY-MM-DD
    remarks: Optional[str] = ""
    bill_photo: Optional[str] = None


class ComplaintCreate(BaseModel):
    retailer_id: str
    category: str
    description: str
    photo_path: Optional[str] = None


class ReviewRequest(BaseModel):
    status: str
    comment: Optional[str] = ""


class ProductCreate(BaseModel):
    brand: str
    name: str
    category: Optional[str] = ""
    pack_size: Optional[str] = ""
    sku_code: str
    mrp: float
    distributor_rate: float = 0
    retailer_rate: float = 0
    salesperson_rate: float = 0
    gst: float = 18
    active: bool = True


class ProductUpdate(BaseModel):
    brand: Optional[str] = None
    name: Optional[str] = None
    category: Optional[str] = None
    pack_size: Optional[str] = None
    sku_code: Optional[str] = None
    mrp: Optional[float] = None
    distributor_rate: Optional[float] = None
    retailer_rate: Optional[float] = None
    salesperson_rate: Optional[float] = None
    gst: Optional[float] = None
    active: Optional[bool] = None


class UserCreate(BaseModel):
    employee_id: str
    name: str
    role: str  # super_admin | sales_manager | salesperson | distributor
    mobile: Optional[str] = ""
    territory: Optional[str] = ""
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    mobile: Optional[str] = None
    territory: Optional[str] = None
    password: Optional[str] = None
    active: Optional[bool] = None


# ----- Attendance -----
@api_router.get("/attendance/today")
async def attendance_today(user=Depends(get_current_user)):
    doc = await db.attendance.find_one({"salesperson_id": user["id"], "date": ist_date_str()}, {"_id": 0})
    return doc


@api_router.post("/attendance/start")
async def attendance_start(req: GpsPunch, user=Depends(get_current_user)):
    date = ist_date_str()
    existing = await db.attendance.find_one({"salesperson_id": user["id"], "date": date}, {"_id": 0})
    if existing:
        raise HTTPException(400, "Day already started")
    doc = {
        "id": str(uuid.uuid4()),
        "salesperson_id": user["id"],
        "salesperson_name": user.get("name"),
        "date": date,
        "start_time": now_utc(),
        "start_lat": req.latitude,
        "start_lng": req.longitude,
        "created_at": now_utc(),
    }
    await db.attendance.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.post("/attendance/end")
async def attendance_end(req: GpsPunch, user=Depends(get_current_user)):
    date = ist_date_str()
    doc = await db.attendance.find_one({"salesperson_id": user["id"], "date": date})
    if not doc:
        raise HTTPException(400, "Start your day first")
    if doc.get("end_time"):
        raise HTTPException(400, "Day already ended")
    end = now_utc()
    duration = int((end - _aware_dt(doc["start_time"])).total_seconds() // 60)
    await db.attendance.update_one(
        {"id": doc["id"]},
        {"$set": {"end_time": end, "end_lat": req.latitude, "end_lng": req.longitude, "duration_minutes": duration}},
    )
    updated = await db.attendance.find_one({"id": doc["id"]}, {"_id": 0})
    return updated


@api_router.get("/attendance")
async def attendance_list(user=Depends(get_current_user), salesperson_id: Optional[str] = None):
    if user["role"] in ("super_admin", "sales_manager"):
        filt = {"salesperson_id": salesperson_id} if salesperson_id else {}
    else:
        filt = {"salesperson_id": user["id"]}
    docs = await db.attendance.find(filt, {"_id": 0}).sort("date", -1).to_list(90)
    return docs


# ----- Expenses -----
@api_router.post("/expenses")
async def create_expense(req: ExpenseCreate, user=Depends(get_current_user)):
    if req.amount <= 0:
        raise HTTPException(400, "Amount must be greater than zero")
    doc = {
        "id": str(uuid.uuid4()),
        "salesperson_id": user["id"],
        "salesperson_name": user.get("name"),
        "expense_date": req.expense_date or ist_date_str(),
        "category": req.category,
        "amount": req.amount,
        "remarks": req.remarks,
        "bill_photo": req.bill_photo,
        "status": "Pending",
        "created_at": now_utc(),
    }
    await db.expenses.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/expenses")
async def list_expenses(user=Depends(get_current_user), status: Optional[str] = None):
    filt: dict = {} if user["role"] in ("super_admin", "sales_manager") else {"salesperson_id": user["id"]}
    if status:
        filt["status"] = status
    docs = await db.expenses.find(filt, {"_id": 0}).sort("created_at", -1).to_list(300)
    return docs


@api_router.put("/expenses/{expense_id}/review")
async def review_expense(expense_id: str, req: ReviewRequest, user=Depends(get_current_user)):
    require_admin(user)
    if req.status not in ("Approved", "Rejected"):
        raise HTTPException(400, "Status must be Approved or Rejected")
    res = await db.expenses.update_one(
        {"id": expense_id},
        {"$set": {"status": req.status, "review_comment": req.comment, "reviewed_by": user.get("name"), "reviewed_at": now_utc()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Expense not found")
    return await db.expenses.find_one({"id": expense_id}, {"_id": 0})


# ----- Complaints -----
@api_router.post("/complaints")
async def create_complaint(req: ComplaintCreate, user=Depends(get_current_user)):
    retailer = await db.retailers.find_one({"id": req.retailer_id}, {"_id": 0})
    if not retailer:
        raise HTTPException(404, "Retailer not found")
    doc = {
        "id": str(uuid.uuid4()),
        "complaint_no": f"CMP{int(datetime.now(timezone.utc).timestamp())}",
        "retailer_id": req.retailer_id,
        "retailer_name": retailer.get("shop_name"),
        "salesperson_id": user["id"],
        "salesperson_name": user.get("name"),
        "category": req.category,
        "description": req.description,
        "photo_path": req.photo_path,
        "status": "Open",
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.complaints.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/complaints")
async def list_complaints(user=Depends(get_current_user), status: Optional[str] = None):
    filt: dict = {} if user["role"] in ("super_admin", "sales_manager") else {"salesperson_id": user["id"]}
    if status:
        filt["status"] = status
    docs = await db.complaints.find(filt, {"_id": 0}).sort("created_at", -1).to_list(300)
    return docs


@api_router.put("/complaints/{complaint_id}/review")
async def review_complaint(complaint_id: str, req: ReviewRequest, user=Depends(get_current_user)):
    require_admin(user)
    if req.status not in ("Open", "In Progress", "Resolved"):
        raise HTTPException(400, "Invalid status")
    update: dict = {"status": req.status, "updated_at": now_utc()}
    if req.status == "Resolved":
        update["resolution_note"] = req.comment
        update["resolved_by"] = user.get("name")
        update["resolved_at"] = now_utc()
    res = await db.complaints.update_one({"id": complaint_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Complaint not found")
    return await db.complaints.find_one({"id": complaint_id}, {"_id": 0})


# ----- Admin: Overview -----
@api_router.get("/admin/overview")
async def admin_overview(user=Depends(get_current_user), range: str = "30d"):
    require_admin(user)
    now = now_utc()
    start = None
    if range == "today":
        start = datetime.combine(now.date(), datetime.min.time(), tzinfo=timezone.utc)
    elif range == "7d":
        start = now - timedelta(days=7)
    elif range == "30d":
        start = now - timedelta(days=30)

    created_filt = {"created_at": {"$gte": start}} if start else {}
    orders = await db.orders.find(created_filt, {"_id": 0}).sort("created_at", -1).to_list(5000)
    total_sales = sum(o.get("net_value", 0) for o in orders)

    visit_filt = {"start_time": {"$gte": start}} if start else {}
    visits = await db.visits.find(visit_filt, {"_id": 0, "salesperson_id": 1}).to_list(5000)

    colls = await db.collections.find(created_filt, {"_id": 0}).to_list(5000)
    total_collection = sum(c.get("amount", 0) for c in colls)

    new_retailers = await db.retailers.count_documents(created_filt)
    active_retailers = await db.retailers.count_documents({"status": "Active"})
    out_agg = await db.retailers.aggregate([{"$group": {"_id": None, "t": {"$sum": "$outstanding"}}}]).to_list(1)
    total_outstanding = round(out_agg[0]["t"], 2) if out_agg else 0

    # Salesperson summary
    sps = await db.users.find({"role": "salesperson"}, {"_id": 0, "password_hash": 0}).to_list(200)
    sp_stats = {s["id"]: {"sales": 0.0, "orders": 0, "collection": 0.0, "visits": 0} for s in sps}
    for o in orders:
        st = sp_stats.get(o.get("salesperson_id"))
        if st:
            st["sales"] += o.get("net_value", 0)
            st["orders"] += 1
    for c in colls:
        st = sp_stats.get(c.get("salesperson_id"))
        if st:
            st["collection"] += c.get("amount", 0)
    for v in visits:
        st = sp_stats.get(v.get("salesperson_id"))
        if st:
            st["visits"] += 1
    salesperson_summary = [
        {
            "id": s["id"],
            "name": s["name"],
            "employee_id": s["employee_id"],
            "territory": s.get("territory", ""),
            "sales": round(sp_stats[s["id"]]["sales"], 2),
            "orders": sp_stats[s["id"]]["orders"],
            "visits": sp_stats[s["id"]]["visits"],
            "collection": round(sp_stats[s["id"]]["collection"], 2),
        }
        for s in sps
    ]
    salesperson_summary.sort(key=lambda x: -x["sales"])

    # Brand summary
    brand_stats: dict = {}
    for o in orders:
        for it in o.get("items", []):
            b = it.get("brand", "OTHER")
            bs = brand_stats.setdefault(b, {"qty": 0, "value": 0.0})
            bs["qty"] += it.get("quantity", 0)
            bs["value"] += it.get("amount", 0)
    brand_summary = [
        {"brand": b, "qty": v["qty"], "value": round(v["value"], 2)}
        for b, v in sorted(brand_stats.items(), key=lambda kv: -kv[1]["value"])
    ]

    pending_expenses = await db.expenses.count_documents({"status": "Pending"})
    open_complaints = await db.complaints.count_documents({"status": {"$in": ["Open", "In Progress"]}})

    return {
        "range": range,
        "total_sales": round(total_sales, 2),
        "total_orders": len(orders),
        "total_visits": len(visits),
        "total_collection": round(total_collection, 2),
        "new_retailers": new_retailers,
        "active_retailers": active_retailers,
        "total_outstanding": total_outstanding,
        "pending_expenses": pending_expenses,
        "open_complaints": open_complaints,
        "salesperson_summary": salesperson_summary,
        "brand_summary": brand_summary,
        "recent_orders": orders[:10],
    }


# ----- Admin: Products CRUD -----
@api_router.get("/admin/products")
async def admin_products(user=Depends(get_current_user)):
    require_admin(user)
    return await db.products.find({}, {"_id": 0}).sort([("brand", 1), ("name", 1)]).to_list(1000)


@api_router.post("/admin/products")
async def admin_create_product(req: ProductCreate, user=Depends(get_current_user)):
    require_admin(user)
    existing = await db.products.find_one({"sku_code": req.sku_code}, {"_id": 0, "sku_code": 1})
    if existing:
        raise HTTPException(400, f"SKU code {req.sku_code} already exists")
    doc = {"id": str(uuid.uuid4()), **req.dict(), "created_at": now_utc(), "updated_at": now_utc()}
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/admin/products/{product_id}")
async def admin_update_product(product_id: str, req: ProductUpdate, user=Depends(get_current_user)):
    require_admin(user)
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Nothing to update")
    if "sku_code" in updates:
        dup = await db.products.find_one({"sku_code": updates["sku_code"], "id": {"$ne": product_id}})
        if dup:
            raise HTTPException(400, f"SKU code {updates['sku_code']} already exists")
    updates["updated_at"] = now_utc()
    res = await db.products.update_one({"id": product_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Product not found")
    return await db.products.find_one({"id": product_id}, {"_id": 0})


# ----- Admin: Users CRUD -----
@api_router.get("/admin/users")
async def admin_users(user=Depends(get_current_user)):
    require_admin(user)
    return await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("employee_id", 1).to_list(500)


@api_router.post("/admin/users")
async def admin_create_user(req: UserCreate, user=Depends(get_current_user)):
    require_admin(user)
    if req.role not in ("super_admin", "sales_manager", "salesperson", "distributor"):
        raise HTTPException(400, "Invalid role")
    emp_id = req.employee_id.strip().upper()
    existing = await db.users.find_one({"employee_id": emp_id})
    if existing:
        raise HTTPException(400, f"Employee ID {emp_id} already exists")
    if len(req.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    doc = {
        "id": str(uuid.uuid4()),
        "employee_id": emp_id,
        "name": req.name,
        "role": req.role,
        "mobile": req.mobile,
        "territory": req.territory,
        "password_hash": hash_password(req.password),
        "active": True,
        "created_at": now_utc(),
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


@api_router.put("/admin/users/{user_id}")
async def admin_update_user(user_id: str, req: UserUpdate, user=Depends(get_current_user)):
    require_admin(user)
    updates = {k: v for k, v in req.dict().items() if v is not None}
    if "role" in updates and updates["role"] not in ("super_admin", "sales_manager", "salesperson", "distributor"):
        raise HTTPException(400, "Invalid role")
    if "password" in updates:
        if len(updates["password"]) < 6:
            raise HTTPException(400, "Password must be at least 6 characters")
        updates["password_hash"] = hash_password(updates.pop("password"))
    if not updates:
        raise HTTPException(400, "Nothing to update")
    updates["updated_at"] = now_utc()
    res = await db.users.update_one({"id": user_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "User not found")
    return await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})


# ----- Admin: Targets -----
class TargetSet(BaseModel):
    salesperson_id: str
    period: str  # daily | monthly
    value: float


@api_router.get("/admin/targets")
async def admin_targets(user=Depends(get_current_user)):
    require_admin(user)
    sps = await db.users.find({"role": "salesperson"}, {"_id": 0, "password_hash": 0}).sort("employee_id", 1).to_list(200)
    targets = await db.targets.find({"active": True}, {"_id": 0}).to_list(1000)
    tmap: dict = {}
    for t in targets:
        tmap.setdefault(t["salesperson_id"], {})[t["period"]] = t["value"]
    return [
        {
            "id": s["id"],
            "name": s["name"],
            "employee_id": s["employee_id"],
            "territory": s.get("territory", ""),
            "active": s.get("active", True),
            "daily_target": tmap.get(s["id"], {}).get("daily", 0),
            "monthly_target": tmap.get(s["id"], {}).get("monthly", 0),
        }
        for s in sps
    ]


@api_router.post("/admin/targets")
async def admin_set_target(req: TargetSet, user=Depends(get_current_user)):
    require_admin(user)
    if req.period not in ("daily", "monthly"):
        raise HTTPException(400, "Period must be daily or monthly")
    if req.value < 0:
        raise HTTPException(400, "Target must be zero or more")
    sp = await db.users.find_one({"id": req.salesperson_id, "role": "salesperson"})
    if not sp:
        raise HTTPException(404, "Salesperson not found")
    await db.targets.update_many(
        {"salesperson_id": req.salesperson_id, "period": req.period, "active": True},
        {"$set": {"active": False}},
    )
    doc = {
        "id": str(uuid.uuid4()),
        "salesperson_id": req.salesperson_id,
        "period": req.period,
        "metric": "sales_value",
        "value": req.value,
        "active": True,
        "set_by": user["id"],
        "created_at": now_utc(),
    }
    await db.targets.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ----- Salesperson Performance -----
def _month_add(y: int, m: int, delta: int):
    idx = y * 12 + (m - 1) + delta
    return idx // 12, idx % 12 + 1


@api_router.get("/performance")
async def performance(user=Depends(get_current_user)):
    sp_id = user["id"]
    now = now_utc()
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    today_start = datetime.combine(now.date(), datetime.min.time(), tzinfo=timezone.utc)

    daily_t = await db.targets.find_one({"salesperson_id": sp_id, "period": "daily", "active": True}, {"_id": 0})
    monthly_t = await db.targets.find_one({"salesperson_id": sp_id, "period": "monthly", "active": True}, {"_id": 0})
    daily_target = daily_t["value"] if daily_t else 0
    monthly_target = monthly_t["value"] if monthly_t else 0

    y0, m0 = _month_add(now.year, now.month, -5)
    window_start = datetime(y0, m0, 1, tzinfo=timezone.utc)
    orders = await db.orders.find(
        {"salesperson_id": sp_id, "created_at": {"$gte": window_start}},
        {"_id": 0, "net_value": 1, "created_at": 1},
    ).to_list(10000)

    trend = []
    for i in range(-5, 1):
        y, m = _month_add(now.year, now.month, i)
        trend.append({"month": f"{y}-{m:02d}", "label": datetime(y, m, 1).strftime("%b"), "sales": 0.0})
    tmap = {t["month"]: t for t in trend}

    month_sales = 0.0
    today_sales = 0.0
    month_orders = 0
    for o in orders:
        dt = _aware_dt(o["created_at"])
        key = f"{dt.year}-{dt.month:02d}"
        if key in tmap:
            tmap[key]["sales"] += o.get("net_value", 0)
        if dt >= month_start:
            month_sales += o.get("net_value", 0)
            month_orders += 1
        if dt >= today_start:
            today_sales += o.get("net_value", 0)
    for t in trend:
        t["sales"] = round(t["sales"], 2)

    month_visits = await db.visits.count_documents({"salesperson_id": sp_id, "start_time": {"$gte": month_start}})
    colls = await db.collections.find(
        {"salesperson_id": sp_id, "created_at": {"$gte": month_start}}, {"_id": 0, "amount": 1}
    ).to_list(5000)
    month_collection = sum(c.get("amount", 0) for c in colls)

    # Rank among active salespersons by current-month sales
    sps = await db.users.find({"role": "salesperson", "active": True}, {"_id": 0, "id": 1, "name": 1}).to_list(200)
    all_orders = await db.orders.find(
        {"created_at": {"$gte": month_start}}, {"_id": 0, "salesperson_id": 1, "net_value": 1}
    ).to_list(20000)
    sales_by_sp = {s["id"]: 0.0 for s in sps}
    for o in all_orders:
        if o.get("salesperson_id") in sales_by_sp:
            sales_by_sp[o["salesperson_id"]] += o.get("net_value", 0)
    ranking = sorted(sales_by_sp.items(), key=lambda kv: -kv[1])
    rank = next((i + 1 for i, (sid, _) in enumerate(ranking) if sid == sp_id), None)
    name_map = {s["id"]: s["name"] for s in sps}
    leaderboard = [
        {"rank": i + 1, "name": name_map.get(sid, ""), "sales": round(v, 2), "is_me": sid == sp_id}
        for i, (sid, v) in enumerate(ranking[:5])
    ]

    return {
        "today_sales": round(today_sales, 2),
        "daily_target": daily_target,
        "month_sales": round(month_sales, 2),
        "monthly_target": monthly_target,
        "month_orders": month_orders,
        "month_visits": month_visits,
        "month_collection": round(month_collection, 2),
        "rank": rank,
        "total_salespersons": len(sps),
        "trend": trend,
        "leaderboard": leaderboard,
    }


# ----- Distributor -----
@api_router.get("/distributor/dashboard")
async def distributor_dashboard(user=Depends(get_current_user)):
    if user["role"] != "distributor":
        raise HTTPException(403, "Distributor access required")
    pending_orders = await db.orders.count_documents({"distributor_id": user["id"], "status": "Submitted"})
    dispatched_orders = await db.orders.count_documents({"distributor_id": user["id"], "status": "Dispatched"})
    delivered_orders = await db.orders.count_documents({"distributor_id": user["id"], "status": "Delivered"})
    pending_claims = await db.scheme_claims.count_documents({"distributor_id": user["id"], "status": "Pending"})
    return {
        "pending_orders": pending_orders,
        "dispatched_orders": dispatched_orders,
        "delivered_orders": delivered_orders,
        "pending_claims": pending_claims,
    }


class OrderStatusUpdate(BaseModel):
    status: str  # Dispatched | Delivered


@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, req: OrderStatusUpdate, user=Depends(get_current_user)):
    if req.status not in ("Dispatched", "Delivered"):
        raise HTTPException(400, "Status must be Dispatched or Delivered")
    if user["role"] not in ("distributor", "super_admin", "sales_manager"):
        raise HTTPException(403, "Not permitted")
    o = await db.orders.find_one({"id": order_id})
    if not o:
        raise HTTPException(404, "Order not found")
    if user["role"] == "distributor" and o.get("distributor_id") != user["id"]:
        raise HTTPException(403, "Not permitted")
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": req.status, "status_updated_by": user.get("name"), "updated_at": now_utc()}},
    )
    return await db.orders.find_one({"id": order_id}, {"_id": 0})


@api_router.get("/scheme-claims")
async def list_scheme_claims(user=Depends(get_current_user), status: Optional[str] = None):
    if user["role"] not in ("distributor", "super_admin", "sales_manager"):
        raise HTTPException(403, "Not permitted")
    filt: dict = {}
    if user["role"] == "distributor":
        filt["distributor_id"] = user["id"]
    if status:
        filt["status"] = status
    docs = await db.scheme_claims.find(filt, {"_id": 0}).sort("created_at", -1).to_list(500)
    rids = list({d["retailer_id"] for d in docs})
    rdocs = await db.retailers.find({"id": {"$in": rids}}, {"_id": 0, "id": 1, "shop_name": 1}).to_list(1000)
    rmap = {r["id"]: r["shop_name"] for r in rdocs}
    for d in docs:
        d["retailer_name"] = rmap.get(d["retailer_id"], "")
    return docs


@api_router.put("/scheme-claims/{claim_id}/fulfil")
async def fulfil_scheme_claim(claim_id: str, user=Depends(get_current_user)):
    if user["role"] not in ("distributor", "super_admin", "sales_manager"):
        raise HTTPException(403, "Not permitted")
    c = await db.scheme_claims.find_one({"id": claim_id})
    if not c:
        raise HTTPException(404, "Claim not found")
    if user["role"] == "distributor" and c.get("distributor_id") != user["id"]:
        raise HTTPException(403, "Not permitted")
    if c.get("status") == "Fulfilled":
        raise HTTPException(400, "Claim already fulfilled")
    await db.scheme_claims.update_one(
        {"id": claim_id},
        {"$set": {"status": "Fulfilled", "fulfilled_by": user.get("name"), "fulfilled_at": now_utc()}},
    )
    return await db.scheme_claims.find_one({"id": claim_id}, {"_id": 0})


# ----- Admin: Attendance Report -----
@api_router.get("/admin/attendance-report")
async def admin_attendance_report(user=Depends(get_current_user), month: Optional[str] = None):
    require_admin(user)
    if not month:
        month = datetime.now(IST).strftime("%Y-%m")
    try:
        y, m = int(month[:4]), int(month[5:7])
        days_in_month = calendar.monthrange(y, m)[1]
    except (ValueError, IndexError):
        raise HTTPException(400, "Month must be in YYYY-MM format")
    docs = await db.attendance.find({"date": {"$regex": f"^{y:04d}-{m:02d}"}}, {"_id": 0}).to_list(3000)
    by_sp: dict = {}
    for d in docs:
        day = int(d["date"].split("-")[2])
        by_sp.setdefault(d["salesperson_id"], {})[str(day)] = {
            "date": d["date"],
            "start_time": _aware_dt(d.get("start_time")).isoformat() if d.get("start_time") else None,
            "end_time": _aware_dt(d.get("end_time")).isoformat() if d.get("end_time") else None,
            "duration_minutes": d.get("duration_minutes"),
            "start_lat": d.get("start_lat"),
            "start_lng": d.get("start_lng"),
            "end_lat": d.get("end_lat"),
            "end_lng": d.get("end_lng"),
        }
    sps = await db.users.find(
        {"role": "salesperson"}, {"_id": 0, "id": 1, "name": 1, "employee_id": 1, "territory": 1}
    ).sort("employee_id", 1).to_list(200)
    rows = [
        {
            "id": s["id"],
            "name": s["name"],
            "employee_id": s["employee_id"],
            "territory": s.get("territory", ""),
            "days": by_sp.get(s["id"], {}),
        }
        for s in sps
    ]
    return {"month": month, "days_in_month": days_in_month, "rows": rows}


@api_router.get("/")
async def root():
    return {"message": "FMCG FieldForce Pro API"}


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def on_startup():
    # Auto-seed if empty
    try:
        cnt = await db.users.count_documents({})
        if cnt == 0:
            logger.info("Seeding demo data...")
            await seed_data()
            logger.info("Seed complete.")
    except Exception as e:
        logger.error(f"Startup seed failed: {e}")
    # Init storage lazily; ignore errors so app can boot without storage
    try:
        await run_in_threadpool(init_storage)
    except Exception as e:
        logger.warning(f"Storage init failed (non-fatal): {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
