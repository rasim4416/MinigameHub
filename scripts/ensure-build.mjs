import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(__dirname, "../dist/public/index.html");

if (!fs.existsSync(indexPath)) {
  console.error(
    "Production build missing (dist/public/index.html). Run: npm run build",
  );
  process.exit(1);
}
