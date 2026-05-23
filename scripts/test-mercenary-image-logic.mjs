#!/usr/bin/env node
/** Smoke test: mercenary image URL resolution and orange piece detection. */
import assert from "assert";
import path from "path";
import { fileURLToPath } from "url";

// Mirror mercenaryAssets.ts logic (keep in sync) for CI without TS runner.
const PIECE_STEM = { P: "pawn", N: "knight", R: "rook", B: "bishop", Q: "queen" };

function publicAssetUrl(filename, base = "/") {
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}${filename.replace(/^\//, "")}`;
}

function mercenaryImageCandidates(type, base = "/") {
  const stem = PIECE_STEM[type];
  if (!stem) return [];
  return [
    publicAssetUrl(`chess-orange-mercenary-${stem}.png`, base),
    publicAssetUrl(`chess-orange-mercenary-${stem}.svg`, base),
  ];
}

function shouldRender(piece) {
  if (!piece || piece.color !== "orange") return false;
  return piece.type in PIECE_STEM;
}

const pawn = { type: "P", color: "orange", id: "mercenary-event-lost-abc" };
assert(shouldRender(pawn));
const urls = mercenaryImageCandidates("P");
assert(urls[0].endsWith(".png"));
assert(urls[1].endsWith(".svg"));
assert(
  mercenaryImageCandidates("P", "/games/")[0].startsWith("/games/"),
  "subpath base",
);

const noId = { type: "N", color: "orange" };
assert(shouldRender(noId), "orange without id still renders");

const white = { type: "P", color: "white" };
assert(!shouldRender(white));

console.log("mercenary image logic: ok");
