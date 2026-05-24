import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";

type Color = "white" | "black";
type PlayerSlot = "white1" | "white2" | "black1" | "black2";
type PlayerKey = Color | PlayerSlot;
type RoomMode = "1v1" | "2v2";

const DISCONNECT_GRACE_MS = 45_000;

const WHITE_SLOTS: PlayerSlot[] = ["white1", "white2"];
const BLACK_SLOTS: PlayerSlot[] = ["black1", "black2"];

interface Player {
  key: PlayerKey;
  team: Color;
  ws: WebSocket | null;
  ready: boolean;
  augmentId: string | null;
  sessionToken: string;
  leaveTimer: ReturnType<typeof setTimeout> | null;
}

interface Room {
  id: string;
  mode: RoomMode;
  players: Map<PlayerKey, Player>;
  gameStarted: boolean;
  createdAt: number;
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

function relay(room: Room, msg: object, from: PlayerKey) {
  for (const [key, player] of Array.from(room.players.entries())) {
    if (key === from) continue;
    send(player.ws, msg);
  }
}

function clearPlayerLeaveTimer(player: Player) {
  if (player.leaveTimer) {
    clearTimeout(player.leaveTimer);
    player.leaveTimer = null;
  }
}

function countTeam(room: Room, team: Color): number {
  let n = 0;
  for (const p of Array.from(room.players.values())) {
    if (p.team === team) n++;
  }
  return n;
}

function assignTeamSlot(room: Room, team: Color): PlayerSlot | null {
  const slots = team === "white" ? WHITE_SLOTS : BLACK_SLOTS;
  for (const s of slots) {
    if (!room.players.has(s)) return s;
  }
  return null;
}

function tryStartGame(r: Room) {
  if (r.gameStarted) return;
  const needed = r.mode === "2v2" ? 4 : 2;
  const allReady =
    r.players.size === needed &&
    Array.from(r.players.values()).every(
      (p) => p.ready && p.ws && p.ws.readyState === WebSocket.OPEN,
    );
  if (allReady) {
    r.gameStarted = true;
    for (const [, p] of Array.from(r.players.entries())) send(p.ws, { type: "start" });
  }
}

function slotToTeam(slot: PlayerSlot): Color {
  return slot.startsWith("white") ? "white" : "black";
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
    let myKey: PlayerKey | null = null;

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 20_000);

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        switch (msg.type) {
          case "create": {
            const mode: RoomMode = msg.mode === "2v2" ? "2v2" : "1v1";
            let id = makeRoomId();
            while (rooms.has(id)) id = makeRoomId();
            room = {
              id,
              mode,
              players: new Map(),
              gameStarted: false,
              createdAt: Date.now(),
              lastSnapshot: null,
            };
            const sessionToken = makeSessionToken();

            if (mode === "2v2") {
              myKey = "white1";
              room.players.set("white1", {
                key: "white1",
                team: "white",
                ws,
                ready: false,
                augmentId: null,
                sessionToken,
                leaveTimer: null,
              });
              rooms.set(id, room);
              send(ws, {
                type: "created",
                roomId: id,
                mode: "2v2",
                slot: "white1",
                color: "white",
                sessionToken,
              });
            } else {
              myKey = "white";
              room.players.set("white", {
                key: "white",
                team: "white",
                ws,
                ready: false,
                augmentId: null,
                sessionToken,
                leaveTimer: null,
              });
              rooms.set(id, room);
              send(ws, {
                type: "created",
                roomId: id,
                mode: "1v1",
                color: "white",
                sessionToken,
              });
            }
            break;
          }
          case "join": {
            const r = rooms.get((msg.roomId || "").toUpperCase().trim());
            if (!r) {
              send(ws, { type: "error", msg: "Room not found. Check the code and try again." });
              return;
            }
            if (r.gameStarted) {
              send(ws, { type: "error", msg: "Game already started." });
              return;
            }

            if (r.mode === "2v2") {
              const team = msg.team === "black" ? "black" : "white";
              if (countTeam(r, team) >= 2) {
                send(ws, { type: "error", msg: `Team ${team} is full.` });
                return;
              }
              const slot = assignTeamSlot(r, team);
              if (!slot) {
                send(ws, { type: "error", msg: "Room is full." });
                return;
              }
              for (const [, p] of Array.from(r.players.entries())) clearPlayerLeaveTimer(p);

              room = r;
              myKey = slot;
              const sessionToken = makeSessionToken();
              r.players.set(slot, {
                key: slot,
                team,
                ws,
                ready: false,
                augmentId: null,
                sessionToken,
                leaveTimer: null,
              });
              const roster = Array.from(r.players.keys());
              send(ws, {
                type: "joined",
                roomId: r.id,
                mode: "2v2",
                slot,
                color: team,
                sessionToken,
                roster,
              });
              relay(
                r,
                { type: "player_joined", slot, team, roster },
                slot,
              );
            } else {
              if (r.players.has("black")) {
                send(ws, { type: "error", msg: "Room is full." });
                return;
              }
              const host = r.players.get("white");
              if (host) clearPlayerLeaveTimer(host);

              room = r;
              myKey = "black";
              const sessionToken = makeSessionToken();
              r.players.set("black", {
                key: "black",
                team: "black",
                ws,
                ready: false,
                augmentId: null,
                sessionToken,
                leaveTimer: null,
              });
              send(ws, {
                type: "joined",
                roomId: r.id,
                mode: "1v1",
                color: "black",
                sessionToken,
              });
              relay(r, { type: "opponent_joined" }, "black");
            }
            break;
          }
          case "resume": {
            const rid = (msg.roomId || "").toUpperCase().trim();
            const token = String(msg.sessionToken || "").trim();
            const r = rooms.get(rid);
            if (!r) {
              send(ws, { type: "error", msg: "Could not resume — room no longer exists." });
              return;
            }

            let key: PlayerKey | null = null;
            if (r.mode === "2v2") {
              const slot = msg.slot as PlayerSlot;
              if (
                slot !== "white1" &&
                slot !== "white2" &&
                slot !== "black1" &&
                slot !== "black2"
              ) {
                send(ws, { type: "error", msg: "Could not resume — room no longer exists." });
                return;
              }
              key = slot;
            } else {
              const col = msg.color as Color;
              if (col !== "white" && col !== "black") {
                send(ws, { type: "error", msg: "Could not resume — room no longer exists." });
                return;
              }
              key = col;
            }

            const p = r.players.get(key);
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
            myKey = key;
            send(ws, {
              type: "resumed",
              roomId: r.id,
              mode: r.mode,
              ...(r.mode === "2v2"
                ? { slot: key, color: slotToTeam(key as PlayerSlot) }
                : { color: key }),
              gameStarted: r.gameStarted,
            });
            if (r.gameStarted && r.lastSnapshot) {
              send(ws, { type: "move", snapshot: r.lastSnapshot });
            }
            tryStartGame(r);
            break;
          }
          case "ready": {
            if (!room || !myKey) return;
            const player = room.players.get(myKey);
            if (!player || player.ws !== ws) return;
            player.ready = true;
            player.augmentId = msg.augmentId ?? null;
            if (room.mode === "1v1") {
              relay(
                room,
                { type: "opponent_augment", color: myKey, augmentId: msg.augmentId },
                myKey,
              );
            } else {
              relay(room, { type: "player_ready", slot: myKey }, myKey);
            }
            tryStartGame(room);
            break;
          }
          case "move": {
            if (!room || !myKey) return;
            const player = room.players.get(myKey);
            if (!player || player.ws !== ws) return;
            const snap = msg.snapshot;
            if (snap && typeof snap === "object")
              room.lastSnapshot = snap as Record<string, unknown>;
            relay(room, { type: "move", snapshot: msg.snapshot }, myKey);
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
      if (!room || !myKey) return;
      const leavingRoom = room;
      const leavingKey = myKey;
      const player = leavingRoom.players.get(leavingKey);
      if (!player || player.ws !== ws) return;

      player.ws = null;
      clearPlayerLeaveTimer(player);
      player.leaveTimer = setTimeout(() => {
        player.leaveTimer = null;
        relay(leavingRoom, { type: "opponent_left", slot: leavingKey }, leavingKey);
        leavingRoom.players.delete(leavingKey);
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
