import { getDerivedBoard, type ChessState } from "../engine";
import { LBM_PHANTOM_CP } from "./constants";
import {
  advanceRules,
  applyMove,
  isBlessed,
  legalMovesFor,
  matchUci,
  passTurn,
  type AppliedMove,
  type RuleSet,
} from "./botRules";
import { forcedMoveLoss, queenLineScore, value } from "./heuristics";
import { probe, type Budget } from "./probe";
import type { BotMove, BotSpellContext } from "./types";

/** Depth-12 probes vs the deep root differ by this much on quiet positions. */
const PROBE_NOISE_CP = 30;

export type Candidate = {
  move: BotMove;
  /** Black POV, after reply-rule corrections. */
  cp: number;
  pv: string[];
  after: AppliedMove;
  /** Black POV after subtracting weighted enemy-spell risk. */
  score: number;
  risk: number;
  riskNote: string | null;
};

type Threat = { cp: number; note: string };

function lossVs(cand: Candidate, cp: number): number {
  return Math.max(0, cand.cp - cp - PROBE_NOISE_CP);
}

/**
 * How much worse `cand` gets if White answers with a spell instead of a
 * plain move. Each threat is verified with a short engine probe; the static
 * filters only decide which few spell targets are worth probing.
 */
export async function assessThreats(
  cand: Candidate,
  ctx: BotSpellContext,
  rules: RuleSet,
  budget: Budget,
): Promise<{ risk: number; note: string | null }> {
  if (ctx.augmentSpellBlockedFor === "white") return { risk: 0, note: null };
  const after = cand.after.state;
  if (after.status === "checkmate" || after.status === "stalemate") return { risk: 0, note: null };
  const rulesW = advanceRules(rules, "black");
  const whiteMoves = legalMovesFor(after, "white", rulesW);
  if (whiteMoves.length === 0) return { risk: 0, note: null };

  const threats: Threat[] = [];
  const reply = cand.pv[1] ? matchUci(cand.pv[1], whiteMoves) : null;
  const afterReply = reply ? applyMove(after, reply, null) : null;
  const rulesB2 = advanceRules(rulesW, "white");
  const blackMoves2 = afterReply ? legalMovesFor(afterReply.state, "black", rulesB2) : [];
  const response = afterReply && cand.pv[2] ? matchUci(cand.pv[2], blackMoves2) : null;

  // Frost: freeze the piece we planned to answer with.
  if ((ctx.whiteFreezeCharges ?? 0) > 0) {
    if (afterReply && response) {
      const responder = getDerivedBoard(afterReply.state)[response.from[0]]?.[response.from[1]];
      if (responder && responder.type !== "K" && budget.canProbe()) {
        const restricted = blackMoves2.filter(
          (m) => m.from[0] !== response.from[0] || m.from[1] !== response.from[1],
        );
        const res = await probe(afterReply.state, "black", rulesB2, { moves: restricted });
        threats.push({ cp: lossVs(cand, res.cp), note: "frost-response" });
      }
    }
    const capture = soleDefenderCapture(after, whiteMoves, rulesB2);
    if (capture && budget.canProbe()) {
      const res = await probe(capture.state, "black", rulesB2, { moves: capture.blackMoves });
      threats.push({ cp: lossVs(cand, res.cp), note: "frost-defender" });
    }
  }

  // Blessed Water: White blesses the piece we planned to capture.
  if ((ctx.whiteBlessedWaterCharges ?? 0) > 0 && afterReply && response) {
    const victim = getDerivedBoard(afterReply.state)[response.to[0]]?.[response.to[1]];
    if (victim && victim.color === "white" && budget.canProbe()) {
      const restricted = blackMoves2.filter(
        (m) =>
          m.to[0] !== response.to[0] ||
          m.to[1] !== response.to[1] ||
          !getDerivedBoard(afterReply.state)[m.to[0]]?.[m.to[1]],
      );
      const res = await probe(afterReply.state, "black", rulesB2, { moves: restricted });
      threats.push({ cp: lossVs(cand, res.cp), note: "bless-block" });
    }
  }

  // Puppet: White passes and forces our worst-placed piece to move.
  if (ctx.whitePuppetAvailable && after.status !== "check") {
    const forcedState = passTurn(after);
    const rulesP = advanceRules(rulesW, "white");
    const all = legalMovesFor(forcedState, "black", rulesP);
    const bySquare = new Map<string, BotMove[]>();
    for (const m of all) {
      const p = getDerivedBoard(forcedState)[m.from[0]]?.[m.from[1]];
      if (!p || p.type === "K") continue;
      const k = `${m.from[0]},${m.from[1]}`;
      bySquare.set(k, [...(bySquare.get(k) ?? []), m]);
    }
    let worst: { moves: BotMove[]; loss: number } | null = null;
    for (const moves of bySquare.values()) {
      const loss = forcedMoveLoss(forcedState, "black", moves);
      if (!worst || loss > worst.loss) worst = { moves, loss };
    }
    if (worst && worst.loss >= 2 && budget.canProbe()) {
      const res = await probe(forcedState, "black", rulesP, { moves: worst.moves });
      threats.push({ cp: lossVs(cand, res.cp), note: "puppet" });
    }
  }

  // Little Big Man: any white pawn may start moving like a queen right now.
  if ((ctx.whiteLittleBigManCharges ?? 0) > 0 && !after.littleBigManWhiteId) {
    const board = getDerivedBoard(after);
    const pawns: { id: string; score: number }[] = [];
    for (let r = 0; r < board.length; r++)
      for (let c = 0; c < (board[r]?.length ?? 0); c++) {
        const p = board[r][c];
        if (p?.type === "P" && p.color === "white" && p.id)
          pawns.push({ id: p.id, score: queenLineScore(after, [r, c], "white") });
      }
    pawns.sort((a, b) => b.score - a.score);
    for (const pawn of pawns.slice(0, 2)) {
      if (pawn.score < 3 || !budget.canProbe()) break;
      const lbm: ChessState = { ...after, littleBigManWhiteId: pawn.id };
      const res = await probe(lbm, "white", rulesW);
      threats.push({ cp: lossVs(cand, res.cp + LBM_PHANTOM_CP), note: "lbm" });
    }
  }

  // Bloodbending+: White flips one of our minors/rooks. Mostly constant, but
  // it rewards moves that trade or bless the exposed piece.
  if ((ctx.whiteBloodbendingPlusCharges ?? 0) > 0) {
    const board = getDerivedBoard(after);
    let exposed = 0;
    for (let r = 0; r < board.length; r++)
      for (let c = 0; c < (board[r]?.length ?? 0); c++) {
        const p = board[r][c];
        if (p?.color === "black" && (p.type === "N" || p.type === "B" || p.type === "R"))
          if (!isBlessed(rulesW, r, c)) exposed = Math.max(exposed, value(p));
      }
    threats.push({ cp: exposed * 100 * 0.3, note: "bloodbending" });
  }

  let top: Threat | null = null;
  for (const t of threats) if (!top || t.cp > top.cp) top = t;
  return top && top.cp > 0 ? { risk: top.cp, note: top.note } : { risk: 0, note: null };
}

/**
 * A White capture whose only recapture comes from a single non-king piece —
 * freezing that piece makes the capture free. Returns the position after the
 * capture and our moves without the frozen recapturer.
 */
function soleDefenderCapture(
  after: ChessState,
  whiteMoves: BotMove[],
  rulesB2: RuleSet,
): { state: ChessState; blackMoves: BotMove[] } | null {
  const board = getDerivedBoard(after);
  let best: { state: ChessState; blackMoves: BotMove[]; extra: number } | null = null;
  for (const w of whiteMoves) {
    const victim = board[w.to[0]]?.[w.to[1]];
    const attacker = board[w.from[0]]?.[w.from[1]];
    if (!victim || victim.color !== "black" || !attacker || value(victim) < 3) continue;
    const extra = Math.min(value(victim), attacker.type === "K" ? 0 : value(attacker));
    if (extra < 2 || (best && extra <= best.extra)) continue;
    const cap = applyMove(after, w, null);
    if (!cap) continue;
    const replies = legalMovesFor(cap.state, "black", rulesB2);
    const recapturers = new Set(
      replies
        .filter((m) => m.to[0] === w.to[0] && m.to[1] === w.to[1])
        .map((m) => `${m.from[0]},${m.from[1]}`),
    );
    if (recapturers.size !== 1) continue;
    const [only] = [...recapturers];
    const [rr, rc] = only!.split(",").map(Number) as [number, number];
    if (getDerivedBoard(cap.state)[rr]?.[rc]?.type === "K") continue;
    best = {
      state: cap.state,
      blackMoves: replies.filter((m) => m.from[0] !== rr || m.from[1] !== rc),
      extra,
    };
  }
  return best ? { state: best.state, blackMoves: best.blackMoves } : null;
}
