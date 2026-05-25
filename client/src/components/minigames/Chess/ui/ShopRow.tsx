import { getAugmentName } from "../../../../locales/chess";
import { useChessLanguage } from "../ChessLanguageContext";
import type { Augment } from "../augments";
import { RARITY_META } from "../augments";

export function ShopRow({
  augment,
  description,
  cost,
  canAfford,
  isMaxed,
  onBuy,
  showBuy = true,
  improveCost,
  canAffordImprove,
  showImprove,
  onImprove,
  disabled = false,
  tutorialId,
}: {
  augment: Augment;
  description?: string;
  cost: number;
  canAfford: boolean;
  isMaxed: boolean;
  onBuy: () => void;
  showBuy?: boolean;
  disabled?: boolean;
  tutorialId?: string;
  improveCost?: number;
  canAffordImprove?: boolean;
  showImprove?: boolean;
  onImprove?: () => void;
}) {
  const lang = useChessLanguage();
  const m = RARITY_META[augment.rarity];
  const name = getAugmentName(augment.id, lang);
  const canClickBuy = canAfford && !isMaxed && !disabled;
  const canClickImprove =
    showImprove &&
    improveCost != null &&
    canAffordImprove === true &&
    onImprove != null;
  const desc = description ?? augment.description;

  return (
    <div
      data-tutorial-id={tutorialId}
      className={`flex min-h-11 items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
        disabled
          ? "pointer-events-none opacity-40"
          : isMaxed && !showImprove
            ? "opacity-55"
            : "hover:border-slate-600 hover:bg-slate-900/80"
      }`}
      style={{ borderColor: `${m.border}44` }}
    >
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-slate-900"
        style={{ borderColor: `${m.border}44` }}
      >
        <span className="text-[15px] leading-none">{augment.icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="text-[11px] font-extrabold leading-tight tracking-wide"
          style={{ color: m.text }}
        >
          {name}
          {isMaxed && showBuy && (
            <span className="ml-1.5 text-[9px] font-bold tracking-widest text-amber-400">
              MAX
            </span>
          )}
        </div>
        <div className="line-clamp-2 text-[10px] leading-snug text-slate-500">
          {desc}
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
        {showImprove && improveCost != null && onImprove && (
          <button
            type="button"
            disabled={!canClickImprove}
            onClick={onImprove}
            className={`rounded-lg px-2.5 py-1.5 text-[10px] font-extrabold tracking-wide transition-all ${
              canClickImprove
                ? "cursor-pointer border border-amber-600/60 bg-amber-950 text-amber-300 hover:bg-amber-900/80"
                : "cursor-not-allowed border border-slate-800 bg-slate-900 text-slate-600"
            }`}
          >
            Improve {improveCost}g
          </button>
        )}
        {showBuy && (
          <button
            type="button"
            disabled={!canClickBuy}
            onClick={onBuy}
            className={`rounded-lg px-3 py-1.5 text-[10px] font-extrabold tracking-wide transition-all ${
              canClickBuy
                ? "cursor-pointer bg-indigo-600 text-white hover:bg-indigo-500"
                : "cursor-not-allowed bg-slate-800 text-slate-600"
            }`}
          >
            {cost}g
          </button>
        )}
      </div>
    </div>
  );
}
