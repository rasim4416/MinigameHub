import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Heart } from 'lucide-react';
import { useAudio } from '@/lib/stores/useAudio';
import type { AimSettings } from '../reactionTestCopy';
import { t } from '../reactionTestCopy';
import { clamp01, randomBetween, type ModeProps } from '../timing';

const ROUND_MS = 30_000;
const LIVES = 3;
const MISS_PENALTY = 5;
const SIZE_PX: Record<AimSettings['size'], number> = { large: 84, medium: 60, small: 40 };
const BASE_POINTS: Record<AimSettings['size'], number> = { large: 10, medium: 15, small: 22 };
const PACE: Record<AimSettings['density'], { life: number; gap: number }> = {
  calm: { life: 1400, gap: 450 },
  busy: { life: 850, gap: 160 },
};
const RING = 2 * Math.PI * 46;

interface Target { id: number; x: number; y: number; born: number }
interface Pop { id: number; x: number; y: number; text: string; kind: 'hit' | 'miss' }

let uid = 0;

export default function AimSnap({ settings, language, paused, onLive, onFinish }: ModeProps<AimSettings>) {
  const { playHit } = useAudio();
  const { life, gap } = PACE[settings.density];
  const size = SIZE_PX[settings.size];

  const fieldRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const run = useRef({
    elapsed: 0,
    nextSpawn: 600,
    target: null as Target | null,
    score: 0,
    hits: 0,
    misses: 0,
    timeouts: 0,
    lives: LIVES,
    rts: [] as number[],
    done: false,
  });
  const [, setFrame] = useState(0);
  const [pops, setPops] = useState<Pop[]>([]);
  const [shake, setShake] = useState(0);

  const addPop = useCallback((p: Omit<Pop, 'id'>) => {
    const id = ++uid;
    setPops((ps) => [...ps.slice(-8), { ...p, id }]);
    setTimeout(() => setPops((ps) => ps.filter((x) => x.id !== id)), 850);
  }, []);

  const finishRef = useRef(() => {});
  finishRef.current = () => {
    const r = run.current;
    if (r.done) return;
    r.done = true;
    const attempts = r.hits + r.misses + r.timeouts;
    const acc = attempts ? Math.round((r.hits / attempts) * 100) : 0;
    const avg = r.rts.length ? Math.round(r.rts.reduce((a, b) => a + b, 0) / r.rts.length) : 0;
    onFinish({
      bestValue: r.score,
      headline: r.score.toLocaleString(),
      headlineLabel: t('points', 'puan', language),
      quality: clamp01(r.score / 520),
      chips: r.score,
      stats: [
        { label: t('Hits', 'İsabet', language), value: String(r.hits) },
        { label: t('Accuracy', 'Doğruluk', language), value: `${acc}%` },
        { label: t('Avg snap', 'Ort. tepki', language), value: avg ? `${avg}` : '—' },
        { label: t('Escaped', 'Kaçan', language), value: String(r.timeouts) },
      ],
    });
  };

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (ts: number) => {
      const dt = Math.min(ts - last, 100);
      last = ts;
      const r = run.current;
      if (!pausedRef.current && !r.done) {
        r.elapsed += dt;
        if (r.target && r.elapsed - r.target.born >= life) {
          addPop({ x: r.target.x, y: r.target.y, text: t('escaped', 'kaçtı', language), kind: 'miss' });
          r.target = null;
          r.timeouts += 1;
          r.lives -= 1;
          r.nextSpawn = r.elapsed + gap;
          setShake((k) => k + 1);
        }
        if (!r.target && r.elapsed >= r.nextSpawn && r.lives > 0) {
          r.target = { id: ++uid, x: randomBetween(8, 92), y: randomBetween(12, 88), born: r.elapsed };
        }
        if (r.elapsed >= ROUND_MS || r.lives <= 0) finishRef.current();
        setFrame((f) => f + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [life, gap, addPop, language]);

  const hitTarget = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const r = run.current;
    if (!r.target || pausedRef.current || r.done) return;
    const rt = r.elapsed - r.target.born;
    const pts = Math.round(BASE_POINTS[settings.size] * (1 + (1 - rt / life)));
    r.score += pts;
    r.hits += 1;
    r.rts.push(Math.round(rt));
    addPop({ x: r.target.x, y: r.target.y, text: `+${pts}`, kind: 'hit' });
    r.target = null;
    r.nextSpawn = r.elapsed + gap;
    playHit();
  };

  const missField = (e: React.PointerEvent) => {
    const r = run.current;
    if (pausedRef.current || r.done || !fieldRef.current) return;
    const box = fieldRef.current.getBoundingClientRect();
    r.misses += 1;
    r.score = Math.max(0, r.score - MISS_PENALTY);
    addPop({
      x: ((e.clientX - box.left) / box.width) * 100,
      y: ((e.clientY - box.top) / box.height) * 100,
      text: `−${MISS_PENALTY}`,
      kind: 'miss',
    });
  };

  const r = run.current;
  const secondsLeft = Math.max(0, Math.ceil((ROUND_MS - r.elapsed) / 1000));

  useEffect(() => {
    onLive([
      { label: t('Score', 'Puan', language), value: r.score.toLocaleString(), tone: 'gold' },
      { label: t('Time', 'Süre', language), value: `${secondsLeft}s`, tone: secondsLeft <= 5 ? 'hot' : 'plain' },
      { label: t('Hits', 'İsabet', language), value: String(r.hits) },
    ]);
  }, [r.score, r.hits, secondsLeft, language, onLive]);

  const lifeLeft = r.target ? 1 - (r.elapsed - r.target.born) / life : 0;

  return (
    <div
      ref={fieldRef}
      key={shake}
      className={`rt-play rt-aim${shake ? ' is-shake' : ''}`}
      onPointerDown={missField}
    >
      <div className="rt-aim__lives" aria-label={`${r.lives} lives`}>
        {Array.from({ length: LIVES }, (_, i) => (
          <Heart key={i} size={18} fill="currentColor" className={i >= r.lives ? 'is-lost' : ''} />
        ))}
      </div>

      {r.target && (
        <button
          key={r.target.id}
          type="button"
          className="rt-target"
          style={{ left: `${r.target.x}%`, top: `${r.target.y}%`, '--size': `${size}px` } as CSSProperties}
          onPointerDown={hitTarget}
          aria-label={t('Target', 'Hedef', language)}
        >
          <svg viewBox="0 0 100 100" aria-hidden>
            <circle cx="50" cy="50" r="46" strokeDasharray={RING} strokeDashoffset={RING * (1 - lifeLeft)} />
          </svg>
        </button>
      )}

      {r.elapsed < 600 && (
        <p className="rt-hint rt-aim__intro">
          {t('Snap the bullseyes before they vanish.', 'Hedefler kaybolmadan vur.', language)}
        </p>
      )}

      {pops.map((p) => (
        <span key={p.id} className={`rt-pop rt-pop--${p.kind}`} style={{ left: `${p.x}%`, top: `${p.y}%` }}>
          {p.text}
        </span>
      ))}
    </div>
  );
}
