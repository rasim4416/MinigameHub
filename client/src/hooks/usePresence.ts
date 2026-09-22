import { useEffect, useState } from "react";

const RECONNECT_BASE_MS = 800;
const RECONNECT_MAX_MS = 12_000;

function presenceUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/presence-ws`;
}

/** Live tab count from /presence-ws. One open tab ≈ one online. */
export function usePresence(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let attempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    const clearPing = () => {
      if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
      }
    };

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(presenceUrl());

      ws.onopen = () => {
        attempt = 0;
        clearPing();
        pingTimer = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 25_000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data));
          if (msg?.type === "online_count" && typeof msg.count === "number") {
            setCount(msg.count);
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        clearPing();
        if (closed) return;
        const delay = Math.min(
          RECONNECT_MAX_MS,
          RECONNECT_BASE_MS * 2 ** attempt,
        );
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearPing();
      ws?.close();
    };
  }, []);

  return count;
}
