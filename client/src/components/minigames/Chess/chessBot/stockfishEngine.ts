const ENGINE_URL = "/stockfish/stockfish-18-lite-single.js";

/** Minimal UCI pipe so the same engine driver runs in a Worker or in Node. */
export type EngineTransport = {
  post: (line: string) => void;
  onLine: (cb: (line: string) => void) => void;
  onError: (cb: (err: Error) => void) => void;
  terminate: () => void;
};

export type EngineLine = {
  multipv: number;
  uci: string;
  /** Side-to-move POV; mate scores are folded into ±(10000 − 10·plies). */
  cp: number;
  mate: number | null;
  depth: number;
  pv: string[];
};

export type AnalyseResult = {
  bestmove: string | null;
  lines: EngineLine[];
  depth: number;
  elapsedMs: number;
  cached: boolean;
};

export type AnalyseOptions = {
  movetimeMs: number;
  depth?: number;
  multiPv?: number;
  /** Restrict the root to these UCI moves (our augment-aware legal list). */
  searchmoves?: string[];
};

type Job = {
  key: string;
  fen: string;
  opts: AnalyseOptions;
  resolve: (r: AnalyseResult) => void;
  reject: (err: Error) => void;
  lines: Map<number, EngineLine>;
  maxDepth: number;
  startedAt: number;
  timers: ReturnType<typeof setTimeout>[];
};

function workerTransport(): EngineTransport {
  const worker = new Worker(ENGINE_URL);
  return {
    post: (line) => worker.postMessage(line),
    onLine: (cb) => {
      worker.onmessage = (e: MessageEvent<string>) => cb(String(e.data));
    },
    onError: (cb) => {
      worker.onerror = (e) => {
        // A failed WASM worker becomes a normal engine failure so callers can
        // fall back to the built-in search instead of leaking a page error.
        e.preventDefault();
        cb(new Error(e.message || "Stockfish worker error"));
      };
    },
    terminate: () => worker.terminate(),
  };
}

let transportFactory: () => EngineTransport = workerTransport;
let transport: EngineTransport | null = null;
let ready = false;
let initPromise: Promise<void> | null = null;
let current: Job | null = null;
const queue: Job[] = [];
/** bestmove lines still owed by searches we stopped; their output is ignored. */
let staleSearches = 0;
let currentMultiPv = 1;

const CACHE_LIMIT = 600;
const cache = new Map<string, { result: AnalyseResult; movetimeMs: number }>();

/** Tests (Node) swap the Worker for a child-process pipe. */
export function setEngineTransportFactory(factory: () => EngineTransport) {
  terminateStockfish();
  transportFactory = factory;
}

function mateToCp(mate: number): number {
  const sign = mate > 0 ? 1 : -1;
  return sign * (10000 - Math.abs(mate) * 10);
}

/** FEN without move clocks, so transpositions share cache entries. */
function fenKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

function jobKey(fen: string, opts: AnalyseOptions): string {
  const moves = opts.searchmoves ? [...opts.searchmoves].sort().join(",") : "*";
  return `${fenKey(fen)}|${opts.multiPv ?? 1}|${moves}`;
}

function parseInfo(line: string): EngineLine | null {
  if (!line.includes(" pv ") || line.includes("bound")) return null;
  const depth = Number(line.match(/\bdepth (\d+)/)?.[1] ?? 0);
  const multipv = Number(line.match(/\bmultipv (\d+)/)?.[1] ?? 1);
  const mateM = line.match(/\bscore mate (-?\d+)/);
  const cpM = line.match(/\bscore cp (-?\d+)/);
  if (!mateM && !cpM) return null;
  const mate = mateM ? Number(mateM[1]) : null;
  const cp = mate !== null ? mateToCp(mate === 0 ? -1 : mate) : Number(cpM![1]);
  const pv = line.slice(line.indexOf(" pv ") + 4).trim().split(/\s+/);
  if (!pv[0]) return null;
  return { multipv, uci: pv[0], cp, mate, depth, pv };
}

function finishJob(job: Job, bestmove: string | null) {
  job.timers.forEach(clearTimeout);
  const lines = [...job.lines.values()].sort((a, b) => a.multipv - b.multipv);
  const result: AnalyseResult = {
    bestmove: bestmove && bestmove !== "(none)" ? bestmove : lines[0]?.uci ?? null,
    lines,
    depth: job.maxDepth,
    elapsedMs: Date.now() - job.startedAt,
    cached: false,
  };
  if (lines.length > 0) {
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    cache.set(job.key, { result, movetimeMs: job.opts.movetimeMs });
  }
  job.resolve(result);
}

function onLine(raw: string) {
  const line = raw.trim();
  if (!line) return;
  if (line === "uciok" || line === "readyok") {
    ready = true;
    return;
  }
  if (staleSearches > 0) {
    if (line.startsWith("bestmove")) {
      staleSearches--;
      if (staleSearches === 0) pump();
    }
    return;
  }
  const job = current;
  if (!job) return;
  if (line.startsWith("info ")) {
    const parsed = parseInfo(line);
    if (!parsed) return;
    job.maxDepth = Math.max(job.maxDepth, parsed.depth);
    job.lines.set(parsed.multipv, parsed);
    return;
  }
  if (line.startsWith("bestmove")) {
    current = null;
    finishJob(job, line.split(/\s+/)[1] ?? null);
    pump();
  }
}

function startJob(job: Job) {
  current = job;
  job.startedAt = Date.now();
  const multiPv = job.opts.multiPv ?? 1;
  if (multiPv !== currentMultiPv) {
    transport!.post(`setoption name MultiPV value ${multiPv}`);
    currentMultiPv = multiPv;
  }
  transport!.post(`position fen ${job.fen}`);
  let go = `go movetime ${Math.max(10, Math.round(job.opts.movetimeMs))}`;
  if (job.opts.depth) go += ` depth ${job.opts.depth}`;
  if (job.opts.searchmoves?.length) go += ` searchmoves ${job.opts.searchmoves.join(" ")}`;
  transport!.post(go);
  // The engine always answers `go movetime`; these guards only cover a wedged
  // WASM instance so a bot turn can never hang forever.
  job.timers.push(
    setTimeout(() => {
      if (current === job) transport?.post("stop");
    }, job.opts.movetimeMs + 1200),
    setTimeout(() => {
      if (current !== job) return;
      current = null;
      staleSearches++;
      finishJob(job, null);
      pump();
    }, job.opts.movetimeMs + 3000),
  );
}

function pump() {
  if (current || staleSearches > 0 || !ready || !transport) return;
  const next = queue.shift();
  if (next) startJob(next);
}

async function ensureEngine(): Promise<void> {
  if (ready && transport) return;
  if (initPromise) return initPromise;

  initPromise = new Promise<void>((resolve, reject) => {
    try {
      transport = transportFactory();
      transport.onLine(onLine);
      transport.onError((err) => {
        failAll(err);
        reject(err);
      });

      const deviceMemory =
        typeof navigator === "undefined"
          ? undefined
          : (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
      // The lite WASM engine can trap while allocating a 256MB hash on
      // memory-constrained browsers; 32–128MB is plenty for short searches.
      const hashMb = Math.min(128, Math.max(32, Math.floor((deviceMemory ?? 4) * 16)));

      transport.post("uci");
      transport.post("setoption name Skill Level value 20");
      transport.post(`setoption name Hash value ${hashMb}`);
      transport.post("setoption name MultiPV value 1");
      currentMultiPv = 1;
      transport.post("isready");

      const waitReady = setInterval(() => {
        if (ready) {
          clearInterval(waitReady);
          resolve();
          pump();
        }
      }, 5);
      setTimeout(() => {
        clearInterval(waitReady);
        if (!ready) reject(new Error("Stockfish init timeout"));
      }, 15000);
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
  initPromise.catch(() => {
    initPromise = null;
  });
  return initPromise;
}

function failAll(err: Error) {
  const pending = [...queue];
  queue.length = 0;
  pending.forEach((j) => j.reject(err));
  if (current) {
    const job = current;
    current = null;
    job.timers.forEach(clearTimeout);
    job.reject(err);
  }
}

/** Start loading the WASM engine before the bot's first turn. */
export function warmupStockfish(): void {
  ensureEngine().catch(() => {});
}

/** Searches are queued (never superseded) so concurrent probes all resolve. */
export async function analyse(fen: string, opts: AnalyseOptions): Promise<AnalyseResult> {
  const key = jobKey(fen, opts);
  const hit = cache.get(key);
  if (hit && hit.movetimeMs >= opts.movetimeMs * 0.9) {
    return { ...hit.result, cached: true, elapsedMs: 0 };
  }
  await ensureEngine();
  if (!transport) throw new Error("Stockfish unavailable");
  return new Promise<AnalyseResult>((resolve, reject) => {
    queue.push({
      key,
      fen,
      opts,
      resolve,
      reject,
      lines: new Map(),
      maxDepth: 0,
      startedAt: 0,
      timers: [],
    });
    pump();
  });
}

/** Drop queued work and stop the running search (e.g. the bot turn was cancelled). */
export function abortSearches(): void {
  const pending = [...queue];
  queue.length = 0;
  pending.forEach((j) => j.reject(new Error("Search aborted")));
  if (current && transport) {
    const job = current;
    current = null;
    job.timers.forEach(clearTimeout);
    staleSearches++;
    transport.post("stop");
    job.reject(new Error("Search aborted"));
  }
}

export function newEngineGame(): void {
  cache.clear();
  abortSearches();
  if (transport && ready) transport.post("ucinewgame");
}

export function terminateStockfish() {
  failAll(new Error("Engine terminated"));
  transport?.terminate();
  transport = null;
  ready = false;
  initPromise = null;
  staleSearches = 0;
  cache.clear();
}
