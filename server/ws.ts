import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";

type Color = "white" | "black";

const DISCONNECT_GRACE_MS = 45_000;

interface Player {
  color: Color;
  /** Null while disconnected but still within grace period (may resume). */
  ws: WebSocket | null;
  ready: boolean;
  augmentId: string | null;
  sessionToken: string;
  leaveTimer: ReturnType<typeof setTimeout> | null;
}

interface Room {
  id: string;
  players: Map<Color, Player>;
  gameStarted: boolean;
  createdAt: number;
  /** Latest full game snapshot from either side — used to resync after reconnect. */
  lastSnapshot: Record<string, unknown> | null;
}

const rooms = new Map<string, Room>();

function makeRoomId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function makeSessionToken(): string {
  const chars = "0123456789abcdef";
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function send(ws: WebSocket | null, msg: object) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function relay(room: Room, msg: object, from: Color) {
  for (const [col, player] of Array.from(room.players.entries())) {
    if (col === from) continue;
    send(player.ws, msg);
  }
}

function clearPlayerLeaveTimer(player: Player) {
  if (player.leaveTimer) {
    clearTimeout(player.leaveTimer);
    player.leaveTimer = null;
  }
}

/** When both players are ready and connected, transition to in-game and notify clients. */
function tryStartGame(r: Room) {
  if (r.gameStarted) return;
  const allReady =
    r.players.size === 2 &&
    Array.from(r.players.values()).every((p) => p.ready && p.ws && p.ws.readyState === WebSocket.OPEN);
  if (allReady) {
    r.gameStarted = true;
    for (const [, p] of Array.from(r.players.entries())) send(p.ws, { type: "start" });
  }
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({
    server,
    path: "/chess-ws",
    perMessageDeflate: false,
    clientTracking: true,
  });

  wss.on("connection", (ws) => {
    let room: Room | null = null;
    let myColor: Color | null = null;

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 20_000);

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        switch (msg.type) {
          case "create": {
            let id = makeRoomId();
            while (rooms.has(id)) id = makeRoomId();
            room = {
              id,
              players: new Map(),
              gameStarted: false,
              createdAt: Date.now(),
              lastSnapshot: null,
            };
            myColor = "white";
            const sessionToken = makeSessionToken();
            room.players.set("white", {
              color: "white",
              ws,
              ready: false,
              augmentId: null,
              sessionToken,
              leaveTimer: null,
            });
            rooms.set(id, room);
            send(ws, { type: "created", roomId: id, color: "white", sessionToken });
            break;
          }
          case "join": {
            const r = rooms.get((msg.roomId || "").toUpperCase().trim());
            if (!r) {
              send(ws, { type: "error", msg: "Room not found. Check the code and try again." });
              return;
            }
            if (r.players.has("black")) {
              send(ws, { type: "error", msg: "Room is full." });
              return;
            }
            if (r.gameStarted) {
              send(ws, { type: "error", msg: "Game already started." });
              return;
            }
            const host = r.players.get("white");
            if (host) clearPlayerLeaveTimer(host);

            room = r;
            myColor = "black";
            const sessionToken = makeSessionToken();
            r.players.set("black", {
              color: "black",
              ws,
              ready: false,
              augmentId: null,
              sessionToken,
              leaveTimer: null,
            });
            send(ws, { type: "joined", roomId: r.id, color: "black", sessionToken });
            relay(r, { type: "opponent_joined" }, "black");
            break;
          }
          case "resume": {
            const rid = (msg.roomId || "").toUpperCase().trim();
            const col = msg.color as Color;
            const token = String(msg.sessionToken || "").trim();
            const r = rooms.get(rid);
            if (!r || (col !== "white" && col !== "black")) {
              send(ws, { type: "error", msg: "Could not resume — room no longer exists." });
              return;
            }
            const p = r.players.get(col);
            if (!p || p.sessionToken !== token) {
              send(ws, { type: "error", msg: "Could not resume — session expired." });
              return;
            }
            if (p.ws && p.ws.readyState === WebSocket.OPEN) {
              send(ws, { type: "error", msg: "Already connected from another tab." });
              ws.close();
              return;
            }
            clearPlayerLeaveTimer(p);
            p.ws = ws;
            room = r;
            myColor = col;
            send(ws, {
              type: "resumed",
              roomId: r.id,
              color: col,
              gameStarted: r.gameStarted,
            });
            if (r.gameStarted && r.lastSnapshot) {
              send(ws, { type: "move", snapshot: r.lastSnapshot });
            }
            tryStartGame(r);
            break;
          }
          case "ready": {
            if (!room || !myColor) return;
            const player = room.players.get(myColor);
            if (!player || player.ws !== ws) return;
            player.ready = true;
            player.augmentId = msg.augmentId ?? null;
            relay(room, { type: "opponent_augment", color: myColor, augmentId: msg.augmentId }, myColor);
            tryStartGame(room);
            break;
          }
          case "move": {
            if (!room || !myColor) return;
            const player = room.players.get(myColor);
            if (!player || player.ws !== ws) return;
            const snap = msg.snapshot;
            if (snap && typeof snap === "object") room.lastSnapshot = snap as Record<string, unknown>;
            relay(room, { type: "move", snapshot: msg.snapshot }, myColor);
            break;
          }
          case "ping":
            send(ws, { type: "pong" });
            break;
        }
      } catch (e) {
        console.error("WS parse error:", e);
      }
    });

    ws.on("close", () => {
      clearInterval(heartbeat);
      if (!room || !myColor) return;
      const leavingRoom = room;
      const leavingColor = myColor;
      const player = leavingRoom.players.get(leavingColor);
      if (!player || player.ws !== ws) return;

      player.ws = null;
      clearPlayerLeaveTimer(player);
      player.leaveTimer = setTimeout(() => {
        player.leaveTimer = null;
        relay(leavingRoom, { type: "opponent_left" }, leavingColor);
        leavingRoom.players.delete(leavingColor);
        if (leavingRoom.players.size === 0) rooms.delete(leavingRoom.id);
      }, DISCONNECT_GRACE_MS);
    });

    ws.on("error", () => {
      clearInterval(heartbeat);
    });
  });

  setInterval(() => {
    const now = Date.now();
    for (const [id, r] of Array.from(rooms.entries())) {
      if (now - r.createdAt > 7_200_000 && r.players.size === 0) rooms.delete(id);
    }
  }, 3_600_000);
}
