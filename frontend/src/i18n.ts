// English / Hindi strings and Panchang localisation helpers.
import type { Panchang } from "@/src/api";

export type Lang = "en" | "hi";

const en = {
  namaste: "Namaste 🙏",
  today: "Today",
  paksha: "Paksha",
  throughTithi: "{pct}% through this Tithi",
  nakshatra: "Nakshatra",
  sunrise: "Sunrise",
  yoga: "Yoga",
  rahuKaal: "Rahu Kaal",
  peaceful: "A peaceful day for prayer and reflection.",
  fastingDay: "Fasting Day (व्रत)",
  upcomingTithis: "Upcoming Tithis",
  dailyReminders: "Daily Reminders",
  noAlarms: "No alarms yet",
  noAlarmsSub: "Set a sacred morning reminder for today’s Tithi.",
  addAlarm: "Add Alarm",
  attributionOnline: "Panchang data: Nitya Panchangam (CC-BY 4.0) · Lahiri ayanamsa",
  attributionCalc: "Panchang calculated on-device from sun & moon positions (offline)",
  eveningCardTitle: "Evening-before reminder",
  eveningCardSub: "{time} · Festivals, Ekadashi, Purnima, Amavasya",
  on: "On",
  off: "Off",
  newAlarm: "New Alarm",
  editAlarm: "Edit Alarm",
  alarmTime: "Alarm Time",
  repeat: "Repeat",
  label: "Label",
  labelPlaceholder: "e.g. Morning Tithi",
  defaultLabel: "Morning Tithi",
  alarmSound: "Alarm Sound",
  soundOm: "Om Chant",
  soundBell: "Temple Bell",
  soundDefault: "System Default",
  preview: "Preview",
  alarmNote:
    "Each morning’s reminder names that day’s Tithi and festival. Om Chant and Temple Bell ring in the installed app; Expo Go plays the phone’s default sound instead.",
  saveAlarm: "Save Alarm",
  updateAlarm: "Update Alarm",
  settings: "Settings",
  language: "Language",
  location: "Location",
  currentCity: "Current City",
  useDeviceLocation: "Use device location",
  detectNow: "Detect Now",
  delhi: "Delhi (IST)",
  latitude: "Latitude",
  longitude: "Longitude",
  defaultSound: "Default Sound",
  eveningReminder: "Evening-before Reminder",
  eveningToggle: "Remind me the evening before",
  eveningHelp: "Major festivals, Ekadashi, Purnima and Amavasya",
  reminderTime: "Reminder time",
  custom: "Custom",
  dangerZone: "Danger Zone",
  cancelAll: "Cancel All Scheduled Alarms",
  cancelAllSub: "Clears pending notifications on this device until you next open the app.",
  cancelledAll: "Scheduled reminders cleared.",
  festivalCalendar: "Festival Calendar",
  readingPanchang: "Reading the Panchang…",
  loadFailed: "Could not load this month. Tap to retry.",
  ekadashi: "Ekadashi",
  purnima: "Purnima",
  amavasya: "Amavasya",
  festival: "Festival",
  thisMonth: "This Month",
  vrat: "Vrat",
  calendarFootnote:
    "Festivals use the Amanta (North-Indian festival dates) month system and the traditional time of day for each festival. Regional observance may differ by a day.",
  shareTitle: "Share Today’s Tithi",
  shareKicker: "आज की तिथि · Today’s Tithi",
  shareCard: "Share Card (WhatsApp, etc.)",
  shareAsText: "Share as Text",
  shareFailed: "Couldn't share the image. Try sharing as text instead.",
  shareCancelled: "Sharing was cancelled.",
  shareDialog: "Share today's Tithi",
  sentWith: "Sent with Tithi Alarm 🔔",
  appName: "Tithi Alarm 🔔",
  tomorrow: "Tomorrow",
  prepare: "Prepare tonight.",
  readKatha: "Read Vrat Katha",
  vratKatha: "Vrat Katha",
  howToObserve: "How to observe",
  katha: "Katha",
  allKathas: "All Vrat Kathas",
  catEkadashi: "Ekadashi",
  catFestival: "Festivals",
  catMonthly: "Monthly Vratas",
  textSize: "Text size",
  kathaNotFound: "This katha could not be loaded. Tap to retry.",
  kathaInApp: "Read the Vrat Katha in the app.",
  credits: "Credits",
  omCredit: "Om chant: “Om pro.ogg” by Tito Dutta, Wikimedia Commons, CC BY-SA 3.0. Changes: slowed down, repeated and layered with a drone, bell and reverb. This adapted Om sound is shared under CC BY-SA 3.0.",
  bellCredit: "Temple bell and drone: original sounds made for this app.",
  panchangCredit: "Panchang data: Nitya Panchangam, CC BY 4.0.",
  kathaCredit: "Vrat kathas: brief retellings of traditional stories from the Puranas and folk tradition.",
  viewSource: "Source",
  viewLicense: "Licence",
};

const hi: typeof en = {
  namaste: "नमस्ते 🙏",
  today: "आज",
  paksha: "पक्ष",
  throughTithi: "इस तिथि का {pct}% बीत चुका",
  nakshatra: "नक्षत्र",
  sunrise: "सूर्योदय",
  yoga: "योग",
  rahuKaal: "राहु काल",
  peaceful: "प्रार्थना और चिंतन के लिए शांत दिन।",
  fastingDay: "व्रत का दिन",
  upcomingTithis: "आगामी तिथियाँ",
  dailyReminders: "दैनिक अलार्म",
  noAlarms: "अभी कोई अलार्म नहीं",
  noAlarmsSub: "आज की तिथि के लिए सुबह का पावन अलार्म लगाएँ।",
  addAlarm: "अलार्म जोड़ें",
  attributionOnline: "पंचांग स्रोत: नित्य पंचांगम (CC-BY 4.0) · लाहिरी अयनांश",
  attributionCalc: "पंचांग फ़ोन पर सूर्य-चंद्र की स्थिति से गणना किया गया (ऑफ़लाइन)",
  eveningCardTitle: "एक शाम पहले अनुस्मारक",
  eveningCardSub: "{time} · त्योहार, एकादशी, पूर्णिमा, अमावस्या",
  on: "चालू",
  off: "बंद",
  newAlarm: "नया अलार्म",
  editAlarm: "अलार्म बदलें",
  alarmTime: "अलार्म का समय",
  repeat: "दोहराएँ",
  label: "नाम",
  labelPlaceholder: "जैसे: सुबह की तिथि",
  defaultLabel: "सुबह की तिथि",
  alarmSound: "अलार्म ध्वनि",
  soundOm: "ॐ जाप",
  soundBell: "मंदिर की घंटी",
  soundDefault: "फ़ोन की सामान्य ध्वनि",
  preview: "सुनें",
  alarmNote:
    "हर सुबह का अलार्म उस दिन की तिथि और त्योहार बताएगा। ॐ जाप और मंदिर की घंटी इंस्टॉल किए गए ऐप में बजेंगे; Expo Go में फ़ोन की सामान्य ध्वनि बजेगी।",
  saveAlarm: "अलार्म सहेजें",
  updateAlarm: "अलार्म अपडेट करें",
  settings: "सेटिंग्स",
  language: "भाषा",
  location: "स्थान",
  currentCity: "वर्तमान शहर",
  useDeviceLocation: "फ़ोन का स्थान उपयोग करें",
  detectNow: "अभी पता करें",
  delhi: "दिल्ली (IST)",
  latitude: "अक्षांश",
  longitude: "देशांतर",
  defaultSound: "डिफ़ॉल्ट ध्वनि",
  eveningReminder: "पूर्व संध्या अनुस्मारक",
  eveningToggle: "एक शाम पहले याद दिलाएँ",
  eveningHelp: "प्रमुख त्योहार, एकादशी, पूर्णिमा और अमावस्या",
  reminderTime: "अनुस्मारक का समय",
  custom: "अपना समय",
  dangerZone: "सावधान",
  cancelAll: "सभी निर्धारित अलार्म रद्द करें",
  cancelAllSub: "अगली बार ऐप खोलने तक इस फ़ोन की सभी सूचनाएँ हटा देता है।",
  cancelledAll: "निर्धारित अनुस्मारक हटा दिए गए।",
  festivalCalendar: "त्योहार कैलेंडर",
  readingPanchang: "पंचांग पढ़ा जा रहा है…",
  loadFailed: "यह माह लोड नहीं हो सका। फिर से कोशिश करने के लिए छुएँ।",
  ekadashi: "एकादशी",
  purnima: "पूर्णिमा",
  amavasya: "अमावस्या",
  festival: "त्योहार",
  thisMonth: "इस माह",
  vrat: "व्रत",
  calendarFootnote:
    "त्योहार अमांत मास पद्धति और हर त्योहार के पारंपरिक समय के अनुसार दिखाए गए हैं। क्षेत्र के अनुसार एक दिन का अंतर हो सकता है।",
  shareTitle: "आज की तिथि साझा करें",
  shareKicker: "आज की तिथि",
  shareCard: "कार्ड साझा करें (WhatsApp आदि)",
  shareAsText: "टेक्स्ट के रूप में साझा करें",
  shareFailed: "चित्र साझा नहीं हो सका। टेक्स्ट के रूप में साझा करें।",
  shareCancelled: "साझा करना रद्द हुआ।",
  shareDialog: "आज की तिथि साझा करें",
  sentWith: "तिथि अलार्म से भेजा गया 🔔",
  appName: "तिथि अलार्म 🔔",
  tomorrow: "कल",
  prepare: "आज शाम से तैयारी करें।",
  readKatha: "व्रत कथा पढ़ें",
  vratKatha: "व्रत कथा",
  howToObserve: "व्रत विधि",
  katha: "कथा",
  allKathas: "सभी व्रत कथाएँ",
  catEkadashi: "एकादशी",
  catFestival: "त्योहार",
  catMonthly: "मासिक व्रत",
  textSize: "अक्षर आकार",
  kathaNotFound: "यह कथा लोड नहीं हो सकी। फिर से कोशिश करने के लिए छुएँ।",
  kathaInApp: "ऐप में व्रत कथा पढ़ें।",
  credits: "श्रेय",
  omCredit: "ॐ जाप: “Om pro.ogg”, रचनाकार टीटो दत्ता (Tito Dutta), विकिमीडिया कॉमन्स, CC BY-SA 3.0। बदलाव: धीमा किया, दोहराया और ड्रोन, घंटी व गूँज के साथ मिलाया गया। यह बदली हुई ॐ ध्वनि CC BY-SA 3.0 के अंतर्गत साझा है।",
  bellCredit: "मंदिर की घंटी और ड्रोन: इस ऐप के लिए बनाई गई मूल ध्वनियाँ।",
  panchangCredit: "पंचांग स्रोत: नित्य पंचांगम, CC BY 4.0।",
  kathaCredit: "व्रत कथाएँ: पुराणों और लोक परंपरा की पारंपरिक कथाओं का संक्षिप्त पुनर्कथन।",
  viewSource: "स्रोत",
  viewLicense: "लाइसेंस",
};

export type StringKey = keyof typeof en;

export function translate(lang: Lang, key: StringKey, vars?: Record<string, string | number>) {
  let s = (lang === "hi" ? hi : en)[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

export const localeOf = (lang: Lang) => (lang === "hi" ? "hi-IN" : "en-IN");

export const WEEK_LETTERS: Record<Lang, string[]> = {
  en: ["S", "M", "T", "W", "T", "F", "S"],
  hi: ["र", "सो", "मं", "बु", "गु", "शु", "श"],
};
export const WEEK_SHORT: Record<Lang, string[]> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  hi: ["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"],
};

export function formatTime(hour: number, minute: number, lang: Lang) {
  const h12 = ((hour + 11) % 12) + 1;
  const mm = `${minute}`.padStart(2, "0");
  if (lang === "en") return `${h12}:${mm} ${hour < 12 ? "AM" : "PM"}`;
  const period = hour >= 4 && hour < 12 ? "सुबह" : hour < 16 && hour >= 12 ? "दोपहर" : hour >= 16 && hour < 20 ? "शाम" : "रात";
  return `${period} ${h12}:${mm}`;
}

/** Converts "6:25 AM" style times inside a string into the chosen language. */
export function localizeTimes(s: string | null | undefined, lang: Lang) {
  if (!s || lang === "en") return s ?? "";
  return s.replace(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi, (_, h, m, ap) => {
    const hour = (Number(h) % 12) + (ap.toUpperCase() === "PM" ? 12 : 0);
    return formatTime(hour, Number(m), lang);
  });
}

/** Panchang fields in the chosen language. */
export function lp(p: Panchang, lang: Lang) {
  const hiMode = lang === "hi";
  return {
    tithi: hiMode ? p.tithi_hindi : p.tithi,
    tithiFull: hiMode ? `${p.paksha === "Shukla" ? "शुक्ल" : "कृष्ण"} ${p.tithi_hindi}` : `${p.paksha} ${p.tithi}`,
    paksha: hiMode ? p.paksha_hindi : `${p.paksha} Paksha`,
    pakshaShort: hiMode ? (p.paksha === "Shukla" ? "शुक्ल" : "कृष्ण") : p.paksha,
    masa: hiMode ? `${p.masa_hindi} मास` : p.masa,
    nakshatra: hiMode ? p.nakshatra_hindi : p.nakshatra,
    yoga: hiMode ? p.yoga_hindi ?? p.yoga : p.yoga,
    festivals: hiMode ? p.festivals_hindi : p.festivals,
    observances: hiMode ? p.observances_hindi : p.observances,
    significance: hiMode ? p.significance_hindi : p.significance,
  };
}
