import type { CSSProperties } from "react";
import type { Card, Rank } from "../blackjackEngine";
import { RED_SUITS } from "../blackjackEngine";

/** Pip coordinates in percent of the pip area, mirroring a real card face. */
const PIP_LAYOUT: Partial<Record<Rank, [number, number][]>> = {
  "2": [[50, 0], [50, 100]],
  "3": [[50, 0], [50, 50], [50, 100]],
  "4": [[0, 0], [100, 0], [0, 100], [100, 100]],
  "5": [[0, 0], [100, 0], [50, 50], [0, 100], [100, 100]],
  "6": [[0, 0], [100, 0], [0, 50], [100, 50], [0, 100], [100, 100]],
  "7": [[0, 0], [100, 0], [50, 25], [0, 50], [100, 50], [0, 100], [100, 100]],
  "8": [[0, 0], [100, 0], [50, 25], [0, 50], [100, 50], [50, 75], [0, 100], [100, 100]],
  "9": [[0, 0], [100, 0], [0, 33.3], [100, 33.3], [50, 50], [0, 66.7], [100, 66.7], [0, 100], [100, 100]],
  "10": [[0, 0], [100, 0], [50, 16.7], [0, 33.3], [100, 33.3], [0, 66.7], [100, 66.7], [50, 83.3], [0, 100], [100, 100]],
};

const COURT: Partial<Record<Rank, { glyph: string; title: string }>> = {
  J: { glyph: "♞", title: "Jack" },
  Q: { glyph: "♛", title: "Queen" },
  K: { glyph: "♚", title: "King" },
};

const SUIT_NAME: Record<Card["suit"], string> = {
  "♠": "spades",
  "♥": "hearts",
  "♦": "diamonds",
  "♣": "clubs",
};

function Corner({ card, flipped = false }: { card: Card; flipped?: boolean }) {
  return (
    <div className={`bj-card__corner${flipped ? " bj-card__corner--br" : " bj-card__corner--tl"}`}>
      <span className="bj-card__rank">{card.rank}</span>
      <span className="bj-card__suit">{card.suit}</span>
    </div>
  );
}

function CardFront({ card }: { card: Card }) {
  const red = RED_SUITS.has(card.suit);
  const pips = PIP_LAYOUT[card.rank];
  const court = COURT[card.rank];
  return (
    <div className={`bj-card__face bj-card__face--front${red ? " bj-card__face--red" : ""}`}>
      <Corner card={card} />
      <Corner card={card} flipped />

      {card.rank === "A" && (
        <div className="bj-card__ace">
          <span className="bj-card__ace-ring" aria-hidden />
          <span className="bj-card__ace-suit">{card.suit}</span>
        </div>
      )}

      {pips && (
        <div className="bj-card__pips">
          {pips.map(([x, y], i) => (
            <span
              key={i}
              className={`bj-card__pip${y > 50 ? " bj-card__pip--flipped" : ""}`}
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {card.suit}
            </span>
          ))}
        </div>
      )}

      {court && (
        <div className="bj-card__court" title={court.title}>
          <span className="bj-card__court-half">
            <span className="bj-card__court-glyph">{court.glyph}</span>
            <span className="bj-card__court-suit">{card.suit}</span>
          </span>
          <span className="bj-card__court-half bj-card__court-half--flipped">
            <span className="bj-card__court-glyph">{court.glyph}</span>
            <span className="bj-card__court-suit">{card.suit}</span>
          </span>
        </div>
      )}

      <span className="bj-card__gloss" />
    </div>
  );
}

export function PlayingCard({
  card,
  faceDown = false,
  dealDelay = 0,
  index = 0,
  count = 1,
}: {
  card: Card;
  faceDown?: boolean;
  /** Seconds of stagger so a dealt hand fans out one card at a time. */
  dealDelay?: number;
  /** Position within the hand, used to fan the cards. */
  index?: number;
  count?: number;
}) {
  const mid = (count - 1) / 2;
  const offset = index - mid;
  const style = {
    "--bj-deal-delay": `${dealDelay}s`,
    "--bj-fan-rot": `${offset * 4}deg`,
    "--bj-fan-y": `${Math.abs(offset) * 3}px`,
  } as CSSProperties;
  return (
    <div
      className={`bj-card${faceDown ? " bj-card--down" : ""}`}
      style={style}
      aria-label={faceDown ? "Face-down card" : `${card.rank} of ${SUIT_NAME[card.suit]}`}
    >
      <div className="bj-card__flipper">
        <CardFront card={card} />
        <div className="bj-card__face bj-card__face--back">
          <div className="bj-card__back-frame">
            <span className="bj-card__back-emblem">
              <span>♠</span>
              <span>♥</span>
              <span>♣</span>
              <span>♦</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
