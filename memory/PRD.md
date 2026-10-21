# Tithi Alarm — Panchang Daily Reminder

## Product
A sacred, calm mobile app that wakes the user each morning with that day's Hindu Tithi (Pratipada through Ekadashi, Dwadashi, Trayodashi, Chaturdashi, Purnima/Amavasya), along with Paksha, Nakshatra, sunrise and the day's spiritual/fasting significance.

## MVP Features
- Today's Panchang card: Tithi (Hindi + English), Paksha (Shukla/Krishna), Nakshatra, sunrise, significance, fasting-day badge, progress bar through the tithi.
- 7-day upcoming Tithi strip.
- Daily alarms: create / edit / delete, per-day repeat, label, three sound options (Om chant, Temple Bell, System default) with in-app preview, enable/disable toggle.
- Local scheduled notifications via `expo-notifications` (daily calendar trigger).
- Location-aware: device location auto-detect with reverse-geocoded city; Delhi (IST) default; manual lat/lng override.
- Ambient floating ॐ animation in the background over a starry night image (Reanimated).
- Dark luxe theme (deep indigo night + saffron/gold accents) per `design_guidelines.json`.

## Backend (FastAPI + MongoDB)
Astronomical Tithi/Nakshatra computation (simplified Meeus) — no external API key needed, works offline.
- `GET /api/panchang?lat&lng[&date]` — today or any date
- `GET /api/panchang/week?lat&lng` — next 7 days
- `GET/POST/PATCH/DELETE /api/alarms` — CRUD
- `GET/PUT /api/settings` — user preferences

## Frontend (Expo Router, React Native)
- `app/index.tsx` — home with Tithi card, week strip, alarms list, Add FAB
- `app/alarm-setup.tsx` — modal for create/edit alarm, time picker, days, sound preview
- `app/settings.tsx` — location + default sound + cancel-all-alarms

## Known limits
- Expo managed workflow: "alarm" is a scheduled local notification (loud default sound), not a system alarm clock. On Android 14+ exact alarms require the manifest permission (declared in app.json).
- Preview sounds are streamed URLs; the notification itself uses the system default sound.
- Astronomical calc is accurate within ~0.3° (tithi boundary within ~5–10 minutes).

## Next ideas
- Offline-first alarms (persist in SecureStore, reschedule on boot).
- Monthly festival calendar (Diwali, Shivratri, Ekadashi vrat list).
- Audio-based alarm screen (foreground service / expo-task-manager) for true ringtone.
- Share today's Tithi card to WhatsApp (shareability for virality).
