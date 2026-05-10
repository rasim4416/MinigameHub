import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChessState, PieceType, Color,
  PIECE_UNICODE, PIECE_VALUE,
  createInitialState, getLegalMoves, makeMove,
  materialAdvantage, opp,
} from "./engine";
import { Augment, rollAugments, RARITY_META } from "./augments";

// ─── Types ────────────────────────────────────────────────────────────────────

type GamePhase = "start" | "white-augment" | "black-augment" | "playing";
type Milestones = { knight: boolean; bishop: boolean; rook: boolean };
const EMPTY_MILESTONES: Milestones = { knight: false, bishop: false, rook: false };

// Center squares for King of the Hill: d4(4,3) d5(3,3) e4(4,4) e5(3,4)
const CENTER_SQUARES = new Set(["4,3", "3,3", "4,4", "3,4"]);

function checkNewMilestone(captured: PieceType | null, ms: Milestones): PieceType | null {
  if (!captured) return null;
  if (captured === "N" && !ms.knight) return "N";
  if (captured === "B" && !ms.bishop) return "B";
  if (captured === "R" && !ms.rook)   return "R";
  return null;
}

function applyMilestone(type: PieceType, ms: Milestones): Milestones {
  return {
    knight: type === "N" ? true : ms.knight,
    bishop: type === "B" ? true : ms.bishop,
    rook:   type === "R" ? true : ms.rook,
  };
}

/**
 * Apply end-of-turn passive augment effects (Miner, King of the Hill).
 * Called AFTER makeMove, so the board already reflects the move.
 */
function applyEndOfTurnEffects(
  g: ChessState,
  movingColor: Color,
  augments: Augment[],
  turnCount: number, // this player's turn count including the current move
): ChessState {
  let delta = 0;
  for (const aug of augments) {
    // Miner: +1 gold every 2 turns
    if (aug.id === "miner" && turnCount % 2 === 0) delta += 1;

    // King of the Hill: +1 gold per own piece on center squares
    if (aug.id === "king-of-the-hill") {
      for (const key of CENTER_SQUARES) {
        const [r, c] = key.split(",").map(Number);
        if (g.board[r][c]?.color === movingColor) delta += 1;
      }
    }
  }
  if (delta === 0) return g;
  return {
    ...g,
    goldWhite: movingColor === "white" ? g.goldWhite + delta : g.goldWhite,
    goldBlack: movingColor === "black" ? g.goldBlack + delta : g.goldBlack,
  };
}

// ─── Board square constants ───────────────────────────────────────────────────

const LIGHT_SQ   = "#f0d9b5";
const DARK_SQ    = "#b58863";
const SEL_LIGHT  = "#f6f669";
const SEL_DARK   = "#baca2b";
const LAST_LIGHT = "#cdd16f";
const LAST_DARK  = "#aaa23a";

// ─── SquareEl ─────────────────────────────────────────────────────────────────

function SquareEl({
  row, col, size, piece, isSelected, isValidMove, isLastMove, isCheckKing,
  isCenter, onClick,
}: {
  row: number; col: number; size: number;
  piece: { type: PieceType; color: Color } | null;
  isSelected: boolean; isValidMove: boolean; isLastMove: boolean;
  isCheckKing: boolean; isCenter: boolean;
  onClick: () => void;
}) {
  const light = (row + col) % 2 === 0;
  let bg = light ? LIGHT_SQ : DARK_SQ;
  if (isCheckKing)  bg = "#c82020";
  else if (isSelected) bg = light ? SEL_LIGHT : SEL_DARK;
  else if (isLastMove) bg = light ? LAST_LIGHT : LAST_DARK;

  const dot  = size * 0.3;
  const ring = size * 0.07;

  return (
    <div onClick={onClick} style={{
      width: size, height: size, backgroundColor: bg,
      position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", transition: "background-color 0.1s",
    }}>
      {col === 0 && (
        <span style={{
          position: "absolute", top: 2, left: 3,
          fontSize: Math.max(9, size * 0.18), fontWeight: 700,
          color: light ? DARK_SQ : LIGHT_SQ, userSelect: "none", lineHeight: 1,
        }}>{8 - row}</span>
      )}
      {row === 7 && (
        <span style={{
          position: "absolute", bottom: 2, right: 3,
          fontSize: Math.max(9, size * 0.18), fontWeight: 700,
          color: light ? DARK_SQ : LIGHT_SQ, userSelect: "none", lineHeight: 1,
        }}>{String.fromCharCode(97 + col)}</span>
      )}
      {/* King of the Hill center marker */}
      {isCenter && (
        <div style={{
          position: "absolute", top: 3, right: 3,
          width: 5, height: 5,
          background: "rgba(234,179,8,0.6)",
          borderRadius: "50%",
          pointerEvents: "none",
          boxShadow: "0 0 3px rgba(234,179,8,0.8)",
        }} />
      )}
      {isValidMove && !piece && (
        <div style={{ width: dot, height: dot, borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.22)", pointerEvents: "none" }} />
      )}
      {isValidMove && piece && (
        <div style={{
          position: "absolute", inset: ring, borderRadius: "50%",
          border: `${Math.max(3, size * 0.07)}px solid rgba(0,0,0,0.28)`, pointerEvents: "none",
        }} />
      )}
      {piece && (
        <span style={{
          fontSize: size * 0.72, lineHeight: 1,
          color: piece.color === "white" ? "#ffffff" : "#1a0f00",
          textShadow: piece.color === "white"
            ? "0 0 3px #000, 0 0 6px #000, 1px 1px 0 #222"
            : "0 0 3px rgba(255,255,255,0.7), 1px 1px 0 rgba(255,255,255,0.5)",
          userSelect: "none", pointerEvents: "none",
        }}>
          {PIECE_UNICODE[piece.color][piece.type]}
        </span>
      )}
    </div>
  );
}

// ─── CapturedRow ──────────────────────────────────────────────────────────────

function CapturedRow({ pieces, byColor, advantage }: {
  pieces: PieceType[]; byColor: Color; advantage: number;
}) {
  const sorted = [...pieces].sort((a, b) => PIECE_VALUE[b] - PIECE_VALUE[a]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
      {sorted.map((t, i) => (
        <span key={i} style={{
          fontSize: 16, lineHeight: 1,
          color: byColor === "white" ? "#fff" : "#1a0f00",
          textShadow: byColor === "white"
            ? "0 0 2px #000, 0 0 4px #000"
            : "0 0 2px rgba(255,255,255,0.6)",
        }}>{PIECE_UNICODE[byColor][t]}</span>
      ))}
      {advantage > 0 && (
        <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, marginLeft: 2 }}>+{advantage}</span>
      )}
    </div>
  );
}

// ─── PromotionDialog ──────────────────────────────────────────────────────────

function PromotionDialog({ color, onChoose }: { color: Color; onChoose: (t: PieceType) => void }) {
  const pieces: PieceType[] = ["Q", "R", "B", "N"];
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#1f2937", border: "1px solid #374151", borderRadius: 14,
        padding: "18px 24px", display: "flex", flexDirection: "column",
        alignItems: "center", gap: 14, boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
      }}>
        <p style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 14, margin: 0 }}>Promote Pawn</p>
        <div style={{ display: "flex", gap: 10 }}>
          {pieces.map(t => (
            <button key={t} onClick={() => onChoose(t)} style={{
              width: 56, height: 56, borderRadius: 10,
              background: "#111827", border: "2px solid #4b5563",
              cursor: "pointer", fontSize: 32, lineHeight: 1,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: color === "white" ? "#ffffff" : "#1a0f00",
              textShadow: color === "white" ? "0 0 3px #000, 0 0 6px #000" : "0 0 3px rgba(255,255,255,0.7)",
              transition: "border-color 0.15s, background 0.15s",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#6366f1"; (e.currentTarget as HTMLElement).style.background = "#1e1b4b"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#4b5563"; (e.currentTarget as HTMLElement).style.background = "#111827"; }}
            >
              {PIECE_UNICODE[color][t]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── GoldBadge ────────────────────────────────────────────────────────────────

function GoldBadge({ gold, active }: { gold: number; active: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5,
      background: gold > 0 ? "linear-gradient(135deg,#1c1500,#2d2000)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${gold > 0 ? "rgba(234,179,8,0.35)" : "rgba(255,255,255,0.08)"}`,
      borderRadius: 20, padding: "2px 8px 2px 5px", transition: "all 0.3s",
      boxShadow: gold > 0 && active ? "0 0 8px rgba(234,179,8,0.25)" : "none",
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
        background: "radial-gradient(ellipse at 35% 30%,#fde047,#eab308 55%,#a16207)",
        boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.25), 0 1px 3px rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 8, fontWeight: 900, color: "#422006", lineHeight: 1 }}>G</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 800, color: gold > 0 ? "#facc15" : "#4b5563", lineHeight: 1, minWidth: 14, textAlign: "right" }}>
        {gold}
      </span>
    </div>
  );
}

// ─── AugmentIconChip ─────────────────────────────────────────────────────────

function AugmentIconChip({ augment }: { augment: Augment }) {
  const m = RARITY_META[augment.rarity];
  return (
    <div title={`${augment.name} — ${augment.description}`} style={{
      width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
      border: `1.5px solid ${m.border}`, background: "#0f172a",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: `0 0 5px ${m.glow}`, cursor: "default",
    }}>
      <span style={{ fontSize: 12, lineHeight: 1 }}>{augment.icon}</span>
    </div>
  );
}

// ─── UndoButton ──────────────────────────────────────────────────────────────

function UndoButton({ onUndo }: { onUndo: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onUndo}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title="Use your Oops! undo"
      style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: "2px 8px", fontSize: 10, fontWeight: 800,
        borderRadius: 6, border: `1px solid ${hov ? "#6366f1" : "#374151"}`,
        background: hov ? "#1e1b4b" : "#111827",
        color: hov ? "#a5b4fc" : "#9ca3af",
        cursor: "pointer", transition: "all 0.15s", flexShrink: 0,
        letterSpacing: "0.04em",
      }}
    >
      <span style={{ fontSize: 11 }}>↩</span> UNDO
    </button>
  );
}

// ─── AugmentCard ─────────────────────────────────────────────────────────────

function AugmentCard({ augment, onSelect }: { augment: Augment; onSelect: () => void }) {
  const [hov, setHov] = useState(false);
  const m = RARITY_META[augment.rarity];
  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 155, padding: "18px 14px 14px",
        borderRadius: 14, position: "relative",
        border: `2px solid ${hov ? m.border : "rgba(255,255,255,0.07)"}`,
        background: hov ? "#0b1120" : "#080e1a",
        cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        boxShadow: hov ? `0 0 22px ${m.glow}, 0 4px 16px rgba(0,0,0,0.5)` : "0 2px 8px rgba(0,0,0,0.4)",
        transform: hov ? "translateY(-5px) scale(1.02)" : "translateY(0) scale(1)",
        transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
        userSelect: "none",
      }}
    >
      <div style={{
        position: "absolute", top: 0, left: 14, right: 14, height: 3,
        borderRadius: "0 0 3px 3px",
        background: `linear-gradient(90deg, transparent, ${m.border}, transparent)`,
        opacity: hov ? 1 : 0.4, transition: "opacity 0.2s",
      }} />
      <span style={{ fontSize: 36, lineHeight: 1, filter: hov ? "drop-shadow(0 0 8px rgba(255,255,255,0.3))" : "none", transition: "filter 0.2s" }}>
        {augment.icon}
      </span>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: "#f1f5f9", margin: "0 0 5px", letterSpacing: "0.01em" }}>
          {augment.name}
        </p>
        <p style={{ fontSize: 10.5, color: "#64748b", margin: 0, lineHeight: 1.45 }}>
          {augment.description}
        </p>
      </div>
      <div style={{
        fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase",
        padding: "2px 10px", borderRadius: 20,
        background: m.badge, color: m.text, border: `1px solid ${m.border}`,
      }}>
        {m.label}
      </div>
    </div>
  );
}

// ─── AugmentSelector ─────────────────────────────────────────────────────────

const MILESTONE_LABEL: Partial<Record<PieceType, string>> = {
  N: "First Knight Captured!",
  B: "First Bishop Captured!",
  R: "First Rook Captured!",
};

function AugmentSelector({ playerColor, offered, onSelect, milestone }: {
  playerColor: Color; offered: Augment[]; onSelect: (aug: Augment) => void;
  milestone?: PieceType | null;
}) {
  const isWhite = playerColor === "white";
  const milestoneLabel = milestone ? MILESTONE_LABEL[milestone] : null;

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 80,
      background: "linear-gradient(160deg, #030712 0%, #080e1f 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 16, padding: "16px 12px",
    }}>
      <div style={{ textAlign: "center" }}>
        {milestoneLabel ? (
          <div style={{
            display: "inline-block", marginBottom: 10,
            padding: "4px 14px", borderRadius: 20,
            background: "linear-gradient(135deg,#1c1f2e,#2d2f45)",
            border: "1px solid #4f46e5",
            fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
            color: "#818cf8", textTransform: "uppercase",
          }}>
            ✦ {milestoneLabel}
          </div>
        ) : (
          <p style={{
            fontSize: 10, letterSpacing: "0.2em", fontWeight: 700,
            color: "#475569", margin: "0 0 6px", textTransform: "uppercase",
          }}>
            Choose your augment
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <div style={{
            width: 12, height: 12, borderRadius: "50%", flexShrink: 0,
            background: isWhite ? "#ffffff" : "#1a0f00",
            border: `2px solid ${isWhite ? "#94a3b8" : "#6b7280"}`,
            boxShadow: `0 0 10px ${isWhite ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"}`,
          }} />
          <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, letterSpacing: "0.08em", color: "#f1f5f9" }}>
            {playerColor.toUpperCase()}
          </h2>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        {offered.map(aug => (
          <AugmentCard key={aug.id} augment={aug} onSelect={() => onSelect(aug)} />
        ))}
      </div>

      <p style={{ fontSize: 10, color: "#334155", margin: 0 }}>Click a card to select it</p>
    </div>
  );
}

// ─── StartScreen ─────────────────────────────────────────────────────────────

function StartScreen({ onStart }: { onStart: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 80,
      background: "linear-gradient(160deg, #030712 0%, #080e1f 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 18,
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,10px)", gap: 1, opacity: 0.15, marginBottom: 4 }}>
        {Array.from({ length: 16 }, (_, i) => (
          <div key={i} style={{ width: 10, height: 10, background: (Math.floor(i / 4) + i) % 2 === 0 ? "#f0d9b5" : "#b58863" }} />
        ))}
      </div>
      <span style={{ fontSize: 48, lineHeight: 1, filter: "drop-shadow(0 4px 16px rgba(99,102,241,0.4))" }}>♟️</span>
      <div style={{ textAlign: "center" }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: "#f1f5f9", margin: "0 0 6px", letterSpacing: "0.04em" }}>
          Chess Roguelike
        </h2>
        <p style={{ fontSize: 12, color: "#475569", margin: 0, lineHeight: 1.6 }}>
          Classic chess · Each player picks an augment<br />before the game begins
        </p>
      </div>
      <button
        onClick={onStart}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          padding: "11px 44px", fontSize: 14, fontWeight: 800,
          letterSpacing: "0.1em", textTransform: "uppercase",
          borderRadius: 12, border: "none", cursor: "pointer",
          background: hov ? "linear-gradient(135deg,#4338ca,#6366f1)" : "linear-gradient(135deg,#4f46e5,#818cf8)",
          color: "#fff",
          boxShadow: hov ? "0 6px 28px rgba(99,102,241,0.65)" : "0 4px 18px rgba(99,102,241,0.45)",
          transform: hov ? "translateY(-2px)" : "none", transition: "all 0.18s",
        }}
      >
        Start Game
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChessGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardPx, setBoardPx] = useState(320);

  // Chess engine state
  const [game, setGame] = useState<ChessState>(createInitialState);
  const [selected, setSelected]   = useState<[number, number] | null>(null);
  const [validMoves, setValidMoves] = useState<[number, number][]>([]);
  const [promotionPending, setPromotionPending] = useState<{
    from: [number, number]; to: [number, number];
  } | null>(null);

  // Roguelike: pregame phase
  const [phase, setPhase] = useState<GamePhase>("start");
  const [offeredToWhite, setOfferedToWhite] = useState<Augment[]>([]);
  const [offeredToBlack, setOfferedToBlack] = useState<Augment[]>([]);
  const [whiteAugments, setWhiteAugments] = useState<Augment[]>([]);
  const [blackAugments, setBlackAugments] = useState<Augment[]>([]);

  // Roguelike: mid-game milestone picks
  const [whiteMilestones, setWhiteMilestones] = useState<Milestones>(EMPTY_MILESTONES);
  const [blackMilestones, setBlackMilestones] = useState<Milestones>(EMPTY_MILESTONES);
  const [pendingAugmentFor, setPendingAugmentFor]   = useState<Color | null>(null);
  const [pendingMilestoneType, setPendingMilestoneType] = useState<PieceType | null>(null);
  const [midGameOffered, setMidGameOffered] = useState<Augment[]>([]);

  // Augment effect state
  const [whiteTurnCount, setWhiteTurnCount] = useState(0); // for Miner
  const [blackTurnCount, setBlackTurnCount] = useState(0);
  const [gameHistory, setGameHistory]       = useState<ChessState[]>([]); // for Oops
  const [whiteUndosLeft, setWhiteUndosLeft] = useState(0);
  const [blackUndosLeft, setBlackUndosLeft] = useState(0);

  // Whether either player has King of the Hill (show center markers)
  const showCenterMarkers =
    phase === "playing" &&
    ([...whiteAugments, ...blackAugments].some(a => a.id === "king-of-the-hill"));

  // Responsive board size
  useEffect(() => {
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBoardPx(Math.floor(Math.min(width - 4, height - 4) / 8) * 8);
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const sqSize = boardPx / 8;

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const maybeTriggerMilestone = useCallback((
    movingColor: Color,
    capturedType: PieceType | null,
    wMs: Milestones, bMs: Milestones,
    heldIds: string[],
  ) => {
    const ms = movingColor === "white" ? wMs : bMs;
    const triggered = checkNewMilestone(capturedType, ms);
    if (!triggered) return { wMs, bMs };

    const newMs  = applyMilestone(triggered, ms);
    const newWMs = movingColor === "white" ? newMs : wMs;
    const newBMs = movingColor === "black" ? newMs : bMs;

    setPendingAugmentFor(movingColor);
    setPendingMilestoneType(triggered);
    setMidGameOffered(rollAugments(3, heldIds));

    return { wMs: newWMs, bMs: newBMs };
  }, []);

  // ── Pre-game pick handlers ───────────────────────────────────────────────────

  const grantOopsIfNeeded = (aug: Augment, color: Color) => {
    if (aug.id !== "oops") return;
    if (color === "white") setWhiteUndosLeft(u => u + 1);
    else setBlackUndosLeft(u => u + 1);
  };

  const handleStart = () => {
    setOfferedToWhite(rollAugments(3));
    setPhase("white-augment");
  };

  const handleWhitePick = (aug: Augment) => {
    setWhiteAugments([aug]);
    grantOopsIfNeeded(aug, "white");
    setOfferedToBlack(rollAugments(3, [aug.id]));
    setPhase("black-augment");
  };

  const handleBlackPick = (aug: Augment) => {
    setBlackAugments([aug]);
    grantOopsIfNeeded(aug, "black");
    setPhase("playing");
  };

  // ── Mid-game milestone pick ──────────────────────────────────────────────────

  const handleMidGamePick = (aug: Augment) => {
    if (pendingAugmentFor === "white") {
      setWhiteAugments(prev => [...prev, aug]);
      grantOopsIfNeeded(aug, "white");
    } else if (pendingAugmentFor === "black") {
      setBlackAugments(prev => [...prev, aug]);
      grantOopsIfNeeded(aug, "black");
    }
    setPendingAugmentFor(null);
    setPendingMilestoneType(null);
    setMidGameOffered([]);
  };

  // ── Core move executor ───────────────────────────────────────────────────────

  /**
   * Execute a legal move, apply augment effects, push to history, check milestones.
   * capturedType: the type of the piece on the target square (or null).
   */
  const executeMove = useCallback((
    from: [number, number],
    to:   [number, number],
    promotion?: PieceType,
    capturedType?: PieceType | null,
  ) => {
    const movingColor = game.turn;

    // Push state to history BEFORE the move (for Oops undo)
    setGameHistory(h => [...h, game]);

    // Make the move
    let newGame = makeMove(game, from, to, promotion);

    // Update turn count for Miner
    const newTurnCount = (movingColor === "white" ? whiteTurnCount : blackTurnCount) + 1;
    if (movingColor === "white") setWhiteTurnCount(newTurnCount);
    else setBlackTurnCount(newTurnCount);

    // Apply passive augment effects (Miner, KotH)
    const playerAugs = movingColor === "white" ? whiteAugments : blackAugments;
    newGame = applyEndOfTurnEffects(newGame, movingColor, playerAugs, newTurnCount);

    setGame(newGame);

    // Check milestone (N/B/R capture)
    if (capturedType) {
      const held = [...whiteAugments, ...blackAugments].map(a => a.id);
      const curWMs = whiteMilestones;
      const curBMs = blackMilestones;
      const { wMs, bMs } = maybeTriggerMilestone(movingColor, capturedType, curWMs, curBMs, held);
      setWhiteMilestones(wMs);
      setBlackMilestones(bMs);
    }
  }, [game, whiteTurnCount, blackTurnCount, whiteAugments, blackAugments,
      whiteMilestones, blackMilestones, maybeTriggerMilestone]);

  // ── Undo (Oops augment) ──────────────────────────────────────────────────────

  const handleUndo = useCallback(() => {
    if (gameHistory.length < 2) return;
    // Restore the state from 2 half-moves ago
    const restored = gameHistory[gameHistory.length - 2];
    setGame(restored);
    setGameHistory(h => h.slice(0, -2));
    setSelected(null);
    setValidMoves([]);

    // Decrement undo usage
    if (game.turn === "white") {
      setWhiteUndosLeft(u => u - 1);
      setWhiteTurnCount(c => Math.max(0, c - 1));
    } else {
      setBlackUndosLeft(u => u - 1);
      setBlackTurnCount(c => Math.max(0, c - 1));
    }
    // Also roll back the other player's turn count
    if (game.turn === "white") setBlackTurnCount(c => Math.max(0, c - 1));
    else setWhiteTurnCount(c => Math.max(0, c - 1));
  }, [game, gameHistory]);

  // ── Chess handlers ──────────────────────────────────────────────────────────

  const handleSquareClick = useCallback((r: number, c: number) => {
    if (phase !== "playing") return;
    if (pendingAugmentFor !== null) return;
    if (game.status === "checkmate" || game.status === "stalemate") return;
    if (promotionPending) return;

    const piece = game.board[r][c];

    if (selected) {
      const isValid = validMoves.some(([vr, vc]) => vr === r && vc === c);
      if (isValid) {
        const movingPiece = game.board[selected[0]][selected[1]]!;
        const isPromotion =
          movingPiece.type === "P" &&
          ((movingPiece.color === "white" && r === 0) ||
           (movingPiece.color === "black" && r === 7));

        if (isPromotion) {
          setPromotionPending({ from: selected, to: [r, c] });
        } else {
          const captured = game.board[r][c];
          executeMove(selected, [r, c], undefined, captured?.type ?? null);
          setSelected(null);
          setValidMoves([]);
        }
        return;
      }
      if (piece && piece.color === game.turn) {
        setSelected([r, c]);
        setValidMoves(getLegalMoves(game, r, c));
        return;
      }
      setSelected(null);
      setValidMoves([]);
      return;
    }

    if (piece && piece.color === game.turn) {
      setSelected([r, c]);
      setValidMoves(getLegalMoves(game, r, c));
    }
  }, [phase, pendingAugmentFor, game, selected, validMoves, promotionPending, executeMove]);

  const handlePromotion = useCallback((type: PieceType) => {
    if (!promotionPending) return;
    const captured = game.board[promotionPending.to[0]][promotionPending.to[1]];
    executeMove(promotionPending.from, promotionPending.to, type, captured?.type ?? null);
    setPromotionPending(null);
    setSelected(null);
    setValidMoves([]);
  }, [promotionPending, game, executeMove]);

  const resetGame = () => {
    setGame(createInitialState());
    setSelected(null);
    setValidMoves([]);
    setPromotionPending(null);
    setPhase("start");
    setWhiteAugments([]);
    setBlackAugments([]);
    setOfferedToWhite([]);
    setOfferedToBlack([]);
    setWhiteMilestones(EMPTY_MILESTONES);
    setBlackMilestones(EMPTY_MILESTONES);
    setPendingAugmentFor(null);
    setPendingMilestoneType(null);
    setMidGameOffered([]);
    setWhiteTurnCount(0);
    setBlackTurnCount(0);
    setGameHistory([]);
    setWhiteUndosLeft(0);
    setBlackUndosLeft(0);
  };

  // ── Derived state ───────────────────────────────────────────────────────────

  const adv    = materialAdvantage(game);
  const isOver = game.status === "checkmate" || game.status === "stalemate";

  const statusText = (() => {
    if (game.status === "checkmate")
      return { label: `${opp(game.turn).toUpperCase()} WINS  ·  Checkmate`, color: "#4ade80" };
    if (game.status === "stalemate")
      return { label: "DRAW  ·  Stalemate", color: "#94a3b8" };
    if (game.status === "check")
      return { label: `${game.turn.toUpperCase()}  ·  CHECK!`, color: "#f87171" };
    return { label: `${game.turn.toUpperCase()}'S TURN`, color: "#e2e8f0" };
  })();

  const canWhiteUndo = phase === "playing" && !isOver && game.turn === "white"
    && whiteUndosLeft > 0 && gameHistory.length >= 2;
  const canBlackUndo = phase === "playing" && !isOver && game.turn === "black"
    && blackUndosLeft > 0 && gameHistory.length >= 2;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{
      display: "flex", flexDirection: "column", width: "100%", height: "100%",
      background: "#030712", color: "#fff", userSelect: "none", overflow: "hidden",
      position: "relative",
    }}>

      {/* ── Black's info bar ── */}
      <div style={{
        flexShrink: 0, height: 48,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 12px", background: "#0a0f1a", borderBottom: "1px solid #1f2937",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
            background: "#1a0f00", border: "2px solid #6b7280",
            boxShadow: game.turn === "black" && !isOver && phase === "playing" ? "0 0 0 2px #6366f1" : "none",
          }} />
          <span style={{
            fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", flexShrink: 0,
            color: game.turn === "black" && !isOver && phase === "playing" ? "#e2e8f0" : "#6b7280",
          }}>BLACK</span>
          {blackAugments.length > 0 && (
            <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
              {blackAugments.map(a => <AugmentIconChip key={a.id} augment={a} />)}
            </div>
          )}
          {canBlackUndo && <UndoButton onUndo={handleUndo} />}
          <GoldBadge gold={game.goldBlack} active={game.turn === "black" && !isOver && phase === "playing"} />
          <CapturedRow pieces={game.capturedByBlack} byColor="white" advantage={adv.black > 0 ? adv.black : 0} />
        </div>
        <button onClick={resetGame} style={{
          padding: "4px 12px", fontSize: 11, fontWeight: 700, flexShrink: 0,
          borderRadius: 6, border: "1px solid #374151",
          background: "#111827", color: "#9ca3af", cursor: "pointer",
        }}>
          New Game
        </button>
      </div>

      {/* ── Board area ── */}
      <div ref={containerRef} style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 6, minHeight: 0, position: "relative", background: "#030712",
      }}>
        <div style={{
          width: boardPx, height: boardPx,
          display: "grid",
          gridTemplateColumns: `repeat(8, ${sqSize}px)`,
          gridTemplateRows: `repeat(8, ${sqSize}px)`,
          border: "3px solid #5c3d1e", borderRadius: 2,
          boxShadow: "0 8px 40px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.5)",
          flexShrink: 0,
        }}>
          {Array.from({ length: 8 }, (_, r) =>
            Array.from({ length: 8 }, (_, c) => {
              const piece  = game.board[r][c];
              const isSel  = selected?.[0] === r && selected?.[1] === c;
              const isVM   = validMoves.some(([vr, vc]) => vr === r && vc === c);
              const isLM   = !!(game.lastMove &&
                ((game.lastMove.from[0] === r && game.lastMove.from[1] === c) ||
                 (game.lastMove.to[0]   === r && game.lastMove.to[1]   === c)));
              const isCK   = !!(piece?.type === "K" && piece.color === game.turn &&
                (game.status === "check" || game.status === "checkmate"));
              const isCenter = showCenterMarkers && CENTER_SQUARES.has(`${r},${c}`);
              return (
                <SquareEl key={`${r}-${c}`}
                  row={r} col={c} size={sqSize} piece={piece}
                  isSelected={isSel} isValidMove={isVM} isLastMove={isLM}
                  isCheckKing={isCK} isCenter={isCenter}
                  onClick={() => handleSquareClick(r, c)}
                />
              );
            })
          )}
        </div>

        {promotionPending && (
          <PromotionDialog color={game.turn} onChoose={handlePromotion} />
        )}

        {isOver && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none",
          }}>
            <div style={{
              background: "#111827", border: "1px solid #374151", borderRadius: 14,
              padding: "20px 36px", display: "flex", flexDirection: "column",
              alignItems: "center", gap: 10,
              boxShadow: "0 8px 40px rgba(0,0,0,0.7)", pointerEvents: "auto",
            }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: statusText.color, letterSpacing: "0.04em" }}>
                {statusText.label}
              </span>
              <button onClick={resetGame} style={{
                padding: "8px 28px", fontSize: 14, fontWeight: 700,
                borderRadius: 10, border: "none", cursor: "pointer",
                background: "linear-gradient(135deg,#4f46e5,#6366f1)", color: "#fff",
                boxShadow: "0 3px 12px rgba(99,102,241,0.5)",
              }}>
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── White's info bar ── */}
      <div style={{
        flexShrink: 0, height: 48,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 12px", background: "#0a0f1a", borderTop: "1px solid #1f2937",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
            background: "#ffffff", border: "2px solid #6b7280",
            boxShadow: game.turn === "white" && !isOver && phase === "playing" ? "0 0 0 2px #6366f1" : "none",
          }} />
          <span style={{
            fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", flexShrink: 0,
            color: game.turn === "white" && !isOver && phase === "playing" ? "#e2e8f0" : "#6b7280",
          }}>WHITE</span>
          {whiteAugments.length > 0 && (
            <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
              {whiteAugments.map(a => <AugmentIconChip key={a.id} augment={a} />)}
            </div>
          )}
          {canWhiteUndo && <UndoButton onUndo={handleUndo} />}
          <GoldBadge gold={game.goldWhite} active={game.turn === "white" && !isOver && phase === "playing"} />
          <CapturedRow pieces={game.capturedByWhite} byColor="black" advantage={adv.white > 0 ? adv.white : 0} />
        </div>
        {phase === "playing" && !isOver && (
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", flexShrink: 0,
            color: statusText.color,
            background: game.status === "check" ? "rgba(239,68,68,0.15)" : "transparent",
            padding: game.status === "check" ? "3px 10px" : "0",
            borderRadius: 20,
            border: game.status === "check" ? "1px solid rgba(239,68,68,0.4)" : "none",
          }}>
            {statusText.label}
          </div>
        )}
      </div>

      {/* ══ Phase overlays ══ */}

      {phase === "start" && <StartScreen onStart={handleStart} />}

      {phase === "white-augment" && (
        <AugmentSelector playerColor="white" offered={offeredToWhite} onSelect={handleWhitePick} />
      )}

      {phase === "black-augment" && (
        <AugmentSelector playerColor="black" offered={offeredToBlack} onSelect={handleBlackPick} />
      )}

      {phase === "playing" && pendingAugmentFor !== null && (
        <AugmentSelector
          playerColor={pendingAugmentFor}
          offered={midGameOffered}
          onSelect={handleMidGamePick}
          milestone={pendingMilestoneType}
        />
      )}
    </div>
  );
}
