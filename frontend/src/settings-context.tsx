// App-wide settings (location, sound, language, evening reminder) shared via context.
import { getLocales } from "expo-localization";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { translate, type Lang, type StringKey } from "@/src/i18n";
import { defaultSettings, loadSettings, saveSettings, type UserSettings } from "@/src/settings-store";

type SettingsCtx = {
  settings: UserSettings;
  ready: boolean;
  update: (patch: Partial<UserSettings>) => void;
  lang: Lang;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
};

const Ctx = createContext<SettingsCtx | null>(null);

const deviceLang = (): Lang => (getLocales()[0]?.languageCode === "hi" ? "hi" : "en");

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setReady(true);
    });
  }, []);

  const update = useCallback((patch: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  // Follow the phone's language until the user picks one in Settings.
  const lang: Lang = settings.language ?? deviceLang();
  const t = useCallback<SettingsCtx["t"]>((key, vars) => translate(lang, key, vars), [lang]);

  const value = useMemo(() => ({ settings, ready, update, lang, t }), [settings, ready, update, lang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
