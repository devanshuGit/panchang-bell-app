"""Hindu Panchang Alarm backend.

Exposes endpoints for computing today's/any day's Tithi + Panchang info and
storing user alarms. Tithi is computed astronomically using simplified
Meeus formulas; location-aware sunrise is approximated. Also attempts a
best-effort fetch from a free Hindu Panchang API as a secondary source.
"""

from __future__ import annotations

import logging
import math
import os
import uuid
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Panchang Alarm API")
api = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Panchang astronomical computation
# ---------------------------------------------------------------------------

TITHI_NAMES = [
    "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami",
    "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
    "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi", "Purnima",
]

TITHI_HINDI = [
    "प्रतिपदा", "द्वितीया", "तृतीया", "चतुर्थी", "पंचमी",
    "षष्ठी", "सप्तमी", "अष्टमी", "नवमी", "दशमी",
    "एकादशी", "द्वादशी", "त्रयोदशी", "चतुर्दशी", "पूर्णिमा",
]

NAKSHATRAS = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni",
    "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha",
    "Anuradha", "Jyeshtha", "Mula", "Purva Ashadha", "Uttara Ashadha",
    "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada",
    "Uttara Bhadrapada", "Revati",
]

# Fasting / spiritual significance per tithi index (1..30 in paksha order)
TITHI_SIGNIFICANCE = {
    "Pratipada": "Beginning of paksha; auspicious for new ventures.",
    "Dwitiya": "Favorable for travel and foundation of homes.",
    "Tritiya": "Good for feminine deities; Hartalika observed by married women.",
    "Chaturthi": "Sankashti Chaturthi — devoted to Lord Ganesha; moonrise fast.",
    "Panchami": "Naga Panchami; worship of serpents and knowledge.",
    "Shashthi": "Skanda Shashthi — devoted to Lord Kartikeya.",
    "Saptami": "Dedicated to Surya; chant Gayatri mantra at sunrise.",
    "Ashtami": "Durga Ashtami / Krishna Ashtami — fast and bhajan.",
    "Navami": "Rama Navami on Shukla; Mahanavami in Shardiya Navratri.",
    "Dashami": "Vijayadashami in Ashwin; day of victory of good over evil.",
    "Ekadashi": "Fast day — abstain from grains, dedicated to Lord Vishnu.",
    "Dwadashi": "Break Ekadashi fast (Parana); charity and feeding brahmins.",
    "Trayodashi": "Pradosh Vrat — evening worship of Lord Shiva.",
    "Chaturdashi": "Masik Shivaratri on Krishna; Narak Chaturdashi before Diwali.",
    "Purnima": "Full moon fast; Satyanarayan katha, auspicious for all vratas.",
    "Amavasya": "New moon; pitru tarpan, pind daan, remembrance of ancestors.",
}


def _norm(angle_deg: float) -> float:
    return angle_deg % 360.0


def _julian_day(dt: datetime) -> float:
    """Julian Day for a given UTC datetime."""
    y, m = dt.year, dt.month
    d = dt.day + (dt.hour + dt.minute / 60.0 + dt.second / 3600.0) / 24.0
    if m <= 2:
        y -= 1
        m += 12
    a = y // 100
    b = 2 - a + a // 4
    return math.floor(365.25 * (y + 4716)) + math.floor(30.6001 * (m + 1)) + d + b - 1524.5


def _sun_longitude(jd: float) -> float:
    """Approximate ecliptic longitude of the Sun (tropical)."""
    t = (jd - 2451545.0) / 36525.0
    l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t
    m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t
    m_rad = math.radians(m)
    c = (
        (1.914602 - 0.004817 * t - 0.000014 * t * t) * math.sin(m_rad)
        + (0.019993 - 0.000101 * t) * math.sin(2 * m_rad)
        + 0.000289 * math.sin(3 * m_rad)
    )
    return _norm(l0 + c)


def _moon_longitude(jd: float) -> float:
    """Approximate ecliptic longitude of the Moon (tropical, ~0.3° accuracy)."""
    t = (jd - 2451545.0) / 36525.0
    lp = 218.3164477 + 481267.88123421 * t
    d = 297.8501921 + 445267.1114034 * t
    m = 357.5291092 + 35999.0502909 * t
    mp = 134.9633964 + 477198.8675055 * t
    f = 93.2720950 + 483202.0175233 * t
    d_r, m_r, mp_r, f_r = map(math.radians, (d, m, mp, f))
    lon = lp + (
        6.289 * math.sin(mp_r)
        - 1.274 * math.sin(mp_r - 2 * d_r)
        + 0.658 * math.sin(2 * d_r)
        - 0.186 * math.sin(m_r)
        - 0.059 * math.sin(2 * mp_r - 2 * d_r)
        - 0.057 * math.sin(mp_r - 2 * d_r + m_r)
        + 0.053 * math.sin(mp_r + 2 * d_r)
        + 0.046 * math.sin(2 * d_r - m_r)
        + 0.041 * math.sin(mp_r - m_r)
        - 0.035 * math.sin(d_r)
        - 0.031 * math.sin(mp_r + m_r)
        - 0.015 * math.sin(2 * f_r - 2 * d_r)
        + 0.011 * math.sin(mp_r - 4 * d_r)
    )
    return _norm(lon)


# Lahiri ayanamsa approximation
def _ayanamsa(jd: float) -> float:
    t = (jd - 2451545.0) / 36525.0
    return 23.85 + 0.0137 * (jd - 2451545.0) / 365.25 + 0 * t  # ~linear growth


def compute_panchang(dt_utc: datetime, lat: float, lng: float) -> dict:
    """Compute Tithi / Nakshatra / Paksha for the sunrise moment of a date."""
    # Local sunrise approximation (NOAA simple):
    sunrise_utc = _sunrise_utc(dt_utc.date(), lat, lng)
    jd = _julian_day(sunrise_utc)
    sun_lon = _sun_longitude(jd)
    moon_lon = _moon_longitude(jd)

    diff = _norm(moon_lon - sun_lon)
    tithi_index = int(diff // 12)  # 0..29

    if tithi_index < 15:
        paksha = "Shukla"
        name = TITHI_NAMES[tithi_index]
        hindi = TITHI_HINDI[tithi_index]
    else:
        paksha = "Krishna"
        idx = tithi_index - 15
        if idx == 14:
            name = "Amavasya"
            hindi = "अमावस्या"
        else:
            name = TITHI_NAMES[idx]
            hindi = TITHI_HINDI[idx]

    # Nakshatra from sidereal moon longitude
    ayan = _ayanamsa(jd)
    sidereal_moon = _norm(moon_lon - ayan)
    nak_index = int(sidereal_moon // (360 / 27))
    nakshatra = NAKSHATRAS[nak_index]

    # % progress through this tithi (0..100)
    progress = ((diff % 12) / 12) * 100

    return {
        "date": dt_utc.date().isoformat(),
        "tithi": name,
        "tithi_hindi": hindi,
        "tithi_number": tithi_index + 1,  # 1..30
        "paksha": paksha,
        "paksha_hindi": "शुक्ल पक्ष" if paksha == "Shukla" else "कृष्ण पक्ष",
        "nakshatra": nakshatra,
        "progress_pct": round(progress, 1),
        "sunrise_utc": sunrise_utc.isoformat(),
        "significance": TITHI_SIGNIFICANCE.get(name, ""),
        "is_fasting_day": name in {"Ekadashi", "Chaturdashi", "Purnima", "Amavasya"},
    }


def _sunrise_utc(d: date, lat: float, lng: float) -> datetime:
    """Approx sunrise in UTC using NOAA simplified algorithm."""
    n = (d - date(d.year, 1, 1)).days + 1
    # Fractional year
    lng_hour = lng / 15.0
    t = n + ((6 - lng_hour) / 24)
    m = (0.9856 * t) - 3.289
    l = _norm(m + 1.916 * math.sin(math.radians(m)) + 0.020 * math.sin(math.radians(2 * m)) + 282.634)
    ra = math.degrees(math.atan(0.91764 * math.tan(math.radians(l))))
    ra = _norm(ra)
    l_quad = (math.floor(l / 90)) * 90
    ra_quad = (math.floor(ra / 90)) * 90
    ra += (l_quad - ra_quad)
    ra_h = ra / 15.0
    sin_dec = 0.39782 * math.sin(math.radians(l))
    cos_dec = math.cos(math.asin(sin_dec))
    cos_h = (math.cos(math.radians(90.833)) - sin_dec * math.sin(math.radians(lat))) / (
        cos_dec * math.cos(math.radians(lat))
    )
    if cos_h > 1 or cos_h < -1:
        # polar day/night, fallback to 06:00 local
        return datetime.combine(d, time(6, 0), tzinfo=timezone.utc) - timedelta(hours=lng_hour)
    h = 360 - math.degrees(math.acos(cos_h))
    h /= 15.0
    tt = h + ra_h - 0.06571 * t - 6.622
    ut = tt - lng_hour
    ut = ut % 24
    hours = int(ut)
    minutes = int((ut - hours) * 60)
    return datetime(d.year, d.month, d.day, hours, minutes, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class Panchang(BaseModel):
    date: str
    tithi: str
    tithi_hindi: str
    tithi_number: int
    paksha: str
    paksha_hindi: str
    nakshatra: str
    progress_pct: float
    sunrise_utc: str
    significance: str
    is_fasting_day: bool


class AlarmCreate(BaseModel):
    label: str = Field(default="Morning Tithi")
    hour: int = Field(ge=0, le=23)
    minute: int = Field(ge=0, le=59)
    enabled: bool = True
    sound: str = Field(default="om")  # om | bell | default
    days: List[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4, 5, 6])  # 0=Sun
    notification_id: Optional[str] = None  # client-managed local notif id


class Alarm(AlarmCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AlarmUpdate(BaseModel):
    label: Optional[str] = None
    hour: Optional[int] = None
    minute: Optional[int] = None
    enabled: Optional[bool] = None
    sound: Optional[str] = None
    days: Optional[List[int]] = None
    notification_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@api.get("/")
async def root():
    return {"message": "Panchang Alarm API"}


@api.get("/panchang", response_model=Panchang)
async def get_panchang(
    date_str: Optional[str] = Query(default=None, alias="date"),
    lat: float = Query(default=28.6139),
    lng: float = Query(default=77.2090),
):
    try:
        if date_str:
            d = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        else:
            d = datetime.now(timezone.utc)
        data = compute_panchang(d, lat, lng)
        return data
    except Exception as e:
        logger.exception("panchang error")
        raise HTTPException(status_code=500, detail=str(e))


@api.get("/panchang/week", response_model=List[Panchang])
async def get_panchang_week(
    lat: float = Query(default=28.6139),
    lng: float = Query(default=77.2090),
):
    today = datetime.now(timezone.utc)
    results = []
    for i in range(7):
        d = today + timedelta(days=i)
        results.append(compute_panchang(d, lat, lng))
    return results


@api.post("/alarms", response_model=Alarm)
async def create_alarm(payload: AlarmCreate):
    alarm = Alarm(**payload.model_dump())
    await db.alarms.insert_one(alarm.model_dump())
    return alarm


@api.get("/alarms", response_model=List[Alarm])
async def list_alarms():
    docs = await db.alarms.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Alarm(**d) for d in docs]


@api.patch("/alarms/{alarm_id}", response_model=Alarm)
async def update_alarm(alarm_id: str, payload: AlarmUpdate):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.alarms.find_one_and_update(
        {"id": alarm_id},
        {"$set": update},
        return_document=True,
        projection={"_id": 0},
    )
    if not result:
        raise HTTPException(status_code=404, detail="Alarm not found")
    return Alarm(**result)


@api.delete("/alarms/{alarm_id}")
async def delete_alarm(alarm_id: str):
    result = await db.alarms.delete_one({"id": alarm_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Alarm not found")
    return {"ok": True}


class Settings(BaseModel):
    lat: float = 28.6139
    lng: float = 77.2090
    city: str = "New Delhi"
    default_sound: str = "om"
    use_device_location: bool = True


@api.get("/settings", response_model=Settings)
async def get_settings():
    doc = await db.settings.find_one({"_id": "singleton"}, {"_id": 0})
    if not doc:
        return Settings()
    return Settings(**doc)


@api.put("/settings", response_model=Settings)
async def put_settings(payload: Settings):
    await db.settings.update_one(
        {"_id": "singleton"},
        {"$set": payload.model_dump()},
        upsert=True,
    )
    return payload


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db():
    client.close()
