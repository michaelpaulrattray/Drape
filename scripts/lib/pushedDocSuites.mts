/**
 * THE SUITES THAT PIN WHAT A PUSH TOUCHES — RUN BEFORE THE PUSH, NOT AFTER (#1813).
 *
 * `#169`'s shape, a THIRD time, and its own words predicted the second: *the arm
 * exists but runs only in `pnpm test` and the PR gate, and editions go straight
 * to main through the rite, never through a PR.* #1679 heard that about the
 * briefing and fixed the briefing. This is the same sentence about every other
 * instruction surface the rite pushes.
 *
 * `ca13c631` (card #1809, a Warden patrol's docs commit) went to `main` through
 * the rite at 19:57Z on 2026-10-02 carrying two bare `file:line` pointers in
 * `CLAUDE.md`. **`server/prosePointerDiscipline.test.ts` reddened on `main` from
 * that moment**, and the first PR to run its gate afterwards — #1812, docs-only —
 * failed `gate-checks` on an arm its diff never touched. Nothing in the rite
 * reads `CLAUDE.md`, so nothing could have said so.
 *
 * The rite deliberately does not run `pnpm test` (eight minutes, his word), so
 * the answer is not *run everything*. It is: **run the suites whose SUBJECT is
 * the files this push changes.**
 *
 * # WHAT "ABOUT" MEANS HERE — AND THE TWO READINGS THAT WERE MEASURED AND REJECTED
 *
 * ⚠ **A STRING GREP IS NOT READERSHIP: CITATION OUTNUMBERS IT.** Measured on
 * this tree: `git grep -l CLAUDE.md -- '*.test.ts'` returns **59** suites, and
 * almost all of them merely QUOTE a law out of `CLAUDE.md` in a docblock —
 * `server/billing.test.ts` cites it, it does not read it. This repository writes
 * its reasons into docblocks and backticks every filename it mentions, so prose
 * is the DOMINANT source of a filename in a test file here.
 *
 * ⚠ **AND FOLLOWING IMPORTS GENERICALLY IS WORSE, WHICH WAS DRIVEN RATHER THAN
 * REASONED ABOUT.** The first shape of this module unioned the literals of every
 * module a suite imported, so that a suite reading `LAW_SURFACES` out of
 * `lawText.mts` would be found. It selected **71 suites for `CLAUDE.md` and took
 * 27 seconds** — worse than the grep it was built to beat, because an imported
 * module's whole vocabulary gets attributed to every importer. That is the same
 * failure `preflight.mts`'s own subject index records at its own first attempt
 * (*"a two-file change selected 71 suites where the precise reading selects a
 * fraction"*), reproduced here down to the number.
 *
 * **So the reading is:** a suite is about a path when, read at the commit and
 * **with comments stripped**, it performs a filesystem READ and either
 *
 *   1. names that path — or a directory containing it — in a string literal, or
 *   2. names the DECLARED CONSTANT that holds that path (`LAW_SURFACES`,
 *      `BRIEFING_FILE`), which is the one hop, taken on the SYMBOL rather than
 *      on a module's vocabulary.
 *
 * Road 2 is what keeps this honest rather than lucky. `prosePointerDiscipline`
 * does not hard-code its surfaces: it imports `LAW_SURFACES` from
 * `scripts/lib/lawText.mts`, a module that exists for exactly that reason (*"the
 * population is declared ONCE, here, and derived by every reader (working law
 * 4)"*). A reader without this hop works today only because those suites also
 * happen to mention `CLAUDE.md` in their own assertions, and would go silent the
 * first time one stopped. A surface added to `LAW_SURFACES` enrols its suites
 * here with no edit.
 *
 * ⚠ **COMMENTS ARE STRIPPED WITH `withoutComments`, THE ONE SOURCE WALK** —
 * #1623's sweep found four private copies of that idea which disagreed about
 * string literals, and #1638 resolved them to that module (56 consumers, several
 * security guards among them). A fifth copy here would be the same bug a fifth
 * time, and the walk is the difference between 59 suites and 22.
 *
 * # WHERE AN EMPTY POPULATION REFUSES, AND WHERE IT IS ORDINARY
 *
 * Most pushed paths have no suite about them, so empty cannot be a refusal in
 * general — that would refuse every ordinary push. But for a DECLARED
 * instruction surface an empty answer means this reader has gone blind, which is
 * the exact failure it was built to end. **The surfaces that must find a guard
 * are themselves derived** — `LAW_SURFACES` plus `BRIEFING_FILE`, both already
 * declared elsewhere — never a list kept here.
 *
 * This is a MODULE (imported by the rite and by its suite) and it never exits.
 */
import { execFileSync } from "node:child_process";

import { withoutComments } from "../../server/testing/withoutComments";
import { BRIEFING_FILE } from "./briefingConformance.mts";
import { LAW_SURFACES } from "./lawText.mts";

/** The test trees `git grep` is asked for. */
const TEST_GLOBS = ["*.test.ts", "*.test.tsx", "*.test.mts"] as const;

/** A read from disk, in the spellings this repository's guards use. */
const READS_DISK = /\b(?:readFileSync|readListedSource|readFile)\s*\(/;

/**
 * A quoted path- or filename-shaped literal.
 *
 * ⚠ Unlike `preflight.mts`'s `PATH_LITERAL` this does NOT require a slash:
 * `"CLAUDE.md"` is the whole subject of this module and has none. Safe here
 * only because the input is comment-stripped — the same pattern over raw source
 * is what produced the 59.
 */
const QUOTED_LITERAL = /["'`]([A-Za-z0-9_.@-]+(?:\/[A-Za-z0-9_.@-]+)*)["'`]/g;

/**
 * Each declared surface constant, and the paths it holds.
 *
 * ⚠ The VALUES are imported, never restated — this names which symbol to look
 * for and asks the declaration what it contains, so a carve-out that adds a file
 * to `LAW_SURFACES` is followed here with no edit (working law 4).
 */
const SURFACE_CONSTANTS: ReadonlyArray<{ readonly symbol: string; readonly paths: readonly string[] }> = [
  { symbol: "LAW_SURFACES", paths: [...LAW_SURFACES] },
  { symbol: "BRIEFING_FILE", paths: [BRIEFING_FILE] },
];

/**
 * The paths whose guards MUST be found, or this reader is blind and refuses.
 * Derived from the constants above rather than listed.
 */
export const GUARDED_SURFACES: readonly string[] = [
  ...new Set(SURFACE_CONSTANTS.flatMap((constant) => constant.paths)),
];

const normalise = (p: string): string => p.replace(/\\/g, "/").replace(/^\.\//, "").trim();

/**
 * Every path that CONTAINS `file`, including itself — so a suite naming a
 * directory (`"docs/specs"`) is about a file inside it, which is what a
 * cross-tree guard writes.
 *
 * ⚠ **A BARE TOP-LEVEL TREE IS NOT A CONTAINER, AND THAT BOUND WAS MEASURED.**
 * Without it, `server/crew/crew-briefing.json` widens to `"server"` — a literal
 * dozens of tree-walking guards name as the root of their own derived
 * population — and the selection went to **76 suites in 5.6s** where the bounded
 * reading returns a handful. A suite naming an entire top-level tree is a
 * whole-repository guard rather than a guard ABOUT this file, and the derived-
 * population guards among them are already in `preflight.mts`'s ALWAYS_RUN set.
 * The file's own full path always counts, however few segments it has, so
 * `CLAUDE.md` is never dropped by this rule.
 */
export function containingPaths(file: string): string[] {
  const normalised = normalise(file);
  const parts = normalised.split("/");
  const out: string[] = [normalised];
  for (let i = parts.length - 1; i >= 2; i -= 1) out.push(parts.slice(0, i).join("/"));
  return out;
}

/** `git grep -l` at a commit, with the `<commit>:` prefix stripped. */
function grepFiles(root: string, commit: string, args: readonly string[]): string[] {
  const prefix = `${commit}:`;
  let out = "";
  try {
    out = execFileSync("git", ["grep", "-l", ...args, commit, "--", ...TEST_GLOBS], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error: any) {
    /* git grep exits 1 with no stderr when nothing matched — not an error. */
    if (error?.status === 1 && String(error?.stderr ?? "").trim() === "") return [];
    throw error;
  }
  return out
    .split(/\r?\n/)
    .map((line) => normalise(line.startsWith(prefix) ? line.slice(prefix.length) : line))
    .filter((line) => line !== "");
}

function showAtCommit(root: string, commit: string, file: string): string {
  try {
    return execFileSync("git", ["show", `${commit}:${file}`], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    return "";
  }
}

export type DocSuiteSelection = {
  /** The suites to run, sorted, deduplicated, `already` excluded. */
  readonly suites: readonly string[];
  /** Which pushed path selected what — for the receipt and for the refusal. */
  readonly byPath: ReadonlyMap<string, readonly string[]>;
  /** Declared surfaces in this push that found NO suite at all. A refusal. */
  readonly blindSurfaces: readonly string[];
};

/**
 * The suites that READ any of `changedPaths`, read at `commit`.
 *
 * @param already suites a previous step has already run on this commit; excluded
 *                from `suites` so nothing runs twice (the rite's briefing block
 *                owns the client-side briefing readers).
 */
export function pushedDocSuites(
  root: string,
  commit: string,
  changedPaths: readonly string[],
  already: readonly string[] = [],
): DocSuiteSelection {
  const changed = [...new Set(changedPaths.map(normalise).filter((p) => p !== ""))];
  if (changed.length === 0) return { suites: [], byPath: new Map(), blindSurfaces: [] };

  /* PREFILTER, so only a handful of blobs are ever fetched. The reads-disk set
     is one grep for the whole run; the naming set is one grep per candidate
     path. The intersection is what gets read and comment-stripped. */
  const readsDisk = new Set(
    grepFiles(root, commit, ["-E", "-e", "readFileSync|readListedSource|readFile\\("]),
  );

  const stripped = new Map<string, string>();
  const strippedOf = (file: string): string => {
    const hit = stripped.get(file);
    if (hit !== undefined) return hit;
    const text = withoutComments(showAtCommit(root, commit, file));
    stripped.set(file, text);
    return text;
  };

  /* A suite naming a declared surface CONSTANT is about every path it holds,
     whether or not it spells any of them out. One grep per constant. */
  const bySymbol = new Map<string, Set<string>>();
  for (const constant of SURFACE_CONSTANTS) {
    const named = grepFiles(root, commit, ["-F", "-e", constant.symbol]).filter(
      (file) => readsDisk.has(file) && new RegExp(`\\b${constant.symbol}\\b`).test(strippedOf(file)),
    );
    for (const path of constant.paths) {
      const set = bySymbol.get(path) ?? new Set<string>();
      for (const file of named) set.add(file);
      bySymbol.set(path, set);
    }
  }

  const ran = new Set(already.map(normalise));
  const byPath = new Map<string, string[]>();
  const selected = new Set<string>();

  for (const changedPath of changed) {
    const containers = containingPaths(changedPath);
    const hits = new Set<string>(bySymbol.get(changedPath) ?? []);

    for (const container of containers) {
      for (const file of grepFiles(root, commit, ["-F", "-e", container])) {
        /* A suite is never its own subject: a guard that reads itself — the
           suite-pointer and listed-source readers do — would otherwise be
           selected by every push that touches it, which adjacency covers. */
        if (file === changedPath) continue;
        if (!readsDisk.has(file)) continue;
        const text = strippedOf(file);
        if (!READS_DISK.test(text)) continue;
        QUOTED_LITERAL.lastIndex = 0;
        for (const match of text.matchAll(QUOTED_LITERAL)) {
          if (match[1] === container) {
            hits.add(file);
            break;
          }
        }
      }
    }

    if (hits.size > 0) byPath.set(changedPath, [...hits].sort());
    for (const file of hits) if (!ran.has(file)) selected.add(file);
  }

  const blindSurfaces = changed
    .filter((p) => GUARDED_SURFACES.includes(p))
    .filter((p) => (byPath.get(p) ?? []).length === 0)
    .sort();

  return { suites: [...selected].sort(), byPath, blindSurfaces };
}
