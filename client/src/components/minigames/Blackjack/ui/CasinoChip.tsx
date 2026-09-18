import type { CSSProperties } from "react";
import type { ChipDef, ChipPile } from "../chips";

function chipVars(chip: ChipDef, size: number): CSSProperties {
  return {
    "--bj-chip-size": `${size}px`,
    "--bj-chip-light": chip.light,
    "--bj-chip-base": chip.base,
    "--bj-chip-dark": chip.dark,
    "--bj-chip-spot": chip.spot,
    "--bj-chip-text": chip.text,
    "--bj-chip-glow": chip.glow,
  } as CSSProperties;
}

function ChipBody({ chip, showValue }: { chip: ChipDef; showValue: boolean }) {
  return (
    <>
      <span className="bj-chip__edge" />
      <span className="bj-chip__face">
        <span className="bj-chip__ring" />
        {showValue && <span className="bj-chip__value">{chip.label}</span>}
      </span>
    </>
  );
}

export function CasinoChip({
  chip,
  size = 46,
  onClick,
  disabled = false,
  title,
}: {
  chip: ChipDef;
  size?: number;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  if (!onClick) {
    return (
      <span className="bj-chip" style={chipVars(chip, size)} aria-hidden>
        <ChipBody chip={chip} showValue={size >= 26} />
      </span>
    );
  }
  return (
    <button
      type="button"
      className="bj-chip"
      style={chipVars(chip, size)}
      onClick={onClick}
      disabled={disabled}
      title={title ?? `Bet ${chip.value.toLocaleString("en-US")}`}
      aria-label={`Bet ${chip.value.toLocaleString("en-US")} chips`}
    >
      <ChipBody chip={chip} showValue />
    </button>
  );
}

/** A wagered pile: up to five chips drawn stacked, with a count underneath. */
export function ChipStack({ pile, size = 30 }: { pile: ChipPile; size?: number }) {
  const drawn = Math.min(pile.count, 5);
  return (
    <div className="bj-stack">
      {Array.from({ length: drawn }, (_, i) => (
        <span
          key={i}
          className="bj-chip bj-stack__chip"
          style={{ ...chipVars(pile.chip, size), "--bj-stack-delay": `${i * 0.05}s` } as CSSProperties}
        >
          <ChipBody chip={pile.chip} showValue={i === drawn - 1} />
        </span>
      ))}
      {pile.count > 1 && <span className="bj-stack__count">×{pile.count}</span>}
    </div>
  );
}
