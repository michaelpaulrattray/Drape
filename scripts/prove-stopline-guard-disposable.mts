/**
 * DOES THE FREEZE ACTUALLY STOP THE SPENDERS — or does it merely sit near them?
 *
 * `scripts/lib/stopline.mts --prove` proves the READING (a file present means
 * stop, absent means go, a dry run is left alone). That is the guard's own
 * opinion of itself, and invariant 7 is explicit that a control which is not
 * invoked does not exist. This driver is the other half: it starts the real
 * spending scripts, with `--spend`, and watches what they do.
 *
 * Three cases per subject, and the last two are the ones that matter:
 *
 *   FROZEN      as the tree stands → must refuse with STOP-THE-LINE
 *   SABOTAGED   the call deleted   → must NOT refuse with STOP-THE-LINE; it
 *                                    falls through to a failure BEHIND the
 *                                    guard, named per subject, which is what
 *                                    proves the run got past it
 *   THAWED      the guard's path pointed at a file that does not exist
 *                                  → must NOT refuse: lifting the freeze is
 *                                    removing a file, never editing a script
 *
 * The middle case is the sabotage fable-117 asked for; the third is its mirror,
 * and it is what keeps this from being a guard nobody can turn off. Neither
 * touches `.agents/mailbox/STOPLINE` itself — only Fable does that.
 *
 * # Nothing here can charge anything, and that is arranged rather than hoped
 *
 * A sabotaged spender has had its brake removed, so the run must be unable to
 * reach a provider by CONSTRUCTION, not by dying at a check that happens to sit
 * behind the guard:
 *
 *   the walk      no `--token`, and the walk refuses to guess a face
 *   the roll      `DATABASE_URL` pointed at a closed port, so the account
 *                 lookup that precedes `createRoll` cannot resolve
 *   the prover    its `BASE` mutated to a closed port for the two runs that
 *                 get past the gate, so the refine POST never leaves the
 *                 machine
 *
 * Each of those failures is also the subject's `behind` marker, so "it went
 * past the guard" is a positive reading rather than the absence of one.
 *
 *   npx tsx scripts/prove-stopline-guard-disposable.mts
 */
import { spawnSync } from "node:child_process";

import { sabotage, type Mutation } from "./lib/sabotage.mts";

type Subject = {
  name: string;
  script: string;
  /** Enough arguments to reach the spend gate and not one more. */
  argv: string[];
  /** The failure that lives BEHIND the freeze — seeing it proves we got past. */
  behind: string;
  /** The call site, deleted for the sabotage case. */
  guard: Mutation;
  /** Applied for the two runs that get past the gate, to strand them offline. */
  strand?: Mutation[];
  env?: Record<string, string>;
};

const SUBJECTS: Subject[] = [
  {
    name: "the walk (drive-self-walk)",
    script: "scripts/drive-self-walk.mts",
    argv: ["--spend"],
    behind: "--token",
    guard: {
      find: 'const SPEND = spendAuthorized("spend a walk\'s credits on the founder\'s account");',
      replace: 'const SPEND = process.argv.includes("--spend");',
    },
  },
  {
    name: "the paid roll (bespectacled-roll-production)",
    script: "scripts/calibration/bespectacled-roll-production.mts",
    argv: ["--spend"],
    behind: "ECONNREFUSED",
    guard: {
      find: 'const SPEND = spendAuthorized("cast a paid sheet on the founder\'s account");',
      replace: 'const SPEND = process.argv.includes("--spend");',
    },
    /* Present, so dotenv leaves it alone and the world guard is satisfied —
       and unreachable, so the owner lookup before `createRoll` cannot land. */
    env: { DATABASE_URL: "mysql://stranded:stranded@127.0.0.1:1/stranded" },
  },
  {
    name: "the caption prover (prove-caption-governs)",
    script: "scripts/prove-caption-governs-disposable.mts",
    argv: ["--token", "not-a-real-token", "--spend"],
    /* `fetch` reports the refused connection through its own wrapper, so the
       marker is the wrapper's words rather than the socket's. */
    behind: "fetch failed",
    guard: {
      find: 'if (!spendAuthorized("charge a refine on the founder\'s account")) {',
      replace: 'if (!process.argv.includes("--spend")) {',
    },
    strand: [{
      find: 'const BASE = "https://drape-production-0232.up.railway.app";',
      replace: 'const BASE = "http://127.0.0.1:1";',
    }],
  },
];

const PATH_CONSTANT = 'export const STOPLINE_PATH = fileURLToPath(new URL("../../.agents/mailbox/STOPLINE", import.meta.url));';
const PATH_THAWED = 'export const STOPLINE_PATH = fileURLToPath(new URL("../../.agents/mailbox/STOPLINE-NO-SUCH-FILE", import.meta.url));';

function run(subject: Subject): { code: number; output: string } {
  const result = spawnSync("npx", ["tsx", subject.script, ...subject.argv], {
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 180_000,
    env: { ...process.env, ...subject.env },
  });
  return { code: result.status ?? -1, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

let failures = 0;
const check = (name: string, pass: boolean, detail: string) => {
  if (!pass) failures += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}\n        ${detail}`);
};

const firstLine = (output: string): string => {
  const rows = output.split(/\r?\n/);
  const line = rows.find((row) => /STOP-THE-LINE/.test(row))
    ?? rows.find((row) => /Error:|refusing|ECONNREFUSED|fetch failed/.test(row));
  return (line ?? rows.find(Boolean) ?? "(no output)").trim().slice(0, 150);
};

console.log("Every invocation below is deliberately unable to reach a provider. Nothing can be charged.\n");

for (const subject of SUBJECTS) {
  console.log(`--- ${subject.name}`);

  /* 1. As the tree stands, with the founder's freeze in place. */
  const frozen = run(subject);
  check(
    "FROZEN — refuses, and the freeze is what refuses",
    frozen.code !== 0 && frozen.output.includes("STOP-THE-LINE"),
    firstLine(frozen.output),
  );

  /* 2. The sabotage: the guard call deleted, everything else intact. */
  const cut = await sabotage(subject.script, [subject.guard, ...(subject.strand ?? [])]);
  try {
    const sabotaged = run(subject);
    const sawFreeze = sabotaged.output.includes("STOP-THE-LINE");
    check(
      "SABOTAGED — the freeze is gone, so the script walks past it to its own failure",
      !sawFreeze && sabotaged.output.includes(subject.behind),
      sawFreeze
        ? "still refused with STOP-THE-LINE — something ELSE is stopping it and this control proves nothing"
        : firstLine(sabotaged.output),
    );
  } finally {
    await cut.restore();
  }

  /* 3. The mirror: the freeze lifted, no spender edited. */
  const strand = subject.strand ? await sabotage(subject.script, subject.strand) : null;
  const thawed = await sabotage("scripts/lib/stopline.mts", [{ find: PATH_CONSTANT, replace: PATH_THAWED }]);
  try {
    const running = run(subject);
    check(
      "THAWED — with no STOPLINE file the spender proceeds unaided",
      !running.output.includes("STOP-THE-LINE") && running.output.includes(subject.behind),
      firstLine(running.output),
    );
  } finally {
    await thawed.restore();
    if (strand) await strand.restore();
  }
  console.log("");
}

console.log(failures === 0
  ? "The freeze is what stops all three spenders, it stops them before they can reach a provider,\n"
    + "and removing the file — not the code — is what lets them run again."
  : `${failures} control(s) failed — the stop-the-line is not enforced where it matters.`);
process.exit(failures === 0 ? 0 : 1);
