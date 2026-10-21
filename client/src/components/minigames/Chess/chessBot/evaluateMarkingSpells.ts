import {
  getDerivedBoard,
  getLegalMoves,
  PIECE_VALUE,
  type ChessState,
} from "../engine";
import type { BotMove, BotSpellContext } from "./types";
import { enumerateDeathNoteTargets } from "./spellTargets";

function pieceValueAt(
  game: ChessState,
  target: [number, number],
): number {
  const p = getDerivedBoard(game)[target[0]]?.[target[1]];
  if (!p || p.type === "M") return 0;
  return PIECE_VALUE[p.type] ?? 0;
}

function blackCanCaptureTarget(game: ChessState, target: [number, number]): boolean {
  const board = getDerivedBoard(game);
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < (board[r]?.length ?? 0); c++) {
      if (board[r][c]?.color !== "black") continue;
      if (getLegalMoves(game, r, c).some(([tr, tc]) => tr === target[0] && tc === target[1]))
        return true;
    }
  }
  return false;
}

export function pickDeathNoteTarget(
  game: ChessState,
  ctx: BotSpellContext,
): [number, number] | null {
  if (ctx.augmentSpellBlockedFor === "black") return null;
  if (!ctx.deathNoteAvailable) return null;

  const targets = enumerateDeathNoteTargets(game, ctx);
  if (targets.length === 0) return null;

  // Cursing a piece that can immediately be captured throws away capture gold;
  // reserve the one-use curse for a piece that is currently out of reach.
  const delayedTargets = targets.filter(
    (target) => !blackCanCaptureTarget(game, target),
  );
  const ranked = delayedTargets.length > 0 ? delayedTargets : targets;
  ranked.sort(
    (a, b) => pieceValueAt(game, b) - pieceValueAt(game, a),
  );
  const best = ranked[0];
  // Holding the curse for a rook beats burning it on a pawn in the opening.
  if (!best || (pieceValueAt(game, best) < 3 && (game.fullMoveNumber ?? 1) < 20)) return null;
  return best;
}

export function contractCaptureMove(
  game: ChessState,
  ctx: BotSpellContext,
  move: BotMove,
): { target: [number, number]; move: BotMove } | null {
  if (ctx.augmentSpellBlockedFor === "black") return null;
  if (!ctx.contractAvailable) return null;

  const cap = getDerivedBoard(game)[move.to[0]]?.[move.to[1]];
  if (!cap || cap.color !== "white" || !cap.id) return null;
  // One contract per game: spend it on a heavy piece, or on a minor once the
  // game is long enough that a heavier capture is unlikely to come along.
  const lateGame = (game.fullMoveNumber ?? 1) >= 25;
  const heavy = cap.type === "Q" || cap.type === "R";
  const minor = cap.type === "N" || cap.type === "B";
  if (!heavy && !(lateGame && minor)) return null;

  return { target: move.to, move };
}
