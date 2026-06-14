import type { EvalSearchOptions, RankedSearchOptions } from "./types";
import {
  SPELL_EVAL_DEPTH,
  SPELL_EVAL_MOVETIME_MS,
} from "./constants";

const ENGINE_URL = "/stockfish/stockfish-18-lite-single.js";

type PendingMoves = {
  kind: "moves";
  resolve: (moves: string[]) => void;
  reject: (err: Error) => void;
  pvMap: Map<number, string>;
  bestmove: string | null;
  multiPv: number;
};

type PendingEval = {
  kind: "eval";
  resolve: (cp: number) => void;
  reject: (err: Error) => void;
  lastCp: number | null;
  lastMate: number | null;
};

type PendingOp = PendingMoves | PendingEval;

let worker: Worker | null = null;
let ready = false;
let initPromise: Promise<void> | null = null;
let pending: PendingOp | null = null;

function post(line: string) {
  worker?.postMessage(line);
}

function parsePvMove(line: string): { multipv: number; move: string } | null {
  const mp = line.match(/\bmultipv (\d+)\b/);
  const pv = line.match(/\bpv ([a-h][1-8][a-h][1-8][qrbn]?)/);
  if (!mp || !pv) return null;
  return { multipv: Number(mp[1]), move: pv[1]! };
}

function parseScore(line: string): { cp: number | null; mate: number | null } {
  const mate = line.match(/\bscore mate (-?\d+)\b/);
  if (mate) return { cp: null, mate: Number(mate[1]) };
  const cp = line.match(/\bscore cp (-?\d+)\b/);
  if (cp) return { cp: Number(cp[1]), mate: null };
  return { cp: null, mate: null };
}

function mateToCp(mate: number): number {
  const sign = mate > 0 ? 1 : -1;
  return sign * (10000 - Math.abs(mate) * 10);
}

function finishPendingMoves() {
  if (!pending || pending.kind !== "moves") return;
  const { pvMap, bestmove, multiPv, resolve } = pending;
  const ordered: string[] = [];
  for (let i = 1; i <= multiPv; i++) {
    const m = pvMap.get(i);
    if (m) ordered.push(m);
  }
  if (bestmove && bestmove !== "(none)" && !ordered.includes(bestmove)) {
    ordered.unshift(bestmove);
  }
  const uniq = [...new Set(ordered)];
  pending = null;
  resolve(uniq);
}

function finishPendingEval() {
  if (!pending || pending.kind !== "eval") return;
  const { lastCp, lastMate, resolve } = pending;
  pending = null;
  if (lastMate !== null) {
    resolve(mateToCp(lastMate));
    return;
  }
  resolve(lastCp ?? 0);
}

function cancelPending(err: Error) {
  if (!pending) return;
  const op = pending;
  pending = null;
  op.reject(err);
}

function onWorkerMessage(raw: string) {
  const line = raw.trim();
  if (!line) return;

  if (line === "uciok") {
    ready = true;
    return;
  }

  if (!pending) return;

  if (pending.kind === "moves") {
    if (line.startsWith("info ")) {
      const parsed = parsePvMove(line);
      if (parsed) pending.pvMap.set(parsed.multipv, parsed.move);
      return;
    }
    if (line.startsWith("bestmove ")) {
      const parts = line.split(/\s+/);
      pending.bestmove = parts[1] ?? null;
      finishPendingMoves();
    }
    return;
  }

  if (line.startsWith("info ")) {
    const { cp, mate } = parseScore(line);
    if (mate !== null) pending.lastMate = mate;
    else if (cp !== null) pending.lastCp = cp;
    return;
  }

  if (line.startsWith("bestmove ")) {
    finishPendingEval();
  }
}

async function ensureEngine(): Promise<void> {
  if (ready && worker) return;
  if (initPromise) return initPromise;

  initPromise = new Promise<void>((resolve, reject) => {
    try {
      worker = new Worker(ENGINE_URL);
      worker.onmessage = (e: MessageEvent<string>) => onWorkerMessage(e.data);
      worker.onerror = (e) => reject(new Error(e.message || "Stockfish worker error"));

      const hashMb = Math.min(
        256,
        Math.max(64, Math.floor((navigator.deviceMemory ?? 4) * 32)),
      );

      post("uci");
      post("setoption name Skill Level value 20");
      post(`setoption name Hash value ${hashMb}`);
      post("isready");

      const waitReady = setInterval(() => {
        if (ready) {
          clearInterval(waitReady);
          resolve();
        }
      }, 10);
      setTimeout(() => {
        clearInterval(waitReady);
        if (!ready) reject(new Error("Stockfish init timeout"));
      }, 15000);
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });

  return initPromise;
}

function stopInFlight() {
  if (!pending) return;
  post("stop");
  cancelPending(new Error("Search superseded"));
}

export async function getRankedMoves(
  fen: string,
  opts: RankedSearchOptions = {},
): Promise<string[]> {
  await ensureEngine();
  if (!worker) return [];

  const multiPv = opts.multiPv ?? 20;
  const depth = opts.depth ?? 24;
  const movetimeMs = opts.movetimeMs ?? 4000;

  stopInFlight();

  return new Promise<string[]>((resolve, reject) => {
    pending = {
      kind: "moves",
      resolve,
      reject,
      pvMap: new Map(),
      bestmove: null,
      multiPv,
    };

    post(`setoption name MultiPV value ${multiPv}`);
    post(`position fen ${fen}`);
    post(`go depth ${depth} movetime ${movetimeMs}`);

    setTimeout(() => {
      if (!pending || pending.kind !== "moves") return;
      post("stop");
      finishPendingMoves();
    }, movetimeMs + 500);
  });
}

/** Centipawns from side-to-move perspective in FEN. */
export async function getEval(
  fen: string,
  opts: EvalSearchOptions = {},
): Promise<number> {
  await ensureEngine();
  if (!worker) return 0;

  const depth = opts.depth ?? SPELL_EVAL_DEPTH;
  const movetimeMs = opts.movetimeMs ?? SPELL_EVAL_MOVETIME_MS;

  stopInFlight();

  return new Promise<number>((resolve, reject) => {
    pending = {
      kind: "eval",
      resolve,
      reject,
      lastCp: null,
      lastMate: null,
    };

    post("setoption name MultiPV value 1");
    post(`position fen ${fen}`);
    post(`go depth ${depth} movetime ${movetimeMs}`);

    setTimeout(() => {
      if (!pending || pending.kind !== "eval") return;
      post("stop");
      finishPendingEval();
    }, movetimeMs + 500);
  });
}

export function terminateStockfish() {
  cancelPending(new Error("Engine terminated"));
  worker?.terminate();
  worker = null;
  ready = false;
  initPromise = null;
}
