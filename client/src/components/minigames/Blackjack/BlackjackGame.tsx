import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAudio } from "@/lib/stores/useAudio";
import { useChips } from "@/lib/stores/useChips";
import {
  RESHUFFLE_AT,
  SHOE_DECKS,
  createShoe,
  dealerShouldHit,
  drawCards,
  handLabel,
  handTotal,
  isBlackjack,
  isBust,
  settleRound,
  type Card,
  type Phase,
  type ResultType,
  type Settlement,
} from "./blackjackEngine";
import { CHIP_SET, decomposeBet, formatChips } from "./chips";
import { CasinoChip, ChipStack } from "./ui/CasinoChip";
import { HourlyBonus } from "./ui/HourlyBonus";
import { PlayingCard } from "./ui/PlayingCard";
import "./blackjack.css";

const DEAL_STEP_MS = 190;
const DEALER_STEP_MS = 620;

const RESULT_STYLE: Record<
  ResultType,
  { label: string; icon: string; bg: string; border: string; text: string }
> = {
  blackjack: { label: "BLACKJACK", icon: "🂡", bg: "linear-gradient(160deg,#7a5a12,#2a1d04)", border: "rgba(252,211,77,0.8)", text: "#fde68a" },
  win: { label: "YOU WIN", icon: "🏆", bg: "linear-gradient(160deg,#14532d,#04200f)", border: "rgba(74,222,128,0.7)", text: "#86efac" },
  push: { label: "PUSH", icon: "🤝", bg: "linear-gradient(160deg,#1e293b,#0b1120)", border: "rgba(148,163,184,0.6)", text: "#cbd5e1" },
  lose: { label: "DEALER WINS", icon: "🂠", bg: "linear-gradient(160deg,#7f1d1d,#2b0707)", border: "rgba(248,113,113,0.7)", text: "#fca5a5" },
  bust: { label: "BUST", icon: "💥", bg: "linear-gradient(160deg,#7f1d1d,#2b0707)", border: "rgba(248,113,113,0.7)", text: "#fca5a5" },
};

function Hand({
  label,
  cards,
  holeHidden = false,
  badge,
  badgeTone,
}: {
  label: string;
  cards: Card[];
  holeHidden?: boolean;
  badge?: string;
  badgeTone?: "bust" | "bj" | "win";
}) {
  return (
    <div className="bj-hand">
      <div className="bj-hand__cards">
        {cards.length === 0 ? (
          <div className="bj-hand__empty">♠</div>
        ) : (
          cards.map((card, i) => (
            <PlayingCard
              key={card.id}
              card={card}
              faceDown={holeHidden && i === 1}
              dealDelay={i < 2 ? i * 0.18 : 0}
            />
          ))
        )}
      </div>
      <span className={`bj-hand__badge${badgeTone ? ` bj-hand__badge--${badgeTone}` : ""}`}>
        <span>{label}</span>
        {badge || "—"}
      </span>
    </div>
  );
}

export default function BlackjackGame() {
  const chips = useChips((s) => s.chips);
  const addChips = useChips((s) => s.addChips);
  const spendChips = useChips((s) => s.spendChips);
  const { playHit, playSuccess } = useAudio();

  const [shoe, setShoe] = useState<Card[]>(() => createShoe());
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [holeHidden, setHoleHidden] = useState(true);
  const [phase, setPhase] = useState<Phase>("betting");
  const [bet, setBet] = useState(0);
  const [wager, setWager] = useState(0);
  const [lastWager, setLastWager] = useState(0);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [handsPlayed, setHandsPlayed] = useState(0);
  const [sessionNet, setSessionNet] = useState(0);
  const [balanceTick, setBalanceTick] = useState(0);

  const timers = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  }, []);
  const clearTimers = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    setBalanceTick((t) => t + 1);
  }, [chips]);

  const finishRound = useCallback(
    (player: Card[], dealer: Card[], amount: number) => {
      const outcome = settleRound(player, dealer, amount);
      if (outcome.returned > 0) addChips(outcome.returned);
      if (outcome.net > 0) playSuccess();
      setSettlement(outcome);
      setHandsPlayed((n) => n + 1);
      setSessionNet((n) => n + outcome.net);
      setPhase("result");
    },
    [addChips, playSuccess],
  );

  const runDealerTurn = useCallback(
    (currentShoe: Card[], dealer: Card[], player: Card[], amount: number) => {
      setHoleHidden(false);
      let hand = dealer;
      let rest = currentShoe;

      const step = () => {
        if (!dealerShouldHit(hand)) {
          finishRound(player, hand, amount);
          return;
        }
        const [drawn, remaining] = drawCards(rest, 1);
        hand = [...hand, ...drawn];
        rest = remaining;
        setDealerHand(hand);
        setShoe(rest);
        playHit();
        later(step, DEALER_STEP_MS);
      };

      later(step, DEALER_STEP_MS);
    },
    [finishRound, later, playHit],
  );

  const addToBet = (value: number) => {
    if (phase !== "betting" || bet + value > chips) return;
    setBet((b) => b + value);
    playHit();
  };

  const deal = useCallback(() => {
    if (phase !== "betting" || bet <= 0 || !spendChips(bet)) return;
    clearTimers();

    const source = shoe.length < RESHUFFLE_AT ? createShoe() : shoe;
    const [cards, rest] = drawCards(source, 4);
    const player = [cards[0], cards[2]];
    const dealer = [cards[1], cards[3]];

    setShoe(rest);
    setWager(bet);
    setLastWager(bet);
    setPlayerHand(player);
    setDealerHand(dealer);
    setHoleHidden(true);
    setSettlement(null);
    setPhase("dealing");
    playHit();

    later(() => {
      if (isBlackjack(player) || isBlackjack(dealer)) {
        setHoleHidden(false);
        later(() => finishRound(player, dealer, bet), 520);
      } else {
        setPhase("playing");
      }
    }, DEAL_STEP_MS * 4);
  }, [phase, bet, spendChips, shoe, clearTimers, later, finishRound, playHit]);

  const hit = useCallback(() => {
    if (phase !== "playing") return;
    const [drawn, rest] = drawCards(shoe, 1);
    const hand = [...playerHand, ...drawn];
    setPlayerHand(hand);
    setShoe(rest);
    playHit();
    if (isBust(hand)) {
      setHoleHidden(false);
      later(() => finishRound(hand, dealerHand, wager), 480);
      setPhase("dealerTurn");
    }
  }, [phase, shoe, playerHand, dealerHand, wager, finishRound, later, playHit]);

  const stand = useCallback(() => {
    if (phase !== "playing") return;
    setPhase("dealerTurn");
    runDealerTurn(shoe, dealerHand, playerHand, wager);
  }, [phase, shoe, dealerHand, playerHand, wager, runDealerTurn]);

  const canDouble =
    phase === "playing" && playerHand.length === 2 && chips >= wager && wager > 0;

  const doubleDown = useCallback(() => {
    if (!canDouble || !spendChips(wager)) return;
    const doubled = wager * 2;
    const [drawn, rest] = drawCards(shoe, 1);
    const hand = [...playerHand, ...drawn];
    setWager(doubled);
    setLastWager(doubled);
    setPlayerHand(hand);
    setShoe(rest);
    setPhase("dealerTurn");
    playHit();
    if (isBust(hand)) {
      setHoleHidden(false);
      later(() => finishRound(hand, dealerHand, doubled), 520);
    } else {
      later(() => runDealerTurn(rest, dealerHand, hand, doubled), 520);
    }
  }, [canDouble, spendChips, wager, shoe, playerHand, dealerHand, later, finishRound, runDealerTurn, playHit]);

  const nextHand = useCallback(() => {
    clearTimers();
    setPlayerHand([]);
    setDealerHand([]);
    setHoleHidden(true);
    setSettlement(null);
    setWager(0);
    setPhase("betting");
    setBet(lastWager > 0 && lastWager <= chips ? lastWager : 0);
  }, [clearTimers, lastWager, chips]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (phase === "playing") {
        if (key === "h") hit();
        if (key === "s") stand();
        if (key === "d") doubleDown();
      }
      if ((key === " " || key === "enter") && (phase === "betting" || phase === "result")) {
        e.preventDefault();
        if (phase === "betting") deal();
        else nextHand();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, hit, stand, doubleDown, deal, nextHand]);

  const displayedBet = phase === "betting" ? bet : wager;
  const piles = useMemo(() => decomposeBet(displayedBet), [displayedBet]);
  const playerTotal = handTotal(playerHand);
  const dealerCardsShown = holeHidden ? dealerHand.slice(0, 1) : dealerHand;
  const playerBadgeTone = isBust(playerHand)
    ? "bust"
    : isBlackjack(playerHand)
      ? "bj"
      : settlement?.net && settlement.net > 0
        ? "win"
        : undefined;

  const maxAffordable = Math.min(chips, 25000);
  const shoeCards = shoe.length;

  return (
    <div className="bj">
      {/* ── HUD ── */}
      <div className="bj__hud">
        <div className="bj__brand">
          <span className="bj__title">Blackjack</span>
          <span className="bj__subtitle">
            {SHOE_DECKS} decks · pays 3:2 · dealer hits soft 17
          </span>
        </div>
        <div className="bj__meters">
          {handsPlayed > 0 && (
            <div className="bj-meter">
              <span className="bj-meter__label">Session</span>
              <span
                className="bj-meter__value"
                style={{
                  color: sessionNet > 0 ? "#4ade80" : sessionNet < 0 ? "#f87171" : "#cbd5e1",
                  fontSize: 13,
                }}
              >
                {sessionNet > 0 ? "+" : ""}
                {formatChips(sessionNet)}
              </span>
            </div>
          )}
          {displayedBet > 0 && (
            <div className="bj-meter bj-meter--bet">
              <span className="bj-meter__label">Bet</span>
              <span className="bj-meter__value">{formatChips(displayedBet)}</span>
            </div>
          )}
          <div className="bj-meter bj-meter--chips">
            <span className="bj-meter__label">Chips</span>
            <span key={balanceTick} className="bj-meter__value bj-meter--bump">
              {formatChips(chips)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bj__table">
        <div className="bj__felt">
          <div className="bj__arc" aria-hidden />
          <div className="bj__rules" aria-hidden>
            <span className="bj__rules-main">BLACKJACK PAYS 3 TO 2</span>
            <span className="bj__rules-sub">
              DEALER MUST DRAW TO 16 AND HIT SOFT 17
            </span>
          </div>

          <HourlyBonus />

          <div className="bj-shoe" title={`${shoeCards} cards left in the shoe`}>
            <span className="bj-shoe__deck" aria-hidden />
            <span className="bj-shoe__text">
              <span className="bj-shoe__label">Shoe</span>
              <span className="bj-shoe__value">{shoeCards}</span>
            </span>
          </div>

          <div className="bj__zone bj__zone--dealer">
            <Hand
              label="Dealer"
              cards={dealerHand}
              holeHidden={holeHidden}
              badge={handLabel(dealerCardsShown)}
              badgeTone={
                !holeHidden && isBust(dealerHand)
                  ? "bust"
                  : !holeHidden && isBlackjack(dealerHand)
                    ? "bj"
                    : undefined
              }
            />
          </div>

          <div className="bj__zone bj__zone--player">
            <Hand
              label="You"
              cards={playerHand}
              badge={handLabel(playerHand)}
              badgeTone={playerBadgeTone}
            />
            <div className={`bj-spot${displayedBet > 0 ? " bj-spot--active" : ""}`}>
              <div className="bj-spot__piles">
                {piles.map((pile) => (
                  <ChipStack key={pile.chip.value} pile={pile} size={28} />
                ))}
              </div>
              {displayedBet > 0 ? (
                <span className="bj-spot__amount">{formatChips(displayedBet)}</span>
              ) : (
                <span className="bj-spot__label">Place your bet</span>
              )}
            </div>
          </div>

          {phase === "result" && settlement && (
            <div className="bj__result" onClick={nextHand} role="presentation">
              <div
                className="bj-result-card"
                style={
                  {
                    "--bj-result-bg": RESULT_STYLE[settlement.result].bg,
                    "--bj-result-border": RESULT_STYLE[settlement.result].border,
                    "--bj-result-text": RESULT_STYLE[settlement.result].text,
                  } as React.CSSProperties
                }
              >
                <span className="bj-result-card__icon">
                  {RESULT_STYLE[settlement.result].icon}
                </span>
                <span className="bj-result-card__label">
                  {RESULT_STYLE[settlement.result].label}
                </span>
                <span
                  className={`bj-result-card__payout bj-result-card__payout--${
                    settlement.net > 0 ? "up" : settlement.net < 0 ? "down" : "flat"
                  }`}
                >
                  {settlement.net > 0
                    ? `+${formatChips(settlement.net)} chips`
                    : settlement.net < 0
                      ? `${formatChips(settlement.net)} chips`
                      : "Bet returned"}
                </span>
                <span className="bj-result-card__hint">
                  {playerTotal > 21
                    ? "You went over 21"
                    : `You ${handLabel(playerHand)} · Dealer ${handLabel(dealerHand)}`}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="bj__controls">
        {phase === "betting" && (
          <>
            <div className="bj__rail">
              {CHIP_SET.map((chip) => (
                <CasinoChip
                  key={chip.value}
                  chip={chip}
                  size={44}
                  onClick={() => addToBet(chip.value)}
                  disabled={bet + chip.value > chips}
                />
              ))}
            </div>
            <div className="bj__actions">
              <button
                type="button"
                className="bj-btn"
                onClick={() => setBet(0)}
                disabled={bet === 0}
              >
                Clear
              </button>
              <button
                type="button"
                className="bj-btn"
                onClick={() => setBet(Math.min(bet * 2 || lastWager, chips))}
                disabled={chips === 0 || (bet === 0 && lastWager === 0)}
              >
                {bet > 0 ? "Double" : "Repeat"}
              </button>
              <button
                type="button"
                className="bj-btn"
                onClick={() => setBet(maxAffordable)}
                disabled={chips === 0 || bet === maxAffordable}
              >
                Max
              </button>
              <button
                type="button"
                className="bj-btn bj-btn--primary"
                onClick={deal}
                disabled={bet <= 0}
              >
                Deal <span className="bj-btn__key">SPACE</span>
              </button>
            </div>
            <p className={`bj__hint${chips === 0 && bet === 0 ? " bj__hint--warn" : ""}`}>
              {chips === 0 && bet === 0
                ? "Out of chips — claim the hourly bonus in the corner of the table"
                : handsPlayed > 0
                  ? `${handsPlayed} hand${handsPlayed === 1 ? "" : "s"} played this session`
                  : "Stack chips on the circle, then deal"}
            </p>
          </>
        )}

        {phase === "dealing" && <p className="bj__hint">Dealing…</p>}

        {phase === "playing" && (
          <div className="bj__actions">
            <button type="button" className="bj-btn bj-btn--hit" onClick={hit}>
              Hit <span className="bj-btn__key">H</span>
            </button>
            <button type="button" className="bj-btn bj-btn--stand" onClick={stand}>
              Stand <span className="bj-btn__key">S</span>
            </button>
            <button
              type="button"
              className="bj-btn bj-btn--double"
              onClick={doubleDown}
              disabled={!canDouble}
              title={canDouble ? "Double your wager and draw one card" : "Needs two cards and matching chips"}
            >
              Double <span className="bj-btn__key">D</span>
            </button>
          </div>
        )}

        {phase === "dealerTurn" && <p className="bj__hint">Dealer is drawing…</p>}

        {phase === "result" && (
          <div className="bj__actions">
            <button type="button" className="bj-btn bj-btn--primary" onClick={nextHand}>
              Next hand <span className="bj-btn__key">SPACE</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
