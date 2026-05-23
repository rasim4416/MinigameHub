import type { Color, PieceType } from "../engine";
import type { Augment } from "../augments";
import type { AugmentTrigger } from "../chessTypes";
import { chessShell } from "../chessTheme";
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
      ? "Blind Rage — bonus pick!"
      : trigger?.reason === "bloodlust"
        ? "Bloodlust Bonus!"
        : trigger?.reason === "promotion"
          ? "Promotion bonus!"
          : trigger?.reason === "queen-capture"
            ? "Queen captured — bonus pick!"
            : trigger?.milestoneType
              ? `${MILESTONE_LABEL[trigger.milestoneType!]}`
              : null;

  const badgeBorder =
    pickMode === "blind-rage"
      ? "border-orange-600"
      : trigger?.reason === "bloodlust"
        ? "border-red-600"
        : "border-indigo-600";

  const badgeColor =
    pickMode === "blind-rage"
      ? "text-orange-300"
      : trigger?.reason === "bloodlust"
        ? "text-red-300"
        : "text-indigo-300";

  return (
    <div
      className={`${chessShell.overlay} ${pickMode === "blind-rage" ? "z-[90]" : "z-[80]"}`}
    >
      <div className="mb-4 max-w-lg text-center">
        {badgeLabel && (
          <div
            className={`mb-2.5 inline-block rounded-full border bg-slate-900/80 px-3.5 py-1 text-[11px] font-bold uppercase tracking-widest ${badgeBorder} ${badgeColor}`}
          >
            {badgeLabel}
          </div>
        )}
        <div className="mt-1 flex items-center justify-center gap-2.5">
          <div
            className={`h-3 w-3 shrink-0 rounded-full border-2 ${
              isWhite
                ? "border-slate-400 bg-white shadow-[0_0_10px_rgba(255,255,255,0.4)]"
                : "border-slate-500 bg-[#1a0f00] shadow-[0_0_10px_rgba(0,0,0,0.4)]"
            }`}
          />
          <h2 className="m-0 text-xl font-black tracking-widest text-slate-100">
            {playerColor.toUpperCase()}
          </h2>
        </div>
        {pickMode === "blind-rage" && (
          <p className="mx-auto mt-2 max-w-xs text-[11px] font-semibold leading-snug text-slate-400">
            Knight captured before both sides have finished four moves each
            (four full rounds).
          </p>
        )}
        {!badgeLabel && pickMode !== "blind-rage" && (
          <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
            Choose your augment
          </p>
        )}
      </div>

      <div className="grid w-full max-w-6xl grid-cols-1 place-items-center gap-4 px-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {offered.map((aug) => (
          <AugmentCard key={aug.id} augment={aug} onSelect={() => onSelect(aug)} />
        ))}
      </div>

      <p className="mt-4 text-[10px] text-slate-600">Click a card to select it</p>
    </div>
  );
}
