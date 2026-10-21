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

## Iteration 2 (Oct 2026) — done, 25/25 backend tests + frontend flows pass
- Online Panchang: Nitya Panchangam (CC-BY, `PANCHANG_API_URL`), cached in Mongo `panchang_cache`; astronomical fallback. Adds local sunrise/sunset, yoga, karana, Rahu Kaal.
- Masa (amanta, adhika detection) + ~35 major festivals assigned by traditional kala (sunrise/midday/afternoon/pradosh/midnight) + Sankranti + monthly vratas. Endpoints `/api/panchang/range`, `/api/panchang/month`.
- Festival Calendar screen (`app/calendar.tsx`): month grid, Ekadashi/Purnima/Amavasya/festival marks, day detail, month list.
- Share screen (`app/share.tsx`): image card via react-native-view-shot + expo-sharing; text share fallback.
- Om/Bell alarm sounds bundled (`assets/sounds/om.wav`, `bell.wav`) via expo-notifications plugin; per-sound Android channels. Om = Wikimedia "Om pro.ogg" (Tito Dutta, CC BY-SA 3.0) over synthesized drone; bell synthesized.
- Reminders now dated per day (next 30 days, ≤60 pending) with that day's Tithi + festival in the notification; respects repeat days and enable toggle; rescheduled on every Home load.
- Known: custom sounds only in installed builds (Expo Go = default sound); reminders stop if app unopened 30 days; Holika Dahan 2026 shows Mar 2 (commonly Mar 3).

## Iteration 3 (Oct 2026) — done, 28/28 backend tests + frontend flows pass
- Evening-before reminders: night before major festivals, Ekadashi, Purnima, Amavasya. Toggle + time (6/7/8/9 PM chips, custom picker on phone) in Settings; default ON at 7 PM; Home shows a status card. Scheduled first within the 60-notification budget.
- Hindi mode: full UI in Hindi via `src/i18n.ts` + `SettingsProvider` (`src/settings-context.tsx`); follows phone language until user picks हिन्दी/English in Settings. Backend adds nakshatra_hindi, yoga_hindi, festivals_hindi, observances_hindi, significance_hindi. Times shown as सुबह/दोपहर/शाम/रात. Notifications and share card follow the language.
- Fixes: Hindi default alarm label; back buttons work when a screen is opened directly.

## Next ideas
- Offline-first alarms (persist in SecureStore, reschedule on boot).
- Monthly festival calendar (Diwali, Shivratri, Ekadashi vrat list).
- Audio-based alarm screen (foreground service / expo-task-manager) for true ringtone.
- Share today's Tithi card to WhatsApp (shareability for virality).
