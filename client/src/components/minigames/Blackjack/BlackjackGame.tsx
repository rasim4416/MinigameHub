import { useState, useCallback, useEffect } from "react";
import { useChips, CHIP_DENOMINATIONS } from "@/lib/stores/useChips";

type Suit = "♠" | "♥" | "♦" | "♣";
type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
type Phase = "betting" | "playing" | "dealerTurn" | "result";

interface Card {
  suit: Suit;
  rank: Rank;
  hidden?: boolean;
}

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RED_SUITS: Suit[] = ["♥", "♦"];

function isRed(suit: Suit) { return RED_SUITS.includes(suit); }

function rankValue(rank: Rank): number {
  if (rank === "A") return 11;
  if (["J", "Q", "K"].includes(rank)) return 10;
  return parseInt(rank);
}

function handTotal(hand: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.hidden) continue;
    if (card.rank === "A") aces++;
    total += rankValue(card.rank);
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ suit, rank });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && handTotal(hand) === 21;
}

function PlayingCard({ card }: { card: Card }) {
  if (card.hidden) {
    return (
      <div className="w-14 h-20 sm:w-16 sm:h-24 rounded-lg border-2 border-indigo-400 bg-indigo-900 flex items-center justify-center shadow-lg">
        <div className="w-10 h-16 sm:w-12 sm:h-20 rounded border border-indigo-600 bg-indigo-800 flex items-center justify-center">
          <span className="text-indigo-400 text-xl font-bold">?</span>
        </div>
      </div>
    );
  }
  const red = isRed(card.suit);
  return (
    <div className={`w-14 h-20 sm:w-16 sm:h-24 rounded-lg border-2 border-gray-300 bg-white flex flex-col justify-between p-1 shadow-lg ${red ? "text-red-600" : "text-gray-900"}`}>
      <div className="text-xs font-bold leading-none">{card.rank}<br />{card.suit}</div>
      <div className="text-center text-xl sm:text-2xl font-bold leading-none">{card.suit}</div>
      <div className="text-xs font-bold leading-none text-right rotate-180">{card.rank}<br />{card.suit}</div>
    </div>
  );
}

function ChipVisual({ value, size = "md" }: { value: number; size?: "sm" | "md" }) {
  const chip = CHIP_DENOMINATIONS.find(c => c.value === value) || CHIP_DENOMINATIONS[0];
  const sz = size === "sm" ? "w-8 h-8 text-[10px]" : "w-10 h-10 text-xs";
  return (
    <div className={`${sz} rounded-full ${chip.color} ${chip.text} border-2 ${chip.border} flex items-center justify-center font-bold shadow-md flex-shrink-0`}>
      {chip.label}
    </div>
  );
}

type ResultType = "blackjack" | "win" | "push" | "lose" | "bust";

export default function BlackjackGame() {
  const { chips, addChips, spendChips } = useChips();
  const [deck, setDeck] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [phase, setPhase] = useState<Phase>("betting");
  const [bet, setBet] = useState(0);
  const [result, setResult] = useState<ResultType | null>(null);
  const [payout, setPayout] = useState(0);
  const [dealerThinking, setDealerThinking] = useState(false);
  const [lastBet, setLastBet] = useState(0);

  const addToBet = (value: number) => {
    if (phase !== "betting") return;
    if (bet + value > chips) return;
    setBet(b => b + value);
  };

  const clearBet = () => setBet(0);

  const deal = useCallback(() => {
    if (bet <= 0 || bet > chips) return;
    if (!spendChips(bet)) return;
    setLastBet(bet);

    const fresh = createDeck();
    const p: Card[] = [fresh[0], fresh[2]];
    const d: Card[] = [fresh[1], { ...fresh[3], hidden: true }];
    const remaining = fresh.slice(4);

    setDeck(remaining);
    setPlayerHand(p);
    setDealerHand(d);

    if (isBlackjack(p)) {
      // Reveal dealer hand
      const revealedDealer = d.map(c => ({ ...c, hidden: false }));
      setDealerHand(revealedDealer);
      const dealerBJ = isBlackjack(revealedDealer);
      if (dealerBJ) {
        const payAmount = bet;
        addChips(payAmount);
        setPayout(0);
        setResult("push");
      } else {
        const payAmount = Math.floor(bet * 2.5);
        addChips(payAmount);
        setPayout(payAmount - bet);
        setResult("blackjack");
      }
      setPhase("result");
    } else {
      setPhase("playing");
    }
  }, [bet, chips, spendChips, addChips]);

  const drawCard = useCallback((currentDeck: Card[]): [Card, Card[]] => {
    if (currentDeck.length === 0) {
      const fresh = createDeck();
      return [fresh[0], fresh.slice(1)];
    }
    return [currentDeck[0], currentDeck.slice(1)];
  }, []);

  const hit = useCallback(() => {
    if (phase !== "playing") return;
    const [card, rest] = drawCard(deck);
    const newHand = [...playerHand, card];
    setPlayerHand(newHand);
    setDeck(rest);
    if (handTotal(newHand) > 21) {
      const revealedDealer = dealerHand.map(c => ({ ...c, hidden: false }));
      setDealerHand(revealedDealer);
      setResult("bust");
      setPayout(-lastBet);
      setPhase("result");
    }
  }, [phase, deck, playerHand, dealerHand, drawCard, lastBet]);

  const runDealerTurn = useCallback((currentDeck: Card[], currentDealer: Card[], currentPlayer: Card[], effectiveBet: number) => {
    setDealerThinking(true);
    let d = currentDealer.map(c => ({ ...c, hidden: false }));
    let dk = [...currentDeck];

    const drawDealer = () => {
      const total = handTotal(d);
      if (total < 17) {
        const [card, rest] = dk.length > 0 ? [dk[0], dk.slice(1)] : (() => { const f = createDeck(); return [f[0], f.slice(1)]; })();
        d = [...d, card];
        dk = rest;
        setDealerHand([...d]);
        setTimeout(drawDealer, 600);
      } else {
        setDealerThinking(false);
        const dealerTotal = handTotal(d);
        const playerTotal = handTotal(currentPlayer);
        let res: ResultType;
        let pay: number;
        if (dealerTotal > 21 || playerTotal > dealerTotal) {
          res = "win";
          pay = effectiveBet;
          addChips(effectiveBet * 2);
        } else if (playerTotal === dealerTotal) {
          res = "push";
          pay = 0;
          addChips(effectiveBet);
        } else {
          res = "lose";
          pay = -effectiveBet;
        }
        setResult(res);
        setPayout(pay);
        setPhase("result");
      }
    };

    setDealerHand(d);
    setTimeout(drawDealer, 400);
  }, [addChips]);

  const stand = useCallback(() => {
    if (phase !== "playing") return;
    setPhase("dealerTurn");
    runDealerTurn(deck, dealerHand, playerHand, lastBet);
  }, [phase, deck, dealerHand, playerHand, runDealerTurn, lastBet]);

  const doubleDown = useCallback(() => {
    if (phase !== "playing" || playerHand.length !== 2) return;
    if (!spendChips(lastBet)) return;
    const newBet = lastBet * 2;
    setLastBet(newBet);

    const [card, rest] = drawCard(deck);
    const newHand = [...playerHand, card];
    setPlayerHand(newHand);
    setDeck(rest);

    if (handTotal(newHand) > 21) {
      const revealedDealer = dealerHand.map(c => ({ ...c, hidden: false }));
      setDealerHand(revealedDealer);
      setResult("bust");
      setPayout(-newBet);
      setPhase("result");
    } else {
      setPhase("dealerTurn");
      runDealerTurn(rest, dealerHand, newHand, newBet);
    }
  }, [phase, playerHand, deck, dealerHand, spendChips, lastBet, drawCard, runDealerTurn]);

  const reset = () => {
    setPlayerHand([]);
    setDealerHand([]);
    setResult(null);
    setPayout(0);
    setBet(0);
    setPhase("betting");
  };

  const repeatBet = () => {
    if (lastBet > 0 && lastBet <= chips) setBet(lastBet);
    else setBet(0);
  };

  const playerTotal = handTotal(playerHand);
  const dealerTotal = handTotal(dealerHand.filter(c => !c.hidden));
  const canDouble = phase === "playing" && playerHand.length === 2 && chips >= lastBet;

  const resultStyle: Record<ResultType, { color: string; label: string }> = {
    blackjack: { color: "text-yellow-400", label: "🎰 BLACKJACK!" },
    win:       { color: "text-green-400",  label: "🏆 YOU WIN!" },
    push:      { color: "text-gray-300",   label: "🤝 PUSH" },
    lose:      { color: "text-red-400",    label: "💀 DEALER WINS" },
    bust:      { color: "text-red-400",    label: "💥 BUST!" },
  };

  return (
    <div className="flex flex-col w-full h-full bg-gray-950 text-white select-none overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 shrink-0">
        <span className="text-xs text-gray-400 font-semibold tracking-wider uppercase">Blackjack</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Chips:</span>
          <span className="text-sm font-bold text-yellow-400">{chips.toLocaleString()}</span>
        </div>
        {phase === "playing" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Bet:</span>
            <span className="text-sm font-bold text-white">{lastBet.toLocaleString()}</span>
          </div>
        )}
        {phase === "betting" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Bet:</span>
            <span className="text-sm font-bold text-indigo-300">{bet.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Dealer area */}
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-3 bg-gray-900/50 border-b border-gray-800 min-h-0">
          <div className="text-[10px] font-bold text-gray-500 tracking-widest">DEALER {(phase === "playing" || phase === "dealerTurn") && dealerHand.some(c => !c.hidden) ? `(${dealerTotal})` : phase === "result" ? `(${handTotal(dealerHand)})` : ""}</div>
          <div className="flex gap-2 flex-wrap justify-center">
            {dealerHand.length === 0
              ? <div className="text-gray-700 text-sm italic">waiting...</div>
              : dealerHand.map((card, i) => <PlayingCard key={i} card={card} />)
            }
          </div>
        </div>

        {/* Result overlay */}
        {phase === "result" && result && (
          <div className="flex flex-col items-center justify-center gap-2 py-4 bg-gray-950 border-b border-gray-800 shrink-0">
            <div className={`text-2xl font-bold ${resultStyle[result].color}`}>
              {resultStyle[result].label}
            </div>
            <div className="text-sm text-gray-400">
              {payout > 0 ? <span className="text-green-400 font-bold">+{payout.toLocaleString()} chips</span>
               : payout < 0 ? <span className="text-red-400 font-bold">{payout.toLocaleString()} chips</span>
               : <span className="text-gray-400">chips returned</span>}
            </div>
          </div>
        )}

        {/* Player area */}
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-3 min-h-0">
          <div className="text-[10px] font-bold text-gray-500 tracking-widest">
            YOU {playerHand.length > 0 ? `(${playerTotal})` : ""}
            {playerTotal === 21 && playerHand.length === 2 ? " ✨" : ""}
            {playerTotal > 21 ? " 💥" : ""}
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            {playerHand.length === 0
              ? <div className="text-gray-700 text-sm italic">waiting...</div>
              : playerHand.map((card, i) => <PlayingCard key={i} card={card} />)
            }
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="shrink-0 border-t border-gray-800 bg-gray-950 px-3 py-2">
        {/* BETTING PHASE */}
        {phase === "betting" && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5 justify-center">
              {CHIP_DENOMINATIONS.map(chip => (
                <button
                  key={chip.value}
                  onClick={() => addToBet(chip.value)}
                  disabled={bet + chip.value > chips}
                  className={`w-10 h-10 rounded-full ${chip.color} ${chip.text} border-2 ${chip.border} text-[11px] font-bold shadow-md active:scale-90 transition-transform disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-center gap-3">
              {lastBet > 0 && (
                <button onClick={repeatBet} className="px-3 py-1 text-xs rounded border border-gray-600 text-gray-300 hover:border-gray-400 active:scale-95">
                  Repeat ({lastBet})
                </button>
              )}
              <button
                onClick={clearBet}
                disabled={bet === 0}
                className="px-3 py-1 text-xs rounded border border-gray-700 text-gray-400 hover:border-gray-500 active:scale-95 disabled:opacity-30"
              >
                Clear
              </button>
              <button
                onClick={deal}
                disabled={bet <= 0 || bet > chips}
                className="px-6 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg active:scale-95 transition-all"
              >
                Deal →
              </button>
            </div>
            {chips === 0 && (
              <p className="text-center text-xs text-red-400">No chips left! Play Speed Typer to earn more.</p>
            )}
          </div>
        )}

        {/* PLAYING PHASE */}
        {phase === "playing" && (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={hit}
              className="px-5 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-bold rounded-lg active:scale-95 transition-all shadow"
            >
              Hit
            </button>
            <button
              onClick={stand}
              className="px-5 py-2 bg-red-700 hover:bg-red-600 text-white text-sm font-bold rounded-lg active:scale-95 transition-all shadow"
            >
              Stand
            </button>
            {canDouble && (
              <button
                onClick={doubleDown}
                className="px-5 py-2 bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-bold rounded-lg active:scale-95 transition-all shadow"
              >
                2×
              </button>
            )}
          </div>
        )}

        {/* DEALER TURN */}
        {phase === "dealerTurn" && (
          <div className="flex items-center justify-center">
            <span className="text-sm text-gray-400 animate-pulse">Dealer drawing...</span>
          </div>
        )}

        {/* RESULT */}
        {phase === "result" && (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={reset}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg active:scale-95 transition-all shadow"
            >
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
