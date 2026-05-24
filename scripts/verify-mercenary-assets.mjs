#!/usr/bin/env node
/**
 * Verifies mercenary piece images exist in client/public (SVG required; PNG optional).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "..", "client", "public");
const assetsDir = path.resolve(__dirname, "..", "client", "src", "assets", "mercenary");
const stems = ["pawn", "knight", "rook", "bishop", "queen"];
const pngStems = ["pawn", "knight"];

let failed = false;
for (const stem of stems) {
  const svgPublic = path.join(publicDir, `chess-orange-mercenary-${stem}.svg`);
  const svgAssets = path.join(assetsDir, `chess-orange-mercenary-${stem}.svg`);
  if (!fs.existsSync(svgPublic) && !fs.existsSync(svgAssets)) {
    console.error(`Missing required SVG: chess-orange-mercenary-${stem}.svg`);
    failed = true;
  } else {
    console.log(`OK svg: chess-orange-mercenary-${stem}.svg`);
  }
  if (pngStems.includes(stem)) {
    const pngAssets = path.join(assetsDir, `chess-orange-mercenary-${stem}.png`);
    const pngPublic = path.join(publicDir, `chess-orange-mercenary-${stem}.png`);
    if (!fs.existsSync(pngAssets) && !fs.existsSync(pngPublic)) {
      console.error(`Missing required PNG: chess-orange-mercenary-${stem}.png`);
      failed = true;
    } else {
      console.log(`OK png: chess-orange-mercenary-${stem}.png`);
    }
  }
}

if (failed) process.exit(1);
console.log("Mercenary public assets verified.");
