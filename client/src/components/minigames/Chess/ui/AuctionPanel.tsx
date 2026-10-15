import { useEffect, useState } from "react";
import type { Color, PieceType } from "../engine";
import { PIECE_UNICODE } from "../engine";
import type { AuctionPieceType } from "../augments";
import {
  AUCTION_DURATION_MS,
  isOutOfAuction,
  minNextBid,
  type AuctionSide,
} from "../auctionRules";
import "./chess-ui.css";

export type AuctionState = {
  pieceType: AuctionPieceType;
  minBid: number;
  highBid: number;
  highBidder: Color | null;
  timerEndsAt: number;
  status: "active" | "resolved" | "skipped";
  /** Sides that folded since the last bid; a new bid clears it. */
  passed?: AuctionSide[];
};

export const AUCTION_PIECE_LABEL: Record<AuctionPieceType, string> = {
  P: "Pawn",
  N: "Knight",
  B: "Bishop",
  R: "Rook",
  Q: "Queen",
};

const LOT_TITLE: Record<AuctionPieceType, string> = {
  P: "Pawn Star",
  N: "Knight Shift",
  B: "Bishop Bargain",
  R: "Rook-Bottom Price",
  Q: "Queen of the Market",
};

const LOT_TAGLINE: Record<AuctionPieceType, string> = {
  P: "Small piece, big promotion potential.",
  N: "Hops in, no questions asked.",
  B: "Diagonally the best deal in town.",
  R: "Castle not included.",
  Q: "She's expensive. She's worth it.",
};

function bidOptions(min: number, gold: number): { amount: number; label: string }[] {
  const raw = [
    { amount: min, label: `${min}g` },
    { amount: min + 5, label: `+5 · ${min + 5}g` },
    { amount: min + 15, label: `+15 · ${min + 15}g` },
    { amount: gold, label: `All in · ${gold}g` },
  ];
  const seen = new Set<number>();
  return raw.filter((o) => {
    if (o.amount < min || o.amount > gold || seen.has(o.amount)) return false;
    seen.add(o.amount);
    return true;
  });
}

function SideRow({
  side,
  name,
  gold,
  auction,
  controllable,
  onBid,
  onPass,
}: {
  side: AuctionSide;
  name: string;
  gold: number;
  auction: AuctionState;
  controllable: boolean;
  onBid: (amount: number) => void;
  onPass: () => void;
}) {
  const leading = auction.highBidder === side;
  const passed = !leading && (auction.passed ?? []).includes(side);
  const broke = !leading && !passed && isOutOfAuction(auction, side, gold);
  const min = minNextBid(auction);
  const status = leading
    ? "Leading"
    : passed
      ? "Passed"
      : broke
        ? `Needs ${min}g`
        : controllable
          ? "Your call"
          : "Deciding…";

  return (
    <div className={`ca-side${leading ? " ca-side--leading" : ""}${passed || broke ? " ca-side--out" : ""}`}>
      <div className="ca-side__who">
        <span className={`ca-side__dot ca-side__dot--${side}`} aria-hidden />
        <span className="ca-side__name">{name}</span>
        <span className="ca-side__gold">{gold}g</span>
        <span className={`ca-side__status${leading ? " ca-side__status--lead" : ""}`}>{status}</span>
      </div>
      {controllable && !leading && !passed && !broke && (
        <div className="ca-side__bids">
          {bidOptions(min, gold).map((o) => (
            <button
              key={o.amount}
              type="button"
              className={`ca-bid${o.amount === gold && o.amount > min ? " ca-bid--allin" : ""}`}
              onClick={() => onBid(o.amount)}
            >
              {o.label}
            </button>
          ))}
          <button type="button" className="ca-bid ca-bid--pass" onClick={onPass}>
            Pass
          </button>
        </div>
      )}
    </div>
  );
}

export function AuctionPanel({
  auction,
  controllableSides,
  sideNames,
  goldWhite,
  goldBlack,
  onBid,
  onPass,
  paused = false,
}: {
  auction: AuctionState;
  /** Sides this client can bid for (both in hot-seat play). */
  controllableSides: AuctionSide[];
  sideNames: Record<AuctionSide, string>;
  goldWhite: number;
  goldBlack: number;
  onBid: (amount: number, side: AuctionSide) => void;
  onPass: (side: AuctionSide) => void;
  paused?: boolean;
}) {
  const [msLeft, setMsLeft] = useState(AUCTION_DURATION_MS);

  useEffect(() => {
    const tick = () => setMsLeft(Math.max(0, auction.timerEndsAt - Date.now()));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [auction.timerEndsAt]);

  const pieceType = auction.pieceType as PieceType;
  const seconds = Math.ceil(msLeft / 1000);
  const fraction = Math.min(1, msLeft / AUCTION_DURATION_MS);
  const urgent = !paused && seconds <= 5;
  const R = 22;
  const C = 2 * Math.PI * R;
  const leaderName = auction.highBidder
    ? sideNames[auction.highBidder as AuctionSide]
    : null;

  return (
    <div className="ca-wrap" role="dialog" aria-label="Mercenary auction">
      <div className="ca">
        <div className="ca__head">
          <div className="ca__lot">
            <span className="ca__spot" aria-hidden />
            <span className="ca__piece">{PIECE_UNICODE.white[pieceType]}</span>
          </div>
          <div className="ca__titles">
            <span className="ca__kicker">Mercenary auction · {AUCTION_PIECE_LABEL[auction.pieceType]}</span>
            <span className="ca__title">{LOT_TITLE[auction.pieceType]}</span>
            <span className="ca__tagline">{LOT_TAGLINE[auction.pieceType]}</span>
          </div>
          <div className={`ca__timer${urgent ? " ca__timer--urgent" : ""}`} aria-label={`${seconds} seconds left`}>
            <svg viewBox="0 0 52 52" aria-hidden>
              <circle cx="26" cy="26" r={R} className="ca__timer-track" />
              <circle
                cx="26"
                cy="26"
                r={R}
                className="ca__timer-fill"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - fraction)}
              />
            </svg>
            <span>{paused ? "❚❚" : seconds}</span>
          </div>
        </div>

        <div className="ca__board">
          <div className="ca__stat">
            <span className="ca__stat-label">Current bid</span>
            <span key={auction.highBid} className="ca__stat-value ca__stat-value--bump">
              {auction.highBid > 0 ? `${auction.highBid}g` : "—"}
            </span>
          </div>
          <div className="ca__stat">
            <span className="ca__stat-label">Top dog</span>
            <span className="ca__stat-value ca__stat-value--name">{leaderName ?? "Nobody yet"}</span>
          </div>
          <div className="ca__stat">
            <span className="ca__stat-label">Opening</span>
            <span className="ca__stat-value ca__stat-value--muted">{auction.minBid}g</span>
          </div>
        </div>

        <div className="ca__sides">
          {(["white", "black"] as const).map((side) => (
            <SideRow
              key={side}
              side={side}
              name={sideNames[side]}
              gold={side === "white" ? goldWhite : goldBlack}
              auction={auction}
              controllable={controllableSides.includes(side)}
              onBid={(amount) => onBid(amount, side)}
              onPass={() => onPass(side)}
            />
          ))}
        </div>

        <p className="ca__foot">
          {paused
            ? "Hammer on hold while the table is busy."
            : "Bids reset the clock to at least 8s. Gold is only paid if you win."}
        </p>
      </div>
    </div>
  );
}
