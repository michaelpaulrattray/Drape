/**
 * THE UN-WIRING TIMELINE — *was this symbol EVER wired?*, asked of the whole
 * history at once.
 *
 * `diff-importer-count-across-time.mts` is the two-tree reading: it answers
 * *did something STOP calling this, between HERE and THERE*, and the retirement
 * program runs it over its own window before a sitting closes. This is the same
 * reader walked across the entire history, and it answers a question the
 * pairwise form structurally cannot:
 *
 *   npx tsx scripts/unwiring-timeline.mts <worktree> [stride] [out.json]
 *   git worktree add --detach C:/tmp/unwire-tiles 3dad2280   # then remove it
 *
 * Every symbol ever declared is classified against HEAD — `died`, `revived`,
 * `deleted`, `dark-born`, `wired-at-head` (`lib/importerCountDiff.mts` carries
 * the definitions and the classifier's own limits).
 *
 * # WHY IT EXISTS: THE MISS IS A CONFIDENT WRONG ROAD, NOT A SILENCE
 *
 * The pairwise differ's docblock states its gap — a symbol born AND un-wired
 * inside one window is invisible — and demonstrates it on the February tile
 * that reported ZERO while both deaths that morning were inside it. What that
 * paragraph did not say is what the reading returns INSTEAD, and it is the
 * worse half. Measured on the real history 2026-08-23, the same reading, the
 * same specimen, two tile sizes:
 *
 *   stride 400   isSensitiveAction -> dark-born   "never had a production
 *                importer at any boundary"  ......... PATH ONE
 *   stride 10    isSensitiveAction -> died        last wired 2026-02-07,
 *                `git log -S` hands you 3cb0cdee  ... PATH THREE
 *
 * CLAUDE.md: *"A list that files a path-three death as a path-one death is not
 * merely incomplete — it is pointing every future repair at the wrong
 * question."* A coarse tile does exactly that, mechanically. **Every zero is
 * only as trustworthy as its tile is fine**, and this script makes the tile an
 * argument rather than a property of whoever chose two commits.
 *
 * # CONTROLS — three REAL specimens, one per class, before any verdict prints
 *
 *   isSensitiveAction        died     3cb0cdee, 2026-02-07, the routers.ts split
 *   getRecentTopupCredits    deleted  live 02-06 to 02-07, symbol cut 2026-08-19
 *   recordGlobalFailedLogin  revived  killed 2026-04-03 by b1f5187d, re-wired
 *                                     2026-08-19 — mis-filed for four and a
 *                                     half months as a control never wired
 *   logAdminAction           NEGATIVE it kept its importers throughout
 *
 * Fixtures would only model what their author expected; these are the product's
 * own accidents, each with a commit that can be read. A control failing REFUSES
 * the report — a classification printed over a broken reading is worse than no
 * reading, because it looks like a clean bill of health.
 *
 * The arms that need no worktree are `server/unwiringTimeline.test.ts`,
 * including the intermediate-boundary pair that makes the stride fact above a
 * mechanical property rather than an anecdote.
 *
 * # LIMITS, inherited and stated
 *
 * Everything `lib/importerCountDiff.mts` states: one hop (a dead importer still
 * counts), a call site after an early return is invisible, dynamic specifiers
 * unresolved, one row per symbol NAME across the tree. Two of its own:
 * `dark-born` includes symbols whose only consumer is a ceremony or audit
 * script (13 of 19 control-shaped names, measured), and a finer stride shrinks
 * the born-and-killed-inside-one-tile gap without ever closing it.
 *
 * **A clean run is a floor, not coverage. A finding is a question.**
 *
 * Reading only: one detached worktree, no network, no database, no credits.
 */
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

import {
  classifyTimeline,
  newTimeline,
  observeTree,
  readTree,
  type TimelineKind,
  type TimelineRow,
} from "./lib/importerCountDiff.mts";

const WORKTREE = process.argv[2];
const STRIDE = Number(process.argv[3] ?? 10);
const OUT = process.argv[4] ?? "output/unwiring-timeline.json";

if (!WORKTREE || !existsSync(WORKTREE)) {
  console.error("usage: unwiring-timeline.mts <worktree> [stride] [out.json]");
  console.error("  git worktree add --detach C:/tmp/unwire-tiles 3dad2280");
  process.exit(2);
}
if (!Number.isInteger(STRIDE) || STRIDE < 1) {
  console.error(`stride must be a positive integer; got ${process.argv[3]}`);
  process.exit(2);
}

const git = (args: string[], cwd = process.cwd()) =>
  execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const history = git(["rev-list", "--reverse", "HEAD"]).trim().split("\n");
const head = history[history.length - 1]!;
const boundaries: string[] = [];
for (let i = 0; i < history.length; i += STRIDE) boundaries.push(history[i]!);
if (boundaries[boundaries.length - 1] !== head) boundaries.push(head);

console.log(`history ${history.length} commits · stride ${STRIDE} · ${boundaries.length} boundaries`);

const timeline = newTimeline();
const shas: string[] = [];
const dates: string[] = [];
let headTree: ReturnType<typeof readTree> | null = null;
const started = Date.now();

for (let i = 0; i < boundaries.length; i++) {
  const sha = boundaries[i]!;
  git(["checkout", "--detach", "--force", sha], WORKTREE);
  const tree = readTree(WORKTREE);
  observeTree(timeline, i, tree);
  shas.push(sha);
  dates.push(git(["show", "-s", "--format=%cI", sha]).trim());
  if (i === boundaries.length - 1) headTree = tree;
  if (i % 20 === 0 || i === boundaries.length - 1) {
    console.log(
      `  [${String(i).padStart(3)}/${boundaries.length - 1}] ${sha.slice(0, 8)} ${dates[i]!.slice(0, 10)}` +
        `  ${tree.files} files / ${tree.decl.size} exports  (${((Date.now() - started) / 1000).toFixed(0)}s)`,
    );
  }
}

if (!headTree) {
  console.error("no HEAD tree was read — refusing to report");
  process.exit(1);
}

const rows = classifyTimeline(timeline, headTree);
const rowOf = (name: string) => rows.find((row) => row.name === name);
const at = (index: number | null) =>
  index === null ? "" : ` · ${dates[index]!.slice(0, 10)} ${shas[index]!.slice(0, 8)}`;
const describe = (name: string) => {
  const row = rowOf(name);
  if (!row) return "NOT PRESENT AT ANY BOUNDARY";
  return row.kind === "revived"
    ? `revived · dark until${at(row.darkAfterWiredIndex)}`
    : `${row.kind}${row.kind === "wired-at-head" ? "" : ` · last wired${at(row.lastWiredIndex)}`}`;
};

/* ---- CONTROLS FIRST. A verdict printed before these pass is not a reading. -- */
const failures: string[] = [];
const check = (label: string, ok: boolean, detail: string) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(46)} ${detail}`);
  if (!ok) failures.push(label);
};

console.log("\nCONTROLS");
check(
  "sanity    the tiling read real trees",
  headTree.decl.size > 500 && boundaries.length > 20,
  `${boundaries.length} boundaries · HEAD ${headTree.files} files / ${headTree.decl.size} exports`,
);
check(
  "sanity    the population is more than one tree's",
  timeline.everDeclared.size > headTree.decl.size,
  `${timeline.everDeclared.size} names ever declared vs ${headTree.decl.size} at HEAD`,
);
check("positive  REAL: the sensitive-action gate", rowOf("isSensitiveAction")?.kind === "died", describe("isSensitiveAction"));
check("positive  REAL: a credit-velocity cap", rowOf("getRecentTopupCredits")?.kind === "deleted", describe("getRecentTopupCredits"));
check("positive  REAL: the login-attack detector", rowOf("recordGlobalFailedLogin")?.kind === "revived", describe("recordGlobalFailedLogin"));
check("negative  a symbol that kept its importers", rowOf("logAdminAction")?.kind === "wired-at-head", describe("logAdminAction"));

if (failures.length > 0) {
  console.log(`\nREFUSING TO REPORT — ${failures.length} control(s) failed.`);
  process.exit(1);
}

const KINDS: TimelineKind[] = ["wired-at-head", "dark-born", "died", "revived", "deleted"];
console.log("\nCLASSES");
for (const kind of KINDS) {
  console.log(`  ${kind.padEnd(14)} ${String(rows.filter((row) => row.kind === kind).length).padStart(5)}`);
}

const died = rows
  .filter((row): row is TimelineRow & { lastWiredIndex: number } => row.kind === "died" && row.lastWiredIndex !== null)
  .sort((a, b) => a.lastWiredIndex - b.lastWiredIndex);

console.log(`\nDIED — wired once, still in the tree, ZERO production importers at HEAD (${died.length})`);
for (const row of died) {
  console.log(
    `  ${dates[row.lastWiredIndex]!.slice(0, 10)}  ${row.name.padEnd(40)} ${row.declaredAt}` +
      `  [${row.selfUsesAtHead > 0 ? "self-consulted" : "fully-dark"}]`,
  );
  console.log(`              lost: ${row.lostImporters.join(", ")}`);
  console.log(`              read it: git log -S ${row.name} --oneline -- ${row.lostImporters[0] ?? ""}`);
}

writeFileSync(OUT, JSON.stringify({ stride: STRIDE, shas, dates, rows }, null, 2));
console.log(`\nwrote ${OUT}`);
process.exit(0);
