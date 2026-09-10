import assert from "node:assert/strict";
import type { Board, ChessState, Piece } from "../client/src/components/minigames/Chess/engine";
import { diffChessBoard } from "../client/src/components/minigames/Chess/ui/chess-effects-diff";

const piece = (type: Piece["type"], color: Piece["color"], id: string): Piece => ({
  type,
  color,
  id,
});

const emptyBoard = (rows = 8, cols = rows): Board =>
  Array.from({ length: rows }, () => Array<Piece | null>(cols).fill(null));

const move = (overrides: Partial<NonNullable<ChessState["lastMove"]>>): ChessState["lastMove"] => ({
  from: [0, 0],
  to: [0, 1],
  piece: piece("P", "white", "w-p"),
  captured: null,
  ...overrides,
});

{
  const before = emptyBoard();
  const after = emptyBoard();
  before[6][0] = piece("P", "white", "w-p");
  after[4][0] = piece("P", "white", "w-p");
  assert.deepEqual(
    diffChessBoard(before, after, move({
      from: [6, 0],
      to: [4, 0],
      pieceId: "w-p",
    })),
    [],
    "an ordinary move must not look like a revival or removal",
  );
}

{
  const before = emptyBoard();
  const after = emptyBoard();
  before[4][0] = piece("P", "white", "w-p");
  before[3][1] = piece("N", "black", "b-n");
  after[3][1] = piece("P", "white", "w-p");
  assert.deepEqual(
    diffChessBoard(before, after, move({
      from: [4, 0],
      to: [3, 1],
      pieceId: "w-p",
      capturedPieceId: "b-n",
      captured: piece("N", "black", "b-n"),
    })),
    [{ kind: "remove", square: [3, 1], pieceId: "b-n" }],
    "a capture must remove the captured identity, not convert the mover",
  );
}

{
  const before = emptyBoard();
  const after = emptyBoard();
  after[5][3] = piece("N", "white", "revived-n");
  assert.deepEqual(
    diffChessBoard(before, after, move({
      from: [5, 3],
      to: [5, 3],
      piece: piece("N", "white", "revived-n"),
      pieceId: "revived-n",
    })),
    [{ kind: "revive", square: [5, 3], pieceId: "revived-n" }],
    "a genuinely new same-square piece must be announced as revived",
  );
}

{
  const before = emptyBoard();
  const after = emptyBoard();
  before[4][4] = piece("P", "black", "convertible");
  after[4][4] = piece("P", "white", "convertible");
  assert.deepEqual(
    diffChessBoard(before, after, move({
      from: [4, 4],
      to: [4, 4],
      piece: piece("P", "white", "convertible"),
      pieceId: "convertible",
    })),
    [{ kind: "convert", square: [4, 4], pieceId: "convertible" }],
    "a stable identity changing color must be announced as converted",
  );
}

{
  const before = emptyBoard();
  const after = emptyBoard();
  before[1][6] = piece("P", "white", "promoting-p");
  after[0][6] = piece("Q", "white", "promoting-p");
  assert.deepEqual(
    diffChessBoard(before, after, move({
      from: [1, 6],
      to: [0, 6],
      piece: piece("P", "white", "promoting-p"),
      pieceId: "promoting-p",
      promotion: "Q",
    })),
    [{ kind: "promote", square: [0, 6], pieceId: "promoting-p" }],
    "an identity-preserving pawn type change must be a promotion",
  );
}

{
  const before = emptyBoard(8, 8);
  const after = emptyBoard(10, 10);
  before[0][0] = piece("R", "black", "b-r");
  before[7][7] = piece("R", "white", "w-r");
  after[1][1] = piece("R", "black", "b-r");
  after[8][8] = piece("R", "white", "w-r");
  after[0][0] = piece("R", "black", "new-domain-r");
  after[0][9] = piece("R", "black", "new-domain-r-2");
  assert.deepEqual(
    diffChessBoard(before, after, move({
      from: [1, 1],
      to: [1, 2],
      pieceId: "b-r",
    })),
    [],
    "domain expansion must not emit coordinate-shift notices",
  );
}

console.log("chess-effects diff tests passed");