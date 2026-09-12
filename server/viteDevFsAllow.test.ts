import express from "express";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A WORKTREE DEV SERVER SERVES ITS WEBFONTS (#842).
 *
 * A shift worktree's `node_modules` is a junction to the main tree's. Vite
 * resolves a CSS `url()` through it to the REAL path, serves that via `/@fs/`,
 * and `fs.strict` refuses anything outside the allow-list — whose default is the
 * workspace root alone, i.e. the worktree. Every `@fontsource` woff2 came back
 * 403 and every frame photographed from a worktree server was in the wrong
 * typeface. `devServerFsAllow` adds the junction's real path.
 *
 * Two things are proven, and the second is the one that matters:
 *
 *  1. THE READING — against a real junction in a temp dir, the list carries the
 *     target's real path; on a plain clone (a real directory, no junction) it
 *     carries nothing but the workspace root, because the fix must be inert
 *     where the defect cannot occur.
 *  2. THE WIRE (invariant 5) — `setupVite` hands that list to `createServer`
 *     under `server.fs.allow`, with `strict` still on. The first shape of this
 *     fix was drafted into `vite.config.ts`, where `setupVite` spreads the
 *     config and then REPLACES its whole `server` key — a line there passes a
 *     reading of the helper and changes nothing the browser sees. Only the
 *     object Vite actually receives settles it.
 */

const createServerMock = vi.fn(async () => ({
  middlewares: (_req: unknown, _res: unknown, next: () => void) => next(),
  transformIndexHtml: async (_url: string, html: string) => html,
  ssrFixStacktrace: () => {},
}));

vi.mock("vite", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vite")>();
  return { ...actual, createServer: createServerMock };
});

let scratch: string;
beforeEach(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), "drape-842-"));
});
afterEach(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
  createServerMock.mockClear();
});

/**
 * A fixture root is a package root: `searchForWorkspaceRoot` starts from the
 * nearest `package.json` ABOVE the path it is given, so a bare temp dir would
 * resolve to whatever ancestor happens to hold one (on this machine, the
 * operator's home folder) and the arm would be reading that instead.
 */
function packageRoot(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"fixture","private":true}\n');
  return dir;
}

/** A worktree whose node_modules is a junction to a main tree's, both real. */
function junctionedWorktree(): { worktree: string; mainNodeModules: string } {
  const main = packageRoot(path.join(scratch, "main"));
  const mainNodeModules = path.join(main, "node_modules");
  fs.mkdirSync(mainNodeModules, { recursive: true });
  const worktree = packageRoot(path.join(scratch, "worktree"));
  // 'junction' is what shift-worktree.mts makes on Windows; on POSIX node
  // degrades it to a directory symlink, which realpath resolves the same way.
  fs.symlinkSync(mainNodeModules, path.join(worktree, "node_modules"), "junction");
  return { worktree, mainNodeModules: fs.realpathSync(mainNodeModules) };
}

describe("devServerFsAllow — the reading", () => {
  it("carries the junction's real path beside the workspace root", async () => {
    const { devServerFsAllow } = await import("./_core/vite");
    const { worktree, mainNodeModules } = junctionedWorktree();
    const allow = devServerFsAllow(worktree);
    expect(allow).toContain(mainNodeModules);
    expect(allow.length).toBe(2);
    // The junction path itself is NOT the entry — Vite compares real paths —
    // and the real path lies OUTSIDE the worktree, which is the whole defect.
    expect(allow).not.toContain(path.join(worktree, "node_modules"));
    expect(mainNodeModules.startsWith(fs.realpathSync(worktree) + path.sep)).toBe(false);
  });

  it("widens nothing on a plain clone: a real node_modules resolves to itself, INSIDE the root already allowed", async () => {
    const { devServerFsAllow } = await import("./_core/vite");
    const plain = packageRoot(path.join(scratch, "plain"));
    fs.mkdirSync(path.join(plain, "node_modules"), { recursive: true });
    const root = fs.realpathSync(plain);
    const allow = devServerFsAllow(plain).map((entry) => fs.realpathSync(entry));
    expect(allow[0]).toBe(root);
    // Every entry is the root or a path under it — nothing outside the clone
    // becomes servable because this list exists.
    for (const entry of allow) {
      expect(entry === root || entry.startsWith(root + path.sep), entry).toBe(true);
    }
  });

  it("does not throw before install: a missing node_modules is listed as written", async () => {
    const { devServerFsAllow } = await import("./_core/vite");
    const bare = packageRoot(path.join(scratch, "bare"));
    expect(() => devServerFsAllow(bare)).not.toThrow();
  });
});

describe("setupVite — the wire", () => {
  it("hands createServer the allow-list under server.fs.allow, strict still on", async () => {
    const { devServerFsAllow, setupVite } = await import("./_core/vite");
    const app = express();
    const server = http.createServer(app);
    await setupVite(app, server);
    expect(createServerMock).toHaveBeenCalledTimes(1);
    const received = createServerMock.mock.calls[0]![0] as {
      server?: { fs?: { strict?: boolean; allow?: string[] } };
    };
    expect(received.server?.fs?.strict).toBe(true);
    expect(received.server?.fs?.allow).toEqual(devServerFsAllow());
    // The real tree's own node_modules, resolved: this is the entry that lets a
    // worktree serve the main tree's fonts, and a plain clone its own.
    const realNodeModules = fs.realpathSync(path.resolve(__dirname, "..", "node_modules"));
    expect(received.server?.fs?.allow).toContain(realNodeModules);
    server.close();
  });
});
