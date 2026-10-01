import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { probeInvocation, readProbeStep } from "../scripts/lib/trackerProbeStep.mts";

/**
 * THE RITE'S READING OF THE ERROR-TRACKER PROBE, DRIVEN (#1643 — the remainder
 * of #1542).
 *
 * `scripts/probe-error-tracker.mts` needs a Sentry account and a linked Railway
 * project to say anything, so nothing in CI can run it — which is exactly why
 * its judgement lives in a pure module and is proven here instead. The same
 * split, for the same reason, as `server/productionHealthProbe.test.ts`.
 *
 * ⚠ **THE TWO ARMS THAT MATTER MOST ARE NOT ABOUT VERDICTS.**
 *
 * 1. **The libuv arm.** The probe's first production run printed
 *    `accepted-unverified` and `EXIT 2` correctly and then aborted inside libuv
 *    on the way out, returning **1**. A rite step keyed on the exit code would
 *    have filed a FINDING as an ordinary failure. So the `EXIT` LINE is the
 *    contract and the code is agreement, and the arm below drives exactly that
 *    disagreement on the real output.
 * 2. **The no-line arm.** A probe that could not be STARTED must be a finding,
 *    never a skip. An instrument watching an instrument that goes quiet when it
 *    breaks is #1542's own defect one level up.
 */

/** The relay's real production run, 2026-10-01 — quoted from #1542, not invented. */
const ARRIVED_OUTPUT = [
  "— error tracker probe (#1542) —",
  "marker   probe:cd969b54:muon8kgq-kjri81",
  "build    checkout — git rev-parse HEAD — this working tree, NOT the deployment…",
  "boot     [Errors] reporting to Sentry · railway:production",
  "eventId  9b8e65a8a1194f72aab8222ec8c57782",
  "counters sent +1 · refused +0 · configured=true ready=true",
  "lookup   arrived — Sentry answered 200 for the event id on attempt 3 (klieg-labs/klieg-server)",
  "",
  "VERDICT  arrived",
  "The event arrived at Sentry (event id 9b8e65a8a1194f72aab8222ec8c57782).",
  "EXIT     0",
].join("\n");

/** The relay's earlier production run, 2026-09-30 — the 403 read-back. */
const UNVERIFIED_OUTPUT = [
  "— error tracker probe (#1542) —",
  "marker   probe:4942f8b465:muog3z57-s5bngo",
  "build    health — /api/health's `build` — the commit production is SERVING, read by the caller this run.",
  "eventId  c4d427384375477095eab4de12388d7d",
  "counters sent +1 · refused +0 · configured=true ready=true",
  "lookup   unreadable — Sentry answered 403 for klieg-labs/klieg-server",
  "",
  "VERDICT  accepted-unverified  (finding)",
  "The SDK accepted the event, and the read-back at Sentry failed, so arrival is unproven.",
  "",
  "Record this on #1542: the verdict, the event id, and the lookup note above.",
  "EXIT     2",
].join("\n");

/**
 * A REAL RUN'S BYTES, not a fixture — driven on this machine 2026-10-01 with no
 * `SENTRY_DSN` in the environment, which is the `no-tracker` road and sends
 * nothing. Pasted rather than composed: a receipt reconstructed from what a
 * design says the output looks like is how #1061's unexecutable query came to
 * stand as evidence.
 */
const NO_TRACKER_OUTPUT = [
  "— error tracker probe (#1542) —",
  "marker   probe:4942f8b465f9067e8ef25f06a55bbd54cb0ed0f2:muooz698-cqtbzh",
  "build    health — /api/health's `build` — the commit production is SERVING, read by the caller this run.",
  "boot     [Errors] SENTRY_DSN is not set — uncaught errors are logged locally and reported nowhere",
  "eventId  (none — the SDK returned no id)",
  "counters sent +0 · refused +0 · configured=false ready=false",
  "lookup   not-checked — No event id, so there was nothing to look up.",
  "",
  "VERDICT  no-tracker  (finding)",
  "SENTRY_DSN is not set in this process — errors are logged locally and reported nowhere.",
  "",
  "Record this on #1542: the verdict, the event id, and the lookup note above.",
  "EXIT     2",
].join("\n");

describe("the rite's reading of the probe (#1643)", () => {
  it("reads a REAL driven run — the no-DSN road, and the `(finding)` suffix is not part of the verdict", () => {
    const reading = readProbeStep({ output: NO_TRACKER_OUTPUT, status: 2 });

    expect(reading.verdict).toBe("no-tracker");
    expect(reading.exitLine).toBe(2);
    expect(reading.healthy).toBe(false);
    expect(reading.problems).toHaveLength(1);
    /* And the build the rite handed over survives into the receipt line, which is
       #1643's fourth done-when read at a real run rather than at a fixture. */
    expect(reading.line).toContain("4942f8b465f9067e8ef25f06a55bbd54cb0ed0f2");
    expect(reading.line).toContain("build health");
  });

  it("calls an ARRIVED run healthy and carries its marker into the receipt line", () => {
    const reading = readProbeStep({ output: ARRIVED_OUTPUT, status: 0 });

    expect(reading.verdict).toBe("arrived");
    expect(reading.exitLine).toBe(0);
    expect(reading.healthy).toBe(true);
    expect(reading.problems).toEqual([]);
    expect(reading.line).toContain("arrived");
    expect(reading.line).toContain("probe:cd969b54:muon8kgq-kjri81");
  });

  it("calls a non-arrived verdict a PROBLEM, and says the deploy is not rolled back", () => {
    const reading = readProbeStep({ output: UNVERIFIED_OUTPUT, status: 2 });

    expect(reading.verdict).toBe("accepted-unverified");
    expect(reading.healthy).toBe(false);
    expect(reading.problems).toHaveLength(1);
    expect(reading.problems[0]).toContain("accepted-unverified");
    expect(reading.problems[0]).toContain("probe:4942f8b465");
    expect(reading.problems[0]).toMatch(/NOT rolled back/);
  });

  it("⚠ keys on the EXIT LINE, not the process code — an ARRIVED run that aborted at teardown", () => {
    /*
      THE ARM THAT ACTUALLY DISCRIMINATES, AND IT IS HERE BECAUSE A SABOTAGE RUN
      SHOWED THE OBVIOUS ONE DOES NOT.

      The first shape of this arm fed the `accepted-unverified` output with a
      process code of 1 — the real 2026-09-30 incident — and a reader keyed on
      `run.status` PASSED it, because `EXIT 2` and `exit 1` are both non-zero and
      both reach the same `healthy: false`. The fixture could not ask the
      question (memory: `surviving-sabotage-may-be-inert`).

      The direction that separates them is the expensive one: a pipe the probe
      proved ALIVE, on a process that died on the way out. Keyed on the code, that
      is a false alarm on his receipt about a tracker that is working.
    */
    const reading = readProbeStep({ output: ARRIVED_OUTPUT, status: 1 });

    expect(reading.exitLine).toBe(0);
    expect(reading.verdict).toBe("arrived");
    expect(reading.healthy).toBe(true);
    /* And the disagreement is SAID on the line rather than swallowed — anything
       keying on the code alone reads this run differently. */
    expect(reading.line).toContain("process exited 1");
    expect(reading.line).toContain("the LINE is the contract");
  });

  it("⚠ a teardown crash does NOT cost the rite its OK — that would be a manufactured alarm", () => {
    /* The mismatch is a fact about the probe's own exit, not about the tracker,
       and `problems` is what withholds `RITE EXIT STATUS: OK`. A `problems` entry
       here would redden every deploy over a proven-healthy pipe. */
    expect(readProbeStep({ output: ARRIVED_OUTPUT, status: 1 }).problems).toEqual([]);
  });

  it("the real 2026-09-30 run still reads as the finding it was, code or no code", () => {
    for (const status of [1, 2, null]) {
      const reading = readProbeStep({ output: UNVERIFIED_OUTPUT, status });
      expect(reading.exitLine).toBe(2);
      expect(reading.healthy).toBe(false);
      expect(reading.problems).toHaveLength(1);
    }
  });

  it("POSITIVE CONTROL — an agreeing code puts no mismatch on the line at all", () => {
    /* Without this the arms above pass for an implementation that simply appends
       the note to every run. */
    expect(readProbeStep({ output: ARRIVED_OUTPUT, status: 0 }).line).not.toContain("process exited");
    expect(readProbeStep({ output: UNVERIFIED_OUTPUT, status: 2 }).line).not.toContain("process exited");
  });

  it("does not hold a null process code against the reading when the line is there", () => {
    /* A timeout kill gives `status: null` with a signal. If the probe had already
       printed its verdict, that verdict stands. */
    const reading = readProbeStep({ output: ARRIVED_OUTPUT, status: null });

    expect(reading.healthy).toBe(true);
    expect(reading.problems).toEqual([]);
  });

  describe("⚠ a probe that never reached a verdict is a FINDING, never a skip", () => {
    it("reports UNREAD and names the by-hand command", () => {
      const reading = readProbeStep({
        output: "'railway.cmd' is not recognized as an internal or external command",
        status: 1,
      });

      expect(reading.exitLine).toBeNull();
      expect(reading.healthy).toBe(false);
      expect(reading.line).toContain("UNREAD");
      expect(reading.problems).toHaveLength(1);
      expect(reading.problems[0]).toContain("probe-error-tracker.mts");
    });

    it("carries the tail of what it DID print, so the failure is diagnosable", () => {
      const reading = readProbeStep({
        output: "line one\nline two\nProject is not linked. Run `railway link`.\n",
        status: 1,
      });

      expect(reading.line).toContain("railway link");
    });

    it("says so even when the child wrote nothing at all", () => {
      const reading = readProbeStep({ output: "", status: null });

      expect(reading.healthy).toBe(false);
      expect(reading.line).toContain("no output at all");
      expect(reading.problems).toHaveLength(1);
    });

    it("a half-run that printed a VERDICT and died before its EXIT line is still unread", () => {
      /* The verdict is KEPT for the receipt — it is a real reading — but it does
         not make the run healthy, because the contract line is what says so. */
      const reading = readProbeStep({
        output: ARRIVED_OUTPUT.split("\nEXIT")[0]!,
        status: null,
      });

      expect(reading.verdict).toBe("arrived");
      expect(reading.exitLine).toBeNull();
      expect(reading.healthy).toBe(false);
    });
  });

  describe("the two lines are one fact, so incoherent output is named", () => {
    it("flags a VERDICT and an EXIT that cannot both be true", () => {
      const reading = readProbeStep({
        output: "marker   probe:x:y\nVERDICT  arrived\nEXIT     2\n",
        status: 2,
      });

      expect(reading.healthy).toBe(false);
      expect(reading.problems.some((problem) => /disagree/.test(problem))).toBe(true);
    });

    it("flags the other direction too — EXIT 0 under a finding verdict", () => {
      const reading = readProbeStep({
        output: "VERDICT  lost-in-transit\nEXIT     0\n",
        status: 0,
      });

      expect(reading.healthy).toBe(true);
      expect(reading.problems.some((problem) => /disagree/.test(problem))).toBe(true);
    });
  });

  describe("⚠ the readers are ANCHORED — prose about EXIT is not an EXIT line", () => {
    it("ignores a mid-line mention of the contract", () => {
      const output = [
        "A caller keys on the EXIT line and not on the code.",
        "  the VERDICT word is printed above EXIT 7 in the docblock",
        "VERDICT  arrived",
        "EXIT     0",
      ].join("\n");
      const reading = readProbeStep({ output, status: 0 });

      expect(reading.exitLine).toBe(0);
      expect(reading.verdict).toBe("arrived");
    });

    it("does not read a trailing sentence on the EXIT line as the code", () => {
      const reading = readProbeStep({ output: "VERDICT  arrived\nEXIT 0 — and here is why\n", status: 0 });

      /* `EXIT 0 — and here is why` is not the contract line, so there is no
         reading, and that is a finding rather than a silent zero. */
      expect(reading.exitLine).toBeNull();
      expect(reading.healthy).toBe(false);
    });
  });
});

describe("how the rite fires it (#1643)", () => {
  it("goes through railway run, SCOPED to the service — never a bare child", () => {
    /* The probe must send on the SERVICE's DSN and read back with the SERVICE's
       token; a plain child would pick up whatever `.env` the machine carries and
       report a healthy pipe that is not production's. */
    const invocation = probeInvocation({ service: "Drape", healthBuild: "4942f8b465" });

    expect(invocation.command).toBe("railway.cmd");
    expect(invocation.args.slice(0, 4)).toEqual(["run", "--service", "Drape", "--"]);
    expect(invocation.args).toContain("scripts/probe-error-tracker.mts");
  });

  it("hands the probe /api/health's own build, so the marker names the SERVING commit", () => {
    const invocation = probeInvocation({ service: "Drape", healthBuild: "4942f8b465" });
    const at = invocation.args.indexOf("--health-build");

    expect(at).toBeGreaterThan(-1);
    expect(invocation.args[at + 1]).toBe("4942f8b465");
  });

  it("passes NO build flag when health carried none, rather than an empty one", () => {
    /* `--health-build ""` is refused by the probe's strict reader, which would
       turn a missing field into a refused run. Absent means absent. */
    const invocation = probeInvocation({ service: "Drape", healthBuild: null });

    expect(invocation.args).not.toContain("--health-build");
    expect(invocation.args.at(-1)).toBe("scripts/probe-error-tracker.mts");
  });
});

describe("the rite's own wiring — a step whose findings go nowhere is a silent skip", () => {
  const rite = readFileSync(join(__dirname, "..", "scripts", "deploy-rite.mts"), "utf8");
  const probe = readFileSync(join(__dirname, "..", "scripts", "probe-error-tracker.mts"), "utf8");

  it("the rite runs the probe AFTER the health verdict, never before it", () => {
    /* #1643: the probe's subject is the build now taking traffic, and which
       process that is has no verdict until health has answered three times. */
    const healthAt = rite.indexOf("if (!health.ok) {");
    const probeAt = rite.indexOf("probeInvocation({");

    expect(healthAt, "the health refusal could not be found — this arm is measuring nothing")
      .toBeGreaterThan(-1);
    expect(probeAt).toBeGreaterThan(healthAt);
  });

  it("⚠ a bad verdict costs the rite its OK — the arm that makes this a step and not a print", () => {
    /* A step that prints a finding and lets the run exit 0 is a silent skip with
       extra words. The rite's verdict rides its exit status, so the tracker's
       problems must be IN that arithmetic beside the flag, schema and asset ones. */
    const lastExit = rite.lastIndexOf("process.exit(");
    expect(lastExit, "the rite's final exit could not be found — this arm is measuring nothing")
      .toBeGreaterThan(-1);
    const finalExit = rite.slice(lastExit);
    expect(finalExit).toContain("tracker.problems.length");
    /* POSITIVE CONTROL — the slice really is the exit arithmetic, not a stray
       mention, so the assertion above is a reading. */
    expect(finalExit).toContain("assets.problems.length");
  });

  it("does not roll the deploy back — the step has no refusal road at all", () => {
    const step = rite.slice(rite.indexOf("4a. the error tracker"), rite.indexOf("5. the flags, OFF THE SERVICE"));
    expect(step.length, "the step could not be sliced out — this arm is measuring nothing")
      .toBeGreaterThan(200);
    /* `die()` is the rite's only refusal and it is `process.exit(1)` before the
       receipt. A tracker verdict must never reach one: a tracker that is down is
       no reason to keep an old build serving. */
    expect(step).not.toContain("die(");
    expect(rite).toContain("NOT rolled back");
  });

  it("⚠ the rite never names the token or the DSN — it cannot print what it never holds", () => {
    /* #1643's done-when: no token or DSN value is ever printed. This is the
       structural form of it — the secrets live on the service and reach only the
       child, so the rite's own text has no business carrying either name. */
    expect(rite).not.toContain("SENTRY_AUTH_TOKEN");
    expect(rite).not.toContain("SENTRY_DSN");
    /* POSITIVE CONTROL — the file being read really is the rite, so these
       absences are readings rather than a mistyped path. */
    expect(rite).toContain("probeInvocation({");
  });

  it("⚠ a --dry run never reaches the probe, so a rehearsal writes nothing to Sentry", () => {
    /* This replaces a `--dry` GUARD the first draft of the step carried. Read at
       the bytes: the rite exits at the end of step 2, so the guard was dead code
       and a suite asserting it would have been coverage over nothing. What the
       guard was reaching for is this ORDERING, and this is the arm for it — it
       reddens if the dry exit is ever moved past the probe, which is the only way
       a rehearsal could start writing events. */
    const dryExit = rite.indexOf('say("DRY RUN — stopping before the watch.");');
    const probeAt = rite.indexOf("probeInvocation({");

    expect(dryExit, "the rite's dry-run exit could not be found — this arm is measuring nothing")
      .toBeGreaterThan(-1);
    expect(probeAt).toBeGreaterThan(dryExit);
    /* And it is a real exit rather than a message: the statement carries one. */
    expect(rite.slice(dryExit, dryExit + 120)).toContain("process.exit(0)");
  });

  it("the probe REFUSES a word it does not know, on a script that writes to a vendor", () => {
    /*
      Until #1643 it read no arguments at all, so `--dry-run` would have been
      ignored and the event sent anyway — `strictArgs.mts`'s founding incident.

      ⚠ **THE CALL, NOT THE TOKEN.** The first shape of this arm was
      `toContain("parseStrictArgsOrRefuse")` and a sabotage run walked straight
      through it: the name appears twice in that file — once on the import line —
      so replacing the CALL left the arm green. *An import is not a call site* is
      this repository's own most expensive lesson (CLAUDE.md's sensitive-action
      gate), and a text guard is exactly where it comes back.
    */
    expect(probe).toMatch(/const args = parseStrictArgsOrRefuse\(/);
    expect(probe).toMatch(/value: \[[^\]]*"health-build"/);
    /* And the declared flag is READ — a vocabulary entry nothing consumes is the
       same defect one step along: the rite would pass a sha into a void. */
    expect(probe).toMatch(/args\.value\("health-build"\)/);
  });
});
