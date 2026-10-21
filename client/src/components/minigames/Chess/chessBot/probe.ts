import { isInCheck, type ChessState } from "../engine";
import { PROBE_MAX_DEPTH, PROBE_MOVETIME_MS, PROBE_RESERVE_MS } from "./constants";
import { isFenSafe, toStockfishFen } from "./fen";
import { MATE_CP, jsSearch } from "./jsSearch";
import { legalMovesFor, matchUci, toUci, withWalls, type RuleSet, type Side } from "./botRules";
import { abortSearches, analyse } from "./stockfishEngine";
import type { BotMove } from "./types";

export type ProbeLine = {
  move: BotMove;
  /** Black POV. */
  cp: number;
  pv: string[];
};

export type ProbeResult = {
  /** Black POV score of the position with best play from `stm`. */
  cp: number;
  best: BotMove | null;
  lines: ProbeLine[];
  source: "stockfish" | "js" | "terminal";
  depth: number;
};

export type ProbeOptions = {
  /** Root moves (already filtered by variant rules). Defaults to all legal. */
  moves?: BotMove[];
  multiPv?: number;
  movetimeMs?: number;
  depth?: number;
};

let generation = 0;

/** Stop every in-flight bot decision (its result will be discarded). */
export function cancelBotSearches(): void {
  generation++;
  abortSearches();
}

/** Wall-clock budget shared by every search in one bot decision. */
export class Budget {
  readonly deadline: number;
  private readonly gen = generation;
  constructor(ms: number) {
    this.deadline = Date.now() + ms;
  }
  get cancelled(): boolean {
    return this.gen !== generation;
  }
  left(): number {
    return this.cancelled ? 0 : this.deadline - Date.now();
  }
  canProbe(ms = PROBE_MOVETIME_MS): boolean {
    return this.left() > ms + PROBE_RESERVE_MS;
  }
}

class SearchAborted extends Error {}

const toBlack = (stm: Side, cp: number) => (stm === "black" ? cp : -cp);

function terminal(game: ChessState, stm: Side): ProbeResult {
  const mated = isInCheck({ ...game, turn: stm }, stm);
  const stmCp = mated ? -MATE_CP : 0;
  return { cp: toBlack(stm, stmCp), best: null, lines: [], source: "terminal", depth: 0 };
}

async function stockfishProbe(
  game: ChessState,
  stm: Side,
  moves: BotMove[],
  opts: ProbeOptions,
): Promise<ProbeResult | null> {
  if (!isFenSafe(game, stm)) return null;
  const fen = toStockfishFen(game, stm);
  const ucis = moves.map((m) => toUci(game, m));
  let res;
  const gen = generation;
  try {
    res = await analyse(fen, {
      movetimeMs: opts.movetimeMs ?? PROBE_MOVETIME_MS,
      depth: opts.depth,
      multiPv: Math.min(opts.multiPv ?? 1, moves.length),
      searchmoves: ucis,
    });
  } catch {
    // A cancelled turn must not fall through to the (synchronous) JS search.
    if (gen !== generation) throw new SearchAborted("Search aborted");
    return null;
  }
  const lines: ProbeLine[] = [];
  for (const l of res.lines) {
    const move = matchUci(l.uci, moves);
    if (!move || lines.some((x) => x.move === move)) continue;
    lines.push({ move, cp: toBlack(stm, l.cp), pv: l.pv });
  }
  if (lines.length === 0) {
    // Stockfish rejected every searchmove (our rules allow a move chess doesn't).
    return null;
  }
  return {
    cp: lines[0]!.cp,
    best: lines[0]!.move,
    lines,
    source: "stockfish",
    depth: res.depth,
  };
}

function fallbackProbe(
  game: ChessState,
  stm: Side,
  moves: BotMove[],
  rules: RuleSet,
  opts: ProbeOptions,
): ProbeResult {
  const walled = withWalls({ ...game, turn: stm }, rules);
  const time = Math.max(40, Math.min(600, opts.movetimeMs ?? PROBE_MOVETIME_MS));
  const depth = (opts.movetimeMs ?? PROBE_MOVETIME_MS) >= 300 ? 3 : 2;
  const res = jsSearch(walled, moves, time, depth);
  const lines = res.ranked.map((r) => ({ move: r.move, cp: toBlack(stm, r.cp), pv: [] }));
  return {
    cp: toBlack(stm, res.cp),
    best: lines[0]?.move ?? null,
    lines,
    source: "js",
    depth,
  };
}

/**
 * Evaluate `game` with `stm` to move, restricted to `opts.moves`. Returns a
 * black-POV score. Never throws: Stockfish failures fall back to the JS search.
 */
export async function probe(
  game: ChessState,
  stm: Side,
  rules: RuleSet,
  opts: ProbeOptions = {},
): Promise<ProbeResult> {
  const moves = opts.moves ?? legalMovesFor(game, stm, rules);
  if (moves.length === 0) return terminal(game, stm);
  let sf: ProbeResult | null;
  try {
    sf = await stockfishProbe(game, stm, moves, {
      ...opts,
      depth: opts.depth ?? (opts.movetimeMs ? undefined : PROBE_MAX_DEPTH),
    });
  } catch (err) {
    if (!(err instanceof SearchAborted)) throw err;
    return { cp: 0, best: moves[0]!, lines: [], source: "terminal", depth: 0 };
  }
  return sf ?? fallbackProbe(game, stm, moves, rules, opts);
}
