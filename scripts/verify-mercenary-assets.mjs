#!/usr/bin/env node
/**
 * Verifies mercenary piece images exist in client/public (SVG required; PNG optional).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "..", "client", "public");
const stems = ["pawn", "knight", "rook", "bishop", "queen"];

let failed = false;
for (const stem of stems) {
  const svg = path.join(publicDir, `chess-orange-mercenary-${stem}.svg`);
  const png = path.join(publicDir, `chess-orange-mercenary-${stem}.png`);
  if (!fs.existsSync(svg)) {
    console.error(`Missing required: ${path.relative(process.cwd(), svg)}`);
    failed = true;
  } else {
    console.log(`OK svg: chess-orange-mercenary-${stem}.svg`);
  }
  if (fs.existsSync(png)) {
    console.log(`OK png: chess-orange-mercenary-${stem}.png`);
  }
}

if (failed) process.exit(1);
console.log("Mercenary public assets verified.");
