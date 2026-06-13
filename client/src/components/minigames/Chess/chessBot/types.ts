import type { PieceType } from "../engine";

export type BotMove = {
  from: [number, number];
  to: [number, number];
  promotion?: PieceType;
};

export type RankedSearchOptions = {
  multiPv?: number;
  depth?: number;
  movetimeMs?: number;
};
