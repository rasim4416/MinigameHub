import {
  getDerivedBoard,
  getLegalMoves,
  isSquareAttackedBy,
  PIECE_VALUE,
  type ChessState,
} from "../engine";
import type { BotMove, BotSpellContext } from "./types";
import type { PositionAssessment } from "./assessPosition";
import {
  enumerateDeathNoteTargets,
  enumeratePuppetTargets,
} from "./spellTargets";

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
  return ranked[0] ?? null;
}

export function pickPuppetTarget(
  game: ChessState,
  ctx: BotSpellContext,
  position: PositionAssessment,
): [number, number] | null {
  if (ctx.augmentSpellBlockedFor === "black") return null;
  if (!ctx.puppetAvailable) return null;
  if (!position.isAttacking) return null;

  const targets = enumeratePuppetTargets(game, ctx);
  if (targets.length === 0) return null;

  targets.sort((a, b) => {
    const whiteTurnGame = { ...game, turn: "white" as const };
    const aMoves = getLegalMoves(whiteTurnGame, a[0], a[1]).length;
    const bMoves = getLegalMoves(whiteTurnGame, b[0], b[1]).length;
    const aScore =
      pieceValueAt(game, a) * 100 -
      aMoves * 15 -
      (isSquareAttackedBy(game, a[0], a[1], "black") ? 250 : 0);
    const bScore =
      pieceValueAt(game, b) * 100 -
      bMoves * 15 -
      (isSquareAttackedBy(game, b[0], b[1], "black") ? 250 : 0);
    return bScore - aScore;
  });
  return targets[0] ?? null;
}

export function contractCaptureMove(
  game: ChessState,
  ctx: BotSpellContext,
  move: BotMove,
): { target: [number, number]; move: BotMove } | null {
  if (ctx.augmentSpellBlockedFor === "black") return null;
  if (!ctx.contractAvailable) return null;

  const cap = getDerivedBoard(game)[move.to[0]]?.[move.to[1]];
  if (!cap || cap.color !== "white") return null;
  if (cap.type !== "Q" && cap.type !== "R") return null;

  return { target: move.to, move };
}
