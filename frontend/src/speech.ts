// Read-aloud with the phone's built-in voice (free, offline). Hindi needs a Hindi voice installed.
import * as Speech from "expo-speech";

export type SpeakLang = "hi" | "en";

let hindiVoiceCache: boolean | null = null;

export async function hasVoice(lang: SpeakLang): Promise<boolean> {
  if (lang === "en") return true;
  if (hindiVoiceCache !== null) return hindiVoiceCache;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    hindiVoiceCache = voices.some((v) => v.language?.toLowerCase().startsWith("hi"));
  } catch {
    hindiVoiceCache = false;
  }
  return hindiVoiceCache;
}

export function speak(text: string, lang: SpeakLang, rate: number, onDone: () => void) {
  Speech.stop();
  Speech.speak(text, {
    language: lang === "hi" ? "hi-IN" : "en-IN",
    rate,
    pitch: 1.0,
    onDone,
    onStopped: onDone,
    onError: onDone,
  });
}

export const stopSpeaking = () => {
  Speech.stop();
};
