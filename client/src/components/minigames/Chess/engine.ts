// ─────────────────────────────────────────────────────────────────────────────
// Chess Engine — pure logic, no React dependencies
// Designed to be extended with roguelike augment hooks later
// ─────────────────────────────────────────────────────────────────────────────

export type PieceType = "K" | "Q" | "R" | "B" | "N" | "P";
export type Color = "white" | "black";
export interface Piece { type: PieceType; color: Color; }
export type Square = Piece | null;
export type Board = Square[][];  // [row][col], row 0 = rank 8 (top), row 7 = rank 1 (bottom)

export interface CastlingRights {
  white: { kingside: boolean; queenside: boolean };
  black: { kingside: boolean; queenside: boolean };
}

export interface MoveRecord {
  from: [number, number];
  to: [number, number];
  piece: Piece;
  captured: Square;
  promotion?: PieceType;
  castling?: "kingside" | "queenside";
  enPassant?: boolean;
}

export type GameStatus = "playing" | "check" | "checkmate" | "stalemate";

export interface ChessState {
  board: Board;
  turn: Color;
  castlingRights: CastlingRights;
  enPassantTarget: [number, number] | null; // square the capturing pawn lands on
  capturedByWhite: PieceType[];
  capturedByBlack: PieceType[];
  status: GameStatus;
  lastMove: MoveRecord | null;
  halfMoveClock: number;
  fullMoveNumber: number;
  moveHistory: MoveRecord[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BACK_RANK: PieceType[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];

export const PIECE_UNICODE: Record<Color, Record<PieceType, string>> = {
  white: { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙" },
  black: { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" },
};

export const PIECE_VALUE: Record<PieceType, number> = {
  P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0,
};

// ─── Utility ──────────────────────────────────────────────────────────────────

export const inB = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
export const opp = (color: Color): Color => color === "white" ? "black" : "white";

export function cloneBoard(board: Board): Board {
  return board.map(row => [...row]);
}

export function findKing(board: Board, color: Color): [number, number] {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.type === "K" && board[r][c]?.color === color)
        return [r, c];
  return [-1, -1]; // should never happen
}

// ─── Attack detection ─────────────────────────────────────────────────────────

/** All squares a piece at (r,c) attacks (for pawns: diagonals only). */
function attacksFrom(board: Board, r: number, c: number, piece: Piece): [number, number][] {
  const { type, color } = piece;
  const sq: [number, number][] = [];

  if (type === "P") {
    const dir = color === "white" ? -1 : 1;
    for (const dc of [-1, 1])
      if (inB(r + dir, c + dc)) sq.push([r + dir, c + dc]);
    return sq;
  }

  if (type === "N") {
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])
      if (inB(r+dr, c+dc)) sq.push([r+dr, c+dc]);
    return sq;
  }

  if (type === "K") {
    for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]])
      if (inB(r+dr, c+dc)) sq.push([r+dr, c+dc]);
    return sq;
  }

  const dirs: [number, number][] = [];
  if (type === "R" || type === "Q") dirs.push([0,1],[0,-1],[1,0],[-1,0]);
  if (type === "B" || type === "Q") dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
  for (const [dr, dc] of dirs) {
    let nr = r+dr, nc = c+dc;
    while (inB(nr, nc)) {
      sq.push([nr, nc]);
      if (board[nr][nc]) break;
      nr += dr; nc += dc;
    }
  }
  return sq;
}

export function isSquareAttackedBy(board: Board, r: number, c: number, byColor: Color): boolean {
  for (let pr = 0; pr < 8; pr++)
    for (let pc = 0; pc < 8; pc++) {
      const p = board[pr][pc];
      if (p && p.color === byColor)
        if (attacksFrom(board, pr, pc, p).some(([ar, ac]) => ar === r && ac === c))
          return true;
    }
  return false;
}

export function isInCheck(board: Board, color: Color): boolean {
  const [kr, kc] = findKing(board, color);
  return kr !== -1 && isSquareAttackedBy(board, kr, kc, opp(color));
}

// ─── Pseudo-legal move generation ─────────────────────────────────────────────

/** Candidate squares for the piece at (r,c) — does NOT filter for self-check. */
function pseudoMoves(
  board: Board, r: number, c: number,
  enPassantTarget: [number, number] | null,
): [number, number][] {
  const piece = board[r][c];
  if (!piece) return [];
  const { type, color } = piece;
  const sq: [number, number][] = [];

  if (type === "P") {
    const dir = color === "white" ? -1 : 1;
    const startRow = color === "white" ? 6 : 1;
    if (inB(r+dir, c) && !board[r+dir][c]) {
      sq.push([r+dir, c]);
      if (r === startRow && !board[r+2*dir][c]) sq.push([r+2*dir, c]);
    }
    for (const dc of [-1, 1]) {
      if (!inB(r+dir, c+dc)) continue;
      const tgt = board[r+dir][c+dc];
      if (tgt && tgt.color !== color) sq.push([r+dir, c+dc]);
      if (enPassantTarget &&
          enPassantTarget[0] === r+dir && enPassantTarget[1] === c+dc)
        sq.push([r+dir, c+dc]);
    }
    return sq;
  }

  if (type === "N") {
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const nr = r+dr, nc = c+dc;
      if (inB(nr, nc) && board[nr][nc]?.color !== color) sq.push([nr, nc]);
    }
    return sq;
  }

  if (type === "K") {
    for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
      const nr = r+dr, nc = c+dc;
      if (inB(nr, nc) && board[nr][nc]?.color !== color) sq.push([nr, nc]);
    }
    return sq;
  }

  const dirs: [number, number][] = [];
  if (type === "R" || type === "Q") dirs.push([0,1],[0,-1],[1,0],[-1,0]);
  if (type === "B" || type === "Q") dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
  for (const [dr, dc] of dirs) {
    let nr = r+dr, nc = c+dc;
    while (inB(nr, nc)) {
      if (board[nr][nc]) {
        if (board[nr][nc]!.color !== color) sq.push([nr, nc]);
        break;
      }
      sq.push([nr, nc]);
      nr += dr; nc += dc;
    }
  }
  return sq;
}

// ─── Board mutation (used for legal-move filtering) ───────────────────────────

/** Apply a single move to a board copy (without updating game state metadata). */
export function applyMoveToBoard(
  board: Board,
  enPassantTarget: [number, number] | null,
  from: [number, number], to: [number, number],
  promotion?: PieceType,
): Board {
  const [fr, fc] = from;
  const [tr, tc] = to;
  const piece = board[fr][fc]!;
  const nb = cloneBoard(board);

  // En passant: remove the captured pawn
  if (piece.type === "P" && fc !== tc && !board[tr][tc]) {
    nb[fr][tc] = null;
  }

  nb[tr][tc] = promotion ? { type: promotion, color: piece.color } : { ...piece };
  nb[fr][fc] = null;

  // Castling: also move the rook
  if (piece.type === "K" && Math.abs(tc - fc) === 2) {
    if (tc === 6) { nb[fr][5] = nb[fr][7]; nb[fr][7] = null; }
    else          { nb[fr][3] = nb[fr][0]; nb[fr][0] = null; }
  }

  return nb;
}

// ─── Legal move generation ────────────────────────────────────────────────────

export function getLegalMoves(state: ChessState, r: number, c: number): [number, number][] {
  const piece = state.board[r][c];
  if (!piece || piece.color !== state.turn) return [];

  const pseudo = pseudoMoves(state.board, r, c, state.enPassantTarget);
  const legal: [number, number][] = [];

  for (const [tr, tc] of pseudo) {
    const nb = applyMoveToBoard(state.board, state.enPassantTarget, [r, c], [tr, tc]);
    if (!isInCheck(nb, piece.color)) legal.push([tr, tc]);
  }

  // Castling (added separately so applyMoveToBoard doesn't need to know the full state)
  if (piece.type === "K" && !isInCheck(state.board, piece.color)) {
    const row = piece.color === "white" ? 7 : 0;
    const rights = state.castlingRights[piece.color];

    if (rights.kingside
        && !state.board[row][5] && !state.board[row][6]
        && !isSquareAttackedBy(state.board, row, 5, opp(piece.color))
        && !isSquareAttackedBy(state.board, row, 6, opp(piece.color))) {
      legal.push([row, 6]);
    }

    if (rights.queenside
        && !state.board[row][1] && !state.board[row][2] && !state.board[row][3]
        && !isSquareAttackedBy(state.board, row, 3, opp(piece.color))
        && !isSquareAttackedBy(state.board, row, 2, opp(piece.color))) {
      legal.push([row, 2]);
    }
  }

  return legal;
}

export function hasAnyLegalMove(state: ChessState, color: Color): boolean {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (state.board[r][c]?.color === color) {
        const tempState = { ...state, turn: color };
        if (getLegalMoves(tempState, r, c).length > 0) return true;
      }
  return false;
}

// ─── Full move execution ──────────────────────────────────────────────────────

export function makeMove(
  state: ChessState,
  from: [number, number], to: [number, number],
  promotion?: PieceType,
): ChessState {
  const [fr, fc] = from;
  const [tr, tc] = to;
  const piece = state.board[fr][fc]!;
  const captured = state.board[tr][tc];

  const isEP = piece.type === "P" && fc !== tc && !captured;
  const isCastling = piece.type === "K" && Math.abs(tc - fc) === 2;

  const newBoard = applyMoveToBoard(state.board, state.enPassantTarget, from, to, promotion);

  // Update castling rights
  const cr = {
    white: { ...state.castlingRights.white },
    black: { ...state.castlingRights.black },
  };
  if (piece.type === "K") cr[piece.color] = { kingside: false, queenside: false };
  if (piece.type === "R" || (fr === 7 && fc === 0)) cr.white.queenside = false;
  if (piece.type === "R" || (fr === 7 && fc === 7)) cr.white.kingside = false;
  if (piece.type === "R" || (fr === 0 && fc === 0)) cr.black.queenside = false;
  if (piece.type === "R" || (fr === 0 && fc === 7)) cr.black.kingside = false;
  // More precise rook tracking
  if (piece.type === "R") {
    if (fr === 7 && fc === 0) cr.white.queenside = false;
    else if (fr === 7 && fc === 7) cr.white.kingside = false;
    else if (fr === 0 && fc === 0) cr.black.queenside = false;
    else if (fr === 0 && fc === 7) cr.black.kingside = false;
  }
  if (piece.type === "K") cr[piece.color] = { kingside: false, queenside: false };
  // Rook captured from its corner removes rights too
  if (tr === 7 && tc === 0) cr.white.queenside = false;
  if (tr === 7 && tc === 7) cr.white.kingside = false;
  if (tr === 0 && tc === 0) cr.black.queenside = false;
  if (tr === 0 && tc === 7) cr.black.kingside = false;

  // En passant target
  const newEP: [number, number] | null =
    piece.type === "P" && Math.abs(tr - fr) === 2
      ? [(fr + tr) / 2, fc]
      : null;

  // Captured pieces lists
  const cbw = [...state.capturedByWhite];
  const cbb = [...state.capturedByBlack];
  if (captured) {
    piece.color === "white" ? cbw.push(captured.type) : cbb.push(captured.type);
  }
  if (isEP) {
    piece.color === "white" ? cbw.push("P") : cbb.push("P");
  }

  const record: MoveRecord = {
    from, to, piece: { ...piece }, captured,
    promotion, enPassant: isEP || undefined,
    castling: isCastling ? (tc === 6 ? "kingside" : "queenside") : undefined,
  };

  const nextTurn = opp(piece.color);
  const nextState: ChessState = {
    board: newBoard,
    turn: nextTurn,
    castlingRights: cr,
    enPassantTarget: newEP,
    capturedByWhite: cbw,
    capturedByBlack: cbb,
    status: "playing",
    lastMove: record,
    halfMoveClock: (piece.type === "P" || !!captured || isEP) ? 0 : state.halfMoveClock + 1,
    fullMoveNumber: piece.color === "black" ? state.fullMoveNumber + 1 : state.fullMoveNumber,
    moveHistory: [...state.moveHistory, record],
  };

  // Determine status for the next player
  const nextHasMove = hasAnyLegalMove(nextState, nextTurn);
  if (!nextHasMove) {
    nextState.status = isInCheck(newBoard, nextTurn) ? "checkmate" : "stalemate";
  } else if (isInCheck(newBoard, nextTurn)) {
    nextState.status = "check";
  }

  return nextState;
}

// ─── Initial state ────────────────────────────────────────────────────────────

export function createInitialState(): ChessState {
  const board: Board = Array(8).fill(null).map(() => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    board[0][c] = { type: BACK_RANK[c], color: "black" };
    board[1][c] = { type: "P", color: "black" };
    board[6][c] = { type: "P", color: "white" };
    board[7][c] = { type: BACK_RANK[c], color: "white" };
  }
  return {
    board,
    turn: "white",
    castlingRights: {
      white: { kingside: true, queenside: true },
      black: { kingside: true, queenside: true },
    },
    enPassantTarget: null,
    capturedByWhite: [],
    capturedByBlack: [],
    status: "playing",
    lastMove: null,
    halfMoveClock: 0,
    fullMoveNumber: 1,
    moveHistory: [],
  };
}

// ─── Helpers for UI ───────────────────────────────────────────────────────────

export function materialAdvantage(state: ChessState): { white: number; black: number } {
  const sum = (arr: PieceType[]) => arr.reduce((s, t) => s + PIECE_VALUE[t], 0);
  const w = sum(state.capturedByWhite);
  const b = sum(state.capturedByBlack);
  return { white: w - b, black: b - w };
}
