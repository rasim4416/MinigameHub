import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { randomBytes } from "crypto";

type Color = "white" | "black";
type PlayerSlot = "white1" | "white2" | "black1" | "black2";
type PlayerKey = Color | PlayerSlot;
type RoomMode = "1v1" | "2v2";

const DISCONNECT_GRACE_MS = 45_000;
const ALL_TEAM_SLOTS: PlayerSlot[] = ["white1", "white2", "black1", "black2"];

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

interface TeamPlayer {
  playerId: string;
  ws: WebSocket | null;
  sessionToken: string;
  assignedSlot: PlayerSlot | null;
  leaveTimer: ReturnType<typeof setTimeout> | null;
}

interface Room {
  id: string;
  mode: RoomMode;
  /** 1v1 */
  players: Map<PlayerKey, Player>;
  /** 2v2 lobby + in-game connections */
  teamPlayers?: Map<string, TeamPlayer>;
  teamSlots?: Record<PlayerSlot, string | null>;
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
  return randomBytes(16).toString("hex");
}

function makePlayerId(): string {
  return `p_${randomBytes(6).toString("hex")}`;
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

function relayTeam(room: Room, msg: object, fromPlayerId: string) {
  if (!room.teamPlayers) return;
  for (const [id, player] of Array.from(room.teamPlayers.entries())) {
    if (id === fromPlayerId) continue;
    send(player.ws, msg);
  }
}

function clearPlayerLeaveTimer(player: { leaveTimer: ReturnType<typeof setTimeout> | null }) {
  if (player.leaveTimer) {
    clearTimeout(player.leaveTimer);
    player.leaveTimer = null;
  }
}

function emptyTeamSlots(): Record<PlayerSlot, string | null> {
  return { white1: null, white2: null, black1: null, black2: null };
}

function playerDisplayName(playerId: string, index: number): string {
  return `Player ${index + 1}`;
}

function buildLobbyPayload(room: Room, yourPlayerId?: string) {
  const slots = room.teamSlots ?? emptyTeamSlots();
  const teamPlayers = room.teamPlayers ?? new Map();
  const order = Array.from(teamPlayers.keys());

  const slotNames: Record<PlayerSlot, string | null> = {
    white1: null,
    white2: null,
    black1: null,
    black2: null,
  };
  for (const slot of ALL_TEAM_SLOTS) {
    const pid = slots[slot];
    if (!pid) continue;
    const ord = order.indexOf(pid);
    slotNames[slot] =
      pid === yourPlayerId ? "You" : playerDisplayName(pid, ord >= 0 ? ord : 0);
  }

  const neutral = order
    .filter((id) => !teamPlayers.get(id)?.assignedSlot)
    .map((id) => ({
      playerId: id,
      name:
        id === yourPlayerId ? "You" : playerDisplayName(id, order.indexOf(id)),
    }));

  return {
    type: "lobby_state",
    roomId: room.id,
    slots,
    slotNames,
    neutral,
    playerCount: teamPlayers.size,
    yourPlayerId,
    gameStarted: room.gameStarted,
  };
}

function broadcastLobby(room: Room) {
  if (!room.teamPlayers) return;
  for (const [id, p] of Array.from(room.teamPlayers.entries())) {
    send(p.ws, buildLobbyPayload(room, id));
  }
}

function slotToTeam(slot: PlayerSlot): Color {
  return slot.startsWith("white") ? "white" : "black";
}

function tryStart1v1(r: Room) {
  if (r.gameStarted || r.mode !== "1v1") return;
  const allReady =
    r.players.size === 2 &&
    Array.from(r.players.values()).every(
      (p) => p.ready && p.ws && p.ws.readyState === WebSocket.OPEN,
    );
  if (allReady) {
    r.gameStarted = true;
    for (const [, p] of Array.from(r.players.entries())) send(p.ws, { type: "start" });
  }
}

function tryStart2v2(r: Room) {
  if (r.gameStarted || r.mode !== "2v2" || !r.teamPlayers || !r.teamSlots) return;
  if (r.teamPlayers.size !== 4) return;
  const allFilled = ALL_TEAM_SLOTS.every((s) => r.teamSlots![s] !== null);
  if (!allFilled) return;
  const allConnected = Array.from(r.teamPlayers.values()).every(
    (p) => p.ws && p.ws.readyState === WebSocket.OPEN,
  );
  if (!allConnected) return;

  r.gameStarted = true;
  for (const [, p] of Array.from(r.teamPlayers.entries())) {
    if (!p.assignedSlot) continue;
    send(p.ws, {
      type: "start",
      slot: p.assignedSlot,
      color: slotToTeam(p.assignedSlot),
    });
  }
}

function removeTeamPlayer(room: Room, playerId: string) {
  if (!room.teamPlayers || !room.teamSlots) return;
  const p = room.teamPlayers.get(playerId);
  if (p?.assignedSlot) {
    room.teamSlots[p.assignedSlot] = null;
  }
  room.teamPlayers.delete(playerId);
}

function init2v2Room(id: string): Room {
  return {
    id,
    mode: "2v2",
    players: new Map(),
    teamPlayers: new Map(),
    teamSlots: emptyTeamSlots(),
    gameStarted: false,
    createdAt: Date.now(),
    lastSnapshot: null,
  };
}

function addTeamPlayer(room: Room, ws: WebSocket): TeamPlayer {
  const playerId = makePlayerId();
  const sessionToken = makeSessionToken();
  const player: TeamPlayer = {
    playerId,
    ws,
    sessionToken,
    assignedSlot: null,
    leaveTimer: null,
  };
  room.teamPlayers!.set(playerId, player);
  return player;
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
    let myPlayerId: string | null = null;

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

            if (mode === "2v2") {
              room = init2v2Room(id);
              const player = addTeamPlayer(room, ws);
              myPlayerId = player.playerId;
              rooms.set(id, room);
              send(ws, {
                type: "created",
                roomId: id,
                mode: "2v2",
                playerId: player.playerId,
                sessionToken: player.sessionToken,
                ...buildLobbyPayload(room, player.playerId),
              });
              broadcastLobby(room);
            } else {
              room = {
                id,
                mode: "1v1",
                players: new Map(),
                gameStarted: false,
                createdAt: Date.now(),
                lastSnapshot: null,
              };
              myKey = "white";
              const sessionToken = makeSessionToken();
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
              if (!r.teamPlayers || r.teamPlayers.size >= 4) {
                send(ws, { type: "error", msg: "Room is full (4 players max)." });
                return;
              }
              for (const [, p] of Array.from(r.teamPlayers.entries())) {
                clearPlayerLeaveTimer(p);
              }

              room = r;
              const player = addTeamPlayer(r, ws);
              myPlayerId = player.playerId;
              send(ws, {
                type: "joined",
                roomId: r.id,
                mode: "2v2",
                playerId: player.playerId,
                sessionToken: player.sessionToken,
                ...buildLobbyPayload(r, player.playerId),
              });
              broadcastLobby(r);
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
          case "assign_slot": {
            if (!room || room.mode !== "2v2" || !myPlayerId || !room.teamPlayers || !room.teamSlots) {
              return;
            }
            if (room.gameStarted) {
              send(ws, { type: "error", msg: "Game already started." });
              return;
            }
            const player = room.teamPlayers.get(myPlayerId);
            if (!player || player.ws !== ws) return;

            const target = msg.slot as PlayerSlot | null | undefined;
            const wantNeutral = target === null || target === undefined;

            if (wantNeutral) {
              if (player.assignedSlot) {
                room.teamSlots[player.assignedSlot] = null;
                player.assignedSlot = null;
              }
            } else {
              if (
                target !== "white1" &&
                target !== "white2" &&
                target !== "black1" &&
                target !== "black2"
              ) {
                return;
              }
              const occupant = room.teamSlots[target];
              if (occupant && occupant !== myPlayerId) {
                send(ws, { type: "error", msg: "That slot is already taken." });
                return;
              }
              if (player.assignedSlot) {
                room.teamSlots[player.assignedSlot] = null;
              }
              room.teamSlots[target] = myPlayerId;
              player.assignedSlot = target;
            }

            broadcastLobby(room);
            tryStart2v2(room);
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

            if (r.mode === "2v2") {
              const playerId = String(msg.playerId || msg.slot || "").trim();
              if (!playerId || !r.teamPlayers) {
                send(ws, { type: "error", msg: "Could not resume — session expired." });
                return;
              }
              const p = r.teamPlayers.get(playerId);
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
              myPlayerId = playerId;
              send(ws, {
                type: "resumed",
                roomId: r.id,
                mode: "2v2",
                playerId,
                slot: p.assignedSlot,
                color: p.assignedSlot ? slotToTeam(p.assignedSlot) : null,
                gameStarted: r.gameStarted,
                ...buildLobbyPayload(r, playerId),
              });
              if (r.gameStarted && r.lastSnapshot) {
                send(ws, { type: "move", snapshot: r.lastSnapshot });
              } else {
                broadcastLobby(r);
              }
              tryStart2v2(r);
            } else {
              const col = msg.color as Color;
              if (col !== "white" && col !== "black") {
                send(ws, { type: "error", msg: "Could not resume — room no longer exists." });
                return;
              }
              const key = col;
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
              myKey = col;
              send(ws, {
                type: "resumed",
                roomId: r.id,
                mode: "1v1",
                color: col,
                gameStarted: r.gameStarted,
              });
              if (r.gameStarted && r.lastSnapshot) {
                send(ws, { type: "move", snapshot: r.lastSnapshot });
              }
              tryStart1v1(r);
            }
            break;
          }
          case "ready": {
            if (!room || room.mode !== "1v1" || !myKey) return;
            const player = room.players.get(myKey);
            if (!player || player.ws !== ws) return;
            player.ready = true;
            player.augmentId = msg.augmentId ?? null;
            relay(
              room,
              { type: "opponent_augment", color: myKey, augmentId: msg.augmentId },
              myKey,
            );
            tryStart1v1(room);
            break;
          }
          case "move": {
            if (!room) return;
            if (room.mode === "2v2") {
              if (!myPlayerId || !room.teamPlayers) return;
              const player = room.teamPlayers.get(myPlayerId);
              if (!player || player.ws !== ws) return;
              const snap = msg.snapshot;
              if (snap && typeof snap === "object")
                room.lastSnapshot = snap as Record<string, unknown>;
              relayTeam(room, { type: "move", snapshot: msg.snapshot }, myPlayerId);
            } else {
              if (!myKey) return;
              const player = room.players.get(myKey);
              if (!player || player.ws !== ws) return;
              const snap = msg.snapshot;
              if (snap && typeof snap === "object")
                room.lastSnapshot = snap as Record<string, unknown>;
              relay(room, { type: "move", snapshot: msg.snapshot }, myKey);
            }
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
      if (!room) return;

      if (room.mode === "2v2" && myPlayerId && room.teamPlayers) {
        const leavingId = myPlayerId;
        const player = room.teamPlayers.get(leavingId);
        if (!player || player.ws !== ws) return;

        player.ws = null;
        clearPlayerLeaveTimer(player);
        player.leaveTimer = setTimeout(() => {
          player.leaveTimer = null;
          const r = rooms.get(room!.id);
          if (!r?.teamPlayers) return;
          removeTeamPlayer(r, leavingId);
          if (r.teamPlayers.size === 0) {
            rooms.delete(r.id);
          } else {
            relayTeam(r, { type: "opponent_left", playerId: leavingId }, leavingId);
            if (!r.gameStarted) broadcastLobby(r);
          }
        }, DISCONNECT_GRACE_MS);
        return;
      }

      if (!myKey) return;
      const leavingRoom = room;
      const leavingKey = myKey;
      const player = leavingRoom.players.get(leavingKey);
      if (!player || player.ws !== ws) return;

      player.ws = null;
      clearPlayerLeaveTimer(player);
      player.leaveTimer = setTimeout(() => {
        player.leaveTimer = null;
        relay(leavingRoom, { type: "opponent_left" }, leavingKey);
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
      const empty =
        r.mode === "2v2"
          ? (r.teamPlayers?.size ?? 0) === 0
          : r.players.size === 0;
      if (now - r.createdAt > 7_200_000 && empty) rooms.delete(id);
    }
  }, 3_600_000);
}
