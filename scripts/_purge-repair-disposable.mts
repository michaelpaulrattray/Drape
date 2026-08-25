/**
 * DISPOSABLE — **THE PURGE DELETED MODULES THAT SURVIVING SCRIPTS IMPORT.**
 *
 * The manifest's authorities were `docs/`, `CLAUDE.md`, `server`/`client`/
 * `shared` and `package.json`. **`scripts/` was not an authority over itself**,
 * so a helper imported only by other scripts read as uncited — and
 * `scripts/calibration/lib/*` went, breaking six surviving calibration scripts
 * at `pnpm check`.
 *
 * That is the manifest's real hole and it is worth naming rather than patching:
 * a citation index that excludes the population it is classifying cannot see the
 * population's internal edges. The Atlas learned the same lesson about
 * re-exports and dynamic imports.
 *
 * This walks every SURVIVING script's relative imports, resolves them, and
 * reports every one that points at a deleted file. It restores the TRACKED ones
 * (they are in git) and it can only REPORT the untracked ones, which are gone.
 *
 *   npx tsx scripts/_purge-repair-disposable.mts            report only
 *   npx tsx scripts/_purge-repair-disposable.mts --restore  restore the tracked
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const git = (args: string[]) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 })
    .split(/\r?\n/).filter(Boolean);

const RESTORE = process.argv.includes("--restore");

const survivingTracked = git(["ls-files", "scripts/"]);
const survivingUntracked = git(["ls-files", "--others", "--exclude-standard", "scripts/"]);
const surviving = [...survivingTracked, ...survivingUntracked];

const deletedTracked = new Set(git(["diff", "--cached", "--name-only", "--diff-filter=D"]));
const deletedUntracked = new Set(
  existsSync("output/_purge/untracked.txt")
    ? readFileSync("output/_purge/untracked.txt", "utf8").split(/\r?\n/).filter(Boolean)
    : [],
);
if (deletedTracked.size === 0 && deletedUntracked.size === 0) {
  throw new Error("no deletions found — this reader has nothing to check and a clean run would mean nothing");
}

/* Every relative specifier, with and without an extension. */
const SPECIFIER = /from\s+["'](\.[^"']+)["']|import\s*\(\s*["'](\.[^"']+)["']\s*\)/g;
const CANDIDATES = ["", ".mts", ".ts", ".js", ".mjs", "/index.mts", "/index.ts"];

type Break = { importer: string; specifier: string; target: string; tracked: boolean };
const breaks: Break[] = [];

for (const importer of surviving) {
  let text: string;
  try { text = readFileSync(importer, "utf8"); } catch { continue; }
  for (const match of text.matchAll(SPECIFIER)) {
    const specifier = match[1] ?? match[2]!;
    /*
      ⚠ `.mjs` HAD TO BE ADDED AFTER `pnpm check` FOUND ONE THIS READER MISSED.
      A `.mts` module is imported as `./x.mjs` (TypeScript's own emit-extension
      rule), and stripping only `.js` left `./lib/speckDensity.mjs` unresolvable
      and therefore invisible — a reader whose extension list is shorter than the
      language's reports a clean run.
    */
    const bare = specifier.replace(/\.(m?js)$/, "");
    let resolvedTo: string | null = null;
    let missing = true;
    for (const suffix of CANDIDATES) {
      const path = normalize(join(dirname(importer), bare + suffix)).replace(/\\/g, "/");
      if (existsSync(path)) { missing = false; break; }
      if (deletedTracked.has(path) || deletedUntracked.has(path)) { resolvedTo = path; }
    }
    if (!missing || resolvedTo === null) continue;
    breaks.push({ importer, specifier, target: resolvedTo, tracked: deletedTracked.has(resolvedTo) });
  }
}

const trackedBreaks = [...new Set(breaks.filter((b) => b.tracked).map((b) => b.target))];
const untrackedBreaks = [...new Set(breaks.filter((b) => !b.tracked).map((b) => b.target))];

console.log(`THE PURGE REPAIR — ${surviving.length} surviving scripts read`);
console.log(`  broken imports: ${breaks.length}  ·  distinct targets: ${trackedBreaks.length + untrackedBreaks.length}`);
console.log(`\n══ DELETED BUT IMPORTED — TRACKED (${trackedBreaks.length}), recoverable ══`);
for (const target of trackedBreaks) {
  const importers = breaks.filter((b) => b.target === target).map((b) => b.importer);
  console.log(`  ${target}\n      imported by ${importers.join(", ")}`);
}
console.log(`\n══ DELETED BUT IMPORTED — UNTRACKED (${untrackedBreaks.length}), ⚠ GONE ══`);
for (const target of untrackedBreaks) {
  const importers = breaks.filter((b) => b.target === target).map((b) => b.importer);
  console.log(`  ${target}\n      imported by ${importers.join(", ")}`);
}
if (untrackedBreaks.length === 0) console.log("  (none — no unrecoverable damage)");

if (RESTORE && trackedBreaks.length > 0) {
  /*
    `git restore --staged --worktree` on a path whose only change is the
    deletion. It is safe HERE and would not be in general: these files carried no
    uncommitted work, which is the condition the standing rule about `git
    checkout` is really about.
  */
  execFileSync("git", ["restore", "--staged", "--worktree", "--", ...trackedBreaks], { stdio: "inherit" });
  console.log(`\nrestored ${trackedBreaks.length} tracked file(s). Re-run to see whether restoring them exposed more.`);
}

process.exit(0);
