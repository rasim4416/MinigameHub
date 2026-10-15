import { useState, type CSSProperties } from "react";
import {
  BookOpen,
  Bot,
  Crown,
  Globe2,
  Monitor,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Language } from "../../../lib/language";
import { LANGUAGES } from "../../../lib/language";
import ChessGame from "./ChessGame";
import TutorialChess from "./TutorialChess";
import MultiplayerChess from "./MultiplayerChess";
import TeamMultiplayerChess from "./TeamMultiplayerChess";
import { ChessLanguageProvider } from "./ChessLanguageContext";
import { ChessErrorBoundary } from "./ui/ChessErrorBoundary";
import { AugmentGuide } from "./tutorial/AugmentGuide";

type Mode = "local" | "bot" | "online" | "team2v2" | "tutorial";

function LanguageToggle({
  language,
  onChange,
}: {
  language: Language;
  onChange: (lang: Language) => void;
}) {
  const tr = language === "türkçe";

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">
        {tr ? "Dil" : "Language"}
      </span>
      <div className="flex overflow-hidden rounded-md border border-slate-700 bg-slate-950/70">
        {LANGUAGES.map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => onChange(lang)}
            aria-pressed={lang === language}
            className={`px-2.5 py-1 text-[10px] font-extrabold tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-inset ${
              lang === language
                ? "bg-amber-300 text-slate-950"
                : "text-slate-500 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {lang === "english" ? "EN" : "TR"}
          </button>
        ))}
      </div>
    </div>
  );
}

const MODE_ACCENTS: Record<Mode, string> = {
  tutorial: "linear-gradient(135deg,#fbbf24,#b45309)",
  local: "linear-gradient(135deg,#60a5fa,#4338ca)",
  bot: "linear-gradient(135deg,#f472b6,#9333ea)",
  online: "linear-gradient(135deg,#34d399,#0f766e)",
  team2v2: "linear-gradient(135deg,#fb923c,#dc2626)",
};

type MenuItem = {
  mode: Mode;
  icon: LucideIcon;
  title: string;
  description: string;
};

export default function ChessHub() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [language, setLanguage] = useState<Language>("english");
  const [guideOpen, setGuideOpen] = useState(false);
  const tr = language === "türkçe";

  const menuItems: MenuItem[] = [
    {
      mode: "tutorial",
      icon: BookOpen,
      title: tr ? "Eğitim" : "Tutorial",
      description: tr
        ? "Augmentleri ve temel akışı öğren"
        : "Learn the ropes before you rope the king",
    },
    {
      mode: "local",
      icon: Monitor,
      title: tr ? "Yerel Oyun" : "Local Game",
      description: tr ? "Aynı cihazda iki oyuncu" : "Two players, one screen, zero trust",
    },
    {
      mode: "bot",
      icon: Bot,
      title: tr ? "Bota Karşı" : "Vs Bot",
      description: tr ? "Stockfish'e karşı oyna" : "Challenge Stockfish. It doesn't blink.",
    },
    {
      mode: "online",
      icon: Globe2,
      title: tr ? "Çevrimiçi" : "Online",
      description: tr ? "Bir arkadaşınla eşleş" : "Share a room code, settle a rivalry",
    },
    {
      mode: "team2v2",
      icon: UsersRound,
      title: tr ? "2v2 Takım" : "2v2 Team",
      description: tr ? "Dört oyuncu, ortak strateji" : "Four players, two kings, no chill",
    },
  ];

  return (
    <ChessLanguageProvider language={language}>
      {mode === "tutorial" && (
        <ChessErrorBoundary>
          <TutorialChess onBack={() => setMode(null)} />
        </ChessErrorBoundary>
      )}
      {mode === "local" && (
        <ChessErrorBoundary>
          <div className="flex min-h-[min(720px,calc(100dvh-8rem))] w-full flex-col">
            <ChessGame />
          </div>
        </ChessErrorBoundary>
      )}
      {mode === "bot" && (
        <ChessErrorBoundary>
          <div className="flex min-h-[min(720px,calc(100dvh-8rem))] w-full flex-col">
            <ChessGame botMode />
          </div>
        </ChessErrorBoundary>
      )}
      {mode === "online" && (
        <MultiplayerChess onBack={() => setMode(null)} />
      )}
      {mode === "team2v2" && (
        <TeamMultiplayerChess onBack={() => setMode(null)} />
      )}
      {mode === null && (
        <div className="relative flex min-h-[min(720px,calc(100dvh-5.5rem))] w-full items-center justify-center overflow-hidden bg-[radial-gradient(70%_50%_at_50%_0%,rgba(231,192,99,0.12),transparent_70%),linear-gradient(180deg,#060914,#04060d)] px-4 py-8 text-slate-100 sm:px-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-[-20%] bottom-[-25%] h-[60%] [background-image:conic-gradient(rgba(240,217,181,0.07)_25%,rgba(181,136,99,0.04)_0_50%,rgba(240,217,181,0.07)_0_75%,rgba(181,136,99,0.04)_0)] [background-size:88px_88px] [mask-image:linear-gradient(180deg,transparent,#000_35%,transparent_95%)] [transform:perspective(520px)_rotateX(58deg)] [transform-origin:50%_0]"
          />
          <main className="relative w-full max-w-4xl">
            <header className="hub-rise mb-6 flex flex-col items-center gap-5 text-center sm:flex-row sm:items-end sm:justify-between sm:text-left">
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-300/40 bg-gradient-to-br from-amber-300/25 to-amber-900/10 text-amber-200 shadow-[0_12px_32px_rgba(231,192,99,0.2)]">
                  <Crown size={30} strokeWidth={1.8} aria-hidden />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-center gap-2 sm:justify-start">
                    <span className="text-[10px] font-extrabold uppercase tracking-[.26em] text-amber-300">
                      {tr ? "Satranç" : "Chess"}
                    </span>
                    <span className="h-1 w-1 rounded-full bg-slate-600" />
                    <span className="text-[10px] font-bold uppercase tracking-[.26em] text-slate-500">
                      v1.0.1
                    </span>
                  </div>
                  <h2 className="m-0 text-3xl font-black tracking-tight text-slate-50 sm:text-4xl">
                    Chess{" "}
                    <span className="bg-gradient-to-b from-amber-100 via-amber-300 to-amber-600 bg-clip-text text-transparent">
                      Augmented
                    </span>
                  </h2>
                  <p className="mt-1.5 mb-0 max-w-md text-sm italic leading-relaxed text-slate-400">
                    {tr
                      ? "Aynı tahta, yeni kurallar. Şahını hazırla."
                      : "Same board, new rules. Mind your king — and your wallet."}
                  </p>
                </div>
              </div>
              <LanguageToggle language={language} onChange={setLanguage} />
            </header>

            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <h3 className="m-0 text-[11px] font-extrabold uppercase tracking-[.22em] text-slate-400">
                {tr ? "Oyun modu seç" : "Choose your battlefield"}
              </h3>
              <span className="hidden text-[10px] font-bold uppercase tracking-[.16em] text-slate-600 sm:block">
                {tr ? "5 mod" : "5 modes"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {menuItems.map(
                ({ mode: itemMode, icon: Icon, title, description }, index) => {
                  const accent = MODE_ACCENTS[itemMode];
                  return (
                    <button
                      key={itemMode}
                      type="button"
                      onClick={() => setMode(itemMode)}
                      className="hub-shine hub-rise group relative flex min-h-[104px] items-center gap-3.5 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0a0e1b]/90 p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                      style={{ "--hub-delay": `${index * 0.05}s` } as CSSProperties}
                    >
                      <span
                        aria-hidden
                        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-45"
                        style={{ background: accent }}
                      />
                      <span
                        className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-[0_10px_22px_rgba(0,0,0,0.45)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"
                        style={{ background: accent }}
                      >
                        <Icon size={22} strokeWidth={2} aria-hidden />
                      </span>
                      <span className="relative min-w-0">
                        <span className="block text-[15px] font-black tracking-tight text-slate-50">
                          {title}
                        </span>
                        <span className="mt-1 block text-[12px] leading-snug text-slate-500 group-hover:text-slate-400">
                          {description}
                        </span>
                      </span>
                    </button>
                  );
                },
              )}
              <button
                type="button"
                onClick={() => setGuideOpen((open) => !open)}
                aria-expanded={guideOpen}
                className={`hub-shine hub-rise group relative flex min-h-[104px] items-center gap-3.5 overflow-hidden rounded-2xl border border-dashed p-4 text-left transition-all duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                  guideOpen
                    ? "border-amber-300/60 bg-amber-300/[0.08]"
                    : "border-amber-300/25 bg-[#0a0e1b]/70 hover:border-amber-300/50"
                }`}
                style={{ "--hub-delay": "0.25s" } as CSSProperties}
              >
                <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-300/40 bg-amber-300/10 text-amber-200">
                  <Sparkles size={22} strokeWidth={2} aria-hidden />
                </span>
                <span className="relative min-w-0">
                  <span className="block text-[15px] font-black tracking-tight text-slate-50">
                    {tr ? "Augment rehberi" : "Augment guide"}
                  </span>
                  <span className="mt-1 block text-[12px] leading-snug text-slate-500 group-hover:text-slate-400">
                    {tr
                      ? "Tüm augmentleri ve nadirlikleri keşfet"
                      : "Every power, every rarity, zero spoilers held back"}
                  </span>
                </span>
              </button>
            </div>

            {guideOpen && (
              <div className="mt-3 rounded-2xl border border-amber-300/20 bg-slate-950/70 p-2.5 backdrop-blur sm:p-3">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold uppercase tracking-[.16em] text-amber-300">
                    {tr ? "Augment kütüphanesi" : "Augment library"}
                  </span>
                  <BookOpen size={14} className="text-slate-500" aria-hidden />
                </div>
                <AugmentGuide />
              </div>
            )}
          </main>
        </div>
      )}
    </ChessLanguageProvider>
  );
}