import { useEffect, useState } from "react";
import type { Color, PieceType } from "../engine";
import { PIECE_UNICODE } from "../engine";
import type { AuctionPieceType } from "../augments";

export type AuctionState = {
  pieceType: AuctionPieceType;
  minBid: number;
  highBid: number;
  highBidder: Color | null;
  timerEndsAt: number;
  status: "active" | "resolved" | "skipped";
};

const PIECE_LABEL: Record<AuctionPieceType, string> = {
  P: "Pawn",
  N: "Knight",
  B: "Bishop",
  R: "Rook",
  Q: "Queen",
};

export function AuctionPanel({
  auction,
  myColor,
  myGold,
  onBid,
  placementPending,
}: {
  auction: AuctionState;
  myColor: Color;
  myGold: number;
  onBid: (amount: number) => void;
  placementPending?: boolean;
}) {
  const [secondsLeft, setSecondsLeft] = useState(20);

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.ceil((auction.timerEndsAt - Date.now()) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [auction.timerEndsAt]);

  const minNextBid = Math.max(
    auction.minBid,
    auction.highBid > 0 ? auction.highBid + 1 : auction.minBid,
  );
  const canBid = myGold >= minNextBid && !placementPending;

  const pieceType = auction.pieceType as PieceType;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 75,
        width: "min(420px, calc(100% - 24px))",
        background: "linear-gradient(160deg,#0f172a 0%,#1e1b4b 100%)",
        border: "1px solid rgba(245,158,11,0.45)",
        borderRadius: 14,
        padding: "14px 16px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.55),0 0 24px rgba(245,158,11,0.12)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>{PIECE_UNICODE.white[pieceType]}</span>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.12em",
                color: "#fbbf24",
                textTransform: "uppercase",
              }}
            >
              Mercenary Auction
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>
              {PIECE_LABEL[auction.pieceType]}
            </div>
          </div>
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: secondsLeft <= 5 ? "#f87171" : "#fde68a",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {secondsLeft}s
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "#94a3b8",
          marginBottom: 12,
        }}
      >
        <span>
          High bid:{" "}
          <strong style={{ color: "#f1f5f9" }}>
            {auction.highBid > 0 ? `${auction.highBid}g` : "—"}
          </strong>
        </span>
        <span>
          Leader:{" "}
          <strong style={{ color: "#f1f5f9" }}>
            {auction.highBidder
              ? auction.highBidder.toUpperCase()
              : "None"}
          </strong>
        </span>
        <span>
          Your gold: <strong style={{ color: "#4ade80" }}>{myGold}g</strong>
        </span>
      </div>

      {placementPending ? (
        <div
          style={{
            textAlign: "center",
            fontSize: 12,
            fontWeight: 700,
            color: "#86efac",
            padding: "8px 0",
          }}
        >
          You won! Click the board to place your mercenary.
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {[minNextBid, minNextBid + 5, minNextBid + 10, myGold]
            .filter((v, i, arr) => v >= minNextBid && v <= myGold && arr.indexOf(v) === i)
            .slice(0, 4)
            .map((amount) => (
              <button
                key={amount}
                type="button"
                disabled={!canBid || amount < minNextBid}
                onClick={() => onBid(amount)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid rgba(251,191,36,0.35)",
                  background: canBid ? "rgba(245,158,11,0.15)" : "rgba(30,41,59,0.8)",
                  color: canBid ? "#fde68a" : "#64748b",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: canBid ? "pointer" : "not-allowed",
                }}
              >
                Bid {amount}g
              </button>
            ))}
          {!canBid && myGold < minNextBid && (
            <span style={{ fontSize: 11, color: "#64748b", alignSelf: "center" }}>
              Need at least {minNextBid}g to bid
            </span>
          )}
        </div>
      )}

      {auction.highBidder && auction.highBidder !== myColor && !placementPending && (
        <div
          style={{
            marginTop: 10,
            textAlign: "center",
            fontSize: 11,
            color: "#64748b",
            fontStyle: "italic",
          }}
        >
          Outbid them before time runs out!
        </div>
      )}
    </div>
  );
}
