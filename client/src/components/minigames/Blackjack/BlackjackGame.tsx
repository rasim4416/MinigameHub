import { useState, useCallback, useRef } from "react";
import { useChips } from "@/lib/stores/useChips";

// ─── Types ───────────────────────────────────────────────────────────────────

type Suit = "♠" | "♥" | "♦" | "♣";
type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
type Phase = "betting" | "playing" | "dealerTurn" | "result";
type ResultType = "blackjack" | "win" | "push" | "lose" | "bust";

interface Card { suit: Suit; rank: Rank; hidden?: boolean; }

// ─── Chip definitions (with hex colors for inline styles) ────────────────────

const CHIPS = [
  { value: 5,     bg: "#94a3b8", light: "#e2e8f0", dark: "#475569", text: "#0f172a", label: "5"   },
  { value: 10,    bg: "#3b82f6", light: "#93c5fd", dark: "#1d4ed8", text: "#ffffff", label: "10"  },
  { value: 20,    bg: "#22c55e", light: "#86efac", dark: "#15803d", text: "#052e16", label: "20"  },
  { value: 50,    bg: "#ef4444", light: "#fca5a5", dark: "#b91c1c", text: "#ffffff", label: "50"  },
  { value: 100,   bg: "#1e293b", light: "#475569", dark: "#0f172a", text: "#e2e8f0", label: "100" },
  { value: 200,   bg: "#a855f7", light: "#d8b4fe", dark: "#7e22ce", text: "#ffffff", label: "200" },
  { value: 500,   bg: "#f97316", light: "#fdba74", dark: "#c2410c", text: "#ffffff", label: "500" },
  { value: 1000,  bg: "#06b6d4", light: "#67e8f9", dark: "#0e7490", text: "#083344", label: "1K"  },
  { value: 5000,  bg: "#ec4899", light: "#f9a8d4", dark: "#be185d", text: "#ffffff", label: "5K"  },
  { value: 10000, bg: "#eab308", light: "#fde047", dark: "#a16207", text: "#422006", label: "10K" },
] as const;

type ChipDef = typeof CHIPS[number];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS: Rank[] = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const RED_SUITS = new Set<Suit>(["♥", "♦"]);

function rankValue(r: Rank) {
  if (r === "A") return 11;
  if (["J","Q","K"].includes(r)) return 10;
  return parseInt(r);
}
function handTotal(hand: Card[]) {
  let t = 0, aces = 0;
  for (const c of hand) {
    if (c.hidden) continue;
    if (c.rank === "A") aces++;
    t += rankValue(c.rank);
  }
  while (t > 21 && aces-- > 0) t -= 10;
  return t;
}
function isBlackjack(hand: Card[]) { return hand.length === 2 && handTotal(hand) === 21; }
function createDeck(): Card[] {
  const d: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ suit: s, rank: r });
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
function chipForValue(v: number): ChipDef {
  return CHIPS.find(c => c.value === v) ?? CHIPS[0];
}
function decomposeBet(amount: number): ChipDef[] {
  const result: ChipDef[] = [];
  let rem = amount;
  for (const chip of [...CHIPS].sort((a, b) => b.value - a.value)) {
    while (rem >= chip.value && result.length < 10) {
      result.push(chip);
      rem -= chip.value;
    }
  }
  return result;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CasinoChip({
  chip, size = 46, onClick, disabled = false, scale = 1,
}: {
  chip: ChipDef; size?: number; onClick?: () => void; disabled?: boolean; scale?: number;
}) {
  const s = size * scale;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: s, height: s, borderRadius: "50%", flexShrink: 0,
        background: `radial-gradient(ellipse at 32% 28%, ${chip.light}, ${chip.bg} 55%, ${chip.dark})`,
        boxShadow: disabled
          ? "none"
          : `0 4px 12px rgba(0,0,0,0.65), 0 2px 4px rgba(0,0,0,0.4), inset 0 0 0 3px rgba(255,255,255,0.28), inset 0 0 0 6px ${chip.bg}, inset 0 0 0 8px rgba(0,0,0,0.18)`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.28 : 1,
        transition: "transform 0.1s, box-shadow 0.1s",
        position: "relative",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      className="active:scale-90"
    >
      <span style={{
        fontSize: s < 38 ? 9 : s < 46 ? 10 : 12,
        fontWeight: 900,
        color: chip.text,
        letterSpacing: "-0.03em",
        textShadow: `0 1px 2px rgba(0,0,0,0.4)`,
        userSelect: "none",
        lineHeight: 1,
      }}>
        {chip.label}
      </span>
    </button>
  );
}

function PlayingCard({ card, animateIn = false }: { card: Card; animateIn?: boolean }) {
  const _ = animateIn; // reserved for future animation
  if (card.hidden) {
    return (
      <div style={{
        width: 58, height: 84, borderRadius: 8, flexShrink: 0,
        background: "linear-gradient(145deg, #312e81, #1e1b4b)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.7), 0 2px 4px rgba(0,0,0,0.5)",
        border: "1.5px solid #4338ca",
        position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {/* Card back pattern */}
        <div style={{
          position: "absolute", inset: 5, borderRadius: 4,
          border: "1px solid rgba(99,102,241,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            position: "absolute", inset: 4, borderRadius: 3,
            border: "1px solid rgba(99,102,241,0.25)",
          }} />
          <span style={{ fontSize: 22, color: "rgba(99,102,241,0.7)", lineHeight: 1 }}>♦</span>
        </div>
      </div>
    );
  }
  const red = RED_SUITS.has(card.suit);
  const color = red ? "#dc2626" : "#0f172a";
  const isFace = ["J","Q","K"].includes(card.rank);
  return (
    <div style={{
      width: 58, height: 84, borderRadius: 8, flexShrink: 0,
      background: "#ffffff",
      boxShadow: "0 4px 14px rgba(0,0,0,0.55), 0 2px 5px rgba(0,0,0,0.35)",
      border: "1.5px solid #e5e7eb",
      position: "relative", overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {/* Top-left corner */}
      <div style={{ position: "absolute", top: 4, left: 5, display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1 }}>
        <span style={{ fontSize: 13, fontWeight: 900, color, lineHeight: 1 }}>{card.rank}</span>
        <span style={{ fontSize: 10, color, lineHeight: 1.1 }}>{card.suit}</span>
      </div>
      {/* Center suit */}
      <span style={{ fontSize: isFace ? 24 : 26, color, lineHeight: 1, userSelect: "none" }}>{card.suit}</span>
      {/* Bottom-right corner (rotated) */}
      <div style={{
        position: "absolute", bottom: 4, right: 5,
        display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1,
        transform: "rotate(180deg)",
      }}>
        <span style={{ fontSize: 13, fontWeight: 900, color, lineHeight: 1 }}>{card.rank}</span>
        <span style={{ fontSize: 10, color, lineHeight: 1.1 }}>{card.suit}</span>
      </div>
      {/* Face card tint */}
      {isFace && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 6,
          background: red
            ? "linear-gradient(135deg, rgba(254,202,202,0.25), transparent 60%)"
            : "linear-gradient(135deg, rgba(199,210,254,0.25), transparent 60%)",
        }} />
      )}
    </div>
  );
}

function HandArea({
  label, hand, showTotal, totalOverride, isBust, isBlackjackHand,
}: {
  label: string; hand: Card[]; showTotal: boolean;
  totalOverride?: number; isBust?: boolean; isBlackjackHand?: boolean;
}) {
  const total = totalOverride ?? handTotal(hand.filter(c => !c.hidden));
  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 6, minHeight: 0,
      padding: "8px 12px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, color: "#6b7280",
          letterSpacing: "0.15em", textTransform: "uppercase",
        }}>{label}</span>
        {showTotal && hand.length > 0 && (
          <span style={{
            fontSize: 13, fontWeight: 800, padding: "1px 8px",
            borderRadius: 20,
            background: isBust ? "#7f1d1d" : isBlackjackHand ? "#713f12" : "#1f2937",
            color: isBust ? "#fca5a5" : isBlackjackHand ? "#fde047" : "#e5e7eb",
            boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
          }}>
            {isBust ? "BUST" : isBlackjackHand ? "BJ" : total}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        {hand.length === 0
          ? <span style={{ fontSize: 13, color: "#374151", fontStyle: "italic" }}>waiting...</span>
          : hand.map((card, i) => <PlayingCard key={i} card={card} animateIn />)
        }
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BlackjackGame() {
  const { chips, addChips, spendChips } = useChips();
  const [deck, setDeck] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [phase, setPhase] = useState<Phase>("betting");
  const [bet, setBet] = useState(0);
  const [result, setResult] = useState<ResultType | null>(null);
  const [payout, setPayout] = useState(0);
  const [lastBet, setLastBet] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => { if (timerRef.current) clearTimeout(timerRef.current); };

  const addToBet = (value: number) => {
    if (phase !== "betting") return;
    if (bet + value > chips) return;
    setBet(b => b + value);
  };
  const clearBet = () => { if (phase === "betting") setBet(0); };

  const drawCard = useCallback((d: Card[]): [Card, Card[]] => {
    if (d.length === 0) { const f = createDeck(); return [f[0], f.slice(1)]; }
    return [d[0], d.slice(1)];
  }, []);

  const runDealerTurn = useCallback((dk: Card[], dd: Card[], pd: Card[], eff: number) => {
    let d: Card[] = dd.map((c) => ({ ...c, hidden: false }));
    let ddk = [...dk];
    setDealerHand([...d]);

    const step = () => {
      if (handTotal(d) < 17) {
        let card: Card;
        let rest: Card[];
        if (ddk.length > 0) {
          card = ddk[0]!;
          rest = ddk.slice(1);
        } else {
          const f = createDeck();
          card = f[0]!;
          rest = f.slice(1);
        }
        d = [...d, card]; ddk = rest;
        setDealerHand([...d]);
        timerRef.current = setTimeout(step, 650);
      } else {
        const dt = handTotal(d), pt = handTotal(pd);
        let res: ResultType, pay: number;
        if (dt > 21 || pt > dt)      { res = "win";  pay = eff;  addChips(eff * 2); }
        else if (pt === dt)           { res = "push"; pay = 0;   addChips(eff); }
        else                          { res = "lose"; pay = -eff; }
        setResult(res); setPayout(pay); setPhase("result");
      }
    };
    timerRef.current = setTimeout(step, 450);
  }, [addChips]);

  const deal = useCallback(() => {
    if (bet <= 0 || bet > chips || !spendChips(bet)) return;
    clearTimer();
    setLastBet(bet);
    const fresh = createDeck();
    const p: Card[] = [fresh[0], fresh[2]];
    const d: Card[] = [fresh[1], { ...fresh[3], hidden: true }];
    const rem = fresh.slice(4);
    setDeck(rem); setPlayerHand(p); setDealerHand(d);

    if (isBlackjack(p)) {
      const rd = d.map(c => ({ ...c, hidden: false }));
      setDealerHand(rd);
      if (isBlackjack(rd)) { addChips(bet); setPayout(0); setResult("push"); }
      else { const amt = Math.floor(bet * 2.5); addChips(amt); setPayout(amt - bet); setResult("blackjack"); }
      setPhase("result");
    } else setPhase("playing");
  }, [bet, chips, spendChips, addChips, clearTimer]);

  const hit = useCallback(() => {
    if (phase !== "playing") return;
    const [card, rest] = drawCard(deck);
    const nh = [...playerHand, card];
    setPlayerHand(nh); setDeck(rest);
    if (handTotal(nh) > 21) {
      setDealerHand(dh => dh.map(c => ({ ...c, hidden: false })));
      setResult("bust"); setPayout(-lastBet); setPhase("result");
    }
  }, [phase, deck, playerHand, drawCard, lastBet]);

  const stand = useCallback(() => {
    if (phase !== "playing") return;
    setPhase("dealerTurn");
    runDealerTurn(deck, dealerHand, playerHand, lastBet);
  }, [phase, deck, dealerHand, playerHand, runDealerTurn, lastBet]);

  const doubleDown = useCallback(() => {
    if (phase !== "playing" || playerHand.length !== 2 || !spendChips(lastBet)) return;
    const nb = lastBet * 2; setLastBet(nb);
    const [card, rest] = drawCard(deck);
    const nh = [...playerHand, card];
    setPlayerHand(nh); setDeck(rest);
    if (handTotal(nh) > 21) {
      setDealerHand(dh => dh.map(c => ({ ...c, hidden: false })));
      setResult("bust"); setPayout(-nb); setPhase("result");
    } else { setPhase("dealerTurn"); runDealerTurn(rest, dealerHand, nh, nb); }
  }, [phase, playerHand, deck, dealerHand, spendChips, lastBet, drawCard, runDealerTurn]);

  const reset = () => {
    clearTimer();
    setPlayerHand([]); setDealerHand([]); setResult(null);
    setPayout(0); setBet(0); setPhase("betting");
  };
  const repeatBet = () => { if (lastBet > 0 && lastBet <= chips) setBet(lastBet); };

  const playerTotal = handTotal(playerHand);
  const playerBust = playerTotal > 21;
  const playerBJ = isBlackjack(playerHand);
  const dealerVisible = handTotal(dealerHand.filter(c => !c.hidden));
  const showDealerTotal = phase === "playing" || phase === "dealerTurn" || phase === "result";
  const canDouble = phase === "playing" && playerHand.length === 2 && chips >= lastBet;
  const betChips = decomposeBet(phase === "betting" ? bet : lastBet);

  const RESULT_CONFIG: Record<ResultType, { label: string; sub: string; bg: string; border: string; textColor: string }> = {
    blackjack: { label: "BLACKJACK!", sub: "🎰", bg: "linear-gradient(135deg,#78350f,#451a03)", border: "#d97706", textColor: "#fde047" },
    win:       { label: "YOU WIN",   sub: "🏆", bg: "linear-gradient(135deg,#14532d,#052e16)", border: "#22c55e", textColor: "#86efac" },
    push:      { label: "PUSH",      sub: "🤝", bg: "linear-gradient(135deg,#1e293b,#0f172a)", border: "#475569", textColor: "#cbd5e1" },
    lose:      { label: "DEALER WINS",sub:"💔", bg: "linear-gradient(135deg,#7f1d1d,#450a0a)", border: "#ef4444", textColor: "#fca5a5" },
    bust:      { label: "BUST!",     sub: "💥", bg: "linear-gradient(135deg,#7f1d1d,#450a0a)", border: "#ef4444", textColor: "#fca5a5" },
  };

  const FELT = "#0c2318";
  const FELT_LIGHT = "#0f2d1e";

  return (
    <div style={{
      display: "flex", flexDirection: "column", width: "100%", height: "100%",
      background: "#030712", color: "#fff", userSelect: "none", overflow: "hidden",
      position: "relative",
    }}>

      {/* ── Top bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "6px 14px", borderBottom: "1px solid #1f2937", flexShrink: 0,
        background: "#030712",
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Blackjack
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 10, color: "#6b7280" }}>CHIPS</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#facc15", letterSpacing: "-0.01em" }}>
              {chips.toLocaleString()}
            </span>
          </div>
          {(phase !== "betting" || bet > 0) && (
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 10, color: "#6b7280" }}>BET</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#a5b4fc", letterSpacing: "-0.01em" }}>
                {(phase === "betting" ? bet : lastBet).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, position: "relative" }}>

        {/* Dealer zone */}
        <div style={{
          flex: 1, background: FELT, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", minHeight: 0,
          borderBottom: "2px solid #1a5c35",
        }}>
          <HandArea
            label="Dealer"
            hand={dealerHand}
            showTotal={showDealerTotal}
            totalOverride={showDealerTotal ? handTotal(dealerHand.filter(c => !c.hidden)) : undefined}
          />
        </div>

        {/* Center strip — bet chips or divider */}
        <div style={{
          flexShrink: 0, background: "#071810",
          borderTop: "1px solid #1a5c35", borderBottom: "1px solid #1a5c35",
          padding: "5px 12px", display: "flex", alignItems: "center",
          justifyContent: "center", gap: 6, minHeight: 36,
        }}>
          {betChips.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 10, color: "#4b7a59", marginRight: 4, fontWeight: 600 }}>BET</span>
              <div style={{ display: "flex", alignItems: "center" }}>
                {betChips.slice(0, 8).map((chip, i) => (
                  <div key={i} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: i }}>
                    <CasinoChip chip={chip} size={30} />
                  </div>
                ))}
                {betChips.length > 8 && (
                  <span style={{ marginLeft: 4, fontSize: 10, color: "#6b7280" }}>+{betChips.length - 8}</span>
                )}
              </div>
              {phase !== "betting" && (
                <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: "#a5b4fc" }}>
                  {lastBet.toLocaleString()}
                </span>
              )}
            </div>
          ) : (
            <span style={{ fontSize: 10, color: "#1a5c35", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600 }}>
              ♠ Place your bet ♠
            </span>
          )}
        </div>

        {/* Player zone */}
        <div style={{
          flex: 1, background: FELT_LIGHT, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", minHeight: 0,
        }}>
          <HandArea
            label="You"
            hand={playerHand}
            showTotal={playerHand.length > 0}
            isBust={playerBust}
            isBlackjackHand={playerBJ}
          />
        </div>

        {/* Result overlay */}
        {phase === "result" && result && (() => {
          const cfg = RESULT_CONFIG[result];
          return (
            <div style={{
              position: "absolute", inset: 0,
              background: "rgba(0,0,0,0.72)", backdropFilter: "blur(3px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 20,
            }}>
              <div style={{
                background: cfg.bg,
                border: `2px solid ${cfg.border}`,
                borderRadius: 16,
                padding: "20px 36px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                boxShadow: `0 8px 40px rgba(0,0,0,0.8), 0 0 0 1px ${cfg.border}40`,
              }}>
                <span style={{ fontSize: 28 }}>{cfg.sub}</span>
                <span style={{
                  fontSize: 22, fontWeight: 900, color: cfg.textColor,
                  letterSpacing: "0.04em", textShadow: "0 2px 8px rgba(0,0,0,0.5)",
                }}>
                  {cfg.label}
                </span>
                <span style={{
                  fontSize: 14, fontWeight: 700,
                  color: payout > 0 ? "#4ade80" : payout < 0 ? "#f87171" : "#94a3b8",
                }}>
                  {payout > 0 ? `+${payout.toLocaleString()} chips` : payout < 0 ? `${payout.toLocaleString()} chips` : "chips returned"}
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Controls ── */}
      <div style={{
        flexShrink: 0, borderTop: "1px solid #1f2937",
        background: "#030712", padding: "8px 12px",
      }}>

        {/* BETTING */}
        {phase === "betting" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Chip row */}
            <div style={{
              display: "flex", gap: 8, justifyContent: "center",
              overflowX: "auto", paddingBottom: 2, flexWrap: "wrap",
            }}>
              {CHIPS.map(chip => (
                <CasinoChip
                  key={chip.value}
                  chip={chip}
                  size={44}
                  onClick={() => addToBet(chip.value)}
                  disabled={bet + chip.value > chips}
                />
              ))}
            </div>
            {/* Action row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              {lastBet > 0 && lastBet <= chips && (
                <button onClick={repeatBet} style={{
                  padding: "6px 12px", fontSize: 11, fontWeight: 600,
                  borderRadius: 8, border: "1px solid #374151",
                  background: "#111827", color: "#9ca3af",
                  cursor: "pointer",
                }}>
                  ↩ Repeat
                </button>
              )}
              <button onClick={clearBet} disabled={bet === 0} style={{
                padding: "6px 12px", fontSize: 11, fontWeight: 600,
                borderRadius: 8, border: "1px solid #374151",
                background: "#111827", color: bet === 0 ? "#374151" : "#9ca3af",
                cursor: bet === 0 ? "not-allowed" : "pointer",
              }}>
                Clear
              </button>
              <button onClick={deal} disabled={bet <= 0} style={{
                padding: "7px 26px", fontSize: 14, fontWeight: 800,
                borderRadius: 10,
                background: bet > 0 ? "linear-gradient(135deg,#4f46e5,#6366f1)" : "#1f2937",
                color: bet > 0 ? "#fff" : "#374151",
                cursor: bet <= 0 ? "not-allowed" : "pointer",
                boxShadow: bet > 0 ? "0 3px 12px rgba(99,102,241,0.5)" : "none",
                border: "none",
                letterSpacing: "0.03em",
              }}>
                Deal →
              </button>
            </div>
            {chips === 0 && (
              <p style={{ textAlign: "center", fontSize: 11, color: "#ef4444", marginTop: 2 }}>
                No chips! Earn more by playing Speed Typer.
              </p>
            )}
          </div>
        )}

        {/* PLAYING */}
        {phase === "playing" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <button onClick={hit} style={{
              padding: "10px 28px", fontSize: 15, fontWeight: 800,
              borderRadius: 12, border: "none", cursor: "pointer",
              background: "linear-gradient(135deg,#15803d,#166534)",
              color: "#fff", boxShadow: "0 3px 12px rgba(22,163,74,0.45)",
              letterSpacing: "0.03em",
            }}>Hit</button>
            <button onClick={stand} style={{
              padding: "10px 28px", fontSize: 15, fontWeight: 800,
              borderRadius: 12, border: "none", cursor: "pointer",
              background: "linear-gradient(135deg,#b91c1c,#991b1b)",
              color: "#fff", boxShadow: "0 3px 12px rgba(185,28,28,0.45)",
              letterSpacing: "0.03em",
            }}>Stand</button>
            {canDouble && (
              <button onClick={doubleDown} style={{
                padding: "10px 24px", fontSize: 15, fontWeight: 800,
                borderRadius: 12, border: "none", cursor: "pointer",
                background: "linear-gradient(135deg,#d97706,#b45309)",
                color: "#fff", boxShadow: "0 3px 12px rgba(217,119,6,0.45)",
                letterSpacing: "0.03em",
              }}>2×</button>
            )}
          </div>
        )}

        {/* DEALER TURN */}
        {phase === "dealerTurn" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "6px 0" }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%", background: "#4ade80",
              animation: "pulse 1s infinite",
            }} />
            <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>Dealer is drawing...</span>
          </div>
        )}

        {/* RESULT */}
        {phase === "result" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <button onClick={reset} style={{
              padding: "10px 32px", fontSize: 15, fontWeight: 800,
              borderRadius: 12, border: "none", cursor: "pointer",
              background: "linear-gradient(135deg,#4f46e5,#6366f1)",
              color: "#fff", boxShadow: "0 3px 14px rgba(99,102,241,0.5)",
              letterSpacing: "0.03em",
            }}>Play Again</button>
          </div>
        )}
      </div>
    </div>
  );
}
