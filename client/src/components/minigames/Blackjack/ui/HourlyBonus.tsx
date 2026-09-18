import { useEffect, useState } from "react";
import {
  HOURLY_BONUS_AMOUNT,
  HOURLY_BONUS_INTERVAL_MS,
  hourlyBonusReadyAt,
  useChips,
} from "@/lib/stores/useChips";
import { formatChips } from "../chips";

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Corner widget: claims 1,000 chips once an hour and counts down in between. */
export function HourlyBonus({ onClaim }: { onClaim?: (amount: number) => void }) {
  const lastHourlyBonusAt = useChips((s) => s.lastHourlyBonusAt);
  const claimHourlyBonus = useChips((s) => s.claimHourlyBonus);
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(false), 1600);
    return () => window.clearTimeout(id);
  }, [flash]);

  const readyAt = hourlyBonusReadyAt(lastHourlyBonusAt);
  const remaining = Math.max(0, readyAt - now);
  const ready = remaining === 0;
  const progress = ready
    ? 1
    : 1 - remaining / HOURLY_BONUS_INTERVAL_MS;

  const claim = () => {
    const amount = claimHourlyBonus();
    if (amount === null) return;
    setFlash(true);
    onClaim?.(amount);
  };

  const body = (
    <>
      <span className="bj-bonus__icon" aria-hidden>
        {ready ? "🎁" : "⏳"}
      </span>
      <span className="bj-bonus__text">
        <span className="bj-bonus__label">
          {ready ? "Hourly bonus" : "Next bonus"}
        </span>
        <span className="bj-bonus__value">
          {ready ? `Claim ${formatChips(HOURLY_BONUS_AMOUNT)}` : formatCountdown(remaining)}
        </span>
      </span>
      {!ready && (
        <span className="bj-bonus__bar">
          <span
            className="bj-bonus__bar-fill"
            style={{ width: `${Math.min(100, progress * 100).toFixed(2)}%` }}
          />
        </span>
      )}
      {flash && (
        <span className="bj-bonus__flash">+{formatChips(HOURLY_BONUS_AMOUNT)}</span>
      )}
    </>
  );

  if (!ready) {
    return (
      <div className="bj-bonus" title="A free 1,000 chip bonus unlocks every hour">
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="bj-bonus bj-bonus--ready"
      onClick={claim}
      title="Claim your free hourly chips"
    >
      {body}
    </button>
  );
}
