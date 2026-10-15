import type { ReactNode } from "react";
import {
  BOARD_THEMES,
  type BoardThemeId,
} from "../boardThemes";

export function BoardStage({
  boardPx,
  boardPxW,
  boardPxH,
  stageMinHeight,
  boardThemeId,
  onThemeChange,
  showEventBanner,
  eventBanner,
  children,
  overlays,
}: {
  boardPx?: number;
  boardPxW?: number;
  boardPxH?: number;
  stageMinHeight: number;
  boardThemeId: BoardThemeId;
  onThemeChange: (id: BoardThemeId) => void;
  showEventBanner: boolean;
  eventBanner: ReactNode;
  children: ReactNode;
  overlays?: ReactNode;
}) {
  const w = boardPxW ?? boardPx ?? 320;
  const h = boardPxH ?? boardPx ?? 320;

  return (
    <section
      className="relative flex w-full flex-shrink-0 flex-col items-center justify-center px-3 pb-3 pt-2"
      style={{ minHeight: stageMinHeight }}
    >
      <div
        className="mb-2.5 flex min-h-8 w-full flex-shrink-0 flex-wrap items-center justify-between gap-2"
        style={{ maxWidth: Math.max(w + 16, 320) }}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {showEventBanner && eventBanner}
        </div>
        <div
          className="flex items-center gap-1 rounded-full border border-slate-700/70 bg-slate-950/70 p-1"
          role="radiogroup"
          aria-label="Board theme"
        >
          {(Object.keys(BOARD_THEMES) as BoardThemeId[]).map((id) => {
            const { label, palette } = BOARD_THEMES[id];
            const active = id === boardThemeId;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                title={label}
                aria-label={`${label} board`}
                onClick={() => onThemeChange(id)}
                className={`grid h-5 w-5 grid-cols-2 overflow-hidden rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
                  active
                    ? "scale-110 ring-2 ring-amber-300 ring-offset-1 ring-offset-slate-950"
                    : "opacity-70 hover:scale-110 hover:opacity-100"
                }`}
              >
                <span style={{ background: palette.light }} />
                <span style={{ background: palette.dark }} />
                <span style={{ background: palette.dark }} />
                <span style={{ background: palette.light }} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative flex-shrink-0 rounded-[10px] bg-gradient-to-br from-[#6b4423] via-[#3d2412] to-[#24140a] p-[6px] shadow-[0_18px_50px_rgba(0,0,0,0.75),0_0_0_1px_rgba(231,192,99,0.35),inset_0_1px_0_rgba(255,255,255,0.12)]">
        <div
          className="relative flex-shrink-0 rounded-[3px] ring-1 ring-[#e7c063]/40"
          style={{ width: w, height: h }}
        >
          {children}
          {overlays}
        </div>
      </div>
    </section>
  );
}
