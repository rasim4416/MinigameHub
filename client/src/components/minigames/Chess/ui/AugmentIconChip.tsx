import {
  getAugmentDescription,
  getAugmentName,
} from "../../../../locales/chess";
import { useChessLanguage } from "../ChessLanguageContext";
import type { Augment } from "../augments";
import { RARITY_META } from "../augments";

export function AugmentIconChip({
  augment,
  stacked,
}: {
  augment: Augment;
  stacked?: boolean;
}) {
  const lang = useChessLanguage();
  const m = RARITY_META[augment.rarity];
  const name = getAugmentName(augment.id, lang);
  const description = getAugmentDescription(augment.id, lang);
  return (
    <div
      title={`${name}${stacked ? " ★ (×2)" : ""} — ${description}`}
      className="relative h-6 w-6 shrink-0 cursor-default"
    >
      <div
        className="flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] bg-slate-900"
        style={{ borderColor: m.border, boxShadow: `0 0 5px ${m.glow}` }}
      >
        <span className="text-[10px] leading-none">{augment.icon}</span>
      </div>
      {stacked && (
        <div className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full border border-amber-950 bg-gradient-to-br from-amber-500 to-yellow-300 shadow-[0_0_4px_rgba(234,179,8,0.7)]">
          <span className="text-[7px] font-black leading-none text-amber-950">★</span>
        </div>
      )}
    </div>
  );
}
