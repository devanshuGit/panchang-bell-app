"""Backend tests for Ekadashi list + Vrat tracker + regression (sunrise UTC day,
Vat Purnima deduplication)."""
import os
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://panchang-bell.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"
DELHI = {"lat": 28.61, "lng": 77.21}


@pytest.fixture
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- /api/ekadashis ----------
class TestEkadashis:
    @pytest.fixture(scope="class")
    def days_2026(self):
        s = requests.Session()
        r = s.get(f"{API}/ekadashis", params={"year": 2026, **DELHI}, timeout=60)
        assert r.status_code == 200, r.text
        return r.json()

    def test_count_is_24(self, days_2026):
        # 24 Ekadashis in a standard year (no Adhika masa in 2026)
        assert len(days_2026) == 24, f"expected 24, got {len(days_2026)}"

    def test_no_duplicate_dates(self, days_2026):
        dates = [d["date"] for d in days_2026]
        assert len(set(dates)) == len(dates), f"duplicate dates: {dates}"

    def test_entry_shape(self, days_2026):
        for d in days_2026:
            assert set(d.keys()) >= {"date", "paksha", "katha_id", "name", "name_hindi"}
            assert d["paksha"] in {"Shukla", "Krishna"}

    def test_known_ekadashis_present(self, days_2026):
        by_date = {d["date"]: d for d in days_2026}
        # Padmini (Adhika Shukla Ekadashi) — but 2026 has no Adhika, this one is still named
        # per the "padmini" katha id. Spec: 2026-05-26 padmini.
        assert "2026-05-26" in by_date, [d["date"] for d in days_2026[:12]]
        assert by_date["2026-05-26"]["katha_id"] == "padmini"
        # Parama 2026-06-11 (Krishna)
        assert "2026-06-11" in by_date
        assert by_date["2026-06-11"]["katha_id"] == "parama"
        # Nirjala 2026-06-25 (Shukla Jyeshtha)
        assert "2026-06-25" in by_date
        assert by_date["2026-06-25"]["katha_id"] == "nirjala"
        # Devutthana 2026-11-20
        assert "2026-11-20" in by_date
        assert by_date["2026-11-20"]["katha_id"] == "devutthana"

    def test_yogini_only_once(self, days_2026):
        yogini = [d for d in days_2026 if d["katha_id"] == "yogini"]
        # Spec: yogini only once, on 2026-07-10
        assert len(yogini) == 1, f"expected 1 yogini entry, got {[d['date'] for d in yogini]}"
        assert yogini[0]["date"] == "2026-07-10"

    def test_name_hindi_devanagari(self, days_2026):
        for d in days_2026:
            assert any("\u0900" <= ch <= "\u097F" for ch in d["name_hindi"]), d


# ---------- /api/vrats ----------
class TestVrats:
    created_dates = []

    def test_list_initial(self, api_client):
        r = api_client.get(f"{API}/vrats", params={"year": 2026})
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_put_upsert(self, api_client):
        d = "2026-02-02"  # TEST entry; past date
        r = api_client.put(f"{API}/vrats/{d}", json={"kept": True})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body == {"date": d, "kept": True}
        TestVrats.created_dates.append(d)

        # Toggle to False and verify persistence via GET list
        r2 = api_client.put(f"{API}/vrats/{d}", json={"kept": False})
        assert r2.status_code == 200
        assert r2.json()["kept"] is False

        got = api_client.get(f"{API}/vrats", params={"year": 2026}).json()
        found = [v for v in got if v["date"] == d]
        assert len(found) == 1 and found[0]["kept"] is False

    def test_future_date_400(self, api_client):
        r = api_client.put(f"{API}/vrats/2027-05-01", json={"kept": True})
        assert r.status_code == 400, r.text

    def test_bad_date_400(self, api_client):
        r = api_client.put(f"{API}/vrats/not-a-date", json={"kept": True})
        assert r.status_code == 400, r.text

    @classmethod
    def teardown_class(cls):
        # Clean up any created vrat entries directly via mongo
        try:
            import asyncio
            from motor.motor_asyncio import AsyncIOMotorClient
            from dotenv import load_dotenv
            from pathlib import Path
            load_dotenv(Path(__file__).resolve().parents[1] / ".env")
            client = AsyncIOMotorClient(os.environ["MONGO_URL"])
            db = client[os.environ["DB_NAME"]]
            async def _cleanup():
                for d in cls.created_dates:
                    await db.vrat_log.delete_one({"date": d})
            asyncio.get_event_loop().run_until_complete(_cleanup())
            client.close()
        except Exception as e:
            print("vrat cleanup skipped:", e)


# ---------- Regression: Vat Purnima once, sunrise UTC on correct day ----------
class TestRegression:
    def test_vat_purnima_only_2026_06_29(self, api_client):
        r = api_client.get(
            f"{API}/panchang/range",
            params={"start": "2026-06-28", "days": 4, **DELHI},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        hits = [d["date"] for d in r.json() if any("Vat Purnima" in f for f in d["festivals"])]
        assert hits == ["2026-06-29"], f"Vat Purnima occurrences: {hits}"

    def test_sunrise_utc_on_prev_day_for_delhi(self, api_client):
        # Delhi sunrise ~ 05:24 IST = ~23:54 UTC previous day
        r = api_client.get(f"{API}/panchang", params={"date": "2026-06-15", **DELHI})
        assert r.status_code == 200, r.text
        su = r.json()["sunrise_utc"]
        assert su.startswith("2026-06-14T23:5"), f"sunrise_utc={su}"
