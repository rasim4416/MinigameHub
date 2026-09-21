import type { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";

function broadcastOnlineCount(wss: WebSocketServer) {
  const count = wss.clients.size;
  const payload = JSON.stringify({ type: "online_count", count });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

/** Site-wide presence: one socket ≈ one open tab. Separate from /chess-ws. */
export function setupPresence(server: Server) {
  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
    clientTracking: true,
  });

  server.on("upgrade", (request, socket, head) => {
    if (request.url?.split("?")[0] !== "/presence-ws") return;
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws) => {
    broadcastOnlineCount(wss);

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 20_000);

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.type === "ping" && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch {
        // ignore malformed frames
      }
    });

    ws.on("close", () => {
      clearInterval(heartbeat);
      broadcastOnlineCount(wss);
    });

    ws.on("error", () => {
      clearInterval(heartbeat);
    });
  });
}
