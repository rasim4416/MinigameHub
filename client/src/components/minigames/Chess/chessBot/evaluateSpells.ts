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
import { evalBlackPovFromPreview, evalForBlack } from "./evalPosition";
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
    score += 20;
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

function frostHighValueOverride(
  game: ChessState,
  ctx: BotSpellContext,
  candidate: SpellCandidate | null,
): SpellCandidate | null {
  if (!candidate || candidate.spellId !== "frost") return candidate;
  const [r, c] = candidate.target;
  const p = getDerivedBoard(game)[r][c];
  if (
    p &&
    p.color === "white" &&
    (p.type === "Q" || p.type === "R") &&
    frostTargetHasLegalMoves(game, candidate.target)
  ) {
    return candidate;
  }
  return candidate;
}

export async function evaluateFreeSpells(
  game: ChessState,
  ctx: BotSpellContext,
): Promise<SpellCandidate | null> {
  if (ctx.augmentSpellBlockedFor === "black") return null;

  const baseline = await evalForBlack(game, ctx, "black");
  if (baseline === null) return null;

  let best: SpellCandidate | null = null;

  if (ctx.blackFreezeCharges > 0) {
    const frost = await scoreCandidates(game, ctx, "frost", baseline);
    const frostChecked = frostHighValueOverride(game, ctx, frost);
    if (
      frostChecked &&
      (frostChecked.gainCp >= FREE_SPELL_THRESHOLD_CP ||
        (getDerivedBoard(game)[frostChecked.target[0]]?.[frostChecked.target[1]]
          ?.type === "Q" ||
          getDerivedBoard(game)[frostChecked.target[0]]?.[frostChecked.target[1]]
            ?.type === "R"))
    ) {
      if (!best || frostChecked.gainCp > best.gainCp) best = frostChecked;
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
      if (!best || bless.gainCp > best.gainCp) best = bless;
    }
  }

  return best;
}

export async function evaluateTurnSpellVsMove(
  game: ChessState,
  ctx: BotSpellContext,
  precomputedMove?: BotMove | null,
): Promise<SpellCandidate | null> {
  if (ctx.augmentSpellBlockedFor === "black") return null;
  if (!ctx.monolithPlaceAvailable) return null;

  const baseline = await evalForBlack(game, ctx, "black");
  if (baseline === null) return null;

  const monolith = await scoreCandidates(game, ctx, "impassable", baseline);
  if (!monolith || monolith.gainCp < TURN_SPELL_THRESHOLD_CP) return null;

  const move = precomputedMove ?? (await pickBotMove(game, ctx));
  if (!move) return monolith;

  let afterMoveBlack = baseline;
  try {
    const next = makeMove(game, move.from, move.to, move.promotion);
    const wEval = await evalForBlack(next, ctx, "white");
    if (wEval !== null) afterMoveBlack = wEval;
  } catch {
    /* keep baseline */
  }

  if (monolith.gainCp > afterMoveBlack - baseline) {
    return monolith;
  }
  return null;
}
