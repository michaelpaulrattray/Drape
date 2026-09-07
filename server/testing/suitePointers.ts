import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A DOCBLOCK THAT NAMES ITS OWN GUARD IS A CLAIM, AND IT IS ONE OF THE FEW A
 * MACHINE CAN SETTLE COMPLETELY (#647).
 *
 * *"`foo.test.ts` drives it"* is either true or it is not: a file by that name
 * is tracked, or it is not. No line numbers, no judgement.
 *
 * ⚠ **THE HARM IS NOT UNTIDINESS, AND THIS REPOSITORY HAS PAID FOR IT TWICE.**
 * A reader who follows the pointer, finds nothing, and concludes *the guard was
 * never written* has just re-filed a LIVE control as a dead one. That is the
 * wrong-road class `CLAUDE.md`'s law-7 section documents at length — the
 * sensitive-action gate moved to "wired and lost" on the strength of a dead
 * import, the login-attack detector filed as "never wired" when it had run in
 * production for two months. Both cost months, and both were a record
 * disagreeing with the tree.
 *
 * # WHY A BASENAME AND NOT A RESOLVER
 *
 * `prosePointerDiscipline.test.ts` refused a *pointer-resolver* and its header
 * says why: built, run and refused, 46 broken pointers found and all three live
 * instances MISSED, because a line number is ambiguous — a line that still
 * holds something else reads as fine.
 *
 * **A basename is not ambiguous.** This closes the strictly smaller question
 * that has a yes/no answer, and leaves the one that does not exactly where that
 * suite left it.
 *
 * # SCOPE, STATED RATHER THAN IMPLIED
 *
 * Tracked `.ts` and `.tsx` only. `.md` and `.mts` are a second population and
 * are not claimed here — a clean reading over this one says nothing about them.
 */

/** A backticked reference to a test file, e.g. `` `refineSubjects.test.ts` ``. */
const POINTER = /`([A-Za-z0-9_.-]+\.test\.tsx?)`/g;

export type PointerReading = {
  /** Repo-relative, forward-slashed, of the file doing the pointing. */
  file: string;
  /** The basename it names. */
  names: string;
  /** 1-indexed line it sits on. */
  line: number;
  /** Whether a tracked file with that basename exists. */
  resolves: boolean;
};

/**
 * ⚠ **DELIBERATE MENTIONS OF A SUITE THAT DOES NOT EXIST — EACH WITH ITS OWN
 * REASON, AND THE REASON IS THE POINT.**
 *
 * Some sentences name a dead or never-born suite ON PURPOSE, and they are the
 * most valuable sentences of their kind rather than the sloppiest: a paragraph
 * explaining that a control DIED is worthless without naming what died. A guard
 * that indicts them teaches people to delete the history instead.
 *
 * So they are enumerated here, the way this repository already enumerates its
 * push paths and its capability debts — never inferred, never pattern-matched.
 * Adding a line is a deliberate act, and the `why` is what a later reader gets
 * instead of a mystery.
 */
export const DELIBERATELY_ABSENT: Record<string, { readonly why: string }> = {
  "velocityLimits.test.ts": {
    why:
      "Deleted with the credit-velocity caps (2026-08-19). `prosePointerDiscipline.test.ts` " +
      "and `loginAttackAlert.test.ts` quote it as the worked example of a suite that could " +
      "not fail when its own subject was deleted. Naming it is the whole content of those " +
      "sentences.",
  },
  "framingTrimStep.test.ts": {
    why:
      "Deleted when the founder retired the framing trim (2026-09-03, card #11). " +
      "`rollService.test.ts` names it in the sentence that explains WHY those arms moved " +
      "there — 'deleting it took its sheet arm with it'. The mention is the provenance.",
  },
  "planLadder.test.ts": {
    why:
      "`client/src/features/settings/planLadder.ts` documents this defect about ITSELF — " +
      "'for a file that has never existed'. It is the negative control this guard is " +
      "measured against, and indicting it would be the guard failing its own subject.",
  },
  "referenceAttachDoor.test.ts": {
    why:
      "`referenceAttachDoor.ts` names it in the ⚠ paragraph recording that this very " +
      "pointer never resolved (#647) — the same self-documenting shape as planLadder. " +
      "The correction cannot be written without naming what was corrected.",
  },
};

/*
  ⚠ WHAT IS NOT IN THE LIST, AND WHY THE LIST IS THIS SHORT.

  The card that ordered this guard named four `preflight.test.ts` fixtures
  (`foo`, `bar`, `thing`) among its six false positives, and entries for them
  were written here before the reading was taken. THE READING DOES NOT FIND
  THEM: this reader keys on a BACKTICKED reference, and those fixtures are bare
  strings inside that suite's own arms. Three dead entries would have sat here
  excusing names nothing mentions — an allowlist that is longer than its
  population is an allowlist nobody can audit, and every future reader would
  have had to check whether those lines were load-bearing.

  They were removed rather than kept "just in case", which is the same reason
  `KNOWN_DEBTS` may only shrink.
*/

/** Every backticked suite pointer in the tracked `.ts`/`.tsx` population. */
export function suitePointers(repoRoot: string): PointerReading[] {
  const tracked = execFileSync("git", ["ls-files", "*.ts", "*.tsx"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (tracked.length === 0) {
    /* A sweep over no files answers every question with "clean". */
    throw new Error(
      `suitePointers: git ls-files returned nothing under ${repoRoot}. ` +
        "An empty population is a broken reading, not a clean tree.",
    );
  }

  const basenames = new Set(tracked.map((file) => file.split("/").pop() ?? file));
  const readings: PointerReading[] = [];

  for (const file of tracked) {
    let source: string;
    try {
      source = readFileSync(join(repoRoot, file), "utf8");
    } catch {
      continue;
    }
    if (!source.includes(".test.ts")) continue;

    source.split("\n").forEach((text, index) => {
      POINTER.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = POINTER.exec(text))) {
        readings.push({ file, names: match[1], line: index + 1, resolves: basenames.has(match[1]) });
      }
    });
  }

  return readings;
}

/** The pointers that name nothing and are not enumerated above. */
export function danglingPointers(repoRoot: string): PointerReading[] {
  return suitePointers(repoRoot).filter(
    (row) => !row.resolves && !(row.names in DELIBERATELY_ABSENT),
  );
}
