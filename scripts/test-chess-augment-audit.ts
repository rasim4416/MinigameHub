import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  AUGMENT_IMPROVEMENTS,
  AUGMENT_POOL,
  AUGMENT_PREREQUISITE,
  MAX_STACK,
  NON_PURCHASABLE,
  applyGuaranteedUpgradeSlot,
  getContractKillerMultiplier,
  getRollExcludeIds,
} from "../client/src/components/minigames/Chess/augments";

const ids = AUGMENT_POOL.map((augment) => augment.id);
const uniqueIds = new Set(ids);

assert.equal(uniqueIds.size, ids.length, "augment pool ids must be unique");
for (const id of ids) {
  assert.ok(id in MAX_STACK, `${id} must declare an explicit maximum stack`);
}
for (const id of Object.keys(AUGMENT_IMPROVEMENTS)) {
  assert.ok(uniqueIds.has(id), `improvement ${id} must belong to the pool`);
}
for (const [child, parent] of Object.entries(AUGMENT_PREREQUISITE)) {
  assert.ok(uniqueIds.has(child), `prerequisite child ${child} must be in pool`);
  assert.ok(parent && uniqueIds.has(parent), `prerequisite parent for ${child} must be in pool`);
}
for (const id of NON_PURCHASABLE) {
  assert.ok(uniqueIds.has(id), `non-purchasable ${id} must be in pool`);
}

const necromancer = AUGMENT_POOL.find((augment) => augment.id === "necromancer");
assert.ok(necromancer);
assert.ok(
  getRollExcludeIds([necromancer]).includes("necromancer-plus-plus"),
  "Necromancer++ remains locked until Necromancer+ is owned",
);
const necromancerPlus = AUGMENT_POOL.find(
  (augment) => augment.id === "necromancer-plus",
);
assert.ok(necromancerPlus);
assert.ok(
  !getRollExcludeIds([necromancer, necromancerPlus]).includes(
    "necromancer-plus-plus",
  ),
  "Necromancer++ unlocks after Necromancer+",
);
assert.equal(getContractKillerMultiplier(0), 3);
assert.equal(getContractKillerMultiplier(1), 5);
const mastermind = AUGMENT_POOL.find((augment) => augment.id === "mastermind");
const mastermindPlus = AUGMENT_POOL.find(
  (augment) => augment.id === "mastermind-plus",
);
const miner = AUGMENT_POOL.find((augment) => augment.id === "miner");
assert.ok(mastermind && mastermindPlus && miner);
const originalRandom = Math.random;
Math.random = () => 0;
try {
  const guaranteed = applyGuaranteedUpgradeSlot(
    [mastermindPlus, miner],
    [mastermind],
    [],
  );
  assert.deepEqual(
    guaranteed.map((augment) => augment.id),
    ["mastermind-plus", "miner"],
    "an already rolled guaranteed upgrade must not create a duplicate choice",
  );
} finally {
  Math.random = originalRandom;
}

const chessGame = await readFile(
  new URL("../client/src/components/minigames/Chess/ChessGame.tsx", import.meta.url),
  "utf8",
);
const snapshotSection = chessGame.slice(
  chessGame.indexOf("const applySnapshot"),
  chessGame.indexOf("// MP: initialize augment effects"),
);
assert.match(
  snapshotSection,
  /setFrozenTurnsLeft\(\s*\(g as \{ frozenTurnsLeft\?: number \}\)\.frozenTurnsLeft \?\? 0/,
  "online snapshots restore Frost's remaining duration",
);
assert.doesNotMatch(
  snapshotSection,
  /setWhiteAugmentLevels\(\{\}\)|setBlackAugmentLevels\(\{\}\)|setWhiteJewPawnLosses\(0\)|setBlackJewPawnLosses\(0\)/,
  "online snapshots must not erase received upgrade/Jew state",
);
assert.match(
  chessGame,
  /setWhiteAugments\(\(prev\) => prev\.filter\(\(a\) => a\.id !== "contract-killer"\)\)/,
  "a resolved white contract consumes its augment",
);
assert.match(
  chessGame,
  /setBlackAugments\(\(prev\) => prev\.filter\(\(a\) => a\.id !== "contract-killer"\)\)/,
  "a resolved black contract consumes its augment",
);
assert.match(
  chessGame,
  /if \(NON_PURCHASABLE\.has\(aug\.id\)\) return;/,
  "shop purchase handler rejects non-purchasable augments defensively",
);
assert.match(
  chessGame,
  /const \[necroPlusChoice, setNecroPlusChoice\]/,
  "Necromancer+ stores the selected minor-piece type",
);
assert.match(
  chessGame,
  /const pieceType =\s*necroPlusChoice \?\?/,
  "Necromancer+ revives the chosen type rather than the last loss",
);
assert.match(
  chessGame,
  /necroPlusMode \|\| botForcedSpell === "necromancer-plus"/,
  "bot spell targeting can activate Necromancer+ without a UI toggle",
);
assert.match(
  chessGame,
  /function isLegalRevivalPlacement[\s\S]*isInCheckForSlot/,
  "revival placement checks the active 2v2 slot king for check",
);
assert.match(
  chessGame,
  /function isActiveSlotFile[\s\S]*slotColRange/,
  "revival placement limits 2v2 targets to the active slot files",
);
assert.match(
  chessGame,
  /spellMove\?: \{[\s\S]*spellMove\.board/,
  "revivals enter the normal move lifecycle through a synthetic spell move",
);
assert.match(
  chessGame,
  /Events and timed effects resolve after the capture-time contract[\s\S]*whiteContractPieceId[\s\S]*blackContractPieceId/,
  "contracts are reconciled after timed and event removals",
);
const freeSpellBranch = chessGame.slice(
  chessGame.indexOf("const freeSpell ="),
  chessGame.indexOf("if (!freeSpell)"),
);
assert.ok(
  !freeSpellBranch.includes('"necromancer'),
  "revival consumes a turn and must not be repeated as a free spell",
);
const contextCall = chessGame.slice(chessGame.indexOf("const spellCtx = buildBotSpellContext"));
for (const field of ["blackNecroCharges", "blackLostPawnCols", "blackNecroPlusCharges", "blackLostMinors", "blackNecroPPCharges"]) {
  assert.ok(contextCall.slice(0, contextCall.indexOf("});")).includes(field), `bot context receives ${field}`);
}
assert.match(
  chessGame,
  /<ChessEffects[\s\S]*flipped=\{mpViewFlipped\}[\s\S]*whiteAugmentLevels=\{whiteAugmentLevels\}[\s\S]*blackAugmentLevels=\{blackAugmentLevels\}/,
  "board VFX receives display orientation and both improvement-level maps",
);

console.log(`Chess augment audit checks passed (${ids.length} pool augments).`);