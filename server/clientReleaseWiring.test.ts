/**
 * THE BROWSER BUNDLE'S RELEASE TAG, ASSERTED AT THE WIRE (#1420).
 *
 * Invariant 5 — *"Assert at the wire. Contracts about what gets sent are proven
 * on the outgoing request, not on a constant near it."* The claim here is about
 * the `define` map vite is HANDED, so these arms import `vite.config.ts` itself
 * with `RAILWAY_GIT_COMMIT_SHA` set and unset and read that map. A test of a
 * helper would keep passing after somebody stopped wiring it into the config,
 * which is the whole failure worth catching — and it is the failure this
 * repository has paid for before, most recently as `sendDefaultPii`: an option
 * that typechecked, read well, was asserted by a suite, and was read by nobody.
 *
 * ⚠ **AND THE SIDE THIS CANNOT REACH IS NAMED RATHER THAN IMPLIED.** Whether
 * Railway's BUILD step actually provides `RAILWAY_GIT_COMMIT_SHA` is not
 * decidable from here and was not decidable at the build log either — read at
 * the real production build log for the 2026-09-29 deploy, which prints vite's
 * asset list and railpack's copy steps and no environment at all. Railway's own
 * reference says the Git variables go *"to all builds and deployments"*
 * (docs.railway.com/variables/reference), and that is the vendor's claim, not
 * this repository's evidence (law 7b). So the config carries a plugin that
 * PRINTS which of the two happened, and the arm below holds that plugin in
 * place: the next production build's log is where the fact is finally read, and
 * a config that stopped saying would take the reading away with it.
 *
 * The client-side half — that the reader survives the define never having run,
 * and that an unknown release omits the KEY rather than sending an empty one —
 * is `client/src/monitoring/errorTracker.test.ts`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const SHA = "d0beb8f5c55b36df7d674d55965a23b8d54ad69b";

interface LoadedConfig {
  define?: Record<string, unknown>;
  plugins?: unknown;
}

/** vite's plugin option nests — `react()` alone returns an array of plugins. */
function pluginNames(plugins: unknown): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (node && typeof node === "object" && "name" in node) {
      out.push(String((node as { name: unknown }).name));
    }
  };
  walk(plugins);
  return out;
}

async function loadConfig(sha: string | undefined): Promise<LoadedConfig> {
  vi.resetModules();
  const previous = process.env.RAILWAY_GIT_COMMIT_SHA;
  if (sha === undefined) delete process.env.RAILWAY_GIT_COMMIT_SHA;
  else process.env.RAILWAY_GIT_COMMIT_SHA = sha;
  try {
    const mod = (await import("../vite.config")) as { default: LoadedConfig };
    return mod.default;
  } finally {
    if (previous === undefined) delete process.env.RAILWAY_GIT_COMMIT_SHA;
    else process.env.RAILWAY_GIT_COMMIT_SHA = previous;
  }
}

afterEach(() => {
  vi.resetModules();
});

describe("vite.config — the browser bundle learns which build it is", () => {
  it("bakes the commit in, as a JSON string literal the bundler can substitute", async () => {
    const config = await loadConfig(SHA);
    expect(config.define?.__DRAPE_RELEASE__).toBe(JSON.stringify(SHA));
  });

  it("⚠ defines it as an EMPTY string when the build does not know — never undefined", async () => {
    /* `define` with `undefined` substitutes the literal text `undefined`, which
       the reader's `typeof` guard would then see as `"undefined"` — a release
       named after a mistake. An empty string is what `clientRelease()` is
       written to mean "no release" by, and the option is omitted from there. */
    const config = await loadConfig(undefined);
    expect(config.define?.__DRAPE_RELEASE__).toBe('""');
  });

  it("trims a value with stray whitespace rather than baking one in", async () => {
    const config = await loadConfig(`  ${SHA}\n`);
    expect(config.define?.__DRAPE_RELEASE__).toBe(JSON.stringify(SHA));
  });

  it("treats a whitespace-only value as no release at all", async () => {
    const config = await loadConfig("   ");
    expect(config.define?.__DRAPE_RELEASE__).toBe('""');
  });

  it("⚠ keeps the stamp plugin, which is the ONLY place the unread fact gets read", async () => {
    for (const sha of [SHA, undefined]) {
      const names = pluginNames((await loadConfig(sha)).plugins);
      expect(names.length, "the config really loaded").toBeGreaterThan(0);
      expect(names, `RAILWAY_GIT_COMMIT_SHA ${sha ?? "unset"}`).toContain("drape-release-stamp");
    }
  });

  it("does not define anything else — one name, from one line", async () => {
    const config = await loadConfig(SHA);
    expect(Object.keys(config.define ?? {})).toEqual(["__DRAPE_RELEASE__"]);
  });
});
