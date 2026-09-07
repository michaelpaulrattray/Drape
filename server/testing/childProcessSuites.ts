import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * WHICH SUITES DRIVE A REAL CHILD PROCESS — the population, derived from the
 * tree rather than listed (#548).
 *
 * The timeout they all declare, and why it is 30 s, lives beside it in
 * `childProcessTimeout.ts`. This module answers only the other half: WHO must
 * declare it. A list would drift the moment a suite was added, which is the
 * defect working law 4 is about and the shape that let four arms of
 * `nextUpEscalation.test.ts` go red on a machine while CI stayed green.
 */

/**
 * The functions that start a process. Matched only when the identifier was
 * imported from `node:child_process`, never on the bare word: `spawn(` and
 * `exec(` are ordinary English in this repository and half a dozen libraries
 * export them.
 */
const CHILD_PROCESS_CALLS = [
  "spawnSync",
  "spawn",
  "execSync",
  "execFileSync",
  "execFile",
  "exec",
  "fork",
];

/**
 * Strip comments and string/template literals before asking whether a file
 * spawns anything.
 *
 * ⚠ **THIS IS THE WHOLE DIFFERENCE BETWEEN A POPULATION AND A GREP, AND THE
 * TREE HOLDS ITS OWN CONTROLS** — live files rather than fixtures, which is why
 * `childProcessTestTimeouts.test.ts` asserts on them by name:
 *
 *   server/crewNamingWindow.test.ts     "handed to `execFileSync`, not a
 *                                       constant standing near it" — a comment,
 *                                       and the file starts no process at all.
 *   server/r7-b4-live-consumers.test.ts a source-guard arm asserting that the
 *                                       runner CONTAINS `spawnSync('taskkill…`
 *                                       — the call is a string it reads, not a
 *                                       call it makes.
 *
 * Neither starts a process, and a naive sweep on the call name alone indicts
 * both. It is the same discipline `prosePointerDiscipline.test.ts` already
 * applies for the same reason.
 *
 * ⚠ **SAID PRECISELY, BECAUSE THE SABOTAGE RUN SHOWED THE LOOSER SENTENCE WAS
 * FLATTERING ITSELF: those two files are held out by the IMPORT half, not by
 * this stripper.** Neither imports `node:child_process` at all, so turning
 * `codeOnly` into a no-op leaves both correctly excluded and the two arms
 * naming them stay green. They are honest controls for the POPULATION and they
 * are not coverage for the stripping. What covers the stripping is the pair of
 * arms that drive `codeOnly` directly — and those DO redden under that
 * sabotage. Two properties, two controls, rather than one claim doing the work
 * of two.
 *
 * ⚠ **AND THE THIRD FILE I EXPECTED TO SIT HERE DOES NOT — THE DERIVER SAID SO
 * AND IT WAS RIGHT.** `server/pushPathsToMain.test.ts` also carries a spawn
 * call inside a string — a fake file's content, an `execFileSync` invocation
 * spelled out as a literal — so it was written down as a third negative control
 * before the reading was taken. (The invocation is not quoted here on purpose:
 * that suite flags any file naming a push command, even in a comment, and
 * quoting its fixture would put this module on an enumeration of doors to main
 * for no reason but a docblock.) It is a genuine MEMBER: it imports
 * `scripts/lib/scriptGuards.mts`,
 * which spawns. Stripping keeps it out of the population for the wrong reason
 * and the hop puts it back for the right one — recorded because a control that
 * was never checked against the artifact is how a guard comes to assert
 * something false about its own tree.
 */
export function codeOnly(source: string): string {
  let out = "";
  let i = 0;
  type Mode = "code" | "line" | "block" | "single" | "double" | "template";
  let mode: Mode = "code";

  while (i < source.length) {
    const two = source.slice(i, i + 2);
    if (mode === "code") {
      if (two === "//") { mode = "line"; i += 2; continue; }
      if (two === "/*") { mode = "block"; i += 2; continue; }
      if (source[i] === "'") { mode = "single"; i += 1; continue; }
      if (source[i] === '"') { mode = "double"; i += 1; continue; }
      if (source[i] === "`") { mode = "template"; i += 1; continue; }
      out += source[i];
      i += 1;
      continue;
    }
    if (mode === "line") {
      if (source[i] === "\n") { mode = "code"; out += "\n"; }
      i += 1;
      continue;
    }
    if (mode === "block") {
      if (two === "*/") { mode = "code"; i += 2; continue; }
      /* Newlines are kept so a later reader's line numbers still mean something. */
      if (source[i] === "\n") out += "\n";
      i += 1;
      continue;
    }
    /* Inside a literal: honour the escape, then look for the closer. */
    if (source[i] === "\\") { i += 2; continue; }
    const closer = mode === "single" ? "'" : mode === "double" ? '"' : "`";
    if (source[i] === closer) { mode = "code"; }
    if (source[i] === "\n") out += "\n";
    i += 1;
  }
  return out;
}

/**
 * Does this module's own code start a process? BOTH halves must hold.
 *
 * The import specifier is read from the RAW source, because a specifier is
 * always a string literal and `codeOnly` has by then removed it — that is the
 * one place stripping goes too far, and it is safe precisely because the CALL
 * half is still read from the stripped code. A comment mentioning the module
 * alongside no call, or a call-shaped string alongside no import, is not a
 * spawner either way.
 */
function startsAProcess(source: string): boolean {
  const imports = /(?:from\s*|require\(\s*)["'](?:node:)?child_process["']/.test(source);
  if (!imports) return false;
  const code = codeOnly(source);
  return CHILD_PROCESS_CALLS.some((fn) => new RegExp(`\\b${fn}\\s*\\(`).test(code));
}

/** Every extension a relative import may resolve to here. */
const EXTENSIONS = ["", ".ts", ".tsx", ".mts", ".js", ".mjs", "/index.ts", "/index.tsx"];

function resolveRelative(fromFile: string, specifier: string, repoRoot: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(join(repoRoot, fromFile)), specifier);
  for (const ext of EXTENSIONS) {
    const candidate = base + ext;
    /* `existsSync` alone is true of the DIRECTORY `./testing`, and reading one
       throws EISDIR — measured on the first run of this deriver. */
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function relativeSpecifiers(source: string): string[] {
  const out: string[] = [];
  const pattern = /(?:from|import)\s*["'](\.[^"']*)["']/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(source))) out.push(m[1]);
  return out;
}

/**
 * Does this suite actually SET the timeout?
 *
 * ⚠ **AN IMPORT IS NOT A CALL SITE, AND THE FIRST DRAFT OF THIS READER COUNTED
 * ONE.** It asked whether the source mentions `CHILD_PROCESS_TEST_TIMEOUT_MS`
 * — which the import line does — so deleting the `vi.setConfig(…)` call and
 * leaving the import behind read as fully declared, and the sabotage aimed at
 * exactly that hole came back green. It is `CLAUDE.md`'s own most expensive
 * mistake (`isSensitiveAction`, a road re-classified on the strength of an
 * import nobody opened) reproduced inside a guard written the same week.
 *
 * So the CALL is what is read, from stripped code, in either spelling vitest
 * accepts.
 */
export function declaresTheTimeout(source: string): boolean {
  const code = codeOnly(source);
  return /vi\s*\.\s*setConfig\s*\(\s*\{[^}]*testTimeout\s*:\s*CHILD_PROCESS_TEST_TIMEOUT_MS/.test(code);
}

export type SuiteReading = {
  /** Repo-relative, forward-slashed. */
  file: string;
  /** How the child process is reached. */
  via: "directly" | { module: string };
  /** Whether the file declares the shared floor. */
  declares: boolean;
};

/**
 * The population, derived from the tree.
 *
 * ⚠ **ONE HOP IS RESOLVED, AND IT IS NOT AN EXTRA — IT IS WHAT CATCHES BOTH
 * FILES THE CARD NAMED.** Neither `nextUpEscalation.test.ts` nor
 * `typecheckOnCommit.test.ts` contains the word `spawnSync` in code: the first
 * goes through `server/testing/hookDriver.ts` and the second through the module
 * it is testing, `scripts/lib/typecheckOnCommit.mts`. A sweep that asked only
 * "does this file call spawnSync" would have found neither of the two arms that
 * actually failed, and reported a clean population. That is the namespace-hop
 * lesson the un-wiring differ paid for, arriving in a new place.
 *
 * ITS LIMIT IS STATED RATHER THAN DISCOVERED: **exactly one hop**, through a
 * RELATIVE specifier. A test reaching a spawner two modules deep, or through a
 * package, is invisible here — so a clean reading is a FLOOR and not coverage.
 */
export function childProcessSuites(repoRoot: string): SuiteReading[] {
  const tracked = execFileSync("git", ["ls-files", "*.test.ts", "*.test.tsx"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (tracked.length === 0) {
    /* A sweep over no files answers every question with "clean". */
    throw new Error(
      `childProcessSuites: git ls-files returned no *.test.ts under ${repoRoot}. ` +
        "A population of zero is a broken reading, not a clean tree.",
    );
  }

  const readings: SuiteReading[] = [];
  const spawnerCache = new Map<string, boolean>();

  for (const file of tracked) {
    const absolute = join(repoRoot, file);
    if (!existsSync(absolute)) continue;
    const source = readFileSync(absolute, "utf8");

    let via: SuiteReading["via"] | null = null;
    if (startsAProcess(source)) {
      via = "directly";
    } else {
      for (const specifier of relativeSpecifiers(source)) {
        const target = resolveRelative(file, specifier, repoRoot);
        if (!target) continue;
        let spawns = spawnerCache.get(target);
        if (spawns === undefined) {
          spawns = startsAProcess(readFileSync(target, "utf8"));
          spawnerCache.set(target, spawns);
        }
        if (spawns) {
          via = { module: target.replace(/\\/g, "/").replace(repoRoot.replace(/\\/g, "/") + "/", "") };
          break;
        }
      }
    }

    if (!via) continue;
    readings.push({ file, via, declares: declaresTheTimeout(source) });
  }

  return readings;
}
