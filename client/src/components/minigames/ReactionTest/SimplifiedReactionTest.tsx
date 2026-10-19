import React, { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Coins, Crown, Crosshair, Flag, Grid2x2, Hand, Pause, Play,
  RotateCcw, Sparkles, Timer, Trophy, Zap,
} from 'lucide-react';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import './reaction-test.css';
import { useAudio } from '@/lib/stores/useAudio';
import { useChips } from '@/lib/stores/useChips';
import type { Language } from '@/lib/language';
import {
  DEFAULT_SETTINGS, GAME_MODES, SUBSETTINGS, type GameMode, type Settings,
  formatBest, gradeFor, lowerIsBetter, modeAccent, modeName, modePun, modeRules,
  optLabel, randomTagline, subLabel, t,
} from './reactionTestCopy';
import type { LiveStat, ModeResult } from './timing';
import ClassicFlash from './modes/ClassicFlash';
import AimSnap from './modes/AimSnap';
import GoNoGo from './modes/GoNoGo';
import SequenceEcho from './modes/SequenceEcho';

type Phase = 'lobby' | 'playing' | 'over';

const PREFS_KEY = 'reactionTest.prefs.v1';
const BEST_KEY = 'reactionTest.best.v1';

const MODE_ICONS: Record<GameMode, typeof Zap> = {
  classic: Zap,
  aim: Crosshair,
  gonogo: Hand,
  sequence: Grid2x2,
};

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
};

interface Prefs {
  language: Language;
  mode: GameMode;
  settings: Settings;
}

const SimplifiedReactionTest: React.FC = () => {
  const navigate = useNavigate();
  const { playSuccess } = useAudio();
  const { addChips } = useChips();

  const prefs = useMemo(() => {
    const p = readJson<Prefs>(PREFS_KEY, { language: 'english', mode: 'classic', settings: DEFAULT_SETTINGS });
    const settings = { ...DEFAULT_SETTINGS };
    for (const m of GAME_MODES) settings[m] = { ...DEFAULT_SETTINGS[m], ...p.settings?.[m] } as never;
    return { ...p, mode: GAME_MODES.includes(p.mode) ? p.mode : 'classic', settings } as Prefs;
  }, []);

  const [language, setLanguage] = useState<Language>(prefs.language);
  const [gameMode, setGameMode] = useState<GameMode>(prefs.mode);
  const [settings, setSettings] = useState<Settings>(prefs.settings);
  const [best, setBest] = useState<Record<GameMode, number>>(() =>
    readJson(BEST_KEY, { classic: 0, aim: 0, gonogo: 0, sequence: 0 }),
  );
  const tagline = useMemo(() => randomTagline(language), [language]);

  const [phase, setPhase] = useState<Phase>('lobby');
  const [isPaused, setIsPaused] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [live, setLive] = useState<LiveStat[]>([]);
  const [result, setResult] = useState<(ModeResult & { newBest: boolean }) | null>(null);
  const overAtRef = useRef(0);

  const accent = modeAccent(gameMode);

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ language, mode: gameMode, settings }));
  }, [language, gameMode, settings]);

  const startGame = useCallback(() => {
    setResult(null);
    setLive([]);
    setIsPaused(false);
    setRunKey((k) => k + 1);
    setPhase('playing');
  }, []);

  const finish = useCallback(
    (r: ModeResult) => {
      overAtRef.current = Date.now();
      const prev = best[gameMode] ?? 0;
      const better = lowerIsBetter(gameMode) ? r.bestValue < prev : r.bestValue > prev;
      const newBest = r.bestValue > 0 && (prev === 0 || better);
      if (newBest) {
        const next = { ...best, [gameMode]: r.bestValue };
        setBest(next);
        localStorage.setItem(BEST_KEY, JSON.stringify(next));
      }
      if (r.chips > 0) addChips(r.chips);
      playSuccess();
      setResult({ ...r, newBest });
      setIsPaused(false);
      setPhase('over');
    },
    [best, gameMode, addChips, playSuccess],
  );

  const quit = useCallback(() => {
    setIsPaused(false);
    setPhase('lobby');
  }, []);

  const togglePause = useCallback(() => {
    if (phase === 'playing') setIsPaused((p) => !p);
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'playing') {
        if (e.key === 'Escape') {
          e.preventDefault();
          togglePause();
        }
        return;
      }
      if (e.key === 'Enter' && !e.repeat) {
        e.preventDefault();
        if (phase === 'over' && Date.now() - overAtRef.current < 900) return;
        startGame();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, togglePause, startGame]);

  const setSub = (key: string, value: string | number) =>
    setSettings((s) => ({ ...s, [gameMode]: { ...s[gameMode], [key]: value } }));

  const stageStyle = { '--rt-from': accent.from, '--rt-to': accent.to } as CSSProperties;
  const ModeIcon = MODE_ICONS[gameMode];
  const modeProps = { language, paused: isPaused, onLive: setLive, onFinish: finish };

  return (
    <div className="rt" style={stageStyle}>
      <header className="rt-hud">
        <div className="rt-hud__left">
          <button
            type="button"
            className="rt-icon-btn"
            onClick={phase === 'playing' ? quit : () => navigate('/minigames')}
            title={phase === 'playing' ? t('Quit run', 'Bitir', language) : t('Back to games', 'Oyunlara dön', language)}
          >
            {phase === 'playing' ? <Flag size={15} /> : <ChevronLeft size={16} />}
          </button>
          <div className="rt-hud__mode">
            <span className="rt-hud__mode-icon"><ModeIcon size={15} /></span>
            <div className="rt-hud__mode-text">
              <span className="rt-hud__eyebrow">Reaction Test</span>
              <span className="rt-hud__mode-name">{modeName(gameMode, language)}</span>
            </div>
          </div>
        </div>

        {phase === 'playing' ? (
          <div className="rt-hud__stats">
            {live.map((s, i) => (
              <div
                key={s.label}
                className={`rt-stat${s.tone && s.tone !== 'plain' ? ` rt-stat--${s.tone}` : ''}${i > 1 ? ' rt-hide-sm' : ''}`}
              >
                <span className="rt-stat__label">{s.label}</span>
                <span className="rt-stat__value">{s.value}</span>
              </div>
            ))}
            <button type="button" className="rt-icon-btn" onClick={togglePause} title={t('Pause (Esc)', 'Duraklat (Esc)', language)}>
              {isPaused ? <Play size={15} /> : <Pause size={15} />}
            </button>
          </div>
        ) : (
          <div className="rt-hud__stats">
            <div className="rt-best">
              <Trophy size={13} />
              <span>{t('Best', 'Rekor', language)}</span>
              <strong>{formatBest(gameMode, best[gameMode] ?? 0, language)}</strong>
            </div>
            <div className="rt-seg" role="radiogroup" aria-label="Language">
              {(['english', 'türkçe'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={language === l}
                  className={language === l ? 'is-on' : ''}
                  onClick={() => setLanguage(l)}
                >
                  {l === 'english' ? 'EN' : 'TR'}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="rt-stage">
        <div className="rt-stage__bg" aria-hidden>
          <div className="rt-stage__glow" />
          <div className="rt-stage__floor" />
        </div>

        {phase === 'lobby' && (
          <Lobby
            language={language}
            tagline={tagline}
            gameMode={gameMode}
            settings={settings}
            best={best}
            onMode={setGameMode}
            onSub={setSub}
            onStart={startGame}
          />
        )}

        {phase === 'playing' && gameMode === 'classic' && <ClassicFlash key={runKey} settings={settings.classic} {...modeProps} />}
        {phase === 'playing' && gameMode === 'aim' && <AimSnap key={runKey} settings={settings.aim} {...modeProps} />}
        {phase === 'playing' && gameMode === 'gonogo' && <GoNoGo key={runKey} settings={settings.gonogo} {...modeProps} />}
        {phase === 'playing' && gameMode === 'sequence' && <SequenceEcho key={runKey} settings={settings.sequence} {...modeProps} />}

        {phase === 'playing' && isPaused && (
          <div className="rt-overlay">
            <div className="rt-modal">
              <span className="rt-modal__icon"><Pause size={22} /></span>
              <h3 className="rt-modal__title">{t('Paused', 'Duraklatıldı', language)}</h3>
              <p className="rt-modal__sub">
                {t('Reflexes on ice. The current trial restarts when you resume.', 'Refleksler buzda. Devam edince bu deneme baştan başlar.', language)}
              </p>
              <div className="rt-modal__actions">
                <button type="button" className="rt-btn rt-btn--primary" onClick={togglePause} autoFocus>
                  <Play size={15} /> {t('Resume', 'Devam', language)} <kbd>Esc</kbd>
                </button>
                <button type="button" className="rt-btn" onClick={quit}>
                  <Flag size={14} /> {t('Quit run', 'Bitir', language)}
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === 'over' && result && (
          <Results
            language={language}
            gameMode={gameMode}
            result={result}
            best={best[gameMode] ?? 0}
            onAgain={startGame}
            onLobby={() => setPhase('lobby')}
          />
        )}
      </main>
    </div>
  );
};

// ─── Lobby ───────────────────────────────────────────────────────────────────

function Lobby({
  language, tagline, gameMode, settings, best, onMode, onSub, onStart,
}: {
  language: Language;
  tagline: string;
  gameMode: GameMode;
  settings: Settings;
  best: Record<GameMode, number>;
  onMode: (m: GameMode) => void;
  onSub: (key: string, value: string | number) => void;
  onStart: () => void;
}) {
  const current = settings[gameMode] as unknown as Record<string, string | number>;
  return (
    <div className="rt-lobby">
      <section className="rt-lobby__hero">
        <div className="rt-signal" aria-hidden>
          {[0, 1, 2, 3].map((i) => <span key={i} style={{ '--i': i } as CSSProperties} />)}
        </div>
        <h2 className="rt-lobby__title">
          Reaction <span>Test</span>
        </h2>
        <p className="rt-lobby__tagline">{tagline}</p>
        <div className="rt-lobby__chips">
          <span><Timer size={12} /> {t('Millisecond timing', 'Milisaniye ölçüm', language)}</span>
          <span><Zap size={12} /> {t('Early = foul', 'Erken = faul', language)}</span>
          <span><Coins size={12} /> {t('Speed = chips', 'Hız = çip', language)}</span>
        </div>
      </section>

      <section className="rt-lobby__setup">
        <p className="rt-section-label">{t('Choose your reflex', 'Refleksini seç', language)}</p>
        <div className="rt-modes" role="radiogroup" aria-label="Game mode">
          {GAME_MODES.map((m) => {
            const Icon = MODE_ICONS[m];
            const a = modeAccent(m);
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={gameMode === m}
                className={`rt-mode${gameMode === m ? ' is-on' : ''}`}
                style={{ '--m-from': a.from, '--m-to': a.to } as CSSProperties}
                onClick={() => onMode(m)}
              >
                <span className="rt-mode__icon"><Icon size={18} /></span>
                <span className="rt-mode__body">
                  <span className="rt-mode__name">{modeName(m, language)}</span>
                  <span className="rt-mode__pun">{modePun(m, language)}</span>
                  <span className="rt-mode__rules">
                    {modeRules(m, language).map((r) => <span key={r}>{r}</span>)}
                  </span>
                </span>
                {best[m] > 0 && (
                  <span className="rt-mode__best"><Crown size={10} /> {formatBest(m, best[m], language)}</span>
                )}
              </button>
            );
          })}
        </div>

        <div key={gameMode} className="rt-subs">
          {SUBSETTINGS[gameMode].map((def) => (
            <div key={def.key} className="rt-sub">
              <p className="rt-section-label">{subLabel(def, language)}</p>
              <div className="rt-seg" role="radiogroup" aria-label={subLabel(def, language)}>
                {def.options.map((o) => (
                  <button
                    key={String(o.value)}
                    type="button"
                    role="radio"
                    aria-checked={current[def.key] === o.value}
                    className={current[def.key] === o.value ? 'is-on' : ''}
                    onClick={() => onSub(def.key, o.value)}
                  >
                    {optLabel(o, language)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button type="button" className="rt-start" onClick={onStart}>
          <Play size={17} fill="currentColor" />
          {t(`Start ${modeName(gameMode, language)}`, `${modeName(gameMode, language)} başlat`, language)}
          <kbd>Enter</kbd>
        </button>
      </section>
    </div>
  );
}

// ─── Results ─────────────────────────────────────────────────────────────────

function Results({
  language, gameMode, result, best, onAgain, onLobby,
}: {
  language: Language;
  gameMode: GameMode;
  result: ModeResult & { newBest: boolean };
  best: number;
  onAgain: () => void;
  onLobby: () => void;
}) {
  const grade = gradeFor(result.quality, language);
  return (
    <div className="rt-overlay">
      <div className="rt-results">
        {result.newBest && (
          <span className="rt-results__ribbon"><Sparkles size={11} /> {t('New best', 'Yeni rekor', language)}</span>
        )}
        <p className="rt-results__eyebrow">{t('Run complete', 'Tur bitti', language)} · {modeName(gameMode, language)}</p>
        <h3 className="rt-results__title">{grade.title}</h3>
        <p className="rt-results__quip">{grade.quip}</p>

        <div className="rt-results__score">
          <span>{result.headline}</span>
          <small>{result.headlineLabel} · {t('best', 'rekor', language)} {formatBest(gameMode, best, language)}</small>
        </div>

        <div className="rt-results__grid">
          {result.stats.map((s) => (
            <div key={s.label} className="rt-results__cell">
              <span className="rt-results__cell-label">{s.label}</span>
              <span className="rt-results__cell-value">{s.value}</span>
            </div>
          ))}
        </div>

        {result.chips > 0 && (
          <p className="rt-results__chips"><Coins size={14} /> +{result.chips.toLocaleString()} {t('chips banked', 'çip kazandın', language)}</p>
        )}

        <div className="rt-modal__actions">
          <button type="button" className="rt-btn rt-btn--primary" onClick={onAgain} autoFocus>
            <RotateCcw size={15} /> {t('Run it back', 'Bir daha', language)} <kbd>Enter</kbd>
          </button>
          <button type="button" className="rt-btn" onClick={onLobby}>
            {t('Change mode', 'Mod değiştir', language)}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SimplifiedReactionTest;
