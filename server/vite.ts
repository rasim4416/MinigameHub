import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

/** Do not serve SPA HTML for static public assets (mercenary SVGs, audio, etc.). */
const STATIC_PUBLIC_FILE =
  /\.(svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot|mp3|wav|ogg|gltf|glb|json)(\?.*)?$/i;

function resolveClientPublicDir(): string {
  return path.resolve(__dirname, "..", "client", "public");
}

function resolveProductionDistDir(): string {
  const nextToBundle = path.resolve(__dirname, "public");
  if (fs.existsSync(nextToBundle)) return nextToBundle;
  const repoDist = path.resolve(__dirname, "..", "dist", "public");
  if (fs.existsSync(repoDist)) return repoDist;
  return nextToBundle;
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  const clientPublic = resolveClientPublicDir();
  app.use(express.static(clientPublic));

  app.use("*", async (req, res, next) => {
    if (STATIC_PUBLIC_FILE.test(req.path)) {
      return next();
    }
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = resolveProductionDistDir();

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (req, res) => {
    if (STATIC_PUBLIC_FILE.test(req.path)) {
      res.status(404).end();
      return;
    }
    // Stale cached index.html can reference missing hashed bundles; returning
    // HTML for /assets/* breaks module loading and yields a blank page.
    if (req.path.startsWith("/assets/")) {
      res.status(404).end();
      return;
    }
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
