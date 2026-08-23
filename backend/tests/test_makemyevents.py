"""Backend tests for MakeMyEvents API (auth + bookings)"""
import os
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://app-launcher-3237.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"


@pytest.fixture
def s():
    return requests.Session()


# Root
def test_root_message(s):
    r = s.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    assert r.json().get("message") == "MakeMyEvents API"


# Auth
def test_session_invalid_returns_401(s):
    r = s.post(f"{API}/auth/session", json={"session_id": "definitely-not-valid-xyz"}, timeout=20)
    assert r.status_code == 401


def test_session_empty_returns_400(s):
    r = s.post(f"{API}/auth/session", json={"session_id": ""}, timeout=15)
    assert r.status_code == 400


def test_auth_me_requires_bearer(s):
    r = s.get(f"{API}/auth/me", timeout=15)
    assert r.status_code == 401


def test_auth_me_bad_token(s):
    r = s.get(f"{API}/auth/me", headers={"Authorization": "Bearer nope"}, timeout=15)
    assert r.status_code == 401


# PATCH /auth/me — hallName update (auth-gated)
def test_patch_auth_me_requires_bearer(s):
    r = s.patch(f"{API}/auth/me", json={"hallName": "Test Hall"}, timeout=15)
    assert r.status_code == 401


def test_patch_auth_me_bad_token(s):
    r = s.patch(f"{API}/auth/me", json={"hallName": "Test Hall"},
                headers={"Authorization": "Bearer nope"}, timeout=15)
    assert r.status_code == 401


def test_patch_auth_me_accepts_hallname_shape(s):
    # Even with bad token, endpoint should be reachable (not 404/405); payload
    # shape {hallName: str} is accepted by pydantic (401 from auth, not 422).
    r = s.patch(f"{API}/auth/me", json={"hallName": "Bharath Convention Hall"},
                headers={"Authorization": "Bearer nope"}, timeout=15)
    assert r.status_code == 401, f"expected 401 (route+schema OK), got {r.status_code}"


# Bookings - all require auth
@pytest.mark.parametrize("method,path", [
    ("get", "/bookings"),
    ("post", "/bookings"),
    ("post", "/bookings/seed"),
    ("patch", "/bookings/MME-999"),
    ("delete", "/bookings/MME-999"),
])
def test_bookings_require_auth(s, method, path):
    fn = getattr(s, method)
    kwargs = {"timeout": 15}
    if method in ("post", "patch"):
        kwargs["json"] = {"clientName": "x", "phone": "1", "eventType": "y", "eventDate": "2026-01-01"}
    r = fn(f"{API}{path}", **kwargs)
    assert r.status_code == 401, f"{method} {path} -> {r.status_code}"


def test_bookings_bad_token_401(s):
    r = s.get(f"{API}/bookings", headers={"Authorization": "Bearer garbage"}, timeout=15)
    assert r.status_code == 401


# ---------- Static file content verification (fixes in this iteration) ----------
import re
from pathlib import Path

SERVER_PY = Path("/app/backend/server.py").read_text(encoding="utf-8")
INVOICE_TS = Path("/app/frontend/src/invoice.ts").read_text(encoding="utf-8")


# server.py — booking id refactor
def test_server_defines_next_booking_id():
    assert "async def next_booking_id(" in SERVER_PY


def test_next_booking_id_uses_counters_and_inc():
    # Must $inc on counters collection with per-user key
    assert "db.counters.find_one_and_update" in SERVER_PY
    assert '"$inc": {"seq": 1}' in SERVER_PY
    assert 'f"bookings_{user_id}"' in SERVER_PY
    assert 'f"MME-{seq:03d}"' in SERVER_PY


def _extract_fn_body(src: str, fn_name: str) -> str:
    """Return the body of an async function until the next top-level `@` or `async def`/`def`."""
    m = re.search(rf"async def {fn_name}\([^)]*\)[^:]*:\n", src)
    assert m, f"{fn_name} not found"
    start = m.end()
    # find next top-level decorator/def at column 0
    m2 = re.search(r"\n(?:@|async def |def )", src[start:])
    end = start + m2.start() if m2 else len(src)
    return src[start:end]


def test_create_booking_uses_next_booking_id():
    body = _extract_fn_body(SERVER_PY, "create_booking")
    assert 'next_booking_id(user["user_id"])' in body
    assert "Booking(id=bid" in body


def test_seed_bookings_calls_next_booking_id_in_loop():
    body = _extract_fn_body(SERVER_PY, "seed_bookings")
    loop_pos = body.find("for (name, phone,")
    call_pos = body.find('next_booking_id(user["user_id"])')
    assert loop_pos != -1, "samples loop not found in seed_bookings"
    assert call_pos != -1, "next_booking_id not called in seed_bookings"
    assert call_pos > loop_pos, "next_booking_id must be called INSIDE the samples loop"


def test_booking_model_id_is_optional_no_bkg_default():
    # `id: Optional[str] = None`  — no default_factory generating BKG-uuid
    assert re.search(r"class Booking\(BaseModel\):\s*\n\s*id:\s*Optional\[str\]\s*=\s*None",
                     SERVER_PY), "Booking.id must be Optional[str] = None"


def test_no_bkg_prefix_remaining_in_server():
    assert "BKG-" not in SERVER_PY, "server.py still references legacy BKG- prefix"


# invoice.ts — Terms & Conditions wording
def test_invoice_terms_contains_required_wording():
    required = [
        "RENTAL TERMS & CONDITIONS",
        "EXTRA CHARGES",
        "SECURITY DEPOSIT FOR EQUIPMENT",
        "₹25,000",
        "RENTAL TIMINGS",
        "Morning Shift: 5:00 AM",
        "Night Shift: 5:00 PM",
        "RULES & DAMAGE LIABILITY",
        "Personal Belongings & Valuables",
        "cash, gold, mobile phones, laptops, cameras, tablet",
    ]
    missing = [p for p in required if p not in INVOICE_TS]
    assert not missing, f"Missing T&C phrases in invoice.ts: {missing}"


def test_invoice_terms_ends_with_management_not_responsible():
    # DEFAULT_TERMS string ends with the exact sentence supplied by owner
    m = re.search(r"const DEFAULT_TERMS = `([\s\S]*?)`", INVOICE_TS)
    assert m, "DEFAULT_TERMS template literal not found"
    terms = m.group(1).rstrip()
    assert terms.endswith("Strictly speaking, management is not responsible."), \
        f"DEFAULT_TERMS does not end with expected sentence, ends with: ...{terms[-80:]!r}"


def test_invoice_html_prints_booking_id_as_invoice_no():
    # The 'Invoice No.' <p> cell must interpolate booking.id
    assert re.search(
        r"<label>Invoice No\.</label>\s*<p>\$\{booking\.id\}</p>", INVOICE_TS
    ), "Invoice No. cell must render ${booking.id}"


# ---------- next_booking_id atomic increment (async, monkeypatched db) ----------
def test_next_booking_id_sequences_mme_001_then_002(monkeypatch):
    """Same fake user_id → MME-001, MME-002 (via in-memory fake counters collection)."""
    import asyncio
    from backend import server as srv

    class _FakeCounters:
        def __init__(self):
            self.store = {}

        async def find_one_and_update(self, flt, update, upsert=False, return_document=True):
            key = flt["_id"]
            inc = update["$inc"]["seq"]
            self.store[key] = self.store.get(key, 0) + inc
            return {"_id": key, "seq": self.store[key]}

    class _FakeDB:
        def __init__(self):
            self.counters = _FakeCounters()

    fake_db = _FakeDB()
    monkeypatch.setattr(srv, "db", fake_db)

    async def _run():
        id1 = await srv.next_booking_id("user_abc")
        id2 = await srv.next_booking_id("user_abc")
        id_other = await srv.next_booking_id("user_xyz")
        return id1, id2, id_other

    id1, id2, id_other = asyncio.run(_run())
    assert id1 == "MME-001", f"expected MME-001, got {id1}"
    assert id2 == "MME-002", f"expected MME-002, got {id2}"
    # per-user counter is independent
    assert id_other == "MME-001", f"expected per-user reset MME-001, got {id_other}"
