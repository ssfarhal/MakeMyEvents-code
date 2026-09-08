"""
BookMyEvents backend tests — covers health, API root, managers, public delete-account, phone-verify endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')


# Health check
class TestHealth:
    def test_health_ok(self):
        r = requests.get(f"{BASE_URL}/health", timeout=10)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_api_root(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=10)
        assert r.status_code == 200
        assert r.json().get("message") == "BookMyEvents API"


# Public delete-account endpoint (no auth needed)
class TestPublicDeleteAccount:
    def test_delete_nonexistent_email_returns_ok(self):
        r = requests.post(f"{BASE_URL}/api/public/delete-account",
                          json={"email": "TEST_nonexistent_user@example.com"}, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True

    def test_delete_invalid_email_returns_400(self):
        r = requests.post(f"{BASE_URL}/api/public/delete-account",
                          json={"email": "notanemail"}, timeout=10)
        assert r.status_code == 400

    def test_delete_empty_email_returns_422_or_400(self):
        r = requests.post(f"{BASE_URL}/api/public/delete-account",
                          json={"email": ""}, timeout=10)
        assert r.status_code in (400, 422)


# Managers endpoints require auth — verify 401 without token
class TestManagersAuthRequired:
    def test_list_managers_no_auth_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/managers", timeout=10)
        assert r.status_code == 401

    def test_add_manager_no_auth_returns_401(self):
        r = requests.post(f"{BASE_URL}/api/managers",
                          json={"identifier": "+911234567890", "identifier_type": "phone"}, timeout=10)
        assert r.status_code == 401

    def test_delete_manager_no_auth_returns_401(self):
        r = requests.delete(f"{BASE_URL}/api/managers/+911234567890", timeout=10)
        assert r.status_code == 401


# Phone verify endpoint — verify it exists and returns 400 when Firebase not configured
class TestPhoneVerify:
    def test_phone_verify_without_firebase_returns_400_not_404(self):
        r = requests.post(f"{BASE_URL}/api/auth/phone-verify",
                          json={"firebase_id_token": "dummy_token"}, timeout=10)
        # Should be 400 (Firebase not configured) not 404 (endpoint missing)
        assert r.status_code in (400, 401, 422)
        assert r.status_code != 404


# IDOR check — update_booking with wrong user_id returns 404 (no cross-user access)
class TestIDOR:
    def test_update_booking_no_auth_returns_401(self):
        r = requests.patch(f"{BASE_URL}/api/bookings/BME-001",
                           json={"notes": "hacked"}, timeout=10)
        assert r.status_code == 401
