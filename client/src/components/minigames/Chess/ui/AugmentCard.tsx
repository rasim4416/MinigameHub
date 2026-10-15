import { useState, type CSSProperties } from "react";
import {
  getAugmentDescription,
  getAugmentName,
  getAugmentPun,
} from "../../../../locales/chess";
import { useChessLanguage } from "../ChessLanguageContext";
import type { Augment } from "../augments";
import { RARITY_META } from "../augments";
import "./chess-ui.css";

export function AugmentCard({
  augment,
  onSelect,
  disabled = false,
  highlighted = false,
  tutorialId,
  index = 0,
}: {
  augment: Augment;
  onSelect: () => void;
  disabled?: boolean;
  highlighted?: boolean;
  tutorialId?: string;
  /** Position in the hand, used to stagger the deal-in animation. */
  index?: number;
}) {
  const lang = useChessLanguage();
  const tr = lang === "türkçe";
  const [flipped, setFlipped] = useState(false);
  const m = RARITY_META[augment.rarity];
  const name = getAugmentName(augment.id, lang);
  const pun = getAugmentPun(augment.id, lang);
  const description = getAugmentDescription(augment.id, lang);

  const vars = {
    "--aug-border": m.border,
    "--aug-glow": m.glow,
    "--aug-text": m.text,
    "--aug-badge": m.badge,
    "--aug-delay": `${index * 0.09}s`,
  } as CSSProperties;

  return (
    <div
      data-tutorial-id={tutorialId}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={`${name} — ${m.label}. ${description}`}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
        if (event.key === "?" || event.key === "i") setFlipped((f) => !f);
      }}
      className={`aug aug--${augment.rarity}${flipped ? " aug--flipped" : ""}${
        disabled ? " aug--disabled" : ""
      }${highlighted ? " aug--highlighted" : ""}`}
      style={vars}
    >
      <div className="aug__flipper">
        <div className="aug__face aug__face--front">
          <span className="aug__foil" aria-hidden />
          <div className="aug__ribbon">{m.label}</div>
          <div className="aug__medallion">
            <span className="aug__rays" aria-hidden />
            <span className="aug__icon">{augment.icon}</span>
          </div>
          <h3 className="aug__name">{name}</h3>
          <span className="aug__divider" aria-hidden>
            ◆
          </span>
          <p className="aug__pun">{pun ?? description}</p>
        </div>
        <div className="aug__face aug__face--back">
          <div className="aug__ribbon">{tr ? "Kurallar" : "Fine print"}</div>
          <span className="aug__back-icon" aria-hidden>
            {augment.icon}
          </span>
          <p className="aug__rules">{description}</p>
          <span className="aug__back-hint">{tr ? "Seçmek için tıkla" : "Click to claim"}</span>
        </div>
      </div>
      <button
        type="button"
        className="aug__info"
        aria-label={flipped ? (tr ? "Kartı çevir" : "Show front") : tr ? "Kuralları göster" : "Show rules"}
        aria-pressed={flipped}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setFlipped((f) => !f);
        }}
      >
        {flipped ? "↺" : "?"}
      </button>
    </div>
  );
}

/** Multiplayer lobby pick — same card UI. */
export function AugmentCardPick({
  aug,
  onPick,
  index,
}: {
  aug: Augment;
  onPick: () => void;
  index?: number;
}) {
  return <AugmentCard augment={aug} onSelect={onPick} index={index} />;
}
