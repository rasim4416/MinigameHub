import type { AuctionPieceType } from "./augments";
import {
  getBoardCols,
  getBoardRows,
  getDerivedBoard,
  is2v2Mode,
  type ChessState,
  type PieceType,
} from "./engine";
import type { AuctionState } from "./ui/AuctionPanel";

export const AUCTION_DURATION_MS = 20_000;
/** A fresh bid always leaves the rival at least this long to answer. */
export const AUCTION_ANTI_SNIPE_MS = 8_000;

type Square = [number, number];
export type AuctionSide = "white" | "black";

/** Starting back-rank layout (files a–h). Kings are never auctioned. */
const BACK_RANK: PieceType[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];

function isPermaFrost(game: ChessState, r: number, c: number): boolean {
  return game.permaFrozenSquares?.some((s) => s.row === r && s.col === c) ?? false;
}

/**
 * Column starts of each 8-file army for this board.
 * 1v1: one centered block. 2v2 / wide boards: both team halves.
 */
function armyFileStarts(game: ChessState): number[] {
  const rows = getBoardRows(game);
  const cols = getBoardCols(game);
  if (is2v2Mode(game) || cols >= 16) {
    const pad = Math.max(0, Math.floor((cols - 16) / 2));
    return [pad, pad + 8];
  }
  return [(Math.min(rows, cols) - 8) / 2];
}

/**
 * Original starting squares for an auctioned piece type — pawn rank for pawns,
 * back-rank home squares for N/B/R/Q. No fallback: if every home square is
 * taken the piece is held for later placement from the spell bar.
 */
export function listAuctionPlacements(
  game: ChessState,
  pieceType: AuctionPieceType,
  color: AuctionSide,
  isBlocked: (r: number, c: number) => boolean = () => false,
): Square[] {
  const rows = getBoardRows(game);
  const board = getDerivedBoard(game);
  const free = (r: number, c: number) =>
    !board[r]?.[c] && !isPermaFrost(game, r, c) && !isBlocked(r, c);

  const rowOff = (rows - 8) / 2;
  const out: Square[] = [];

  if (pieceType === "P") {
    const pawnRow = color === "white" ? 6 + rowOff : 1 + rowOff;
    for (const start of armyFileStarts(game)) {
      for (let i = 0; i < 8; i++) {
        const c = start + i;
        if (free(pawnRow, c)) out.push([pawnRow, c]);
      }
    }
    return out;
  }

  const backRow = color === "white" ? 7 + rowOff : rowOff;
  for (const start of armyFileStarts(game)) {
    for (let i = 0; i < 8; i++) {
      if (BACK_RANK[i] !== pieceType) continue;
      const c = start + i;
      if (free(backRow, c)) out.push([backRow, c]);
    }
  }
  return out;
}

export function minNextBid(auction: AuctionState): number {
  return Math.max(
    auction.minBid,
    auction.highBid > 0 ? auction.highBid + 1 : auction.minBid,
  );
}

/** A side is out once it passed or cannot cover the next legal bid. */
export function isOutOfAuction(
  auction: AuctionState,
  color: AuctionSide,
  gold: number,
): boolean {
  if (auction.highBidder === color) return false;
  return (auction.passed ?? []).includes(color) || gold < minNextBid(auction);
}

/** True when nobody left in the auction can still change the result. */
export function auctionIsSettled(
  auction: AuctionState,
  goldWhite: number,
  goldBlack: number,
): boolean {
  const contenders = (["white", "black"] as const).filter(
    (c) => c !== auction.highBidder,
  );
  return contenders.every((c) =>
    isOutOfAuction(auction, c, c === "white" ? goldWhite : goldBlack),
  );
}
