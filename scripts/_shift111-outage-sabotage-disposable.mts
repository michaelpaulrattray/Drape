/**
 * DISPOSABLE (foreman-111) — SABOTAGE DRIVER for `readerOutageRefusal.test.ts`.
 *
 * Working law 2: a green suite proves nothing if the checker cannot fail. Each
 * case below puts the defect BACK, runs the one suite, and asserts the number
 * of arms that redden is exactly what the case declares. Every case restores in
 * `finally`, and the tree is re-read clean at the end.
 *
 * ⚠ Do not run any other suite while this is live — the tree is sabotaged
 * between the write and the restore.
 *
 * Usage: npx tsx scripts/_shift111-outage-sabotage-disposable.mts
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const SUITE = "server/castingV2/readerOutageRefusal.test.ts";

/* Built from char codes so this driver's OWN source cannot carry a stray CR. */
const CRLF = String.fromCharCode(13, 10);
const LF = String.fromCharCode(10);

type Case = {
  name: string;
  file: string;
  from: string;
  to: string;
  /** How many arms this defect must redden — declared BEFORE the run. */
  expect: number;
};

const CASES: Case[] = [
  {
    name: "1. the loop no longer distinguishes a throw (the defect itself)",
    file: "server/castingV2/refineInterpreter.ts",
    from: `  if (trace.last === "threw") {`,
    to: `  if (false as boolean) {`,
    expect: 2,
  },
  {
    name: "2. the throw is no longer recorded (the same defect, one layer down)",
    file: "server/castingV2/refineInterpreter.ts",
    from: `    if (trace) trace.last = "threw";`,
    to: `    if (trace) trace.last = "unparsed";`,
    expect: 2,
  },
  {
    name: "3. an unconfigured engine goes back to blaming her sentence",
    file: "server/castingV2/refineInterpreter.ts",
    from: `    log.warn({}, "[refineInterpreter] no text engine — refusing rather than guessing");
    return { ok: false, refusal: { reason: "reader_outage" } };`,
    to: `    log.warn({}, "[refineInterpreter] no text engine — refusing rather than guessing");
    return { ok: false, refusal: { reason: "unreadable" } };`,
    expect: 1,
  },
  {
    name: "4. the outage sentence picks up the unreadable one's advice",
    file: "server/castingV2/refineRefusals.ts",
    from: `    say: () => "I couldn't read that just now — the reader that turns your words into an edit "
      + "didn't answer. Try again in a moment. Nothing was charged.",`,
    to: `    say: () => "I couldn't read that just now — the reader that turns your words into an edit "
      + "didn't answer. Try naming what you want changed. Nothing was charged.",`,
    expect: 1,
  },
  {
    name: "5. an UNREADABLE reply is mislabelled as an outage (the other direction)",
    file: "server/castingV2/refineInterpreter.ts",
    from: `    if (trace) trace.last = "unparsed";
    log.warn({ err: error }, "[refineInterpreter] unreadable reply");`,
    to: `    if (trace) trace.last = "threw";
    log.warn({ err: error }, "[refineInterpreter] unreadable reply");`,
    expect: 1,
  },
  {
    name: "6. hair goes back to telling her to swap the photograph",
    file: "server/castingV2/hairColourFromReference.ts",
    from: `    log.warn({ err: error }, "[hairColourFromReference] the reader did not answer");
    return {
      ok: false,
      refusal: {
        code: "unreadable",
        message: "I couldn't read that picture just now — try again in a moment. Nothing was charged.",`,
    to: `    log.warn({ err: error }, "[hairColourFromReference] the reader did not answer");
    return {
      ok: false,
      refusal: {
        code: "unreadable",
        message: "We couldn't read that picture — try another one.",`,
    expect: 1,
  },
  {
    name: "7. makeup, the same",
    file: "server/castingV2/makeupFromReference.ts",
    from: `    log.warn({ err: error }, "[makeupFromReference] the reader did not answer");
    return {
      ok: false,
      refusal: {
        code: "unreadable",
        message: "I couldn't read that picture just now — try again in a moment. Nothing was charged.",`,
    to: `    log.warn({ err: error }, "[makeupFromReference] the reader did not answer");
    return {
      ok: false,
      refusal: {
        code: "unreadable",
        message: "We couldn't read that picture — try another one.",`,
    expect: 1,
  },
];

const REPORT = "output/_shift111-sabotage-report.json";

/* The JSON reporter writes to a FILE, never to stdout: the product logs its
   own warn lines through this suite, and a report parsed out of a mixed stream
   fails on the first one. */
function runSuite(): { failed: number; passed: number } {
  try {
    execFileSync("npx", ["vitest", "run", SUITE, "--reporter=json", `--outputFile=${REPORT}`], {
      encoding: "utf8", shell: true, stdio: "ignore", maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    /* A red suite exits non-zero and still writes the report. */
  }
  const report = JSON.parse(readFileSync(REPORT, "utf8")) as {
    numFailedTests: number; numPassedTests: number;
  };
  return { failed: report.numFailedTests, passed: report.numPassedTests };
}

function main() {
  console.log("SABOTAGE DRIVER — readerOutageRefusal.test.ts\n");

  const clean = runSuite();
  console.log(`baseline: ${clean.passed} passed, ${clean.failed} failed`);
  if (clean.failed !== 0) {
    console.error("REFUSING: the suite is not green before sabotage.");
    process.exit(1);
  }

  let allAsDeclared = true;
  for (const kase of CASES) {
    /*
      ⚠ THE TREE IS CRLF (autocrlf on Windows) AND THE ANCHORS ARE LF.

      The first run of this driver matched both SINGLE-line anchors and missed
      all five MULTI-line ones, which is that signature exactly. The anchor
      check is what said so — a driver that had silently replaced nothing would
      have reported five green sabotages and certified an untested guard.

      So matching happens on a NORMALIZED copy, and `finally` restores the
      ORIGINAL BYTES rather than the normalized ones, so a green run cannot
      quietly rewrite the repository's line endings.
    */
    const original = readFileSync(kase.file, "utf8");
    const normalized = original.split(CRLF).join(LF);
    if (!normalized.includes(kase.from)) {
      console.error(`  ${kase.name}\n    ✗ ANCHOR NOT FOUND in ${kase.file} — case did not run`);
      allAsDeclared = false;
      continue;
    }
    try {
      writeFileSync(kase.file, normalized.replace(kase.from, kase.to), "utf8");
      const result = runSuite();
      const ok = result.failed === kase.expect;
      allAsDeclared &&= ok;
      console.log(`  ${kase.name}\n    declared ${kase.expect} · reddened ${result.failed} · ${ok ? "AS DECLARED" : "*** NOT AS DECLARED ***"}`);
    } finally {
      writeFileSync(kase.file, original, "utf8");
    }
  }

  const after = runSuite();
  console.log(`\nafter restore: ${after.passed} passed, ${after.failed} failed`);
  console.log(allAsDeclared && after.failed === 0 ? "\nALL CASES AS DECLARED, TREE RESTORED." : "\n*** REVIEW ***");
  return allAsDeclared && after.failed === 0 ? 0 : 1;
}

/* The LAST top-level statement ends the process. `scriptExitDiscipline`
   reads the last statement and an exit inside `main` does not satisfy it. */
process.exit(main());
