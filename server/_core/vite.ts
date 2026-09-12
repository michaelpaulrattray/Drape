import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer, searchForWorkspaceRoot } from "vite";
import viteConfig from "../../vite.config";

/**
 * THE DEV SERVER'S FILE ALLOW-LIST LIVES HERE, NOT IN `vite.config.ts` (#842).
 *
 * `setupVite` spreads the config and then REPLACES its whole `server` key with
 * `serverOptions`, so a `server.fs` block written in `vite.config.ts` never
 * reaches the dev server — it has been dead since the bootstrap commit, and the
 * vite CLI is only ever run as `vite build`, which ignores `server` entirely.
 * The allow-list therefore has to be declared in the object Vite actually
 * receives, which is this one.
 *
 * Why it needs a second entry at all: a shift worktree's `node_modules` is a
 * junction to the main tree's (`scripts/shift-worktree.mts`, one install for
 * every tree). Vite resolves a CSS `url()` — every `@fontsource` woff2 — through
 * the junction to its REAL path under the main tree, serves it via `/@fs/`, and
 * `fs.strict` (Vite's default, kept explicit here) refuses it: the only allowed
 * root is the workspace, which is the worktree. JS modules survive because the
 * dep optimiser copies them into the worktree's own `.vite/deps`; static assets
 * do not. Measured 2026-09-12: every webfont 403, `document.fonts` at `error`,
 * every mono label 1.4 px shorter, and a before/after taken across the main
 * tree and a worktree reading as a 12 px regression that did not exist.
 *
 * `realpathSync` on a plain clone resolves `node_modules` to itself, a path
 * INSIDE the workspace root it already allows — so on a clone without a
 * junction the second entry widens nothing. Setting `allow` REPLACES Vite's
 * default rather than extending it, so the workspace root is restated first.
 * `server/viteDevFsAllow.test.ts` drives both roads against a real junction.
 */
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

export function devServerFsAllow(repoRoot: string = REPO_ROOT): string[] {
  const nodeModules = path.join(repoRoot, "node_modules");
  const real = fs.existsSync(nodeModules) ? fs.realpathSync(nodeModules) : nodeModules;
  const workspace = searchForWorkspaceRoot(repoRoot);
  return real === workspace ? [workspace] : [workspace, real];
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
    fs: { strict: true, allow: devServerFsAllow() },
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
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
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
