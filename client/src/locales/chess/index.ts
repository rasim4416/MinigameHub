import type { Language } from "../../lib/language";
import { AUGMENT_POOL, AUGMENT_IMPROVEMENTS, type Augment, type AugmentUpgradeLevels } from "../../components/minigames/Chess/augments";
import { EVENT_POOL, type GameEvent } from "../../components/minigames/Chess/events";
import type { AugmentLocaleEntry, EventLocaleEntry } from "./types";
import { AUGMENTS_EN } from "./augments.en";
import { AUGMENTS_TR } from "./augments.tr";
import { IMPROVEMENTS_EN } from "./improvements.en";
import { IMPROVEMENTS_TR } from "./improvements.tr";
import { EVENTS_EN } from "./events.en";
import { EVENTS_TR } from "./events.tr";

const AUGMENTS: Record<Language, Record<string, AugmentLocaleEntry>> = {
  english: AUGMENTS_EN,
  türkçe: AUGMENTS_TR,
};

const IMPROVEMENTS: Record<Language, Record<string, string[]>> = {
  english: IMPROVEMENTS_EN,
  türkçe: IMPROVEMENTS_TR,
};

const EVENTS: Record<Language, Record<string, EventLocaleEntry>> = {
  english: EVENTS_EN,
  türkçe: EVENTS_TR,
};

function poolAugment(id: string): Augment | undefined {
  return AUGMENT_POOL.find((a) => a.id === id);
}

function poolEvent(id: string): GameEvent | undefined {
  return EVENT_POOL.find((e) => e.id === id);
}

export function getAugmentName(id: string, lang: Language): string {
  return AUGMENTS[lang][id]?.name ?? poolAugment(id)?.name ?? id;
}

export function getAugmentDescription(id: string, lang: Language): string {
  return (
    AUGMENTS[lang][id]?.description ??
    poolAugment(id)?.description ??
    ""
  );
}

export function getAugmentImproveDescription(
  augId: string,
  tierIndex: number,
  lang: Language,
): string {
  const localized = IMPROVEMENTS[lang][augId]?.[tierIndex];
  if (localized) return localized;
  const tiers = AUGMENT_IMPROVEMENTS[augId];
  return tiers?.[tierIndex]?.description ?? "";
}

export function getAugmentDisplayDescription(
  aug: Augment,
  levels: AugmentUpgradeLevels,
  lang: Language,
): string {
  const level = levels[aug.id] ?? 0;
  const tiers = AUGMENT_IMPROVEMENTS[aug.id];
  if (level > 0 && tiers) {
    const idx = Math.min(level, tiers.length) - 1;
    return getAugmentImproveDescription(aug.id, idx, lang);
  }
  return getAugmentDescription(aug.id, lang);
}

export function getEventName(id: string, lang: Language): string {
  return EVENTS[lang][id]?.name ?? poolEvent(id)?.name ?? id;
}

export function getEventDescription(id: string, lang: Language): string {
  return (
    EVENTS[lang][id]?.description ??
    poolEvent(id)?.description ??
    ""
  );
}

export function getEventFlavor(id: string, lang: Language): string | undefined {
  const flavor = EVENTS[lang][id]?.flavor ?? poolEvent(id)?.flavor;
  return flavor;
}
