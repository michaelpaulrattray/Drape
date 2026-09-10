import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { codeOnly, relativeSpecifiers, resolveRelative } from "./childProcessSuites";

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
  OUT. Of the fourteen files this reader finds, thirteen read the real tree and
  one does not: `testing/listedSource.test.ts` drives the reader over
  `mkdtemp` fixtures of three files apiece, which costs microseconds. It is the
  reader's OWN suite, and it keeps the floor anyway — a 30 s ceiling on a cheap
  suite costs only that a genuine hang there takes 30 s to surface, whereas an
  exception keyed on a FILENAME is the thing that stops a guard watching the
  moment somebody fixes one file. The cost is named; the carve-out is declined.
*/

/*
  ⚠ AND THE THIRD LIMIT IS THE MOST WORTH READING, BECAUSE IT IS THE ONE I GOT
  WRONG FIRST: `codeOnly`'S DOCUMENTED BLIND SPOT IS LIVE ON THIS QUESTION
  TODAY, ON ONE NAMED FILE.

  A `grep -l readListedSource` over the tracked test files returns FIFTEEN. This
  reader returns FOURTEEN, and the missing one is
  `server/deployTriggerClaims.test.ts` — which imports the reader by its plain
  name and calls it at line 214.

  The cause, read at the bytes rather than assumed: that file carries a REGEX
  LITERAL containing a BACKTICK (its `push to \`main\` deploys` claim matcher).
  `codeOnly` does not distinguish a regex literal from division — a limit its
  own header states — so the backtick flips it into TEMPLATE mode, and unlike a
  single- or double-quoted literal **a template is not ended by a newline**. It
  therefore swallows eleven lines including the call, and the file leaves the
  population with nothing going red.

  ⚠ **`childProcessSuites`'S HEADER RECORDS THIS REMAINDER AS HAVING "no live
  instance today" — TRUE OF ITS OWN QUESTION AND NOT OF THIS ONE.** A spawn call
  inside a template is what it grepped for; a tree-read call inside a template's
  BLAST RADIUS is a different population, and it has an instance.

  It is stated rather than fixed here because fixing it means teaching the
  stripper to recognise regex literals, which that module explicitly declines as
  genuinely hard, and because the consequence is bounded and known: the file is
  DECLARED, on measurement, like the other suites the reader cannot see. **A
  clean reading from this deriver is a floor. It is not a census.**
*/

/** The one module a member must reach, repo-relative and forward-slashed. */
const LISTED_SOURCE = "server/testing/listedSource.ts";

/**
 * Does this suite read the tree through the sanctioned reader?
 *
 * BOTH halves must hold, for `childProcessSuites`'s reason: the specifier is
 * read from the RAW source, because an import specifier is a string literal and
 * `codeOnly` has by then removed it; the CALL is read from the stripped code, so
 * a docblock naming the helper — and several in this tree do, including this
 * one — is not a sweep, and an import with no call is not one either.
 *
 * ⚠ **THE IMPORT HALF RESOLVES AGAINST THE FILE SYSTEM RATHER THAN MATCHING A
 * LIST OF SPELLINGS, AND THE FIRST SHAPE OF IT DID THE SECOND THING.** That
 * draft enumerated `./testing/listedSource`, `../testing/listedSource` and
 * `./listedSource` — which covered every importer alive that day and
 * **would have gone silently blind on `../../testing/listedSource`**, the
 * spelling every suite two levels deep under `server/` must use, of which the
 * tree already holds around fifty. It was a hand-kept mirror of a fact the file
 * system already states (working law 4), failing in the direction that reports
 * a clean tree. Resolving the specifier dissolves the question instead of
 * answering it, and it is the sibling deriver's own resolver doing it.
 */
export function sweepsTheTree(source: string, fromFile: string, repoRoot: string): boolean {
  const imports = relativeSpecifiers(source).some((specifier) => {
    const target = resolveRelative(fromFile, specifier, repoRoot);
    if (!target) return false;
    return target.replaceAll("\\", "/").endsWith(LISTED_SOURCE);
  });
  if (!imports) return false;
  /*
    ⚠ THE LIMIT OF THIS HALF, STATED BECAUSE THE HOUSE DISCIPLINE IS THAT A
    FLOOR IS DECLARED RATHER THAN DISCOVERED (the reviewer's second finding, and
    `childProcessSuites` states its one-hop and template-literal remainders the
    same way). A RENAMED or NAMESPACE import — `readListedSource as readSrc`,
    or `import * as listed` — takes a genuine sweeper out of the population with
    nothing going red, because the call is then spelled something this pattern
    does not know. **Grepped at the tree the day this shipped: no live instance,
    all importers use the plain named import.** So it is a remainder rather than
    a defect, and it is the silent direction, which is why it is written down.

    ⚠ AND ITS SIBLING ON THE IMPORT HALF: `relativeSpecifiers` reads STATIC
    import syntax, so a suite reaching the reader through a dynamic
    `await import(…)` leaves this population silently. No live instance today
    and static imports are the house style — but **this is the exact class that
    blinded the architecture Atlas to 65 modules** (`d614320f`), where "zero
    inbound edges" was the reading that meant "safe to delete". It is cheap to
    write down and expensive to rediscover.
  */
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
 *
 * ⚠ **ITS REMAINDER, AND IT IS THE ONE THIS READER IS WEAKEST ON: THE CONSTANT
 * IS MATCHED BY NAME, NEVER BY PROVENANCE.** A file writing its own
 * `const CONTENDED_TEST_TIMEOUT_MS = 7_000;` and setting that satisfies this
 * predicate while re-authoring the figure — which is precisely the second-copy
 * shape the raw-number arm exists to refuse, and it compiles, so `tsc` is no
 * backstop either. **`sweepsTheTree` applies the both-halves discipline that
 * would close it** (resolve the specifier as well as match the call) and this
 * function deliberately does not, because the structural fix is real work and
 * the risk is a shadow nobody has a motive to write. **It is written down here
 * rather than left to be rediscovered, which is the whole of the difference
 * between a limit and a defect** — and if this class ever bites, the fix is
 * named above rather than needing to be invented.
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
    if (!sweepsTheTree(source, file, repoRoot)) continue;
    readings.push({ file, declares: declaresTheFloor(source) });
  }

  return readings;
}
