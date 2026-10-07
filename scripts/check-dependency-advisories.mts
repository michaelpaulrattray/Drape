/**
 * THE GATE STEP: are there known vulnerabilities in what we ship? (#1805)
 *
 * His word, 2026-10-03 (terminal), verbatim: ***"add the gate step"*** — chosen
 * over relying on a dashboard setting nobody in the tree can see, on the ground
 * that this is *"the one we can see working and prove is switched on"*.
 *
 * The judge, the policy, the measured positive control and the stated limits are
 * all in `scripts/lib/dependencyAdvisories.mts`. This file is only the road from
 * the command to the verdict, and it exists so that the gate runs the SAME
 * reading a shift can run by hand:
 *
 *     npx tsx scripts/check-dependency-advisories.mts
 *
 * ⚠ **A NON-ZERO EXIT FROM `pnpm audit` IS NOT A FAILURE HERE** — it is how the
 * command reports that it FOUND something, which is the normal case this step
 * exists for. So the exit code is deliberately not consulted; the OUTPUT is. The
 * two things that are genuinely failures are an output this cannot parse and a
 * command that could not be launched at all, and both REFUSE rather than pass
 * (invariant 7: a control must refuse, not allow, when a dependency is missing).
 */
import { spawnSync } from "node:child_process";

import {
  advisoryPass,
  advisoryRefusal,
  advisoryTreeLine,
  AUDIT_ARGUMENTS,
  judgeAdvisories,
  readAuditReport,
  readTreeFromRevList,
  type TreeRead,
} from "./lib/dependencyAdvisories.mts";

/**
 * WHICH TREE THIS READING IS OF (#1899) — the sha and, when it is a merge, its
 * two parents.
 *
 * One command answers both: `git rev-list --parents -n 1 HEAD` prints the
 * commit followed by its parents, so a pull request's merge ref names itself
 * AND the two commits it joined. `advisoryTreeLine` turns that into the
 * sentence, and the reason it is owed is in its own docblock.
 *
 * ⚠ **IT NEVER FAILS THE CHECK, AND THAT IS THE ONE RULE HERE.** A tree with no
 * git — a tarball, a vendored copy — has no sha to name, and a security verdict
 * must not be withheld because a LABEL could not be composed. `null` says so in
 * as many words. This is the opposite of the file's other refusals on purpose:
 * those are the check being unable to LOOK, which proves nothing; this is the
 * check having looked and being unable to say where.
 */
function readTree(): TreeRead | null {
  const shown = spawnSync("git rev-list --parents -n 1 HEAD", {
    encoding: "utf8",
    shell: true,
    maxBuffer: 1024 * 1024,
  });
  if (shown.error !== undefined || shown.status !== 0) return null;
  /* The PARSE lives in the lib so it can be driven against real git output —
     the format is the assumption most likely to be wrong, and a spawn inside a
     command script is not reachable from a suite. */
  return readTreeFromRevList(shown.stdout ?? "");
}

/*
  ⚠ IT GOES THROUGH A SHELL, AND BOTH HALVES OF THAT WERE DRIVEN RATHER THAN
  REASONED.
  `spawnSync("pnpm.cmd", [...])` on Node 24 answers `EINVAL` outright — since the
  CVE-2024-27980 fix Node refuses to launch a `.cmd` without a shell — so the
  first version of this file refused on every local run. (It REFUSED rather than
  passed, which is the whole design, and is why a two-minute drive found it
  instead of a shift meeting it at the gate.) And passing an argument ARRAY
  alongside `shell: true` earns Node's DEP0190 warning, so the command is one
  joined string: one code path for both worlds, and no warning printed over a
  security check's own output.
  ⚠ The shell is safe HERE and this is NOT a shape to copy: every token is a
  literal in `AUDIT_ARGUMENTS`, and no diff, pull request, filename or
  environment variable reaches this line. The moment one would, the argv form
  comes back.
*/
const COMMAND = ["pnpm", ...AUDIT_ARGUMENTS].join(" ");

const run = spawnSync(COMMAND, {
  encoding: "utf8",
  shell: true,
  /*
    The report is ~29 KB on a tree with four advisories and grows with them, so
    the default 1 MB buffer is ample — but a truncated read would silently drop
    findings, so the cap is named rather than inherited.
  */
  maxBuffer: 32 * 1024 * 1024,
});

if (run.error !== undefined) {
  console.log(`REFUSED: could not run \`${COMMAND}\` — ${run.error.message}`);
  console.log("  The check has proven nothing; it does not pass by being unable to look.");
  process.exit(1);
}

const read = readAuditReport(run.stdout ?? "");

if (!read.ok) {
  console.log(`REFUSED: ${read.why}`);
  /*
    ⚠ STDERR IS KEPT AND IS MEASURED EMPTY FOR THE CASE IT WAS WRITTEN FOR
    (#1856). Driven on pnpm 10.28.2 against a dead port and a local stand-in
    endpoint, five failure shapes out of five — ECONNREFUSED, a captive portal's
    HTML, a 503, a 429 and a 500 — printed their whole diagnosis as JSON on
    STDOUT and left stderr at zero bytes. So this branch is not where an outage
    explains itself; `readAuditReport` reads the report's own `error` object and
    the sentence above carries it. The echo stays because it costs nothing and a
    failure that is not one of those five may yet use it — but nobody should
    read its silence as "pnpm said nothing".
  */
  if ((run.stderr ?? "").trim() !== "") {
    console.log(`  pnpm said on stderr: ${(run.stderr ?? "").trim().split("\n").slice(0, 5).join("\n  ")}`);
  }
  console.log("  The check has proven nothing; it does not pass by being unable to look.");
  process.exit(1);
}

const verdict = judgeAdvisories(read.report);

/* The tree is named beside BOTH verdicts, because a refusal is the reading
   somebody is most likely to carry to another machine and compare. */
const tree = readTree();

if (!verdict.ok) {
  console.log(advisoryRefusal(verdict));
  console.log(advisoryTreeLine(tree));
  process.exit(1);
}

console.log(advisoryPass(read.report, verdict));
console.log(advisoryTreeLine(tree));
process.exit(0);
