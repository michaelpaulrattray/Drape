/**
 * THE DEPLOY RITE'S READING OF THE ERROR-TRACKER PROBE (#1643, the remainder of
 * #1542).
 *
 * # What this is for
 *
 * The founder clicked *Errors* on 2026-09-30 and read Sentry's *"Get Started …
 * no event, ever"* panel over a server that had been printing `[Errors]
 * reporting to Sentry` for three days. `scripts/probe-error-tracker.mts` is the
 * positive control that answers that question, and it answered it: his eye on
 * event `d5062d9c…`, then the probe reading its own arrival once his token
 * carried `event:read`.
 *
 * ⚠ **BUT IT RAN BY HAND, WHICH MEANS IT RAN WHEN SOMEBODY REMEMBERED.** A pipe
 * that dies next Tuesday is then discovered the way the first one was — by him,
 * looking at a quiet feed and having to ask. So the probe becomes a STEP of the
 * rite, fired after the health check on every deploy, and a dead pipe becomes a
 * line in the receipt.
 *
 * # ⚠ WHY THE RITE READS A LINE RATHER THAN AN EXIT CODE
 *
 * The probe's own docblock states the contract and it is the opposite of the
 * usual one: **`EXIT <n>` on stdout is the measurement and the process's exit
 * code is only agreement.** That is not fussiness — the first production run
 * printed `accepted-unverified` correctly and then died inside libuv on the way
 * out (`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`, `win/async.c`),
 * returning **1** where the docblock promises **2**. A caller keying on the code
 * alone would have filed a FINDING as an ordinary failure, and the verdict the
 * probe had already reached correctly would have been overwritten by the way the
 * process happened to end.
 *
 * So: this reader takes the line, and treats a code that disagrees with it as
 * its own named observation rather than as the answer.
 *
 * # What it will not do
 *
 * It never decides to roll anything back. #1643's own done-when: *a verdict
 * other than `arrived` is a red line in the rite — named, never a silent skip —
 * but does NOT roll the deploy back*, because a tracker being down is not a
 * reason to keep an old build serving. The rite's exit status is a receipt's
 * quality, not a deploy gate, which is already how the flag, schema and asset
 * problems ride.
 *
 * Nothing in here spawns, fetches, reads an environment variable or exits — the
 * rite owns the spawn policy, this owns the verdict, which is
 * `productionHealthProbe.mts`'s split for the same reason: a judgement that only
 * runs inside a 1,600-line script that pushes to production is a judgement
 * nothing can drive. Driven by `server/trackerProbeStep.test.ts`.
 */

/** The probe's invocation, declared once so the rite cannot spell it two ways. */
export interface ProbeInvocation {
  readonly command: string;
  readonly args: readonly string[];
}

/**
 * How the rite fires the probe.
 *
 * ⚠ **THROUGH `railway run --service <service>`, WHICH IS NOT INCIDENTAL.** The
 * probe must send its event on the SERVICE's DSN and read it back with the
 * SERVICE's token; a plain child would pick up whatever `.env` the operator's
 * machine carries — a different project, or none — and report a healthy pipe
 * that is not the one production uses. The wrapper is also the road the probe's
 * two proven production runs took, so this reproduces a measured road rather
 * than inventing one.
 *
 * ⚠ **AND THE RITE MUST NOT ITSELF RUN UNDER THAT WRAPPER** — its own header
 * says so (#148: an unscoped `railway deployment list` inside a MySQL context
 * watched the wrong service for ten minutes). A CHILD under the wrapper is a
 * different thing: the rite's own environment is untouched, and every railway
 * call it makes stays `--service`-scoped.
 *
 * The secrets never enter the rite's process. That is the strongest form of
 * #1643's *"no token or DSN value is ever printed"*: the rite cannot print what
 * it never holds.
 */
export function probeInvocation(input: {
  readonly service: string;
  /** `/api/health`'s `build`, so the marker names the SERVING commit. */
  readonly healthBuild: string | null;
}): ProbeInvocation {
  return {
    command: "railway.cmd",
    args: [
      "run",
      "--service",
      input.service,
      "--",
      "npx",
      "tsx",
      "scripts/probe-error-tracker.mts",
      ...(input.healthBuild ? ["--health-build", input.healthBuild] : []),
    ],
  };
}

/** What the rite saw when it ran the probe. */
export interface ProbeRun {
  /** Everything the child wrote, stdout and stderr, in whatever order arrived. */
  readonly output: string;
  /** The process's exit code, or null when it never produced one (killed, spawn failure). */
  readonly status: number | null;
}

export interface ProbeStepReading {
  /** The word after `VERDICT`, or null when the probe never reached one. */
  readonly verdict: string | null;
  /** The number on the `EXIT` line, or null when there was none. */
  readonly exitLine: number | null;
  /** Whether this should cost the rite its `RITE EXIT STATUS: OK`. */
  readonly healthy: boolean;
  /** The receipt's line for this step — always one line, always a reading. */
  readonly line: string;
  /** Named faults, in the rite's own `problems` shape. Empty when healthy. */
  readonly problems: readonly string[];
}

/*
  `VERDICT  arrived` / `EXIT     0`, ANCHORED — and the gap is `[ \t]+` rather
  than `\s+`, which was the first shape and is wrong: `\s` matches a newline, so
  a bare `EXIT` line followed by a line holding `0` would have read as the
  contract. The probe's own prose talks about both words, and this module's
  docblock quotes them, so a reader that matched anywhere would be measuring the
  explanation instead of the reading.
*/
const VERDICT_LINE = /^VERDICT[ \t]+(\S+)/m;
const EXIT_LINE = /^EXIT[ \t]+(-?\d+)[ \t]*$/m;
const MARKER_LINE = /^marker[ \t]+(\S+)/m;
const BUILD_LINE = /^build[ \t]+(.+)$/m;

/** The last few lines of a run that said nothing useful, for the receipt. */
function tailOf(output: string, lines: number): string {
  const kept = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .slice(-lines);
  return kept.length === 0 ? "(no output at all)" : kept.join(" ⏎ ");
}

/**
 * Judge one probe run.
 *
 * ⚠ **THE MISSING `EXIT` LINE IS A FINDING, NEVER A SKIP.** A probe that could
 * not be started — `railway.cmd` absent, the project unlinked, `npx` not on the
 * path — produces no verdict, and reporting that as "nothing to see" is exactly
 * the silence #1542 was filed about, one level up: the instrument watching the
 * instrument would itself go quiet and nothing would say so. So a run with no
 * line is unhealthy and the receipt carries the tail of what it did print.
 */
export function readProbeStep(run: ProbeRun): ProbeStepReading {
  const verdictMatch = VERDICT_LINE.exec(run.output);
  const exitMatch = EXIT_LINE.exec(run.output);
  const verdict = verdictMatch?.[1] ?? null;
  const exitLine = exitMatch ? Number(exitMatch[1]) : null;
  const marker = MARKER_LINE.exec(run.output)?.[1] ?? null;
  const build = BUILD_LINE.exec(run.output)?.[1]?.trim() ?? null;

  if (exitLine === null) {
    return {
      verdict,
      exitLine: null,
      healthy: false,
      line:
        "error tracker UNREAD — the probe printed no EXIT line, so it never reached a verdict"
        + ` (process exit ${run.status === null ? "none" : run.status}) · ${tailOf(run.output, 3)}`,
      problems: [
        "the error-tracker probe did not run to a verdict — the question \"is the Sentry pipe alive?\" is"
        + " unanswered for this deploy, which is the silence #1542 was filed about. Run"
        + " `railway.cmd run --service Drape -- npx tsx scripts/probe-error-tracker.mts` by hand and read why.",
      ],
    };
  }

  const healthy = exitLine === 0;
  const problems: string[] = [];

  if (!healthy) {
    problems.push(
      `the error tracker probe returned ${verdict ?? "no verdict word"} rather than \`arrived\``
      + `${marker ? ` (marker ${marker})` : ""} — an exception the product reports may not be reaching`
      + " Sentry, so a quiet Errors feed cannot be trusted. The deploy is NOT rolled back for this.",
    );
  }

  /*
    ⚠ THE CROSS-CHECK, AND IT IS CHEAP BECAUSE `readTrackerProbe` IS THE ONLY
    PRODUCER: `healthy` and the verdict `arrived` are the same fact on the probe's
    side, so seeing one without the other means the two lines did not come from
    one reading — interleaved output, a truncated pipe, a second probe's text.
    Working law 2's habit pointed at a reader rather than at a guard: an
    instrument that cannot notice its own input being incoherent reports whatever
    it happened to match.
  */
  if (healthy !== (verdict === "arrived")) {
    problems.push(
      `the probe's own two readings disagree — VERDICT said \`${verdict ?? "nothing"}\` and EXIT said`
      + ` ${exitLine}. They are one fact on the probe's side, so this output is not one coherent run;`
      + " read the receipt rather than believing either line.",
    );
  }

  /*
    ⚠ THE EXIT-CODE DISAGREEMENT GOES ON THE LINE AND **NOT** INTO `problems`,
    AND THE FIRST DRAFT HAD IT THE OTHER WAY.

    It is not a fact about the tracker. The measured cause is the probe's own
    teardown aborting inside libuv on Windows against a real ingest endpoint, and
    `problems` is what withholds the rite's `RITE EXIT STATUS: OK` — so a
    `problems` entry here would turn a proven-healthy pipe into a red receipt on
    every deploy, for a reason that has nothing to do with the question asked.
    That is an instrument manufacturing the alarm it exists to raise honestly.

    It is still SAID, in the line, where a reader looking at this step will see
    it: #1643's *"named, never a silent skip"* is about visibility, not about the
    exit status. Anything that ever keys on the CODE — a future `deploy-verify`
    step — reads this run differently, and the receipt now says so.
  */
  const codeDisagrees = run.status !== null && run.status !== exitLine;

  return {
    verdict,
    exitLine,
    healthy,
    line:
      `error tracker ${verdict ?? "(no verdict word)"}`
      + `${marker ? ` · ${marker}` : ""}`
      + `${build ? ` · build ${build}` : ""}`
      + (codeDisagrees
        ? ` · ⚠ printed EXIT ${exitLine}, process exited ${run.status} — the LINE is the contract`
        : ""),
    problems,
  };
}

/*
  ⚠ THERE IS NO `--dry` BRANCH IN HERE, AND THAT IS A READING RATHER THAN AN
  OMISSION. A rehearsal must not write to a vendor — a probe event creates an
  issue in the feed the founder opens — and the first draft of this module
  carried a `PROBE_SKIPPED_DRY` line for exactly that reason. Read at the rite
  instead of assumed: `if (DRY) { … process.exit(0); }` fires at the END OF STEP
  2, before the watch, so a dry run never reaches the health check and therefore
  never reaches this step at all. A guard on a road nothing walks is invariant
  7's own defect wearing a safety label, and a suite asserting it would be
  coverage over nothing. `server/trackerProbeStep.test.ts` pins the ORDERING
  instead, which is the fact the guard was reaching for.
*/
