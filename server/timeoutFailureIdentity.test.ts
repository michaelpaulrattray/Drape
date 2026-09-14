import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/* This suite spawns a real `vitest` and waits for it — #548's population
   exactly, and the single child run below is the whole cost of the file
   (measured: 2.1 s wall, of which ~1 s is the child). */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/**
 * WHAT A TIMEOUT LOOKS LIKE IN EACH READER — because the two readers disagree,
 * and the team reads the one that says nothing (#962).
 *
 * ⚠ **THE SAME FAILURE PRINTS TWO DIFFERENT THINGS, AND ONLY ONE OF THEM IS
 * THE TRUTH:**
 *
 * | reader | a timed-out arm reports |
 * |---|---|
 * | default (console) | `Error: Test timed out in 5000ms.` |
 * | **json** (`--reporter=json`) | **`Error: STACK_TRACE_ERROR`** — no message |
 *
 * An arm that fails an ASSERTION is identical in both. So the blind spot is
 * specific to timeouts, which is the one class this repository has three
 * separate doctrines about.
 *
 * # Why it costs a shift, measured rather than supposed
 *
 * `server/testing/contendedTestTimeout.ts`, `childProcessTimeout.ts` and
 * `suiteClocks.ts` are the three files a shift lands on when a suite goes red
 * under load, and **all three describe the symptom as the string
 * `Test timed out in 5000ms`** — eight citations across the tree at the time
 * this was written. Meanwhile **nothing in the tree mentioned
 * `STACK_TRACE_ERROR` at all**, and the json reporter is what the team is told
 * to use: #741/#743 prescribe it for the duration reading, and #962's own card
 * instructs *"run `--reporter=json --outputFile=...` from the first attempt"*.
 *
 * **So the prescribed instrument is the one that hides the diagnosis.** The
 * shift that filed #962 captured a red, read `STACK_TRACE_ERROR` in the json,
 * and reasonably concluded it was *"the shape vitest reports when a task dies
 * outside an assertion"* — which sent the card's whole "what a fix has to find
 * out first" list toward the image decode and the worker pool, past the
 * doctrine that already owns the class. Working law 2: verify the instrument
 * before believing its finding.
 *
 * # Where it comes from, read at the bytes
 *
 * `@vitest/runner`'s `makeTimeoutError` builds the right message and then
 * overwrites the stack with a sentinel's:
 *
 * ```js
 * const error = new Error(message);   // "Test timed out in 5000ms..."
 * error.stack = stackTraceError.stack.replace(error.message, stackTraceError.message);
 * ```
 *
 * `stackTraceError` is the `new Error("STACK_TRACE_ERROR")` vitest constructs
 * at REGISTRATION time to remember the `it(...)` call site. Its stack never
 * contains the timeout message, so the `.replace` is a **no-op** and `.stack`
 * keeps reading `Error: STACK_TRACE_ERROR`. The default reporter prints
 * `.message`; the json reporter serialises `.stack`. Same error object, two
 * answers.
 *
 * ⚠ **This is why the last user frame of such a stack is the `it(` line and
 * not the line that was slow** — it is the registration site, which is exactly
 * what misreads as "the test died here". #962 was captured at
 * `inkReferenceCrop.test.ts:293:3`, which is that file's `it(`.
 *
 * # Why this is a driven guard and not a ninth paragraph
 *
 * The eight prose citations above rotted *because nothing drove them*: they
 * were true when written and quietly stopped describing the suite's output. A
 * ninth sentence would have the same shelf life. **If vitest repairs this
 * upstream, the sentinel arm goes red and these documents get corrected —
 * which is the only way a note like this stays honest.**
 */
const ROOT = resolve(import.meta.dirname, "..");

/** One child `vitest` over a throwaway fixture; both readers, one run. */
function driveOneFixtureRun(): { title: string; json: string; console: string }[] {
  /*
    ⚠ THE FIXTURE LIVES INSIDE THE REPOSITORY AND THAT IS NOT TIDINESS. Under
    pnpm's strict layout a config file in the OS temp directory cannot resolve
    `vitest/config` at all — driven, and it dies at MODULE_NOT_FOUND before a
    single arm runs. `output/` is gitignored, and the main suite's `include`
    covers only `server/**` and `client/src/**`, so this fixture can never be
    collected by the run that is driving it.
  */
  mkdirSync(join(ROOT, "output"), { recursive: true });
  const dir = mkdtempSync(join(ROOT, "output", "timeout-identity-"));
  try {
    writeFileSync(
      join(dir, "fixture.test.ts"),
      [
        'import { describe, expect, it } from "vitest";',
        'describe("the two failure kinds", () => {',
        '  it("EXCEEDS ITS CLOCK", async () => { await new Promise((r) => setTimeout(r, 400)); }, 50);',
        '  it("FAILS AN ASSERTION", () => { expect(1).toBe(2); });',
        "});",
      ].join("\n"),
      "utf8",
    );
    writeFileSync(
      join(dir, "vitest.config.ts"),
      [
        'import { defineConfig } from "vitest/config";',
        'export default defineConfig({ test: { environment: "node", include: ["**/fixture.test.ts"] } });',
      ].join("\n"),
      "utf8",
    );
    const out = join(dir, "out.json");

    let consoleOutput = "";
    try {
      execFileSync(
        process.execPath,
        [
          join(ROOT, "node_modules", "vitest", "vitest.mjs"),
          "run",
          "--config",
          join(dir, "vitest.config.ts"),
          "--reporter=default",
          "--reporter=json",
          `--outputFile.json=${out}`,
        ],
        { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      /* The fixture is SUPPOSED to fail — a non-zero exit is the happy path,
         and its stdout/stderr is half the evidence. A run that failed for some
         other reason is caught by the shape arm below, never swallowed here. */
      const failure = error as { stdout?: string; stderr?: string };
      consoleOutput = `${failure.stdout ?? ""}\n${failure.stderr ?? ""}`;
    }

    const report = JSON.parse(readFileSync(out, "utf8")) as {
      testResults: { assertionResults: { title: string; failureMessages?: string[] }[] }[];
    };
    return report.testResults.flatMap((file) =>
      file.assertionResults.map((arm) => ({
        title: arm.title,
        json: (arm.failureMessages ?? []).join("\n"),
        console: consoleOutput,
      })),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("a timed-out arm and an assertion failure do NOT read the same in both reporters (#962)", () => {
  const arms = driveOneFixtureRun();
  const timedOut = arms.find((a) => a.title === "EXCEEDS ITS CLOCK");
  const asserted = arms.find((a) => a.title === "FAILS AN ASSERTION");

  it("drove a real run that produced BOTH failures — an empty read is not an answer", () => {
    /* Working law 2's other half: this whole file is an instrument, and an
       instrument that silently collected nothing would pass every arm below by
       vacuity. It has already earned its place — the first shape of this
       driver put the fixture in the OS temp directory, the child died at
       MODULE_NOT_FOUND, and this is the arm that said so. */
    expect(arms.map((a) => a.title).sort()).toEqual(["EXCEEDS ITS CLOCK", "FAILS AN ASSERTION"]);
    expect(timedOut?.json, "the timed-out arm reported no failure at all").toBeTruthy();
    expect(asserted?.json, "the asserting arm reported no failure at all").toBeTruthy();
  });

  it("the json reporter names the TIMEOUT with a sentinel and NO message", () => {
    expect(
      timedOut?.json,
      "If this is red, vitest may have repaired makeTimeoutError upstream - which is GOOD NEWS. " +
        "Correct the identity note in this file's docblock and in testing/contendedTestTimeout.ts, " +
        "testing/childProcessTimeout.ts and testing/suiteClocks.ts, then delete this arm.",
    ).toContain("STACK_TRACE_ERROR");
    expect(
      timedOut?.json,
      "the json reporter has started carrying the real message - see the note above",
    ).not.toContain("timed out");
  });

  it("the DEFAULT reporter names the same timeout properly - so the blind spot is the reader, not the runner", () => {
    /* The half that makes the finding actionable: the information is not lost,
       it is only absent from the reader the team was told to use. */
    expect(timedOut?.console).toMatch(/Test timed out in 50ms/);
  });

  it("NEGATIVE CONTROL: an ASSERTION failure survives BOTH readers intact", () => {
    /*
      Without this the arms above would pass against a json reporter that had
      simply stopped carrying messages at all, and the finding would be "the
      json reporter is broken" rather than "timeouts specifically lose their
      message" - a different diagnosis pointing at a different repair.
    */
    expect(asserted?.json).toContain("expected 1 to be 2");
    expect(asserted?.json).not.toContain("STACK_TRACE_ERROR");
    expect(asserted?.console).toMatch(/expected 1 to be 2/);
  });
});
