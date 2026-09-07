import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A DOCBLOCK THAT NAMES ITS OWN GUARD IS A CLAIM, AND IT IS ONE OF THE FEW A
 * MACHINE CAN SETTLE COMPLETELY (#647).
 *
 * *"<something>.test.ts drives it"* is either true or it is not: a file by that
 * name is tracked, or it is not. No line numbers, no judgement.
 *
 * ⚠ **NOTE THE ANGLE BRACKETS, BECAUSE THIS READER CAUGHT ITS OWN AUTHOR.** The
 * first draft of this docblock used a backticked example filename, and the arm
 * below correctly reported it — a backticked name in prose is a pointer, and
 * nothing in the bytes distinguishes an illustration from a claim. **So the
 * rule for writing ABOUT pointers is: do not backtick an example.** Exempting
 * them instead would have punched a hole in the reader for the sake of a
 * comment.
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

/**
 * A backticked reference to a test file, bare or path-qualified — a backticked
 * <name>.test.ts, or a backticked server/<name>.test.ts.
 *
 * ⚠ **THE PATH-QUALIFIED HALF WAS MISSING AND IT WAS A QUARTER OF THE
 * POPULATION** (PR #651's review, findings 1 and 2). The first version matched
 * `[A-Za-z0-9_.-]+`, which excludes `/`, so ~113 pointers written in the
 * <dir>/<name> style were invisible — and the module's own comment explained
 * their absence with a reason that was FALSE at the bytes, claiming those
 * mentions were unbackticked when `preflight.test.ts` backticks all three.
 * **A record disagreeing with the tree, inside the guard built to stop records
 * disagreeing with the tree.**
 *
 * The gap is CLOSED here rather than declared, because the reviewer had already
 * checked all ~113 against the tree and none dangled undeliberately — so
 * widening costs nothing today and stops a dangling pointer written in path
 * form from shipping green tomorrow. Resolution is still by BASENAME: the
 * question this guard answers is whether a file by that name is tracked, and a
 * path that has merely moved is a different, ambiguous question.
 */
const POINTER = /`((?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.test\.tsx?)`/g;

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
  "foo.test.ts": {
    why:
      "A worked example inside `preflight.test.ts`'s own comments, describing the " +
      "selector shape that was silently green — 'server/foo.test.ts while server/bar.test.ts " +
      "imports it'. Naming a file that does not exist is the whole point of an example.",
  },
  "bar.test.ts": {
    why: "The second half of the same worked example in `preflight.test.ts`'s comments.",
  },
  "thing.test.ts": {
    why:
      "The third, at `preflight.test.ts:372` — 'a shift writes server/thing.test.ts'. Same " +
      "example, same reason: it describes a file a shift is about to create.",
  },
};

/*
  ⚠ THE `foo`/`bar`/`thing` ENTRIES CAME OFF THIS LIST AND WENT BACK ON, AND
  THE ROUND TRIP IS THE LESSON RATHER THAN AN EMBARRASSMENT.

  The card that ordered this guard named them among its false positives. They
  were written here, then REMOVED when the first reading did not find them —
  with a comment in this spot explaining that the reader keys on a backticked
  reference and those fixtures are "bare strings".

  ⚠ **THAT EXPLANATION WAS FALSE AT THE BYTES, and PR #651's review read them.**
  `preflight.test.ts:72` and `:372` backtick all three; they were invisible only
  because they are PATH-QUALIFIED and the regex excluded `/`. So the guard built
  to stop records disagreeing with the tree was carrying a record that
  disagreed with the tree — about its own population, in a comment that read
  like a measurement.

  The regex is widened and the three are enumerated with the reason that is
  actually true. **The rule that survives both directions: an entry earns its
  place from a reading, and so does its absence — a removal justified by a
  mechanism nobody drove is the same mistake as a dead entry kept just in
  case.** The "still mentioned" arm is what now checks that continuously.
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
        /* A path-qualified pointer resolves on its LAST segment: this guard
           answers "is a file by that name tracked", and a file that has merely
           moved directory is the ambiguous question it deliberately avoids. */
        const named = match[1].split("/").pop() ?? match[1];
        readings.push({ file, names: named, line: index + 1, resolves: basenames.has(named) });
      }
    });
  }

  return readings;
}

/*
  ⚠ THERE IS NO `danglingPointers` HELPER HERE, AND THAT IS THE GATE'S DOING
  RATHER THAN AN OVERSIGHT. One was written — `suitePointers` filtered by
  `!resolves && !(names in DELIBERATELY_ABSENT)` — and `pnpm check`'s
  uncalled-export arm refused the commit: its only consumer was the suite that
  drives it, which that reader does not count. An export nothing in the product
  calls is a control that does not exist, and this repository's own
  "currently not enforced" list is that mistake four times over.

  So the two facts a caller needs are exported and the one-line join that
  combines them lives in `suitePointerDiscipline.test.ts`, which is the only
  place that ever wanted it.
*/
