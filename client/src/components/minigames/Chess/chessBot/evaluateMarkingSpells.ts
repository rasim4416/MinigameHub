import { getDerivedBoard, PIECE_VALUE, type ChessState } from "../engine";
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

export function pickDeathNoteTarget(
  game: ChessState,
  ctx: BotSpellContext,
): [number, number] | null {
  if (ctx.augmentSpellBlockedFor === "black") return null;
  if (!ctx.deathNoteAvailable) return null;

  const targets = enumerateDeathNoteTargets(game, ctx);
  if (targets.length === 0) return null;

  targets.sort(
    (a, b) => pieceValueAt(game, b) - pieceValueAt(game, a),
  );
  return targets[0] ?? null;
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

  targets.sort(
    (a, b) => pieceValueAt(game, a) - pieceValueAt(game, b),
  );
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
