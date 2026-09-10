import { useChessLanguage } from "../ChessLanguageContext";

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
  const tr = useChessLanguage() === "türkçe";
  return (
    <button
      type="button"
      data-tutorial-id={tutorialId}
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`flex min-h-8 shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-extrabold tracking-[0.08em] transition-[transform,colors] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
        active
          ? "border-amber-400 bg-amber-300/15 text-amber-100"
          : "border-slate-700 bg-slate-900/40 text-slate-400 hover:-translate-y-px hover:border-slate-500 hover:bg-slate-800 hover:text-slate-100"
      }`}
    >
      <span className="text-[11px]">{icon}</span>
      {label}
      {active && <span className="rounded border border-amber-300/40 px-1 text-[8px] tracking-wider">{tr ? "HEDEF" : "TARGET"}</span>}
      {count !== undefined && count > 0 && (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-cyan-500 text-[9px] font-black text-slate-950">
          {count}
        </span>
      )}
    </button>
  );
}
