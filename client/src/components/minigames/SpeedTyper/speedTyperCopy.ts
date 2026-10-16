import type { Language } from "./wordBanks";

export type GameMode = "falling" | "linear" | "letter-level" | "score-level";
export type SpawnRateMultiplier = 0.25 | 0.5 | 1 | 1.25 | 1.5 | 2 | 2.5 | 3;

export const GAME_MODES: GameMode[] = ["falling", "linear", "letter-level", "score-level"];
export const SPAWN_RATES: SpawnRateMultiplier[] = [0.25, 0.5, 1, 1.25, 1.5, 2, 2.5, 3];

type Bi = { en: string; tr: string };
const pick = (b: Bi, lang: Language) => (lang === "türkçe" ? b.tr : b.en);

interface ModeMeta {
  name: Bi;
  short: Bi;
  pun: Bi;
  rules: Bi[];
  from: string;
  to: string;
}

const MODE_META: Record<GameMode, ModeMeta> = {
  falling: {
    name: { en: "Word Rain", tr: "Kelime Yağmuru" },
    short: { en: "Rain", tr: "Yağmur" },
    pun: { en: "Make it rain. Words, that is.", tr: "Gökten kelime yağıyor. Şemsiye yok." },
    rules: [
      { en: "Type a word to zap it", tr: "Yaz ve patlat" },
      { en: "Misses cost 5", tr: "Kaçan −5" },
    ],
    from: "#38bdf8",
    to: "#6366f1",
  },
  linear: {
    name: { en: "Type Train", tr: "Yazı Treni" },
    short: { en: "Train", tr: "Tren" },
    pun: { en: "All aboard. Next stop: the word you just typed.", tr: "Herkes vagona. Sıradaki durak: sıradaki kelime." },
    rules: [
      { en: "Space or Enter to submit", tr: "Boşluk veya Enter" },
      { en: "One word at a time", tr: "Tek tek, sırayla" },
    ],
    from: "#fbbf24",
    to: "#f97316",
  },
  "letter-level": {
    name: { en: "Letter Ladder", tr: "Harf Merdiveni" },
    short: { en: "Ladder", tr: "Merdiven" },
    pun: { en: "Every level adds a letter. Climb it character by character.", tr: "Her seviye bir harf daha. Harf harf tırman." },
    rules: [
      { en: "+1s right · −2s wrong", tr: "Doğru +1s · Yanlış −2s" },
      { en: "10 levels", tr: "10 seviye" },
    ],
    from: "#e879f9",
    to: "#8b5cf6",
  },
  "score-level": {
    name: { en: "Score Climb", tr: "Puan Tırmanışı" },
    short: { en: "Climb", tr: "Tırmanış" },
    pun: { en: "Hit the target, raise the bar. Points make prizes.", tr: "Hedefi vur, çıtayı yükselt. Puan puandır." },
    rules: [
      { en: "+1s right · −2s wrong", tr: "Doğru +1s · Yanlış −2s" },
      { en: "Targets grow each level", tr: "Hedef her seviyede büyür" },
    ],
    from: "#34d399",
    to: "#14b8a6",
  },
};

export const modeName = (m: GameMode, lang: Language) => pick(MODE_META[m].name, lang);
export const modeShort = (m: GameMode, lang: Language) => pick(MODE_META[m].short, lang);
export const modePun = (m: GameMode, lang: Language) => pick(MODE_META[m].pun, lang);
export const modeRules = (m: GameMode, lang: Language) => MODE_META[m].rules.map((r) => pick(r, lang));
export const modeAccent = (m: GameMode) => ({ from: MODE_META[m].from, to: MODE_META[m].to });

const RATE_NAMES: Record<SpawnRateMultiplier, Bi> = {
  0.25: { en: "Drizzle", tr: "Çisenti" },
  0.5: { en: "Sprinkle", tr: "Serpinti" },
  1: { en: "Shower", tr: "Yağmur" },
  1.25: { en: "Downpour", tr: "Sağanak" },
  1.5: { en: "Storm", tr: "Fırtına" },
  2: { en: "Tempest", tr: "Tufan" },
  2.5: { en: "Hurricane", tr: "Kasırga" },
  3: { en: "Monsoon", tr: "Muson" },
};
export const rateName = (r: SpawnRateMultiplier, lang: Language) => pick(RATE_NAMES[r], lang);

const GRADES: { minWpm: number; title: Bi; quip: Bi }[] = [
  { minWpm: 80, title: { en: "Type-Lightning", tr: "Yıldırım Parmak" }, quip: { en: "The keyboard filed a noise complaint.", tr: "Klavye şikâyetçi oldu." } },
  { minWpm: 60, title: { en: "Fingers of Fury", tr: "Öfkeli Parmaklar" }, quip: { en: "Ten fingers, zero chill.", tr: "On parmak, sıfır sakinlik." } },
  { minWpm: 45, title: { en: "Keyboard Warrior", tr: "Klavye Savaşçısı" }, quip: { en: "The good kind, for once.", tr: "Bu sefer iyi anlamda." } },
  { minWpm: 30, title: { en: "Steady Typist", tr: "İstikrarlı Yazar" }, quip: { en: "You've got the write stuff.", tr: "Yazı senin işin." } },
  { minWpm: 15, title: { en: "Key Learner", tr: "Tuş Çırağı" }, quip: { en: "Practice makes perfect. Typos make character.", tr: "Pratik mükemmelleştirir." } },
  { minWpm: 0, title: { en: "Hunt & Peck", tr: "Tek Parmak" }, quip: { en: "Every legend starts with one finger.", tr: "Her efsane tek parmakla başlar." } },
];
export const gradeFor = (wpm: number, lang: Language) => {
  const g = GRADES.find((x) => wpm >= x.minWpm) ?? GRADES[GRADES.length - 1];
  return { title: pick(g.title, lang), quip: pick(g.quip, lang) };
};

const LEVEL_UP: Bi[] = [
  { en: "You've got the write stuff.", tr: "Klavyen yanıyor!" },
  { en: "Spell-binding.", tr: "Büyüleyici." },
  { en: "Key-rect!", tr: "Tam isabet!" },
  { en: "Type-cal excellence.", tr: "Tipik mükemmellik." },
  { en: "Letter perfect.", tr: "Harfi harfine." },
];
export const levelUpQuip = (level: number, lang: Language) => pick(LEVEL_UP[level % LEVEL_UP.length], lang);

const TAGLINES: Bi[] = [
  { en: "Keys to success. Literally.", tr: "Başarının anahtarı: tuşlar." },
  { en: "Mind your Ps and Qs. And the rest.", tr: "Harfine dikkat, hızına bak." },
  { en: "Type fast, typo less.", tr: "Hızlı yaz, az hata yap." },
];
export const randomTagline = (lang: Language) => pick(TAGLINES[Math.floor(Math.random() * TAGLINES.length)], lang);

export const t = (en: string, tr: string, lang: Language) => (lang === "türkçe" ? tr : en);
