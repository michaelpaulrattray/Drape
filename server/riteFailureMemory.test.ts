/**
 * #2212 ITEM 4 — THE RITE REMEMBERS, SO THE SECOND REFUSAL IS NOT A SECOND GUESS.
 *
 * The deploy rite refused a one-JSON-file commit five times on 2026-10-10 and
 * nothing reached his Desk. Its refusal correctly named TWO roads and said it
 * could not tell them apart, and that is true of one run and false of two: the
 * failing arms went **1 → 7 → 6 → 1 → 3**, and `childProcessTimeout.ts` already
 * writes that down as the signature of starvation. The rite had all five
 * readings and discarded each at exit.
 *
 * Four halves, and the order is the order of what could go wrong:
 *
 * - the **reader** arms run against vitest's REAL output, captured at the bytes
 *   from driven runs on 2026-10-10 (vitest 4.1.11) rather than typed from
 *   memory — an assertion, a throw, a TIMEOUT, a suite that would not load, and
 *   a GREEN run as the negative control that the reader invents nothing;
 * - the **judgement** arms drive the verdict over the incident's own sequence,
 *   and include the two conclusions it must REFUSE to draw;
 * - the **store** arms use a real `mkdtemp` directory, because "survives a
 *   corrupt file" and "forgets on a pass" are properties of a disk;
 * - the **producer** arms read `scripts/deploy-rite.mts` and
 *   `scripts/lib/scriptGuards.mts` themselves, because a correct memory the
 *   rite never writes to is invariant 7's dead control. They are driven by
 *   SABOTAGE — each deletes the one line the reading cannot exist without and
 *   asserts the reading goes RED, so a green run means the arm can still fail
 *   (working law 2).
 *
 * ⚠ **WHY THIS SUITE IS NOT IN `PUSH_PATH_SUITES`, said rather than left as an
 * omission.** That list is for suites guarding a control the rite PERFORMS, and
 * this module is a control the rite performs — so the argument reaches it. It
 * is declined on one ground: this memory decides only WORDING. The refusal is
 * identical whether it works, misreads or throws (the reader is wrapped for
 * exactly that), so a red here can never be the difference between a push that
 * should fire and one that should not — which is the whole basis of that list.
 * Adding it would also put one more suite inside the single contended step this
 * card was filed about. `pnpm test` and the gate run it.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  EMPTY_MEMORY,
  MEMORY_RETENTION_HOURS,
  REMEMBERED_RUNS_PER_COMMIT,
  RITE_FAILURE_MEMORY_PATH,
  judgeAgainstMemory,
  judgeRepeatAlone,
  notePass,
  noteRefusal,
  pruneMemory,
  readFailedArms,
  recallMemory,
  runFromArms,
  suiteFilesOf,
  withRun,
  withoutCommit,
  type FailureMemoryFs,
  type RememberedRun,
} from "../scripts/lib/riteFailureMemory.mts";

const ROOT = process.cwd();
const riteSource = () => readFileSync(path.join(ROOT, "scripts", "deploy-rite.mts"), "utf8");
const guardsSource = () => readFileSync(path.join(ROOT, "scripts", "lib", "scriptGuards.mts"), "utf8");

/* ───────────────────────── the reader, on real output ───────────────────────── */

/**
 * CAPTURED, NOT COMPOSED. Driven on 2026-10-10 against vitest 4.1.11 in this
 * repository: two throwaway suites, one with a failing assertion, a passing arm
 * and a throwing arm, the other with one failing assertion. Trimmed to the
 * lines that carry the identities plus the summary, with vitest's own
 * indentation kept — the leading space on ` FAIL` is part of what is read.
 */
const REAL_MIXED_FAILURES = [
  " RUN  v4.1.11 C:/Users/Admin/drape-shift-seat-1-20261010-215120",
  "",
  " ❯ server/_scratch2212a.test.ts (3 tests | 2 failed) 5ms",
  "     × fails on an assertion 4ms",
  "     × fails by throw 0ms",
  " ❯ server/_scratch2212b.test.ts (1 test | 1 failed) 5ms",
  "     × also fails 4ms",
  "",
  "⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯",
  "",
  " FAIL  server/_scratch2212a.test.ts > scratch 2212 alpha > fails on an assertion",
  "AssertionError: expected 1 to be 2 // Object.is equality",
  "",
  " FAIL  server/_scratch2212a.test.ts > scratch 2212 alpha > fails by throw",
  "Error: boom 2212",
  "",
  " FAIL  server/_scratch2212b.test.ts > scratch 2212 beta > also fails",
  "AssertionError: expected 'a' to be 'b' // Object.is equality",
  "",
  " Test Files  2 failed (2)",
  "      Tests  3 failed | 1 passed (4)",
].join("\n");

/**
 * CAPTURED the same way: a 300 ms arm awaiting a 5 s promise, beside a suite
 * importing a module that does not exist. **The timeout and the card's whole
 * subject wear the FIRST shape**, and the load failure wears the second.
 */
const REAL_TIMEOUT_AND_LOAD_FAILURE = [
  " RUN  v4.1.11 C:/Users/Admin/drape-shift-seat-1-20261010-215120",
  "",
  " FAIL  server/_scratch2212d.test.ts [ server/_scratch2212d.test.ts ]",
  "Error: Cannot find module './_scratch2212-does-not-exist.ts' imported from"
    + " C:/Users/Admin/drape-shift-seat-1-20261010-215120/server/_scratch2212d.test.ts",
  "",
  "⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯",
  "",
  " FAIL  server/_scratch2212c.test.ts > scratch 2212 timeout > times out",
  "Error: Test timed out in 300ms.",
  "",
  " Test Files  2 failed (2)",
  "      Tests  1 failed (1)",
].join("\n");

/** CAPTURED: a passing run, which is the reader's negative control. */
const REAL_GREEN = [
  " RUN  v4.1.11 C:/Users/Admin/drape-shift-seat-1-20261010-215120",
  "",
  "",
  " Test Files  1 passed (1)",
  "      Tests  1 passed (1)",
  "   Start at  22:14:20",
  "   Duration  144ms (transform 20ms, setup 22ms, import 9ms, tests 1ms, environment 0ms)",
].join("\n");

describe("#2212 · reading the failing arms out of a real vitest run", () => {
  it("reads every failing arm's identity, across files, assertion and throw alike", () => {
    expect(readFailedArms(REAL_MIXED_FAILURES)).toEqual([
      "server/_scratch2212a.test.ts > scratch 2212 alpha > fails by throw",
      "server/_scratch2212a.test.ts > scratch 2212 alpha > fails on an assertion",
      "server/_scratch2212b.test.ts > scratch 2212 beta > also fails",
    ]);
  });

  it("reads a TIMEOUT — the shape the card was filed on — as an ordinary arm", () => {
    /* The point of the whole module: a timeout needs no special reading,
       because vitest reports it as a failing arm like any other. */
    expect(readFailedArms(REAL_TIMEOUT_AND_LOAD_FAILURE))
      .toContain("server/_scratch2212c.test.ts > scratch 2212 timeout > times out");
  });

  it("keeps a suite that would NOT LOAD as an identity, marked so it cannot collide", () => {
    /* A collection error reports `Tests  N passed` — the tally that has lied to
       this team before — and under contention a module resolution can fail on
       one run and resolve on the next. Dropping it would make exactly that
       movement invisible. */
    expect(readFailedArms(REAL_TIMEOUT_AND_LOAD_FAILURE))
      .toContain("server/_scratch2212d.test.ts <suite would not load>");
    expect(readFailedArms(REAL_TIMEOUT_AND_LOAD_FAILURE)).toHaveLength(2);
  });

  it("NEGATIVE CONTROL — a real green run yields no identities at all", () => {
    expect(readFailedArms(REAL_GREEN)).toEqual([]);
  });

  it("NEGATIVE CONTROL — prose about failure is not an arm", () => {
    /* `FAILURE`/`FAILED` share the prefix and must not be read; the contract is
       the token `FAIL` followed by whitespace at the start of a trimmed line. */
    const prose = [
      "FAILURE: the deploy did not land",
      "Failed Tests 3",
      "  3 tests FAILED on the machine",
      "the word FAIL appears in this sentence",
    ].join("\n");
    expect(readFailedArms(prose)).toEqual([]);
  });

  it("strips ANSI colour, which a real terminal run carries", () => {
    const esc = String.fromCharCode(27);
    const coloured = `${esc}[31m FAIL ${esc}[39m server/x.test.ts > d > a${esc}[0m`;
    expect(readFailedArms(coloured)).toEqual(["server/x.test.ts > d > a"]);
  });

  it("dedupes and sorts, so two runs of one set compare equal whatever the order", () => {
    const a = readFailedArms(" FAIL  b.test.ts > d > y\n FAIL  a.test.ts > d > x\n FAIL  b.test.ts > d > y");
    const b = readFailedArms(" FAIL  a.test.ts > d > x\n FAIL  b.test.ts > d > y");
    expect(a).toEqual(b);
  });

  it("an empty set and the `readable` flag are derived together and cannot disagree", () => {
    expect(runFromArms([], "2026-10-10T12:00:00.000Z").readable).toBe(false);
    expect(runFromArms(["a.test.ts > d > x"], "2026-10-10T12:00:00.000Z").readable).toBe(true);
  });
});

/* ───────────────────────────── the judgement ───────────────────────────── */

const at = (minute: number) => `2026-10-10T12:${String(minute).padStart(2, "0")}:00.000Z`;
const run = (arms: string[], minute: number): RememberedRun => runFromArms(arms, at(minute));

/** The incident's own five sets, as arm identities of the measured sizes. */
const armsOf = (count: number, label: string) =>
  Array.from({ length: count }, (_, index) => `server/${label}.test.ts > d > arm ${index + 1}`);

describe("#2212 · what two runs of one commit settle", () => {
  it("the FIRST refusal settles nothing and says to re-run — it must NOT read as the commit", () => {
    const verdict = judgeAgainstMemory({ current: run(armsOf(1, "scriptGuards"), 0), previous: [] });
    /* The dangerous answer here is `same-set`, which accuses the commit from a
       memory of nothing. */
    expect(verdict.kind).toBe("first-refusal");
    expect(verdict.sentence).toContain("RE-RUN THE RITE UNCHANGED");
  });

  it("a set that MOVED clears the commit — the incident's run 1 against run 2", () => {
    const verdict = judgeAgainstMemory({
      current: run(armsOf(7, "scriptGuards"), 10),
      previous: [run(armsOf(1, "scriptGuards"), 0)],
    });
    expect(verdict.kind).toBe("changed-set");
    expect(verdict.sentence).toContain("NOTHING IN THE COMMIT IS IMPLICATED");
    if (verdict.kind !== "changed-set") throw new Error("unreachable");
    expect(verdict.appeared).toHaveLength(6);
    expect(verdict.cleared).toHaveLength(0);
  });

  it("a set that REPEATS names the arms and, since #2248, ACCUSES NOBODY", () => {
    const same = armsOf(2, "scriptExitDiscipline");
    const verdict = judgeAgainstMemory({
      current: run(same, 10),
      previous: [run(same, 0), run(same, 5)],
    });
    expect(verdict.kind).toBe("same-set");
    expect(verdict.sentence).toContain("3 refusals");
    expect(verdict.sentence).toContain(same[0]!);
    /*
      ⚠ **THIS ARM READ *"accuses the commit"* UNTIL #2248 AND THAT WAS THE
      DEFECT.** A repeating set is what PERSISTENT contention looks like — the
      slowest arms fall first every single time — so the repeat alone cannot
      tell a breach from the machine. Measured: it said exactly that, in
      capitals, about commit `9e3217c2` on two refusals, and the same sha then
      shipped UNCHANGED on its third run. The sentence now names the control
      instead of a culprit, and the pin is the half that matters.
    */
    expect(verdict.sentence, "no accusation from a repeat alone").not.toContain("breached in the commit");
    expect(verdict.sentence).toContain("NOT YET EVIDENCE ABOUT THE COMMIT");
    expect(verdict.sentence, "and it names the control that does settle it").toContain("re-run ALONE");
  });

  it("it compares against EVERY remembered run, not only the most recent", () => {
    /*
      The arm that holds the design decision, and the ORDER here is the whole of
      it. The current set equals the run IMMEDIATELY BEFORE it and differs from
      an earlier one — so a reader looking one run back answers `same-set` and
      accuses a commit whose failure set has demonstrably moved, while a reader
      comparing against every remembered run answers `changed-set`.

      ⚠ This fixture was wrong when first written (current differing from the
      most recent run), and the sabotage that flips the reader to one-run-back
      passed it GREEN. The incident's own sequence 1 → 7 → 6 → 1 → 3 returns to
      a set it has held before, which is why this case is not hypothetical.
    */
    const one = armsOf(1, "scriptGuards");
    const two = armsOf(2, "scriptGuards");
    const verdict = judgeAgainstMemory({
      current: run(one, 20),
      previous: [run(two, 0), run(one, 10)],
    });
    expect(verdict.kind).toBe("changed-set");
    if (verdict.kind !== "changed-set") throw new Error("unreachable");
    /* And it names the run it disagrees with, not the one it matches. */
    expect(verdict.cleared).toHaveLength(1);
  });

  it("the whole measured sequence 1 → 7 → 6 → 1 → 3 reads as the machine from run 2 on", () => {
    const sequence = [1, 7, 6, 1, 3].map((count, index) => run(armsOf(count, "scriptGuards"), index * 5));
    const verdicts = sequence.map((current, index) =>
      judgeAgainstMemory({ current, previous: sequence.slice(0, index) }).kind);
    expect(verdicts).toEqual(["first-refusal", "changed-set", "changed-set", "changed-set", "changed-set"]);
  });

  it("REFUSES to conclude when this run's arms could not be read", () => {
    /* An empty current set against a remembered set would otherwise read as
       `changed-set` — a clean bill for a commit nobody measured. */
    const verdict = judgeAgainstMemory({
      current: runFromArms([], at(10)),
      previous: [run(armsOf(1, "scriptGuards"), 0)],
    });
    expect(verdict.kind).toBe("unreadable");
    expect(verdict.sentence).toContain("cannot be compared");
  });

  it("REFUSES to compare against remembered runs that were themselves unreadable", () => {
    /* An unreadable remembered run is not an empty set; treating it as one
       would read as a moved set and clear the commit on no evidence. */
    const verdict = judgeAgainstMemory({
      current: run(armsOf(1, "scriptGuards"), 10),
      previous: [runFromArms([], at(0)), runFromArms([], at(5))],
    });
    expect(verdict.kind).toBe("first-refusal");
  });

  it("names the lever that was measured to work, not a hope", () => {
    const verdict = judgeAgainstMemory({
      current: run(armsOf(3, "scriptGuards"), 10),
      previous: [run(armsOf(1, "scriptGuards"), 0)],
    });
    expect(verdict.sentence).toContain("VITEST_MAX_THREADS=2");
  });
});

/* ───────────────────── the store, on a real filesystem ───────────────────── */

const realFs: FailureMemoryFs = {
  mkdirSync: (p, options) => { mkdirSync(p, options); },
  writeFileSync: (p, data, options) => { writeFileSync(p, data, options); },
  readFileSync: (p) => readFileSync(p, "utf8"),
};

const scratch = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "rite-memory-2212-"));
  return { dir, file: path.join(dir, "guard-failures.json").replace(/\\/g, "/") };
};

const noteOn = (file: string, dir: string, sha: string, arms: string[], minute: number) =>
  noteRefusal({ sha, arms, at: new Date(at(minute)), path: file, directory: dir, fs: realFs });

describe("#2212 · the store, against a real directory", () => {
  it("a first refusal records, and a SECOND on different arms settles it as the machine", () => {
    const { dir, file } = scratch();
    try {
      expect(noteOn(file, dir, "abc1234", armsOf(1, "scriptGuards"), 0).kind).toBe("first-refusal");
      const second = noteOn(file, dir, "abc1234", armsOf(7, "scriptGuards"), 5);
      expect(second.kind).toBe("changed-set");

      /* And both runs are on the disk, so a THIRD refusal can still see run 1. */
      const stored = recallMemory(file, realFs);
      expect(stored.commits["abc1234"]).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the judgement is taken BEFORE this run is added — the order that cannot be got wrong", () => {
    const { dir, file } = scratch();
    try {
      /* If `noteRefusal` remembered first and judged after, a first refusal
         would compare with itself and read `same-set`: a confident accusation
         of the commit, from a memory of nothing. */
      expect(noteOn(file, dir, "abc1234", armsOf(2, "scriptGuards"), 0).kind).toBe("first-refusal");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("is keyed by COMMIT — another commit's refusals are never compared with this one", () => {
    const { dir, file } = scratch();
    try {
      noteOn(file, dir, "aaaaaaa", armsOf(1, "scriptGuards"), 0);
      expect(noteOn(file, dir, "bbbbbbb", armsOf(7, "scriptGuards"), 5).kind).toBe("first-refusal");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a PASS forgets the commit, so no verdict waits to be read about finished work", () => {
    const { dir, file } = scratch();
    try {
      noteOn(file, dir, "abc1234", armsOf(1, "scriptGuards"), 0);
      notePass({ sha: "abc1234", at: new Date(at(5)), path: file, directory: dir, fs: realFs });
      expect(recallMemory(file, realFs).commits["abc1234"]).toBeUndefined();
      /* And the next refusal of that commit starts over rather than inheriting. */
      expect(noteOn(file, dir, "abc1234", armsOf(1, "scriptGuards"), 10).kind).toBe("first-refusal");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a PASS with nothing to forget writes no file at all", () => {
    const { dir, file } = scratch();
    try {
      /* Most green rites have nothing remembered. A write there would create
         and re-touch a file recording nothing, on the one path whose whole
         output is a receipt. */
      notePass({ sha: "abc1234", at: new Date(at(0)), path: file, directory: dir, fs: realFs });
      expect(() => readFileSync(file, "utf8")).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a CORRUPT file reads as empty memory and never throws on the way to a refusal", () => {
    const { dir, file } = scratch();
    try {
      writeFileSync(file, "{ this is not json", { encoding: "utf8" });
      expect(recallMemory(file, realFs)).toEqual(EMPTY_MEMORY);
      expect(noteOn(file, dir, "abc1234", armsOf(1, "scriptGuards"), 0).kind).toBe("first-refusal");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("valid JSON of the WRONG SHAPE reads as empty memory too", () => {
    const { dir, file } = scratch();
    try {
      writeFileSync(file, JSON.stringify({ commits: "not an object" }), { encoding: "utf8" });
      expect(recallMemory(file, realFs)).toEqual(EMPTY_MEMORY);
      writeFileSync(file, JSON.stringify([1, 2, 3]), { encoding: "utf8" });
      expect(recallMemory(file, realFs)).toEqual(EMPTY_MEMORY);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a missing file reads as empty memory", () => {
    const { dir, file } = scratch();
    try {
      expect(recallMemory(file, realFs)).toEqual(EMPTY_MEMORY);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a filesystem that cannot be written does not throw — the refusal still prints", () => {
    const throwing: FailureMemoryFs = {
      mkdirSync: () => { throw new Error("EACCES"); },
      writeFileSync: () => { throw new Error("EACCES"); },
      readFileSync: () => { throw new Error("EACCES"); },
    };
    expect(() => noteRefusal({
      sha: "abc1234", arms: armsOf(1, "scriptGuards"), at: new Date(at(0)),
      path: "nowhere/x.json", directory: "nowhere", fs: throwing,
    })).not.toThrow();
    expect(() => notePass({
      sha: "abc1234", at: new Date(at(0)), path: "nowhere/x.json", directory: "nowhere", fs: throwing,
    })).not.toThrow();
  });
});

describe("#2212 · the store's own arithmetic", () => {
  it("keeps the most recent runs and no more", () => {
    let memory = EMPTY_MEMORY;
    for (let index = 0; index < REMEMBERED_RUNS_PER_COMMIT + 3; index += 1) {
      memory = withRun(memory, "abc1234", run(armsOf(index + 1, "scriptGuards"), index));
    }
    const kept = memory.commits["abc1234"]!;
    expect(kept).toHaveLength(REMEMBERED_RUNS_PER_COMMIT);
    /* The most recent, not the first — a cap that drops the newest run would
       freeze the memory at the first few refusals. */
    expect(kept[kept.length - 1]!.arms).toHaveLength(REMEMBERED_RUNS_PER_COMMIT + 3);
  });

  it("prunes a commit whose newest run is past the retention window, and keeps one inside it", () => {
    const now = new Date("2026-10-10T12:00:00.000Z");
    const hoursAgo = (hours: number) =>
      new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
    const memory = {
      commits: {
        stale: [runFromArms(["a.test.ts > d > x"], hoursAgo(MEMORY_RETENTION_HOURS + 1))],
        fresh: [runFromArms(["a.test.ts > d > x"], hoursAgo(1))],
      },
    };
    const pruned = pruneMemory(memory, now);
    expect(Object.keys(pruned.commits)).toEqual(["fresh"]);
  });

  it("an unparseable stamp is KEPT — a bad date is not evidence that a run is old", () => {
    const memory = { commits: { odd: [{ at: "not a date", readable: true, arms: ["a.test.ts > d > x"] }] } };
    expect(Object.keys(pruneMemory(memory, new Date("2026-10-10T12:00:00.000Z")).commits)).toEqual(["odd"]);
  });

  it("withoutCommit leaves every other commit alone", () => {
    const memory = withRun(withRun(EMPTY_MEMORY, "aaa", run(armsOf(1, "x"), 0)), "bbb", run(armsOf(1, "x"), 0));
    expect(Object.keys(withoutCommit(memory, "aaa").commits)).toEqual(["bbb"]);
    expect(withoutCommit(memory, "never-here")).toBe(memory);
  });
});

/* ───────────── the producers: a memory nobody writes to is dead ───────────── */

/**
 * Each arm names the one line the reading cannot exist without, deletes it from
 * a copy of the real source, and asserts the reading goes RED.
 *
 * ⚠ **THE ANCHOR'S UNIQUENESS IS ASSERTED, which `riteLock.test.ts`'s sabotage
 * helper does not do.** `String.replace` with a string pattern replaces the
 * FIRST occurrence only, so an anchor appearing twice leaves the second one
 * standing and the arm passes green having sabotaged nothing — the
 * satisfied-by-a-sibling shape this repository has paid for before.
 */
const sabotage = (source: string, line: string, where: string): string => {
  const occurrences = source.split(line).length - 1;
  if (occurrences === 0) throw new Error(`the sabotage anchor is not in ${where}: ${line}`);
  if (occurrences > 1) {
    throw new Error(`the sabotage anchor appears ${occurrences} times in ${where}, so deleting one proves nothing: ${line}`);
  }
  return source.replace(line, "/* sabotaged */");
};

describe("#2212 · the rite writes to the memory and prints its verdict (invariant 7)", () => {
  it("the refusal road calls noteRefusal and puts its sentence in the message a shift reads", () => {
    const source = riteSource();
    const reads = (text: string) =>
      /const memory = noteRefusal\(\{/.test(text) && /\$\{memory\.sentence\}/.test(text);

    expect(reads(source)).toBe(true);
    expect(reads(sabotage(source, "const memory = noteRefusal({", "deploy-rite.mts"))).toBe(false);
    expect(reads(sabotage(source, "${memory.sentence}", "deploy-rite.mts"))).toBe(false);
  });

  it("the refusal passes the arms the guards actually read, not the truncated `printed` tail", () => {
    /* `printed` is the last twelve lines and the FAIL lines are not reliably
       among them. A rite reading its arms from there would compare tails. */
    const source = riteSource();
    expect(source).toContain("arms: verdict.failedArms,");
    expect(source).not.toContain("arms: readFailedArms(verdict.printed)");
  });

  it("the PASS road calls notePass, so a fixed commit does not keep a verdict about it", () => {
    const source = riteSource();
    const reads = (text: string) => /notePass\(\{ sha, at: new Date\(\)/.test(text);

    expect(reads(source)).toBe(true);
    expect(reads(sabotage(source, "notePass({ sha, at: new Date()", "deploy-rite.mts"))).toBe(false);
  });

  it("the guards read the arms from the FULL output, which is the only place they exist", () => {
    const source = guardsSource();
    const reads = (text: string) => /failedArms: result\.status === 0 \? \[\] : armsOrNone\(result\.output\)/.test(text);

    expect(reads(source)).toBe(true);
    /*
      ⚠ **THE ANCHOR IS THE WHOLE ASSIGNMENT SINCE #2248, and the helper above
      is why it had to be.** `rerunArmsAlone` reads its own solo run the same
      way, so the bare `armsOrNone(result.output)` became the second occurrence
      of its own anchor — and `sabotage` THREW rather than passing green with
      nothing sabotaged, which is exactly the shape its docblock was written
      about. The fix is a unique anchor, never a looser assertion.
    */
    expect(reads(sabotage(
      source,
      "failedArms: result.status === 0 ? [] : armsOrNone(result.output)",
      "scriptGuards.mts",
    ))).toBe(false);
  });

  it("a broken reader cannot kill the push path — the arms read is wrapped", () => {
    const source = guardsSource();
    const reads = (text: string) => /const armsOrNone = \(output: string\): string\[\] => \{\s*try \{/.test(text);

    expect(reads(source)).toBe(true);
    expect(reads(sabotage(source, "  try {\n    return readFailedArms(output);", "scriptGuards.mts"))).toBe(false);
  });

  it("the blind road records nothing readable, so it accuses no commit", () => {
    /* A worktree that could not be made handed no suite a tree. Its verdict
       carries an empty arm list, which the judgement refuses to compare. */
    const source = guardsSource();
    expect(source).toContain("printed: message, failedArms: []");
  });
});

describe("#2212 · the memory file can never become a stageable byte", () => {
  it("lives under output/, which .gitignore ignores", () => {
    expect(RITE_FAILURE_MEMORY_PATH.startsWith("output/")).toBe(true);
    /* Derived from the real file rather than asserted: the whole reason this
       path was chosen is that the directory is already ignored (Janitor patrol
       #1), and a rule that moved would make the memory committable. */
    const ignore = readFileSync(path.join(ROOT, ".gitignore"), "utf8");
    expect(ignore.split(/\r?\n/).map((line) => line.trim())).toContain("output/");
  });

  it("is not tracked by git — the one reading that settles it", () => {
    const tracked = readFileSync(path.join(ROOT, ".gitignore"), "utf8");
    expect(tracked).not.toContain(`!${RITE_FAILURE_MEMORY_PATH}`);
  });
});

/* ─────────── #2248 · a repeat is not evidence until the arms run alone ─────────── */

/**
 * THE CONTROL THAT TELLS A PERSISTENT MACHINE FROM A BREACHED CONTRACT.
 *
 * #2212's reader fixed the moving-set case and created the standing-set case:
 * *a set that repeats is the commit* holds only while the interference is
 * TRANSIENT. Measured on commit `9e3217c2`, which changes one JSON file — two
 * refusals, the same two arms both times, the memory asserting *"a contract
 * breached in the commit"* and *"repair: fix those arms' subject"*, and then
 * the same sha shipping UNCHANGED on run three. Both arms `await
 * import("drizzle-orm/mysql-core")` inside the test body, so they are simply
 * the first to fall under load, every time. Alone at that commit: 141 of 141
 * passing in 50.2 s.
 *
 * The card's two refusals are pinned as hard as its requirement: not *stop
 * refusing* (the gate is right — invariant 7), and not *key on the word
 * timeout* (#2212's own header forbids it, with an ordinary assertion as the
 * worked example).
 */
describe("#2248 · suiteFilesOf — which files a set of arms names", () => {
  it("reads the file out of both shapes `readFailedArms` produces", () => {
    expect(suiteFilesOf([
      "server/moneySurfaceClassifier.test.ts > castProjection.ts really decides the price > arm",
      "server/moneySurfaceClassifier.test.ts > another describe > arm",
      "server/scriptGuards.test.ts <suite would not load>",
    ])).toEqual({
      files: ["server/moneySurfaceClassifier.test.ts", "server/scriptGuards.test.ts"],
      unparsed: [],
    });
  });

  it("⚠ an identity it cannot read goes to `unparsed` and is never DROPPED", () => {
    /*
      Dropping one would hand the caller a SUBSET, and a subset that passes
      would read as "alone-pass, so the machine" on evidence that never covered
      the whole refusal. That is the silent direction, so the reading keeps it.
    */
    const reading = suiteFilesOf(["server/x.test.ts > d > a", "Unhandled error in some worker"]);
    expect(reading.files).toEqual(["server/x.test.ts"]);
    expect(reading.unparsed).toEqual(["Unhandled error in some worker"]);
  });

  it("an arm with no describe separator is still its own file", () => {
    expect(suiteFilesOf(["server/x.test.ts"]).files).toEqual(["server/x.test.ts"]);
    expect(suiteFilesOf([]).files).toEqual([]);
  });
});

describe("#2248 · judgeRepeatAlone — the two readings, driven both ways", () => {
  const repeated = [
    "server/moneySurfaceClassifier.test.ts > d > castProjection.ts really decides the price",
    "server/moneySurfaceClassifier.test.ts > d > castingV2ViewRetry.ts really decides whether a replacement is still in flight",
  ];

  it("⚠ ALONE-PASS is the MACHINE, and the commit is explicitly cleared — the 9e3217c2 reading", () => {
    const verdict = judgeRepeatAlone({
      arms: repeated,
      runs: 2,
      alone: { ran: true, passed: true, arms: [], files: ["server/moneySurfaceClassifier.test.ts"] },
    });

    expect(verdict.kind).toBe("alone-passes");
    expect(verdict.sentence).toContain("NOTHING IN THE COMMIT IS IMPLICATED");
    expect(verdict.sentence, "and it names the lever that actually helps").toContain("VITEST_MAX_THREADS=2");
    expect(verdict.sentence, "never a script to go and fix").not.toContain("fix those arms' subject");
  });

  it("⚠ ALONE-FAIL is the COMMIT — the control must still convict, or it is no control", () => {
    /*
      Without this arm the reader could answer `alone-passes` for everything and
      the arm above would pass. A genuinely breaching script fails with nothing
      competing for the box, and the rite must still send the shift to fix it.
    */
    const verdict = judgeRepeatAlone({
      arms: repeated,
      runs: 2,
      alone: { ran: true, passed: false, arms: repeated, files: ["server/moneySurfaceClassifier.test.ts"] },
    });

    expect(verdict.kind).toBe("alone-fails");
    expect(verdict.sentence).toContain("a contract breached in the commit");
    expect(verdict.sentence).toContain("fix those arms' subject in the commit");
    expect(verdict.kind === "alone-fails" && verdict.stillFailing).toEqual(repeated);
    expect(verdict.kind === "alone-fails" && verdict.alsoFailing).toEqual([]);
  });

  it("a solo failure on DIFFERENT arms is still the commit, and says it is not the same arm", () => {
    const other = ["server/scriptGuards.test.ts > d > a worktree it could not make"];
    const verdict = judgeRepeatAlone({
      arms: repeated,
      runs: 3,
      alone: { ran: true, passed: false, arms: other, files: ["server/moneySurfaceClassifier.test.ts"] },
    });

    expect(verdict.kind).toBe("alone-fails");
    expect(verdict.kind === "alone-fails" && verdict.stillFailing).toEqual([]);
    expect(verdict.kind === "alone-fails" && verdict.alsoFailing).toEqual(other);
    expect(verdict.sentence, "the shift is told to read the solo run first").toContain("NONE of the repeated arms");
  });

  it("⚠ a solo run that FAILED UNREADABLY concludes nothing — a dead runner is not a failed arm", () => {
    const verdict = judgeRepeatAlone({
      arms: repeated,
      runs: 2,
      alone: { ran: true, passed: false, arms: [], files: ["server/moneySurfaceClassifier.test.ts"] },
    });

    expect(verdict.kind).toBe("alone-unresolved");
    expect(verdict.sentence).toContain("COULD NOT BE READ");
    expect(verdict.sentence, "and it accuses nobody").not.toContain("breached in the commit");
  });

  it("⚠ a control that could not be TAKEN settles nothing, and hands over the command", () => {
    const verdict = judgeRepeatAlone({
      arms: repeated,
      runs: 2,
      alone: { ran: false, why: "a worktree of the commit could not be made: fatal: not a git repository" },
    });

    expect(verdict.kind).toBe("alone-unresolved");
    expect(verdict.sentence).toContain("BOTH roads above stand");
    /* The by-hand command is derived from the arms, so a shift is never left to
       work out which suite the refusal was about. */
    expect(verdict.sentence).toContain("npx vitest run server/moneySurfaceClassifier.test.ts");
    expect(verdict.sentence).not.toContain("breached in the commit");
  });

  it("⚠ NOT keyed on the word timeout — #2212's own refusal, pinned here too", () => {
    /*
      The trap the card names second. An ordinary assertion that only fails
      under contention must read exactly as a timeout does, or a shift goes
      hunting a broken hook — which is the measured 2026-10-10 case
      (`server/atlasCommitHook.test.ts:367`, a real `git commit` giving up).
      The reading is the SOLO RUN's exit status and the error text never enters
      it, so the two cases are indistinguishable to this judge by construction.
    */
    const assertionArm = ["server/atlasCommitHook.test.ts > d > the hook stages the map"];
    const asMachine = judgeRepeatAlone({
      arms: assertionArm,
      runs: 2,
      alone: { ran: true, passed: true, arms: [], files: ["server/atlasCommitHook.test.ts"] },
    });
    const asCommit = judgeRepeatAlone({
      arms: assertionArm,
      runs: 2,
      alone: { ran: true, passed: false, arms: assertionArm, files: ["server/atlasCommitHook.test.ts"] },
    });

    expect(asMachine.kind).toBe("alone-passes");
    expect(asCommit.kind).toBe("alone-fails");
    /*
      ⚠ **TWO NARROWINGS, BOTH FOUND BY THIS ARM FIRING ON THINGS IT SHOULD NOT
      HAVE.**

      **The comments are stripped**: these modules QUOTE `Test timed out in
      30000ms` at length, because that is the measurement they record, and a
      reader keyed on the wording is a thing in the CODE — the only place it can
      do harm. Testing the prose made the arm red the moment the defect was
      written up, which is a guard punishing the write-up rather than the
      behaviour.

      **And the population is the two READER modules, not `deploy-rite.mts`.**
      The rite legitimately holds the word three ways: `setTimeout`,
      `fetchWithClearedTimeout` for the health probe, and — the one that
      matters — the refusal's own English, *"a guard suite failed on the machine
      rather than on the commit — a timeout under load"*. That sentence is the
      road being EXPLAINED to a person, which is the opposite of a classifier
      keying on it. Holding the printer to this rule would forbid the rite from
      describing the very thing it is diagnosing.
    */
    const codeOnly = (text: string) => text
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^\s*\/\/.*$/gm, " ");
    /*
      ⚠ **AND IT FORBIDS A COMPARISON, NOT THE WORD — the third narrowing, and
      the arm found this one too.** `judgeAgainstMemory`'s own `changed-set`
      sentence ends *"It does NOT have to arrive as a timeout"*, which is the
      reading being EXPLAINED to a person in the one place that explanation
      belongs. Forbidding the word outright would delete the sentence that tells
      a shift this is not a timeout rule. What must never exist is a branch
      taken on the wording: a `.includes`, an `.indexOf`, or a regex test.
    */
    const keysOnWording = (code: string) =>
      /(?:includes|indexOf|startsWith|endsWith)\(\s*["'`][^"'`]*tim(?:ed |e)?out/i.test(code)
      || /\/[^/\n]*tim(?:ed |e)?out[^/\n]*\/[a-z]*\s*\.\s*test\s*\(/i.test(code)
      || /\.\s*match\s*\(\s*\/[^/\n]*tim(?:ed |e)?out/i.test(code);
    /* The instrument gets its positive control before its verdict counts
       (working law 2) — all three shapes, and one that must NOT fire. */
    expect(keysOnWording('if (output.includes("Test timed out")) return "machine";')).toBe(true);
    expect(keysOnWording('if (/timed out/i.test(output)) return "machine";')).toBe(true);
    expect(keysOnWording('const hit = output.match(/timeout/);')).toBe(true);
    expect(keysOnWording('sentence: `it does NOT have to arrive as a timeout`')).toBe(false);

    for (const file of [
      path.join(ROOT, "scripts", "lib", "riteFailureMemory.mts"),
      path.join(ROOT, "scripts", "lib", "scriptGuards.mts"),
    ]) {
      expect(
        keysOnWording(codeOnly(readFileSync(file, "utf8"))),
        `no reader in ${path.basename(file)} branches on the wording of a timeout`,
      ).toBe(false);
    }
  });
});

describe("#2248 · the rite TAKES the control, and only on a repeat (invariant 7)", () => {
  it("the refusal road re-runs the arms alone when the memory says `same-set`", () => {
    const source = riteSource();
    const reads = (text: string) =>
      /if \(memory\.kind === "same-set"\)/.test(text)
      && /judgeRepeatAlone\(\{/.test(text)
      && /alone: rerunArmsAlone\(/.test(text);

    expect(reads(source)).toBe(true);
    expect(reads(sabotage(source, 'if (memory.kind === "same-set") {', "deploy-rite.mts"))).toBe(false);
    expect(reads(sabotage(source, "alone: rerunArmsAlone(", "deploy-rite.mts"))).toBe(false);
  });

  it("⚠ its sentence reaches the message a shift reads, or the control is spent for nothing", () => {
    const source = riteSource();
    const reads = (text: string) => /AND WHAT THOSE ARMS DID ON THEIR OWN \(#2248\)/.test(text)
      && /\$\{repeat\}/.test(text);

    expect(reads(source)).toBe(true);
    expect(reads(sabotage(source, "${repeat}", "deploy-rite.mts"))).toBe(false);
  });

  it("⚠ the gate is UNCHANGED — the refusal still fires on both roads", () => {
    /*
      The card's first refusal: not "stop refusing". The control buys the
      DIAGNOSIS and never the push, so `die` is reached whatever the solo run
      said — there is no road out of the refusal, and no branch on `repeat`
      except whether its sentence is printed.
    */
    const source = riteSource();
    /* ⚠ `if (!verdict.ok) {` appears THREE times in this file — the atlas, the
       capability and the guard steps each have one — so slicing on it spanned
       nine `die(` calls and the arm failed for the wrong reason. The anchor is
       the guard step's own call, which is unique and asserted so. */
    const opens = "const verdict = runScriptGuardsOnCommit(";
    const closes = "notePass({ sha, at: new Date()";
    expect(source.split(opens), "the opening anchor must be unique").toHaveLength(2);
    expect(source.split(closes), "the closing anchor must be unique").toHaveLength(2);
    const guardStep = source.slice(source.indexOf(opens), source.indexOf(closes));
    expect(guardStep, "the step was sliced").not.toBe("");
    expect(guardStep, "and the slice is the right step").toContain("judgeRepeatAlone({");
    /* ⚠ The STEP holds two refusals — the blind road (`couldNotRun`) and this
       one — so the subject is the `!verdict.ok` branch alone. Sliced once more
       rather than counted loosely: the arm is about there being no road out of
       THIS refusal, and two `die(` calls in one slice would satisfy a sloppier
       count either way. */
    const refusal = guardStep.slice(guardStep.indexOf("if (!verdict.ok) {"));
    expect(refusal.split("die(")).toHaveLength(2);
    expect(refusal, "no early return past the refusal").not.toContain("return;");
    expect(refusal).not.toContain("process.exit(0)");
  });

  it("the solo re-run is a worktree of the COMMIT, never the shift's own directory", () => {
    /* `riteWorktree.mts`' own reason: the shared tree carries untracked
       disposables, so a control run there answers about a tree nobody pushes. */
    const guards = guardsSource();
    const alone = guards.slice(guards.indexOf("export const rerunArmsAlone ="));
    expect(alone, "the function was sliced").not.toBe("");
    expect(alone).toContain("inWorktreeOf(root, commit,");
  });

  it("⚠ it refuses a PARTIAL re-run rather than answering a narrower question", () => {
    const guards = guardsSource();
    const alone = guards.slice(guards.indexOf("export const rerunArmsAlone ="));
    expect(alone).toContain("reading.unparsed.length > 0");
    expect(alone).toContain("ran: false");
  });
});
