import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A SCRIPT ENDS BY ENDING THE PROCESS.
 *
 * `getDb()` hands out a module-level mysql pool with no exported shutdown, and
 * `storagePut` builds an S3 client with keep-alive sockets. Both keep the event
 * loop alive after a script's work is finished, so the process sits there with
 * everything done and nothing left to do. On 2026-08-10 eighteen such processes
 * from four scripts were found alive from the previous day; on 2026-08-11 a
 * SPEND script (`buy-hoop-specimens-disposable.mts`) was found resident for
 * three hours and twenty minutes — and the shift that left it had reported "no
 * background jobs of mine running" in good faith, because nothing showed them.
 *
 * The rule (fable-127, burn-down ordered in fable-246): the happy path exits,
 * the failure path exits nonzero.
 *
 * # Why the scope is EVERY entrypoint, and not "every script that imports an
 * # app service"
 *
 * That narrower rule was written first, and it excluded its own origin case.
 * `buy-hoop-specimens-disposable.mts` reaches the app through
 * `await import("../server/castingV2/refineService")` — a DYNAMIC import, on
 * line 61, because it has to load `dotenv/config` first — and it opens its own
 * `mysql2` connection besides. A scope derived from `from "…"` lines does not
 * see either. Widening it meant naming the packages that hold a handle, and
 * that list is a mirror: it drifts the day someone reaches for a client nobody
 * enumerated (working law 4).
 *
 * So the split that IS derived is used instead: a file under `scripts/` that
 * nothing imports is an entrypoint, and an entrypoint ends by exiting. A file
 * that something imports is a module, and a module must NEVER exit — the whole
 * import graph of the repository decides which is which, so a script written
 * tomorrow is in scope the moment it exists, whatever it happens to open. The
 * cost is a redundant `process.exit(0)` on the thirty-odd scripts that only
 * ever touch `sharp` and the filesystem, which is a cheap thing to be wrong
 * about in this direction.
 *
 * # Why the check is on the LAST STATEMENT and not on the presence of a string
 *
 * `buy-hoop-specimens-disposable.mts` — the script actually found resident —
 * contained `process.exit(0)` all along, in an early-return branch forty lines
 * from the end. A `contains("process.exit(0)")` check passes it. What matters
 * is that the path which reaches the end of the work terminates the process.
 */

const ROOT = path.resolve(__dirname, "..");

/** Source with comments removed, blank lines dropped, trailing space trimmed. */
const codeLines = (raw: string): string[] => raw
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .map((line) => line.replace(/(^|\s)\/\/.*$/, "").trimEnd())
  .filter((line) => line.trim().length > 0);

/**
 * The last TOP-LEVEL statement, whole — not the last line. A promise chain
 * spans lines and its final line is `});`, which says nothing on its own; the
 * statement it closes says everything.
 */
export const terminalStatement = (raw: string): string => {
  const lines = codeLines(raw);
  if (lines.length === 0) return "";
  let start = lines.length - 1;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (/^[A-Za-z_$]/.test(lines[i]!)) { start = i; break; }
  }
  return lines.slice(start).join("\n").trim();
};

/**
 * Does the script end by terminating the process?
 *
 * Three accepted shapes, all of them already in the tree:
 *   1. `process.exit(0);` (or `process.exit(failures === 0 ? 0 : 1);`) as the
 *      final statement of a top-level-await script;
 *   2. `main().then(() => process.exit(0)).catch(… process.exit(1) …)`;
 *   3. `main().then((code) => process.exit(code), (err) => { … process.exit(1) })`.
 *
 * A terminal chain that only sets `process.exitCode` is NOT accepted: the code
 * is recorded and the process then waits forever on the pool it opened, which
 * is the same defect moved to the failure path.
 */
export const exitContract = (raw: string): { ok: boolean; reason: string } => {
  const statement = terminalStatement(raw);
  if (statement === "") return { ok: false, reason: "empty file" };
  if (/^process\.exit\(/.test(statement)) return { ok: true, reason: "terminal process.exit" };

  const isChain = /^(await\s+)?[\w$.]+\([^\n]*\)\s*\n?\s*\.(then|catch)\(/.test(statement);
  if (!isChain) {
    return { ok: false, reason: `last statement does not exit: ${statement.split("\n")[0]!.slice(0, 70)}` };
  }
  const exitsHappy = /process\.exit\(\s*(0|[A-Za-z_$][\w$.]*(\s*\?\?\s*\d+)?)\s*\)/.test(statement);
  const exitsFailure = /process\.exit\(\s*[1-9]/.test(statement);
  if (exitsHappy && exitsFailure) return { ok: true, reason: "terminal chain exits on both arms" };
  if (!exitsHappy) return { ok: false, reason: "terminal chain has no exit on the happy arm" };
  return { ok: false, reason: "terminal chain has no nonzero exit on the failure arm" };
};

const walk = (dir: string): string[] => readdirSync(path.join(ROOT, dir), { withFileTypes: true })
  .flatMap((entry) => (entry.isDirectory()
    ? walk(path.posix.join(dir, entry.name))
    : (/\.(m?ts|tsx|m?js)$/.test(entry.name) ? [path.posix.join(dir, entry.name)] : [])));

const scriptFiles = walk("scripts");
const universe = [...scriptFiles, ...walk("server"), ...walk("client/src")];
const sourceOf = new Map(universe.map((rel) => [rel, readFileSync(path.join(ROOT, rel), "utf8")]));

/**
 * Every specifier the file imports — static, dynamic and `require`. The dynamic
 * form is not an exotic case here: it is how a script loads `dotenv/config`
 * before the server module that reads the environment at import time, and
 * missing it is what made the first version of this guard blind.
 */
export const importSpecifiers = (raw: string): string[] => [
  ...raw.matchAll(/from\s+["']([^"']+)["']/g),
  ...raw.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g),
  ...raw.matchAll(/\brequire\s*\(\s*["']([^"']+)["']/g),
].map((match) => match[1]!);

/** Resolve a relative specifier to a file under `scripts/`, if it is one. */
const resolveScript = (from: string, spec: string): string | null => {
  if (!spec.startsWith(".")) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  const candidates = [base, base.replace(/\.m?js$/, ".mts"), base.replace(/\.m?js$/, ".ts"),
    `${base}.mts`, `${base}.ts`];
  return candidates.find((candidate) => scriptFiles.includes(candidate)) ?? null;
};

/**
 * A script imported ANYWHERE in the repository is a module, not an entrypoint —
 * and a module must never exit. `scripts/check-architecture.mts` is imported by
 * `architectureAtlas.test.ts`; a `process.exit(0)` at its top level would kill
 * the vitest worker mid-suite. So the exclusion is derived from the whole tree,
 * not from a `lib/` path convention.
 */
const importedSomewhere = new Set<string>();
for (const rel of universe) {
  for (const spec of importSpecifiers(sourceOf.get(rel) ?? "")) {
    const target = resolveScript(rel, spec);
    if (target) importedSomewhere.add(target);
  }
}

const entrypoints = scriptFiles
  .filter((rel) => /\.m?ts$/.test(rel))
  .filter((rel) => !importedSomewhere.has(rel));

describe("a script ends by ending the process", () => {
  it("finds the scripts at all — a guard over an empty list is not a guard", () => {
    /* Invariant 7 in miniature, and the vacuous-zero lesson of shift 34: a
       rename or a moved directory would empty this scan and every assertion
       below would pass over nothing. So the scan is asserted first, by count
       and by name, including one script of each shape it must classify. */
    expect(entrypoints.length).toBeGreaterThan(250);
    const names = entrypoints.map((rel) => rel.replace(/\\/g, "/"));
    expect(names).toContain("scripts/buy-hoop-specimens-disposable.mts"); // the one found resident
    expect(names).toContain("scripts/apply-ink-add-migration.mts");       // main().catch shape
    expect(names).toContain("scripts/calibration/gauntlet.mts");          // top-level-await shape
    expect(names).toContain("scripts/verify-bucket-cors.mts");            // browser + two servers
  });

  it("excludes the modules — a script imported elsewhere must NOT exit", () => {
    const names = entrypoints.map((rel) => rel.replace(/\\/g, "/"));
    /* Imported by architectureAtlas.test.ts: exiting here kills the suite. */
    expect(names).not.toContain("scripts/check-architecture.mts");
    expect(names).not.toContain("scripts/generate-architecture.mts");
    expect(names).not.toContain("scripts/lib/termsPalette.mts");
    expect(names).not.toContain("scripts/lib/dbConnection.mts");
    /* And the exclusion is not vacuous either — it excludes a real set. */
    const modules = scriptFiles.filter((rel) => /\.m?ts$/.test(rel) && importedSomewhere.has(rel));
    expect(modules.length).toBeGreaterThan(10);
    for (const rel of modules) {
      expect(terminalStatement(sourceOf.get(rel)!), `${rel} is imported by something and must not exit`)
        .not.toMatch(/^process\.exit\(/);
    }
  });

  it("holds for every one of them", () => {
    const breaches = entrypoints
      .map((rel) => ({ rel, verdict: exitContract(sourceOf.get(rel)!) }))
      .filter(({ verdict }) => !verdict.ok)
      .map(({ rel, verdict }) => `${rel}: ${verdict.reason}`);
    /*
      THE MESSAGE NAMES THE REMEDY BY PATH, ordered fable-1038 §4 after the
      fourth promoted-script instance. A guard that names its remedy gets
      followed; one that only refuses gets worked around, and the next instance
      arrives through whoever never read the mailbox this was ruled in.
    */
    expect(
      breaches,
      "End the script by ending the process — the LAST top-level statement is "
        + "`process.exit(0)`, and an exit in an earlier branch does not count. "
        + "`scripts/SKELETON-disposable.mts` is the shape both script guards "
        + "want; copy it rather than starting from a blank file.\n"
        + breaches.map((line) => `  ${line}`).join("\n"),
    ).toEqual([]);
  });

  it("CAN FAIL — the shapes it must reject, driven directly", () => {
    /* The defect exactly as it stood: an exit in an early branch, and work that
       reaches the end of the file and stops without one. `contains()` passes
       this; the terminal-statement rule does not. */
    const earlyExitOnly = [
      "import { getDb } from '../server/db/connection.js';",
      "if (!process.env.DATABASE_URL) { console.log('no database'); process.exit(0); }",
      "const db = await getDb();",
      "console.log('done');",
    ].join("\n");
    expect(earlyExitOnly).toContain("process.exit(0)");
    expect(exitContract(earlyExitOnly).ok).toBe(false);

    /* The failure path that records a code and then hangs on the open pool —
       the shape found on fourteen scripts by this sweep. */
    const exitCodeOnly = "main().catch((error) => {\n  console.error(error);\n  process.exitCode = 1;\n});";
    expect(exitContract(exitCodeOnly).ok).toBe(false);
    expect(exitContract(exitCodeOnly).reason).toContain("happy arm");

    /* A happy arm that exits while the failure arm falls through. */
    const happyOnly = "main().then(() => process.exit(0));";
    expect(exitContract(happyOnly).ok).toBe(false);
    expect(exitContract(happyOnly).reason).toContain("failure arm");

    /* And a comment is not an exit. */
    expect(exitContract("await run();\n/* process.exit(0); */").ok).toBe(false);
    expect(exitContract("await run();\n// process.exit(0);").ok).toBe(false);
  });

  it("CAN PASS FOR THE RIGHT REASON — the four shapes that are actually correct", () => {
    /* The other half of the same question, and the one usually left unasked: a
       checker that cannot go green for the right reason is as useless as one
       that cannot go red. Each of these is a real tail from the tree. */
    expect(exitContract("await main();\n\n/* note */\nprocess.exit(0);\n").ok).toBe(true);
    expect(exitContract("process.exit(failures === 0 ? 0 : 1);\n").ok).toBe(true);
    expect(exitContract([
      "main().then(() => process.exit(0)).catch(() => {",
      "  process.stderr.write('migration_failed\\n');",
      "  process.exit(1);",
      "});",
    ].join("\n")).ok).toBe(true);
    expect(exitContract([
      "main().then(",
      "  (exitCode) => process.exit(exitCode),",
      "  (error) => {",
      "    console.error(error);",
      "    process.exit(1);",
      "  },",
      ");",
    ].join("\n")).ok).toBe(true);
  });

  it("CAN FAIL ON SCOPE — the entrypoint/module split, driven directly", () => {
    /* The scope rule is the other place this guard could quietly stop working:
       if every script looked like a module, they would all pass by being out of
       scope, and the suite would stay green over nothing. */
    const specimens = "import { openDatabase } from './lib/dbConnection.mts';\n"
      + "const { refineCandidate } = await import('../server/castingV2/refineService');\n";
    expect(importSpecifiers(specimens)).toEqual([
      "./lib/dbConnection.mts",
      "../server/castingV2/refineService",
    ]);
    /* The dynamic form specifically — the one the first version of this guard
       could not see, on the one script that was actually found resident. */
    expect(importSpecifiers(`await import("../server/db/connection.js")`))
      .toEqual(["../server/db/connection.js"]);
    expect(resolveScript("scripts/x.mts", "./lib/dbConnection.mts")).toBe("scripts/lib/dbConnection.mts");
    expect(resolveScript("scripts/x.mts", "../server/db/connection.js")).toBe(null);
  });
});
