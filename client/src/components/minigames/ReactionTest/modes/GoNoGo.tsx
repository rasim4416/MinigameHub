import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAudio } from '@/lib/stores/useAudio';
import type { GoNoGoSettings } from '../reactionTestCopy';
import { t } from '../reactionTestCopy';
import { clamp01, now, randomBetween, useReactionKeys, useTimers, type ModeProps } from '../timing';

type Stage = 'fix' | 'stim' | 'feedback';
type Outcome = 'hit' | 'miss' | 'falseAlarm' | 'reject' | 'early';

const STIM_WINDOW = 800;
const FEEDBACK_MS = 550;
const POINTS: Record<Exclude<Outcome, 'hit'>, number> = { miss: -5, falseAlarm: -10, reject: 5, early: -5 };
const speedBonus = (rt: number) => Math.max(0, Math.min(10, Math.round((600 - rt) / 35)));

function buildTrials(n: number, ratio: number) {
  const goCount = Math.round(n * ratio);
  const list = Array.from({ length: n }, (_, i) => i < goCount);
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export default function GoNoGo({ settings, language, paused, onLive, onFinish }: ModeProps<GoNoGoSettings>) {
  const { playHit } = useAudio();
  const { schedule, clearAll } = useTimers();
  const trials = useRef(buildTrials(settings.trials, settings.ratio));
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<Stage>('fix');
  const [feedback, setFeedback] = useState<{ outcome: Outcome; text: string } | null>(null);
  const [score, setScore] = useState(0);
  const [shake, setShake] = useState(0);
  const indexRef = useRef(0);
  const stageRef = useRef<Stage>('fix');
  stageRef.current = stage;
  const scoreRef = useRef(0);
  const shownAt = useRef<number | null>(null);
  const tally = useRef({ hit: 0, miss: 0, falseAlarm: 0, reject: 0, early: 0, rts: [] as number[] });
  const finished = useRef(false);
  const resolveRef = useRef<(outcome: Outcome) => void>(() => {});

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    const c = tally.current;
    const n = trials.current.length;
    const acc = (c.hit + c.reject) / n;
    const avg = c.rts.length ? Math.round(c.rts.reduce((a, b) => a + b, 0) / c.rts.length) : 0;
    const speed = avg ? clamp01((650 - avg) / 350) : 0;
    const final = Math.max(0, scoreRef.current);
    onFinish({
      bestValue: final,
      headline: final.toLocaleString(),
      headlineLabel: t('points', 'puan', language),
      quality: clamp01(acc * (0.45 + 0.55 * speed)),
      chips: final,
      stats: [
        { label: t('Accuracy', 'Doğruluk', language), value: `${Math.round(acc * 100)}%` },
        { label: t('Avg go', 'Ort. tepki', language), value: avg ? `${avg}` : '—' },
        { label: t('False alarms', 'Yanlış alarm', language), value: String(c.falseAlarm + c.early) },
        { label: t('Missed go', 'Kaçan', language), value: String(c.miss) },
      ],
    });
  }, [language, onFinish]);

  const runTrial = useCallback(
    (i: number) => {
      clearAll();
      if (i >= trials.current.length) {
        finish();
        return;
      }
      indexRef.current = i;
      setIndex(i);
      shownAt.current = null;
      setFeedback(null);
      setStage('fix');
      schedule(() => {
        setStage('stim');
        schedule(() => resolveRef.current(trials.current[i] ? 'miss' : 'reject'), STIM_WINDOW);
      }, randomBetween(600, 1300));
    },
    [clearAll, schedule, finish],
  );

  const resolve = useCallback(
    (outcome: Outcome, rt = 0) => {
      clearAll();
      const pts = outcome === 'hit' ? 10 + speedBonus(rt) : POINTS[outcome];
      scoreRef.current = Math.max(0, scoreRef.current + pts);
      setScore(scoreRef.current);
      const c = tally.current;
      c[outcome] += 1;
      if (outcome === 'hit') {
        c.rts.push(rt);
        playHit();
      }
      if (outcome === 'falseAlarm' || outcome === 'early') setShake((k) => k + 1);
      const label: Record<Outcome, string> = {
        hit: `${rt} ms`,
        miss: t('Too slow', 'Geç kaldın', language),
        falseAlarm: t('That was a stop!', 'Dur demiştik!', language),
        reject: t('Nice restraint', 'İyi frenledin', language),
        early: t('Jumped early', 'Erken bastın', language),
      };
      setFeedback({ outcome, text: `${label[outcome]}  ${pts > 0 ? '+' : ''}${pts}` });
      setStage('feedback');
      schedule(() => runTrial(indexRef.current + 1), FEEDBACK_MS);
    },
    [clearAll, schedule, runTrial, playHit, language],
  );

  resolveRef.current = resolve;

  useEffect(() => {
    runTrial(0);
  }, [runTrial]);

  useLayoutEffect(() => {
    if (stage !== 'stim') return;
    const id = requestAnimationFrame(() => (shownAt.current = now()));
    return () => cancelAnimationFrame(id);
  }, [stage, index]);

  const wasPaused = useRef(paused);
  useEffect(() => {
    if (wasPaused.current === paused) return;
    wasPaused.current = paused;
    if (paused) {
      clearAll();
      return;
    }
    runTrial(stageRef.current === 'feedback' ? indexRef.current + 1 : indexRef.current);
  }, [paused, clearAll, runTrial]);

  const press = useCallback(() => {
    if (paused) return;
    const s = stageRef.current;
    if (s === 'fix') resolve('early');
    else if (s === 'stim') {
      if (trials.current[indexRef.current]) {
        resolve('hit', Math.max(1, Math.round(now() - (shownAt.current ?? now()))));
      } else resolve('falseAlarm');
    }
  }, [paused, resolve]);

  useReactionKeys(press, [' ', 'Enter'], !paused);

  useEffect(() => {
    onLive([
      { label: t('Score', 'Puan', language), value: score.toLocaleString(), tone: 'gold' },
      { label: t('Trial', 'Deneme', language), value: `${Math.min(index + 1, settings.trials)}/${settings.trials}` },
    ]);
  }, [score, index, settings.trials, language, onLive]);

  const isGo = trials.current[index];
  const good = feedback && (feedback.outcome === 'hit' || feedback.outcome === 'reject');

  return (
    <div
      key={shake}
      className={`rt-play rt-gng${shake ? ' is-shake' : ''}`}
      onPointerDown={(e) => { e.preventDefault(); press(); }}
      role="button"
    >
      <div className="rt-gng__arena" aria-live="polite">
        {stage === 'fix' && <span className="rt-gng__fix">+</span>}
        {stage === 'stim' && (isGo ? <span className="rt-gng__go" /> : <span className="rt-gng__stop" />)}
        {stage === 'feedback' && feedback && (
          <span className={`rt-gng__feedback ${good ? 'is-good' : 'is-bad'}`}>{feedback.text}</span>
        )}
      </div>
      <div className="rt-gng__legend">
        <span><i /> {t('Go: tap', 'Bas', language)}</span>
        <span><i className="is-stop" /> {t('Stop: freeze', 'Dur', language)}</span>
      </div>
      {index === 0 && stage === 'fix' && (
        <p className="rt-hint">{t('Tap, click, or press', 'Dokun, tıkla ya da bas', language)} <kbd>Space</kbd></p>
      )}
    </div>
  );
}
