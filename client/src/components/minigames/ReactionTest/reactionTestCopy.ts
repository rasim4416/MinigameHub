import type { Language } from "@/lib/language";

export type GameMode = "classic" | "aim" | "gonogo" | "sequence";
export const GAME_MODES: GameMode[] = ["classic", "aim", "gonogo", "sequence"];

type Bi = { en: string; tr: string };
const pick = (b: Bi, lang: Language) => (lang === "türkçe" ? b.tr : b.en);
export const t = (en: string, tr: string, lang: Language) => (lang === "türkçe" ? tr : en);

// ─── Settings ────────────────────────────────────────────────────────────────

export interface ClassicSettings { trials: 3 | 5 | 10; maxWait: 2000 | 4000 | 6000 }
export interface AimSettings { size: "large" | "medium" | "small"; density: "calm" | "busy" }
export interface GoNoGoSettings { ratio: 0.7 | 0.5 | 0.3; trials: 20 | 40 }
export interface SequenceSettings { start: 1 | 2 | 3; pace: "slow" | "normal" | "fast" }

export interface Settings {
  classic: ClassicSettings;
  aim: AimSettings;
  gonogo: GoNoGoSettings;
  sequence: SequenceSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  classic: { trials: 5, maxWait: 4000 },
  aim: { size: "medium", density: "calm" },
  gonogo: { ratio: 0.7, trials: 20 },
  sequence: { start: 1, pace: "normal" },
};

export interface SubsettingDef {
  key: string;
  label: Bi;
  options: { value: string | number; label: Bi }[];
}

export const SUBSETTINGS: Record<GameMode, SubsettingDef[]> = {
  classic: [
    {
      key: "trials",
      label: { en: "Trials", tr: "Deneme" },
      options: [3, 5, 10].map((v) => ({ value: v, label: { en: String(v), tr: String(v) } })),
    },
    {
      key: "maxWait",
      label: { en: "Max wait", tr: "En uzun bekleme" },
      options: [2000, 4000, 6000].map((v) => ({
        value: v,
        label: { en: `${v / 1000}s`, tr: `${v / 1000} sn` },
      })),
    },
  ],
  aim: [
    {
      key: "size",
      label: { en: "Target", tr: "Hedef" },
      options: [
        { value: "large", label: { en: "Large", tr: "Büyük" } },
        { value: "medium", label: { en: "Medium", tr: "Orta" } },
        { value: "small", label: { en: "Small", tr: "Küçük" } },
      ],
    },
    {
      key: "density",
      label: { en: "Pace", tr: "Tempo" },
      options: [
        { value: "calm", label: { en: "Calm", tr: "Sakin" } },
        { value: "busy", label: { en: "Busy", tr: "Yoğun" } },
      ],
    },
  ],
  gonogo: [
    {
      key: "ratio",
      label: { en: "Go ratio", tr: "Bas oranı" },
      options: [0.7, 0.5, 0.3].map((v) => ({
        value: v,
        label: { en: `${Math.round(v * 100)}%`, tr: `%${Math.round(v * 100)}` },
      })),
    },
    {
      key: "trials",
      label: { en: "Trials", tr: "Deneme" },
      options: [20, 40].map((v) => ({ value: v, label: { en: String(v), tr: String(v) } })),
    },
  ],
  sequence: [
    {
      key: "start",
      label: { en: "Start length", tr: "Başlangıç" },
      options: [1, 2, 3].map((v) => ({ value: v, label: { en: String(v), tr: String(v) } })),
    },
    {
      key: "pace",
      label: { en: "Pace", tr: "Tempo" },
      options: [
        { value: "slow", label: { en: "Slow", tr: "Yavaş" } },
        { value: "normal", label: { en: "Normal", tr: "Normal" } },
        { value: "fast", label: { en: "Fast", tr: "Hızlı" } },
      ],
    },
  ],
};

export const subLabel = (d: SubsettingDef, lang: Language) => pick(d.label, lang);
export const optLabel = (o: SubsettingDef["options"][number], lang: Language) => pick(o.label, lang);

// ─── Mode meta ───────────────────────────────────────────────────────────────

interface ModeMeta {
  name: Bi;
  pun: Bi;
  rules: Bi[];
  from: string;
  to: string;
  /** Classic stores the lowest average; every other mode keeps the highest score. */
  lowerIsBetter: boolean;
}

const MODE_META: Record<GameMode, ModeMeta> = {
  classic: {
    name: { en: "Classic Flash", tr: "Klasik Flaş" },
    pun: { en: "Green means go. Red means patience.", tr: "Yeşil bas der. Kırmızı sabret der." },
    rules: [
      { en: "Tap on green", tr: "Yeşilde bas" },
      { en: "Early = foul", tr: "Erken = faul" },
    ],
    from: "#facc15",
    to: "#f97316",
    lowerIsBetter: true,
  },
  aim: {
    name: { en: "Aim Snap", tr: "Nişan Al" },
    pun: { en: "Point, click, brag.", tr: "Nişan al, tıkla, hava at." },
    rules: [
      { en: "30s · 3 lives", tr: "30 sn · 3 can" },
      { en: "Misses cost 5", tr: "Iska −5" },
    ],
    from: "#fb7185",
    to: "#e11d48",
    lowerIsBetter: false,
  },
  gonogo: {
    name: { en: "Go / No-Go", tr: "Bas / Basma" },
    pun: { en: "Know when to hold 'em.", tr: "Ne zaman durulacağını bil." },
    rules: [
      { en: "Green circle: tap", tr: "Yeşil daire: bas" },
      { en: "Red square: freeze", tr: "Kırmızı kare: dur" },
    ],
    from: "#4ade80",
    to: "#0d9488",
    lowerIsBetter: false,
  },
  sequence: {
    name: { en: "Sequence Echo", tr: "Sıra Yankısı" },
    pun: { en: "Monkey see, monkey tap.", tr: "Gördüğünü tekrar et." },
    rules: [
      { en: "Repeat the flashes", tr: "Işıkları tekrarla" },
      { en: "One slip ends it", tr: "Tek hata biter" },
    ],
    from: "#22d3ee",
    to: "#3b82f6",
    lowerIsBetter: false,
  },
};

export const modeName = (m: GameMode, lang: Language) => pick(MODE_META[m].name, lang);
export const modePun = (m: GameMode, lang: Language) => pick(MODE_META[m].pun, lang);
export const modeRules = (m: GameMode, lang: Language) => MODE_META[m].rules.map((r) => pick(r, lang));
export const modeAccent = (m: GameMode) => ({ from: MODE_META[m].from, to: MODE_META[m].to });
export const lowerIsBetter = (m: GameMode) => MODE_META[m].lowerIsBetter;

export const formatBest = (m: GameMode, value: number, lang: Language) => {
  if (!value) return "—";
  if (m === "classic") return `${value} ms`;
  if (m === "sequence") return t(`${value} long`, `${value} uzun`, lang);
  return value.toLocaleString();
};

// ─── Grades & flavour ────────────────────────────────────────────────────────

const GRADES: { min: number; title: Bi; quip: Bi }[] = [
  { min: 0.9, title: { en: "Lightning Rod", tr: "Paratoner" }, quip: { en: "Did you see it coming? Because you beat it.", tr: "Işıktan önce davrandın." } },
  { min: 0.75, title: { en: "Quick Draw", tr: "Seri Silahşor" }, quip: { en: "Fastest finger in the west.", tr: "Batının en hızlı parmağı." } },
  { min: 0.55, title: { en: "Sharp Shooter", tr: "Keskin Nişancı" }, quip: { en: "Reflexes on point.", tr: "Refleksler yerinde." } },
  { min: 0.35, title: { en: "Steady Hand", tr: "Sağlam El" }, quip: { en: "Not fast, not furious. Yet.", tr: "Hızlı değil, öfkeli değil. Henüz." } },
  { min: 0.15, title: { en: "Coffee Pending", tr: "Kahve Bekleniyor" }, quip: { en: "Have you tried caffeine?", tr: "Bir kahve iyi gelirdi." } },
  { min: 0, title: { en: "Sloth Mode", tr: "Tembel Hayvan" }, quip: { en: "Slow and steady wins... eventually.", tr: "Yavaş ama emin adımlarla." } },
];

export const gradeFor = (quality: number, lang: Language) => {
  const g = GRADES.find((x) => quality >= x.min) ?? GRADES[GRADES.length - 1];
  return { title: pick(g.title, lang), quip: pick(g.quip, lang) };
};

const TAGLINES: Bi[] = [
  { en: "Blink and you lose.", tr: "Göz kırpan kaybeder." },
  { en: "Your reflexes called. They want a rematch.", tr: "Reflekslerin rövanş istiyor." },
  { en: "Fast fingers, faster brain.", tr: "Hızlı parmak, daha hızlı beyin." },
];
export const randomTagline = (lang: Language) =>
  pick(TAGLINES[Math.floor(Math.random() * TAGLINES.length)], lang);
