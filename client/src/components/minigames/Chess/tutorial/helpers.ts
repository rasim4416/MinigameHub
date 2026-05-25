import type { TutorialRestrictions } from "./types";

export function tutorialBlocksBoard(
  r: TutorialRestrictions | null,
): boolean {
  if (!r) return false;
  if (r.blockAllBoardInput) return true;
  return false;
}

export function tutorialFilterMoves(
  moves: [number, number][],
  from: [number, number],
  r: TutorialRestrictions | null,
): [number, number][] {
  if (!r?.allowedMoves?.length) return moves;
  const allowed = r.allowedMoves.filter(
    (m) => m.from[0] === from[0] && m.from[1] === from[1],
  );
  if (allowed.length === 0) return moves;
  const toSet = new Set(allowed.map((m) => `${m.to[0]},${m.to[1]}`));
  return moves.filter(([tr, tc]) => toSet.has(`${tr},${tc}`));
}

export function tutorialAllowsSquareSelect(
  r: [number, number],
  restrictions: TutorialRestrictions | null,
): boolean {
  if (!restrictions) return true;
  if (restrictions.blockAllBoardInput) return false;
  if (restrictions.highlightSquares?.length) {
    return restrictions.highlightSquares.some(
      ([hr, hc]) => hr === r[0] && hc === r[1],
    );
  }
  if (restrictions.allowedMoves?.length) {
    return restrictions.allowedMoves.some(
      (m) => m.from[0] === r[0] && m.from[1] === r[1],
    );
  }
  return true;
}

export function tutorialAllowsSpell(
  spellId: string,
  r: TutorialRestrictions | null,
): boolean {
  if (!r) return true;
  if (r.blockAllSpells) return false;
  if (r.allowSpellIds?.length) return r.allowSpellIds.includes(spellId);
  return true;
}

export function tutorialAllowsAugment(
  id: string,
  r: TutorialRestrictions | null,
): boolean {
  if (!r?.allowedAugmentIds?.length) return true;
  return r.allowedAugmentIds.includes(id);
}

export function tutorialAllowsShopBuy(
  id: string,
  r: TutorialRestrictions | null,
): boolean {
  if (!r?.allowedShopIds?.length) return true;
  return r.allowedShopIds.includes(id);
}

export function tutorialMatchMove(
  from: [number, number],
  to: [number, number],
  r: TutorialRestrictions | null,
): boolean {
  if (!r?.allowedMoves?.length) return true;
  return r.allowedMoves.some(
    (m) =>
      m.from[0] === from[0] &&
      m.from[1] === from[1] &&
      m.to[0] === to[0] &&
      m.to[1] === to[1],
  );
}
