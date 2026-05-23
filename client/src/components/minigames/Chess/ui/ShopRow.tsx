import type { Augment } from "../augments";
import { RARITY_META } from "../augments";

export function ShopRow({
  augment,
  cost,
  canAfford,
  isMaxed,
  onBuy,
}: {
  augment: Augment;
  cost: number;
  canAfford: boolean;
  isMaxed: boolean;
  onBuy: () => void;
}) {
  const m = RARITY_META[augment.rarity];
  const canClick = canAfford && !isMaxed;

  return (
    <div
      className={`flex min-h-11 items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
        isMaxed ? "opacity-55" : "hover:border-slate-600 hover:bg-slate-900/80"
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
          {augment.name}
          {isMaxed && (
            <span className="ml-1.5 text-[9px] font-bold tracking-widest text-amber-400">
              MAX
            </span>
          )}
        </div>
        <div className="line-clamp-2 text-[10px] leading-snug text-slate-500">
          {augment.description}
        </div>
      </div>
      <button
        type="button"
        disabled={!canClick}
        onClick={onBuy}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-extrabold tracking-wide transition-all ${
          canClick
            ? "cursor-pointer bg-indigo-600 text-white hover:bg-indigo-500"
            : "cursor-not-allowed bg-slate-800 text-slate-600"
        }`}
      >
        {cost}g
      </button>
    </div>
  );
}
