import { useEffect } from "react";
import { useChessLanguage } from "../ChessLanguageContext";
import {
  ADVANTAGE_OPTIONS,
  ADVANTAGE_PERKS,
  describePerks,
  parseAdvantage,
  type AdvantageLevel,
  type AdvantageSetting,
} from "../advantage";
import { BOT_DIFFICULTIES, BOT_SKILL_LEVEL, type BotDifficulty } from "../chessBot/constants";
import "./chess-ui.css";
import "./start-screen.css";

const FEATURES: { icon: string; en: [string, string]; tr: [string, string] }[] = [
  { icon: "🃏", en: ["Augments", "Pick a power before move one"], tr: ["Augmentler", "İlk hamleden önce güç seç"] },
  { icon: "🪙", en: ["Gold & shop", "Captures pay. Spend wisely."], tr: ["Altın & dükkan", "Alımlar öder. Akıllı harca."] },
  { icon: "⚡", en: ["Board events", "Fate rolls every few rounds"], tr: ["Tahta olayları", "Kader birkaç turda bir zar atar"] },
  { icon: "🔨", en: ["Auctions", "Bid gold for mercenaries"], tr: ["Müzayede", "Paralı askerlere teklif ver"] },
];

const DIFFICULTY_COPY: Record<BotDifficulty, { en: [string, string]; tr: [string, string] }> = {
  easy: { en: ["Easy", "Slips up"], tr: ["Kolay", "Hata yapar"] },
  medium: { en: ["Medium", "Solid club player"], tr: ["Orta", "Sağlam kulüp oyuncusu"] },
  hard: { en: ["Hard", "Full strength"], tr: ["Zor", "Tam güç"] },
};

const LEVEL_COPY: Record<AdvantageLevel, { en: string; tr: string }> = {
  high: { en: "High", tr: "Yüksek" },
  medium: { en: "Med", tr: "Orta" },
  low: { en: "Low", tr: "Düşük" },
};

export type StartSetup = {
  advantage: AdvantageSetting;
  onAdvantage: (a: AdvantageSetting) => void;
  /** Bot mode only. */
  difficulty?: BotDifficulty;
  onDifficulty?: (d: BotDifficulty) => void;
};

export function StartScreen({
  onStart,
  subtitle,
  botMode = false,
  setup,
}: {
  onStart: () => void;
  subtitle?: string;
  botMode?: boolean;
  setup?: StartSetup;
}) {
  const tr = useChessLanguage() === "türkçe";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") onStart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStart]);

  const whiteName = botMode ? (tr ? "Sen" : "You") : tr ? "Beyaz" : "White";
  const blackName = botMode ? "Stockfish" : tr ? "Siyah" : "Black";
  const difficulty = setup?.difficulty;
  const blackRole =
    botMode && difficulty
      ? `${(tr ? DIFFICULTY_COPY[difficulty].tr : DIFFICULTY_COPY[difficulty].en)[0]} · Skill ${BOT_SKILL_LEVEL[difficulty]}`
      : botMode
        ? tr
          ? "Hiç uyumaz"
          : "Never sleeps"
        : tr
          ? "Rövanşa hazır"
          : "Plots revenge";

  const favoured = setup ? parseAdvantage(setup.advantage) : null;
  const perks = favoured ? describePerks(ADVANTAGE_PERKS[favoured.level], tr) : [];
  const favouredName = favoured ? (favoured.color === "white" ? whiteName : blackName) : "";

  return (
    <div className="cstart">
      <div className="cstart__board" aria-hidden />
      <div className="cstart__glow" aria-hidden />

      <div className="cstart__brand">
        <span className="cstart__kicker">{tr ? "Satranç" : "Chess"} · Augmented</span>
        <h2 className="cstart__title">
          Chess <span>Augmented</span>
        </h2>
        <p className="cstart__subtitle">
          {subtitle ?? (tr ? "Aynı tahta. Yeni kurallar. Sıfır merhamet." : "Same board. New rules. Zero chill.")}
        </p>
      </div>

      <div className="cstart__versus">
        <div className={`cstart__side cstart__side--white${favoured?.color === "white" ? " is-favoured" : ""}`}>
          <span className="cstart__piece">♔</span>
          <span className="cstart__name">{whiteName}</span>
          <span className="cstart__role">{tr ? "İlk hamle" : "Moves first"}</span>
        </div>
        <span className="cstart__vs">VS</span>
        <div className={`cstart__side cstart__side--black${favoured?.color === "black" ? " is-favoured" : ""}`}>
          <span className="cstart__piece">{botMode ? "🤖" : "♚"}</span>
          <span className="cstart__name">{blackName}</span>
          <span className="cstart__role">{blackRole}</span>
        </div>
      </div>

      {setup && (
        <div className="cstart__setup">
          {botMode && difficulty && setup.onDifficulty && (
            <div className="cstart__row">
              <span className="cstart__label">{tr ? "Zorluk" : "Difficulty"}</span>
              <div className="cstart__diff" role="radiogroup" aria-label={tr ? "Bot zorluğu" : "Bot difficulty"}>
                {BOT_DIFFICULTIES.map((d) => {
                  const [name, hint] = tr ? DIFFICULTY_COPY[d].tr : DIFFICULTY_COPY[d].en;
                  return (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={difficulty === d}
                      className={`cstart__diff-opt cstart__diff-opt--${d}${difficulty === d ? " is-on" : ""}`}
                      onClick={() => setup.onDifficulty?.(d)}
                    >
                      <strong>{name}</strong>
                      <span>
                        {d === "hard" ? hint : `Skill ${BOT_SKILL_LEVEL[d]} · ${hint}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="cstart__row">
            <span className="cstart__label">{tr ? "Avantaj" : "Advantage"}</span>
            <div className="cstart__adv">
              <div className="cstart__adv-ends" aria-hidden>
                <span>♔ {whiteName}</span>
                <span>{blackName} ♚</span>
              </div>
              <div className="cstart__adv-track" role="radiogroup" aria-label={tr ? "Avantaj" : "Advantage"}>
                {ADVANTAGE_OPTIONS.map((opt) => {
                  const parsed = parseAdvantage(opt);
                  const label = parsed
                    ? tr
                      ? LEVEL_COPY[parsed.level].tr
                      : LEVEL_COPY[parsed.level].en
                    : tr
                      ? "Eşit"
                      : "Even";
                  const sideName = parsed ? (parsed.color === "white" ? whiteName : blackName) : "";
                  return (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={setup.advantage === opt}
                      aria-label={parsed ? `${sideName} · ${label}` : label}
                      className={`cstart__adv-opt cstart__adv-opt--${parsed?.color ?? "neutral"} cstart__adv-opt--${parsed?.level ?? "even"}${setup.advantage === opt ? " is-on" : ""}`}
                      onClick={() => setup.onAdvantage(opt)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="cstart__perks" aria-live="polite">
                {favoured ? (
                  <>
                    <span className="cstart__perks-who">{favouredName}:</span>
                    {perks.map((p) => (
                      <span key={p} className="cstart__perk">
                        {p}
                      </span>
                    ))}
                  </>
                ) : (
                  <span className="cstart__perks-even">
                    {tr ? "İki taraf da eşit başlar." : "Both sides start even."}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      <ul className="cstart__features">
        {FEATURES.map((f) => {
          const [title, body] = tr ? f.tr : f.en;
          return (
            <li key={f.icon} className="cstart__feature">
              <span className="cstart__feature-icon" aria-hidden>
                {f.icon}
              </span>
              <span className="cstart__feature-text">
                <strong>{title}</strong>
                <span>{body}</span>
              </span>
            </li>
          );
        })}
      </ul>

      <button type="button" onClick={onStart} className="cstart__go">
        {tr ? "Oyuna başla" : "Start game"}
        <span className="cstart__key">ENTER</span>
      </button>
    </div>
  );
}
