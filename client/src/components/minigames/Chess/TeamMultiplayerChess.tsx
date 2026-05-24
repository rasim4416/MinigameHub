import { useState, useEffect, useRef, useCallback } from "react";
import ChessGame, { MpConfig } from "./ChessGame";
import type { PlayerSlot } from "./engine";
import { slotToColor } from "./engine";

type LobbyPhase = "menu" | "creating" | "lobby" | "playing" | "opponent_left";

interface WsMsg {
  type: string;
  [key: string]: unknown;
}

interface LobbyNeutralPlayer {
  playerId: string;
  name: string;
}

interface LobbyState {
  slots: Record<PlayerSlot, string | null>;
  slotNames: Record<PlayerSlot, string | null>;
  neutral: LobbyNeutralPlayer[];
  playerCount: number;
  yourPlayerId: string;
}

interface ResumeSession {
  roomId: string;
  playerId: string;
  sessionToken: string;
}

const TEAM_SLOTS: PlayerSlot[] = ["white1", "white2", "black1", "black2"];

function useTeamChessSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const closingIntentionallyRef = useRef(false);
  const resumeSessionRef = useRef<ResumeSession | null>(null);
  const resumeEnabledRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const pingIntervalRef = useRef<number | null>(null);

  const [connected, setConnected] = useState(false);
  const [connectionLost, setConnectionLost] = useState(false);
  const [lastMsg, setLastMsg] = useState<WsMsg | null>(null);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const clearPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const connectInnerRef = useRef<() => void>(() => {});

  const connectInner = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    if (wsRef.current) {
      const stale = wsRef.current;
      closingIntentionallyRef.current = true;
      stale.close();
      closingIntentionallyRef.current = false;
      if (wsRef.current === stale) wsRef.current = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/chess-ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setConnectionLost(false);
      reconnectAttemptRef.current = 0;
      clearReconnectTimer();

      const cred = resumeSessionRef.current;
      if (cred && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "resume",
            roomId: cred.roomId,
            playerId: cred.playerId,
            sessionToken: cred.sessionToken,
          }),
        );
      }

      clearPingInterval();
      pingIntervalRef.current = window.setInterval(() => {
        const w = wsRef.current;
        if (w?.readyState === WebSocket.OPEN) {
          w.send(JSON.stringify({ type: "ping" }));
        }
      }, 18_000);
    };

    ws.onmessage = (e) => {
      try {
        setLastMsg(JSON.parse(e.data));
      } catch {
        /* ignore */
      }
    };

    ws.onerror = () => setConnected(false);

    ws.onclose = () => {
      clearPingInterval();
      setConnected(false);
      if (wsRef.current === ws) wsRef.current = null;
      if (closingIntentionallyRef.current) {
        closingIntentionallyRef.current = false;
        return;
      }
      closingIntentionallyRef.current = false;
      if (resumeEnabledRef.current && resumeSessionRef.current) {
        setConnectionLost(true);
        const attempt = reconnectAttemptRef.current++;
        const delay = Math.min(24_000, 350 * Math.pow(2, Math.min(attempt, 7)));
        clearReconnectTimer();
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectTimerRef.current = null;
          if (!resumeEnabledRef.current) return;
          if (wsRef.current?.readyState === WebSocket.OPEN) return;
          connectInnerRef.current();
        }, delay);
      }
    };
  }, [clearPingInterval, clearReconnectTimer]);

  connectInnerRef.current = connectInner;

  const connect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    connectInner();
  }, [connectInner]);

  const disconnect = useCallback(() => {
    clearReconnectTimer();
    clearPingInterval();
    resumeEnabledRef.current = false;
    resumeSessionRef.current = null;
    setConnectionLost(false);
    const w = wsRef.current;
    if (w) {
      closingIntentionallyRef.current = true;
      w.close();
      if (wsRef.current === w) wsRef.current = null;
    }
    setConnected(false);
  }, [clearPingInterval, clearReconnectTimer]);

  const send = useCallback((msg: object) => {
    const w = wsRef.current;
    if (w?.readyState === WebSocket.OPEN) w.send(JSON.stringify(msg));
  }, []);

  const setResumeSession = useCallback((session: ResumeSession | null) => {
    resumeSessionRef.current = session;
  }, []);

  const setResumeEnabled = useCallback(
    (enabled: boolean) => {
      resumeEnabledRef.current = enabled;
      if (!enabled) {
        clearReconnectTimer();
        setConnectionLost(false);
      }
    },
    [clearReconnectTimer],
  );

  const clearConnectionLost = useCallback(() => setConnectionLost(false), []);

  return {
    connected,
    connectionLost,
    lastMsg,
    connect,
    disconnect,
    send,
    setResumeSession,
    setResumeEnabled,
    clearConnectionLost,
  };
}

function parseLobbyState(msg: WsMsg): LobbyState | null {
  if (!msg.slots || typeof msg.slots !== "object") return null;
  const slots = msg.slots as Record<PlayerSlot, string | null>;
  const slotNames = (msg.slotNames as Record<PlayerSlot, string | null>) ?? {
    white1: null,
    white2: null,
    black1: null,
    black2: null,
  };
  const neutral = Array.isArray(msg.neutral)
    ? (msg.neutral as LobbyNeutralPlayer[])
    : [];
  return {
    slots,
    slotNames,
    neutral,
    playerCount: typeof msg.playerCount === "number" ? msg.playerCount : 0,
    yourPlayerId: String(msg.yourPlayerId ?? ""),
  };
}

function Btn({
  children,
  onClick,
  disabled,
  variant = "primary",
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  style?: React.CSSProperties;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: "#6366f1", color: "#fff" },
    secondary: { background: "#374151", color: "#fff" },
    danger: { background: "#dc2626", color: "#fff" },
    ghost: { background: "transparent", color: "#9ca3af", border: "1px solid #4b5563" },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles[variant],
        border: variant === "ghost" ? styles.ghost.border : "none",
        borderRadius: 8,
        padding: "10px 18px",
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function SlotCard({
  slot,
  label,
  occupantName,
  isYou,
  empty,
  onClick,
  disabled,
  theme,
}: {
  slot: string;
  label: string;
  occupantName: string | null;
  isYou: boolean;
  empty: boolean;
  onClick?: () => void;
  disabled?: boolean;
  theme: "white" | "black" | "neutral";
}) {
  const themes = {
    white: {
      bg: "#f8fafc",
      border: "#cbd5e1",
      text: "#1e293b",
      sub: "#64748b",
      accent: "#6366f1",
    },
    black: {
      bg: "#1e293b",
      border: "#334155",
      text: "#f1f5f9",
      sub: "#94a3b8",
      accent: "#818cf8",
    },
    neutral: {
      bg: "#1e2130",
      border: "#3d4460",
      text: "#e2e8f0",
      sub: "#9ca3af",
      accent: "#6366f1",
    },
  };
  const t = themes[theme];
  const clickable = !disabled && onClick && (empty || isYou);

  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={disabled || !clickable}
      style={{
        width: "100%",
        minHeight: 72,
        padding: "12px 14px",
        borderRadius: 10,
        border: `2px solid ${isYou ? t.accent : t.border}`,
        background: t.bg,
        color: t.text,
        textAlign: "left",
        cursor: clickable ? "pointer" : "default",
        opacity: disabled && !isYou ? 0.55 : 1,
        boxShadow: isYou ? `0 0 0 1px ${t.accent}40` : "none",
        transition: "border-color 0.15s, transform 0.1s",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: t.sub }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>
        {empty ? "Empty" : occupantName}
      </div>
      {empty && !disabled && (
        <div style={{ fontSize: 11, color: t.accent, marginTop: 6 }}>Click to join</div>
      )}
      {isYou && !empty && theme !== "neutral" && (
        <div style={{ fontSize: 11, color: t.sub, marginTop: 6 }}>Click to return to pool</div>
      )}
    </button>
  );
}

export default function TeamMultiplayerChess({ onBack }: { onBack: () => void }) {
  const {
    connected,
    connectionLost,
    lastMsg,
    connect,
    disconnect,
    send,
    setResumeSession,
    setResumeEnabled,
    clearConnectionLost,
  } = useTeamChessSocket();

  const [lobbyPhase, setLobbyPhase] = useState<LobbyPhase>("menu");
  const [roomId, setRoomId] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [joinError, setJoinError] = useState("");
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [mySlot, setMySlot] = useState<PlayerSlot | null>(null);
  const [myColor, setMyColor] = useState<"white" | "black">("white");
  const [incomingSnapshot, setIncomingSnapshot] = useState<Record<string, unknown> | null>(
    null,
  );
  const [opponentLeft, setOpponentLeft] = useState(false);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const applyLobby = useCallback((msg: WsMsg) => {
    const state = parseLobbyState(msg);
    if (!state) return;
    setLobby(state);
    const yid = state.yourPlayerId;
    let assigned: PlayerSlot | null = null;
    for (const s of TEAM_SLOTS) {
      if (state.slots[s] === yid) {
        assigned = s;
        break;
      }
    }
    setMySlot(assigned);
    if (assigned) setMyColor(slotToColor(assigned));
  }, []);

  useEffect(() => {
    if (!lastMsg) return;
    switch (lastMsg.type) {
      case "created":
      case "joined":
      case "lobby_state":
        applyLobby(lastMsg);
        if (lastMsg.type === "created" || lastMsg.type === "joined") {
          setRoomId(String(lastMsg.roomId ?? ""));
          setMyPlayerId(String(lastMsg.playerId ?? lastMsg.yourPlayerId ?? ""));
          const token = String(lastMsg.sessionToken ?? "");
          setSessionToken(token);
          if (token && lastMsg.roomId) {
            setResumeSession({
              roomId: String(lastMsg.roomId),
              playerId: String(lastMsg.playerId ?? lastMsg.yourPlayerId),
              sessionToken: token,
            });
            setResumeEnabled(true);
          }
          setLobbyPhase("lobby");
        }
        break;
      case "resumed":
        clearConnectionLost();
        applyLobby(lastMsg);
        if (lastMsg.gameStarted && lastMsg.slot) {
          setMySlot(lastMsg.slot as PlayerSlot);
          setMyColor(slotToColor(lastMsg.slot as PlayerSlot));
        }
        setLobbyPhase(lastMsg.gameStarted ? "playing" : "lobby");
        break;
      case "start": {
        const slot = lastMsg.slot as PlayerSlot;
        setMySlot(slot);
        setMyColor(slotToColor(slot));
        setLobbyPhase("playing");
        break;
      }
      case "move":
        clearConnectionLost();
        setIncomingSnapshot({
          ...(lastMsg.snapshot as Record<string, unknown>),
          _ts: Date.now(),
        });
        break;
      case "opponent_left":
        setResumeEnabled(false);
        setResumeSession(null);
        setOpponentLeft(true);
        break;
      case "error":
        setJoinError(String(lastMsg.msg ?? ""));
        if (/resume|session|not exist/i.test(String(lastMsg.msg))) {
          setResumeEnabled(false);
          setResumeSession(null);
        }
        break;
    }
  }, [lastMsg, applyLobby, setResumeSession, setResumeEnabled, clearConnectionLost]);

  const handleCreate = () => {
    setJoinError("");
    send({ type: "create", mode: "2v2" });
    setLobbyPhase("creating");
  };

  const handleJoin = () => {
    if (!joinInput.trim()) return;
    setJoinError("");
    send({ type: "join", roomId: joinInput.trim().toUpperCase() });
  };

  const assignSlot = (slot: PlayerSlot | null) => {
    send({ type: "assign_slot", slot });
  };

  const handleSnapshot = useCallback(
    (snap: Record<string, unknown>) => {
      send({ type: "move", snapshot: snap });
    },
    [send],
  );

  const mpConfig: MpConfig | undefined =
    lobbyPhase === "playing" && mySlot
      ? {
          gameMode: "2v2",
          mySlot,
          myColor,
          onSnapshot: handleSnapshot,
          incomingSnapshot,
          opponentLeft,
          connectionLost,
        }
      : undefined;

  if (lobbyPhase === "playing" && mpConfig) {
    return <ChessGame mpConfig={mpConfig} />;
  }

  const filledSlots = lobby
    ? TEAM_SLOTS.filter((s) => lobby.slots[s] !== null).length
    : 0;
  const canStart = lobby && lobby.playerCount === 4 && filledSlots === 4;

  if (lobbyPhase === "lobby" && lobby) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          background: "#0f1117",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          overflow: "auto",
        }}
      >
        <header
          style={{
            flexShrink: 0,
            padding: "16px 20px",
            borderBottom: "1px solid #2d3148",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Team Lobby</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9ca3af" }}>
              Room <span style={{ letterSpacing: 4, fontWeight: 800 }}>{roomId}</span>
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, color: "#9ca3af" }}>
              Players connected:{" "}
              <strong style={{ color: "#e2e8f0" }}>{lobby.playerCount}/4</strong>
            </div>
            <div style={{ fontSize: 13, color: canStart ? "#4ade80" : "#fbbf24", marginTop: 4 }}>
              {canStart
                ? "All slots filled — starting match…"
                : `Slots filled: ${filledSlots}/4 — pick a slot to play`}
            </div>
          </div>
        </header>

        <div
          style={{
            flex: 1,
            padding: 16,
            display: "grid",
            gridTemplateColumns: "minmax(140px, 1fr) minmax(160px, 1.1fr) minmax(140px, 1fr)",
            gap: 12,
            alignItems: "stretch",
            maxWidth: 960,
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {/* White team */}
          <section
            style={{
              background: "linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)",
              borderRadius: 12,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 800,
                color: "#334155",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              White Team
            </h3>
            {(["white1", "white2"] as PlayerSlot[]).map((slot) => {
              const pid = lobby.slots[slot];
              const empty = !pid;
              const isYou = pid === lobby.yourPlayerId;
              return (
                <SlotCard
                  key={slot}
                  slot={slot}
                  label={slot === "white1" ? "White 1" : "White 2"}
                  occupantName={lobby.slotNames[slot]}
                  isYou={isYou}
                  empty={empty}
                  theme="white"
                  disabled={!empty && !isYou}
                  onClick={() => {
                    if (empty) assignSlot(slot);
                    else if (isYou) assignSlot(null);
                  }}
                />
              );
            })}
          </section>

          {/* Neutral */}
          <section
            style={{
              background: "#161922",
              border: "1px dashed #3d4460",
              borderRadius: 12,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 700,
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Unassigned
            </h3>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.4 }}>
              New players appear here. Click an empty team slot to join White or Black.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
              {lobby.neutral.length === 0 ? (
                <div
                  style={{
                    padding: 16,
                    textAlign: "center",
                    color: "#6b7280",
                    fontSize: 13,
                    border: "1px dashed #374151",
                    borderRadius: 8,
                  }}
                >
                  No unassigned players
                </div>
              ) : (
                lobby.neutral.map((p) => (
                  <div
                    key={p.playerId}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: "#1e2130",
                      border:
                        p.playerId === lobby.yourPlayerId
                          ? "2px solid #6366f1"
                          : "1px solid #2d3148",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {p.name}
                    {p.playerId === lobby.yourPlayerId && (
                      <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 8 }}>
                        (you)
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
            {mySlot && (
              <Btn variant="ghost" onClick={() => assignSlot(null)} style={{ width: "100%" }}>
                Leave slot → return here
              </Btn>
            )}
          </section>

          {/* Black team */}
          <section
            style={{
              background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
              borderRadius: 12,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              border: "1px solid #334155",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 800,
                color: "#cbd5e1",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Black Team
            </h3>
            {(["black1", "black2"] as PlayerSlot[]).map((slot) => {
              const pid = lobby.slots[slot];
              const empty = !pid;
              const isYou = pid === lobby.yourPlayerId;
              return (
                <SlotCard
                  key={slot}
                  slot={slot}
                  label={slot === "black1" ? "Black 1" : "Black 2"}
                  occupantName={lobby.slotNames[slot]}
                  isYou={isYou}
                  empty={empty}
                  theme="black"
                  disabled={!empty && !isYou}
                  onClick={() => {
                    if (empty) assignSlot(slot);
                    else if (isYou) assignSlot(null);
                  }}
                />
              );
            })}
          </section>
        </div>

        <footer
          style={{
            flexShrink: 0,
            padding: 16,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Btn
            variant="ghost"
            onClick={() => {
              disconnect();
              onBack();
            }}
          >
            Leave lobby
          </Btn>
        </footer>
      </div>
    );
  }

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    background: "#0f1117",
    color: "#fff",
    fontFamily: "system-ui, sans-serif",
    padding: 24,
    boxSizing: "border-box",
  };

  if (lobbyPhase === "menu" || lobbyPhase === "creating") {
    return (
      <div style={containerStyle}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>👥</div>
        <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>
          2v2 Team Chess
        </h2>
        <p
          style={{
            color: "#9ca3af",
            fontSize: 13,
            margin: "0 0 24px",
            textAlign: "center",
            maxWidth: 380,
            lineHeight: 1.5,
          }}
        >
          Up to 4 players join a room, then each picks White 1, White 2, Black 1, or Black 2.
          The match starts automatically when every slot is filled.
        </p>
        <div
          style={{
            width: "100%",
            maxWidth: 380,
            background: "#1e2130",
            border: "1px solid #2d3148",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Btn onClick={handleCreate} disabled={!connected}>
              {connected
                ? lobbyPhase === "creating"
                  ? "Creating…"
                  : "Create Team Room"
                : "Connecting…"}
            </Btn>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={joinInput}
                onChange={(e) => {
                  setJoinInput(e.target.value.toUpperCase());
                  setJoinError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder="Room code"
                maxLength={6}
                style={{
                  flex: 1,
                  background: "#111827",
                  border: "1px solid #374151",
                  borderRadius: 8,
                  padding: "10px 12px",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: 2,
                  outline: "none",
                }}
              />
              <Btn onClick={handleJoin} disabled={!connected || !joinInput.trim()} variant="secondary">
                Join
              </Btn>
            </div>
            {joinError && (
              <p style={{ color: "#f87171", fontSize: 12, margin: 0 }}>{joinError}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          style={{
            marginTop: 20,
            background: "none",
            border: "none",
            color: "#6b7280",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          ← Back
        </button>
      </div>
    );
  }

  return null;
}
