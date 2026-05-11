import { useState, useEffect, useRef, useCallback } from "react";
import { Augment, AUGMENT_POOL, rollAugments, RARITY_META } from "./augments";
import ChessGame, { MpConfig } from "./ChessGame";

// ─── Types ────────────────────────────────────────────────────────────────────

type LobbyPhase =
  | "menu"
  | "creating"
  | "waiting_opponent"
  | "picking_augment"
  | "waiting_start"
  | "playing"
  | "opponent_left";

type Color = "white" | "black";

interface WsMsg {
  type: string;
  [key: string]: unknown;
}

// ─── WebSocket hook ───────────────────────────────────────────────────────────

function useChessSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMsg, setLastMsg] = useState<WsMsg | null>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/chess-ws`);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (e) => {
      try { setLastMsg(JSON.parse(e.data)); } catch {}
    };
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  const send = useCallback((msg: object) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  return { connected, lastMsg, connect, disconnect, send };
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#1e2130", border: "1px solid #2d3148", borderRadius: 12, padding: 24, ...style }}>
      {children}
    </div>
  );
}

function Btn({ children, onClick, disabled, variant = "primary", style }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean;
  variant?: "primary" | "secondary" | "danger"; style?: React.CSSProperties;
}) {
  const bg = variant === "primary" ? "#6366f1" : variant === "danger" ? "#dc2626" : "#374151";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? "#374151" : bg, color: "#fff", border: "none", borderRadius: 8,
        padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1, transition: "opacity 0.2s", ...style,
      }}
    >
      {children}
    </button>
  );
}

// ─── Augment pick card ────────────────────────────────────────────────────────

function AugmentCard({ aug, onPick }: { aug: Augment; onPick: () => void }) {
  const meta = RARITY_META[aug.rarity];
  return (
    <button
      onClick={onPick}
      style={{
        background: "#111827", border: `2px solid ${meta.border}`,
        boxShadow: `0 0 12px ${meta.glow}`, borderRadius: 12, padding: 16,
        cursor: "pointer", textAlign: "left", color: "#fff", width: "100%", transition: "transform 0.15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.02)")}
      onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
    >
      <div style={{ fontSize: 28, marginBottom: 6 }}>{aug.icon}</div>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{aug.name}</div>
      <div style={{ fontSize: 11, color: meta.text, fontWeight: 600, marginBottom: 6, textTransform: "uppercase" }}>
        {aug.rarity}
      </div>
      <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.5 }}>{aug.description}</div>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MultiplayerChess({ onBack }: { onBack: () => void }) {
  const { connected, lastMsg, connect, disconnect, send } = useChessSocket();
  const [lobbyPhase, setLobbyPhase] = useState<LobbyPhase>("menu");
  const [roomId, setRoomId] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [joinError, setJoinError] = useState("");
  const [myColor, setMyColor] = useState<Color>("white");
  const [offeredAugs, setOfferedAugs] = useState<Augment[]>([]);
  const [myAugment, setMyAugment] = useState<Augment | null>(null);
  const [opponentAugmentId, setOpponentAugmentId] = useState<string | null>(null);
  const [incomingSnapshot, setIncomingSnapshot] = useState<Record<string, unknown> | null>(null);
  const [opponentLeft, setOpponentLeft] = useState(false);
  const incomingRef = useRef<Record<string, unknown> | null>(null);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMsg) return;
    switch (lastMsg.type) {
      case "created":
        setRoomId(lastMsg.roomId as string);
        setMyColor("white");
        setLobbyPhase("waiting_opponent");
        break;
      case "joined":
        setRoomId(lastMsg.roomId as string);
        setMyColor("black");
        setOfferedAugs(rollAugments(3));
        setLobbyPhase("picking_augment");
        break;
      case "opponent_joined":
        // White now picks their augment
        setOfferedAugs(rollAugments(3));
        setLobbyPhase("picking_augment");
        break;
      case "opponent_augment": {
        const oppId = lastMsg.augmentId as string;
        setOpponentAugmentId(oppId);
        // If we're still on the pick screen, remove the opponent's chosen augment from our offered list
        setOfferedAugs(prev => prev.filter(a => a.id !== oppId));
        break;
      }
      case "start":
        setLobbyPhase("playing");
        break;
      case "move": {
        const snap = lastMsg.snapshot as Record<string, unknown>;
        const newSnap = { ...snap, _ts: Date.now() };
        incomingRef.current = newSnap;
        setIncomingSnapshot(newSnap);
        break;
      }
      case "opponent_left":
        setOpponentLeft(true);
        break;
      case "error":
        setJoinError(lastMsg.msg as string);
        break;
    }
  }, [lastMsg]);

  const handleCreate = () => {
    setJoinError("");
    send({ type: "create" });
    setLobbyPhase("creating");
  };

  const handleJoin = () => {
    if (!joinInput.trim()) return;
    setJoinError("");
    send({ type: "join", roomId: joinInput.trim().toUpperCase() });
  };

  const handlePickAugment = (aug: Augment) => {
    setMyAugment(aug);
    send({ type: "ready", augmentId: aug.id });
    setLobbyPhase("waiting_start");
  };

  const handleSnapshot = useCallback((snap: Record<string, unknown>) => {
    send({ type: "move", snapshot: snap });
  }, [send]);

  const handleOpponentLeft = useCallback(() => {
    setOpponentLeft(true);
  }, []);

  // Derive the actual Augment objects once we have both IDs
  const whiteAugment = myColor === "white" ? myAugment : (opponentAugmentId ? AUGMENT_POOL.find(a => a.id === opponentAugmentId) ?? null : null);
  const blackAugment = myColor === "black" ? myAugment : (opponentAugmentId ? AUGMENT_POOL.find(a => a.id === opponentAugmentId) ?? null : null);

  const mpConfig: MpConfig | undefined = (lobbyPhase === "playing" && whiteAugment && blackAugment) ? {
    myColor,
    initialWhiteAugment: whiteAugment,
    initialBlackAugment: blackAugment,
    onSnapshot: handleSnapshot,
    incomingSnapshot,
    opponentLeft,
  } : undefined;

  // ── Render ────────────────────────────────────────────────────────────────

  if (lobbyPhase === "playing" && mpConfig) {
    return <ChessGame mpConfig={mpConfig} />;
  }

  const containerStyle: React.CSSProperties = {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    width: "100%", height: "100%", background: "#0f1117", color: "#fff", fontFamily: "sans-serif",
    padding: 24, boxSizing: "border-box",
  };

  // ── Menu ──────────────────────────────────────────────────────────────────
  if (lobbyPhase === "menu") {
    return (
      <div style={containerStyle}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>♟️</div>
        <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>Online Multiplayer</h2>
        <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 28px", textAlign: "center" }}>
          Play Chess Roguelike with a friend in real time
        </p>
        <Card style={{ width: "100%", maxWidth: 340 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Btn onClick={handleCreate} disabled={!connected}>
              {connected ? "Create Room" : "Connecting…"}
            </Btn>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={joinInput}
                onChange={e => { setJoinInput(e.target.value.toUpperCase()); setJoinError(""); }}
                onKeyDown={e => e.key === "Enter" && handleJoin()}
                placeholder="Enter room code"
                maxLength={6}
                style={{
                  flex: 1, background: "#111827", border: "1px solid #374151", borderRadius: 8,
                  padding: "10px 12px", color: "#fff", fontSize: 15, fontWeight: 700, letterSpacing: 2,
                  textTransform: "uppercase", outline: "none",
                }}
              />
              <Btn onClick={handleJoin} disabled={!connected || !joinInput.trim()} variant="secondary">
                Join
              </Btn>
            </div>
            {joinError && <p style={{ color: "#f87171", fontSize: 12, margin: 0 }}>{joinError}</p>}
          </div>
        </Card>
        <button
          onClick={onBack}
          style={{ marginTop: 20, background: "none", border: "none", color: "#6b7280", fontSize: 13, cursor: "pointer" }}
        >
          ← Back to local game
        </button>
      </div>
    );
  }

  // ── Creating / waiting for join ───────────────────────────────────────────
  if (lobbyPhase === "creating" || lobbyPhase === "waiting_opponent") {
    return (
      <div style={containerStyle}>
        <Card style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔗</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 18 }}>Room Created!</h3>
          <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 16px" }}>
            Share this code with your opponent:
          </p>
          <div style={{
            fontSize: 36, fontWeight: 900, letterSpacing: 8, color: "#a5b4fc",
            background: "#111827", borderRadius: 10, padding: "14px 20px", marginBottom: 16,
          }}>
            {roomId}
          </div>
          <p style={{ color: "#6b7280", fontSize: 12, margin: "0 0 16px" }}>
            Waiting for opponent to join…
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: "50%", background: "#6366f1",
                animation: `pulse 1.2s ${i*0.4}s ease-in-out infinite`,
              }} />
            ))}
          </div>
          <Btn variant="secondary" onClick={() => { disconnect(); connect(); setLobbyPhase("menu"); }}>
            Cancel
          </Btn>
        </Card>
        <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}`}</style>
      </div>
    );
  }

  // ── Augment pick ──────────────────────────────────────────────────────────
  if (lobbyPhase === "picking_augment") {
    return (
      <div style={containerStyle}>
        <div style={{ width: "100%", maxWidth: 480 }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
              {myColor === "white" ? "⬜ You are White" : "⬛ You are Black"}
            </div>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>
              Choose your starting augment
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {offeredAugs.map(aug => (
              <AugmentCard key={aug.id} aug={aug} onPick={() => handlePickAugment(aug)} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Waiting for game start ────────────────────────────────────────────────
  if (lobbyPhase === "waiting_start") {
    return (
      <div style={containerStyle}>
        <Card style={{ textAlign: "center", maxWidth: 320 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>
            {myAugment?.icon ?? "⏳"}
          </div>
          <p style={{ margin: "0 0 6px", fontWeight: 700 }}>
            You chose: {myAugment?.name}
          </p>
          <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 16px" }}>
            Waiting for your opponent to pick their augment…
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: "50%", background: "#6366f1",
                animation: `pulse 1.2s ${i*0.4}s ease-in-out infinite`,
              }} />
            ))}
          </div>
        </Card>
        <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}`}</style>
      </div>
    );
  }

  // ── Fallback / playing with missing config ────────────────────────────────
  return (
    <div style={containerStyle}>
      <p style={{ color: "#9ca3af" }}>Setting up game…</p>
    </div>
  );
}
