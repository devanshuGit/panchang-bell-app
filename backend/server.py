"""Hindu Panchang Alarm backend.

Exposes endpoints for computing today's/any day's Tithi + Panchang info and
storing user alarms. Tithi is computed astronomically using simplified
Meeus formulas; location-aware sunrise is approximated. Also attempts a
best-effort fetch from a free Hindu Panchang API as a secondary source.
"""

from __future__ import annotations

import asyncio
import logging
import math
import os
import uuid
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

from kathas_ekadashi import EKADASHI_BY_AMANTA, EKADASHI_KATHAS, EKADASHI_VIDHI, EKADASHI_VIDHI_HI
from kathas_festivals import FESTIVAL_KATHAS, FESTIVAL_TO_KATHA, MONTHLY_KATHAS

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


MASAS = [
    "Chaitra", "Vaishakha", "Jyeshtha", "Ashadha", "Shravana", "Bhadrapada",
    "Ashwin", "Kartika", "Margashirsha", "Pausha", "Magha", "Phalguna",
]
MASAS_HINDI = [
    "चैत्र", "वैशाख", "ज्येष्ठ", "आषाढ़", "श्रावण", "भाद्रपद",
    "आश्विन", "कार्तिक", "मार्गशीर्ष", "पौष", "माघ", "फाल्गुन",
]

# Major festivals keyed by (amanta masa, tithi number 1..30 where 16..30 = Krishna).
FESTIVALS = {
    ("Chaitra", 1): "Ugadi / Gudi Padwa · Chaitra Navratri begins",
    ("Chaitra", 9): "Ram Navami",
    ("Chaitra", 15): "Hanuman Jayanti",
    ("Vaishakha", 3): "Akshaya Tritiya",
    ("Vaishakha", 15): "Buddha Purnima",
    ("Jyeshtha", 11): "Nirjala Ekadashi",
    ("Jyeshtha", 15): "Vat Purnima",
    ("Ashadha", 2): "Jagannath Rath Yatra",
    ("Ashadha", 11): "Devshayani Ekadashi",
    ("Ashadha", 15): "Guru Purnima",
    ("Shravana", 5): "Nag Panchami",
    ("Shravana", 15): "Raksha Bandhan",
    ("Shravana", 23): "Krishna Janmashtami",
    ("Bhadrapada", 3): "Hartalika Teej",
    ("Bhadrapada", 4): "Ganesh Chaturthi",
    ("Bhadrapada", 14): "Anant Chaturdashi",
    ("Bhadrapada", 30): "Mahalaya Amavasya",
    ("Ashwin", 1): "Sharad Navratri begins",
    ("Ashwin", 8): "Durga Ashtami",
    ("Ashwin", 10): "Dussehra (Vijayadashami)",
    ("Ashwin", 15): "Sharad Purnima",
    ("Ashwin", 19): "Karwa Chauth",
    ("Ashwin", 28): "Dhanteras",
    ("Ashwin", 29): "Narak Chaturdashi",
    ("Ashwin", 30): "Diwali · Lakshmi Puja",
    ("Kartika", 1): "Govardhan Puja",
    ("Kartika", 2): "Bhai Dooj",
    ("Kartika", 6): "Chhath Puja",
    ("Kartika", 11): "Dev Uthani Ekadashi",
    ("Kartika", 15): "Kartik Purnima · Dev Deepawali",
    ("Margashirsha", 11): "Gita Jayanti · Mokshada Ekadashi",
    ("Magha", 5): "Vasant Panchami",
    ("Magha", 29): "Maha Shivaratri",
    ("Phalguna", 15): "Holika Dahan",
    ("Phalguna", 16): "Holi",
}

SANKRANTI = {270: "Makar Sankranti", 0: "Mesha Sankranti · Baisakhi"}

# Festivals observed at a time of day other than sunrise (fraction of a day after sunrise).
KALA_OFFSET = {"sunrise": 0.0, "madhyahna": 0.25, "aparahna": 0.33, "pradosh": 0.5, "nishita": 0.75}
FESTIVAL_KALA = {
    "Ram Navami": "madhyahna", "Ganesh Chaturthi": "madhyahna",
    "Dussehra (Vijayadashami)": "aparahna",
    "Dhanteras": "pradosh", "Diwali · Lakshmi Puja": "pradosh", "Holika Dahan": "pradosh",
    "Karwa Chauth": "pradosh",
    "Maha Shivaratri": "nishita", "Krishna Janmashtami": "nishita",
}


def _tithi_at(jd: float) -> int:
    return int(_norm(_moon_longitude(jd) - _sun_longitude(jd)) // 12) + 1


def skipped_tithi(sunrise_jd: float, sunrise_tithi: int) -> Optional[int]:
    """Kshaya tithi: begins after today's sunrise and ends before tomorrow's, so it is observed today."""
    nxt = _tithi_at(sunrise_jd + 1.0)
    return sunrise_tithi % 30 + 1 if (nxt - sunrise_tithi) % 30 == 2 else None


def festivals_for(sunrise_jd: float, sunrise_tithi: Optional[int] = None) -> List[str]:
    """Major festivals on the civil day starting at sunrise_jd.

    A festival falls on the first day whose tithi at the festival's kala
    (sunrise / midday / afternoon / evening / midnight) matches.
    """
    out = []
    cache: dict = {}
    skip = skipped_tithi(sunrise_jd, sunrise_tithi or _tithi_at(sunrise_jd))

    def state(kala: str, day_shift: int):
        k = (kala, day_shift)
        if k not in cache:
            j = sunrise_jd + KALA_OFFSET[kala] + day_shift
            t = sunrise_tithi if (kala == "sunrise" and day_shift == 0 and sunrise_tithi) else _tithi_at(j)
            m = compute_masa(j)
            cache[k] = (t, None if m["adhika"] else m["masa"])
        return cache[k]

    for (masa, num), fname in FESTIVALS.items():
        kala = next((v for k, v in FESTIVAL_KALA.items() if fname.startswith(k)), "sunrise")
        t_now, m_now = state(kala, 0)
        if kala == "sunrise" and m_now == masa and num in (t_now, skip):
            out.append(fname)
        elif kala != "sunrise" and (t_now, m_now) == (num, masa) and state(kala, -1) != (num, masa):
            out.append(fname)
    ayan = _ayanamsa(sunrise_jd)
    s_now = _norm(_sun_longitude(sunrise_jd) - ayan)
    s_next = _norm(_sun_longitude(sunrise_jd + 1) - ayan)
    for deg, fname in SANKRANTI.items():
        if (s_now < deg <= s_next) or (deg == 0 and s_now > s_next):
            out.append(fname)
    return out


def observances_for(tithi_number: int) -> List[str]:
    """Recurring monthly vratas for a tithi number (1..30)."""
    return {
        11: ["Ekadashi Vrat"], 26: ["Ekadashi Vrat"],
        13: ["Pradosh Vrat"], 28: ["Pradosh Vrat"],
        19: ["Sankashti Chaturthi"], 4: ["Vinayaka Chaturthi"],
        29: ["Masik Shivaratri"], 15: ["Purnima Vrat"], 30: ["Amavasya"],
    }.get(tithi_number, [])


NAKSHATRA_HI = dict(zip(NAKSHATRAS, [
    "अश्विनी", "भरणी", "कृत्तिका", "रोहिणी", "मृगशिरा", "आर्द्रा", "पुनर्वसु", "पुष्य", "आश्लेषा",
    "मघा", "पूर्वा फाल्गुनी", "उत्तरा फाल्गुनी", "हस्त", "चित्रा", "स्वाति", "विशाखा", "अनुराधा",
    "ज्येष्ठा", "मूल", "पूर्वाषाढ़ा", "उत्तराषाढ़ा", "श्रवण", "धनिष्ठा", "शतभिषा", "पूर्वा भाद्रपद",
    "उत्तरा भाद्रपद", "रेवती",
]))

YOGA_HI = {
    "Vishkambha": "विष्कुम्भ", "Priti": "प्रीति", "Ayushman": "आयुष्मान", "Saubhagya": "सौभाग्य",
    "Shobhana": "शोभन", "Atiganda": "अतिगण्ड", "Sukarma": "सुकर्मा", "Dhriti": "धृति",
    "Shoola": "शूल", "Shula": "शूल", "Ganda": "गण्ड", "Vriddhi": "वृद्धि", "Dhruva": "ध्रुव",
    "Vyaghata": "व्याघात", "Harshana": "हर्षण", "Vajra": "वज्र", "Siddhi": "सिद्धि",
    "Vyatipata": "व्यतीपात", "Variyana": "वरीयान", "Variyan": "वरीयान", "Parigha": "परिघ",
    "Shiva": "शिव", "Siddha": "सिद्ध", "Sadhya": "साध्य", "Shubha": "शुभ", "Shukla": "शुक्ल",
    "Brahma": "ब्रह्म", "Indra": "इन्द्र", "Vaidhriti": "वैधृति",
}

FESTIVAL_HI = {
    "Ugadi / Gudi Padwa · Chaitra Navratri begins": "उगादि / गुड़ी पड़वा · चैत्र नवरात्रि आरंभ",
    "Ram Navami": "राम नवमी", "Hanuman Jayanti": "हनुमान जयंती",
    "Akshaya Tritiya": "अक्षय तृतीया", "Buddha Purnima": "बुद्ध पूर्णिमा",
    "Nirjala Ekadashi": "निर्जला एकादशी", "Vat Purnima": "वट पूर्णिमा",
    "Jagannath Rath Yatra": "जगन्नाथ रथ यात्रा", "Devshayani Ekadashi": "देवशयनी एकादशी",
    "Guru Purnima": "गुरु पूर्णिमा", "Nag Panchami": "नाग पंचमी", "Raksha Bandhan": "रक्षा बंधन",
    "Krishna Janmashtami": "कृष्ण जन्माष्टमी", "Hartalika Teej": "हरतालिका तीज",
    "Ganesh Chaturthi": "गणेश चतुर्थी", "Anant Chaturdashi": "अनंत चतुर्दशी",
    "Mahalaya Amavasya": "महालया अमावस्या", "Sharad Navratri begins": "शारदीय नवरात्रि आरंभ",
    "Durga Ashtami": "दुर्गा अष्टमी", "Dussehra (Vijayadashami)": "दशहरा (विजयादशमी)",
    "Sharad Purnima": "शरद पूर्णिमा", "Karwa Chauth": "करवा चौथ", "Dhanteras": "धनतेरस",
    "Narak Chaturdashi": "नरक चतुर्दशी", "Diwali · Lakshmi Puja": "दीपावली · लक्ष्मी पूजा",
    "Govardhan Puja": "गोवर्धन पूजा", "Bhai Dooj": "भाई दूज", "Chhath Puja": "छठ पूजा",
    "Dev Uthani Ekadashi": "देवउठनी एकादशी",
    "Kartik Purnima · Dev Deepawali": "कार्तिक पूर्णिमा · देव दीपावली",
    "Gita Jayanti · Mokshada Ekadashi": "गीता जयंती · मोक्षदा एकादशी",
    "Vasant Panchami": "वसंत पंचमी", "Maha Shivaratri": "महाशिवरात्रि",
    "Holika Dahan": "होलिका दहन", "Holi": "होली", "Makar Sankranti": "मकर संक्रांति",
    "Mesha Sankranti · Baisakhi": "मेष संक्रांति · बैसाखी",
}

OBSERVANCE_HI = {
    "Ekadashi Vrat": "एकादशी व्रत", "Pradosh Vrat": "प्रदोष व्रत",
    "Sankashti Chaturthi": "संकष्टी चतुर्थी", "Vinayaka Chaturthi": "विनायक चतुर्थी",
    "Masik Shivaratri": "मासिक शिवरात्रि", "Purnima Vrat": "पूर्णिमा व्रत", "Amavasya": "अमावस्या",
}

SIGNIFICANCE_HI = {
    "Pratipada": "पक्ष का आरंभ; नए कार्यों के लिए शुभ।",
    "Dwitiya": "यात्रा और गृह-निर्माण की नींव के लिए अनुकूल।",
    "Tritiya": "देवी उपासना का दिन; सुहागिनें हरतालिका तीज मनाती हैं।",
    "Chaturthi": "संकष्टी चतुर्थी — भगवान गणेश को समर्पित; चंद्रोदय तक व्रत।",
    "Panchami": "नाग पंचमी; नाग देवता और विद्या की उपासना।",
    "Shashthi": "स्कंद षष्ठी — भगवान कार्तिकेय को समर्पित।",
    "Saptami": "सूर्य देव को समर्पित; सूर्योदय पर गायत्री मंत्र जपें।",
    "Ashtami": "दुर्गा अष्टमी / कृष्ण अष्टमी — व्रत और भजन।",
    "Navami": "शुक्ल पक्ष में राम नवमी; शारदीय नवरात्रि में महानवमी।",
    "Dashami": "आश्विन में विजयादशमी; बुराई पर अच्छाई की विजय का दिन।",
    "Ekadashi": "व्रत का दिन — अन्न का त्याग, भगवान विष्णु को समर्पित।",
    "Dwadashi": "एकादशी व्रत का पारण; दान और ब्राह्मण भोजन।",
    "Trayodashi": "प्रदोष व्रत — संध्या में भगवान शिव की पूजा।",
    "Chaturdashi": "कृष्ण पक्ष में मासिक शिवरात्रि; दीपावली से पहले नरक चतुर्दशी।",
    "Purnima": "पूर्णिमा व्रत; सत्यनारायण कथा, सभी व्रतों के लिए शुभ।",
    "Amavasya": "अमावस्या; पितृ तर्पण, पिंडदान और पूर्वजों का स्मरण।",
}


ALL_KATHAS = {
    **{k: {**v, "category": "ekadashi"} for k, v in EKADASHI_KATHAS.items()},
    **{k: {**v, "category": "festival"} for k, v in FESTIVAL_KATHAS.items()},
    **{k: {**v, "category": "monthly"} for k, v in MONTHLY_KATHAS.items()},
}


def kathas_for(masa: str, tithis: List[int], festivals: List[str]) -> List[dict]:
    """Vrat kathas to read on a day: festivals first, then the named Ekadashi, then monthly vratas."""
    ids: List[str] = []
    for f in festivals:
        kid = FESTIVAL_TO_KATHA.get(f)
        if kid and kid not in ids:
            ids.append(kid)
    month = "Adhika" if masa.startswith("Adhika") else masa
    for tn in tithis:
        if tn in (11, 26):
            kid = EKADASHI_BY_AMANTA.get((month, "S" if tn == 11 else "K"))
            if kid and kid not in ids:
                ids.append(kid)
    for tn in tithis:
        monthly = {15: "satyanarayan", 13: "pradosh", 28: "pradosh", 19: "sankashti"}.get(tn)
        if monthly and monthly not in ids:
            ids.append(monthly)
    return [{"id": k, "title": ALL_KATHAS[k]["title"], "title_hindi": ALL_KATHAS[k]["title_hi"]} for k in ids]


FASTING_TITHIS = {"Ekadashi", "Chaturdashi", "Purnima", "Amavasya"}


def add_hindi(p: dict) -> dict:
    """Attach Hindi names, kathas, and any kshaya (skipped) tithi observed on this day."""
    jd = _julian_day(datetime.fromisoformat(p["sunrise_utc"]))
    skip = skipped_tithi(jd, p["tithi_number"])
    p["kshaya_tithi"] = _tithi_names(skip)[0] if skip else None
    p["kshaya_tithi_hindi"] = _tithi_names(skip)[1] if skip else None
    if skip:
        p["observances"] = p["observances"] + [o for o in observances_for(skip) if o not in p["observances"]]
        p["is_fasting_day"] = p["is_fasting_day"] or p["kshaya_tithi"] in FASTING_TITHIS
    p["kathas"] = kathas_for(p["masa"], [p["tithi_number"]] + ([skip] if skip else []), p["festivals"])
    p["nakshatra_hindi"] = NAKSHATRA_HI.get(p["nakshatra"], p["nakshatra"])
    p["yoga_hindi"] = YOGA_HI.get(p.get("yoga") or "", p.get("yoga"))
    p["festivals_hindi"] = [FESTIVAL_HI.get(f, f) for f in p["festivals"]]
    p["observances_hindi"] = [OBSERVANCE_HI.get(o, o) for o in p["observances"]]
    p["significance_hindi"] = SIGNIFICANCE_HI.get(p["tithi"], p["significance"])
    return p


def _elongation_signed(jd: float) -> float:
    d = _norm(_moon_longitude(jd) - _sun_longitude(jd))
    return d - 360 if d > 180 else d


def _new_moon_near(jd_guess: float) -> float:
    j = jd_guess
    for _ in range(6):
        j -= _elongation_signed(j) / 12.1907
    return j


def _sidereal_sun_rashi(jd: float) -> int:
    return int(_norm(_sun_longitude(jd) - _ayanamsa(jd)) // 30)


def compute_masa(jd: float) -> dict:
    """Amanta lunar month: named from the sun's sidereal sign at the new moon starting it."""
    elong = _norm(_moon_longitude(jd) - _sun_longitude(jd))
    prev_nm = _new_moon_near(jd - elong / 12.1907)
    if prev_nm > jd:
        prev_nm = _new_moon_near(prev_nm - 29.53)
    next_nm = _new_moon_near(prev_nm + 29.53)
    r1, r2 = _sidereal_sun_rashi(prev_nm), _sidereal_sun_rashi(next_nm)
    idx = (r1 + 1) % 12
    return {"masa": MASAS[idx], "masa_hindi": MASAS_HINDI[idx], "adhika": r1 == r2}


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

    masa = compute_masa(jd)
    festivals = festivals_for(jd)

    return {
        "masa": ("Adhika " if masa["adhika"] else "") + masa["masa"],
        "masa_hindi": ("अधिक " if masa["adhika"] else "") + masa["masa_hindi"],
        "festivals": festivals,
        "observances": observances_for(tithi_index + 1),
        "source": "calculated",
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


class KathaRef(BaseModel):
    id: str
    title: str
    title_hindi: str


class Katha(KathaRef):
    category: str  # ekadashi | festival | monthly
    vidhi: str
    vidhi_hindi: str
    story: str
    story_hindi: str


def _katha_out(kid: str) -> Katha:
    k = ALL_KATHAS[kid]
    is_ek = k["category"] == "ekadashi"
    return Katha(
        id=kid, title=k["title"], title_hindi=k["title_hi"], category=k["category"],
        vidhi=k.get("vidhi") or (EKADASHI_VIDHI if is_ek else ""),
        vidhi_hindi=k.get("vidhi_hi") or (EKADASHI_VIDHI_HI if is_ek else ""),
        story=k["story"], story_hindi=k["story_hi"],
    )


@api.get("/kathas", response_model=List[KathaRef])
async def list_kathas(category: Optional[str] = Query(default=None, pattern="^(ekadashi|festival|monthly)$")):
    return [
        KathaRef(id=k, title=v["title"], title_hindi=v["title_hi"])
        for k, v in ALL_KATHAS.items()
        if category is None or v["category"] == category
    ]


@api.get("/kathas/{katha_id}", response_model=Katha)
async def get_katha(katha_id: str):
    if katha_id not in ALL_KATHAS:
        raise HTTPException(status_code=404, detail="Katha not found")
    return _katha_out(katha_id)


class Panchang(BaseModel):
    kathas: List[KathaRef]
    kshaya_tithi: Optional[str] = None  # tithi that starts and ends between two sunrises (observed today)
    kshaya_tithi_hindi: Optional[str] = None
    nakshatra_hindi: str
    yoga_hindi: Optional[str] = None
    festivals_hindi: List[str]
    observances_hindi: List[str]
    significance_hindi: str
    masa: str
    masa_hindi: str
    festivals: List[str]
    observances: List[str]
    source: str  # online | calculated
    sunrise: Optional[str] = None  # local display string from online source
    sunset: Optional[str] = None
    yoga: Optional[str] = None
    karana: Optional[str] = None
    rahu_kalam: Optional[str] = None
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


PANCHANG_API_URL = os.environ["PANCHANG_API_URL"]
_online_sem = asyncio.Semaphore(6)


async def fetch_online(d: date, lat: float, lng: float) -> Optional[dict]:
    """Fetch from Nitya Panchangam (CC-BY), cached in Mongo per date+location."""
    key = f"{d.isoformat()}|{lat:.2f}|{lng:.2f}"
    cached = await db.panchang_cache.find_one({"key": key}, {"_id": 0})
    if cached:
        return cached["data"]
    try:
        async with _online_sem, httpx.AsyncClient(
            timeout=8, headers={"User-Agent": "Mozilla/5.0 (TithiAlarm/1.0)", "Accept": "application/json"}
        ) as hc:
            r = await hc.get(PANCHANG_API_URL, params={"date": d.isoformat(), "lat": f"{lat:.4f}", "lng": f"{lng:.4f}"})
        r.raise_for_status()
        raw = r.json()
        num = int(raw["tithi"]["number"])
        data = {
            "tithi_number": num,
            "nakshatra": raw["nakshatra"]["name"],
            "yoga": raw.get("yoga", {}).get("name"),
            "karana": raw.get("karana", {}).get("name"),
            "sunrise": raw.get("sun", {}).get("sunrise"),
            "sunset": raw.get("sun", {}).get("sunset"),
            "rahu_kalam": raw.get("muhurta", {}).get("rahu_kalam"),
        }
        if not 1 <= num <= 30:
            raise ValueError(f"bad tithi number {num}")
        await db.panchang_cache.update_one({"key": key}, {"$set": {"key": key, "data": data}}, upsert=True)
        return data
    except Exception as e:
        logger.warning("online panchang failed for %s: %s", key, e)
        return None


def _tithi_names(num: int) -> tuple[str, str, str]:
    idx = num - 1
    if idx < 15:
        return TITHI_NAMES[idx], TITHI_HINDI[idx], "Shukla"
    if num == 30:
        return "Amavasya", "अमावस्या", "Krishna"
    return TITHI_NAMES[idx - 15], TITHI_HINDI[idx - 15], "Krishna"


async def build_day(d: date, lat: float, lng: float) -> dict:
    """Online Panchang when available; astronomical calculation as fallback."""
    local = compute_panchang(datetime.combine(d, time(12), tzinfo=timezone.utc), lat, lng)
    online = await fetch_online(d, lat, lng)
    if not online:
        return add_hindi(local)
    num = online["tithi_number"]
    name, hindi, paksha = _tithi_names(num)
    jd = _julian_day(datetime.fromisoformat(local["sunrise_utc"]))
    festivals = festivals_for(jd, num)
    local.update({
        "tithi": name,
        "tithi_hindi": hindi,
        "tithi_number": num,
        "paksha": paksha,
        "paksha_hindi": "शुक्ल पक्ष" if paksha == "Shukla" else "कृष्ण पक्ष",
        "nakshatra": online["nakshatra"],
        "yoga": online["yoga"],
        "karana": online["karana"],
        "sunrise": online["sunrise"],
        "sunset": online["sunset"],
        "rahu_kalam": online["rahu_kalam"],
        "significance": TITHI_SIGNIFICANCE.get(name, ""),
        "is_fasting_day": name in {"Ekadashi", "Chaturdashi", "Purnima", "Amavasya"},
        "festivals": festivals,
        "observances": observances_for(num),
        "source": "online",
    })
    return add_hindi(local)


def _parse_date(s: Optional[str]) -> date:
    if not s:
        return datetime.now(timezone.utc).date()
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")


@api.get("/panchang", response_model=Panchang)
async def get_panchang(
    date_str: Optional[str] = Query(default=None, alias="date"),
    lat: float = Query(default=28.6139, ge=-90, le=90),
    lng: float = Query(default=77.2090, ge=-180, le=180),
):
    return await build_day(_parse_date(date_str), lat, lng)


@api.get("/panchang/range", response_model=List[Panchang])
async def get_panchang_range(
    start: Optional[str] = Query(default=None),
    days: int = Query(default=7, ge=1, le=42),
    lat: float = Query(default=28.6139, ge=-90, le=90),
    lng: float = Query(default=77.2090, ge=-180, le=180),
):
    s = _parse_date(start)
    return await asyncio.gather(*(build_day(s + timedelta(days=i), lat, lng) for i in range(days)))


@api.get("/panchang/week", response_model=List[Panchang])
async def get_panchang_week(
    start: Optional[str] = Query(default=None),
    lat: float = Query(default=28.6139, ge=-90, le=90),
    lng: float = Query(default=77.2090, ge=-180, le=180),
):
    return await get_panchang_range(start=start, days=7, lat=lat, lng=lng)


@api.get("/panchang/month", response_model=List[Panchang])
async def get_panchang_month(
    year: int = Query(ge=1900, le=2100),
    month: int = Query(ge=1, le=12),
    lat: float = Query(default=28.6139, ge=-90, le=90),
    lng: float = Query(default=77.2090, ge=-180, le=180),
):
    first = date(year, month, 1)
    nxt = date(year + (month == 12), month % 12 + 1, 1)
    n = (nxt - first).days
    return await asyncio.gather(*(build_day(first + timedelta(days=i), lat, lng) for i in range(n)))


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
