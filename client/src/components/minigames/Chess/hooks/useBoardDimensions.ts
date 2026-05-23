import { useCallback, useLayoutEffect, useState, type RefObject } from "react";
import { CHESS_LAYOUT } from "../chessTheme";

const MIN_SQ = 28;
const MAX_SQ = 80;

/**
 * Board pixel size from viewport + stage width — never shrinks when shop opens.
 */
export function useBoardDimensions(
  boardSize: number,
  stageRef: RefObject<HTMLElement | null>,
) {
  const [boardPx, setBoardPx] = useState(() => boardSize * 40);

  const recalc = useCallback(() => {
    const sqCount = boardSize;
    const chrome =
      CHESS_LAYOUT.playerBarHeight * 2 +
      CHESS_LAYOUT.eventBannerHeight +
      CHESS_LAYOUT.themeRowHeight +
      CHESS_LAYOUT.stagePadding;
    const availH = window.innerHeight - chrome;
    const stageW = stageRef.current?.clientWidth ?? window.innerWidth;
    const availW = Math.max(200, stageW - 32);
    const raw = Math.floor(Math.min(availW, availH) / sqCount) * sqCount;
    const clamped = Math.max(
      sqCount * MIN_SQ,
      Math.min(raw || sqCount * 40, sqCount * MAX_SQ),
    );
    setBoardPx(clamped);
  }, [boardSize, stageRef]);

  useLayoutEffect(() => {
    recalc();
    window.addEventListener("resize", recalc);
    const el = stageRef.current;
    const ro = el
      ? new ResizeObserver(() => recalc())
      : null;
    if (el && ro) ro.observe(el);
    return () => {
      window.removeEventListener("resize", recalc);
      ro?.disconnect();
    };
  }, [recalc, stageRef]);

  return {
    boardPx,
    sqSize: boardPx / boardSize,
    stageMinHeight: boardPx + CHESS_LAYOUT.themeRowHeight + CHESS_LAYOUT.eventBannerHeight + 16,
  };
}
