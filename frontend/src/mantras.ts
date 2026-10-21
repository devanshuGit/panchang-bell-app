// Mantra for the deity of each Tithi (Sanskrit + meaning), shown on Home each morning.
import type { Lang } from "@/src/i18n";

type Mantra = { deity: string; deity_hi: string; text: string; meaning: string; meaning_hi: string };

const MANTRAS: Record<string, Mantra> = {
  Pratipada: {
    deity: "Agni", deity_hi: "अग्नि देव",
    text: "ॐ अग्नये नमः",
    meaning: "Salutations to Agni, the sacred fire who carries our prayers to the gods.",
    meaning_hi: "अग्नि देव को नमस्कार, जो हमारी प्रार्थनाएँ देवताओं तक पहुँचाते हैं।",
  },
  Dwitiya: {
    deity: "Brahma", deity_hi: "ब्रह्मा जी",
    text: "ॐ ब्रह्मणे नमः",
    meaning: "Salutations to Brahma, the creator of the universe.",
    meaning_hi: "सृष्टि के रचयिता ब्रह्मा जी को नमस्कार।",
  },
  Tritiya: {
    deity: "Gauri", deity_hi: "माँ गौरी",
    text: "सर्वमङ्गलमाङ्गल्ये शिवे सर्वार्थसाधिके।\nशरण्ये त्र्यम्बके गौरि नारायणि नमोऽस्तु ते॥",
    meaning: "O auspicious Gauri, source of all blessings, who fulfils every aim and gives refuge — salutations to you.",
    meaning_hi: "हे मंगलमयी गौरी, सब मंगलों की मूल, सब कामनाएँ पूर्ण करने वाली और शरण देने वाली — आपको नमस्कार।",
  },
  Chaturthi: {
    deity: "Ganesha", deity_hi: "श्री गणेश",
    text: "वक्रतुण्ड महाकाय सूर्यकोटि समप्रभ।\nनिर्विघ्नं कुरु मे देव सर्वकार्येषु सर्वदा॥",
    meaning: "O Lord with the curved trunk and mighty form, radiant as a million suns, remove obstacles from all my work, always.",
    meaning_hi: "हे वक्र सूँड और विशाल शरीर वाले, करोड़ों सूर्यों के समान तेजस्वी देव, मेरे सभी कार्य सदा निर्विघ्न करें।",
  },
  Panchami: {
    deity: "Saraswati", deity_hi: "माँ सरस्वती",
    text: "ॐ ऐं सरस्वत्यै नमः",
    meaning: "Salutations to Goddess Saraswati, giver of knowledge, speech and music.",
    meaning_hi: "ज्ञान, वाणी और संगीत देने वाली माँ सरस्वती को नमस्कार।",
  },
  Shashthi: {
    deity: "Kartikeya", deity_hi: "भगवान कार्तिकेय",
    text: "ॐ शरवणभवाय नमः",
    meaning: "Salutations to Kartikeya, born in the sacred reeds, the brave protector.",
    meaning_hi: "सरकंडों के वन में जन्मे वीर रक्षक भगवान कार्तिकेय को नमस्कार।",
  },
  Saptami: {
    deity: "Surya", deity_hi: "सूर्य देव",
    text: "ॐ घृणि सूर्याय नमः",
    meaning: "Salutations to the radiant Sun, giver of light, health and energy.",
    meaning_hi: "प्रकाश, स्वास्थ्य और ऊर्जा देने वाले तेजस्वी सूर्य देव को नमस्कार।",
  },
  Ashtami: {
    deity: "Durga", deity_hi: "माँ दुर्गा",
    text: "ॐ दुं दुर्गायै नमः",
    meaning: "Salutations to Goddess Durga, who removes fear and protects her devotees.",
    meaning_hi: "भय दूर करने वाली और भक्तों की रक्षा करने वाली माँ दुर्गा को नमस्कार।",
  },
  Navami: {
    deity: "Shri Rama", deity_hi: "श्रीराम",
    text: "श्री राम जय राम जय जय राम",
    meaning: "Victory to Shri Rama — the thirteen-syllable mantra of devotion to Rama.",
    meaning_hi: "श्रीराम की जय — श्रीराम भक्ति का तेरह अक्षरों वाला मंत्र।",
  },
  Dashami: {
    deity: "Dharma", deity_hi: "धर्म",
    text: "धर्मो रक्षति रक्षितः",
    meaning: "Dharma protects those who protect dharma.",
    meaning_hi: "जो धर्म की रक्षा करता है, धर्म उसकी रक्षा करता है।",
  },
  Ekadashi: {
    deity: "Vishnu", deity_hi: "भगवान विष्णु",
    text: "ॐ नमो भगवते वासुदेवाय",
    meaning: "Salutations to Lord Vasudeva (Vishnu), who dwells in all beings.",
    meaning_hi: "सब प्राणियों में बसने वाले भगवान वासुदेव (विष्णु) को नमस्कार।",
  },
  Dwadashi: {
    deity: "Vishnu", deity_hi: "भगवान विष्णु",
    text: "शान्ताकारं भुजगशयनं पद्मनाभं सुरेशं\nविश्वाधारं गगनसदृशं मेघवर्णं शुभाङ्गम्।",
    meaning: "I bow to Vishnu — peaceful, resting on the serpent, lotus-naveled lord of gods, support of the universe, vast as the sky, dark as a rain cloud, beautiful in form.",
    meaning_hi: "शांत स्वरूप, शेषनाग पर शयन करने वाले, नाभि में कमल वाले देवेश्वर, जगत के आधार, आकाश के समान व्यापक, मेघ वर्ण और सुंदर अंगों वाले विष्णु को प्रणाम।",
  },
  Trayodashi: {
    deity: "Shiva", deity_hi: "भगवान शिव",
    text: "ॐ त्र्यम्बकं यजामहे सुगन्धिं पुष्टिवर्धनम्।\nउर्वारुकमिव बन्धनान्मृत्योर्मुक्षीय माऽमृतात्॥",
    meaning: "We worship the three-eyed Shiva, fragrant and nourishing. As a ripe cucumber is freed from its vine, may he free us from death, not from immortality.",
    meaning_hi: "हम सुगंधित और पोषण करने वाले त्रिनेत्र शिव की पूजा करते हैं। जैसे पका ककड़ी बेल से छूट जाता है, वैसे ही वे हमें मृत्यु से मुक्त करें, अमृत से नहीं।",
  },
  Chaturdashi: {
    deity: "Shiva", deity_hi: "भगवान शिव",
    text: "ॐ नमः शिवाय",
    meaning: "Salutations to Shiva, the auspicious one — the five-syllable Panchakshara mantra.",
    meaning_hi: "कल्याणकारी शिव को नमस्कार — पंचाक्षर मंत्र।",
  },
  Purnima: {
    deity: "Satyanarayan", deity_hi: "भगवान सत्यनारायण",
    text: "ॐ श्री सत्यनारायणाय नमः",
    meaning: "Salutations to Lord Satyanarayan, Vishnu as the embodiment of truth.",
    meaning_hi: "सत्य के स्वरूप भगवान सत्यनारायण (विष्णु) को नमस्कार।",
  },
  Amavasya: {
    deity: "Ancestors (Pitrs)", deity_hi: "पितृ देव",
    text: "ॐ सर्व पितृ देवताभ्यो नमः",
    meaning: "Salutations to all our ancestors; may they be at peace and bless the family.",
    meaning_hi: "सभी पितृ देवताओं को नमस्कार; वे शांत रहें और परिवार को आशीर्वाद दें।",
  },
};

export function mantraFor(tithi: string, lang: Lang) {
  const m = MANTRAS[tithi];
  if (!m) return null;
  return { text: m.text, deity: lang === "hi" ? m.deity_hi : m.deity, meaning: lang === "hi" ? m.meaning_hi : m.meaning };
}
