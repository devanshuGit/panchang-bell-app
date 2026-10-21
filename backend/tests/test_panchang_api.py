"""Backend tests for Hindu Panchang Alarm app - v2 (online Panchang + festivals)."""
import os
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://panchang-bell.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

DELHI = {"lat": 28.6139, "lng": 77.209}

TITHI_NAMES = {
    "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami",
    "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
    "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima",
    "Amavasya",
}
MASAS = {
    "Chaitra", "Vaishakha", "Jyeshtha", "Ashadha", "Shravana", "Bhadrapada",
    "Ashwin", "Kartika", "Margashirsha", "Pausha", "Magha", "Phalguna",
}


@pytest.fixture
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Panchang (base fields + v2 fields) ----------
class TestPanchang:
    def test_root(self, api_client):
        r = api_client.get(f"{API}/")
        assert r.status_code == 200

    def test_today_has_v2_fields(self, api_client):
        r = api_client.get(f"{API}/panchang", params=DELHI)
        assert r.status_code == 200, r.text
        d = r.json()
        # v2 fields
        for k in ["masa", "masa_hindi", "festivals", "observances", "source"]:
            assert k in d, f"missing {k}"
        assert d["source"] in {"online", "calculated"}
        assert isinstance(d["festivals"], list)
        assert isinstance(d["observances"], list)
        masa_base = d["masa"].replace("Adhika ", "")
        assert masa_base in MASAS
        assert d["tithi"] in TITHI_NAMES
        # Optional online fields may be None if source=calculated
        for k in ["sunrise", "sunset", "yoga", "karana", "rahu_kalam"]:
            assert k in d

    def test_invalid_date_is_400_not_500(self, api_client):
        r = api_client.get(f"{API}/panchang", params={"date": "bad"})
        assert r.status_code == 400, r.text

    def test_range_30_days(self, api_client):
        r = api_client.get(
            f"{API}/panchang/range",
            params={"start": "2026-10-21", "days": 30, **DELHI},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data) == 30
        dates = [d["date"] for d in data]
        assert dates[0] == "2026-10-21"
        assert dates[-1] == "2026-11-19"
        assert len(set(dates)) == 30

    def test_range_too_many_days_422(self, api_client):
        r = api_client.get(f"{API}/panchang/range", params={"start": "2026-10-21", "days": 60})
        assert r.status_code == 422

    def test_month_bad_month_422(self, api_client):
        r = api_client.get(f"{API}/panchang/month", params={"year": 2026, "month": 13})
        assert r.status_code == 422


def _month(api_client, year, month):
    r = api_client.get(
        f"{API}/panchang/month",
        params={"year": year, "month": month, **DELHI},
        timeout=90,
    )
    assert r.status_code == 200, r.text
    return r.json()


def _festivals_on(month_data, iso_date):
    for d in month_data:
        if d["date"] == iso_date:
            return d["festivals"]
    return None


# ---------- Festival calendar matrix (Delhi 28.61,77.21) ----------
class TestFestivals:
    @pytest.fixture(scope="class")
    def month_nov(self, api_client=requests.Session()):
        api_client.headers.update({"Content-Type": "application/json"})
        return _month(api_client, 2026, 11)

    def test_november_2026_30_entries(self, month_nov):
        assert len(month_nov) == 30

    def test_diwali_2026_11_08(self, month_nov):
        fs = _festivals_on(month_nov, "2026-11-08")
        assert fs is not None
        assert any("Diwali" in f for f in fs), f"Expected Diwali on 2026-11-08, got {fs}"

    def test_dhanteras_2026_11_06(self, month_nov):
        fs = _festivals_on(month_nov, "2026-11-06")
        assert any("Dhanteras" in f for f in fs), f"got {fs}"

    def test_bhai_dooj_2026_11_11(self, month_nov):
        fs = _festivals_on(month_nov, "2026-11-11")
        assert any("Bhai Dooj" in f for f in fs), f"got {fs}"

    def test_maha_shivaratri_feb_2026(self, api_client):
        data = _month(api_client, 2026, 2)
        fs = _festivals_on(data, "2026-02-15")
        assert fs is not None and any("Shivaratri" in f for f in fs), f"got {fs}"

    def test_dussehra_oct_2026(self, api_client):
        data = _month(api_client, 2026, 10)
        fs = _festivals_on(data, "2026-10-20")
        assert fs is not None and any("Dussehra" in f for f in fs), f"got {fs}"

    def test_holi_march_2026(self, api_client):
        data = _month(api_client, 2026, 3)
        fs = _festivals_on(data, "2026-03-04")
        assert fs is not None and any("Holi" in f for f in fs), f"got {fs}"

    def test_makar_sankranti_jan_2026(self, api_client):
        data = _month(api_client, 2026, 1)
        fs = _festivals_on(data, "2026-01-14")
        assert fs is not None and any("Makar Sankranti" in f for f in fs), f"got {fs}"

    def test_sept_2026_janmashtami_and_ganesh(self, api_client):
        data = _month(api_client, 2026, 9)
        fs1 = _festivals_on(data, "2026-09-04")
        fs2 = _festivals_on(data, "2026-09-14")
        assert fs1 is not None and any("Janmashtami" in f for f in fs1), f"janmashtami got {fs1}"
        assert fs2 is not None and any("Ganesh Chaturthi" in f for f in fs2), f"ganesh got {fs2}"


# ---------- Alarms CRUD regression ----------
class TestAlarms:
    created_ids = []

    def test_create_alarm(self, api_client):
        payload = {
            "label": "TEST_Morning Tithi",
            "hour": 6, "minute": 0, "sound": "om",
            "days": [0, 1, 2, 3, 4, 5, 6],
        }
        r = api_client.post(f"{API}/alarms", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "_id" not in d
        assert d["label"] == payload["label"]
        TestAlarms.created_ids.append(d["id"])

    def test_list_alarms_contains_created(self, api_client):
        r = api_client.get(f"{API}/alarms")
        assert r.status_code == 200
        assert any(a["id"] == TestAlarms.created_ids[0] for a in r.json())

    def test_patch_alarm_toggle(self, api_client):
        aid = TestAlarms.created_ids[0]
        r = api_client.patch(f"{API}/alarms/{aid}", json={"enabled": False, "minute": 15})
        assert r.status_code == 200
        d = r.json()
        assert d["enabled"] is False and d["minute"] == 15

    def test_patch_alarm_empty_400(self, api_client):
        r = api_client.patch(f"{API}/alarms/{TestAlarms.created_ids[0]}", json={})
        assert r.status_code == 400

    def test_patch_missing_404(self, api_client):
        r = api_client.patch(f"{API}/alarms/nope", json={"enabled": True})
        assert r.status_code == 404

    def test_delete_alarm(self, api_client):
        r = api_client.delete(f"{API}/alarms/{TestAlarms.created_ids[0]}")
        assert r.status_code == 200

    def test_delete_missing_404(self, api_client):
        r = api_client.delete(f"{API}/alarms/nope")
        assert r.status_code == 404

    def test_create_invalid_hour_422(self, api_client):
        r = api_client.post(f"{API}/alarms", json={"hour": 25, "minute": 0})
        assert r.status_code == 422


# ---------- Settings ----------
class TestSettings:
    def test_get_default(self, api_client):
        r = api_client.get(f"{API}/settings")
        assert r.status_code == 200
        d = r.json()
        assert "_id" not in d
        for k in ["lat", "lng", "city", "default_sound", "use_device_location"]:
            assert k in d

    def test_put_persists(self, api_client):
        payload = {"lat": 19.076, "lng": 72.8777, "city": "TEST_Mumbai",
                   "default_sound": "bell", "use_device_location": False}
        r = api_client.put(f"{API}/settings", json=payload)
        assert r.status_code == 200
        r2 = api_client.get(f"{API}/settings").json()
        assert r2["city"] == "TEST_Mumbai"
        # cleanup
        api_client.put(f"{API}/settings", json={
            "lat": 28.6139, "lng": 77.209, "city": "New Delhi",
            "default_sound": "om", "use_device_location": True})
