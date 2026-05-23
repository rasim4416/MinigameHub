import { useState } from "react";
import type { Augment } from "../augments";
import { RARITY_META } from "../augments";

export function AugmentCard({
  augment,
  onSelect,
}: {
  augment: Augment;
  onSelect: () => void;
}) {
  const [hov, setHov] = useState(false);
  const m = RARITY_META[augment.rarity];

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className={`relative flex w-full max-w-[200px] min-w-0 flex-col items-center gap-2.5 rounded-xl border-2 bg-slate-950/90 px-3.5 pb-3.5 pt-4 text-left transition-all duration-200 ${
        hov
          ? "-translate-y-1 border-opacity-100 shadow-lg"
          : "border-white/10 shadow-md"
      }`}
      style={{
        borderColor: hov ? m.border : "rgba(255,255,255,0.07)",
        boxShadow: hov ? `0 0 22px ${m.glow},0 4px 16px rgba(0,0,0,0.5)` : undefined,
      }}
    >
      <div
        className="absolute left-3.5 right-3.5 top-0 h-0.5 rounded-b-sm transition-opacity"
        style={{
          background:
            m.shimmer ??
            `linear-gradient(90deg,transparent,${m.border},transparent)`,
          opacity: hov ? 1 : augment.rarity === "legendary" ? 0.8 : 0.4,
        }}
      />
      <span
        className={`text-[32px] leading-none transition-[filter] ${
          hov ? "drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" : ""
        }`}
      >
        {augment.icon}
      </span>
      <div className="w-full text-center">
        <p className="mb-1 text-[13px] font-extrabold tracking-wide text-slate-100">
          {augment.name}
        </p>
        <p className="m-0 text-xs leading-relaxed text-slate-500">
          {augment.description}
        </p>
      </div>
      <div
        className="rounded-full border px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest"
        style={{
          background: m.badge,
          color: m.text,
          borderColor: m.border,
        }}
      >
        {m.label}
      </div>
    </button>
  );
}

/** Button variant for multiplayer draft (same visuals, full width). */
export function AugmentCardPick({
  aug,
  onPick,
}: {
  aug: Augment;
  onPick: () => void;
}) {
  return <AugmentCard augment={aug} onSelect={onPick} />;
}
