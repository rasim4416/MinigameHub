import React, { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ALargeSmall, ChevronLeft, CloudRain, Coins, Crown, Flag, Flame, Mountain,
  Pause, Play, RotateCcw, Sparkles, Target, TrainFront, Trophy, Zap,
} from 'lucide-react';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import './speed-typer.css';
import { useAudio } from '@/lib/stores/useAudio';
import { useChips } from '@/lib/stores/useChips';
import { levelThresholds } from '@/lib/stores/useLevelMode';
import {
  Language,
  getRandomWord,
  getWordOfLength,
  getWordInRange,
  getLetterCountForLevel,
} from './wordBanks';
import {
  GAME_MODES, SPAWN_RATES, GameMode, SpawnRateMultiplier,
  gradeFor, levelUpQuip, modeAccent, modeName, modePun, modeRules,
  randomTagline, rateName, t,
} from './speedTyperCopy';

// ─── Types & constants ───────────────────────────────────────────────────────

interface FallingWord {
  id: number;
  word: string;
  x: number;
  y: number;
  speed: number;
  hue: number;
}

interface Pop {
  id: number;
  x: number;
  y: number;
  text: string;
  kind: 'hit' | 'miss' | 'wrong';
}

interface RunStats {
  correct: number;
  wrong: number;
  missed: number;
  chars: number;
  combo: number;
  bestCombo: number;
  elapsed: number;
}

type Phase = 'lobby' | 'playing' | 'over';
type EndReason = 'time' | 'quit' | 'victory';
interface RunResult { reason: EndReason; newBest: boolean; chips: number }

const ROUND_SECONDS = 60;
const MAX_LEVEL = levelThresholds.length;
const LEVEL_UP_MS = 2600;
const DROP_HUES = [199, 217, 262, 291, 330, 168, 38, 142];
const MODE_ICONS: Record<GameMode, typeof CloudRain> = {
  falling: CloudRain,
  linear: TrainFront,
  'letter-level': ALargeSmall,
  'score-level': Mountain,
};
const PREFS_KEY = 'speedTyper.prefs.v1';
const BEST_KEY = 'speedTyper.best.v1';

const EMPTY_STATS: RunStats = { correct: 0, wrong: 0, missed: 0, chars: 0, combo: 0, bestCombo: 0, elapsed: 0 };

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
};

const comboMultiplier = (combo: number) => 1 + Math.min(combo, 20) * 0.05;
const targetForLevel = (level: number) => levelThresholds[Math.min(level, MAX_LEVEL) - 1].requiredScore;
const isLevelModeOf = (m: GameMode) => m === 'letter-level' || m === 'score-level';

let uid = 0;
const nextId = () => ++uid;

// ─── Component ───────────────────────────────────────────────────────────────

const SimplifiedSpeedTyper: React.FC = () => {
  const navigate = useNavigate();
  const { playHit, playSuccess } = useAudio();
  const { addChips } = useChips();

  const prefs = useMemo(
    () => readJson<{ language: Language; mode: GameMode; rate: SpawnRateMultiplier }>(PREFS_KEY, {
      language: 'english', mode: 'falling', rate: 1,
    }),
    [],
  );
  const [language, setLanguage] = useState<Language>(prefs.language);
  const [gameMode, setGameMode] = useState<GameMode>(prefs.mode);
  const [spawnRate, setSpawnRate] = useState<SpawnRateMultiplier>(prefs.rate);
  const [best, setBest] = useState<Record<GameMode, number>>(() =>
    readJson(BEST_KEY, { falling: 0, linear: 0, 'letter-level': 0, 'score-level': 0 }),
  );
  const tagline = useMemo(() => randomTagline(language), [language]);

  const [phase, setPhase] = useState<Phase>('lobby');
  const [isPaused, setIsPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [stats, setStats] = useState<RunStats>(EMPTY_STATS);
  const [input, setInput] = useState('');
  const [words, setWords] = useState<FallingWord[]>([]);
  const [queue, setQueue] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<{ word: string; ok: boolean; id: number } | null>(null);
  const [pops, setPops] = useState<Pop[]>([]);
  const [shakeKey, setShakeKey] = useState(0);
  const [missKey, setMissKey] = useState(0);
  const [level, setLevel] = useState(1);
  const [levelScore, setLevelScore] = useState(0);
  const [levelUp, setLevelUp] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const wordsRef = useRef<FallingWord[]>([]);
  const pausedRef = useRef(false);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const overAtRef = useRef(0);
  const fieldRef = useRef<HTMLDivElement>(null);
  pausedRef.current = isPaused || levelUp;
  scoreRef.current = score;
  comboRef.current = stats.combo;

  const isLevelMode = isLevelModeOf(gameMode);
  const isFalling = gameMode === 'falling';
  const accent = modeAccent(gameMode);
  const locale = language === 'türkçe' ? 'tr' : 'en';
  const norm = useCallback((s: string) => s.trim().toLocaleLowerCase(locale), [locale]);

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ language, mode: gameMode, rate: spawnRate }));
  }, [language, gameMode, spawnRate]);

  const focusInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const addPop = useCallback((pop: Omit<Pop, 'id'>) => {
    const id = nextId();
    setPops((ps) => [...ps.slice(-12), { ...pop, id }]);
    setTimeout(() => setPops((ps) => ps.filter((p) => p.id !== id)), 900);
  }, []);

  const makeWord = useCallback(
    (lvl: number) => {
      if (gameMode === 'letter-level') return getWordOfLength(language, getLetterCountForLevel(lvl));
      if (gameMode === 'score-level') return getWordInRange(language, 3, 9);
      return getRandomWord(language);
    },
    [gameMode, language],
  );

  const buildQueue = useCallback((lvl: number) => Array.from({ length: 20 }, () => makeWord(lvl)), [makeWord]);

  useEffect(() => {
    const el = fieldRef.current;
    if (!shakeKey || !el) return;
    el.classList.remove('is-shake');
    void el.offsetWidth;
    el.classList.add('is-shake');
    const clear = () => el.classList.remove('is-shake');
    el.addEventListener('animationend', clear, { once: true });
    return () => el.removeEventListener('animationend', clear);
  }, [shakeKey]);

  // ── Game lifecycle ──

  const endGame = useCallback(
    (reason: EndReason, pendingPoints = 0) => {
      const finalScore = scoreRef.current + pendingPoints;
      overAtRef.current = Date.now();
      const newBest = finalScore > 0 && finalScore > (best[gameMode] ?? 0);
      if (newBest) {
        const next = { ...best, [gameMode]: finalScore };
        setBest(next);
        localStorage.setItem(BEST_KEY, JSON.stringify(next));
      }
      if (finalScore > 0) addChips(finalScore);
      setResult({ reason, newBest, chips: finalScore });
      setPhase('over');
      setIsPaused(false);
      setLevelUp(false);
      wordsRef.current = [];
      setWords([]);
      playSuccess();
    },
    [best, gameMode, addChips, playSuccess],
  );

  const startGame = useCallback(() => {
    wordsRef.current = [];
    setWords([]);
    setPops([]);
    setScore(0);
    setTimeLeft(ROUND_SECONDS);
    setStats(EMPTY_STATS);
    setInput('');
    setLastResult(null);
    setLevel(1);
    setLevelScore(0);
    setLevelUp(false);
    setIsPaused(false);
    setResult(null);
    setQueue(isFalling ? [] : buildQueue(1));
    setPhase('playing');
    focusInput();
  }, [isFalling, buildQueue, focusInput]);

  const togglePause = useCallback(() => {
    if (phase !== 'playing' || levelUp) return;
    setIsPaused((p) => {
      if (p) focusInput();
      return !p;
    });
  }, [phase, levelUp, focusInput]);

  // Countdown; frozen while paused or during the level-up card.
  useEffect(() => {
    if (phase !== 'playing' || isPaused || levelUp) return;
    const id = setInterval(() => {
      setTimeLeft((s) => Math.max(0, s - 1));
      setStats((st) => ({ ...st, elapsed: st.elapsed + 1 }));
    }, 1000);
    return () => clearInterval(id);
  }, [phase, isPaused, levelUp]);

  useEffect(() => {
    if (phase === 'playing' && timeLeft === 0 && !levelUp) endGame('time');
  }, [phase, timeLeft, levelUp, endGame]);

  // ── Word Rain loop ──

  const onMissRef = useRef<(missed: FallingWord[]) => void>(() => {});
  onMissRef.current = (missed) => {
    setScore((s) => Math.max(0, s - 5 * missed.length));
    setStats((st) => ({ ...st, missed: st.missed + missed.length, combo: 0 }));
    setMissKey((k) => k + 1);
    missed.forEach((w) => addPop({ x: w.x, y: 96, text: '−5', kind: 'miss' }));
  };

  useEffect(() => {
    if (phase !== 'playing' || !isFalling) return;
    const interval = 1000 / spawnRate;
    const speed = 20 * spawnRate;
    let spawnAcc = interval;
    let last = performance.now();
    let raf = 0;

    const spawn = (current: FallingWord[]): FallingWord => {
      let x = 50;
      for (let i = 0; i < 8; i++) {
        x = Math.random() * 76 + 12;
        if (!current.some((w) => w.y < 22 && Math.abs(w.x - x) < 16)) break;
      }
      return {
        id: nextId(),
        word: getRandomWord(language),
        x,
        y: 0,
        speed: speed * (0.85 + Math.random() * 0.3),
        hue: DROP_HUES[Math.floor(Math.random() * DROP_HUES.length)],
      };
    };

    const tick = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      if (!pausedRef.current) {
        spawnAcc += dt;
        const kept: FallingWord[] = [];
        const missed: FallingWord[] = [];
        for (const w of wordsRef.current) {
          const moved = { ...w, y: w.y + (w.speed * dt) / 1000 };
          (moved.y >= 100 ? missed : kept).push(moved);
        }
        if (spawnAcc >= interval) {
          spawnAcc -= interval;
          kept.push(spawn(kept));
        }
        wordsRef.current = kept;
        setWords(kept);
        if (missed.length) onMissRef.current(missed);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, isFalling, spawnRate, language]);

  const zap = useCallback(
    (typed: string): boolean => {
      const n = norm(typed);
      if (!n) return false;
      const hits = wordsRef.current.filter((w) => norm(w.word) === n);
      if (!hits.length) return false;
      const target = hits.reduce((a, b) => (b.y > a.y ? b : a));
      wordsRef.current = wordsRef.current.filter((w) => w.id !== target.id);
      setWords(wordsRef.current);
      const pts = Math.round(
        Math.floor(target.word.length * 5 * Math.min(spawnRate * 1.2, 3)) * comboMultiplier(comboRef.current),
      );
      setScore((s) => s + pts);
      setStats((st) => {
        const combo = st.combo + 1;
        return { ...st, correct: st.correct + 1, chars: st.chars + target.word.length, combo, bestCombo: Math.max(st.bestCombo, combo) };
      });
      addPop({ x: target.x, y: target.y, text: `+${pts}`, kind: 'hit' });
      playHit();
      return true;
    },
    [norm, spawnRate, addPop, playHit],
  );

  // ── Train / level submit ──

  const completeLevel = useCallback((pendingPoints: number) => {
    if (level >= MAX_LEVEL) {
      endGame('victory', pendingPoints);
      return;
    }
    setLevelUp(true);
    playSuccess();
  }, [level, endGame, playSuccess]);

  useEffect(() => {
    if (!levelUp) return;
    const id = setTimeout(() => {
      const next = level + 1;
      setLevel(next);
      setLevelScore(0);
      setTimeLeft(ROUND_SECONDS);
      setQueue(buildQueue(next));
      setLastResult(null);
      setInput('');
      setLevelUp(false);
      focusInput();
    }, LEVEL_UP_MS);
    return () => clearTimeout(id);
  }, [levelUp, level, buildQueue, focusInput]);

  const submitQueued = useCallback(
    (typed: string) => {
      const current = queue[0];
      if (!current || !norm(typed)) return;
      const ok = norm(typed) === norm(current);
      setQueue((q) => {
        const rest = q.slice(1);
        return rest.length < 10 ? [...rest, ...Array.from({ length: 10 }, () => makeWord(level))] : rest;
      });
      setLastResult({ word: current, ok, id: nextId() });

      if (ok) {
        const pts = Math.round(current.length * 5 * comboMultiplier(comboRef.current));
        setScore((s) => s + pts);
        setStats((st) => {
          const combo = st.combo + 1;
          return { ...st, correct: st.correct + 1, chars: st.chars + current.length, combo, bestCombo: Math.max(st.bestCombo, combo) };
        });
        addPop({ x: 50, y: 24, text: `+${pts}`, kind: 'hit' });
        playHit();
        if (isLevelMode) {
          setTimeLeft((s) => s + 1);
          const nextLevelScore = levelScore + pts;
          setLevelScore(nextLevelScore);
          if (nextLevelScore >= targetForLevel(level)) completeLevel(pts);
        }
      } else {
        setStats((st) => ({ ...st, wrong: st.wrong + 1, combo: 0 }));
        setShakeKey((k) => k + 1);
        addPop({ x: 50, y: 24, text: isLevelMode ? '−2s' : '✗', kind: 'wrong' });
        if (isLevelMode) setTimeLeft((s) => Math.max(0, s - 2));
      }
    },
    [queue, norm, makeWord, level, addPop, playHit, isLevelMode, levelScore, completeLevel],
  );

  // ── Input ──

  const submit = useCallback(
    (raw: string) => {
      if (!raw.trim()) return;
      if (isFalling) {
        if (!zap(raw)) {
          setStats((st) => ({ ...st, wrong: st.wrong + 1, combo: 0 }));
          setShakeKey((k) => k + 1);
        }
      } else {
        submitQueued(raw);
      }
      setInput('');
    },
    [isFalling, zap, submitQueued],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/\s$/.test(value)) {
      submit(value);
      return;
    }
    if (isFalling && zap(value)) {
      setInput('');
      return;
    }
    setInput(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit(input);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'playing') {
        if (e.key === 'Escape') {
          e.preventDefault();
          togglePause();
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (Date.now() - overAtRef.current < 900) return;
        startGame();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, togglePause, startGame]);

  // ── Derived ──

  const minutes = Math.max(stats.elapsed, 1) / 60;
  const wpm = stats.elapsed >= 3 ? Math.round(stats.chars / 5 / minutes) : 0;
  const attempts = stats.correct + stats.wrong + stats.missed;
  const accuracy = attempts ? Math.round((stats.correct / attempts) * 100) : 100;
  const multiplier = comboMultiplier(stats.combo);
  const target = targetForLevel(level);
  const levelPct = Math.min(100, (levelScore / target) * 100);
  const typed = norm(input);

  const targetWordId = useMemo(() => {
    if (!isFalling || !typed) return null;
    let bestW: FallingWord | null = null;
    for (const w of words) if (norm(w.word).startsWith(typed) && (!bestW || w.y > bestW.y)) bestW = w;
    return bestW?.id ?? null;
  }, [isFalling, typed, words, norm]);

  const leaveToMenu = () => navigate('/minigames');

  const stageStyle = { '--st-from': accent.from, '--st-to': accent.to } as CSSProperties;
  const ModeIcon = MODE_ICONS[gameMode];

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="st" style={stageStyle} data-phase={phase}>
      <header className="st-hud">
        <div className="st-hud__left">
          <button
            type="button"
            className="st-icon-btn"
            onClick={phase === 'playing' ? () => endGame('quit') : leaveToMenu}
            title={phase === 'playing' ? t('Quit run', 'Bitir', language) : t('Back to games', 'Oyunlara dön', language)}
          >
            {phase === 'playing' ? <Flag size={15} /> : <ChevronLeft size={16} />}
          </button>
          <div className="st-hud__mode">
            <span className="st-hud__mode-icon"><ModeIcon size={15} /></span>
            <div className="st-hud__mode-text">
              <span className="st-hud__eyebrow">Speed Typer</span>
              <span className="st-hud__mode-name">
                {modeName(gameMode, language)}
                {isFalling && phase === 'playing' && <em> · {rateName(spawnRate, language)}</em>}
              </span>
            </div>
          </div>
        </div>

        {phase === 'playing' ? (
          <div className="st-hud__stats">
            <Stat label={t('Score', 'Puan', language)} value={score.toLocaleString()} tone="gold" big />
            <Stat
              label={t('Combo', 'Kombo', language)}
              value={stats.combo ? `${stats.combo}` : '—'}
              sub={stats.combo ? `×${multiplier.toFixed(2)}` : undefined}
              tone={stats.combo >= 10 ? 'hot' : 'plain'}
              icon={stats.combo >= 10 ? <Flame size={11} /> : undefined}
            />
            <Stat label="WPM" value={String(wpm)} className="st-hide-sm" />
            <Stat label={t('Accuracy', 'İsabet', language)} value={`${accuracy}%`} className="st-hide-sm" />
            <TimerRing seconds={timeLeft} />
            <button type="button" className="st-icon-btn" onClick={togglePause} title={t('Pause (Esc)', 'Duraklat (Esc)', language)}>
              {isPaused ? <Play size={15} /> : <Pause size={15} />}
            </button>
          </div>
        ) : (
          <div className="st-hud__stats">
            <div className="st-best">
              <Trophy size={13} />
              <span>{t('Best', 'Rekor', language)}</span>
              <strong>{(best[gameMode] ?? 0).toLocaleString()}</strong>
            </div>
            <div className="st-seg st-seg--lang" role="radiogroup" aria-label="Language">
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

      {isLevelMode && phase === 'playing' && (
        <div className="st-level">
          <span className="st-level__badge">
            {t('Level', 'Seviye', language)} <strong>{level}</strong>
            <span>/{MAX_LEVEL}</span>
          </span>
          <div className="st-level__bar">
            <div className="st-level__fill" style={{ width: `${levelPct}%` }} />
          </div>
          <span className="st-level__target">
            {levelScore.toLocaleString()} / {target.toLocaleString()}
          </span>
        </div>
      )}

      <main className="st-stage" onMouseDown={(e) => { if (phase === 'playing' && e.target !== inputRef.current) { e.preventDefault(); inputRef.current?.focus(); } }}>
        <div className="st-stage__bg" aria-hidden>
          <div className="st-stage__glow" />
          <div className="st-stage__floor" />
        </div>

        {phase === 'lobby' && (
          <Lobby
            language={language}
            tagline={tagline}
            gameMode={gameMode}
            spawnRate={spawnRate}
            best={best}
            onMode={setGameMode}
            onRate={setSpawnRate}
            onStart={startGame}
          />
        )}

        {phase === 'playing' && isFalling && (
          <div className="st-rain">
            {words.map((w) => {
              const hit = typed && norm(w.word).startsWith(typed) ? typed.length : 0;
              return (
                <div
                  key={w.id}
                  className={`st-drop${w.id === targetWordId ? ' is-target' : ''}${w.y > 72 ? ' is-danger' : ''}`}
                  style={{ left: `${w.x}%`, top: `${w.y}%`, '--hue': w.hue } as CSSProperties}
                >
                  {hit > 0 && <span className="st-drop__hit">{w.word.slice(0, hit)}</span>}
                  <span>{w.word.slice(hit)}</span>
                </div>
              );
            })}
            <div key={missKey} className={`st-rain__floor${missKey ? ' is-hit' : ''}`} />
          </div>
        )}

        {phase === 'playing' && !isFalling && (
          <Track
            language={language}
            queue={queue}
            input={input}
            norm={norm}
            lastResult={lastResult}
            gameMode={gameMode}
            level={level}
            shakeKey={shakeKey}
          />
        )}

        {pops.map((p) => (
          <span
            key={p.id}
            className={`st-pop st-pop--${p.kind}`}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            {p.text}
          </span>
        ))}

        {phase === 'playing' && isPaused && (
          <div className="st-overlay">
            <div className="st-modal">
              <span className="st-modal__icon"><Pause size={22} /></span>
              <h3 className="st-modal__title">{t('Paused', 'Duraklatıldı', language)}</h3>
              <p className="st-modal__sub">{t('Keys cooling down. Take a breather.', 'Tuşlar soğuyor. Bir nefes al.', language)}</p>
              <div className="st-modal__actions">
                <button type="button" className="st-btn st-btn--primary" onClick={togglePause} autoFocus>
                  <Play size={15} /> {t('Resume', 'Devam', language)} <kbd>Esc</kbd>
                </button>
                <button type="button" className="st-btn" onClick={() => endGame('quit')}>
                  <Flag size={14} /> {t('End run', 'Bitir', language)}
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === 'playing' && levelUp && (
          <div className="st-overlay st-overlay--clear">
            <div className="st-levelup">
              <div className="st-levelup__ring">
                <span>{level + 1}</span>
              </div>
              <h3>{t('Level up!', 'Seviye atladın!', language)}</h3>
              <p className="st-levelup__quip">{levelUpQuip(level, language)}</p>
              <p className="st-levelup__next">
                {gameMode === 'letter-level'
                  ? t(
                      `Next: ${getLetterCountForLevel(level + 1)}-letter words`,
                      `Sıradaki: ${getLetterCountForLevel(level + 1)} harfli kelimeler`,
                      language,
                    )
                  : t(
                      `Next target: ${targetForLevel(level + 1).toLocaleString()}`,
                      `Yeni hedef: ${targetForLevel(level + 1).toLocaleString()}`,
                      language,
                    )}
              </p>
            </div>
          </div>
        )}

        {phase === 'over' && result && (
          <Results
            language={language}
            gameMode={gameMode}
            score={score}
            wpm={wpm}
            accuracy={accuracy}
            stats={stats}
            level={isLevelMode ? level : null}
            result={result}
            best={best[gameMode] ?? 0}
            onAgain={startGame}
            onLobby={() => setPhase('lobby')}
          />
        )}
      </main>

      {phase === 'playing' && (
        <form
          className="st-dock"
          onSubmit={(e) => { e.preventDefault(); submit(input); }}
        >
          <div ref={fieldRef} className="st-dock__field">
            <span className="st-dock__prompt">›</span>
            <input
              ref={inputRef}
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              disabled={isPaused || levelUp}
              placeholder={
                isFalling
                  ? t('Type any falling word…', 'Düşen bir kelimeyi yaz…', language)
                  : t('Type the glowing word…', 'Parlayan kelimeyi yaz…', language)
              }
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label={t('Type here', 'Buraya yaz', language)}
            />
            <span className="st-dock__keys">
              {isFalling ? t('auto-zaps', 'otomatik', language) : <><kbd>Space</kbd><kbd>Enter</kbd></>}
            </span>
          </div>
          <span className="st-dock__hint">
            <kbd>Esc</kbd> {t('pause', 'duraklat', language)}
          </span>
        </form>
      )}
    </div>
  );
};

// ─── HUD pieces ──────────────────────────────────────────────────────────────

function Stat({
  label, value, sub, tone = 'plain', big, icon, className = '',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'plain' | 'gold' | 'hot';
  big?: boolean;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`st-stat st-stat--${tone}${big ? ' st-stat--big' : ''} ${className}`}>
      <span className="st-stat__label">{icon}{label}</span>
      <span className="st-stat__value">
        {value}
        {sub && <small>{sub}</small>}
      </span>
    </div>
  );
}

function TimerRing({ seconds }: { seconds: number }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  const ratio = Math.min(1, seconds / ROUND_SECONDS);
  const tone = seconds <= 10 ? 'danger' : seconds <= 30 ? 'warn' : 'ok';
  return (
    <div className={`st-timer st-timer--${tone}`} aria-label={`${seconds} seconds left`}>
      <svg viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} className="st-timer__track" />
        <circle
          cx="20" cy="20" r={r}
          className="st-timer__arc"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
        />
      </svg>
      <span>{seconds}</span>
    </div>
  );
}

// ─── Lobby ───────────────────────────────────────────────────────────────────

function Lobby({
  language, tagline, gameMode, spawnRate, best, onMode, onRate, onStart,
}: {
  language: Language;
  tagline: string;
  gameMode: GameMode;
  spawnRate: SpawnRateMultiplier;
  best: Record<GameMode, number>;
  onMode: (m: GameMode) => void;
  onRate: (r: SpawnRateMultiplier) => void;
  onStart: () => void;
}) {
  return (
    <div className="st-lobby">
      <section className="st-lobby__hero">
        <div className="st-keycaps" aria-hidden>
          {'TYPE'.split('').map((ch, i) => (
            <span key={i} className="st-keycap" style={{ '--i': i } as CSSProperties}>{ch}</span>
          ))}
        </div>
        <h2 className="st-lobby__title">
          Speed <span>Typer</span>
        </h2>
        <p className="st-lobby__tagline">{tagline}</p>
        <div className="st-lobby__chips">
          <span><Zap size={12} /> {t('60s rounds', '60 sn tur', language)}</span>
          <span><Flame size={12} /> {t('Combos up to ×2', '×2 kombo', language)}</span>
          <span><Coins size={12} /> {t('Score = chips', 'Puan = çip', language)}</span>
        </div>
      </section>

      <section className="st-lobby__setup">
        <p className="st-section-label">{t('Pick your poison', 'Modunu seç', language)}</p>
        <div className="st-modes" role="radiogroup" aria-label="Game mode">
          {GAME_MODES.map((m) => {
            const Icon = MODE_ICONS[m];
            const a = modeAccent(m);
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={gameMode === m}
                className={`st-mode${gameMode === m ? ' is-on' : ''}`}
                style={{ '--m-from': a.from, '--m-to': a.to } as CSSProperties}
                onClick={() => onMode(m)}
              >
                <span className="st-mode__icon"><Icon size={18} /></span>
                <span className="st-mode__body">
                  <span className="st-mode__name">{modeName(m, language)}</span>
                  <span className="st-mode__pun">{modePun(m, language)}</span>
                  <span className="st-mode__rules">
                    {modeRules(m, language).map((r) => <span key={r}>{r}</span>)}
                  </span>
                </span>
                {best[m] > 0 && (
                  <span className="st-mode__best"><Crown size={10} /> {best[m].toLocaleString()}</span>
                )}
              </button>
            );
          })}
        </div>

        {gameMode === 'falling' && (
          <div className="st-rate">
            <div className="st-rate__head">
              <p className="st-section-label">{t('Forecast', 'Hava durumu', language)}</p>
              <span className={`st-rate__name${spawnRate >= 2 ? ' is-wild' : ''}`}>
                <CloudRain size={12} /> {rateName(spawnRate, language)} · {spawnRate}×
              </span>
            </div>
            <div className="st-seg st-seg--rate" role="radiogroup" aria-label="Spawn rate">
              {SPAWN_RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={spawnRate === r}
                  className={`${spawnRate === r ? 'is-on' : ''}${r >= 2 ? ' is-wild' : ''}`}
                  onClick={() => onRate(r)}
                >
                  {r}×
                </button>
              ))}
            </div>
          </div>
        )}

        <button type="button" className="st-start" onClick={onStart}>
          <Play size={17} fill="currentColor" />
          {t(`Start ${modeName(gameMode, language)}`, `${modeName(gameMode, language)} başlat`, language)}
          <kbd>Enter</kbd>
        </button>
      </section>
    </div>
  );
}

// ─── Train / level track ─────────────────────────────────────────────────────

function Track({
  language, queue, input, norm, lastResult, gameMode, level, shakeKey,
}: {
  language: Language;
  queue: string[];
  input: string;
  norm: (s: string) => string;
  lastResult: { word: string; ok: boolean; id: number } | null;
  gameMode: GameMode;
  level: number;
  shakeKey: number;
}) {
  const current = queue[0] ?? '';
  const typedChars = Array.from(norm(input));
  const letters = Array.from(current);
  const lower = Array.from(norm(current));

  return (
    <div className="st-track">
      <p className="st-track__label">
        {gameMode === 'letter-level'
          ? t(`${getLetterCountForLevel(level)}-letter words`, `${getLetterCountForLevel(level)} harfli kelimeler`, language)
          : gameMode === 'score-level'
            ? t('Now climbing', 'Tırmanıyor', language)
            : t('Now boarding', 'Biniş başladı', language)}
      </p>

      <div className="st-track__prev">
        {lastResult && (
          <span key={lastResult.id} className={`st-track__last ${lastResult.ok ? 'is-ok' : 'is-bad'}`}>
            {lastResult.ok ? '✓' : '✗'} {lastResult.word}
          </span>
        )}
      </div>

      <div key={shakeKey} className={`st-word${shakeKey ? ' is-shake' : ''}`}>
        {letters.map((ch, i) => {
          const state = i < typedChars.length ? (typedChars[i] === lower[i] ? 'ok' : 'bad') : 'todo';
          return (
            <span key={i} className={`st-word__ch is-${state}${i === typedChars.length ? ' is-caret' : ''}`}>
              {ch}
            </span>
          );
        })}
        {typedChars.length > letters.length && (
          <span className="st-word__extra">{typedChars.slice(letters.length).join('')}</span>
        )}
      </div>

      <div className="st-train">
        {queue.slice(1, 6).map((w, i) => (
          <span key={`${w}-${i}`} className="st-car" style={{ '--i': i } as CSSProperties}>
            {w}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Results ─────────────────────────────────────────────────────────────────

function Results({
  language, gameMode, score, wpm, accuracy, stats, level, result, best, onAgain, onLobby,
}: {
  language: Language;
  gameMode: GameMode;
  score: number;
  wpm: number;
  accuracy: number;
  stats: RunStats;
  level: number | null;
  result: RunResult;
  best: number;
  onAgain: () => void;
  onLobby: () => void;
}) {
  const grade = gradeFor(wpm, language);
  const victory = result.reason === 'victory';
  return (
    <div className="st-overlay">
      <div className={`st-results${victory ? ' is-victory' : ''}`}>
        {result.newBest && (
          <span className="st-results__ribbon"><Sparkles size={11} /> {t('New best', 'Yeni rekor', language)}</span>
        )}
        <p className="st-results__eyebrow">
          {victory
            ? t('All 10 levels cleared', '10 seviye tamam', language)
            : result.reason === 'quit'
              ? t('Run ended', 'Tur bitti', language)
              : t("Time's up", 'Süre doldu', language)}{' '}
          · {modeName(gameMode, language)}
        </p>
        <h3 className="st-results__title">
          {victory ? t('Champion of the Keys', 'Klavye Şampiyonu', language) : grade.title}
        </h3>
        <p className="st-results__quip">{grade.quip}</p>

        <div className="st-results__score">
          <span>{score.toLocaleString()}</span>
          <small>{t('points', 'puan', language)} · {t('best', 'rekor', language)} {best.toLocaleString()}</small>
        </div>

        <div className="st-results__grid">
          <ResultCell icon={<Zap size={13} />} label="WPM" value={String(wpm)} />
          <ResultCell icon={<Target size={13} />} label={t('Accuracy', 'İsabet', language)} value={`${accuracy}%`} />
          <ResultCell icon={<Flame size={13} />} label={t('Best combo', 'En iyi kombo', language)} value={String(stats.bestCombo)} />
          {level !== null ? (
            <ResultCell icon={<Mountain size={13} />} label={t('Level', 'Seviye', language)} value={`${level}/${MAX_LEVEL}`} />
          ) : (
            <ResultCell icon={<CloudRain size={13} />} label={t('Words', 'Kelime', language)} value={String(stats.correct)} />
          )}
        </div>

        {result.chips > 0 && (
          <p className="st-results__chips"><Coins size={14} /> +{result.chips.toLocaleString()} {t('chips banked', 'çip kazandın', language)}</p>
        )}

        <div className="st-modal__actions">
          <button type="button" className="st-btn st-btn--primary" onClick={onAgain} autoFocus>
            <RotateCcw size={15} /> {t('Run it back', 'Bir daha', language)} <kbd>Enter</kbd>
          </button>
          <button type="button" className="st-btn" onClick={onLobby}>
            {t('Change mode', 'Mod değiştir', language)}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="st-results__cell">
      <span className="st-results__cell-label">{icon}{label}</span>
      <span className="st-results__cell-value">{value}</span>
    </div>
  );
}

export default SimplifiedSpeedTyper;
