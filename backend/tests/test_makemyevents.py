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


# ---------- Payments endpoint auth-gating (iteration 5) ----------
def test_add_payment_requires_bearer(s):
    r = s.post(f"{API}/bookings/MME-001/payments", json={"amount": 1000}, timeout=15)
    assert r.status_code == 401


def test_add_payment_bad_token_401(s):
    r = s.post(f"{API}/bookings/MME-001/payments", json={"amount": 1000},
               headers={"Authorization": "Bearer nope"}, timeout=15)
    assert r.status_code == 401


def test_add_payment_zero_amount_still_401_without_auth(s):
    # Without bearer -> 401 (auth is checked BEFORE body validation)
    r = s.post(f"{API}/bookings/MME-001/payments", json={"amount": 0}, timeout=15)
    assert r.status_code == 401


# ---------- Static file content verification (fixes in this iteration) ----------
import re
from pathlib import Path

SERVER_PY = Path("/app/backend/server.py").read_text(encoding="utf-8")
INVOICE_TS = Path("/app/frontend/src/invoice.ts").read_text(encoding="utf-8")
THEME_TS = Path("/app/frontend/src/theme.ts").read_text(encoding="utf-8")
DASHBOARD_TSX = Path("/app/frontend/app/(tabs)/dashboard.tsx").read_text(encoding="utf-8")
DETAIL_TSX = Path("/app/frontend/src/BookingDetailSheet.tsx").read_text(encoding="utf-8")
REPORT_MODAL = Path("/app/frontend/src/ReportModal.tsx").read_text(encoding="utf-8")


# ---------- Iteration 5: Payment ledger + KPI full digits + custom report ----------
def test_payment_model_defined():
    assert re.search(r"class Payment\(BaseModel\):\s*\n\s*amount:\s*float\s*\n\s*date:\s*str", SERVER_PY)


def test_booking_has_payments_list():
    assert re.search(r"payments:\s*List\[Payment\]\s*=\s*\[\]", SERVER_PY)


def test_payment_create_model_defined():
    assert re.search(r"class PaymentCreate\(BaseModel\):\s*\n\s*amount:\s*float", SERVER_PY)


def test_add_payment_endpoint_present():
    assert '@api_router.post("/bookings/{booking_id}/payments"' in SERVER_PY
    assert "async def add_payment(" in SERVER_PY


def test_add_payment_logic_handles_edge_cases():
    body = _extract_fn_body(SERVER_PY, "add_payment")
    assert "payload.amount <= 0" in body, "must reject amount <= 0"
    assert "status_code=400" in body, "must return 400 for invalid amounts"
    assert "status_code=404" in body, "must return 404 for missing booking"
    assert "$push" in body and "payments" in body, "must $push payment entry"
    assert "$inc" in body and "advancePaid" in body, "must $inc advancePaid"
    assert "exceeds pending balance" in body or "balance" in body.lower()


def test_seed_bookings_seeds_initial_payment_when_advance_gt_zero():
    body = _extract_fn_body(SERVER_PY, "seed_bookings")
    assert "if float(adv) > 0" in body
    assert 'payments = [{"amount": float(adv)' in body
    assert "payments=payments" in body


# ---------- Frontend static checks ----------
def test_theme_format_inr_full_returns_rupee_with_dash_suffix():
    assert re.search(r"formatINRFull\s*=\s*\(v:\s*number\)\s*:\s*string\s*=>\s*`₹\$\{formatINR\(v\)\}/-`", THEME_TS)


def test_dashboard_uses_format_inr_full_not_compact():
    assert "formatINRFull" in DASHBOARD_TSX
    # KPI rendering line must not use compact
    kpi_matches = re.findall(r"KpiCard[^>]*value=\{formatINR\w+\(", DASHBOARD_TSX)
    assert kpi_matches, "no KpiCard value formatter found"
    assert all("formatINRCompact" not in m for m in kpi_matches), \
        f"KPI cards still use formatINRCompact: {kpi_matches}"


def test_dashboard_imports_and_uses_report_modal():
    assert "import ReportModal" in DASHBOARD_TSX
    assert '<ReportModal' in DASHBOARD_TSX
    assert 'testID="report-btn"' in DASHBOARD_TSX
    assert "setShowReport(true)" in DASHBOARD_TSX


def test_booking_detail_sheet_uses_add_payment_and_shows_history():
    assert "onAddPayment" in DETAIL_TSX
    assert "await onAddPayment(booking.id, amt)" in DETAIL_TSX
    assert "Payment History" in DETAIL_TSX
    assert "booking.payments" in DETAIL_TSX
    assert "booking.payments.map" in DETAIL_TSX


def test_invoice_ts_has_payment_history_and_report_functions():
    assert "paymentsSectionHtml" in INVOICE_TS
    assert "Payment History" in INVOICE_TS
    assert "buildReportHtml" in INVOICE_TS
    assert "export async function shareReport" in INVOICE_TS
    # landscape A4
    assert "A4 landscape" in INVOICE_TS
    # KPI tiles (4)
    kpi_tiles = re.findall(r'class="kpi"', INVOICE_TS)
    assert len(kpi_tiles) >= 4, f"expected >=4 KPI tiles in report, found {len(kpi_tiles)}"
    # payments column header
    assert "<th>Payments</th>" in INVOICE_TS


def test_report_modal_has_required_testids():
    for tid in ["report-start-date", "report-end-date", "generate-report-btn",
                "report-preset-this-month", "report-preset-last-month",
                "report-preset-last-3", "report-preset-this-year"]:
        assert f'testID="{tid}"' in REPORT_MODAL or f"testID={{`{tid}`}}" in REPORT_MODAL or f"`report-preset-${{p.key}}`" in REPORT_MODAL, \
            f"missing testID {tid} in ReportModal"


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


# ---------- Iteration 6: DELETE payment + create_booking seeds payments + FE fixes ----------
ADDSHEET_TSX = Path("/app/frontend/src/AddBookingSheet.tsx").read_text(encoding="utf-8")
TABS_LAYOUT_TSX = Path("/app/frontend/app/(tabs)/_layout.tsx").read_text(encoding="utf-8")
BOOKINGS_TSX = Path("/app/frontend/app/(tabs)/bookings.tsx").read_text(encoding="utf-8")
CALENDAR_TSX = Path("/app/frontend/app/(tabs)/calendar.tsx").read_text(encoding="utf-8")
API_TS = Path("/app/frontend/src/api.ts").read_text(encoding="utf-8")
CTX_TSX = Path("/app/frontend/src/BookingsContext.tsx").read_text(encoding="utf-8")


# Backend behaviour - DELETE payment endpoint auth-gating
def test_delete_payment_requires_bearer(s):
    r = s.delete(f"{API}/bookings/MME-001/payments/0", timeout=15)
    assert r.status_code == 401


def test_delete_payment_bad_token_401(s):
    r = s.delete(f"{API}/bookings/MME-001/payments/0",
                 headers={"Authorization": "Bearer nope"}, timeout=15)
    assert r.status_code == 401


# Static: server.py has route defined properly
def test_delete_payment_endpoint_present():
    assert '@api_router.delete("/bookings/{booking_id}/payments/{index}"' in SERVER_PY
    assert "async def delete_payment(" in SERVER_PY


def test_delete_payment_logic_ok():
    body = _extract_fn_body(SERVER_PY, "delete_payment")
    assert "status_code=404" in body, "should 404 on missing booking / bad index"
    assert "Booking not found" in body
    assert "Payment entry not found" in body
    assert "payments.pop(index)" in body
    assert "$set" in body and "payments" in body and "advancePaid" in body
    assert "max(0.0" in body, "advancePaid must be clamped at 0"


# create_booking seeds payments with initial advance entry
def test_create_booking_seeds_initial_payment():
    body = _extract_fn_body(SERVER_PY, "create_booking")
    assert 'float(data.get("advancePaid", 0) or 0) > 0' in body
    assert 'payments = [{"amount": float(data["advancePaid"])' in body
    assert "payments=payments" in body


# Logic test: monkeypatched delete_payment reduces advancePaid and shrinks payments
def test_delete_payment_updates_advance_and_removes_entry(monkeypatch):
    import asyncio
    from backend import server as srv

    store = {
        "bookings": {
            ("MME-100", "user_a"): {
                "id": "MME-100", "user_id": "user_a",
                "clientName": "X", "phone": "1", "eventType": "Wedding",
                "eventDate": "2026-02-01", "functionTime": "Day", "guestCount": 0,
                "totalAmount": 100000.0, "advancePaid": 30000.0,
                "payments": [
                    {"amount": 10000.0, "date": "2026-01-01T00:00:00+00:00"},
                    {"amount": 20000.0, "date": "2026-01-02T00:00:00+00:00"},
                ],
                "status": "confirmed", "notes": "",
                "createdAt": "2026-01-01T00:00:00+00:00",
            }
        }
    }

    class _FakeBookings:
        async def find_one(self, flt, projection=None):
            k = (flt["id"], flt["user_id"])
            doc = store["bookings"].get(k)
            return dict(doc) if doc else None

        async def update_one(self, flt, update):
            k = (flt["id"], flt["user_id"])
            doc = store["bookings"].get(k)
            if not doc:
                return None
            for kk, vv in update.get("$set", {}).items():
                doc[kk] = vv
            return None

    class _FakeDB:
        def __init__(self):
            self.bookings = _FakeBookings()

    monkeypatch.setattr(srv, "db", _FakeDB())
    monkeypatch.setattr(srv, "get_current_user",
                        lambda authorization=None: _async_return({"user_id": "user_a"}))

    async def _run():
        return await srv.delete_payment("MME-100", 0, authorization="Bearer x")

    updated = asyncio.run(_run())
    assert updated.advancePaid == 20000.0, f"expected 20000, got {updated.advancePaid}"
    assert len(updated.payments) == 1
    assert updated.payments[0].amount == 20000.0


async def _async_return(v):
    return v


def test_delete_payment_out_of_range_raises(monkeypatch):
    import asyncio
    from fastapi import HTTPException
    from backend import server as srv

    class _B:
        async def find_one(self, flt, projection=None):
            return {"id": "MME-1", "user_id": "u", "clientName": "x", "phone": "1",
                    "eventType": "y", "eventDate": "2026-01-01",
                    "functionTime": "Day", "guestCount": 0,
                    "totalAmount": 0.0, "advancePaid": 0.0,
                    "payments": [], "status": "confirmed", "notes": "",
                    "createdAt": "2026-01-01T00:00:00+00:00"}
        async def update_one(self, *a, **k): return None

    class _DB:
        def __init__(self): self.bookings = _B()

    monkeypatch.setattr(srv, "db", _DB())
    monkeypatch.setattr(srv, "get_current_user",
                        lambda authorization=None: _async_return({"user_id": "u"}))

    async def _run():
        try:
            await srv.delete_payment("MME-1", 5, authorization="Bearer x")
            return None
        except HTTPException as e:
            return e.status_code

    code = asyncio.run(_run())
    assert code == 404


# ---------- Frontend static grep ----------
def test_api_ts_exports_delete_payment():
    assert "deletePayment:" in API_TS
    assert "`/bookings/${id}/payments/${index}`" in API_TS
    assert "method: 'DELETE'" in API_TS


def test_context_defines_and_exports_delete_payment():
    assert "deletePayment: (id: string, index: number) => Promise<void>" in CTX_TSX
    assert "const deletePayment = useCallback" in CTX_TSX
    # provider value includes deletePayment
    assert re.search(r"value=\{\{[^}]*deletePayment[^}]*\}\}", CTX_TSX), \
        "BookingsProvider value must include deletePayment"


def test_detail_sheet_renders_delete_payment_buttons():
    assert "testID={`delete-payment-${i}`}" in DETAIL_TSX
    assert "onDeletePayment(booking.id, i)" in DETAIL_TSX
    assert "onDeletePayment" in DETAIL_TSX


def test_add_booking_sheet_is_fullscreen_modal():
    # Iteration 7: New Booking is now a full-screen Modal (no bottom sheet)
    assert 'presentationStyle="fullScreen"' in ADDSHEET_TSX
    assert "statusBarTranslucent" in ADDSHEET_TSX
    assert "from 'react-native-safe-area-context'" in ADDSHEET_TSX
    assert "SafeAreaView" in ADDSHEET_TSX
    # KeyboardAvoidingView behavior string
    assert "Platform.OS === 'ios' ? 'padding' : 'height'" in ADDSHEET_TSX
    # ScrollView paddingBottom should be small (40) so scroll stops at Confirm btn
    m = re.search(r"content:\s*\{[^}]*paddingBottom:\s*(\d+)", ADDSHEET_TSX)
    assert m, "content paddingBottom not found in AddBookingSheet"
    assert int(m.group(1)) == 40, f"expected paddingBottom == 40, got {m.group(1)}"


# ---------- Iteration 7: Business Settings + PDF header (hallAddress + ownerPhone) ----------
SETTINGS_TSX = Path("/app/frontend/src/SettingsBottomSheet.tsx").read_text(encoding="utf-8")
AUTHCTX_TSX = Path("/app/frontend/src/AuthContext.tsx").read_text(encoding="utf-8")


def test_backend_user_model_has_hall_address_and_owner_phone():
    # User model must expose the two new optional fields
    assert re.search(r"class User\(BaseModel\):[\s\S]*hallAddress:\s*Optional\[str\]", SERVER_PY)
    assert re.search(r"class User\(BaseModel\):[\s\S]*ownerPhone:\s*Optional\[str\]", SERVER_PY)


def test_backend_user_update_has_hall_address_and_owner_phone():
    assert re.search(r"class UserUpdate\(BaseModel\):[\s\S]*hallAddress:\s*Optional\[str\]", SERVER_PY)
    assert re.search(r"class UserUpdate\(BaseModel\):[\s\S]*ownerPhone:\s*Optional\[str\]", SERVER_PY)


def test_backend_auth_me_returns_new_fields():
    body = _extract_fn_body(SERVER_PY, "auth_me")
    assert '"hallAddress"' in body and '"ownerPhone"' in body


def test_backend_update_me_returns_new_fields():
    body = _extract_fn_body(SERVER_PY, "update_me")
    assert '"hallAddress"' in body and '"ownerPhone"' in body


def test_settings_sheet_has_three_input_testids():
    for tid in ["hall-name-input", "hall-address-input", "owner-phone-input"]:
        assert f'testID="{tid}"' in SETTINGS_TSX, f"missing testID {tid} in SettingsBottomSheet"


def test_api_update_me_accepts_new_fields():
    assert re.search(r"updateMe:\s*\(data:\s*\{[^}]*hallAddress\?[^}]*ownerPhone\?", API_TS)


def test_authctx_exports_update_profile_not_hall_name():
    assert "updateProfile" in AUTHCTX_TSX
    assert "updateHallName" not in AUTHCTX_TSX
    # User type has all 3 fields
    assert re.search(r"type User = \{[^}]*hallName\?[^}]*hallAddress\?[^}]*ownerPhone\?", AUTHCTX_TSX)


def test_invoice_html_accepts_and_renders_hall_address_and_phone():
    # buildInvoiceHtml signature has both opts
    assert re.search(r"buildInvoiceHtml\(booking:\s*Booking,\s*opts\?:\s*\{[^}]*hallAddress\?[^}]*ownerPhone\?", INVOICE_TS)
    # Renders 📍 and 📞 in headerSubHtml
    assert "headerSubHtml" in INVOICE_TS
    assert "📍" in INVOICE_TS and "📞" in INVOICE_TS


def test_report_html_accepts_and_renders_hall_address_and_phone():
    assert re.search(r"buildReportHtml\([^)]*opts\?:\s*\{[^}]*hallAddress\?[^}]*ownerPhone\?", INVOICE_TS)
    assert "headerSubBits" in INVOICE_TS


def test_share_invoice_and_report_forward_new_opts():
    assert re.search(r"shareInvoice\(booking:\s*Booking,\s*opts\?:\s*\{[^}]*hallAddress\?[^}]*ownerPhone\?", INVOICE_TS)
    assert re.search(r"shareReport\([^)]*opts\?:\s*\{[^}]*hallAddress\?[^}]*ownerPhone\?", INVOICE_TS)


def test_dashboard_forwards_new_fields_to_detail_and_report():
    assert "hallAddress={user?.hallAddress}" in DASHBOARD_TSX
    assert "ownerPhone={user?.ownerPhone}" in DASHBOARD_TSX


def test_bookings_screen_forwards_new_fields_to_detail():
    assert "hallAddress={user?.hallAddress}" in BOOKINGS_TSX
    assert "ownerPhone={user?.ownerPhone}" in BOOKINGS_TSX


def test_tabs_layout_uses_safe_area_insets():
    assert "useSafeAreaInsets" in TABS_LAYOUT_TSX
    assert "const insets = useSafeAreaInsets()" in TABS_LAYOUT_TSX
    assert "Math.max(insets.bottom" in TABS_LAYOUT_TSX
    # paddingBottom + height both use insets.bottom
    assert "paddingBottom: Math.max(insets.bottom" in TABS_LAYOUT_TSX
    assert "height: 60 + Math.max(insets.bottom" in TABS_LAYOUT_TSX


def test_tabs_content_paddingbottom_raised():
    for src, name in [(DASHBOARD_TSX, "dashboard"), (BOOKINGS_TSX, "bookings"), (CALENDAR_TSX, "calendar")]:
        matches = [int(x) for x in re.findall(r"paddingBottom:\s*(\d+)", src)]
        assert matches, f"no paddingBottom in {name}.tsx"
        assert max(matches) >= 160, f"{name}.tsx max paddingBottom {max(matches)} < 160"
