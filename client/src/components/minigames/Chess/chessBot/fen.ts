import {
  getDerivedBoard,
  isInCheck,
  syncStateFromBoard,
  type Board,
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

/** Little Big Man pawns move as queens, so Stockfish has to see a queen. */
export function isLittleBigManPawn(piece: Piece, state: ChessState): boolean {
  if (piece.type !== "P" || !piece.id) return false;
  return (
    (piece.color === "black" && piece.id === state.littleBigManBlackId) ||
    (piece.color === "white" && piece.id === state.littleBigManWhiteId)
  );
}

function pieceToFenChar(piece: Piece, state: ChessState): string | null {
  if (piece.type === "M") return null;
  const type: PieceType = isLittleBigManPawn(piece, state) ? "Q" : piece.type;
  const color: Color = piece.color === "orange" ? "white" : piece.color;
  const pair = FEN_CHARS[type];
  if (!pair) return null;
  return color === "white" ? pair[0] : pair[1];
}

export function isStockfishEligible(state: ChessState): boolean {
  return state.occupancy.length === 8 && state.occupancy[0]?.length === 8;
}

/** The board exactly as Stockfish will see it (walls removed, LBM as queen). */
function stockfishViewBoard(state: ChessState): Board {
  return getDerivedBoard(state).map((row) =>
    row.map((p) => {
      if (!p || p.type === "M") return null;
      const color: Color = p.color === "orange" ? "white" : p.color;
      if (isLittleBigManPawn(p, state)) return { ...p, type: "Q" as PieceType, color };
      return color === p.color ? p : { ...p, color };
    }),
  );
}

/**
 * Stockfish (WASM) can crash or return garbage on positions that are legal in
 * this variant but not in chess: missing/extra kings, pawns on a back rank, or
 * the side NOT to move standing in check (Plot Armour, walls hiding a check).
 */
export function isFenSafe(state: ChessState, sideToMove: "white" | "black"): boolean {
  if (!isStockfishEligible(state)) return false;
  const board = stockfishViewBoard(state);
  let wk = 0;
  let bk = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      if (p.type === "K") {
        if (p.color === "white") wk++;
        else bk++;
      }
      if (p.type === "P" && (r === 0 || r === 7)) return false;
    }
  }
  if (wk !== 1 || bk !== 1) return false;
  const view = syncStateFromBoard({ ...state, turn: sideToMove }, board);
  const other = sideToMove === "white" ? "black" : "white";
  // isInCheck honours Plot Armour; Stockfish does not, so strip it here.
  const plain: ChessState = {
    ...view,
    plotArmourWhiteRoundsLeft: 0,
    plotArmourBlackRoundsLeft: 0,
  };
  return !isInCheck(plain, other);
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
      const ch = p ? pieceToFenChar(p, state) : null;
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
  const castling = castlingField(state, board);
  const ep = enPassantField(state, sideToMove, board);
  const stm = sideToMove === "white" ? "w" : "b";
  const half = state.halfMoveClock ?? 0;
  const full = Math.max(1, state.fullMoveNumber ?? 1);

  return `${placement} ${stm} ${castling} ${ep} ${half} ${full}`;
}

/** Only advertise castling rights the board can actually back up. */
function castlingField(state: ChessState, board: Board): string {
  const cr = state.castlingRights;
  const at = (r: number, c: number, type: PieceType, color: Color) => {
    const p = board[r]?.[c];
    return !!p && p.type === type && p.color === color && !isLittleBigManPawn(p, state);
  };
  let castling = "";
  if (cr.white.kingside && at(7, 4, "K", "white") && at(7, 7, "R", "white")) castling += "K";
  if (cr.white.queenside && at(7, 4, "K", "white") && at(7, 0, "R", "white")) castling += "Q";
  if (cr.black.kingside && at(0, 4, "K", "black") && at(0, 7, "R", "black")) castling += "k";
  if (cr.black.queenside && at(0, 4, "K", "black") && at(0, 0, "R", "black")) castling += "q";
  return castling || "-";
}

function enPassantField(
  state: ChessState,
  sideToMove: "white" | "black",
  board: Board,
): string {
  const ep = state.enPassantTarget;
  if (!ep) return "-";
  const [r, c] = ep;
  // The target is only meaningful for the side that can take en passant.
  if (sideToMove === "white" ? r !== 2 : r !== 5) return "-";
  if (board[r]?.[c]) return "-";
  return squareToAlg(r, c);
}

/** Position identity for memoising a follow-up move (ignores move clocks). */
export function positionKey(state: ChessState, sideToMove: "white" | "black"): string {
  const board = getDerivedBoard(state);
  const cells = board
    .map((row) => row.map((p) => (p ? `${p.color[0]}${p.type}` : ".")).join(""))
    .join("/");
  return `${cells}|${sideToMove}|${state.fullMoveNumber}`;
}

export { squareToAlg };
