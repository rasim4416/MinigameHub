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

const EMPTY_SLOTS: Record<PlayerSlot, string | null> = {
  white1: null,
  white2: null,
  black1: null,
  black2: null,
};

function emptyLobbyState(yourPlayerId = ""): LobbyState {
  return {
    slots: { ...EMPTY_SLOTS },
    slotNames: { ...EMPTY_SLOTS },
    neutral: [],
    playerCount: 0,
    yourPlayerId,
  };
}

function useTeamChessSocket(onMessage: (msg: WsMsg) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const closingIntentionallyRef = useRef(false);
  const resumeSessionRef = useRef<ResumeSession | null>(null);
  const resumeEnabledRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const pingIntervalRef = useRef<number | null>(null);
  const pendingSendRef = useRef<object[]>([]);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const [connected, setConnected] = useState(false);
  const [connectionLost, setConnectionLost] = useState(false);

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
      } else {
        for (const msg of pendingSendRef.current) {
          ws.send(JSON.stringify(msg));
        }
        pendingSendRef.current = [];
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
        onMessageRef.current(JSON.parse(e.data) as WsMsg);
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
    pendingSendRef.current = [];
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
    if (w?.readyState === WebSocket.OPEN) {
      w.send(JSON.stringify(msg));
      return true;
    }
    pendingSendRef.current.push(msg);
    return false;
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
    connect,
    disconnect,
    send,
    setResumeSession,
    setResumeEnabled,
    clearConnectionLost,
  };
}

function parseLobbyState(msg: WsMsg): LobbyState | null {
  const rawSlots = msg.slots;
  const slots: Record<PlayerSlot, string | null> =
    rawSlots && typeof rawSlots === "object"
      ? {
          white1: (rawSlots as Record<string, string | null>).white1 ?? null,
          white2: (rawSlots as Record<string, string | null>).white2 ?? null,
          black1: (rawSlots as Record<string, string | null>).black1 ?? null,
          black2: (rawSlots as Record<string, string | null>).black2 ?? null,
        }
      : { ...EMPTY_SLOTS };
  const rawNames = msg.slotNames;
  const slotNames: Record<PlayerSlot, string | null> =
    rawNames && typeof rawNames === "object"
      ? {
          white1: (rawNames as Record<string, string | null>).white1 ?? null,
          white2: (rawNames as Record<string, string | null>).white2 ?? null,
          black1: (rawNames as Record<string, string | null>).black1 ?? null,
          black2: (rawNames as Record<string, string | null>).black2 ?? null,
        }
      : { ...EMPTY_SLOTS };
  const neutral = Array.isArray(msg.neutral)
    ? (msg.neutral as LobbyNeutralPlayer[])
    : [];
  return {
    slots,
    slotNames,
    neutral,
    playerCount: typeof msg.playerCount === "number" ? msg.playerCount : 0,
    yourPlayerId: String(msg.yourPlayerId ?? msg.playerId ?? ""),
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

  const shellStyle: React.CSSProperties = {
    width: "100%",
    minHeight: "min(720px, 85vh)",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    background: "#0f1117",
    color: "#fff",
    fontFamily: "system-ui, sans-serif",
    boxSizing: "border-box",
  };

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    width: "100%",
    padding: 24,
    boxSizing: "border-box",
  };

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

  const wsHandlerRef = useRef<(msg: WsMsg) => void>(() => {});

  const {
    connected,
    connectionLost,
    connect,
    disconnect,
    send,
    setResumeSession,
    setResumeEnabled,
    clearConnectionLost,
  } = useTeamChessSocket((msg) => wsHandlerRef.current(msg));

  wsHandlerRef.current = (msg: WsMsg) => {
    switch (msg.type) {
      case "created":
      case "joined":
      case "lobby_state": {
        applyLobby(msg);
        if (msg.type === "created" || msg.type === "joined") {
          setRoomId(String(msg.roomId ?? ""));
          setMyPlayerId(String(msg.playerId ?? msg.yourPlayerId ?? ""));
          const token = String(msg.sessionToken ?? "");
          setSessionToken(token);
          if (token && msg.roomId) {
            setResumeSession({
              roomId: String(msg.roomId),
              playerId: String(msg.playerId ?? msg.yourPlayerId),
              sessionToken: token,
            });
            setResumeEnabled(true);
          }
        } else if (msg.type === "lobby_state") {
          if (msg.roomId) setRoomId(String(msg.roomId));
          const yid = String(msg.yourPlayerId ?? "");
          if (yid) setMyPlayerId((prev) => prev || yid);
        }
        setLobbyPhase((phase) => (phase === "playing" ? "playing" : "lobby"));
        break;
      }
      case "resumed":
        clearConnectionLost();
        applyLobby(msg);
        if (msg.roomId) setRoomId(String(msg.roomId));
        if (msg.gameStarted && msg.slot) {
          setMySlot(msg.slot as PlayerSlot);
          setMyColor(slotToColor(msg.slot as PlayerSlot));
        }
        setLobbyPhase(msg.gameStarted ? "playing" : "lobby");
        break;
      case "start": {
        const slot = msg.slot as PlayerSlot;
        setMySlot(slot);
        setMyColor(slotToColor(slot));
        setLobbyPhase("playing");
        break;
      }
      case "move":
        clearConnectionLost();
        setIncomingSnapshot({
          ...(msg.snapshot as Record<string, unknown>),
          _ts: Date.now(),
        });
        break;
      case "opponent_left":
        setResumeEnabled(false);
        setResumeSession(null);
        setOpponentLeft(true);
        setLobbyPhase("opponent_left");
        break;
      case "error":
        setJoinError(String(msg.msg ?? ""));
        setLobbyPhase((phase) => (phase === "creating" ? "menu" : phase));
        if (/resume|session|not exist/i.test(String(msg.msg))) {
          setResumeEnabled(false);
          setResumeSession(null);
        }
        break;
    }
  };

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const handleCreate = () => {
    setJoinError("");
    send({ type: "create", mode: "2v2" });
    setLobbyPhase("creating");
  };

  const handleJoin = () => {
    if (!joinInput.trim()) return;
    setJoinError("");
    send({ type: "join", roomId: joinInput.trim().toUpperCase() });
    setLobbyPhase("creating");
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
    return (
      <div style={shellStyle}>
        <ChessGame mpConfig={mpConfig} />
      </div>
    );
  }

  const lobbyView = lobby ?? emptyLobbyState(myPlayerId);

  const filledSlots = TEAM_SLOTS.filter((s) => lobbyView.slots[s] !== null).length;
  const canStart = lobbyView.playerCount === 4 && filledSlots === 4;

  if (lobbyPhase === "creating") {
    return (
      <div style={shellStyle}>
        <div style={containerStyle}>
          <p style={{ color: "#9ca3af", fontSize: 14 }}>Creating room…</p>
        </div>
      </div>
    );
  }

  if (lobbyPhase === "lobby") {
    return (
      <div style={{ ...shellStyle, overflow: "auto" }}>
        {!lobby && (
          <div style={{ ...containerStyle, padding: "12px 24px" }}>
            <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>Loading lobby…</p>
          </div>
        )}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
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
              <strong style={{ color: "#e2e8f0" }}>{lobbyView.playerCount}/4</strong>
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
              const pid = lobbyView.slots[slot];
              const empty = !pid;
              const isYou = pid === lobbyView.yourPlayerId;
              return (
                <SlotCard
                  key={slot}
                  slot={slot}
                  label={slot === "white1" ? "White 1" : "White 2"}
                  occupantName={lobbyView.slotNames[slot]}
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
              {lobbyView.neutral.length === 0 ? (
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
                lobbyView.neutral.map((p) => (
                  <div
                    key={p.playerId}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: "#1e2130",
                      border:
                        p.playerId === lobbyView.yourPlayerId
                          ? "2px solid #6366f1"
                          : "1px solid #2d3148",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {p.name}
                    {p.playerId === lobbyView.yourPlayerId && (
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
              const pid = lobbyView.slots[slot];
              const empty = !pid;
              const isYou = pid === lobbyView.yourPlayerId;
              return (
                <SlotCard
                  key={slot}
                  slot={slot}
                  label={slot === "black1" ? "Black 1" : "Black 2"}
                  occupantName={lobbyView.slotNames[slot]}
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
      </div>
    );
  }

  if (lobbyPhase === "opponent_left") {
    return (
      <div style={shellStyle}>
        <div style={containerStyle}>
          <p style={{ color: "#f87171", marginBottom: 16 }}>A player left the match.</p>
          <Btn
            onClick={() => {
              disconnect();
              onBack();
            }}
          >
            Back to menu
          </Btn>
        </div>
      </div>
    );
  }

  if (lobbyPhase === "menu") {
    return (
      <div style={shellStyle}>
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
              {connected ? "Create Team Room" : "Connecting…"}
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
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <div style={containerStyle}>
        <p style={{ color: "#9ca3af", fontSize: 14 }}>Connecting…</p>
      </div>
    </div>
  );
}
