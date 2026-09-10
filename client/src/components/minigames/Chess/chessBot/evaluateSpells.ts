import {
  isSquareAttackedByEnemyOrMercenary,
  makeMove,
  PIECE_VALUE,
  getDerivedBoard,
  type ChessState,
} from "../engine";
import {
  FREE_SPELL_THRESHOLD_CP,
  MAX_SPELL_CANDIDATES,
  TURN_SPELL_THRESHOLD_CP,
} from "./constants";
import { evalForBlack } from "./evalPosition";
import { pickBotMove } from "./pickBotMove";
import {
  enumerateSpellTargets,
  frostTargetHasLegalMoves,
} from "./spellTargets";
import {
  gameForFrostEval,
  gameForMonolithEval,
  previewSpell,
} from "./spellPreview";
import type { BotSpellContext, SpellCandidate, BotMove } from "./types";

function heuristicTargetScore(
  game: ChessState,
  ctx: BotSpellContext,
  spellId: string,
  target: [number, number],
): number {
  const [r, c] = target;
  const board = getDerivedBoard(game);
  const p = board[r][c];
  let score = 0;

  if (spellId === "frost" && p && p.color === "white") {
    score += (PIECE_VALUE[p.type] ?? 0) * 100;
    if (frostTargetHasLegalMoves(game, target)) score += 50;
    if (p.type === "Q" || p.type === "R") score += 200;
  }

  if (spellId === "blessed-water-spell") {
    if (p && p.color === "black") {
      score += (PIECE_VALUE[p.type] ?? 0) * 80;
      if (isSquareAttackedByEnemyOrMercenary(game, r, c, "black")) {
        score += 300;
      }
    }
  }

  if (spellId === "impassable") {
    // Central walls are much more likely to cut a useful line than a corner
    // wall. Do not spend the candidate budget on cosmetic edge placements.
    const rows = board.length;
    const cols = board[0]?.length ?? rows;
    score += 100 - Math.abs(r - (rows - 1) / 2) * 12;
    score += 100 - Math.abs(c - (cols - 1) / 2) * 12;
  }

  if (
    spellId === "necromancer" ||
    spellId === "necromancer-plus" ||
    spellId === "necromancer-plus-plus"
  ) {
    const rows = board.length;
    const cols = board[0]?.length ?? rows;
    // A revived piece should not be placed on an immediately attacked square
    // if a safer legal square exists. Prefer development toward the centre.
    score += 100 - Math.abs(c - (cols - 1) / 2) * 15;
    score += 30 - Math.abs(r - (rows - 1) / 2) * 3;
    if (isSquareAttackedByEnemyOrMercenary(game, r, c, "black")) {
      score -= 250;
    }
  }

  void ctx;
  return score;
}

async function scoreCandidates(
  game: ChessState,
  ctx: BotSpellContext,
  spellId: string,
  baselineBlack: number,
): Promise<SpellCandidate | null> {
  const targets = enumerateSpellTargets(spellId, game, ctx);
  if (targets.length === 0) return null;

  const ranked = [...targets].sort(
    (a, b) =>
      heuristicTargetScore(game, ctx, spellId, b) -
      heuristicTargetScore(game, ctx, spellId, a),
  );
  const top = ranked.slice(0, MAX_SPELL_CANDIDATES);

  let best: SpellCandidate | null = null;
  for (const target of top) {
    const preview = previewSpell(spellId, game, ctx, target);
    if (!preview) continue;

    let evalGame = preview.game;
    if (spellId === "frost") {
      evalGame = gameForFrostEval(preview);
    } else if (spellId === "impassable") {
      evalGame = gameForMonolithEval(preview);
    }

    const afterBlack = await evalForBlack(
      evalGame,
      preview.ctx,
      preview.sideToMove,
    );
    if (afterBlack === null) continue;

    const gainCp = afterBlack - baselineBlack;
    if (!best || gainCp > best.gainCp) {
      best = { spellId, target, gainCp };
    }
  }
  return best;
}

export async function evaluateFreeSpells(
  game: ChessState,
  ctx: BotSpellContext,
): Promise<SpellCandidate | null> {
  if (ctx.augmentSpellBlockedFor === "black") return null;

  const baseline = await evalForBlack(game, ctx, "black");
  if (baseline === null) return null;

  const candidates: SpellCandidate[] = [];

  // Frost replaces the single frozen-square state. Never erase an existing
  // freeze merely because we still have charges.
  if (ctx.blackFreezeCharges > 0 && !ctx.frozenSquare) {
    const frost = await scoreCandidates(game, ctx, "frost", baseline);
    if (frost && frost.gainCp >= FREE_SPELL_THRESHOLD_CP) {
      candidates.push(frost);
    }
  }

  if (ctx.blackBlessedWaterCharges > 0) {
    const bless = await scoreCandidates(
      game,
      ctx,
      "blessed-water-spell",
      baseline,
    );
    if (bless && bless.gainCp >= FREE_SPELL_THRESHOLD_CP) {
      candidates.push(bless);
    }
  }

  return candidates.reduce<SpellCandidate | null>(
    (best, candidate) =>
      !best || candidate.gainCp > best.gainCp ? candidate : best,
    null,
  );
}

export async function evaluateTurnSpellVsMove(
  game: ChessState,
  ctx: BotSpellContext,
  precomputedMove?: BotMove | null,
): Promise<SpellCandidate | null> {
  if (ctx.augmentSpellBlockedFor === "black") return null;
  const baseline = await evalForBlack(game, ctx, "black");
  if (baseline === null) return null;

  const spellIds = [
    ...(ctx.monolithPlaceAvailable ? ["impassable"] : []),
    ...(ctx.blackNecroCharges && (ctx.blackLostPawnCols?.length ?? 0) > 0
      ? ["necromancer"]
      : []),
    ...(ctx.blackNecroPlusCharges &&
    (ctx.blackLostMinors?.some((type) => type === "N" || type === "B") ?? false)
      ? ["necromancer-plus"]
      : []),
    ...(ctx.blackNecroPPCharges ? ["necromancer-plus-plus"] : []),
  ];
  const candidates = (
    await Promise.all(
      spellIds.map((spellId) => scoreCandidates(game, ctx, spellId, baseline)),
    )
  ).filter((candidate): candidate is SpellCandidate => candidate !== null);
  const turnSpell = candidates.reduce<SpellCandidate | null>(
    (best, candidate) =>
      !best || candidate.gainCp > best.gainCp ? candidate : best,
    null,
  );
  if (!turnSpell) return null;
  const threshold =
    turnSpell.spellId === "impassable"
      ? TURN_SPELL_THRESHOLD_CP
      : TURN_SPELL_THRESHOLD_CP + 50;
  if (turnSpell.gainCp < threshold) return null;

  const move = precomputedMove ?? (await pickBotMove(game, ctx));
  if (!move) return turnSpell;

  let afterMoveBlack = baseline;
  try {
    const next = makeMove(game, move.from, move.to, move.promotion);
    const wEval = await evalForBlack(next, ctx, "white");
    if (wEval !== null) afterMoveBlack = wEval;
  } catch {
    /* keep baseline */
  }

  if (turnSpell.gainCp > afterMoveBlack - baseline) {
    return turnSpell;
  }
  return null;
}
