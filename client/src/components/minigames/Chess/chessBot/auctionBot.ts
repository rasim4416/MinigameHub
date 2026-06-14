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
import {
  getBoardCols,
  getBoardRows,
  getDerivedBoard,
  type ChessState,
} from "../engine";

function isPermaFrostSquare(state: ChessState, r: number, c: number): boolean {
  return (
    state.permaFrozenSquares?.some((s) => s.row === r && s.col === c) ?? false
  );
}

function isOriginalPawnSpawnSquare(
  r: number,
  c: number,
  color: "white" | "black",
  boardSize: number,
): boolean {
  const off = (boardSize - 8) / 2;
  const pawnRow = color === "white" ? 6 + off : 1 + off;
  if (r !== pawnRow) return false;
  return c >= off && c < off + 8;
}

export function computeAuctionBid(input: {
  auction: AuctionState;
  goldBlack: number;
  position: PositionAssessment;
}): number | null {
  const { auction, goldBlack, position } = input;
  if (auction.status !== "active") return null;

  const minNext = Math.max(
    auction.minBid,
    auction.highBid > 0 ? auction.highBid + 1 : auction.minBid,
  );
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
): [number, number] | null {
  const rows = getBoardRows(game);
  const cols = getBoardCols(game);
  const board = getDerivedBoard(game);
  const candidates: [number, number][] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c]) continue;
      if (isPermaFrostSquare(game, r, c)) continue;
      if (pieceType === "P") {
        if (isOriginalPawnSpawnSquare(r, c, color, rows)) {
          candidates.push([r, c]);
        }
      } else {
        candidates.push([r, c]);
      }
    }
  }
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
