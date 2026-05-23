export function UndoButton({ onUndo }: { onUndo: () => void }) {
  return (
    <button
      type="button"
      onClick={onUndo}
      title="Use your Oops! undo"
      className="flex shrink-0 items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-extrabold tracking-wide text-slate-400 transition-all hover:border-indigo-500 hover:bg-indigo-950/50 hover:text-indigo-300"
    >
      <span className="text-[11px]">↩</span>
      UNDO
    </button>
  );
}
