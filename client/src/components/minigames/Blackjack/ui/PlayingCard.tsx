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
  "9": [[0, 0], [100, 0], [0, 33], [100, 33], [50, 50], [0, 67], [100, 67], [0, 100], [100, 100]],
  "10": [[0, 0], [100, 0], [50, 17], [0, 33], [100, 33], [0, 67], [100, 67], [50, 83], [0, 100], [100, 100]],
};

const COURT_RANKS = new Set<Rank>(["J", "Q", "K"]);

function CardFront({ card }: { card: Card }) {
  const color = RED_SUITS.has(card.suit) ? "#c81e3c" : "#101828";
  const pips = PIP_LAYOUT[card.rank];
  return (
    <div className="bj-card__face bj-card__face--front" style={{ color }}>
      <div className="bj-card__corner bj-card__corner--tl">
        <span className="bj-card__rank">{card.rank}</span>
        <span className="bj-card__suit">{card.suit}</span>
      </div>
      <div className="bj-card__corner bj-card__corner--br">
        <span className="bj-card__rank">{card.rank}</span>
        <span className="bj-card__suit">{card.suit}</span>
      </div>

      {card.rank === "A" && <div className="bj-card__center">{card.suit}</div>}

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

      {COURT_RANKS.has(card.rank) && (
        <div className="bj-card__court">
          <span className="bj-card__court-suit bj-card__court-suit--top">{card.suit}</span>
          <span className="bj-card__court-letter">{card.rank}</span>
          <span className="bj-card__court-suit">{card.suit}</span>
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
}: {
  card: Card;
  faceDown?: boolean;
  /** Seconds of stagger so a dealt hand fans out one card at a time. */
  dealDelay?: number;
}) {
  return (
    <div
      className={`bj-card${faceDown ? " bj-card--down" : ""}`}
      style={{ "--bj-deal-delay": `${dealDelay}s` } as React.CSSProperties}
      aria-label={faceDown ? "Face-down card" : `${card.rank} of ${card.suit}`}
    >
      <div className="bj-card__flipper">
        <CardFront card={card} />
        <div className="bj-card__face bj-card__face--back">
          <div className="bj-card__back-frame">
            <span className="bj-card__back-mark">♠</span>
          </div>
        </div>
      </div>
    </div>
  );
}
