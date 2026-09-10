import assert from "node:assert/strict";
import {
  cloneBoard,
  createInitialState,
  getDerivedBoard,
  getLegalMoves,
  syncStateFromBoard,
  type ChessState,
} from "../client/src/components/minigames/Chess/engine";
import { AUGMENT_POOL, type Augment } from "../client/src/components/minigames/Chess/augments";
import { buildBotMoveContext } from "../client/src/components/minigames/Chess/chessBot/legalMoves";
import { pickAugmentForBot } from "../client/src/components/minigames/Chess/chessBot/pickAugment";
import { pickShopBuy } from "../client/src/components/minigames/Chess/chessBot/pickShopBuy";
import { previewSpell } from "../client/src/components/minigames/Chess/chessBot/spellPreview";
import {
  enumerateBlessedWaterTargets,
  enumerateNecromancerPlusPlusTargets,
  enumerateNecromancerPlusTargets,
  enumerateNecromancerTargets,
  enumeratePuppetTargets,
} from "../client/src/components/minigames/Chess/chessBot/spellTargets";
import type { BotSpellContext } from "../client/src/components/minigames/Chess/chessBot/types";

const aug = (id: string): Augment => {
  const found = AUGMENT_POOL.find((candidate) => candidate.id === id);
  assert.ok(found, `missing augment fixture: ${id}`);
  return found;
};

function gameWith(
  edit: (board: ReturnType<typeof getDerivedBoard>) => void,
): ChessState {
  const base = { ...createInitialState(), turn: "black" as const };
  const board = cloneBoard(getDerivedBoard(base));
  edit(board);
  return syncStateFromBoard(base, board);
}

function spellContext(
  overrides: Partial<BotSpellContext> = {},
): BotSpellContext {
  return {
    ...buildBotMoveContext({
      wallSquares: [],
      blessedSquares: [],
      coldWindsSquares: [],
      coldWindsMovesLeft: 0,
      frozenSquare: null,
      activePuppetSquare: null,
      activePuppetColor: null,
      blackAugments: [],
      blackAugmentLevels: {},
    }),
    blackFreezeCharges: 0,
    blackBlessedWaterCharges: 0,
    blackAugments: [],
    blackAugmentLevels: {},
    augmentSpellBlockedFor: null,
    monolithPlaceAvailable: false,
    contractAvailable: false,
    blackContractPieceId: null,
    puppetAvailable: false,
    deathNoteAvailable: false,
    ...overrides,
  };
}

{
  const game = gameWith((board) => {
    board[1]![3] = null;
  });
  const ctx = spellContext({
    blackAugments: [aug("necromancer")],
    blackNecroCharges: 1,
    blackLostPawnCols: [3, 3, -1, 9],
  });
  assert.deepEqual(enumerateNecromancerTargets(game, ctx), [[1, 3]]);
  assert.deepEqual(enumerateNecromancerTargets(game, { ...ctx, blackNecroCharges: 0 }), []);
  const preview = previewSpell("necromancer", game, ctx, [1, 3]);
  assert.equal(preview?.sideToMove, "white", "revival consumes the bot turn");
  assert.equal(getDerivedBoard(preview!.game)[1]?.[3]?.type, "P");
}

{
  const game = gameWith((board) => {
    board[0]![1] = null;
  });
  const ctx = spellContext({
    blackAugments: [aug("necromancer-plus")],
    blackNecroPlusCharges: 1,
    blackLostMinors: ["B", "N"],
  });
  assert.deepEqual(enumerateNecromancerPlusTargets(game, ctx), [[0, 1]]);
  const preview = previewSpell("necromancer-plus", game, ctx, [0, 1]);
  assert.equal(getDerivedBoard(preview!.game)[0]?.[1]?.type, "N");
}

{
  const game = gameWith((board) => {
    board[0]![3] = null;
  });
  const ctx = spellContext({
    blackAugments: [aug("necromancer-plus-plus")],
    blackNecroPPCharges: 1,
  });
  assert.deepEqual(enumerateNecromancerPlusPlusTargets(game, ctx), [[0, 3]]);
  assert.equal(
    getDerivedBoard(previewSpell("necromancer-plus-plus", game, ctx, [0, 3])!.game)[0]?.[3]
      ?.type,
    "Q",
  );
}

{
  const game = gameWith(() => {});
  const ctx = spellContext({
    blackAugments: [aug("blessed-water-spell")],
    blackBlessedWaterCharges: 1,
    puppetAvailable: true,
  });
  const blessed = enumerateBlessedWaterTargets(game, ctx);
  assert.ok(blessed.length > 0);
  for (const [r, c] of blessed) {
    const piece = getDerivedBoard(game)[r]?.[c];
    assert.equal(piece?.color, "black");
    assert.notEqual(piece?.type, "K");
  }
  const puppet = enumeratePuppetTargets(game, ctx);
  assert.ok(puppet.length > 0);
  for (const [r, c] of puppet) {
    const piece = getDerivedBoard(game)[r]?.[c];
    assert.notEqual(piece?.type, "K");
    assert.ok(getLegalMoves({ ...game, turn: "white" }, r, c).length > 0);
  }
}

{
  assert.equal(
    pickAugmentForBot([aug("bloodbending"), aug("death-note")], []),
    aug("death-note"),
    "bot must not select an active it cannot execute",
  );
  assert.equal(
    pickAugmentForBot([aug("necromancer-plus-plus")], []),
    null,
    "prerequisite-locked upgrades are never selected",
  );
  assert.equal(
    pickAugmentForBot(
      [aug("necromancer-plus"), aug("frost")],
      [aug("necromancer")],
    )?.id,
    "necromancer-plus",
    "a usable prerequisite upgrade beats a lower tier alternative",
  );
}

{
  const result = pickShopBuy({
    goldBlack: 50,
    blackTierBought: {
      common: 0,
      uncommon: 0,
      rare: 1,
      epic: 0,
      legendary: 0,
    },
    blackAugments: [],
    blackAugmentLevels: {},
    position: {
      materialCp: 0,
      evalCp: 0,
      scoreCp: 0,
      isAttacking: true,
      isAdvantaged: false,
      isDisadvantaged: false,
    },
  });
  assert.ok(result);
  assert.ok(result.cost <= 28, "shop pick must respect reserved-gold budget");
}

console.log("chess bot regression tests passed");