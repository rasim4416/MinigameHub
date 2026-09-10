import { useState } from "react";
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
        : "Learn augments and the core loop",
    },
    {
      mode: "local",
      icon: Monitor,
      title: tr ? "Yerel Oyun" : "Local Game",
      description: tr ? "Aynı cihazda iki oyuncu" : "Two players, one device",
    },
    {
      mode: "bot",
      icon: Bot,
      title: tr ? "Bota Karşı" : "Vs Bot",
      description: tr ? "Stockfish'e karşı oyna" : "Play against Stockfish",
    },
    {
      mode: "online",
      icon: Globe2,
      title: tr ? "Çevrimiçi" : "Online",
      description: tr ? "Bir arkadaşınla eşleş" : "Match with a friend",
    },
    {
      mode: "team2v2",
      icon: UsersRound,
      title: tr ? "2v2 Takım" : "2v2 Team",
      description: tr ? "Dört oyuncu, ortak strateji" : "Four players, one strategy",
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
        <div className="flex min-h-[min(720px,calc(100dvh-8rem))] w-full items-center justify-center overflow-y-auto bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
          <main className="w-full max-w-4xl">
            <header className="mb-5 flex flex-col gap-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/40 sm:flex-row sm:items-end sm:justify-between sm:p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-amber-400/30 bg-amber-300/10 p-2.5 text-amber-300">
                  <Crown size={22} strokeWidth={1.8} aria-hidden />
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[.2em] text-amber-300">
                      Chess
                    </span>
                    <span className="text-[10px] text-slate-600">/</span>
                    <span className="text-[10px] font-bold uppercase tracking-[.2em] text-slate-500">
                      Augmented
                    </span>
                    <span className="text-[10px] text-slate-600">v1.0.1</span>
                  </div>
                  <h2 className="m-0 text-2xl font-black tracking-tight text-slate-50 sm:text-3xl">
                    Chess Augmented
                  </h2>
                  <p className="mt-1.5 mb-0 max-w-md text-sm leading-relaxed text-slate-400">
                    {tr
                      ? "Satranç stratejisini augmentler ve büyülerle yeniden kur."
                      : "Rebuild chess strategy with augments and spells."}
                  </p>
                </div>
              </div>
              <LanguageToggle language={language} onChange={setLanguage} />
            </header>

            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div>
                <h3 className="m-0 text-xs font-extrabold uppercase tracking-[.18em] text-slate-300">
                  {tr ? "Oyun seç" : "Choose a mode"}
                </h3>
                <p className="mt-1 mb-0 text-xs text-slate-500">
                  {tr
                    ? "Bir deneyim seç ve oyuna başla."
                    : "Pick an experience and start playing."}
                </p>
              </div>
              <span className="hidden text-[10px] font-bold uppercase tracking-[.16em] text-slate-600 sm:block">
                {tr ? "5 seçenek" : "5 modes"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {menuItems.map(
                ({ mode: itemMode, icon: Icon, title, description }, index) => (
                  <button
                    key={itemMode}
                    type="button"
                    onClick={() => setMode(itemMode)}
                    className={`group flex min-h-[92px] items-center gap-3 rounded-xl border p-3.5 text-left transition-[border-color,background-color,transform] hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                      index === 0
                        ? "border-amber-400/50 bg-amber-300/[0.08] hover:border-amber-300 hover:bg-amber-300/[0.13]"
                        : "border-slate-800 bg-slate-900/60 hover:border-slate-600 hover:bg-slate-800/80"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                        index === 0
                          ? "border-amber-400/30 bg-amber-300/10 text-amber-300"
                          : "border-slate-700 bg-slate-950/60 text-slate-400 group-hover:border-slate-500 group-hover:text-slate-200"
                      }`}
                    >
                      <Icon size={19} strokeWidth={1.8} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-100">
                        {title}
                      </span>
                      <span className="mt-1 block text-[11px] leading-snug text-slate-500 group-hover:text-slate-400">
                        {description}
                      </span>
                    </span>
                  </button>
                ),
              )}
              <button
                type="button"
                onClick={() => setGuideOpen((open) => !open)}
                aria-expanded={guideOpen}
                className={`group flex min-h-[92px] items-center gap-3 rounded-xl border p-3.5 text-left transition-[border-color,background-color,transform] hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                  guideOpen
                    ? "border-amber-400/60 bg-amber-300/[0.1]"
                    : "border-slate-800 bg-slate-900/60 hover:border-amber-400/50 hover:bg-slate-800/80"
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-300/10 text-amber-300">
                  <Sparkles size={19} strokeWidth={1.8} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-100">
                    {tr ? "Augment rehberi" : "Augment guide"}
                  </span>
                  <span className="mt-1 block text-[11px] leading-snug text-slate-500 group-hover:text-slate-400">
                    {tr
                      ? "Tüm augmentleri ve nadirlikleri keşfet"
                      : "Explore every augment and rarity tier"}
                  </span>
                </span>
              </button>
            </div>

            {guideOpen && (
              <div className="mt-3 rounded-2xl border border-amber-400/20 bg-slate-900/50 p-2.5 sm:p-3">
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