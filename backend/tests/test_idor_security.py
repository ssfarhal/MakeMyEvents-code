"""
IDOR Security Tests for BookMyEvents booking endpoints (SEC-001)
Tests: update_booking, add_payment, delete_payment, delete_booking
All tests in ONE class so loadscope pins them to a single xdist worker (no OTP races).
"""

import pytest
import requests
import time

BASE_URL = "https://app-launcher-3237.preview.emergentagent.com"


def login(phone: str) -> str:
    """OTP login and return session token."""
    r = requests.post(f"{BASE_URL}/api/auth/phone-otp/send", json={"phone": phone})
    assert r.status_code == 200, f"OTP send failed: {r.text}"
    otp = r.json()["otp"]
    r2 = requests.post(f"{BASE_URL}/api/auth/phone-otp/verify", json={"phone": phone, "otp": otp})
    assert r2.status_code == 200, f"OTP verify failed: {r2.text}"
    return r2.json()["session_token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def create_booking(token: str) -> str:
    payload = {
        "clientName": "TEST_Client",
        "phone": "9999999999",
        "eventType": "Wedding",
        "eventDate": "2026-12-31",
        "totalAmount": 100000,
        "advancePaid": 0,
    }
    r = requests.post(f"{BASE_URL}/api/bookings", json=payload, headers=auth(token))
    assert r.status_code == 200, f"Create booking failed: {r.text}"
    return r.json()["id"]


# All tests in one class so loadscope pins them to ONE worker
class TestIDORSecuritySEC001:
    """IDOR Security tests - all on one worker via loadscope."""

    @pytest.fixture(scope="class")
    def setup(self):
        """Login two users and create booking for User A."""
        token_a = login("+911111111111")
        time.sleep(0.5)
        token_b = login("+912222222222")
        booking_id = create_booking(token_a)
        yield token_a, token_b, booking_id
        # Cleanup
        requests.delete(f"{BASE_URL}/api/bookings/{booking_id}", headers=auth(token_a))

    # --- IDOR Prevention ---

    def test_user_b_cannot_patch_user_a_booking(self, setup):
        token_a, token_b, booking_id = setup
        r = requests.patch(
            f"{BASE_URL}/api/bookings/{booking_id}",
            json={"notes": "HACKED"},
            headers=auth(token_b),
        )
        assert r.status_code == 404, f"IDOR VULNERABILITY! PATCH returned {r.status_code}: {r.text}"
        print(f"PASS: PATCH IDOR prevented (404)")

    def test_user_b_cannot_add_payment_to_user_a_booking(self, setup):
        token_a, token_b, booking_id = setup
        r = requests.post(
            f"{BASE_URL}/api/bookings/{booking_id}/payments",
            json={"amount": 1000},
            headers=auth(token_b),
        )
        assert r.status_code == 404, f"IDOR VULNERABILITY! POST payment returned {r.status_code}: {r.text}"
        print(f"PASS: POST payment IDOR prevented (404)")

    def test_user_b_cannot_delete_user_a_booking(self, setup):
        token_a, token_b, booking_id = setup
        r = requests.delete(
            f"{BASE_URL}/api/bookings/{booking_id}",
            headers=auth(token_b),
        )
        assert r.status_code == 404, f"IDOR VULNERABILITY! DELETE booking returned {r.status_code}: {r.text}"
        print(f"PASS: DELETE booking IDOR prevented (404)")

    def test_user_b_cannot_delete_payment_from_user_a_booking(self, setup):
        token_a, token_b, booking_id = setup
        r = requests.delete(
            f"{BASE_URL}/api/bookings/{booking_id}/payments/0",
            headers=auth(token_b),
        )
        assert r.status_code == 404, f"IDOR VULNERABILITY! DELETE payment returned {r.status_code}: {r.text}"
        print(f"PASS: DELETE payment IDOR prevented (404)")

    # --- Legitimate Access ---

    def test_user_a_can_patch_own_booking(self, setup):
        token_a, token_b, booking_id = setup
        r = requests.patch(
            f"{BASE_URL}/api/bookings/{booking_id}",
            json={"notes": "Updated by owner"},
            headers=auth(token_a),
        )
        assert r.status_code == 200, f"Legitimate PATCH failed: {r.status_code}: {r.text}"
        print(f"PASS: Legitimate PATCH works (200)")

    def test_user_a_can_add_payment_to_own_booking(self, setup):
        token_a, token_b, booking_id = setup
        r = requests.post(
            f"{BASE_URL}/api/bookings/{booking_id}/payments",
            json={"amount": 5000},
            headers=auth(token_a),
        )
        assert r.status_code == 200, f"Legitimate add payment failed: {r.status_code}: {r.text}"
        print(f"PASS: Legitimate POST payment works (200)")

    def test_user_a_can_delete_payment_from_own_booking(self, setup):
        token_a, token_b, booking_id = setup
        r = requests.delete(
            f"{BASE_URL}/api/bookings/{booking_id}/payments/0",
            headers=auth(token_a),
        )
        assert r.status_code == 200, f"Legitimate delete payment failed: {r.status_code}: {r.text}"
        print(f"PASS: Legitimate DELETE payment works (200)")
