export interface ChipDef {
  value: number;
  label: string;
  /** Clay body colours, lightest first. */
  light: string;
  base: string;
  dark: string;
  /** Colour of the painted edge spots and the inner ring. */
  spot: string;
  text: string;
  glow: string;
}

export const CHIP_SET: ChipDef[] = [
  { value: 5,     label: "5",   light: "#ffffff", base: "#e7e5e4", dark: "#a8a29e", spot: "#b91c1c", text: "#1c1917", glow: "rgba(231,229,228,0.55)" },
  { value: 10,    label: "10",  light: "#93c5fd", base: "#2563eb", dark: "#1e3a8a", spot: "#eff6ff", text: "#f8fafc", glow: "rgba(59,130,246,0.6)" },
  { value: 20,    label: "20",  light: "#86efac", base: "#16a34a", dark: "#14532d", spot: "#f0fdf4", text: "#f8fafc", glow: "rgba(34,197,94,0.6)" },
  { value: 50,    label: "50",  light: "#fca5a5", base: "#dc2626", dark: "#7f1d1d", spot: "#fef2f2", text: "#fff1f2", glow: "rgba(239,68,68,0.6)" },
  { value: 100,   label: "100", light: "#64748b", base: "#1e293b", dark: "#020617", spot: "#e2e8f0", text: "#f1f5f9", glow: "rgba(148,163,184,0.5)" },
  { value: 200,   label: "200", light: "#d8b4fe", base: "#9333ea", dark: "#4c1d95", spot: "#faf5ff", text: "#faf5ff", glow: "rgba(168,85,247,0.6)" },
  { value: 500,   label: "500", light: "#fdba74", base: "#ea580c", dark: "#7c2d12", spot: "#fff7ed", text: "#fff7ed", glow: "rgba(249,115,22,0.6)" },
  { value: 1000,  label: "1K",  light: "#67e8f9", base: "#0891b2", dark: "#164e63", spot: "#ecfeff", text: "#ecfeff", glow: "rgba(6,182,212,0.6)" },
  { value: 5000,  label: "5K",  light: "#f9a8d4", base: "#db2777", dark: "#831843", spot: "#fdf2f8", text: "#fdf2f8", glow: "rgba(236,72,153,0.6)" },
  { value: 10000, label: "10K", light: "#fde047", base: "#d4a017", dark: "#713f12", spot: "#fffbeb", text: "#422006", glow: "rgba(234,179,8,0.65)" },
];

const DESCENDING = [...CHIP_SET].sort((a, b) => b.value - a.value);

export function chipForValue(value: number): ChipDef {
  return CHIP_SET.find((chip) => chip.value === value) ?? CHIP_SET[0];
}

export interface ChipPile {
  chip: ChipDef;
  count: number;
}

/** Splits a wager into the fewest chips, biggest denomination first. */
export function decomposeBet(amount: number): ChipPile[] {
  const piles: ChipPile[] = [];
  let remaining = amount;
  for (const chip of DESCENDING) {
    const count = Math.floor(remaining / chip.value);
    if (count > 0) {
      piles.push({ chip, count });
      remaining -= count * chip.value;
    }
  }
  return piles;
}

export function formatChips(amount: number): string {
  return amount.toLocaleString("en-US");
}
