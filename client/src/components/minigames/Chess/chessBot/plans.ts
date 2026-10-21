import {
  cloneBoard,
  getDerivedBoard,
  isInCheck,
  syncStateFromBoard,
  type ChessState,
} from "../engine";
import { getBlessedWaterMovesLeft, getFrostFreezeTurns, getImproveLevel } from "../augments";
import { LBM_PHANTOM_CP, SPELL_COST_CP } from "./constants";
import {
  advanceRules,
  applyMove,
  isBlessed,
  legalMovesFor,
  matchUci,
  passTurn,
  pieceAt,
  type RuleSet,
  type Sq,
} from "./botRules";
import { positionKey } from "./fen";
import { forcedMoveLoss, queenLineScore, value } from "./heuristics";
import { probe, type Budget } from "./probe";
import { previewRevival } from "./spellPreview";
import { enumerateSpellTargets } from "./spellTargets";
import type { Candidate } from "./threats";
import type { BotAction, BotMove, BotSpellContext } from "./types";
import { sameMove } from "./uciParse";

export type Plan = {
  spellId: string;
  target: Sq;
  /** Black POV after the plan. */
  value: number;
  cost: number;
  /** Free spells keep our turn: this is the move to play right after. */
  followUp: { key: string; move: BotMove } | null;
};

export function planAction(plan: Plan): BotAction {
  return { type: "castSpell", spellId: plan.spellId, target: plan.target };
}

type PlanInput = {
  game: ChessState;
  ctx: BotSpellContext;
  rules: RuleSet;
  legal: BotMove[];
  candidates: Candidate[];
  budget: Budget;
  icDefender: "white" | null;
};

const sqKey = (s: Sq) => `${s[0]},${s[1]}`;

function cost(spellId: string, charges = 1): number {
  const base = SPELL_COST_CP[spellId] ?? 50;
  return charges >= 2 ? Math.round(base * 0.65) : base;
}

/** Black POV after our move `m` and White's best reply under `rules`. */
async function scoreMoveUnder(
  input: PlanInput,
  m: BotMove,
  rules: RuleSet,
): Promise<number | null> {
  const after = applyMove(input.game, m, input.icDefender);
  if (!after) return null;
  const rulesW = advanceRules(rules, "black");
  const res = await probe(after.state, "white", rulesW);
  return res.cp;
}

function whiteReply(input: PlanInput, cand: Candidate): BotMove | null {
  if (!cand.pv[1]) return null;
  const rulesW = advanceRules(input.rules, "black");
  return matchUci(cand.pv[1], legalMovesFor(cand.after.state, "white", rulesW));
}

// ─── Free spells (cast, then move this same turn) ──────────────────────────

/**
 * Frost a White piece, then move. Targets are the piece that refutes one of
 * our top lines, the lone recapturer of a capture we'd like to make, and —
 * when White froze one of ours — any target, purely to thaw our piece.
 */
async function frostPlans(input: PlanInput): Promise<Plan[]> {
  const { game, ctx, rules, candidates, budget } = input;
  if (ctx.blackFreezeCharges <= 0) return [];
  const frozenPiece = rules.frozen ? pieceAt(game, rules.frozen) : null;
  if (frozenPiece?.color === "white" && rules.frozenTurnsLeft >= 2) return [];
  const turns = getFrostFreezeTurns(getImproveLevel(ctx.blackAugmentLevels, "frost"));
  const pairs = new Map<string, { target: Sq; move: BotMove }>();
  const add = (target: Sq, move: BotMove) => {
    const p = pieceAt(game, target);
    if (!p || p.color !== "white" || p.type === "K" || p.type === "M") return;
    pairs.set(`${sqKey(target)}|${sqKey(move.from)}>${sqKey(move.to)}`, { target, move });
  };

  for (const cand of candidates.slice(0, 3)) {
    const reply = whiteReply(input, cand);
    if (reply) add(reply.from, cand.move);
  }

  // Captures Stockfish rejects only because one piece can take back.
  const board = getDerivedBoard(game);
  const captures = input.legal
    .filter((m) => board[m.to[0]]?.[m.to[1]]?.color === "white")
    .sort((a, b) => value(board[b.to[0]]?.[b.to[1]]) - value(board[a.to[0]]?.[a.to[1]]));
  const rulesW = advanceRules(rules, "black");
  let checked = 0;
  for (const m of captures) {
    if (checked >= 4) break;
    const victim = board[m.to[0]]?.[m.to[1]];
    const attacker = board[m.from[0]]?.[m.from[1]];
    if (!victim || !attacker) continue;
    checked++;
    const after = applyMove(game, m, input.icDefender);
    if (!after) continue;
    const recapturers = new Set(
      legalMovesFor(after.state, "white", rulesW)
        .filter((w) => w.to[0] === m.to[0] && w.to[1] === m.to[1])
        .map((w) => sqKey(w.from)),
    );
    if (recapturers.size === 1) {
      const [only] = [...recapturers];
      add(only!.split(",").map(Number) as Sq, m);
    }
  }

  // Thaw: re-casting Frost moves the single freeze off our own piece.
  if (frozenPiece?.color === "black" && rules.frozen && budget.canProbe()) {
    const thawRules = { ...rules, frozen: null, frozenTurnsLeft: 0 };
    const thawMoves = legalMovesFor(game, "black", thawRules, { onlyFrom: rules.frozen });
    if (thawMoves.length > 0) {
      const res = await probe(game, "black", thawRules, { moves: thawMoves });
      if (res.best) {
        const after = applyMove(game, res.best, input.icDefender);
        const reply =
          after && res.lines[0]?.pv[1]
            ? matchUci(res.lines[0].pv[1], legalMovesFor(after.state, "white", rulesW))
            : null;
        const target = reply?.from ?? mostActiveWhitePiece(game, rules);
        if (target) add(target, res.best);
      }
    }
  }

  const plans: Plan[] = [];
  for (const { target, move } of pairs.values()) {
    if (!budget.canProbe()) break;
    const frostRules: RuleSet = { ...rules, frozen: target, frozenTurnsLeft: turns };
    const v = await scoreMoveUnder(input, move, frostRules);
    if (v === null) continue;
    plans.push({
      spellId: "frost",
      target,
      value: v,
      cost: cost("frost", ctx.blackFreezeCharges),
      followUp: { key: positionKey(game, "black"), move },
    });
  }
  return plans;
}

function mostActiveWhitePiece(game: ChessState, rules: RuleSet): Sq | null {
  const moves = legalMovesFor(game, "white", rules);
  const counts = new Map<string, number>();
  for (const m of moves) {
    const p = pieceAt(game, m.from);
    if (!p || p.type === "K") continue;
    counts.set(sqKey(m.from), (counts.get(sqKey(m.from)) ?? 0) + 1 + value(p));
  }
  let best: [string, number] | null = null;
  for (const e of counts) if (!best || e[1] > best[1]) best = e;
  return best ? (best[0].split(",").map(Number) as Sq) : null;
}

/** Bless the square White wants to capture on, then make our move. */
async function blessPlans(input: PlanInput): Promise<Plan[]> {
  const { game, ctx, rules, candidates, budget } = input;
  if (ctx.blackBlessedWaterCharges <= 0) return [];
  const movesLeft = getBlessedWaterMovesLeft(
    getImproveLevel(ctx.blackAugmentLevels, "blessed-water-spell"),
  );
  const board = getDerivedBoard(game);
  const plans: Plan[] = [];
  const seen = new Set<string>();
  for (const cand of candidates.slice(0, 3)) {
    const reply = whiteReply(input, cand);
    if (!reply) continue;
    const victim = pieceAt(cand.after.state, reply.to);
    if (!victim || victim.color !== "black") continue;
    let square: Sq | null = null;
    const movedHere = cand.move.to[0] === reply.to[0] && cand.move.to[1] === reply.to[1];
    if (movedHere && !board[cand.move.to[0]]?.[cand.move.to[1]]) square = cand.move.to;
    else if (!movedHere && pieceAt(game, reply.to)?.color === "black") square = reply.to;
    if (!square || isBlessed(rules, square[0], square[1])) continue;
    const key = `${sqKey(square)}|${sqKey(cand.move.from)}>${sqKey(cand.move.to)}`;
    if (seen.has(key) || !budget.canProbe()) continue;
    seen.add(key);
    const blessRules: RuleSet = {
      ...rules,
      blessed: [...rules.blessed, { row: square[0], col: square[1], movesLeft }],
    };
    const v = await scoreMoveUnder(input, cand.move, blessRules);
    if (v === null) continue;
    plans.push({
      spellId: "blessed-water-spell",
      target: square,
      value: v,
      cost: cost("blessed-water-spell", ctx.blackBlessedWaterCharges),
      followUp: { key: positionKey(game, "black"), move: cand.move },
    });
  }
  return plans;
}

/** Little Big Man: one pawn moves like a queen for a few rounds. */
async function littleBigManPlans(input: PlanInput): Promise<Plan[]> {
  const { game, ctx, rules, budget } = input;
  if ((ctx.blackLittleBigManCharges ?? 0) <= 0 || game.littleBigManBlackId) return [];
  const board = getDerivedBoard(game);
  const pawns: { sq: Sq; id: string; score: number }[] = [];
  for (let r = 0; r < board.length; r++)
    for (let c = 0; c < (board[r]?.length ?? 0); c++) {
      const p = board[r][c];
      if (p?.type === "P" && p.color === "black" && p.id)
        pawns.push({ sq: [r, c], id: p.id, score: queenLineScore(game, [r, c], "black") });
    }
  pawns.sort((a, b) => b.score - a.score);
  const plans: Plan[] = [];
  for (const pawn of pawns.slice(0, 3)) {
    if (pawn.score < 2 || !budget.canProbe()) break;
    const lbm: ChessState = { ...game, littleBigManBlackId: pawn.id };
    const res = await probe(lbm, "black", rules);
    if (!res.best) continue;
    plans.push({
      spellId: "little-big-man",
      target: pawn.sq,
      value: res.cp - LBM_PHANTOM_CP,
      cost: cost("little-big-man", ctx.blackLittleBigManCharges),
      followUp: { key: positionKey(game, "black"), move: res.best },
    });
  }
  return plans;
}

/** Bloodbending+: permanently turn a White minor or rook into ours. */
async function bloodbendingPlusPlans(input: PlanInput): Promise<Plan[]> {
  const { game, ctx, rules, budget } = input;
  if ((ctx.blackBloodbendingPlusCharges ?? 0) <= 0) return [];
  const board = getDerivedBoard(game);
  const targets: Sq[] = [];
  for (let r = 0; r < board.length; r++)
    for (let c = 0; c < (board[r]?.length ?? 0); c++) {
      const p = board[r][c];
      if (
        p?.color === "white" &&
        (p.type === "N" || p.type === "B" || p.type === "R") &&
        !isBlessed(rules, r, c)
      )
        targets.push([r, c]);
    }
  targets.sort((a, b) => value(pieceAt(game, b)) - value(pieceAt(game, a)));
  const plans: Plan[] = [];
  for (const target of targets.slice(0, 3)) {
    if (!budget.canProbe()) break;
    const nb = cloneBoard(board);
    nb[target[0]][target[1]] = { ...nb[target[0]][target[1]]!, color: "black" };
    const flipped = syncStateFromBoard({ ...game, turn: "black" }, nb);
    // A flip that leaves White in check on our turn is not a sane position.
    if (isInCheck(flipped, "white")) continue;
    const res = await probe(flipped, "black", rules);
    if (!res.best) continue;
    plans.push({
      spellId: "bloodbending-plus",
      target,
      value: res.cp,
      cost: cost("bloodbending-plus"),
      followUp: { key: positionKey(flipped, "black"), move: res.best },
    });
  }
  return plans;
}

// ─── Turn spells (replace our move) ─────────────────────────────────────────

/** Puppet: pass, and make White move its most awkward piece. */
async function puppetPlans(input: PlanInput): Promise<Plan[]> {
  const { game, ctx, rules, budget } = input;
  if (!ctx.puppetAvailable || isInCheck(game, "black")) return [];
  const passed = passTurn(game);
  const rulesW = advanceRules(rules, "black");
  const all = legalMovesFor(passed, "white", rulesW);
  const engineView = { ...game, turn: "white" as const };
  const bySquare = new Map<string, BotMove[]>();
  for (const m of all) {
    const p = pieceAt(game, m.from);
    if (!p || p.type === "K" || p.type === "M" || p.color !== "white") continue;
    bySquare.set(sqKey(m.from), [...(bySquare.get(sqKey(m.from)) ?? []), m]);
  }
  const ranked = [...bySquare.entries()]
    .map(([k, moves]) => ({
      sq: k.split(",").map(Number) as Sq,
      moves,
      loss: forcedMoveLoss(passed, "white", moves),
    }))
    .filter((t) => legalMovesFor(engineView, "white", rules, { onlyFrom: t.sq }).length > 0)
    .sort((a, b) => b.loss - a.loss || a.moves.length - b.moves.length);
  const plans: Plan[] = [];
  for (const t of ranked.slice(0, 3)) {
    if (t.loss < 1 && plans.length > 0) break;
    if (!budget.canProbe()) break;
    const res = await probe(passed, "white", rulesW, { moves: t.moves });
    plans.push({ spellId: "puppet", target: t.sq, value: res.cp, cost: cost("puppet"), followUp: null });
  }
  return plans;
}

/** Monolith: wall off the line White's best reply travels along. */
async function monolithPlans(input: PlanInput): Promise<Plan[]> {
  const { game, ctx, rules, candidates, budget } = input;
  if (!ctx.monolithPlaceAvailable) return [];
  const board = getDerivedBoard(game);
  const squares = new Map<string, Sq>();
  for (const cand of candidates.slice(0, 2)) {
    if (!cand.pv[1]) continue;
    const reply = matchUci(cand.pv[1], legalMovesFor(passTurn(game), "white", advanceRules(rules, "black")));
    if (!reply) continue;
    const p = pieceAt(game, reply.from);
    if (!p || !["Q", "R", "B"].includes(p.type)) continue;
    const dr = Math.sign(reply.to[0] - reply.from[0]);
    const dc = Math.sign(reply.to[1] - reply.from[1]);
    let r = reply.from[0] + dr;
    let c = reply.from[1] + dc;
    while (r !== reply.to[0] || c !== reply.to[1]) {
      const perm = game.permaFrozenSquares?.some((s) => s.row === r && s.col === c);
      if (!board[r]?.[c] && !perm) squares.set(`${r},${c}`, [r, c]);
      r += dr;
      c += dc;
    }
  }
  const plans: Plan[] = [];
  for (const sq of [...squares.values()].slice(0, 3)) {
    if (!budget.canProbe()) break;
    const nb = cloneBoard(board);
    nb[sq[0]][sq[1]] = { type: "M", color: "black" };
    const walled = passTurn(game, nb);
    const res = await probe(walled, "white", advanceRules(rules, "black"));
    plans.push({ spellId: "impassable", target: sq, value: res.cp, cost: cost("impassable"), followUp: null });
  }
  return plans;
}

/** Necromancer variants: revive onto the safest useful square. */
async function revivalPlans(input: PlanInput): Promise<Plan[]> {
  const { game, ctx, rules, budget } = input;
  const plans: Plan[] = [];
  for (const spellId of ["necromancer-plus-plus", "necromancer-plus", "necromancer"]) {
    const targets = enumerateSpellTargets(spellId, game, ctx);
    if (targets.length === 0) continue;
    const cols = getDerivedBoard(game)[0]?.length ?? 8;
    const ranked = [...targets].sort(
      (a, b) => Math.abs(a[1] - (cols - 1) / 2) - Math.abs(b[1] - (cols - 1) / 2),
    );
    for (const target of ranked.slice(0, 2)) {
      if (!budget.canProbe()) break;
      const preview = previewRevival(spellId, game, ctx, target);
      if (!preview || isInCheck(preview.game, "black")) continue;
      const res = await probe(preview.game, "white", advanceRules(rules, "black"));
      plans.push({ spellId, target, value: res.cp, cost: cost(spellId), followUp: null });
    }
  }
  return plans;
}

/** Bloodbending: turn an advanced White pawn (spends our turn). */
async function bloodbendingPlans(input: PlanInput): Promise<Plan[]> {
  const { game, ctx, rules, budget } = input;
  if ((ctx.blackBloodbendingCharges ?? 0) <= 0) return [];
  const board = getDerivedBoard(game);
  const bs = board.length;
  const off = (bs - 8) / 2;
  const targets: Sq[] = [];
  for (let r = 0; r < bs; r++)
    for (let c = 0; c < (board[r]?.length ?? 0); c++) {
      const p = board[r][c];
      if (p?.type !== "P" || p.color !== "white" || isBlessed(rules, r, c)) continue;
      const onSpawn = r === 6 + off && c >= off && c < off + 8;
      if (!onSpawn) targets.push([r, c]);
    }
  targets.sort((a, b) => a[0] - b[0]);
  const plans: Plan[] = [];
  for (const target of targets.slice(0, 2)) {
    if (!budget.canProbe()) break;
    const nb = cloneBoard(board);
    nb[target[0]][target[1]] = { ...nb[target[0]][target[1]]!, color: "black" };
    const next = passTurn(game, nb);
    if (isInCheck(next, "black")) continue;
    const res = await probe(next, "white", advanceRules(rules, "black"));
    plans.push({ spellId: "bloodbending", target, value: res.cp, cost: cost("bloodbending"), followUp: null });
  }
  return plans;
}

/**
 * Every spell plan worth considering this turn. Free spells are evaluated
 * first (they are cheaper to misjudge), then turn-spending spells.
 */
export async function evaluatePlans(input: PlanInput): Promise<Plan[]> {
  if (input.ctx.augmentSpellBlockedFor === "black") return [];
  const groups = [
    bloodbendingPlusPlans,
    revivalPlans,
    frostPlans,
    blessPlans,
    puppetPlans,
    littleBigManPlans,
    monolithPlans,
    bloodbendingPlans,
  ];
  const plans: Plan[] = [];
  for (const g of groups) {
    if (!input.budget.canProbe()) break;
    plans.push(...(await g(input)));
  }
  return plans.filter((p) => !p.followUp || input.legal.length === 0 || validFollowUp(p, input));
}

function validFollowUp(plan: Plan, input: PlanInput): boolean {
  const move = plan.followUp?.move;
  if (!move) return true;
  if (plan.spellId === "bloodbending-plus" || plan.spellId === "little-big-man") return true;
  if (plan.spellId === "frost") return true;
  return input.legal.some((m) => sameMove(m, move));
}
