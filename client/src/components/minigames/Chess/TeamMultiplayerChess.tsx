import { useState, useEffect, useRef, useCallback } from "react";
import ChessGame, { MpConfig } from "./ChessGame";
import type { PlayerSlot } from "./engine";
import { slotToColor } from "./engine";

type LobbyPhase =
  | "menu"
  | "creating"
  | "waiting_players"
  | "lobby_ready"
  | "playing"
  | "opponent_left";

type TeamColor = "white" | "black";

interface WsMsg {
  type: string;
  [key: string]: unknown;
}

interface ResumeSession {
  roomId: string;
  slot: PlayerSlot;
  color: TeamColor;
  sessionToken: string;
}

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
            slot: cred.slot,
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

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "#1e2130",
        border: "1px solid #2d3148",
        borderRadius: 12,
        padding: 24,
        ...style,
      }}
    >
      {children}
    </div>
  );
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
  variant?: "primary" | "secondary" | "danger";
  style?: React.CSSProperties;
}) {
  const bg =
    variant === "primary"
      ? "#6366f1"
      : variant === "danger"
        ? "#dc2626"
        : "#374151";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? "#374151" : bg,
        color: "#fff",
        border: "none",
        borderRadius: 8,
        padding: "10px 20px",
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

const SLOT_LABEL: Record<PlayerSlot, string> = {
  white1: "White · Left army",
  white2: "White · Right army (blue dot)",
  black1: "Black · Left army",
  black2: "Black · Right army (blue dot)",
};

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
  const [joinTeam, setJoinTeam] = useState<TeamColor>("white");
  const [joinError, setJoinError] = useState("");
  const [mySlot, setMySlot] = useState<PlayerSlot>("white1");
  const [myColor, setMyColor] = useState<TeamColor>("white");
  const [roster, setRoster] = useState<PlayerSlot[]>([]);
  const [readySlots, setReadySlots] = useState<Set<PlayerSlot>>(new Set());
  const [iAmReady, setIAmReady] = useState(false);
  const [incomingSnapshot, setIncomingSnapshot] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [opponentLeft, setOpponentLeft] = useState(false);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  useEffect(() => {
    if (!lastMsg) return;
    switch (lastMsg.type) {
      case "created": {
        const rid = lastMsg.roomId as string;
        const slot = lastMsg.slot as PlayerSlot;
        const token = String(lastMsg.sessionToken ?? "");
        setRoomId(rid);
        setMySlot(slot);
        setMyColor("white");
        setRoster([slot]);
        if (token) {
          setResumeSession({ roomId: rid, slot, color: "white", sessionToken: token });
          setResumeEnabled(true);
        }
        setLobbyPhase("waiting_players");
        break;
      }
      case "joined": {
        const rid = lastMsg.roomId as string;
        const slot = lastMsg.slot as PlayerSlot;
        const team = (lastMsg.color as TeamColor) ?? slotToColor(slot);
        const token = String(lastMsg.sessionToken ?? "");
        setRoomId(rid);
        setMySlot(slot);
        setMyColor(team);
        if (Array.isArray(lastMsg.roster)) {
          setRoster(lastMsg.roster as PlayerSlot[]);
        } else {
          setRoster((prev) => (prev.includes(slot) ? prev : [...prev, slot]));
        }
        if (token) {
          setResumeSession({
            roomId: rid,
            slot,
            color: team,
            sessionToken: token,
          });
          setResumeEnabled(true);
        }
        setLobbyPhase("waiting_players");
        break;
      }
      case "player_joined": {
        if (Array.isArray(lastMsg.roster)) {
          setRoster(lastMsg.roster as PlayerSlot[]);
        } else {
          const slot = lastMsg.slot as PlayerSlot;
          setRoster((prev) => (prev.includes(slot) ? prev : [...prev, slot]));
        }
        break;
      }
      case "player_ready": {
        const slot = lastMsg.slot as PlayerSlot;
        setReadySlots((prev) => new Set([...prev, slot]));
        break;
      }
      case "resumed":
        clearConnectionLost();
        break;
      case "start":
        setLobbyPhase("playing");
        break;
      case "move": {
        clearConnectionLost();
        setIncomingSnapshot({
          ...(lastMsg.snapshot as Record<string, unknown>),
          _ts: Date.now(),
        });
        break;
      }
      case "opponent_left":
        setResumeEnabled(false);
        setResumeSession(null);
        setOpponentLeft(true);
        break;
      case "error": {
        setJoinError(String(lastMsg.msg ?? ""));
        if (/resume|session|not exist/i.test(String(lastMsg.msg))) {
          setResumeEnabled(false);
          setResumeSession(null);
        }
        break;
      }
    }
  }, [lastMsg, setResumeSession, setResumeEnabled, clearConnectionLost]);

  const playerCount = roster.length;
  const allReady = readySlots.size >= 4 && playerCount >= 4;

  const handleCreate = () => {
    setJoinError("");
    send({ type: "create", mode: "2v2" });
    setLobbyPhase("creating");
  };

  const handleJoin = () => {
    if (!joinInput.trim()) return;
    setJoinError("");
    send({
      type: "join",
      roomId: joinInput.trim().toUpperCase(),
      team: joinTeam,
    });
  };

  const handleReady = () => {
    setIAmReady(true);
    send({ type: "ready" });
    setReadySlots((prev) => new Set([...prev, mySlot]));
    if (playerCount >= 4) setLobbyPhase("lobby_ready");
  };

  const handleSnapshot = useCallback(
    (snap: Record<string, unknown>) => {
      send({ type: "move", snapshot: snap });
    },
    [send],
  );

  const mpConfig: MpConfig | undefined =
    lobbyPhase === "playing"
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

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    background: "#0f1117",
    color: "#fff",
    fontFamily: "sans-serif",
    padding: 24,
    boxSizing: "border-box",
  };

  if (lobbyPhase === "menu") {
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
            maxWidth: 360,
          }}
        >
          16×8 board · two full armies per team · pick White or Black when joining
        </p>
        <Card style={{ width: "100%", maxWidth: 380 }}>
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
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn
                variant={joinTeam === "white" ? "primary" : "secondary"}
                onClick={() => setJoinTeam("white")}
                style={{ flex: 1 }}
              >
                Join White
              </Btn>
              <Btn
                variant={joinTeam === "black" ? "primary" : "secondary"}
                onClick={() => setJoinTeam("black")}
                style={{ flex: 1 }}
              >
                Join Black
              </Btn>
            </div>
            <Btn
              onClick={handleJoin}
              disabled={!connected || !joinInput.trim()}
              variant="secondary"
            >
              Join with selected team
            </Btn>
            {joinError && (
              <p style={{ color: "#f87171", fontSize: 12, margin: 0 }}>{joinError}</p>
            )}
          </div>
        </Card>
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

  if (
    lobbyPhase === "creating" ||
    lobbyPhase === "waiting_players" ||
    lobbyPhase === "lobby_ready"
  ) {
    return (
      <div style={containerStyle}>
        <p style={{ color: "#9ca3af", fontSize: 13, margin: "0 0 8px" }}>
          Room code
        </p>
        <div
          style={{
            fontSize: 36,
            fontWeight: 800,
            letterSpacing: 8,
            marginBottom: 16,
          }}
        >
          {roomId}
        </div>
        <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 20px" }}>
          Players {playerCount}/4 · You are {SLOT_LABEL[mySlot]}
        </p>
        <Card style={{ width: "100%", maxWidth: 340, marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(["white1", "white2", "black1", "black2"] as PlayerSlot[]).map(
              (s) => (
                <div
                  key={s}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    color: roster.includes(s) ? "#e2e8f0" : "#4b5563",
                  }}
                >
                  <span>{SLOT_LABEL[s]}</span>
                  <span>
                    {!roster.includes(s)
                      ? "—"
                      : readySlots.has(s)
                        ? "Ready"
                        : s === mySlot && iAmReady
                          ? "Ready"
                          : "Joined"}
                  </span>
                </div>
              ),
            )}
          </div>
        </Card>
        {!iAmReady ? (
          <Btn onClick={handleReady} disabled={!connected}>
            I&apos;m Ready
          </Btn>
        ) : (
          <p style={{ color: "#9ca3af", fontSize: 13 }}>
            {allReady ? "Starting…" : "Waiting for other players…"}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            disconnect();
            onBack();
          }}
          style={{
            marginTop: 24,
            background: "none",
            border: "none",
            color: "#6b7280",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return null;
}
