from fastapi import FastAPI, APIRouter, HTTPException, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


# ---------- Models ----------
class SessionExchange(BaseModel):
    session_id: str


class User(BaseModel):
    user_id: str
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None
    hallName: Optional[str] = None
    hallAddress: Optional[str] = None
    ownerName: Optional[str] = None
    ownerPhone: Optional[str] = None


class UserUpdate(BaseModel):
    hallName: Optional[str] = None
    hallAddress: Optional[str] = None
    ownerName: Optional[str] = None
    ownerPhone: Optional[str] = None


class AuthResponse(BaseModel):
    session_token: str
    user: User


class Payment(BaseModel):
    amount: float
    date: str  # ISO datetime


class ChargeItem(BaseModel):
    label: str
    amount: float = 0.0


class Booking(BaseModel):
    id: Optional[str] = None
    user_id: str
    clientName: str
    phone: str
    eventType: str
    eventDate: str  # ISO date string
    functionTime: str = "Day"
    guestCount: int = 0
    totalAmount: float = 0.0
    advancePaid: float = 0.0
    payments: List[Payment] = []
    status: str = "confirmed"
    notes: Optional[str] = ""
    charges: List[ChargeItem] = []
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PaymentCreate(BaseModel):
    amount: float


class BookingCreate(BaseModel):
    clientName: str
    phone: str
    eventType: str
    eventDate: str
    functionTime: str = "Day"
    guestCount: int = 0
    totalAmount: float = 0.0
    advancePaid: float = 0.0
    status: str = "confirmed"
    notes: Optional[str] = ""
    charges: List[ChargeItem] = []


class BookingUpdate(BaseModel):
    clientName: Optional[str] = None
    phone: Optional[str] = None
    eventType: Optional[str] = None
    eventDate: Optional[str] = None
    functionTime: Optional[str] = None
    guestCount: Optional[int] = None
    totalAmount: Optional[float] = None
    advancePaid: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    charges: Optional[List[ChargeItem]] = None


# ---------- Auth helper ----------
async def next_booking_id(user_id: str) -> str:
    """Atomically returns the next per-user booking id like MME-001."""
    res = await db.counters.find_one_and_update(
        {"_id": f"bookings_{user_id}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = (res or {}).get("seq", 1)
    return f"MME-{seq:03d}"


async def get_current_user(authorization: Optional[str] = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session.get("expires_at")
    if isinstance(expires_at, datetime):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "MakeMyEvents API"}


@api_router.post("/auth/session", response_model=AuthResponse)
async def exchange_session(payload: SessionExchange):
    session_id = payload.session_id.strip()
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    async with httpx.AsyncClient(timeout=15) as http:
        r = await http.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = r.json()
    email = data.get("email")
    name = data.get("name")
    picture = data.get("picture")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=401, detail="Bad session payload")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": name, "picture": picture}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({"user_id": user_id, "email": email, "name": name, "picture": picture,
                                   "createdAt": datetime.now(timezone.utc).isoformat()})

    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
    })
    return AuthResponse(session_token=session_token,
                        user=User(user_id=user_id, email=email, name=name, picture=picture,
                                  hallName=(existing or {}).get("hallName") if existing else None))


@api_router.get("/auth/me", response_model=User)
async def auth_me(authorization: Optional[str] = Header(default=None)):
    u = await get_current_user(authorization)
    return User(**{k: u.get(k) for k in ["user_id", "email", "name", "picture", "hallName", "hallAddress", "ownerName", "ownerPhone"]})


@api_router.patch("/auth/me", response_model=User)
async def update_me(payload: UserUpdate, authorization: Optional[str] = Header(default=None)):
    u = await get_current_user(authorization)
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if updates:
        await db.users.update_one({"user_id": u["user_id"]}, {"$set": updates})
    doc = await db.users.find_one({"user_id": u["user_id"]}, {"_id": 0})
    return User(**{k: doc.get(k) for k in ["user_id", "email", "name", "picture", "hallName", "hallAddress", "ownerName", "ownerPhone"]})


@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------- Bookings ----------
@api_router.get("/bookings", response_model=List[Booking])
async def list_bookings(authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    # Auto-complete past events (except cancelled/completed) so status reflects reality.
    today_iso = datetime.now(timezone.utc).date().isoformat()
    await db.bookings.update_many(
        {
            "user_id": user["user_id"],
            "status": {"$nin": ["cancelled", "completed"]},
            "eventDate": {"$lt": today_iso},
        },
        {"$set": {"status": "completed"}},
    )
    docs = await db.bookings.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    return [Booking(**d) for d in docs]


@api_router.post("/bookings", response_model=Booking)
async def create_booking(payload: BookingCreate, authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    bid = await next_booking_id(user["user_id"])
    data = payload.dict()
    payments: list = []
    if float(data.get("advancePaid", 0) or 0) > 0:
        payments = [{"amount": float(data["advancePaid"]),
                     "date": datetime.now(timezone.utc).isoformat()}]
    booking = Booking(id=bid, user_id=user["user_id"], payments=payments, **data)
    await db.bookings.insert_one(booking.dict())
    return booking


@api_router.delete("/bookings/{booking_id}/payments/{index}", response_model=Booking)
async def delete_payment(booking_id: str, index: int,
                         authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    doc = await db.bookings.find_one(
        {"id": booking_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Booking not found")
    payments = doc.get("payments") or []
    if index < 0 or index >= len(payments):
        raise HTTPException(status_code=404, detail="Payment entry not found")
    removed_amount = float(payments[index].get("amount", 0))
    payments.pop(index)
    new_advance = max(0.0, float(doc.get("advancePaid", 0)) - removed_amount)
    await db.bookings.update_one(
        {"id": booking_id, "user_id": user["user_id"]},
        {"$set": {"payments": payments, "advancePaid": new_advance}},
    )
    updated = await db.bookings.find_one(
        {"id": booking_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    return Booking(**updated)


@api_router.patch("/bookings/{booking_id}", response_model=Booking)
async def update_booking(booking_id: str, payload: BookingUpdate,
                         authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No changes")
    res = await db.bookings.update_one(
        {"id": booking_id, "user_id": user["user_id"]}, {"$set": updates}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    doc = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    return Booking(**doc)


@api_router.delete("/bookings/{booking_id}")
async def delete_booking(booking_id: str, authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    res = await db.bookings.delete_one({"id": booking_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"ok": True}


@api_router.post("/bookings/{booking_id}/payments", response_model=Booking)
async def add_payment(booking_id: str, payload: PaymentCreate,
                      authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    if payload.amount is None or payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be > 0")
    doc = await db.bookings.find_one(
        {"id": booking_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Booking not found")
    balance = float(doc.get("totalAmount", 0)) - float(doc.get("advancePaid", 0))
    if payload.amount > balance + 0.01:
        raise HTTPException(status_code=400,
                            detail=f"Amount exceeds pending balance ({balance})")
    entry = {"amount": float(payload.amount),
             "date": datetime.now(timezone.utc).isoformat()}
    await db.bookings.update_one(
        {"id": booking_id, "user_id": user["user_id"]},
        {
            "$push": {"payments": entry},
            "$inc": {"advancePaid": float(payload.amount)},
        },
    )
    updated = await db.bookings.find_one(
        {"id": booking_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    return Booking(**updated)


@api_router.post("/bookings/seed", response_model=List[Booking])
async def seed_bookings(authorization: Optional[str] = Header(default=None)):
    """Seed demo bookings for the signed-in owner (idempotent — only if none exist)."""
    user = await get_current_user(authorization)
    existing = await db.bookings.count_documents({"user_id": user["user_id"]})
    if existing > 0:
        docs = await db.bookings.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
        return [Booking(**d) for d in docs]
    now = datetime.now(timezone.utc)
    samples = [
        ("Ananya & Rohit", "9876543210", "Wedding", 5, "Night", 450, 350000, 150000, "confirmed",
         "Full hall booking with catering"),
        ("Priya Sharma", "9812345670", "Reception", 12, "Night", 300, 200000, 100000, "confirmed",
         "Live music setup"),
        ("Kavya + Arjun", "9900112233", "Engagement", 20, "Day", 150, 80000, 40000, "pending",
         "Vegetarian menu"),
        ("Rahul Mehta", "9871122334", "Birthday", 25, "Day", 80, 45000, 0, "confirmed",
         "Kids birthday, cake included"),
        ("Infosys Team", "9098765432", "Corporate", 40, "Day", 200, 120000, 60000, "confirmed",
         "Annual off-site"),
        ("Sneha & Vikram", "9765432109", "Wedding", 60, "Night", 500, 420000, 0, "pending",
         "Pending advance"),
        ("Rajan Family", "9012345678", "Reception", -20, "Night", 250, 180000, 180000, "completed",
         "Fully paid"),
    ]
    to_insert = []
    for (name, phone, etype, days_off, ftime, guests, total, adv, status, notes) in samples:
        d = now + timedelta(days=days_off)
        bid = await next_booking_id(user["user_id"])
        payments = []
        if float(adv) > 0:
            payments = [{"amount": float(adv),
                          "date": (now - timedelta(days=abs(days_off) + 3)).isoformat()}]
        b = Booking(id=bid, user_id=user["user_id"], clientName=name, phone=phone, eventType=etype,
                    eventDate=d.date().isoformat(), functionTime=ftime, guestCount=guests,
                    totalAmount=float(total), advancePaid=float(adv), payments=payments,
                    status=status, notes=notes)
        to_insert.append(b.dict())
    await db.bookings.insert_many(to_insert)
    return [Booking(**d) for d in to_insert]


# ---------- Startup: MongoDB indexes ----------
@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.bookings.create_index([("user_id", 1), ("eventDate", 1)])


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
