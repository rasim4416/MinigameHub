import { useCallback, useEffect, useRef } from "react";
import type { Language } from "@/lib/language";

export interface LiveStat {
  label: string;
  value: string;
  tone?: "gold" | "plain" | "hot";
}

export interface ModeResult {
  /** Value compared against the stored best for this mode. */
  bestValue: number;
  headline: string;
  headlineLabel: string;
  /** 0..1, drives the grade title. */
  quality: number;
  chips: number;
  stats: { label: string; value: string }[];
}

export interface ModeProps<S> {
  settings: S;
  language: Language;
  paused: boolean;
  onLive: (stats: LiveStat[]) => void;
  onFinish: (result: ModeResult) => void;
}

export const now = () => performance.now();
export const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
export const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Timeouts owned by a mode. Everything is cancelled on unmount; `clearAll`
 * lets a mode abort a trial (foul, pause) without leaking callbacks.
 */
export function useTimers() {
  const ids = useRef(new Set<ReturnType<typeof setTimeout>>());

  const clearAll = useCallback(() => {
    ids.current.forEach(clearTimeout);
    ids.current.clear();
  }, []);

  const schedule = useCallback((cb: () => void, ms: number) => {
    const id = setTimeout(() => {
      ids.current.delete(id);
      cb();
    }, ms);
    ids.current.add(id);
    return id;
  }, []);

  useEffect(() => clearAll, [clearAll]);
  return { schedule, clearAll };
}

/**
 * Keyboard reactions. A key still held from the lobby (the Enter that started
 * the run) never counts: presses only register after a keyup or a short arm
 * delay, and auto-repeat is ignored.
 */
export function useReactionKeys(
  onPress: (key: string) => void,
  keys: string[],
  enabled: boolean,
) {
  const handler = useRef(onPress);
  handler.current = onPress;
  const keyList = keys.join("|");

  useEffect(() => {
    if (!enabled) return;
    const watched = keyList.split("|");
    let armed = false;
    const armTimer = setTimeout(() => (armed = true), 350);
    const down = (e: KeyboardEvent) => {
      if (!watched.includes(e.key)) return;
      e.preventDefault();
      if (e.repeat || !armed) return;
      handler.current(e.key);
    };
    const up = (e: KeyboardEvent) => {
      if (watched.includes(e.key)) armed = true;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      clearTimeout(armTimer);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [enabled, keyList]);
}
