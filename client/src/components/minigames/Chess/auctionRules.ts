import type { AuctionPieceType } from "./augments";
import {
  getBoardCols,
  getBoardRows,
  getDerivedBoard,
  type ChessState,
} from "./engine";
import type { AuctionState } from "./ui/AuctionPanel";

export const AUCTION_DURATION_MS = 20_000;
/** A fresh bid always leaves the rival at least this long to answer. */
export const AUCTION_ANTI_SNIPE_MS = 8_000;

type Square = [number, number];
export type AuctionSide = "white" | "black";

function isPermaFrost(game: ChessState, r: number, c: number): boolean {
  return game.permaFrozenSquares?.some((s) => s.row === r && s.col === c) ?? false;
}

function pawnRankSquares(game: ChessState, color: AuctionSide): Square[] {
  const rows = getBoardRows(game);
  const cols = getBoardCols(game);
  const off = (rows - 8) / 2;
  const row = color === "white" ? 6 + off : 1 + off;
  // 2v2 boards are wider than tall; every file there belongs to a pawn rank.
  const [c0, c1] = rows === cols ? [off, off + 8] : [0, cols];
  const out: Square[] = [];
  for (let c = c0; c < c1; c++) out.push([row, c]);
  return out;
}

/**
 * Squares the auction winner may drop their piece on. Pawns prefer their
 * original rank; if that is full they may land anywhere on their own half
 * short of either back rank so the won pawn is never stranded.
 */
export function listAuctionPlacements(
  game: ChessState,
  pieceType: AuctionPieceType,
  color: AuctionSide,
  isBlocked: (r: number, c: number) => boolean = () => false,
): Square[] {
  const rows = getBoardRows(game);
  const cols = getBoardCols(game);
  const board = getDerivedBoard(game);
  const free = (r: number, c: number) =>
    !board[r]?.[c] && !isPermaFrost(game, r, c) && !isBlocked(r, c);

  if (pieceType !== "P") {
    const out: Square[] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) if (free(r, c)) out.push([r, c]);
    return out;
  }

  const home = pawnRankSquares(game, color).filter(([r, c]) => free(r, c));
  if (home.length > 0) return home;

  const half = Math.floor(rows / 2);
  const [r0, r1] = color === "white" ? [half, rows - 1] : [1, rows - half];
  const out: Square[] = [];
  for (let r = r0; r < r1; r++)
    for (let c = 0; c < cols; c++) if (free(r, c)) out.push([r, c]);
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
