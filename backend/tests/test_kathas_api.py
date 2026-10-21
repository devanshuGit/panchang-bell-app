"""Tests for new /api/kathas endpoints and panchang kathas/kshaya integration."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://panchang-bell.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
DELHI = {"lat": 28.61, "lng": 77.21}


@pytest.fixture
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


class TestKathasList:
    def test_list_all(self, api_client):
        r = api_client.get(f"{API}/kathas")
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data) == 58, f"expected 58, got {len(data)}"
        for row in data:
            assert set(row.keys()) == {"id", "title", "title_hindi"}, row

    def test_list_ekadashi(self, api_client):
        r = api_client.get(f"{API}/kathas", params={"category": "ekadashi"})
        assert r.status_code == 200
        assert len(r.json()) == 26

    def test_list_festival(self, api_client):
        r = api_client.get(f"{API}/kathas", params={"category": "festival"})
        assert r.status_code == 200
        assert len(r.json()) == 29

    def test_list_monthly(self, api_client):
        r = api_client.get(f"{API}/kathas", params={"category": "monthly"})
        assert r.status_code == 200
        assert len(r.json()) == 3

    def test_list_bad_category_422(self, api_client):
        r = api_client.get(f"{API}/kathas", params={"category": "bogus"})
        assert r.status_code == 422


class TestKathaDetail:
    def test_rama_detail(self, api_client):
        r = api_client.get(f"{API}/kathas/rama")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"] == "rama"
        assert d["category"] == "ekadashi"
        for k in ["title", "title_hindi", "vidhi", "vidhi_hindi", "story", "story_hindi"]:
            assert d[k] and isinstance(d[k], str), f"{k} empty"
        # devanagari in hindi fields
        assert any("\u0900" <= c <= "\u097F" for c in d["story_hindi"])

    def test_nirjala_has_own_vidhi(self, api_client):
        r = api_client.get(f"{API}/kathas/nirjala")
        assert r.status_code == 200
        assert "water" in r.json()["vidhi"].lower()

    def test_festival_katha_diwali(self, api_client):
        r = api_client.get(f"{API}/kathas/diwali")
        assert r.status_code == 200
        assert r.json()["category"] == "festival"

    def test_monthly_katha_satyanarayan(self, api_client):
        r = api_client.get(f"{API}/kathas/satyanarayan")
        assert r.status_code == 200
        assert r.json()["category"] == "monthly"

    def test_missing_404(self, api_client):
        r = api_client.get(f"{API}/kathas/nope")
        assert r.status_code == 404


class TestPanchangKathasKshaya:
    @pytest.fixture(scope="class")
    def nov(self):
        s = requests.Session()
        r = s.get(f"{API}/panchang/month", params={"year": 2026, "month": 11, **DELHI}, timeout=90)
        assert r.status_code == 200
        return {d["date"]: d for d in r.json()}

    def test_nov5_rama(self, nov):
        d = nov["2026-11-05"]
        ids = [k["id"] for k in d["kathas"]]
        assert ids == ["rama"], f"got {ids}"

    def test_nov8_narak_diwali(self, nov):
        d = nov["2026-11-08"]
        ids = [k["id"] for k in d["kathas"]]
        assert "narak-chaturdashi" in ids and "diwali" in ids, f"got {ids}"

    def test_nov20_devutthana_kshaya(self, nov):
        d = nov["2026-11-20"]
        assert d["kshaya_tithi"] == "Ekadashi", f"kshaya={d['kshaya_tithi']}"
        assert any("Dev Uthani Ekadashi" in f for f in d["festivals"]), d["festivals"]
        ids = [k["id"] for k in d["kathas"]]
        assert "devutthana" in ids, f"got {ids}"
        assert d["is_fasting_day"] is True

    def test_nov24_kartik_purnima_satyanarayan(self, nov):
        d = nov["2026-11-24"]
        ids = [k["id"] for k in d["kathas"]]
        assert "kartik-purnima" in ids and "satyanarayan" in ids, f"got {ids}"
