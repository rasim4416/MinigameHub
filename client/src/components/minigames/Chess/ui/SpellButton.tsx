export function SpellButton({
  icon,
  label,
  active,
  onClick,
  title,
  count,
  tutorialId,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
  title?: string;
  count?: number;
  tutorialId?: string;
}) {
  return (
    <button
      type="button"
      data-tutorial-id={tutorialId}
      onClick={onClick}
      title={title}
      className={`flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-extrabold tracking-wide transition-all ${
        active
          ? "border-cyan-500 bg-cyan-500/15 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.3)]"
          : "border-slate-800 bg-transparent text-slate-500 hover:border-slate-600 hover:bg-slate-900 hover:text-slate-300"
      }`}
    >
      <span className="text-[11px]">{icon}</span>
      {label}
      {count !== undefined && count > 0 && (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-cyan-500 text-[9px] font-black text-slate-950">
          {count}
        </span>
      )}
    </button>
  );
}
