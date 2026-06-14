import { useState, useEffect, useRef, useCallback, type CSSProperties } from "react";
import {
  ChessState,
  PieceType,
  Color,
  Board,
  PIECE_UNICODE,
  PIECE_VALUE,
  createInitialState,
  create2v2InitialState,
  getLegalMoves,
  makeMove,
  materialAdvantage,
  opp,
  cloneBoard,
  findKing,
  findKingForSlot,
  isInCheck,
  hasAnyLegalMove,
  setBoardSize,
  getDerivedBoard,
  getBoardRows,
  getBoardCols,
  is2v2Mode,
  isTeamRoundComplete,
  isPawnSpawnSquareForSlot,
  summonedPiece,
  slotToColor,
  syncStateFromBoard,
  normalizeChessState,
  castlingRightsAfterSwap,
  type Piece,
  type PlayerSlot,
} from "./engine";
import {
  BOARD_THEMES,
  type BoardThemeId,
  type BoardThemePalette,
} from "./boardThemes";
import { chessShell } from "./chessTheme";
import type { GamePhase, AugmentTrigger, TierBought, SpellState } from "./chessTypes";
import { useBoardDimensions } from "./hooks/useBoardDimensions";
import { BoardStage } from "./ui/BoardStage";
import { PlayerBar } from "./ui/PlayerBar";
import { ShopPanel } from "./ui/ShopPanel";
import { AugmentSelector } from "./ui/AugmentSelector";
import { StartScreen } from "./ui/StartScreen";
import {
  buildBotMoveContext,
  buildBotSpellContext,
  computeAuctionBid,
  decideBotAction,
  pickAuctionPlacement,
  pickAugmentForBot,
  pickShopBuy,
  assessPosition,
} from "./chessBot";
import {
  useTutorial,
  useTutorialRestrictions,
  useTutorialEmit,
} from "./tutorial/TutorialContext";
import {
  tutorialAllowsAugment,
  tutorialAllowsShopBuy,
  tutorialAllowsSpell,
  tutorialAllowsSquareSelect,
  tutorialBlocksBoard,
  tutorialFilterMoves,
  tutorialMatchMove,
} from "./tutorial/helpers";
import type { TutorialBridge } from "./tutorial/types";
import {
  applyLostMercenaryAfterFullMove,
  applyMercenaryPatrolAfterFullMove,
  isMercenaryPiece,
  isLostMercenaryPawn,
  spawnLostMercenaryOnBoard,
  spawnMercenaryPatrolKnights,
  spawnMercenarySiegePatrol,
  spawnMercenaryCrusaders,
} from "./mercenaryMoves";
import {
  Augment,
  type AugmentUpgradeLevels,
  AUGMENT_POOL,
  augmentExcludedByPrereq,
  augmentUnlockedForShop,
  canImproveAugment,
  getBlessedWaterMovesLeft,
  getBloodlustPickCount,
  getBloodlustThreshold,
  getContractKillerMultiplier,
  getDeathNoteTurnsLeft,
  getEfficientCaptureBonus,
  getFrostFreezeTurns,
  getImproveLevel,
  getIAmDangerGoldPerStack,
  getJewPawnCaptureGold,
  getKingOfTheHillGoldPerPiece,
  getMinerInterval,
  getNextImproveTier,
  getPawnShopPrice,
  getRoyalEducationMaxUses,
  getRollExcludeIds,
  getTaxManParams,
  getThiefProcRate,
  MAX_STACK,
  rollAugments,
  rollBonusAugments,
  rollBonusAugmentsFiltered,
  AUGMENT_IMPROVEMENTS,
  AUCTION_MIN_BID,
  AUCTION_PIECE_TYPES,
  type AuctionPieceType,
  RARITY_META,
  RarityWeights,
  getWeightsForPlayer,
  BASE_COST,
  getShopCost,
  NON_PURCHASABLE,
  ownsAugment,
  pickAugmentCount,
} from "./augments";
import {
  GameEvent,
  EVENT_RARITY_META,
  rollEvent,
  rollFullRoundsUntilNextEvent,
  rollFullRoundsUntilNextAuction,
  EVENT_POOL,
} from "./events";
import { AuctionPanel, type AuctionState } from "./ui/AuctionPanel";
import {
  getEventDescription,
  getEventFlavor,
  getEventName,
} from "../../../locales/chess";
import { useChessLanguage } from "./ChessLanguageContext";

function getExcludeForPlayer(augments: Augment[]): string[] {
  return getRollExcludeIds(augments);
}

/** Empty original pawn rank square for Pawn Shop / spawn rules (8×8 or expanded boards). */
function isOriginalPawnSpawnSquare(
  r: number,
  c: number,
  color: "white" | "black",
  boardSize: number,
): boolean {
  const off = (boardSize - 8) / 2;
  const pawnRow = color === "white" ? 6 + off : 1 + off;
  if (r !== pawnRow) return false;
  return c >= off && c < off + 8;
}

function isRookFileCol(c: number, boardSize: number): boolean {
  const off = (boardSize - 8) / 2;
  return c === off || c === off + 7;
}

/** White piece glyphs; orange mercenaries get a strong orange glow in SquareEl. */
function pieceGlyph(piece: Piece): string {
  if (piece.color === "orange") return PIECE_UNICODE.white[piece.type];
  return PIECE_UNICODE[piece.color][piece.type];
}

function pieceGlyphStyle(piece: Piece, size: number): CSSProperties {
  const base: CSSProperties = {
    fontSize: size * 0.72,
    lineHeight: 1,
    userSelect: "none",
    pointerEvents: "none",
    position: "relative",
    zIndex: 1,
  };
  if (piece.color === "orange") {
    return {
      ...base,
      color: "#ffffff",
      textShadow:
        "0 0 3px #fdba74, 0 0 7px #fb923c, 0 0 12px #f97316, 0 0 18px #ea580c, 0 0 24px rgba(234,88,12,0.9), 1px 1px 0 rgba(0,0,0,0.65)",
    };
  }
  return {
    ...base,
    color: piece.color === "white" ? "#ffffff" : "#1a0f00",
    textShadow:
      piece.color === "white"
        ? "0 0 3px #000,0 0 6px #000,1px 1px 0 #222"
        : "0 0 3px rgba(255,255,255,0.7),1px 1px 0 rgba(255,255,255,0.5)",
  };
}


function isPermaFrostSquare(state: ChessState, r: number, c: number): boolean {
  return (
    state.permaFrozenSquares?.some((s) => s.row === r && s.col === c) ?? false
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Milestones = { knight: boolean; bishop: boolean; rook: boolean };
type DeathNoteTarget = {
  pieceId: string;
  turnsLeft: number;
  targetColor: Color;
};

type AugmentSnapshot = {
  frozenSquare: [number, number] | null;
  frozenExpireAfter: Color | null;
  frozenTurnsLeft: number;
  whiteDomainUsed?: boolean;
  blackDomainUsed?: boolean;
  whiteAugmentLevels: AugmentUpgradeLevels;
  blackAugmentLevels: AugmentUpgradeLevels;
  whiteJewPawnLosses: number;
  blackJewPawnLosses: number;
  whiteRoyalEdUsesLeft: number;
  blackRoyalEdUsesLeft: number;
  deathNoteTargets: DeathNoteTarget[];
  activePuppetSquare: [number, number] | null;
  activePuppetColor: Color | null;
  whiteContractTarget: [number, number] | null;
  blackContractTarget: [number, number] | null;
  whiteContractPieceId: string | null;
  blackContractPieceId: string | null;
  whiteIlkkanId: string | null;
  blackIlkkanId: string | null;
  blessedSquares: { row: number; col: number; movesLeft: number }[];
  coldWindsSquares: [number, number][];
  coldWindsMovesLeft: number;
  wallSquares: { row: number; col: number }[];
  wallMovesLeft: number;
  activeNuke: { topRow: number; leftCol: number; movesLeft: number } | null;
  peaceTreatyRoundsLeft: number;
  whiteLostPawnCols: number[];
  blackLostPawnCols: number[];
  whiteCaptureCount: number;
  blackCaptureCount: number;
  whiteBloodlustNext: number;
  blackBloodlustNext: number;
  whiteLostMinors: PieceType[];
  blackLostMinors: PieceType[];
  nextEventTurn: number;
  chaosEventTiming: boolean;
  chaosPoolRestricted: boolean;
  whiteTaxVault: number;
  blackTaxVault: number;
  hillPawnTimers: { pieceId: string; fullRoundsLeft: number }[];
  prizeFirstCaptureOfGameDone: boolean;
  whiteBlindRageDone: boolean;
  blackBlindRageDone: boolean;
  whiteEvadeCharges: number;
  blackEvadeCharges: number;
  augmentSpellBlockedFor: Color | null;
  whitePawnShopBuys: number;
  blackPawnShopBuys: number;
  blindRagePickColor: Color | null;
  blindRageOffered: Augment[];
  whiteDoubleGoldFullRoundsLeft: number;
  blackDoubleGoldFullRoundsLeft: number;
  whiteBloodbendingCharges: number;
  blackBloodbendingCharges: number;
  whiteBloodbendingPlusCharges: number;
  blackBloodbendingPlusCharges: number;
  whiteNecroPPCharges: number;
  blackNecroPPCharges: number;
  whiteLittleBigManCharges: number;
  blackLittleBigManCharges: number;
};

const EMPTY_MILESTONES: Milestones = {
  knight: false,
  bishop: false,
  rook: false,
};
const EMPTY_TIER: TierBought = {
  common: 0,
  uncommon: 0,
  rare: 0,
  epic: 0,
  legendary: 0,
};
function getCenterSquares(bs: number): Set<string> {
  const mid = Math.floor(bs / 2);
  return new Set([
    `${mid},${mid - 1}`,
    `${mid - 1},${mid - 1}`,
    `${mid},${mid}`,
    `${mid - 1},${mid}`,
  ]);
}

/** Edge columns A/B/G/H and rows 1/2/7/8 (board-relative). */
function isApocalypseSquare(
  r: number,
  c: number,
  rows: number,
  cols: number,
): boolean {
  const edgeCol = c <= 1 || c >= cols - 2;
  const edgeRow = r <= 1 || r >= rows - 2;
  return edgeCol || edgeRow;
}

function clearAllNonKings(g: ChessState): ChessState {
  const nb = cloneBoard(getDerivedBoard(g));
  const rows = nb.length;
  const cols = nb[0]?.length ?? rows;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const p = nb[r][c];
      if (p && p.type !== "K") nb[r][c] = null;
    }
  return recomputeStatus(syncStateFromBoard({ ...g }, nb));
}

function removeAllQueens(g: ChessState): ChessState {
  const nb = cloneBoard(getDerivedBoard(g));
  const rows = nb.length;
  const cols = nb[0]?.length ?? rows;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (nb[r][c]?.type === "Q") nb[r][c] = null;
    }
  return recomputeStatus(syncStateFromBoard({ ...g }, nb));
}

function tickEmperorHillTimers(
  g: ChessState,
  prevTimers: { pieceId: string; fullRoundsLeft: number }[],
  whiteAugments: Augment[],
  blackAugments: Augment[],
): { state: ChessState; timers: { pieceId: string; fullRoundsLeft: number }[] } {
  const wEmperor = whiteAugments.some((a) => a.id === "emperor-of-the-hill");
  const bEmperor = blackAugments.some((a) => a.id === "emperor-of-the-hill");
  if (!wEmperor && !bEmperor) return { state: g, timers: [] };

  const nb = cloneBoard(getDerivedBoard(g));
  const bs = nb.length;
  const center = getCenterSquares(bs);
  const timerMap = new Map(prevTimers.map((t) => [t.pieceId, t.fullRoundsLeft]));
  const nextTimers: { pieceId: string; fullRoundsLeft: number }[] = [];

  for (let r = 0; r < bs; r++) {
    for (let c = 0; c < bs; c++) {
      const p = nb[r][c];
      if (!p || p.type !== "P" || !p.id) continue;
      const ownerEmperor =
        (p.color === "white" && wEmperor) || (p.color === "black" && bEmperor);
      if (!ownerEmperor) continue;
      if (!center.has(`${r},${c}`)) continue;

      let left = timerMap.get(p.id);
      if (left === undefined) left = 2;
      left -= 1;
      if (left <= 0) {
        nb[r][c] = { ...p, type: "Q" };
      } else {
        nextTimers.push({ pieceId: p.id, fullRoundsLeft: left });
      }
    }
  }
  return {
    state: recomputeStatus(syncStateFromBoard({ ...g }, nb)),
    timers: nextTimers,
  };
}

function flipRandomPawns(
  g: ChessState,
  countPerSide: number,
): ChessState {
  const nb = cloneBoard(getDerivedBoard(g));
  const rows = nb.length;
  const cols = nb[0]?.length ?? rows;
  const pick = (color: "white" | "black") => {
    const pawns: [number, number][] = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const p = nb[r][c];
        if (p?.type === "P" && p.color === color) pawns.push([r, c]);
      }
    for (let i = pawns.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pawns[i], pawns[j]] = [pawns[j], pawns[i]];
    }
    for (const [r, c] of pawns.slice(0, countPerSide)) {
      const p = nb[r][c]!;
      nb[r][c] = { ...p, color: color === "white" ? "black" : "white" };
    }
  };
  pick("white");
  pick("black");
  return recomputeStatus(syncStateFromBoard({ ...g }, nb));
}

function spawnTeaPartyPawns(
  g: ChessState,
  color: Color,
): ChessState {
  const nb = cloneBoard(getDerivedBoard(g));
  const rows = nb.length;
  const centerKeys = Array.from(getCenterSquares(rows));
  const candidates = centerKeys
    .map((k) => {
      const [rr, cc] = k.split(",").map(Number);
      return [rr, cc] as [number, number];
    })
    .filter(([rr, cc]) => !nb[rr]?.[cc])
    .sort((a, b) => (color === "white" ? b[0] - a[0] : a[0] - b[0]));
  let placed = 0;
  for (const [rr, cc] of candidates) {
    if (placed >= 2) break;
    nb[rr][cc] = { type: "P", color };
    placed++;
  }
  return syncStateFromBoard({ ...g }, nb);
}
const KNIGHT_OFFSETS: [number, number][] = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];

function findSquareByPieceId(
  board: Board,
  pieceId: string,
): [number, number] | null {
  for (let r = 0; r < board.length; r++)
    for (let c = 0; c < board[r].length; c++)
      if (board[r][c]?.id === pieceId) return [r, c];
  return null;
}

function normalizeDeathNoteTargets(raw: unknown): DeathNoteTarget[] {
  if (!Array.isArray(raw)) return [];
  const out: DeathNoteTarget[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const o = t as Record<string, unknown>;
    if (
      typeof o.pieceId === "string" &&
      typeof o.turnsLeft === "number" &&
      (o.targetColor === "white" || o.targetColor === "black")
    )
      out.push({
        pieceId: o.pieceId,
        turnsLeft: o.turnsLeft,
        targetColor: o.targetColor as Color,
      });
  }
  return out;
}

function checkNewMilestone(
  t: PieceType | null,
  ms: Milestones,
): PieceType | null {
  if (!t) return null;
  if (t === "N" && !ms.knight) return "N";
  if (t === "B" && !ms.bishop) return "B";
  if (t === "R" && !ms.rook) return "R";
  return null;
}
function applyMilestone(t: PieceType, ms: Milestones): Milestones {
  return {
    knight: t === "N" || ms.knight,
    bishop: t === "B" || ms.bishop,
    rook: t === "R" || ms.rook,
  };
}

// ─── Engine helpers ───────────────────────────────────────────────────────────

function findCheckingPiece(
  board: Board,
  kingColor: Color,
): [number, number] | null {
  if (kingColor === "orange") return null;
  const [kr, kc] = findKing(board, kingColor);
  if (kr === -1) return null;
  const bs = board.length;
  for (let r = 0; r < bs; r++)
    for (let c = 0; c < bs; c++) {
      const p = board[r][c];
      if (!p) continue;
      const isEnemy = p.color === opp(kingColor);
      const isOrangeMerc =
        p.color === "orange" &&
        typeof p.id === "string" &&
        p.id.includes("mercenary");
      if (isEnemy || isOrangeMerc) {
        const test = cloneBoard(board);
        test[r][c] = null;
        if (!isInCheck(test, kingColor)) return [r, c];
      }
    }
  return null;
}
function recomputeStatus(g: ChessState): ChessState {
  const [wkr] = findKing(g, "white");
  const [bkr] = findKing(g, "black");
  if (wkr === -1) return { ...g, status: "checkmate", turn: "black" };
  if (bkr === -1) return { ...g, status: "checkmate", turn: "white" };
  const nextTurn = g.turn;
  const nextHasMove = hasAnyLegalMove(g, nextTurn);
  let status = g.status;
  if (!nextHasMove)
    status = isInCheck(g, nextTurn) ? "checkmate" : "stalemate";
  else if (isInCheck(g, nextTurn)) status = "check";
  else status = "playing";
  return { ...g, status };
}

function applyEndOfTurnEffects(
  g: ChessState,
  color: Color,
  augments: Augment[],
  turn: number,
  whiteAugments: Augment[],
  blackAugments: Augment[],
  whiteDGRounds: number,
  blackDGRounds: number,
  levels: AugmentUpgradeLevels,
  taxVault?: TaxVaultCredit,
): ChessState {
  let delta = 0;
  const minerInterval = getMinerInterval(getImproveLevel(levels, "miner"));
  const kotHGold = getKingOfTheHillGoldPerPiece(
    getImproveLevel(levels, "king-of-the-hill"),
  );
  for (const aug of augments) {
    if (aug.id === "miner" && turn % minerInterval === 0) delta += 2;
    if (aug.id === "king-of-the-hill") {
      const cs = Array.from(getCenterSquares(getDerivedBoard(g).length));
      for (const key of cs) {
        const [r, c] = key.split(",").map(Number);
        if (getDerivedBoard(g)[r][c]?.color === color) delta += kotHGold;
      }
    }
  }
  const curGold = color === "white" ? g.goldWhite : g.goldBlack;
  const afterPassive = curGold + delta;
  let invExtra = 0;
  if (getImproveLevel(levels, "investment") < 1) {
    for (const _ of augments.filter((a) => a.id === "investment")) {
      if (afterPassive + invExtra > 20) invExtra += 1;
    }
  }
  delta += invExtra;
  if (!delta) return g;
  return creditGoldWithAugments(
    g,
    color,
    delta,
    whiteAugments,
    blackAugments,
    whiteDGRounds,
    blackDGRounds,
    taxVault,
  );
}

function applyInvestmentEndOfFullRound(
  g: ChessState,
  whiteAugments: Augment[],
  blackAugments: Augment[],
  whiteLevels: AugmentUpgradeLevels,
  blackLevels: AugmentUpgradeLevels,
  whiteDGRounds: number,
  blackDGRounds: number,
  whiteTaxVault?: TaxVaultCredit,
  blackTaxVault?: TaxVaultCredit,
): ChessState {
  let out = g;
  const applyFor = (color: Color) => {
    const levels = color === "white" ? whiteLevels : blackLevels;
    if (getImproveLevel(levels, "investment") < 1) return;
    const augs = color === "white" ? whiteAugments : blackAugments;
    const stacks = augs.filter((a) => a.id === "investment").length;
    if (stacks === 0) return;
    const gold = color === "white" ? out.goldWhite : out.goldBlack;
    const payout = Math.floor(gold / 10) * stacks;
    if (payout <= 0) return;
    out = creditGoldWithAugments(
      out,
      color,
      payout,
      whiteAugments,
      blackAugments,
      whiteDGRounds,
      blackDGRounds,
      color === "white" ? whiteTaxVault : blackTaxVault,
    );
  };
  applyFor("white");
  applyFor("black");
  return out;
}

function commitSpellHalfMove(
  g: ChessState,
  board: Board,
  movingColor: Color,
  lastMove: NonNullable<ChessState["lastMove"]>,
  newTurnCount: number,
  curWhiteTurns: number,
  curBlackTurns: number,
  whiteAugments: Augment[],
  blackAugments: Augment[],
  whiteDGRounds: number,
  blackDGRounds: number,
  levels: AugmentUpgradeLevels,
  taxVault?: TaxVaultCredit,
): ChessState {
  let newG = syncStateFromBoard(
    {
      ...g,
      turn: opp(movingColor),
      enPassantTarget: null,
      lastMove,
    },
    board,
  );
  newG = applyEndOfTurnEffects(
    newG,
    movingColor,
    movingColor === "white" ? whiteAugments : blackAugments,
    newTurnCount,
    whiteAugments,
    blackAugments,
    whiteDGRounds,
    blackDGRounds,
    levels,
    taxVault,
  );
  return recomputeStatus(
    expireLittleBigManAfterHalfMove(
      newG,
      movingColor,
      newTurnCount,
      curWhiteTurns,
      curBlackTurns,
    ),
  );
}

function getAlternativeMoves(
  game: ChessState,
  r: number,
  c: number,
): [number, number][] {
  const piece = getDerivedBoard(game)[r][c];
  const bs = getDerivedBoard(game).length;
  const off = (bs - 8) / 2;
  if (!piece || piece.type !== "P" || (c !== 0 && c !== bs - 1)) return [];
  if (piece.color === "white") {
    const sr = 6 + off;
    if (r !== sr) return [];
    if (getDerivedBoard(game)[sr - 1][c] || getDerivedBoard(game)[sr - 2][c] || getDerivedBoard(game)[sr - 3][c])
      return [];
    return [[sr - 3, c]];
  } else {
    const sr = 1 + off;
    if (r !== sr) return [];
    if (getDerivedBoard(game)[sr + 1][c] || getDerivedBoard(game)[sr + 2][c] || getDerivedBoard(game)[sr + 3][c])
      return [];
    return [[sr + 3, c]];
  }
}

/** Alternative+: any pawn's first move may advance up to 3 squares if path clear. */
function getAlternativePlusMoves(
  game: ChessState,
  r: number,
  c: number,
): [number, number][] {
  const piece = getDerivedBoard(game)[r][c];
  const bs = getDerivedBoard(game).length;
  const off = (bs - 8) / 2;
  if (!piece || piece.type !== "P" || piece.color === "orange") return [];
  const dir = piece.color === "white" ? -1 : 1;
  const startRow = piece.color === "white" ? 6 + off : 1 + off;
  if (r !== startRow) return [];
  const out: [number, number][] = [];
  for (let step = 1; step <= 3; step++) {
    const tr = r + dir * step;
    if (tr < 0 || tr >= bs) break;
    if (getDerivedBoard(game)[tr][c]) break;
    out.push([tr, c]);
  }
  return out;
}

/** Horde augment — the owner's pawns each try one forward step into an empty square. */
function applyHordeEffect(g: ChessState, owner: "white" | "black"): ChessState {
  const nb = cloneBoard(getDerivedBoard(g));
  const n = nb.length;
  // Scan from back rank toward front so a pawn is never stepped twice in one pass.
  for (let r = n - 1; r >= 0; r--)
    for (let c = 0; c < n; c++) {
      const p = nb[r][c];
      if (!p || p.type !== "P" || p.color !== owner) continue;
      const dir = p.color === "white" ? -1 : 1;
      const tr = r + dir;
      if (tr < 0 || tr >= n) continue;
      if (nb[tr][c]) continue;
      const moved = nb[r][c]!;
      nb[r][c] = null;
      nb[tr][c] = moved;
    }
  return recomputeStatus(syncStateFromBoard({ ...g }, nb));
}

type TaxVaultCredit = {
  hasTallPolitician: boolean;
  onVaultDeposit?: (color: "white" | "black", amount: number) => void;
};

/** Add gold to one side; positive amounts respect Double Gold rounds + stacks. */
function creditGoldWithAugments(
  g: ChessState,
  beneficiary: "white" | "black",
  delta: number,
  whiteAugments: Augment[],
  blackAugments: Augment[],
  whiteDGRounds: number,
  blackDGRounds: number,
  taxVault?: TaxVaultCredit,
): ChessState {
  if (delta === 0) return g;
  const augs = beneficiary === "white" ? whiteAugments : blackAugments;
  const rounds = beneficiary === "white" ? whiteDGRounds : blackDGRounds;
  let adj =
    delta > 0
      ? applyDoubleGoldToPositiveDelta(beneficiary, delta, augs, rounds)
      : delta;
  if (adj > 0 && taxVault?.hasTallPolitician && taxVault.onVaultDeposit) {
    const vaultAmt = Math.floor(adj * 0.8);
    const walletAmt = adj - vaultAmt;
    taxVault.onVaultDeposit(beneficiary, vaultAmt);
    adj = walletAmt;
  }
  return {
    ...g,
    goldWhite: beneficiary === "white" ? g.goldWhite + adj : g.goldWhite,
    goldBlack: beneficiary === "black" ? g.goldBlack + adj : g.goldBlack,
  };
}

/** After any half-move, clear Little Big Man if its 4 full-round timer has elapsed. */
function expireLittleBigManAfterHalfMove(
  g: ChessState,
  movingColor: Color,
  newTurnCount: number,
  curWhiteTurns: number,
  curBlackTurns: number,
): ChessState {
  const nextWT = movingColor === "white" ? newTurnCount : curWhiteTurns;
  const nextBT = movingColor === "black" ? newTurnCount : curBlackTurns;
  const fullR = Math.min(nextWT, nextBT);
  let out = g;
  if (
    out.littleBigManWhiteExpiresAtFullRound != null &&
    fullR >= out.littleBigManWhiteExpiresAtFullRound
  )
    out = {
      ...out,
      littleBigManWhiteId: null,
      littleBigManWhiteExpiresAtFullRound: null,
    };
  if (
    out.littleBigManBlackExpiresAtFullRound != null &&
    fullR >= out.littleBigManBlackExpiresAtFullRound
  )
    out = {
      ...out,
      littleBigManBlackId: null,
      littleBigManBlackExpiresAtFullRound: null,
    };
  return out;
}

function applyDoubleGoldToPositiveDelta(
  color: "white" | "black",
  delta: number,
  augments: Augment[],
  roundsLeft: number,
): number {
  if (delta <= 0 || roundsLeft <= 0) return delta;
  if (!augments.some((a) => a.id === "double-gold")) return delta;
  return delta * 2;
}

function getRoyalEdMoves(
  game: ChessState,
  color: Color,
): { kingPos: [number, number]; dests: [number, number][] } {
  const [kr, kc] = findKing(game, color);
  if (kr === -1) return { kingPos: [-1, -1], dests: [] };
  const dests: [number, number][] = [];
  const bs = getDerivedBoard(game).length;
  for (const [dr, dc] of KNIGHT_OFFSETS) {
    const nr = kr + dr,
      nc = kc + dc;
    if (nr < 0 || nr >= bs || nc < 0 || nc >= bs) continue;
    const db = getDerivedBoard(game);
    if (db[nr][nc]?.color === color) continue;
    const test = cloneBoard(db);
    const k = db[kr][kc];
    test[kr][kc] = null;
    test[nr][nc] = k ? { ...k } : { type: "K", color };
    const testState = syncStateFromBoard({ ...game }, test);
    if (!isInCheck(testState, color)) dests.push([nr, nc]);
  }
  return { kingPos: [kr, kc], dests };
}

// ─── Legendary ability helpers ────────────────────────────────────────────────

const RAMPAGE_DIRS: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

/** All unoccupied squares on the entire board the piece can safely teleport to. */
function getSakoMoves(
  game: ChessState,
  from: [number, number],
  color: Color,
): [number, number][] {
  const piece = getDerivedBoard(game)[from[0]][from[1]];
  if (!piece) return [];
  const bs = getDerivedBoard(game).length;
  const result: [number, number][] = [];
  for (let r = 0; r < bs; r++)
    for (let c = 0; c < bs; c++) {
      if (getDerivedBoard(game)[r][c]) continue;
      if (r === from[0] && c === from[1]) continue;
      const nb = cloneBoard(getDerivedBoard(game));
      nb[from[0]][from[1]] = null;
      nb[r][c] = piece;
      if (!isInCheck(nb, color)) result.push([r, c]);
    }
  return result;
}

/** Destinations the king can rampage to (straight line, UP TO 4 sq, all pieces cleared up to dest). */
function getRoyalHouseholdDests(
  game: ChessState,
  color: Color,
): [number, number][] {
  const [kr, kc] = findKing(game, color);
  if (kr === -1) return [];
  const bs = getDerivedBoard(game).length;
  const dests: [number, number][] = [];
  for (const [dr, dc] of RAMPAGE_DIRS) {
    for (let s = 1; s <= 4; s++) {
      const nr = kr + dr * s,
        nc = kc + dc * s;
      if (nr < 0 || nr >= bs || nc < 0 || nc >= bs) break;
      const nb = cloneBoard(getDerivedBoard(game));
      nb[kr][kc] = null;
      for (let t = 1; t <= s; t++) nb[kr + dr * t][kc + dc * t] = null;
      const k = getDerivedBoard(game)[kr][kc];
      nb[nr][nc] = k ? { ...k } : { type: "K", color };
      if (!isInCheck(nb, color)) dests.push([nr, nc]);
    }
  }
  return dests;
}

// ─── Board expansion helpers ──────────────────────────────────────────────────

function expandGameBoard(g: ChessState, expander: Color): ChessState {
  const oldBoard = getDerivedBoard(g);
  const oldN = oldBoard.length;
  const newN = oldN + 2;
  const off = (newN - 8) / 2;
  const newBoard: Board = Array(newN)
    .fill(null)
    .map(() => Array(newN).fill(null));
  for (let r = 0; r < oldN; r++)
    for (let c = 0; c < oldN; c++)
      newBoard[r + 1][c + 1] = oldBoard[r][c];
  const backRow = expander === "white" ? 7 + off : off;
  newBoard[backRow][0] = { type: "R", color: expander };
  newBoard[backRow][newN - 1] = { type: "R", color: expander };

  return syncStateFromBoard(
    {
      ...g,
      castlingRights: {
        white: { kingside: false, queenside: false },
        black: { kingside: false, queenside: false },
      },
      enPassantTarget: g.enPassantTarget
        ? ([g.enPassantTarget[0] + 1, g.enPassantTarget[1] + 1] as [
            number,
            number,
          ])
        : null,
      lastMove: g.lastMove
        ? {
            ...g.lastMove,
            from: [g.lastMove.from[0] + 1, g.lastMove.from[1] + 1] as [
              number,
              number,
            ],
            to: [g.lastMove.to[0] + 1, g.lastMove.to[1] + 1] as [number, number],
          }
        : null,
    },
    newBoard,
  );
}

/** 2v2 Domain Expansion: pad 8×16 → 10×18 (x/r, 0/9) or 10×18 → 12×20 (y/s, -1/10). */
function expandGameBoard2v2(
  g: ChessState,
  expander: Color,
  tier: 1 | 2,
): ChessState {
  const oldBoard = getDerivedBoard(g);
  const oldRows = oldBoard.length;
  const oldCols = oldBoard[0]?.length ?? oldRows;
  const newRows = oldRows + 2;
  const newCols = oldCols + 2;
  const newBoard: Board = Array(newRows)
    .fill(null)
    .map(() => Array(newCols).fill(null));
  for (let r = 0; r < oldRows; r++)
    for (let c = 0; c < oldCols; c++)
      newBoard[r + 1][c + 1] = oldBoard[r][c];

  const rowOff = (newRows - 8) / 2;
  const backRow = expander === "white" ? 7 + rowOff : rowOff;
  const slot1: PlayerSlot = expander === "white" ? "white1" : "black1";
  const slot2: PlayerSlot = expander === "white" ? "white2" : "black2";
  newBoard[backRow][0] = summonedPiece("R", slot1, `dom-${slot1}-t${tier}`);
  newBoard[backRow][newCols - 1] = summonedPiece("R", slot2, `dom-${slot2}-t${tier}`);

  const allSlots: PlayerSlot[] = ["white1", "white2", "black1", "black2"];
  const castlingBySlot = Object.fromEntries(
    allSlots.map((s) => [s, { kingside: false, queenside: false }]),
  ) as ChessState["castlingBySlot"];

  return syncStateFromBoard(
    {
      ...g,
      castlingRights: {
        white: { kingside: false, queenside: false },
        black: { kingside: false, queenside: false },
      },
      castlingBySlot,
      enPassantTarget: g.enPassantTarget
        ? ([g.enPassantTarget[0] + 1, g.enPassantTarget[1] + 1] as [
            number,
            number,
          ])
        : null,
      lastMove: g.lastMove
        ? {
            ...g.lastMove,
            from: [g.lastMove.from[0] + 1, g.lastMove.from[1] + 1] as [
              number,
              number,
            ],
            to: [g.lastMove.to[0] + 1, g.lastMove.to[1] + 1] as [number, number],
          }
        : null,
    },
    newBoard,
  );
}

function getFileChar2v2(col: number, boardRows: number, cols: number): string {
  const colPad = Math.max(0, Math.floor((cols - 16) / 2));
  if (colPad >= 2) {
    if (col === 0) return "y";
    if (col === 1) return "x";
    if (col === cols - 2) return "r";
    if (col === cols - 1) return "s";
  } else if (colPad >= 1) {
    if (col === 0) return "x";
    if (col === cols - 1) return "r";
  }
  const innerCol = col - colPad;
  if (innerCol >= 0 && innerCol < 8) return String.fromCharCode(97 + innerCol);
  if (innerCol >= 8 && innerCol < 16) return String.fromCharCode(97 + (innerCol - 8));
  return "?";
}

function getRankLabel2v2(row: number, boardRows: number): string {
  const rowPad = Math.max(0, Math.floor((boardRows - 8) / 2));
  if (rowPad >= 2) {
    if (row === 0) return "-1";
    if (row === 1) return "0";
    if (row === boardRows - 2) return "9";
    if (row === boardRows - 1) return "10";
  } else if (rowPad >= 1) {
    if (row === 0) return "0";
    if (row === boardRows - 1) return "9";
  }
  const innerRow = row - rowPad;
  return String(8 - innerRow);
}

function getFileChar(col: number, boardSize: number, boardCols?: number): string {
  const cols = boardCols ?? boardSize;
  if (boardSize === 8 && cols === 16) {
    return getFileChar2v2(col, boardSize, cols);
  }
  if (cols === 16 && boardSize === 8) {
    return String.fromCharCode(97 + col);
  }
  if (boardSize === 8 && cols === 8) return String.fromCharCode(97 + col);
  if (boardSize === 8 && cols > 16) {
    return getFileChar2v2(col, boardSize, cols);
  }
  const off = (boardSize - 8) / 2;
  const innerRight = boardSize - 1 - off;
  if (boardSize >= 12) {
    if (col === off - 2) return "y";
    if (col === off - 1) return "x";
    if (col === innerRight + 1) return "i";
    if (col === innerRight + 2) return "j";
  } else {
    if (col === off - 1) return "x";
    if (col === innerRight + 1) return "i";
  }
  if (col >= off && col < off + 8)
    return String.fromCharCode(97 + (col - off));
  return "?";
}

function getRankLabel(row: number, boardRows: number, boardCols?: number): string {
  const cols = boardCols ?? boardRows;
  if (boardRows === 8 && cols === 16) return getRankLabel2v2(row, boardRows);
  if (boardRows === 8 && cols === 8) return String(8 - row);
  if (boardRows === 8 && cols > 16) return getRankLabel2v2(row, boardRows);
  if (boardRows > 8 && cols >= 16) return getRankLabel2v2(row, boardRows);
  const off = (boardRows - 8) / 2;
  return String(8 + off - row);
}

// ─── Board themes (local cosmetic) ───────────────────────────────────────────

// ─── SquareEl ─────────────────────────────────────────────────────────────────

function SquareEl({
  row,
  col,
  size,
  piece,
  isSelected,
  isValidMove,
  isLastMove,
  isCheckKing,
  isCenter,
  isFrozen,
  isPermaWinter = false,
  onClick,
  boardSize,
  boardCols: boardColsProp,
  showTeamSetMarker,
  deathNoteCount,
  isNuke,
  nukeMovesLeft,
  isApocalypse,
  isBlessed,
  isColdWind,
  contractMark,
  isWall,
  isPuppet,
  isIlkkan,
  isTutorialHighlight = false,
  viewFlipped,
  squarePalette,
}: {
  row: number;
  col: number;
  /** When true (black in online MP), rank/file labels sit on the rotated edges. */
  viewFlipped?: boolean;
  squarePalette: BoardThemePalette;
  size: number;
  piece: Piece | null;
  isSelected: boolean;
  isValidMove: boolean;
  isLastMove: boolean;
  isCheckKing: boolean;
  isCenter: boolean;
  isFrozen: boolean;
  isPermaWinter?: boolean;
  onClick: () => void;
  boardSize: number;
  boardCols?: number;
  showTeamSetMarker?: boolean;
  deathNoteCount?: number;
  isNuke?: boolean;
  nukeMovesLeft?: number;
  isApocalypse?: boolean;
  isBlessed?: boolean;
  isColdWind?: boolean;
  contractMark?: boolean;
  isWall?: boolean;
  isPuppet?: boolean;
  isIlkkan?: boolean;
  isTutorialHighlight?: boolean;
}) {
  const vf = !!viewFlipped;
  const boardCols = boardColsProp ?? boardSize;
  const boardRows = boardSize;
  const pal = squarePalette;
  const light = (row + col) % 2 === 0;
  let bg = light ? pal.light : pal.dark;
  if (isPermaWinter) bg = light ? "#dbeafe" : "#7dd3fc";
  else if (isCheckKing) bg = "#c82020";
  else if (isSelected) bg = light ? pal.selLight : pal.selDark;
  else if (isLastMove) bg = light ? pal.lastLight : pal.lastDark;
  const dot = size * 0.3,
    ring = size * 0.07;
  const isMonolith = piece?.type === "M";
  return (
    <div
      onClick={onClick}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "background-color 0.1s",
        boxShadow: isTutorialHighlight
          ? "inset 0 0 0 3px rgba(251,191,36,0.85), 0 0 12px rgba(251,191,36,0.45)"
          : undefined,
        overflow: "hidden",
      }}
    >
      {(vf ? col === boardCols - 1 : col === 0) && (
        <span
          style={{
            position: "absolute",
            top: 2,
            ...(vf ? { right: 3 } : { left: 3 }),
            fontSize: Math.max(9, size * 0.18),
            fontWeight: 700,
            color: light ? pal.dark : pal.light,
            userSelect: "none",
            lineHeight: 1,
          }}
        >
          {getRankLabel(row, boardRows, boardCols)}
        </span>
      )}
      {(vf ? row === 0 : row === boardRows - 1) && (
        <span
          style={{
            position: "absolute",
            ...(vf ? { top: 2 } : { bottom: 2 }),
            right: 3,
            fontSize: Math.max(9, size * 0.18),
            fontWeight: 700,
            color: light ? pal.dark : pal.light,
            userSelect: "none",
            lineHeight: 1,
          }}
        >
          {getFileChar(col, boardRows, boardCols)}
        </span>
      )}
      {showTeamSetMarker && (
        <div
          style={{
            position: "absolute",
            bottom: 3,
            left: 3,
            width: 7,
            height: 7,
            background: "#3b82f6",
            borderRadius: "50%",
            pointerEvents: "none",
            boxShadow: "0 0 4px rgba(59,130,246,0.9)",
            zIndex: 3,
          }}
        />
      )}
      {isCenter && (
        <div
          style={{
            position: "absolute",
            top: 3,
            right: 3,
            width: 5,
            height: 5,
            background: "rgba(234,179,8,0.6)",
            borderRadius: "50%",
            pointerEvents: "none",
            boxShadow: "0 0 3px rgba(234,179,8,0.8)",
          }}
        />
      )}
      {isFrozen && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(147,210,255,0.28)",
            border: "2px solid rgba(147,210,255,0.7)",
            boxShadow: "inset 0 0 8px rgba(147,210,255,0.5)",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
      )}
      {isApocalypse && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(220,38,38,0.22)",
            border: "2px solid rgba(220,38,38,0.75)",
            pointerEvents: "none",
            zIndex: 2,
            boxShadow: "inset 0 0 6px rgba(220,38,38,0.5)",
          }}
        />
      )}
      {isNuke && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(34,197,94,0.30)",
            border: "2px solid rgba(34,197,94,0.85)",
            pointerEvents: "none",
            zIndex: 2,
            boxShadow: "inset 0 0 6px rgba(34,197,94,0.6)",
          }}
        />
      )}
      {isNuke &&
        nukeMovesLeft !== undefined &&
        row === Math.floor(row) &&
        col === Math.floor(col) && (
          <div
            style={{
              position: "absolute",
              bottom: 2,
              left: 2,
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "#16a34a",
              border: "1px solid #4ade80",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 4,
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                fontSize: 8,
                fontWeight: 900,
                color: "white",
                lineHeight: 1,
              }}
            >
              {nukeMovesLeft}
            </span>
          </div>
        )}
      {isBlessed && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(250,204,21,0.20)",
            border: "2px solid rgba(250,204,21,0.80)",
            pointerEvents: "none",
            zIndex: 2,
            boxShadow: "inset 0 0 8px rgba(250,204,21,0.45)",
          }}
        />
      )}
      {isColdWind && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(147,210,255,0.22)",
            border: "2px solid rgba(147,210,255,0.80)",
            pointerEvents: "none",
            zIndex: 2,
            boxShadow: "inset 0 0 8px rgba(147,210,255,0.45)",
          }}
        />
      )}
      {contractMark && (
        <div
          style={{
            position: "absolute",
            top: 1,
            right: 2,
            fontSize: 10,
            lineHeight: 1,
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          🎯
        </div>
      )}
      {isPuppet && (
        <div
          style={{
            position: "absolute",
            top: 1,
            left: 2,
            fontSize: 10,
            lineHeight: 1,
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          🪆
        </div>
      )}
      {isWall && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#3d2b1f",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 6,
            borderRadius: 1,
          }}
        >
          <span
            style={{
              fontSize: Math.max(10, size * 0.55),
              lineHeight: 1,
              userSelect: "none",
            }}
          >
            🧱
          </span>
        </div>
      )}
      {deathNoteCount !== undefined && (
        <div
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#dc2626",
            border: "1px solid #fca5a5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3,
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontSize: 8,
              fontWeight: 900,
              color: "white",
              lineHeight: 1,
            }}
          >
            {deathNoteCount}
          </span>
        </div>
      )}
      {isValidMove && !piece && (
        <div
          style={{
            width: dot,
            height: dot,
            borderRadius: "50%",
            backgroundColor: "rgba(0,0,0,0.22)",
            pointerEvents: "none",
          }}
        />
      )}
      {isValidMove && piece && !isMonolith && (
        <div
          style={{
            position: "absolute",
            inset: ring,
            borderRadius: "50%",
            border: `${Math.max(3, size * 0.07)}px solid rgba(0,0,0,0.28)`,
            pointerEvents: "none",
          }}
        />
      )}
      {isMonolith && (
        <div
          style={{
            width: size * 0.72,
            height: size * 0.72,
            background: "linear-gradient(145deg,#475569,#1e293b)",
            border: "2px solid #64748b",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow:
              "0 3px 10px rgba(0,0,0,0.7),inset 0 1px 0 rgba(255,255,255,0.1)",
            pointerEvents: "none",
            position: "relative",
            zIndex: 1,
          }}
        >
          <span
            style={{ fontSize: size * 0.38, lineHeight: 1, userSelect: "none" }}
          >
            🗿
          </span>
        </div>
      )}
      {piece &&
        !isMonolith &&
        (isIlkkan ? (
          <img
            src="/ilkkan.jpeg"
            alt="İlkkan"
            decoding="async"
            fetchPriority="high"
            style={{
              width: size * 0.78,
              height: size * 0.78,
              objectFit: "cover",
              borderRadius: "50%",
              pointerEvents: "none",
              position: "relative",
              zIndex: 1,
              boxShadow:
                piece.color === "white"
                  ? "0 0 0 2px #fff,0 0 6px #000"
                  : "0 0 0 2px #1a0f00,0 0 6px rgba(255,255,255,0.5)",
            }}
          />
        ) : (
          <span style={pieceGlyphStyle(piece, size)}>{pieceGlyph(piece)}</span>
        ))}
    </div>
  );
}

// ─── EventAnnouncement ────────────────────────────────────────────────────────

function EventAnnouncement({
  event,
  peaceTreatyLeft,
  onClose,
}: {
  event: GameEvent;
  peaceTreatyLeft: number;
  onClose: () => void;
}) {
  const lang = useChessLanguage();
  const meta = EVENT_RARITY_META[event.rarity];
  const eventName = getEventName(event.id, lang);
  const eventDescription = getEventDescription(event.id, lang);
  const eventFlavor = getEventFlavor(event.id, lang);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 30,
      }}
    >
      <div
        style={{
          background: "#0f172a",
          border: `2px solid ${meta.border}`,
          borderRadius: 16,
          padding: "28px 36px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          boxShadow: `0 0 40px ${meta.glow}, 0 8px 40px rgba(0,0,0,0.8)`,
          minWidth: 300,
          maxWidth: 420,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: meta.text,
            background: meta.badge,
            padding: "3px 12px",
            borderRadius: 20,
            border: `1px solid ${meta.border}`,
          }}
        >
          ⚡ EVENT · {meta.label}
        </div>
        <div style={{ fontSize: 36, lineHeight: 1, marginTop: 4 }}>
          {event.icon}
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: "#f1f5f9",
            letterSpacing: "0.02em",
          }}
        >
          {eventName}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#94a3b8",
            lineHeight: 1.5,
            maxWidth: 300,
          }}
        >
          {eventDescription}
        </div>
        {event.id === "peace-treaty" && peaceTreatyLeft > 0 && (
          <div style={{ fontSize: 11, color: "#64748b", fontStyle: "italic" }}>
            ({peaceTreatyLeft} rounds remaining)
          </div>
        )}
        {eventFlavor && (
          <div
            style={{
              fontSize: 12,
              color: meta.text,
              fontStyle: "italic",
              marginTop: 2,
              opacity: 0.85,
            }}
          >
            {eventFlavor}
          </div>
        )}
        <button
          onClick={onClose}
          style={{
            marginTop: 8,
            padding: "9px 32px",
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            background: `linear-gradient(135deg,${meta.border},${meta.text})`,
            color: "#0f172a",
            letterSpacing: "0.04em",
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// ─── PromotionDialog ──────────────────────────────────────────────────────────

function PromotionDialog({
  color,
  onChoose,
}: {
  color: Color;
  onChoose: (t: PieceType) => void;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 50,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#1f2937",
          border: "1px solid #374151",
          borderRadius: 14,
          padding: "18px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
        }}
      >
        <p
          style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 14, margin: 0 }}
        >
          Promote Pawn
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          {(["Q", "R", "B", "N"] as PieceType[]).map((t) => (
            <button
              key={t}
              onClick={() => onChoose(t)}
              style={{
                width: 56,
                height: 56,
                borderRadius: 10,
                background: "#111827",
                border: "2px solid #4b5563",
                cursor: "pointer",
                fontSize: 32,
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: color === "white" ? "#ffffff" : "#1a0f00",
                textShadow:
                  color === "white"
                    ? "0 0 3px #000,0 0 6px #000"
                    : "0 0 3px rgba(255,255,255,0.7)",
                transition: "border-color 0.15s,background 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "#6366f1";
                (e.currentTarget as HTMLElement).style.background = "#1e1b4b";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "#4b5563";
                (e.currentTarget as HTMLElement).style.background = "#111827";
              }}
            >
              {PIECE_UNICODE[color][t]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


// ─── Main component ───────────────────────────────────────────────────────────

export interface MpConfig {
  myColor: Color;
  mySlot?: PlayerSlot;
  gameMode?: "standard" | "2v2";
  initialWhiteAugment?: Augment;
  initialBlackAugment?: Augment;
  onSnapshot: (snap: Record<string, unknown>) => void;
  incomingSnapshot: Record<string, unknown> | null;
  opponentLeft: boolean;
  /** True while the WebSocket is down and the client is attempting to resume the session. */
  connectionLost?: boolean;
}

export default function ChessGame({
  mpConfig,
  tutorialMode = false,
  botMode = false,
}: { mpConfig?: MpConfig; tutorialMode?: boolean; botMode?: boolean } = {}) {
  const lang = useChessLanguage();
  const is2v2 =
    mpConfig?.gameMode === "2v2" ||
    false;
  const boardStageRef = useRef<HTMLDivElement>(null);
  const [boardThemeId, setBoardThemeId] = useState<BoardThemeId>("classic");
  const boardPalette = BOARD_THEMES[boardThemeId].palette;

  const [game, setGame] = useState<ChessState>(() =>
    is2v2 ? create2v2InitialState() : createInitialState(),
  );

  useEffect(() => {
    const rows = game.occupancy.length;
    const cols = game.occupancy[0]?.length ?? rows;
    const n = Math.max(rows, cols);
    if (n >= 8 && n <= 16) setBoardSize(n);
  }, [game.occupancy.length, game.occupancy[0]?.length]);

  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [validMoves, setValidMoves] = useState<[number, number][]>([]);
  const [promotionPending, setPromotionPending] = useState<{
    from: [number, number];
    to: [number, number];
  } | null>(null);

  const [phase, setPhase] = useState<GamePhase>(
    tutorialMode || mpConfig ? "playing" : "start",
  );
  const tutorialRestrictions = useTutorialRestrictions();
  const tutorialEmit = useTutorialEmit();
  const { registerBridge: registerTutorialBridge } = useTutorial();
  const executeMoveRef = useRef<
    (
      from: [number, number],
      to: [number, number],
      promotion?: PieceType,
      capturedType?: PieceType | null,
    ) => void
  >(() => {});
  const [botThinking, setBotThinking] = useState(false);
  const botBusyRef = useRef(false);
  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);
  const [offeredToWhite, setOfferedToWhite] = useState<Augment[]>([]);
  const [offeredToBlack, setOfferedToBlack] = useState<Augment[]>([]);
  const [whiteAugments, setWhiteAugments] = useState<Augment[]>(
    mpConfig?.initialWhiteAugment ? [mpConfig.initialWhiteAugment] : [],
  );
  const [blackAugments, setBlackAugments] = useState<Augment[]>(
    mpConfig?.initialBlackAugment ? [mpConfig.initialBlackAugment] : [],
  );
  const [mpReady, setMpReady] = useState(!mpConfig || is2v2);

  useEffect(() => {
    const hasIlkkan =
      whiteAugments.some((a) => a.id === "ilkkan") ||
      blackAugments.some((a) => a.id === "ilkkan");
    if (!hasIlkkan) return;
    const img = new Image();
    img.src = "/ilkkan.jpeg";
  }, [whiteAugments, blackAugments]);

  const [augmentQueue, setAugmentQueue] = useState<AugmentTrigger[]>([]);
  const [currentTrigger, setCurrentTrigger] = useState<AugmentTrigger | null>(
    null,
  );
  const [midGameOffered, setMidGameOffered] = useState<Augment[]>([]);
  const [blindRagePickColor, setBlindRagePickColor] = useState<Color | null>(
    null,
  );
  const [blindRageOffered, setBlindRageOffered] = useState<Augment[]>([]);

  const [whiteMilestones, setWhiteMilestones] =
    useState<Milestones>(EMPTY_MILESTONES);
  const [blackMilestones, setBlackMilestones] =
    useState<Milestones>(EMPTY_MILESTONES);

  const [gameHistory, setGameHistory] = useState<ChessState[]>([]);
  const [augmentHistory, setAugmentHistory] = useState<AugmentSnapshot[]>([]);
  const [whiteUndosLeft, setWhiteUndosLeft] = useState(0);
  const [blackUndosLeft, setBlackUndosLeft] = useState(0);

  const [whiteTurnCount, setWhiteTurnCount] = useState(0);
  const [blackTurnCount, setBlackTurnCount] = useState(0);

  // Frost
  const [whiteFreezeCharges, setWhiteFreezeCharges] = useState(0);
  const [blackFreezeCharges, setBlackFreezeCharges] = useState(0);
  const [frozenSquare, setFrozenSquare] = useState<[number, number] | null>(
    null,
  );
  const [frozenExpireAfter, setFrozenExpireAfter] = useState<Color | null>(
    null,
  );
  const [frozenTurnsLeft, setFrozenTurnsLeft] = useState(0);
  const [freezeMode, setFreezeMode] = useState(false);
  const [bloodbendingMode, setBloodbendingMode] = useState(false);
  const [bloodbendingPlusMode, setBloodbendingPlusMode] = useState(false);

  // Necromancer
  const [whiteNecroCharges, setWhiteNecroCharges] = useState(0);
  const [blackNecroCharges, setBlackNecroCharges] = useState(0);
  const [whiteLostPawnCols, setWhiteLostPawnCols] = useState<number[]>([]);
  const [blackLostPawnCols, setBlackLostPawnCols] = useState<number[]>([]);
  const [necroMode, setNecroMode] = useState(false);

  // Bloodlust
  const [whiteCaptureCount, setWhiteCaptureCount] = useState(0);
  const [blackCaptureCount, setBlackCaptureCount] = useState(0);
  const [whiteBloodlustNext, setWhiteBloodlustNext] = useState(4);
  const [blackBloodlustNext, setBlackBloodlustNext] = useState(4);

  // Internal Combustion
  const [whiteIcUsed, setWhiteIcUsed] = useState(false);
  const [blackIcUsed, setBlackIcUsed] = useState(false);

  // Royal Education
  const [whiteRoyalEdUsesLeft, setWhiteRoyalEdUsesLeft] = useState(0);
  const [blackRoyalEdUsesLeft, setBlackRoyalEdUsesLeft] = useState(0);
  const [royalEdMode, setRoyalEdMode] = useState(false);

  const [whiteAugmentLevels, setWhiteAugmentLevels] =
    useState<AugmentUpgradeLevels>({});
  const [blackAugmentLevels, setBlackAugmentLevels] =
    useState<AugmentUpgradeLevels>({});
  const [whiteJewPawnLosses, setWhiteJewPawnLosses] = useState(0);
  const [blackJewPawnLosses, setBlackJewPawnLosses] = useState(0);

  // What?
  const [whiteWhatUsed, setWhiteWhatUsed] = useState(false);
  const [blackWhatUsed, setBlackWhatUsed] = useState(false);
  const [whatMode, setWhatMode] = useState(false);
  const [whatSelected, setWhatSelected] = useState<[number, number] | null>(
    null,
  );

  // Şako Bosphorus
  const [whiteSakoUsed, setWhiteSakoUsed] = useState(false);
  const [blackSakoUsed, setBlackSakoUsed] = useState(false);
  const [sakoMode, setSakoMode] = useState(false);
  const [sakoSelected, setSakoSelected] = useState<[number, number] | null>(
    null,
  );

  const [whiteSwapUsed, setWhiteSwapUsed] = useState(false);
  const [blackSwapUsed, setBlackSwapUsed] = useState(false);
  const [swapMode, setSwapMode] = useState(false);
  const [swapFirst, setSwapFirst] = useState<[number, number] | null>(null);

  // Royal Household
  const [whiteRoyalHouseholdUsed, setWhiteRoyalHouseholdUsed] = useState(false);
  const [blackRoyalHouseholdUsed, setBlackRoyalHouseholdUsed] = useState(false);
  const [royalHouseholdMode, setRoyalHouseholdMode] = useState(false);

  // Death Note
  const [whiteDNUsed, setWhiteDNUsed] = useState(false);
  const [blackDNUsed, setBlackDNUsed] = useState(false);
  const [deathNoteMode, setDeathNoteMode] = useState(false);
  const [deathNoteTargets, setDeathNoteTargets] = useState<DeathNoteTarget[]>(
    [],
  );

  // Domain Expansion — each side may expand once (8→10→12)
  const [whiteDomainUsed, setWhiteDomainUsed] = useState(false);
  const [blackDomainUsed, setBlackDomainUsed] = useState(false);

  // Events
  const [nextEventTurn, setNextEventTurn] = useState(() =>
    rollFullRoundsUntilNextEvent(false),
  );
  const [pendingEvent, setPendingEvent] = useState<GameEvent | null>(null);
  const [peaceTreatyRoundsLeft, setPeaceTreatyRoundsLeft] = useState(0);
  const [activeNuke, setActiveNuke] = useState<{
    topRow: number;
    leftCol: number;
    movesLeft: number;
  } | null>(null);
  const [activeApocalypse, setActiveApocalypse] = useState<{
    fullRoundsLeft: number;
  } | null>(null);
  const [exhaustedEventIds, setExhaustedEventIds] = useState<string[]>([]);

  /** After "Just Chaos", board events fire every 2 full rounds. */
  const [chaosEventTiming, setChaosEventTiming] = useState(false);
  /** After "Just Chaos", common/uncommon events are excluded from the pool. */
  const [chaosPoolRestricted, setChaosPoolRestricted] = useState(false);

  const [whiteTaxVault, setWhiteTaxVault] = useState(0);
  const [blackTaxVault, setBlackTaxVault] = useState(0);
  const [taxStealBanner, setTaxStealBanner] = useState<string | null>(null);
  const [hillPawnTimers, setHillPawnTimers] = useState<
    { pieceId: string; fullRoundsLeft: number }[]
  >([]);

  const taxVaultCredit = useCallback(
    (color: "white" | "black", amount: number) => {
      if (color === "white") setWhiteTaxVault((v) => v + amount);
      else setBlackTaxVault((v) => v + amount);
    },
    [],
  );

  const taxVaultCtx = useCallback(
    (color: "white" | "black"): TaxVaultCredit => ({
      hasTallPolitician: (color === "white" ? whiteAugments : blackAugments).some(
        (a) => a.id === "tall-politician",
      ),
      onVaultDeposit: taxVaultCredit,
    }),
    [whiteAugments, blackAugments, taxVaultCredit],
  );

  // Mercenary auction (every 10–15 full rounds)
  const [nextAuctionTurn, setNextAuctionTurn] = useState(() =>
    rollFullRoundsUntilNextAuction(),
  );
  const [activeAuction, setActiveAuction] = useState<AuctionState | null>(null);
  const [auctionPlaceFor, setAuctionPlaceFor] = useState<{
    color: Color;
    pieceType: PieceType;
  } | null>(null);
  const [auctionAnnouncement, setAuctionAnnouncement] = useState<string | null>(
    null,
  );

  // Great Wall of Hatay (event)
  const [wallSquares, setWallSquares] = useState<
    { row: number; col: number }[]
  >([]);
  const [wallMovesLeft, setWallMovesLeft] = useState(0);

  // Puppet (augment)
  const [puppetMode, setPuppetMode] = useState(false);
  const [whitePuppetUsed, setWhitePuppetUsed] = useState(false);
  const [blackPuppetUsed, setBlackPuppetUsed] = useState(false);
  const [activePuppetSquare, setActivePuppetSquare] = useState<
    [number, number] | null
  >(null);
  const [activePuppetColor, setActivePuppetColor] = useState<Color | null>(
    null,
  );

  // Blessed squares (Blessed Waters event + Blessed Water Spell augment)
  const [blessedSquares, setBlessedSquares] = useState<
    { row: number; col: number; movesLeft: number }[]
  >([]);

  // Cold Winds (event)
  const [coldWindsSquares, setColdWindsSquares] = useState<[number, number][]>(
    [],
  );
  const [coldWindsMovesLeft, setColdWindsMovesLeft] = useState(0);

  // Contract Killer (augment)
  const [whiteContractTarget, setWhiteContractTarget] = useState<
    [number, number] | null
  >(null);
  const [blackContractTarget, setBlackContractTarget] = useState<
    [number, number] | null
  >(null);
  const [whiteContractPieceId, setWhiteContractPieceId] = useState<
    string | null
  >(null);
  const [blackContractPieceId, setBlackContractPieceId] = useState<
    string | null
  >(null);
  const [contractMode, setContractMode] = useState(false);

  // Necromancer+ (augment)
  const [whiteNecroPlusCharges, setWhiteNecroPlusCharges] = useState(0);
  const [blackNecroPlusCharges, setBlackNecroPlusCharges] = useState(0);
  const [whiteLostMinors, setWhiteLostMinors] = useState<PieceType[]>([]);
  const [blackLostMinors, setBlackLostMinors] = useState<PieceType[]>([]);
  const [necroPlusMode, setNecroPlusMode] = useState(false);
  const [necroPPMode, setNecroPPMode] = useState(false);
  const [whiteMonolithPermRemoved, setWhiteMonolithPermRemoved] =
    useState(false);
  const [blackMonolithPermRemoved, setBlackMonolithPermRemoved] =
    useState(false);

  // İlkkan (augment)
  const [whiteIlkkanId, setWhiteIlkkanId] = useState<string | null>(null);
  const [blackIlkkanId, setBlackIlkkanId] = useState<string | null>(null);
  const [whiteIlkkanChosen, setWhiteIlkkanChosen] = useState(false);
  const [blackIlkkanChosen, setBlackIlkkanChosen] = useState(false);
  const [ilkkanMode, setIlkkanMode] = useState(false);

  // Blessed Water Spell (augment)
  const [whiteBlessedWaterCharges, setWhiteBlessedWaterCharges] = useState(0);
  const [blackBlessedWaterCharges, setBlackBlessedWaterCharges] = useState(0);
  const [blessedWaterMode, setBlessedWaterMode] = useState(false);

  // Monolith (Impassable)
  const [monolithMode, setMonolithMode] = useState<"place" | "remove" | null>(
    null,
  );

  // Pawn Shop — buy count + pending placement (same turn, no extra move cost)
  const [pawnPlaceFor, setPawnPlaceFor] = useState<Color | null>(null);
  const [pawnPlaceSlot, setPawnPlaceSlot] = useState<PlayerSlot | null>(null);
  const [augmentPickSlot, setAugmentPickSlot] = useState<PlayerSlot | null>(null);
  const [blindRagePickSlot, setBlindRagePickSlot] = useState<PlayerSlot | null>(
    null,
  );
  const [whitePawnShopBuys, setWhitePawnShopBuys] = useState(0);
  const [blackPawnShopBuys, setBlackPawnShopBuys] = useState(0);

  // Prize Money / Blind Rage
  const [prizeFirstCaptureOfGameDone, setPrizeFirstCaptureOfGameDone] =
    useState(false);
  const [whiteDoubleGoldFullRoundsLeft, setWhiteDoubleGoldFullRoundsLeft] =
    useState(0);
  const [blackDoubleGoldFullRoundsLeft, setBlackDoubleGoldFullRoundsLeft] =
    useState(0);
  const [whiteBloodbendingCharges, setWhiteBloodbendingCharges] = useState(0);
  const [blackBloodbendingCharges, setBlackBloodbendingCharges] = useState(0);
  const [whiteBloodbendingPlusCharges, setWhiteBloodbendingPlusCharges] =
    useState(0);
  const [blackBloodbendingPlusCharges, setBlackBloodbendingPlusCharges] =
    useState(0);
  const [whiteNecroPPCharges, setWhiteNecroPPCharges] = useState(0);
  const [blackNecroPPCharges, setBlackNecroPPCharges] = useState(0);
  const [whiteLittleBigManCharges, setWhiteLittleBigManCharges] = useState(0);
  const [blackLittleBigManCharges, setBlackLittleBigManCharges] = useState(0);
  const [littleBigManMode, setLittleBigManMode] = useState(false);
  const [sacrificeMode, setSacrificeMode] = useState(false);
  const [whiteBlindRageDone, setWhiteBlindRageDone] = useState(false);
  const [blackBlindRageDone, setBlackBlindRageDone] = useState(false);

  // Evade — charges + opponent spell/shop lock for one of their turns
  const [whiteEvadeCharges, setWhiteEvadeCharges] = useState(0);
  const [blackEvadeCharges, setBlackEvadeCharges] = useState(0);
  const [augmentSpellBlockedFor, setAugmentSpellBlockedFor] =
    useState<Color | null>(null);

  // Shop
  const [shopOpen, setShopOpen] = useState(false);
  const [whiteTierBought, setWhiteTierBought] = useState<TierBought>({
    ...EMPTY_TIER,
  });
  const [blackTierBought, setBlackTierBought] = useState<TierBought>({
    ...EMPTY_TIER,
  });

  const boardRows = getBoardRows(game);
  const boardCols = getBoardCols(game);
  const boardSize = boardRows;
  const gameIs2v2 = is2v2Mode(game) || is2v2;
  const mySlotTurn =
    !gameIs2v2 ||
    !mpConfig?.mySlot ||
    game.turnSlot === mpConfig.mySlot;
  const { boardPxW, boardPxH, sqSize, stageMinHeight } = useBoardDimensions(
    boardRows,
    boardStageRef,
    boardCols,
  );
  const showCenterMarkers =
    !gameIs2v2 &&
    phase === "playing" &&
    [...whiteAugments, ...blackAugments].some(
      (a) => a.id === "king-of-the-hill",
    );
  const centerSquares = showCenterMarkers
    ? getCenterSquares(boardSize)
    : new Set<string>();

  /** Online black sees the board from their side (pieces at bottom); white unchanged. */
  const mpViewFlipped = gameIs2v2
    ? !!mpConfig?.mySlot?.startsWith("black")
    : mpConfig?.myColor === "black";

  // ── Grant effects ────────────────────────────────────────────────────────

  const grantPickedEffects = useCallback(
    (
      aug: Augment,
      color: Color,
      afterWhite?: Augment[],
      afterBlack?: Augment[],
    ) => {
      const wA = afterWhite ?? whiteAugments;
      const bA = afterBlack ?? blackAugments;
      if (aug.id === "oops") {
        if (color === "white") setWhiteUndosLeft((u) => u + 1);
        else setBlackUndosLeft((u) => u + 1);
      }
      if (aug.id === "frost") {
        if (color === "white") setWhiteFreezeCharges((n) => n + 1);
        else setBlackFreezeCharges((n) => n + 1);
      }
      if (aug.id === "blessed-water-spell") {
        if (color === "white") setWhiteBlessedWaterCharges((n) => n + 1);
        else setBlackBlessedWaterCharges((n) => n + 1);
      }
      if (aug.id === "necromancer") {
        if (color === "white") setWhiteNecroCharges((n) => n + 1);
        else setBlackNecroCharges((n) => n + 1);
      }
      if (aug.id === "necromancer-plus") {
        if (color === "white") setWhiteNecroPlusCharges((n) => n + 1);
        else setBlackNecroPlusCharges((n) => n + 1);
      }
      if (aug.id === "necromancer-plus-plus") {
        if (color === "white") setWhiteNecroPPCharges((n) => n + 1);
        else setBlackNecroPPCharges((n) => n + 1);
      }
      if (aug.id === "royal-education") {
        if (color === "white") setWhiteRoyalEdUsesLeft(1);
        else setBlackRoyalEdUsesLeft(1);
      }
      if (aug.id === "what") {
        if (color === "white") setWhiteWhatUsed(false);
        else setBlackWhatUsed(false);
      }
      if (aug.id === "instant-cash") {
        setGame((g) =>
          creditGoldWithAugments(
            g,
            color,
            10,
            wA,
            bA,
            whiteDoubleGoldFullRoundsLeft,
            blackDoubleGoldFullRoundsLeft,
            taxVaultCtx(color),
          ),
        );
      }
      if (aug.id === "evade") {
        if (color === "white") setWhiteEvadeCharges((n) => n + 1);
        else setBlackEvadeCharges((n) => n + 1);
      }
      if (aug.id === "double-gold") {
        if (color === "white") setWhiteDoubleGoldFullRoundsLeft(5);
        else setBlackDoubleGoldFullRoundsLeft(5);
      }
      if (aug.id === "horde") {
        setGame((g) => applyHordeEffect(g, color));
      }
      if (aug.id === "bloodbending") {
        if (color === "white") setWhiteBloodbendingCharges((n) => n + 1);
        else setBlackBloodbendingCharges((n) => n + 1);
      }
      if (aug.id === "bloodbending-plus") {
        if (color === "white") setWhiteBloodbendingPlusCharges((n) => n + 1);
        else setBlackBloodbendingPlusCharges((n) => n + 1);
      }
      if (aug.id === "little-big-man") {
        if (color === "white") setWhiteLittleBigManCharges((n) => n + 1);
        else setBlackLittleBigManCharges((n) => n + 1);
      }
      if (aug.id === "emperor-of-the-hill") {
        const kotH = AUGMENT_POOL.find((a) => a.id === "king-of-the-hill");
        if (!kotH) return;
        const augs = color === "white" ? wA : bA;
        const levels =
          color === "white" ? whiteAugmentLevels : blackAugmentLevels;
        if (!augs.some((a) => a.id === "king-of-the-hill")) {
          if (color === "white")
            setWhiteAugments((prev) => [...prev, kotH]);
          else setBlackAugments((prev) => [...prev, kotH]);
        } else if (canImproveAugment(levels, "king-of-the-hill", augs)) {
          const cur = getImproveLevel(levels, "king-of-the-hill");
          const setter =
            color === "white"
              ? setWhiteAugmentLevels
              : setBlackAugmentLevels;
          setter((prev) => ({
            ...prev,
            "king-of-the-hill": cur + 1,
          }));
        }
      }
      if (aug.id === "plot-armour") {
        setGame((g) => ({
          ...g,
          plotArmourWhiteRoundsLeft:
            color === "white"
              ? 5
              : (g.plotArmourWhiteRoundsLeft ?? 0),
          plotArmourBlackRoundsLeft:
            color === "black"
              ? 5
              : (g.plotArmourBlackRoundsLeft ?? 0),
        }));
      }
    },
    [
      whiteAugments,
      blackAugments,
      whiteAugmentLevels,
      blackAugmentLevels,
      whiteTurnCount,
      blackTurnCount,
      whiteDoubleGoldFullRoundsLeft,
      blackDoubleGoldFullRoundsLeft,
      taxVaultCtx,
    ],
  );

  // ── MP: snapshot infrastructure ──────────────────────────────────────────

  const snapshotRef = useRef(false);
  const triggersAfterBlindRageRef = useRef<AugmentTrigger[]>([]);
  const requestSnapshot = useCallback(() => {
    snapshotRef.current = true;
  }, []);
  const captureAugmentSnapshot = useCallback((): AugmentSnapshot => ({
    frozenSquare,
    frozenExpireAfter,
    frozenTurnsLeft,
    whiteDomainUsed,
    blackDomainUsed,
    whiteAugmentLevels,
    blackAugmentLevels,
    whiteJewPawnLosses,
    blackJewPawnLosses,
    whiteRoyalEdUsesLeft,
    blackRoyalEdUsesLeft,
    deathNoteTargets,
    activePuppetSquare,
    activePuppetColor,
    whiteContractTarget,
    blackContractTarget,
    whiteContractPieceId,
    blackContractPieceId,
    whiteIlkkanId,
    blackIlkkanId,
    blessedSquares,
    coldWindsSquares,
    coldWindsMovesLeft,
    wallSquares,
    wallMovesLeft,
    activeNuke,
    peaceTreatyRoundsLeft,
    whiteLostPawnCols,
    blackLostPawnCols,
    whiteCaptureCount,
    blackCaptureCount,
    whiteBloodlustNext,
    blackBloodlustNext,
    whiteLostMinors,
    blackLostMinors,
    nextEventTurn,
    chaosEventTiming,
    chaosPoolRestricted,
    whiteTaxVault,
    blackTaxVault,
    hillPawnTimers,
    prizeFirstCaptureOfGameDone,
    whiteBlindRageDone,
    blackBlindRageDone,
    whiteEvadeCharges,
    blackEvadeCharges,
    augmentSpellBlockedFor,
    whitePawnShopBuys,
    blackPawnShopBuys,
    blindRagePickColor,
    blindRageOffered,
    whiteDoubleGoldFullRoundsLeft,
    blackDoubleGoldFullRoundsLeft,
    whiteBloodbendingCharges,
    blackBloodbendingCharges,
    whiteBloodbendingPlusCharges,
    blackBloodbendingPlusCharges,
    whiteNecroPPCharges,
    blackNecroPPCharges,
    whiteLittleBigManCharges,
    blackLittleBigManCharges,
  }), [
    frozenSquare, frozenExpireAfter, frozenTurnsLeft,
    whiteDomainUsed, blackDomainUsed,
    whiteAugmentLevels, blackAugmentLevels, whiteJewPawnLosses, blackJewPawnLosses,
    whiteRoyalEdUsesLeft, blackRoyalEdUsesLeft, deathNoteTargets,
    activePuppetSquare, activePuppetColor, whiteContractTarget, blackContractTarget,
    whiteContractPieceId, blackContractPieceId, whiteIlkkanId, blackIlkkanId,
    blessedSquares, coldWindsSquares, coldWindsMovesLeft, wallSquares, wallMovesLeft,
    activeNuke, peaceTreatyRoundsLeft, whiteLostPawnCols, blackLostPawnCols,
    whiteCaptureCount, blackCaptureCount, whiteBloodlustNext, blackBloodlustNext,
    whiteLostMinors, blackLostMinors, nextEventTurn, chaosEventTiming,
    chaosPoolRestricted, whiteTaxVault, blackTaxVault, hillPawnTimers,
    prizeFirstCaptureOfGameDone, whiteBlindRageDone, blackBlindRageDone,
    whiteEvadeCharges, blackEvadeCharges, augmentSpellBlockedFor,
    whitePawnShopBuys, blackPawnShopBuys, blindRagePickColor, blindRageOffered,
    whiteDoubleGoldFullRoundsLeft, blackDoubleGoldFullRoundsLeft,
    whiteBloodbendingCharges, blackBloodbendingCharges,
    whiteBloodbendingPlusCharges, blackBloodbendingPlusCharges,
    whiteNecroPPCharges, blackNecroPPCharges,
    whiteLittleBigManCharges, blackLittleBigManCharges,
  ]);

  // Build a plain-JSON snapshot of all game state
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const buildSnapshot = () => {
    const shareMidOffers =
      !mpConfig ||
      !currentTrigger ||
      isLocalAugmentPicker(currentTrigger.color, augmentPickSlot);
    const shareBlindOffers =
      !mpConfig ||
      !blindRagePickColor ||
      isLocalAugmentPicker(blindRagePickColor, blindRagePickSlot);
    return {
    game,
    whiteTurnCount,
    blackTurnCount,
    whiteAugments,
    blackAugments,
    whiteAugmentLevels,
    blackAugmentLevels,
    whiteJewPawnLosses,
    blackJewPawnLosses,
    whiteMilestones,
    blackMilestones,
    whiteFreezeCharges,
    blackFreezeCharges,
    frozenSquare,
    frozenExpireAfter,
    frozenTurnsLeft,
    whiteNecroCharges,
    blackNecroCharges,
    whiteLostPawnCols,
    blackLostPawnCols,
    whiteCaptureCount,
    blackCaptureCount,
    whiteBloodlustNext,
    blackBloodlustNext,
    whiteIcUsed,
    blackIcUsed,
    whiteRoyalEdUsesLeft,
    blackRoyalEdUsesLeft,
    whiteWhatUsed,
    blackWhatUsed,
    whiteSakoUsed,
    blackSakoUsed,
    whiteSwapUsed,
    blackSwapUsed,
    whiteRoyalHouseholdUsed,
    blackRoyalHouseholdUsed,
    whiteDNUsed,
    blackDNUsed,
    deathNoteTargets,
    boardExpanded: whiteDomainUsed || blackDomainUsed,
    whiteDomainUsed,
    blackDomainUsed,
    nextEventTurn,
    pendingEvent,
    peaceTreatyRoundsLeft,
    activeNuke,
    chaosEventTiming,
    chaosPoolRestricted,
    whiteTaxVault,
    blackTaxVault,
    hillPawnTimers,
    wallSquares,
    wallMovesLeft,
    whitePuppetUsed,
    blackPuppetUsed,
    activePuppetSquare,
    activePuppetColor,
    blessedSquares,
    coldWindsSquares,
    coldWindsMovesLeft,
    whiteContractTarget,
    blackContractTarget,
    whiteContractPieceId,
    blackContractPieceId,
    whiteBlessedWaterCharges,
    blackBlessedWaterCharges,
    whiteTierBought,
    blackTierBought,
    augmentQueue,
    currentTrigger,
    midGameOffered: shareMidOffers ? midGameOffered : [],
    whiteNecroPlusCharges,
    blackNecroPlusCharges,
    whiteLostMinors,
    blackLostMinors,
    whiteMonolithPermRemoved,
    blackMonolithPermRemoved,
    whiteIlkkanId,
    blackIlkkanId,
    whiteIlkkanChosen,
    blackIlkkanChosen,
    prizeFirstCaptureOfGameDone,
    whiteBlindRageDone,
    blackBlindRageDone,
    whiteEvadeCharges,
    blackEvadeCharges,
    augmentSpellBlockedFor,
    whitePawnShopBuys,
    blackPawnShopBuys,
    pawnPlaceFor,
    blindRagePickColor,
    blindRageOffered: shareBlindOffers ? blindRageOffered : [],
    whiteDoubleGoldFullRoundsLeft,
    blackDoubleGoldFullRoundsLeft,
    whiteBloodbendingCharges,
    blackBloodbendingCharges,
    whiteBloodbendingPlusCharges,
    blackBloodbendingPlusCharges,
    whiteNecroPPCharges,
    blackNecroPPCharges,
    whiteLittleBigManCharges,
    blackLittleBigManCharges,
    augmentPickSlot,
    blindRagePickSlot,
    pawnPlaceSlot,
    exhaustedEventIds,
    activeApocalypse,
    nextAuctionTurn,
    activeAuction,
    auctionPlaceFor,
  };
  };

  // Apply a snapshot received from the opponent
  const applySnapshot = (s: Record<string, unknown>) => {
    const g = s as ReturnType<typeof buildSnapshot>;
    setGame(g.game as ChessState);
    setBoardSize((g.game as ChessState).occupancy.length);
    setWhiteTurnCount(g.whiteTurnCount as number);
    setBlackTurnCount(g.blackTurnCount as number);
    setWhiteAugments(g.whiteAugments as Augment[]);
    setBlackAugments(g.blackAugments as Augment[]);
    setWhiteAugmentLevels(
      (g as { whiteAugmentLevels?: AugmentUpgradeLevels }).whiteAugmentLevels ??
        {},
    );
    setBlackAugmentLevels(
      (g as { blackAugmentLevels?: AugmentUpgradeLevels }).blackAugmentLevels ??
        {},
    );
    setWhiteJewPawnLosses(
      (g as { whiteJewPawnLosses?: number }).whiteJewPawnLosses ?? 0,
    );
    setBlackJewPawnLosses(
      (g as { blackJewPawnLosses?: number }).blackJewPawnLosses ?? 0,
    );
    setWhiteMilestones(g.whiteMilestones as Milestones);
    setBlackMilestones(g.blackMilestones as Milestones);
    setWhiteFreezeCharges(g.whiteFreezeCharges as number);
    setBlackFreezeCharges(g.blackFreezeCharges as number);
    setFrozenSquare(g.frozenSquare as [number, number] | null);
    setFrozenExpireAfter(g.frozenExpireAfter as Color | null);
    setWhiteNecroCharges(g.whiteNecroCharges as number);
    setBlackNecroCharges(g.blackNecroCharges as number);
    setWhiteLostPawnCols(g.whiteLostPawnCols as number[]);
    setBlackLostPawnCols(g.blackLostPawnCols as number[]);
    setWhiteCaptureCount(g.whiteCaptureCount as number);
    setBlackCaptureCount(g.blackCaptureCount as number);
    setWhiteBloodlustNext(g.whiteBloodlustNext as number);
    setBlackBloodlustNext(g.blackBloodlustNext as number);
    setWhiteIcUsed(g.whiteIcUsed as boolean);
    setBlackIcUsed(g.blackIcUsed as boolean);
    setWhiteRoyalEdUsesLeft((g as { whiteRoyalEdUsesLeft?: number }).whiteRoyalEdUsesLeft ?? 0);
    setBlackRoyalEdUsesLeft((g as { blackRoyalEdUsesLeft?: number }).blackRoyalEdUsesLeft ?? 0);
    setWhiteWhatUsed(g.whiteWhatUsed as boolean);
    setBlackWhatUsed(g.blackWhatUsed as boolean);
    setWhiteSakoUsed(g.whiteSakoUsed as boolean);
    setBlackSakoUsed(g.blackSakoUsed as boolean);
    setWhiteSwapUsed((g.whiteSwapUsed as boolean) ?? false);
    setBlackSwapUsed((g.blackSwapUsed as boolean) ?? false);
    setWhiteRoyalHouseholdUsed(g.whiteRoyalHouseholdUsed as boolean);
    setBlackRoyalHouseholdUsed(g.blackRoyalHouseholdUsed as boolean);
    setWhiteDNUsed(g.whiteDNUsed as boolean);
    setBlackDNUsed(g.blackDNUsed as boolean);
    setDeathNoteTargets(normalizeDeathNoteTargets(g.deathNoteTargets));
    setWhiteDomainUsed(!!g.whiteDomainUsed);
    setBlackDomainUsed(!!g.blackDomainUsed);
    setNextEventTurn(g.nextEventTurn as number);
    setPendingEvent(g.pendingEvent as GameEvent | null);
    setPeaceTreatyRoundsLeft(g.peaceTreatyRoundsLeft as number);
    setActiveNuke(
      g.activeNuke as {
        topRow: number;
        leftCol: number;
        movesLeft: number;
      } | null,
    );
    setActiveApocalypse(
      (g as { activeApocalypse?: { fullRoundsLeft: number } | null })
        .activeApocalypse ?? null,
    );
    setExhaustedEventIds(
      (g as { exhaustedEventIds?: string[] }).exhaustedEventIds ?? [],
    );
    setNextAuctionTurn(
      (g as { nextAuctionTurn?: number }).nextAuctionTurn ??
        rollFullRoundsUntilNextAuction(),
    );
    setActiveAuction(
      (g as { activeAuction?: AuctionState | null }).activeAuction ?? null,
    );
    setAuctionPlaceFor(
      (g as { auctionPlaceFor?: { color: Color; pieceType: PieceType } | null })
        .auctionPlaceFor ?? null,
    );
    setChaosEventTiming(
      typeof g.chaosEventTiming === "boolean"
        ? g.chaosEventTiming
        : (g as { eventInterval?: number }).eventInterval === 10,
    );
    setChaosPoolRestricted(
      (g as { chaosPoolRestricted?: boolean }).chaosPoolRestricted ?? false,
    );
    setWhiteTaxVault((g as { whiteTaxVault?: number }).whiteTaxVault ?? 0);
    setBlackTaxVault((g as { blackTaxVault?: number }).blackTaxVault ?? 0);
    setHillPawnTimers(
      (g as { hillPawnTimers?: { pieceId: string; fullRoundsLeft: number }[] })
        .hillPawnTimers ?? [],
    );
    setWallSquares(g.wallSquares as { row: number; col: number }[]);
    setWallMovesLeft(g.wallMovesLeft as number);
    setWhitePuppetUsed(g.whitePuppetUsed as boolean);
    setBlackPuppetUsed(g.blackPuppetUsed as boolean);
    setActivePuppetSquare(g.activePuppetSquare as [number, number] | null);
    setActivePuppetColor(g.activePuppetColor as Color | null);
    setBlessedSquares(
      g.blessedSquares as { row: number; col: number; movesLeft: number }[],
    );
    setColdWindsSquares(g.coldWindsSquares as [number, number][]);
    setColdWindsMovesLeft(g.coldWindsMovesLeft as number);
    setWhiteContractTarget(g.whiteContractTarget as [number, number] | null);
    setBlackContractTarget(g.blackContractTarget as [number, number] | null);
    setWhiteContractPieceId(
      (g as { whiteContractPieceId?: string | null }).whiteContractPieceId ??
        null,
    );
    setBlackContractPieceId(
      (g as { blackContractPieceId?: string | null }).blackContractPieceId ??
        null,
    );
    setWhiteBlessedWaterCharges(g.whiteBlessedWaterCharges as number);
    setBlackBlessedWaterCharges(g.blackBlessedWaterCharges as number);
    setWhiteTierBought(g.whiteTierBought as TierBought);
    setBlackTierBought(g.blackTierBought as TierBought);
    setAugmentQueue(g.augmentQueue as AugmentTrigger[]);
    setCurrentTrigger(g.currentTrigger as AugmentTrigger | null);
    const remoteTrigger = g.currentTrigger as AugmentTrigger | null;
    const remotePickSlot = g.augmentPickSlot as PlayerSlot | null | undefined;
    const myMidPick =
      !mpConfig ||
      !remoteTrigger ||
      (gameIs2v2
        ? remotePickSlot === mpConfig.mySlot
        : remoteTrigger.color === mpConfig.myColor);
    setMidGameOffered(
      myMidPick ? (g.midGameOffered as Augment[]) : [],
    );
    setWhiteNecroPlusCharges(g.whiteNecroPlusCharges as number);
    setBlackNecroPlusCharges(g.blackNecroPlusCharges as number);
    setWhiteLostMinors(g.whiteLostMinors as PieceType[]);
    setBlackLostMinors(g.blackLostMinors as PieceType[]);
    setWhiteMonolithPermRemoved(g.whiteMonolithPermRemoved as boolean);
    setBlackMonolithPermRemoved(g.blackMonolithPermRemoved as boolean);
    setWhiteIlkkanId(g.whiteIlkkanId as string | null);
    setBlackIlkkanId(g.blackIlkkanId as string | null);
    setWhiteIlkkanChosen(g.whiteIlkkanChosen as boolean);
    setBlackIlkkanChosen(g.blackIlkkanChosen as boolean);
    setPrizeFirstCaptureOfGameDone(
      (g as { prizeFirstCaptureOfGameDone?: boolean })
        .prizeFirstCaptureOfGameDone ?? false,
    );
    setWhiteBlindRageDone(
      (g as { whiteBlindRageDone?: boolean }).whiteBlindRageDone ?? false,
    );
    setBlackBlindRageDone(
      (g as { blackBlindRageDone?: boolean }).blackBlindRageDone ?? false,
    );
    setWhiteEvadeCharges((g as { whiteEvadeCharges?: number }).whiteEvadeCharges ?? 0);
    setBlackEvadeCharges((g as { blackEvadeCharges?: number }).blackEvadeCharges ?? 0);
    setAugmentSpellBlockedFor(
      (g as { augmentSpellBlockedFor?: Color | null }).augmentSpellBlockedFor ??
        null,
    );
    setWhitePawnShopBuys((g as { whitePawnShopBuys?: number }).whitePawnShopBuys ?? 0);
    setBlackPawnShopBuys((g as { blackPawnShopBuys?: number }).blackPawnShopBuys ?? 0);
    setBlindRagePickColor(
      (g as { blindRagePickColor?: Color | null }).blindRagePickColor ?? null,
    );
    const remoteBlindColor =
      (g as { blindRagePickColor?: Color | null }).blindRagePickColor ?? null;
    const remoteBlindSlot =
      (g as { blindRagePickSlot?: PlayerSlot | null }).blindRagePickSlot ??
      null;
    const myBlindPick =
      !mpConfig ||
      !remoteBlindColor ||
      (gameIs2v2
        ? remoteBlindSlot === mpConfig.mySlot
        : remoteBlindColor === mpConfig.myColor);
    setBlindRageOffered(
      myBlindPick
        ? ((g as { blindRageOffered?: Augment[] }).blindRageOffered ?? [])
        : [],
    );
    setWhiteDoubleGoldFullRoundsLeft(
      (g as { whiteDoubleGoldFullRoundsLeft?: number })
        .whiteDoubleGoldFullRoundsLeft ?? 0,
    );
    setBlackDoubleGoldFullRoundsLeft(
      (g as { blackDoubleGoldFullRoundsLeft?: number })
        .blackDoubleGoldFullRoundsLeft ?? 0,
    );
    setWhiteBloodbendingCharges(
      (g as { whiteBloodbendingCharges?: number }).whiteBloodbendingCharges ?? 0,
    );
    setBlackBloodbendingCharges(
      (g as { blackBloodbendingCharges?: number }).blackBloodbendingCharges ?? 0,
    );
    setWhiteBloodbendingPlusCharges(
      (g as { whiteBloodbendingPlusCharges?: number })
        .whiteBloodbendingPlusCharges ?? 0,
    );
    setBlackBloodbendingPlusCharges(
      (g as { blackBloodbendingPlusCharges?: number })
        .blackBloodbendingPlusCharges ?? 0,
    );
    setWhiteNecroPPCharges(
      (g as { whiteNecroPPCharges?: number }).whiteNecroPPCharges ?? 0,
    );
    setBlackNecroPPCharges(
      (g as { blackNecroPPCharges?: number }).blackNecroPPCharges ?? 0,
    );
    setWhiteLittleBigManCharges(
      (g as { whiteLittleBigManCharges?: number }).whiteLittleBigManCharges ??
        0,
    );
    setBlackLittleBigManCharges(
      (g as { blackLittleBigManCharges?: number }).blackLittleBigManCharges ??
        0,
    );
    setPawnPlaceFor(
      (g as { pawnPlaceFor?: Color | null }).pawnPlaceFor ?? null,
    );
    setPawnPlaceSlot(
      (g as { pawnPlaceSlot?: PlayerSlot | null }).pawnPlaceSlot ?? null,
    );
    setAugmentPickSlot(
      (g as { augmentPickSlot?: PlayerSlot | null }).augmentPickSlot ?? null,
    );
    setBlindRagePickSlot(
      (g as { blindRagePickSlot?: PlayerSlot | null }).blindRagePickSlot ??
        null,
    );
    // Clear any active interaction mode on opponent's turn
    setSelected(null);
    setValidMoves([]);
    setFreezeMode(false);
    setNecroMode(false);
    setRoyalHouseholdMode(false);
    setSakoMode(false);
    setSakoSelected(null);
    setDeathNoteMode(false);
    setWhiteAugmentLevels({});
    setBlackAugmentLevels({});
    setWhiteJewPawnLosses(0);
    setBlackJewPawnLosses(0);
    setRoyalEdMode(false);
    setContractMode(false);
    setBlessedWaterMode(false);
    setPuppetMode(false);
    setWhatMode(false);
    setWhatSelected(null);
    setMonolithMode(null);
    setShopOpen(false);
    setNecroPlusMode(false);
    setBloodbendingMode(false);
    setBloodbendingPlusMode(false);
    setNecroPPMode(false);
    setLittleBigManMode(false);
    setIlkkanMode(false);
    setSwapMode(false);
    setSwapFirst(null);
  };

  // MP: initialize augment effects on mount
  useEffect(() => {
    if (!mpConfig) return;
    if (
      mpConfig.gameMode === "2v2" &&
      (!mpConfig.initialWhiteAugment || !mpConfig.initialBlackAugment)
    ) {
      setMpReady(true);
      return;
    }
    if (!mpConfig.initialWhiteAugment || !mpConfig.initialBlackAugment) return;
    setWhiteAugments([mpConfig.initialWhiteAugment]);
    setBlackAugments([mpConfig.initialBlackAugment]);
    grantPickedEffects(mpConfig.initialWhiteAugment, "white", [
      mpConfig.initialWhiteAugment,
    ], []);
    grantPickedEffects(
      mpConfig.initialBlackAugment,
      "black",
      [mpConfig.initialWhiteAugment],
      [mpConfig.initialBlackAugment],
    );
    setPhase("playing");
    setMpReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // MP: apply incoming snapshot from opponent
  useEffect(() => {
    if (mpConfig?.incomingSnapshot) applySnapshot(mpConfig.incomingSnapshot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mpConfig?.incomingSnapshot]);

  // MP: dep-less effect — fires after every render; sends snapshot when flagged
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!snapshotRef.current || !mpConfig) return;
    snapshotRef.current = false;
    mpConfig.onSnapshot(buildSnapshot());
  });

  // Sync Free Passage augment flags into engine state for castling legality
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const fw = whiteAugments.some((a) => a.id === "free-passage");
    const fb = blackAugments.some((a) => a.id === "free-passage");
    setGame((g) =>
      (g.freePassageWhite ?? false) === fw && (g.freePassageBlack ?? false) === fb
        ? g
        : { ...g, freePassageWhite: fw, freePassageBlack: fb },
    );
  }, [whiteAugments, blackAugments]);

  // ── Pre-game picks ───────────────────────────────────────────────────────

  const handleStart = () => {
    setOfferedToWhite(rollBonusAugments(pickAugmentCount([]), []));
    setPhase("white-augment");
  };
  const handleWhitePick = (aug: Augment) => {
    if (
      tutorialMode &&
      tutorialRestrictions &&
      !tutorialAllowsAugment(aug.id, tutorialRestrictions)
    ) {
      return;
    }
    setWhiteAugments([aug]);
    grantPickedEffects(aug, "white", [aug], []);
    if (tutorialMode) {
      tutorialEmit?.({ type: "augment", id: aug.id });
      setPhase("playing");
      return;
    }
    setOfferedToBlack(rollBonusAugments(pickAugmentCount([aug]), [aug]));
    setPhase("black-augment");
  };
  const handleBlackPick = (aug: Augment) => {
    setBlackAugments([aug]);
    grantPickedEffects(aug, "black", whiteAugments, [aug]);
    setPhase("playing");
  };

  // ── Mid-game pick ────────────────────────────────────────────────────────

  const showTrigger = useCallback(
    (trigger: AugmentTrigger, wAugs: Augment[], bAugs: Augment[]) => {
      if (tutorialMode) return;
      setCurrentTrigger(trigger);
      const playerAugs = trigger.color === "white" ? wAugs : bAugs;
      const count = pickAugmentCount(playerAugs);
      if (trigger.eventRollFilter) {
        setMidGameOffered(
          rollBonusAugmentsFiltered(count, playerAugs, trigger.eventRollFilter),
        );
      } else {
        setMidGameOffered(rollBonusAugments(count, playerAugs));
      }
    },
    [tutorialMode],
  );

  const isLocalAugmentPicker = useCallback(
    (color: Color, slot?: PlayerSlot | null) => {
      if (!mpConfig) return true;
      if (gameIs2v2) return slot === mpConfig.mySlot;
      return color === mpConfig.myColor;
    },
    [mpConfig, gameIs2v2],
  );

  const handleMidGamePick = useCallback(
    (aug: Augment) => {
      if (!currentTrigger) return;
      const color = currentTrigger.color;
      let newWAugs = whiteAugments,
        newBAugs = blackAugments;
      if (color === "white") {
        newWAugs = [...whiteAugments, aug];
        setWhiteAugments(newWAugs);
      } else {
        newBAugs = [...blackAugments, aug];
        setBlackAugments(newBAugs);
      }
      grantPickedEffects(aug, color, newWAugs, newBAugs);
      if (augmentQueue.length > 0) {
        const [next, ...rest] = augmentQueue;
        setAugmentQueue(rest);
        setAugmentPickSlot(
          gameIs2v2
            ? next.color === "white"
              ? "white1"
              : "black1"
            : null,
        );
        showTrigger(next, newWAugs, newBAugs);
      } else {
        setCurrentTrigger(null);
        setMidGameOffered([]);
        setAugmentPickSlot(null);
      }
      requestSnapshot();
    },
    [
      currentTrigger,
      whiteAugments,
      blackAugments,
      augmentQueue,
      augmentPickSlot,
      grantPickedEffects,
      showTrigger,
      requestSnapshot,
      gameIs2v2,
    ],
  );

  const resolveAuction = useCallback(() => {
    if (!activeAuction || activeAuction.status !== "active") return;
    if (Date.now() < activeAuction.timerEndsAt) return;
    if (currentTrigger || blindRagePickColor) return;
    const winner = activeAuction.highBidder;
    if (winner && activeAuction.highBid > 0) {
      setGame((g) => ({
        ...g,
        goldWhite:
          winner === "white"
            ? g.goldWhite - activeAuction.highBid
            : g.goldWhite,
        goldBlack:
          winner === "black"
            ? g.goldBlack - activeAuction.highBid
            : g.goldBlack,
      }));
      setAuctionPlaceFor({
        color: winner,
        pieceType: activeAuction.pieceType,
      });
    }
    setActiveAuction(null);
    requestSnapshot();
  }, [activeAuction, requestSnapshot, currentTrigger, blindRagePickColor]);

  const handleAuctionBid = useCallback(
    (amount: number, asColor?: Color) => {
      if (!activeAuction || activeAuction.status !== "active") return;
      const bidderColor = asColor ?? mpConfig?.myColor ?? game.turn;
      const myGold =
        bidderColor === "white" ? game.goldWhite : game.goldBlack;
      const minNext = Math.max(
        activeAuction.minBid,
        activeAuction.highBid > 0
          ? activeAuction.highBid + 1
          : activeAuction.minBid,
      );
      if (amount < minNext || amount > myGold) return;
      setActiveAuction({
        ...activeAuction,
        highBid: amount,
        highBidder: bidderColor,
        timerEndsAt: Date.now() + 20000,
      });
      requestSnapshot();
    },
    [activeAuction, game, mpConfig, requestSnapshot],
  );

  useEffect(() => {
    if (!activeAuction || activeAuction.status !== "active") return;
    const id = setInterval(() => {
      if (Date.now() >= activeAuction.timerEndsAt) resolveAuction();
    }, 250);
    return () => clearInterval(id);
  }, [activeAuction, resolveAuction]);

  useEffect(() => {
    if (
      !mpConfig ||
      !currentTrigger ||
      midGameOffered.length > 0 ||
      !isLocalAugmentPicker(currentTrigger.color, augmentPickSlot)
    )
      return;
    showTrigger(currentTrigger, whiteAugments, blackAugments);
  }, [
    mpConfig,
    currentTrigger,
    midGameOffered.length,
    isLocalAugmentPicker,
    augmentPickSlot,
    whiteAugments,
    blackAugments,
    showTrigger,
  ]);

  const handleBlindRagePick = useCallback(
    (aug: Augment) => {
      const color = blindRagePickColor;
      if (!color) return;
      let newWAugs = whiteAugments,
        newBAugs = blackAugments;
      if (color === "white") {
        newWAugs = [...whiteAugments, aug];
        setWhiteAugments(newWAugs);
      } else {
        newBAugs = [...blackAugments, aug];
        setBlackAugments(newBAugs);
      }
      grantPickedEffects(aug, color, newWAugs, newBAugs);
      const pickSlotHeld = blindRagePickSlot;
      setBlindRagePickColor(null);
      setBlindRagePickSlot(null);
      setBlindRageOffered([]);
      const pending = triggersAfterBlindRageRef.current;
      triggersAfterBlindRageRef.current = [];
      if (pending.length > 0) {
        const [first, ...rest] = pending;
        setCurrentTrigger(first);
        setAugmentPickSlot(pickSlotHeld);
        const pAugs = first.color === "white" ? newWAugs : newBAugs;
        setMidGameOffered(rollBonusAugments(pickAugmentCount(pAugs), pAugs));
        setAugmentQueue(rest);
      }
      requestSnapshot();
    },
    [
      blindRagePickColor,
      blindRagePickSlot,
      whiteAugments,
      blackAugments,
      grantPickedEffects,
      requestSnapshot,
    ],
  );

  // ── Shop buy ─────────────────────────────────────────────────────────────

  const handleBuy = useCallback(
    (aug: Augment) => {
      if (
        tutorialMode &&
        tutorialRestrictions &&
        !tutorialAllowsShopBuy(aug.id, tutorialRestrictions)
      ) {
        return;
      }
      const color = game.turn;
      const playerAugs = color === "white" ? whiteAugments : blackAugments;
      const ownedCount = playerAugs.filter((a) => a.id === aug.id).length;
      if (ownedCount >= (MAX_STACK[aug.id] ?? 1)) return;
      const ownedIds = playerAugs.map((a) => a.id);
      if (!augmentUnlockedForShop(aug.id, ownedIds)) return;
      const tierBought = color === "white" ? whiteTierBought : blackTierBought;
      const cost = getShopCost(aug.rarity, tierBought[aug.rarity]);
      const currentGold = color === "white" ? game.goldWhite : game.goldBlack;
      if (currentGold < cost) return;

      // Deduct gold
      setGame((g) => ({
        ...g,
        goldWhite: color === "white" ? g.goldWhite - cost : g.goldWhite,
        goldBlack: color === "black" ? g.goldBlack - cost : g.goldBlack,
      }));

      // Add augment
      if (color === "white") setWhiteAugments((prev) => [...prev, aug]);
      else setBlackAugments((prev) => [...prev, aug]);
      grantPickedEffects(
        aug,
        color,
        color === "white" ? [...whiteAugments, aug] : whiteAugments,
        color === "black" ? [...blackAugments, aug] : blackAugments,
      );

      // Increment tier bought counter
      const setter =
        color === "white" ? setWhiteTierBought : setBlackTierBought;
      setter((prev) => ({ ...prev, [aug.rarity]: prev[aug.rarity] + 1 }));
      if (tutorialMode) tutorialEmit?.({ type: "shop-buy", id: aug.id });
      requestSnapshot();
    },
    [
      game,
      whiteTierBought,
      blackTierBought,
      whiteAugments,
      blackAugments,
      grantPickedEffects,
      requestSnapshot,
      tutorialMode,
      tutorialRestrictions,
      tutorialEmit,
    ],
  );
  const applyImproveSideEffects = useCallback(
    (augId: string, color: Color, newLevel: number) => {
      if (augId === "bloodlust") {
        const threshold = getBloodlustThreshold(newLevel);
        if (color === "white") setWhiteBloodlustNext(threshold);
        else setBlackBloodlustNext(threshold);
      }
      if (augId === "royal-education") {
        const maxUses = getRoyalEducationMaxUses(newLevel);
        if (color === "white") setWhiteRoyalEdUsesLeft((n) => Math.max(n, maxUses));
        else setBlackRoyalEdUsesLeft((n) => Math.max(n, maxUses));
      }
    },
    [],
  );

  const handleImprove = useCallback(
    (augId: string) => {
      const color = game.turn;
      const playerAugs = color === "white" ? whiteAugments : blackAugments;
      const levels = color === "white" ? whiteAugmentLevels : blackAugmentLevels;
      if (!ownsAugment(playerAugs, augId)) return;
      if (!canImproveAugment(levels, augId, playerAugs)) return;
      const tier = getNextImproveTier(augId, levels);
      if (!tier) return;
      const currentGold = color === "white" ? game.goldWhite : game.goldBlack;
      if (currentGold < tier.cost) return;
      setGame((g) => ({
        ...g,
        goldWhite: color === "white" ? g.goldWhite - tier.cost : g.goldWhite,
        goldBlack: color === "black" ? g.goldBlack - tier.cost : g.goldBlack,
      }));
      const newLevel = getImproveLevel(levels, augId) + 1;
      const setter = color === "white" ? setWhiteAugmentLevels : setBlackAugmentLevels;
      setter((prev) => ({ ...prev, [augId]: newLevel }));
      applyImproveSideEffects(augId, color, newLevel);
      requestSnapshot();
    },
    [game, whiteAugments, blackAugments, whiteAugmentLevels, blackAugmentLevels, applyImproveSideEffects, requestSnapshot],
  );

  // ── Core move executor ───────────────────────────────────────────────────

  const executeMove = useCallback(
    (
      from: [number, number],
      to: [number, number],
      promotion?: PieceType,
      capturedType?: PieceType | null,
    ) => {
      const moverSlot = gameIs2v2 ? game.turnSlot ?? null : null;
      const movingColor = game.turn;
      const startGoldWhite = game.goldWhite;
      const startGoldBlack = game.goldBlack;
      const roundsSoFar = Math.min(whiteTurnCount, blackTurnCount);
      const victimSquarePiece = getDerivedBoard(game)[to[0]][to[1]];
      const victimWasMercenary = isMercenaryPiece(victimSquarePiece);
      let eventAugmentTriggers: AugmentTrigger[] = [];
      setGameHistory((h) => [...h, game]);
      setAugmentHistory((h) => [...h, captureAugmentSnapshot()]);
      setShopOpen(false);

      // Frost expire (turn counter or legacy expire-after)
      if (frozenSquare && frozenTurnsLeft > 0) {
        const nextFrozen = frozenTurnsLeft - 1;
        if (nextFrozen <= 0) {
          setFrozenSquare(null);
          setFrozenExpireAfter(null);
    setFrozenTurnsLeft(0);
          setFrozenTurnsLeft(0);
        } else setFrozenTurnsLeft(nextFrozen);
      } else if (frozenSquare && frozenExpireAfter === movingColor) {
        setFrozenSquare(null);
        setFrozenExpireAfter(null);
      }

      let newGame = makeMove(game, from, to, promotion);

      const newTurnCount =
        (movingColor === "white" ? whiteTurnCount : blackTurnCount) + 1;
      if (movingColor === "white") setWhiteTurnCount(newTurnCount);
      else setBlackTurnCount(newTurnCount);

      const playerAugs =
        movingColor === "white" ? whiteAugments : blackAugments;
      const moverLevels =
        movingColor === "white" ? whiteAugmentLevels : blackAugmentLevels;
      newGame = applyEndOfTurnEffects(
        newGame,
        movingColor,
        playerAugs,
        newTurnCount,
        whiteAugments,
        blackAugments,
        whiteDoubleGoldFullRoundsLeft,
        blackDoubleGoldFullRoundsLeft,
        moverLevels,
        taxVaultCtx(movingColor),
      );

      const investmentRoundDone = is2v2Mode(newGame)
        ? isTeamRoundComplete(moverSlot, newGame)
        : movingColor === "black";
      if (investmentRoundDone) {
        newGame = applyInvestmentEndOfFullRound(
          newGame,
          whiteAugments,
          blackAugments,
          whiteAugmentLevels,
          blackAugmentLevels,
          whiteDoubleGoldFullRoundsLeft,
          blackDoubleGoldFullRoundsLeft,
          taxVaultCtx("white"),
          taxVaultCtx("black"),
        );
      }

      // Jew (blocked by peace treaty)
      if (
        capturedType === "P" &&
        !victimWasMercenary &&
        peaceTreatyRoundsLeft <= 0
      ) {
        const victimColor = opp(movingColor);
        const victimAugs =
          victimColor === "white" ? whiteAugments : blackAugments;
        const victimLevels =
          victimColor === "white" ? whiteAugmentLevels : blackAugmentLevels;
        if (victimAugs.some((a) => a.id === "jew")) {
          const jewLevel = getImproveLevel(victimLevels, "jew");
          let lossIndex = 1;
          if (jewLevel >= 2) {
            if (victimColor === "white") {
              lossIndex = whiteJewPawnLosses + 1;
              setWhiteJewPawnLosses(lossIndex);
            } else {
              lossIndex = blackJewPawnLosses + 1;
              setBlackJewPawnLosses(lossIndex);
            }
          }
          const jewGold = getJewPawnCaptureGold(jewLevel, lossIndex);
          newGame = creditGoldWithAugments(
            newGame,
            victimColor,
            jewGold,
            whiteAugments,
            blackAugments,
            whiteDoubleGoldFullRoundsLeft,
            blackDoubleGoldFullRoundsLeft,
            taxVaultCtx(victimColor),
          );
        }
      }

      // Necromancer: track column at death, revive at home rank
      if (capturedType === "P" && !victimWasMercenary) {
        const victimColor = opp(movingColor);
        if (victimColor === "white")
          setWhiteLostPawnCols((prev) => [...prev, to[1]]);
        else setBlackLostPawnCols((prev) => [...prev, to[1]]);
      }
      // Necromancer+: track lost knights/bishops
      if ((capturedType === "N" || capturedType === "B") && !victimWasMercenary) {
        const victimColor = opp(movingColor);
        if (victimColor === "white")
          setWhiteLostMinors((prev) => [...prev, capturedType]);
        else setBlackLostMinors((prev) => [...prev, capturedType]);
      }

      // İlkkan: ID-based tracking — no coordinate updates needed, ID travels with piece
      {
        const movingPieceId = getDerivedBoard(game)[from[0]][from[1]]?.id ?? null;
        const myIlkId = movingColor === "white" ? whiteIlkkanId : blackIlkkanId;
        const setMyIlkId =
          movingColor === "white" ? setWhiteIlkkanId : setBlackIlkkanId;
        if (movingPieceId && movingPieceId === myIlkId) {
          if (
            !victimWasMercenary &&
            (capturedType === "R" ||
              capturedType === "B" ||
              capturedType === "N")
          ) {
            // İlkkan pawn transforms into the captured piece — strip ID (no longer a pawn)
            const nb2 = cloneBoard(getDerivedBoard(newGame));
            nb2[to[0]][to[1]] = { type: capturedType, color: movingColor };
            newGame = syncStateFromBoard({ ...newGame }, nb2);
            setMyIlkId(null);
          } else if (promotion) {
            // İlkkan pawn promoted — engine already replaced piece, clear tracking
            setMyIlkId(null);
          }
          // else: normal move — ID already traveled with piece via { ...piece } in applyMoveToBoard
        }
        // Clear enemy ilkkan if their pawn was captured (regular capture or en passant)
        const isEP =
          getDerivedBoard(game)[from[0]][from[1]]?.type === "P" &&
          from[1] !== to[1] &&
          !getDerivedBoard(game)[to[0]][to[1]];
        const capturedPieceId = isEP
          ? (getDerivedBoard(game)[from[0]][to[1]]?.id ?? null)
          : (getDerivedBoard(game)[to[0]][to[1]]?.id ?? null);
        const enemyIlkId =
          movingColor === "white" ? blackIlkkanId : whiteIlkkanId;
        const setEnemyIlkId =
          movingColor === "white" ? setBlackIlkkanId : setWhiteIlkkanId;
        if (capturedPieceId && capturedPieceId === enemyIlkId)
          setEnemyIlkId(null);
      }

      // Internal Combustion runs after mercenary ticks (see end of executeMove).

      // Gold from capture (blocked by peace treaty; Efficient)
      if (capturedType && peaceTreatyRoundsLeft <= 0 && !victimWasMercenary) {
        const efficientStacks = playerAugs.filter(
          (a) => a.id === "efficient",
        ).length;
        const efficientBonus =
          efficientStacks > 0
            ? efficientStacks *
              getEfficientCaptureBonus(getImproveLevel(moverLevels, "efficient"))
            : 0;
        let captureBonus = 1 + efficientBonus;
        captureBonus = applyDoubleGoldToPositiveDelta(
          movingColor,
          captureBonus,
          playerAugs,
          movingColor === "white"
            ? whiteDoubleGoldFullRoundsLeft
            : blackDoubleGoldFullRoundsLeft,
        );
        newGame = {
          ...newGame,
          goldWhite:
            movingColor === "white"
              ? newGame.goldWhite + captureBonus
              : newGame.goldWhite,
          goldBlack:
            movingColor === "black"
              ? newGame.goldBlack + captureBonus
              : newGame.goldBlack,
        };
      }

      // Peace treaty countdown moved to fullRoundDone block

      // Contract Killer — 4× payout when you capture the marked piece; consume augment when resolved
      {
        const capId = newGame.lastMove?.captured?.id ?? null;
        const settleWhiteContract = () => {
          setWhiteContractTarget(null);
          setWhiteContractPieceId(null);
          setWhiteAugments((prev) => prev.filter((a) => a.id !== "contract-killer"));
        };
        const settleBlackContract = () => {
          setBlackContractTarget(null);
          setBlackContractPieceId(null);
          setBlackAugments((prev) => prev.filter((a) => a.id !== "contract-killer"));
        };
        if (whiteContractPieceId) {
          let cleared = false;
          if (
            capturedType &&
            capturedType !== "K" &&
            movingColor === "white"
          ) {
            const hitId = capId === whiteContractPieceId;
            const wCT = whiteContractTarget;
            const hitSq =
              wCT && wCT[0] === to[0] && wCT[1] === to[1];
            if (hitId || hitSq) {
              if (peaceTreatyRoundsLeft <= 0) {
                const bonus =
                  (PIECE_VALUE[capturedType] ?? 1) *
                  getContractKillerMultiplier(
                    getImproveLevel(whiteAugmentLevels, "contract-killer"),
                  );
                newGame = creditGoldWithAugments(
                  newGame,
                  "white",
                  bonus,
                  whiteAugments,
                  blackAugments,
                  whiteDoubleGoldFullRoundsLeft,
                  blackDoubleGoldFullRoundsLeft,
                  taxVaultCtx("white"),
                );
              }
              settleWhiteContract();
              cleared = true;
            }
          }
          if (
            !cleared &&
            capId === whiteContractPieceId &&
            movingColor === "black"
          ) {
            settleWhiteContract();
            cleared = true;
          }
          if (!cleared) {
            const pos = findSquareByPieceId(
              getDerivedBoard(newGame),
              whiteContractPieceId,
            );
            if (pos) setWhiteContractTarget(pos);
            else settleWhiteContract();
          }
        }
        if (blackContractPieceId) {
          let cleared = false;
          if (
            capturedType &&
            capturedType !== "K" &&
            movingColor === "black"
          ) {
            const hitId = capId === blackContractPieceId;
            const bCT = blackContractTarget;
            const hitSq =
              bCT && bCT[0] === to[0] && bCT[1] === to[1];
            if (hitId || hitSq) {
              if (peaceTreatyRoundsLeft <= 0) {
                const bonus =
                  (PIECE_VALUE[capturedType] ?? 1) *
                  getContractKillerMultiplier(
                    getImproveLevel(blackAugmentLevels, "contract-killer"),
                  );
                newGame = creditGoldWithAugments(
                  newGame,
                  "black",
                  bonus,
                  whiteAugments,
                  blackAugments,
                  whiteDoubleGoldFullRoundsLeft,
                  blackDoubleGoldFullRoundsLeft,
                  taxVaultCtx("black"),
                );
              }
              settleBlackContract();
              cleared = true;
            }
          }
          if (
            !cleared &&
            capId === blackContractPieceId &&
            movingColor === "white"
          ) {
            settleBlackContract();
            cleared = true;
          }
          if (!cleared) {
            const pos = findSquareByPieceId(
              getDerivedBoard(newGame),
              blackContractPieceId,
            );
            if (pos) setBlackContractTarget(pos);
            else settleBlackContract();
          }
        }
      }

      // ── Event trigger (full round: black half-move in 1v1, black2 in 2v2) ───
      const fullRoundDone = is2v2Mode(newGame)
        ? isTeamRoundComplete(moverSlot, newGame)
        : movingColor === "black";
      if (fullRoundDone) {
        if (peaceTreatyRoundsLeft > 0) setPeaceTreatyRoundsLeft((n) => n - 1);
        newGame = recomputeStatus(newGame);
        const fullRoundsCompleted = newTurnCount;
        if (fullRoundsCompleted >= nextEventTurn) {
          const event = rollEvent(exhaustedEventIds, {
            excludeRarities: chaosPoolRestricted
              ? (["common", "uncommon"] as const)
              : undefined,
          });
          setExhaustedEventIds((prev) => {
            const next = [...prev, event.id];
            return next.length >= EVENT_POOL.length ? [] : next;
          });
          const permaSq = newGame.permaFrozenSquares ?? [];
          const evRows = getBoardRows(newGame);
          const evCols = getBoardCols(newGame);
          if (event.id === "golden-age") {
            const wAdd = applyDoubleGoldToPositiveDelta(
              "white",
              10,
              whiteAugments,
              whiteDoubleGoldFullRoundsLeft,
            );
            const bAdd = applyDoubleGoldToPositiveDelta(
              "black",
              10,
              blackAugments,
              blackDoubleGoldFullRoundsLeft,
            );
            newGame = {
              ...newGame,
              goldWhite: newGame.goldWhite + wAdd,
              goldBlack: newGame.goldBlack + bAdd,
            };
          } else if (event.id === "stock-crash") {
            let nw = newGame.goldWhite - 10;
            let nb = newGame.goldBlack - 10;
            if (whiteAugments.some((a) => a.id === "anticipation"))
              nw = newGame.goldWhite;
            if (blackAugments.some((a) => a.id === "anticipation"))
              nb = newGame.goldBlack;
            newGame = {
              ...newGame,
              goldWhite: Math.max(0, nw),
              goldBlack: Math.max(0, nb),
            };
          } else if (event.id === "peace-treaty") {
            setPeaceTreatyRoundsLeft(3);
          } else if (event.id === "tactical-nuke") {
            const topRow = Math.floor(Math.random() * Math.max(1, evRows - 2));
            const leftCol = Math.floor(Math.random() * Math.max(1, evCols - 2));
            setActiveNuke({ topRow, leftCol, movesLeft: 10 });
          } else if (event.id === "red-wedding") {
            const nb = cloneBoard(getDerivedBoard(newGame));
            const wPawns: [number, number][] = [];
            const bPawns: [number, number][] = [];
            for (let r = 0; r < evRows; r++)
              for (let c = 0; c < evCols; c++) {
                if (nb[r][c]?.type === "P" && nb[r][c]?.color === "white")
                  wPawns.push([r, c]);
                if (nb[r][c]?.type === "P" && nb[r][c]?.color === "black")
                  bPawns.push([r, c]);
              }
            for (let i = wPawns.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [wPawns[i], wPawns[j]] = [wPawns[j], wPawns[i]];
            }
            for (let i = bPawns.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [bPawns[i], bPawns[j]] = [bPawns[j], bPawns[i]];
            }
            for (const [r, c] of wPawns.slice(0, 2)) nb[r][c] = null;
            for (const [r, c] of bPawns.slice(0, 2)) nb[r][c] = null;
            newGame = recomputeStatus(syncStateFromBoard({ ...newGame }, nb));
          } else if (event.id === "just-chaos") {
            setChaosEventTiming(true);
            setChaosPoolRestricted(true);
            setExhaustedEventIds([]);
          } else if (event.id === "all-in") {
            newGame = clearAllNonKings(newGame);
            newGame = creditGoldWithAugments(
              newGame,
              "white",
              200,
              whiteAugments,
              blackAugments,
              whiteDoubleGoldFullRoundsLeft,
              blackDoubleGoldFullRoundsLeft,
              taxVaultCtx("white"),
            );
            newGame = creditGoldWithAugments(
              newGame,
              "black",
              200,
              whiteAugments,
              blackAugments,
              whiteDoubleGoldFullRoundsLeft,
              blackDoubleGoldFullRoundsLeft,
              taxVaultCtx("black"),
            );
            const grantPawnShop = (color: Color) => {
              const pawnShop = AUGMENT_POOL.find((a) => a.id === "pawn-shop");
              if (!pawnShop) return;
              const augs = color === "white" ? whiteAugments : blackAugments;
              if (!augs.some((a) => a.id === "pawn-shop")) {
                if (color === "white")
                  setWhiteAugments((prev) => [...prev, pawnShop]);
                else setBlackAugments((prev) => [...prev, pawnShop]);
              }
              const setter =
                color === "white"
                  ? setWhiteAugmentLevels
                  : setBlackAugmentLevels;
              setter((prev) => ({ ...prev, "pawn-shop": 2 }));
            };
            grantPawnShop("white");
            grantPawnShop("black");
          } else if (event.id === "capitalism") {
            if (newGame.goldWhite > newGame.goldBlack) {
              newGame = creditGoldWithAugments(
                newGame,
                "white",
                20,
                whiteAugments,
                blackAugments,
                whiteDoubleGoldFullRoundsLeft,
                blackDoubleGoldFullRoundsLeft,
                taxVaultCtx("white"),
              );
            } else if (newGame.goldBlack > newGame.goldWhite) {
              newGame = creditGoldWithAugments(
                newGame,
                "black",
                20,
                whiteAugments,
                blackAugments,
                whiteDoubleGoldFullRoundsLeft,
                blackDoubleGoldFullRoundsLeft,
                taxVaultCtx("black"),
              );
            }
          } else if (event.id === "pride-month") {
            newGame = removeAllQueens(newGame);
          } else if (event.id === "imposters") {
            newGame = flipRandomPawns(newGame, 2);
          } else if (event.id === "great-wall-of-hatay") {
            const wallOptions: { row: number; col: number }[][] = [];
            for (let row = 0; row < evRows; row++)
              for (let c = 0; c <= evCols - 3; c++) {
                if (
                  !getDerivedBoard(newGame)[row][c] &&
                  !getDerivedBoard(newGame)[row][c + 1] &&
                  !getDerivedBoard(newGame)[row][c + 2]
                )
                  wallOptions.push([
                    { row, col: c },
                    { row, col: c + 1 },
                    { row, col: c + 2 },
                  ]);
              }
            for (let col = 0; col < evCols; col++)
              for (let rr = 0; rr <= evRows - 3; rr++) {
                if (
                  !getDerivedBoard(newGame)[rr][col] &&
                  !getDerivedBoard(newGame)[rr + 1][col] &&
                  !getDerivedBoard(newGame)[rr + 2][col]
                )
                  wallOptions.push([
                    { row: rr, col },
                    { row: rr + 1, col },
                    { row: rr + 2, col },
                  ]);
              }
            if (wallOptions.length > 0) {
              const chosen =
                wallOptions[Math.floor(Math.random() * wallOptions.length)];
              setWallSquares(chosen);
              setWallMovesLeft(4);
            }
          } else if (event.id === "blessed-waters") {
            const off2 = (evRows - 8) / 2;
            const minRow = 2 + off2,
              maxRow = 5 + off2;
            const bRow =
              minRow + Math.floor(Math.random() * (maxRow - minRow + 1));
            const bCol = Math.floor(Math.random() * evCols);
            setBlessedSquares((prev) => [
              ...prev,
              { row: bRow, col: bCol, movesLeft: 6 },
            ]);
        } else if (event.id === "lost-mercenary") {
          newGame = spawnLostMercenaryOnBoard(newGame, wallSquares, permaSq);
        } else if (event.id === "mercenary-patrol") {
          newGame = spawnMercenaryPatrolKnights(newGame, wallSquares, permaSq);
        } else if (event.id === "siege-patrol") {
          newGame = spawnMercenarySiegePatrol(newGame, wallSquares, permaSq);
        } else if (event.id === "crusaders") {
          newGame = spawnMercenaryCrusaders(newGame, wallSquares, permaSq);
        } else if (event.id === "winter-has-come") {
          const nb = getDerivedBoard(newGame);
          const empties: [number, number][] = [];
          for (let rr = 0; rr < evRows; rr++)
            for (let cc = 0; cc < evCols; cc++) {
              if (!nb[rr][cc]) empties.push([rr, cc]);
            }
          if (empties.length > 0) {
            const pick = empties[Math.floor(Math.random() * empties.length)]!;
            const prev = newGame.permaFrozenSquares ?? [];
            newGame = {
              ...newGame,
              permaFrozenSquares: [
                ...prev,
                { row: pick[0], col: pick[1] },
              ],
            };
          }
        } else if (event.id === "valar-morghulis") {
          const nb = cloneBoard(getDerivedBoard(newGame));
          let lostW = false;
          let lostB = false;
          for (let rr = 0; rr < evRows; rr++)
            for (let cc = 0; cc < evCols; cc++) {
              const p = nb[rr][cc];
              if (!p || p.type !== "P") continue;
              if (p.color === "orange") continue;
              const pid = p.id;
              nb[rr][cc] = null;
              if (pid && whiteIlkkanId && pid === whiteIlkkanId) lostW = true;
              if (pid && blackIlkkanId && pid === blackIlkkanId) lostB = true;
            }
          if (lostW) setWhiteIlkkanId(null);
          if (lostB) setBlackIlkkanId(null);
          newGame = recomputeStatus(syncStateFromBoard({ ...newGame }, nb));
        } else if (event.id === "cold-winds") {
            const wPcs: [number, number][] = [],
              blPcs: [number, number][] = [];
            for (let rr = 0; rr < evRows; rr++)
              for (let cc = 0; cc < evCols; cc++) {
                const p = getDerivedBoard(newGame)[rr][cc];
                if (p && p.type !== "K" && p.type !== "M" && p.color === "white")
                  wPcs.push([rr, cc]);
                if (p && p.type !== "K" && p.type !== "M" && p.color === "black")
                  blPcs.push([rr, cc]);
              }
            const shuf = (a: [number, number][]) => {
              for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
              }
              return a;
            };
            setColdWindsSquares([
              ...shuf(wPcs).slice(0, 2),
              ...shuf(blPcs).slice(0, 2),
            ]);
            setColdWindsMovesLeft(2);
          } else if (event.id === "more-more-moreeee") {
            eventAugmentTriggers.push(
              {
                color: "white",
                reason: "event",
                eventRollFilter: { minRarity: "rare" },
              },
              {
                color: "black",
                reason: "event",
                eventRollFilter: { minRarity: "rare" },
              },
            );
          } else if (event.id === "tea-party") {
            const grantKotH = (color: Color) => {
              const augs = color === "white" ? whiteAugments : blackAugments;
              const levels =
                color === "white" ? whiteAugmentLevels : blackAugmentLevels;
              const kotH = AUGMENT_POOL.find((a) => a.id === "king-of-the-hill");
              if (!kotH) return;
              if (!augs.some((a) => a.id === "king-of-the-hill")) {
                if (color === "white")
                  setWhiteAugments((prev) => [...prev, kotH]);
                else setBlackAugments((prev) => [...prev, kotH]);
                grantPickedEffects(
                  kotH,
                  color,
                  color === "white" ? [...augs, kotH] : whiteAugments,
                  color === "black" ? [...augs, kotH] : blackAugments,
                );
              } else if (
                canImproveAugment(levels, "king-of-the-hill", augs)
              ) {
                const cur = getImproveLevel(levels, "king-of-the-hill");
                const setter =
                  color === "white"
                    ? setWhiteAugmentLevels
                    : setBlackAugmentLevels;
                setter((prev) => ({
                  ...prev,
                  "king-of-the-hill": cur + 1,
                }));
                applyImproveSideEffects("king-of-the-hill", color, cur + 1);
              }
            };
            grantKotH("white");
            grantKotH("black");
            newGame = spawnTeaPartyPawns(newGame, "white");
            newGame = spawnTeaPartyPawns(newGame, "black");
            newGame = recomputeStatus(newGame);
          } else if (event.id === "capitulations") {
            setWhiteTierBought({
              common: 0,
              uncommon: 0,
              rare: 0,
              epic: 0,
              legendary: 0,
            });
            setBlackTierBought({
              common: 0,
              uncommon: 0,
              rare: 0,
              epic: 0,
              legendary: 0,
            });
          } else if (event.id === "common-knowledge") {
            eventAugmentTriggers.push(
              {
                color: "white",
                reason: "event",
                eventRollFilter: { maxRarity: "rare" },
              },
              {
                color: "black",
                reason: "event",
                eventRollFilter: { maxRarity: "rare" },
              },
            );
          } else if (event.id === "apocalypse") {
            setActiveApocalypse({ fullRoundsLeft: 10 });
          }
          setPendingEvent(event);
          const chaosAfter =
            event.id === "just-chaos" ? true : chaosEventTiming;
          const delayRounds = rollFullRoundsUntilNextEvent(chaosAfter);
          setNextEventTurn(fullRoundsCompleted + delayRounds);
        }

        if (activeApocalypse) {
          if (activeApocalypse.fullRoundsLeft <= 1) {
            const nbAp = cloneBoard(getDerivedBoard(newGame));
            const apRows = nbAp.length;
            const apCols = nbAp[0]?.length ?? apRows;
            for (let rr = 0; rr < apRows; rr++)
              for (let cc = 0; cc < apCols; cc++)
                if (
                  isApocalypseSquare(rr, cc, apRows, apCols) &&
                  nbAp[rr][cc]?.type !== "K"
                )
                  nbAp[rr][cc] = null;
            newGame = recomputeStatus(syncStateFromBoard({ ...newGame }, nbAp));
            setActiveApocalypse(null);
          } else {
            setActiveApocalypse({
              fullRoundsLeft: activeApocalypse.fullRoundsLeft - 1,
            });
          }
        }

        if (fullRoundsCompleted >= nextAuctionTurn) {
          const pieceType =
            AUCTION_PIECE_TYPES[
              Math.floor(Math.random() * AUCTION_PIECE_TYPES.length)
            ]!;
          const minBid = AUCTION_MIN_BID[pieceType];
          if (
            newGame.goldWhite >= minBid ||
            newGame.goldBlack >= minBid
          ) {
            setActiveAuction({
              pieceType,
              minBid,
              highBid: 0,
              highBidder: null,
              timerEndsAt: Date.now() + 20000,
              status: "active",
            });
          } else {
            setAuctionAnnouncement(
              "Auction skipped — neither player can afford the minimum bid.",
            );
          }
          setNextAuctionTurn(
            fullRoundsCompleted + rollFullRoundsUntilNextAuction(),
          );
        }
      }

      // Death Note: timers tick each half-move; kills cursed piece by ID when expired
      let updatedDN = deathNoteTargets;
      updatedDN = updatedDN.map((dn) => ({
        ...dn,
        turnsLeft: dn.turnsLeft - 1,
      }));
      let dnBoard = getDerivedBoard(newGame);
      let dnChanged = false;
      updatedDN = updatedDN.filter((dn) => {
        if (dn.turnsLeft > 0) return true;
        const pos = findSquareByPieceId(dnBoard, dn.pieceId);
        if (!pos) return false;
        const [rr, cc] = pos;
        const p = dnBoard[rr]?.[cc];
        if (p && p.color === dn.targetColor && p.type !== "K") {
          if (!dnChanged) {
            dnBoard = cloneBoard(dnBoard);
            dnChanged = true;
          }
          dnBoard[rr][cc] = null;
        }
        return false;
      });
      if (dnChanged) newGame = recomputeStatus(syncStateFromBoard({ ...newGame }, dnBoard));
      setDeathNoteTargets(updatedDN);

      // Nuke countdown
      if (activeNuke) {
        if (activeNuke.movesLeft <= 1) {
          const nb2 = cloneBoard(getDerivedBoard(newGame));
          for (let nr = activeNuke.topRow; nr < activeNuke.topRow + 3; nr++)
            for (let nc = activeNuke.leftCol; nc < activeNuke.leftCol + 3; nc++)
              if (nb2[nr]?.[nc]?.type !== "K") nb2[nr][nc] = null;
          newGame = recomputeStatus(syncStateFromBoard({ ...newGame }, nb2));
          setActiveNuke(null);
        } else {
          setActiveNuke((prev) =>
            prev ? { ...prev, movesLeft: prev.movesLeft - 1 } : null,
          );
        }
      }

      // Blessed squares decrement (filter out expired)
      setBlessedSquares((prev) =>
        prev
          .map((b) => ({ ...b, movesLeft: b.movesLeft - 1 }))
          .filter((b) => b.movesLeft > 0),
      );

      // Cold Winds decrement
      if (coldWindsMovesLeft > 0) {
        if (coldWindsMovesLeft <= 1) {
          setColdWindsSquares([]);
          setColdWindsMovesLeft(0);
        } else setColdWindsMovesLeft((n) => n - 1);
      }

      // Great Wall decrement
      if (wallMovesLeft > 0) {
        if (wallMovesLeft <= 1) {
          setWallSquares([]);
          setWallMovesLeft(0);
        } else setWallMovesLeft((n) => n - 1);
      }

      // Puppet: clear forced state after the puppet player moves
      if (activePuppetColor === movingColor) {
        setActivePuppetSquare(null);
        setActivePuppetColor(null);
      }

      let boardAfterMerc = newGame;
      if (fullRoundDone) {
        setWhiteDoubleGoldFullRoundsLeft((n) => Math.max(0, n - 1));
        setBlackDoubleGoldFullRoundsLeft((n) => Math.max(0, n - 1));
        boardAfterMerc = {
          ...boardAfterMerc,
          plotArmourWhiteRoundsLeft: Math.max(
            0,
            (boardAfterMerc.plotArmourWhiteRoundsLeft ?? 0) - 1,
          ),
          plotArmourBlackRoundsLeft: Math.max(
            0,
            (boardAfterMerc.plotArmourBlackRoundsLeft ?? 0) - 1,
          ),
        };
        if (whiteAugments.some((a) => a.id === "tall-politician")) {
          setWhiteTaxVault((v) => Math.round(v * 1.25));
        }
        if (blackAugments.some((a) => a.id === "tall-politician")) {
          setBlackTaxVault((v) => Math.round(v * 1.25));
        }
        const hillTick = tickEmperorHillTimers(
          boardAfterMerc,
          hillPawnTimers,
          whiteAugments,
          blackAugments,
        );
        boardAfterMerc = hillTick.state;
        setHillPawnTimers(hillTick.timers);
        const mercCtx = {
          wallSquares,
          frozenSquare,
          coldWindsSquares,
          coldWindsMovesLeft,
          blessedSquares,
          permaFrozenSquares: boardAfterMerc.permaFrozenSquares ?? [],
        };
        boardAfterMerc = applyLostMercenaryAfterFullMove(boardAfterMerc, mercCtx);
        boardAfterMerc = applyMercenaryPatrolAfterFullMove(boardAfterMerc, mercCtx);
      }

      const icSide = boardAfterMerc.turn;
      const icAugs = icSide === "white" ? whiteAugments : blackAugments;
      const icUsedNow = icSide === "white" ? whiteIcUsed : blackIcUsed;
      if (
        boardAfterMerc.status === "check" &&
        icAugs.some((a) => a.id === "internal-combustion") &&
        !icUsedNow
      ) {
        const checker = findCheckingPiece(getDerivedBoard(boardAfterMerc), icSide);
        if (checker) {
          const nbIc = cloneBoard(getDerivedBoard(boardAfterMerc));
          nbIc[checker[0]][checker[1]] = null;
          boardAfterMerc = recomputeStatus(
            syncStateFromBoard({ ...boardAfterMerc }, nbIc),
          );
          if (icSide === "white") setWhiteIcUsed(true);
          else setBlackIcUsed(true);
        }
      }

      let finalGame = boardAfterMerc;
      if (finalGame.status === "check" && finalGame.turn !== movingColor) {
        const dangerStacks = playerAugs.filter((a) => a.id === "i-am-danger")
          .length;
        if (dangerStacks > 0) {
          const perStack = getIAmDangerGoldPerStack(
            getImproveLevel(moverLevels, "i-am-danger"),
          );
          const g = perStack * dangerStacks;
          finalGame = creditGoldWithAugments(
            finalGame,
            movingColor,
            g,
            whiteAugments,
            blackAugments,
            whiteDoubleGoldFullRoundsLeft,
            blackDoubleGoldFullRoundsLeft,
            taxVaultCtx(movingColor),
          );
        }
      }
      const thiefStacks = playerAugs.filter((a) => a.id === "thief").length;
      const thiefRate = getThiefProcRate(getImproveLevel(moverLevels, "thief"));
      if (thiefStacks > 0 && Math.random() < thiefRate * thiefStacks) {
        finalGame = creditGoldWithAugments(
          finalGame,
          movingColor,
          50,
          whiteAugments,
          blackAugments,
          whiteDoubleGoldFullRoundsLeft,
          blackDoubleGoldFullRoundsLeft,
          taxVaultCtx(movingColor),
        );
      }

      const oppC = opp(movingColor);
      const oppGoldStart =
        oppC === "white" ? startGoldWhite : startGoldBlack;
      const oppGoldEnd =
        oppC === "white" ? finalGame.goldWhite : finalGame.goldBlack;
      const oppDelta = oppGoldEnd - oppGoldStart;
      if (oppDelta > 0) {
        const taxStacks = playerAugs.filter((a) => a.id === "tax-man").length;
        if (taxStacks > 0) {
          const { divisor, goldPer } = getTaxManParams(
            getImproveLevel(moverLevels, "tax-man"),
          );
          const tg = Math.floor(oppDelta / divisor) * goldPer * taxStacks;
          if (tg > 0) {
            finalGame = creditGoldWithAugments(
              finalGame,
              movingColor,
              tg,
              whiteAugments,
              blackAugments,
              whiteDoubleGoldFullRoundsLeft,
              blackDoubleGoldFullRoundsLeft,
              taxVaultCtx(movingColor),
            );
          }
        }
      }

      const moverGoldStart =
        movingColor === "white" ? startGoldWhite : startGoldBlack;
      if (capturedType && !victimWasMercenary && !prizeFirstCaptureOfGameDone && peaceTreatyRoundsLeft <= 0) {
        if (playerAugs.some((a) => a.id === "prize-money")) {
          const moverNow =
            movingColor === "white"
              ? finalGame.goldWhite
              : finalGame.goldBlack;
          const d = moverNow - moverGoldStart;
          if (d !== 0) {
            finalGame = creditGoldWithAugments(
              finalGame,
              movingColor,
              d,
              whiteAugments,
              blackAugments,
              whiteDoubleGoldFullRoundsLeft,
              blackDoubleGoldFullRoundsLeft,
              taxVaultCtx(movingColor),
            );
          }
        }
        setPrizeFirstCaptureOfGameDone(true);
      }

      if (augmentSpellBlockedFor && movingColor === augmentSpellBlockedFor)
        setAugmentSpellBlockedFor(null);

      finalGame = expireLittleBigManAfterHalfMove(
        finalGame,
        movingColor,
        newTurnCount,
        whiteTurnCount,
        blackTurnCount,
      );

      setGame(finalGame);

      const milestoneTriggers: AugmentTrigger[] = [];
      if (capturedType && !victimWasMercenary) {
        const ms = movingColor === "white" ? whiteMilestones : blackMilestones;
        const triggered = checkNewMilestone(capturedType, ms);
        if (triggered) {
          const newMs = applyMilestone(triggered, ms);
          if (movingColor === "white") setWhiteMilestones(newMs);
          else setBlackMilestones(newMs);
          milestoneTriggers.push({
            color: movingColor,
            reason: "milestone",
            milestoneType: triggered,
          });
        }
      }
      if (capturedType && playerAugs.some((a) => a.id === "bloodlust")) {
        const newCount =
          (movingColor === "white" ? whiteCaptureCount : blackCaptureCount) + 1;
        if (movingColor === "white") setWhiteCaptureCount(newCount);
        else setBlackCaptureCount(newCount);
        const nextThreshold =
          movingColor === "white" ? whiteBloodlustNext : blackBloodlustNext;
        if (newCount >= nextThreshold) {
          const blLevel = getImproveLevel(moverLevels, "bloodlust");
          const threshold = getBloodlustThreshold(blLevel);
          if (movingColor === "white")
            setWhiteBloodlustNext(newCount + threshold);
          else setBlackBloodlustNext(newCount + threshold);
          const picks = getBloodlustPickCount(blLevel);
          for (let i = 0; i < picks; i++)
            milestoneTriggers.push({ color: movingColor, reason: "bloodlust" });
        }
      } else if (capturedType) {
        const newCount =
          (movingColor === "white" ? whiteCaptureCount : blackCaptureCount) + 1;
        if (movingColor === "white") setWhiteCaptureCount(newCount);
        else setBlackCaptureCount(newCount);
      }

      if (promotion) {
        milestoneTriggers.push({ color: movingColor, reason: "promotion" });
      }
      if (
        capturedType === "Q" &&
        !victimWasMercenary &&
        peaceTreatyRoundsLeft <= 0
      ) {
        milestoneTriggers.push({
          color: movingColor,
          reason: "queen-capture",
        });
      }

      const blindEligible =
        capturedType === "N" &&
        !victimWasMercenary &&
        roundsSoFar < 4 &&
        playerAugs.some((a) => a.id === "blind-rage");
      const brDone =
        movingColor === "white" ? whiteBlindRageDone : blackBlindRageDone;
      if (tutorialMode && tutorialEmit && tutorialMatchMove(from, to, tutorialRestrictions)) {
        tutorialEmit({ type: "move", from, to });
      }

      if (blindEligible && !brDone && !tutorialMode) {
        if (movingColor === "white") setWhiteBlindRageDone(true);
        else setBlackBlindRageDone(true);
        triggersAfterBlindRageRef.current = [
          ...eventAugmentTriggers,
          ...milestoneTriggers,
        ];
        const wAugs0 =
          movingColor === "white" ? [...whiteAugments] : whiteAugments;
        const bAugs0 =
          movingColor === "black" ? [...blackAugments] : blackAugments;
        const pAugsForRoll = movingColor === "white" ? wAugs0 : bAugs0;
        setBlindRagePickColor(movingColor);
        setBlindRagePickSlot(moverSlot);
        setBlindRageOffered(
          rollBonusAugments(pickAugmentCount(pAugsForRoll), pAugsForRoll),
        );
      } else if (
        (eventAugmentTriggers.length > 0 || milestoneTriggers.length > 0) &&
        !tutorialMode
      ) {
        const allBonusTriggers = [
          ...eventAugmentTriggers,
          ...milestoneTriggers,
        ];
        const [first, ...rest] = allBonusTriggers;
        setAugmentPickSlot(
          gameIs2v2
            ? first.color === "white"
              ? "white1"
              : "black1"
            : null,
        );
        showTrigger(first, whiteAugments, blackAugments);
        if (rest.length > 0) setAugmentQueue((prev) => [...prev, ...rest]);
      }
      requestSnapshot();
    },
    [
      game,
      frozenSquare,
      frozenExpireAfter,
      whiteTurnCount,
      blackTurnCount,
      whiteAugments,
      blackAugments,
      whiteMilestones,
      blackMilestones,
      whiteIcUsed,
      blackIcUsed,
      whiteCaptureCount,
      blackCaptureCount,
      whiteBloodlustNext,
      blackBloodlustNext,
      deathNoteTargets,
      peaceTreatyRoundsLeft,
      nextEventTurn,
      activeNuke,
      coldWindsMovesLeft,
      coldWindsSquares,
      whiteContractTarget,
      blackContractTarget,
      whiteContractPieceId,
      blackContractPieceId,
      wallMovesLeft,
      wallSquares,
      blessedSquares,
      activePuppetColor,
      activePuppetSquare,
      chaosEventTiming,
      chaosPoolRestricted,
      hillPawnTimers,
      taxVaultCtx,
      requestSnapshot,
      whiteIlkkanId,
      blackIlkkanId,
      prizeFirstCaptureOfGameDone,
      whiteDoubleGoldFullRoundsLeft,
      blackDoubleGoldFullRoundsLeft,
      whiteBlindRageDone,
      blackBlindRageDone,
      whiteEvadeCharges,
      blackEvadeCharges,
      augmentSpellBlockedFor,
      whitePawnShopBuys,
      blackPawnShopBuys,
      blindRagePickColor,
      blindRageOffered,
      tutorialMode,
      tutorialEmit,
      tutorialRestrictions,
      activeApocalypse,
      exhaustedEventIds,
      nextAuctionTurn,
      whiteAugmentLevels,
      blackAugmentLevels,
      grantPickedEffects,
      applyImproveSideEffects,
      showTrigger,
      gameIs2v2,
    ],
  );

  useEffect(() => {
    executeMoveRef.current = executeMove;
  }, [executeMove]);

  useEffect(() => {
    if (!tutorialMode) {
      registerTutorialBridge(null);
      return;
    }
    const bridge: TutorialBridge = {
      getPhase: () => phase,
      setPhase,
      setOfferedToWhite,
      setShopOpen,
      setGoldWhite: (gold) =>
        setGame((g) => ({ ...g, goldWhite: gold })),
      getTurn: () => game.turn,
      getWhiteWhatUsed: () => whiteWhatUsed,
      executeScriptedMove: (from, to) => executeMoveRef.current(from, to),
      findWhiteDPawnSquare: () => {
        const db = getDerivedBoard(game);
        for (let r = 0; r < db.length; r++) {
          for (let c = 0; c < (db[r]?.length ?? 0); c++) {
            const p = db[r][c];
            if (p?.type === "P" && p.color === "white" && c === 3) return [r, c];
          }
        }
        return null;
      },
    };
    registerTutorialBridge(bridge);
    return () => registerTutorialBridge(null);
  }, [
    tutorialMode,
    phase,
    game,
    whiteWhatUsed,
    registerTutorialBridge,
    setPhase,
    setOfferedToWhite,
    setShopOpen,
  ]);

  // ── Undo ─────────────────────────────────────────────────────────────────

  const handleUndo = useCallback(() => {
    if (gameHistory.length < 2) return;
    const restored = gameHistory[gameHistory.length - 2];
    const augRestored = augmentHistory[augmentHistory.length - 2];
    setGame(restored);
    setBoardSize(restored.occupancy.length);
    setGameHistory((h) => h.slice(0, -2));
    setAugmentHistory((h) => h.slice(0, -2));
    triggersAfterBlindRageRef.current = [];
    if (augRestored) {
      setWhiteDomainUsed(augRestored.whiteDomainUsed ?? false);
      setBlackDomainUsed(augRestored.blackDomainUsed ?? false);
      setFrozenSquare(augRestored.frozenSquare);
      setFrozenExpireAfter(augRestored.frozenExpireAfter);
      setFrozenTurnsLeft(augRestored.frozenTurnsLeft ?? 0);
      setWhiteAugmentLevels(augRestored.whiteAugmentLevels ?? {});
      setBlackAugmentLevels(augRestored.blackAugmentLevels ?? {});
      setWhiteJewPawnLosses(augRestored.whiteJewPawnLosses ?? 0);
      setBlackJewPawnLosses(augRestored.blackJewPawnLosses ?? 0);
      setWhiteRoyalEdUsesLeft(augRestored.whiteRoyalEdUsesLeft ?? 0);
      setBlackRoyalEdUsesLeft(augRestored.blackRoyalEdUsesLeft ?? 0);

      setDeathNoteTargets(normalizeDeathNoteTargets(augRestored.deathNoteTargets));
      setActivePuppetSquare(augRestored.activePuppetSquare);
      setActivePuppetColor(augRestored.activePuppetColor);
      setWhiteContractTarget(augRestored.whiteContractTarget);
      setBlackContractTarget(augRestored.blackContractTarget);
      setWhiteContractPieceId(augRestored.whiteContractPieceId ?? null);
      setBlackContractPieceId(augRestored.blackContractPieceId ?? null);
      setWhiteIlkkanId(augRestored.whiteIlkkanId);
      setBlackIlkkanId(augRestored.blackIlkkanId);
      setBlessedSquares(augRestored.blessedSquares);
      setColdWindsSquares(augRestored.coldWindsSquares);
      setColdWindsMovesLeft(augRestored.coldWindsMovesLeft);
      setWallSquares(augRestored.wallSquares);
      setWallMovesLeft(augRestored.wallMovesLeft);
      setActiveNuke(augRestored.activeNuke);
      setPeaceTreatyRoundsLeft(augRestored.peaceTreatyRoundsLeft);
      setWhiteLostPawnCols(augRestored.whiteLostPawnCols);
      setBlackLostPawnCols(augRestored.blackLostPawnCols);
      setWhiteCaptureCount(augRestored.whiteCaptureCount);
      setBlackCaptureCount(augRestored.blackCaptureCount);
      setWhiteBloodlustNext(augRestored.whiteBloodlustNext);
      setBlackBloodlustNext(augRestored.blackBloodlustNext);
      setWhiteLostMinors(augRestored.whiteLostMinors);
      setBlackLostMinors(augRestored.blackLostMinors);
      setNextEventTurn(augRestored.nextEventTurn);
      setChaosEventTiming(
        typeof (augRestored as { chaosEventTiming?: boolean }).chaosEventTiming ===
          "boolean"
          ? (augRestored as { chaosEventTiming: boolean }).chaosEventTiming
          : (augRestored as { eventInterval?: number }).eventInterval === 10,
      );
      setChaosPoolRestricted(
        (augRestored as { chaosPoolRestricted?: boolean }).chaosPoolRestricted ??
          false,
      );
      setWhiteTaxVault(
        (augRestored as { whiteTaxVault?: number }).whiteTaxVault ?? 0,
      );
      setBlackTaxVault(
        (augRestored as { blackTaxVault?: number }).blackTaxVault ?? 0,
      );
      setHillPawnTimers(
        (augRestored as { hillPawnTimers?: { pieceId: string; fullRoundsLeft: number }[] })
          .hillPawnTimers ?? [],
      );
      setPrizeFirstCaptureOfGameDone(
        (augRestored as { prizeFirstCaptureOfGameDone?: boolean })
          .prizeFirstCaptureOfGameDone ?? false,
      );
      setWhiteBlindRageDone(
        (augRestored as { whiteBlindRageDone?: boolean }).whiteBlindRageDone ??
          false,
      );
      setBlackBlindRageDone(
        (augRestored as { blackBlindRageDone?: boolean }).blackBlindRageDone ??
          false,
      );
      setWhiteEvadeCharges(
        (augRestored as { whiteEvadeCharges?: number }).whiteEvadeCharges ?? 0,
      );
      setBlackEvadeCharges(
        (augRestored as { blackEvadeCharges?: number }).blackEvadeCharges ?? 0,
      );
      setAugmentSpellBlockedFor(
        (augRestored as { augmentSpellBlockedFor?: Color | null })
          .augmentSpellBlockedFor ?? null,
      );
      setWhitePawnShopBuys(
        (augRestored as { whitePawnShopBuys?: number }).whitePawnShopBuys ?? 0,
      );
      setBlackPawnShopBuys(
        (augRestored as { blackPawnShopBuys?: number }).blackPawnShopBuys ?? 0,
      );
      setBlindRagePickColor(
        (augRestored as { blindRagePickColor?: Color | null })
          .blindRagePickColor ?? null,
      );
      setBlindRageOffered(
        (augRestored as { blindRageOffered?: Augment[] }).blindRageOffered ?? [],
      );
      setWhiteDoubleGoldFullRoundsLeft(
        (augRestored as { whiteDoubleGoldFullRoundsLeft?: number })
          .whiteDoubleGoldFullRoundsLeft ?? 0,
      );
      setBlackDoubleGoldFullRoundsLeft(
        (augRestored as { blackDoubleGoldFullRoundsLeft?: number })
          .blackDoubleGoldFullRoundsLeft ?? 0,
      );
      setWhiteBloodbendingCharges(
        (augRestored as { whiteBloodbendingCharges?: number })
          .whiteBloodbendingCharges ?? 0,
      );
      setBlackBloodbendingCharges(
        (augRestored as { blackBloodbendingCharges?: number })
          .blackBloodbendingCharges ?? 0,
      );
      setWhiteBloodbendingPlusCharges(
        (augRestored as { whiteBloodbendingPlusCharges?: number })
          .whiteBloodbendingPlusCharges ?? 0,
      );
      setBlackBloodbendingPlusCharges(
        (augRestored as { blackBloodbendingPlusCharges?: number })
          .blackBloodbendingPlusCharges ?? 0,
      );
      setWhiteNecroPPCharges(
        (augRestored as { whiteNecroPPCharges?: number })
          .whiteNecroPPCharges ?? 0,
      );
      setBlackNecroPPCharges(
        (augRestored as { blackNecroPPCharges?: number })
          .blackNecroPPCharges ?? 0,
      );
      setWhiteLittleBigManCharges(
        (augRestored as { whiteLittleBigManCharges?: number })
          .whiteLittleBigManCharges ?? 0,
      );
      setBlackLittleBigManCharges(
        (augRestored as { blackLittleBigManCharges?: number })
          .blackLittleBigManCharges ?? 0,
      );
    }
    setSelected(null);
    setValidMoves([]);
    setFreezeMode(false);
    setNecroMode(false);
    setNecroPlusMode(false);
    setNecroPPMode(false);
    setLittleBigManMode(false);
    setBloodbendingMode(false);
    setBloodbendingPlusMode(false);
    setRoyalEdMode(false);
    setWhatMode(false);
    setWhatSelected(null);
    if (game.turn === "white") {
      setWhiteUndosLeft((u) => u - 1);
      setWhiteTurnCount((c) => Math.max(0, c - 1));
      setBlackTurnCount((c) => Math.max(0, c - 1));
    } else {
      setBlackUndosLeft((u) => u - 1);
      setBlackTurnCount((c) => Math.max(0, c - 1));
      setWhiteTurnCount((c) => Math.max(0, c - 1));
    }
  }, [game, gameHistory, augmentHistory]);

  // ── Mode toggles ─────────────────────────────────────────────────────────

  const clearModes = (opts?: { preserveIlkkan?: boolean; preserveSwap?: boolean }) => {
    setFreezeMode(false);
    setNecroMode(false);
    setNecroPlusMode(false);
    setBloodbendingMode(false);
    if (!opts?.preserveIlkkan) setIlkkanMode(false);
    setRoyalEdMode(false);
    setWhatMode(false);
    setWhatSelected(null);
    setSakoMode(false);
    setSakoSelected(null);
    if (!opts?.preserveSwap) {
      setSwapMode(false);
      setSwapFirst(null);
    }
    setRoyalHouseholdMode(false);
    setDeathNoteMode(false);
    setMonolithMode(null);
    setContractMode(false);
    setBlessedWaterMode(false);
    setPuppetMode(false);
    setPawnPlaceFor(null);
    setBloodbendingPlusMode(false);
    setNecroPPMode(false);
    setLittleBigManMode(false);
    setSacrificeMode(false);
  };

  const handleToggleFreeze = useCallback(() => {
    const e = !freezeMode;
    clearModes();
    setFreezeMode(e);
  }, [freezeMode]);
  const handleToggleBloodbending = useCallback(() => {
    const e = !bloodbendingMode;
    clearModes();
    setBloodbendingMode(e);
  }, [bloodbendingMode]);
  const handleToggleBloodbendingPlus = useCallback(() => {
    const e = !bloodbendingPlusMode;
    clearModes();
    setBloodbendingPlusMode(e);
  }, [bloodbendingPlusMode]);
  const handleToggleLittleBigMan = useCallback(() => {
    const entering = !littleBigManMode;
    clearModes();
    setLittleBigManMode(entering);
    if (entering) {
      const bs = getDerivedBoard(game).length;
      const pawns: [number, number][] = [];
      getDerivedBoard(game).forEach((row, r) =>
        row.forEach((p, c) => {
          if (p?.type === "P" && p.color === game.turn && p.id)
            pawns.push([r, c]);
        }),
      );
      setValidMoves(pawns);
      if (pawns.length === 0) setLittleBigManMode(false);
    }
  }, [littleBigManMode, game]);
  const handleToggleSacrifice = useCallback(() => {
    const entering = !sacrificeMode;
    clearModes();
    setSacrificeMode(entering);
    if (entering) {
      const rooks: [number, number][] = [];
      getDerivedBoard(game).forEach((row, r) =>
        row.forEach((p, c) => {
          if (p?.type === "R" && p.color === game.turn) rooks.push([r, c]);
        }),
      );
      setValidMoves(rooks);
      if (rooks.length === 0) setSacrificeMode(false);
    }
  }, [sacrificeMode, game]);
  const handleToggleNecro = useCallback(() => {
    const entering = !necroMode;
    clearModes();
    setNecroMode(entering);
    if (entering) {
      const lostCols =
        game.turn === "white" ? whiteLostPawnCols : blackLostPawnCols;
      const bs = getDerivedBoard(game).length;
      const off = (bs - 8) / 2;
      const homeRow = game.turn === "white" ? 6 + off : 1 + off;
      setValidMoves(
        lostCols
          .filter((col) => getDerivedBoard(game)[homeRow] && !getDerivedBoard(game)[homeRow][col])
          .map((col) => [homeRow, col] as [number, number]),
      );
    }
  }, [necroMode, game, whiteLostPawnCols, blackLostPawnCols]);
  const handleToggleRoyalEd = useCallback(() => {
    const entering = !royalEdMode;
    clearModes();
    setRoyalEdMode(entering);
    if (entering) {
      const { kingPos, dests } = getRoyalEdMoves(game, game.turn);
      if (dests.length > 0) {
        setSelected(kingPos);
        setValidMoves(dests);
      } else setRoyalEdMode(false);
    }
  }, [royalEdMode, game]);
  const handleToggleWhat = useCallback(() => {
    const e = !whatMode;
    clearModes();
    setWhatMode(e);
  }, [whatMode]);
  const handleToggleSako = useCallback(() => {
    const e = !sakoMode;
    clearModes();
    setSakoMode(e);
  }, [sakoMode]);
  const handleToggleSwap = useCallback(() => {
    const entering = !swapMode;
    clearModes({ preserveSwap: true });
    setSwapMode(entering);
    if (entering) {
      const bs = getDerivedBoard(game);
      const isCw = (rr: number, cc: number) =>
        coldWindsMovesLeft > 0 &&
        coldWindsSquares.some(([fr, fc]) => fr === rr && fc === cc);
      const sqBlocked = (rr: number, cc: number) => {
        const p2 = bs[rr][cc];
        if (!p2 || p2.color !== game.turn) return true;
        if (frozenSquare?.[0] === rr && frozenSquare?.[1] === cc) return true;
        if (isCw(rr, cc)) return true;
        return false;
      };
      const own: [number, number][] = [];
      bs.forEach((row, rr) =>
        row.forEach((p, cc) => {
          if (p && p.color === game.turn && !sqBlocked(rr, cc)) own.push([rr, cc]);
        }),
      );
      if (own.length < 2) {
        setSwapMode(false);
        setValidMoves([]);
        return;
      }
      setValidMoves(own);
    }
  }, [swapMode, game, frozenSquare, coldWindsMovesLeft, coldWindsSquares]);
  const handleToggleRoyalHousehold = useCallback(() => {
    const entering = !royalHouseholdMode;
    clearModes();
    setRoyalHouseholdMode(entering);
    if (entering) {
      const dests = getRoyalHouseholdDests(game, game.turn);
      if (dests.length > 0) {
        setValidMoves(dests);
      } else setRoyalHouseholdMode(false);
    }
  }, [royalHouseholdMode, game]);
  const handleToggleShop = useCallback(() => {
    setShopOpen((s) => !s);
    clearModes();
  }, []);
  const handleToggleDeathNote = useCallback(() => {
    const e = !deathNoteMode;
    clearModes();
    setDeathNoteMode(e);
  }, [deathNoteMode]);
  const handleToggleMonolithPlace = useCallback(() => {
    const e = monolithMode !== "place";
    clearModes();
    if (e) setMonolithMode("place");
  }, [monolithMode]);
  const handleToggleMonolithRemove = useCallback(() => {
    const e = monolithMode !== "remove";
    clearModes();
    if (e) setMonolithMode("remove");
  }, [monolithMode]);
  const handleToggleIlkkan = useCallback(() => {
    const entering = !ilkkanMode;
    clearModes({ preserveIlkkan: true });
    setIlkkanMode(entering);
    if (entering) {
      const pawns: [number, number][] = [];
      getDerivedBoard(game).forEach((row, r) =>
        row.forEach((p, c) => {
          if (p?.type === "P" && p.color === game.turn) pawns.push([r, c]);
        }),
      );
      setValidMoves(pawns);
    }
  }, [ilkkanMode, game]);
  const handleToggleNecroPlus = useCallback(() => {
    const entering = !necroPlusMode;
    clearModes();
    setNecroPlusMode(entering);
    if (entering) {
      const _bs = getDerivedBoard(game).length;
      const _off = (_bs - 8) / 2;
      const backRow = game.turn === "white" ? 7 + _off : _off;
      const validSquares: [number, number][] = [];
      for (let c = 0; c < _bs; c++)
        if (!getDerivedBoard(game)[backRow]?.[c]) validSquares.push([backRow, c]);
      setValidMoves(validSquares);
    }
  }, [necroPlusMode, game]);
  const handleToggleNecroPP = useCallback(() => {
    const entering = !necroPPMode;
    clearModes();
    setNecroPPMode(entering);
    if (entering) {
      const _bs = getDerivedBoard(game).length;
      const _off = (_bs - 8) / 2;
      const backRow = game.turn === "white" ? 7 + _off : _off;
      const validSquares: [number, number][] = [];
      for (let c = 0; c < _bs; c++)
        if (!getDerivedBoard(game)[backRow]?.[c]) validSquares.push([backRow, c]);
      setValidMoves(validSquares);
    }
  }, [necroPPMode, game]);
  const handleToggleContract = useCallback(() => {
    const e = !contractMode;
    clearModes();
    setContractMode(e);
  }, [contractMode]);
  const handleToggleBlessedWater = useCallback(() => {
    const e = !blessedWaterMode;
    clearModes();
    setBlessedWaterMode(e);
  }, [blessedWaterMode]);
  const handleTogglePuppet = useCallback(() => {
    const e = !puppetMode;
    clearModes();
    setPuppetMode(e);
  }, [puppetMode]);
  const handleDomainExpansion = useCallback(() => {
    const curRows = getBoardRows(game);
    const curCols = getBoardCols(game);
    const expander = game.turn === "black" ? "black" : "white";
    if (expander === "white" && whiteDomainUsed) return;
    if (expander === "black" && blackDomainUsed) return;

    let expanded: ChessState;
    if (gameIs2v2) {
      if (curRows >= 12 && curCols >= 20) return;
      const tier = curRows === 8 && curCols === 16 ? 1 : 2;
      expanded = expandGameBoard2v2(game, expander, tier);
      setBoardSize(curRows + 2);
    } else {
      if (curRows >= 12) return;
      expanded = expandGameBoard(game, expander);
      setBoardSize(curRows + 2);
    }
    setGame(recomputeStatus(expanded));
    if (game.turn === "white") setWhiteDomainUsed(true);
    else setBlackDomainUsed(true);
    if (frozenSquare)
      setFrozenSquare([frozenSquare[0] + 1, frozenSquare[1] + 1]);
    const expBoard = getDerivedBoard(expanded);
    if (whiteContractPieceId) {
      const p = findSquareByPieceId(expBoard, whiteContractPieceId);
      if (p) setWhiteContractTarget(p);
    }
    if (blackContractPieceId) {
      const p = findSquareByPieceId(expBoard, blackContractPieceId);
      if (p) setBlackContractTarget(p);
    }
    setActiveNuke((prev) =>
      prev
        ? { ...prev, topRow: prev.topRow + 1, leftCol: prev.leftCol + 1 }
        : null,
    );
    setBlessedSquares((prev) =>
      prev.map((b) => ({ ...b, row: b.row + 1, col: b.col + 1 })),
    );
    setColdWindsSquares((prev) =>
      prev.map(([r2, c2]) => [r2 + 1, c2 + 1] as [number, number]),
    );
    setWallSquares((prev) =>
      prev.map((w) => ({ row: w.row + 1, col: w.col + 1 })),
    );
    if (activePuppetSquare)
      setActivePuppetSquare([
        activePuppetSquare[0] + 1,
        activePuppetSquare[1] + 1,
      ]);
    setWhiteLostPawnCols((prev) => prev.map((c) => c + 1));
    setBlackLostPawnCols((prev) => prev.map((c) => c + 1));
    if (selected) setSelected([selected[0] + 1, selected[1] + 1]);
    if (sakoSelected)
      setSakoSelected([sakoSelected[0] + 1, sakoSelected[1] + 1]);
    if (swapFirst)
      setSwapFirst([swapFirst[0] + 1, swapFirst[1] + 1]);
    if (whatSelected)
      setWhatSelected([whatSelected[0] + 1, whatSelected[1] + 1]);
    setValidMoves((prev) => prev.map(([r, c]) => [r + 1, c + 1]));
    clearModes();
  }, [
    game,
    whiteDomainUsed,
    blackDomainUsed,
    frozenSquare,
    selected,
    sakoSelected,
    whatSelected,
    activePuppetSquare,
    swapFirst,
    whiteContractPieceId,
    blackContractPieceId,
  ]);

  // ── Square click ─────────────────────────────────────────────────────────

  const isMyTurn = tutorialMode
    ? game.turn === "white"
    : !mpConfig ||
      (gameIs2v2 && mpConfig.mySlot
        ? game.turnSlot === mpConfig.mySlot
        : game.turn === mpConfig.myColor);

  const handleSquareClick = useCallback(
    (r: number, c: number) => {
      if (phase !== "playing" || currentTrigger !== null || blindRagePickColor)
        return;
      if (activeAuction?.status === "active" && !auctionPlaceFor) return;
      if (tutorialMode && tutorialBlocksBoard(tutorialRestrictions)) return;
      if (!isMyTurn) return;
      if (game.teamStatus && game.teamStatus !== "playing") return;
      if (game.status === "checkmate" || game.status === "stalemate") return;
      if (promotionPending) return;
      const piece = getDerivedBoard(game)[r][c];

      if (auctionPlaceFor) {
        const ap = auctionPlaceFor;
        const isLocalPlacer = !mpConfig || mpConfig.myColor === ap.color;
        if (!isLocalPlacer) return;
        const rows = getBoardRows(game);
        const cols = getBoardCols(game);
        const canPlacePawn =
          ap.pieceType === "P" &&
          !piece &&
          isOriginalPawnSpawnSquare(r, c, ap.color, rows) &&
          !isPermaFrostSquare(game, r, c);
        const canPlaceOther =
          ap.pieceType !== "P" &&
          !piece &&
          !isPermaFrostSquare(game, r, c);
        if (canPlacePawn || canPlaceOther) {
          const nb = cloneBoard(getDerivedBoard(game));
          if (gameIs2v2) {
            const slot = ap.color === "white" ? "white1" : "black1";
            nb[r][c] = summonedPiece(ap.pieceType, slot);
          } else {
            nb[r][c] = { type: ap.pieceType, color: ap.color };
          }
          setGame(recomputeStatus(syncStateFromBoard({ ...game }, nb)));
          setAuctionPlaceFor(null);
          setSelected(null);
          setValidMoves([]);
          requestSnapshot();
        }
        return;
      }

      if (pawnPlaceSlot || (pawnPlaceFor && game.turn === pawnPlaceFor)) {
        const rows = getBoardRows(game);
        const cols = getBoardCols(game);
        const canPlace2v2 =
          pawnPlaceSlot &&
          !piece &&
          isPawnSpawnSquareForSlot(r, c, pawnPlaceSlot, rows, cols) &&
          !isPermaFrostSquare(game, r, c);
        const canPlace1v1 =
          pawnPlaceFor &&
          game.turn === pawnPlaceFor &&
          !piece &&
          isOriginalPawnSpawnSquare(r, c, pawnPlaceFor, rows) &&
          !isPermaFrostSquare(game, r, c);
        if (canPlace2v2 || canPlace1v1) {
          const nb = cloneBoard(getDerivedBoard(game));
          if (pawnPlaceSlot) {
            nb[r][c] = summonedPiece("P", pawnPlaceSlot);
          } else if (pawnPlaceFor) {
            nb[r][c] = { type: "P", color: pawnPlaceFor };
          }
          setGame(recomputeStatus(syncStateFromBoard({ ...game }, nb)));
          setPawnPlaceFor(null);
          setPawnPlaceSlot(null);
          setSelected(null);
          setValidMoves([]);
          requestSnapshot();
        } else {
          setSelected(null);
          setValidMoves([]);
        }
        return;
      }

      if (monolithMode === "place") {
        if (!piece && !isPermaFrostSquare(game, r, c)) {
          const movingColor = game.turn;
          const nb = cloneBoard(getDerivedBoard(game));
          nb[r][c] =
            gameIs2v2 && game.turnSlot
              ? summonedPiece("M", game.turnSlot)
              : { type: "M", color: movingColor };
          const newTurnCount =
            (movingColor === "white" ? whiteTurnCount : blackTurnCount) + 1;
          if (movingColor === "white") setWhiteTurnCount(newTurnCount);
          else setBlackTurnCount(newTurnCount);
          const playerAugsNow =
            movingColor === "white" ? whiteAugments : blackAugments;
          setGameHistory((h) => [...h, game]);
          setAugmentHistory((h) => [...h, captureAugmentSnapshot()]);
          let newGState: ChessState = syncStateFromBoard(
            {
              ...game,
              turn: opp(movingColor),
              enPassantTarget: null,
              lastMove: {
                from: [r, c] as [number, number],
                to: [r, c] as [number, number],
                piece: { type: "M" as const, color: movingColor },
                captured: null,
              },
            },
            nb,
          );
          newGState = applyEndOfTurnEffects(
            newGState,
            movingColor,
            playerAugsNow,
            newTurnCount,
            whiteAugments,
            blackAugments,
            whiteDoubleGoldFullRoundsLeft,
            blackDoubleGoldFullRoundsLeft,
            movingColor === "white" ? whiteAugmentLevels : blackAugmentLevels,
            taxVaultCtx(movingColor),
          );
          newGState = recomputeStatus(
            expireLittleBigManAfterHalfMove(
              newGState,
              movingColor,
              newTurnCount,
              whiteTurnCount,
              blackTurnCount,
            ),
          );
          setGame(newGState);
        }
        setMonolithMode(null);
        setSelected(null);
        setValidMoves([]);
        requestSnapshot();
        return;
      }

      if (monolithMode === "remove") {
        if (piece?.type === "M" && piece.color === game.turn) {
          const nb = cloneBoard(getDerivedBoard(game));
          nb[r][c] = null;
          setGame((g) => recomputeStatus(syncStateFromBoard({ ...g }, nb)));
          if (game.turn === "white") setWhiteMonolithPermRemoved(true);
          else setBlackMonolithPermRemoved(true);
        }
        setMonolithMode(null);
        setSelected(null);
        setValidMoves([]);
        requestSnapshot();
        return;
      }

      if (sacrificeMode) {
        if (piece && piece.type === "R" && piece.color === game.turn) {
          const nb = cloneBoard(getDerivedBoard(game));
          nb[r][c] = null;
          const color = game.turn;
          setGame(recomputeStatus(syncStateFromBoard({ ...game }, nb)));
          if (color === "white")
            setWhiteAugments((prev) => prev.filter((a) => a.id !== "sacrifice"));
          else
            setBlackAugments((prev) => prev.filter((a) => a.id !== "sacrifice"));
          setSacrificeMode(false);
          const newWAugs =
            color === "white"
              ? whiteAugments.filter((a) => a.id !== "sacrifice")
              : whiteAugments;
          const newBAugs =
            color === "black"
              ? blackAugments.filter((a) => a.id !== "sacrifice")
              : blackAugments;
          const trigger: AugmentTrigger = {
            color,
            reason: "event",
            eventRollFilter: { minRarity: "rare" },
          };
          setAugmentPickSlot(
            gameIs2v2 ? (color === "white" ? "white1" : "black1") : null,
          );
          showTrigger(trigger, newWAugs, newBAugs);
          setSelected(null);
          setValidMoves([]);
          requestSnapshot();
        }
        return;
      }

      if (littleBigManMode) {
        if (
          piece &&
          piece.type === "P" &&
          piece.color === game.turn &&
          piece.id
        ) {
          const fullR = Math.min(whiteTurnCount, blackTurnCount) + 4;
          const pid = piece.id;
          setGame((g) =>
            game.turn === "white"
              ? {
                  ...g,
                  littleBigManWhiteId: pid,
                  littleBigManWhiteExpiresAtFullRound: fullR,
                }
              : {
                  ...g,
                  littleBigManBlackId: pid,
                  littleBigManBlackExpiresAtFullRound: fullR,
                },
          );
          if (game.turn === "white") setWhiteLittleBigManCharges((n) => n - 1);
          else setBlackLittleBigManCharges((n) => n - 1);
          requestSnapshot();
        }
        setLittleBigManMode(false);
        setSelected(null);
        setValidMoves([]);
        return;
      }

      if (ilkkanMode) {
        if (
          piece &&
          piece.type === "P" &&
          piece.color === game.turn &&
          piece.id
        ) {
          if (game.turn === "white") {
            setWhiteIlkkanId(piece.id);
            setWhiteIlkkanChosen(true);
          } else {
            setBlackIlkkanId(piece.id);
            setBlackIlkkanChosen(true);
          }
        }
        setIlkkanMode(false);
        setSelected(null);
        setValidMoves([]);
        requestSnapshot();
        return;
      }

      if (necroPPMode) {
        const playerColor = game.turn;
        const _bs = getDerivedBoard(game).length;
        const _off = (_bs - 8) / 2;
        const backRow = playerColor === "white" ? 7 + _off : _off;
        if (r === backRow && !getDerivedBoard(game)[r][c]) {
          const nb = cloneBoard(getDerivedBoard(game));
          const slot = gameIs2v2 && game.turnSlot ? game.turnSlot : null;
          nb[r][c] = slot
            ? summonedPiece("Q", slot)
            : { type: "Q", color: playerColor };
          const newGState = recomputeStatus(
            syncStateFromBoard(
              {
                ...game,
                turn: opp(playerColor),
              },
              nb,
            ),
          );
          setGameHistory((h) => [...h, game]);
          setAugmentHistory((h) => [...h, captureAugmentSnapshot()]);
          setGame(newGState);
          if (playerColor === "white") setWhiteNecroPPCharges((n) => n - 1);
          else setBlackNecroPPCharges((n) => n - 1);
          requestSnapshot();
        }
        setNecroPPMode(false);
        setSelected(null);
        setValidMoves([]);
        return;
      }

      if (necroPlusMode) {
        const playerColor = game.turn;
        const _bs = getDerivedBoard(game).length;
        const _off = (_bs - 8) / 2;
        const backRow = playerColor === "white" ? 7 + _off : _off;
        const lostMinorsArr =
          playerColor === "white" ? whiteLostMinors : blackLostMinors;
        if (r === backRow && !getDerivedBoard(game)[r][c] && lostMinorsArr.length > 0) {
          const pieceType = lostMinorsArr[lostMinorsArr.length - 1];
          const nb = cloneBoard(getDerivedBoard(game));
          const slot = gameIs2v2 && game.turnSlot ? game.turnSlot : null;
          nb[r][c] = slot
            ? summonedPiece(pieceType, slot)
            : { type: pieceType, color: playerColor };
          const newGState = recomputeStatus(
            syncStateFromBoard(
              {
                ...game,
                turn: opp(playerColor),
              },
              nb,
            ),
          );
          setGameHistory((h) => [...h, game]);
          setAugmentHistory((h) => [...h, captureAugmentSnapshot()]);
          setGame(newGState);
          if (playerColor === "white") {
            setWhiteLostMinors((prev) => {
              const idx = prev.lastIndexOf(pieceType);
              if (idx === -1) return prev;
              const next = [...prev];
              next.splice(idx, 1);
              return next;
            });
            setWhiteNecroPlusCharges((n) => n - 1);
          } else {
            setBlackLostMinors((prev) => {
              const idx = prev.lastIndexOf(pieceType);
              if (idx === -1) return prev;
              const next = [...prev];
              next.splice(idx, 1);
              return next;
            });
            setBlackNecroPlusCharges((n) => n - 1);
          }
          requestSnapshot();
        }
        setNecroPlusMode(false);
        setSelected(null);
        setValidMoves([]);
        return;
      }

      if (contractMode) {
        if (
          piece &&
          piece.color !== game.turn &&
          piece.color !== "orange" &&
          piece.type !== "K" &&
          piece.type !== "P" &&
          piece.type !== "M" &&
          piece.id
        ) {
          const cid = piece.id;
          if (game.turn === "white") {
            setWhiteContractTarget([r, c]);
            setWhiteContractPieceId(cid);
          } else {
            setBlackContractTarget([r, c]);
            setBlackContractPieceId(cid);
          }
          setContractMode(false);
        }
        setSelected(null);
        setValidMoves([]);
        requestSnapshot();
        return;
      }

      if (blessedWaterMode) {
        setBlessedSquares((prev) => [
          ...prev,
          { row: r, col: c, movesLeft: getBlessedWaterMovesLeft(getImproveLevel(game.turn === "white" ? whiteAugmentLevels : blackAugmentLevels, "blessed-water-spell")) },
        ]);
        if (game.turn === "white") setWhiteBlessedWaterCharges((n) => n - 1);
        else setBlackBlessedWaterCharges((n) => n - 1);
        setBlessedWaterMode(false);
        setSelected(null);
        setValidMoves([]);
        requestSnapshot();
        return;
      }

      if (puppetMode) {
        if (
          piece &&
          piece.color !== game.turn &&
          piece.color !== "orange" &&
          piece.type !== "K" &&
          piece.type !== "M"
        ) {
          setActivePuppetSquare([r, c]);
          setActivePuppetColor(opp(game.turn));
          if (game.turn === "white") setWhitePuppetUsed(true);
          else setBlackPuppetUsed(true);
        }
        setPuppetMode(false);
        setSelected(null);
        setValidMoves([]);
        requestSnapshot();
        return;
      }

      if (deathNoteMode) {
        if (
          piece &&
          piece.color !== game.turn &&
          piece.type !== "K" &&
          piece.type !== "Q" &&
          piece.type !== "M" &&
          piece.id &&
          !isLostMercenaryPawn(piece)
        ) {
          const pid = piece.id;
          const dnLevel = getImproveLevel(
            game.turn === "white" ? whiteAugmentLevels : blackAugmentLevels,
            "death-note",
          );
          const dnTurns = getDeathNoteTurnsLeft(dnLevel);
          if (dnTurns <= 0) {
            const nb = cloneBoard(getDerivedBoard(game));
            nb[r][c] = null;
            setGame((g) => recomputeStatus(syncStateFromBoard({ ...g }, nb)));
          } else {
            setDeathNoteTargets((prev) => [
              ...prev,
              { pieceId: pid, turnsLeft: dnTurns, targetColor: piece.color },
            ]);
          }
          if (game.turn === "white") setWhiteDNUsed(true);
          else setBlackDNUsed(true);
        }
        setDeathNoteMode(false);
        setSelected(null);
        setValidMoves([]);
        requestSnapshot();
        return;
      }

      if (bloodbendingPlusMode) {
        if (
          piece &&
          piece.color !== game.turn &&
          piece.color !== "orange" &&
          (piece.type === "N" || piece.type === "B" || piece.type === "R") &&
          !blessedSquares.some((b) => b.row === r && b.col === c)
        ) {
          const nb = cloneBoard(getDerivedBoard(game));
          const flipped =
            gameIs2v2 && game.turnSlot
              ? summonedPiece(piece!.type, game.turnSlot, piece!.id)
              : { ...piece!, color: game.turn };
          nb[r][c] = flipped;
          const newG = recomputeStatus(syncStateFromBoard({ ...game }, nb));
          setGameHistory((h) => [...h, game]);
          setAugmentHistory((h) => [...h, captureAugmentSnapshot()]);
          setGame(newG);
          if (game.turn === "white") setWhiteBloodbendingPlusCharges((n) => n - 1);
          else setBlackBloodbendingPlusCharges((n) => n - 1);
          requestSnapshot();
        }
        setBloodbendingPlusMode(false);
        setSelected(null);
        setValidMoves([]);
        return;
      }

      if (bloodbendingMode) {
        const bs = getDerivedBoard(game).length;
        const enemyColor = opp(game.turn);
        if (
          piece &&
          piece.color !== game.turn &&
          piece.color !== "orange" &&
          piece.type === "P" &&
          !isOriginalPawnSpawnSquare(r, c, enemyColor, bs) &&
          !blessedSquares.some((b) => b.row === r && b.col === c)
        ) {
          const movingColor = game.turn;
          const nb = cloneBoard(getDerivedBoard(game));
          const flipped =
            gameIs2v2 && game.turnSlot
              ? summonedPiece(piece!.type, game.turnSlot, piece!.id)
              : { ...piece!, color: movingColor };
          nb[r][c] = flipped;
          const newTurnCount =
            (movingColor === "white" ? whiteTurnCount : blackTurnCount) + 1;
          if (movingColor === "white") setWhiteTurnCount(newTurnCount);
          else setBlackTurnCount(newTurnCount);
          setGameHistory((h) => [...h, game]);
          setAugmentHistory((h) => [...h, captureAugmentSnapshot()]);
          const newG = commitSpellHalfMove(
            game,
            nb,
            movingColor,
            {
              from: [r, c],
              to: [r, c],
              piece: flipped,
              captured: null,
            },
            newTurnCount,
            whiteTurnCount,
            blackTurnCount,
            whiteAugments,
            blackAugments,
            whiteDoubleGoldFullRoundsLeft,
            blackDoubleGoldFullRoundsLeft,
            movingColor === "white" ? whiteAugmentLevels : blackAugmentLevels,
            taxVaultCtx(movingColor),
          );
          setGame(newG);
          if (movingColor === "white") setWhiteBloodbendingCharges((n) => n - 1);
          else setBlackBloodbendingCharges((n) => n - 1);
          requestSnapshot();
        }
        setBloodbendingMode(false);
        setSelected(null);
        setValidMoves([]);
        return;
      }

      if (freezeMode) {
        if (piece && piece.color !== game.turn && piece.type !== "K") {
          setFrozenSquare([r, c]);
          const frostLevel = getImproveLevel(
            game.turn === "white" ? whiteAugmentLevels : blackAugmentLevels,
            "frost",
          );
          setFrozenTurnsLeft(getFrostFreezeTurns(frostLevel));
          setFrozenExpireAfter(null);
          if (game.turn === "white") setWhiteFreezeCharges((n) => n - 1);
          else setBlackFreezeCharges((n) => n - 1);
        }
        setFreezeMode(false);
        requestSnapshot();
        return;
      }

      if (necroMode) {
        const playerColor = game.turn;
        const _bs = getDerivedBoard(game).length;
        const _off = (_bs - 8) / 2;
        const homeRow = playerColor === "white" ? 6 + _off : 1 + _off;
        const lostCols =
          playerColor === "white" ? whiteLostPawnCols : blackLostPawnCols;
        if (
          lostCols.some((col) => col === c) &&
          r === homeRow &&
          !getDerivedBoard(game)[r][c]
        ) {
          const nb = cloneBoard(getDerivedBoard(game));
          const slot = gameIs2v2 && game.turnSlot ? game.turnSlot : null;
          nb[r][c] = slot
            ? summonedPiece("P", slot)
            : { type: "P", color: playerColor };
          const newGState = recomputeStatus(
            syncStateFromBoard(
              {
                ...game,
                turn: opp(playerColor),
              },
              nb,
            ),
          );
          setGameHistory((h) => [...h, game]);
          setAugmentHistory((h) => [...h, captureAugmentSnapshot()]);
          setGame(newGState);
          if (playerColor === "white") {
            setWhiteLostPawnCols((prev) => {
              const i = prev.indexOf(c);
              return i >= 0
                ? [...prev.slice(0, i), ...prev.slice(i + 1)]
                : prev;
            });
            setWhiteNecroCharges((n) => n - 1);
          } else {
            setBlackLostPawnCols((prev) => {
              const i = prev.indexOf(c);
              return i >= 0
                ? [...prev.slice(0, i), ...prev.slice(i + 1)]
                : prev;
            });
            setBlackNecroCharges((n) => n - 1);
          }
        }
        requestSnapshot();
        setNecroMode(false);
        setSelected(null);
        setValidMoves([]);
        return;
      }

      if (royalEdMode) {
        const isValid = validMoves.some(([vr, vc]) => vr === r && vc === c);
        if (isValid && selected) {
          const capturedType = getDerivedBoard(game)[r][c]?.type ?? null;
          executeMove(selected, [r, c], undefined, capturedType);
          if (game.turn === "white") setWhiteRoyalEdUsesLeft((n) => Math.max(0, n - 1));
          else setBlackRoyalEdUsesLeft((n) => Math.max(0, n - 1));
        }
        setRoyalEdMode(false);
        setSelected(null);
        setValidMoves([]);
        return;
      }

      if (swapMode) {
        const bs = getDerivedBoard(game);
        const isCwSq = (rr: number, cc: number) =>
          coldWindsMovesLeft > 0 &&
          coldWindsSquares.some(([fr, fc]) => fr === rr && fc === cc);
        const isOwnBlocked = (rr: number, cc: number) => {
          const p2 = bs[rr][cc];
          if (!p2 || p2.color !== game.turn) return true;
          if (frozenSquare?.[0] === rr && frozenSquare?.[1] === cc) return true;
          if (isCwSq(rr, cc)) return true;
          return false;
        };

        if (!swapFirst) {
          if (piece && piece.color === game.turn && !isOwnBlocked(r, c)) {
            const others: [number, number][] = [];
            bs.forEach((row, rr) =>
              row.forEach((p, cc) => {
                if (
                  p &&
                  p.color === game.turn &&
                  !(rr === r && cc === c) &&
                  !isOwnBlocked(rr, cc)
                )
                  others.push([rr, cc]);
              }),
            );
            if (others.length > 0) {
              setSwapFirst([r, c]);
              setSelected([r, c]);
              setValidMoves(others);
            } else {
              setSwapMode(false);
              setSwapFirst(null);
              setSelected(null);
              setValidMoves([]);
            }
          } else {
            setSwapMode(false);
            setSwapFirst(null);
            setSelected(null);
            setValidMoves([]);
          }
          return;
        }

        const [fr, fc] = swapFirst;
        const isValidSecond = validMoves.some(([vr, vc]) => vr === r && vc === c);
        if (isValidSecond && piece && piece.color === game.turn) {
          const nb = cloneBoard(bs);
          const pa = nb[fr][fc]!;
          const pb = nb[r][c]!;
          nb[fr][fc] = pb;
          nb[r][c] = pa;
          const cr = castlingRightsAfterSwap(game.castlingRights, nb);
          const merged = recomputeStatus(
            syncStateFromBoard(
              { ...game, enPassantTarget: null, castlingRights: cr },
              nb,
            ),
          );
          if (!isInCheck(merged, game.turn)) {
            const movingColor = game.turn;
            const newTurnCount =
              (movingColor === "white" ? whiteTurnCount : blackTurnCount) + 1;
            if (movingColor === "white") setWhiteTurnCount(newTurnCount);
            else setBlackTurnCount(newTurnCount);
            setGameHistory((h) => [...h, game]);
            setAugmentHistory((h) => [...h, captureAugmentSnapshot()]);
            const newG = commitSpellHalfMove(
              game,
              getDerivedBoard(merged),
              movingColor,
              {
                from: [fr, fc],
                to: [r, c],
                piece: pa,
                captured: null,
              },
              newTurnCount,
              whiteTurnCount,
              blackTurnCount,
              whiteAugments,
              blackAugments,
              whiteDoubleGoldFullRoundsLeft,
              blackDoubleGoldFullRoundsLeft,
              movingColor === "white" ? whiteAugmentLevels : blackAugmentLevels,
              taxVaultCtx(movingColor),
            );
            setGame(newG);
            if (movingColor === "white") setWhiteSwapUsed(true);
            else setBlackSwapUsed(true);
            requestSnapshot();
            setSwapMode(false);
            setSwapFirst(null);
            setSelected(null);
            setValidMoves([]);
          }
        } else if (
          piece &&
          piece.color === game.turn &&
          !isOwnBlocked(r, c) &&
          !(r === fr && c === fc)
        ) {
          const others: [number, number][] = [];
          bs.forEach((row, rr) =>
            row.forEach((p, cc) => {
              if (
                p &&
                p.color === game.turn &&
                !(rr === r && cc === c) &&
                !isOwnBlocked(rr, cc)
              )
                others.push([rr, cc]);
            }),
          );
          if (others.length > 0) {
            setSwapFirst([r, c]);
            setSelected([r, c]);
            setValidMoves(others);
            return;
          }
        }
        setSwapMode(false);
        setSwapFirst(null);
        setSelected(null);
        setValidMoves([]);
        return;
      }

      if (sakoMode) {
        if (!sakoSelected) {
          if (piece && piece.color === game.turn) {
            const dests = getSakoMoves(game, [r, c], game.turn);
            if (dests.length > 0) {
              setSakoSelected([r, c]);
              setSelected([r, c]);
              setValidMoves(dests);
            } else {
              setSakoMode(false);
              setSakoSelected(null);
              setSelected(null);
              setValidMoves([]);
            }
          } else {
            setSakoMode(false);
            setSakoSelected(null);
            setSelected(null);
            setValidMoves([]);
          }
          return;
        }
        const isValid = validMoves.some(([vr, vc]) => vr === r && vc === c);
        if (isValid) {
          const movingColor = game.turn;
          const movingPiece = getDerivedBoard(game)[sakoSelected[0]][sakoSelected[1]]!;
          const nb = cloneBoard(getDerivedBoard(game));
          nb[sakoSelected[0]][sakoSelected[1]] = null;
          nb[r][c] = movingPiece;
          const newTurnCount =
            (movingColor === "white" ? whiteTurnCount : blackTurnCount) + 1;
          if (movingColor === "white") setWhiteTurnCount(newTurnCount);
          else setBlackTurnCount(newTurnCount);
          setGameHistory((h) => [...h, game]);
          setAugmentHistory((h) => [...h, captureAugmentSnapshot()]);
          const newGame = commitSpellHalfMove(
            game,
            nb,
            movingColor,
            {
              from: sakoSelected,
              to: [r, c],
              piece: movingPiece,
              captured: null,
            },
            newTurnCount,
            whiteTurnCount,
            blackTurnCount,
            whiteAugments,
            blackAugments,
            whiteDoubleGoldFullRoundsLeft,
            blackDoubleGoldFullRoundsLeft,
            movingColor === "white" ? whiteAugmentLevels : blackAugmentLevels,
            taxVaultCtx(movingColor),
          );
          setGame(newGame);
          if (movingColor === "white") setWhiteSakoUsed(true);
          else setBlackSakoUsed(true);
          requestSnapshot();
        } else if (
          piece &&
          piece.color === game.turn &&
          !(r === sakoSelected[0] && c === sakoSelected[1])
        ) {
          const dests = getSakoMoves(game, [r, c], game.turn);
          if (dests.length > 0) {
            setSakoSelected([r, c]);
            setSelected([r, c]);
            setValidMoves(dests);
            return;
          }
        }
        setSakoMode(false);
        setSakoSelected(null);
        setSelected(null);
        setValidMoves([]);
        return;
      }

      if (royalHouseholdMode) {
        const isValid = validMoves.some(([vr, vc]) => vr === r && vc === c);
        if (isValid) {
          const movingColor = game.turn;
          const enemyColorRH = opp(movingColor);
          const [kr, kc] = findKing(game, movingColor);
          const dr = Math.sign(r - kr),
            dc = Math.sign(c - kc);
          // Detect enemy king anywhere in the rampage path (inclusive of dest)
          let enemyKingInPath = false;
          {
            let sc: [number, number] = [kr + dr, kc + dc];
            while (sc[0] !== r || sc[1] !== c) {
              if (
                getDerivedBoard(game)[sc[0]][sc[1]]?.type === "K" &&
                getDerivedBoard(game)[sc[0]][sc[1]]?.color === enemyColorRH
              )
                enemyKingInPath = true;
              sc = [sc[0] + dr, sc[1] + dc];
            }
            if (
              getDerivedBoard(game)[r][c]?.type === "K" &&
              getDerivedBoard(game)[r][c]?.color === enemyColorRH
            )
              enemyKingInPath = true;
          }
          const nb = cloneBoard(getDerivedBoard(game));
          nb[kr][kc] = null;
          let cur: [number, number] = [kr + dr, kc + dc];
          while (cur[0] !== r || cur[1] !== c) {
            nb[cur[0]][cur[1]] = null;
            cur = [cur[0] + dr, cur[1] + dc];
          }
          const kingMoved = getDerivedBoard(game)[kr][kc];
          nb[r][c] = kingMoved ? { ...kingMoved } : { type: "K", color: movingColor };
          setGameHistory((h) => [...h, game]);
          setAugmentHistory((h) => [...h, captureAugmentSnapshot()]);
          setShopOpen(false);
          const newTurnCount =
            (movingColor === "white" ? whiteTurnCount : blackTurnCount) + 1;
          if (movingColor === "white") setWhiteTurnCount(newTurnCount);
          else setBlackTurnCount(newTurnCount);
          const playerAugsNow =
            movingColor === "white" ? whiteAugments : blackAugments;
          let newGame: ChessState = syncStateFromBoard(
            {
              ...game,
              turn: opp(movingColor),
              enPassantTarget: null,
              castlingRights: {
                ...game.castlingRights,
                white:
                  movingColor === "white"
                    ? { kingside: false, queenside: false }
                    : game.castlingRights.white,
                black:
                  movingColor === "black"
                    ? { kingside: false, queenside: false }
                    : game.castlingRights.black,
              },
              lastMove: {
                from: [kr, kc],
                to: [r, c],
                piece: kingMoved
                  ? { ...kingMoved }
                  : { type: "K", color: movingColor },
                captured: null,
              },
            },
            nb,
          );
          newGame = applyEndOfTurnEffects(
            newGame,
            movingColor,
            playerAugsNow,
            newTurnCount,
            whiteAugments,
            blackAugments,
            whiteDoubleGoldFullRoundsLeft,
            blackDoubleGoldFullRoundsLeft,
            movingColor === "white" ? whiteAugmentLevels : blackAugmentLevels,
            taxVaultCtx(movingColor),
          );
          newGame = recomputeStatus(
            expireLittleBigManAfterHalfMove(
              newGame,
              movingColor,
              newTurnCount,
              whiteTurnCount,
              blackTurnCount,
            ),
          );
          // Instant win if rampage killed the enemy king
          if (enemyKingInPath) newGame = { ...newGame, status: "checkmate" };
          setGame(newGame);
          if (movingColor === "white") setWhiteRoyalHouseholdUsed(true);
          else setBlackRoyalHouseholdUsed(true);
          requestSnapshot();
        }
        setRoyalHouseholdMode(false);
        setSelected(null);
        setValidMoves([]);
        return;
      }

      if (whatMode) {
        if (
          !whatSelected &&
          tutorialRestrictions?.highlightSquares?.length &&
          !tutorialRestrictions.highlightSquares.some(
            ([hr, hc]) => hr === r && hc === c,
          )
        ) {
          return;
        }
        if (!whatSelected) {
          if (piece?.type === "P" && piece.color === game.turn) {
            const moves: [number, number][] = [];
            if (c > 0 && !getDerivedBoard(game)[r][c - 1]) moves.push([r, c - 1]);
            if (c < getDerivedBoard(game).length - 1 && !getDerivedBoard(game)[r][c + 1])
              moves.push([r, c + 1]);
            if (moves.length > 0) {
              setWhatSelected([r, c]);
              setSelected([r, c]);
              setValidMoves(moves);
            } else {
              setWhatMode(false);
              setWhatSelected(null);
              setSelected(null);
              setValidMoves([]);
            }
          } else {
            setWhatMode(false);
            setWhatSelected(null);
            setSelected(null);
            setValidMoves([]);
          }
          return;
        }
        const isValid = validMoves.some(([vr, vc]) => vr === r && vc === c);
        if (isValid) {
          executeMove(whatSelected, [r, c], undefined, null);
          if (game.turn === "white") {
            setWhiteWhatUsed(true);
            if (tutorialMode) tutorialEmit?.({ type: "spell", id: "what" });
          } else setBlackWhatUsed(true);
        }
        setWhatMode(false);
        setWhatSelected(null);
        setSelected(null);
        setValidMoves([]);
        return;
      }

      const playerAugsNow =
        game.turn === "white" ? whiteAugments : blackAugments;
      const moverLevelsNow =
        game.turn === "white" ? whiteAugmentLevels : blackAugmentLevels;
      const hasAlternative = playerAugsNow.some((a) => a.id === "alternative");
      const hasAlternativePlus =
        playerAugsNow.some((a) => a.id === "alternative-plus") ||
        getImproveLevel(moverLevelsNow, "alternative") >= 1;
      const isColdWindFrozen = (row: number, col: number) =>
        coldWindsMovesLeft > 0 &&
        coldWindsSquares.some(([fr, fc]) => fr === row && fc === col);
      const isFrozenPiece =
        (frozenSquare &&
          frozenSquare[0] === r &&
          frozenSquare[1] === c &&
          piece?.color === game.turn) ||
        (isColdWindFrozen(r, c) && piece?.color === game.turn);

      const computeMoves = (pr: number, pc: number): [number, number][] => {
        if (isColdWindFrozen(pr, pc)) return [];
        // Inject wall squares as M-pieces so rays/movement are properly blocked
        const db0 = getDerivedBoard(game);
        const perm = game.permaFrozenSquares ?? [];
        const gameForMoves =
          wallSquares.length > 0 || perm.length > 0
            ? syncStateFromBoard(
                { ...game },
                db0.map((row2, ri) =>
                  row2.map((sq, ci) => {
                    if (wallSquares.some((w) => w.row === ri && w.col === ci))
                      return { type: "M" as PieceType, color: "white" as Color };
                    if (perm.some((p) => p.row === ri && p.col === ci))
                      return { type: "M" as PieceType, color: "white" as Color };
                    return sq;
                  }),
                ),
              )
            : game;
        let moves = getLegalMoves(gameForMoves, pr, pc);
        const p = getDerivedBoard(game)[pr][pc];
        if (hasAlternative && p?.type === "P")
          for (const [er, ec] of getAlternativeMoves(game, pr, pc))
            if (!moves.some(([mr, mc]) => mr === er && mc === ec))
              moves.push([er, ec]);
        if (hasAlternativePlus && p?.type === "P")
          for (const [er, ec] of getAlternativePlusMoves(game, pr, pc))
            if (!moves.some(([mr, mc]) => mr === er && mc === ec))
              moves.push([er, ec]);
        // Filter out captures of blessed pieces
        moves = moves.filter(
          ([tr, tc]) =>
            !getDerivedBoard(game)[tr][tc] ||
            !blessedSquares.some((b) => b.row === tr && b.col === tc),
        );
        return tutorialFilterMoves(moves, [pr, pc], tutorialRestrictions);
      };

      // Puppet force: the puppeted player must move the puppet piece
      if (
        activePuppetColor === game.turn &&
        activePuppetSquare &&
        game.status !== "check"
      ) {
        const pMoves = computeMoves(
          activePuppetSquare[0],
          activePuppetSquare[1],
        );
        if (pMoves.length === 0) {
          setActivePuppetSquare(null);
          setActivePuppetColor(null);
          // fall through to normal selection
        } else {
          if (r === activePuppetSquare[0] && c === activePuppetSquare[1]) {
            setSelected([r, c]);
            setValidMoves(pMoves);
            return;
          }
          if (selected && validMoves.some(([vr, vc]) => vr === r && vc === c)) {
            const cap = getDerivedBoard(game)[r][c]?.type ?? null;
            executeMove(activePuppetSquare, [r, c], undefined, cap);
          }
          setSelected(null);
          setValidMoves([]);
          return;
        }
      }

      if (selected) {
        const isValid = validMoves.some(([vr, vc]) => vr === r && vc === c);
        if (isValid) {
          const movingPiece = getDerivedBoard(game)[selected[0]][selected[1]]!;
          const promRowBlack = boardRows - 1;
          const isPromotion =
            movingPiece.type === "P" &&
            ((movingPiece.color === "white" && r === 0) ||
              (movingPiece.color === "black" && r === promRowBlack));
          if (isPromotion) {
            setPromotionPending({ from: selected, to: [r, c] });
          } else {
            const isEP =
              movingPiece.type === "P" &&
              selected[1] !== c &&
              !getDerivedBoard(game)[r][c];
            executeMove(
              selected,
              [r, c],
              undefined,
              getDerivedBoard(game)[r][c]?.type ?? (isEP ? "P" : null),
            );
            setSelected(null);
            setValidMoves([]);
          }
          return;
        }
        const canSelect = (() => {
          if (!piece || piece.color !== game.turn || isFrozenPiece) return false;
          if (!gameIs2v2) return true;
          const pid = game.occupancy[r]?.[c];
          const ent = pid ? game.pieces[pid] : null;
          if (mpConfig?.mySlot) return ent?.slot === mpConfig.mySlot;
          return ent?.slot === game.turnSlot;
        })();
        if (
          canSelect &&
          tutorialAllowsSquareSelect([r, c], tutorialRestrictions)
        ) {
          setSelected([r, c]);
          setValidMoves(computeMoves(r, c));
          return;
        }
        setSelected(null);
        setValidMoves([]);
        return;
      }
      const canSelectPiece = (() => {
        if (
          !piece ||
          piece.color !== game.turn ||
          piece.type === "M" ||
          isFrozenPiece
        )
          return false;
        if (!gameIs2v2) return true;
        const pid = game.occupancy[r]?.[c];
        const ent = pid ? game.pieces[pid] : null;
        if (mpConfig?.mySlot) return ent?.slot === mpConfig.mySlot;
        return ent?.slot === game.turnSlot;
      })();
      if (
        canSelectPiece &&
        tutorialAllowsSquareSelect([r, c], tutorialRestrictions)
      ) {
        setSelected([r, c]);
        setValidMoves(computeMoves(r, c));
      }
    },
    [
      phase,
      currentTrigger,
      tutorialMode,
      tutorialRestrictions,
      tutorialEmit,
      game,
      selected,
      validMoves,
      promotionPending,
      isMyTurn,
      freezeMode,
      bloodbendingMode,
      bloodbendingPlusMode,
      littleBigManMode,
      necroMode,
      necroPPMode,
      whiteLittleBigManCharges,
      blackLittleBigManCharges,
      whiteTurnCount,
      blackTurnCount,
      royalEdMode,
      whatMode,
      whatSelected,
      frozenSquare,
      whiteLostPawnCols,
      blackLostPawnCols,
      whiteAugments,
      blackAugments,
      executeMove,
      deathNoteMode,
      monolithMode,
      contractMode,
      blessedWaterMode,
      puppetMode,
      whiteTurnCount,
      blackTurnCount,
      peaceTreatyRoundsLeft,
      coldWindsMovesLeft,
      coldWindsSquares,
      blessedSquares,
      wallSquares,
      activePuppetSquare,
      activePuppetColor,
      necroPlusMode,
      whiteLostMinors,
      blackLostMinors,
      requestSnapshot,
      ilkkanMode,
      whiteIlkkanId,
      blackIlkkanId,
      swapMode,
      swapFirst,
      pawnPlaceFor,
      blindRagePickColor,
      whiteDoubleGoldFullRoundsLeft,
      blackDoubleGoldFullRoundsLeft,
      whiteBloodbendingCharges,
      blackBloodbendingCharges,
      whiteBloodbendingPlusCharges,
      blackBloodbendingPlusCharges,
      whiteNecroPPCharges,
      blackNecroPPCharges,
    ],
  );

  const handlePromotion = useCallback(
    (type: PieceType) => {
      if (!promotionPending) return;
      const captured =
        getDerivedBoard(game)[promotionPending.to[0]][promotionPending.to[1]];
      executeMove(
        promotionPending.from,
        promotionPending.to,
        type,
        captured?.type ?? null,
      );
      setPromotionPending(null);
      setSelected(null);
      setValidMoves([]);
    },
    [promotionPending, game, executeMove],
  );

  const botHandlersRef = useRef({
    handleBlackPick: (_aug: Augment) => {},
    handleMidGamePick: (_aug: Augment) => {},
    handleBlindRagePick: (_aug: Augment) => {},
    handlePromotion: (_type: PieceType) => {},
  });
  const botSquareClickRef = useRef<(r: number, c: number) => void>(() => {});
  const botSpellHandlersRef = useRef({
    toggleFreeze: () => {},
    toggleBlessedWater: () => {},
    toggleMonolithPlace: () => {},
    toggleContract: () => {},
    togglePuppet: () => {},
    toggleDeathNote: () => {},
  });
  const botEconomyRef = useRef({
    toggleShop: () => {},
    handleBuy: (_aug: Augment) => {},
    handleAuctionBid: (_amount: number, _asColor?: Color) => {},
  });
  botHandlersRef.current = {
    handleBlackPick,
    handleMidGamePick,
    handleBlindRagePick,
    handlePromotion,
  };
  botSquareClickRef.current = handleSquareClick;
  botSpellHandlersRef.current = {
    toggleFreeze: handleToggleFreeze,
    toggleBlessedWater: handleToggleBlessedWater,
    toggleMonolithPlace: handleToggleMonolithPlace,
    toggleContract: handleToggleContract,
    togglePuppet: handleTogglePuppet,
    toggleDeathNote: handleToggleDeathNote,
  };
  botEconomyRef.current = {
    toggleShop: handleToggleShop,
    handleBuy,
    handleAuctionBid,
  };

  const runBotSpell = (spellId: string, target: [number, number]) => {
    const [r, c] = target;
    const spells = botSpellHandlersRef.current;
    if (spellId === "frost") {
      spells.toggleFreeze();
      botSquareClickRef.current(r, c);
    } else if (spellId === "blessed-water-spell") {
      spells.toggleBlessedWater();
      botSquareClickRef.current(r, c);
    } else if (spellId === "impassable") {
      spells.toggleMonolithPlace();
      botSquareClickRef.current(r, c);
    } else if (spellId === "contract-killer") {
      spells.toggleContract();
      botSquareClickRef.current(r, c);
    } else if (spellId === "puppet") {
      spells.togglePuppet();
      botSquareClickRef.current(r, c);
    } else if (spellId === "death-note") {
      spells.toggleDeathNote();
      botSquareClickRef.current(r, c);
    }
  };

  useEffect(() => {
    if (!botMode || mpConfig) return;

    const gameOver =
      game.status === "checkmate" ||
      game.status === "stalemate" ||
      (!!game.teamStatus && game.teamStatus !== "playing");

    const blockedForMove =
      currentTrigger !== null ||
      blindRagePickColor !== null ||
      promotionPending !== null ||
      (activeAuction?.status === "active" && !auctionPlaceFor) ||
      shopOpen ||
      auctionPlaceFor !== null;

    const shouldAuctionBid =
      phase === "playing" &&
      !gameOver &&
      activeAuction?.status === "active" &&
      !auctionPlaceFor;

    const shouldAuctionPlace =
      phase === "playing" &&
      !gameOver &&
      auctionPlaceFor?.color === "black";

    const shouldShopBuy =
      phase === "playing" &&
      game.turn === "black" &&
      !gameOver &&
      !shopOpen &&
      augmentSpellBlockedFor !== "black" &&
      !blockedForMove &&
      !shouldAuctionBid &&
      !shouldAuctionPlace;

    const shouldPickAugment =
      phase === "black-augment" && offeredToBlack.length > 0;
    const shouldPickMidGame =
      phase === "playing" &&
      currentTrigger?.color === "black" &&
      isLocalAugmentPicker(currentTrigger.color, augmentPickSlot) &&
      midGameOffered.length > 0;
    const shouldPickBlindRage =
      phase === "playing" &&
      blindRagePickColor === "black" &&
      isLocalAugmentPicker(blindRagePickColor, blindRagePickSlot) &&
      blindRageOffered.length > 0;
    const shouldPromote =
      promotionPending !== null && game.turn === "black";
    const shouldMove =
      phase === "playing" &&
      game.turn === "black" &&
      !gameOver &&
      !blockedForMove;

    const shouldAct =
      shouldAuctionBid ||
      shouldAuctionPlace ||
      shouldShopBuy ||
      shouldPickAugment ||
      shouldPickMidGame ||
      shouldPickBlindRage ||
      shouldPromote ||
      shouldMove;

    if (!shouldAct) {
      setBotThinking(false);
      return;
    }

    if (botBusyRef.current) return;
    botBusyRef.current = true;
    setBotThinking(true);

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        if (cancelled) return;

        if (shouldAuctionBid) {
          const g = gameRef.current;
          const moveCtx = buildBotMoveContext({
            wallSquares,
            blessedSquares,
            coldWindsSquares,
            coldWindsMovesLeft,
            frozenSquare,
            activePuppetSquare,
            activePuppetColor,
            blackAugments,
            blackAugmentLevels,
          });
          const position = await assessPosition(g, moveCtx);
          if (activeAuction) {
            const bid = computeAuctionBid({
              auction: activeAuction,
              goldBlack: g.goldBlack,
              position,
            });
            if (bid !== null) {
              botEconomyRef.current.handleAuctionBid(bid, "black");
            }
          }
          return;
        }

        if (shouldAuctionPlace && auctionPlaceFor) {
          const sq = pickAuctionPlacement(
            gameRef.current,
            auctionPlaceFor.pieceType,
            "black",
          );
          if (sq) botSquareClickRef.current(sq[0], sq[1]);
          return;
        }

        if (shouldShopBuy) {
          const g = gameRef.current;
          const moveCtx = buildBotMoveContext({
            wallSquares,
            blessedSquares,
            coldWindsSquares,
            coldWindsMovesLeft,
            frozenSquare,
            activePuppetSquare,
            activePuppetColor,
            blackAugments,
            blackAugmentLevels,
          });
          const position = await assessPosition(g, moveCtx);
          const buy = pickShopBuy({
            goldBlack: g.goldBlack,
            blackTierBought,
            blackAugments,
            blackAugmentLevels,
            position,
          });
          if (buy) {
            botEconomyRef.current.toggleShop();
            botEconomyRef.current.handleBuy(buy.aug);
            botEconomyRef.current.toggleShop();
          }
          return;
        }

        if (shouldPickAugment) {
          const aug =
            pickAugmentForBot(offeredToBlack, blackAugments) ??
            offeredToBlack[0]!;
          botHandlersRef.current.handleBlackPick(aug);
          return;
        }
        if (shouldPickMidGame) {
          const aug =
            pickAugmentForBot(midGameOffered, blackAugments) ??
            midGameOffered[0]!;
          botHandlersRef.current.handleMidGamePick(aug);
          return;
        }
        if (shouldPickBlindRage) {
          const aug =
            pickAugmentForBot(blindRageOffered, blackAugments) ??
            blindRageOffered[0]!;
          botHandlersRef.current.handleBlindRagePick(aug);
          return;
        }
        if (shouldPromote) {
          botHandlersRef.current.handlePromotion("Q");
          return;
        }
        if (shouldMove) {
          const g = gameRef.current;
          if (g.turn !== "black") return;

          const moveCtx = buildBotMoveContext({
            wallSquares,
            blessedSquares,
            coldWindsSquares,
            coldWindsMovesLeft,
            frozenSquare,
            activePuppetSquare,
            activePuppetColor,
            blackAugments,
            blackAugmentLevels,
          });
          const spellCtx = buildBotSpellContext({
            move: moveCtx,
            blackFreezeCharges,
            blackBlessedWaterCharges,
            blackAugments,
            blackAugmentLevels,
            augmentSpellBlockedFor,
            blackMonolithPermRemoved,
            blackContractPieceId,
            blackPuppetUsed,
            blackDNUsed,
            game: g,
          });
          const action = await decideBotAction(g, spellCtx);
          if (cancelled || !action) return;
          if (gameRef.current.turn !== "black") return;

          if (action.type === "castSpell") {
            runBotSpell(action.spellId, action.target);
            return;
          }
          if (action.type === "castSpellThenMove") {
            runBotSpell(action.spellId, action.target);
            if (gameRef.current.turn !== "black") return;
            const cap =
              getDerivedBoard(gameRef.current)[action.move.to[0]]?.[
                action.move.to[1]
              ];
            executeMoveRef.current(
              action.move.from,
              action.move.to,
              action.move.promotion,
              cap?.type ?? null,
            );
            return;
          }
          if (action.type === "move") {
            const cap =
              getDerivedBoard(gameRef.current)[action.move.to[0]]?.[
                action.move.to[1]
              ];
            executeMoveRef.current(
              action.move.from,
              action.move.to,
              action.move.promotion,
              cap?.type ?? null,
            );
          }
        }
      } finally {
        botBusyRef.current = false;
        if (!cancelled) setBotThinking(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      botBusyRef.current = false;
      setBotThinking(false);
    };
  }, [
    botMode,
    mpConfig,
    phase,
    game.turn,
    game.status,
    game.teamStatus,
    game.goldBlack,
    offeredToBlack,
    currentTrigger,
    augmentPickSlot,
    midGameOffered,
    blindRagePickColor,
    blindRagePickSlot,
    blindRageOffered,
    promotionPending,
    activeAuction,
    auctionPlaceFor,
    shopOpen,
    isLocalAugmentPicker,
    wallSquares,
    blessedSquares,
    coldWindsSquares,
    coldWindsMovesLeft,
    frozenSquare,
    activePuppetSquare,
    activePuppetColor,
    blackAugments,
    blackAugmentLevels,
    blackFreezeCharges,
    blackBlessedWaterCharges,
    augmentSpellBlockedFor,
    blackMonolithPermRemoved,
    blackContractPieceId,
    blackPuppetUsed,
    blackDNUsed,
    blackTierBought,
  ]);

  // ── Reset ─────────────────────────────────────────────────────────────────

  const resetGame = () => {
    setGame(is2v2 ? create2v2InitialState() : createInitialState());
    setSelected(null);
    setValidMoves([]);
    setPromotionPending(null);
    setPhase("start");
    setBotThinking(false);
    botBusyRef.current = false;
    setWhiteAugments([]);
    setBlackAugments([]);
    setOfferedToWhite([]);
    setOfferedToBlack([]);
    setWhiteMilestones(EMPTY_MILESTONES);
    setBlackMilestones(EMPTY_MILESTONES);
    setAugmentQueue([]);
    setCurrentTrigger(null);
    setMidGameOffered([]);
    setGameHistory([]);
    setAugmentHistory([]);
    setWhiteUndosLeft(0);
    setBlackUndosLeft(0);
    setWhiteTurnCount(0);
    setBlackTurnCount(0);
    setWhiteFreezeCharges(0);
    setBlackFreezeCharges(0);
    setWhiteBloodbendingCharges(0);
    setBlackBloodbendingCharges(0);
    setWhiteBloodbendingPlusCharges(0);
    setBlackBloodbendingPlusCharges(0);
    setWhiteNecroPPCharges(0);
    setBlackNecroPPCharges(0);
    setWhiteLittleBigManCharges(0);
    setBlackLittleBigManCharges(0);
    setLittleBigManMode(false);
    setFrozenSquare(null);
    setFrozenExpireAfter(null);
    setFreezeMode(false);
    setBloodbendingMode(false);
    setBloodbendingPlusMode(false);
    setNecroPPMode(false);
    setWhiteNecroCharges(0);
    setBlackNecroCharges(0);
    setWhiteLostPawnCols([]);
    setBlackLostPawnCols([]);
    setNecroMode(false);
    setWhiteCaptureCount(0);
    setBlackCaptureCount(0);
    setWhiteBloodlustNext(4);
    setBlackBloodlustNext(4);
    setWhiteIcUsed(false);
    setBlackIcUsed(false);
    setWhiteRoyalEdUsesLeft(0);
    setBlackRoyalEdUsesLeft(0);
    setRoyalEdMode(false);
    setWhiteWhatUsed(false);
    setBlackWhatUsed(false);
    setWhatMode(false);
    setWhatSelected(null);
    setWhiteSakoUsed(false);
    setBlackSakoUsed(false);
    setSakoMode(false);
    setSakoSelected(null);
    setWhiteSwapUsed(false);
    setBlackSwapUsed(false);
    setSwapMode(false);
    setSwapFirst(null);
    setWhiteRoyalHouseholdUsed(false);
    setBlackRoyalHouseholdUsed(false);
    setRoyalHouseholdMode(false);
    setWhiteDNUsed(false);
    setBlackDNUsed(false);
    setDeathNoteMode(false);
    setDeathNoteTargets([]);
    setWhiteDomainUsed(false);
    setBlackDomainUsed(false);
    setBoardSize(8);
    setNextEventTurn(rollFullRoundsUntilNextEvent(false));
    setPendingEvent(null);
    setPeaceTreatyRoundsLeft(0);
    setActiveNuke(null);
    setActiveApocalypse(null);
    setExhaustedEventIds([]);
    setNextAuctionTurn(rollFullRoundsUntilNextAuction());
    setActiveAuction(null);
    setAuctionPlaceFor(null);
    setSacrificeMode(false);
    setBlessedSquares([]);
    setColdWindsSquares([]);
    setColdWindsMovesLeft(0);
    setWallSquares([]);
    setWallMovesLeft(0);
    setChaosEventTiming(false);
    setChaosPoolRestricted(false);
    setWhiteTaxVault(0);
    setBlackTaxVault(0);
    setTaxStealBanner(null);
    setHillPawnTimers([]);
    setWhiteContractTarget(null);
    setBlackContractTarget(null);
    setWhiteContractPieceId(null);
    setBlackContractPieceId(null);
    setContractMode(false);
    setWhiteBlessedWaterCharges(0);
    setBlackBlessedWaterCharges(0);
    setBlessedWaterMode(false);
    setWhitePuppetUsed(false);
    setBlackPuppetUsed(false);
    setPuppetMode(false);
    setActivePuppetSquare(null);
    setActivePuppetColor(null);
    setMonolithMode(null);
    setShopOpen(false);
    setWhiteTierBought({ ...EMPTY_TIER });
    setBlackTierBought({ ...EMPTY_TIER });
    setWhiteNecroPlusCharges(0);
    setBlackNecroPlusCharges(0);
    setWhiteLostMinors([]);
    setBlackLostMinors([]);
    setNecroPlusMode(false);
    setWhiteMonolithPermRemoved(false);
    setBlackMonolithPermRemoved(false);
    setPrizeFirstCaptureOfGameDone(false);
    setWhiteDoubleGoldFullRoundsLeft(0);
    setBlackDoubleGoldFullRoundsLeft(0);
    setWhiteBlindRageDone(false);
    setBlackBlindRageDone(false);
    setWhiteEvadeCharges(0);
    setBlackEvadeCharges(0);
    setAugmentSpellBlockedFor(null);
    setWhitePawnShopBuys(0);
    setBlackPawnShopBuys(0);
    setPawnPlaceFor(null);
    setBlindRagePickColor(null);
    setBlindRageOffered([]);
    triggersAfterBlindRageRef.current = [];
    setWhiteIlkkanId(null);
    setBlackIlkkanId(null);
    setWhiteIlkkanChosen(false);
    setBlackIlkkanChosen(false);
    setIlkkanMode(false);
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const adv = materialAdvantage(game);
  const isTeamOver =
    !!game.teamStatus && game.teamStatus !== "playing";
  const isOver =
    isTeamOver ||
    game.status === "checkmate" ||
    game.status === "stalemate";
  const statusText = (() => {
    if (game.teamStatus === "team_win_white")
      return { label: "WHITE TEAM WINS", color: "#4ade80" };
    if (game.teamStatus === "team_win_black")
      return { label: "BLACK TEAM WINS", color: "#4ade80" };
    if (game.status === "checkmate")
      return {
        label: `${opp(game.turn).toUpperCase()} WINS  ·  Checkmate`,
        color: "#4ade80",
      };
    if (game.status === "stalemate")
      return { label: "DRAW  ·  Stalemate", color: "#94a3b8" };
    if (game.status === "check")
      return {
        label: gameIs2v2 && game.turnSlot
          ? `${game.turnSlot.toUpperCase()}  ·  CHECK!`
          : `${game.turn.toUpperCase()}  ·  CHECK!`,
        color: "#f87171",
      };
    if (gameIs2v2 && game.turnSlot)
      return {
        label: `${game.turnSlot.toUpperCase()}'S TURN`,
        color: "#e2e8f0",
      };
    return { label: `${game.turn.toUpperCase()}'S TURN`, color: "#e2e8f0" };
  })();

  const canWhiteUndo =
    phase === "playing" &&
    !isOver &&
    game.turn === "white" &&
    whiteUndosLeft > 0 &&
    gameHistory.length >= 2 &&
    !mpConfig;
  const canBlackUndo =
    phase === "playing" &&
    !isOver &&
    game.turn === "black" &&
    blackUndosLeft > 0 &&
    gameHistory.length >= 2 &&
    !mpConfig;
  const necroOff = (boardSize - 8) / 2;
  const whiteNecroRow = 6 + necroOff,
    blackNecroRow = 1 + necroOff;
  const whiteHasNecroTargets = whiteLostPawnCols.some(
    (col) => getDerivedBoard(game)[whiteNecroRow] && !getDerivedBoard(game)[whiteNecroRow][col],
  );
  const blackHasNecroTargets = blackLostPawnCols.some(
    (col) => getDerivedBoard(game)[blackNecroRow] && !getDerivedBoard(game)[blackNecroRow][col],
  );

  const dbN = getDerivedBoard(game);
  const bsN = dbN.length;
  const offN = (bsN - 8) / 2;
  const backRw = 7 + offN;
  const backRb = offN;
  let wEmptyBack = false;
  let bEmptyBack = false;
  for (let c = 0; c < bsN; c++) {
    if (!dbN[backRw][c]) wEmptyBack = true;
    if (!dbN[backRb][c]) bEmptyBack = true;
  }
  const whiteHasNecroPPTargets =
    whiteAugments.some((a) => a.id === "necromancer-plus-plus") &&
    whiteNecroPPCharges > 0 &&
    wEmptyBack;
  const blackHasNecroPPTargets =
    blackAugments.some((a) => a.id === "necromancer-plus-plus") &&
    blackNecroPPCharges > 0 &&
    bEmptyBack;

  const handleEvade = useCallback(() => {
    if (game.turn === "white") {
      if (whiteEvadeCharges <= 0) return;
      setWhiteEvadeCharges((n) => n - 1);
    } else {
      if (blackEvadeCharges <= 0) return;
      setBlackEvadeCharges((n) => n - 1);
    }
    setAugmentSpellBlockedFor(opp(game.turn));
    requestSnapshot();
  }, [
    game.turn,
    whiteEvadeCharges,
    blackEvadeCharges,
    requestSnapshot,
  ]);

  const handleBuyPawn = useCallback(() => {
    const color = game.turn;
    const augs = color === "white" ? whiteAugments : blackAugments;
    if (!augs.some((a) => a.id === "pawn-shop")) return;
    const bought = color === "white" ? whitePawnShopBuys : blackPawnShopBuys;
    const pawnLevel = getImproveLevel(
      color === "white" ? whiteAugmentLevels : blackAugmentLevels,
      "pawn-shop",
    );
    const price = getPawnShopPrice(pawnLevel, bought);
    const cur = color === "white" ? game.goldWhite : game.goldBlack;
    if (cur < price) return;
    setGame((g) => ({
      ...g,
      goldWhite: color === "white" ? g.goldWhite - price : g.goldWhite,
      goldBlack: color === "black" ? g.goldBlack - price : g.goldBlack,
    }));
    if (color === "white") setWhitePawnShopBuys((n) => n + 1);
    else setBlackPawnShopBuys((n) => n + 1);
    if (gameIs2v2 && mpConfig?.mySlot) {
      setPawnPlaceSlot(mpConfig.mySlot);
      setPawnPlaceFor(null);
    } else {
      setPawnPlaceFor(color);
      setPawnPlaceSlot(null);
    }
    setShopOpen(false);
    requestSnapshot();
  }, [
    game.turn,
    game.goldWhite,
    game.goldBlack,
    whiteAugments,
    blackAugments,
    whitePawnShopBuys,
    blackPawnShopBuys,
    gameIs2v2,
    mpConfig?.mySlot,
    requestSnapshot,
  ]);

  const turnGuard = (fn: () => void) => () => {
    if (!isMyTurn && mpConfig) return;
    if (tutorialMode && tutorialRestrictions?.blockShopToggle) return;
    fn();
  };

  const spellGuard = (fn: () => void, spellId?: string) => () => {
    if (!isMyTurn && mpConfig) return;
    if (augmentSpellBlockedFor && game.turn === augmentSpellBlockedFor) return;
    if (tutorialMode && tutorialRestrictions) {
      if (spellId && !tutorialAllowsSpell(spellId, tutorialRestrictions))
        return;
      if (!spellId && tutorialRestrictions.blockAllSpells) return;
    }
    fn();
  };

  const handleCollectTax = useCallback(
    (color: Color) => {
      if (color === "white") setWhiteTaxVault(0);
      else setBlackTaxVault(0);
      setTaxStealBanner(
        lang === "türkçe"
          ? "Uzun adam paranı çaldı"
          : "Ah shit he stole your money",
      );
      setTimeout(() => setTaxStealBanner(null), 3000);
      requestSnapshot();
    },
    [requestSnapshot, lang],
  );

  const makeSpells = (color: Color): SpellState => {
    const teamOnClock = game.turn === color;
    const canUseSpells = gameIs2v2 ? mySlotTurn && teamOnClock : teamOnClock;
    return {
    freezeCharges: color === "white" ? whiteFreezeCharges : blackFreezeCharges,
    freezeActive: freezeMode && canUseSpells,
    onFreeze: spellGuard(handleToggleFreeze),
    necroCharges: color === "white" ? whiteNecroCharges : blackNecroCharges,
    necroActive: necroMode && canUseSpells,
    hasNecroTargets:
      color === "white" ? whiteHasNecroTargets : blackHasNecroTargets,
    onNecro: spellGuard(handleToggleNecro),
    necroPlusCharges:
      color === "white" ? whiteNecroPlusCharges : blackNecroPlusCharges,
    necroPlusActive: necroPlusMode && canUseSpells,
    hasNecroPlusTargets:
      color === "white"
        ? whiteLostMinors.length > 0
        : blackLostMinors.length > 0,
    onNecroPlus: spellGuard(handleToggleNecroPlus),
    bloodbendingCharges:
      color === "white" ? whiteBloodbendingCharges : blackBloodbendingCharges,
    bloodbendingActive: bloodbendingMode && canUseSpells,
    onBloodbending: spellGuard(handleToggleBloodbending),
    bloodbendingPlusCharges:
      color === "white"
        ? whiteBloodbendingPlusCharges
        : blackBloodbendingPlusCharges,
    bloodbendingPlusActive: bloodbendingPlusMode && canUseSpells,
    onBloodbendingPlus: spellGuard(handleToggleBloodbendingPlus),
    necroPPCharges:
      color === "white" ? whiteNecroPPCharges : blackNecroPPCharges,
    necroPPActive: necroPPMode && canUseSpells,
    hasNecroPPTargets:
      color === "white" ? whiteHasNecroPPTargets : blackHasNecroPPTargets,
    onNecroPP: spellGuard(handleToggleNecroPP),
    littleBigManCharges:
      color === "white" ? whiteLittleBigManCharges : blackLittleBigManCharges,
    littleBigManActive: littleBigManMode && canUseSpells,
    onLittleBigMan: spellGuard(handleToggleLittleBigMan),
    sacrificeAvailable:
      (color === "white" ? whiteAugments : blackAugments).some(
        (a) => a.id === "sacrifice",
      ) && canUseSpells,
    sacrificeActive: sacrificeMode && canUseSpells,
    onSacrifice: spellGuard(handleToggleSacrifice),
    ilkkanAvailable:
      color === "white"
        ? whiteAugments.some((a) => a.id === "ilkkan") && !whiteIlkkanChosen
        : blackAugments.some((a) => a.id === "ilkkan") && !blackIlkkanChosen,
    ilkkanActive: ilkkanMode && canUseSpells,
    onIlkkan: spellGuard(handleToggleIlkkan),
    royalEdAvailable:
      color === "white"
        ? whiteRoyalEdUsesLeft > 0 &&
          whiteAugments.some((a) => a.id === "royal-education")
        : blackRoyalEdUsesLeft > 0 &&
          blackAugments.some((a) => a.id === "royal-education"),
    royalEdActive: royalEdMode && canUseSpells,
    onRoyalEd: spellGuard(handleToggleRoyalEd),
    whatAvailable:
      color === "white"
        ? !whiteWhatUsed && whiteAugments.some((a) => a.id === "what")
        : !blackWhatUsed && blackAugments.some((a) => a.id === "what"),
    whatActive: whatMode && canUseSpells,
    onWhat: spellGuard(handleToggleWhat, "what"),
    sakoAvailable:
      color === "white"
        ? !whiteSakoUsed && whiteAugments.some((a) => a.id === "sako-bosphorus")
        : !blackSakoUsed &&
          blackAugments.some((a) => a.id === "sako-bosphorus"),
    sakoActive: sakoMode && canUseSpells,
    onSako: spellGuard(handleToggleSako),
    swapAvailable:
      color === "white"
        ? !whiteSwapUsed && whiteAugments.some((a) => a.id === "swap")
        : !blackSwapUsed && blackAugments.some((a) => a.id === "swap"),
    swapActive: swapMode && canUseSpells,
    onSwap: spellGuard(handleToggleSwap),
    royalHouseholdAvailable:
      color === "white"
        ? !whiteRoyalHouseholdUsed &&
          whiteAugments.some((a) => a.id === "royal-household") &&
          game.status === "check" &&
          game.turn === "white"
        : !blackRoyalHouseholdUsed &&
          blackAugments.some((a) => a.id === "royal-household") &&
          game.status === "check" &&
          game.turn === "black",
    royalHouseholdActive: royalHouseholdMode && canUseSpells,
    onRoyalHousehold: spellGuard(handleToggleRoyalHousehold),
    deathNoteAvailable:
      color === "white"
        ? !whiteDNUsed && whiteAugments.some((a) => a.id === "death-note")
        : !blackDNUsed && blackAugments.some((a) => a.id === "death-note"),
    deathNoteActive: deathNoteMode && canUseSpells,
    onDeathNote: spellGuard(handleToggleDeathNote),
    domainAvailable:
      color === "white"
        ? !whiteDomainUsed &&
          (gameIs2v2
            ? getBoardRows(game) < 12 || getBoardCols(game) < 20
            : game.occupancy.length < 12) &&
          whiteAugments.some((a) => a.id === "domain-expansion")
        : !blackDomainUsed &&
          (gameIs2v2
            ? getBoardRows(game) < 12 || getBoardCols(game) < 20
            : game.occupancy.length < 12) &&
          blackAugments.some((a) => a.id === "domain-expansion"),
    onDomain: spellGuard(handleDomainExpansion),
    monolithPlaceAvailable:
      color === "white"
        ? whiteAugments.some((a) => a.id === "impassable") &&
          !whiteMonolithPermRemoved &&
          !getDerivedBoard(game).some((row) =>
            row.some((sq) => sq?.type === "M" && sq.color === "white"),
          )
        : blackAugments.some((a) => a.id === "impassable") &&
          !blackMonolithPermRemoved &&
          !getDerivedBoard(game).some((row) =>
            row.some((sq) => sq?.type === "M" && sq.color === "black"),
          ),
    monolithPlaceActive: monolithMode === "place" && canUseSpells,
    onMonolithPlace: spellGuard(handleToggleMonolithPlace),
    monolithRemoveAvailable:
      color === "white"
        ? getDerivedBoard(game).some((row) =>
            row.some((sq) => sq?.type === "M" && sq.color === "white"),
          )
        : getDerivedBoard(game).some((row) =>
            row.some((sq) => sq?.type === "M" && sq.color === "black"),
          ),
    onMonolithRemove: spellGuard(handleToggleMonolithRemove),
    contractAvailable:
      color === "white"
        ? whiteAugments.some((a) => a.id === "contract-killer") &&
          !whiteContractPieceId
        : blackAugments.some((a) => a.id === "contract-killer") &&
          !blackContractPieceId,
    contractActive: contractMode && canUseSpells,
    onContract: spellGuard(handleToggleContract),
    contractTarget:
      color === "white" ? whiteContractTarget : blackContractTarget,
    blessedWaterCharges:
      color === "white" ? whiteBlessedWaterCharges : blackBlessedWaterCharges,
    blessedWaterActive: blessedWaterMode && canUseSpells,
    onBlessedWater: spellGuard(handleToggleBlessedWater),
    puppetAvailable:
      color === "white"
        ? !whitePuppetUsed && whiteAugments.some((a) => a.id === "puppet")
        : !blackPuppetUsed && blackAugments.some((a) => a.id === "puppet"),
    puppetActive: puppetMode && canUseSpells,
    onPuppet: spellGuard(handleTogglePuppet),
    evadeCharges:
      color === "white" ? whiteEvadeCharges : blackEvadeCharges,
    evadeActive: false,
    onEvade: spellGuard(handleEvade),
    canUndo: color === "white" ? canWhiteUndo : canBlackUndo,
    onUndo: handleUndo,
    captureCount: color === "white" ? whiteCaptureCount : blackCaptureCount,
    hasBloodlust:
      color === "white"
        ? whiteAugments.some((a) => a.id === "bloodlust")
        : blackAugments.some((a) => a.id === "bloodlust"),
    shopOpen: shopOpen && canUseSpells,
    onToggleShop: turnGuard(handleToggleShop),
    hasTallPolitician: (color === "white" ? whiteAugments : blackAugments).some(
      (a) => a.id === "tall-politician",
    ),
    tallPoliticianVault: color === "white" ? whiteTaxVault : blackTaxVault,
    onCollectTax: () => handleCollectTax(color),
    plotArmourRounds:
      color === "white"
        ? game.plotArmourWhiteRoundsLeft ?? 0
        : game.plotArmourBlackRoundsLeft ?? 0,
  };
  };

  const modeBanner = (() => {
    if (sacrificeMode)
      return {
        text: "♜ Sacrifice — click one of your rooks to gain a high-tier augment",
        color: "#f97316",
      };
    if (auctionPlaceFor)
      return {
        text: `🏷️ Place your auction ${auctionPlaceFor.pieceType} on the board`,
        color: "#fbbf24",
      };
    if (littleBigManMode)
      return {
        text: "👶👑 Little Big Man — click one of your pawns",
        color: "#eab308",
      };
    if (bloodbendingPlusMode)
      return {
        text: "🩸✨ Bloodbending+ — click an enemy knight, bishop, or rook (not on blessed)",
        color: "#b91c1c",
      };
    if (bloodbendingMode)
      return {
        text: "🩸 Bloodbending — click an enemy pawn (not on a blessed square)",
        color: "#dc2626",
      };
    if (freezeMode)
      return {
        text: "❄️ Click an enemy piece to freeze it (not king)",
        color: "#06b6d4",
      };
    if (necroMode)
      return {
        text: "💀 Click a home-rank square to revive a pawn",
        color: "#a855f7",
      };
    if (necroPPMode)
      return {
        text: "💀💫 Necromancer++ — click an empty square on your back rank to place a queen",
        color: "#e879f9",
      };
    if (necroPlusMode)
      return {
        text: "💀✨ Click your back rank to revive your last captured knight or bishop",
        color: "#c084fc",
      };
    if (ilkkanMode)
      return {
        text: "🧑 ILKKAN — Click one of your pawns to mark it as İlkkan",
        color: "#6b7280",
      };
    if (pawnPlaceFor)
      return {
        text: "♙ Pawn Shop — click an empty square on your original pawn rank",
        color: "#22c55e",
      };
    if (royalEdMode)
      return {
        text: "♞ Click a destination for your king's knight move",
        color: "#facc15",
      };
    if (whatMode && !whatSelected)
      return {
        text: "↔️ Click one of your pawns to move it sideways",
        color: "#f97316",
      };
    if (whatMode && whatSelected)
      return { text: "↔️ Click the destination square", color: "#f97316" };
    if (swapMode && !swapFirst)
      return {
        text: "🔀 SWAP — Click your first piece (frozen pieces cannot swap)",
        color: "#a78bfa",
      };
    if (swapMode && swapFirst)
      return {
        text: "🔀 SWAP — Click a second piece to trade squares (your king cannot end in check)",
        color: "#a78bfa",
      };
    if (sakoMode && !sakoSelected)
      return {
        text: "⚓ ŞAKO — Click any of your pieces to teleport anywhere",
        color: "#eab308",
      };
    if (sakoMode && sakoSelected)
      return {
        text: "⚓ ŞAKO — Click any empty square on the board",
        color: "#eab308",
      };
    if (royalHouseholdMode)
      return {
        text: "🏰 RAMPAGE — Click a destination (up to 4 squares, destroys all in path)",
        color: "#ef4444",
      };
    if (deathNoteMode)
      return {
        text: "☠️ DEATH NOTE — Click an enemy piece (not king/queen) to doom it in 16 turns (each move ticks)",
        color: "#dc2626",
      };
    if (monolithMode === "place")
      return {
        text: "🗿 Click an empty square to place your monolith (spends a turn)",
        color: "#64748b",
      };
    if (monolithMode === "remove")
      return {
        text: "🗿 Click your monolith to remove it (free action)",
        color: "#64748b",
      };
    if (contractMode)
      return {
        text: "🎯 CONTRACT — Click an enemy piece (not king/pawn) to mark it (one contract per pick)",
        color: "#f59e0b",
      };
    if (blessedWaterMode)
      return {
        text: "💧 BLESS — Click any square to protect the piece on it for 2 rounds",
        color: "#22d3ee",
      };
    if (puppetMode)
      return {
        text: "🪆 PUPPET — Click an enemy piece to force them to play it next turn",
        color: "#f97316",
      };
    if (
      activePuppetColor === game.turn &&
      activePuppetSquare &&
      game.status !== "check"
    )
      return {
        text: "🪆 You are puppeted! You MUST move the marked piece.",
        color: "#ef4444",
      };
    return null;
  })();

  const activePlayerGold =
    game.turn === "white" ? game.goldWhite : game.goldBlack;
  const activeTierBought =
    game.turn === "white" ? whiteTierBought : blackTierBought;
  const pawnShopNextPrice = (() => {
    const color = game.turn;
    const has =
      color === "white"
        ? whiteAugments.some((a) => a.id === "pawn-shop")
        : blackAugments.some((a) => a.id === "pawn-shop");
    if (!has) return null;
    const bought = color === "white" ? whitePawnShopBuys : blackPawnShopBuys;
    const level = getImproveLevel(
      color === "white" ? whiteAugmentLevels : blackAugmentLevels,
      "pawn-shop",
    );
    return getPawnShopPrice(level, bought);
  })();

  const fullRoundsPlayed = blackTurnCount;
  const fullRoundsUntilBoardEvent = Math.max(0, nextEventTurn - fullRoundsPlayed);
  const fullRoundsUntilAuction = Math.max(0, nextAuctionTurn - fullRoundsPlayed);

  const opponentAugmentPickActive =
    !!mpConfig &&
    !!currentTrigger &&
    !isLocalAugmentPicker(currentTrigger.color, augmentPickSlot);

  const myAuctionColor = mpConfig?.myColor ?? game.turn;
  const myAuctionGold =
    myAuctionColor === "white" ? game.goldWhite : game.goldBlack;
  const auctionPlacementPending =
    !!auctionPlaceFor &&
    (!mpConfig || mpConfig.myColor === auctionPlaceFor.color);

  const preGamePhase =
    phase === "start" ||
    phase === "white-augment" ||
    phase === "black-augment";

  // ── Render ────────────────────────────────────────────────────────────────

  if (mpConfig && !mpReady) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "#030712",
          color: "#fff",
        }}
      >
        <div style={{ fontSize: 14, color: "#9ca3af" }}>Setting up game…</div>
      </div>
    );
  }

  const eventBannerEl = (
    <div className="rounded-lg border border-slate-700 bg-slate-900/90 px-3.5 py-1.5 text-[11px] font-semibold tracking-wide text-slate-400 shadow-lg">
      <span className="text-slate-300">Board event</span>
      {" — fires after full round "}
      <span className="text-amber-400">{nextEventTurn}</span>
      {" · "}
      <span className="text-slate-200">
        {fullRoundsUntilBoardEvent} full round
        {fullRoundsUntilBoardEvent === 1 ? "" : "s"} away
      </span>
      {" · "}
      <span className="text-slate-300">Auction</span>
      {" — "}
      <span className="text-slate-200">
        {fullRoundsUntilAuction} full round
        {fullRoundsUntilAuction === 1 ? "" : "s"} away
      </span>
      {activeApocalypse && (
        <>
          {" · "}
          <span className="text-red-400">
            Apocalypse in {activeApocalypse.fullRoundsLeft} round
            {activeApocalypse.fullRoundsLeft === 1 ? "" : "s"}
          </span>
        </>
      )}
      {chaosEventTiming && (
        <span className="ml-2 text-pink-400">(Chaos)</span>
      )}
    </div>
  );

  const boardOverlays = (
    <>
      {promotionPending && (
        <PromotionDialog color={game.turn} onChoose={handlePromotion} />
      )}
      {pendingEvent && (
        <EventAnnouncement
          event={pendingEvent}
          peaceTreatyLeft={peaceTreatyRoundsLeft}
          onClose={() => setPendingEvent(null)}
        />
      )}
      {isOver && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55">
          <div className={`${chessShell.card} pointer-events-auto flex flex-col items-center gap-2.5 px-9 py-5`}>
            <span
              className="text-[22px] font-black tracking-wide"
              style={{ color: statusText.color }}
            >
              {statusText.label}
            </span>
            <button
              type="button"
              onClick={resetGame}
              className="rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-400 px-7 py-2 text-sm font-bold text-white shadow-[0_3px_12px_rgba(99,102,241,0.5)]"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
      {modeBanner && (
        <div
          className="pointer-events-none absolute left-1/2 top-2.5 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 px-4 py-1 text-[11px] font-extrabold uppercase tracking-wider"
          style={{
            color: modeBanner.color,
            boxShadow: `0 2px 12px rgba(0,0,0,0.5),0 0 0 1px ${modeBanner.color}40`,
          }}
        >
          {modeBanner.text}
        </div>
      )}
      {mpConfig && opponentAugmentPickActive && !isOver && (
        <div className="pointer-events-none absolute bottom-2.5 left-1/2 z-[85] -translate-x-1/2 whitespace-nowrap rounded-full bg-black/80 px-4 py-1.5 text-[11px] font-bold tracking-wide text-indigo-300">
          Opponent is choosing an augment…
        </div>
      )}
      {mpConfig && !isMyTurn && !isOver && !opponentAugmentPickActive && (
        <div className="pointer-events-none absolute bottom-2.5 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/75 px-4 py-1 text-[11px] font-bold tracking-wide text-slate-400">
          {gameIs2v2 ? "Waiting for other players…" : "Opponent\u2019s turn…"}
        </div>
      )}
      {mpConfig?.connectionLost && !mpConfig.opponentLeft && (
        <div className="pointer-events-none absolute left-1/2 top-2.5 z-[25] -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-500/45 bg-amber-500/15 px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-amber-300">
          Connection lost — reconnecting…
        </div>
      )}
      {mpConfig?.opponentLeft && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className={`${chessShell.card} px-9 py-6 text-center`}>
            <div className="mb-2.5 text-[32px]">🔌</div>
            <div className="mb-1.5 text-base font-bold">Opponent disconnected</div>
            <div className="text-sm text-slate-400">The game has ended.</div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div
      className={`${chessShell.page} ${chessShell.column} relative ${
        mpViewFlipped ? "flex-col-reverse" : "flex-col"
      }`}
    >
      <PlayerBar
        color="black"
        isActive={game.turn === "black"}
        isOver={isOver}
        phase={phase}
        augments={blackAugments}
        gold={game.goldBlack}
        capturedPieces={game.capturedByBlack}
        advantage={adv.black > 0 ? adv.black : 0}
        spells={makeSpells("black")}
        taxStealBanner={taxStealBanner}
        statusLabel={botThinking ? "Thinking…" : undefined}
        statusColor={botThinking ? "#f97316" : undefined}
        statusBadge={botThinking}
      />

      <div
        ref={boardStageRef}
        className={`w-full flex-shrink-0 ${preGamePhase ? "pointer-events-none" : ""}`}
      >
        <BoardStage
          boardPxW={boardPxW}
          boardPxH={boardPxH}
          stageMinHeight={stageMinHeight}
          boardThemeId={boardThemeId}
          onThemeChange={setBoardThemeId}
          showEventBanner={phase === "playing" && !isOver}
          eventBanner={eventBannerEl}
          overlays={boardOverlays}
        >
          <div
            className="grid shrink-0 rounded-sm border-[3px] border-[#5c3d1e] shadow-[0_8px_40px_rgba(0,0,0,0.8),0_2px_8px_rgba(0,0,0,0.5)]"
            style={{
              width: boardPxW,
              height: boardPxH,
              gridTemplateColumns: `repeat(${boardCols},${sqSize}px)`,
              gridTemplateRows: `repeat(${boardRows},${sqSize}px)`,
            }}
          >
          {Array.from({ length: boardRows }, (_, dr) =>
            Array.from({ length: boardCols }, (_, dc) => {
              const r = mpViewFlipped ? boardRows - 1 - dr : dr;
              const c = mpViewFlipped ? boardCols - 1 - dc : dc;
              const piece = getDerivedBoard(game)[r]?.[c] ?? null;
              const isSel = selected?.[0] === r && selected?.[1] === c;
              const isVM = validMoves.some(([vr, vc]) => vr === r && vc === c);
              const isLM = !!(
                game.lastMove &&
                ((game.lastMove.from[0] === r && game.lastMove.from[1] === c) ||
                  (game.lastMove.to[0] === r && game.lastMove.to[1] === c))
              );
              const isCK = (() => {
                if (piece?.type !== "K") return false;
                if (game.status !== "check" && game.status !== "checkmate")
                  return false;
                if (gameIs2v2 && game.turnSlot) {
                  const [kr, kc] = findKingForSlot(game, game.turnSlot);
                  return kr === r && kc === c;
                }
                return (
                  piece.color === game.turn &&
                  (game.status === "check" || game.status === "checkmate")
                );
              })();
              const showTeamSetMarker =
                gameIs2v2 && piece?.setIndex === 1;
              const isCenter =
                showCenterMarkers && centerSquares.has(`${r},${c}`);
              const isFrozen = !!(
                frozenSquare &&
                frozenSquare[0] === r &&
                frozenSquare[1] === c
              );
              const dn = piece?.id
                ? deathNoteTargets.find((d) => d.pieceId === piece.id)
                : undefined;
              const isApocalypseZone = !!(
                activeApocalypse &&
                isApocalypseSquare(r, c, boardRows, boardCols)
              );
              const isNukeSquare = !!(
                activeNuke &&
                r >= activeNuke.topRow &&
                r < activeNuke.topRow + 3 &&
                c >= activeNuke.leftCol &&
                c < activeNuke.leftCol + 3
              );
              const showNukeCount =
                isNukeSquare &&
                r === activeNuke!.topRow &&
                c === activeNuke!.leftCol;
              const isBlessed = blessedSquares.some(
                (b) => b.row === r && b.col === c,
              );
              const isColdWind =
                coldWindsMovesLeft > 0 &&
                coldWindsSquares.some(([cr, cc]) => cr === r && cc === c);
              const contractMark =
                !!(
                  whiteContractTarget &&
                  whiteContractTarget[0] === r &&
                  whiteContractTarget[1] === c
                ) ||
                !!(
                  blackContractTarget &&
                  blackContractTarget[0] === r &&
                  blackContractTarget[1] === c
                );
              const isWall = wallSquares.some(
                (w) => w.row === r && w.col === c,
              );
              const isPuppet = !!(
                activePuppetSquare &&
                activePuppetSquare[0] === r &&
                activePuppetSquare[1] === c
              );
              const isIlkkanSq = !!(
                piece?.id &&
                (piece.id === whiteIlkkanId || piece.id === blackIlkkanId)
              );
              const isPermaWinter = isPermaFrostSquare(game, r, c);
              const isTutorialHighlight =
                tutorialRestrictions?.highlightSquares?.some(
                  ([hr, hc]) => hr === r && hc === c,
                ) ?? false;
              return (
                <SquareEl
                  key={`${dr}-${dc}`}
                  row={r}
                  col={c}
                  viewFlipped={mpViewFlipped}
                  size={sqSize}
                  piece={piece}
                  isSelected={isSel}
                  isValidMove={isVM}
                  isLastMove={isLM}
                  isCheckKing={isCK}
                  isCenter={isCenter}
                  isFrozen={isFrozen}
                  isPermaWinter={isPermaWinter}
                  onClick={() => handleSquareClick(r, c)}
                  boardSize={boardRows}
                  boardCols={boardCols}
                  showTeamSetMarker={showTeamSetMarker}
                  deathNoteCount={dn?.turnsLeft}
                  isNuke={isNukeSquare}
                  isApocalypse={isApocalypseZone}
                  nukeMovesLeft={
                    showNukeCount ? activeNuke!.movesLeft : undefined
                  }
                  isBlessed={isBlessed}
                  isColdWind={isColdWind}
                  contractMark={contractMark}
                  isWall={isWall}
                  isPuppet={isPuppet}
                  isIlkkan={isIlkkanSq}
                  isTutorialHighlight={isTutorialHighlight}
                  squarePalette={boardPalette}
                />
              );
            }),
          )}
          </div>
        </BoardStage>
      </div>

      <PlayerBar
        color="white"
        isActive={game.turn === "white"}
        isOver={isOver}
        phase={phase}
        augments={whiteAugments}
        gold={game.goldWhite}
        capturedPieces={game.capturedByWhite}
        advantage={adv.white > 0 ? adv.white : 0}
        spells={makeSpells("white")}
        taxStealBanner={taxStealBanner}
        statusLabel={
          phase === "playing" && !isOver ? statusText.label : undefined
        }
        statusColor={statusText.color}
        statusBadge={game.status === "check"}
      />

      {activeAuction?.status === "active" && phase === "playing" && !isOver && (
        <AuctionPanel
          auction={activeAuction}
          myColor={myAuctionColor}
          myGold={myAuctionGold}
          onBid={handleAuctionBid}
          placementPending={auctionPlacementPending}
        />
      )}

      <ShopPanel
        open={shopOpen && phase === "playing" && !isOver}
        playerColor={game.turn}
        gold={activePlayerGold}
        tierBought={activeTierBought}
        playerAugments={game.turn === "white" ? whiteAugments : blackAugments}
        augmentLevels={
          game.turn === "white" ? whiteAugmentLevels : blackAugmentLevels
        }
        onBuy={handleBuy}
        onImprove={handleImprove}
        onClose={() => {
          if (tutorialMode && tutorialRestrictions?.blockShopClose) return;
          setShopOpen(false);
        }}
        enabledShopIds={
          tutorialRestrictions?.allowedShopIds
            ? new Set(tutorialRestrictions.allowedShopIds)
            : undefined
        }
        pawnShopNextPrice={pawnShopNextPrice}
        onBuyPawn={pawnShopNextPrice != null ? handleBuyPawn : null}
        pawnPlacePending={pawnPlaceFor !== null || pawnPlaceSlot !== null}
      />

      {/* Phase overlays — above board; board input disabled until playing */}
      {preGamePhase && !tutorialMode && (
        <div className="pointer-events-none absolute inset-0 z-[100]">
          {phase === "start" && (
            <div className="pointer-events-auto h-full w-full">
              <StartScreen
                onStart={handleStart}
                subtitle={
                  botMode ? "Face Stockfish as White" : undefined
                }
              />
            </div>
          )}
          {phase === "white-augment" && (
            <div className="pointer-events-auto h-full w-full">
              <AugmentSelector
                playerColor="white"
                offered={offeredToWhite}
                onSelect={handleWhitePick}
                enabledIds={
                  tutorialRestrictions?.allowedAugmentIds
                    ? new Set(tutorialRestrictions.allowedAugmentIds)
                    : undefined
                }
              />
            </div>
          )}
          {phase === "black-augment" && (
            <div className="pointer-events-auto h-full w-full">
              <AugmentSelector
                playerColor="black"
                offered={offeredToBlack}
                onSelect={handleBlackPick}
              />
            </div>
          )}
        </div>
      )}
      {phase === "playing" &&
        currentTrigger !== null &&
        isLocalAugmentPicker(currentTrigger.color, augmentPickSlot) && (
        <AugmentSelector
          playerColor={currentTrigger.color}
          offered={midGameOffered}
          onSelect={handleMidGamePick}
          trigger={currentTrigger}
        />
      )}
      {phase === "playing" &&
        blindRagePickColor &&
        isLocalAugmentPicker(blindRagePickColor, blindRagePickSlot) && (
        <AugmentSelector
          pickMode="blind-rage"
          playerColor={blindRagePickColor}
          offered={blindRageOffered}
          onSelect={handleBlindRagePick}
        />
      )}
    </div>
  );
}
