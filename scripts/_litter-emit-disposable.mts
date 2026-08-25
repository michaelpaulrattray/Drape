/**
 * DISPOSABLE — writes the purge manifest the DELETION COMMIT carries
 * (fable-1676 §3.1: *"The FULL delete manifest (names + classification) is
 * COMMITTED IN THE DELETION COMMIT so the record survives the transcript"*).
 *
 * It re-derives the classification by IMPORTING nothing and re-running the same
 * rules — the manifest script prints, this one emits, and they must not drift.
 * ⚠ So the rules live HERE and the printing script's numbers are checked against
 * this file's output by hand before the deletion: two readers of one population
 * is the shape this campaign uses everywhere else, and a manifest that emitted a
 * different list from the one the reviewer approved would be the worst possible
 * version of this defect.
 *
 * Deletes nothing. Writes:
 *   docs/specs/CASTING_V2_LITTER_PURGE_MANIFEST.md   the committed record
 *   output/_purge/tracked.txt · untracked.txt · outputdirs.txt   the lists
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";

const git = (args: string[]) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
    .split(/\r?\n/).filter(Boolean);

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
if (founderQueue.length < 1000) {
  throw new Error("founder-queue.md did not read — guard (a) would pass everything and delete his own artifacts");
}

const base = (path: string) => path.split("/").pop()!;
const keeper = (path: string) => KEEPER_PATTERNS.some((re) => re.test(path));
const onHisDesk = (path: string) => founderQueue.includes(path) || founderQueue.includes(base(path));

const WINDOW_DAYS = 7;
const NOW = Date.now();
const commitTimes = new Map<string, number>();
let lastStamp = 0;
for (const line of git(["log", "--since", `${WINDOW_DAYS + 1} days ago`, "--name-only", "--format=%ct"])) {
  if (/^\d{9,}$/.test(line)) { lastStamp = Number(line) * 1000; continue; }
  if ((commitTimes.get(line) ?? 0) < lastStamp) commitTimes.set(line, lastStamp);
}
function touchedRecently(path: string): boolean {
  let newest = commitTimes.get(path) ?? 0;
  try { newest = Math.max(newest, statSync(path).mtimeMs); } catch { /* gone */ }
  return NOW - newest < WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

type Verdict = { path: string; keep: boolean; why: string };
const classify = (path: string): Verdict => {
  if (path.startsWith("docs/")) return { path, keep: true, why: "COMMIT — untracked doc, not litter" };
  if (keeper(path)) return { path, keep: true, why: "named keeper" };
  if (authority.includes(base(path))) return { path, keep: true, why: "cited in docs/code/CLAUDE.md" };
  if (onHisDesk(path)) return { path, keep: true, why: "ON HIS DESK (founder-queue)" };
  if (touchedRecently(path)) return { path, keep: true, why: `touched inside the ${WINDOW_DAYS}-day window` };
  return { path, keep: false, why: "uncited" };
};

const dropTracked = scriptsTracked.map(classify).filter((v) => !v.keep);
const dropUntracked = scriptsUntracked.map(classify).filter((v) => !v.keep);
const dropOther = otherUntracked.map(classify).filter((v) => !v.keep);

const dirs = new Map<string, { files: number; bytes: number }>();
for (const path of outputUntracked) {
  const top = path.split("/")[1] ?? "(root)";
  const row = dirs.get(top) ?? { files: 0, bytes: 0 };
  row.files += 1;
  try { row.bytes += statSync(path).size; } catch { /* ignore */ }
  dirs.set(top, row);
}
const CITED_OUTPUT = /^(deploy-receipts|raw-prompt-reference|_purge)$/;
const reviewDirs = [...dirs.entries()]
  .filter(([dir]) => !(CITED_OUTPUT.test(dir)
    || authority.includes(`output/${dir}`)
    || founderQueue.includes(`output/${dir}`)
    || outputUntracked.some((f) => f.startsWith(`output/${dir}/`) && touchedRecently(f))))
  .sort((a, b) => b[1].bytes - a[1].bytes);

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const keptDirs = dirs.size - reviewDirs.length;
const keptBytes = [...dirs.values()].reduce((a, b) => a + b.bytes, 0) - reviewDirs.reduce((a, b) => a + b[1].bytes, 0);

const out: string[] = [];
const w = (line = "") => out.push(line);

w("# The litter purge — the manifest the deletion commit carries");
w();
w("Ordered fable-1675 §1 from the founder's own words — *\"i feel like we have made so");
w("many scope changes and interations my brain literally cant keep up… maybe do a full");
w("sweet to figure out how bad our mess is\"* — and authorized fable-1676 §3 with two");
w("added guards.");
w();
w("**A KEEP is a CITATION, never a judgement of value.** Authorities: `docs/`,");
w("`CLAUDE.md`, `server`/`client`/`shared`, `package.json`, and the named keepers (the");
w("deploy rite, every ceremony, the Atlas and capability generators, the un-wiring");
w("differ, the ledger readers, `scripts/lib`, every `court-*` runner).");
w();
w("**The two guards fable-1676 added, and both of them changed the answer:**");
w();
w("- **(a) Anything on the founder's desk is kept.** `founder-queue.md` names six");
w("  `output/` paths and three of them — `eyes-court`, `open-crop-carry`,");
w("  `outsider-rail` — were in the uncited column, because no committed document");
w("  happens to name them. They are frames he was asked to look at. The guard covers");
w("  `scripts/` too, and caught one there.");
w("- **(b) The 7-day rule.** *\"Uncited is true of every document the day it is");
w("  written\"* generalises past `docs/`: this week's court scripts have not had time");
w("  to be cited by anything. The timestamp is the LATER of the file's mtime and its");
w("  last commit date, so recency only ever keeps.");
w();
w("```");
w(`tracked scripts/      ${String(scriptsTracked.length).padStart(5)} files   DELETE ${dropTracked.length}`);
w(`untracked scripts/    ${String(scriptsUntracked.length).padStart(5)} files   DELETE ${dropUntracked.length}`);
w(`untracked elsewhere   ${String(otherUntracked.length).padStart(5)} files   DELETE ${dropOther.length}`);
w(`output/               ${String(outputUntracked.length).padStart(5)} files   DELETE ${reviewDirs.reduce((a, b) => a + b[1].files, 0)}`);
w(`                                       in ${reviewDirs.length} directories, ${mb(reviewDirs.reduce((a, b) => a + b[1].bytes, 0))}`);
w(`                              KEPT     ${keptDirs} directories, ${mb(keptBytes)}`);
w("```");
w();
w("## What was NOT touched");
w();
w("`.agents/`, `docs/`, `memory`, every tracked source file, and every `output/`");
w("directory that is cited, on his desk, or inside the window — including");
w("`deploy-receipts` and `raw-prompt-reference`.");
w();
w("---");
w();
w("## The deleted files");
w();
for (const [label, rows] of [
  ["tracked `scripts/`", dropTracked],
  ["untracked `scripts/`", dropUntracked],
  ["untracked, elsewhere", dropOther],
] as const) {
  w(`### ${label} — ${rows.length}`);
  w();
  for (const row of rows) w(`- \`${row.path}\``);
  w();
}
w(`### \`output/\` directories removed — ${reviewDirs.length}`);
w();
for (const [dir, row] of reviewDirs) w(`- \`output/${dir}\` — ${row.files} files, ${mb(row.bytes)}`);
w();

writeFileSync("docs/specs/CASTING_V2_LITTER_PURGE_MANIFEST.md", `${out.join("\n")}\n`, "utf8");
mkdirSync("output/_purge", { recursive: true });
writeFileSync("output/_purge/tracked.txt", `${dropTracked.map((v) => v.path).join("\n")}\n`, "utf8");
writeFileSync("output/_purge/untracked.txt", `${[...dropUntracked, ...dropOther].map((v) => v.path).join("\n")}\n`, "utf8");
writeFileSync("output/_purge/outputdirs.txt", `${reviewDirs.map(([dir]) => `output/${dir}`).join("\n")}\n`, "utf8");

console.log("wrote docs/specs/CASTING_V2_LITTER_PURGE_MANIFEST.md");
console.log(`  tracked scripts   DELETE ${dropTracked.length}`);
console.log(`  untracked scripts DELETE ${dropUntracked.length}`);
console.log(`  elsewhere         DELETE ${dropOther.length}`);
console.log(`  output/ dirs      DELETE ${reviewDirs.length}  (${mb(reviewDirs.reduce((a, b) => a + b[1].bytes, 0))})`);
console.log(`  output/ dirs      KEEP   ${keptDirs}  (${mb(keptBytes)})`);

process.exit(0);
