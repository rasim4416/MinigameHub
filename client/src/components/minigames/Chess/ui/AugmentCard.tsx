import { useState } from "react";
import {
  getAugmentDescription,
  getAugmentName,
} from "../../../../locales/chess";
import { useChessLanguage } from "../ChessLanguageContext";
import type { Augment } from "../augments";
import { RARITY_META } from "../augments";

export function AugmentCard({
  augment,
  onSelect,
}: {
  augment: Augment;
  onSelect: () => void;
}) {
  const lang = useChessLanguage();
  const [hov, setHov] = useState(false);
  const m = RARITY_META[augment.rarity];
  const name = getAugmentName(augment.id, lang);
  const description = getAugmentDescription(augment.id, lang);
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 155,
        padding: "18px 14px 14px",
        borderRadius: 14,
        position: "relative",
        border: `2px solid ${hov ? m.border : "rgba(255,255,255,0.07)"}`,
        background: hov ? "#0b1120" : "#080e1a",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        boxShadow: hov
          ? `0 0 22px ${m.glow},0 4px 16px rgba(0,0,0,0.5)`
          : "0 2px 8px rgba(0,0,0,0.4)",
        transform: hov
          ? "translateY(-5px) scale(1.02)"
          : "translateY(0) scale(1)",
        transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
        userSelect: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 14,
          right: 14,
          height: 3,
          borderRadius: "0 0 3px 3px",
          background:
            m.shimmer ??
            `linear-gradient(90deg,transparent,${m.border},transparent)`,
          opacity: hov ? 1 : augment.rarity === "legendary" ? 0.8 : 0.4,
          transition: "opacity 0.2s",
        }}
      />
      <span
        style={{
          fontSize: 32,
          lineHeight: 1,
          filter: hov ? "drop-shadow(0 0 8px rgba(255,255,255,0.3))" : "none",
          transition: "filter 0.2s",
        }}
      >
        {augment.icon}
      </span>
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#f1f5f9",
            margin: "0 0 5px",
            letterSpacing: "0.01em",
          }}
        >
          {name}
        </p>
        <p
          style={{
            fontSize: 10.5,
            color: "#64748b",
            margin: 0,
            lineHeight: 1.45,
          }}
        >
          {description}
        </p>
      </div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          padding: "2px 10px",
          borderRadius: 20,
          background: m.badge,
          color: m.text,
          border: `1px solid ${m.border}`,
        }}
      >
        {m.label}
      </div>
    </div>
  );
}

/** Multiplayer lobby pick — same card UI. */
export function AugmentCardPick({
  aug,
  onPick,
}: {
  aug: Augment;
  onPick: () => void;
}) {
  return <AugmentCard augment={aug} onSelect={onPick} />;
}
