import {
  cloneBoard,
  findKing,
  getDerivedBoard,
  getLegalMoves,
  isInCheck,
  makeMove,
  opp,
  syncStateFromBoard,
  type Board,
  type ChessState,
  type Color,
  type PieceType,
} from "../engine";
import type { Augment, AugmentUpgradeLevels } from "../augments";
import { getImproveLevel } from "../augments";
import { isLittleBigManPawn, squareToAlg } from "./fen";
import type { BotMove, BotSpellContext } from "./types";

export type Sq = [number, number];
export type Side = "white" | "black";

/**
 * Variant rules that change which moves are legal for one half-move. The
 * engine's getLegalMoves knows none of these; ChessGame layers them on top.
 */
export type RuleSet = {
  walls: { row: number; col: number }[];
  blessed: { row: number; col: number; movesLeft: number }[];
  coldWinds: Sq[];
  coldWindsMovesLeft: number;
  /** Frozen square and how many half-moves it still holds (incl. this one). */
  frozen: Sq | null;
  frozenTurnsLeft: number;
  /** Puppet: this colour must move the piece on this square. */
  forced: { color: Color; square: Sq } | null;
  augments: Record<Side, Augment[]>;
  levels: Record<Side, AugmentUpgradeLevels>;
};

export function rulesFromCtx(ctx: BotSpellContext): RuleSet {
  return {
    walls: ctx.wallSquares,
    blessed: ctx.blessedSquares,
    coldWinds: ctx.coldWindsSquares,
    coldWindsMovesLeft: ctx.coldWindsMovesLeft,
    frozen: ctx.frozenSquare,
    frozenTurnsLeft: ctx.frozenTurnsLeft ?? (ctx.frozenSquare ? 2 : 0),
    forced:
      ctx.activePuppetSquare && ctx.activePuppetColor
        ? { color: ctx.activePuppetColor, square: ctx.activePuppetSquare }
        : null,
    augments: { white: ctx.whiteAugments ?? [], black: ctx.blackAugments },
    levels: { white: ctx.whiteAugmentLevels ?? {}, black: ctx.blackAugmentLevels },
  };
}

/** Rules as they stand for the reply after one half-move has been played. */
export function advanceRules(rules: RuleSet, mover: Side): RuleSet {
  const frozenTurnsLeft = Math.max(0, rules.frozenTurnsLeft - 1);
  return {
    ...rules,
    blessed: rules.blessed
      .map((b) => ({ ...b, movesLeft: b.movesLeft - 1 }))
      .filter((b) => b.movesLeft > 0),
    coldWindsMovesLeft: Math.max(0, rules.coldWindsMovesLeft - 1),
    coldWinds: rules.coldWindsMovesLeft > 1 ? rules.coldWinds : [],
    frozen: frozenTurnsLeft > 0 ? rules.frozen : null,
    frozenTurnsLeft,
    forced: rules.forced?.color === mover ? null : rules.forced,
  };
}

export const EMPTY_RULES: RuleSet = {
  walls: [],
  blessed: [],
  coldWinds: [],
  coldWindsMovesLeft: 0,
  frozen: null,
  frozenTurnsLeft: 0,
  forced: null,
  augments: { white: [], black: [] },
  levels: { white: {}, black: {} },
};

export function isBlessed(rules: RuleSet, r: number, c: number): boolean {
  return rules.blessed.some((b) => b.row === r && b.col === c);
}

/** Walls and permafrost become immovable blockers for move generation. */
export function withWalls(game: ChessState, rules: RuleSet): ChessState {
  const perm = game.permaFrozenSquares ?? [];
  if (rules.walls.length === 0 && perm.length === 0) return game;
  const db = getDerivedBoard(game);
  return syncStateFromBoard(
    { ...game },
    db.map((row, ri) =>
      row.map((sq, ci) => {
        if (rules.walls.some((w) => w.row === ri && w.col === ci))
          return { type: "M" as PieceType, color: "white" as Color };
        if (perm.some((p) => p.row === ri && p.col === ci))
          return { type: "M" as PieceType, color: "white" as Color };
        return sq;
      }),
    ),
  );
}

function hasAug(rules: RuleSet, side: Side, id: string): boolean {
  return rules.augments[side].some((a) => a.id === id);
}

function alternativeMoves(board: Board, r: number, c: number, side: Side, plus: boolean): Sq[] {
  const bs = board.length;
  const off = (bs - 8) / 2;
  const piece = board[r]?.[c];
  if (!piece || piece.type !== "P") return [];
  const dir = side === "white" ? -1 : 1;
  const startRow = side === "white" ? 6 + off : 1 + off;
  if (r !== startRow) return [];
  const out: Sq[] = [];
  if (plus) {
    for (let step = 1; step <= 3; step++) {
      const tr = r + dir * step;
      if (tr < 0 || tr >= bs || board[tr][c]) break;
      out.push([tr, c]);
    }
    return out;
  }
  if (c !== 0 && c !== bs - 1) return [];
  for (let step = 1; step <= 3; step++) if (board[r + dir * step]?.[c]) return [];
  return [[r + dir * 3, c]];
}

export type MoveGenOptions = {
  /** Treat these squares' pieces as unable to move (frozen by a spell plan). */
  frozenExtra?: Sq | null;
  /** Ignore the current freeze (e.g. Frost cast elsewhere replaces it). */
  ignoreFrozen?: boolean;
  /** Only generate moves for the piece on this square. */
  onlyFrom?: Sq | null;
};

/**
 * Every legal move for `side` under the variant rules — mirrors ChessGame's
 * computeMoves (walls, permafrost, frost, cold winds, Alternative pawns,
 * blessed-square capture ban, Puppet).
 */
export function legalMovesFor(
  game: ChessState,
  side: Side,
  rules: RuleSet,
  opts: MoveGenOptions = {},
): BotMove[] {
  const base = game.turn === side ? game : { ...game, turn: side as Color };
  const gen = withWalls(base, rules);
  const board = getDerivedBoard(base);
  const rows = board.length;
  const cols = board[0]?.length ?? rows;
  const forcedSq = rules.forced?.color === side ? rules.forced.square : null;
  const only = opts.onlyFrom ?? forcedSq;
  const alt = hasAug(rules, side, "alternative");
  const altPlus =
    hasAug(rules, side, "alternative-plus") ||
    getImproveLevel(rules.levels[side], "alternative") >= 1;
  const coldActive = rules.coldWindsMovesLeft > 0;
  const promoRow = side === "white" ? 0 : rows - 1;
  const out: BotMove[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = board[r][c];
      if (!p || p.color !== side || p.type === "M") continue;
      if (only && (only[0] !== r || only[1] !== c)) continue;
      if (coldActive && rules.coldWinds.some(([fr, fc]) => fr === r && fc === c)) continue;
      if (!opts.ignoreFrozen && rules.frozen && rules.frozen[0] === r && rules.frozen[1] === c)
        continue;
      if (opts.frozenExtra && opts.frozenExtra[0] === r && opts.frozenExtra[1] === c) continue;

      const targets = getLegalMoves(gen, r, c);
      if (p.type === "P" && (alt || altPlus)) {
        const extra = [
          ...(alt ? alternativeMoves(board, r, c, side, false) : []),
          ...(altPlus ? alternativeMoves(board, r, c, side, true) : []),
        ];
        for (const e of extra)
          if (!targets.some(([tr, tc]) => tr === e[0] && tc === e[1])) targets.push(e);
      }
      const lbm = isLittleBigManPawn(p, base);
      for (const [tr, tc] of targets) {
        if (board[tr][tc] && isBlessed(rules, tr, tc)) continue;
        const promotion =
          p.type === "P" && !lbm && tr === promoRow ? ("Q" as PieceType) : undefined;
        out.push({ from: [r, c], to: [tr, tc], promotion });
      }
    }
  }
  return out;
}

export function moveKey(m: BotMove): string {
  return `${m.from[0]},${m.from[1]}>${m.to[0]},${m.to[1]}`;
}

/** UCI for Stockfish; an LBM pawn is a queen there, so it never "promotes". */
export function toUci(game: ChessState, m: BotMove): string {
  const p = getDerivedBoard(game)[m.from[0]]?.[m.from[1]];
  const promo = p && isLittleBigManPawn(p, game) ? "" : (m.promotion?.toLowerCase() ?? "");
  return `${squareToAlg(m.from[0], m.from[1])}${squareToAlg(m.to[0], m.to[1])}${promo}`;
}

/** Map engine UCI back to one of our legal moves (promotion-insensitive). */
export function matchUci(uci: string, legal: BotMove[]): BotMove | null {
  const m = uci.match(/^([a-h])([1-8])([a-h])([1-8])/);
  if (!m) return null;
  const fc = m[1]!.charCodeAt(0) - 97;
  const fr = 8 - Number(m[2]);
  const tc = m[3]!.charCodeAt(0) - 97;
  const tr = 8 - Number(m[4]);
  return (
    legal.find(
      (x) => x.from[0] === fr && x.from[1] === fc && x.to[0] === tr && x.to[1] === tc,
    ) ?? null
  );
}

/** Port of ChessGame's findCheckingPiece (Internal Combustion target). */
export function findCheckingPiece(board: Board, kingColor: Color): Sq | null {
  if (kingColor === "orange") return null;
  const [kr] = findKing(board, kingColor);
  if (kr === -1) return null;
  for (let r = 0; r < board.length; r++)
    for (let c = 0; c < (board[r]?.length ?? 0); c++) {
      const p = board[r][c];
      if (!p) continue;
      const isEnemy = p.color === opp(kingColor);
      const isOrangeMerc =
        p.color === "orange" && typeof p.id === "string" && p.id.includes("mercenary");
      if (isEnemy || isOrangeMerc) {
        const test = cloneBoard(board);
        test[r][c] = null;
        if (!isInCheck(test, kingColor)) return [r, c];
      }
    }
  return null;
}

export type AppliedMove = {
  state: ChessState;
  captured: PieceType | null;
  /** Square of our checking piece destroyed by the defender's Internal Combustion. */
  exploded: Sq | null;
};

/** makeMove plus the defender's Internal Combustion response. */
export function applyMove(
  game: ChessState,
  m: BotMove,
  icDefender: Side | null,
): AppliedMove | null {
  const board = getDerivedBoard(game);
  const mover = board[m.from[0]]?.[m.from[1]];
  if (!mover) return null;
  const captured = board[m.to[0]]?.[m.to[1]]?.type ?? null;
  let state: ChessState;
  try {
    state = makeMove({ ...game, turn: mover.color }, m.from, m.to, m.promotion);
  } catch {
    return null;
  }
  let exploded: Sq | null = null;
  if (icDefender && state.turn === icDefender && isInCheck(state, icDefender)) {
    const checker = findCheckingPiece(getDerivedBoard(state), icDefender);
    if (checker) {
      const nb = cloneBoard(getDerivedBoard(state));
      nb[checker[0]][checker[1]] = null;
      state = syncStateFromBoard({ ...state, status: "playing" }, nb);
      exploded = checker;
    }
  }
  return { state, captured, exploded };
}

/** Pass the turn without moving (Puppet / Monolith / revival spells). */
export function passTurn(game: ChessState, board?: Board): ChessState {
  const next = { ...game, turn: opp(game.turn), enPassantTarget: null };
  return board ? syncStateFromBoard(next, board) : next;
}

export function pieceAt(game: ChessState, sq: Sq) {
  return getDerivedBoard(game)[sq[0]]?.[sq[1]] ?? null;
}
