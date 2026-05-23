/** Shared Tailwind-oriented class strings for chess UI shells. */
export const chessShell = {
  page: "min-h-full w-full overflow-x-hidden overflow-y-auto bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100 select-none",
  column: "flex flex-col w-full mx-auto max-w-5xl",
  card: "rounded-xl border border-slate-800/80 bg-slate-950/90 shadow-lg",
  overlay: "absolute inset-0 z-[80] flex flex-col items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900/98 p-4 pb-8",
  muted: "text-slate-500",
  label: "text-[10px] font-bold uppercase tracking-widest text-slate-500",
} as const;

export const CHESS_LAYOUT = {
  playerBarHeight: 48,
  playerBarHeightMd: 56,
  eventBannerHeight: 36,
  themeRowHeight: 36,
  stagePadding: 24,
} as const;
