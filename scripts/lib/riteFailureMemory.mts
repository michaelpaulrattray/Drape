/**
 * A CHANGING FAILURE SET SETTLES THE QUESTION THE RITE CANNOT ANSWER (#2212 item 4).
 *
 * # The question, and why one run can never answer it
 *
 * The deploy rite's script-guard step refuses on a vitest exit of 1, and its
 * own refusal says — correctly, since #967 — that this is ONE OF TWO THINGS and
 * that it cannot tell them apart:
 *
 *   · a script in the commit breached a contract, or
 *   · a guard suite failed on the MACHINE rather than on the commit.
 *
 * Both arrive identically: an exit of 1 naming a test file. So the refusal
 * names two roads and leaves the shift to re-run and compare by eye. On
 * 2026-10-10 a shift did that **five times on one commit that changes a single
 * JSON file**, and nothing on the record kept what it had seen:
 *
 *   | run | failed arms |
 *   |-----|-------------|
 *   | 1   | 1           |
 *   | 2   | 7           |
 *   | 3   | 6           |
 *   | 4   | 1           |
 *   | 5   | 3           |
 *
 * **A DIFFERENT SET EVERY RUN.** `server/testing/childProcessTimeout.ts`
 * already writes that sentence down as the signature of starvation: *"a
 * DIFFERENT set of arms each run, which is the tell that this is starvation and
 * not a broken assertion."* The rite had every one of those readings and threw
 * each away at exit, so it asked the shift to be the memory.
 *
 * **This is that memory, and nothing more.** It does not classify a single run,
 * it does not time anything, and it does not change what the rite refuses — the
 * refusal is UNCHANGED either way (invariant 7: a blind gate refuses). What it
 * adds is a sentence the rite could not previously say: *the set moved between
 * two runs of this same commit, so the commit is not implicated.*
 *
 * # Why the SET and not the error text
 *
 * ⚠ **The relay's reading of 2026-10-10 is the reason this keys on identities
 * and never on `Test timed out`.** On the sixth refused run that day the red was
 * not a timeout at all: `server/atlasCommitHook.test.ts:367` failed an ordinary
 * ASSERTION — `expect(result.status).toBe(0)` got `1`, because a real `git
 * commit` driven inside its temporary repository had the atlas hook give up
 * under the same contention. That suite passes standalone, 16 of 16. **A shift
 * reading that red would go looking for a broken hook**, and a reader keyed on
 * timeout wording would have agreed with it.
 *
 * Comparing the SET of failing arms is blind to why each one failed, which is
 * exactly the property that case needs: an assertion that only fails under load
 * moves in and out of the set run to run, and that movement is the finding.
 *
 * # What it refuses to conclude
 *
 * ⚠ **AN UNREADABLE SET IS NEVER COMPARED.** If the runner printed no `FAIL`
 * line — it died before reporting, its output was truncated, a future vitest
 * renamed the line — then the current set is EMPTY, and an empty set measured
 * against a remembered empty set reads as *identical twice*, which is this
 * module's one confident wrong answer and it points at the commit. So an
 * unreadable reading is recorded as unreadable, judged as unreadable, and
 * settles nothing. Law 2's direction: the instrument that cannot see says so.
 *
 * # The store
 *
 * Per checkout, under `output/` (gitignored — `.gitignore`, Janitor patrol #1),
 * beside the receipts, which is where a reader chasing a refusal already is.
 * Keyed by COMMIT SHA, because "the same arms failed again" is only a finding
 * about the same tree; a different commit is a different question. A PASS
 * forgets the commit, and entries age out, so the file cannot grow without
 * bound or carry a verdict about a tree nobody is pushing any more.
 *
 * This is a MODULE (imported by the rite and by its suite) and it never exits.
 */

/**
 * WHERE THE MEMORY LIVES. Same argument as `RITE_LOCK_PATH`, same directory.
 */
export const RITE_FAILURE_MEMORY_PATH = "output/deploy-rite-guard-failures.json";

/** How many runs of one commit are kept. Five is the measured incident's length. */
export const REMEMBERED_RUNS_PER_COMMIT = 5;

/** How long a commit's entry survives before it is pruned, in hours. */
export const MEMORY_RETENTION_HOURS = 72;

/**
 * One refused run's reading.
 *
 * `arms` is empty EXACTLY WHEN `readable` is false — the two are not
 * independent, and keeping both is what stops an empty set being read as a
 * verdict (see "What it refuses to conclude" above).
 */
export type RememberedRun = {
  at: string;
  /** Could the failing arms be read out of the runner's output at all? */
  readable: boolean;
  /** The failing arm identities, sorted and deduped. Empty when unreadable. */
  arms: string[];
};

export type FailureMemory = {
  /** Commit sha → the runs of it that have been refused, oldest first. */
  commits: Record<string, RememberedRun[]>;
};

export const EMPTY_MEMORY: FailureMemory = { commits: {} };

/**
 * READ THE FAILING ARM IDENTITIES OUT OF A VITEST RUN.
 *
 * Measured at the bytes against vitest 4.1.11 on 2026-10-10, both shapes
 * driven rather than recalled:
 *
 *     FAIL  server/x.test.ts > describe name > the arm        ← a failing arm
 *     FAIL  server/x.test.ts [ server/x.test.ts ]             ← the file would not LOAD
 *
 * A timeout wears the first shape (`Error: Test timed out in 300ms.` under it),
 * so no separate reading is needed for the case the card was filed on.
 *
 * ⚠ **The bracketed shape is kept as an identity rather than dropped.** A suite
 * that fails to collect reports `Tests  N passed` — the tally that has lied to
 * this team before — and under contention a module resolution can fail on one
 * run and succeed on the next. Dropping it would make exactly that movement
 * invisible. It is recorded as the file plus a marker, so it can never collide
 * with a real arm name.
 *
 * Returns the sorted, deduped identities. An EMPTY array means nothing was
 * read, which the caller must treat as unreadable rather than as "no failures".
 */
export const readFailedArms = (output: string): string[] => {
  const plain = output.replace(new RegExp(String.fromCharCode(27) + "\\[[0-9;]*m", "g"), "");
  const found = new Set<string>();
  for (const raw of plain.split(/\r?\n/)) {
    const line = raw.trim();
    const match = /^FAIL\s+(.+)$/.exec(line);
    if (!match) continue;
    const subject = match[1]!.trim();
    /* The collection-error shape: `server/x.test.ts [ server/x.test.ts ]`. The
       bracket is stripped and replaced with a marker of our own, so a suite
       that would not load and an arm literally named `[ … ]` cannot be
       confused for one another. */
    const bracketed = /^(\S+)\s+\[\s*.*\s*\]$/.exec(subject);
    if (bracketed) {
      found.add(`${bracketed[1]!.replace(/\\/g, "/")} <suite would not load>`);
      continue;
    }
    found.add(subject.replace(/\\/g, "/"));
  }
  return [...found].sort();
};

/**
 * One run's reading, ready to be remembered.
 *
 * `readable` is derived here and in one place, so no caller can construct the
 * contradictory state (unreadable with arms, or readable with none) that the
 * judgement below depends on being impossible.
 */
export const runFromArms = (arms: string[], at: string): RememberedRun =>
  ({ at, readable: arms.length > 0, arms: [...new Set(arms)].sort() });

export type MemoryVerdict =
  /** Nothing on record for this commit — the rite still cannot tell the two apart. */
  | { kind: "first-refusal"; sentence: string }
  /** This run's arms could not be read, so no comparison is possible. */
  | { kind: "unreadable"; sentence: string }
  /** Every remembered run failed on the same arms. The commit IS implicated. */
  | { kind: "same-set"; sentence: string; arms: string[]; runs: number }
  /** A remembered run failed on different arms. The MACHINE is implicated. */
  | {
      kind: "changed-set";
      sentence: string;
      /** Failing now and not on the run compared against. */
      appeared: string[];
      /** Failing on that run and not now. */
      cleared: string[];
      runs: number;
    };

const sameSet = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * JUDGE THIS RUN AGAINST WHAT IS REMEMBERED OF THE SAME COMMIT.
 *
 * ⚠ It compares against EVERY remembered run, not only the most recent, and
 * that is deliberate. The incident's own sets were 1 → 7 → 6 → 1 → 3 arms: a
 * reader looking one run back would have called runs 3→4 a change and run 4
 * against run 1 nothing at all. **Any** remembered run with a different set
 * proves the set moves on this commit, which is the whole finding.
 *
 * Unreadable remembered runs are skipped rather than treated as an empty set —
 * for the reason in this file's header.
 */
export const judgeAgainstMemory = (input: {
  current: RememberedRun;
  previous: RememberedRun[];
}): MemoryVerdict => {
  const { current } = input;
  const previous = input.previous.filter((run) => run.readable);

  if (!current.readable) {
    return {
      kind: "unreadable",
      sentence:
        "the failing arms could not be read out of the runner's output, so this run cannot be compared with any other."
        + " The two roads above stand exactly as written; nothing here narrows them.",
    };
  }
  if (previous.length === 0) {
    return {
      kind: "first-refusal",
      sentence:
        `this is the first readable refusal of this commit on record (${current.arms.length} arm(s) failing).`
        + " The set is now remembered: RE-RUN THE RITE UNCHANGED and the next refusal will say which of the two roads it is,"
        + " because a set that moves between two runs of one commit is the machine and a set that repeats is the commit.",
    };
  }

  const runs = previous.length + 1;
  const moved = previous.find((run) => !sameSet(run.arms, current.arms));
  if (moved) {
    const appeared = current.arms.filter((arm) => !moved.arms.includes(arm));
    const cleared = moved.arms.filter((arm) => !current.arms.includes(arm));
    return {
      kind: "changed-set",
      appeared,
      cleared,
      runs,
      sentence:
        `⚠ THE FAILURE SET MOVED BETWEEN TWO RUNS OF THIS SAME COMMIT — so this is the SECOND road above and`
        + ` NOTHING IN THE COMMIT IS IMPLICATED.`
        + ` ${runs} refusal(s) of this commit are on record; one of them failed on ${moved.arms.length} arm(s)`
        + ` against ${current.arms.length} now`
        + (appeared.length > 0 ? `\n    failing now and not then: ${appeared.join(", ")}` : "")
        + (cleared.length > 0 ? `\n    failing then and not now: ${cleared.join(", ")}` : "")
        + `\n    A different set of arms each run is starvation under load, which`
        + ` server/testing/childProcessTimeout.ts names as exactly this tell. It does NOT have to arrive as a timeout:`
        + ` an arm driving a real git commit can fail an ordinary assertion when the process it spawns gives up.`
        + `\n    repair: nothing in the commit. Hold vitest to fewer workers for this run —`
        + ` VITEST_MAX_THREADS=2 VITEST_MIN_THREADS=1 npx tsx scripts/deploy-rite.mts — which is the lever measured on`
        + ` 2026-10-10 (two runs at two workers, two passes; eight at the default, eight refusals).`,
    };
  }

  return {
    kind: "same-set",
    arms: current.arms,
    runs,
    sentence:
      `the same ${current.arms.length} arm(s) have failed on every one of ${runs} refusals of this commit.`
      + ` ⚠ THAT IS NOT YET EVIDENCE ABOUT THE COMMIT (#2248) — it says only that the interference, if`
      + ` there is any, is PERSISTENT rather than transient, and from here a repeat and a breach look`
      + ` identical.`
      + `\n    ${current.arms.join("\n    ")}`
      + `\n    THE CONTROL THAT SETTLES IT IS BELOW: those arms re-run ALONE, outside the concurrent run.`,
  };
};

/**
 * The filesystem, injected — the four calls this makes, so a fake is four lines
 * and a real run passes `node:fs` straight through. Same shape as `RiteLockFs`,
 * and deliberately a SEPARATE type rather than a shared one: the lock needs an
 * exclusive `flag` honoured and this needs ordinary writes, so one type would
 * promise each caller something the other does not need.
 */
export type FailureMemoryFs = {
  mkdirSync: (path: string, options: { recursive: true }) => void;
  writeFileSync: (path: string, data: string, options: { encoding: "utf8" }) => void;
  readFileSync: (path: string, encoding: "utf8") => string;
};

/**
 * READ THE STORE, AND NEVER THROW ON THE WAY TO A REFUSAL MESSAGE.
 *
 * ⚠ A missing, truncated or hand-edited file reads as EMPTY MEMORY rather than
 * as an error. This sits on the path of a refusal that is already being
 * printed, and a memory that can abort the rite with a JSON parse error would
 * make a diagnosis aid into a new way to fail — which is the shape #2212 is
 * about ("a refusal that makes the next refusal more likely is the worst shape
 * a gate can have"). An empty memory simply gives `first-refusal`.
 */
export const recallMemory = (path: string, fs: FailureMemoryFs): FailureMemory => {
  let raw: string;
  try {
    raw = fs.readFileSync(path, "utf8");
  } catch {
    return { commits: {} };
  }
  try {
    const parsed = JSON.parse(raw) as FailureMemory;
    if (parsed === null || typeof parsed !== "object" || typeof parsed.commits !== "object" || parsed.commits === null) {
      return { commits: {} };
    }
    const commits: Record<string, RememberedRun[]> = {};
    for (const [sha, runs] of Object.entries(parsed.commits)) {
      if (!Array.isArray(runs)) continue;
      commits[sha] = runs
        .filter((run): run is RememberedRun =>
          run !== null && typeof run === "object"
          && typeof (run as RememberedRun).at === "string"
          && typeof (run as RememberedRun).readable === "boolean"
          && Array.isArray((run as RememberedRun).arms))
        .map((run) => ({ at: run.at, readable: run.readable, arms: run.arms.filter((arm) => typeof arm === "string") }));
    }
    return { commits };
  } catch {
    return { commits: {} };
  }
};

/** Drop commits whose newest remembered run is older than the retention window. */
export const pruneMemory = (memory: FailureMemory, now: Date, retentionHours = MEMORY_RETENTION_HOURS): FailureMemory => {
  const floor = now.getTime() - retentionHours * 60 * 60 * 1000;
  const commits: Record<string, RememberedRun[]> = {};
  for (const [sha, runs] of Object.entries(memory.commits)) {
    if (runs.length === 0) continue;
    const newest = Math.max(...runs.map((run) => {
      const stamp = Date.parse(run.at);
      /* An unparseable stamp is kept rather than silently expired: a bad date
         is not evidence that the run is old. */
      return Number.isFinite(stamp) ? stamp : now.getTime();
    }));
    if (newest >= floor) commits[sha] = runs;
  }
  return { commits };
};

/** Add this run to the commit's history, keeping the most recent few. */
export const withRun = (memory: FailureMemory, sha: string, run: RememberedRun): FailureMemory => {
  const runs = [...(memory.commits[sha] ?? []), run].slice(-REMEMBERED_RUNS_PER_COMMIT);
  return { commits: { ...memory.commits, [sha]: runs } };
};

/** Forget a commit — called on a PASS, where the question has been answered. */
export const withoutCommit = (memory: FailureMemory, sha: string): FailureMemory => {
  if (!(sha in memory.commits)) return memory;
  const commits = { ...memory.commits };
  delete commits[sha];
  return { commits };
};

/**
 * WRITE THE STORE, AND NEVER THROW ON THE WAY TO A REFUSAL MESSAGE.
 *
 * Same argument as `recallMemory`: a write that cannot land must not turn a
 * diagnosable refusal into an unhandled error. It returns whether it landed, so
 * a caller that wants to say so can; the rite does not, because a shift chasing
 * a refused push does not need to hear about a file it never asked for.
 */
export const persistMemory = (
  path: string,
  directory: string,
  memory: FailureMemory,
  fs: FailureMemoryFs,
): boolean => {
  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path, `${JSON.stringify(memory, null, 2)}\n`, { encoding: "utf8" });
    return true;
  } catch {
    return false;
  }
};

/**
 * THE WHOLE ACT ON A REFUSAL: recall, judge, remember, and hand back the
 * sentence for the refusal message.
 *
 * One function so the ORDER cannot be got wrong by a caller: the judgement is
 * taken against what was remembered BEFORE this run is added. Adding first
 * would compare the run with itself and read `same-set` on every first refusal
 * — a confident accusation of the commit, from a memory of nothing.
 */
export const noteRefusal = (input: {
  sha: string;
  /** Read with `readFailedArms` by whoever owns the runner's full output. */
  arms: string[];
  at: Date;
  path?: string;
  directory?: string;
  fs: FailureMemoryFs;
}): MemoryVerdict => {
  const path = input.path ?? RITE_FAILURE_MEMORY_PATH;
  const directory = input.directory ?? path.slice(0, Math.max(0, path.lastIndexOf("/")));
  const run = runFromArms(input.arms, input.at.toISOString());
  const recalled = pruneMemory(recallMemory(path, input.fs), input.at);
  const verdict = judgeAgainstMemory({ current: run, previous: recalled.commits[input.sha] ?? [] });
  persistMemory(path, directory, withRun(recalled, input.sha, run), input.fs);
  return verdict;
};

/**
 * THE WHOLE ACT ON A PASS: forget this commit.
 *
 * A commit that passed has had its question answered, and a remembered refusal
 * of a tree that now passes is a verdict waiting to be read about work that is
 * finished. It also keeps the honest case honest: a shift that fixes a real
 * breach and re-commits gets a new sha anyway, and the old one ages out.
 */
export const notePass = (input: {
  sha: string;
  at: Date;
  path?: string;
  directory?: string;
  fs: FailureMemoryFs;
}): void => {
  const path = input.path ?? RITE_FAILURE_MEMORY_PATH;
  const directory = input.directory ?? path.slice(0, Math.max(0, path.lastIndexOf("/")));
  const recalled = recallMemory(path, input.fs);
  const next = withoutCommit(pruneMemory(recalled, input.at), input.sha);
  /* ⚠ IT WRITES ONLY WHEN SOMETHING WAS ACTUALLY FORGOTTEN. This runs on every
     green rite, and most green rites have nothing to forget — a write there
     would create and re-touch a file that records nothing, on the one path
     whose whole output is a receipt. Both operations above only ever REMOVE
     commits, so a key count that did not move means nothing changed. */
  if (Object.keys(next.commits).length === Object.keys(recalled.commits).length) return;
  persistMemory(path, directory, next, input.fs);
};

/* ───────────────────────────────────────────────────────────────────────────
   A REPEATING SET IS NOT EVIDENCE UNTIL THE ARMS ARE RUN ALONE (#2248)
   ─────────────────────────────────────────────────────────────────────────── */

/**
 * ⚠ **THE READING ABOVE FIXED THE MOVING-SET CASE AND CREATED THE
 * STANDING-SET CASE.**
 *
 * `judgeAgainstMemory` reads *a set that moved is the machine; a set that
 * repeats is the commit*. The first half holds. The second half holds only
 * while the machine's interference is TRANSIENT — starvation landing on
 * different arms each run, which is `server/testing/childProcessTimeout.ts`'s
 * own observed tell. **It does not hold when the interference is PERSISTENT**,
 * because then the same arms fail every single time and a repeat proves
 * nothing at all.
 *
 * **Measured 2026-10-11 on commit `9e3217c2`, which changes ONE JSON file**
 * (`server/crew/crew-briefing.json`, the Desk edition):
 *
 *   | run | verdict | failing arms |
 *   |-----|---------|--------------|
 *   | 1 · 03:04Z | REFUSED | two arms of `server/moneySurfaceClassifier.test.ts` |
 *   | 2 · 03:19Z | REFUSED | **the same two, identically** |
 *   | 3 · 03:35Z | **OK**, deployed | none |
 *
 * On run 2 the memory said, in capitals, *"THE SAME 2 ARM(S) HAVE FAILED ON
 * EVERY ONE OF 2 REFUSALS OF THIS COMMIT — so this is the FIRST road above: a
 * contract breached in the commit"*, and *"repair: fix those arms' subject in
 * the commit"*. **There was nothing to fix**: between runs 2 and 3 nothing was
 * committed and nothing was edited, and the same sha shipped. Both failures
 * were `Test timed out in 30000ms` on the two arms that `await
 * import("drizzle-orm/mysql-core")` inside the test body, so a cold dependency
 * transform is charged to the arm's own clock — which makes them the FIRST two
 * arms to fall under load, every time. Driven alone at that exact commit:
 * **141 of 141 passing in 50.2 s, 45.3 s of it transform.**
 *
 * # What it must not conclude, and the second one is the trap
 *
 * ⚠ **NOT "stop refusing".** The gate is right and is UNCHANGED either way
 * (invariant 7: a guard that could not pass still does not push). Only the
 * DIAGNOSIS was wrong, which is the narrowing #967 already made once.
 *
 * ⚠ **NOT "key on the word timeout".** #2212's own header forbids it with a
 * worked example: an ordinary assertion (`expect(result.status).toBe(0)`) failed
 * under the same contention because a real `git commit` driven inside a
 * temporary repository had the atlas hook give up. A reader keyed on timeout
 * wording would have sent a shift hunting a broken hook.
 *
 * # What actually tells them apart
 *
 * **A repeating set is evidence about the commit only if those arms are
 * incapable of passing on this machine right now.** That is a question the rite
 * can ask cheaply and did not: re-run the failing arms ALONE, outside the
 * concurrent run, after the second refusal. Alone-pass is the machine;
 * alone-fail is the commit. One suite, about 50 s here, and it is the control a
 * shift ends up running by hand anyway.
 */

/** A suite file reading taken off a set of arm identities. */
export type SuiteFileReading = {
  /** The suite files to re-run, sorted and deduped. */
  files: string[];
  /** Arm identities whose file could not be read — never silently dropped. */
  unparsed: string[];
};

/** The marker `readFailedArms` puts on a suite that would not load. */
const WOULD_NOT_LOAD = " <suite would not load>";

/**
 * WHICH SUITE FILES A SET OF ARM IDENTITIES NAMES.
 *
 * `readFailedArms` produces two shapes and this reads both: `server/x.test.ts >
 * describe > the arm`, and `server/x.test.ts <suite would not load>`. The file
 * is everything before the first ` > ` or before that marker.
 *
 * ⚠ **AN IDENTITY IT CANNOT READ GOES IN `unparsed` RATHER THAN BEING
 * DROPPED.** Dropping one would hand the caller a SUBSET to re-run, and a
 * subset that passes says nothing about the arm left out of it — it would read
 * as "alone-pass, so the machine" on evidence that never covered the whole
 * refusal. The caller refuses to run at all rather than run a subset, which is
 * law 2's direction: the instrument that cannot see the whole question says so.
 */
export const suiteFilesOf = (arms: readonly string[]): SuiteFileReading => {
  const files = new Set<string>();
  const unparsed: string[] = [];
  for (const arm of arms) {
    const marker = arm.indexOf(WOULD_NOT_LOAD);
    const separator = arm.indexOf(" > ");
    const head = marker >= 0
      ? arm.slice(0, marker)
      : separator >= 0 ? arm.slice(0, separator) : arm;
    const file = head.trim();
    /* A guard suite is a `.test.ts`; anything else is not something this can
       hand to a runner, and guessing would be the subset problem above. */
    if (/\.test\.tsx?$/.test(file) && !file.includes(" ")) files.add(file);
    else unparsed.push(arm);
  }
  return { files: [...files].sort(), unparsed };
};

/**
 * WHAT A SOLO RE-RUN OF THE FAILING ARMS PRODUCED.
 *
 * ⚠ **`passed` IS THE RUNNER'S EXIT STATUS AND NOT AN ARM READING**, because a
 * PASSING run prints no `FAIL` line at all — so "no arms could be read" and
 * "nothing failed" are the same string and opposite facts. The exit code is the
 * only thing that tells them apart, which is the same mistake `readFailedArms`'
 * empty-set rule exists to prevent, one layer up.
 */
export type AloneRerun =
  /** It could not be attempted, or could not be attempted HONESTLY. */
  | { ran: false; why: string }
  | {
      ran: true;
      /** The runner exited 0 on those suites alone. */
      passed: boolean;
      /** The arms that failed alone — empty when it passed, or unreadable. */
      arms: string[];
      /** The suite files it ran. */
      files: string[];
    };

export type RepeatVerdict =
  /** They pass alone, so they are capable of passing here — the MACHINE. */
  | { kind: "alone-passes"; sentence: string; files: string[] }
  /** They fail alone too, with no contention to blame — the COMMIT. */
  | { kind: "alone-fails"; sentence: string; stillFailing: string[]; alsoFailing: string[] }
  /** The control could not be taken. Both roads stand exactly as written. */
  | { kind: "alone-unresolved"; sentence: string };

/**
 * JUDGE A REPEATING SET BY WHETHER ITS ARMS CAN PASS ALONE.
 *
 * ⚠ **IT NEVER CONCLUDES FROM A FAILURE IT COULD NOT READ.** A solo run that
 * exits non-zero while printing nothing readable is `alone-unresolved` and not
 * `alone-fails`: that is the runner having died, not an arm having failed, and
 * accusing the commit off it would be exactly the confident wrong answer this
 * card is about.
 *
 * ⚠ **A SOLO FAILURE ON DIFFERENT ARMS STILL POINTS AT THE COMMIT, and it is
 * named rather than folded in.** Something in this tree fails with nothing
 * competing for the box, which is the finding; that it is not the same arm is
 * worth a shift knowing before it starts fixing, so both lists travel with the
 * verdict.
 */
export const judgeRepeatAlone = (input: {
  /** The arms that repeated, from the `same-set` verdict. */
  arms: readonly string[];
  /** How many refusals of this commit are on record. */
  runs: number;
  alone: AloneRerun;
}): RepeatVerdict => {
  const { alone } = input;
  const byHand = suiteFilesOf(input.arms).files.join(" ");
  if (!alone.ran) {
    return {
      kind: "alone-unresolved",
      sentence:
        `THE CONTROL COULD NOT BE TAKEN, so the repeat settles nothing and BOTH roads above stand`
        + ` exactly as written — ${alone.why}`
        + `\n    by hand, which is the whole of it: npx vitest run ${byHand === "" ? "<the suite named above>" : byHand}`
        + `\n    passing alone means the machine and nothing in the commit; failing alone means the commit.`,
    };
  }
  if (alone.passed) {
    return {
      kind: "alone-passes",
      files: alone.files,
      sentence:
        `THOSE ARMS PASS WHEN RUN ALONE — so they are CAPABLE of passing on this machine right now,`
        + ` and the repeat was never evidence about the commit. NOTHING IN THE COMMIT IS IMPLICATED.`
        + `\n    re-run alone and green: ${alone.files.join(", ")}`
        + `\n    A set that repeats identically is what PERSISTENT contention looks like — the same arms are`
        + ` simply the first to fall under load every time, which a moving set never shows (#2248).`
        + `\n    repair: nothing in the commit. Hold vitest to fewer workers for this run —`
        + ` VITEST_MAX_THREADS=2 VITEST_MIN_THREADS=1 npx tsx scripts/deploy-rite.mts — the lever measured on`
        + ` 2026-10-10; or re-run the rite unchanged, which is what shipped 9e3217c2 on its third run.`,
    };
  }
  if (alone.arms.length === 0) {
    return {
      kind: "alone-unresolved",
      sentence:
        `THE SOLO RE-RUN FAILED AND ITS OUTPUT COULD NOT BE READ, so nothing is concluded from it —`
        + ` a runner that died is not an arm that failed, and both roads above stand as written.`
        + `\n    by hand: npx vitest run ${alone.files.join(" ")}`,
    };
  }
  const repeated = new Set(input.arms);
  const stillFailing = alone.arms.filter((arm) => repeated.has(arm));
  const alsoFailing = alone.arms.filter((arm) => !repeated.has(arm));
  return {
    kind: "alone-fails",
    stillFailing,
    alsoFailing,
    sentence:
      `THOSE ARMS FAIL ALONE TOO, with nothing competing for the box — so this IS the first road above:`
      + ` a contract breached in the commit, not the machine.`
      + (stillFailing.length > 0 ? `\n    failing alone as well:\n    ${stillFailing.join("\n    ")}` : "")
      + (stillFailing.length === 0
        ? `\n    NONE of the repeated arms is among them — the tree fails either way, but not where the`
          + ` refusals said. Read the solo run before fixing anything.`
        : "")
      + (alsoFailing.length > 0
        ? `\n    and failing alone on arm(s) the refusals did NOT name, which is still the commit:`
          + `\n    ${alsoFailing.join("\n    ")}`
        : "")
      + `\n    repair: fix those arms' subject in the commit (the shape is scripts/SKELETON-disposable.mts),`
      + ` commit, re-run.`,
  };
};
