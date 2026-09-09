import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { codeOnly } from "./childProcessSuites";

/**
 * WHICH SUITES SWEEP THE SOURCE TREE — the population, derived from the tree
 * rather than listed (#741).
 *
 * The timeout they all declare, and why it is 30 s, lives beside it in
 * `contendedTestTimeout.ts`. This module answers only the other half: WHO must
 * declare it. `childProcessSuites.ts` is the sibling that answers the same
 * question for suites that spawn a real process, and `codeOnly` is IMPORTED
 * from it rather than copied — a second stripper would be the mirror this
 * repository keeps paying for.
 *
 * ⚠ **THE SIGNAL IS `readListedSource`, AND IT IS PRECISE BY CONSTRUCTION
 * RATHER THAN BY LUCK.** That helper exists for exactly one purpose, stated in
 * its own header: a file a listing named can be gone by the time you read it,
 * so a walk that lists and then reads goes through it. A test file that imports
 * it is therefore reading many files off the real tree — that is the whole
 * reason it is reaching for that reader at all.
 *
 * ⚠ **THE ROAD NOT TAKEN, AND THE NUMBER THAT KILLED IT: `readdirSync`.** It
 * looked like the obvious signal and it was measured before it was believed —
 * **65 of the 801 tracked test files call it, and only 11 declare any timeout
 * at all.** Most of the other 54 read an `mkdtemp` fixture of three files,
 * which costs microseconds and would be indicted for nothing. **A guard that
 * indicts fifty innocent files to catch nine is the failure this card is
 * about**, not its remedy: the card's own sentence is that a guard which
 * reddens because the machine was busy teaches a shift to ignore it.
 */

/*
  THE ONE IMPRECISION IN THE SIGNAL, MEASURED AND LEFT IN RATHER THAN CARVED
  OUT. Of the fifteen files this reader finds, fourteen read the real tree and
  one does not: `testing/listedSource.test.ts` drives the reader over
  `mkdtemp` fixtures of three files apiece, which costs microseconds. It is the
  reader's OWN suite, and it keeps the floor anyway — a 30 s ceiling on a cheap
  suite costs only that a genuine hang there takes 30 s to surface, whereas an
  exception keyed on a FILENAME is the thing that stops a guard watching the
  moment somebody fixes one file. The cost is named; the carve-out is declined.
*/

/** Where the sanctioned tree reader lives, as its importers spell it. */
const LISTED_SOURCE_SPECIFIERS = [
  "./testing/listedSource",
  "../testing/listedSource",
  "./listedSource",
];

/**
 * Does this suite read the tree through the sanctioned reader?
 *
 * BOTH halves must hold, for `childProcessSuites`'s reason: the specifier is
 * read from the RAW source, because an import specifier is a string literal and
 * `codeOnly` has by then removed it; the CALL is read from the stripped code, so
 * a docblock naming the helper — and several in this tree do, including this
 * one — is not a sweep, and an import with no call is not one either.
 */
export function sweepsTheTree(source: string): boolean {
  const imports = LISTED_SOURCE_SPECIFIERS.some(
    (specifier) => source.includes(`from "${specifier}"`) || source.includes(`from '${specifier}'`),
  );
  if (!imports) return false;
  return /\breadListedSource\s*\(/.test(codeOnly(source));
}

/**
 * Does this suite SET the floor, at FILE level?
 *
 * ⚠ **AN IMPORT IS NOT A CALL SITE** — #548's guard counted one in its first
 * draft and the sabotage aimed at the hole came back green, which is
 * `CLAUDE.md`'s own most expensive mistake reproduced inside a guard. So the
 * `vi.setConfig` CALL is what is read, from stripped code.
 *
 * ⚠ **EITHER CLASS CONSTANT SATISFIES IT.** Four of this population also spawn
 * a process and already carry `CHILD_PROCESS_TEST_TIMEOUT_MS`; they are off the
 * 5 s default, which is the entire property being asserted, and making them
 * swap one 30,000 for another would be churn dressed as compliance.
 *
 * ⚠ **A PER-ARM NUMBER DOES NOT COUNT, AND THAT IS DELIBERATE** — it is the
 * road #548 measured as leaking, and this tree holds two live half-covered
 * files. The declaration must be the file's.
 */
export function declaresTheFloor(source: string): boolean {
  const code = codeOnly(source);
  return /vi\s*\.\s*setConfig\s*\(\s*\{[^}]*testTimeout\s*:\s*(?:CONTENDED_TEST_TIMEOUT_MS|CHILD_PROCESS_TEST_TIMEOUT_MS)/.test(
    code,
  );
}

export type SweepReading = {
  /** Repo-relative, forward-slashed. */
  file: string;
  /** Whether the file declares one of the two class floors. */
  declares: boolean;
};

/**
 * The population, derived from the tree.
 *
 * ⚠ **ITS LIMIT IS STATED RATHER THAN DISCOVERED, AND IT IS A REAL ONE: A
 * HAND-ROLLED WALK IS INVISIBLE HERE.** `castingV2/openLanePinning.test.ts`
 * sweeps the whole casting tree through its own `tsFilesUnder` + bare
 * `readFileSync` and went red twice in five runs, and this reader cannot see
 * it. That is not a hole to paper over: a walk that lists and reads without the
 * sanctioned reader is #223's defect and #655's subject, and the answer to it
 * is to move those walks onto `readListedSource` — at which point they arrive
 * in this population for free. **Until then a clean reading here is a FLOOR and
 * not coverage**, and the arms that measured red carry the declaration whether
 * this reader can see them or not.
 */
export function sourceSweepSuites(repoRoot: string): SweepReading[] {
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
      `sourceSweepSuites: git ls-files returned no *.test.ts under ${repoRoot}. ` +
        "A population of zero is a broken reading, not a clean tree.",
    );
  }

  const readings: SweepReading[] = [];
  for (const file of tracked) {
    const absolute = join(repoRoot, file);
    /* A tracked file can be absent from a worktree mid-operation, and this
       reader must not throw where `readListedSource` would tolerate. */
    if (!existsSync(absolute)) continue;
    const source = readFileSync(absolute, "utf8");
    if (!sweepsTheTree(source)) continue;
    readings.push({ file, declares: declaresTheFloor(source) });
  }

  return readings;
}
