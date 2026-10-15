import {
  AUCTION_MIN_BID,
  type AuctionPieceType,
} from "../augments";
import type { AuctionState } from "../ui/AuctionPanel";
import {
  auctionAggression,
  reserveFraction,
} from "./constants";
import type { PositionAssessment } from "./assessPosition";
import { getBoardRows, type ChessState } from "../engine";
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
  const reserve = Math.floor(goldBlack * reserveFraction(position.scoreCp));
  const budget = goldBlack - reserve;
  if (minNext > budget) return null;

  const aggression = auctionAggression(position.scoreCp);
  const pieceType = auction.pieceType as AuctionPieceType;
  const pieceFloor = AUCTION_MIN_BID[pieceType];
  const maxWilling =
    pieceFloor * (1 + aggression * 2) + Math.floor(goldBlack * 0.12 * aggression);

  if (aggression < 0.25) {
    if (pieceType !== "Q" && pieceType !== "R") return null;
    if (minNext > budget || minNext > maxWilling) return null;
    if (minNext > pieceFloor * 1.1) return null;
    return minNext;
  }

  if (minNext > budget || minNext > maxWilling) return null;
  const bid = Math.min(
    minNext + Math.floor(aggression * 6),
    budget,
    Math.floor(maxWilling),
  );
  return bid >= minNext ? bid : null;
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
