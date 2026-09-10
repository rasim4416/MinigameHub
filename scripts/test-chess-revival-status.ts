import assert from "node:assert/strict";
import {
  completeBoardSpellTurn, createInitialState, create2v2InitialState,
  getDerivedBoard, syncStateFromBoard, isInCheck, type Board, type ChessState,
} from "../client/src/components/minigames/Chess/engine";

function blank(state = createInitialState()) {
  return syncStateFromBoard(state, getDerivedBoard(state).map(row => row.map(() => null)));
}
function cast(state: ChessState, board: Board, row: number, col: number) {
  return completeBoardSpellTurn(state, board, {
    from: [row, col], to: [row, col], piece: board[row][col]!, captured: null,
  });
}
let state = blank();
let board = getDerivedBoard(state);
board[7][7] = { type: "K", color: "white", id: "wk" };
board[0][0] = { type: "K", color: "black", id: "bk" };
state = syncStateFromBoard(state, board);
board[7][0] = { type: "R", color: "white", id: "revived-rook" };
let result = cast(state, board, 7, 0);
assert.equal(result.turn, "black");
assert.equal(result.status, "check", "a revived checking piece updates the opponent's status");
assert.equal(result.moveHistory.length, 1);

state = blank();
board = getDerivedBoard(state);
board[7][0] = { type: "K", color: "white", id: "wk" };
board[0][7] = { type: "K", color: "black", id: "bk" };
board[7][7] = { type: "R", color: "black", id: "br" };
state = syncStateFromBoard({ ...state, status: "check" }, board);
assert.ok(isInCheck(state, "white"));
board[7][3] = { type: "B", color: "white", id: "revived-bishop" };
result = cast(state, board, 7, 3);
assert.equal(result.status, "playing", "blocking check does not carry stale check to the opponent");

state = blank();
board = getDerivedBoard(state);
board[2][2] = { type: "K", color: "white", id: "wk" };
board[0][0] = { type: "K", color: "black", id: "bk" };
state = syncStateFromBoard(state, board);
board[1][1] = { type: "Q", color: "white", id: "revived-queen" };
result = cast(state, board, 1, 1);
assert.equal(result.status, "checkmate", "post-spell mate is detected");

state = blank(create2v2InitialState());
board = getDerivedBoard(state);
board[2][2] = { type: "K", color: "white", slot: "white1", id: "w1k" };
board[7][12] = { type: "K", color: "white", slot: "white2", id: "w2k" };
board[0][0] = { type: "K", color: "black", slot: "black1", id: "b1k" };
board[0][12] = { type: "K", color: "black", slot: "black2", id: "b2k" };
state = syncStateFromBoard(state, board);
board[1][1] = { type: "Q", color: "white", slot: "white1", id: "revived-queen" };
result = cast(state, board, 1, 1);
assert.ok(result.eliminatedSlots?.includes("black1"), "mated next slot is eliminated");
assert.equal(result.turnSlot, "white2", "play advances to the next surviving teammate");
console.log("PASS: revival check, escape, mate, history, and 2v2 slot resolution");