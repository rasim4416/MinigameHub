import { getDerivedBoard, syncStateFromBoard, type ChessState } from "../engine";
import {
  DECISION_BUDGET_MS,
  FREE_SPELL_THRESHOLD_CP,
  THREAT_WEIGHT,
  TURN_SPELL_THRESHOLD_CP,
} from "./constants";
import {
  advanceRules,
  applyMove,
  EMPTY_RULES,
  legalMovesFor,
  moveKey,
  rulesFromCtx,
  type RuleSet,
} from "./botRules";
import { positionKey } from "./fen";
import { value } from "./heuristics";
import { Budget, probe } from "./probe";
import { analyseRoot, enemyThreatsPresent } from "./rootAnalysis";
import { assessThreats, type Candidate } from "./threats";
import { evaluatePlans, planAction, type Plan } from "./plans";
import { contractCaptureMove, pickDeathNoteTarget } from "./evaluateMarkingSpells";
import type { BotAction, BotMove, BotSpellContext } from "./types";
import { sameMove } from "./uciParse";

/** Move chosen together with a free spell; played on the very next call. */
let pendingFollowUp: { key: string; move: BotMove } | null = null;

export function resetBotMemory(): void {
  pendingFollowUp = null;
}

export type BotDecisionTrace = {
  elapsedMs: number;
  source: string;
  depth: number;
  candidates: { uci: string; cp: number; score: number; risk: string | null }[];
  plans: { spellId: string; target: [number, number]; net: number }[];
  chosen: string;
};

let lastTrace: BotDecisionTrace | null = null;
export function getLastBotTrace(): BotDecisionTrace | null {
  return lastTrace;
}

function takeFollowUp(game: ChessState, legal: BotMove[]): BotMove | null {
  const memo = pendingFollowUp;
  pendingFollowUp = null;
  if (!memo || memo.key !== positionKey(game, "black")) return null;
  return legal.find((m) => sameMove(m, memo.move)) ?? null;
}

/** Stockfish can't see walls/blessings: does White's reply set differ from chess? */
function replyRulesDiffer(after: ChessState, rulesW: RuleSet): boolean {
  const board = getDerivedBoard(after);
  const hasWallPiece = board.some((row) => row.some((p) => p?.type === "M"));
  const relevant =
    rulesW.blessed.length > 0 ||
    rulesW.walls.length > 0 ||
    rulesW.frozen !== null ||
    rulesW.coldWindsMovesLeft > 0 ||
    hasWallPiece ||
    (after.permaFrozenSquares?.length ?? 0) > 0 ||
    rulesW.augments.white.some((a) => a.id.startsWith("alternative"));
  if (!relevant) return false;
  const ours = legalMovesFor(after, "white", rulesW);
  const sfView = syncStateFromBoard(
    { ...after, permaFrozenSquares: [] },
    board.map((row) => row.map((p) => (p?.type === "M" ? null : p))),
  );
  const chess = legalMovesFor(sfView, "white", EMPTY_RULES);
  if (ours.length !== chess.length) return true;
  const keys = new Set(chess.map(moveKey));
  return ours.some((m) => !keys.has(moveKey(m)));
}

function doomedBonus(cand: Candidate, ctx: BotSpellContext): number {
  const doomed = ctx.blackDoomedPieceIds;
  if (!doomed?.length || !cand.pv[1]) return 0;
  const m = cand.pv[1].match(/^[a-h][1-8]([a-h])([1-8])/);
  if (!m) return 0;
  const r = 8 - Number(m[2]);
  const c = m[1]!.charCodeAt(0) - 97;
  const victim = getDerivedBoard(cand.after.state)[r]?.[c];
  if (!victim || victim.color !== "black" || !victim.id || !doomed.includes(victim.id)) return 0;
  // The engine mourns a piece that Death Note takes anyway.
  return Math.round(value(victim) * 100 * 0.8);
}

/**
 * One bot turn: a single deep root search, cheap corrections for rules the
 * engine can't see, enemy-spell risk on the top candidates, then our own
 * spell plans — all inside DECISION_BUDGET_MS.
 */
export async function decideBotAction(
  game: ChessState,
  ctx: BotSpellContext,
): Promise<BotAction | null> {
  if (game.turn !== "black") return null;
  const started = Date.now();
  const budget = new Budget(DECISION_BUDGET_MS);
  const spellsOpen = ctx.augmentSpellBlockedFor !== "black";

  const rules = rulesFromCtx(ctx);
  const legal = legalMovesFor(game, "black", rules);

  const follow = takeFollowUp(game, legal);
  if (follow) return { type: "move", move: follow };

  if (spellsOpen) {
    const deathTarget = pickDeathNoteTarget(game, ctx);
    if (deathTarget) return { type: "castSpell", spellId: "death-note", target: deathTarget };
  }

  const root = await analyseRoot(game, ctx, { legal, rules });

  const icDefender = ctx.whiteIcAvailable ? ("white" as const) : null;
  const rulesW = advanceRules(rules, "black");
  const candidates: Candidate[] = [];
  for (const line of root.result?.lines ?? []) {
    const after = applyMove(game, line.move, icDefender);
    if (!after) continue;
    candidates.push({ move: line.move, cp: line.cp, pv: line.pv, after, score: line.cp, risk: 0, riskNote: null });
  }

  // Reply-rule corrections: the engine assumed White may capture blessed
  // pieces, walk through walls, or keep a checker Internal Combustion kills.
  if (candidates.length > 1 || legal.length > 1) {
    for (const cand of candidates.slice(0, 3)) {
      if (!budget.canProbe()) break;
      if (cand.after.exploded || replyRulesDiffer(cand.after.state, rulesW)) {
        const res = await probe(cand.after.state, "white", rulesW);
        cand.cp = res.cp;
      }
      cand.cp += doomedBonus(cand, ctx);
      cand.score = cand.cp;
    }
  }

  if (enemyThreatsPresent(ctx) && candidates.length > 1) {
    for (const cand of candidates.slice(0, 3)) {
      if (!budget.canProbe(300)) break;
      const { risk, note } = await assessThreats(cand, ctx, rules, budget);
      cand.risk = risk;
      cand.riskNote = note;
      cand.score = cand.cp - THREAT_WEIGHT * risk;
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0] ?? null;

  let chosenPlan: Plan | null = null;
  let plans: Plan[] = [];
  if (spellsOpen) {
    plans = await evaluatePlans({ game, ctx, rules, legal, candidates, budget, icDefender });
    const baseline = best ? best.cp : -Infinity;
    for (const plan of plans) {
      const net = plan.value - plan.cost;
      const margin = plan.followUp ? FREE_SPELL_THRESHOLD_CP : TURN_SPELL_THRESHOLD_CP;
      if (net < baseline + margin) continue;
      if (!chosenPlan || net > chosenPlan.value - chosenPlan.cost) chosenPlan = plan;
    }
  }

  const fallbackMove = best?.move ?? legal[0] ?? null;
  let action: BotAction | null;
  if (chosenPlan) {
    pendingFollowUp = chosenPlan.followUp;
    action = planAction(chosenPlan);
  } else if (fallbackMove) {
    const contract = spellsOpen ? contractCaptureMove(game, ctx, fallbackMove) : null;
    action = contract
      ? { type: "castSpellThenMove", spellId: "contract-killer", target: contract.target, move: contract.move }
      : { type: "move", move: fallbackMove };
  } else {
    action = null;
  }

  lastTrace = {
    elapsedMs: Date.now() - started,
    source: root.result?.source ?? "none",
    depth: root.result?.depth ?? 0,
    candidates: candidates.map((c) => ({
      uci: moveKey(c.move),
      cp: Math.round(c.cp),
      score: Math.round(c.score),
      risk: c.riskNote,
    })),
    plans: plans.map((p) => ({ spellId: p.spellId, target: p.target, net: Math.round(p.value - p.cost) })),
    chosen: action ? (action.type === "move" ? moveKey(action.move) : `${action.type}:${"spellId" in action ? action.spellId : ""}`) : "none",
  };
  return action;
}
