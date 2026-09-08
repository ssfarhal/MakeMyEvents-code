from fastapi import FastAPI, APIRouter, HTTPException, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import httpx
import jwt
import json
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
FIREBASE_PROJECT_ID = os.environ.get('FIREBASE_PROJECT_ID', '')
FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"


# ---------- Models ----------
class SessionExchange(BaseModel):
    session_id: str


class PhoneVerifyPayload(BaseModel):
    firebase_id_token: str


class User(BaseModel):
    user_id: str
    email: Optional[str] = None
    name: Optional[str] = None
    picture: Optional[str] = None
    phone: Optional[str] = None
    hallName: Optional[str] = None
    hallAddress: Optional[str] = None
    ownerName: Optional[str] = None
    ownerPhone: Optional[str] = None
    role: Optional[str] = None          # "owner" or "manager"
    managed_owner_id: Optional[str] = None  # only for managers


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


class ManagerInvite(BaseModel):
    identifier: str   # phone number or email
    identifier_type: str = "phone"  # "phone" or "email"


class PublicDeleteRequest(BaseModel):
    email: str


# ---------- Auth helpers ----------
async def next_booking_id(user_id: str) -> str:
    """Atomically returns the next per-user booking id like BME-001."""
    res = await db.counters.find_one_and_update(
        {"_id": f"bookings_{user_id}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = (res or {}).get("seq", 1)
    return f"BME-{seq:03d}"


def _normalize_phone(phone: str) -> str:
    """Normalize a phone number: remove spaces, ensure leading +"""
    p = phone.strip().replace(' ', '').replace('-', '')
    if not p.startswith('+'):
        p = '+' + p
    return p


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

    # Check if this user is a manager for another owner
    user_email = user.get("email", "")
    user_phone = _normalize_phone(user.get("phone", "")) if user.get("phone") else ""

    conditions = []
    if user_email:
        conditions.append({"identifier": user_email})
    if user_phone:
        conditions.append({"identifier": user_phone})

    manager_record = None
    if conditions:
        manager_record = await db.manager_access.find_one({
            "$or": conditions,
            "status": "active"
        })

    if manager_record:
        user["role"] = "manager"
        user["managed_owner_id"] = manager_record["owner_user_id"]
    else:
        user["role"] = "owner"

    return user


async def verify_firebase_id_token(id_token: str) -> dict:
    """Verify a Firebase ID token using Google's public JWK endpoint."""
    if not FIREBASE_PROJECT_ID:
        raise HTTPException(status_code=400, detail="Firebase not configured on server")
    try:
        # Fetch Google's public JWKs
        async with httpx.AsyncClient(timeout=10) as http:
            jwks_resp = await http.get(FIREBASE_JWKS_URL)
        jwks = jwks_resp.json()

        # Decode header to get kid
        header = jwt.get_unverified_header(id_token)
        kid = header.get("kid")

        # Find matching key
        public_key = None
        for key_data in jwks.get("keys", []):
            if key_data.get("kid") == kid:
                public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key_data))
                break

        if not public_key:
            raise HTTPException(status_code=401, detail="Firebase token key not found")

        # Verify token
        payload = jwt.decode(
            id_token,
            public_key,
            algorithms=["RS256"],
            audience=FIREBASE_PROJECT_ID,
            issuer=f"https://securetoken.google.com/{FIREBASE_PROJECT_ID}",
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Firebase token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Firebase token: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Firebase verification failed: {str(e)}")


# ---------- Routes ----------
@app.get("/health")
async def health():
    return {"status": "ok"}


@api_router.get("/health")
async def health_api():
    return {"status": "ok"}


@api_router.get("/")
async def root():
    return {"message": "BookMyEvents API"}


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

    # Check if this user is a manager
    manager_record = await db.manager_access.find_one({"identifier": email, "status": "active"})
    role = "manager" if manager_record else "owner"
    managed_owner_id = manager_record["owner_user_id"] if manager_record else None

    user_data = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return AuthResponse(
        session_token=session_token,
        user=User(
            user_id=user_id, email=email, name=name, picture=picture,
            hallName=(user_data or {}).get("hallName"),
            role=role,
            managed_owner_id=managed_owner_id,
        )
    )


@api_router.post("/auth/phone-verify", response_model=AuthResponse)
async def phone_verify(payload: PhoneVerifyPayload):
    """Verify a Firebase phone OTP and create a BookMyEvents session."""
    firebase_data = await verify_firebase_id_token(payload.firebase_id_token)

    phone_number = firebase_data.get("phone_number")
    firebase_uid = firebase_data.get("sub")
    if not phone_number or not firebase_uid:
        raise HTTPException(status_code=400, detail="No phone_number in Firebase token")

    normalized_phone = _normalize_phone(phone_number)

    # Find or create user by phone
    existing = await db.users.find_one({"phone": normalized_phone}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"firebase_uid": firebase_uid}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "phone": normalized_phone,
            "firebase_uid": firebase_uid,
            "auth_method": "phone",
            "createdAt": datetime.now(timezone.utc).isoformat(),
        })

    session_token = f"phone_sess_{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
    })

    # Check if manager
    manager_record = await db.manager_access.find_one({"identifier": normalized_phone, "status": "active"})
    role = "manager" if manager_record else "owner"
    managed_owner_id = manager_record["owner_user_id"] if manager_record else None

    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return AuthResponse(
        session_token=session_token,
        user=User(
            user_id=user_id,
            phone=normalized_phone,
            hallName=(user_doc or {}).get("hallName"),
            role=role,
            managed_owner_id=managed_owner_id,
        )
    )


@api_router.get("/auth/me", response_model=User)
async def auth_me(authorization: Optional[str] = Header(default=None)):
    u = await get_current_user(authorization)
    return User(**{k: u.get(k) for k in [
        "user_id", "email", "name", "picture", "phone",
        "hallName", "hallAddress", "ownerName", "ownerPhone",
        "role", "managed_owner_id"
    ]})


@api_router.patch("/auth/me", response_model=User)
async def update_me(payload: UserUpdate, authorization: Optional[str] = Header(default=None)):
    u = await get_current_user(authorization)
    if u.get("role") == "manager":
        raise HTTPException(status_code=403, detail="Managers cannot modify settings")
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if updates:
        await db.users.update_one({"user_id": u["user_id"]}, {"$set": updates})
    doc = await db.users.find_one({"user_id": u["user_id"]}, {"_id": 0})
    return User(**{k: doc.get(k) for k in [
        "user_id", "email", "name", "picture", "phone",
        "hallName", "hallAddress", "ownerName", "ownerPhone",
        "role", "managed_owner_id"
    ]})


@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


@api_router.delete("/auth/me")
async def delete_me(authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    if user.get("role") == "manager":
        raise HTTPException(status_code=403, detail="Managers cannot delete accounts")
    user_id = user["user_id"]
    session_token = authorization.split(" ", 1)[1].strip() if authorization and authorization.startswith("Bearer ") else None

    await db.bookings.delete_many({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.manager_access.delete_many({"owner_user_id": user_id})
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    await db.users.delete_one({"user_id": user_id})
    await db.counters.delete_one({"_id": f"bookings_{user_id}"})
    return {"ok": True}


# ---------- Public endpoints (no auth required) ----------
@api_router.post("/public/delete-account")
async def public_delete_account(payload: PublicDeleteRequest):
    """Allow users to delete their account by email (for web deletion page)."""
    email = payload.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address")

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        # For privacy, return success even if user not found
        return {"ok": True, "message": "If an account with this email exists, it has been deleted."}

    user_id = user["user_id"]
    await db.bookings.delete_many({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.manager_access.delete_many({"owner_user_id": user_id})
    await db.users.delete_one({"user_id": user_id})
    await db.counters.delete_one({"_id": f"bookings_{user_id}"})
    return {"ok": True, "message": "Account and all associated data have been permanently deleted."}


# ---------- Manager Access ----------
@api_router.get("/managers")
async def list_managers(authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    if user.get("role") == "manager":
        raise HTTPException(status_code=403, detail="Managers cannot manage other managers")
    records = await db.manager_access.find(
        {"owner_user_id": user["user_id"], "status": "active"},
        {"_id": 0}
    ).to_list(100)
    return records


@api_router.post("/managers")
async def add_manager(payload: ManagerInvite, authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    if user.get("role") == "manager":
        raise HTTPException(status_code=403, detail="Managers cannot invite other managers")

    identifier = payload.identifier.strip()
    if not identifier:
        raise HTTPException(status_code=400, detail="Identifier required")

    # Normalize phone if it looks like a phone number
    id_type = payload.identifier_type
    if id_type == "phone":
        identifier = _normalize_phone(identifier)

    # Check if already added
    existing = await db.manager_access.find_one({
        "owner_user_id": user["user_id"],
        "identifier": identifier,
        "status": "active"
    })
    if existing:
        raise HTTPException(status_code=409, detail="Manager already added")

    record = {
        "owner_user_id": user["user_id"],
        "identifier": identifier,
        "identifier_type": id_type,
        "status": "active",
        "added_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.manager_access.insert_one(record)
    return {"ok": True, "identifier": identifier, "identifier_type": id_type}


@api_router.delete("/managers/{identifier}")
async def remove_manager(identifier: str, authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    if user.get("role") == "manager":
        raise HTTPException(status_code=403, detail="Managers cannot remove managers")

    from urllib.parse import unquote
    identifier = unquote(identifier).strip()

    res = await db.manager_access.update_one(
        {"owner_user_id": user["user_id"], "identifier": identifier, "status": "active"},
        {"$set": {"status": "revoked", "revoked_at": datetime.now(timezone.utc).isoformat()}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Manager not found")
    return {"ok": True}


# ---------- Bookings ----------
def _get_booking_owner_id(user: dict) -> str:
    """Returns the effective owner user_id for booking operations."""
    if user.get("role") == "manager":
        return user["managed_owner_id"]
    return user["user_id"]


@api_router.get("/bookings", response_model=List[Booking])
async def list_bookings(authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    owner_id = _get_booking_owner_id(user)

    # Auto-complete past events (except cancelled/completed)
    today_iso = datetime.now(timezone.utc).date().isoformat()
    await db.bookings.update_many(
        {
            "user_id": owner_id,
            "status": {"$nin": ["cancelled", "completed"]},
            "eventDate": {"$lt": today_iso},
        },
        {"$set": {"status": "completed"}},
    )
    docs = await db.bookings.find({"user_id": owner_id}, {"_id": 0}).to_list(1000)
    return [Booking(**d) for d in docs]


@api_router.post("/bookings", response_model=Booking)
async def create_booking(payload: BookingCreate, authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    owner_id = _get_booking_owner_id(user)
    bid = await next_booking_id(owner_id)
    data = payload.dict()
    payments: list = []
    if float(data.get("advancePaid", 0) or 0) > 0:
        payments = [{"amount": float(data["advancePaid"]),
                     "date": datetime.now(timezone.utc).isoformat()}]
    booking = Booking(id=bid, user_id=owner_id, payments=payments, **data)
    await db.bookings.insert_one(booking.dict())
    return booking


@api_router.delete("/bookings/{booking_id}/payments/{index}", response_model=Booking)
async def delete_payment(booking_id: str, index: int,
                         authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    owner_id = _get_booking_owner_id(user)
    doc = await db.bookings.find_one(
        {"id": booking_id, "user_id": owner_id}, {"_id": 0}
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
        {"id": booking_id, "user_id": owner_id},
        {"$set": {"payments": payments, "advancePaid": new_advance}},
    )
    updated = await db.bookings.find_one(
        {"id": booking_id, "user_id": owner_id}, {"_id": 0}
    )
    return Booking(**updated)


@api_router.patch("/bookings/{booking_id}", response_model=Booking)
async def update_booking(booking_id: str, payload: BookingUpdate,
                         authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    owner_id = _get_booking_owner_id(user)
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No changes")
    res = await db.bookings.update_one(
        {"id": booking_id, "user_id": owner_id}, {"$set": updates}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    # SECURITY: Always filter by both id AND user_id to prevent IDOR
    doc = await db.bookings.find_one({"id": booking_id, "user_id": owner_id}, {"_id": 0})
    return Booking(**doc)


@api_router.delete("/bookings/{booking_id}")
async def delete_booking(booking_id: str, authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    owner_id = _get_booking_owner_id(user)
    res = await db.bookings.delete_one({"id": booking_id, "user_id": owner_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    return {"ok": True}


@api_router.post("/bookings/{booking_id}/payments", response_model=Booking)
async def add_payment(booking_id: str, payload: PaymentCreate,
                      authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(authorization)
    owner_id = _get_booking_owner_id(user)
    if payload.amount is None or payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be > 0")
    doc = await db.bookings.find_one(
        {"id": booking_id, "user_id": owner_id}, {"_id": 0}
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
        {"id": booking_id, "user_id": owner_id},
        {
            "$push": {"payments": entry},
            "$inc": {"advancePaid": float(payload.amount)},
        },
    )
    updated = await db.bookings.find_one(
        {"id": booking_id, "user_id": owner_id}, {"_id": 0}
    )
    return Booking(**updated)


@api_router.post("/bookings/seed", response_model=List[Booking])
async def seed_bookings(authorization: Optional[str] = Header(default=None)):
    """Seed demo bookings for the signed-in owner (idempotent — only if none exist)."""
    user = await get_current_user(authorization)
    if user.get("role") == "manager":
        raise HTTPException(status_code=403, detail="Managers cannot seed bookings")
    owner_id = user["user_id"]
    existing = await db.bookings.count_documents({"user_id": owner_id})
    if existing > 0:
        docs = await db.bookings.find({"user_id": owner_id}, {"_id": 0}).to_list(1000)
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
        bid = await next_booking_id(owner_id)
        payments = []
        if float(adv) > 0:
            payments = [{"amount": float(adv),
                          "date": (now - timedelta(days=abs(days_off) + 3)).isoformat()}]
        b = Booking(id=bid, user_id=owner_id, clientName=name, phone=phone, eventType=etype,
                    eventDate=d.date().isoformat(), functionTime=ftime, guestCount=guests,
                    totalAmount=float(total), advancePaid=float(adv), payments=payments,
                    status=status, notes=notes)
        to_insert.append(b.dict())
    await db.bookings.insert_many(to_insert)
    return [Booking(**d) for d in to_insert]


# ---------- Startup: MongoDB indexes ----------
@app.on_event("startup")
async def on_startup():
    # Drop old conflicting email index if it exists (email now optional for phone-auth users)
    try:
        await db.users.drop_index("email_1")
    except Exception:
        pass
    # Recreate email index as sparse (allows phone-only users without email)
    await db.users.create_index("email", unique=True, sparse=True, name="email_1_sparse")
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("phone", unique=True, sparse=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.bookings.create_index([("user_id", 1), ("eventDate", 1)])
    await db.manager_access.create_index([("owner_user_id", 1), ("identifier", 1)])
    await db.manager_access.create_index("identifier")


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
