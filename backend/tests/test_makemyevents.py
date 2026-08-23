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


# Bookings - all require auth
@pytest.mark.parametrize("method,path", [
    ("get", "/bookings"),
    ("post", "/bookings"),
    ("post", "/bookings/seed"),
    ("patch", "/bookings/BKG-XXXX"),
    ("delete", "/bookings/BKG-XXXX"),
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
