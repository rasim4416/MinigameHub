// Mercenary piece images — bundled via Vite (PNG preferred, SVG fallback).
import type { Piece, PieceType } from "./engine";
import { isMercenaryPiece, MERCENARY_ID_MARKER } from "./mercenaryMoves";

import pawnPng from "../../../assets/mercenary/chess-orange-mercenary-pawn.png";
import knightPng from "../../../assets/mercenary/chess-orange-mercenary-knight.png";
import pawnSvg from "../../../assets/mercenary/chess-orange-mercenary-pawn.svg?url";
import knightSvg from "../../../assets/mercenary/chess-orange-mercenary-knight.svg?url";
import rookSvg from "../../../assets/mercenary/chess-orange-mercenary-rook.svg?url";
import bishopSvg from "../../../assets/mercenary/chess-orange-mercenary-bishop.svg?url";
import queenSvg from "../../../assets/mercenary/chess-orange-mercenary-queen.svg?url";

const MERCENARY_IMAGE_CANDIDATES: Partial<Record<PieceType, string[]>> = {
  P: [pawnPng, pawnSvg],
  N: [knightPng, knightSvg],
  R: [rookSvg],
  B: [bishopSvg],
  Q: [queenSvg],
};

/** Root-relative public URL with Vite base path (subpath deploys). */
export function publicAssetUrl(filename: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}${filename.replace(/^\//, "")}`;
}

/** Candidate URLs for a mercenary piece type (PNG first when bundled, then SVG). */
export function mercenaryImageCandidates(type: PieceType): string[] {
  return MERCENARY_IMAGE_CANDIDATES[type] ?? [];
}

/** Orange board pieces that should use mercenary art (all orange pieces are mercenaries). */
export function shouldRenderMercenaryImage(piece: Piece | null): boolean {
  if (!piece || piece.color !== "orange") return false;
  return piece.type in MERCENARY_IMAGE_CANDIDATES;
}

/**
 * Primary image URL for an orange mercenary, or null if not renderable.
 * Does not require id marker — spawned pieces still get ids via ensureMercenaryPieceId.
 */
export function getOrangeMercenaryPieceImage(piece: Piece | null): string | null {
  if (!shouldRenderMercenaryImage(piece)) return null;
  const candidates = mercenaryImageCandidates(piece!.type);
  return candidates[0] ?? null;
}

/** All candidate URLs for <img> fallback (PNG → SVG). */
export function getOrangeMercenaryPieceImageCandidates(
  piece: Piece | null,
): string[] {
  if (!shouldRenderMercenaryImage(piece)) return [];
  return mercenaryImageCandidates(piece!.type);
}

/** Ensure orange pieces keep a mercenary id for game logic (Death Note, captures, etc.). */
export function ensureMercenaryPieceId(piece: Piece): Piece {
  if (piece.color !== "orange") return piece;
  if (typeof piece.id === "string" && piece.id.includes(MERCENARY_ID_MARKER))
    return piece;
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    ...piece,
    id: `mercenary-auto-${suffix}`,
  };
}

export { isMercenaryPiece, MERCENARY_ID_MARKER };
