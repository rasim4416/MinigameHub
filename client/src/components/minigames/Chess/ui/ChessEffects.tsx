import { useEffect, useMemo, useRef, useState } from "react";
import type { Augment } from "../augments";
import type { AugmentUpgradeLevels } from "../augments";
import type { Board, ChessState, Color } from "../engine";
import { useChessLanguage } from "../ChessLanguageContext";
import { getAugmentName } from "../../../../locales/chess";
import {
  diffChessBoard,
  type ChessBoardChange,
  type ChessBoardChangeKind,
} from "./chess-effects-diff";
import "./chess-effects.css";

type FrozenSquare = [number, number] | { row: number; col: number };
type MovePulse = { move: NonNullable<ChessState["lastMove"]>; key: number };
type NoticeTone = "gold" | ChessBoardChangeKind;

export { diffChessBoard };
export type { ChessBoardChange, ChessBoardChangeKind };

function squareOf(square: FrozenSquare): [number, number] {
  return Array.isArray(square) ? square : [square.row, square.col];
}

/** Non-interactive board VFX. Mount inside BoardStage's `overlays` at the board's exact size. */
export function ChessEffects({
  board,
  turn,
  lastMove,
  frozenSquares,
  whiteAugments,
  blackAugments,
  flipped = false,
  whiteAugmentLevels,
  blackAugmentLevels,
}: {
  board: Board;
  turn: Color;
  lastMove: ChessState["lastMove"];
  frozenSquares: FrozenSquare[] | FrozenSquare | null | undefined;
  whiteAugments: Augment[];
  blackAugments: Augment[];
  /** Set true when the board is rendered from Black's perspective. */
  flipped?: boolean;
  /** Optional enhancement: lets the overlay announce a specific upgraded augment. */
  whiteAugmentLevels?: AugmentUpgradeLevels;
  blackAugmentLevels?: AugmentUpgradeLevels;
}) {
  const [movePulse, setMovePulse] = useState<MovePulse | null>(null);
  const [notices, setNotices] = useState<{ id: number; label: string; tone: NoticeTone; square?: [number, number] }[]>([]);
  const previousAugmentCounts = useRef({ white: whiteAugments.length, black: blackAugments.length });
  const previousLevels = useRef({ white: whiteAugmentLevels ?? {}, black: blackAugmentLevels ?? {} });
  const previousBoard = useRef<Board | null>(null);
  const noticeId = useRef(0);
  const pulseId = useRef(0);
  const noticeTimers = useRef(new Set<number>());
  const pulseTimer = useRef<number | null>(null);
  const language = useChessLanguage();
  const tr = language === "türkçe";
  const moveKey = lastMove
    ? [
        lastMove.from.join(","),
        lastMove.to.join(","),
        lastMove.pieceId ?? lastMove.piece.id ?? "",
        lastMove.piece.type,
        lastMove.piece.color,
        lastMove.capturedPieceId ?? "",
        lastMove.promotion ?? "",
        lastMove.castling ?? "",
        lastMove.enPassant ? "ep" : "",
      ].join("|")
    : "";
  const previousMove = useRef<string | null>(null);
  const moveEffectInitialized = useRef(false);
  const rows = board.length || 8;
  const cols = board[0]?.length || rows;

  useEffect(() => {
    const before = previousBoard.current;
    const boardExpanded =
      !!before &&
      (before.length !== board.length || (before[0]?.length ?? 0) !== (board[0]?.length ?? 0));

    /*
     * Establish the initial key without animating a restored/in-progress game.
     * A later key change is an actual move, including the first move after mount.
     */
    if (!moveEffectInitialized.current) {
      moveEffectInitialized.current = true;
      previousMove.current = moveKey;
      return;
    }

    if (moveKey !== previousMove.current) {
      previousMove.current = moveKey;
      if (pulseTimer.current !== null) {
        window.clearTimeout(pulseTimer.current);
        pulseTimer.current = null;
      }
      if (moveKey && lastMove && !boardExpanded) {
        const key = ++pulseId.current;
        setMovePulse({ move: lastMove, key });
        pulseTimer.current = window.setTimeout(() => {
          setMovePulse((current) => (current?.key === key ? null : current));
          pulseTimer.current = null;
        }, 900);
      } else {
        setMovePulse(null);
      }
    }
  }, [board, lastMove, moveKey]);

  const notify = (label: string, tone: NoticeTone, square?: [number, number]) => {
    const id = ++noticeId.current;
    setNotices((current) => [...current, { id, label, tone, square }].slice(-3));
    const timer = window.setTimeout(() => {
      noticeTimers.current.delete(timer);
      setNotices((current) => current.filter((notice) => notice.id !== id));
    }, 1350);
    noticeTimers.current.add(timer);
  };

  useEffect(() => () => {
    if (pulseTimer.current !== null) window.clearTimeout(pulseTimer.current);
    for (const timer of noticeTimers.current) window.clearTimeout(timer);
    noticeTimers.current.clear();
  }, []);

  useEffect(() => {
    const prior = previousAugmentCounts.current;
    if (whiteAugments.length > prior.white) {
      const augment = whiteAugments[whiteAugments.length - 1];
      notify(`${tr ? "BEYAZ" : "WHITE"} · ${getAugmentName(augment.id, language)}`, "gold");
    }
    if (blackAugments.length > prior.black) {
      const augment = blackAugments[blackAugments.length - 1];
      notify(`${tr ? "SİYAH" : "BLACK"} · ${getAugmentName(augment.id, language)}`, "gold");
    }
    previousAugmentCounts.current = { white: whiteAugments.length, black: blackAugments.length };
  }, [blackAugments, language, tr, whiteAugments]);

  useEffect(() => {
    const announceImprovement = (current: AugmentUpgradeLevels | undefined, before: AugmentUpgradeLevels, augments: Augment[], owner: string) => {
      for (const [id, level] of Object.entries(current ?? {})) if ((level ?? 0) > (before[id] ?? 0)) {
        const owned = augments.find((augment) => augment.id === id);
        notify(`${owner} · ${getAugmentName(id, language)} ${tr ? "GELİŞTİRİLDİ" : "IMPROVED"}`, "promote");
        if (!owned) break;
      }
    };
    announceImprovement(whiteAugmentLevels, previousLevels.current.white, whiteAugments, tr ? "BEYAZ" : "WHITE");
    announceImprovement(blackAugmentLevels, previousLevels.current.black, blackAugments, tr ? "SİYAH" : "BLACK");
    previousLevels.current = { white: whiteAugmentLevels ?? {}, black: blackAugmentLevels ?? {} };
  }, [blackAugmentLevels, blackAugments, language, tr, whiteAugmentLevels, whiteAugments]);

  useEffect(() => {
    const before = previousBoard.current;
    const snapshot = board.map((row) => [...row]);
    if (!before) { previousBoard.current = snapshot; return; }
    const changes = diffChessBoard(before, board, lastMove);
    changes.slice(0, 2).forEach((change) => notify(
      change.kind === "revive" ? (tr ? "DİRİLTİLDİ" : "REVIVED") :
      change.kind === "convert" ? (tr ? "SAF DEĞİŞTİRDİ" : "CONVERTED") :
      change.kind === "promote" ? (tr ? "TERFİ" : "PROMOTION") : (tr ? "KALDIRILDI" : "REMOVED"),
      change.kind, change.square,
    ));
    previousBoard.current = snapshot;
  }, [board, lastMove, tr]);

  const frozen = useMemo(() => {
    const all: FrozenSquare[] = frozenSquares == null ? [] : !Array.isArray(frozenSquares) ? [frozenSquares] : typeof frozenSquares[0] === "number" ? [frozenSquares as FrozenSquare] : frozenSquares as FrozenSquare[];
    return all.map(squareOf);
  }, [frozenSquares]);

  const viewSquare = ([row, col]: [number, number]): [number, number] =>
    flipped ? [rows - 1 - row, cols - 1 - col] : [row, col];
  const point = (square: [number, number]) => {
    const [row, col] = viewSquare(square);
    return { left: `${((col + .5) / cols) * 100}%`, top: `${((row + .5) / rows) * 100}%` };
  };
  const pulseMove = movePulse?.move;
  const from = pulseMove ? viewSquare(pulseMove.from) : [0, 0];
  const to = pulseMove ? viewSquare(pulseMove.to) : [0, 0];
  const dx = pulseMove ? (to[1] - from[1]) * (100 / cols) : 0;
  /*
   * Trail width is measured against the overlay width, not its height. Board
   * cells are square, so convert the vertical percentage into width units.
   */
  const dy = pulseMove
    ? (to[0] - from[0]) * (100 / rows) * (rows / cols)
    : 0;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return (
    <div className="chess-effects" style={{ "--board-cols": cols, "--board-rows": rows } as React.CSSProperties} aria-hidden="true">
      {frozen.map((square) => {
        const [row, col] = viewSquare(square);
        return <span key={`${square[0]}-${square[1]}`} className="chess-effects__freeze" style={{ left: `${(col / cols) * 100}%`, top: `${(row / rows) * 100}%` }} />;
      })}
      {movePulse && <>
        <span key={`trail-${movePulse.key}`} className="chess-effects__trail" style={{ ...point(movePulse.move.from), width: `${length}%`, transform: `rotate(${angle}deg)` }} />
        <span key={`burst-${movePulse.key}`} className="chess-effects__burst" style={point(movePulse.move.to)} />
        {movePulse.move.promotion && <span key={`promotion-${movePulse.key}`} className="chess-effects__promotion" />}
      </>}
      {notices.map((notice) => <span key={notice.id} className={`chess-effects__gain chess-effects__gain--${notice.tone}`} style={notice.square ? point(notice.square) : undefined}>{notice.label}</span>)}
    </div>
  );
}