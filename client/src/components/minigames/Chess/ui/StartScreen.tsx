import { useEffect } from "react";
import { useChessLanguage } from "../ChessLanguageContext";
import "./chess-ui.css";
import "./start-screen.css";

const FEATURES: { icon: string; en: [string, string]; tr: [string, string] }[] = [
  { icon: "🃏", en: ["Augments", "Pick a power before move one"], tr: ["Augmentler", "İlk hamleden önce güç seç"] },
  { icon: "🪙", en: ["Gold & shop", "Captures pay. Spend wisely."], tr: ["Altın & dükkan", "Alımlar öder. Akıllı harca."] },
  { icon: "⚡", en: ["Board events", "Fate rolls every few rounds"], tr: ["Tahta olayları", "Kader birkaç turda bir zar atar"] },
  { icon: "🔨", en: ["Auctions", "Bid gold for mercenaries"], tr: ["Müzayede", "Paralı askerlere teklif ver"] },
];

export function StartScreen({
  onStart,
  subtitle,
  botMode = false,
}: {
  onStart: () => void;
  subtitle?: string;
  botMode?: boolean;
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
        <div className="cstart__side cstart__side--white">
          <span className="cstart__piece">♔</span>
          <span className="cstart__name">{whiteName}</span>
          <span className="cstart__role">{tr ? "İlk hamle" : "Moves first"}</span>
        </div>
        <span className="cstart__vs">VS</span>
        <div className="cstart__side cstart__side--black">
          <span className="cstart__piece">{botMode ? "🤖" : "♚"}</span>
          <span className="cstart__name">{blackName}</span>
          <span className="cstart__role">
            {botMode ? (tr ? "Hiç uyumaz" : "Never sleeps") : tr ? "Rövanşa hazır" : "Plots revenge"}
          </span>
        </div>
      </div>

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
