import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChessState, PieceType, Color, Board,
  PIECE_UNICODE, PIECE_VALUE,
  createInitialState, getLegalMoves, makeMove,
  materialAdvantage, opp, cloneBoard, findKing,
  isInCheck, hasAnyLegalMove,
} from "./engine";
import {
  Augment, rollAugments, RARITY_META,
  RarityWeights, getWeightsForPlayer,
} from "./augments";

// ─── Types ────────────────────────────────────────────────────────────────────

type GamePhase = "start" | "white-augment" | "black-augment" | "playing";
type Milestones = { knight: boolean; bishop: boolean; rook: boolean };
type AugmentTrigger = { color: Color; reason: "milestone" | "bloodlust"; milestoneType?: PieceType };
const EMPTY_MILESTONES: Milestones = { knight: false, bishop: false, rook: false };
const CENTER_SQUARES = new Set(["4,3", "3,3", "4,4", "3,4"]);
const KNIGHT_OFFSETS: [number, number][] = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];

function checkNewMilestone(t: PieceType | null, ms: Milestones): PieceType | null {
  if (!t) return null;
  if (t === "N" && !ms.knight) return "N";
  if (t === "B" && !ms.bishop) return "B";
  if (t === "R" && !ms.rook)   return "R";
  return null;
}
function applyMilestone(t: PieceType, ms: Milestones): Milestones {
  return { knight: t==="N"||ms.knight, bishop: t==="B"||ms.bishop, rook: t==="R"||ms.rook };
}

// ─── Engine helpers ───────────────────────────────────────────────────────────

function findCheckingPiece(board: Board, kingColor: Color): [number, number] | null {
  const [kr, kc] = findKing(board, kingColor);
  if (kr === -1) return null;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p?.color === opp(kingColor)) {
        const test = cloneBoard(board);
        test[r][c] = null;
        if (!isInCheck(test, kingColor)) return [r, c];
      }
    }
  return null;
}

function recomputeStatus(g: ChessState): ChessState {
  const nextTurn = g.turn;
  const nextHasMove = hasAnyLegalMove(g, nextTurn);
  let status = g.status;
  if (!nextHasMove) status = isInCheck(g.board, nextTurn) ? "checkmate" : "stalemate";
  else if (isInCheck(g.board, nextTurn)) status = "check";
  else status = "playing";
  return { ...g, status };
}

// ─── Passive augment effects ──────────────────────────────────────────────────

function applyEndOfTurnEffects(
  g: ChessState, movingColor: Color, augments: Augment[], turnCount: number,
): ChessState {
  let delta = 0;
  for (const aug of augments) {
    if (aug.id === "miner" && turnCount % 2 === 0) delta += 1;
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

// ─── Alternative: 3-square rook-file pawn ────────────────────────────────────

function getAlternativeMoves(game: ChessState, r: number, c: number): [number, number][] {
  const piece = game.board[r][c];
  if (!piece || piece.type !== "P" || (c !== 0 && c !== 7)) return [];
  if (piece.color === "white") {
    if (r !== 6) return [];
    if (game.board[5][c] || game.board[4][c] || game.board[3][c]) return [];
    return [[3, c]];
  } else {
    if (r !== 1) return [];
    if (game.board[2][c] || game.board[3][c] || game.board[4][c]) return [];
    return [[4, c]];
  }
}

// ─── Royal Education: knight-move destinations for king ──────────────────────

function getRoyalEdMoves(game: ChessState, color: Color): { kingPos: [number,number]; dests: [number,number][] } {
  const [kr, kc] = findKing(game.board, color);
  if (kr === -1) return { kingPos: [-1,-1], dests: [] };
  const dests: [number, number][] = [];
  for (const [dr, dc] of KNIGHT_OFFSETS) {
    const nr = kr + dr, nc = kc + dc;
    if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
    if (game.board[nr][nc]?.color === color) continue;
    const test = cloneBoard(game.board);
    test[kr][kc] = null;
    test[nr][nc] = { type: "K", color };
    if (!isInCheck(test, color)) dests.push([nr, nc]);
  }
  return { kingPos: [kr, kc], dests };
}

// ─── Board constants ──────────────────────────────────────────────────────────

const LIGHT_SQ  = "#f0d9b5", DARK_SQ   = "#b58863";
const SEL_LIGHT = "#f6f669", SEL_DARK  = "#baca2b";
const LAST_LIGHT= "#cdd16f", LAST_DARK = "#aaa23a";

// ─── SquareEl ─────────────────────────────────────────────────────────────────

function SquareEl({ row, col, size, piece, isSelected, isValidMove, isLastMove,
  isCheckKing, isCenter, isFrozen, onClick }: {
  row: number; col: number; size: number;
  piece: { type: PieceType; color: Color } | null;
  isSelected: boolean; isValidMove: boolean; isLastMove: boolean;
  isCheckKing: boolean; isCenter: boolean; isFrozen: boolean;
  onClick: () => void;
}) {
  const light = (row + col) % 2 === 0;
  let bg = light ? LIGHT_SQ : DARK_SQ;
  if (isCheckKing) bg = "#c82020";
  else if (isSelected) bg = light ? SEL_LIGHT : SEL_DARK;
  else if (isLastMove) bg = light ? LAST_LIGHT : LAST_DARK;
  const dot = size * 0.3, ring = size * 0.07;
  return (
    <div onClick={onClick} style={{
      width: size, height: size, backgroundColor: bg,
      position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer", transition: "background-color 0.1s", overflow: "hidden",
    }}>
      {col === 0 && <span style={{ position:"absolute",top:2,left:3,fontSize:Math.max(9,size*0.18),fontWeight:700,color:light?DARK_SQ:LIGHT_SQ,userSelect:"none",lineHeight:1 }}>{8-row}</span>}
      {row === 7 && <span style={{ position:"absolute",bottom:2,right:3,fontSize:Math.max(9,size*0.18),fontWeight:700,color:light?DARK_SQ:LIGHT_SQ,userSelect:"none",lineHeight:1 }}>{String.fromCharCode(97+col)}</span>}
      {isCenter && <div style={{ position:"absolute",top:3,right:3,width:5,height:5,background:"rgba(234,179,8,0.6)",borderRadius:"50%",pointerEvents:"none",boxShadow:"0 0 3px rgba(234,179,8,0.8)" }} />}
      {isFrozen && <div style={{ position:"absolute",inset:0,background:"rgba(147,210,255,0.28)",border:"2px solid rgba(147,210,255,0.7)",boxShadow:"inset 0 0 8px rgba(147,210,255,0.5)",pointerEvents:"none",zIndex:2 }} />}
      {isValidMove && !piece && <div style={{ width:dot,height:dot,borderRadius:"50%",backgroundColor:"rgba(0,0,0,0.22)",pointerEvents:"none" }} />}
      {isValidMove && piece && <div style={{ position:"absolute",inset:ring,borderRadius:"50%",border:`${Math.max(3,size*0.07)}px solid rgba(0,0,0,0.28)`,pointerEvents:"none" }} />}
      {piece && <span style={{
        fontSize:size*0.72,lineHeight:1,
        color:piece.color==="white"?"#ffffff":"#1a0f00",
        textShadow:piece.color==="white"?"0 0 3px #000, 0 0 6px #000, 1px 1px 0 #222":"0 0 3px rgba(255,255,255,0.7), 1px 1px 0 rgba(255,255,255,0.5)",
        userSelect:"none",pointerEvents:"none",position:"relative",zIndex:1,
      }}>{PIECE_UNICODE[piece.color][piece.type]}</span>}
    </div>
  );
}

// ─── CapturedRow ──────────────────────────────────────────────────────────────

function CapturedRow({ pieces, byColor, advantage }: { pieces: PieceType[]; byColor: Color; advantage: number }) {
  const sorted = [...pieces].sort((a,b) => PIECE_VALUE[b]-PIECE_VALUE[a]);
  return (
    <div style={{ display:"flex",alignItems:"center",gap:4,flexWrap:"wrap" }}>
      {sorted.map((t,i) => <span key={i} style={{ fontSize:16,lineHeight:1,color:byColor==="white"?"#fff":"#1a0f00",textShadow:byColor==="white"?"0 0 2px #000, 0 0 4px #000":"0 0 2px rgba(255,255,255,0.6)" }}>{PIECE_UNICODE[byColor][t]}</span>)}
      {advantage > 0 && <span style={{ fontSize:12,color:"#9ca3af",fontWeight:600,marginLeft:2 }}>+{advantage}</span>}
    </div>
  );
}

// ─── PromotionDialog ──────────────────────────────────────────────────────────

function PromotionDialog({ color, onChoose }: { color: Color; onChoose: (t: PieceType) => void }) {
  return (
    <div style={{ position:"absolute",inset:0,zIndex:50,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ background:"#1f2937",border:"1px solid #374151",borderRadius:14,padding:"18px 24px",display:"flex",flexDirection:"column",alignItems:"center",gap:14,boxShadow:"0 8px 40px rgba(0,0,0,0.7)" }}>
        <p style={{ color:"#e5e7eb",fontWeight:700,fontSize:14,margin:0 }}>Promote Pawn</p>
        <div style={{ display:"flex",gap:10 }}>
          {(["Q","R","B","N"] as PieceType[]).map(t => (
            <button key={t} onClick={() => onChoose(t)} style={{ width:56,height:56,borderRadius:10,background:"#111827",border:"2px solid #4b5563",cursor:"pointer",fontSize:32,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center",color:color==="white"?"#ffffff":"#1a0f00",textShadow:color==="white"?"0 0 3px #000, 0 0 6px #000":"0 0 3px rgba(255,255,255,0.7)",transition:"border-color 0.15s, background 0.15s" }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="#6366f1";(e.currentTarget as HTMLElement).style.background="#1e1b4b";}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="#4b5563";(e.currentTarget as HTMLElement).style.background="#111827";}}
            >{PIECE_UNICODE[color][t]}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── GoldBadge ────────────────────────────────────────────────────────────────

function GoldBadge({ gold, active }: { gold: number; active: boolean }) {
  return (
    <div style={{ display:"flex",alignItems:"center",gap:5,background:gold>0?"linear-gradient(135deg,#1c1500,#2d2000)":"rgba(255,255,255,0.04)",border:`1px solid ${gold>0?"rgba(234,179,8,0.35)":"rgba(255,255,255,0.08)"}`,borderRadius:20,padding:"2px 8px 2px 5px",transition:"all 0.3s",boxShadow:gold>0&&active?"0 0 8px rgba(234,179,8,0.25)":"none" }}>
      <div style={{ width:16,height:16,borderRadius:"50%",flexShrink:0,background:"radial-gradient(ellipse at 35% 30%,#fde047,#eab308 55%,#a16207)",boxShadow:"inset 0 0 0 1.5px rgba(255,255,255,0.25), 0 1px 3px rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center" }}>
        <span style={{ fontSize:8,fontWeight:900,color:"#422006",lineHeight:1 }}>G</span>
      </div>
      <span style={{ fontSize:13,fontWeight:800,color:gold>0?"#facc15":"#4b5563",lineHeight:1,minWidth:14,textAlign:"right" }}>{gold}</span>
    </div>
  );
}

// ─── AugmentIconChip ─────────────────────────────────────────────────────────

function AugmentIconChip({ augment }: { augment: Augment }) {
  const m = RARITY_META[augment.rarity];
  return (
    <div title={`${augment.name} — ${augment.description}`} style={{ width:24,height:24,borderRadius:"50%",flexShrink:0,border:`1.5px solid ${m.border}`,background:"#0f172a",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 0 5px ${m.glow}`,cursor:"default" }}>
      <span style={{ fontSize:10,lineHeight:1 }}>{augment.icon}</span>
    </div>
  );
}

// ─── SpellButton ─────────────────────────────────────────────────────────────

function SpellButton({ icon, label, active, onClick, title, count }: {
  icon: string; label: string; active?: boolean; onClick: () => void; title?: string; count?: number;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} title={title} style={{
      display:"flex",alignItems:"center",gap:3,padding:"2px 7px",fontSize:10,fontWeight:800,borderRadius:6,
      border:`1px solid ${active?"#06b6d4":(hov?"#374151":"#1f2937")}`,
      background:active?"rgba(6,182,212,0.15)":(hov?"#111827":"transparent"),
      color:active?"#22d3ee":(hov?"#d1d5db":"#6b7280"),
      cursor:"pointer",transition:"all 0.15s",flexShrink:0,letterSpacing:"0.04em",
      boxShadow:active?"0 0 8px rgba(6,182,212,0.3)":"none",
    }}>
      <span style={{ fontSize:11 }}>{icon}</span>
      {label}
      {count !== undefined && count > 0 && <span style={{ fontSize:9,fontWeight:900,background:"#06b6d4",color:"#030712",borderRadius:"50%",width:14,height:14,display:"inline-flex",alignItems:"center",justifyContent:"center" }}>{count}</span>}
    </button>
  );
}

// ─── UndoButton ──────────────────────────────────────────────────────────────

function UndoButton({ onUndo }: { onUndo: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onUndo} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} title="Use your Oops! undo" style={{ display:"flex",alignItems:"center",gap:4,padding:"2px 8px",fontSize:10,fontWeight:800,borderRadius:6,border:`1px solid ${hov?"#6366f1":"#374151"}`,background:hov?"#1e1b4b":"#111827",color:hov?"#a5b4fc":"#9ca3af",cursor:"pointer",transition:"all 0.15s",flexShrink:0,letterSpacing:"0.04em" }}>
      <span style={{ fontSize:11 }}>↩</span> UNDO
    </button>
  );
}

// ─── AugmentCard ─────────────────────────────────────────────────────────────

function AugmentCard({ augment, onSelect }: { augment: Augment; onSelect: () => void }) {
  const [hov, setHov] = useState(false);
  const m = RARITY_META[augment.rarity];
  return (
    <div onClick={onSelect} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{
      width:155,padding:"18px 14px 14px",borderRadius:14,position:"relative",
      border:`2px solid ${hov?m.border:"rgba(255,255,255,0.07)"}`,
      background:hov?"#0b1120":"#080e1a",cursor:"pointer",
      display:"flex",flexDirection:"column",alignItems:"center",gap:10,
      boxShadow:hov?`0 0 22px ${m.glow}, 0 4px 16px rgba(0,0,0,0.5)`:"0 2px 8px rgba(0,0,0,0.4)",
      transform:hov?"translateY(-5px) scale(1.02)":"translateY(0) scale(1)",
      transition:"all 0.2s cubic-bezier(0.34,1.56,0.64,1)",userSelect:"none",
    }}>
      <div style={{ position:"absolute",top:0,left:14,right:14,height:3,borderRadius:"0 0 3px 3px",background:m.shimmer?m.shimmer:`linear-gradient(90deg, transparent, ${m.border}, transparent)`,opacity:hov?1:(augment.rarity==="legendary"?0.8:0.4),transition:"opacity 0.2s" }} />
      <span style={{ fontSize:32,lineHeight:1,filter:hov?"drop-shadow(0 0 8px rgba(255,255,255,0.3))":"none",transition:"filter 0.2s" }}>{augment.icon}</span>
      <div style={{ textAlign:"center" }}>
        <p style={{ fontSize:13,fontWeight:800,color:"#f1f5f9",margin:"0 0 5px",letterSpacing:"0.01em" }}>{augment.name}</p>
        <p style={{ fontSize:10.5,color:"#64748b",margin:0,lineHeight:1.45 }}>{augment.description}</p>
      </div>
      <div style={{ fontSize:9,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",padding:"2px 10px",borderRadius:20,background:m.badge,color:m.text,border:`1px solid ${m.border}` }}>{m.label}</div>
    </div>
  );
}

// ─── AugmentSelector ─────────────────────────────────────────────────────────

const MILESTONE_LABEL: Partial<Record<PieceType, string>> = {
  N: "First Knight Captured!", B: "First Bishop Captured!", R: "First Rook Captured!",
};

function AugmentSelector({ playerColor, offered, onSelect, trigger }: {
  playerColor: Color; offered: Augment[]; onSelect: (aug: Augment) => void;
  trigger?: AugmentTrigger | null;
}) {
  const isWhite = playerColor === "white";
  const badgeLabel = trigger?.reason === "bloodlust"
    ? "🩸 Bloodlust Bonus!"
    : trigger?.milestoneType ? `✦ ${MILESTONE_LABEL[trigger.milestoneType!]}` : null;
  return (
    <div style={{ position:"absolute",inset:0,zIndex:80,background:"linear-gradient(160deg, #030712 0%, #080e1f 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:"16px 12px" }}>
      <div style={{ textAlign:"center" }}>
        {badgeLabel && <div style={{ display:"inline-block",marginBottom:10,padding:"4px 14px",borderRadius:20,background:"linear-gradient(135deg,#1c1f2e,#2d2f45)",border:`1px solid ${trigger?.reason==="bloodlust"?"#dc2626":"#4f46e5"}`,fontSize:11,fontWeight:700,letterSpacing:"0.1em",color:trigger?.reason==="bloodlust"?"#fca5a5":"#818cf8",textTransform:"uppercase" }}>{badgeLabel}</div>}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginTop:badgeLabel?0:4 }}>
          <div style={{ width:12,height:12,borderRadius:"50%",flexShrink:0,background:isWhite?"#ffffff":"#1a0f00",border:`2px solid ${isWhite?"#94a3b8":"#6b7280"}`,boxShadow:`0 0 10px ${isWhite?"rgba(255,255,255,0.4)":"rgba(0,0,0,0.4)"}` }} />
          <h2 style={{ fontSize:20,fontWeight:900,margin:0,letterSpacing:"0.08em",color:"#f1f5f9" }}>{playerColor.toUpperCase()}</h2>
        </div>
        {!badgeLabel && <p style={{ fontSize:10,letterSpacing:"0.2em",fontWeight:700,color:"#475569",margin:"6px 0 0",textTransform:"uppercase" }}>Choose your augment</p>}
      </div>
      <div style={{ display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center" }}>
        {offered.map(aug => <AugmentCard key={aug.id} augment={aug} onSelect={() => onSelect(aug)} />)}
      </div>
      <p style={{ fontSize:10,color:"#334155",margin:0 }}>Click a card to select it</p>
    </div>
  );
}

// ─── StartScreen ─────────────────────────────────────────────────────────────

function StartScreen({ onStart }: { onStart: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{ position:"absolute",inset:0,zIndex:80,background:"linear-gradient(160deg, #030712 0%, #080e1f 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:18 }}>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,10px)",gap:1,opacity:0.15,marginBottom:4 }}>
        {Array.from({length:16},(_,i)=><div key={i} style={{ width:10,height:10,background:(Math.floor(i/4)+i)%2===0?"#f0d9b5":"#b58863" }}/>)}
      </div>
      <span style={{ fontSize:48,lineHeight:1,filter:"drop-shadow(0 4px 16px rgba(99,102,241,0.4))" }}>♟️</span>
      <div style={{ textAlign:"center" }}>
        <h2 style={{ fontSize:22,fontWeight:900,color:"#f1f5f9",margin:"0 0 6px",letterSpacing:"0.04em" }}>Chess Roguelike</h2>
        <p style={{ fontSize:12,color:"#475569",margin:0,lineHeight:1.6 }}>Classic chess · Each player picks an augment<br/>before the game begins</p>
      </div>
      <button onClick={onStart} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{ padding:"11px 44px",fontSize:14,fontWeight:800,letterSpacing:"0.1em",textTransform:"uppercase",borderRadius:12,border:"none",cursor:"pointer",background:hov?"linear-gradient(135deg,#4338ca,#6366f1)":"linear-gradient(135deg,#4f46e5,#818cf8)",color:"#fff",boxShadow:hov?"0 6px 28px rgba(99,102,241,0.65)":"0 4px 18px rgba(99,102,241,0.45)",transform:hov?"translateY(-2px)":"none",transition:"all 0.18s" }}>Start Game</button>
    </div>
  );
}

// ─── PlayerBar ───────────────────────────────────────────────────────────────

type SpellState = {
  freezeCharges: number; freezeActive: boolean; onFreeze: () => void;
  necroCharges: number; necroActive: boolean; hasNecroTargets: boolean; onNecro: () => void;
  royalEdAvailable: boolean; royalEdActive: boolean; onRoyalEd: () => void;
  whatAvailable: boolean; whatActive: boolean; onWhat: () => void;
  canUndo: boolean; onUndo: () => void;
  captureCount: number; hasBloodlust: boolean;
};

function PlayerBar({
  color, isActive, isOver, phase, augments, gold, capturedPieces, advantage,
  spells, showReset, onReset, statusLabel, statusColor, statusBadge,
}: {
  color: Color; isActive: boolean; isOver: boolean; phase: GamePhase;
  augments: Augment[]; gold: number; capturedPieces: PieceType[]; advantage: number;
  spells: SpellState; showReset: boolean; onReset: () => void;
  statusLabel?: string; statusColor?: string; statusBadge?: boolean;
}) {
  const captureColor = opp(color);
  const sorted = [...capturedPieces].sort((a,b) => PIECE_VALUE[b]-PIECE_VALUE[a]);
  const canAct = isActive && !isOver && phase === "playing";
  return (
    <div style={{ flexShrink:0,height:48,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 12px",background:"#0a0f1a",borderTop:color==="white"?"1px solid #1f2937":undefined,borderBottom:color==="black"?"1px solid #1f2937":undefined }}>
      <div style={{ display:"flex",alignItems:"center",gap:5,minWidth:0,overflow:"hidden",flexWrap:"nowrap" }}>
        <div style={{ width:10,height:10,borderRadius:"50%",flexShrink:0,background:color==="white"?"#ffffff":"#1a0f00",border:`2px solid ${color==="white"?"#94a3b8":"#6b7280"}`,boxShadow:canAct?"0 0 0 2px #6366f1":"none" }} />
        <span style={{ fontSize:13,fontWeight:700,letterSpacing:"0.05em",flexShrink:0,color:canAct?"#e2e8f0":"#6b7280" }}>{color.toUpperCase()}</span>
        {augments.length > 0 && <div style={{ display:"flex",gap:3,alignItems:"center" }}>{augments.map(a=><AugmentIconChip key={a.id} augment={a}/>)}</div>}
        {spells.canUndo && <UndoButton onUndo={spells.onUndo}/>}
        {canAct && spells.freezeCharges > 0 && <SpellButton icon="❄️" label="FREEZE" active={spells.freezeActive} count={spells.freezeCharges} onClick={spells.onFreeze} title="Freeze an enemy piece for 1 opponent turn"/>}
        {canAct && spells.necroCharges > 0 && spells.hasNecroTargets && <SpellButton icon="💀" label="REVIVE" active={spells.necroActive} onClick={spells.onNecro} title="Resurrect a captured pawn at its home square"/>}
        {canAct && spells.royalEdAvailable && <SpellButton icon="♞" label="ROYAL" active={spells.royalEdActive} onClick={spells.onRoyalEd} title="Move your king like a knight (one time)"/>}
        {canAct && spells.whatAvailable && <SpellButton icon="↔️" label="WHAT?" active={spells.whatActive} onClick={spells.onWhat} title="Move one pawn sideways one square (one time)"/>}
        <GoldBadge gold={gold} active={canAct}/>
        <div style={{ display:"flex",alignItems:"center",gap:4,flexWrap:"wrap" }}>
          {sorted.map((t,i)=><span key={i} style={{ fontSize:16,lineHeight:1,color:captureColor==="white"?"#fff":"#1a0f00",textShadow:captureColor==="white"?"0 0 2px #000, 0 0 4px #000":"0 0 2px rgba(255,255,255,0.6)" }}>{PIECE_UNICODE[captureColor][t]}</span>)}
          {advantage > 0 && <span style={{ fontSize:12,color:"#9ca3af",fontWeight:600,marginLeft:2 }}>+{advantage}</span>}
        </div>
        {spells.hasBloodlust && <span style={{ fontSize:9,color:"#9ca3af",letterSpacing:"0.05em",flexShrink:0 }}>🩸 {spells.captureCount%4}/4</span>}
      </div>
      <div style={{ display:"flex",alignItems:"center",gap:8,flexShrink:0 }}>
        {statusLabel && <div style={{ fontSize:11,fontWeight:700,letterSpacing:"0.08em",color:statusColor??"#e2e8f0",background:statusBadge?"rgba(239,68,68,0.15)":"transparent",padding:statusBadge?"3px 10px":"0",borderRadius:20,border:statusBadge?"1px solid rgba(239,68,68,0.4)":"none" }}>{statusLabel}</div>}
        {showReset && <button onClick={onReset} style={{ padding:"4px 12px",fontSize:11,fontWeight:700,borderRadius:6,border:"1px solid #374151",background:"#111827",color:"#9ca3af",cursor:"pointer" }}>New Game</button>}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChessGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardPx, setBoardPx] = useState(320);

  // Engine state
  const [game, setGame]                   = useState<ChessState>(createInitialState);
  const [selected, setSelected]           = useState<[number,number]|null>(null);
  const [validMoves, setValidMoves]       = useState<[number,number][]>([]);
  const [promotionPending, setPromotionPending] = useState<{from:[number,number];to:[number,number]}|null>(null);

  // Phase
  const [phase, setPhase] = useState<GamePhase>("start");
  const [offeredToWhite, setOfferedToWhite] = useState<Augment[]>([]);
  const [offeredToBlack, setOfferedToBlack] = useState<Augment[]>([]);
  const [whiteAugments, setWhiteAugments] = useState<Augment[]>([]);
  const [blackAugments, setBlackAugments] = useState<Augment[]>([]);

  // Augment pick queue
  const [augmentQueue, setAugmentQueue]     = useState<AugmentTrigger[]>([]);
  const [currentTrigger, setCurrentTrigger] = useState<AugmentTrigger|null>(null);
  const [midGameOffered, setMidGameOffered] = useState<Augment[]>([]);

  // Milestones
  const [whiteMilestones, setWhiteMilestones] = useState<Milestones>(EMPTY_MILESTONES);
  const [blackMilestones, setBlackMilestones] = useState<Milestones>(EMPTY_MILESTONES);

  // Oops
  const [gameHistory, setGameHistory]       = useState<ChessState[]>([]);
  const [whiteUndosLeft, setWhiteUndosLeft] = useState(0);
  const [blackUndosLeft, setBlackUndosLeft] = useState(0);

  // Miner / KotH
  const [whiteTurnCount, setWhiteTurnCount] = useState(0);
  const [blackTurnCount, setBlackTurnCount] = useState(0);

  // Frost — FIX: track which color's turn clears the freeze
  const [whiteFreezeCharges, setWhiteFreezeCharges] = useState(0);
  const [blackFreezeCharges, setBlackFreezeCharges] = useState(0);
  const [frozenSquare, setFrozenSquare]             = useState<[number,number]|null>(null);
  const [frozenExpireAfter, setFrozenExpireAfter]   = useState<Color|null>(null); // clear when this color moves
  const [freezeMode, setFreezeMode]                 = useState(false);

  // Necromancer — FIX: track columns, revive at home rank
  const [whiteNecroCharges, setWhiteNecroCharges]     = useState(0);
  const [blackNecroCharges, setBlackNecroCharges]     = useState(0);
  const [whiteLostPawnCols, setWhiteLostPawnCols]     = useState<number[]>([]);
  const [blackLostPawnCols, setBlackLostPawnCols]     = useState<number[]>([]);
  const [necroMode, setNecroMode]                     = useState(false);

  // Bloodlust
  const [whiteCaptureCount, setWhiteCaptureCount] = useState(0);
  const [blackCaptureCount, setBlackCaptureCount] = useState(0);
  const [whiteBloodlustNext, setWhiteBloodlustNext] = useState(4);
  const [blackBloodlustNext, setBlackBloodlustNext] = useState(4);

  // Internal Combustion
  const [whiteIcUsed, setWhiteIcUsed] = useState(false);
  const [blackIcUsed, setBlackIcUsed] = useState(false);

  // Royal Education
  const [whiteRoyalEdUsed, setWhiteRoyalEdUsed] = useState(false);
  const [blackRoyalEdUsed, setBlackRoyalEdUsed] = useState(false);
  const [royalEdMode, setRoyalEdMode]            = useState(false);

  // What?
  const [whiteWhatUsed, setWhiteWhatUsed] = useState(false);
  const [blackWhatUsed, setBlackWhatUsed] = useState(false);
  const [whatMode, setWhatMode]           = useState(false);
  const [whatSelected, setWhatSelected]   = useState<[number,number]|null>(null);

  const showCenterMarkers = phase === "playing" &&
    [...whiteAugments, ...blackAugments].some(a => a.id === "king-of-the-hill");

  // Responsive board
  useEffect(() => {
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBoardPx(Math.floor(Math.min(width-4, height-4) / 8) * 8);
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);
  const sqSize = boardPx / 8;

  // ── Roll helper ─────────────────────────────────────────────────────────────

  const rollForPlayer = useCallback((color: Color, wAugs: Augment[], bAugs: Augment[], exclude: string[]) => {
    const playerAugs = color === "white" ? wAugs : bAugs;
    return rollAugments(3, exclude, getWeightsForPlayer(playerAugs));
  }, []);

  // ── Grant effects on pick ───────────────────────────────────────────────────

  const grantPickedEffects = useCallback((aug: Augment, color: Color) => {
    if (aug.id === "oops")       { if (color==="white") setWhiteUndosLeft(u=>u+1); else setBlackUndosLeft(u=>u+1); }
    if (aug.id === "frost")      { if (color==="white") setWhiteFreezeCharges(n=>n+1); else setBlackFreezeCharges(n=>n+1); }
    if (aug.id === "necromancer"){ if (color==="white") setWhiteNecroCharges(n=>n+1); else setBlackNecroCharges(n=>n+1); }
  }, []);

  // ── Pre-game picks ──────────────────────────────────────────────────────────

  const handleStart = () => {
    setOfferedToWhite(rollAugments(3));
    setPhase("white-augment");
  };
  const handleWhitePick = (aug: Augment) => {
    setWhiteAugments([aug]);
    grantPickedEffects(aug, "white");
    setOfferedToBlack(rollAugments(3, [aug.id]));
    setPhase("black-augment");
  };
  const handleBlackPick = (aug: Augment) => {
    setBlackAugments([aug]);
    grantPickedEffects(aug, "black");
    setPhase("playing");
  };

  // ── Mid-game pick ───────────────────────────────────────────────────────────

  const showTrigger = useCallback((
    trigger: AugmentTrigger, wAugs: Augment[], bAugs: Augment[],
  ) => {
    setCurrentTrigger(trigger);
    const held = [...wAugs, ...bAugs].map(a => a.id);
    setMidGameOffered(rollForPlayer(trigger.color, wAugs, bAugs, held));
  }, [rollForPlayer]);

  const handleMidGamePick = useCallback((aug: Augment) => {
    if (!currentTrigger) return;
    const color = currentTrigger.color;
    let newWAugs = whiteAugments, newBAugs = blackAugments;
    if (color === "white") { newWAugs = [...whiteAugments, aug]; setWhiteAugments(newWAugs); }
    else                   { newBAugs = [...blackAugments, aug]; setBlackAugments(newBAugs); }
    grantPickedEffects(aug, color);

    // Advance queue
    if (augmentQueue.length > 0) {
      const [next, ...rest] = augmentQueue;
      setAugmentQueue(rest);
      showTrigger(next, newWAugs, newBAugs);
    } else {
      setCurrentTrigger(null);
      setMidGameOffered([]);
    }
  }, [currentTrigger, whiteAugments, blackAugments, augmentQueue, grantPickedEffects, showTrigger]);

  // ── Core move executor ──────────────────────────────────────────────────────

  const executeMove = useCallback((
    from: [number,number], to: [number,number],
    promotion?: PieceType, capturedType?: PieceType|null,
  ) => {
    const movingColor = game.turn;
    setGameHistory(h => [...h, game]);

    // Frost: clear frozen square when the frozen player (frozenExpireAfter) makes their move
    if (frozenSquare && frozenExpireAfter === movingColor) {
      setFrozenSquare(null);
      setFrozenExpireAfter(null);
    }

    let newGame = makeMove(game, from, to, promotion);

    // Turn count
    const newTurnCount = (movingColor === "white" ? whiteTurnCount : blackTurnCount) + 1;
    if (movingColor === "white") setWhiteTurnCount(newTurnCount);
    else setBlackTurnCount(newTurnCount);

    // Miner + KotH
    const playerAugs = movingColor === "white" ? whiteAugments : blackAugments;
    newGame = applyEndOfTurnEffects(newGame, movingColor, playerAugs, newTurnCount);

    // Jew
    if (capturedType === "P") {
      const victimColor = opp(movingColor);
      const victimAugs  = victimColor === "white" ? whiteAugments : blackAugments;
      if (victimAugs.some(a => a.id === "jew")) {
        newGame = { ...newGame,
          goldWhite: victimColor==="white" ? newGame.goldWhite+1 : newGame.goldWhite,
          goldBlack: victimColor==="black" ? newGame.goldBlack+1 : newGame.goldBlack,
        };
      }
    }

    // Necromancer: track captured pawn columns (FIX: store column, revive at home rank)
    if (capturedType === "P") {
      const victimColor = opp(movingColor);
      const col = to[1];
      if (victimColor === "white") setWhiteLostPawnCols(prev => [...prev, col]);
      else setBlackLostPawnCols(prev => [...prev, col]);
    }

    // Internal Combustion
    const opponentColor = opp(movingColor);
    const opponentAugs  = opponentColor === "white" ? whiteAugments : blackAugments;
    const icUsed        = opponentColor === "white" ? whiteIcUsed : blackIcUsed;
    if (newGame.status === "check" && opponentAugs.some(a => a.id === "internal-combustion") && !icUsed) {
      const checker = findCheckingPiece(newGame.board, opponentColor);
      if (checker) {
        const nb = cloneBoard(newGame.board);
        nb[checker[0]][checker[1]] = null;
        newGame = recomputeStatus({ ...newGame, board: nb });
        if (opponentColor === "white") setWhiteIcUsed(true); else setBlackIcUsed(true);
      }
    }

    setGame(newGame);

    // Collect augment triggers
    const rollW = getWeightsForPlayer(playerAugs);
    const held  = [...whiteAugments, ...blackAugments].map(a => a.id);
    const newTriggers: AugmentTrigger[] = [];

    if (capturedType) {
      const ms = movingColor === "white" ? whiteMilestones : blackMilestones;
      const triggered = checkNewMilestone(capturedType, ms);
      if (triggered) {
        const newMs = applyMilestone(triggered, ms);
        if (movingColor === "white") setWhiteMilestones(newMs); else setBlackMilestones(newMs);
        newTriggers.push({ color: movingColor, reason: "milestone", milestoneType: triggered });
      }
    }

    if (capturedType && playerAugs.some(a => a.id === "bloodlust")) {
      const newCount = (movingColor === "white" ? whiteCaptureCount : blackCaptureCount) + 1;
      if (movingColor === "white") setWhiteCaptureCount(newCount); else setBlackCaptureCount(newCount);
      const nextThreshold = movingColor === "white" ? whiteBloodlustNext : blackBloodlustNext;
      if (newCount >= nextThreshold) {
        if (movingColor === "white") setWhiteBloodlustNext(t=>t+4); else setBlackBloodlustNext(t=>t+4);
        newTriggers.push({ color: movingColor, reason: "bloodlust" });
      }
    } else if (capturedType) {
      const newCount = (movingColor === "white" ? whiteCaptureCount : blackCaptureCount) + 1;
      if (movingColor === "white") setWhiteCaptureCount(newCount); else setBlackCaptureCount(newCount);
    }

    if (newTriggers.length > 0) {
      const [first, ...rest] = newTriggers;
      const wAugs = movingColor === "white" ? [...whiteAugments] : whiteAugments;
      const bAugs = movingColor === "black" ? [...blackAugments] : blackAugments;
      setCurrentTrigger(first);
      setMidGameOffered(rollAugments(3, held, rollW));
      if (rest.length > 0) setAugmentQueue(prev => [...prev, ...rest]);
    }
  }, [
    game, frozenSquare, frozenExpireAfter,
    whiteTurnCount, blackTurnCount, whiteAugments, blackAugments,
    whiteMilestones, blackMilestones, whiteIcUsed, blackIcUsed,
    whiteCaptureCount, blackCaptureCount, whiteBloodlustNext, blackBloodlustNext,
  ]);

  // ── Undo ───────────────────────────────────────────────────────────────────

  const handleUndo = useCallback(() => {
    if (gameHistory.length < 2) return;
    const restored = gameHistory[gameHistory.length - 2];
    setGame(restored);
    setGameHistory(h => h.slice(0,-2));
    setSelected(null); setValidMoves([]);
    setFreezeMode(false); setNecroMode(false); setRoyalEdMode(false); setWhatMode(false); setWhatSelected(null);
    if (game.turn === "white") { setWhiteUndosLeft(u=>u-1); setWhiteTurnCount(c=>Math.max(0,c-1)); setBlackTurnCount(c=>Math.max(0,c-1)); }
    else { setBlackUndosLeft(u=>u-1); setBlackTurnCount(c=>Math.max(0,c-1)); setWhiteTurnCount(c=>Math.max(0,c-1)); }
  }, [game, gameHistory]);

  // ── Mode toggles ──────────────────────────────────────────────────────────

  const clearModes = (keepFreeze=false, keepNecro=false, keepRoyalEd=false, keepWhat=false) => {
    if (!keepFreeze) setFreezeMode(false);
    if (!keepNecro)  setNecroMode(false);
    if (!keepRoyalEd) setRoyalEdMode(false);
    if (!keepWhat) { setWhatMode(false); setWhatSelected(null); }
    setSelected(null); setValidMoves([]);
  };

  const handleToggleFreeze = useCallback(() => {
    const entering = !freezeMode;
    clearModes(entering);
    setFreezeMode(entering);
  }, [freezeMode]);

  const handleToggleNecro = useCallback(() => {
    const entering = !necroMode;
    clearModes(false, entering);
    setNecroMode(entering);
    if (entering) {
      // Show home-rank empty squares for lost pawns
      const lostCols = game.turn === "white" ? whiteLostPawnCols : blackLostPawnCols;
      const homeRow  = game.turn === "white" ? 6 : 1;
      const targets  = lostCols
        .filter(col => !game.board[homeRow][col])
        .map(col => [homeRow, col] as [number,number]);
      setValidMoves(targets);
    }
  }, [necroMode, game, whiteLostPawnCols, blackLostPawnCols]);

  const handleToggleRoyalEd = useCallback(() => {
    const entering = !royalEdMode;
    clearModes(false, false, entering);
    setRoyalEdMode(entering);
    if (entering) {
      const { kingPos, dests } = getRoyalEdMoves(game, game.turn);
      if (dests.length > 0) {
        setSelected(kingPos);
        setValidMoves(dests);
      } else {
        setRoyalEdMode(false);
      }
    }
  }, [royalEdMode, game]);

  const handleToggleWhat = useCallback(() => {
    const entering = !whatMode;
    clearModes(false, false, false, entering);
    setWhatMode(entering);
  }, [whatMode]);

  // ── Square click ──────────────────────────────────────────────────────────

  const handleSquareClick = useCallback((r: number, c: number) => {
    if (phase !== "playing") return;
    if (currentTrigger !== null) return;
    if (game.status === "checkmate" || game.status === "stalemate") return;
    if (promotionPending) return;

    const piece = game.board[r][c];

    // ── Freeze mode ──────────────────────────────────────────────────────────
    if (freezeMode) {
      if (piece && piece.color !== game.turn) {
        setFrozenSquare([r, c]);
        setFrozenExpireAfter(opp(game.turn)); // clears after opponent moves
        if (game.turn === "white") setWhiteFreezeCharges(n=>n-1);
        else setBlackFreezeCharges(n=>n-1);
      }
      setFreezeMode(false);
      // Do NOT switch turn — the freezing player can still make their move
      return;
    }

    // ── Necro mode ───────────────────────────────────────────────────────────
    if (necroMode) {
      const playerColor = game.turn;
      const homeRow     = playerColor === "white" ? 6 : 1;
      const lostCols    = playerColor === "white" ? whiteLostPawnCols : blackLostPawnCols;
      const isTarget    = lostCols.some(col => col === c) && r === homeRow && !game.board[r][c];
      if (isTarget) {
        const newBoard = cloneBoard(game.board);
        newBoard[r][c] = { type: "P", color: playerColor };
        const nextTurn = opp(playerColor);
        const newGState = recomputeStatus({ ...game, board: newBoard, turn: nextTurn });
        setGameHistory(h => [...h, game]);
        setGame(newGState);
        // Remove one instance of that column from lost list
        if (playerColor === "white") {
          setWhiteLostPawnCols(prev => { const idx=prev.indexOf(c); return idx>=0?[...prev.slice(0,idx),...prev.slice(idx+1)]:prev; });
          setWhiteNecroCharges(n=>n-1);
        } else {
          setBlackLostPawnCols(prev => { const idx=prev.indexOf(c); return idx>=0?[...prev.slice(0,idx),...prev.slice(idx+1)]:prev; });
          setBlackNecroCharges(n=>n-1);
        }
      }
      setNecroMode(false);
      setSelected(null); setValidMoves([]);
      return;
    }

    // ── Royal Education mode ─────────────────────────────────────────────────
    if (royalEdMode) {
      const isValid = validMoves.some(([vr,vc]) => vr===r && vc===c);
      if (isValid && selected) {
        const capturedType = game.board[r][c]?.type ?? null;
        executeMove(selected, [r,c], undefined, capturedType);
        if (game.turn === "white") setWhiteRoyalEdUsed(true); else setBlackRoyalEdUsed(true);
      }
      setRoyalEdMode(false);
      setSelected(null); setValidMoves([]);
      return;
    }

    // ── What? mode ───────────────────────────────────────────────────────────
    if (whatMode) {
      if (!whatSelected) {
        // Step 1: select a pawn
        if (piece?.type === "P" && piece.color === game.turn) {
          const moves: [number,number][] = [];
          if (c > 0 && !game.board[r][c-1]) moves.push([r, c-1]);
          if (c < 7 && !game.board[r][c+1]) moves.push([r, c+1]);
          if (moves.length > 0) {
            setWhatSelected([r, c]);
            setSelected([r, c]);
            setValidMoves(moves);
          }
        } else {
          setWhatMode(false); setWhatSelected(null); setSelected(null); setValidMoves([]);
        }
        return;
      }
      // Step 2: execute horizontal move
      const isValid = validMoves.some(([vr,vc]) => vr===r && vc===c);
      if (isValid) {
        // The engine's en-passant branch happens to handle horizontal pawn moves correctly
        executeMove(whatSelected, [r,c], undefined, null);
        if (game.turn === "white") setWhiteWhatUsed(true); else setBlackWhatUsed(true);
      }
      setWhatMode(false); setWhatSelected(null); setSelected(null); setValidMoves([]);
      return;
    }

    // ── Normal chess ─────────────────────────────────────────────────────────
    const playerAugsNow  = game.turn === "white" ? whiteAugments : blackAugments;
    const hasAlternative = playerAugsNow.some(a => a.id === "alternative");

    const isFrozenPiece = frozenSquare && frozenSquare[0]===r && frozenSquare[1]===c && piece?.color===game.turn;

    const computeMoves = (pr: number, pc: number): [number,number][] => {
      const moves = getLegalMoves(game, pr, pc);
      const p = game.board[pr][pc];
      if (hasAlternative && p?.type === "P")
        for (const [er,ec] of getAlternativeMoves(game, pr, pc))
          if (!moves.some(([mr,mc]) => mr===er && mc===ec)) moves.push([er,ec]);
      return moves;
    };

    if (selected) {
      const isValid = validMoves.some(([vr,vc]) => vr===r && vc===c);
      if (isValid) {
        const movingPiece = game.board[selected[0]][selected[1]]!;
        const isPromotion = movingPiece.type === "P" &&
          ((movingPiece.color==="white" && r===0) || (movingPiece.color==="black" && r===7));
        if (isPromotion) {
          setPromotionPending({ from: selected, to: [r,c] });
        } else {
          const isEP = movingPiece.type==="P" && selected[1]!==c && !game.board[r][c];
          executeMove(selected, [r,c], undefined, game.board[r][c]?.type ?? (isEP?"P":null));
          setSelected(null); setValidMoves([]);
        }
        return;
      }
      if (piece && piece.color===game.turn && !isFrozenPiece) {
        setSelected([r,c]); setValidMoves(computeMoves(r,c)); return;
      }
      setSelected(null); setValidMoves([]); return;
    }

    if (piece && piece.color===game.turn && !isFrozenPiece) {
      setSelected([r,c]); setValidMoves(computeMoves(r,c));
    }
  }, [
    phase, currentTrigger, game, selected, validMoves, promotionPending,
    freezeMode, necroMode, royalEdMode, whatMode, whatSelected, frozenSquare,
    whiteLostPawnCols, blackLostPawnCols, whiteAugments, blackAugments, executeMove,
  ]);

  const handlePromotion = useCallback((type: PieceType) => {
    if (!promotionPending) return;
    const captured = game.board[promotionPending.to[0]][promotionPending.to[1]];
    executeMove(promotionPending.from, promotionPending.to, type, captured?.type??null);
    setPromotionPending(null); setSelected(null); setValidMoves([]);
  }, [promotionPending, game, executeMove]);

  // ── Reset ─────────────────────────────────────────────────────────────────

  const resetGame = () => {
    setGame(createInitialState());
    setSelected(null); setValidMoves([]); setPromotionPending(null);
    setPhase("start");
    setWhiteAugments([]); setBlackAugments([]);
    setOfferedToWhite([]); setOfferedToBlack([]);
    setWhiteMilestones(EMPTY_MILESTONES); setBlackMilestones(EMPTY_MILESTONES);
    setAugmentQueue([]); setCurrentTrigger(null); setMidGameOffered([]);
    setGameHistory([]);
    setWhiteUndosLeft(0); setBlackUndosLeft(0);
    setWhiteTurnCount(0); setBlackTurnCount(0);
    setWhiteFreezeCharges(0); setBlackFreezeCharges(0);
    setFrozenSquare(null); setFrozenExpireAfter(null); setFreezeMode(false);
    setWhiteNecroCharges(0); setBlackNecroCharges(0);
    setWhiteLostPawnCols([]); setBlackLostPawnCols([]); setNecroMode(false);
    setWhiteCaptureCount(0); setBlackCaptureCount(0);
    setWhiteBloodlustNext(4); setBlackBloodlustNext(4);
    setWhiteIcUsed(false); setBlackIcUsed(false);
    setWhiteRoyalEdUsed(false); setBlackRoyalEdUsed(false); setRoyalEdMode(false);
    setWhiteWhatUsed(false); setBlackWhatUsed(false); setWhatMode(false); setWhatSelected(null);
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const adv    = materialAdvantage(game);
  const isOver = game.status === "checkmate" || game.status === "stalemate";
  const statusText = (() => {
    if (game.status === "checkmate") return { label:`${opp(game.turn).toUpperCase()} WINS  ·  Checkmate`, color:"#4ade80" };
    if (game.status === "stalemate") return { label:"DRAW  ·  Stalemate", color:"#94a3b8" };
    if (game.status === "check")     return { label:`${game.turn.toUpperCase()}  ·  CHECK!`, color:"#f87171" };
    return { label:`${game.turn.toUpperCase()}'S TURN`, color:"#e2e8f0" };
  })();

  const canWhiteUndo = phase==="playing" && !isOver && game.turn==="white" && whiteUndosLeft>0 && gameHistory.length>=2;
  const canBlackUndo = phase==="playing" && !isOver && game.turn==="black" && blackUndosLeft>0 && gameHistory.length>=2;

  const whiteNecroHomeRow = 6;
  const blackNecroHomeRow = 1;
  const whiteHasNecroTargets = whiteLostPawnCols.some(col => !game.board[whiteNecroHomeRow][col]);
  const blackHasNecroTargets = blackLostPawnCols.some(col => !game.board[blackNecroHomeRow][col]);

  const makeSpells = (color: Color): SpellState => ({
    freezeCharges:    color==="white" ? whiteFreezeCharges : blackFreezeCharges,
    freezeActive:     freezeMode && game.turn===color,
    onFreeze:         handleToggleFreeze,
    necroCharges:     color==="white" ? whiteNecroCharges : blackNecroCharges,
    necroActive:      necroMode && game.turn===color,
    hasNecroTargets:  color==="white" ? whiteHasNecroTargets : blackHasNecroTargets,
    onNecro:          handleToggleNecro,
    royalEdAvailable: color==="white" ? (!whiteRoyalEdUsed && whiteAugments.some(a=>a.id==="royal-education"))
                                      : (!blackRoyalEdUsed && blackAugments.some(a=>a.id==="royal-education")),
    royalEdActive:    royalEdMode && game.turn===color,
    onRoyalEd:        handleToggleRoyalEd,
    whatAvailable:    color==="white" ? (!whiteWhatUsed && whiteAugments.some(a=>a.id==="what"))
                                      : (!blackWhatUsed && blackAugments.some(a=>a.id==="what")),
    whatActive:       whatMode && game.turn===color,
    onWhat:           handleToggleWhat,
    canUndo:          color==="white" ? canWhiteUndo : canBlackUndo,
    onUndo:           handleUndo,
    captureCount:     color==="white" ? whiteCaptureCount : blackCaptureCount,
    hasBloodlust:     color==="white" ? whiteAugments.some(a=>a.id==="bloodlust") : blackAugments.some(a=>a.id==="bloodlust"),
  });

  // Active mode banner text
  const modeBanner = (() => {
    if (freezeMode) return { text:"❄️ Click an enemy piece to freeze it", color:"#06b6d4" };
    if (necroMode)  return { text:"💀 Click a home-rank square to revive a pawn there", color:"#a855f7" };
    if (royalEdMode)return { text:"♞ Click a destination for your king's knight move", color:"#facc15" };
    if (whatMode && !whatSelected) return { text:"↔️ Click one of your pawns to move it sideways", color:"#f97316" };
    if (whatMode && whatSelected)  return { text:"↔️ Click the destination square", color:"#f97316" };
    return null;
  })();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display:"flex",flexDirection:"column",width:"100%",height:"100%",background:"#030712",color:"#fff",userSelect:"none",overflow:"hidden",position:"relative" }}>

      <PlayerBar
        color="black" isActive={game.turn==="black"} isOver={isOver} phase={phase}
        augments={blackAugments} gold={game.goldBlack}
        capturedPieces={game.capturedByBlack} advantage={adv.black>0?adv.black:0}
        spells={makeSpells("black")} showReset={true} onReset={resetGame}
      />

      <div ref={containerRef} style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:6,minHeight:0,position:"relative",background:"#030712" }}>
        <div style={{ width:boardPx,height:boardPx,display:"grid",gridTemplateColumns:`repeat(8, ${sqSize}px)`,gridTemplateRows:`repeat(8, ${sqSize}px)`,border:"3px solid #5c3d1e",borderRadius:2,boxShadow:"0 8px 40px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.5)",flexShrink:0 }}>
          {Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=>{
            const piece   = game.board[r][c];
            const isSel   = selected?.[0]===r && selected?.[1]===c;
            const isVM    = validMoves.some(([vr,vc])=>vr===r&&vc===c);
            const isLM    = !!(game.lastMove&&((game.lastMove.from[0]===r&&game.lastMove.from[1]===c)||(game.lastMove.to[0]===r&&game.lastMove.to[1]===c)));
            const isCK    = !!(piece?.type==="K"&&piece.color===game.turn&&(game.status==="check"||game.status==="checkmate"));
            const isCenter= showCenterMarkers && CENTER_SQUARES.has(`${r},${c}`);
            const isFrozen= !!(frozenSquare&&frozenSquare[0]===r&&frozenSquare[1]===c);
            return <SquareEl key={`${r}-${c}`} row={r} col={c} size={sqSize} piece={piece} isSelected={isSel} isValidMove={isVM} isLastMove={isLM} isCheckKing={isCK} isCenter={isCenter} isFrozen={isFrozen} onClick={()=>handleSquareClick(r,c)}/>;
          }))}
        </div>

        {promotionPending && <PromotionDialog color={game.turn} onChoose={handlePromotion}/>}

        {isOver && (
          <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none" }}>
            <div style={{ background:"#111827",border:"1px solid #374151",borderRadius:14,padding:"20px 36px",display:"flex",flexDirection:"column",alignItems:"center",gap:10,boxShadow:"0 8px 40px rgba(0,0,0,0.7)",pointerEvents:"auto" }}>
              <span style={{ fontSize:22,fontWeight:900,color:statusText.color,letterSpacing:"0.04em" }}>{statusText.label}</span>
              <button onClick={resetGame} style={{ padding:"8px 28px",fontSize:14,fontWeight:700,borderRadius:10,border:"none",cursor:"pointer",background:"linear-gradient(135deg,#4f46e5,#6366f1)",color:"#fff",boxShadow:"0 3px 12px rgba(99,102,241,0.5)" }}>Play Again</button>
            </div>
          </div>
        )}

        {modeBanner && (
          <div style={{ position:"absolute",top:10,left:"50%",transform:"translateX(-50%)",zIndex:20,pointerEvents:"none",background:`rgba(0,0,0,0.82)`,color:modeBanner.color,fontSize:11,fontWeight:800,letterSpacing:"0.08em",padding:"5px 18px",borderRadius:20,textTransform:"uppercase",boxShadow:`0 2px 12px rgba(0,0,0,0.5), 0 0 0 1px ${modeBanner.color}40`,whiteSpace:"nowrap" }}>
            {modeBanner.text}
          </div>
        )}
      </div>

      <PlayerBar
        color="white" isActive={game.turn==="white"} isOver={isOver} phase={phase}
        augments={whiteAugments} gold={game.goldWhite}
        capturedPieces={game.capturedByWhite} advantage={adv.white>0?adv.white:0}
        spells={makeSpells("white")} showReset={false} onReset={resetGame}
        statusLabel={phase==="playing"&&!isOver?statusText.label:undefined}
        statusColor={statusText.color} statusBadge={game.status==="check"}
      />

      {/* ═══ Phase overlays ═══ */}
      {phase==="start" && <StartScreen onStart={handleStart}/>}
      {phase==="white-augment" && <AugmentSelector playerColor="white" offered={offeredToWhite} onSelect={handleWhitePick}/>}
      {phase==="black-augment" && <AugmentSelector playerColor="black" offered={offeredToBlack} onSelect={handleBlackPick}/>}
      {phase==="playing" && currentTrigger!==null && (
        <AugmentSelector playerColor={currentTrigger.color} offered={midGameOffered} onSelect={handleMidGamePick} trigger={currentTrigger}/>
      )}
    </div>
  );
}
