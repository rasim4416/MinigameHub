import {
  AUCTION_MIN_BID,
  type AuctionPieceType,
} from "../augments";
import type { AuctionState } from "../ui/AuctionPanel";
import { auctionAggression } from "./constants";
import type { PositionAssessment } from "./assessPosition";
import { getBoardRows, PIECE_VALUE, type ChessState } from "../engine";
import { listAuctionPlacements, minNextBid } from "../auctionRules";

export function computeAuctionBid(input: {
  auction: AuctionState;
  goldBlack: number;
  position: PositionAssessment;
}): number | null {
  const { auction, goldBlack, position } = input;
  if (auction.status !== "active") return null;
  // Already leading — wait until white outbids before raising again.
  if (auction.highBidder === "black") return null;

  if (auction.passed?.includes("black")) return null;
  const minNext = minNextBid(auction);
  const budget = goldBlack - Math.floor(goldBlack * AUCTION_RESERVE);
  const maxWilling = auctionMaxBid(auction.pieceType as AuctionPieceType, position.scoreCp);
  if (minNext > budget || minNext > maxWilling) return null;
  // Ascending auction: raising by the minimum always wins at the lowest price.
  return minNext;
}

/** Gold the bot keeps out of auctions (shop money, next auction). */
const AUCTION_RESERVE = 0.1;
/** Gold per pawn of material the bot will pay at an even score. */
const AUCTION_GOLD_PER_PAWN = 11;

/**
 * Highest price worth paying for a piece: its material in gold, more when
 * behind (material decides lost games), less when already winning.
 */
export function auctionMaxBid(pieceType: AuctionPieceType, scoreCp: number): number {
  const pawns = PIECE_VALUE[pieceType] ?? 1;
  const urgency = 1 + auctionAggression(scoreCp) * 0.5 - (scoreCp > 600 ? 0.3 : 0);
  const willing = Math.round(pawns * AUCTION_GOLD_PER_PAWN * urgency);
  return Math.max(AUCTION_MIN_BID[pieceType], willing);
}

export function pickAuctionPlacement(
  game: ChessState,
  pieceType: AuctionPieceType,
  color: "white" | "black" = "black",
  isBlocked?: (r: number, c: number) => boolean,
): [number, number] | null {
  const rows = getBoardRows(game);
  const candidates = listAuctionPlacements(game, pieceType, color, isBlocked);
  if (candidates.length === 0) return null;

  const off = (rows - 8) / 2;
  const center = off + 3.5;

  candidates.sort((a, b) => {
    const score = (sq: [number, number]) => {
      const [r, c] = sq;
      let s = -Math.abs(c - center);
      if (pieceType === "R" || pieceType === "Q") {
        const backRow = color === "white" ? rows - 1 - off : off;
        s += r === backRow ? 50 : 0;
      }
      if (pieceType === "N" || pieceType === "B") {
        s += r >= off + 2 && r <= off + 5 ? 20 : 0;
      }
      return s;
    };
    return score(b) - score(a);
  });

  return candidates[0] ?? null;
}
