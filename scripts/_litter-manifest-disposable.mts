/**
 * DISPOSABLE — **THE LITTER MANIFEST** (ordered fable-1675 §1, from the founder's
 * own "maybe do a full sweet to figure out how bad our mess is").
 *
 * Classifies every script and every untracked file as KEEP or DELETE, with the
 * REASON, so the purge is a manifest the reviewer approves rather than a
 * judgement call made at `rm` time.
 *
 * ⚠ **A script is KEPT when something that OUTLIVES this shift cites it.** The
 * authorities, in order:
 *   1. `docs/` — a design, a court's evidence, a decision log
 *   2. `CLAUDE.md` — the project's own instructions
 *   3. `server/**` and `client/**` — a test or a module referencing it
 *   4. `package.json` — anything a script alias invokes
 *   5. the NAMED KEEPERS below — paid-road drivers and instruments whose value
 *      is that they can be re-run, not that they are cited
 *
 * ⚠ **The MAILBOX is deliberately NOT an authority.** `.agents/` is never
 * committed, so a citation there dies with the shift's transcript; counting it
 * would keep hundreds of scripts on the strength of a file the repo does not
 * have. Mailbox-only citations are COUNTED SEPARATELY and reported, because
 * "cited nowhere durable" is a different fact from "cited nowhere".
 *
 * Read-only. It deletes nothing and prints the manifest. No network, no spend.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const git = (args: string[]) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
    .split(/\r?\n/).filter(Boolean);

/*
  NAMED KEEPERS — kept for what they can DO rather than for who cites them.
  Every one is either a paid-road driver, a standing instrument, or a ceremony.
*/
const KEEPER_PATTERNS = [
  /^scripts\/deploy-rite\.mts$/,
  /^scripts\/ceremony-/,
  /^scripts\/generate-architecture\.mts$/,
  /^scripts\/capability-atlas/,
  /^scripts\/check-cleanup-dispositions\.mts$/,
  /^scripts\/diff-importer-count-across-time\.mts$/,
  /^scripts\/campaign-ledger-/,
  /^scripts\/lib\//,
  /^scripts\/SKELETON-disposable\.mts$/,
  /^scripts\/court-/,
  /^scripts\/migrate-storage-urls\.ts$/,
  /^scripts\/subjectless-arm-census\.mts$/,
];

const tracked = git(["ls-files"]);
const untracked = git(["ls-files", "--others", "--exclude-standard"]);

const scriptsTracked = tracked.filter((f) => f.startsWith("scripts/"));
const scriptsUntracked = untracked.filter((f) => f.startsWith("scripts/"));
const outputUntracked = untracked.filter((f) => f.startsWith("output/"));
const otherUntracked = untracked.filter((f) => !f.startsWith("scripts/") && !f.startsWith("output/"));

/*
  THE CITATION INDEX. Built once by reading every authority file into one string
  per authority, so the per-script test is a substring check rather than 900
  greps. A basename is enough: a citation writes the filename.
*/
const authorityFiles = [
  ...tracked.filter((f) => f.startsWith("docs/") && /\.(md|ya?ml|json)$/.test(f)),
  ...tracked.filter((f) => f.startsWith("server/") || f.startsWith("client/") || f.startsWith("shared/")),
  "CLAUDE.md",
  "package.json",
];
let authority = "";
for (const file of authorityFiles) {
  try { authority += readFileSync(file, "utf8"); } catch { /* a listed file may be gone */ }
}
if (authority.length < 100_000) {
  throw new Error(`the authority index is only ${authority.length} chars — it did not read; every script would read as UNCITED`);
}

const founderQueue = (() => {
  try { return readFileSync(".agents/mailbox/founder-queue.md", "utf8"); } catch { return ""; }
})();

let mailbox = "";
for (const file of git(["ls-files", "--others", "--exclude-standard", ".agents/"]).slice(0, 4000)) {
  if (!file.endsWith(".md")) continue;
  try { mailbox += readFileSync(file, "utf8"); } catch { /* ignore */ }
}

const base = (path: string) => path.split("/").pop()!;
const keeper = (path: string) => KEEPER_PATTERNS.some((re) => re.test(path));

/*
  ⚠ GUARD (a), fable-1676 §3.1 — THE FOUNDER'S QUEUE COVERS `scripts/` TOO.
  It was added for `output/` after the first manifest would have deleted three
  sets of frames from his desk; the ruling made the cross mandatory on BOTH
  delete sets, and a script he was told to run is the same class of artifact as
  a picture he was told to look at.
*/
const onHisDesk = (path: string) => founderQueue.includes(path) || founderQueue.includes(base(path));

/*
  ⚠ GUARD (b), fable-1676 §3.1 — THE 7-DAY RULE.

  *"Uncited is true of every document the day it is written"* generalises past
  `docs/`: this week's court scripts have not had time to be cited by anything,
  and deleting them would delete the work the sweep was ordered from. Anything
  touched inside the window waits for the next sweep.

  The timestamp is the LATER of the file's mtime and its last commit date, so a
  script committed today but written weeks ago is still recent, and a tracked
  file rewritten today without a commit is too. Recency keeps; it never deletes.
*/
const WINDOW_DAYS = 7;
const NOW = Number(process.env.SWEEP_NOW_MS ?? Date.now());
const commitTimes = new Map<string, number>();
let lastStamp = 0;
for (const line of git(["log", "--since", `${WINDOW_DAYS + 1} days ago`, "--name-only", "--format=%ct"])) {
  if (/^\d{9,}$/.test(line)) { lastStamp = Number(line) * 1000; continue; }
  const prior = commitTimes.get(line) ?? 0;
  if (lastStamp > prior) commitTimes.set(line, lastStamp);
}
function touchedRecently(path: string): boolean {
  let newest = commitTimes.get(path) ?? 0;
  try { newest = Math.max(newest, statSync(path).mtimeMs); } catch { /* gone */ }
  return NOW - newest < WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

type Verdict = { path: string; keep: boolean; why: string };
const classify = (path: string): Verdict => {
  /*
    ⚠ AN UNTRACKED DOC IS A COMMIT CANDIDATE, NOT LITTER — and the first version
    of this classifier said DELETE for `docs/specs/CREATIVE_CASTS_RESEARCH.md`,
    which is an ACTIVE research document the founder's own fable-1666 ruling
    points at. "Uncited" is true of every document on the day it is written, so
    applying the citation test to `docs/` reads newness as worthlessness.
  */
  if (path.startsWith("docs/")) return { path, keep: true, why: "COMMIT — untracked doc, not litter" };
  if (keeper(path)) return { path, keep: true, why: "named keeper" };
  const name = base(path);
  if (authority.includes(name)) return { path, keep: true, why: "cited in docs/code/CLAUDE.md" };
  if (onHisDesk(path)) return { path, keep: true, why: "ON HIS DESK (founder-queue)" };
  if (touchedRecently(path)) return { path, keep: true, why: `touched inside the ${WINDOW_DAYS}-day window` };
  if (mailbox.includes(name)) return { path, keep: false, why: "MAILBOX-ONLY citation (not durable)" };
  return { path, keep: false, why: "uncited" };
};

const report = (label: string, paths: string[]) => {
  const verdicts = paths.map(classify);
  const keep = verdicts.filter((v) => v.keep);
  const drop = verdicts.filter((v) => !v.keep);
  const mailboxOnly = drop.filter((v) => v.why.startsWith("MAILBOX"));
  console.log(`\n══ ${label} — ${paths.length} files ══`);
  /*
    ⚠ ONE LINE PER REASON, not "keepers and everything else". The first version
    printed `N named keepers, M cited` and the guards added at fable-1676 landed
    in the `cited` bucket — so a count of 16 genuinely-cited untracked scripts
    reported as 256. A breakdown whose buckets stop matching the reasons is how a
    manifest's headline stops describing the manifest.
  */
  const byReason = new Map<string, number>();
  for (const v of keep) byReason.set(v.why, (byReason.get(v.why) ?? 0) + 1);
  console.log(`  KEEP   ${keep.length}`);
  for (const [why, n] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`           ${String(n).padStart(4)}  ${why}`);
  }
  console.log(`  DELETE ${drop.length}   (of which ${mailboxOnly.length} are cited ONLY in the mailbox)`);
  return { verdicts, keep, drop };
};

console.log("THE LITTER MANIFEST (fable-1675 §1) — nothing is deleted by this script\n");
console.log(`tracked files ${tracked.length} · untracked ${untracked.length}`);

const t = report("TRACKED scripts/", scriptsTracked);
const u = report("UNTRACKED scripts/", scriptsUntracked);

console.log(`\n══ THE KEEP LIST, tracked scripts/ (${t.keep.length}) ══`);
for (const v of t.keep) console.log(`  ${v.path}   [${v.why}]`);

console.log(`\n══ THE KEEP LIST, untracked scripts/ (${u.keep.length}) ══`);
for (const v of u.keep) console.log(`  ${v.path}   [${v.why}]`);

console.log(`\n══ UNTRACKED, NOT scripts/ and NOT output/ — ${otherUntracked.length} files ══`);
for (const path of otherUntracked) {
  const v = classify(path);
  console.log(`  ${v.keep ? "KEEP  " : "DELETE"} ${path}   [${v.why}]`);
}

/* output/ by top-level directory, with sizes, because 6.9GB is the headline. */
console.log(`\n══ output/ — ${outputUntracked.length} untracked files ══`);
const dirs = new Map<string, { files: number; bytes: number }>();
for (const path of outputUntracked) {
  const top = path.split("/")[1] ?? "(root)";
  const row = dirs.get(top) ?? { files: 0, bytes: 0 };
  row.files += 1;
  try { row.bytes += statSync(path).size; } catch { /* ignore */ }
  dirs.set(top, row);
}
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
/*
  ⚠ THE FOUNDER'S OWN QUEUE IS AN AUTHORITY FOR `output/`, AND THIS CLAUSE WAS
  ADDED AFTER THE FIRST MANIFEST WOULD HAVE DELETED THREE OF ITS ARTIFACTS.

  `founder-queue.md` names six `output/` paths. Three of them — `eyes-court`,
  `open-crop-carry`, `outsider-rail` — landed in the REVIEW (uncited) column,
  because no committed document happens to name them. **They are frames HE was
  asked to look at.** Deleting them destroys the evidence behind a question on
  his desk, which is a different and worse thing than deleting a court's spent
  frames.

  It is the one place the mailbox exclusion above is wrong, and the reason is
  narrow enough to state: `.agents/` dying with the transcript is an argument
  about CITATIONS, not about ARTIFACTS. A picture he was pointed at outlives the
  message that pointed at it.
*/
const CITED_OUTPUT = /^(deploy-receipts|raw-prompt-reference)$/;
for (const [dir, row] of [...dirs.entries()].sort((a, b) => b[1].bytes - a[1].bytes)) {
  const desk = founderQueue.includes(`output/${dir}`);
  const recent = outputUntracked.some((f) => f.startsWith(`output/${dir}/`) && touchedRecently(f));
  const cited = CITED_OUTPUT.test(dir) || authority.includes(`output/${dir}`) || desk || recent;
  console.log(`  ${cited ? "KEEP  " : "REVIEW"} ${String(row.files).padStart(5)} files  ${mb(row.bytes).padStart(10)}  output/${dir}${desk ? "   ← ON HIS DESK" : recent ? "   ← inside the 7-day window" : ""}`);
}
console.log(`  ${"".padStart(6)} ${String(outputUntracked.length).padStart(5)} files  ${mb([...dirs.values()].reduce((a, b) => a + b.bytes, 0)).padStart(10)}  TOTAL`);

console.log("\n⚠ A KEEP is a CITATION, not a judgement of value. A script cited only in the mailbox");
console.log("  is marked DELETE because `.agents/` is never committed — the citation dies with the");
console.log("  transcript. That count is reported separately so the reviewer can overrule it.");

process.exit(0);
