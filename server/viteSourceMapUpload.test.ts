import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

/**
 * THE BROWSER'S SOURCE MAPS GO TO SENTRY AND NOWHERE ELSE (#1420 part 1).
 *
 * Three claims, and they fail in three different directions:
 *
 *   1. **No token, no maps.** Every laptop and every CI run has no
 *      `SENTRY_AUTH_TOKEN`. A build that generated maps there would write them
 *      into `dist/public` with nothing to delete them — the leak, arrived at by
 *      omission rather than by error.
 *   2. **Token, maps, and not one left behind.** The plugin deletes what it
 *      uploaded, against a glob THIS repository composes; a wrong glob deletes
 *      nothing, the upload still reports success, and the maps ship. So the
 *      backstop is driven directly rather than trusted.
 *   3. **The token never travels.** It is a credential in a build config, one
 *      `define` entry away from being inside the bundle every customer downloads.
 *
 * # Why this drives the config and the hooks rather than helpers beside them
 *
 * Invariant 5. `server/bundleReportWiring.test.ts` established the road for this
 * file — it imports `vite.config.ts` itself and reads the plugin list vite would
 * actually receive, because a test of a `wantsBundleReport()` helper keeps
 * passing after somebody appends the plugin unconditionally two lines below.
 * Same here: the arms read `build.sourcemap` and the plugin list off the real
 * config object, and they call `closeBundle` on the real plugin.
 *
 * # Working law 3 — a backstop needs a test the model cannot rescue
 *
 * The refusal is not driven through a build, a bundler or a network call. It is
 * `closeBundle()` invoked against a real temporary directory with a real `.map`
 * file in it, and the arm asserts it THROWS. Nothing in that path can behave
 * well by accident.
 */

/** A token shaped like the real one but obviously not it, so a leak is greppable. */
const FAKE_TOKEN = "sntrys_FAKE_TOKEN_FOR_THIS_SUITE_ONLY_do_not_use";

interface LoadedConfig {
  plugins?: unknown;
  build?: { sourcemap?: unknown; outDir?: unknown };
  define?: Record<string, unknown>;
}

/** vite's plugin option nests — `react()` alone returns an array of plugins. */
function flattenPlugins(node: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) {
    for (const child of node) flattenPlugins(child, out);
    return out;
  }
  if (node && typeof node === "object" && "name" in node) out.push(node as Record<string, unknown>);
  return out;
}

async function loadConfig(env: {
  token?: string;
  sha?: string;
}): Promise<{ config: LoadedConfig; plugins: Record<string, unknown>[] }> {
  vi.resetModules();
  const previous = {
    token: process.env.SENTRY_AUTH_TOKEN,
    sha: process.env.RAILWAY_GIT_COMMIT_SHA,
  };
  const set = (key: "SENTRY_AUTH_TOKEN" | "RAILWAY_GIT_COMMIT_SHA", value: string | undefined): void => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };
  set("SENTRY_AUTH_TOKEN", env.token);
  set("RAILWAY_GIT_COMMIT_SHA", env.sha);
  try {
    const mod = (await import("../vite.config")) as { default: LoadedConfig };
    return { config: mod.default, plugins: flattenPlugins(mod.default.plugins) };
  } finally {
    set("SENTRY_AUTH_TOKEN", previous.token);
    set("RAILWAY_GIT_COMMIT_SHA", previous.sha);
  }
}

/** The upload options, read at the wire with the module's own env restored after. */
async function loadUploadOptions(outDir: string, release: string) {
  vi.resetModules();
  const mod = await import("../vite.config");
  return mod.sourceMapUploadOptions({ authToken: FAKE_TOKEN, release, outDir });
}

const trees: string[] = [];

/**
 * THE REGISTRATION LIVES HERE, AND IT USED TO LIVE AT THE CALL SITES (#1795).
 *
 * `trees` was pushed BY HAND after each `tempTree()`, which is working law 4
 * inside one file - four of the five call sites did it and the fifth could not,
 * because it makes its tree inline inside an argument
 * (`mapFilesUnder(path.join(tempTree(), "never-built"))`). So that one directory
 * leaked on every run, and **nothing could ever go red**: a stray empty
 * directory in `%TEMP%` raises no error, fails no assertion and blocks no gate.
 * Janitor patrol #12 read **155** of them in under three days, one per run of
 * this suite. Registering inside the maker covers every call site by
 * construction, including any added later.
 *
 * The prefix carries a per-load token so the arm below can tell THIS run's trees
 * from a concurrent run's - builder seats and shifts run this suite at the same
 * time, and a bare `drape-1420-*` read would go red on somebody else's work.
 */
const TEMP_PREFIX = `drape-1420-${randomUUID().slice(0, 8)}-`;
let treesMade = 0;

function tempTree(): string {
  const tree = fs.mkdtempSync(path.join(os.tmpdir(), TEMP_PREFIX));
  treesMade += 1;
  trees.push(tree);
  return tree;
}

/** This run's surviving trees, read off the DISK rather than off `trees`. */
function survivingTrees(): string[] {
  return fs
    .readdirSync(os.tmpdir(), { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith(TEMP_PREFIX))
    .map((e) => e.name)
    .sort();
}

afterEach(() => {
  vi.resetModules();
  while (trees.length > 0) {
    const tree = trees.pop();
    if (tree) fs.rmSync(tree, { recursive: true, force: true });
  }
});

afterAll(() => {
  /* Non-vacuity FIRST. An arm that passes because nothing was ever created
     proves nothing, and that is the shape this suite was already in. */
  expect(treesMade, "this suite must actually have made temp trees").toBeGreaterThan(0);
  /* The claim, read where the leak actually was: the filesystem. No amount of
     bookkeeping in `trees` can rescue this one. */
  expect(
    survivingTrees(),
    `every temp tree this suite made must be gone; ${treesMade} were made`,
  ).toEqual([]);
});

describe("vite.config — source maps exist only to be uploaded", () => {
  it("builds NO source maps and adds no uploader when there is no token", async () => {
    const { config, plugins } = await loadConfig({ token: undefined, sha: "abc1234" });
    expect(config.build?.sourcemap).toBe(false);
    expect(plugins.map((p) => String(p.name)).filter((n) => /sentry/i.test(n))).toEqual([]);
    // the config really loaded, so the assertion above is about presence
    expect(plugins.length).toBeGreaterThan(0);
  });

  it("treats a blank or whitespace token as no token — a Railway variable set to empty is `\"\"`", async () => {
    for (const token of ["", "   "]) {
      const { config, plugins } = await loadConfig({ token, sha: "abc1234" });
      expect(config.build?.sourcemap, `token=${JSON.stringify(token)}`).toBe(false);
      expect(plugins.map((p) => String(p.name)).filter((n) => /sentry/i.test(n))).toEqual([]);
    }
  });

  it("builds HIDDEN source maps and adds the uploader when the token is there", async () => {
    const { config, plugins } = await loadConfig({ token: FAKE_TOKEN, sha: "abc1234" });
    /* "hidden" and not `true`: no `//# sourceMappingURL` comment may point at a
       file that is about to be deleted, and Sentry matches on the debug id. */
    expect(config.build?.sourcemap).toBe("hidden");
    expect(plugins.map((p) => String(p.name)).filter((n) => /sentry/i.test(n)).length).toBeGreaterThan(0);
  });

  it("never lets the token into the bundle — `define` carries the release and nothing else", async () => {
    const { config } = await loadConfig({ token: FAKE_TOKEN, sha: "abc1234" });
    const defined = JSON.stringify(config.define ?? {});
    expect(defined).not.toContain(FAKE_TOKEN);
    expect(defined).not.toContain("sntrys_");
    expect(Object.keys(config.define ?? {})).toEqual(["__DRAPE_RELEASE__"]);
  });

  it("keeps react, tailwind and the release stamp in place either way", async () => {
    const off = (await loadConfig({ token: undefined, sha: "abc1234" })).plugins.map((p) => String(p.name));
    const on = (await loadConfig({ token: FAKE_TOKEN, sha: "abc1234" })).plugins.map((p) => String(p.name));
    for (const required of ["drape-release-stamp", "drape-no-public-source-maps"]) {
      expect(off, "token absent").toContain(required);
      expect(on, "token present").toContain(required);
    }
    expect(off.some((n) => /react/i.test(n))).toBe(true);
    expect(on.some((n) => /react/i.test(n))).toBe(true);
  });
});

describe("vite.config — the upload options handed to the plugin", () => {
  it("names the org and the BROWSER project, from the shared declaration", async () => {
    const { SENTRY_ORG, SENTRY_BROWSER_PROJECT } = await import("../shared/monitoringProjects");
    const options = await loadUploadOptions(path.resolve("/tmp/out"), "abc1234");
    expect(options.org).toBe(SENTRY_ORG);
    expect(options.project).toBe(SENTRY_BROWSER_PROJECT);
    /* The browser bundle's maps belong to the browser project. A suite that
       accepted either would pass on the Node one, where they resolve nothing. */
    expect(options.project).not.toBe("klieg-server");
  });

  it("DERIVES the delete-after glob from the outDir it is given, in posix form", async () => {
    const outDir = path.join(tempTree(), "dist", "public");
    const options = await loadUploadOptions(outDir, "abc1234");
    const globs = options.sourcemaps?.filesToDeleteAfterUpload;
    expect(globs).toEqual([`${outDir.replace(/\\/g, "/")}/**/*.map`]);
    /* `glob` takes posix separators on every platform. A Windows-separator glob
       matches nothing, deletes nothing, and reports success. */
    expect(String(globs)).not.toContain("\\");
  });

  it("carries the release as its NAME when the build knows the sha, and injects nothing", async () => {
    const options = await loadUploadOptions(path.resolve("/tmp/out"), "abc1234");
    expect(options.release?.name).toBe("abc1234");
    /* `__DRAPE_RELEASE__` is the bundle's only release source — see the config. */
    expect(options.release?.inject).toBe(false);
    expect(options.release?.setCommits).toBe(false);
  });

  it("creates NO release when the build does not know the sha, rather than letting one be detected", async () => {
    const options = await loadUploadOptions(path.resolve("/tmp/out"), "");
    /* Absent, never present-and-undefined: the plugin's `??` chain would fall
       through to git detection and invent a name the events do not carry. */
    expect("name" in (options.release ?? {})).toBe(false);
    expect(options.release?.create).toBe(false);
    expect(options.release?.finalize).toBe(false);
  });

  it("does not report the build to Sentry's own account", async () => {
    const options = await loadUploadOptions(path.resolve("/tmp/out"), "abc1234");
    expect(options.telemetry).toBe(false);
  });
});

describe("mapFilesUnder — the reader behind the refusal", () => {
  it("finds maps at any depth, ignores everything else, and sorts", async () => {
    const { mapFilesUnder } = await import("../vite.config");
    const root = tempTree();
    fs.mkdirSync(path.join(root, "assets", "nested"), { recursive: true });
    fs.writeFileSync(path.join(root, "index.html"), "<html></html>");
    fs.writeFileSync(path.join(root, "assets", "z-app.js"), "//");
    fs.writeFileSync(path.join(root, "assets", "z-app.js.map"), "{}");
    fs.writeFileSync(path.join(root, "assets", "nested", "a-chunk.js.map"), "{}");
    fs.writeFileSync(path.join(root, "assets", "notamap.mapper"), "");
    expect(mapFilesUnder(root)).toEqual(["assets/nested/a-chunk.js.map", "assets/z-app.js.map"]);
  });

  it("answers [] for a directory that does not exist rather than throwing", async () => {
    const { mapFilesUnder } = await import("../vite.config");
    expect(mapFilesUnder(path.join(tempTree(), "never-built"))).toEqual([]);
  });

  it("answers [] for a clean output tree — the positive control for the arm below", async () => {
    const { mapFilesUnder } = await import("../vite.config");
    const root = tempTree();
    fs.mkdirSync(path.join(root, "assets"), { recursive: true });
    fs.writeFileSync(path.join(root, "assets", "z-app.js"), "//");
    expect(mapFilesUnder(root)).toEqual([]);
  });
});

describe("the refusal — a surviving .map fails the build", () => {
  /** The guard plugin, found on the real config by name. */
  async function guardPlugin(): Promise<{ closeBundle: () => void }> {
    const { plugins } = await loadConfig({ token: FAKE_TOKEN, sha: "abc1234" });
    const found = plugins.find((p) => p.name === "drape-no-public-source-maps");
    expect(found, "the guard must be on the real config").toBeDefined();
    return found as unknown as { closeBundle: () => void };
  }

  it("THROWS, naming the file, when a map is still in the published output", async () => {
    const root = tempTree();
    /* The guard reads the config's own outDir, so the arm has to put the file
       there. Anything else would pass by measuring the wrong tree. */
    const { config } = await loadConfig({ token: FAKE_TOKEN, sha: "abc1234" });
    const outDir = String(config.build?.outDir);
    const leaked = path.join(outDir, "assets", "drape-1420-leak-probe.js.map");
    fs.mkdirSync(path.dirname(leaked), { recursive: true });
    fs.writeFileSync(leaked, "{}");
    try {
      const plugin = await guardPlugin();
      expect(() => plugin.closeBundle()).toThrow(/drape-1420-leak-probe\.js\.map/);
      expect(() => plugin.closeBundle()).toThrow(/REFUSED/);
    } finally {
      fs.rmSync(leaked, { force: true });
    }
  });

  it("passes when the published output holds no map", async () => {
    const plugin = await guardPlugin();
    const { config } = await loadConfig({ token: FAKE_TOKEN, sha: "abc1234" });
    const outDir = String(config.build?.outDir);
    /* Guarded rather than assumed: a stale `dist/public` with a map in it from
       somebody's local experiment would make this arm red for the right reason,
       and reading it out loud is cheaper than a confusing failure. */
    const { mapFilesUnder } = await import("../vite.config");
    expect(mapFilesUnder(outDir), `${outDir} holds a .map — the build would refuse`).toEqual([]);
    expect(() => plugin.closeBundle()).not.toThrow();
  });
});
