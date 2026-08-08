/**
 * DOES THE FILE COME BACK WHEN THE DRIVER IS KILLED MID-SWEEP?
 *
 * 2026-08-09: `npx tsx prove-prune-guard-disposable.mts | grep … | tail -8`
 * killed the driver with SIGPIPE the moment `tail` had enough. A mutation was
 * applied and never restored, and the working tree carried a **deliberate
 * removal bug** through a full suite run that was then reported green. The suite
 * was fine; it was measuring sabotaged source, and `git status` was the only
 * tell.
 *
 * The fix is a process-level restore in `sabotage.mts`. Working law 2 says that
 * fix gets a positive AND a negative control before its verdict counts, so:
 *
 *   POSITIVE — a child applies a sabotage and dies without calling restore().
 *              The file must be byte-identical afterwards.
 *   NEGATIVE — the same check is run against a file this script dirtied ITSELF.
 *              It must report DIRTY. A checker that cannot fail proves nothing,
 *              and "the file matches" is exactly the kind of assertion that
 *              passes when it is measuring nothing.
 *
 *   npx tsx scripts/prove-sabotage-survives-death-disposable.mts
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";

/* A file nobody else is editing, chosen so a bug here cannot corrupt source. */
const TARGET = "output/sabotage-victim.txt";
const BODY = "the quick brown fox\njumps over the lazy dog\n";
const CHILD = "output/sabotage-child-disposable.mts";

const clean = (): boolean => readFileSync(TARGET, "utf8") === BODY;

writeFileSync(TARGET, BODY);
writeFileSync(CHILD, [
  `import { sabotage } from "../scripts/lib/sabotage.mts";`,
  `await sabotage("${TARGET}", [{ find: "lazy", replace: "SABOTAGED" }]);`,
  `/* And now the driver dies exactly the way SIGPIPE killed it: no restore. */`,
  `process.exit(3);`,
].join("\n"));

let failures = 0;

/* POSITIVE — the child applies a mutation and exits without restoring. */
let childExit = 0;
try {
  execFileSync("npx", ["tsx", CHILD], { stdio: "pipe", shell: true });
} catch (error) {
  childExit = (error as { status?: number }).status ?? -1;
}
const survived = clean();
console.log(`${survived ? "PASS" : "FAIL"}  POSITIVE — child died (exit ${childExit}) and the file came back`);
if (!survived) {
  failures += 1;
  console.log(`        file now reads: ${JSON.stringify(readFileSync(TARGET, "utf8"))}`);
}

/* NEGATIVE — dirty it by hand and confirm the check SAYS SO. */
writeFileSync(TARGET, BODY.replace("lazy", "SABOTAGED"));
const noticed = !clean();
console.log(`${noticed ? "PASS" : "FAIL"}  NEGATIVE — a file left dirty is reported dirty (the check can fail)`);
if (!noticed) failures += 1;

writeFileSync(TARGET, BODY);
unlinkSync(CHILD);
unlinkSync(TARGET);

console.log(failures === 0
  ? "\nA killed sabotage driver leaves no mutation behind, and the check that says so can fail."
  : `\n${failures} control(s) failed — the process-level restore is not trustworthy.`);
process.exit(failures === 0 ? 0 : 1);
