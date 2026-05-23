import { useState } from "react";
import ChessGame from "./ChessGame";
import MultiplayerChess from "./MultiplayerChess";

type Mode = "local" | "online";

export default function ChessHub() {
  const [mode, setMode] = useState<Mode | null>(null);

  if (mode === "local") return <ChessGame />;
  if (mode === "online") return <MultiplayerChess onBack={() => setMode(null)} />;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      width: "100%", height: "100%", background: "#0f1117", color: "#fff", fontFamily: "sans-serif",
      gap: 20,
    }}>
      <div style={{ fontSize: 48 }}>♟️</div>
      <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Chess Roguelike</h2>
      <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>Choose your game mode</p>
      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
        <button
          onClick={() => setMode("local")}
          style={{
            background: "#1e2130", border: "2px solid #374151", borderRadius: 12,
            padding: "20px 32px", cursor: "pointer", color: "#fff", fontSize: 15,
            fontWeight: 600, display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            transition: "border-color 0.2s",
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "#6366f1")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "#374151")}
        >
          <span style={{ fontSize: 32 }}>🖥️</span>
          Local Game
          <span style={{ color: "#6b7280", fontSize: 12, fontWeight: 400 }}>Same device, 2 players</span>
        </button>
        <button
          onClick={() => setMode("online")}
          style={{
            background: "#1e2130", border: "2px solid #374151", borderRadius: 12,
            padding: "20px 32px", cursor: "pointer", color: "#fff", fontSize: 15,
            fontWeight: 600, display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            transition: "border-color 0.2s",
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "#6366f1")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "#374151")}
        >
          <span style={{ fontSize: 32 }}>🌐</span>
          Online Multiplayer
          <span style={{ color: "#6b7280", fontSize: 12, fontWeight: 400 }}>Play with a friend online</span>
        </button>
      </div>
    </div>
  );
}
