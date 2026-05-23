import type { Color, PieceType } from "../engine";
import type { Augment } from "../augments";
import type { AugmentTrigger } from "../chessTypes";
import { AugmentCard } from "./AugmentCard";

const MILESTONE_LABEL: Partial<Record<PieceType, string>> = {
  N: "First Knight Captured!",
  B: "First Bishop Captured!",
  R: "First Rook Captured!",
};

export function AugmentSelector({
  playerColor,
  offered,
  onSelect,
  trigger,
  pickMode = "normal",
}: {
  playerColor: Color;
  offered: Augment[];
  onSelect: (aug: Augment) => void;
  trigger?: AugmentTrigger | null;
  pickMode?: "normal" | "blind-rage";
}) {
  const isWhite = playerColor === "white";
  const badgeLabel =
    pickMode === "blind-rage"
      ? "😤 Blind Rage — bonus pick!"
      : trigger?.reason === "bloodlust"
        ? "🩸 Bloodlust Bonus!"
        : trigger?.reason === "promotion"
          ? "♕ Promotion bonus!"
          : trigger?.reason === "queen-capture"
            ? "👑 Queen captured — bonus pick!"
            : trigger?.milestoneType
              ? `✦ ${MILESTONE_LABEL[trigger.milestoneType!]}`
              : null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: pickMode === "blind-rage" ? 90 : 80,
        background: "linear-gradient(160deg,#030712 0%,#080e1f 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "16px 12px",
      }}
    >
      <div style={{ textAlign: "center" }}>
        {badgeLabel && (
          <div
            style={{
              display: "inline-block",
              marginBottom: 10,
              padding: "4px 14px",
              borderRadius: 20,
              background: "linear-gradient(135deg,#1c1f2e,#2d2f45)",
              border: `1px solid ${
                pickMode === "blind-rage"
                  ? "#ea580c"
                  : trigger?.reason === "bloodlust"
                    ? "#dc2626"
                    : "#4f46e5"
              }`,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              color:
                pickMode === "blind-rage"
                  ? "#fdba74"
                  : trigger?.reason === "bloodlust"
                    ? "#fca5a5"
                    : "#818cf8",
              textTransform: "uppercase",
            }}
          >
            {badgeLabel}
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginTop: badgeLabel ? 0 : 4,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              flexShrink: 0,
              background: isWhite ? "#ffffff" : "#1a0f00",
              border: `2px solid ${isWhite ? "#94a3b8" : "#6b7280"}`,
              boxShadow: `0 0 10px ${isWhite ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"}`,
            }}
          />
          <h2
            style={{
              fontSize: 20,
              fontWeight: 900,
              margin: 0,
              letterSpacing: "0.08em",
              color: "#f1f5f9",
            }}
          >
            {playerColor.toUpperCase()}
          </h2>
        </div>
        {pickMode === "blind-rage" && (
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#94a3b8",
              margin: "8px 0 0",
              maxWidth: 320,
              lineHeight: 1.45,
            }}
          >
            Knight captured before both sides have finished four moves each
            (four full rounds).
          </p>
        )}
        {!badgeLabel && pickMode !== "blind-rage" && (
          <p
            style={{
              fontSize: 10,
              letterSpacing: "0.2em",
              fontWeight: 700,
              color: "#475569",
              margin: "6px 0 0",
              textTransform: "uppercase",
            }}
          >
            Choose your augment
          </p>
        )}
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {offered.map((aug) => (
          <AugmentCard
            key={aug.id}
            augment={aug}
            onSelect={() => onSelect(aug)}
          />
        ))}
      </div>
      <p style={{ fontSize: 10, color: "#334155", margin: 0 }}>
        Click a card to select it
      </p>
    </div>
  );
}
