/**
 * THE SABOTAGE DRIVER FOR #263 — proves every arm of
 * `server/pushPathsToMain.test.ts` can go RED, one cause at a time.
 *
 * Committed on purpose: `docs/specs/PUSH_PATHS_TO_MAIN.md` cites this file for
 * the sentence "driven — N/N", and an instrument that is not in the tree is a
 * citation nobody can re-run (the finding on #11's build doc, 2026-09-03).
 *
 * # Why a driver and not only the in-suite controls
 *
 * The suite's positive controls feed synthetic trees to the READER. That proves
 * the reader sees a door; it does not prove the finding reaches an ASSERTION
 * over the real repository. These sabotages edit the real files and run the
 * real suite, which is the only way to learn that an arm is wired to the thing
 * it names. Working law 2, and #263's own subject: a control that is not
 * invoked does not exist.
 *
 * No database, no network, no spend. It restores every file in a `finally`.
 */
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SUITE = ["server/pushPathsToMain.test.ts", "server/typecheckOnCommit.test.ts"];

/**
 * Run the suite and say whether it went red.
 *
 * ⚠ `shell: true` is not optional: `spawnSync` refuses a `.cmd` on Windows with
 * EINVAL and returns BOTH STREAMS EMPTY, which is indistinguishable from a
 * passing run. That reported 0/7 on the last driver written here (#11). A run
 * that produced no report THROWS rather than counting as anything.
 */
const runSuite = (): { red: boolean; summary: string } => {
  const result = spawnSync("npx", ["vitest", "run", ...SUITE], {
    cwd: ROOT, encoding: "utf8", shell: true, maxBuffer: 32 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (!/Test Files/.test(output)) {
    throw new Error(`vitest produced no report (status ${result.status}) — the run did not happen:\n${output.slice(0, 800)}`);
  }
  const line = output.split(/\r?\n/).find((l) => l.includes("Tests ")) ?? "(no tally line)";
  /* vitest colours its tally. The ESC is built from its code point rather
     than typed: a raw 0x1b in a regex literal renders fine in every editor
     and is REFUSED by the pre-commit guard — it bit the previous driver
     written here (#11), and then bit this one. */
  const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
  return { red: result.status !== 0, summary: line.replace(ansi, "").trim() };
};

type Sabotage = { name: string; file: string; apply: (text: string) => string } | { name: string; create: string; body: string };

const SABOTAGES: Sabotage[] = [
  {
    name: "the rite stops calling the typecheck (the control this card ADDS)",
    file: "scripts/deploy-rite.mts",
    apply: (t) => t.replace("runTypecheckOnCommit(path.resolve", "noop(path.resolve"),
  },
  {
    name: "the rite stops calling the script guards (the control #152 added)",
    file: "scripts/deploy-rite.mts",
    apply: (t) => t.replace("runScriptGuardsOnCommit(path.resolve", "noop(path.resolve"),
  },
  {
    /* Was "stops guarding local-migration" until #508 PR-2 deleted that ref from
       the hook; the arm now loses the one deploying branch the same way the
       in-suite positive control does (main → mainx). */
    name: "the pre-push hook stops guarding main",
    file: ".githooks/pre-push",
    apply: (t) => t.replace("refs/heads/main)", "refs/heads/mainx)"),
  },
  {
    name: "the push detector stops matching the argv shape",
    file: "scripts/lib/pushPaths.mts",
    apply: (t) => t.replace('const ARGV_PUSH = /["\']git["\']\\s*,\\s*\\[\\s*["\']push["\']/;', "const ARGV_PUSH = /__never__/;"),
  },
  {
    name: "a NEW script reaches main and nobody enumerated it",
    create: "scripts/_263-unlisted-door-disposable.mts",
    body: "// a door nobody wrote down\nexecFileSync(\"git\", [\"push\", \"origin\", \"main\"]);\nprocess.exit(0);\n",
  },
  {
    name: "a workflow gains contents: write",
    file: ".github/workflows/knip.yml",
    apply: (t) => t.replace("permissions:\n  contents: read", "permissions:\n  contents: write"),
  },
  /* The three below are the PR review's findings, armed (2026-09-03). */
  {
    name: "a workflow stops declaring permissions at all (inherits the repo default)",
    file: ".github/workflows/knip.yml",
    apply: (t) => t.replace("permissions:\n  contents: read", "# permissions removed\n"),
  },
  {
    name: "the enumeration falls off the rite's push path",
    file: "scripts/lib/scriptGuards.mts",
    /* Anchored on the entry alone, not on the closing bracket after it — the
       bracket anchor broke the moment a second suite was added to the list, and
       the driver's own "changed nothing" refusal is what caught that rather
       than a silent MISS. */
    apply: (t) => t.replace('  "server/pushPathsToMain.test.ts",\n', ""),
  },
  {
    name: "a .cmd wrapper pushes — the native shape on the machine the rite runs on",
    create: "scripts/_263-unlisted-door-disposable.cmd",
    body: "@echo off\r\ngit push origin main\r\n",
  },
  /* The two below arm the typecheck's own verdict (second review round). */
  {
    name: "a run that produced NOTHING is read as a pass",
    file: "scripts/lib/typecheckOnCommit.mts",
    apply: (t) => t.replace('if (result.status === null || output.trim() === "") {', "if (false) {"),
  },
  {
    name: "a RED typecheck is reported as ok",
    file: "scripts/lib/typecheckOnCommit.mts",
    apply: (t) => t.replace("ok: result.status === 0,", "ok: true,"),
  },
];

console.log(`baseline (no sabotage):`);
const baseline = runSuite();
console.log(`  ${baseline.red ? "RED — fix the tree before driving sabotages" : "green"} · ${baseline.summary}`);
if (baseline.red) process.exit(1);

let caught = 0;
for (const sabotage of SABOTAGES) {
  const isCreate = "create" in sabotage;
  const target = path.join(ROOT, isCreate ? sabotage.create : sabotage.file);
  const original = isCreate ? null : readFileSync(target, "utf8");
  try {
    if (isCreate) {
      writeFileSync(target, sabotage.body, "utf8");
      /* ls-files only reports tracked paths, so the door must be staged to be
         in the population — which is exactly the state this reader is built to
         see (it reads the index for names and the disk for text). */
      spawnSync("git", ["add", "--intent-to-add", sabotage.create], { cwd: ROOT, encoding: "utf8" });
    } else {
      const sabotaged = sabotage.apply(original!);
      if (sabotaged === original) throw new Error(`sabotage "${sabotage.name}" changed nothing — it no longer matches the file`);
      writeFileSync(target, sabotaged, "utf8");
    }
    const verdict = runSuite();
    if (verdict.red) caught += 1;
    console.log(`  ${verdict.red ? "CAUGHT" : "MISSED"} — ${sabotage.name} · ${verdict.summary}`);
  } finally {
    /* Restored here and not after the log: a throw mid-sabotage once left a
       tree sabotaged and the next suite run lied about it. */
    if (isCreate) {
      spawnSync("git", ["rm", "--cached", "--force", "--quiet", sabotage.create], { cwd: ROOT, encoding: "utf8" });
      rmSync(target, { force: true });
    } else {
      writeFileSync(target, original!, "utf8");
    }
  }
}

console.log(`\n${caught}/${SABOTAGES.length} sabotages caught.`);
const after = runSuite();
console.log(`restored tree: ${after.red ? "RED — THE RESTORE FAILED" : "green"} · ${after.summary}`);
process.exit(caught === SABOTAGES.length && !after.red ? 0 : 1);
