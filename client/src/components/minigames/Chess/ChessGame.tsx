import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChessState,
  PieceType,
  Color,
  Board,
  PIECE_UNICODE,
  PIECE_VALUE,
  createInitialState,
  getLegalMoves,
  makeMove,
  materialAdvantage,
  opp,
  cloneBoard,
  findKing,
  isInCheck,
  hasAnyLegalMove,
  setBoardSize,
  getDerivedBoard,
  syncStateFromBoard,
  normalizeChessState,
  castlingRightsAfterSwap,
} from "./engine";
import {
  applyLostMercenaryAfterFullMove,
  applyMercenaryPatrolAfterFullMove,
  isMercenaryPiece,
  isLostMercenaryPawn,
  spawnLostMercenaryOnBoard,
  spawnMercenaryPatrolKnights,
} from "./mercenaryMoves";
import {
  Augment,
  AUGMENT_POOL,
  rollAugments,
  RARITY_META,
  RarityWeights,
  getWeightsForPlayer,
  BASE_COST,
  getShopCost,
  MAX_STACK,
  NON_PURCHASABLE,
  pickAugmentCount,
} from "./augments";
import {
  GameEvent,
  EVENT_RARITY_META,
  rollEvent,
  rollFullRoundsUntilNextEvent,
} from "./events";

/** Augments the player already holds at their max stack count — exclude from future rolls. */
function getExcludeForPlayer(augments: Augment[]): string[] {
  const counts: Record<string, number> = {};
  for (const a of augments) counts[a.id] = (counts[a.id] || 0) + 1;
  return Object.keys(counts).filter((id) => counts[id] >= (MAX_STACK[id] ?? 1));
}

/** Empty original pawn rank square for Pawn Shop / spawn rules (8×8 or 10×10). */
function isOriginalPawnSpawnSquare(
  r: number,
  c: number,
  color: "white" | "black",
  boardSize: number,
): boolean {
  const off = (boardSize - 8) / 2;
  const pawnRow = color === "white" ? 6 + off : 1 + off;
  if (r !== pawnRow) return false;
  return c >= off && c < off + 8;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type GamePhase = "start" | "white-augment" | "black-augment" | "playing";
type Milestones = { knight: boolean; bishop: boolean; rook: boolean };
type AugmentTrigger = {
  color: Color;
  reason: "milestone" | "bloodlust" | "blind-rage";
  milestoneType?: PieceType;
};
type TierBought = {
  common: number;
  uncommon: number;
  rare: number;
  epic: number;
  legendary: number;
};
type DeathNoteTarget = {
  pieceId: string;
  turnsLeft: number;
  targetColor: Color;
};

type AugmentSnapshot = {
  frozenSquare: [number, number] | null;
  frozenExpireAfter: Color | null;
  deathNoteTargets: DeathNoteTarget[];
  activePuppetSquare: [number, number] | null;
  activePuppetColor: Color | null;
  whiteContractTarget: [number, number] | null;
  blackContractTarget: [number, number] | null;
  whiteContractPieceId: string | null;
  blackContractPieceId: string | null;
  whiteIlkkanId: string | null;
  blackIlkkanId: string | null;
  blessedSquares: { row: number; col: number; movesLeft: number }[];
  coldWindsSquares: [number, number][];
  coldWindsMovesLeft: number;
  wallSquares: { row: number; col: number }[];
  wallMovesLeft: number;
  activeNuke: { topRow: number; leftCol: number; movesLeft: number } | null;
  peaceTreatyMovesLeft: number;
  whiteLostPawnCols: number[];
  blackLostPawnCols: number[];
  whiteCaptureCount: number;
  blackCaptureCount: number;
  whiteBloodlustNext: number;
  blackBloodlustNext: number;
  whiteLostMinors: PieceType[];
  blackLostMinors: PieceType[];
  nextEventTurn: number;
  chaosEventTiming: boolean;
  whitePrizeFirstCaptureDone: boolean;
  blackPrizeFirstCaptureDone: boolean;
  whiteBlindRageDone: boolean;
  blackBlindRageDone: boolean;
  whiteEvadeCharges: number;
  blackEvadeCharges: number;
  augmentSpellBlockedFor: Color | null;
  whitePawnShopBuys: number;
  blackPawnShopBuys: number;
};

const EMPTY_MILESTONES: Milestones = {
  knight: false,
  bishop: false,
  rook: false,
};
const EMPTY_TIER: TierBought = {
  common: 0,
  uncommon: 0,
  rare: 0,
  epic: 0,
  legendary: 0,
};
function getCenterSquares(bs: number): Set<string> {
  const mid = Math.floor(bs / 2);
  return new Set([
    `${mid},${mid - 1}`,
    `${mid - 1},${mid - 1}`,
    `${mid},${mid}`,
    `${mid - 1},${mid}`,
  ]);
}
const KNIGHT_OFFSETS: [number, number][] = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];

function findSquareByPieceId(
  board: Board,
  pieceId: string,
): [number, number] | null {
  for (let r = 0; r < board.length; r++)
    for (let c = 0; c < board[r].length; c++)
      if (board[r][c]?.id === pieceId) return [r, c];
  return null;
}

function normalizeDeathNoteTargets(raw: unknown): DeathNoteTarget[] {
  if (!Array.isArray(raw)) return [];
  const out: DeathNoteTarget[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const o = t as Record<string, unknown>;
    if (
      typeof o.pieceId === "string" &&
      typeof o.turnsLeft === "number" &&
      (o.targetColor === "white" || o.targetColor === "black")
    )
      out.push({
        pieceId: o.pieceId,
        turnsLeft: o.turnsLeft,
        targetColor: o.targetColor as Color,
      });
  }
  return out;
}

function checkNewMilestone(
  t: PieceType | null,
  ms: Milestones,
): PieceType | null {
  if (!t) return null;
  if (t === "N" && !ms.knight) return "N";
  if (t === "B" && !ms.bishop) return "B";
  if (t === "R" && !ms.rook) return "R";
  return null;
}
function applyMilestone(t: PieceType, ms: Milestones): Milestones {
  return {
    knight: t === "N" || ms.knight,
    bishop: t === "B" || ms.bishop,
    rook: t === "R" || ms.rook,
  };
}

// ─── Engine helpers ───────────────────────────────────────────────────────────

function findCheckingPiece(
  board: Board,
  kingColor: Color,
): [number, number] | null {
  if (kingColor === "orange") return null;
  const [kr, kc] = findKing(board, kingColor);
  if (kr === -1) return null;
  const bs = board.length;
  for (let r = 0; r < bs; r++)
    for (let c = 0; c < bs; c++) {
      const p = board[r][c];
      if (!p) continue;
      const isEnemy = p.color === opp(kingColor);
      const isOrangeMerc =
        p.color === "orange" &&
        typeof p.id === "string" &&
        p.id.includes("mercenary");
      if (isEnemy || isOrangeMerc) {
        const test = cloneBoard(board);
        test[r][c] = null;
        if (!isInCheck(test, kingColor)) return [r, c];
      }
    }
  return null;
}
function recomputeStatus(g: ChessState): ChessState {
  const [wkr] = findKing(g, "white");
  const [bkr] = findKing(g, "black");
  if (wkr === -1) return { ...g, status: "checkmate", turn: "black" };
  if (bkr === -1) return { ...g, status: "checkmate", turn: "white" };
  const nextTurn = g.turn;
  const nextHasMove = hasAnyLegalMove(g, nextTurn);
  let status = g.status;
  if (!nextHasMove)
    status = isInCheck(g, nextTurn) ? "checkmate" : "stalemate";
  else if (isInCheck(g, nextTurn)) status = "check";
  else status = "playing";
  return { ...g, status };
}

function applyEndOfTurnEffects(
  g: ChessState,
  color: Color,
  augments: Augment[],
  turn: number,
): ChessState {
  let delta = 0;
  for (const aug of augments) {
    if (aug.id === "miner" && turn % 3 === 0) delta += 2;
    if (aug.id === "king-of-the-hill") {
      const cs = Array.from(getCenterSquares(getDerivedBoard(g).length));
      for (const key of cs) {
        const [r, c] = key.split(",").map(Number);
        if (getDerivedBoard(g)[r][c]?.color === color) delta += 1;
      }
    }
  }
  const curGold = color === "white" ? g.goldWhite : g.goldBlack;
  const afterPassive = curGold + delta;
  let invExtra = 0;
  for (const _ of augments.filter((a) => a.id === "investment")) {
    if (afterPassive + invExtra > 20) invExtra += 1;
  }
  delta += invExtra;
  if (!delta) return g;
  return {
    ...g,
    goldWhite: color === "white" ? g.goldWhite + delta : g.goldWhite,
    goldBlack: color === "black" ? g.goldBlack + delta : g.goldBlack,
  };
}

function getAlternativeMoves(
  game: ChessState,
  r: number,
  c: number,
): [number, number][] {
  const piece = getDerivedBoard(game)[r][c];
  const bs = getDerivedBoard(game).length;
  const off = (bs - 8) / 2;
  if (!piece || piece.type !== "P" || (c !== 0 && c !== bs - 1)) return [];
  if (piece.color === "white") {
    const sr = 6 + off;
    if (r !== sr) return [];
    if (getDerivedBoard(game)[sr - 1][c] || getDerivedBoard(game)[sr - 2][c] || getDerivedBoard(game)[sr - 3][c])
      return [];
    return [[sr - 3, c]];
  } else {
    const sr = 1 + off;
    if (r !== sr) return [];
    if (getDerivedBoard(game)[sr + 1][c] || getDerivedBoard(game)[sr + 2][c] || getDerivedBoard(game)[sr + 3][c])
      return [];
    return [[sr + 3, c]];
  }
}

function getRoyalEdMoves(
  game: ChessState,
  color: Color,
): { kingPos: [number, number]; dests: [number, number][] } {
  const [kr, kc] = findKing(game, color);
  if (kr === -1) return { kingPos: [-1, -1], dests: [] };
  const dests: [number, number][] = [];
  const bs = getDerivedBoard(game).length;
  for (const [dr, dc] of KNIGHT_OFFSETS) {
    const nr = kr + dr,
      nc = kc + dc;
    if (nr < 0 || nr >= bs || nc < 0 || nc >= bs) continue;
    const db = getDerivedBoard(game);
    if (db[nr][nc]?.color === color) continue;
    const test = cloneBoard(db);
    const k = db[kr][kc];
    test[kr][kc] = null;
    test[nr][nc] = k ? { ...k } : { type: "K", color };
    if (!isInCheck(test, color)) dests.push([nr, nc]);
  }
  return { kingPos: [kr, kc], dests };
}

// ─── Legendary ability helpers ────────────────────────────────────────────────

const RAMPAGE_DIRS: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

/** All unoccupied squares on the entire board the piece can safely teleport to. */
function getSakoMoves(
  game: ChessState,
  from: [number, number],
  color: Color,
): [number, number][] {
  const piece = getDerivedBoard(game)[from[0]][from[1]];
  if (!piece) return [];
  const bs = getDerivedBoard(game).length;
  const result: [number, number][] = [];
  for (let r = 0; r < bs; r++)
    for (let c = 0; c < bs; c++) {
      if (getDerivedBoard(game)[r][c]) continue;
      if (r === from[0] && c === from[1]) continue;
      const nb = cloneBoard(getDerivedBoard(game));
      nb[from[0]][from[1]] = null;
      nb[r][c] = piece;
      if (!isInCheck(nb, color)) result.push([r, c]);
    }
  return result;
}

/** Destinations the king can rampage to (straight line, UP TO 4 sq, all pieces cleared up to dest). */
function getRoyalHouseholdDests(
  game: ChessState,
  color: Color,
): [number, number][] {
  const [kr, kc] = findKing(game, color);
  if (kr === -1) return [];
  const bs = getDerivedBoard(game).length;
  const dests: [number, number][] = [];
  for (const [dr, dc] of RAMPAGE_DIRS) {
    for (let s = 1; s <= 4; s++) {
      const nr = kr + dr * s,
        nc = kc + dc * s;
      if (nr < 0 || nr >= bs || nc < 0 || nc >= bs) break;
      const nb = cloneBoard(getDerivedBoard(game));
      nb[kr][kc] = null;
      for (let t = 1; t <= s; t++) nb[kr + dr * t][kc + dc * t] = null;
      const k = getDerivedBoard(game)[kr][kc];
      nb[nr][nc] = k ? { ...k } : { type: "K", color };
      if (!isInCheck(nb, color)) dests.push([nr, nc]);
    }
  }
  return dests;
}

// ─── Board expansion helpers ──────────────────────────────────────────────────

function expandGameBoard(g: ChessState): ChessState {
  const newBoard: Board = Array(10)
    .fill(null)
    .map(() => Array(10).fill(null));
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) newBoard[r + 1][c + 1] = getDerivedBoard(g)[r][c];
  return syncStateFromBoard(
    {
      ...g,
      castlingRights: {
        white: { kingside: false, queenside: false },
        black: { kingside: false, queenside: false },
      },
      enPassantTarget: g.enPassantTarget
        ? ([g.enPassantTarget[0] + 1, g.enPassantTarget[1] + 1] as [
            number,
            number,
          ])
        : null,
      lastMove: g.lastMove
        ? {
            ...g.lastMove,
            from: [g.lastMove.from[0] + 1, g.lastMove.from[1] + 1] as [
              number,
              number,
            ],
            to: [g.lastMove.to[0] + 1, g.lastMove.to[1] + 1] as [number, number],
          }
        : null,
    },
    newBoard,
  );
}

function getFileChar(col: number, boardSize: number): string {
  if (boardSize === 8) return String.fromCharCode(97 + col);
  if (col === 0) return "x";
  if (col === boardSize - 1) return "i";
  return String.fromCharCode(96 + col);
}

function getRankLabel(row: number, boardSize: number): string {
  return boardSize === 8 ? String(8 - row) : String(9 - row);
}

// ─── Board constants ──────────────────────────────────────────────────────────

const LIGHT_SQ = "#f0d9b5",
  DARK_SQ = "#b58863",
  SEL_LIGHT = "#f6f669",
  SEL_DARK = "#baca2b",
  LAST_LIGHT = "#cdd16f",
  LAST_DARK = "#aaa23a";

// ─── SquareEl ─────────────────────────────────────────────────────────────────

function SquareEl({
  row,
  col,
  size,
  piece,
  isSelected,
  isValidMove,
  isLastMove,
  isCheckKing,
  isCenter,
  isFrozen,
  onClick,
  boardSize,
  deathNoteCount,
  isNuke,
  nukeMovesLeft,
  isBlessed,
  isColdWind,
  contractMark,
  isWall,
  isPuppet,
  isIlkkan,
  viewFlipped,
}: {
  row: number;
  col: number;
  /** When true (black in online MP), rank/file labels sit on the rotated edges. */
  viewFlipped?: boolean;
  size: number;
  piece: { type: PieceType; color: Color } | null;
  isSelected: boolean;
  isValidMove: boolean;
  isLastMove: boolean;
  isCheckKing: boolean;
  isCenter: boolean;
  isFrozen: boolean;
  onClick: () => void;
  boardSize: number;
  deathNoteCount?: number;
  isNuke?: boolean;
  nukeMovesLeft?: number;
  isBlessed?: boolean;
  isColdWind?: boolean;
  contractMark?: boolean;
  isWall?: boolean;
  isPuppet?: boolean;
  isIlkkan?: boolean;
}) {
  const vf = !!viewFlipped;
  const light = (row + col) % 2 === 0;
  let bg = light ? LIGHT_SQ : DARK_SQ;
  if (isCheckKing) bg = "#c82020";
  else if (isSelected) bg = light ? SEL_LIGHT : SEL_DARK;
  else if (isLastMove) bg = light ? LAST_LIGHT : LAST_DARK;
  const dot = size * 0.3,
    ring = size * 0.07;
  const isMonolith = piece?.type === "M";
  const orangeMercenaryImg =
    piece &&
    piece.color === "orange" &&
    (piece.type === "P" || piece.type === "N")
      ? piece.type === "P"
        ? "/chess-orange-mercenary-pawn.svg"
        : "/chess-orange-mercenary-knight.svg"
      : null;
  return (
    <div
      onClick={onClick}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "background-color 0.1s",
        overflow: "hidden",
      }}
    >
      {(vf ? col === boardSize - 1 : col === 0) && (
        <span
          style={{
            position: "absolute",
            top: 2,
            ...(vf ? { right: 3 } : { left: 3 }),
            fontSize: Math.max(9, size * 0.18),
            fontWeight: 700,
            color: light ? DARK_SQ : LIGHT_SQ,
            userSelect: "none",
            lineHeight: 1,
          }}
        >
          {getRankLabel(row, boardSize)}
        </span>
      )}
      {(vf ? row === 0 : row === boardSize - 1) && (
        <span
          style={{
            position: "absolute",
            ...(vf ? { top: 2 } : { bottom: 2 }),
            right: 3,
            fontSize: Math.max(9, size * 0.18),
            fontWeight: 700,
            color: light ? DARK_SQ : LIGHT_SQ,
            userSelect: "none",
            lineHeight: 1,
          }}
        >
          {getFileChar(col, boardSize)}
        </span>
      )}
      {isCenter && (
        <div
          style={{
            position: "absolute",
            top: 3,
            right: 3,
            width: 5,
            height: 5,
            background: "rgba(234,179,8,0.6)",
            borderRadius: "50%",
            pointerEvents: "none",
            boxShadow: "0 0 3px rgba(234,179,8,0.8)",
          }}
        />
      )}
      {isFrozen && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(147,210,255,0.28)",
            border: "2px solid rgba(147,210,255,0.7)",
            boxShadow: "inset 0 0 8px rgba(147,210,255,0.5)",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
      )}
      {isNuke && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(34,197,94,0.30)",
            border: "2px solid rgba(34,197,94,0.85)",
            pointerEvents: "none",
            zIndex: 2,
            boxShadow: "inset 0 0 6px rgba(34,197,94,0.6)",
          }}
        />
      )}
      {isNuke &&
        nukeMovesLeft !== undefined &&
        row === Math.floor(row) &&
        col === Math.floor(col) && (
          <div
            style={{
              position: "absolute",
              bottom: 2,
              left: 2,
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "#16a34a",
              border: "1px solid #4ade80",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 4,
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                fontSize: 8,
                fontWeight: 900,
                color: "white",
                lineHeight: 1,
              }}
            >
              {nukeMovesLeft}
            </span>
          </div>
        )}
      {isBlessed && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(250,204,21,0.20)",
            border: "2px solid rgba(250,204,21,0.80)",
            pointerEvents: "none",
            zIndex: 2,
            boxShadow: "inset 0 0 8px rgba(250,204,21,0.45)",
          }}
        />
      )}
      {isColdWind && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(147,210,255,0.22)",
            border: "2px solid rgba(147,210,255,0.80)",
            pointerEvents: "none",
            zIndex: 2,
            boxShadow: "inset 0 0 8px rgba(147,210,255,0.45)",
          }}
        />
      )}
      {contractMark && (
        <div
          style={{
            position: "absolute",
            top: 1,
            right: 2,
            fontSize: 10,
            lineHeight: 1,
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          🎯
        </div>
      )}
      {isPuppet && (
        <div
          style={{
            position: "absolute",
            top: 1,
            left: 2,
            fontSize: 10,
            lineHeight: 1,
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          🪆
        </div>
      )}
      {isWall && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#3d2b1f",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 6,
            borderRadius: 1,
          }}
        >
          <span
            style={{
              fontSize: Math.max(10, size * 0.55),
              lineHeight: 1,
              userSelect: "none",
            }}
          >
            🧱
          </span>
        </div>
      )}
      {deathNoteCount !== undefined && (
        <div
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#dc2626",
            border: "1px solid #fca5a5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3,
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontSize: 8,
              fontWeight: 900,
              color: "white",
              lineHeight: 1,
            }}
          >
            {deathNoteCount}
          </span>
        </div>
      )}
      {isValidMove && !piece && (
        <div
          style={{
            width: dot,
            height: dot,
            borderRadius: "50%",
            backgroundColor: "rgba(0,0,0,0.22)",
            pointerEvents: "none",
          }}
        />
      )}
      {isValidMove && piece && !isMonolith && (
        <div
          style={{
            position: "absolute",
            inset: ring,
            borderRadius: "50%",
            border: `${Math.max(3, size * 0.07)}px solid rgba(0,0,0,0.28)`,
            pointerEvents: "none",
          }}
        />
      )}
      {isMonolith && (
        <div
          style={{
            width: size * 0.72,
            height: size * 0.72,
            background: "linear-gradient(145deg,#475569,#1e293b)",
            border: "2px solid #64748b",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow:
              "0 3px 10px rgba(0,0,0,0.7),inset 0 1px 0 rgba(255,255,255,0.1)",
            pointerEvents: "none",
            position: "relative",
            zIndex: 1,
          }}
        >
          <span
            style={{ fontSize: size * 0.38, lineHeight: 1, userSelect: "none" }}
          >
            🗿
          </span>
        </div>
      )}
      {piece &&
        !isMonolith &&
        (isIlkkan ? (
          <img
            src="/ilkkan.jpeg"
            alt="İlkkan"
            decoding="async"
            fetchPriority="high"
            style={{
              width: size * 0.78,
              height: size * 0.78,
              objectFit: "cover",
              borderRadius: "50%",
              pointerEvents: "none",
              position: "relative",
              zIndex: 1,
              boxShadow:
                piece.color === "white"
                  ? "0 0 0 2px #fff,0 0 6px #000"
                  : "0 0 0 2px #1a0f00,0 0 6px rgba(255,255,255,0.5)",
            }}
          />
        ) : orangeMercenaryImg ? (
          <img
            src={orangeMercenaryImg}
            alt=""
            decoding="async"
            style={{
              width: size * 0.78,
              height: size * 0.78,
              objectFit: "contain",
              pointerEvents: "none",
              position: "relative",
              zIndex: 1,
              filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.45))",
            }}
          />
        ) : (
          <span
            style={{
              fontSize: size * 0.72,
              lineHeight: 1,
              color: piece.color === "white" ? "#ffffff" : "#1a0f00",
              textShadow:
                piece.color === "white"
                  ? "0 0 3px #000,0 0 6px #000,1px 1px 0 #222"
                  : "0 0 3px rgba(255,255,255,0.7),1px 1px 0 rgba(255,255,255,0.5)",
              userSelect: "none",
              pointerEvents: "none",
              position: "relative",
              zIndex: 1,
            }}
          >
            {PIECE_UNICODE[piece.color][piece.type]}
          </span>
        ))}
    </div>
  );
}

// ─── EventAnnouncement ────────────────────────────────────────────────────────

function EventAnnouncement({
  event,
  peaceTreatyLeft,
  onClose,
}: {
  event: GameEvent;
  peaceTreatyLeft: number;
  onClose: () => void;
}) {
  const meta = EVENT_RARITY_META[event.rarity];
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 30,
      }}
    >
      <div
        style={{
          background: "#0f172a",
          border: `2px solid ${meta.border}`,
          borderRadius: 16,
          padding: "28px 36px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          boxShadow: `0 0 40px ${meta.glow}, 0 8px 40px rgba(0,0,0,0.8)`,
          minWidth: 300,
          maxWidth: 420,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: meta.text,
            background: meta.badge,
            padding: "3px 12px",
            borderRadius: 20,
            border: `1px solid ${meta.border}`,
          }}
        >
          ⚡ EVENT · {meta.label}
        </div>
        <div style={{ fontSize: 36, lineHeight: 1, marginTop: 4 }}>
          {event.icon}
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: "#f1f5f9",
            letterSpacing: "0.02em",
          }}
        >
          {event.name}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#94a3b8",
            lineHeight: 1.5,
            maxWidth: 300,
          }}
        >
          {event.description}
        </div>
        {event.id === "peace-treaty" && peaceTreatyLeft > 0 && (
          <div style={{ fontSize: 11, color: "#64748b", fontStyle: "italic" }}>
            ({peaceTreatyLeft} half-moves remaining)
          </div>
        )}
        {event.flavor && (
          <div
            style={{
              fontSize: 12,
              color: meta.text,
              fontStyle: "italic",
              marginTop: 2,
              opacity: 0.85,
            }}
          >
            {event.flavor}
          </div>
        )}
        <button
          onClick={onClose}
          style={{
            marginTop: 8,
            padding: "9px 32px",
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            background: `linear-gradient(135deg,${meta.border},${meta.text})`,
            color: "#0f172a",
            letterSpacing: "0.04em",
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ─── PromotionDialog ──────────────────────────────────────────────────────────

function PromotionDialog({
  color,
  onChoose,
}: {
  color: Color;
  onChoose: (t: PieceType) => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 50,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#1f2937",
          border: "1px solid #374151",
          borderRadius: 14,
          padding: "18px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
        }}
      >
        <p
          style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 14, margin: 0 }}
        >
          Promote Pawn
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          {(["Q", "R", "B", "N"] as PieceType[]).map((t) => (
            <button
              key={t}
              onClick={() => onChoose(t)}
              style={{
                width: 56,
                height: 56,
                borderRadius: 10,
                background: "#111827",
                border: "2px solid #4b5563",
                cursor: "pointer",
                fontSize: 32,
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: color === "white" ? "#ffffff" : "#1a0f00",
                textShadow:
                  color === "white"
                    ? "0 0 3px #000,0 0 6px #000"
                    : "0 0 3px rgba(255,255,255,0.7)",
                transition: "border-color 0.15s,background 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "#6366f1";
                (e.currentTarget as HTMLElement).style.background = "#1e1b4b";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "#4b5563";
                (e.currentTarget as HTMLElement).style.background = "#111827";
              }}
            >
              {PIECE_UNICODE[color][t]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── GoldBadge ────────────────────────────────────────────────────────────────

function GoldBadge({ gold, active }: { gold: number; active: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        background:
          gold > 0
            ? "linear-gradient(135deg,#1c1500,#2d2000)"
            : "rgba(255,255,255,0.04)",
        border: `1px solid ${gold > 0 ? "rgba(234,179,8,0.35)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 20,
        padding: "2px 8px 2px 5px",
        transition: "all 0.3s",
        boxShadow: gold > 0 && active ? "0 0 8px rgba(234,179,8,0.25)" : "none",
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          flexShrink: 0,
          background:
            "radial-gradient(ellipse at 35% 30%,#fde047,#eab308 55%,#a16207)",
          boxShadow:
            "inset 0 0 0 1.5px rgba(255,255,255,0.25),0 1px 3px rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: 8,
            fontWeight: 900,
            color: "#422006",
            lineHeight: 1,
          }}
        >
          G
        </span>
      </div>
      <span
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: gold > 0 ? "#facc15" : "#4b5563",
          lineHeight: 1,
          minWidth: 14,
          textAlign: "right",
        }}
      >
        {gold}
      </span>
    </div>
  );
}

// ─── AugmentIconChip ─────────────────────────────────────────────────────────

function AugmentIconChip({
  augment,
  stacked,
}: {
  augment: Augment;
  stacked?: boolean;
}) {
  const m = RARITY_META[augment.rarity];
  return (
    <div
      title={`${augment.name}${stacked ? " ★ (×2)" : ""} — ${augment.description}`}
      style={{
        position: "relative",
        width: 24,
        height: 24,
        flexShrink: 0,
        cursor: "default",
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          border: `1.5px solid ${m.border}`,
          background: "#0f172a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 5px ${m.glow}`,
        }}
      >
        <span style={{ fontSize: 10, lineHeight: 1 }}>{augment.icon}</span>
      </div>
      {stacked && (
        <div
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "linear-gradient(135deg,#eab308,#fde047)",
            border: "1px solid #422006",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 4px rgba(234,179,8,0.7)",
          }}
        >
          <span
            style={{
              fontSize: 7,
              fontWeight: 900,
              color: "#422006",
              lineHeight: 1,
            }}
          >
            ★
          </span>
        </div>
      )}
    </div>
  );
}

// ─── SpellButton ─────────────────────────────────────────────────────────────

function SpellButton({
  icon,
  label,
  active,
  onClick,
  title,
  count,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
  title?: string;
  count?: number;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 3,
        padding: "2px 7px",
        fontSize: 10,
        fontWeight: 800,
        borderRadius: 6,
        border: `1px solid ${active ? "#06b6d4" : hov ? "#374151" : "#1f2937"}`,
        background: active
          ? "rgba(6,182,212,0.15)"
          : hov
            ? "#111827"
            : "transparent",
        color: active ? "#22d3ee" : hov ? "#d1d5db" : "#6b7280",
        cursor: "pointer",
        transition: "all 0.15s",
        flexShrink: 0,
        letterSpacing: "0.04em",
        boxShadow: active ? "0 0 8px rgba(6,182,212,0.3)" : "none",
      }}
    >
      <span style={{ fontSize: 11 }}>{icon}</span>
      {label}
      {count !== undefined && count > 0 && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 900,
            background: "#06b6d4",
            color: "#030712",
            borderRadius: "50%",
            width: 14,
            height: 14,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function UndoButton({ onUndo }: { onUndo: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onUndo}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title="Use your Oops! undo"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        fontSize: 10,
        fontWeight: 800,
        borderRadius: 6,
        border: `1px solid ${hov ? "#6366f1" : "#374151"}`,
        background: hov ? "#1e1b4b" : "#111827",
        color: hov ? "#a5b4fc" : "#9ca3af",
        cursor: "pointer",
        transition: "all 0.15s",
        flexShrink: 0,
        letterSpacing: "0.04em",
      }}
    >
      <span style={{ fontSize: 11 }}>↩</span>UNDO
    </button>
  );
}

// ─── AugmentCard (pick overlay) ───────────────────────────────────────────────

function AugmentCard({
  augment,
  onSelect,
}: {
  augment: Augment;
  onSelect: () => void;
}) {
  const [hov, setHov] = useState(false);
  const m = RARITY_META[augment.rarity];
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 155,
        padding: "18px 14px 14px",
        borderRadius: 14,
        position: "relative",
        border: `2px solid ${hov ? m.border : "rgba(255,255,255,0.07)"}`,
        background: hov ? "#0b1120" : "#080e1a",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        boxShadow: hov
          ? `0 0 22px ${m.glow},0 4px 16px rgba(0,0,0,0.5)`
          : "0 2px 8px rgba(0,0,0,0.4)",
        transform: hov
          ? "translateY(-5px) scale(1.02)"
          : "translateY(0) scale(1)",
        transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
        userSelect: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 14,
          right: 14,
          height: 3,
          borderRadius: "0 0 3px 3px",
          background:
            m.shimmer ??
            `linear-gradient(90deg,transparent,${m.border},transparent)`,
          opacity: hov ? 1 : augment.rarity === "legendary" ? 0.8 : 0.4,
          transition: "opacity 0.2s",
        }}
      />
      <span
        style={{
          fontSize: 32,
          lineHeight: 1,
          filter: hov ? "drop-shadow(0 0 8px rgba(255,255,255,0.3))" : "none",
          transition: "filter 0.2s",
        }}
      >
        {augment.icon}
      </span>
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: "#f1f5f9",
            margin: "0 0 5px",
            letterSpacing: "0.01em",
          }}
        >
          {augment.name}
        </p>
        <p
          style={{
            fontSize: 10.5,
            color: "#64748b",
            margin: 0,
            lineHeight: 1.45,
          }}
        >
          {augment.description}
        </p>
      </div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          padding: "2px 10px",
          borderRadius: 20,
          background: m.badge,
          color: m.text,
          border: `1px solid ${m.border}`,
        }}
      >
        {m.label}
      </div>
    </div>
  );
}

// ─── Shop Panel ───────────────────────────────────────────────────────────────

function ShopPanel({
  playerColor,
  gold,
  tierBought,
  playerAugments,
  onBuy,
  onClose,
  pawnShopNextPrice,
  onBuyPawn,
  pawnPlacePending,
}: {
  playerColor: Color;
  gold: number;
  tierBought: TierBought;
  playerAugments: Augment[];
  onBuy: (aug: Augment) => void;
  onClose: () => void;
  pawnShopNextPrice: number | null;
  onBuyPawn: (() => void) | null;
  pawnPlacePending: boolean;
}) {
  const RARITY_ORDER: Array<Augment["rarity"]> = [
    "common",
    "uncommon",
    "rare",
    "epic",
    "legendary",
  ];
  const grouped = RARITY_ORDER.map((r) => ({
    rarity: r,
    augments: AUGMENT_POOL.filter(
      (a) => a.rarity === r && !NON_PURCHASABLE.has(a.id),
    ),
  })).filter((g) => g.augments.length > 0);

  return (
    <div
      style={{
        flexShrink: 0,
        borderTop: "2px solid #1e2d40",
        background: "#080e1a",
        display: "flex",
        flexDirection: "column",
        maxHeight: 220,
        minHeight: 160,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 14px",
          borderBottom: "1px solid #1f2937",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: "#e2e8f0",
              letterSpacing: "0.06em",
            }}
          >
            🏪 SHOP
          </span>
          <span
            style={{ fontSize: 11, color: "#4b5563", letterSpacing: "0.04em" }}
          >
            {playerColor.toUpperCase()}'S TURN
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <GoldBadge gold={gold} active={true} />
          <button
            onClick={onClose}
            style={{
              padding: "2px 8px",
              fontSize: 11,
              fontWeight: 800,
              borderRadius: 6,
              border: "1px solid #374151",
              background: "#111827",
              color: "#6b7280",
              cursor: "pointer",
              letterSpacing: "0.04em",
            }}
          >
            ✕ CLOSE
          </button>
        </div>
      </div>

      {/* Augment list */}
      <div
        style={{
          overflowY: "auto",
          flex: 1,
          padding: "6px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {grouped.map(({ rarity, augments }) => {
          const m = RARITY_META[rarity];
          const bought = tierBought[rarity];
          const nextCost = getShopCost(rarity, bought);
          return (
            <div key={rarity}>
              {/* Tier header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <div
                  style={{
                    height: 1,
                    flex: 1,
                    background: `linear-gradient(90deg,${m.border}66,transparent)`,
                  }}
                />
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: "0.16em",
                    color: m.text,
                    textTransform: "uppercase",
                    padding: "1px 8px",
                    borderRadius: 20,
                    background: m.badge,
                    border: `1px solid ${m.border}44`,
                  }}
                >
                  {m.label}
                </span>
                <span
                  style={{ fontSize: 9, color: "#374151", fontWeight: 600 }}
                >
                  next: {nextCost}g{bought > 0 ? ` (${bought} bought)` : ""}
                </span>
                <div
                  style={{
                    height: 1,
                    width: 20,
                    background: `linear-gradient(90deg,transparent,${m.border}66)`,
                  }}
                />
              </div>
              {/* Augment rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {augments.map((aug) => {
                  const cost = getShopCost(aug.rarity, bought);
                  const canAfford = gold >= cost;
                  const ownedCount = playerAugments.filter(
                    (a: Augment) => a.id === aug.id,
                  ).length;
                  const maxStack = MAX_STACK[aug.id] ?? 1;
                  const isMaxed = ownedCount >= maxStack;
                  return (
                    <ShopRow
                      key={aug.id}
                      augment={aug}
                      cost={cost}
                      canAfford={canAfford}
                      isMaxed={isMaxed}
                      onBuy={() => onBuy(aug)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
        {pawnShopNextPrice != null &&
          onBuyPawn &&
          playerAugments.some((a) => a.id === "pawn-shop") &&
          !pawnPlacePending && (
            <div style={{ padding: "8px 10px", borderTop: "1px solid #1f2937" }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  color: "#64748b",
                  marginBottom: 6,
                }}
              >
                PAWN SHOP
              </div>
              <ShopRow
                augment={{
                  id: "pawn-shop-buy",
                  name: "Buy pawn",
                  description: "Place on an empty original pawn square",
                  rarity: "rare",
                  icon: "♙",
                }}
                cost={pawnShopNextPrice}
                canAfford={gold >= pawnShopNextPrice}
                isMaxed={false}
                onBuy={onBuyPawn}
              />
            </div>
          )}
      </div>
    </div>
  );
}

function ShopRow({
  augment,
  cost,
  canAfford,
  isMaxed,
  onBuy,
}: {
  augment: Augment;
  cost: number;
  canAfford: boolean;
  isMaxed: boolean;
  onBuy: () => void;
}) {
  const [hov, setHov] = useState(false);
  const m = RARITY_META[augment.rarity];
  const canClick = canAfford && !isMaxed;
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 8px",
        borderRadius: 8,
        background: hov && !isMaxed ? "#0f1929" : "#0b111e",
        border: `1px solid ${hov && !isMaxed ? m.border + "66" : "#1f293766"}`,
        transition: "all 0.15s",
        cursor: "default",
        opacity: isMaxed ? 0.55 : 1,
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: "#0f172a",
          border: `1px solid ${m.border}44`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>{augment.icon}</span>
      </div>
      {/* Name + desc */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: m.text,
            lineHeight: 1.2,
            letterSpacing: "0.02em",
          }}
        >
          {augment.name}
          {isMaxed && (
            <span
              style={{
                marginLeft: 5,
                fontSize: 9,
                fontWeight: 700,
                color: "#eab308",
                letterSpacing: "0.1em",
              }}
            >
              MAX
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 9.5,
            color: "#475569",
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 260,
          }}
        >
          {augment.description}
        </div>
      </div>
      {/* Cost */}
      {!isMaxed && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 900,
              color: canAfford ? "#facc15" : "#4b5563",
              lineHeight: 1,
            }}
          >
            {cost}
          </span>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse at 35% 30%,#fde047,#eab308 55%,#a16207)",
              flexShrink: 0,
            }}
          />
        </div>
      )}
      {/* Buy button */}
      <button
        onClick={canClick ? onBuy : undefined}
        disabled={!canClick}
        style={{
          padding: "3px 10px",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.06em",
          borderRadius: 6,
          border: "none",
          cursor: canClick ? "pointer" : "not-allowed",
          background: isMaxed
            ? "#1c1500"
            : canClick
              ? hov
                ? "linear-gradient(135deg,#166534,#16a34a)"
                : "linear-gradient(135deg,#14532d,#15803d)"
              : "#1f2937",
          color: isMaxed ? "#eab30888" : canClick ? "#bbf7d0" : "#374151",
          boxShadow: canClick && hov ? "0 2px 8px rgba(22,163,74,0.4)" : "none",
          transition: "all 0.15s",
          flexShrink: 0,
        }}
      >
        {isMaxed ? "★ MAX" : canClick ? "BUY" : "—"}
      </button>
    </div>
  );
}

// ─── AugmentSelector (pick overlay) ──────────────────────────────────────────

const MILESTONE_LABEL: Partial<Record<PieceType, string>> = {
  N: "First Knight Captured!",
  B: "First Bishop Captured!",
  R: "First Rook Captured!",
};

function AugmentSelector({
  playerColor,
  offered,
  onSelect,
  trigger,
}: {
  playerColor: Color;
  offered: Augment[];
  onSelect: (aug: Augment) => void;
  trigger?: AugmentTrigger | null;
}) {
  const isWhite = playerColor === "white";
  const badgeLabel =
    trigger?.reason === "bloodlust"
      ? "🩸 Bloodlust Bonus!"
      : trigger?.reason === "blind-rage"
        ? "😤 Blind Rage!"
        : trigger?.milestoneType
          ? `✦ ${MILESTONE_LABEL[trigger.milestoneType!]}`
          : null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 80,
        background: "linear-gradient(160deg,#030712 0%,#080e1f 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "16px 12px",
      }}
    >
      <div style={{ textAlign: "center" }}>
        {badgeLabel && (
          <div
            style={{
              display: "inline-block",
              marginBottom: 10,
              padding: "4px 14px",
              borderRadius: 20,
              background: "linear-gradient(135deg,#1c1f2e,#2d2f45)",
              border: `1px solid ${trigger?.reason === "bloodlust" ? "#dc2626" : trigger?.reason === "blind-rage" ? "#ea580c" : "#4f46e5"}`,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              color:
                trigger?.reason === "bloodlust"
                  ? "#fca5a5"
                  : trigger?.reason === "blind-rage"
                    ? "#fdba74"
                    : "#818cf8",
              textTransform: "uppercase",
            }}
          >
            {badgeLabel}
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginTop: badgeLabel ? 0 : 4,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              flexShrink: 0,
              background: isWhite ? "#ffffff" : "#1a0f00",
              border: `2px solid ${isWhite ? "#94a3b8" : "#6b7280"}`,
              boxShadow: `0 0 10px ${isWhite ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"}`,
            }}
          />
          <h2
            style={{
              fontSize: 20,
              fontWeight: 900,
              margin: 0,
              letterSpacing: "0.08em",
              color: "#f1f5f9",
            }}
          >
            {playerColor.toUpperCase()}
          </h2>
        </div>
        {!badgeLabel && (
          <p
            style={{
              fontSize: 10,
              letterSpacing: "0.2em",
              fontWeight: 700,
              color: "#475569",
              margin: "6px 0 0",
              textTransform: "uppercase",
            }}
          >
            Choose your augment
          </p>
        )}
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {offered.map((aug) => (
          <AugmentCard
            key={aug.id}
            augment={aug}
            onSelect={() => onSelect(aug)}
          />
        ))}
      </div>
      <p style={{ fontSize: 10, color: "#334155", margin: 0 }}>
        Click a card to select it
      </p>
    </div>
  );
}

// ─── StartScreen ─────────────────────────────────────────────────────────────

function StartScreen({ onStart }: { onStart: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 80,
        background: "linear-gradient(160deg,#030712 0%,#080e1f 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,10px)",
          gap: 1,
          opacity: 0.15,
          marginBottom: 4,
        }}
      >
        {Array.from({ length: 16 }, (_, i) => (
          <div
            key={i}
            style={{
              width: 10,
              height: 10,
              background:
                (Math.floor(i / 4) + i) % 2 === 0 ? "#f0d9b5" : "#b58863",
            }}
          />
        ))}
      </div>
      <span
        style={{
          fontSize: 48,
          lineHeight: 1,
          filter: "drop-shadow(0 4px 16px rgba(99,102,241,0.4))",
        }}
      >
        ♟️
      </span>
      <div style={{ textAlign: "center" }}>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: "#f1f5f9",
            margin: "0 0 6px",
            letterSpacing: "0.04em",
          }}
        >
          Chess Augmented
        </h2>
        <p
          style={{ fontSize: 12, color: "#475569", margin: 0, lineHeight: 1.6 }}
        >
          Classic chess · Each player picks an augment
          <br />
          before the game begins
        </p>
      </div>
      <button
        onClick={onStart}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          padding: "11px 44px",
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          borderRadius: 12,
          border: "none",
          cursor: "pointer",
          background: hov
            ? "linear-gradient(135deg,#4338ca,#6366f1)"
            : "linear-gradient(135deg,#4f46e5,#818cf8)",
          color: "#fff",
          boxShadow: hov
            ? "0 6px 28px rgba(99,102,241,0.65)"
            : "0 4px 18px rgba(99,102,241,0.45)",
          transform: hov ? "translateY(-2px)" : "none",
          transition: "all 0.18s",
        }}
      >
        Start Game
      </button>
    </div>
  );
}

// ─── PlayerBar ───────────────────────────────────────────────────────────────

type SpellState = {
  freezeCharges: number;
  freezeActive: boolean;
  onFreeze: () => void;
  necroCharges: number;
  necroActive: boolean;
  hasNecroTargets: boolean;
  onNecro: () => void;
  necroPlusCharges: number;
  necroPlusActive: boolean;
  hasNecroPlusTargets: boolean;
  onNecroPlus: () => void;
  ilkkanAvailable: boolean;
  ilkkanActive: boolean;
  onIlkkan: () => void;
  royalEdAvailable: boolean;
  royalEdActive: boolean;
  onRoyalEd: () => void;
  whatAvailable: boolean;
  whatActive: boolean;
  onWhat: () => void;
  sakoAvailable: boolean;
  sakoActive: boolean;
  onSako: () => void;
  swapAvailable: boolean;
  swapActive: boolean;
  onSwap: () => void;
  royalHouseholdAvailable: boolean;
  royalHouseholdActive: boolean;
  onRoyalHousehold: () => void;
  deathNoteAvailable: boolean;
  deathNoteActive: boolean;
  onDeathNote: () => void;
  domainAvailable: boolean;
  onDomain: () => void;
  monolithPlaceAvailable: boolean;
  monolithPlaceActive: boolean;
  onMonolithPlace: () => void;
  monolithRemoveAvailable: boolean;
  onMonolithRemove: () => void;
  contractAvailable: boolean;
  contractActive: boolean;
  onContract: () => void;
  contractTarget: [number, number] | null;
  blessedWaterCharges: number;
  blessedWaterActive: boolean;
  onBlessedWater: () => void;
  puppetAvailable: boolean;
  puppetActive: boolean;
  onPuppet: () => void;
  evadeCharges: number;
  evadeActive: boolean;
  onEvade: () => void;
  canUndo: boolean;
  onUndo: () => void;
  captureCount: number;
  hasBloodlust: boolean;
  shopOpen: boolean;
  onToggleShop: () => void;
};

function PlayerBar({
  color,
  isActive,
  isOver,
  phase,
  augments,
  gold,
  capturedPieces,
  advantage,
  spells,
  showReset,
  onReset,
  statusLabel,
  statusColor,
  statusBadge,
}: {
  color: Color;
  isActive: boolean;
  isOver: boolean;
  phase: GamePhase;
  augments: Augment[];
  gold: number;
  capturedPieces: PieceType[];
  advantage: number;
  spells: SpellState;
  showReset: boolean;
  onReset: () => void;
  statusLabel?: string;
  statusColor?: string;
  statusBadge?: boolean;
}) {
  const captureColor = opp(color);
  const sorted = [...capturedPieces].sort(
    (a, b) => PIECE_VALUE[b] - PIECE_VALUE[a],
  );
  const canAct = isActive && !isOver && phase === "playing";
  return (
    <div
      style={{
        flexShrink: 0,
        height: 48,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 12px",
        background: "#0a0f1a",
        borderTop: color === "white" ? "1px solid #1f2937" : undefined,
        borderBottom: color === "black" ? "1px solid #1f2937" : undefined,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          minWidth: 0,
          overflow: "hidden",
          flexWrap: "nowrap",
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            flexShrink: 0,
            background: color === "white" ? "#ffffff" : "#1a0f00",
            border: `2px solid ${color === "white" ? "#94a3b8" : "#6b7280"}`,
            boxShadow: canAct ? "0 0 0 2px #6366f1" : "none",
          }}
        />
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.05em",
            flexShrink: 0,
            color: canAct ? "#e2e8f0" : "#6b7280",
          }}
        >
          {color.toUpperCase()}
        </span>
        {augments.length > 0 &&
          (() => {
            const counts: Record<string, number> = {};
            const ordered: Augment[] = [];
            for (const a of augments) {
              if (!counts[a.id]) {
                ordered.push(a);
                counts[a.id] = 0;
              }
              counts[a.id]++;
            }
            return (
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {ordered.map((a) => (
                  <AugmentIconChip
                    key={a.id}
                    augment={a}
                    stacked={counts[a.id] >= 2}
                  />
                ))}
              </div>
            );
          })()}
        {spells.canUndo && <UndoButton onUndo={spells.onUndo} />}
        {canAct && spells.freezeCharges > 0 && (
          <SpellButton
            icon="❄️"
            label="FREEZE"
            active={spells.freezeActive}
            count={spells.freezeCharges}
            onClick={spells.onFreeze}
            title="Freeze an enemy piece for 1 opponent turn"
          />
        )}
        {canAct && spells.necroCharges > 0 && spells.hasNecroTargets && (
          <SpellButton
            icon="💀"
            label="REVIVE"
            active={spells.necroActive}
            onClick={spells.onNecro}
            title="Resurrect a captured pawn at its home square"
          />
        )}
        {canAct &&
          spells.necroPlusCharges > 0 &&
          spells.hasNecroPlusTargets && (
            <SpellButton
              icon="💀✨"
              label="REVIVE+"
              active={spells.necroPlusActive}
              onClick={spells.onNecroPlus}
              title="Revive a captured knight or bishop to your home rank"
            />
          )}
        {canAct && spells.ilkkanAvailable && (
          <SpellButton
            icon="🧑"
            label="ILKKAN"
            active={spells.ilkkanActive}
            onClick={spells.onIlkkan}
            title="Click a pawn to make it İlkkan — it transforms into any R/B/N it captures"
          />
        )}
        {canAct && spells.royalEdAvailable && (
          <SpellButton
            icon="♞"
            label="ROYAL"
            active={spells.royalEdActive}
            onClick={spells.onRoyalEd}
            title="Move your king like a knight (one time)"
          />
        )}
        {canAct && spells.whatAvailable && (
          <SpellButton
            icon="↔️"
            label="WHAT?"
            active={spells.whatActive}
            onClick={spells.onWhat}
            title="Move one pawn sideways one square (one time)"
          />
        )}
        {canAct && spells.sakoAvailable && (
          <SpellButton
            icon="⚓"
            label="SAKO"
            active={spells.sakoActive}
            onClick={spells.onSako}
            title="Teleport a piece to your half board (free action)"
          />
        )}
        {canAct && spells.swapAvailable && (
          <SpellButton
            icon="🔀"
            label="SWAP"
            active={spells.swapActive}
            onClick={spells.onSwap}
            title="Exchange two of your pieces (free action, once per game)"
          />
        )}
        {canAct && spells.royalHouseholdAvailable && (
          <SpellButton
            icon="🏰"
            label="RAMPAGE"
            active={spells.royalHouseholdActive}
            onClick={spells.onRoyalHousehold}
            title="King rampages up to 4 squares, destroys all in path"
          />
        )}
        {canAct && spells.deathNoteAvailable && (
          <SpellButton
            icon="☠️"
            label="DEATH"
            active={spells.deathNoteActive}
            onClick={spells.onDeathNote}
            title="Mark an enemy piece (not king/queen) to die in 5 rounds"
          />
        )}
        {canAct && spells.domainAvailable && (
          <SpellButton
            icon="♾️"
            label="DOMAIN"
            onClick={spells.onDomain}
            title="DOMAIN EXPANSION — expand the board to 10×10"
          />
        )}
        {canAct && spells.monolithPlaceAvailable && (
          <SpellButton
            icon="🗿"
            label="PLACE"
            active={spells.monolithPlaceActive}
            onClick={spells.onMonolithPlace}
            title="Place an impassable monolith on any empty square (spends a turn)"
          />
        )}
        {canAct && spells.monolithRemoveAvailable && (
          <SpellButton
            icon="🗑️"
            label="REMOVE"
            active={spells.monolithPlaceActive}
            onClick={spells.onMonolithRemove}
            title="Remove your monolith (free action)"
          />
        )}
        {canAct && spells.contractAvailable && (
          <SpellButton
            icon="🎯"
            label="CONTRACT"
            active={spells.contractActive}
            onClick={spells.onContract}
            title="Mark an enemy piece (not king/pawn) — capture it for 4× its value"
          />
        )}
        {canAct && spells.blessedWaterCharges > 0 && (
          <SpellButton
            icon="💧"
            label="BLESS"
            count={spells.blessedWaterCharges}
            active={spells.blessedWaterActive}
            onClick={spells.onBlessedWater}
            title="Bless a square — piece cannot be captured for 2 rounds"
          />
        )}
        {canAct && spells.puppetAvailable && (
          <SpellButton
            icon="🪆"
            label="PUPPET"
            active={spells.puppetActive}
            onClick={spells.onPuppet}
            title="Force the opponent to move a specific piece on their next turn"
          />
        )}
        {canAct && spells.evadeCharges > 0 && (
          <SpellButton
            icon="💨"
            label="EVADE"
            active={spells.evadeActive}
            count={spells.evadeCharges}
            onClick={spells.onEvade}
            title="Opponent cannot use augment spells or shop on their next turn"
          />
        )}
        {canAct && (
          <SpellButton
            icon="🏪"
            label="SHOP"
            active={spells.shopOpen}
            onClick={spells.onToggleShop}
            title="Open the augment shop"
          />
        )}
        <GoldBadge gold={gold} active={canAct} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            flexWrap: "wrap",
          }}
        >
          {sorted.map((t, i) => (
            <span
              key={i}
              style={{
                fontSize: 16,
                lineHeight: 1,
                color: captureColor === "white" ? "#fff" : "#1a0f00",
                textShadow:
                  captureColor === "white"
                    ? "0 0 2px #000,0 0 4px #000"
                    : "0 0 2px rgba(255,255,255,0.6)",
              }}
            >
              {PIECE_UNICODE[captureColor][t]}
            </span>
          ))}
          {advantage > 0 && (
            <span
              style={{
                fontSize: 12,
                color: "#9ca3af",
                fontWeight: 600,
                marginLeft: 2,
              }}
            >
              +{advantage}
            </span>
          )}
        </div>
        {spells.hasBloodlust && (
          <span
            style={{
              fontSize: 9,
              color: "#9ca3af",
              letterSpacing: "0.05em",
              flexShrink: 0,
            }}
          >
            🩸 {spells.captureCount % 4}/4
          </span>
        )}
      </div>
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}
      >
        {statusLabel && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: statusColor ?? "#e2e8f0",
              background: statusBadge ? "rgba(239,68,68,0.15)" : "transparent",
              padding: statusBadge ? "3px 10px" : "0",
              borderRadius: 20,
              border: statusBadge ? "1px solid rgba(239,68,68,0.4)" : "none",
            }}
          >
            {statusLabel}
          </div>
        )}
        {showReset && (
          <button
            onClick={onReset}
            style={{
              padding: "4px 12px",
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 6,
              border: "1px solid #374151",
              background: "#111827",
              color: "#9ca3af",
              cursor: "pointer",
            }}
          >
            New Game
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface MpConfig {
  myColor: Color;
  initialWhiteAugment: Augment;
  initialBlackAugment: Augment;
  onSnapshot: (snap: Record<string, unknown>) => void;
  incomingSnapshot: Record<string, unknown> | null;
  opponentLeft: boolean;
  /** True while the WebSocket is down and the client is attempting to resume the session. */
  connectionLost?: boolean;
}

export default function ChessGame({ mpConfig }: { mpConfig?: MpConfig } = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardPx, setBoardPx] = useState(320);

  const [game, setGame] = useState<ChessState>(createInitialState);

  useEffect(() => {
    const n = game.occupancy.length;
    if (n >= 8 && n <= 16) setBoardSize(n);
  }, [game.occupancy.length]);

  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [validMoves, setValidMoves] = useState<[number, number][]>([]);
  const [promotionPending, setPromotionPending] = useState<{
    from: [number, number];
    to: [number, number];
  } | null>(null);

  const [phase, setPhase] = useState<GamePhase>(mpConfig ? "playing" : "start");
  const [offeredToWhite, setOfferedToWhite] = useState<Augment[]>([]);
  const [offeredToBlack, setOfferedToBlack] = useState<Augment[]>([]);
  const [whiteAugments, setWhiteAugments] = useState<Augment[]>(
    mpConfig ? [mpConfig.initialWhiteAugment] : [],
  );
  const [blackAugments, setBlackAugments] = useState<Augment[]>(
    mpConfig ? [mpConfig.initialBlackAugment] : [],
  );
  const [mpReady, setMpReady] = useState(!mpConfig);

  useEffect(() => {
    const hasIlkkan =
      whiteAugments.some((a) => a.id === "ilkkan") ||
      blackAugments.some((a) => a.id === "ilkkan");
    if (!hasIlkkan) return;
    const img = new Image();
    img.src = "/ilkkan.jpeg";
  }, [whiteAugments, blackAugments]);

  const [augmentQueue, setAugmentQueue] = useState<AugmentTrigger[]>([]);
  const [currentTrigger, setCurrentTrigger] = useState<AugmentTrigger | null>(
    null,
  );
  const [midGameOffered, setMidGameOffered] = useState<Augment[]>([]);

  const [whiteMilestones, setWhiteMilestones] =
    useState<Milestones>(EMPTY_MILESTONES);
  const [blackMilestones, setBlackMilestones] =
    useState<Milestones>(EMPTY_MILESTONES);

  const [gameHistory, setGameHistory] = useState<ChessState[]>([]);
  const [augmentHistory, setAugmentHistory] = useState<AugmentSnapshot[]>([]);
  const [whiteUndosLeft, setWhiteUndosLeft] = useState(0);
  const [blackUndosLeft, setBlackUndosLeft] = useState(0);

  const [whiteTurnCount, setWhiteTurnCount] = useState(0);
  const [blackTurnCount, setBlackTurnCount] = useState(0);

  // Frost
  const [whiteFreezeCharges, setWhiteFreezeCharges] = useState(0);
  const [blackFreezeCharges, setBlackFreezeCharges] = useState(0);
  const [frozenSquare, setFrozenSquare] = useState<[number, number] | null>(
    null,
  );
  const [frozenExpireAfter, setFrozenExpireAfter] = useState<Color | null>(
    null,
  );
  const [freezeMode, setFreezeMode] = useState(false);

  // Necromancer
  const [whiteNecroCharges, setWhiteNecroCharges] = useState(0);
  const [blackNecroCharges, setBlackNecroCharges] = useState(0);
  const [whiteLostPawnCols, setWhiteLostPawnCols] = useState<number[]>([]);
  const [blackLostPawnCols, setBlackLostPawnCols] = useState<number[]>([]);
  const [necroMode, setNecroMode] = useState(false);

  // Bloodlust
  const [whiteCaptureCount, setWhiteCaptureCount] = useState(0);
  const [blackCaptureCount, setBlackCaptureCount] = useState(0);
  const [whiteBloodlustNext, setWhiteBloodlustNext] = useState(4);
  const [blackBloodlustNext, setBlackBloodlustNext] = useState(4);

  // Internal Combustion
  const [whiteIcUsed, setWhiteIcUsed] = useState(false);
  const [blackIcUsed, setBlackIcUsed] = useState(false);

  // Royal Education
  const [whiteRoyalEdUsed, setWhiteRoyalEdUsed] = useState(false);
  const [blackRoyalEdUsed, setBlackRoyalEdUsed] = useState(false);
  const [royalEdMode, setRoyalEdMode] = useState(false);

  // What?
  const [whiteWhatUsed, setWhiteWhatUsed] = useState(false);
  const [blackWhatUsed, setBlackWhatUsed] = useState(false);
  const [whatMode, setWhatMode] = useState(false);
  const [whatSelected, setWhatSelected] = useState<[number, number] | null>(
    null,
  );

  // Şako Bosphorus
  const [whiteSakoUsed, setWhiteSakoUsed] = useState(false);
  const [blackSakoUsed, setBlackSakoUsed] = useState(false);
  const [sakoMode, setSakoMode] = useState(false);
  const [sakoSelected, setSakoSelected] = useState<[number, number] | null>(
    null,
  );

  const [whiteSwapUsed, setWhiteSwapUsed] = useState(false);
  const [blackSwapUsed, setBlackSwapUsed] = useState(false);
  const [swapMode, setSwapMode] = useState(false);
  const [swapFirst, setSwapFirst] = useState<[number, number] | null>(null);

  // Royal Household
  const [whiteRoyalHouseholdUsed, setWhiteRoyalHouseholdUsed] = useState(false);
  const [blackRoyalHouseholdUsed, setBlackRoyalHouseholdUsed] = useState(false);
  const [royalHouseholdMode, setRoyalHouseholdMode] = useState(false);

  // Death Note
  const [whiteDNUsed, setWhiteDNUsed] = useState(false);
  const [blackDNUsed, setBlackDNUsed] = useState(false);
  const [deathNoteMode, setDeathNoteMode] = useState(false);
  const [deathNoteTargets, setDeathNoteTargets] = useState<DeathNoteTarget[]>(
    [],
  );

  // Domain Expansion
  const [boardExpanded, setBoardExpanded] = useState(false);
  const [whiteDomainUsed, setWhiteDomainUsed] = useState(false);
  const [blackDomainUsed, setBlackDomainUsed] = useState(false);

  // Events
  const [nextEventTurn, setNextEventTurn] = useState(() =>
    rollFullRoundsUntilNextEvent(false),
  );
  const [pendingEvent, setPendingEvent] = useState<GameEvent | null>(null);
  const [peaceTreatyMovesLeft, setPeaceTreatyMovesLeft] = useState(0);
  const [activeNuke, setActiveNuke] = useState<{
    topRow: number;
    leftCol: number;
    movesLeft: number;
  } | null>(null);

  /** After "Just Chaos", board events are scheduled every 5 full rounds. */
  const [chaosEventTiming, setChaosEventTiming] = useState(false);

  // Great Wall of Hatay (event)
  const [wallSquares, setWallSquares] = useState<
    { row: number; col: number }[]
  >([]);
  const [wallMovesLeft, setWallMovesLeft] = useState(0);

  // Puppet (augment)
  const [puppetMode, setPuppetMode] = useState(false);
  const [whitePuppetUsed, setWhitePuppetUsed] = useState(false);
  const [blackPuppetUsed, setBlackPuppetUsed] = useState(false);
  const [activePuppetSquare, setActivePuppetSquare] = useState<
    [number, number] | null
  >(null);
  const [activePuppetColor, setActivePuppetColor] = useState<Color | null>(
    null,
  );

  // Blessed squares (Blessed Waters event + Blessed Water Spell augment)
  const [blessedSquares, setBlessedSquares] = useState<
    { row: number; col: number; movesLeft: number }[]
  >([]);

  // Cold Winds (event)
  const [coldWindsSquares, setColdWindsSquares] = useState<[number, number][]>(
    [],
  );
  const [coldWindsMovesLeft, setColdWindsMovesLeft] = useState(0);

  // Contract Killer (augment)
  const [whiteContractTarget, setWhiteContractTarget] = useState<
    [number, number] | null
  >(null);
  const [blackContractTarget, setBlackContractTarget] = useState<
    [number, number] | null
  >(null);
  const [whiteContractPieceId, setWhiteContractPieceId] = useState<
    string | null
  >(null);
  const [blackContractPieceId, setBlackContractPieceId] = useState<
    string | null
  >(null);
  const [contractMode, setContractMode] = useState(false);

  // Necromancer+ (augment)
  const [whiteNecroPlusCharges, setWhiteNecroPlusCharges] = useState(0);
  const [blackNecroPlusCharges, setBlackNecroPlusCharges] = useState(0);
  const [whiteLostMinors, setWhiteLostMinors] = useState<PieceType[]>([]);
  const [blackLostMinors, setBlackLostMinors] = useState<PieceType[]>([]);
  const [necroPlusMode, setNecroPlusMode] = useState(false);
  const [whiteMonolithPermRemoved, setWhiteMonolithPermRemoved] =
    useState(false);
  const [blackMonolithPermRemoved, setBlackMonolithPermRemoved] =
    useState(false);

  // İlkkan (augment)
  const [whiteIlkkanId, setWhiteIlkkanId] = useState<string | null>(null);
  const [blackIlkkanId, setBlackIlkkanId] = useState<string | null>(null);
  const [whiteIlkkanChosen, setWhiteIlkkanChosen] = useState(false);
  const [blackIlkkanChosen, setBlackIlkkanChosen] = useState(false);
  const [ilkkanMode, setIlkkanMode] = useState(false);

  // Blessed Water Spell (augment)
  const [whiteBlessedWaterCharges, setWhiteBlessedWaterCharges] = useState(0);
  const [blackBlessedWaterCharges, setBlackBlessedWaterCharges] = useState(0);
  const [blessedWaterMode, setBlessedWaterMode] = useState(false);

  // Monolith (Impassable)
  const [monolithMode, setMonolithMode] = useState<"place" | "remove" | null>(
    null,
  );

  // Pawn Shop — buy count + pending placement (same turn, no extra move cost)
  const [pawnPlaceFor, setPawnPlaceFor] = useState<Color | null>(null);
  const [whitePawnShopBuys, setWhitePawnShopBuys] = useState(0);
  const [blackPawnShopBuys, setBlackPawnShopBuys] = useState(0);

  // Prize Money / Blind Rage
  const [whitePrizeFirstCaptureDone, setWhitePrizeFirstCaptureDone] =
    useState(false);
  const [blackPrizeFirstCaptureDone, setBlackPrizeFirstCaptureDone] =
    useState(false);
  const [whiteBlindRageDone, setWhiteBlindRageDone] = useState(false);
  const [blackBlindRageDone, setBlackBlindRageDone] = useState(false);

  // Evade — charges + opponent spell/shop lock for one of their turns
  const [whiteEvadeCharges, setWhiteEvadeCharges] = useState(0);
  const [blackEvadeCharges, setBlackEvadeCharges] = useState(0);
  const [augmentSpellBlockedFor, setAugmentSpellBlockedFor] =
    useState<Color | null>(null);

  // Shop
  const [shopOpen, setShopOpen] = useState(false);
  const [whiteTierBought, setWhiteTierBought] = useState<TierBought>({
    ...EMPTY_TIER,
  });
  const [blackTierBought, setBlackTierBought] = useState<TierBought>({
    ...EMPTY_TIER,
  });

  const boardSize = boardExpanded ? 10 : 8;
  const showCenterMarkers =
    phase === "playing" &&
    [...whiteAugments, ...blackAugments].some(
      (a) => a.id === "king-of-the-hill",
    );
  const centerSquares = showCenterMarkers
    ? getCenterSquares(boardSize)
    : new Set<string>();

  /** Online black sees the board from their side (pieces at bottom); white unchanged. */
  const mpViewFlipped = mpConfig?.myColor === "black";

  // Responsive board
  useEffect(() => {
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBoardPx(Math.floor(Math.min(width - 4, height - 4) / 8) * 8);
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      const sqCount = boardExpanded ? 10 : 8;
      setBoardPx(
        Math.floor(Math.min(width - 4, height - 4) / sqCount) * sqCount,
      );
    }
  }, [boardExpanded]);
  const sqSize = boardPx / boardSize;

  // ── Grant effects ────────────────────────────────────────────────────────

  const grantPickedEffects = useCallback((aug: Augment, color: Color) => {
    if (aug.id === "oops") {
      if (color === "white") setWhiteUndosLeft((u) => u + 1);
      else setBlackUndosLeft((u) => u + 1);
    }
    if (aug.id === "frost") {
      if (color === "white") setWhiteFreezeCharges((n) => n + 1);
      else setBlackFreezeCharges((n) => n + 1);
    }
    if (aug.id === "blessed-water-spell") {
      if (color === "white") setWhiteBlessedWaterCharges((n) => n + 1);
      else setBlackBlessedWaterCharges((n) => n + 1);
    }
    if (aug.id === "necromancer") {
      if (color === "white") setWhiteNecroCharges((n) => n + 1);
      else setBlackNecroCharges((n) => n + 1);
    }
    if (aug.id === "necromancer-plus") {
      if (color === "white") setWhiteNecroPlusCharges((n) => n + 1);
      else setBlackNecroPlusCharges((n) => n + 1);
    }
    if (aug.id === "royal-education") {
      if (color === "white") setWhiteRoyalEdUsed(false);
      else setBlackRoyalEdUsed(false);
    }
    if (aug.id === "what") {
      if (color === "white") setWhiteWhatUsed(false);
      else setBlackWhatUsed(false);
    }
    if (aug.id === "instant-cash") {
      setGame((g) => ({
        ...g,
        goldWhite: color === "white" ? g.goldWhite + 10 : g.goldWhite,
        goldBlack: color === "black" ? g.goldBlack + 10 : g.goldBlack,
      }));
    }
    if (aug.id === "evade") {
      if (color === "white") setWhiteEvadeCharges((n) => n + 1);
      else setBlackEvadeCharges((n) => n + 1);
    }
  }, []);

  // ── MP: snapshot infrastructure ──────────────────────────────────────────

  const snapshotRef = useRef(false);
  const requestSnapshot = useCallback(() => {
    snapshotRef.current = true;
  }, []);

  // Build a plain-JSON snapshot of all game state
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const buildSnapshot = () => ({
    game,
    whiteTurnCount,
    blackTurnCount,
    whiteAugments,
    blackAugments,
    whiteMilestones,
    blackMilestones,
    whiteFreezeCharges,
    blackFreezeCharges,
    frozenSquare,
    frozenExpireAfter,
    whiteNecroCharges,
    blackNecroCharges,
    whiteLostPawnCols,
    blackLostPawnCols,
    whiteCaptureCount,
    blackCaptureCount,
    whiteBloodlustNext,
    blackBloodlustNext,
    whiteIcUsed,
    blackIcUsed,
    whiteRoyalEdUsed,
    blackRoyalEdUsed,
    whiteWhatUsed,
    blackWhatUsed,
    whiteSakoUsed,
    blackSakoUsed,
    whiteSwapUsed,
    blackSwapUsed,
    whiteRoyalHouseholdUsed,
    blackRoyalHouseholdUsed,
    whiteDNUsed,
    blackDNUsed,
    deathNoteTargets,
    boardExpanded,
    whiteDomainUsed,
    blackDomainUsed,
    nextEventTurn,
    pendingEvent,
    peaceTreatyMovesLeft,
    activeNuke,
    chaosEventTiming,
    wallSquares,
    wallMovesLeft,
    whitePuppetUsed,
    blackPuppetUsed,
    activePuppetSquare,
    activePuppetColor,
    blessedSquares,
    coldWindsSquares,
    coldWindsMovesLeft,
    whiteContractTarget,
    blackContractTarget,
    whiteContractPieceId,
    blackContractPieceId,
    whiteBlessedWaterCharges,
    blackBlessedWaterCharges,
    whiteTierBought,
    blackTierBought,
    augmentQueue,
    currentTrigger,
    midGameOffered,
    whiteNecroPlusCharges,
    blackNecroPlusCharges,
    whiteLostMinors,
    blackLostMinors,
    whiteMonolithPermRemoved,
    blackMonolithPermRemoved,
    whiteIlkkanId,
    blackIlkkanId,
    whiteIlkkanChosen,
    blackIlkkanChosen,
    whitePrizeFirstCaptureDone,
    blackPrizeFirstCaptureDone,
    whiteBlindRageDone,
    blackBlindRageDone,
    whiteEvadeCharges,
    blackEvadeCharges,
    augmentSpellBlockedFor,
    whitePawnShopBuys,
    blackPawnShopBuys,
    pawnPlaceFor,
  });

  // Apply a snapshot received from the opponent
  const applySnapshot = (s: Record<string, unknown>) => {
    const g = s as ReturnType<typeof buildSnapshot>;
    setGame(g.game as ChessState);
    setBoardSize((g.game as ChessState).occupancy.length);
    setWhiteTurnCount(g.whiteTurnCount as number);
    setBlackTurnCount(g.blackTurnCount as number);
    setWhiteAugments(g.whiteAugments as Augment[]);
    setBlackAugments(g.blackAugments as Augment[]);
    setWhiteMilestones(g.whiteMilestones as Milestones);
    setBlackMilestones(g.blackMilestones as Milestones);
    setWhiteFreezeCharges(g.whiteFreezeCharges as number);
    setBlackFreezeCharges(g.blackFreezeCharges as number);
    setFrozenSquare(g.frozenSquare as [number, number] | null);
    setFrozenExpireAfter(g.frozenExpireAfter as Color | null);
    setWhiteNecroCharges(g.whiteNecroCharges as number);
    setBlackNecroCharges(g.blackNecroCharges as number);
    setWhiteLostPawnCols(g.whiteLostPawnCols as number[]);
    setBlackLostPawnCols(g.blackLostPawnCols as number[]);
    setWhiteCaptureCount(g.whiteCaptureCount as number);
    setBlackCaptureCount(g.blackCaptureCount as number);
    setWhiteBloodlustNext(g.whiteBloodlustNext as number);
    setBlackBloodlustNext(g.blackBloodlustNext as number);
    setWhiteIcUsed(g.whiteIcUsed as boolean);
    setBlackIcUsed(g.blackIcUsed as boolean);
    setWhiteRoyalEdUsed(g.whiteRoyalEdUsed as boolean);
    setBlackRoyalEdUsed(g.blackRoyalEdUsed as boolean);
    setWhiteWhatUsed(g.whiteWhatUsed as boolean);
    setBlackWhatUsed(g.blackWhatUsed as boolean);
    setWhiteSakoUsed(g.whiteSakoUsed as boolean);
    setBlackSakoUsed(g.blackSakoUsed as boolean);
    setWhiteSwapUsed((g.whiteSwapUsed as boolean) ?? false);
    setBlackSwapUsed((g.blackSwapUsed as boolean) ?? false);
    setWhiteRoyalHouseholdUsed(g.whiteRoyalHouseholdUsed as boolean);
    setBlackRoyalHouseholdUsed(g.blackRoyalHouseholdUsed as boolean);
    setWhiteDNUsed(g.whiteDNUsed as boolean);
    setBlackDNUsed(g.blackDNUsed as boolean);
    setDeathNoteTargets(normalizeDeathNoteTargets(g.deathNoteTargets));
    setBoardExpanded(g.boardExpanded as boolean);
    setWhiteDomainUsed(g.whiteDomainUsed as boolean);
    setBlackDomainUsed(g.blackDomainUsed as boolean);
    setNextEventTurn(g.nextEventTurn as number);
    setPendingEvent(g.pendingEvent as GameEvent | null);
    setPeaceTreatyMovesLeft(g.peaceTreatyMovesLeft as number);
    setActiveNuke(
      g.activeNuke as {
        topRow: number;
        leftCol: number;
        movesLeft: number;
      } | null,
    );
    setChaosEventTiming(
      typeof g.chaosEventTiming === "boolean"
        ? g.chaosEventTiming
        : (g as { eventInterval?: number }).eventInterval === 10,
    );
    setWallSquares(g.wallSquares as { row: number; col: number }[]);
    setWallMovesLeft(g.wallMovesLeft as number);
    setWhitePuppetUsed(g.whitePuppetUsed as boolean);
    setBlackPuppetUsed(g.blackPuppetUsed as boolean);
    setActivePuppetSquare(g.activePuppetSquare as [number, number] | null);
    setActivePuppetColor(g.activePuppetColor as Color | null);
    setBlessedSquares(
      g.blessedSquares as { row: number; col: number; movesLeft: number }[],
    );
    setColdWindsSquares(g.coldWindsSquares as [number, number][]);
    setColdWindsMovesLeft(g.coldWindsMovesLeft as number);
    setWhiteContractTarget(g.whiteContractTarget as [number, number] | null);
    setBlackContractTarget(g.blackContractTarget as [number, number] | null);
    setWhiteContractPieceId(
      (g as { whiteContractPieceId?: string | null }).whiteContractPieceId ??
        null,
    );
    setBlackContractPieceId(
      (g as { blackContractPieceId?: string | null }).blackContractPieceId ??
        null,
    );
    setWhiteBlessedWaterCharges(g.whiteBlessedWaterCharges as number);
    setBlackBlessedWaterCharges(g.blackBlessedWaterCharges as number);
    setWhiteTierBought(g.whiteTierBought as TierBought);
    setBlackTierBought(g.blackTierBought as TierBought);
    setAugmentQueue(g.augmentQueue as AugmentTrigger[]);
    setCurrentTrigger(g.currentTrigger as AugmentTrigger | null);
    setMidGameOffered(g.midGameOffered as Augment[]);
    setWhiteNecroPlusCharges(g.whiteNecroPlusCharges as number);
    setBlackNecroPlusCharges(g.blackNecroPlusCharges as number);
    setWhiteLostMinors(g.whiteLostMinors as PieceType[]);
    setBlackLostMinors(g.blackLostMinors as PieceType[]);
    setWhiteMonolithPermRemoved(g.whiteMonolithPermRemoved as boolean);
    setBlackMonolithPermRemoved(g.blackMonolithPermRemoved as boolean);
    setWhiteIlkkanId(g.whiteIlkkanId as string | null);
    setBlackIlkkanId(g.blackIlkkanId as string | null);
    setWhiteIlkkanChosen(g.whiteIlkkanChosen as boolean);
    setBlackIlkkanChosen(g.blackIlkkanChosen as boolean);
    setWhitePrizeFirstCaptureDone(
      (g as { whitePrizeFirstCaptureDone?: boolean }).whitePrizeFirstCaptureDone ??
        false,
    );
    setBlackPrizeFirstCaptureDone(
      (g as { blackPrizeFirstCaptureDone?: boolean }).blackPrizeFirstCaptureDone ??
        false,
    );
    setWhiteBlindRageDone(
      (g as { whiteBlindRageDone?: boolean }).whiteBlindRageDone ?? false,
    );
    setBlackBlindRageDone(
      (g as { blackBlindRageDone?: boolean }).blackBlindRageDone ?? false,
    );
    setWhiteEvadeCharges((g as { whiteEvadeCharges?: number }).whiteEvadeCharges ?? 0);
    setBlackEvadeCharges((g as { blackEvadeCharges?: number }).blackEvadeCharges ?? 0);
    setAugmentSpellBlockedFor(
      (g as { augmentSpellBlockedFor?: Color | null }).augmentSpellBlockedFor ??
        null,
    );
    setWhitePawnShopBuys((g as { whitePawnShopBuys?: number }).whitePawnShopBuys ?? 0);
    setBlackPawnShopBuys((g as { blackPawnShopBuys?: number }).blackPawnShopBuys ?? 0);
    setPawnPlaceFor(
      (g as { pawnPlaceFor?: Color | null }).pawnPlaceFor ?? null,
    );
    // Clear any active interaction mode on opponent's turn
    setSelected(null);
    setValidMoves([]);
    setFreezeMode(false);
    setNecroMode(false);
    setRoyalHouseholdMode(false);
    setSakoMode(false);
    setSakoSelected(null);
    setDeathNoteMode(false);
    setRoyalEdMode(false);
    setContractMode(false);
    setBlessedWaterMode(false);
    setPuppetMode(false);
    setWhatMode(false);
    setWhatSelected(null);
    setMonolithMode(null);
    setShopOpen(false);
    setNecroPlusMode(false);
    setIlkkanMode(false);
    setSwapMode(false);
    setSwapFirst(null);
  };

  // MP: initialize augment effects on mount
  useEffect(() => {
    if (!mpConfig) return;
    setWhiteAugments([mpConfig.initialWhiteAugment]);
    setBlackAugments([mpConfig.initialBlackAugment]);
    grantPickedEffects(mpConfig.initialWhiteAugment, "white");
    grantPickedEffects(mpConfig.initialBlackAugment, "black");
    setPhase("playing");
    setMpReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // MP: apply incoming snapshot from opponent
  useEffect(() => {
    if (mpConfig?.incomingSnapshot) applySnapshot(mpConfig.incomingSnapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mpConfig?.incomingSnapshot]);

  // MP: dep-less effect — fires after every render; sends snapshot when flagged
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!snapshotRef.current || !mpConfig) return;
    snapshotRef.current = false;
    mpConfig.onSnapshot(buildSnapshot());
  });

  // Sync Free Passage augment flags into engine state for castling legality
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const fw = whiteAugments.some((a) => a.id === "free-passage");
    const fb = blackAugments.some((a) => a.id === "free-passage");
    setGame((g) =>
      (g.freePassageWhite ?? false) === fw && (g.freePassageBlack ?? false) === fb
        ? g
        : { ...g, freePassageWhite: fw, freePassageBlack: fb },
    );
  }, [whiteAugments, blackAugments]);

  // ── Pre-game picks ───────────────────────────────────────────────────────

  const handleStart = () => {
    setOfferedToWhite(rollAugments(pickAugmentCount([])));
    setPhase("white-augment");
  };
  const handleWhitePick = (aug: Augment) => {
    setWhiteAugments([aug]);
    grantPickedEffects(aug, "white");
    setOfferedToBlack(rollAugments(pickAugmentCount([aug]), [aug.id]));
    setPhase("black-augment");
  };
  const handleBlackPick = (aug: Augment) => {
    setBlackAugments([aug]);
    grantPickedEffects(aug, "black");
    setPhase("playing");
  };

  // ── Mid-game pick ────────────────────────────────────────────────────────

  const showTrigger = useCallback(
    (trigger: AugmentTrigger, wAugs: Augment[], bAugs: Augment[]) => {
      setCurrentTrigger(trigger);
      const playerAugs = trigger.color === "white" ? wAugs : bAugs;
      setMidGameOffered(
        rollAugments(
          pickAugmentCount(playerAugs),
          getExcludeForPlayer(playerAugs),
          getWeightsForPlayer(playerAugs),
        ),
      );
    },
    [],
  );

  const handleMidGamePick = useCallback(
    (aug: Augment) => {
      if (!currentTrigger) return;
      const color = currentTrigger.color;
      let newWAugs = whiteAugments,
        newBAugs = blackAugments;
      if (color === "white") {
        newWAugs = [...whiteAugments, aug];
        setWhiteAugments(newWAugs);
      } else {
        newBAugs = [...blackAugments, aug];
        setBlackAugments(newBAugs);
      }
      grantPickedEffects(aug, color);
      if (augmentQueue.length > 0) {
        const [next, ...rest] = augmentQueue;
        setAugmentQueue(rest);
        showTrigger(next, newWAugs, newBAugs);
      } else {
        setCurrentTrigger(null);
        setMidGameOffered([]);
      }
      requestSnapshot();
    },
    [
      currentTrigger,
      whiteAugments,
      blackAugments,
      augmentQueue,
      grantPickedEffects,
      showTrigger,
      requestSnapshot,
    ],
  );

  // ── Shop buy ─────────────────────────────────────────────────────────────

  const handleBuy = useCallback(
    (aug: Augment) => {
      const color = game.turn;
      if (augmentSpellBlockedFor === color) return;
      const playerAugs = color === "white" ? whiteAugments : blackAugments;
      const ownedCount = playerAugs.filter((a) => a.id === aug.id).length;
      if (ownedCount >= (MAX_STACK[aug.id] ?? 1)) return;
      const tierBought = color === "white" ? whiteTierBought : blackTierBought;
      const cost = getShopCost(aug.rarity, tierBought[aug.rarity]);
      const currentGold = color === "white" ? game.goldWhite : game.goldBlack;
      if (currentGold < cost) return;

      // Deduct gold
      setGame((g) => ({
        ...g,
        goldWhite: color === "white" ? g.goldWhite - cost : g.goldWhite,
        goldBlack: color === "black" ? g.goldBlack - cost : g.goldBlack,
      }));

      // Add augment
      if (color === "white") setWhiteAugments((prev) => [...prev, aug]);
      else setBlackAugments((prev) => [...prev, aug]);
      grantPickedEffects(aug, color);

      // Increment tier bought counter
      const setter =
        color === "white" ? setWhiteTierBought : setBlackTierBought;
      setter((prev) => ({ ...prev, [aug.rarity]: prev[aug.rarity] + 1 }));
      requestSnapshot();
    },
    [
      game,
      whiteTierBought,
      blackTierBought,
      grantPickedEffects,
      requestSnapshot,
      augmentSpellBlockedFor,
    ],
  );

  // ── Core move executor ───────────────────────────────────────────────────

  const executeMove = useCallback(
    (
      from: [number, number],
      to: [number, number],
      promotion?: PieceType,
      capturedType?: PieceType | null,
    ) => {
      const movingColor = game.turn;
      const startGoldWhite = game.goldWhite;
      const startGoldBlack = game.goldBlack;
      const victimSquarePiece = getDerivedBoard(game)[to[0]][to[1]];
      const victimWasMercenary = isMercenaryPiece(victimSquarePiece);
      setGameHistory((h) => [...h, game]);
      setAugmentHistory((h) => [...h, {
        frozenSquare, frozenExpireAfter,
        deathNoteTargets,
        activePuppetSquare, activePuppetColor,
        whiteContractTarget, blackContractTarget,
        whiteContractPieceId, blackContractPieceId,
        whiteIlkkanId, blackIlkkanId,
        blessedSquares,
        coldWindsSquares, coldWindsMovesLeft,
        wallSquares, wallMovesLeft,
        activeNuke,
        peaceTreatyMovesLeft,
        whiteLostPawnCols, blackLostPawnCols,
        whiteCaptureCount, blackCaptureCount,
        whiteBloodlustNext, blackBloodlustNext,
        whiteLostMinors, blackLostMinors,
        nextEventTurn, chaosEventTiming,
        whitePrizeFirstCaptureDone,
        blackPrizeFirstCaptureDone,
        whiteBlindRageDone,
        blackBlindRageDone,
        whiteEvadeCharges,
        blackEvadeCharges,
        augmentSpellBlockedFor,
        whitePawnShopBuys,
        blackPawnShopBuys,
      }]);
      setShopOpen(false);

      // Frost expire
      if (frozenSquare && frozenExpireAfter === movingColor) {
        setFrozenSquare(null);
        setFrozenExpireAfter(null);
      }

      let newGame = makeMove(game, from, to, promotion);

      const newTurnCount =
        (movingColor === "white" ? whiteTurnCount : blackTurnCount) + 1;
      if (movingColor === "white") setWhiteTurnCount(newTurnCount);
      else setBlackTurnCount(newTurnCount);

      const playerAugs =
        movingColor === "white" ? whiteAugments : blackAugments;
      newGame = applyEndOfTurnEffects(
        newGame,
        movingColor,
        playerAugs,
        newTurnCount,
      );

      // Jew
      if (capturedType === "P" && !victimWasMercenary) {
        const victimColor = opp(movingColor);
        const victimAugs =
          victimColor === "white" ? whiteAugments : blackAugments;
        if (victimAugs.some((a) => a.id === "jew"))
          newGame = {
            ...newGame,
            goldWhite:
              victimColor === "white"
                ? newGame.goldWhite + 2
                : newGame.goldWhite,
            goldBlack:
              victimColor === "black"
                ? newGame.goldBlack + 2
                : newGame.goldBlack,
          };
      }

      // Necromancer: track column at death, revive at home rank
      if (capturedType === "P" && !victimWasMercenary) {
        const victimColor = opp(movingColor);
        if (victimColor === "white")
          setWhiteLostPawnCols((prev) => [...prev, to[1]]);
        else setBlackLostPawnCols((prev) => [...prev, to[1]]);
      }
      // Necromancer+: track lost knights/bishops
      if ((capturedType === "N" || capturedType === "B") && !victimWasMercenary) {
        const victimColor = opp(movingColor);
        if (victimColor === "white")
          setWhiteLostMinors((prev) => [...prev, capturedType]);
        else setBlackLostMinors((prev) => [...prev, capturedType]);
      }

      // İlkkan: ID-based tracking — no coordinate updates needed, ID travels with piece
      {
        const movingPieceId = getDerivedBoard(game)[from[0]][from[1]]?.id ?? null;
        const myIlkId = movingColor === "white" ? whiteIlkkanId : blackIlkkanId;
        const setMyIlkId =
          movingColor === "white" ? setWhiteIlkkanId : setBlackIlkkanId;
        if (movingPieceId && movingPieceId === myIlkId) {
          if (
            !victimWasMercenary &&
            (capturedType === "R" ||
              capturedType === "B" ||
              capturedType === "N")
          ) {
            // İlkkan pawn transforms into the captured piece — strip ID (no longer a pawn)
            const nb2 = cloneBoard(getDerivedBoard(newGame));
            nb2[to[0]][to[1]] = { type: capturedType, color: movingColor };
            newGame = syncStateFromBoard({ ...newGame }, nb2);
            setMyIlkId(null);
          } else if (promotion) {
            // İlkkan pawn promoted — engine already replaced piece, clear tracking
            setMyIlkId(null);
          }
          // else: normal move — ID already traveled with piece via { ...piece } in applyMoveToBoard
        }
        // Clear enemy ilkkan if their pawn was captured (regular capture or en passant)
        const isEP =
          getDerivedBoard(game)[from[0]][from[1]]?.type === "P" &&
          from[1] !== to[1] &&
          !getDerivedBoard(game)[to[0]][to[1]];
        const capturedPieceId = isEP
          ? (getDerivedBoard(game)[from[0]][to[1]]?.id ?? null)
          : (getDerivedBoard(game)[to[0]][to[1]]?.id ?? null);
        const enemyIlkId =
          movingColor === "white" ? blackIlkkanId : whiteIlkkanId;
        const setEnemyIlkId =
          movingColor === "white" ? setBlackIlkkanId : setWhiteIlkkanId;
        if (capturedPieceId && capturedPieceId === enemyIlkId)
          setEnemyIlkId(null);
      }

      // Internal Combustion runs after mercenary ticks (see end of executeMove).

      // Gold from capture (blocked by peace treaty; Prize Money / Efficient)
      if (capturedType && peaceTreatyMovesLeft <= 0 && !victimWasMercenary) {
        let captureBonus = 1;
        if (playerAugs.some((a) => a.id === "efficient")) captureBonus += 1;
        const prizeDone =
          movingColor === "white"
            ? whitePrizeFirstCaptureDone
            : blackPrizeFirstCaptureDone;
        if (playerAugs.some((a) => a.id === "prize-money") && !prizeDone) {
          captureBonus *= 2;
          if (movingColor === "white") setWhitePrizeFirstCaptureDone(true);
          else setBlackPrizeFirstCaptureDone(true);
        }
        newGame = {
          ...newGame,
          goldWhite:
            movingColor === "white"
              ? newGame.goldWhite + captureBonus
              : newGame.goldWhite,
          goldBlack:
            movingColor === "black"
              ? newGame.goldBlack + captureBonus
              : newGame.goldBlack,
        };
      }

      // Peace treaty countdown
      if (peaceTreatyMovesLeft > 0) setPeaceTreatyMovesLeft((n) => n - 1);

      // Contract Killer — 4× payout when you capture the marked piece; consume augment when resolved
      {
        const capId = newGame.lastMove?.captured?.id ?? null;
        const settleWhiteContract = () => {
          setWhiteContractTarget(null);
          setWhiteContractPieceId(null);
          setWhiteAugments((prev) => prev.filter((a) => a.id !== "contract-killer"));
        };
        const settleBlackContract = () => {
          setBlackContractTarget(null);
          setBlackContractPieceId(null);
          setBlackAugments((prev) => prev.filter((a) => a.id !== "contract-killer"));
        };
        if (whiteContractPieceId) {
          let cleared = false;
          if (
            capturedType &&
            capturedType !== "K" &&
            movingColor === "white"
          ) {
            const hitId = capId === whiteContractPieceId;
            const wCT = whiteContractTarget;
            const hitSq =
              wCT && wCT[0] === to[0] && wCT[1] === to[1];
            if (hitId || hitSq) {
              const bonus = (PIECE_VALUE[capturedType] ?? 1) * 4;
              newGame = { ...newGame, goldWhite: newGame.goldWhite + bonus };
              settleWhiteContract();
              cleared = true;
            }
          }
          if (
            !cleared &&
            capId === whiteContractPieceId &&
            movingColor === "black"
          ) {
            settleWhiteContract();
            cleared = true;
          }
          if (!cleared) {
            const pos = findSquareByPieceId(
              getDerivedBoard(newGame),
              whiteContractPieceId,
            );
            if (pos) setWhiteContractTarget(pos);
            else settleWhiteContract();
          }
        }
        if (blackContractPieceId) {
          let cleared = false;
          if (
            capturedType &&
            capturedType !== "K" &&
            movingColor === "black"
          ) {
            const hitId = capId === blackContractPieceId;
            const bCT = blackContractTarget;
            const hitSq =
              bCT && bCT[0] === to[0] && bCT[1] === to[1];
            if (hitId || hitSq) {
              const bonus = (PIECE_VALUE[capturedType] ?? 1) * 4;
              newGame = { ...newGame, goldBlack: newGame.goldBlack + bonus };
              settleBlackContract();
              cleared = true;
            }
          }
          if (
            !cleared &&
            capId === blackContractPieceId &&
            movingColor === "white"
          ) {
            settleBlackContract();
            cleared = true;
          }
          if (!cleared) {
            const pos = findSquareByPieceId(
              getDerivedBoard(newGame),
              blackContractPieceId,
            );
            if (pos) setBlackContractTarget(pos);
            else settleBlackContract();
          }
        }
      }

      // ── Event trigger (full round = after black completes a half-move) ───
      if (movingColor === "black") {
        const fullRoundsCompleted = newTurnCount;
        if (fullRoundsCompleted >= nextEventTurn) {
          const event = rollEvent();
          if (event.id === "golden-age") {
            newGame = {
              ...newGame,
              goldWhite: newGame.goldWhite + 10,
              goldBlack: newGame.goldBlack + 10,
            };
          } else if (event.id === "stock-crash") {
            let nw = newGame.goldWhite - 10;
            let nb = newGame.goldBlack - 10;
            if (whiteAugments.some((a) => a.id === "anticipation"))
              nw = newGame.goldWhite;
            if (blackAugments.some((a) => a.id === "anticipation"))
              nb = newGame.goldBlack;
            newGame = {
              ...newGame,
              goldWhite: Math.max(0, nw),
              goldBlack: Math.max(0, nb),
            };
          } else if (event.id === "peace-treaty") {
            setPeaceTreatyMovesLeft(10);
          } else if (event.id === "tactical-nuke") {
            const bs = getDerivedBoard(newGame).length;
            const topRow = Math.floor(Math.random() * (bs - 2));
            const leftCol = Math.floor(Math.random() * (bs - 2));
            setActiveNuke({ topRow, leftCol, movesLeft: 10 });
          } else if (event.id === "red-wedding") {
            const nb = cloneBoard(getDerivedBoard(newGame));
            const bs = nb.length;
            const wPawns: [number, number][] = [];
            const bPawns: [number, number][] = [];
            for (let r = 0; r < bs; r++)
              for (let c = 0; c < bs; c++) {
                if (nb[r][c]?.type === "P" && nb[r][c]?.color === "white")
                  wPawns.push([r, c]);
                if (nb[r][c]?.type === "P" && nb[r][c]?.color === "black")
                  bPawns.push([r, c]);
              }
            for (let i = wPawns.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [wPawns[i], wPawns[j]] = [wPawns[j], wPawns[i]];
            }
            for (let i = bPawns.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [bPawns[i], bPawns[j]] = [bPawns[j], bPawns[i]];
            }
            for (const [r, c] of wPawns.slice(0, 2)) nb[r][c] = null;
            for (const [r, c] of bPawns.slice(0, 2)) nb[r][c] = null;
            newGame = recomputeStatus(syncStateFromBoard({ ...newGame }, nb));
          } else if (event.id === "just-chaos") {
            setChaosEventTiming(true);
          } else if (event.id === "great-wall-of-hatay") {
            const bsW = getDerivedBoard(newGame).length;
            const wallOptions: { row: number; col: number }[][] = [];
            for (let row = 0; row < bsW; row++)
              for (let c = 0; c <= bsW - 3; c++) {
                if (
                  !getDerivedBoard(newGame)[row][c] &&
                  !getDerivedBoard(newGame)[row][c + 1] &&
                  !getDerivedBoard(newGame)[row][c + 2]
                )
                  wallOptions.push([
                    { row, col: c },
                    { row, col: c + 1 },
                    { row, col: c + 2 },
                  ]);
              }
            for (let col = 0; col < bsW; col++)
              for (let rr = 0; rr <= bsW - 3; rr++) {
                if (
                  !getDerivedBoard(newGame)[rr][col] &&
                  !getDerivedBoard(newGame)[rr + 1][col] &&
                  !getDerivedBoard(newGame)[rr + 2][col]
                )
                  wallOptions.push([
                    { row: rr, col },
                    { row: rr + 1, col },
                    { row: rr + 2, col },
                  ]);
              }
            if (wallOptions.length > 0) {
              const chosen =
                wallOptions[Math.floor(Math.random() * wallOptions.length)];
              setWallSquares(chosen);
              setWallMovesLeft(4);
            }
          } else if (event.id === "blessed-waters") {
            const bs2 = getDerivedBoard(newGame).length;
            const off2 = (bs2 - 8) / 2;
            const minRow = 2 + off2,
              maxRow = 5 + off2;
            const bRow =
              minRow + Math.floor(Math.random() * (maxRow - minRow + 1));
            const bCol = Math.floor(Math.random() * bs2);
            setBlessedSquares((prev) => [
              ...prev,
              { row: bRow, col: bCol, movesLeft: 6 },
            ]);
        } else if (event.id === "lost-mercenary") {
          newGame = spawnLostMercenaryOnBoard(newGame, wallSquares);
        } else if (event.id === "mercenary-patrol") {
          newGame = spawnMercenaryPatrolKnights(newGame, wallSquares);
        } else if (event.id === "cold-winds") {
            const bs3 = getDerivedBoard(newGame).length;
            const wPcs: [number, number][] = [],
              blPcs: [number, number][] = [];
            for (let rr = 0; rr < bs3; rr++)
              for (let cc = 0; cc < bs3; cc++) {
                const p = getDerivedBoard(newGame)[rr][cc];
                if (p && p.type !== "K" && p.type !== "M" && p.color === "white")
                  wPcs.push([rr, cc]);
                if (p && p.type !== "K" && p.type !== "M" && p.color === "black")
                  blPcs.push([rr, cc]);
              }
            const shuf = (a: [number, number][]) => {
              for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
              }
              return a;
            };
            setColdWindsSquares([
              ...shuf(wPcs).slice(0, 2),
              ...shuf(blPcs).slice(0, 2),
            ]);
            setColdWindsMovesLeft(2);
          }
          setPendingEvent(event);
          const chaosAfter =
            event.id === "just-chaos" ? true : chaosEventTiming;
          const delayRounds = rollFullRoundsUntilNextEvent(chaosAfter);
          setNextEventTurn(fullRoundsCompleted + delayRounds);
        }
      }

      // Death Note: timers tick each half-move; kills cursed piece by ID when expired
      let updatedDN = deathNoteTargets;
      updatedDN = updatedDN.map((dn) => ({
        ...dn,
        turnsLeft: dn.turnsLeft - 1,
      }));
      let dnBoard = getDerivedBoard(newGame);
      let dnChanged = false;
      updatedDN = updatedDN.filter((dn) => {
        if (dn.turnsLeft > 0) return true;
        const pos = findSquareByPieceId(dnBoard, dn.pieceId);
        if (!pos) return false;
        const [rr, cc] = pos;
        const p = dnBoard[rr]?.[cc];
        if (p && p.color === dn.targetColor && p.type !== "K") {
          if (!dnChanged) {
            dnBoard = cloneBoard(dnBoard);
            dnChanged = true;
          }
          dnBoard[rr][cc] = null;
        }
        return false;
      });
      if (dnChanged) newGame = recomputeStatus(syncStateFromBoard({ ...newGame }, dnBoard));
      setDeathNoteTargets(updatedDN);

      // Nuke countdown
      if (activeNuke) {
        if (activeNuke.movesLeft <= 1) {
          const nb2 = cloneBoard(getDerivedBoard(newGame));
          for (let nr = activeNuke.topRow; nr < activeNuke.topRow + 3; nr++)
            for (let nc = activeNuke.leftCol; nc < activeNuke.leftCol + 3; nc++)
              if (nb2[nr]?.[nc]?.type !== "K") nb2[nr][nc] = null;
          newGame = recomputeStatus(syncStateFromBoard({ ...newGame }, nb2));
          setActiveNuke(null);
        } else {
          setActiveNuke((prev) =>
            prev ? { ...prev, movesLeft: prev.movesLeft - 1 } : null,
          );
        }
      }

      // Blessed squares decrement (filter out expired)
      setBlessedSquares((prev) =>
        prev
          .map((b) => ({ ...b, movesLeft: b.movesLeft - 1 }))
          .filter((b) => b.movesLeft > 0),
      );

      // Cold Winds decrement
      if (coldWindsMovesLeft > 0) {
        if (coldWindsMovesLeft <= 1) {
          setColdWindsSquares([]);
          setColdWindsMovesLeft(0);
        } else setColdWindsMovesLeft((n) => n - 1);
      }

      // Great Wall decrement
      if (wallMovesLeft > 0) {
        if (wallMovesLeft <= 1) {
          setWallSquares([]);
          setWallMovesLeft(0);
        } else setWallMovesLeft((n) => n - 1);
      }

      // Puppet: clear forced state after the puppet player moves
      if (activePuppetColor === movingColor) {
        setActivePuppetSquare(null);
        setActivePuppetColor(null);
      }

      let boardAfterMerc = newGame;
      if (movingColor === "black") {
        const mercCtx = {
          wallSquares,
          frozenSquare,
          coldWindsSquares,
          coldWindsMovesLeft,
          blessedSquares,
        };
        boardAfterMerc = applyLostMercenaryAfterFullMove(boardAfterMerc, mercCtx);
        boardAfterMerc = applyMercenaryPatrolAfterFullMove(boardAfterMerc, mercCtx);
      }

      const icSide = boardAfterMerc.turn;
      const icAugs = icSide === "white" ? whiteAugments : blackAugments;
      const icUsedNow = icSide === "white" ? whiteIcUsed : blackIcUsed;
      if (
        boardAfterMerc.status === "check" &&
        icAugs.some((a) => a.id === "internal-combustion") &&
        !icUsedNow
      ) {
        const checker = findCheckingPiece(getDerivedBoard(boardAfterMerc), icSide);
        if (checker) {
          const nbIc = cloneBoard(getDerivedBoard(boardAfterMerc));
          nbIc[checker[0]][checker[1]] = null;
          boardAfterMerc = recomputeStatus(
            syncStateFromBoard({ ...boardAfterMerc }, nbIc),
          );
          if (icSide === "white") setWhiteIcUsed(true);
          else setBlackIcUsed(true);
        }
      }

      let finalGame = boardAfterMerc;
      if (finalGame.status === "check" && finalGame.turn !== movingColor) {
        const dangerStacks = playerAugs.filter((a) => a.id === "i-am-danger")
          .length;
        if (dangerStacks > 0) {
          const g = 4 * dangerStacks;
          finalGame = {
            ...finalGame,
            goldWhite:
              movingColor === "white"
                ? finalGame.goldWhite + g
                : finalGame.goldWhite,
            goldBlack:
              movingColor === "black"
                ? finalGame.goldBlack + g
                : finalGame.goldBlack,
          };
        }
      }
      const thiefStacks = playerAugs.filter((a) => a.id === "thief").length;
      if (thiefStacks > 0 && Math.random() < 0.01 * thiefStacks) {
        finalGame = {
          ...finalGame,
          goldWhite:
            movingColor === "white"
              ? finalGame.goldWhite + 50
              : finalGame.goldWhite,
          goldBlack:
            movingColor === "black"
              ? finalGame.goldBlack + 50
              : finalGame.goldBlack,
        };
      }
      const oppC = opp(movingColor);
      const oppGoldStart =
        oppC === "white" ? startGoldWhite : startGoldBlack;
      const oppGoldEnd =
        oppC === "white" ? finalGame.goldWhite : finalGame.goldBlack;
      const oppDelta = oppGoldEnd - oppGoldStart;
      if (oppDelta > 0) {
        const taxStacks = playerAugs.filter((a) => a.id === "tax-man").length;
        if (taxStacks > 0) {
          const tg = Math.floor(oppDelta / 10) * taxStacks;
          if (tg > 0) {
            finalGame = {
              ...finalGame,
              goldWhite:
                movingColor === "white"
                  ? finalGame.goldWhite + tg
                  : finalGame.goldWhite,
              goldBlack:
                movingColor === "black"
                  ? finalGame.goldBlack + tg
                  : finalGame.goldBlack,
            };
          }
        }
      }
      if (augmentSpellBlockedFor && movingColor === augmentSpellBlockedFor)
        setAugmentSpellBlockedFor(null);

      setGame(finalGame);

      // Triggers
      const newTriggers: AugmentTrigger[] = [];

      if (
        capturedType === "N" &&
        !victimWasMercenary &&
        newTurnCount <= 4 &&
        playerAugs.some((a) => a.id === "blind-rage")
      ) {
        const brDone =
          movingColor === "white" ? whiteBlindRageDone : blackBlindRageDone;
        if (!brDone) {
          newTriggers.push({ color: movingColor, reason: "blind-rage" });
          if (movingColor === "white") setWhiteBlindRageDone(true);
          else setBlackBlindRageDone(true);
        }
      }

      if (capturedType && !victimWasMercenary) {
        const ms = movingColor === "white" ? whiteMilestones : blackMilestones;
        const triggered = checkNewMilestone(capturedType, ms);
        if (triggered) {
          const newMs = applyMilestone(triggered, ms);
          if (movingColor === "white") setWhiteMilestones(newMs);
          else setBlackMilestones(newMs);
          newTriggers.push({
            color: movingColor,
            reason: "milestone",
            milestoneType: triggered,
          });
        }
      }
      if (capturedType && playerAugs.some((a) => a.id === "bloodlust")) {
        const newCount =
          (movingColor === "white" ? whiteCaptureCount : blackCaptureCount) + 1;
        if (movingColor === "white") setWhiteCaptureCount(newCount);
        else setBlackCaptureCount(newCount);
        const nextThreshold =
          movingColor === "white" ? whiteBloodlustNext : blackBloodlustNext;
        if (newCount >= nextThreshold) {
          if (movingColor === "white") setWhiteBloodlustNext((t) => t + 4);
          else setBlackBloodlustNext((t) => t + 4);
          newTriggers.push({ color: movingColor, reason: "bloodlust" });
        }
      } else if (capturedType) {
        const newCount =
          (movingColor === "white" ? whiteCaptureCount : blackCaptureCount) + 1;
        if (movingColor === "white") setWhiteCaptureCount(newCount);
        else setBlackCaptureCount(newCount);
      }

      if (newTriggers.length > 0) {
        const [first, ...rest] = newTriggers;
        const wAugs =
          movingColor === "white" ? [...whiteAugments] : whiteAugments;
        const bAugs =
          movingColor === "black" ? [...blackAugments] : blackAugments;
        setCurrentTrigger(first);
        setMidGameOffered(
          rollAugments(
            pickAugmentCount(movingColor === "white" ? wAugs : bAugs),
            getExcludeForPlayer(movingColor === "white" ? wAugs : bAugs),
            getWeightsForPlayer(movingColor === "white" ? wAugs : bAugs),
          ),
        );
        if (rest.length > 0) setAugmentQueue((prev) => [...prev, ...rest]);
      }
      requestSnapshot();
    },
    [
      game,
      frozenSquare,
      frozenExpireAfter,
      whiteTurnCount,
      blackTurnCount,
      whiteAugments,
      blackAugments,
      whiteMilestones,
      blackMilestones,
      whiteIcUsed,
      blackIcUsed,
      whiteCaptureCount,
      blackCaptureCount,
      whiteBloodlustNext,
      blackBloodlustNext,
      deathNoteTargets,
      peaceTreatyMovesLeft,
      nextEventTurn,
      activeNuke,
      coldWindsMovesLeft,
      coldWindsSquares,
      whiteContractTarget,
      blackContractTarget,
      whiteContractPieceId,
      blackContractPieceId,
      wallMovesLeft,
      wallSquares,
      blessedSquares,
      activePuppetColor,
      activePuppetSquare,
      chaosEventTiming,
      requestSnapshot,
      whiteIlkkanId,
      blackIlkkanId,
      whitePrizeFirstCaptureDone,
      blackPrizeFirstCaptureDone,
      whiteBlindRageDone,
      blackBlindRageDone,
      whiteEvadeCharges,
      blackEvadeCharges,
      augmentSpellBlockedFor,
      whitePawnShopBuys,
      blackPawnShopBuys,
    ],
  );

  // ── Undo ─────────────────────────────────────────────────────────────────

  const handleUndo = useCallback(() => {
    if (gameHistory.length < 2) return;
    const restored = gameHistory[gameHistory.length - 2];
    const augRestored = augmentHistory[augmentHistory.length - 2];
    // Cancel domain expansion if the restored board is smaller than current
    if (restored.occupancy.length < game.occupancy.length) {
      setBoardExpanded(false);
      setBoardSize(8);
    }
    setGame(restored);
    setBoardSize(restored.occupancy.length);
    setGameHistory((h) => h.slice(0, -2));
    setAugmentHistory((h) => h.slice(0, -2));
    if (augRestored) {
      setFrozenSquare(augRestored.frozenSquare);
      setFrozenExpireAfter(augRestored.frozenExpireAfter);
      setDeathNoteTargets(normalizeDeathNoteTargets(augRestored.deathNoteTargets));
      setActivePuppetSquare(augRestored.activePuppetSquare);
      setActivePuppetColor(augRestored.activePuppetColor);
      setWhiteContractTarget(augRestored.whiteContractTarget);
      setBlackContractTarget(augRestored.blackContractTarget);
      setWhiteContractPieceId(augRestored.whiteContractPieceId ?? null);
      setBlackContractPieceId(augRestored.blackContractPieceId ?? null);
      setWhiteIlkkanId(augRestored.whiteIlkkanId);
      setBlackIlkkanId(augRestored.blackIlkkanId);
      setBlessedSquares(augRestored.blessedSquares);
      setColdWindsSquares(augRestored.coldWindsSquares);
      setColdWindsMovesLeft(augRestored.coldWindsMovesLeft);
      setWallSquares(augRestored.wallSquares);
      setWallMovesLeft(augRestored.wallMovesLeft);
      setActiveNuke(augRestored.activeNuke);
      setPeaceTreatyMovesLeft(augRestored.peaceTreatyMovesLeft);
      setWhiteLostPawnCols(augRestored.whiteLostPawnCols);
      setBlackLostPawnCols(augRestored.blackLostPawnCols);
      setWhiteCaptureCount(augRestored.whiteCaptureCount);
      setBlackCaptureCount(augRestored.blackCaptureCount);
      setWhiteBloodlustNext(augRestored.whiteBloodlustNext);
      setBlackBloodlustNext(augRestored.blackBloodlustNext);
      setWhiteLostMinors(augRestored.whiteLostMinors);
      setBlackLostMinors(augRestored.blackLostMinors);
      setNextEventTurn(augRestored.nextEventTurn);
      setChaosEventTiming(
        typeof (augRestored as { chaosEventTiming?: boolean }).chaosEventTiming ===
          "boolean"
          ? (augRestored as { chaosEventTiming: boolean }).chaosEventTiming
          : (augRestored as { eventInterval?: number }).eventInterval === 10,
      );
      setWhitePrizeFirstCaptureDone(
        (augRestored as { whitePrizeFirstCaptureDone?: boolean })
          .whitePrizeFirstCaptureDone ?? false,
      );
      setBlackPrizeFirstCaptureDone(
        (augRestored as { blackPrizeFirstCaptureDone?: boolean })
          .blackPrizeFirstCaptureDone ?? false,
      );
      setWhiteBlindRageDone(
        (augRestored as { whiteBlindRageDone?: boolean }).whiteBlindRageDone ??
          false,
      );
      setBlackBlindRageDone(
        (augRestored as { blackBlindRageDone?: boolean }).blackBlindRageDone ??
          false,
      );
      setWhiteEvadeCharges(
        (augRestored as { whiteEvadeCharges?: number }).whiteEvadeCharges ?? 0,
      );
      setBlackEvadeCharges(
        (augRestored as { blackEvadeCharges?: number }).blackEvadeCharges ?? 0,
      );
      setAugmentSpellBlockedFor(
        (augRestored as { augmentSpellBlockedFor?: Color | null })
          .augmentSpellBlockedFor ?? null,
      );
      setWhitePawnShopBuys(
        (augRestored as { whitePawnShopBuys?: number }).whitePawnShopBuys ?? 0,
      );
      setBlackPawnShopBuys(
        (augRestored as { blackPawnShopBuys?: number }).blackPawnShopBuys ?? 0,
      );
    }
    setSelected(null);
    setValidMoves([]);
    setFreezeMode(false);
    setNecroMode(false);
    setRoyalEdMode(false);
    setWhatMode(false);
    setWhatSelected(null);
    if (game.turn === "white") {
      setWhiteUndosLeft((u) => u - 1);
      setWhiteTurnCount((c) => Math.max(0, c - 1));
      setBlackTurnCount((c) => Math.max(0, c - 1));
    } else {
      setBlackUndosLeft((u) => u - 1);
      setBlackTurnCount((c) => Math.max(0, c - 1));
      setWhiteTurnCount((c) => Math.max(0, c - 1));
    }
  }, [game, gameHistory, augmentHistory]);

  // ── Mode toggles ─────────────────────────────────────────────────────────

  const clearModes = (opts?: { preserveIlkkan?: boolean; preserveSwap?: boolean }) => {
    setFreezeMode(false);
    setNecroMode(false);
    setNecroPlusMode(false);
    if (!opts?.preserveIlkkan) setIlkkanMode(false);
    setRoyalEdMode(false);
    setWhatMode(false);
    setWhatSelected(null);
    setSakoMode(false);
    setSakoSelected(null);
    if (!opts?.preserveSwap) {
      setSwapMode(false);
      setSwapFirst(null);
    }
    setRoyalHouseholdMode(false);
    setDeathNoteMode(false);
    setMonolithMode(null);
    setContractMode(false);
    setBlessedWaterMode(false);
    setPuppetMode(false);
    setPawnPlaceFor(null);
    setSelected(null);
    setValidMoves([]);
  };

  const handleToggleFreeze = useCallback(() => {
    const e = !freezeMode;
    clearModes();
    setFreezeMode(e);
  }, [freezeMode]);
  const handleToggleNecro = useCallback(() => {
    const entering = !necroMode;
    clearModes();
    setNecroMode(entering);
    if (entering) {
      const lostCols =
        game.turn === "white" ? whiteLostPawnCols : blackLostPawnCols;
      const bs = getDerivedBoard(game).length;
      const off = (bs - 8) / 2;
      const homeRow = game.turn === "white" ? 6 + off : 1 + off;
      setValidMoves(
        lostCols
          .filter((col) => getDerivedBoard(game)[homeRow] && !getDerivedBoard(game)[homeRow][col])
          .map((col) => [homeRow, col] as [number, number]),
      );
    }
  }, [necroMode, game, whiteLostPawnCols, blackLostPawnCols]);
  const handleToggleRoyalEd = useCallback(() => {
    const entering = !royalEdMode;
    clearModes();
    setRoyalEdMode(entering);
    if (entering) {
      const { kingPos, dests } = getRoyalEdMoves(game, game.turn);
      if (dests.length > 0) {
        setSelected(kingPos);
        setValidMoves(dests);
      } else setRoyalEdMode(false);
    }
  }, [royalEdMode, game]);
  const handleToggleWhat = useCallback(() => {
    const e = !whatMode;
    clearModes();
    setWhatMode(e);
  }, [whatMode]);
  const handleToggleSako = useCallback(() => {
    const e = !sakoMode;
    clearModes();
    setSakoMode(e);
  }, [sakoMode]);
  const handleToggleSwap = useCallback(() => {
    const entering = !swapMode;
    clearModes({ preserveSwap: true });
    setSwapMode(entering);
    if (entering) {
      const bs = getDerivedBoard(game);
      const isCw = (rr: number, cc: number) =>
        coldWindsMovesLeft > 0 &&
        coldWindsSquares.some(([fr, fc]) => fr === rr && fc === cc);
      const sqBlocked = (rr: number, cc: number) => {
        const p2 = bs[rr][cc];
        if (!p2 || p2.color !== game.turn) return true;
        if (frozenSquare?.[0] === rr && frozenSquare?.[1] === cc) return true;
        if (isCw(rr, cc)) return true;
        return false;
      };
      const own: [number, number][] = [];
      bs.forEach((row, rr) =>
        row.forEach((p, cc) => {
          if (p && p.color === game.turn && !sqBlocked(rr, cc)) own.push([rr, cc]);
        }),
      );
      if (own.length < 2) {
        setSwapMode(false);
        setValidMoves([]);
        return;
      }
      setValidMoves(own);
    }
  }, [swapMode, game, frozenSquare, coldWindsMovesLeft, coldWindsSquares]);
  const handleToggleRoyalHousehold = useCallback(() => {
    const entering = !royalHouseholdMode;
    clearModes();
    setRoyalHouseholdMode(entering);
    if (entering) {
      const dests = getRoyalHouseholdDests(game, game.turn);
      if (dests.length > 0) {
        setValidMoves(dests);
      } else setRoyalHouseholdMode(false);
    }
  }, [royalHouseholdMode, game]);
  const handleToggleShop = useCallback(() => {
    setShopOpen((s) => !s);
    clearModes();
  }, []);
  const handleToggleDeathNote = useCallback(() => {
    const e = !deathNoteMode;
    clearModes();
    setDeathNoteMode(e);
  }, [deathNoteMode]);
  const handleToggleMonolithPlace = useCallback(() => {
    const e = monolithMode !== "place";
    clearModes();
    if (e) setMonolithMode("place");
  }, [monolithMode]);
  const handleToggleMonolithRemove = useCallback(() => {
    const e = monolithMode !== "remove";
    clearModes();
    if (e) setMonolithMode("remove");
  }, [monolithMode]);
  const handleToggleIlkkan = useCallback(() => {
    const entering = !ilkkanMode;
    clearModes({ preserveIlkkan: true });
    setIlkkanMode(entering);
    if (entering) {
      const pawns: [number, number][] = [];
      getDerivedBoard(game).forEach((row, r) =>
        row.forEach((p, c) => {
          if (p?.type === "P" && p.color === game.turn) pawns.push([r, c]);
        }),
      );
      setValidMoves(pawns);
    }
  }, [ilkkanMode, game]);
  const handleToggleNecroPlus = useCallback(() => {
    const entering = !necroPlusMode;
    clearModes();
    setNecroPlusMode(entering);
    if (entering) {
      const _bs = getDerivedBoard(game).length;
      const _off = (_bs - 8) / 2;
      const backRow = game.turn === "white" ? 7 + _off : _off;
      const validSquares: [number, number][] = [];
      for (let c = 0; c < _bs; c++)
        if (!getDerivedBoard(game)[backRow]?.[c]) validSquares.push([backRow, c]);
      setValidMoves(validSquares);
    }
  }, [necroPlusMode, game]);
  const handleToggleContract = useCallback(() => {
    const e = !contractMode;
    clearModes();
    setContractMode(e);
  }, [contractMode]);
  const handleToggleBlessedWater = useCallback(() => {
    const e = !blessedWaterMode;
    clearModes();
    setBlessedWaterMode(e);
  }, [blessedWaterMode]);
  const handleTogglePuppet = useCallback(() => {
    const e = !puppetMode;
    clearModes();
    setPuppetMode(e);
  }, [puppetMode]);
  const handleDomainExpansion = useCallback(() => {
    if (boardExpanded) return;
    setBoardSize(10);
    const expanded = expandGameBoard(game);
    setGame(recomputeStatus(expanded));
    setBoardExpanded(true);
    if (game.turn === "white") setWhiteDomainUsed(true);
    else setBlackDomainUsed(true);
    if (frozenSquare)
      setFrozenSquare([frozenSquare[0] + 1, frozenSquare[1] + 1]);
    const expBoard = getDerivedBoard(expanded);
    if (whiteContractPieceId) {
      const p = findSquareByPieceId(expBoard, whiteContractPieceId);
      if (p) setWhiteContractTarget(p);
    }
    if (blackContractPieceId) {
      const p = findSquareByPieceId(expBoard, blackContractPieceId);
      if (p) setBlackContractTarget(p);
    }
    setActiveNuke((prev) =>
      prev
        ? { ...prev, topRow: prev.topRow + 1, leftCol: prev.leftCol + 1 }
        : null,
    );
    setBlessedSquares((prev) =>
      prev.map((b) => ({ ...b, row: b.row + 1, col: b.col + 1 })),
    );
    setColdWindsSquares((prev) =>
      prev.map(([r2, c2]) => [r2 + 1, c2 + 1] as [number, number]),
    );
    setWallSquares((prev) =>
      prev.map((w) => ({ row: w.row + 1, col: w.col + 1 })),
    );
    if (activePuppetSquare)
      setActivePuppetSquare([
        activePuppetSquare[0] + 1,
        activePuppetSquare[1] + 1,
      ]);
    setWhiteLostPawnCols((prev) => prev.map((c) => c + 1));
    setBlackLostPawnCols((prev) => prev.map((c) => c + 1));
    if (selected) setSelected([selected[0] + 1, selected[1] + 1]);
    if (sakoSelected)
      setSakoSelected([sakoSelected[0] + 1, sakoSelected[1] + 1]);
    if (swapFirst)
      setSwapFirst([swapFirst[0] + 1, swapFirst[1] + 1]);
    if (whatSelected)
      setWhatSelected([whatSelected[0] + 1, whatSelected[1] + 1]);
    setValidMoves((prev) => prev.map(([r, c]) => [r + 1, c + 1]));
    clearModes();
  }, [
    game,
    boardExpanded,
    frozenSquare,
    selected,
    sakoSelected,
    whatSelected,
    whiteContractPieceId,
    blackContractPieceId,
  ]);

  // ── Square click ─────────────────────────────────────────────────────────

  const isMyTurn = !mpConfig || game.turn === mpConfig.myColor;

  const handleSquareClick = useCallback(
    (r: number, c: number) => {
      if (phase !== "playing" || currentTrigger !== null) return;
      if (!isMyTurn) return;
      if (game.status === "checkmate" || game.status === "stalemate") return;
      if (promotionPending) return;
      const piece = getDerivedBoard(game)[r][c];

      if (pawnPlaceFor && game.turn === pawnPlaceFor) {
        if (
          !piece &&
          (pawnPlaceFor === "white" || pawnPlaceFor === "black") &&
          isOriginalPawnSpawnSquare(
            r,
            c,
            pawnPlaceFor,
            getDerivedBoard(game).length,
          )
        ) {
          const nb = cloneBoard(getDerivedBoard(game));
          nb[r][c] = { type: "P", color: pawnPlaceFor };
          setGame(recomputeStatus(syncStateFromBoard({ ...game }, nb)));
          setPawnPlaceFor(null);
          setSelected(null);
          setValidMoves([]);
          requestSnapshot();
        } else {
          setSelected(null);
          setValidMoves([]);
        }
        return;
      }

      if (monolithMode === "place") {
        if (!piece) {
          const movingColor = game.turn;
          const nb = cloneBoard(getDerivedBoard(game));
          nb[r][c] = { type: "M", color: movingColor };
          const newTurnCount =
            (movingColor === "white" ? whiteTurnCount : blackTurnCount) + 1;
          if (movingColor === "white") setWhiteTurnCount(newTurnCount);
          else setBlackTurnCount(newTurnCount);
          const playerAugsNow =
            movingColor === "white" ? whiteAugments : blackAugments;
          setGameHistory((h) => [...h, game]);
          setAugmentHistory((h) => [...h, {
            frozenSquare, frozenExpireAfter,
            deathNoteTargets,
            activePuppetSquare, activePuppetColor,
            whiteContractTarget, blackContractTarget,
            whiteContractPieceId, blackContractPieceId,
            whiteIlkkanId, blackIlkkanId,
            blessedSquares,
            coldWindsSquares, coldWindsMovesLeft,
            wallSquares, wallMovesLeft,
            activeNuke,
            peaceTreatyMovesLeft,
            whiteLostPawnCols, blackLostPawnCols,
            whiteCaptureCount, blackCaptureCount,
            whiteBloodlustNext, blackBloodlustNext,
            whiteLostMinors, blackLostMinors,
            nextEventTurn, chaosEventTiming,
            whitePrizeFirstCaptureDone,
            blackPrizeFirstCaptureDone,
            whiteBlindRageDone,
            blackBlindRageDone,
            whiteEvadeCharges,
            blackEvadeCharges,
            augmentSpellBlockedFor,
            whitePawnShopBuys,
            blackPawnShopBuys,
          }]);
          let newGState: ChessState = syncStateFromBoard(
            {
              ...game,
              turn: opp(movingColor),
              enPassantTarget: null,
              lastMove: {
                from: [r, c] as [number, number],
                to: [r, c] as [number, number],
                piece: { type: "M" as const, color: movingColor },
                captured: null,
              },
            },
            nb,
          );
          newGState = applyEndOfTurnEffects(
            newGState,
            movingColor,
            playerAugsNow,
            newTurnCount,
          );
          newGState = recomputeStatus(newGState);
          if (peaceTreatyMovesLeft > 0) setPeaceTreatyMovesLeft((n) => n - 1);
          setGame(newGState);
        }
        setMonolithMode(null);
        setSelected(null);
        setValidMoves([]);
        requestSnapshot();
        return;
      }

      if (monolithMode === "remove") {
        if (piece?.type === "M" && piece.color === game.turn) {
          const nb = cloneBoard(getDerivedBoard(game));
          nb[r][c] = null;
          setGame((g) => recomputeStatus(syncStateFromBoard({ ...g }, nb)));
          if (game.turn === "white") setWhiteMonolithPermRemoved(true);
          else setBlackMonolithPermRemoved(true);
        }
        setMonolithMode(null);
        setSelected(null);
        setValidMoves([]);
        requestSnapshot();
        return;
      }

      if (ilkkanMode) {
        if (
          piece &&
          piece.type === "P" &&
          piece.color === game.turn &&
          piece.id
        ) {
          if (game.turn === "white") {
            setWhiteIlkkanId(piece.id);
            setWhiteIlkkanChosen(true);
          } else {
            setBlackIlkkanId(piece.id);
            setBlackIlkkanChosen(true);
          }
        }
        setIlkkanMode(false);
        setSelected(null);
        setValidMoves([]);
        requestSnapshot();
        return;
      }

      if (necroPlusMode) {
        const playerColor = game.turn;
        const _bs = getDerivedBoard(game).length;
        const _off = (_bs - 8) / 2;
        const backRow = playerColor === "white" ? 7 + _off : _off;
        const lostMinorsArr =
          playerColor === "white" ? whiteLostMinors : blackLostMinors;
        if (r === backRow && !getDerivedBoard(game)[r][c] && lostMinorsArr.length > 0) {
          const pieceType = lostMinorsArr[lostMinorsArr.length - 1];
          const nb = cloneBoard(getDerivedBoard(game));
          nb[r][c] = { type: pieceType, color: playerColor };
          const newGState = recomputeStatus(
            syncStateFromBoard(
              {
                ...game,
                turn: opp(playerColor),
              },
              nb,
            ),
          );
          setGameHistory((h) => [...h, game]);
          setAugmentHistory((h) => [...h, {
            frozenSquare, frozenExpireAfter,
            deathNoteTargets,
            activePuppetSquare, activePuppetColor,
            whiteContractTarget, blackContractTarget,
            whiteContractPieceId, blackContractPieceId,
            whiteIlkkanId, blackIlkkanId,
            blessedSquares,
            coldWindsSquares, coldWindsMovesLeft,
            wallSquares, wallMovesLeft,
            activeNuke,
            peaceTreatyMovesLeft,
            whiteLostPawnCols, blackLostPawnCols,
            whiteCaptureCount, blackCaptureCount,
            whiteBloodlustNext, blackBloodlustNext,
            whiteLostMinors, blackLostMinors,
            nextEventTurn, chaosEventTiming,
            whitePrizeFirstCaptureDone,
            blackPrizeFirstCaptureDone,
            whiteBlindRageDone,
            blackBlindRageDone,
            whiteEvadeCharges,
            blackEvadeCharges,
            augmentSpellBlockedFor,
            whitePawnShopBuys,
            blackPawnShopBuys,
          }]);
          setGame(newGState);
          if (playerColor === "white") {
            setWhiteLostMinors((prev) => {
              const idx = prev.lastIndexOf(pieceType);
              if (idx === -1) return prev;
              const next = [...prev];
              next.splice(idx, 1);
              return next;
            });
            setWhiteNecroPlusCharges((n) => n - 1);
          } else {
            setBlackLostMinors((prev) => {
              const idx = prev.lastIndexOf(pieceType);
              if (idx === -1) return prev;
              const next = [...prev];
              next.splice(idx, 1);
              return next;
            });
            setBlackNecroPlusCharges((n) => n - 1);
          }
          requestSnapshot();
        }
        setNecroPlusMode(false);
        setSelected(null);
        setValidMoves([]);
        return;
      }

      if (contractMode) {
        if (
          piece &&
          piece.color !== game.turn &&
          piece.color !== "orange" &&
          piece.type !== "K" &&
          piece.type !== "P" &&
          piece.type !== "M" &&
          piece.id
        ) {
          const cid = piece.id;
          if (game.turn === "white") {
            setWhiteContractTarget([r, c]);
            setWhiteContractPieceId(cid);
          } else {
            setBlackContractTarget([r, c]);
            setBlackContractPieceId(cid);
          }
          setContractMode(false);
        }
        setSelected(null);
        setValidMoves([]);
        requestSnapshot();
        return;
      }

      if (blessedWaterMode) {
        setBlessedSquares((prev) => [
          ...prev,
          { row: r, col: c, movesLeft: 4 },
        ]);
        if (game.turn === "white") setWhiteBlessedWaterCharges((n) => n - 1);
        else setBlackBlessedWaterCharges((n) => n - 1);
        setBlessedWaterMode(false);
        setSelected(null);
        setValidMoves([]);
        requestSnapshot();
        return;
      }

      if (puppetMode) {
        if (
          piece &&
          piece.color !== game.turn &&
          piece.color !== "orange" &&
          piece.type !== "K" &&
          piece.type !== "M"
        ) {
          setActivePuppetSquare([r, c]);
          setActivePuppetColor(opp(game.turn));
          if (game.turn === "white") setWhitePuppetUsed(true);
          else setBlackPuppetUsed(true);
        }
        setPuppetMode(false);
        setSelected(null);
        setValidMoves([]);
        requestSnapshot();
        return;
      }

      if (deathNoteMode) {
        if (
          piece &&
          piece.color !== game.turn &&
          piece.type !== "K" &&
          piece.type !== "Q" &&
          piece.type !== "M" &&
          piece.id &&
          !isLostMercenaryPawn(piece)
        ) {
          const pid = piece.id;
          setDeathNoteTargets((prev) => [
            ...prev,
            {
              pieceId: pid,
              turnsLeft: 16,
              targetColor: piece.color,
            },
          ]);
          if (game.turn === "white") setWhiteDNUsed(true);
          else setBlackDNUsed(true);
        }
        setDeathNoteMode(false);
        setSelected(null);
        setValidMoves([]);
        requestSnapshot();
        return;
      }

      if (freezeMode) {
        if (piece && piece.color !== game.turn && piece.type !== "K") {
          setFrozenSquare([r, c]);
          setFrozenExpireAfter(opp(game.turn));
          if (game.turn === "white") setWhiteFreezeCharges((n) => n - 1);
          else setBlackFreezeCharges((n) => n - 1);
        }
        setFreezeMode(false);
        requestSnapshot();
        return;
      }

      if (necroMode) {
        const playerColor = game.turn;
        const _bs = getDerivedBoard(game).length;
        const _off = (_bs - 8) / 2;
        const homeRow = playerColor === "white" ? 6 + _off : 1 + _off;
        const lostCols =
          playerColor === "white" ? whiteLostPawnCols : blackLostPawnCols;
        if (
          lostCols.some((col) => col === c) &&
          r === homeRow &&
          !getDerivedBoard(game)[r][c]
        ) {
          const nb = cloneBoard(getDerivedBoard(game));
          nb[r][c] = { type: "P", color: playerColor };
          const newGState = recomputeStatus(
            syncStateFromBoard(
              {
                ...game,
                turn: opp(playerColor),
              },
              nb,
            ),
          );
          setGameHistory((h) => [...h, game]);
          setAugmentHistory((h) => [...h, {
            frozenSquare, frozenExpireAfter,
            deathNoteTargets,
            activePuppetSquare, activePuppetColor,
            whiteContractTarget, blackContractTarget,
            whiteContractPieceId, blackContractPieceId,
            whiteIlkkanId, blackIlkkanId,
            blessedSquares,
            coldWindsSquares, coldWindsMovesLeft,
            wallSquares, wallMovesLeft,
            activeNuke,
            peaceTreatyMovesLeft,
            whiteLostPawnCols, blackLostPawnCols,
            whiteCaptureCount, blackCaptureCount,
            whiteBloodlustNext, blackBloodlustNext,
            whiteLostMinors, blackLostMinors,
            nextEventTurn, chaosEventTiming,
            whitePrizeFirstCaptureDone,
            blackPrizeFirstCaptureDone,
            whiteBlindRageDone,
            blackBlindRageDone,
            whiteEvadeCharges,
            blackEvadeCharges,
            augmentSpellBlockedFor,
            whitePawnShopBuys,
            blackPawnShopBuys,
          }]);
          setGame(newGState);
          if (playerColor === "white") {
            setWhiteLostPawnCols((prev) => {
              const i = prev.indexOf(c);
              return i >= 0
                ? [...prev.slice(0, i), ...prev.slice(i + 1)]
                : prev;
            });
            setWhiteNecroCharges((n) => n - 1);
          } else {
            setBlackLostPawnCols((prev) => {
              const i = prev.indexOf(c);
              return i >= 0
                ? [...prev.slice(0, i), ...prev.slice(i + 1)]
                : prev;
            });
            setBlackNecroCharges((n) => n - 1);
          }
        }
        requestSnapshot();
        setNecroMode(false);
        setSelected(null);
        setValidMoves([]);
        return;
      }

      if (royalEdMode) {
        const isValid = validMoves.some(([vr, vc]) => vr === r && vc === c);
        if (isValid && selected) {
          const capturedType = getDerivedBoard(game)[r][c]?.type ?? null;
          executeMove(selected, [r, c], undefined, capturedType);
          if (game.turn === "white") setWhiteRoyalEdUsed(true);
          else setBlackRoyalEdUsed(true);
        }
        setRoyalEdMode(false);
        setSelected(null);
        setValidMoves([]);
        return;
      }

      if (swapMode) {
        const bs = getDerivedBoard(game);
        const isCwSq = (rr: number, cc: number) =>
          coldWindsMovesLeft > 0 &&
          coldWindsSquares.some(([fr, fc]) => fr === rr && fc === cc);
        const isOwnBlocked = (rr: number, cc: number) => {
          const p2 = bs[rr][cc];
          if (!p2 || p2.color !== game.turn) return true;
          if (frozenSquare?.[0] === rr && frozenSquare?.[1] === cc) return true;
          if (isCwSq(rr, cc)) return true;
          return false;
        };

        if (!swapFirst) {
          if (piece && piece.color === game.turn && !isOwnBlocked(r, c)) {
            const others: [number, number][] = [];
            bs.forEach((row, rr) =>
              row.forEach((p, cc) => {
                if (
                  p &&
                  p.color === game.turn &&
                  !(rr === r && cc === c) &&
                  !isOwnBlocked(rr, cc)
                )
                  others.push([rr, cc]);
              }),
            );
            if (others.length > 0) {
              setSwapFirst([r, c]);
              setSelected([r, c]);
              setValidMoves(others);
            } else {
              setSwapMode(false);
              setSwapFirst(null);
              setSelected(null);
              setValidMoves([]);
            }
          } else {
            setSwapMode(false);
            setSwapFirst(null);
            setSelected(null);
            setValidMoves([]);
          }
          return;
        }

        const [fr, fc] = swapFirst;
        const isValidSecond = validMoves.some(([vr, vc]) => vr === r && vc === c);
        if (isValidSecond && piece && piece.color === game.turn) {
          const nb = cloneBoard(bs);
          const pa = nb[fr][fc]!;
          const pb = nb[r][c]!;
          nb[fr][fc] = pb;
          nb[r][c] = pa;
          const cr = castlingRightsAfterSwap(game.castlingRights, nb);
          const merged = recomputeStatus(
            syncStateFromBoard(
              { ...game, enPassantTarget: null, castlingRights: cr },
              nb,
            ),
          );
          if (!isInCheck(merged, game.turn)) {
            setGame(merged);
            if (game.turn === "white") setWhiteSwapUsed(true);
            else setBlackSwapUsed(true);
            requestSnapshot();
            setSwapMode(false);
            setSwapFirst(null);
            setSelected(null);
            setValidMoves([]);
          }
        } else if (
          piece &&
          piece.color === game.turn &&
          !isOwnBlocked(r, c) &&
          !(r === fr && c === fc)
        ) {
          const others: [number, number][] = [];
          bs.forEach((row, rr) =>
            row.forEach((p, cc) => {
              if (
                p &&
                p.color === game.turn &&
                !(rr === r && cc === c) &&
                !isOwnBlocked(rr, cc)
              )
                others.push([rr, cc]);
            }),
          );
          if (others.length > 0) {
            setSwapFirst([r, c]);
            setSelected([r, c]);
            setValidMoves(others);
            return;
          }
        }
        setSwapMode(false);
        setSwapFirst(null);
        setSelected(null);
        setValidMoves([]);
        return;
      }

      if (sakoMode) {
        if (!sakoSelected) {
          if (piece && piece.color === game.turn) {
            const dests = getSakoMoves(game, [r, c], game.turn);
            if (dests.length > 0) {
              setSakoSelected([r, c]);
              setSelected([r, c]);
              setValidMoves(dests);
            } else {
              setSakoMode(false);
              setSakoSelected(null);
              setSelected(null);
              setValidMoves([]);
            }
          } else {
            setSakoMode(false);
            setSakoSelected(null);
            setSelected(null);
            setValidMoves([]);
          }
          return;
        }
        const isValid = validMoves.some(([vr, vc]) => vr === r && vc === c);
        if (isValid) {
          const movingPiece = getDerivedBoard(game)[sakoSelected[0]][sakoSelected[1]]!;
          const nb = cloneBoard(getDerivedBoard(game));
          nb[sakoSelected[0]][sakoSelected[1]] = null;
          nb[r][c] = movingPiece;
          const newGame = recomputeStatus(
            syncStateFromBoard(
              {
                ...game,
                enPassantTarget: null,
              },
              nb,
            ),
          );
          setGame(newGame);
          if (game.turn === "white") setWhiteSakoUsed(true);
          else setBlackSakoUsed(true);
          requestSnapshot();
        } else if (
          piece &&
          piece.color === game.turn &&
          !(r === sakoSelected[0] && c === sakoSelected[1])
        ) {
          const dests = getSakoMoves(game, [r, c], game.turn);
          if (dests.length > 0) {
            setSakoSelected([r, c]);
            setSelected([r, c]);
            setValidMoves(dests);
            return;
          }
        }
        setSakoMode(false);
        setSakoSelected(null);
        setSelected(null);
        setValidMoves([]);
        return;
      }

      if (royalHouseholdMode) {
        const isValid = validMoves.some(([vr, vc]) => vr === r && vc === c);
        if (isValid) {
          const movingColor = game.turn;
          const enemyColorRH = opp(movingColor);
          const [kr, kc] = findKing(game, movingColor);
          const dr = Math.sign(r - kr),
            dc = Math.sign(c - kc);
          // Detect enemy king anywhere in the rampage path (inclusive of dest)
          let enemyKingInPath = false;
          {
            let sc: [number, number] = [kr + dr, kc + dc];
            while (sc[0] !== r || sc[1] !== c) {
              if (
                getDerivedBoard(game)[sc[0]][sc[1]]?.type === "K" &&
                getDerivedBoard(game)[sc[0]][sc[1]]?.color === enemyColorRH
              )
                enemyKingInPath = true;
              sc = [sc[0] + dr, sc[1] + dc];
            }
            if (
              getDerivedBoard(game)[r][c]?.type === "K" &&
              getDerivedBoard(game)[r][c]?.color === enemyColorRH
            )
              enemyKingInPath = true;
          }
          const nb = cloneBoard(getDerivedBoard(game));
          nb[kr][kc] = null;
          let cur: [number, number] = [kr + dr, kc + dc];
          while (cur[0] !== r || cur[1] !== c) {
            nb[cur[0]][cur[1]] = null;
            cur = [cur[0] + dr, cur[1] + dc];
          }
          const kingMoved = getDerivedBoard(game)[kr][kc];
          nb[r][c] = kingMoved ? { ...kingMoved } : { type: "K", color: movingColor };
          setGameHistory((h) => [...h, game]);
          setAugmentHistory((h) => [...h, {
            frozenSquare, frozenExpireAfter,
            deathNoteTargets,
            activePuppetSquare, activePuppetColor,
            whiteContractTarget, blackContractTarget,
            whiteContractPieceId, blackContractPieceId,
            whiteIlkkanId, blackIlkkanId,
            blessedSquares,
            coldWindsSquares, coldWindsMovesLeft,
            wallSquares, wallMovesLeft,
            activeNuke,
            peaceTreatyMovesLeft,
            whiteLostPawnCols, blackLostPawnCols,
            whiteCaptureCount, blackCaptureCount,
            whiteBloodlustNext, blackBloodlustNext,
            whiteLostMinors, blackLostMinors,
            nextEventTurn, chaosEventTiming,
            whitePrizeFirstCaptureDone,
            blackPrizeFirstCaptureDone,
            whiteBlindRageDone,
            blackBlindRageDone,
            whiteEvadeCharges,
            blackEvadeCharges,
            augmentSpellBlockedFor,
            whitePawnShopBuys,
            blackPawnShopBuys,
          }]);
          setShopOpen(false);
          const newTurnCount =
            (movingColor === "white" ? whiteTurnCount : blackTurnCount) + 1;
          if (movingColor === "white") setWhiteTurnCount(newTurnCount);
          else setBlackTurnCount(newTurnCount);
          const playerAugsNow =
            movingColor === "white" ? whiteAugments : blackAugments;
          let newGame: ChessState = syncStateFromBoard(
            {
              ...game,
              turn: opp(movingColor),
              enPassantTarget: null,
              castlingRights: {
                ...game.castlingRights,
                white:
                  movingColor === "white"
                    ? { kingside: false, queenside: false }
                    : game.castlingRights.white,
                black:
                  movingColor === "black"
                    ? { kingside: false, queenside: false }
                    : game.castlingRights.black,
              },
              lastMove: {
                from: [kr, kc],
                to: [r, c],
                piece: kingMoved
                  ? { ...kingMoved }
                  : { type: "K", color: movingColor },
                captured: null,
              },
            },
            nb,
          );
          newGame = applyEndOfTurnEffects(
            newGame,
            movingColor,
            playerAugsNow,
            newTurnCount,
          );
          newGame = recomputeStatus(newGame);
          // Instant win if rampage killed the enemy king
          if (enemyKingInPath) newGame = { ...newGame, status: "checkmate" };
          setGame(newGame);
          if (movingColor === "white") setWhiteRoyalHouseholdUsed(true);
          else setBlackRoyalHouseholdUsed(true);
          requestSnapshot();
        }
        setRoyalHouseholdMode(false);
        setSelected(null);
        setValidMoves([]);
        return;
      }

      if (whatMode) {
        if (!whatSelected) {
          if (piece?.type === "P" && piece.color === game.turn) {
            const moves: [number, number][] = [];
            if (c > 0 && !getDerivedBoard(game)[r][c - 1]) moves.push([r, c - 1]);
            if (c < getDerivedBoard(game).length - 1 && !getDerivedBoard(game)[r][c + 1])
              moves.push([r, c + 1]);
            if (moves.length > 0) {
              setWhatSelected([r, c]);
              setSelected([r, c]);
              setValidMoves(moves);
            } else {
              setWhatMode(false);
              setWhatSelected(null);
              setSelected(null);
              setValidMoves([]);
            }
          } else {
            setWhatMode(false);
            setWhatSelected(null);
            setSelected(null);
            setValidMoves([]);
          }
          return;
        }
        const isValid = validMoves.some(([vr, vc]) => vr === r && vc === c);
        if (isValid) {
          executeMove(whatSelected, [r, c], undefined, null);
          if (game.turn === "white") setWhiteWhatUsed(true);
          else setBlackWhatUsed(true);
        }
        setWhatMode(false);
        setWhatSelected(null);
        setSelected(null);
        setValidMoves([]);
        return;
      }

      const playerAugsNow =
        game.turn === "white" ? whiteAugments : blackAugments;
      const hasAlternative = playerAugsNow.some((a) => a.id === "alternative");
      const isColdWindFrozen = (row: number, col: number) =>
        coldWindsMovesLeft > 0 &&
        coldWindsSquares.some(([fr, fc]) => fr === row && fc === col);
      const isFrozenPiece =
        (frozenSquare &&
          frozenSquare[0] === r &&
          frozenSquare[1] === c &&
          piece?.color === game.turn) ||
        (isColdWindFrozen(r, c) && piece?.color === game.turn);

      const computeMoves = (pr: number, pc: number): [number, number][] => {
        if (isColdWindFrozen(pr, pc)) return [];
        // Inject wall squares as M-pieces so rays/movement are properly blocked
        const gameForMoves =
          wallSquares.length > 0
            ? syncStateFromBoard(
                { ...game },
                getDerivedBoard(game).map((row2, ri) =>
                  row2.map((sq, ci) =>
                    wallSquares.some((w) => w.row === ri && w.col === ci)
                      ? { type: "M" as PieceType, color: "white" as Color }
                      : sq,
                  ),
                ),
              )
            : game;
        let moves = getLegalMoves(gameForMoves, pr, pc);
        const p = getDerivedBoard(game)[pr][pc];
        if (hasAlternative && p?.type === "P")
          for (const [er, ec] of getAlternativeMoves(game, pr, pc))
            if (!moves.some(([mr, mc]) => mr === er && mc === ec))
              moves.push([er, ec]);
        // Filter out captures of blessed pieces
        moves = moves.filter(
          ([tr, tc]) =>
            !getDerivedBoard(game)[tr][tc] ||
            !blessedSquares.some((b) => b.row === tr && b.col === tc),
        );
        return moves;
      };

      // Puppet force: the puppeted player must move the puppet piece
      if (
        activePuppetColor === game.turn &&
        activePuppetSquare &&
        game.status !== "check"
      ) {
        const pMoves = computeMoves(
          activePuppetSquare[0],
          activePuppetSquare[1],
        );
        if (pMoves.length === 0) {
          setActivePuppetSquare(null);
          setActivePuppetColor(null);
          // fall through to normal selection
        } else {
          if (r === activePuppetSquare[0] && c === activePuppetSquare[1]) {
            setSelected([r, c]);
            setValidMoves(pMoves);
            return;
          }
          if (selected && validMoves.some(([vr, vc]) => vr === r && vc === c)) {
            const cap = getDerivedBoard(game)[r][c]?.type ?? null;
            executeMove(activePuppetSquare, [r, c], undefined, cap);
          }
          setSelected(null);
          setValidMoves([]);
          return;
        }
      }

      if (selected) {
        const isValid = validMoves.some(([vr, vc]) => vr === r && vc === c);
        if (isValid) {
          const movingPiece = getDerivedBoard(game)[selected[0]][selected[1]]!;
          const promRowBlack = getDerivedBoard(game).length - 1;
          const isPromotion =
            movingPiece.type === "P" &&
            ((movingPiece.color === "white" && r === 0) ||
              (movingPiece.color === "black" && r === promRowBlack));
          if (isPromotion) {
            setPromotionPending({ from: selected, to: [r, c] });
          } else {
            const isEP =
              movingPiece.type === "P" &&
              selected[1] !== c &&
              !getDerivedBoard(game)[r][c];
            executeMove(
              selected,
              [r, c],
              undefined,
              getDerivedBoard(game)[r][c]?.type ?? (isEP ? "P" : null),
            );
            setSelected(null);
            setValidMoves([]);
          }
          return;
        }
        if (piece && piece.color === game.turn && !isFrozenPiece) {
          setSelected([r, c]);
          setValidMoves(computeMoves(r, c));
          return;
        }
        setSelected(null);
        setValidMoves([]);
        return;
      }
      if (
        piece &&
        piece.color === game.turn &&
        piece.type !== "M" &&
        !isFrozenPiece
      ) {
        setSelected([r, c]);
        setValidMoves(computeMoves(r, c));
      }
    },
    [
      phase,
      currentTrigger,
      game,
      selected,
      validMoves,
      promotionPending,
      isMyTurn,
      freezeMode,
      necroMode,
      royalEdMode,
      whatMode,
      whatSelected,
      frozenSquare,
      whiteLostPawnCols,
      blackLostPawnCols,
      whiteAugments,
      blackAugments,
      executeMove,
      deathNoteMode,
      monolithMode,
      contractMode,
      blessedWaterMode,
      puppetMode,
      whiteTurnCount,
      blackTurnCount,
      peaceTreatyMovesLeft,
      coldWindsMovesLeft,
      coldWindsSquares,
      blessedSquares,
      wallSquares,
      activePuppetSquare,
      activePuppetColor,
      necroPlusMode,
      whiteLostMinors,
      blackLostMinors,
      requestSnapshot,
      ilkkanMode,
      whiteIlkkanId,
      blackIlkkanId,
      swapMode,
      swapFirst,
      pawnPlaceFor,
    ],
  );

  const handlePromotion = useCallback(
    (type: PieceType) => {
      if (!promotionPending) return;
      const captured =
        getDerivedBoard(game)[promotionPending.to[0]][promotionPending.to[1]];
      executeMove(
        promotionPending.from,
        promotionPending.to,
        type,
        captured?.type ?? null,
      );
      setPromotionPending(null);
      setSelected(null);
      setValidMoves([]);
    },
    [promotionPending, game, executeMove],
  );

  // ── Reset ─────────────────────────────────────────────────────────────────

  const resetGame = () => {
    setGame(createInitialState());
    setSelected(null);
    setValidMoves([]);
    setPromotionPending(null);
    setPhase("start");
    setWhiteAugments([]);
    setBlackAugments([]);
    setOfferedToWhite([]);
    setOfferedToBlack([]);
    setWhiteMilestones(EMPTY_MILESTONES);
    setBlackMilestones(EMPTY_MILESTONES);
    setAugmentQueue([]);
    setCurrentTrigger(null);
    setMidGameOffered([]);
    setGameHistory([]);
    setAugmentHistory([]);
    setWhiteUndosLeft(0);
    setBlackUndosLeft(0);
    setWhiteTurnCount(0);
    setBlackTurnCount(0);
    setWhiteFreezeCharges(0);
    setBlackFreezeCharges(0);
    setFrozenSquare(null);
    setFrozenExpireAfter(null);
    setFreezeMode(false);
    setWhiteNecroCharges(0);
    setBlackNecroCharges(0);
    setWhiteLostPawnCols([]);
    setBlackLostPawnCols([]);
    setNecroMode(false);
    setWhiteCaptureCount(0);
    setBlackCaptureCount(0);
    setWhiteBloodlustNext(4);
    setBlackBloodlustNext(4);
    setWhiteIcUsed(false);
    setBlackIcUsed(false);
    setWhiteRoyalEdUsed(false);
    setBlackRoyalEdUsed(false);
    setRoyalEdMode(false);
    setWhiteWhatUsed(false);
    setBlackWhatUsed(false);
    setWhatMode(false);
    setWhatSelected(null);
    setWhiteSakoUsed(false);
    setBlackSakoUsed(false);
    setSakoMode(false);
    setSakoSelected(null);
    setWhiteSwapUsed(false);
    setBlackSwapUsed(false);
    setSwapMode(false);
    setSwapFirst(null);
    setWhiteRoyalHouseholdUsed(false);
    setBlackRoyalHouseholdUsed(false);
    setRoyalHouseholdMode(false);
    setWhiteDNUsed(false);
    setBlackDNUsed(false);
    setDeathNoteMode(false);
    setDeathNoteTargets([]);
    setBoardExpanded(false);
    setWhiteDomainUsed(false);
    setBlackDomainUsed(false);
    setBoardSize(8);
    setNextEventTurn(rollFullRoundsUntilNextEvent(false));
    setPendingEvent(null);
    setPeaceTreatyMovesLeft(0);
    setActiveNuke(null);
    setBlessedSquares([]);
    setColdWindsSquares([]);
    setColdWindsMovesLeft(0);
    setWallSquares([]);
    setWallMovesLeft(0);
    setChaosEventTiming(false);
    setWhiteContractTarget(null);
    setBlackContractTarget(null);
    setWhiteContractPieceId(null);
    setBlackContractPieceId(null);
    setContractMode(false);
    setWhiteBlessedWaterCharges(0);
    setBlackBlessedWaterCharges(0);
    setBlessedWaterMode(false);
    setWhitePuppetUsed(false);
    setBlackPuppetUsed(false);
    setPuppetMode(false);
    setActivePuppetSquare(null);
    setActivePuppetColor(null);
    setMonolithMode(null);
    setShopOpen(false);
    setWhiteTierBought({ ...EMPTY_TIER });
    setBlackTierBought({ ...EMPTY_TIER });
    setWhiteNecroPlusCharges(0);
    setBlackNecroPlusCharges(0);
    setWhiteLostMinors([]);
    setBlackLostMinors([]);
    setNecroPlusMode(false);
    setWhiteMonolithPermRemoved(false);
    setBlackMonolithPermRemoved(false);
    setWhitePrizeFirstCaptureDone(false);
    setBlackPrizeFirstCaptureDone(false);
    setWhiteBlindRageDone(false);
    setBlackBlindRageDone(false);
    setWhiteEvadeCharges(0);
    setBlackEvadeCharges(0);
    setAugmentSpellBlockedFor(null);
    setWhitePawnShopBuys(0);
    setBlackPawnShopBuys(0);
    setPawnPlaceFor(null);
    setWhiteIlkkanId(null);
    setBlackIlkkanId(null);
    setWhiteIlkkanChosen(false);
    setBlackIlkkanChosen(false);
    setIlkkanMode(false);
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const adv = materialAdvantage(game);
  const isOver = game.status === "checkmate" || game.status === "stalemate";
  const statusText = (() => {
    if (game.status === "checkmate")
      return {
        label: `${opp(game.turn).toUpperCase()} WINS  ·  Checkmate`,
        color: "#4ade80",
      };
    if (game.status === "stalemate")
      return { label: "DRAW  ·  Stalemate", color: "#94a3b8" };
    if (game.status === "check")
      return {
        label: `${game.turn.toUpperCase()}  ·  CHECK!`,
        color: "#f87171",
      };
    return { label: `${game.turn.toUpperCase()}'S TURN`, color: "#e2e8f0" };
  })();

  const canWhiteUndo =
    phase === "playing" &&
    !isOver &&
    game.turn === "white" &&
    whiteUndosLeft > 0 &&
    gameHistory.length >= 2 &&
    !mpConfig;
  const canBlackUndo =
    phase === "playing" &&
    !isOver &&
    game.turn === "black" &&
    blackUndosLeft > 0 &&
    gameHistory.length >= 2 &&
    !mpConfig;
  const necroOff = (boardSize - 8) / 2;
  const whiteNecroRow = 6 + necroOff,
    blackNecroRow = 1 + necroOff;
  const whiteHasNecroTargets = whiteLostPawnCols.some(
    (col) => getDerivedBoard(game)[whiteNecroRow] && !getDerivedBoard(game)[whiteNecroRow][col],
  );
  const blackHasNecroTargets = blackLostPawnCols.some(
    (col) => getDerivedBoard(game)[blackNecroRow] && !getDerivedBoard(game)[blackNecroRow][col],
  );

  const handleEvade = useCallback(() => {
    if (game.turn === "white") {
      if (whiteEvadeCharges <= 0) return;
      setWhiteEvadeCharges((n) => n - 1);
    } else {
      if (blackEvadeCharges <= 0) return;
      setBlackEvadeCharges((n) => n - 1);
    }
    setAugmentSpellBlockedFor(opp(game.turn));
    requestSnapshot();
  }, [
    game.turn,
    whiteEvadeCharges,
    blackEvadeCharges,
    requestSnapshot,
  ]);

  const handleBuyPawn = useCallback(() => {
    const color = game.turn;
    if (augmentSpellBlockedFor === color) return;
    const augs = color === "white" ? whiteAugments : blackAugments;
    if (!augs.some((a) => a.id === "pawn-shop")) return;
    const bought = color === "white" ? whitePawnShopBuys : blackPawnShopBuys;
    const price = 10 * (bought + 1);
    const cur = color === "white" ? game.goldWhite : game.goldBlack;
    if (cur < price) return;
    setGame((g) => ({
      ...g,
      goldWhite: color === "white" ? g.goldWhite - price : g.goldWhite,
      goldBlack: color === "black" ? g.goldBlack - price : g.goldBlack,
    }));
    if (color === "white") setWhitePawnShopBuys((n) => n + 1);
    else setBlackPawnShopBuys((n) => n + 1);
    setPawnPlaceFor(color);
    setShopOpen(false);
    requestSnapshot();
  }, [
    game.turn,
    game.goldWhite,
    game.goldBlack,
    whiteAugments,
    blackAugments,
    whitePawnShopBuys,
    blackPawnShopBuys,
    augmentSpellBlockedFor,
    requestSnapshot,
  ]);

  const spellGuard = (fn: () => void) => () => {
    if (!isMyTurn && mpConfig) return;
    if (augmentSpellBlockedFor && game.turn === augmentSpellBlockedFor) return;
    fn();
  };

  const makeSpells = (color: Color): SpellState => ({
    freezeCharges: color === "white" ? whiteFreezeCharges : blackFreezeCharges,
    freezeActive: freezeMode && game.turn === color,
    onFreeze: spellGuard(handleToggleFreeze),
    necroCharges: color === "white" ? whiteNecroCharges : blackNecroCharges,
    necroActive: necroMode && game.turn === color,
    hasNecroTargets:
      color === "white" ? whiteHasNecroTargets : blackHasNecroTargets,
    onNecro: spellGuard(handleToggleNecro),
    necroPlusCharges:
      color === "white" ? whiteNecroPlusCharges : blackNecroPlusCharges,
    necroPlusActive: necroPlusMode && game.turn === color,
    hasNecroPlusTargets:
      color === "white"
        ? whiteLostMinors.length > 0
        : blackLostMinors.length > 0,
    onNecroPlus: spellGuard(handleToggleNecroPlus),
    ilkkanAvailable:
      color === "white"
        ? whiteAugments.some((a) => a.id === "ilkkan") && !whiteIlkkanChosen
        : blackAugments.some((a) => a.id === "ilkkan") && !blackIlkkanChosen,
    ilkkanActive: ilkkanMode && game.turn === color,
    onIlkkan: spellGuard(handleToggleIlkkan),
    royalEdAvailable:
      color === "white"
        ? !whiteRoyalEdUsed &&
          whiteAugments.some((a) => a.id === "royal-education")
        : !blackRoyalEdUsed &&
          blackAugments.some((a) => a.id === "royal-education"),
    royalEdActive: royalEdMode && game.turn === color,
    onRoyalEd: spellGuard(handleToggleRoyalEd),
    whatAvailable:
      color === "white"
        ? !whiteWhatUsed && whiteAugments.some((a) => a.id === "what")
        : !blackWhatUsed && blackAugments.some((a) => a.id === "what"),
    whatActive: whatMode && game.turn === color,
    onWhat: spellGuard(handleToggleWhat),
    sakoAvailable:
      color === "white"
        ? !whiteSakoUsed && whiteAugments.some((a) => a.id === "sako-bosphorus")
        : !blackSakoUsed &&
          blackAugments.some((a) => a.id === "sako-bosphorus"),
    sakoActive: sakoMode && game.turn === color,
    onSako: spellGuard(handleToggleSako),
    swapAvailable:
      color === "white"
        ? !whiteSwapUsed && whiteAugments.some((a) => a.id === "swap")
        : !blackSwapUsed && blackAugments.some((a) => a.id === "swap"),
    swapActive: swapMode && game.turn === color,
    onSwap: spellGuard(handleToggleSwap),
    royalHouseholdAvailable:
      color === "white"
        ? !whiteRoyalHouseholdUsed &&
          whiteAugments.some((a) => a.id === "royal-household") &&
          game.status === "check" &&
          game.turn === "white"
        : !blackRoyalHouseholdUsed &&
          blackAugments.some((a) => a.id === "royal-household") &&
          game.status === "check" &&
          game.turn === "black",
    royalHouseholdActive: royalHouseholdMode && game.turn === color,
    onRoyalHousehold: spellGuard(handleToggleRoyalHousehold),
    deathNoteAvailable:
      color === "white"
        ? !whiteDNUsed && whiteAugments.some((a) => a.id === "death-note")
        : !blackDNUsed && blackAugments.some((a) => a.id === "death-note"),
    deathNoteActive: deathNoteMode && game.turn === color,
    onDeathNote: spellGuard(handleToggleDeathNote),
    domainAvailable:
      color === "white"
        ? !whiteDomainUsed &&
          !boardExpanded &&
          whiteAugments.some((a) => a.id === "domain-expansion")
        : !blackDomainUsed &&
          !boardExpanded &&
          blackAugments.some((a) => a.id === "domain-expansion"),
    onDomain: spellGuard(handleDomainExpansion),
    monolithPlaceAvailable:
      color === "white"
        ? whiteAugments.some((a) => a.id === "impassable") &&
          !whiteMonolithPermRemoved &&
          !getDerivedBoard(game).some((row) =>
            row.some((sq) => sq?.type === "M" && sq.color === "white"),
          )
        : blackAugments.some((a) => a.id === "impassable") &&
          !blackMonolithPermRemoved &&
          !getDerivedBoard(game).some((row) =>
            row.some((sq) => sq?.type === "M" && sq.color === "black"),
          ),
    monolithPlaceActive: monolithMode === "place" && game.turn === color,
    onMonolithPlace: spellGuard(handleToggleMonolithPlace),
    monolithRemoveAvailable:
      color === "white"
        ? getDerivedBoard(game).some((row) =>
            row.some((sq) => sq?.type === "M" && sq.color === "white"),
          )
        : getDerivedBoard(game).some((row) =>
            row.some((sq) => sq?.type === "M" && sq.color === "black"),
          ),
    onMonolithRemove: spellGuard(handleToggleMonolithRemove),
    contractAvailable:
      color === "white"
        ? whiteAugments.some((a) => a.id === "contract-killer") &&
          !whiteContractPieceId
        : blackAugments.some((a) => a.id === "contract-killer") &&
          !blackContractPieceId,
    contractActive: contractMode && game.turn === color,
    onContract: spellGuard(handleToggleContract),
    contractTarget:
      color === "white" ? whiteContractTarget : blackContractTarget,
    blessedWaterCharges:
      color === "white" ? whiteBlessedWaterCharges : blackBlessedWaterCharges,
    blessedWaterActive: blessedWaterMode && game.turn === color,
    onBlessedWater: spellGuard(handleToggleBlessedWater),
    puppetAvailable:
      color === "white"
        ? !whitePuppetUsed && whiteAugments.some((a) => a.id === "puppet")
        : !blackPuppetUsed && blackAugments.some((a) => a.id === "puppet"),
    puppetActive: puppetMode && game.turn === color,
    onPuppet: spellGuard(handleTogglePuppet),
    evadeCharges:
      color === "white" ? whiteEvadeCharges : blackEvadeCharges,
    evadeActive: false,
    onEvade: spellGuard(handleEvade),
    canUndo: color === "white" ? canWhiteUndo : canBlackUndo,
    onUndo: handleUndo,
    captureCount: color === "white" ? whiteCaptureCount : blackCaptureCount,
    hasBloodlust:
      color === "white"
        ? whiteAugments.some((a) => a.id === "bloodlust")
        : blackAugments.some((a) => a.id === "bloodlust"),
    shopOpen: shopOpen && game.turn === color,
    onToggleShop: spellGuard(handleToggleShop),
  });

  const modeBanner = (() => {
    if (freezeMode)
      return {
        text: "❄️ Click an enemy piece to freeze it (not king)",
        color: "#06b6d4",
      };
    if (necroMode)
      return {
        text: "💀 Click a home-rank square to revive a pawn",
        color: "#a855f7",
      };
    if (necroPlusMode)
      return {
        text: "💀✨ Click your back rank to revive your last captured knight or bishop",
        color: "#c084fc",
      };
    if (ilkkanMode)
      return {
        text: "🧑 ILKKAN — Click one of your pawns to mark it as İlkkan",
        color: "#6b7280",
      };
    if (pawnPlaceFor)
      return {
        text: "♙ Pawn Shop — click an empty square on your original pawn rank",
        color: "#22c55e",
      };
    if (royalEdMode)
      return {
        text: "♞ Click a destination for your king's knight move",
        color: "#facc15",
      };
    if (whatMode && !whatSelected)
      return {
        text: "↔️ Click one of your pawns to move it sideways",
        color: "#f97316",
      };
    if (whatMode && whatSelected)
      return { text: "↔️ Click the destination square", color: "#f97316" };
    if (swapMode && !swapFirst)
      return {
        text: "🔀 SWAP — Click your first piece (frozen pieces cannot swap)",
        color: "#a78bfa",
      };
    if (swapMode && swapFirst)
      return {
        text: "🔀 SWAP — Click a second piece to trade squares (your king cannot end in check)",
        color: "#a78bfa",
      };
    if (sakoMode && !sakoSelected)
      return {
        text: "⚓ ŞAKO — Click any of your pieces to teleport anywhere",
        color: "#eab308",
      };
    if (sakoMode && sakoSelected)
      return {
        text: "⚓ ŞAKO — Click any empty square on the board",
        color: "#eab308",
      };
    if (royalHouseholdMode)
      return {
        text: "🏰 RAMPAGE — Click a destination (up to 4 squares, destroys all in path)",
        color: "#ef4444",
      };
    if (deathNoteMode)
      return {
        text: "☠️ DEATH NOTE — Click an enemy piece (not king/queen) to doom it in 16 turns (each move ticks)",
        color: "#dc2626",
      };
    if (monolithMode === "place")
      return {
        text: "🗿 Click an empty square to place your monolith (spends a turn)",
        color: "#64748b",
      };
    if (monolithMode === "remove")
      return {
        text: "🗿 Click your monolith to remove it (free action)",
        color: "#64748b",
      };
    if (contractMode)
      return {
        text: "🎯 CONTRACT — Click an enemy piece (not king/pawn) to mark it (one contract per pick)",
        color: "#f59e0b",
      };
    if (blessedWaterMode)
      return {
        text: "💧 BLESS — Click any square to protect the piece on it for 2 rounds",
        color: "#22d3ee",
      };
    if (puppetMode)
      return {
        text: "🪆 PUPPET — Click an enemy piece to force them to play it next turn",
        color: "#f97316",
      };
    if (
      activePuppetColor === game.turn &&
      activePuppetSquare &&
      game.status !== "check"
    )
      return {
        text: "🪆 You are puppeted! You MUST move the marked piece.",
        color: "#ef4444",
      };
    return null;
  })();

  const activePlayerGold =
    game.turn === "white" ? game.goldWhite : game.goldBlack;
  const activeTierBought =
    game.turn === "white" ? whiteTierBought : blackTierBought;
  const pawnShopNextPrice =
    game.turn === "white" && whiteAugments.some((a) => a.id === "pawn-shop")
      ? 10 * (whitePawnShopBuys + 1)
      : game.turn === "black" && blackAugments.some((a) => a.id === "pawn-shop")
        ? 10 * (blackPawnShopBuys + 1)
        : null;

  const fullRoundsPlayed = blackTurnCount;
  const fullRoundsUntilBoardEvent = Math.max(0, nextEventTurn - fullRoundsPlayed);

  // ── Render ────────────────────────────────────────────────────────────────

  if (mpConfig && !mpReady) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "#030712",
          color: "#fff",
        }}
      >
        <div style={{ fontSize: 14, color: "#9ca3af" }}>Setting up game…</div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: mpViewFlipped ? "column-reverse" : "column",
        width: "100%",
        height: "100%",
        background: "#030712",
        color: "#fff",
        userSelect: "none",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <PlayerBar
        color="black"
        isActive={game.turn === "black"}
        isOver={isOver}
        phase={phase}
        augments={blackAugments}
        gold={game.goldBlack}
        capturedPieces={game.capturedByBlack}
        advantage={adv.black > 0 ? adv.black : 0}
        spells={makeSpells("black")}
        showReset={true}
        onReset={resetGame}
      />

      <div
        ref={containerRef}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 6,
          minHeight: 0,
          position: "relative",
          background: "#030712",
        }}
      >
        {phase === "playing" && !isOver && (
          <div
            style={{
              position: "absolute",
              top: 4,
              left: 0,
              right: 0,
              zIndex: 4,
              display: "flex",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                background: "rgba(15,23,42,0.9)",
                border: "1px solid #334155",
                borderRadius: 8,
                padding: "5px 14px",
                fontSize: 11,
                color: "#94a3b8",
                fontWeight: 600,
                letterSpacing: "0.02em",
                boxShadow: "0 2px 10px rgba(0,0,0,0.45)",
              }}
            >
              <span style={{ color: "#cbd5e1" }}>Board event</span>
              {" — fires after full round "}
              <span style={{ color: "#fbbf24" }}>{nextEventTurn}</span>
              {" · "}
              <span style={{ color: "#e2e8f0" }}>
                {fullRoundsUntilBoardEvent} full round
                {fullRoundsUntilBoardEvent === 1 ? "" : "s"} away
              </span>
              {chaosEventTiming && (
                <span style={{ color: "#f472b6", marginLeft: 8 }}>(Chaos)</span>
              )}
            </div>
          </div>
        )}
        <div
          style={{
            width: boardPx,
            height: boardPx,
            display: "grid",
            gridTemplateColumns: `repeat(${boardSize},${sqSize}px)`,
            gridTemplateRows: `repeat(${boardSize},${sqSize}px)`,
            border: "3px solid #5c3d1e",
            borderRadius: 2,
            boxShadow: "0 8px 40px rgba(0,0,0,0.8),0 2px 8px rgba(0,0,0,0.5)",
            flexShrink: 0,
          }}
        >
          {Array.from({ length: boardSize }, (_, dr) =>
            Array.from({ length: boardSize }, (_, dc) => {
              const r = mpViewFlipped ? boardSize - 1 - dr : dr;
              const c = mpViewFlipped ? boardSize - 1 - dc : dc;
              const piece = getDerivedBoard(game)[r]?.[c] ?? null;
              const isSel = selected?.[0] === r && selected?.[1] === c;
              const isVM = validMoves.some(([vr, vc]) => vr === r && vc === c);
              const isLM = !!(
                game.lastMove &&
                ((game.lastMove.from[0] === r && game.lastMove.from[1] === c) ||
                  (game.lastMove.to[0] === r && game.lastMove.to[1] === c))
              );
              const isCK = !!(
                piece?.type === "K" &&
                piece.color === game.turn &&
                (game.status === "check" || game.status === "checkmate")
              );
              const isCenter =
                showCenterMarkers && centerSquares.has(`${r},${c}`);
              const isFrozen = !!(
                frozenSquare &&
                frozenSquare[0] === r &&
                frozenSquare[1] === c
              );
              const dn = piece?.id
                ? deathNoteTargets.find((d) => d.pieceId === piece.id)
                : undefined;
              const isNukeSquare = !!(
                activeNuke &&
                r >= activeNuke.topRow &&
                r < activeNuke.topRow + 3 &&
                c >= activeNuke.leftCol &&
                c < activeNuke.leftCol + 3
              );
              const showNukeCount =
                isNukeSquare &&
                r === activeNuke!.topRow &&
                c === activeNuke!.leftCol;
              const isBlessed = blessedSquares.some(
                (b) => b.row === r && b.col === c,
              );
              const isColdWind =
                coldWindsMovesLeft > 0 &&
                coldWindsSquares.some(([cr, cc]) => cr === r && cc === c);
              const contractMark =
                !!(
                  whiteContractTarget &&
                  whiteContractTarget[0] === r &&
                  whiteContractTarget[1] === c
                ) ||
                !!(
                  blackContractTarget &&
                  blackContractTarget[0] === r &&
                  blackContractTarget[1] === c
                );
              const isWall = wallSquares.some(
                (w) => w.row === r && w.col === c,
              );
              const isPuppet = !!(
                activePuppetSquare &&
                activePuppetSquare[0] === r &&
                activePuppetSquare[1] === c
              );
              const isIlkkanSq = !!(
                piece?.id &&
                (piece.id === whiteIlkkanId || piece.id === blackIlkkanId)
              );
              return (
                <SquareEl
                  key={`${dr}-${dc}`}
                  row={r}
                  col={c}
                  viewFlipped={mpViewFlipped}
                  size={sqSize}
                  piece={piece}
                  isSelected={isSel}
                  isValidMove={isVM}
                  isLastMove={isLM}
                  isCheckKing={isCK}
                  isCenter={isCenter}
                  isFrozen={isFrozen}
                  onClick={() => handleSquareClick(r, c)}
                  boardSize={boardSize}
                  deathNoteCount={dn?.turnsLeft}
                  isNuke={isNukeSquare}
                  nukeMovesLeft={
                    showNukeCount ? activeNuke!.movesLeft : undefined
                  }
                  isBlessed={isBlessed}
                  isColdWind={isColdWind}
                  contractMark={contractMark}
                  isWall={isWall}
                  isPuppet={isPuppet}
                  isIlkkan={isIlkkanSq}
                />
              );
            }),
          )}
        </div>

        {promotionPending && (
          <PromotionDialog color={game.turn} onChoose={handlePromotion} />
        )}
        {pendingEvent && (
          <EventAnnouncement
            event={pendingEvent}
            peaceTreatyLeft={peaceTreatyMovesLeft}
            onClose={() => setPendingEvent(null)}
          />
        )}

        {isOver && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                background: "#111827",
                border: "1px solid #374151",
                borderRadius: 14,
                padding: "20px 36px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
                pointerEvents: "auto",
              }}
            >
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: statusText.color,
                  letterSpacing: "0.04em",
                }}
              >
                {statusText.label}
              </span>
              <button
                onClick={resetGame}
                style={{
                  padding: "8px 28px",
                  fontSize: 14,
                  fontWeight: 700,
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  background: "linear-gradient(135deg,#4f46e5,#6366f1)",
                  color: "#fff",
                  boxShadow: "0 3px 12px rgba(99,102,241,0.5)",
                }}
              >
                Play Again
              </button>
            </div>
          </div>
        )}

        {modeBanner && (
          <div
            style={{
              position: "absolute",
              top: 10,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 20,
              pointerEvents: "none",
              background: "rgba(0,0,0,0.82)",
              color: modeBanner.color,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              padding: "5px 18px",
              borderRadius: 20,
              textTransform: "uppercase",
              boxShadow: `0 2px 12px rgba(0,0,0,0.5),0 0 0 1px ${modeBanner.color}40`,
              whiteSpace: "nowrap",
            }}
          >
            {modeBanner.text}
          </div>
        )}

        {/* MP: waiting-for-turn overlay */}
        {mpConfig && !isMyTurn && !isOver && (
          <div
            style={{
              position: "absolute",
              bottom: 10,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 20,
              pointerEvents: "none",
              background: "rgba(0,0,0,0.75)",
              color: "#94a3b8",
              fontSize: 11,
              fontWeight: 700,
              padding: "4px 16px",
              borderRadius: 20,
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
            }}
          >
            ⏳ Opponent&apos;s turn…
          </div>
        )}

        {mpConfig?.connectionLost && !mpConfig.opponentLeft && (
          <div
            style={{
              position: "absolute",
              top: 10,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 25,
              pointerEvents: "none",
              background: "rgba(234,179,8,0.15)",
              border: "1px solid rgba(234,179,8,0.45)",
              color: "#fcd34d",
              fontSize: 11,
              fontWeight: 700,
              padding: "6px 14px",
              borderRadius: 20,
              letterSpacing: "0.04em",
              whiteSpace: "nowrap",
            }}
          >
            Connection lost — reconnecting…
          </div>
        )}

        {/* MP: opponent disconnected overlay */}
        {mpConfig?.opponentLeft && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 50,
            }}
          >
            <div
              style={{
                background: "#111827",
                border: "1px solid #374151",
                borderRadius: 14,
                padding: "24px 36px",
                textAlign: "center",
                boxShadow: "0 8px 40px rgba(0,0,0,0.8)",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔌</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                Opponent disconnected
              </div>
              <div style={{ color: "#9ca3af", fontSize: 13 }}>
                The game has ended.
              </div>
            </div>
          </div>
        )}
      </div>

      <PlayerBar
        color="white"
        isActive={game.turn === "white"}
        isOver={isOver}
        phase={phase}
        augments={whiteAugments}
        gold={game.goldWhite}
        capturedPieces={game.capturedByWhite}
        advantage={adv.white > 0 ? adv.white : 0}
        spells={makeSpells("white")}
        showReset={false}
        onReset={resetGame}
        statusLabel={
          phase === "playing" && !isOver ? statusText.label : undefined
        }
        statusColor={statusText.color}
        statusBadge={game.status === "check"}
      />

      {/* Shop panel — below white bar, board auto-shrinks */}
      {shopOpen && phase === "playing" && !isOver && (
        <ShopPanel
          playerColor={game.turn}
          gold={activePlayerGold}
          tierBought={activeTierBought}
          playerAugments={game.turn === "white" ? whiteAugments : blackAugments}
          onBuy={handleBuy}
          onClose={() => setShopOpen(false)}
          pawnShopNextPrice={pawnShopNextPrice}
          onBuyPawn={pawnShopNextPrice != null ? handleBuyPawn : null}
          pawnPlacePending={pawnPlaceFor !== null}
        />
      )}

      {/* Phase overlays */}
      {phase === "start" && <StartScreen onStart={handleStart} />}
      {phase === "white-augment" && (
        <AugmentSelector
          playerColor="white"
          offered={offeredToWhite}
          onSelect={handleWhitePick}
        />
      )}
      {phase === "black-augment" && (
        <AugmentSelector
          playerColor="black"
          offered={offeredToBlack}
          onSelect={handleBlackPick}
        />
      )}
      {phase === "playing" && currentTrigger !== null && (
        <AugmentSelector
          playerColor={currentTrigger.color}
          offered={midGameOffered}
          onSelect={handleMidGamePick}
          trigger={currentTrigger}
        />
      )}
    </div>
  );
}
