import { PIECE_VALUE, getDerivedBoard, isInCheck, type ChessState } from "../engine";
import { isStockfishEligible, toStockfishFen } from "./fen";
import { enumerateLegalMoves, type BotMoveContext } from "./legalMoves";
import { getRankedMoves } from "./stockfishEngine";
import type { BotMove } from "./types";
import { sameMove, uciToBotMove } from "./uciParse";

function fallbackPick(legal: BotMove[], game: ChessState): BotMove {
  const board = getDerivedBoard(game);
  let best = legal[0]!;
  let bestScore = -Infinity;

  for (const m of legal) {
    let score = 0;
    const cap = board[m.to[0]]?.[m.to[1]];
    if (cap && cap.color !== "black" && cap.type !== "M") {
      score += (PIECE_VALUE[cap.type] ?? 0) * 10;
    }
    const clone = { ...game, turn: "black" as const };
    if (isInCheck(clone, "white")) score += 3;
    score += Math.random() * 0.01;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

export async function pickBotMove(
  game: ChessState,
  ctx: BotMoveContext,
): Promise<BotMove | null> {
  const legal = enumerateLegalMoves(game, ctx);
  if (legal.length === 0) return null;

  if (isStockfishEligible(game)) {
    try {
      const fen = toStockfishFen(game, "black");
      const candidates = await getRankedMoves(fen, {
        multiPv: 20,
        depth: 24,
        movetimeMs: 4000,
      });
      for (const uci of candidates) {
        const parsed = uciToBotMove(uci);
        if (!parsed) continue;
        const match = legal.find((m) => sameMove(m, parsed));
        if (match) return match;
        const promoMatch = legal.find(
          (m) =>
            m.from[0] === parsed.from[0] &&
            m.from[1] === parsed.from[1] &&
            m.to[0] === parsed.to[0] &&
            m.to[1] === parsed.to[1],
        );
        if (promoMatch) return promoMatch;
      }
    } catch {
      /* fall through to greedy fallback */
    }
  }

  return fallbackPick(legal, game);
}
