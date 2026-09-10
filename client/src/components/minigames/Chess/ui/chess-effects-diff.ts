import type { Board, ChessState, Piece } from "../engine";

export type ChessBoardChangeKind = "revive" | "remove" | "convert" | "promote";

export interface ChessBoardChange {
  kind: ChessBoardChangeKind;
  square: [number, number];
  pieceId?: string;
}

interface LocatedPiece {
  piece: Piece;
  square: [number, number];
}

type PieceMap = Map<string, LocatedPiece>;

function pieceMap(board: Board): PieceMap {
  const result: PieceMap = new Map();
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < (board[row]?.length ?? 0); col += 1) {
      const piece = board[row]?.[col];
      if (piece?.id) result.set(piece.id, { piece, square: [row, col] });
    }
  }
  return result;
}

function sameSquare(a: [number, number] | undefined, b: [number, number] | undefined): boolean {
  return !!a && !!b && a[0] === b[0] && a[1] === b[1];
}

function boardShape(board: Board): [number, number] {
  return [board.length, board[0]?.length ?? 0];
}

function shapeChanged(before: Board, after: Board): boolean {
  const [beforeRows, beforeCols] = boardShape(before);
  const [afterRows, afterCols] = boardShape(after);
  return beforeRows !== afterRows || beforeCols !== afterCols;
}

function movedPieceId(lastMove: ChessState["lastMove"]): string | undefined {
  return lastMove?.pieceId ?? lastMove?.piece.id;
}

/**
 * Finds meaningful piece lifecycle changes between two rendered board snapshots.
 *
 * Coordinates alone cannot identify a move: a normal move makes one square empty
 * and another occupied, while a capture replaces the captured piece at the
 * destination. Stable piece ids let us follow the moving piece instead. The
 * move record supplies the remaining context for id-less legacy/synthetic moves.
 *
 * A board resize is deliberately treated as a layout operation. Domain Expansion
 * shifts every existing coordinate and adds edge pieces, so diffing its two grids
 * would otherwise produce a notice for every square.
 */
export function diffChessBoard(
  before: Board,
  after: Board,
  lastMove: ChessState["lastMove"],
): ChessBoardChange[] {
  if (shapeChanged(before, after)) return [];

  const beforePieces = pieceMap(before);
  const afterPieces = pieceMap(after);
  const moverId = movedPieceId(lastMove);
  const from = lastMove?.from;
  const to = lastMove?.to;
  const sourcePiece = from ? before[from[0]]?.[from[1]] : undefined;
  // Legacy records may omit pieceId even though the rendered board has one.
  const effectiveMoverId = moverId ?? sourcePiece?.id;
  const isNonStationaryMove = !!from && !!to && !sameSquare(from, to);
  const targetPiece = to ? after[to[0]]?.[to[1]] : undefined;
  const moverArrivedWithoutStableId =
    isNonStationaryMove &&
    !!targetPiece &&
    !!sourcePiece &&
    targetPiece.color === sourcePiece.color;
  const changes: ChessBoardChange[] = [];

  for (const [id, current] of afterPieces) {
    const previous = beforePieces.get(id);
    if (previous) {
      // A pawn changing type while retaining its identity is a real promotion.
      // Check it before color so a malformed record cannot call it a conversion.
      if (previous.piece.type === "P" && current.piece.type !== "P") {
        changes.push({ kind: "promote", square: current.square, pieceId: id });
      } else if (previous.piece.color !== current.piece.color) {
        changes.push({ kind: "convert", square: current.square, pieceId: id });
      }
      continue;
    }

    /*
     * A legacy board can acquire an id when it is synchronized after an
     * ordinary move. The moving piece is the one exception to "new id means
     * revival"; use the move record and the old source square to recognize it.
     * Same-square synthetic moves are spell summons/revivals, not ordinary moves.
     */
    const isMoverArrival =
      isNonStationaryMove &&
      sameSquare(current.square, to) &&
      (effectiveMoverId === id ||
        (before[from?.[0] ?? -1]?.[from?.[1] ?? -1]?.color === current.piece.color));
    const isPromotionArrival =
      isNonStationaryMove &&
      sameSquare(current.square, to) &&
      sourcePiece?.type === "P" &&
      current.piece.type !== "P" &&
      lastMove?.promotion === current.piece.type;
    if (isPromotionArrival) {
      changes.push({ kind: "promote", square: current.square, pieceId: id });
    } else if (!isMoverArrival) {
      changes.push({ kind: "revive", square: current.square, pieceId: id });
    }
  }

  for (const [id, previous] of beforePieces) {
    if (afterPieces.has(id)) continue;
    // A normal move (including a castling rook move) is not a removal.
    if (
      effectiveMoverId === id &&
      (afterPieces.has(id) || moverArrivedWithoutStableId)
    ) continue;
    changes.push({ kind: "remove", square: previous.square, pieceId: id });
  }

  /*
   * Pieces without ids are not in either identity map. Their source/destination
   * pair is intentionally ignored above, preventing coordinate-only false
   * positives while still allowing id-bearing captures to report the victim.
   */
  return changes;
}