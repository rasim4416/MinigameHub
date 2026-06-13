import type { PieceType } from "../engine";
import type { BotMove } from "./types";
import { squareToAlg } from "./fen";

/** Parse UCI e.g. e7e5 or e7e8q into board coordinates (row 0 = rank 8). */
export function uciToBotMove(uci: string): BotMove | null {
  const m = uci.match(/^([a-h])([1-8])([a-h])([1-8])([qrbn])?$/);
  if (!m) return null;
  const fc = m[1]!.charCodeAt(0) - 97;
  const fr = 8 - Number(m[2]);
  const tc = m[3]!.charCodeAt(0) - 97;
  const tr = 8 - Number(m[4]);
  const promoChar = m[5];
  const promoMap: Record<string, PieceType> = {
    q: "Q",
    r: "R",
    b: "B",
    n: "N",
  };
  return {
    from: [fr, fc],
    to: [tr, tc],
    promotion: promoChar ? promoMap[promoChar] : undefined,
  };
}

export function sameMove(a: BotMove, b: BotMove): boolean {
  return (
    a.from[0] === b.from[0] &&
    a.from[1] === b.from[1] &&
    a.to[0] === b.to[0] &&
    a.to[1] === b.to[1] &&
    (a.promotion ?? null) === (b.promotion ?? null)
  );
}

export function moveToUci(move: BotMove): string {
  const from = squareToAlg(move.from[0], move.from[1]);
  const to = squareToAlg(move.to[0], move.to[1]);
  const promo =
    move.promotion?.toLowerCase() as "q" | "r" | "b" | "n" | undefined;
  return `${from}${to}${promo ?? ""}`;
}
