/**
 * Plays the bot's decision pipeline against real Stockfish (Node child
 * process) on scripted variant positions and checks both the choice and the
 * time it took. Run: npx tsx scripts/chess-bot-bench.mts
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import {
  createInitialState,
  getDerivedBoard,
  syncStateFromBoard,
  type Board,
  type ChessState,
  type PieceType,
} from "../client/src/components/minigames/Chess/engine";
import { AUGMENT_POOL, type Augment } from "../client/src/components/minigames/Chess/augments";
import {
  setEngineTransportFactory,
  terminateStockfish,
  warmupStockfish,
  newEngineGame,
} from "../client/src/components/minigames/Chess/chessBot/stockfishEngine";
import {
  decideBotAction,
  getLastBotTrace,
  resetBotMemory,
} from "../client/src/components/minigames/Chess/chessBot/decideBotAction";
import { buildBotMoveContext } from "../client/src/components/minigames/Chess/chessBot/legalMoves";
import { cancelBotSearches, probe } from "../client/src/components/minigames/Chess/chessBot/probe";
import { applyMove, EMPTY_RULES } from "../client/src/components/minigames/Chess/chessBot/botRules";
import { pickShopBuy } from "../client/src/components/minigames/Chess/chessBot/pickShopBuy";
import { computeAuctionBid } from "../client/src/components/minigames/Chess/chessBot/auctionBot";
import { moveToUci } from "../client/src/components/minigames/Chess/chessBot/uciParse";
import type { BotAction, BotMove, BotSpellContext } from "../client/src/components/minigames/Chess/chessBot/types";

setEngineTransportFactory(() => {
  const child = spawn(process.execPath, ["node_modules/stockfish/src/stockfish-18-lite-single.js"], {
    stdio: ["pipe", "pipe", "ignore"],
  });
  const rl = createInterface({ input: child.stdout! });
  return {
    post: (line) => child.stdin!.write(`${line}\n`),
    onLine: (cb) => rl.on("line", cb),
    onError: (cb) => child.on("error", cb),
    terminate: () => child.kill(),
  };
});

const aug = (id: string): Augment => {
  const a = AUGMENT_POOL.find((x) => x.id === id);
  assert.ok(a, `missing augment ${id}`);
  return a;
};

function fromFen(fen: string, extra: Partial<ChessState> = {}): ChessState {
  const [placement, stm] = fen.split(" ");
  const board: Board = [];
  const counts: Record<string, number> = {};
  for (const rank of placement!.split("/")) {
    const row: Board[number] = [];
    for (const ch of rank) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < Number(ch); i++) row.push(null);
        continue;
      }
      const color = ch === ch.toUpperCase() ? "white" : "black";
      const type = ch.toUpperCase() as PieceType;
      const key = `${color[0]}${type}`;
      counts[key] = (counts[key] ?? 0) + 1;
      row.push({ type, color, id: `${key}${counts[key]}` });
    }
    board.push(row);
  }
  const base = createInitialState();
  return syncStateFromBoard(
    {
      ...base,
      turn: stm === "w" ? "white" : "black",
      castlingRights: { white: { kingside: false, queenside: false }, black: { kingside: false, queenside: false } },
      fullMoveNumber: 20,
      ...extra,
    },
    board,
  );
}

function ctxWith(o: Partial<BotSpellContext> = {}): BotSpellContext {
  return {
    ...buildBotMoveContext({
      wallSquares: [],
      blessedSquares: [],
      coldWindsSquares: [],
      coldWindsMovesLeft: 0,
      frozenSquare: null,
      activePuppetSquare: null,
      activePuppetColor: null,
      blackAugments: [],
      blackAugmentLevels: {},
    }),
    blackFreezeCharges: 0,
    blackBlessedWaterCharges: 0,
    augmentSpellBlockedFor: null,
    monolithPlaceAvailable: false,
    contractAvailable: false,
    blackContractPieceId: null,
    puppetAvailable: false,
    deathNoteAvailable: false,
    ...o,
  };
}

function describe(a: BotAction | null): string {
  if (!a) return "none";
  if (a.type === "move") return moveToUci(a.move);
  if (a.type === "castSpell") return `${a.spellId}@${a.target.join(",")}`;
  if (a.type === "castSpellThenMove") return `${a.spellId}@${a.target.join(",")}+${moveToUci(a.move)}`;
  return a.type;
}

type Scenario = {
  name: string;
  game: ChessState;
  ctx: BotSpellContext;
  expect?: (a: BotAction | null) => boolean;
  maxMs?: number;
};

const sq = (alg: string): [number, number] => [8 - Number(alg[1]), alg.charCodeAt(0) - 97];

const scenarios: Scenario[] = [
  {
    name: "opening reply (plain)",
    game: fromFen("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b", { fullMoveNumber: 1 }),
    ctx: ctxWith(),
    maxMs: 900,
  },
  {
    name: "win the hanging queen",
    game: fromFen("r1b1kbnr/pppp1ppp/2n5/4p3/4P2q/5Q2/PPPP1PPP/RNB1KBNR b"),
    ctx: ctxWith(),
    expect: (a) => a?.type === "move",
    maxMs: 1500,
  },
  {
    name: "free capture after freezing the lone recapturer",
    // Black rook takes the d4 knight; only the c3 pawn can recapture.
    game: fromFen("3rk3/8/8/8/3N4/2P5/8/4K3 b"),
    ctx: ctxWith({ blackFreezeCharges: 1, blackAugments: [aug("frost")] }),
    expect: (a) => a?.type === "castSpell" && a.spellId === "frost" && a.target.join() === sq("c3").join(),
  },
  {
    name: "bless one forked piece, save the other",
    // Ne6 forks Qc7 and Rg7: bless g7, then move the queen.
    game: fromFen("7k/2q3r1/4N3/3P4/8/8/5PPP/3QR1K1 b"),
    ctx: ctxWith({ blackBlessedWaterCharges: 1, blackAugments: [aug("blessed-water-spell")] }),
    expect: (a) => a?.type === "castSpell" && a.spellId === "blessed-water-spell",
  },
  {
    name: "Little Big Man pawn snipes the queen",
    game: fromFen("4k3/2p5/8/8/8/8/7Q/K7 b"),
    ctx: ctxWith({ blackLittleBigManCharges: 1, blackAugments: [aug("little-big-man")] }),
    expect: (a) => a?.type === "castSpell" && a.spellId === "little-big-man" && a.target.join() === sq("c7").join(),
  },
  {
    name: "avoid checking into Internal Combustion",
    game: fromFen("4k3/8/8/3q4/8/8/8/R3K3 b"),
    ctx: ctxWith({ whiteIcAvailable: true }),
    expect: (a) => a?.type === "move" && !["d5e5", "d5d1", "d5e4", "d5e6", "d5b3", "d5a5", "d5h1", "d5g1", "d5d2"].includes(moveToUci(a.move)),
  },
  {
    name: "respect White frost on our recapturer",
    game: fromFen("r3k3/1b6/8/3n4/8/8/3R4/3QK3 b"),
    ctx: ctxWith({ whiteFreezeCharges: 2, whiteAugments: [aug("frost")] }),
  },
  {
    name: "puppet forces the defender away",
    game: fromFen("4k3/8/8/8/8/1q6/1N6/K7 b"),
    ctx: ctxWith({ puppetAvailable: true, blackAugments: [aug("puppet")] }),
  },
  {
    name: "Bloodbending+ flips a rook",
    game: fromFen("4k3/pppp4/8/8/8/8/PPPP2K1/R6R b"),
    ctx: ctxWith({ blackBloodbendingPlusCharges: 1, blackAugments: [aug("bloodbending-plus")] }),
    expect: (a) => a?.type === "castSpell" && a.spellId === "bloodbending-plus",
  },
  {
    name: "revive the queen with Necromancer++",
    game: fromFen("rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b"),
    ctx: ctxWith({ blackNecroPPCharges: 1, blackAugments: [aug("necromancer-plus-plus")] }),
    expect: (a) => a?.type === "castSpell" && a.spellId === "necromancer-plus-plus",
  },
  {
    name: "many spells at once stays inside the budget",
    game: fromFen("r1bqk2r/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R b"),
    ctx: ctxWith({
      blackFreezeCharges: 2,
      blackBlessedWaterCharges: 2,
      puppetAvailable: true,
      blackLittleBigManCharges: 1,
      blackAugments: [aug("frost"), aug("blessed-water-spell"), aug("puppet"), aug("little-big-man")],
      whiteFreezeCharges: 1,
      whiteBlessedWaterCharges: 1,
      whitePuppetAvailable: true,
      whiteLittleBigManCharges: 1,
      whiteIcAvailable: true,
    }),
  },
];

async function main() {
  warmupStockfish();
  let failures = 0;
  let worst = 0;
  for (const s of scenarios) {
    newEngineGame();
    resetBotMemory();
    const t0 = Date.now();
    const action = await decideBotAction(s.game, s.ctx);
    const ms = Date.now() - t0;
    worst = Math.max(worst, ms);
    const trace = getLastBotTrace();
    const ok = s.expect ? s.expect(action) : action !== null;
    const slow = ms > (s.maxMs ?? 2900);
    if (!ok || slow) failures++;
    console.log(
      `${ok && !slow ? "ok  " : "FAIL"} ${String(ms).padStart(5)}ms  ${s.name}: ${describe(action)}` +
        `  [${trace?.source} d${trace?.depth}; cands ${trace?.candidates
          .map((c) => `${c.uci}=${c.score}${c.risk ? `(${c.risk})` : ""}`)
          .join(" ")}; plans ${trace?.plans.map((p) => `${p.spellId}@${p.target.join(",")}=${p.net}`).join(" ")}]`,
    );
  }

  // Free spell → the follow-up move must come back instantly.
  {
    newEngineGame();
    resetBotMemory();
    const game = fromFen("3rk3/8/8/8/3N4/2P5/8/4K3 b");
    const ctx = ctxWith({ blackFreezeCharges: 1, blackAugments: [aug("frost")] });
    const first = await decideBotAction(game, ctx);
    assert.ok(first?.type === "castSpell");
    const t0 = Date.now();
    const second = await decideBotAction(game, {
      ...ctx,
      blackFreezeCharges: 0,
      frozenSquare: first.target,
      frozenTurnsLeft: 2,
    });
    const ms = Date.now() - t0;
    const ok = second?.type === "move" && moveToUci(second.move) === "d8d4" && ms < 50;
    if (!ok) failures++;
    console.log(`${ok ? "ok  " : "FAIL"} ${String(ms).padStart(5)}ms  follow-up after frost: ${describe(second)}`);
  }

  // A cancelled turn returns promptly instead of running every probe.
  {
    newEngineGame();
    resetBotMemory();
    const t0 = Date.now();
    const pending = decideBotAction(
      fromFen("r1bqk2r/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R b"),
      ctxWith({ blackFreezeCharges: 1, whiteFreezeCharges: 1, puppetAvailable: true }),
    );
    setTimeout(() => cancelBotSearches(), 150);
    await pending;
    const ms = Date.now() - t0;
    const ok = ms < 600;
    if (!ok) failures++;
    console.log(`${ok ? "ok  " : "FAIL"} ${String(ms).padStart(5)}ms  cancellation`);
  }

  {
    const position = { materialCp: 0, evalCp: 0, scoreCp: 0, isAttacking: true, isAdvantaged: false, isDisadvantaged: false };
    const tiers = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
    const early = pickShopBuy({
      goldBlack: 40,
      blackTierBought: tiers,
      blackAugments: [],
      blackAugmentLevels: {},
      position,
      context: { game: fromFen("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b", { fullMoveNumber: 2 }) },
    });
    console.log(`info shop @40g move 2: ${early ? (early.kind === "buy" ? early.aug.id : `improve ${early.augId}`) : "save"}`);
    const queenBid = computeAuctionBid({
      auction: { pieceType: "Q", minBid: 70, highBid: 80, highBidder: "white", timerEndsAt: 0, status: "active" },
      goldBlack: 120,
      position,
    });
    const pawnBid = computeAuctionBid({
      auction: { pieceType: "P", minBid: 5, highBid: 14, highBidder: "white", timerEndsAt: 0, status: "active" },
      goldBlack: 120,
      position,
    });
    const ok = queenBid === 81 && pawnBid === null;
    if (!ok) failures++;
    console.log(`${ok ? "ok  " : "FAIL"} auction: queen@80 → ${queenBid}, pawn@14 → ${pawnBid}`);
  }

  // 10×10 boards can't use Stockfish: the JS fallback must still answer fast.
  {
    const base = createInitialState();
    const small = getDerivedBoard(base);
    const wide: Board = Array.from({ length: 10 }, (_, r) =>
      Array.from({ length: 10 }, (_, c) =>
        r >= 1 && r <= 8 && c >= 1 && c <= 8 ? small[r - 1]![c - 1]! : null,
      ),
    );
    const big = syncStateFromBoard(base, wide);
    const t0 = Date.now();
    const a = await decideBotAction({ ...big, turn: "black" }, ctxWith());
    const ms = Date.now() - t0;
    const ok = a?.type === "move" && ms < 2900;
    if (!ok) failures++;
    console.log(`${ok ? "ok  " : "FAIL"} ${String(ms).padStart(5)}ms  10x10 fallback: ${describe(a)}`);
  }

  // Difficulty tiers: Stockfish Skill Level 7 / 12 depth caps and weakened picks.
  {
    const positions = [
      "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b",
      "r2q1rk1/ppp2ppp/2np1n2/2b1p1B1/2B1P1b1/2NP1N2/PPP2PPP/R2Q1RK1 b",
      "r1bq1rk1/pp2bppp/2n1pn2/3p4/2PP4/2N1PN2/PP3PPP/R2QKB1R b",
      "2rq1rk1/pp1bppbp/3p1np1/8/3NP3/1BN1BP2/PPPQ2PP/R3K2R b",
      "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 b",
      "rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP2BPPP/R1BQK2R b",
    ];
    const tiers = ["hard", "medium", "easy"] as const;
    // Full-strength verdict on the position after Black's chosen move.
    const judged = new Map<string, number>();
    const judge = async (fen: string, move: BotMove) => {
      const key = `${fen}|${moveToUci(move)}`;
      const hit = judged.get(key);
      if (hit !== undefined) return hit;
      const after = applyMove(fromFen(fen), move, null)!.state;
      const res = await probe(after, "white", EMPTY_RULES, { movetimeMs: 300 });
      judged.set(key, res.cp);
      return res.cp;
    };
    const hardCp: number[] = [];
    const acpl: Record<string, number> = {};
    for (const tier of tiers) {
      let maxMs = 0;
      let maxDepth = 0;
      let loss = 0;
      let n = 0;
      for (const [pi, fen] of positions.entries()) {
        newEngineGame();
        for (let i = 0; i < (tier === "hard" ? 1 : 6); i++) {
          resetBotMemory();
          const t0 = Date.now();
          const a = await decideBotAction(fromFen(fen), ctxWith({ difficulty: tier }));
          maxMs = Math.max(maxMs, Date.now() - t0);
          maxDepth = Math.max(maxDepth, getLastBotTrace()?.depth ?? 0);
          assert.ok(a?.type === "move");
          const cp = await judge(fen, a.move);
          if (tier === "hard") hardCp[pi] = cp;
          loss += Math.max(0, hardCp[pi]! - cp);
          n++;
        }
      }
      acpl[tier] = Math.round(loss / n);
      const level = tier === "easy" ? 7 : tier === "medium" ? 12 : 20;
      const depthOk = tier === "hard" || maxDepth <= level + 1;
      const timeOk = maxMs < (tier === "hard" ? 1300 : 900);
      if (!depthOk || !timeOk) failures++;
      console.log(
        `${depthOk && timeOk ? "ok  " : "FAIL"} ${String(maxMs).padStart(5)}ms  ${tier} (skill ${level}): max depth ${maxDepth}, avg loss vs hard ${acpl[tier]}cp`,
      );
    }
    const orderOk = acpl.easy! > acpl.medium! && acpl.medium! > 0;
    if (!orderOk) failures++;
    console.log(`${orderOk ? "ok  " : "FAIL"} strength order hard > medium > easy`);

    newEngineGame();
    let took = 0;
    for (let i = 0; i < 12; i++) {
      resetBotMemory();
      const a = await decideBotAction(
        fromFen("rnbqkbnr/pppp1ppp/8/4p3/3Q4/8/PPP1PPPP/RNB1KBNR b", { fullMoveNumber: 3 }),
        ctxWith({ difficulty: "easy" }),
      );
      if (describe(a) === "e5d4") took++;
    }
    const queenOk = took === 12;
    if (!queenOk) failures++;
    console.log(`${queenOk ? "ok  " : "FAIL"} easy never ignores a hanging queen: ${took}/12`);

    newEngineGame();
    resetBotMemory();
    const frostGame = fromFen("3rk3/8/8/8/3N4/2P5/8/4K3 b");
    const frost = await decideBotAction(
      frostGame,
      ctxWith({ blackFreezeCharges: 1, blackAugments: [aug("frost")], difficulty: "easy" }),
    );
    const spellOk = frost?.type === "castSpell" && frost.spellId === "frost";
    if (!spellOk) failures++;
    console.log(`${spellOk ? "ok  " : "FAIL"} easy still plans spells: ${describe(frost)}`);
  }

  terminateStockfish();
  console.log(`worst decision ${worst}ms`);
  if (failures > 0) {
    console.error(`${failures} scenario(s) failed`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  terminateStockfish();
  process.exit(1);
});
