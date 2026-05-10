import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";

type Color = "white" | "black";

interface Player {
  ws: WebSocket;
  color: Color;
  ready: boolean;
  augmentId: string | null;
}

interface Room {
  id: string;
  players: Map<Color, Player>;
  gameStarted: boolean;
  createdAt: number;
}

const rooms = new Map<string, Room>();

function makeRoomId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function send(ws: WebSocket, msg: object) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function relay(room: Room, msg: object, from: Color) {
  for (const [col, player] of room.players) {
    if (col !== from) send(player.ws, msg);
  }
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/chess-ws" });

  wss.on("connection", (ws) => {
    let room: Room | null = null;
    let myColor: Color | null = null;

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 25000);

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        switch (msg.type) {
          case "create": {
            let id = makeRoomId();
            while (rooms.has(id)) id = makeRoomId();
            room = { id, players: new Map(), gameStarted: false, createdAt: Date.now() };
            myColor = "white";
            room.players.set("white", { ws, color: "white", ready: false, augmentId: null });
            rooms.set(id, room);
            send(ws, { type: "created", roomId: id, color: "white" });
            break;
          }
          case "join": {
            const r = rooms.get((msg.roomId || "").toUpperCase().trim());
            if (!r) { send(ws, { type: "error", msg: "Room not found. Check the code and try again." }); return; }
            if (r.players.has("black")) { send(ws, { type: "error", msg: "Room is full." }); return; }
            if (r.gameStarted) { send(ws, { type: "error", msg: "Game already started." }); return; }
            room = r;
            myColor = "black";
            r.players.set("black", { ws, color: "black", ready: false, augmentId: null });
            send(ws, { type: "joined", roomId: r.id, color: "black" });
            relay(r, { type: "opponent_joined" }, "black");
            break;
          }
          case "ready": {
            if (!room || !myColor) return;
            const player = room.players.get(myColor);
            if (!player) return;
            player.ready = true;
            player.augmentId = msg.augmentId ?? null;
            // Tell the other player what augment this player picked
            relay(room, { type: "opponent_augment", color: myColor, augmentId: msg.augmentId }, myColor);
            // Start if both ready
            const allReady = [...room.players.values()].length === 2 && [...room.players.values()].every(p => p.ready);
            if (allReady) {
              room.gameStarted = true;
              for (const [, p] of room.players) send(p.ws, { type: "start" });
            }
            break;
          }
          case "move": {
            if (!room || !myColor) return;
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
      if (room && myColor) {
        relay(room, { type: "opponent_left" }, myColor);
        room.players.delete(myColor);
        if (room.players.size === 0) rooms.delete(room.id);
      }
    });

    ws.on("error", () => {
      clearInterval(heartbeat);
    });
  });

  // Clean up stale empty rooms every 2 hours
  setInterval(() => {
    const now = Date.now();
    for (const [id, r] of rooms) {
      if (now - r.createdAt > 7_200_000 && r.players.size === 0) rooms.delete(id);
    }
  }, 3_600_000);
}
