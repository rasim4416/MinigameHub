import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAudio } from '@/lib/stores/useAudio';
import type { ClassicSettings } from '../reactionTestCopy';
import { t } from '../reactionTestCopy';
import { clamp01, now, randomBetween, useReactionKeys, useTimers, type ModeProps } from '../timing';

type Stage = 'waiting' | 'go' | 'result' | 'foul';

const MIN_WAIT = 500;

const verdict = (ms: number, lang: ModeProps<ClassicSettings>['language']) => {
  if (ms < 180) return t('Inhuman', 'İnsanüstü', lang);
  if (ms < 230) return t('Snappy', 'Şimşek gibi', lang);
  if (ms < 290) return t('Solid', 'Sağlam', lang);
  if (ms < 380) return t('Warming up', 'Isınıyor', lang);
  return t('Were you blinking?', 'Göz mü kırptın?', lang);
};

export default function ClassicFlash({ settings, language, paused, onLive, onFinish }: ModeProps<ClassicSettings>) {
  const { playHit } = useAudio();
  const { schedule, clearAll } = useTimers();
  const [stage, setStage] = useState<Stage>('waiting');
  const [times, setTimes] = useState<number[]>([]);
  const [fouls, setFouls] = useState(0);
  const [shake, setShake] = useState(0);
  const timesRef = useRef<number[]>([]);
  const foulsRef = useRef(0);
  const goAt = useRef<number | null>(null);
  const stageRef = useRef<Stage>('waiting');
  stageRef.current = stage;

  const finished = useRef(false);
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    const ts = timesRef.current;
    const mean = Math.round(ts.reduce((a, b) => a + b, 0) / ts.length);
    const fastest = Math.min(...ts);
    const n = ts.length;
    const sd = Math.round(Math.sqrt(ts.reduce((a, b) => a + (b - mean) ** 2, 0) / n));
    onFinish({
      bestValue: mean,
      headline: `${mean} ms`,
      headlineLabel: t('average reaction', 'ortalama tepki', language),
      quality: clamp01((400 - mean) / 220),
      chips: Math.max(0, Math.round(((400 - mean) * n) / 5)),
      stats: [
        { label: t('Fastest', 'En hızlı', language), value: `${fastest}` },
        { label: t('Slowest', 'En yavaş', language), value: `${Math.max(...ts)}` },
        { label: t('Spread', 'Sapma', language), value: `±${sd}` },
        { label: t('Fouls', 'Faul', language), value: String(foulsRef.current) },
      ],
    });
  }, [language, onFinish]);

  const startTrial = useCallback(() => {
    clearAll();
    goAt.current = null;
    setStage('waiting');
    schedule(() => setStage('go'), randomBetween(MIN_WAIT, settings.maxWait));
  }, [clearAll, schedule, settings.maxWait]);

  const advance = useCallback(() => {
    if (timesRef.current.length >= settings.trials) finish();
    else startTrial();
  }, [settings.trials, finish, startTrial]);

  useEffect(() => {
    startTrial();
  }, [startTrial]);

  // Stamp the moment green is committed; a single rAF lands just before that frame paints.
  useLayoutEffect(() => {
    if (stage !== 'go') return;
    const id = requestAnimationFrame(() => (goAt.current = now()));
    return () => cancelAnimationFrame(id);
  }, [stage]);

  const wasPaused = useRef(paused);
  useEffect(() => {
    if (wasPaused.current === paused) return;
    wasPaused.current = paused;
    if (paused) {
      clearAll();
      return;
    }
    if (stageRef.current === 'result') advance();
    else startTrial();
  }, [paused, clearAll, startTrial, advance]);

  const press = useCallback(() => {
    if (paused) return;
    const s = stageRef.current;
    if (s === 'waiting') {
      clearAll();
      foulsRef.current += 1;
      setFouls(foulsRef.current);
      setShake((k) => k + 1);
      setStage('foul');
      schedule(startTrial, 1200);
      return;
    }
    if (s === 'go') {
      const rt = Math.max(1, Math.round(now() - (goAt.current ?? now())));
      timesRef.current = [...timesRef.current, rt];
      setTimes(timesRef.current);
      playHit();
      setStage('result');
      schedule(advance, timesRef.current.length >= settings.trials ? 900 : 1100);
    }
  }, [paused, clearAll, schedule, startTrial, advance, playHit, settings.trials]);

  useReactionKeys(press, [' ', 'Enter'], !paused);

  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  useEffect(() => {
    onLive([
      { label: t('Trial', 'Deneme', language), value: `${Math.min(times.length + 1, settings.trials)}/${settings.trials}` },
      { label: t('Average', 'Ortalama', language), value: avg ? `${avg} ms` : '—', tone: 'gold' },
      { label: t('Fouls', 'Faul', language), value: String(fouls), tone: fouls ? 'hot' : 'plain' },
    ]);
  }, [times.length, avg, fouls, settings.trials, language, onLive]);

  const last = times[times.length - 1];

  return (
    <div
      key={shake}
      className={`rt-flash rt-flash--${stage}${stage === 'foul' ? ' is-shake' : ''}`}
      onPointerDown={(e) => { e.preventDefault(); press(); }}
      role="button"
      aria-live="polite"
    >
      {stage === 'waiting' && (
        <>
          <p className="rt-headline">{t('Wait for green…', 'Yeşili bekle…', language)}</p>
          <p className="rt-hint">{t("Don't jump the gun.", 'Erken davranma.', language)}</p>
        </>
      )}
      {stage === 'go' && <p className="rt-headline">{t('NOW!', 'ŞİMDİ!', language)}</p>}
      {stage === 'result' && last !== undefined && (
        <>
          <span className="rt-big">{last}<small>ms</small></span>
          <span className="rt-flash__verdict">{verdict(last, language)}</span>
        </>
      )}
      {stage === 'foul' && (
        <>
          <p className="rt-headline">{t('Too soon!', 'Çok erken!', language)}</p>
          <p className="rt-hint">{t('Patience is a reflex too. Retrying…', 'Sabır da bir reflekstir. Tekrar…', language)}</p>
        </>
      )}
      <div className="rt-pips" aria-hidden>
        {Array.from({ length: settings.trials }, (_, i) => (
          <span key={i} className={i < times.length ? 'is-done' : i === times.length ? 'is-now' : ''} />
        ))}
      </div>
      {stage === 'waiting' && times.length === 0 && (
        <p className="rt-hint">{t('Tap, click, or press', 'Dokun, tıkla ya da bas', language)} <kbd>Space</kbd></p>
      )}
    </div>
  );
}
