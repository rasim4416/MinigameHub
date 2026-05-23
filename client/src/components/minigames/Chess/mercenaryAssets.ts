// Mercenary piece images — served from client/public (PNG preferred, SVG fallback).
import type { Piece, PieceType } from "./engine";
import { isMercenaryPiece, MERCENARY_ID_MARKER } from "./mercenaryMoves";

const PIECE_STEM: Partial<Record<PieceType, string>> = {
  P: "pawn",
  N: "knight",
  R: "rook",
  B: "bishop",
  Q: "queen",
};

/** Root-relative public URL with Vite base path (subpath deploys). */
export function publicAssetUrl(filename: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}${filename.replace(/^\//, "")}`;
}

/** Candidate URLs for a mercenary piece type (PNG first, then SVG). */
export function mercenaryImageCandidates(type: PieceType): string[] {
  const stem = PIECE_STEM[type];
  if (!stem) return [];
  return [
    publicAssetUrl(`chess-orange-mercenary-${stem}.png`),
    publicAssetUrl(`chess-orange-mercenary-${stem}.svg`),
  ];
}

/** Orange board pieces that should use mercenary art (all orange pieces are mercenaries). */
export function shouldRenderMercenaryImage(piece: Piece | null): boolean {
  if (!piece || piece.color !== "orange") return false;
  return piece.type in PIECE_STEM;
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
