import { useState } from "react";
import type { Language } from "../../../lib/language";
import { LANGUAGES } from "../../../lib/language";
import ChessGame from "./ChessGame";
import MultiplayerChess from "./MultiplayerChess";
import TeamMultiplayerChess from "./TeamMultiplayerChess";
import { ChessLanguageProvider } from "./ChessLanguageContext";

type Mode = "local" | "online" | "team2v2";

function LanguageToggle({
  language,
  onChange,
}: {
  language: Language;
  onChange: (lang: Language) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: 4,
      }}
    >
      <span style={{ color: "#6b7280", fontSize: 12 }}>Augments / Events:</span>
      <div
        style={{
          display: "flex",
          borderRadius: 6,
          overflow: "hidden",
          border: "1px solid #374151",
        }}
      >
        {LANGUAGES.map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => onChange(lang)}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
              background:
                lang === language
                  ? lang === "english"
                    ? "#2563eb"
                    : "#dc2626"
                  : "#111827",
              color: lang === language ? "#fff" : "#9ca3af",
            }}
          >
            {lang === "english" ? "EN" : "TR"}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChessHub() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [language, setLanguage] = useState<Language>("english");

  return (
    <ChessLanguageProvider language={language}>
      {mode === "local" && <ChessGame />}
      {mode === "online" && (
        <MultiplayerChess onBack={() => setMode(null)} />
      )}
      {mode === "team2v2" && (
        <TeamMultiplayerChess onBack={() => setMode(null)} />
      )}
      {mode === null && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            background: "#0f1117",
            color: "#fff",
            fontFamily: "sans-serif",
            gap: 20,
          }}
        >
          <div style={{ fontSize: 48 }}>♟️</div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
            Chess Roguelike
          </h2>
          <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>
            Choose your game mode
          </p>
          <LanguageToggle language={language} onChange={setLanguage} />
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 8,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <button
              onClick={() => setMode("local")}
              style={{
                background: "#1e2130",
                border: "2px solid #374151",
                borderRadius: 12,
                padding: "20px 32px",
                cursor: "pointer",
                color: "#fff",
                fontSize: 15,
                fontWeight: 600,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                transition: "border-color 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = "#6366f1")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = "#374151")
              }
            >
              <span style={{ fontSize: 32 }}>🖥️</span>
              Local Game
              <span
                style={{ color: "#6b7280", fontSize: 12, fontWeight: 400 }}
              >
                Same device, 2 players
              </span>
            </button>
            <button
              onClick={() => setMode("online")}
              style={{
                background: "#1e2130",
                border: "2px solid #374151",
                borderRadius: 12,
                padding: "20px 32px",
                cursor: "pointer",
                color: "#fff",
                fontSize: 15,
                fontWeight: 600,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                transition: "border-color 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = "#6366f1")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = "#374151")
              }
            >
              <span style={{ fontSize: 32 }}>🌐</span>
              Online Multiplayer
              <span
                style={{ color: "#6b7280", fontSize: 12, fontWeight: 400 }}
              >
                Play with a friend online
              </span>
            </button>
            <button
              onClick={() => setMode("team2v2")}
              style={{
                background: "#1e2130",
                border: "2px solid #374151",
                borderRadius: 12,
                padding: "20px 32px",
                cursor: "pointer",
                color: "#fff",
                fontSize: 15,
                fontWeight: 600,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                transition: "border-color 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = "#6366f1")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = "#374151")
              }
            >
              <span style={{ fontSize: 32 }}>👥</span>
              2v2 Team
              <span
                style={{ color: "#6b7280", fontSize: 12, fontWeight: 400 }}
              >
                4 players · 16×8 board
              </span>
            </button>
          </div>
        </div>
      )}
    </ChessLanguageProvider>
  );
}
