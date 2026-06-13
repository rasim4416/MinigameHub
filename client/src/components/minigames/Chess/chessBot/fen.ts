import {
  getDerivedBoard,
  type ChessState,
  type Color,
  type Piece,
  type PieceType,
} from "../engine";

const FEN_CHARS: Record<PieceType, [string, string]> = {
  K: ["K", "k"],
  Q: ["Q", "q"],
  R: ["R", "r"],
  B: ["B", "b"],
  N: ["N", "n"],
  P: ["P", "p"],
  M: ["", ""],
};

function squareToAlg(row: number, col: number): string {
  return `${String.fromCharCode(97 + col)}${8 - row}`;
}

function pieceToFenChar(piece: Piece, state: ChessState): string | null {
  if (piece.type === "M") return null;

  let type: PieceType = piece.type;
  if (
    piece.type === "P" &&
    piece.id &&
    state.littleBigManBlackId &&
    piece.id === state.littleBigManBlackId
  ) {
    type = "Q";
  }

  const color: Color =
    piece.color === "orange" ? "white" : piece.color;
  const pair = FEN_CHARS[type];
  if (!pair) return null;
  return color === "white" ? pair[0] : pair[1];
}

export function isStockfishEligible(state: ChessState): boolean {
  return state.occupancy.length === 8 && state.occupancy[0]?.length === 8;
}

export function toStockfishFen(
  state: ChessState,
  sideToMove: "white" | "black",
): string {
  const board = getDerivedBoard(state);
  const rows: string[] = [];

  for (let r = 0; r < 8; r++) {
    let empty = 0;
    let rank = "";
    for (let c = 0; c < 8; c++) {
      const p = board[r]?.[c];
      if (!p) {
        empty++;
        continue;
      }
      const ch = pieceToFenChar(p, state);
      if (!ch) {
        empty++;
        continue;
      }
      if (empty > 0) {
        rank += String(empty);
        empty = 0;
      }
      rank += ch;
    }
    if (empty > 0) rank += String(empty);
    rows.push(rank);
  }

  const placement = rows.join("/");

  let castling = "";
  const cr = state.castlingRights;
  if (cr.white.kingside) castling += "K";
  if (cr.white.queenside) castling += "Q";
  if (cr.black.kingside) castling += "k";
  if (cr.black.queenside) castling += "q";
  if (!castling) castling = "-";

  const ep = state.enPassantTarget
    ? squareToAlg(state.enPassantTarget[0], state.enPassantTarget[1])
    : "-";

  const stm = sideToMove === "white" ? "w" : "b";
  const half = state.halfMoveClock ?? 0;
  const full = state.fullMoveNumber ?? 1;

  return `${placement} ${stm} ${castling} ${ep} ${half} ${full}`;
}

export { squareToAlg };
