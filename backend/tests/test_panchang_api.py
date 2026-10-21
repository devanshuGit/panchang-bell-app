"""Backend tests for Hindu Panchang Alarm app."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://panchang-bell.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

TITHI_NAMES = {
    "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami",
    "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
    "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima",
    "Amavasya",
}
NAKSHATRAS = {
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
    "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha",
    "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha",
    "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada",
    "Uttara Bhadrapada", "Revati",
}


@pytest.fixture
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Panchang ----------
class TestPanchang:
    def test_root(self, api_client):
        r = api_client.get(f"{API}/")
        assert r.status_code == 200
        assert "message" in r.json()

    def test_panchang_today_delhi(self, api_client):
        r = api_client.get(f"{API}/panchang", params={"lat": 28.6139, "lng": 77.209})
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["date", "tithi", "tithi_hindi", "tithi_number", "paksha",
                  "nakshatra", "sunrise_utc", "significance", "is_fasting_day"]:
            assert k in data, f"missing {k}"
        assert data["tithi"] in TITHI_NAMES
        assert 1 <= data["tithi_number"] <= 30
        assert data["paksha"] in {"Shukla", "Krishna"}
        assert data["nakshatra"] in NAKSHATRAS
        assert isinstance(data["is_fasting_day"], bool)
        expected_fast = data["tithi"] in {"Ekadashi", "Chaturdashi", "Purnima", "Amavasya"}
        assert data["is_fasting_day"] == expected_fast

    def test_panchang_future_date(self, api_client):
        r = api_client.get(f"{API}/panchang",
                           params={"date": "2026-10-15", "lat": 28.6, "lng": 77.2})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["date"] == "2026-10-15"
        assert data["tithi"] in TITHI_NAMES
        assert data["nakshatra"] in NAKSHATRAS

    def test_panchang_invalid_date(self, api_client):
        r = api_client.get(f"{API}/panchang", params={"date": "not-a-date"})
        assert r.status_code == 500 or r.status_code == 400

    def test_panchang_week(self, api_client):
        r = api_client.get(f"{API}/panchang/week",
                           params={"lat": 28.6139, "lng": 77.209})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 7
        dates = [d["date"] for d in data]
        assert len(set(dates)) == 7
        for entry in data:
            assert entry["tithi"] in TITHI_NAMES
            assert 1 <= entry["tithi_number"] <= 30
            assert entry["paksha"] in {"Shukla", "Krishna"}


# ---------- Alarms CRUD ----------
class TestAlarms:
    created_ids = []

    def test_create_alarm(self, api_client):
        payload = {
            "label": "TEST_Morning Tithi",
            "hour": 6, "minute": 0,
            "sound": "om",
            "days": [0, 1, 2, 3, 4, 5, 6],
        }
        r = api_client.post(f"{API}/alarms", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "id" in data
        assert "_id" not in data
        assert data["label"] == payload["label"]
        assert data["hour"] == 6 and data["minute"] == 0
        assert data["enabled"] is True
        TestAlarms.created_ids.append(data["id"])

    def test_list_alarms_contains_created(self, api_client):
        assert TestAlarms.created_ids, "need created alarm"
        r = api_client.get(f"{API}/alarms")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for a in data:
            assert "_id" not in a
        assert any(a["id"] == TestAlarms.created_ids[0] for a in data)

    def test_patch_alarm_toggle_enabled(self, api_client):
        aid = TestAlarms.created_ids[0]
        r = api_client.patch(f"{API}/alarms/{aid}", json={"enabled": False, "minute": 15})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["enabled"] is False
        assert data["minute"] == 15
        # verify persistence
        r2 = api_client.get(f"{API}/alarms")
        found = next((a for a in r2.json() if a["id"] == aid), None)
        assert found is not None
        assert found["enabled"] is False and found["minute"] == 15

    def test_patch_alarm_empty_body(self, api_client):
        aid = TestAlarms.created_ids[0]
        r = api_client.patch(f"{API}/alarms/{aid}", json={})
        assert r.status_code == 400

    def test_patch_missing_alarm(self, api_client):
        r = api_client.patch(f"{API}/alarms/nonexistent-id", json={"enabled": True})
        assert r.status_code == 404

    def test_delete_alarm(self, api_client):
        aid = TestAlarms.created_ids[0]
        r = api_client.delete(f"{API}/alarms/{aid}")
        assert r.status_code == 200
        # verify gone
        r2 = api_client.get(f"{API}/alarms")
        assert not any(a["id"] == aid for a in r2.json())

    def test_delete_missing_alarm(self, api_client):
        r = api_client.delete(f"{API}/alarms/nonexistent-id")
        assert r.status_code == 404

    def test_create_alarm_invalid_hour(self, api_client):
        r = api_client.post(f"{API}/alarms", json={"hour": 25, "minute": 0})
        assert r.status_code == 422


# ---------- Settings ----------
class TestSettings:
    def test_get_settings_default(self, api_client):
        r = api_client.get(f"{API}/settings")
        assert r.status_code == 200
        data = r.json()
        assert "_id" not in data
        for k in ["lat", "lng", "city", "default_sound", "use_device_location"]:
            assert k in data

    def test_put_and_get_settings(self, api_client):
        payload = {
            "lat": 19.076,
            "lng": 72.8777,
            "city": "TEST_Mumbai",
            "default_sound": "bell",
            "use_device_location": False,
        }
        r = api_client.put(f"{API}/settings", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "_id" not in data
        assert data["city"] == "TEST_Mumbai"
        assert data["default_sound"] == "bell"
        # verify persistence
        r2 = api_client.get(f"{API}/settings")
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["city"] == "TEST_Mumbai"
        assert d2["lat"] == 19.076
        assert d2["use_device_location"] is False
        # reset
        api_client.put(f"{API}/settings", json={
            "lat": 28.6139, "lng": 77.2090, "city": "New Delhi",
            "default_sound": "om", "use_device_location": True,
        })
