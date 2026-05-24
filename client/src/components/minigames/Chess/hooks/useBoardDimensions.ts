import { useCallback, useLayoutEffect, useState, type RefObject } from "react";
import { CHESS_LAYOUT } from "../chessTheme";

const MIN_SQ = 28;
const MAX_SQ = 80;

/**
 * Board pixel size from viewport + stage width — never shrinks when shop opens.
 * Pass boardCols for rectangular boards (e.g. 16×8).
 */
export function useBoardDimensions(
  boardRows: number,
  stageRef: RefObject<HTMLElement | null>,
  boardCols: number = boardRows,
) {
  const [dims, setDims] = useState(() => ({
    boardPxW: boardCols * 40,
    boardPxH: boardRows * 40,
    sqSize: 40,
  }));

  const recalc = useCallback(() => {
    const rows = boardRows;
    const cols = boardCols;
    const chrome =
      CHESS_LAYOUT.playerBarHeight * 2 +
      CHESS_LAYOUT.eventBannerHeight +
      CHESS_LAYOUT.themeRowHeight +
      CHESS_LAYOUT.stagePadding;
    const availH = window.innerHeight - chrome;
    const stageW = stageRef.current?.clientWidth ?? window.innerWidth;
    const availW = Math.max(200, stageW - 32);
    const sqFromW = availW / cols;
    const sqFromH = availH / rows;
    let sq = Math.floor(Math.min(sqFromW, sqFromH));
    sq = Math.max(MIN_SQ, Math.min(sq, MAX_SQ));
    const boardPxW = sq * cols;
    const boardPxH = sq * rows;
    setDims({ boardPxW, boardPxH, sqSize: sq });
  }, [boardRows, boardCols, stageRef]);

  useLayoutEffect(() => {
    recalc();
    window.addEventListener("resize", recalc);
    const el = stageRef.current;
    const ro = el ? new ResizeObserver(() => recalc()) : null;
    if (el && ro) ro.observe(el);
    return () => {
      window.removeEventListener("resize", recalc);
      ro?.disconnect();
    };
  }, [recalc, stageRef]);

  return {
    boardPxW: dims.boardPxW,
    boardPxH: dims.boardPxH,
    /** @deprecated square boards only — use boardPxW/boardPxH */
    boardPx: Math.max(dims.boardPxW, dims.boardPxH),
    sqSize: dims.sqSize,
    stageMinHeight:
      dims.boardPxH +
      CHESS_LAYOUT.themeRowHeight +
      CHESS_LAYOUT.eventBannerHeight +
      16,
  };
}
