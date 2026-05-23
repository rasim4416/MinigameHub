import type { ReactNode } from "react";
import {
  BOARD_THEMES,
  type BoardThemeId,
} from "../boardThemes";
import { chessShell } from "../chessTheme";

export function BoardStage({
  boardPx,
  stageMinHeight,
  boardThemeId,
  onThemeChange,
  showEventBanner,
  eventBanner,
  children,
  overlays,
}: {
  boardPx: number;
  stageMinHeight: number;
  boardThemeId: BoardThemeId;
  onThemeChange: (id: BoardThemeId) => void;
  showEventBanner: boolean;
  eventBanner: ReactNode;
  children: ReactNode;
  overlays?: ReactNode;
}) {
  return (
    <section
      className="relative flex w-full flex-shrink-0 flex-col items-center justify-center px-4 py-3"
      style={{ minHeight: stageMinHeight }}
    >
      {showEventBanner && (
        <div className="pointer-events-none absolute left-0 right-0 top-2 z-[4] flex justify-center">
          {eventBanner}
        </div>
      )}

      <div className="mb-3 flex flex-shrink-0 items-center gap-2">
        <span className={chessShell.label}>Board</span>
        <select
          value={boardThemeId}
          onChange={(e) => onThemeChange(e.target.value as BoardThemeId)}
          className="cursor-pointer rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {(Object.keys(BOARD_THEMES) as BoardThemeId[]).map((id) => (
            <option key={id} value={id}>
              {BOARD_THEMES[id].label}
            </option>
          ))}
        </select>
      </div>

      <div
        className="relative flex-shrink-0"
        style={{ width: boardPx, height: boardPx }}
      >
        {children}
        {overlays}
      </div>
    </section>
  );
}
