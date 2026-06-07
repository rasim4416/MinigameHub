import { useState } from "react";
import { chessShell } from "../chessTheme";

export function StartScreen({ onStart }: { onStart: () => void }) {
  const [hov, setHov] = useState(false);

  return (
    <div className={chessShell.overlay}>
      <div className="mb-1 grid grid-cols-4 gap-px opacity-15">
        {Array.from({ length: 16 }, (_, i) => (
          <div
            key={i}
            className="h-2.5 w-2.5"
            style={{
              background:
                (Math.floor(i / 4) + i) % 2 === 0 ? "#f0d9b5" : "#b58863",
            }}
          />
        ))}
      </div>
      <span className="text-5xl drop-shadow-[0_4px_16px_rgba(99,102,241,0.4)]">
        ♟️
      </span>
      <div className="text-center">
        <h2 className="mb-1.5 text-[22px] font-black tracking-wide text-slate-100">
          Chess Augmented
        </h2>
        <p className="m-0 text-xs leading-relaxed text-slate-500">
          Classic chess · Each player picks an augment
          <br />
          before the game begins
        </p>
      </div>
      <button
        type="button"
        onClick={onStart}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        className={`rounded-xl px-11 py-2.5 text-sm font-extrabold uppercase tracking-widest text-white transition-all ${
          hov
            ? "-translate-y-0.5 bg-gradient-to-br from-indigo-700 to-indigo-500 shadow-[0_6px_28px_rgba(99,102,241,0.65)]"
            : "bg-gradient-to-br from-indigo-600 to-indigo-400 shadow-[0_4px_18px_rgba(99,102,241,0.45)]"
        }`}
      >
        Start Game
      </button>
    </div>
  );
}
