/**
 * THE SOURCE-TREE WALK, PROMOTED — one walk, one path derivation, one race
 * tolerance (#2289, the remainder of #2286).
 *
 * # What was here before, measured rather than remembered
 *
 * #2289's body said the client-source walk was written privately FIVE times.
 * Read at the AST — resolving each listing call's root through local bindings
 * and, where the root arrives as a function PARAMETER, back to the call sites
 * of the function that declares it — it is **TWENTY** tracked test files, and
 * the body's five were a floor rather than a count. Three text readers were
 * tried first and each broke a different control (7 found, missing two of the
 * card's own names; 19, binding identifiers that are no directories; 14,
 * breaking a fifth path derivation no spelling list had). The single cause of
 * every miss is the parameter: in
 *
 *     const CLIENT_SRC = join(__dirname, "..", "client", "src");
 *     function clientSources(dir: string) { … readdirSync(dir) … }
 *
 * the listing call's own argument is `dir` and says nothing about which tree is
 * walked. That is #589's delegated-walk door with a shorter hop.
 *
 * # ⚠ THE HALF THAT MATTERS IS NOT THE DUPLICATION
 *
 * Of those twenty, **TEN read each listed file with a bare `readFileSync`** —
 * the exact #223 race `listedSource.ts` exists to end, in a working tree shared
 * by several sessions and carrying hundreds of untracked disposables — and
 * because `sourceSweepSuites` derives its population from a suite's own call of
 * `readListedSource`, **all ten are invisible to it and not one of them
 * declares the 30 s contended clock.** The two halves line up exactly: reading
 * through the sanctioned reader is what makes a sweeper visible. That is not a
 * coincidence this module exploits — it is `sourceSweepSuites`'s own stated
 * limit, in its own words: *"a walk that lists and reads without the sanctioned
 * reader is #223's defect … and the answer to it is to move those walks onto
 * `readListedSource` — at which point they arrive in this population for
 * free."*
 *
 * So a suite converted to this module gets both repairs in one act, and the
 * population deriver was widened by ONE HOP in the same commit so that a
 * converted suite stays visible rather than leaving the population silently —
 * which would be `directory-population-loses-promoted-subject` arriving by the
 * front door.
 *
 * # The race, and what this module does and does not change about it
 *
 * Two steps touch a listed path and both could throw. The LIST-then-STAT race
 * is dissolved rather than tolerated: `readdirSync(dir, { withFileTypes: true })`
 * answers "file or directory" in the same syscall that names the entry, so
 * there is no second look to lose. The READ goes through `readListedSource`,
 * whose ENOENT-only bound and the reasoning for it are declared at its own
 * header and are NOT restated or widened here.
 *
 * ⚠ **ONE STATED LIMIT IS INHERITED UNCHANGED, DELIBERATELY: a DIRECTORY that
 * vanishes between its parent's listing and its own `readdirSync` still
 * throws.** `listedSource.ts` records that it has not been observed and that
 * inventing a guard for an unmeasured population is the thing this repository
 * does not do; widening the bound here would also owe the same change to
 * `scripts/lib/listedEntry.mts`, the scripts-side twin. The limit is named so
 * that the next person meets it as a decision rather than as a surprise.
 *
 * # ⚠ `tests` IS REQUIRED, AND THAT IS THE WHOLE OF THE CONVERSION DISCIPLINE
 *
 * The twenty walks disagreed about whether `*.test.ts` files are in the
 * population, and they disagreed for good reasons: a guard asking *"does any
 * client file still read this?"* must exclude tests, because a suite that
 * MENTIONS a dead field makes it read as alive (`castingConfigReaders`'s own
 * docblock, written after that happened); a guard asking *"does any file under
 * `client/src` use this pattern?"* must include them. A default would make
 * every conversion a silent behaviour change in one direction or the other, so
 * there is no default: each caller states what its population was.
 */
import { readdirSync } from "node:fs";
import path from "node:path";

import { readListedSource } from "./listedSource";

/** The repository root, derived once. */
export const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

/** A path inside the repository, from the one derivation above. */
export function repoPath(...segments: string[]): string {
  return path.join(REPO_ROOT, ...segments);
}

/** The client's source root — the walk root nineteen of the twenty wanted. */
export const CLIENT_SRC = repoPath("client", "src");

/** The server's source root, for the handful that sweep both. */
export const SERVER_SRC = repoPath("server");

export type TreeOptions = {
  /**
   * Whether `*.test.ts(x)` files are in the population. REQUIRED — see the
   * header: the twenty walks disagreed about this on purpose.
   */
  tests: "include" | "exclude";
  /** Default `[".ts", ".tsx"]`. Matched on the file name's end. */
  extensions?: readonly string[];
  /** Directory names skipped wherever they appear. Default `["node_modules"]`. */
  skipDirectories?: readonly string[];
};

export type TreeSource = {
  /** The absolute path, as the platform spells it. */
  absolute: string;
  /** Relative to the walk root, forward-slashed. */
  relative: string;
  /** The file's text. A file that vanished between the listing and the read is not here. */
  source: string;
};

const DEFAULT_EXTENSIONS = [".ts", ".tsx"] as const;
const DEFAULT_SKIP = ["node_modules"] as const;

const isTest = (name: string) => /\.(test|spec)\.tsx?$/.test(name);

/**
 * Every source file under `root`, deepest-last and in name order.
 *
 * ⚠ **THE ORDER IS DETERMINISTIC, WHICH `readdirSync` ALONE IS NOT.** Several
 * of the converted suites assert on a caller list; sorting here means the
 * answer does not depend on the file system's enumeration, and a caller that
 * already sorted is unaffected.
 */
export function sourcePathsUnder(root: string, options: TreeOptions): string[] {
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;
  const skip = options.skipDirectories ?? DEFAULT_SKIP;
  const found: string[] = [];

  const walk = (directory: string): void => {
    const entries = readdirSync(directory, { withFileTypes: true })
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (skip.includes(entry.name)) continue;
        walk(full);
        continue;
      }
      if (!extensions.some((extension) => entry.name.endsWith(extension))) continue;
      if (options.tests === "exclude" && isTest(entry.name)) continue;
      found.push(full);
    }
  };

  walk(root);
  return found;
}

/**
 * Every source file under `root`, with its text, read through the sanctioned
 * reader. A file listed and then gone is SKIPPED — never returned as empty
 * content, which would read as a file holding nothing rather than one that is
 * not there.
 */
export function sourcesUnder(root: string, options: TreeOptions): TreeSource[] {
  const out: TreeSource[] = [];
  for (const absolute of sourcePathsUnder(root, options)) {
    const source = readListedSource(absolute);
    if (source === null) continue;
    out.push({
      absolute,
      relative: path.relative(root, absolute).split(path.sep).join("/"),
      source,
    });
  }
  return out;
}

/** The client tree, with its text — the call nineteen of the twenty were making. */
export function clientSources(options: TreeOptions): TreeSource[] {
  return sourcesUnder(CLIENT_SRC, options);
}
