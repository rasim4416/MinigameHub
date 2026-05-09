import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChessState, PieceType, Color,
  PIECE_UNICODE, PIECE_VALUE,
  createInitialState, getLegalMoves, makeMove,
  isInCheck, materialAdvantage, opp,
} from "./engine";

// ─── Sub-components ───────────────────────────────────────────────────────────

const LIGHT_SQ = "#f0d9b5";
const DARK_SQ  = "#b58863";
const SEL_LIGHT  = "#f6f669";
const SEL_DARK   = "#baca2b";
const LAST_LIGHT = "#cdd16f";
const LAST_DARK  = "#aaa23a";

function SquareEl({
  row, col, size, piece, isSelected, isValidMove, isLastMove, isCheckKing,
  onClick,
}: {
  row: number; col: number; size: number;
  piece: { type: PieceType; color: Color } | null;
  isSelected: boolean; isValidMove: boolean; isLastMove: boolean; isCheckKing: boolean;
  onClick: () => void;
}) {
  const light = (row + col) % 2 === 0;
  let bg = light ? LIGHT_SQ : DARK_SQ;
  if (isCheckKing) bg = "#c82020";
  else if (isSelected) bg = light ? SEL_LIGHT : SEL_DARK;
  else if (isLastMove) bg = light ? LAST_LIGHT : LAST_DARK;

  const dotSize = size * 0.3;
  const ringPad = size * 0.07;

  return (
    <div
      onClick={onClick}
      style={{
        width: size, height: size,
        backgroundColor: bg,
        position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
        transition: "background-color 0.1s",
      }}
    >
      {/* Rank label — left edge, col 0 */}
      {col === 0 && (
        <span style={{
          position: "absolute", top: 2, left: 3,
          fontSize: Math.max(9, size * 0.18), fontWeight: 700,
          color: light ? DARK_SQ : LIGHT_SQ,
          userSelect: "none", lineHeight: 1,
        }}>
          {8 - row}
        </span>
      )}
      {/* File label — bottom edge, row 7 */}
      {row === 7 && (
        <span style={{
          position: "absolute", bottom: 2, right: 3,
          fontSize: Math.max(9, size * 0.18), fontWeight: 700,
          color: light ? DARK_SQ : LIGHT_SQ,
          userSelect: "none", lineHeight: 1,
        }}>
          {String.fromCharCode(97 + col)}
        </span>
      )}
      {/* Valid-move dot (empty square) */}
      {isValidMove && !piece && (
        <div style={{
          width: dotSize, height: dotSize,
          borderRadius: "50%",
          backgroundColor: "rgba(0,0,0,0.22)",
          pointerEvents: "none",
        }} />
      )}
      {/* Valid-move ring (capture square) */}
      {isValidMove && piece && (
        <div style={{
          position: "absolute",
          inset: ringPad,
          borderRadius: "50%",
          border: `${Math.max(3, size * 0.07)}px solid rgba(0,0,0,0.28)`,
          pointerEvents: "none",
        }} />
      )}
      {/* Piece */}
      {piece && (
        <span
          style={{
            fontSize: size * 0.72,
            lineHeight: 1,
            color: piece.color === "white" ? "#ffffff" : "#1a0f00",
            textShadow: piece.color === "white"
              ? "0 0 3px #000, 0 0 6px #000, 1px 1px 0 #222"
              : "0 0 3px rgba(255,255,255,0.7), 1px 1px 0 rgba(255,255,255,0.5)",
            userSelect: "none",
            pointerEvents: "none",
          }}
        >
          {PIECE_UNICODE[piece.color][piece.type]}
        </span>
      )}
    </div>
  );
}

function CapturedRow({ pieces, byColor, advantage }: {
  pieces: PieceType[]; byColor: Color; advantage: number;
}) {
  // Sort by value descending for display
  const sorted = [...pieces].sort((a, b) => PIECE_VALUE[b] - PIECE_VALUE[a]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
      {sorted.map((t, i) => (
        <span key={i} style={{
          fontSize: 16, lineHeight: 1,
          color: byColor === "white" ? "#fff" : "#1a0f00",
          textShadow: byColor === "white"
            ? "0 0 2px #000, 0 0 4px #000"
            : "0 0 2px rgba(255,255,255,0.6)",
        }}>
          {PIECE_UNICODE[byColor][t]}
        </span>
      ))}
      {advantage > 0 && (
        <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600, marginLeft: 2 }}>
          +{advantage}
        </span>
      )}
    </div>
  );
}

function PromotionDialog({ color, onChoose }: { color: Color; onChoose: (t: PieceType) => void }) {
  const pieces: PieceType[] = ["Q", "R", "B", "N"];
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#1f2937", border: "1px solid #374151",
        borderRadius: 14, padding: "18px 24px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
        boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
      }}>
        <p style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 14, margin: 0 }}>
          Promote Pawn
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          {pieces.map(t => (
            <button
              key={t}
              onClick={() => onChoose(t)}
              style={{
                width: 56, height: 56, borderRadius: 10,
                background: "#111827", border: "2px solid #4b5563",
                cursor: "pointer", fontSize: 32, lineHeight: 1,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: color === "white" ? "#ffffff" : "#1a0f00",
                textShadow: color === "white"
                  ? "0 0 3px #000, 0 0 6px #000"
                  : "0 0 3px rgba(255,255,255,0.7)",
                transition: "border-color 0.15s, background 0.15s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#6366f1";
                (e.currentTarget as HTMLButtonElement).style.background = "#1e1b4b";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#4b5563";
                (e.currentTarget as HTMLButtonElement).style.background = "#111827";
              }}
            >
              {PIECE_UNICODE[color][t]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChessGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardPx, setBoardPx] = useState(320);

  const [game, setGame] = useState<ChessState>(createInitialState);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [validMoves, setValidMoves] = useState<[number, number][]>([]);
  const [promotionPending, setPromotionPending] = useState<{
    from: [number, number]; to: [number, number];
  } | null>(null);

  // Responsive board size
  useEffect(() => {
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBoardPx(Math.floor(Math.min(width - 4, height - 4) / 8) * 8);
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const sqSize = boardPx / 8;

  const handleSquareClick = useCallback((r: number, c: number) => {
    if (game.status === "checkmate" || game.status === "stalemate") return;
    if (promotionPending) return;

    const piece = game.board[r][c];

    // If a piece is selected, try to move
    if (selected) {
      const isValid = validMoves.some(([vr, vc]) => vr === r && vc === c);
      if (isValid) {
        const movingPiece = game.board[selected[0]][selected[1]]!;
        const isPromotion =
          movingPiece.type === "P" &&
          ((movingPiece.color === "white" && r === 0) ||
           (movingPiece.color === "black" && r === 7));

        if (isPromotion) {
          setPromotionPending({ from: selected, to: [r, c] });
        } else {
          setGame(g => makeMove(g, selected, [r, c]));
          setSelected(null);
          setValidMoves([]);
        }
        return;
      }

      // Clicking own piece — re-select
      if (piece && piece.color === game.turn) {
        setSelected([r, c]);
        setValidMoves(getLegalMoves(game, r, c));
        return;
      }

      // Clicking elsewhere — deselect
      setSelected(null);
      setValidMoves([]);
      return;
    }

    // Nothing selected yet — select a piece
    if (piece && piece.color === game.turn) {
      setSelected([r, c]);
      setValidMoves(getLegalMoves(game, r, c));
    }
  }, [game, selected, validMoves, promotionPending]);

  const handlePromotion = useCallback((type: PieceType) => {
    if (!promotionPending) return;
    setGame(g => makeMove(g, promotionPending.from, promotionPending.to, type));
    setPromotionPending(null);
    setSelected(null);
    setValidMoves([]);
  }, [promotionPending]);

  const resetGame = () => {
    setGame(createInitialState());
    setSelected(null);
    setValidMoves([]);
    setPromotionPending(null);
  };

  const adv = materialAdvantage(game);

  // Status text
  const statusText = (() => {
    if (game.status === "checkmate") {
      const winner = opp(game.turn);
      return { label: `${winner.toUpperCase()} WINS  ·  Checkmate`, color: "#4ade80" };
    }
    if (game.status === "stalemate")
      return { label: "DRAW  ·  Stalemate", color: "#94a3b8" };
    if (game.status === "check")
      return { label: `${game.turn.toUpperCase()}  ·  CHECK!`, color: "#f87171" };
    return { label: `${game.turn.toUpperCase()}'S TURN`, color: "#e2e8f0" };
  })();

  const isOver = game.status === "checkmate" || game.status === "stalemate";

  return (
    <div style={{
      display: "flex", flexDirection: "column", width: "100%", height: "100%",
      background: "#030712", color: "#fff", userSelect: "none", overflow: "hidden",
    }}>
      {/* ── Black's info bar ── */}
      <div style={{
        flexShrink: 0, height: 44,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 12px",
        background: "#0a0f1a",
        borderBottom: "1px solid #1f2937",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: "#1a0f00",
            border: "2px solid #6b7280",
            boxShadow: game.turn === "black" && !isOver ? "0 0 0 2px #6366f1" : "none",
          }} />
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: game.turn === "black" && !isOver ? "#e2e8f0" : "#6b7280",
          }}>
            BLACK
          </span>
          <CapturedRow
            pieces={game.capturedByBlack}
            byColor="white"
            advantage={adv.black > 0 ? adv.black : 0}
          />
        </div>
        <button
          onClick={resetGame}
          style={{
            padding: "4px 12px", fontSize: 11, fontWeight: 700,
            borderRadius: 6, border: "1px solid #374151",
            background: "#111827", color: "#9ca3af", cursor: "pointer",
          }}
        >
          New Game
        </button>
      </div>

      {/* ── Board area ── */}
      <div
        ref={containerRef}
        style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          padding: 6, minHeight: 0, position: "relative",
          background: "#030712",
        }}
      >
        {/* Board */}
        <div style={{
          width: boardPx, height: boardPx,
          display: "grid",
          gridTemplateColumns: `repeat(8, ${sqSize}px)`,
          gridTemplateRows: `repeat(8, ${sqSize}px)`,
          border: "3px solid #5c3d1e",
          borderRadius: 2,
          boxShadow: "0 8px 40px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.5)",
          flexShrink: 0,
        }}>
          {Array.from({ length: 8 }, (_, r) =>
            Array.from({ length: 8 }, (_, c) => {
              const piece = game.board[r][c];
              const isSel = selected?.[0] === r && selected?.[1] === c;
              const isVM  = validMoves.some(([vr, vc]) => vr === r && vc === c);
              const isLM  = !!(game.lastMove &&
                ((game.lastMove.from[0] === r && game.lastMove.from[1] === c) ||
                 (game.lastMove.to[0]   === r && game.lastMove.to[1]   === c)));
              const isCK  = !!(piece?.type === "K" &&
                piece.color === game.turn &&
                (game.status === "check" || game.status === "checkmate"));
              return (
                <SquareEl
                  key={`${r}-${c}`}
                  row={r} col={c} size={sqSize}
                  piece={piece}
                  isSelected={isSel}
                  isValidMove={isVM}
                  isLastMove={isLM}
                  isCheckKing={isCK}
                  onClick={() => handleSquareClick(r, c)}
                />
              );
            })
          )}
        </div>

        {/* Promotion overlay */}
        {promotionPending && (
          <PromotionDialog
            color={game.turn}
            onChoose={handlePromotion}
          />
        )}

        {/* Game-over overlay */}
        {isOver && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            <div style={{
              background: "#111827",
              border: "1px solid #374151",
              borderRadius: 14,
              padding: "20px 36px",
              display: "flex", flexDirection: "column",
              alignItems: "center", gap: 10,
              boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
              pointerEvents: "auto",
            }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: statusText.color, letterSpacing: "0.04em" }}>
                {statusText.label}
              </span>
              <button onClick={resetGame} style={{
                padding: "8px 28px", fontSize: 14, fontWeight: 700,
                borderRadius: 10, border: "none", cursor: "pointer",
                background: "linear-gradient(135deg,#4f46e5,#6366f1)",
                color: "#fff",
                boxShadow: "0 3px 12px rgba(99,102,241,0.5)",
              }}>
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── White's info bar ── */}
      <div style={{
        flexShrink: 0, height: 44,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 12px",
        background: "#0a0f1a",
        borderTop: "1px solid #1f2937",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: "#ffffff",
            border: "2px solid #6b7280",
            boxShadow: game.turn === "white" && !isOver ? "0 0 0 2px #6366f1" : "none",
          }} />
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: game.turn === "white" && !isOver ? "#e2e8f0" : "#6b7280",
          }}>
            WHITE
          </span>
          <CapturedRow
            pieces={game.capturedByWhite}
            byColor="black"
            advantage={adv.white > 0 ? adv.white : 0}
          />
        </div>
        {/* Status pill */}
        {!isOver && (
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
            color: statusText.color,
            background: game.status === "check" ? "rgba(239,68,68,0.15)" : "transparent",
            padding: game.status === "check" ? "3px 10px" : "0",
            borderRadius: 20,
            border: game.status === "check" ? "1px solid rgba(239,68,68,0.4)" : "none",
          }}>
            {statusText.label}
          </div>
        )}
      </div>
    </div>
  );
}
