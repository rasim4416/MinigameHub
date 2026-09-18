export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank =
  | "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

/** `id` keeps React keys and deal animations stable across re-renders. */
export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export type Phase = "betting" | "dealing" | "playing" | "dealerTurn" | "result";
export type ResultType = "blackjack" | "win" | "push" | "lose" | "bust";

export const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
export const RANKS: Rank[] = [
  "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K",
];
export const RED_SUITS = new Set<Suit>(["♥", "♦"]);

/** Casino shoe size; the shoe is reshuffled once it runs low. */
export const SHOE_DECKS = 6;
export const RESHUFFLE_AT = 52 * SHOE_DECKS * 0.25;
export const DEALER_STANDS_ON = 17;
export const BLACKJACK_PAYOUT = 1.5;

export function rankValue(rank: Rank): number {
  if (rank === "A") return 11;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  return Number.parseInt(rank, 10);
}

export interface HandValue {
  total: number;
  /** True while an ace is still counted as 11. */
  soft: boolean;
}

export function handValue(cards: Card[]): HandValue {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === "A") aces++;
    total += rankValue(card.rank);
  }
  let softAces = aces;
  while (total > 21 && softAces > 0) {
    total -= 10;
    softAces--;
  }
  return { total, soft: softAces > 0 };
}

export function handTotal(cards: Card[]): number {
  return handValue(cards).total;
}

export function isBust(cards: Card[]): boolean {
  return handTotal(cards) > 21;
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handTotal(cards) === 21;
}

/** Hand label shown on the felt: "17", "A/7" for soft hands, or "BUST". */
export function handLabel(cards: Card[]): string {
  if (cards.length === 0) return "";
  const { total, soft } = handValue(cards);
  if (total > 21) return "BUST";
  if (isBlackjack(cards)) return "BLACKJACK";
  return soft ? `${total - 10}/${total}` : String(total);
}

export function createShoe(decks: number = SHOE_DECKS): Card[] {
  const shoe: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        shoe.push({ id: `${d}-${suit}-${rank}`, suit, rank });
      }
    }
  }
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

/** Draws `count` cards, reshuffling a fresh shoe when this one runs out. */
export function drawCards(shoe: Card[], count: number): [Card[], Card[]] {
  let rest = shoe;
  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    if (rest.length === 0) rest = createShoe();
    drawn.push(rest[0]);
    rest = rest.slice(1);
  }
  return [drawn, rest];
}

export function dealerShouldHit(cards: Card[]): boolean {
  const { total, soft } = handValue(cards);
  // Dealer hits soft 17, the common multi-deck shoe rule.
  return total < DEALER_STANDS_ON || (total === DEALER_STANDS_ON && soft);
}

export interface Settlement {
  result: ResultType;
  /** Chips handed back to the player, including the original wager. */
  returned: number;
  /** Net chips won (positive) or lost (negative) for the round. */
  net: number;
}

export function settleRound(
  playerCards: Card[],
  dealerCards: Card[],
  bet: number,
): Settlement {
  const player = handTotal(playerCards);
  const dealer = handTotal(dealerCards);
  const playerBJ = isBlackjack(playerCards);
  const dealerBJ = isBlackjack(dealerCards);

  if (player > 21) return { result: "bust", returned: 0, net: -bet };
  if (playerBJ && dealerBJ) return { result: "push", returned: bet, net: 0 };
  if (playerBJ) {
    const winnings = Math.floor(bet * BLACKJACK_PAYOUT);
    return { result: "blackjack", returned: bet + winnings, net: winnings };
  }
  if (dealerBJ) return { result: "lose", returned: 0, net: -bet };
  if (dealer > 21 || player > dealer) {
    return { result: "win", returned: bet * 2, net: bet };
  }
  if (player === dealer) return { result: "push", returned: bet, net: 0 };
  return { result: "lose", returned: 0, net: -bet };
}
