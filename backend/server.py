from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, Header
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import bcrypt
import jwt
import uuid
import requests
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'change-me')
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


class VisitStartRequest(BaseModel):
    retailer_id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    gps_accuracy: Optional[float] = None


class VisitCompleteRequest(BaseModel):
    visit_id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    result: str  # ORDER_BOOKED | NO_ORDER | PAYMENT_COLLECTED | COMPLAINT | NEW_RETAILER | OTHER
    no_order_reason: Optional[str] = None
    remarks: Optional[str] = ""


class CollectionCreate(BaseModel):
    retailer_id: str
    amount: float
    mode: str  # Cash | UPI | Bank Transfer | Cheque | Other
    reference_no: Optional[str] = ""
    remarks: Optional[str] = ""
    receipt_photo: Optional[str] = None


# ---------- Auth ----------
@api_router.post("/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    user = await db.users.find_one({"employee_id": req.employee_id.upper()})
    if not user or not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(401, "Invalid Employee ID or password")
    if not user.get("active", True):
        raise HTTPException(403, "Account inactive")
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
        filt["$or"] = [
            {"shop_name": {"$regex": q, "$options": "i"}},
            {"mobile": {"$regex": q}},
            {"owner_name": {"$regex": q, "$options": "i"}},
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
    vid = str(uuid.uuid4())
    doc = {
        "id": vid,
        "retailer_id": req.retailer_id,
        "retailer_name": retailer.get("shop_name"),
        "salesperson_id": user["id"],
        "start_time": now_utc(),
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
    return o


# ---------- Collections ----------
@api_router.post("/collections")
async def create_collection(req: CollectionCreate, user=Depends(get_current_user)):
    retailer = await db.retailers.find_one({"id": req.retailer_id})
    if not retailer:
        raise HTTPException(404, "Retailer not found")
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
    content, ctype = await run_in_threadpool(get_object, path)
    return Response(content=content, media_type=ctype)


# ---------- Seeder ----------
@api_router.post("/seed")
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
