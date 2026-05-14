// ─────────────────────────────────────────────────────────────────────────────
// Chess Engine — pure logic, no React dependencies
// Two-layer model: occupancy grid (pieceId | null) + piece registry (id → entity)
// ─────────────────────────────────────────────────────────────────────────────

export type PieceType = "K" | "Q" | "R" | "B" | "N" | "P" | "M";
export type Color = "white" | "black" | "orange";
export type PieceId = string;

/** Authoritative piece data (extend for per-piece shenanigans). */
export interface PieceEntity {
  id: PieceId;
  type: PieceType;
  color: Color;
}

/** UI / move-record shape: type + color + optional id (matches entity when present). */
export interface Piece {
  type: PieceType;
  color: Color;
  id?: PieceId;
}

export type Square = Piece | null;
/** Derived 2D view built from occupancy + pieces (for legacy helpers and rendering). */
export type Board = Square[][];

export type Occupancy = (PieceId | null)[][];

export interface CastlingRights {
  white: { kingside: boolean; queenside: boolean };
  black: { kingside: boolean; queenside: boolean };
}

/**
 * After swapping two squares on the board (Swap augment), re-check K+R home
 * corners. Rights never flip from false→true; a side clears if king or that
 * rook no longer sits on the canonical castling homes (8×8 or padded 10×10).
 */
export function castlingRightsAfterSwap(
  prior: CastlingRights,
  board: Board,
): CastlingRights {
  const n = board.length;
  const off = (n - 8) / 2;
  const homes = {
    white: {
      k: [7 + off, 4 + off] as [number, number],
      kr: [7 + off, 7 + off] as [number, number],
      qr: [7 + off, 0 + off] as [number, number],
    },
    black: {
      k: [0 + off, 4 + off] as [number, number],
      kr: [0 + off, 7 + off] as [number, number],
      qr: [0 + off, 0 + off] as [number, number],
    },
  };
  const sideOk = (color: "white" | "black", kingside: boolean): boolean => {
    const h = homes[color];
    const [kr, kc] = h.k;
    const [rr, rc] = kingside ? h.kr : h.qr;
    const kp = board[kr]?.[kc];
    const rp = board[rr]?.[rc];
    return (
      !!kp &&
      kp.type === "K" &&
      kp.color === color &&
      !!rp &&
      rp.type === "R" &&
      rp.color === color
    );
  };
  return {
    white: {
      kingside: prior.white.kingside && sideOk("white", true),
      queenside: prior.white.queenside && sideOk("white", false),
    },
    black: {
      kingside: prior.black.kingside && sideOk("black", true),
      queenside: prior.black.queenside && sideOk("black", false),
    },
  };
}

export interface MoveRecord {
  from: [number, number];
  to: [number, number];
  piece: Piece;
  captured: Square;
  pieceId?: PieceId;
  capturedPieceId?: PieceId | null;
  promotion?: PieceType;
  castling?: "kingside" | "queenside";
  enPassant?: boolean;
}

export type GameStatus = "playing" | "check" | "checkmate" | "stalemate";

export interface ChessState {
  occupancy: Occupancy;
  pieces: Record<PieceId, PieceEntity>;
  turn: Color;
  castlingRights: CastlingRights;
  enPassantTarget: [number, number] | null;
  capturedByWhite: PieceType[];
  capturedByBlack: PieceType[];
  goldWhite: number;
  goldBlack: number;
  status: GameStatus;
  lastMove: MoveRecord | null;
  halfMoveClock: number;
  fullMoveNumber: number;
  moveHistory: MoveRecord[];
  /** Augment: Free Passage — king may castle while in check. */
  freePassageWhite?: boolean;
  freePassageBlack?: boolean;
  /** Permanent winter ice (empty squares); cannot move onto or through. */
  permaFrozenSquares?: { row: number; col: number }[];
  /** Little Big Man — pawn id moves like a queen until UI clears this field. */
  littleBigManWhiteId?: PieceId | null;
  littleBigManBlackId?: PieceId | null;
}

// ─── Board size (mutable for Domain Expansion) ───────────────────────────────

let BOARD_SIZE = 8;
export function setBoardSize(size: number) {
  BOARD_SIZE = size;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BACK_RANK: PieceType[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];

export const PIECE_UNICODE: Record<Color, Record<PieceType, string>> = {
  white: { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙", M: "🗿" },
  black: { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟", M: "🗿" },
  orange: { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "🟠", M: "🗿" },
};

export const PIECE_VALUE: Record<PieceType, number> = {
  P: 1,
  N: 3,
  B: 3,
  R: 5,
  Q: 9,
  K: 0,
  M: 0,
};

let idCounter = 0;
function genFallbackPieceId(): PieceId {
  idCounter += 1;
  return `_p${idCounter}_${Math.random().toString(36).slice(2, 9)}`;
}

function entityToPiece(e: PieceEntity): Piece {
  return { type: e.type, color: e.color, id: e.id };
}

/** Piece at square for rules + UI (derived from registry). */
export function getPieceAt(state: ChessState, r: number, c: number): Piece | null {
  if (!inB(r, c, state.occupancy.length)) return null;
  const id = state.occupancy[r][c];
  if (!id) return null;
  const e = state.pieces[id];
  return e ? entityToPiece(e) : null;
}

/** Build a classic `Board` grid from occupancy + pieces (read-only view). */
export function getDerivedBoard(state: ChessState): Board {
  const n = state.occupancy.length;
  const b: Board = Array(n)
    .fill(null)
    .map(() => Array(n).fill(null));
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      b[r][c] = getPieceAt(state, r, c);
    }
  return b;
}

/**
 * Rebuild occupancy + pieces from a full grid. Preserves ids on cells; assigns ids
 * for any piece missing one. Use after UI-style board mutations.
 */
export function syncStateFromBoard(state: ChessState, board: Board): ChessState {
  const pieces: Record<PieceId, PieceEntity> = {};
  const occupancy: Occupancy = board.map((row) =>
    row.map((sq) => {
      if (!sq) return null;
      let id = sq.id;
      if (!id) id = genFallbackPieceId();
      pieces[id] = { id, type: sq.type, color: sq.color };
      return id;
    }),
  );
  return { ...state, occupancy, pieces };
}

/** True if payload is legacy single-layer state (only `board`). */
function isLegacyChessState(x: unknown): x is { board: Board } & Record<string, unknown> {
  return (
    typeof x === "object" &&
    x !== null &&
    "board" in x &&
    !("occupancy" in x) &&
    Array.isArray((x as { board: unknown }).board)
  );
}

/** Normalize snapshot / saved game: dual-layer, or migrate from legacy `board`. */
export function normalizeChessState(raw: unknown): ChessState {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("normalizeChessState: invalid state");
  }
  const s = raw as Partial<ChessState> & { board?: Board };
  if (s.occupancy && s.pieces && typeof s.pieces === "object") {
    return s as ChessState;
  }
  if (isLegacyChessState(s) && s.board) {
    const shell = createEmptyChessStateShell();
    const merged: ChessState = {
      ...shell,
      turn: (s.turn as Color) ?? shell.turn,
      castlingRights: (s.castlingRights as CastlingRights) ?? shell.castlingRights,
      enPassantTarget: (s.enPassantTarget as [number, number] | null) ?? null,
      capturedByWhite: (s.capturedByWhite as PieceType[]) ?? [],
      capturedByBlack: (s.capturedByBlack as PieceType[]) ?? [],
      goldWhite: typeof s.goldWhite === "number" ? s.goldWhite : 0,
      goldBlack: typeof s.goldBlack === "number" ? s.goldBlack : 0,
      status: (s.status as GameStatus) ?? "playing",
      lastMove: (s.lastMove as MoveRecord | null) ?? null,
      halfMoveClock: typeof s.halfMoveClock === "number" ? s.halfMoveClock : 0,
      fullMoveNumber: typeof s.fullMoveNumber === "number" ? s.fullMoveNumber : 1,
      moveHistory: (s.moveHistory as MoveRecord[]) ?? [],
    };
    return syncStateFromBoard(merged, s.board);
  }
  throw new Error("normalizeChessState: missing occupancy/pieces and board");
}

function createEmptyChessStateShell(): ChessState {
  return {
    occupancy: [],
    pieces: {},
    turn: "white",
    castlingRights: {
      white: { kingside: true, queenside: true },
      black: { kingside: true, queenside: true },
    },
    enPassantTarget: null,
    capturedByWhite: [],
    capturedByBlack: [],
    goldWhite: 0,
    goldBlack: 0,
    status: "playing",
    lastMove: null,
    halfMoveClock: 0,
    fullMoveNumber: 1,
    moveHistory: [],
    freePassageWhite: false,
    freePassageBlack: false,
    permaFrozenSquares: [],
  };
}

export function assertStateConsistent(state: ChessState): void {
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") return;
  const seen = new Set<PieceId>();
  for (let r = 0; r < state.occupancy.length; r++)
    for (let c = 0; c < state.occupancy[r].length; c++) {
      const id = state.occupancy[r][c];
      if (!id) continue;
      if (seen.has(id)) console.warn("ChessState: duplicate occupancy id", id);
      seen.add(id);
      if (!state.pieces[id]) console.warn("ChessState: occupancy id missing in pieces", id, r, c);
    }
  for (const id of Object.keys(state.pieces)) {
    let found = false;
    for (const row of state.occupancy)
      for (const cell of row)
        if (cell === id) {
          found = true;
          break;
        }
    if (!found) console.warn("ChessState: piece not on board", id);
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Bounds check; `n` defaults to global board size (Domain Expansion updates `BOARD_SIZE`). */
export const inB = (r: number, c: number, n: number = BOARD_SIZE) =>
  r >= 0 && r < n && c >= 0 && c < n;

export const opp = (color: Color): Color =>
  color === "white" ? "black" : color === "black" ? "white" : "black";

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function cloneOccupancy(occ: Occupancy): Occupancy {
  return occ.map((row) => [...row]);
}

function clonePieces(pieces: Record<PieceId, PieceEntity>): Record<PieceId, PieceEntity> {
  return { ...pieces };
}

// ─── King / attacks (ChessState-native) ───────────────────────────────────────

function isChessState(x: unknown): x is ChessState {
  return typeof x === "object" && x !== null && "occupancy" in x && "pieces" in x;
}

function findKingInState(state: ChessState, color: Color): [number, number] {
  for (let r = 0; r < state.occupancy.length; r++)
    for (let c = 0; c < state.occupancy[r].length; c++) {
      const p = getPieceAt(state, r, c);
      if (p?.type === "K" && p.color === color) return [r, c];
    }
  return [-1, -1];
}

function findKingOnBoard(board: Board, color: Color): [number, number] {
  for (let r = 0; r < board.length; r++)
    for (let c = 0; c < board[r].length; c++) {
      const p = board[r][c];
      if (p?.type === "K" && p.color === color) return [r, c];
    }
  return [-1, -1];
}

/** King square from dual-layer state or from a derived `Board` grid. */
export function findKing(stateOrBoard: ChessState | Board, color: Color): [number, number] {
  if (isChessState(stateOrBoard)) return findKingInState(stateOrBoard, color);
  return findKingOnBoard(stateOrBoard, color);
}

function attacksFrom(state: ChessState, r: number, c: number, piece: Piece): [number, number][] {
  const { type, color } = piece;
  const n = state.occupancy.length;
  const sq: [number, number][] = [];

  if (type === "M") return [];

  if (type === "P") {
    if (color === "orange") {
      for (const [dr, dc] of [
        [-1, 1],
        [1, 1],
      ] as [number, number][])
        if (inB(r + dr, c + dc, n)) sq.push([r + dr, c + dc]);
      return sq;
    }
    const dir = color === "white" ? -1 : 1;
    for (const dc of [-1, 1])
      if (inB(r + dir, c + dc, n)) sq.push([r + dir, c + dc]);
    return sq;
  }

  if (type === "N") {
    for (const [dr, dc] of [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ])
      if (inB(r + dr, c + dc, n)) sq.push([r + dr, c + dc]);
    return sq;
  }

  if (type === "K") {
    for (const [dr, dc] of [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ])
      if (inB(r + dr, c + dc, n)) sq.push([r + dr, c + dc]);
    return sq;
  }

  const dirs: [number, number][] = [];
  if (type === "R" || type === "Q") dirs.push([0, 1], [0, -1], [1, 0], [-1, 0]);
  if (type === "B" || type === "Q") dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
  for (const [dr, dc] of dirs) {
    let nr = r + dr,
      nc = c + dc;
    while (inB(nr, nc, n)) {
      sq.push([nr, nc]);
      if (state.occupancy[nr][nc]) break;
      nr += dr;
      nc += dc;
    }
  }
  return sq;
}

export function isSquareAttackedBy(
  state: ChessState,
  r: number,
  c: number,
  byColor: Color,
): boolean {
  const n = state.occupancy.length;
  for (let pr = 0; pr < n; pr++)
    for (let pc = 0; pc < n; pc++) {
      const p = getPieceAt(state, pr, pc);
      if (p && p.color === byColor)
        if (attacksFrom(state, pr, pc, p).some(([ar, ac]) => ar === r && ac === c)) return true;
    }
  return false;
}

const MERCENARY_ID_MARK = "mercenary";

/** Orange mercenary knights never count toward check (patrol, siege, crusaders). */
function isOrangeMercenaryKnight(p: Piece | null): boolean {
  return (
    !!p &&
    p.type === "N" &&
    p.color === "orange" &&
    typeof p.id === "string" &&
    p.id.includes(MERCENARY_ID_MARK)
  );
}

function isSquareAttackedByOrangeMercenaries(
  state: ChessState,
  r: number,
  c: number,
): boolean {
  const n = state.occupancy.length;
  for (let pr = 0; pr < n; pr++)
    for (let pc = 0; pc < n; pc++) {
      const p = getPieceAt(state, pr, pc);
      if (
        p?.color === "orange" &&
        p.id?.includes(MERCENARY_ID_MARK) &&
        !isOrangeMercenaryKnight(p) &&
        attacksFrom(state, pr, pc, p).some(([ar, ac]) => ar === r && ac === c)
      )
        return true;
    }
  return false;
}

/** Attacked by the opposite player or by an orange mercenary piece (for king safety). */
export function isSquareAttackedByEnemyOrMercenary(
  state: ChessState,
  r: number,
  c: number,
  kingColor: "white" | "black",
): boolean {
  return (
    isSquareAttackedBy(state, r, c, opp(kingColor)) ||
    isSquareAttackedByOrangeMercenaries(state, r, c)
  );
}

/** @deprecated Use isSquareAttackedBy(state, ...) */
export function isSquareAttackedByBoard(
  board: Board,
  r: number,
  c: number,
  byColor: Color,
): boolean {
  const st = boardToMinimalState(board);
  return isSquareAttackedBy(st, r, c, byColor);
}

/** Wrap a Board in minimal ChessState for ray helpers (board-only callers). */
function boardToMinimalState(board: Board): ChessState {
  return syncStateFromBoard(
    {
      ...createEmptyChessStateShell(),
      occupancy: [],
      pieces: {},
    },
    board,
  );
}

function isInCheckState(state: ChessState, color: Color): boolean {
  if (color === "orange") return false;
  const [kr, kc] = findKingInState(state, color);
  return (
    kr !== -1 &&
    isSquareAttackedByEnemyOrMercenary(state, kr, kc, color)
  );
}

/** In-check from dual-layer state or from a derived `Board` grid. */
export function isInCheck(stateOrBoard: ChessState | Board, color: Color): boolean {
  if (isChessState(stateOrBoard)) return isInCheckState(stateOrBoard, color);
  return isInCheckState(boardToMinimalState(stateOrBoard), color);
}

function isPermaFrozenSquare(state: ChessState, r: number, c: number): boolean {
  return (
    state.permaFrozenSquares?.some((s) => s.row === r && s.col === c) ?? false
  );
}

/** Queen-like slides for Little Big Man pawn (pseudo-legal only). */
function pseudoQueenLikeSlidesForColor(
  state: ChessState,
  r: number,
  c: number,
  color: Color,
): [number, number][] {
  const n = state.occupancy.length;
  const sq: [number, number][] = [];
  const dirs: [number, number][] = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  for (const [dr, dc] of dirs) {
    let nr = r + dr,
      nc = c + dc;
    while (inB(nr, nc, n)) {
      const tgt = getPieceAt(state, nr, nc);
      if (tgt) {
        if (tgt.color !== color && tgt.type !== "M") sq.push([nr, nc]);
        break;
      }
      sq.push([nr, nc]);
      nr += dr;
      nc += dc;
    }
  }
  return sq;
}

function pseudoMoves(
  state: ChessState,
  r: number,
  c: number,
  enPassantTarget: [number, number] | null,
): [number, number][] {
  const piece = getPieceAt(state, r, c);
  if (!piece) return [];
  const { type, color } = piece;
  const n = state.occupancy.length;
  const sq: [number, number][] = [];

  if (type === "M") return [];

  if (type === "P") {
    if (color === "orange") return [];
    const movingId = state.occupancy[r][c];
    if (movingId) {
      if (color === "white" && state.littleBigManWhiteId === movingId)
        return pseudoQueenLikeSlidesForColor(state, r, c, color);
      if (color === "black" && state.littleBigManBlackId === movingId)
        return pseudoQueenLikeSlidesForColor(state, r, c, color);
    }
    const dir = color === "white" ? -1 : 1;
    const _off = (n - 8) / 2;
    const startRow = color === "white" ? 6 + _off : 1 + _off;
    if (inB(r + dir, c, n) && !state.occupancy[r + dir][c]) {
      sq.push([r + dir, c]);
      if (r === startRow && inB(r + 2 * dir, c, n) && !state.occupancy[r + 2 * dir][c])
        sq.push([r + 2 * dir, c]);
    }
    for (const dc of [-1, 1]) {
      if (!inB(r + dir, c + dc, n)) continue;
      const tgt = getPieceAt(state, r + dir, c + dc);
      if (tgt && tgt.color !== color && tgt.type !== "M") sq.push([r + dir, c + dc]);
      if (enPassantTarget && enPassantTarget[0] === r + dir && enPassantTarget[1] === c + dc)
        sq.push([r + dir, c + dc]);
    }
    return sq;
  }

  if (type === "N") {
    for (const [dr, dc] of [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ]) {
      const nr = r + dr,
        nc = c + dc;
      const tgt = inB(nr, nc, n) ? getPieceAt(state, nr, nc) : null;
      if (inB(nr, nc, n) && tgt?.color !== color && tgt?.type !== "M") sq.push([nr, nc]);
    }
    return sq;
  }

  if (type === "K") {
    for (const [dr, dc] of [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ]) {
      const nr = r + dr,
        nc = c + dc;
      const tgt = inB(nr, nc, n) ? getPieceAt(state, nr, nc) : null;
      if (inB(nr, nc, n) && tgt?.color !== color && tgt?.type !== "M") sq.push([nr, nc]);
    }
    return sq;
  }

  const dirs: [number, number][] = [];
  if (type === "R" || type === "Q") dirs.push([0, 1], [0, -1], [1, 0], [-1, 0]);
  if (type === "B" || type === "Q") dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
  for (const [dr, dc] of dirs) {
    let nr = r + dr,
      nc = c + dc;
    while (inB(nr, nc, n)) {
      const tgt = getPieceAt(state, nr, nc);
      if (tgt) {
        if (tgt.color !== color && tgt.type !== "M") sq.push([nr, nc]);
        break;
      }
      sq.push([nr, nc]);
      nr += dr;
      nc += dc;
    }
  }
  return sq;
}

// ─── Apply move (dual-layer) ──────────────────────────────────────────────────

function applyMoveToState(
  state: ChessState,
  enPassantTarget: [number, number] | null,
  from: [number, number],
  to: [number, number],
  promotion?: PieceType,
): ChessState {
  const [fr, fc] = from;
  const [tr, tc] = to;
  const movingId = state.occupancy[fr][fc];
  if (!movingId) return state;
  const occ = cloneOccupancy(state.occupancy);
  const pieces = clonePieces(state.pieces);
  const ent = pieces[movingId];
  if (!ent) return state;

  const capturedId = occ[tr][tc];

  if (ent.type === "P" && fc !== tc && !capturedId) {
    const epId = occ[fr][tc];
    if (epId) {
      delete pieces[epId];
      occ[fr][tc] = null;
    }
  }

  occ[fr][fc] = null;
  occ[tr][tc] = movingId;

  if (promotion) {
    pieces[movingId] = { ...ent, type: promotion };
  }

  if (ent.type === "K" && Math.abs(tc - fc) === 2) {
    const n = occ.length;
    const off = (n - 8) / 2;
    if (tc > fc) {
      const rk = off + 7;
      const rid = occ[fr][rk];
      if (rid) {
        occ[fr][rk] = null;
        occ[fr][off + 5] = rid;
      }
    } else {
      const rk = off;
      const rid = occ[fr][rk];
      if (rid) {
        occ[fr][rk] = null;
        occ[fr][off + 3] = rid;
      }
    }
  }

  if (capturedId) delete pieces[capturedId];

  return { ...state, occupancy: occ, pieces };
}

// ─── Legal move generation ────────────────────────────────────────────────────

export function getLegalMoves(state: ChessState, r: number, c: number): [number, number][] {
  const piece = getPieceAt(state, r, c);
  if (!piece || piece.color !== state.turn) return [];

  const pseudoAll = pseudoMoves(state, r, c, state.enPassantTarget);
  const pseudo = pseudoAll.filter(([tr, tc]) => {
    if (isPermaFrozenSquare(state, tr, tc)) return false;
    if (
      piece.type === "P" &&
      Math.abs(tr - r) === 2 &&
      tc === c &&
      piece.color !== "orange"
    ) {
      const midR = (r + tr) / 2;
      if (isPermaFrozenSquare(state, midR, tc)) return false;
    }
    return true;
  });
  const legal: [number, number][] = [];

  for (const [tr, tc] of pseudo) {
    const nb = applyMoveToState(state, state.enPassantTarget, [r, c], [tr, tc]);
    if (!isInCheck(nb, piece.color)) legal.push([tr, tc]);
  }

  const allowCastleFromCheck =
    piece.type === "K" &&
    (piece.color === "white"
      ? !!state.freePassageWhite
      : piece.color === "black"
        ? !!state.freePassageBlack
        : false);
  if (
    piece.type === "K" &&
    (piece.color === "white" || piece.color === "black") &&
    (!isInCheck(state, piece.color) || allowCastleFromCheck)
  ) {
    const side = piece.color;
    const n = state.occupancy.length;
    const off = (n - 8) / 2;
    const row = side === "white" ? 7 + off : off;
    const rights = state.castlingRights[side];

    if (
      rights.kingside &&
      !state.occupancy[row][off + 5] &&
      !state.occupancy[row][off + 6] &&
      !isPermaFrozenSquare(state, row, off + 5) &&
      !isPermaFrozenSquare(state, row, off + 6) &&
      !isSquareAttackedByEnemyOrMercenary(state, row, off + 5, side) &&
      !isSquareAttackedByEnemyOrMercenary(state, row, off + 6, side)
    ) {
      legal.push([row, off + 6]);
    }

    if (
      rights.queenside &&
      !state.occupancy[row][off + 1] &&
      !state.occupancy[row][off + 2] &&
      !state.occupancy[row][off + 3] &&
      !isPermaFrozenSquare(state, row, off + 1) &&
      !isPermaFrozenSquare(state, row, off + 2) &&
      !isPermaFrozenSquare(state, row, off + 3) &&
      !isSquareAttackedByEnemyOrMercenary(state, row, off + 3, side) &&
      !isSquareAttackedByEnemyOrMercenary(state, row, off + 2, side)
    ) {
      legal.push([row, off + 2]);
    }
  }

  return legal;
}

export function hasAnyLegalMove(state: ChessState, color: Color): boolean {
  if (color === "orange") return false;
  const n = state.occupancy.length;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (getPieceAt(state, r, c)?.color === color) {
        const tempState = { ...state, turn: color };
        if (getLegalMoves(tempState, r, c).length > 0) return true;
      }
    }
  return false;
}

// ─── Full move execution ──────────────────────────────────────────────────────

export function makeMove(
  state: ChessState,
  from: [number, number],
  to: [number, number],
  promotion?: PieceType,
): ChessState {
  const [fr, fc] = from;
  const [tr, tc] = to;
  const piece = getPieceAt(state, fr, fc)!;
  const movingId = state.occupancy[fr][fc]!;
  const capturedId = state.occupancy[tr][tc];
  const captured: Square = capturedId ? entityToPiece(state.pieces[capturedId]!) : null;

  const isEP = piece.type === "P" && fc !== tc && !captured;
  const epVictimId = isEP ? state.occupancy[fr][tc] : null;
  const isCastling = piece.type === "K" && Math.abs(tc - fc) === 2;

  const newCore = applyMoveToState(state, state.enPassantTarget, from, to, promotion);

  const cr = {
    white: { ...state.castlingRights.white },
    black: { ...state.castlingRights.black },
  };
  const n = state.occupancy.length;
  const off = (n - 8) / 2;
  const wBack = 7 + off;
  const bBack = off;
  const wRookQ = off;
  const wRookK = off + 7;
  const bRookQ = off;
  const bRookK = off + 7;

  if (piece.type === "K" && (piece.color === "white" || piece.color === "black")) {
    cr[piece.color] = { kingside: false, queenside: false };
  }
  if (piece.type === "R") {
    if (fr === wBack && fc === wRookQ) cr.white.queenside = false;
    else if (fr === wBack && fc === wRookK) cr.white.kingside = false;
    else if (fr === bBack && fc === bRookQ) cr.black.queenside = false;
    else if (fr === bBack && fc === bRookK) cr.black.kingside = false;
  }
  if (tr === wBack && tc === wRookQ) cr.white.queenside = false;
  if (tr === wBack && tc === wRookK) cr.white.kingside = false;
  if (tr === bBack && tc === bRookQ) cr.black.queenside = false;
  if (tr === bBack && tc === bRookK) cr.black.kingside = false;

  const newEP: [number, number] | null =
    piece.type === "P" && Math.abs(tr - fr) === 2 ? [(fr + tr) / 2, fc] : null;

  const cbw = [...state.capturedByWhite];
  const cbb = [...state.capturedByBlack];
  if (captured) {
    if (captured.color === "white") cbw.push(captured.type);
    else if (captured.color === "black") cbb.push(captured.type);
  }
  if (isEP) {
    piece.color === "white" ? cbw.push("P") : cbb.push("P");
  }

  let goldWhite = state.goldWhite;
  let goldBlack = state.goldBlack;
  if (captured) {
    const gain = PIECE_VALUE[captured.type];
    if (captured.color === "white") goldWhite += gain;
    else if (captured.color === "black") goldBlack += gain;
  }
  if (isEP) {
    piece.color === "white" ? (goldWhite += 1) : (goldBlack += 1);
  }

  const record: MoveRecord = {
    from,
    to,
    piece: { ...piece },
    captured,
    pieceId: movingId,
    capturedPieceId: capturedId ?? epVictimId ?? null,
    promotion,
    enPassant: isEP || undefined,
    castling: isCastling ? (tc > fc ? "kingside" : "queenside") : undefined,
  };

  const nextTurn = opp(piece.color);
  const nextState: ChessState = {
    ...newCore,
    turn: nextTurn,
    castlingRights: cr,
    enPassantTarget: newEP,
    capturedByWhite: cbw,
    capturedByBlack: cbb,
    goldWhite,
    goldBlack,
    status: "playing",
    lastMove: record,
    halfMoveClock: piece.type === "P" || !!captured || isEP ? 0 : state.halfMoveClock + 1,
    fullMoveNumber: piece.color === "black" ? state.fullMoveNumber + 1 : state.fullMoveNumber,
    moveHistory: [...state.moveHistory, record],
    freePassageWhite: state.freePassageWhite ?? false,
    freePassageBlack: state.freePassageBlack ?? false,
    permaFrozenSquares: state.permaFrozenSquares
      ? [...state.permaFrozenSquares]
      : [],
    littleBigManWhiteId: state.littleBigManWhiteId ?? null,
    littleBigManBlackId: state.littleBigManBlackId ?? null,
  };

  const nextHasMove = hasAnyLegalMove(nextState, nextTurn);
  if (!nextHasMove) {
    nextState.status = isInCheck(nextState, nextTurn) ? "checkmate" : "stalemate";
  } else if (isInCheck(nextState, nextTurn)) {
    nextState.status = "check";
  }

  return nextState;
}

// ─── Initial state ────────────────────────────────────────────────────────────

export function createInitialState(): ChessState {
  const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const board: Board = Array(8)
    .fill(null)
    .map(() => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    board[0][c] = { type: BACK_RANK[c], color: "black", id: `b${BACK_RANK[c]}${FILES[c]}` };
    board[1][c] = { type: "P", color: "black", id: `bP${c}` };
    board[6][c] = { type: "P", color: "white", id: `wP${c}` };
    board[7][c] = { type: BACK_RANK[c], color: "white", id: `w${BACK_RANK[c]}${FILES[c]}` };
  }
  const shell = createEmptyChessStateShell();
  return syncStateFromBoard(shell, board);
}

// ─── Helpers for UI ───────────────────────────────────────────────────────────

export function materialAdvantage(state: ChessState): { white: number; black: number } {
  const sum = (arr: PieceType[]) => arr.reduce((s, t) => s + PIECE_VALUE[t], 0);
  const w = sum(state.capturedByWhite);
  const b = sum(state.capturedByBlack);
  return { white: w - b, black: b - w };
}

/** Recompute playing / check / mate / stalemate after board mutations (e.g. mercenary). */
export function recomputeChessStatus(g: ChessState): ChessState {
  const [wkr] = findKing(g, "white");
  const [bkr] = findKing(g, "black");
  if (wkr === -1) return { ...g, status: "checkmate", turn: "black" };
  if (bkr === -1) return { ...g, status: "checkmate", turn: "white" };
  const nextTurn = g.turn;
  const nextHasMove = hasAnyLegalMove(g, nextTurn);
  let status: GameStatus = g.status;
  if (!nextHasMove)
    status = isInCheck(g, nextTurn) ? "checkmate" : "stalemate";
  else if (isInCheck(g, nextTurn)) status = "check";
  else status = "playing";
  return { ...g, status };
}

/** @deprecated Engine no longer mutates a standalone Board — use syncStateFromBoard after cloneBoard(getDerivedBoard(state)). */
export function applyMoveToBoard(
  board: Board,
  enPassantTarget: [number, number] | null,
  from: [number, number],
  to: [number, number],
  promotion?: PieceType,
): Board {
  const st = boardToMinimalState(board);
  const next = applyMoveToState(st, enPassantTarget, from, to, promotion);
  return getDerivedBoard(next);
}
