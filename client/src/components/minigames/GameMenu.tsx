import { useNavigate } from "react-router-dom";
import GameHeader from "./GameHeader";
import { useAudio } from "@/lib/stores/useAudio";
import { useChips } from "@/lib/stores/useChips";
import { useMinigames, type GameType } from "@/lib/stores/useMinigames";
import { usePresence } from "@/hooks/usePresence";
import { useEffect, type CSSProperties } from "react";
import { ArrowRight, Bot, Globe2, Sparkles, UsersRound } from "lucide-react";

const GAME_ACCENTS: Record<string, { from: string; to: string; tagline: string }> = {
  "speed-typer": { from: "#38bdf8", to: "#6366f1", tagline: "Fingers of fury" },
  barricade: { from: "#f97316", to: "#ef4444", tagline: "Block, bluff, break through" },
  blackjack: { from: "#22c55e", to: "#0f766e", tagline: "Hit me. Gently." },
  "reaction-test": { from: "#facc15", to: "#f97316", tagline: "Blink and you lose" },
};

const FALLBACK_ACCENT = { from: "#a78bfa", to: "#6366f1", tagline: "Give it a spin" };

const HERO_PIECES: { glyph: string; style: CSSProperties }[] = [
  { glyph: "♛", style: { left: "6%", top: "10%", fontSize: 64, "--hub-tilt": "-10deg", "--hub-delay": "0s" } as CSSProperties },
  { glyph: "♞", style: { right: "8%", top: "6%", fontSize: 54, "--hub-tilt": "12deg", "--hub-delay": "1.2s" } as CSSProperties },
  { glyph: "♜", style: { right: "18%", bottom: "8%", fontSize: 42, "--hub-tilt": "-6deg", "--hub-delay": "2.1s" } as CSSProperties },
];

function MiniBoard() {
  const pieces: Record<number, string> = {
    3: "♚", 10: "♟", 13: "♟", 18: "♞", 27: "♙", 36: "♘", 44: "♙", 51: "♙", 59: "♔", 21: "♝", 42: "♗",
  };
  return (
    <div className="relative aspect-square w-full max-w-[220px] rotate-[-4deg] rounded-xl bg-gradient-to-br from-[#6b4423] to-[#24140a] p-1.5 shadow-[0_24px_50px_rgba(0,0,0,0.6),0_0_0_1px_rgba(231,192,99,0.35)] transition-transform duration-500 group-hover:rotate-0 group-hover:scale-[1.03]">
      <div className="grid h-full w-full grid-cols-8 overflow-hidden rounded-md">
        {Array.from({ length: 64 }, (_, i) => {
          const dark = (Math.floor(i / 8) + i) % 2 === 1;
          const glyph = pieces[i];
          const white = glyph && "♔♕♖♗♘♙".includes(glyph);
          return (
            <div
              key={i}
              className="flex items-center justify-center text-[clamp(12px,2.2vw,20px)] leading-none"
              style={{ background: dark ? "#b58863" : "#f0d9b5" }}
            >
              {glyph && (
                <span
                  style={{
                    color: white ? "#fff" : "#1a0f00",
                    textShadow: white ? "0 0 2px #000, 0 1px 1px #000" : "0 0 2px rgba(255,255,255,0.7)",
                  }}
                >
                  {glyph}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <span className="absolute -right-3 -top-3 rounded-full border border-amber-200/60 bg-gradient-to-b from-amber-300 to-amber-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#1a1204] shadow-lg">
        +Augments
      </span>
    </div>
  );
}

const HeroChessCard = () => {
  const navigate = useNavigate();
  const { playHit } = useAudio();

  const tags = [
    { icon: Sparkles, label: "Roguelike augments" },
    { icon: Bot, label: "Vs Stockfish" },
    { icon: Globe2, label: "Online" },
    { icon: UsersRound, label: "2v2 teams" },
  ];

  return (
    <button
      type="button"
      onClick={() => { playHit(); navigate("/minigames/chess"); }}
      className="hub-shine hub-rise group relative w-full overflow-hidden rounded-3xl border border-amber-300/20 bg-gradient-to-br from-[#16122a] via-[#0b0f1f] to-[#07090f] p-6 text-left shadow-[0_30px_80px_rgba(0,0,0,0.55)] transition-all duration-300 hover:-translate-y-1 hover:border-amber-300/45 hover:shadow-[0_36px_90px_rgba(0,0,0,0.6),0_0_60px_rgba(231,192,99,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:p-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_85%_40%,rgba(231,192,99,0.14),transparent_70%),radial-gradient(50%_70%_at_10%_0%,rgba(139,92,246,0.18),transparent_70%)]" />
      {HERO_PIECES.map((p) => (
        <span
          key={p.glyph}
          aria-hidden
          className="hub-float pointer-events-none absolute select-none text-white/[0.05]"
          style={p.style}
        >
          {p.glyph}
        </span>
      ))}

      <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
        <div className="flex max-w-md flex-col items-center gap-3 text-center sm:items-start sm:text-left">
          <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.24em] text-amber-200">
            ★ Featured
          </span>
          <h2 className="m-0 text-4xl font-black leading-[0.95] tracking-tight text-white sm:text-5xl">
            Chess
            <span className="block bg-gradient-to-b from-amber-100 via-amber-300 to-amber-600 bg-clip-text text-transparent">
              Augmented
            </span>
          </h2>
          <p className="m-0 text-sm leading-relaxed text-slate-400">
            Classic chess, roguelike chaos. Draft powers, hoard gold, bid on mercenaries and survive the board events.
          </p>
          <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
            {tags.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10.5px] font-bold text-slate-300"
              >
                <Icon className="h-3 w-3 text-amber-300" aria-hidden />
                {label}
              </span>
            ))}
          </div>
          <span className="mt-1 inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 px-6 py-2.5 text-sm font-black uppercase tracking-[0.14em] text-[#1a1204] shadow-[0_10px_28px_rgba(231,192,99,0.35)] transition-transform group-hover:translate-x-0.5">
            Play now
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
            v1.3.1.0 · "Turkish added"
          </span>
        </div>
        <div className="w-[180px] shrink-0 sm:w-[220px]">
          <MiniBoard />
        </div>
      </div>
    </button>
  );
};

const GameCard = ({ game, index }: { game: GameType; index: number }) => {
  const navigate = useNavigate();
  const { playHit } = useAudio();
  const accent = GAME_ACCENTS[game.id] ?? FALLBACK_ACCENT;

  const openGame = () => {
    playHit();
    navigate(`/minigames/${game.id}`);
  };

  return (
    <button
      type="button"
      onClick={openGame}
      className="hub-shine hub-rise group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0a0e1a]/90 p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
      style={{ "--hub-delay": `${0.08 + index * 0.06}s` } as CSSProperties}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-25 blur-2xl transition-opacity duration-300 group-hover:opacity-50"
        style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
      />
      <span
        className="relative flex h-12 w-12 items-center justify-center rounded-2xl text-2xl shadow-[0_10px_24px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"
        style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
      >
        {game.icon}
      </span>
      <span className="relative flex flex-col gap-1">
        <span className="text-[15px] font-black tracking-tight text-white">{game.title}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: accent.from }}>
          {accent.tagline}
        </span>
        <span className="line-clamp-2 text-[12px] leading-snug text-slate-500">{game.description}</span>
      </span>
      <span className="relative mt-auto inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400 transition-colors group-hover:text-white">
        Play <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
      </span>
    </button>
  );
};

const GameMenu = () => {
  const { backgroundMusic, isMuted } = useAudio();
  const chips = useChips((s) => s.chips);
  const onlineCount = usePresence();
  const { games } = useMinigames();

  const otherGames = games.filter(g => g.isAvailable && g.id !== "chess");
  const comingSoon = games.filter(g => !g.isAvailable);

  useEffect(() => {
    if (backgroundMusic && !isMuted) {
      backgroundMusic.play().catch(() => {});
    }
    return () => {
      if (backgroundMusic) backgroundMusic.pause();
    };
  }, [backgroundMusic, isMuted]);

  useEffect(() => {
    if (backgroundMusic) {
      if (isMuted) backgroundMusic.pause();
      else backgroundMusic.play().catch(() => {});
    }
  }, [isMuted, backgroundMusic]);

  const stats = [
    { label: "Games", value: String(games.filter((g) => g.isAvailable).length) },
    { label: "Your chips", value: chips.toLocaleString() },
    { label: "Online now", value: onlineCount === null ? "—" : String(onlineCount) },
  ];

  return (
    <div className="hub-backdrop flex h-full flex-col overflow-y-auto text-white">
      <GameHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:py-10">
        <section className="hub-rise flex flex-col items-center gap-4 text-center">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.32em] text-amber-300/80">
            Hemen tıkla, oynamaya başla!
          </span>
          <h1 className="m-0 text-4xl font-black tracking-tight text-white sm:text-6xl">
            Pick a game.
            <span className="block bg-gradient-to-r from-indigo-300 via-violet-300 to-amber-200 bg-clip-text text-transparent">
              Lose track of time.
            </span>
          </h1>
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            {stats.map((s) => (
              <div
                key={s.label}
                className="flex min-w-[104px] flex-col items-center rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 backdrop-blur"
              >
                <span className="text-xl font-black tabular-nums text-white">{s.value}</span>
                <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-slate-500">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        <HeroChessCard />

        {otherGames.length > 0 && (
          <section className="flex flex-col gap-4">
            <div className="flex items-end justify-between">
              <div>
                <h3 className="m-0 text-lg font-black tracking-tight text-white">More games</h3>
                <p className="m-0 text-xs text-slate-500">Quick hits for when chess gets too serious.</p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
                {otherGames.length} ready
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {otherGames.map((game, i) => (
                <GameCard key={game.id} game={game} index={i} />
              ))}
            </div>
          </section>
        )}

        {comingSoon.length > 0 && (
          <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-4 py-5 text-center">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-slate-500">
              In the oven
            </span>
            <div className="flex flex-wrap justify-center gap-1.5">
              {comingSoon.map((g) => (
                <span
                  key={g.id}
                  className="flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-slate-500"
                >
                  <span className="grayscale">{g.icon}</span>
                  {g.title}
                </span>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-white/[0.05] py-4 text-center">
        <p className="m-0 text-[11px] text-slate-600">
          © {new Date().getFullYear()} Minigame Hub · Fun games · Play anytime · Quick challenges
        </p>
      </footer>
    </div>
  );
};

export default GameMenu;
