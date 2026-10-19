import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useAudio } from '@/lib/stores/useAudio';
import type { SequenceSettings } from '../reactionTestCopy';
import { t } from '../reactionTestCopy';
import { clamp01, useReactionKeys, useTimers, type ModeProps } from '../timing';

type Stage = 'show' | 'input' | 'success' | 'fail';

const PADS = ['#facc15', '#fb7185', '#4ade80', '#38bdf8'];
const KEYS = ['1', '2', '3', '4'];
const PACE: Record<SequenceSettings['pace'], { flash: number; gap: number }> = {
  slow: { flash: 650, gap: 260 },
  normal: { flash: 450, gap: 180 },
  fast: { flash: 280, gap: 120 },
};
const PACE_LABEL: Record<SequenceSettings['pace'], [string, string]> = {
  slow: ['Slow', 'Yavaş'],
  normal: ['Normal', 'Normal'],
  fast: ['Fast', 'Hızlı'],
};
const LEAD_IN = 650;
const TAP_FLASH = 170;

const randomPad = () => Math.floor(Math.random() * PADS.length);

export default function SequenceEcho({ settings, language, paused, onLive, onFinish }: ModeProps<SequenceSettings>) {
  const { playHit } = useAudio();
  const { schedule, clearAll } = useTimers();
  const { flash, gap } = PACE[settings.pace];

  const seqRef = useRef<number[]>(Array.from({ length: settings.start }, randomPad));
  const posRef = useRef(0);
  const clearedRef = useRef(0);
  const stageRef = useRef<Stage>('show');
  const [stage, setStageState] = useState<Stage>('show');
  const [lit, setLit] = useState<number | null>(null);
  const [length, setLength] = useState<number>(settings.start);
  const [cleared, setCleared] = useState(0);
  const finished = useRef(false);

  const setStage = (s: Stage) => {
    stageRef.current = s;
    setStageState(s);
  };

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    const best = clearedRef.current;
    onFinish({
      bestValue: best,
      headline: String(best),
      headlineLabel: t('longest echo', 'en uzun seri', language),
      quality: clamp01(best / 12),
      chips: best * 25,
      stats: [
        { label: t('Start', 'Başlangıç', language), value: String(settings.start) },
        { label: t('Reached', 'Ulaşılan', language), value: String(seqRef.current.length) },
        { label: t('Rounds', 'Tur', language), value: String(Math.max(0, best - settings.start + 1)) },
        { label: t('Pace', 'Tempo', language), value: t(PACE_LABEL[settings.pace][0], PACE_LABEL[settings.pace][1], language) },
      ],
    });
  }, [language, onFinish, settings.start, settings.pace]);

  const playback = useCallback(() => {
    clearAll();
    setLit(null);
    posRef.current = 0;
    setStage('show');
    const step = flash + gap;
    seqRef.current.forEach((pad, i) => {
      schedule(() => setLit(pad), LEAD_IN + i * step);
      schedule(() => setLit(null), LEAD_IN + i * step + flash);
    });
    schedule(() => setStage('input'), LEAD_IN + seqRef.current.length * step - gap + 80);
  }, [clearAll, schedule, flash, gap]);

  useEffect(() => {
    playback();
  }, [playback]);

  const wasPaused = useRef(paused);
  useEffect(() => {
    if (wasPaused.current === paused) return;
    wasPaused.current = paused;
    if (paused) {
      if (stageRef.current === 'show' || stageRef.current === 'success') clearAll();
      return;
    }
    if (stageRef.current === 'show') playback();
    else if (stageRef.current === 'success') {
      seqRef.current = [...seqRef.current, randomPad()];
      setLength(seqRef.current.length);
      playback();
    }
  }, [paused, clearAll, playback]);

  const tap = useCallback(
    (pad: number) => {
      if (paused || stageRef.current !== 'input') return;
      setLit(pad);
      schedule(() => setLit((l) => (l === pad ? null : l)), TAP_FLASH);
      if (seqRef.current[posRef.current] !== pad) {
        setStage('fail');
        schedule(finish, 1100);
        return;
      }
      posRef.current += 1;
      if (posRef.current < seqRef.current.length) return;
      clearedRef.current = seqRef.current.length;
      setCleared(clearedRef.current);
      playHit();
      setStage('success');
      schedule(() => {
        seqRef.current = [...seqRef.current, randomPad()];
        setLength(seqRef.current.length);
        playback();
      }, 750);
    },
    [paused, schedule, finish, playHit, playback],
  );

  useReactionKeys((key) => tap(KEYS.indexOf(key)), KEYS, !paused);

  useEffect(() => {
    onLive([
      { label: t('Length', 'Uzunluk', language), value: String(length) },
      { label: t('Cleared', 'Geçilen', language), value: cleared ? String(cleared) : '—', tone: 'gold' },
    ]);
  }, [length, cleared, language, onLive]);

  const status =
    stage === 'show'
      ? t('Watch closely…', 'Dikkatle izle…', language)
      : stage === 'input'
        ? t(`Your echo · ${posRef.current}/${length}`, `Sıra sende · ${posRef.current}/${length}`, language)
        : stage === 'success'
          ? t('Echo received!', 'Yankı alındı!', language)
          : t('Off-key. Run over.', 'Ritim kaçtı. Bitti.', language);

  return (
    <div className="rt-play rt-seq">
      <p
        className={`rt-seq__status${stage === 'fail' ? ' is-bad' : stage === 'success' ? ' is-good' : ''}`}
        aria-live="polite"
      >
        {status}
      </p>
      <div className={`rt-seq__pad${stage !== 'input' ? ' is-locked' : ''}${stage === 'fail' ? ' is-fail' : ''}`}>
        {PADS.map((c, i) => (
          <button
            key={c}
            type="button"
            className={`rt-seq__btn${lit === i ? ' is-lit' : ''}`}
            style={{ '--c': c } as CSSProperties}
            onPointerDown={(e) => { e.preventDefault(); tap(i); }}
            aria-label={t(`Pad ${i + 1}`, `Tuş ${i + 1}`, language)}
          >
            <kbd>{KEYS[i]}</kbd>
          </button>
        ))}
      </div>
      <p className="rt-hint">{t('Tap the pads or use keys', 'Tuşlara dokun ya da bas', language)} <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd></p>
    </div>
  );
}
