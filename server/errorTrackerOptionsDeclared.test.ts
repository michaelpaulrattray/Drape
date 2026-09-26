/**
 * ⚠ THE GUARD THAT WOULD HAVE CAUGHT `sendDefaultPii` (#509 part 1b).
 *
 * Part 1 handed the SDK `sendDefaultPii: false` with a comment describing it as
 * "the SDK's own switch for attach the request's IP, cookies, headers and the
 * user's email", and `server/errorTracker.test.ts` asserted its value. All of it
 * was green and none of it did anything: **that option was removed in Sentry v11**
 * — it was replaced by `dataCollection`, whose defaults are all permissive
 * (`userInfo: true`, `cookies: true`, `httpHeaders: { request: true, response: true }`,
 * `urlQueryParams: true`, `stackFrameVariables: true`).
 *
 * The reason it survived is worth more than the fix. `buildTrackerOptions()`
 * declares its OWN return type and the result is SPREAD into `init`, and
 * TypeScript does not excess-property-check a spread — so an option from an
 * older major version typechecks, reads well, is asserted by a suite, and is
 * read by nobody. Invariant 7 exactly: *a control that is not invoked does not
 * exist.* Working law 2 beside it: the arm agreed with a constant in the module
 * rather than with the SDK.
 *
 * # WHAT THIS ASKS, AND WHY IT ASKS IT OF THE BUILT JAVASCRIPT
 *
 * **Does the name we send appear anywhere in the SDK's own shipped code?** If it
 * does not, then nothing can read it, and the option is decoration — which is
 * the entire defect, stated as a question a machine can answer. The `.d.ts`
 * graph would be the tidier-looking source and it is the wrong one: the option
 * type is spread across three packages (`ClientOptions` and `CoreOptions` in
 * `@sentry/core`, `BrowserSpecificOptions` in `@sentry/browser`, `BaseNodeOptions`
 * in `@sentry/node`), so a reader of it is a small type resolver that can be
 * wrong in the silent direction. **The implementation is the artifact; the
 * declarations are a report about it** (working law 1, pointed at a dependency).
 *
 * ⚠ **SOURCE MAPS ARE EXCLUDED AND THAT IS LOAD-BEARING, NOT HOUSEKEEPING.**
 * `sendDefaultPii` DOES still appear in this tree — in `@sentry/replay`'s
 * `.js.map` and in `@sentry/conventions`' unrelated attribute list. A reader that
 * globbed everything would find the specimen and pass. Measured before this
 * suite was written; it is why the negative control below names the real option
 * rather than only a fabricated one.
 *
 * # THE POPULATION IS DERIVED, IN BOTH DIRECTIONS
 *
 * Not a list of option names kept in step with the code — that is the mirror
 * working law 4 forbids. One side is `Object.keys()` of the real options object
 * each half hands `init`; the other is the installed package's own bytes. Adding
 * an option to either half enrols it here with no edit anywhere.
 */
import { createRequire } from "node:module";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildTrackerOptions } from "./monitoring/errorTracker";
import { buildClientTrackerOptions } from "../client/src/monitoring/errorTracker";

type SdkPackage = "@sentry/node" | "@sentry/browser";

/**
 * The root of an installed package, resolved THROUGH the package rather than by
 * walking `node_modules` — pnpm's layout is a content-addressed store and its
 * directory names carry version and peer hashes.
 */
function packageRoot(pkg: string, from = import.meta.url): string {
  const resolver = typeof from === "string" && from.startsWith("file:") ? createRequire(from) : createRequire(from);
  return path.dirname(resolver.resolve(`${pkg}/package.json`));
}

/** The nested `@sentry/core` a given SDK package actually resolves to. */
function coreRootFor(pkg: SdkPackage): string {
  const entry = createRequire(import.meta.url).resolve(pkg);
  return path.dirname(createRequire(entry).resolve("@sentry/core/package.json"));
}

/**
 * Every JavaScript file the package ships, source maps EXCLUDED — see the
 * header's warning, which is the difference between this guard working and
 * passing its own specimen.
 */
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
      let stats;
      try {
        stats = statSync(full, { throwIfNoEntry: false });
      } catch {
        continue;
      }
      if (!stats) continue;
      if (stats.isDirectory()) {
        walk(full);
      } else if (/\.(js|mjs|cjs)$/.test(entry)) {
        out.push(full);
      }
    }
  };
  walk(path.join(root, "build"));
  return out;
}

const sdkTextCache = new Map<SdkPackage, string>();

/**
 * Everything the installed SDK ships as code, for one half.
 *
 * REFUSES rather than returning a short read. A suite that passes because it
 * found no files is the same defect it exists to catch (working law 2), and an
 * empty string would report every option as unread — which fails loudly, so the
 * throw is belt and braces rather than the only protection.
 */
function sdkCode(pkg: SdkPackage): string {
  const cached = sdkTextCache.get(pkg);
  if (cached !== undefined) return cached;

  const files = [...shippedJsFiles(packageRoot(pkg)), ...shippedJsFiles(coreRootFor(pkg))];
  if (files.length < 20) {
    throw new Error(`only ${files.length} shipped JS file(s) found for ${pkg} — the reader is broken, not the SDK`);
  }
  const text = files.map((file) => readFileSync(file, "utf8")).join("\n");
  if (text.length < 100_000) {
    throw new Error(`${pkg} read as only ${text.length} bytes of code — refusing to judge anything on that`);
  }
  sdkTextCache.set(pkg, text);
  return text;
}

/** Does the SDK's own code mention this option name at all? */
function sdkReads(pkg: SdkPackage, option: string): boolean {
  return new RegExp(`\\b${option}\\b`).test(sdkCode(pkg));
}

describe("the reader's own controls, before it judges either half (working law 2)", () => {
  it("finds a real body of code for both halves", () => {
    expect(sdkCode("@sentry/node").length).toBeGreaterThan(100_000);
    expect(sdkCode("@sentry/browser").length).toBeGreaterThan(100_000);
  });

  it("⚠ REFUSES a root that ships nothing, rather than reporting every option unread", () => {
    expect(shippedJsFiles(path.join(packageRoot("@sentry/node"), "no-such-dir"))).toEqual([]);
    expect(() => sdkCode("@sentry/not-a-package" as SdkPackage)).toThrow();
  });

  it("POSITIVE: names the SDK certainly reads are found", () => {
    for (const option of ["dsn", "beforeSend", "beforeBreadcrumb", "dataCollection", "tracesSampleRate"]) {
      expect(sdkReads("@sentry/node", option), `node should read ${option}`).toBe(true);
      expect(sdkReads("@sentry/browser", option), `browser should read ${option}`).toBe(true);
    }
  });

  it("⚠ NEGATIVE: a fabricated name is NOT found, and neither is the real specimen", () => {
    expect(sdkReads("@sentry/node", "sendDefaultPiiXYZ")).toBe(false);
    expect(sdkReads("@sentry/browser", "sendDefaultPiiXYZ")).toBe(false);
    /* The option part 1 sent and part 1b removed. If this ever goes true, the
       SDK brought it back and this suite's own history is the thing to re-read. */
    expect(sdkReads("@sentry/node", "sendDefaultPii")).toBe(false);
    expect(sdkReads("@sentry/browser", "sendDefaultPii")).toBe(false);
  });
});

describe("every option the SERVER half sends is one @sentry/node reads", () => {
  it("sends nothing the SDK cannot read", () => {
    process.env.SENTRY_DSN = "https://key@o1.ingest.de.sentry.io/2";
    const unread = Object.keys(buildTrackerOptions()).filter((key) => !sdkReads("@sentry/node", key));
    expect(unread).toEqual([]);
  });

  it("sends no unread `dataCollection` key either", () => {
    process.env.SENTRY_DSN = "https://key@o1.ingest.de.sentry.io/2";
    const sent = Object.keys(buildTrackerOptions().dataCollection);
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.filter((key) => !sdkReads("@sentry/node", key))).toEqual([]);
  });
});

describe("every option the BROWSER half sends is one @sentry/browser reads", () => {
  it("sends nothing the SDK cannot read", () => {
    const unread = Object.keys(buildClientTrackerOptions()).filter(
      (key) => !sdkReads("@sentry/browser", key),
    );
    expect(unread).toEqual([]);
  });

  it("sends no unread `dataCollection` key either", () => {
    const sent = Object.keys(buildClientTrackerOptions().dataCollection);
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.filter((key) => !sdkReads("@sentry/browser", key))).toEqual([]);
  });

  it("⚠ names the two default integrations this product refuses, and the SDK still has both", () => {
    /* A dropped integration is dropped BY NAME, so a rename in the SDK would
       silently un-drop it — the session envelope would come back and bypass the
       scrub with nobody noticing. This is the arm that would see that. */
    for (const name of ["BrowserSession", "Console"]) {
      expect(sdkReads("@sentry/browser", name), `the SDK should still declare ${name}`).toBe(true);
    }
  });
});
