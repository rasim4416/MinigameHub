export function GoldBadge({ gold, active }: { gold: number; active: boolean }) {
  return (
    <div
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 transition-all ${
        gold > 0
          ? "border-amber-500/35 bg-gradient-to-br from-amber-950/80 to-amber-900/40"
          : "border-white/10 bg-white/5"
      } ${gold > 0 && active ? "shadow-[0_0_8px_rgba(234,179,8,0.25)]" : ""}`}
    >
      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 via-amber-500 to-amber-800 shadow-inner ring-1 ring-white/25">
        <span className="text-[8px] font-black leading-none text-amber-950">G</span>
      </div>
      <span
        className={`min-w-[14px] text-right text-sm font-extrabold leading-none ${
          gold > 0 ? "text-amber-400" : "text-slate-600"
        }`}
      >
        {gold}
      </span>
    </div>
  );
}
