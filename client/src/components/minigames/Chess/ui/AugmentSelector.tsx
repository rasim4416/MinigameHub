import type { Color, PieceType } from "../engine";
import type { Augment } from "../augments";
import type { AugmentTrigger } from "../chessTypes";
import { useChessLanguage } from "../ChessLanguageContext";
import { AugmentCard } from "./AugmentCard";
import "./chess-ui.css";

const MILESTONE_LABEL: Partial<Record<PieceType, [string, string]>> = {
  N: ["First knight down — neigh-ce!", "İlk at düştü — eyvah!"],
  B: ["First bishop down — holy moly!", "İlk fil düştü — vay be!"],
  R: ["First rook down — rook 'n' roll!", "İlk kale düştü — kale gitti!"],
};

const TAGLINES_EN = [
  "Pick your poison.",
  "Choose wisely. Or chaotically.",
  "One card. Infinite smugness.",
  "Power up. Trash-talk optional.",
  "Fortune favours the bold move.",
];
const TAGLINES_TR = [
  "Zehrini seç.",
  "Akıllıca seç. Ya da kaotikçe.",
  "Bir kart, sonsuz özgüven.",
  "Güçlen. Laf sokmak serbest.",
  "Talih cesur hamleden yanadır.",
];

function pickTagline(offered: Augment[], tr: boolean): string {
  const list = tr ? TAGLINES_TR : TAGLINES_EN;
  const seed = offered.reduce((h, a) => h + a.id.length * 7 + a.id.charCodeAt(0), 0);
  return list[seed % list.length];
}

export function AugmentSelector({
  playerColor,
  offered,
  onSelect,
  trigger,
  pickMode = "normal",
  enabledIds,
}: {
  playerColor: Color;
  offered: Augment[];
  onSelect: (aug: Augment) => void;
  trigger?: AugmentTrigger | null;
  pickMode?: "normal" | "blind-rage";
  enabledIds?: Set<string>;
}) {
  const tr = useChessLanguage() === "türkçe";
  const isWhite = playerColor === "white";

  const badge: { label: string; tone: string } | null =
    pickMode === "blind-rage"
      ? { label: tr ? "😤 Kör Öfke — bonus seçim!" : "😤 Blind Rage — horse-rible for them!", tone: "rage" }
      : trigger?.reason === "event"
        ? { label: tr ? "✨ Etkinlik bonusu!" : "✨ Event bonus — eventful!", tone: "event" }
        : trigger?.reason === "bloodlust"
          ? { label: tr ? "🩸 Kan Hırsı bonusu!" : "🩸 Bloodlust — out for blood!", tone: "blood" }
          : trigger?.reason === "promotion"
            ? { label: tr ? "♕ Terfi bonusu!" : "♕ Promotion — moving on up!", tone: "event" }
            : trigger?.reason === "queen-capture"
              ? { label: tr ? "👑 Vezir düştü — bonus!" : "👑 Queen down — long live the loot!", tone: "gold" }
              : trigger?.milestoneType && MILESTONE_LABEL[trigger.milestoneType]
                ? { label: `✦ ${MILESTONE_LABEL[trigger.milestoneType]![tr ? 1 : 0]}`, tone: "event" }
                : null;

  return (
    <div
      className={`augsel augsel--${isWhite ? "white" : "black"}`}
      style={{ zIndex: pickMode === "blind-rage" ? 110 : 100 }}
    >
      <div className="augsel__floor" aria-hidden />
      <div className="augsel__head">
        {badge && <div className={`augsel__badge augsel__badge--${badge.tone}`}>{badge.label}</div>}
        <div className="augsel__player">
          <span className={`augsel__king augsel__king--${isWhite ? "white" : "black"}`} aria-hidden>
            {isWhite ? "♔" : "♚"}
          </span>
          <h2 className="augsel__title">
            {isWhite ? (tr ? "Beyaz" : "White") : tr ? "Siyah" : "Black"}
            <span className="augsel__title-sub">{tr ? "augmentini seç" : "picks an augment"}</span>
          </h2>
        </div>
        <p className="augsel__tagline">
          {pickMode === "blind-rage"
            ? tr
              ? "Dört tur dolmadan at aldın. Öfken ödüllendirildi."
              : "Knight snatched before round four. Rage, rewarded."
            : pickTagline(offered, tr)}
        </p>
      </div>

      <div className="augsel__hand">
        {offered.map((aug, i) => {
          const enabled = !enabledIds || enabledIds.has(aug.id);
          return (
            <AugmentCard
              key={aug.id}
              index={i}
              augment={aug}
              disabled={!enabled}
              highlighted={enabled && !!enabledIds}
              tutorialId={enabledIds ? `tutorial-augment-${aug.id}` : undefined}
              onSelect={() => onSelect(aug)}
            />
          );
        })}
      </div>

      <p className="augsel__hint">
        {tr ? "Seçmek için karta tıkla · kurallar için ?" : "Click a card to claim it · tap ? for the fine print"}
      </p>
    </div>
  );
}
