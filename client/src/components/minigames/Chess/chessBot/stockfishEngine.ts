import type { RankedSearchOptions } from "./types";

const ENGINE_URL = "/stockfish/stockfish-18-lite-single.js";

type PendingSearch = {
  resolve: (moves: string[]) => void;
  reject: (err: Error) => void;
  pvMap: Map<number, string>;
  bestmove: string | null;
  multiPv: number;
};

let worker: Worker | null = null;
let ready = false;
let initPromise: Promise<void> | null = null;
let pending: PendingSearch | null = null;

function post(line: string) {
  worker?.postMessage(line);
}

function parsePvMove(line: string): { multipv: number; move: string } | null {
  const mp = line.match(/\bmultipv (\d+)\b/);
  const pv = line.match(/\bpv ([a-h][1-8][a-h][1-8][qrbn]?)/);
  if (!mp || !pv) return null;
  return { multipv: Number(mp[1]), move: pv[1]! };
}

function finishPending() {
  if (!pending) return;
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

function onWorkerMessage(raw: string) {
  const line = raw.trim();
  if (!line) return;

  if (line === "uciok") {
    ready = true;
    return;
  }

  if (!pending) return;

  if (line.startsWith("info ")) {
    const parsed = parsePvMove(line);
    if (parsed) pending.pvMap.set(parsed.multipv, parsed.move);
    return;
  }

  if (line.startsWith("bestmove ")) {
    const parts = line.split(/\s+/);
    pending.bestmove = parts[1] ?? null;
    finishPending();
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

export async function getRankedMoves(
  fen: string,
  opts: RankedSearchOptions = {},
): Promise<string[]> {
  await ensureEngine();
  if (!worker) return [];

  const multiPv = opts.multiPv ?? 20;
  const depth = opts.depth ?? 24;
  const movetimeMs = opts.movetimeMs ?? 4000;

  if (pending) {
    post("stop");
    pending.reject(new Error("Search superseded"));
    pending = null;
  }

  return new Promise<string[]>((resolve, reject) => {
    pending = {
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
      if (!pending) return;
      post("stop");
      finishPending();
    }, movetimeMs + 500);
  });
}

export function terminateStockfish() {
  pending?.reject(new Error("Engine terminated"));
  pending = null;
  worker?.terminate();
  worker = null;
  ready = false;
  initPromise = null;
}
