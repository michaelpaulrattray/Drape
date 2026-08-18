/**
 * THE SWEEP'S LIST, SPLIT BY WHY EACH ENTRY IS ON IT (cleanup milestone recon,
 * ordered fable-975 §5). READ-ONLY: it opens files and prints; it changes
 * nothing.
 *
 * The sweep names three biases that all point toward silence — namespace
 * imports, dynamic specifiers, and barrel re-exports — and says its list is
 * therefore a FLOOR. That is true of the count and misleading about the work:
 * a candidate reached through a barrel is not a candidate at all, and three
 * hand-checks found two of them in the first six symbols I looked at
 * (`db.isAccountLocked` through `server/db/index.ts`; `handleSlackInteraction`
 * through a dynamic import with a static specifier).
 *
 * So this asks, for every symbol the sweep printed, the question the triage
 * actually needs: **is there any non-test mention of this name anywhere that is
 * not its own declaration?** — and if so, of which kind.
 *
 *   barrel    named in server/db/index.ts (or another re-export) and used as
 *             `db.NAME(` / `NAME(` by production code
 *   dynamic   inside an `await import(...)` destructure
 *   other     some other production mention — a hand read decides
 *   none      nothing but its own declaration and its tests. THE REAL LIST.
 *
 * CONTROLS (working law 2), printed first, run refuses on failure:
 *   positive  shouldSendGlobalAttackAlert  hand-read 2026-08-18: declaration
 *                                          only → must classify `none`
 *   negative  isAccountLocked              hand-read: reached as
 *                                          `db.isAccountLocked` from two auth
 *                                          routes → must NOT classify `none`
 *
 *   npx tsx scripts/triage-uncalled-exports-disposable.mts <sweep-output-file>
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildClassifier,
  REPO_ROOT,
  runMentionControls,
  type MentionKind,
} from "./lib/productionMention.mts";

/*
  The classifier moved to `lib/productionMention.mts` so the SWEEP can print the
  intersection itself (fable-982). This file keeps the CLI and the report; the
  question it asks is now asked in one place by both instruments.
*/
const repoRoot = REPO_ROOT;
const listFile = process.argv[2];
if (!listFile) throw new Error("give me the sweep's saved output");

const classify = buildClassifier(repoRoot);
type Kind = MentionKind;

/* ---- CONTROLS ---- */
console.log("CONTROLS");
if (!runMentionControls(classify, (line) => console.log(line))) {
  console.log("\nREFUSED — the classifier failed its own controls; no verdict printed.");
  process.exit(1);
}
console.log();

const symbols = readFileSync(resolve(listFile), "utf8").split(/\r?\n/)
  .map((line) => line.match(/^\s{2}(?:function|const|class|type|interface)\s+(\S+)\s+(\S+)$/))
  .filter((match): match is RegExpMatchArray => match !== null)
  .map((match) => ({ symbol: match[1]!, file: match[2]! }));

const byKind: Record<Kind, Array<{ symbol: string; file: string; where: string }>> = {
  barrel: [], dynamic: [], other: [], none: [],
};
for (const entry of symbols) {
  const verdict = classify(entry.symbol);
  byKind[verdict.kind].push({ ...entry, where: verdict.where });
}

console.log(`${symbols.length} symbols off the sweep\n`);
for (const kind of ["none", "other", "barrel", "dynamic"] as const) {
  console.log(`${kind.toUpperCase()} — ${byKind[kind].length}`);
  for (const entry of byKind[kind]) {
    console.log(`  ${entry.symbol.padEnd(44)} ${entry.file}`);
    if (kind === "other") console.log(`      ${entry.where}`);
  }
  console.log();
}

/* A script ends by ending the process (`scriptExitDiscipline.test.ts`). This one
   opens nothing but the filesystem; the rule is deliberately wider than the
   handles a file happens to hold. */
process.exit(0);
