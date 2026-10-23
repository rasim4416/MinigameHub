import type { MastermindTier } from "./augments";

type PlayerColor = "white" | "black";

export type AdvantageLevel = "high" | "medium" | "low";
export type AdvantageSetting = "neutral" | `${PlayerColor}-${AdvantageLevel}`;

export type SideAdvantage = {
  startGold: number;
  /** Extra augment picks before move one. */
  bonusPicks: number;
  /** Multiplier on the per-purchase shop price increase (1 = normal, 0 = none). */
  shopScaling: number;
  mastermindTier: MastermindTier;
};

export const NO_ADVANTAGE: SideAdvantage = {
  startGold: 0,
  bonusPicks: 0,
  shopScaling: 1,
  mastermindTier: 0,
};

export const ADVANTAGE_PERKS: Record<AdvantageLevel, SideAdvantage> = {
  high: { startGold: 50, bonusPicks: 1, shopScaling: 0, mastermindTier: 3 },
  medium: { startGold: 20, bonusPicks: 1, shopScaling: 0.5, mastermindTier: 2 },
  low: { startGold: 0, bonusPicks: 1, shopScaling: 1, mastermindTier: 1 },
};

/** White's strongest edge to Black's, left to right. */
export const ADVANTAGE_OPTIONS: AdvantageSetting[] = [
  "white-high",
  "white-medium",
  "white-low",
  "neutral",
  "black-low",
  "black-medium",
  "black-high",
];

export function parseAdvantage(
  setting: AdvantageSetting,
): { color: PlayerColor; level: AdvantageLevel } | null {
  if (setting === "neutral") return null;
  const [color, level] = setting.split("-") as [PlayerColor, AdvantageLevel];
  return { color, level };
}

export function sideAdvantage(setting: AdvantageSetting, color: PlayerColor): SideAdvantage {
  const parsed = parseAdvantage(setting);
  return parsed && parsed.color === color ? ADVANTAGE_PERKS[parsed.level] : NO_ADVANTAGE;
}

export function isAdvantageSetting(v: unknown): v is AdvantageSetting {
  return typeof v === "string" && (ADVANTAGE_OPTIONS as string[]).includes(v);
}

const MASTERMIND_NAMES = ["", "Mastermind", "Mastermind+", "Mastermind++"] as const;

/** Human-readable perk list for the start screen. */
export function describePerks(perks: SideAdvantage, tr: boolean): string[] {
  const out: string[] = [];
  if (perks.startGold > 0) {
    out.push(tr ? `${perks.startGold} altınla başla` : `Start with ${perks.startGold} gold`);
  }
  if (perks.bonusPicks > 0) {
    out.push(
      tr
        ? `+${perks.bonusPicks} bonus augment seçimi`
        : `+${perks.bonusPicks} bonus augment pick`,
    );
  }
  if (perks.shopScaling === 0) {
    out.push(tr ? "Dükkan fiyatı artmaz" : "No shop price increase");
  } else if (perks.shopScaling < 1) {
    const pct = Math.round((1 - perks.shopScaling) * 100);
    out.push(
      tr ? `Dükkan fiyat artışı %${pct} daha az` : `Shop price increase ${pct}% lower`,
    );
  }
  if (perks.mastermindTier > 0) {
    const name = MASTERMIND_NAMES[perks.mastermindTier];
    out.push(tr ? `${name} zar şansı` : `${name} roll odds`);
  }
  return out;
}
