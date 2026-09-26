/**
 * ⚠ THE `sendDefaultPii` GUARD, ONE VENDOR OVER (#509 part 2).
 *
 * The night before this landed, part 1b found that `sendDefaultPii: false` had
 * been sitting in the Sentry options with a confident comment and a GREEN test
 * arm asserting its value — and that the option does not exist in that SDK's
 * installed major version at all. The reason it survived is the transferable
 * part and it applies to every SDK this product will ever hand an options
 * object to: **a builder function declares its own return type and the result is
 * spread into the constructor, and TypeScript does not excess-property-check a
 * spread.** So an option from a dead version typechecks, reads well, is asserted
 * by a suite, and is read by nobody. Invariant 7, with working law 2 beside it.
 *
 * `server/errorTrackerOptionsDeclared.test.ts` asks that question of Sentry.
 * This asks it of PostHog, and the question is the same one:
 *
 * **Does the name we send appear anywhere in the SDK's own shipped code?**
 *
 * ⚠ **IT READS THE BUILT JAVASCRIPT, NOT THE `.d.ts` GRAPH — and here the
 * declarations would actively mislead.** `posthog-node`'s own option type is
 * `Omit<PostHogCoreOptions, 'before_send' | 'flushInterval' | 'maxQueueSize'>`
 * intersected with its own additions, so a naive type reader would have to
 * follow an `Omit` across two packages to answer correctly. The implementation
 * is the artifact; the declarations are a report about it (working law 1,
 * pointed at a dependency).
 *
 * ⚠ **IT IS A SECOND READER, NOT A COPY OF THE FIRST.** It walks `dist/` where
 * the Sentry guard walks `build/`, and it resolves `@posthog/core` through the
 * node client rather than through the repository root. Neither inherits the
 * other's blind spot, which is this repository's stated preference wherever one
 * reader's verdict is load-bearing.
 *
 * # THE POPULATION IS DERIVED, IN BOTH DIRECTIONS
 *
 * One side is `Object.keys()` of the real options object handed to the
 * constructor; the other is the installed packages' own bytes. Adding an option
 * to `buildProductEventOptions` enrols it here with no edit anywhere, and
 * removing one un-enrols it.
 */
import { createRequire } from "node:module";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildProductEventOptions } from "./monitoring/productEvents";

/**
 * The root of an installed package, resolved THROUGH the package rather than by
 * walking `node_modules` — pnpm's layout is a content-addressed store and its
 * directory names carry version and peer hashes.
 *
 * ⚠ It resolves the ENTRY POINT and climbs to the manifest, rather than asking
 * for `<pkg>/package.json` directly the way the Sentry guard does. Both PostHog
 * packages declare an `exports` map with no `./package.json` subpath, so the
 * direct ask throws `ERR_PACKAGE_PATH_NOT_EXPORTED` — measured, and the first
 * shape of this reader died on it. The climb stops at the manifest whose `name`
 * matches, so a nested dependency's manifest can never stand in for the one
 * asked for.
 */
function packageRoot(pkg: string, from: string = import.meta.url): string {
  let dir = path.dirname(createRequire(from).resolve(pkg));
  for (let up = 0; up < 12; up += 1) {
    const manifest = path.join(dir, "package.json");
    if (statSync(manifest, { throwIfNoEntry: false })?.isFile()) {
      const name: unknown = JSON.parse(readFileSync(manifest, "utf8")).name;
      if (name === pkg) return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`could not find the installed root of ${pkg}`);
}

/**
 * The `@posthog/core` that `posthog-node` itself resolves to — not whatever a
 * root-level resolution would find. The options this product sends are core
 * options that the node client re-exports, so reading the wrong copy would be
 * reading a different version's answer.
 */
function coreRoot(): string {
  return packageRoot("@posthog/core", createRequire(import.meta.url).resolve("posthog-node"));
}

/** Every JavaScript file a package ships, source maps EXCLUDED. */
function shippedJsFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      const stats = statSync(full, { throwIfNoEntry: false });
      if (!stats) continue;
      if (stats.isDirectory()) walk(full);
      else if (/\.(js|mjs|cjs)$/.test(entry)) out.push(full);
    }
  };
  walk(path.join(root, "dist"));
  return out;
}

let cached: string | null = null;

/**
 * Everything the installed SDK ships as code, both packages.
 *
 * REFUSES rather than returning a short read. A suite that passes because it
 * found no files is the same defect it exists to catch (working law 2); an empty
 * string would report every option as unread, which fails loudly, so the throw
 * is belt and braces rather than the only protection.
 */
function sdkCode(): string {
  if (cached !== null) return cached;
  const files = [...shippedJsFiles(packageRoot("posthog-node")), ...shippedJsFiles(coreRoot())];
  if (files.length < 5) {
    throw new Error(`only ${files.length} shipped JS file(s) found — the reader is broken, not the SDK`);
  }
  const text = files.map((file) => readFileSync(file, "utf8")).join("\n");
  if (text.length < 100_000) {
    throw new Error(`the SDK read as only ${text.length} bytes of code — refusing to judge anything on that`);
  }
  cached = text;
  return text;
}

/** Does the SDK's own code mention this option name at all? */
function sdkReads(option: string): boolean {
  return new RegExp(`\\b${option}\\b`).test(sdkCode());
}

describe("the reader's own controls, before it judges anything (working law 2)", () => {
  it("finds a real body of code", () => {
    expect(sdkCode().length).toBeGreaterThan(100_000);
  });

  it("⚠ REFUSES a root that ships nothing, rather than reporting every option unread", () => {
    expect(shippedJsFiles(path.join(packageRoot("posthog-node"), "no-such-dir"))).toEqual([]);
    expect(() => packageRoot("posthog-not-a-package")).toThrow();
  });

  it("POSITIVE: names the SDK certainly reads are found", () => {
    for (const option of ["distinctId", "capture", "flushAt", "disableGeoip", "personProfiles"]) {
      expect(sdkReads(option), `the SDK should read ${option}`).toBe(true);
    }
  });

  it("⚠ NEGATIVE: a fabricated name is not found", () => {
    expect(sdkReads("disableGeoipXYZ")).toBe(false);
    expect(sdkReads("sendDefaultPii")).toBe(false);
  });

  it("⚠ NEGATIVE: `before_send` is NOT an option this SDK accepts, which is why the gate is ours", () => {
    /*
      The catalogue's header rests on this fact and it is worth an arm rather
      than a sentence: `posthog-node` removes `before_send` from the core options
      it accepts, so there is no SDK-side last gate under `projectProductEvent`.
      The name still appears in the CORE package's own code — it is a real core
      option — so the claim proven here is the narrower and correct one: the node
      client's own types omit it, read at the declaration that does the omitting.
    */
    const types = readFileSync(path.join(packageRoot("posthog-node"), "dist/types.d.ts"), "utf8");
    expect(types).toMatch(/Omit<PostHogCoreOptions,[^>]*'before_send'/);
  });
});

describe("every option the product event stream sends is one the SDK reads", () => {
  it("sends nothing the SDK cannot read", () => {
    const unread = Object.keys(buildProductEventOptions()).filter((key) => !sdkReads(key));
    expect(unread).toEqual([]);
  });

  it("⚠ sends every option it believes it sends — the object is not empty", () => {
    /* Without this, a `buildProductEventOptions` that returned `{}` would pass
       the arm above by having nothing to check. The count is a floor, not a
       transcription: it moves only when options are deliberately removed. */
    expect(Object.keys(buildProductEventOptions()).length).toBeGreaterThanOrEqual(8);
  });
});
