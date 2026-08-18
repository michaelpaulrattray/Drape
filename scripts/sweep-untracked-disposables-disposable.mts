/**
 * THE UNTRACKED HALF, READ FRESH AT EXECUTION TIME (§2, ruled fable-993 §5).
 *
 * The recon's list was built four shifts ago and this directory has moved since
 * — files written, files cited, files superseded. A deletion driven from a
 * stale list is the same defect as a table that may rot quietly, so the list is
 * rebuilt here, at the knife, and the buckets are printed before anything goes.
 *
 * # What "cited" means — and the first draft of this got it WRONG twice
 *
 * A tracked document, script or source file that NAMES an untracked file has
 * made it an instrument the repository does not contain. The question is asked
 * of the BASENAME, because that is how these files are cited in prose
 * (`scripts/foo-disposable.mts` and `foo-disposable.mts` both count) — and the
 * bias is toward over-citing: a false CITED costs a file surviving one more
 * shift; a false UNCITED destroys work nothing can recover.
 *
 * **But a bias toward over-citing is not a licence to match anything.** The
 * first run of this sweep called 986 paths CITED, among them `errfiles.tmp`,
 * a file named `0`, and every `master.png` under `output/` — because their
 * basenames are strings that occur in ordinary prose and code. An
 * over-inclusive rule does not fail safe; it fails USELESS, and a bucket that
 * admits everything decides nothing. So:
 *
 *   - the basename must be DISTINCTIVE — at least 8 characters and carrying a
 *     `-` or `.` — and generic ones are never auto-cited. They land in HAND,
 *     which is printed in full and read by a person;
 *   - and it must match as a whole token, so `bench.json` inside
 *     `some-bench.json` is not a citation of `bench.json`.
 *
 * # And the granularity is git's own
 *
 * The first run also passed `--untracked-files=all`, which expanded every
 * untracked DIRECTORY into its contents: 4,801 paths against §2's 292. The
 * subject of this milestone is the entries git itself reports — 285 scripts and
 * a handful of root debris — not the thousands of artifacts inside `output/`,
 * which are one decision, not one thousand.
 *
 * # AND THE THIRD TIME THIS MILESTONE'S APPARATUS COUNTED ITSELF
 *
 * `errfiles.tmp` came back CITED. Its only citation is §2 of the triage
 * document — **the line ordering it deleted.** A deletion order names its
 * target, so the order to delete reads as a reason to keep.
 *
 * That is opus-729 §2's rule arriving in a new shape: prose was §19, data was
 * §22, and this is the deletion ORDER itself. A boolean "cited" cannot tell
 * these apart, so this sweep does not print one — every CITED row NAMES the
 * tracked files that cite it, and a row whose only citer is the cleanup
 * document's own kill list is debris with a death warrant, not an instrument.
 *
 * The tracked corpus is `git ls-files`, per §19's rule: an untracked disposable
 * naming another untracked disposable is not a citation, it is two pieces of
 * debris agreeing with each other.
 *
 * # The date fence
 *
 * §2 kept the last two days' worth because they belong to work in flight. That
 * is a moving fence and it moves with the run, so it is computed from the
 * clock rather than from the recon's date: anything touched inside FRESH_HOURS
 * is held regardless of citation.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, "..");
const FRESH_HOURS = 48;

const git = (args: string[]): string =>
  execFileSync("git", args, { cwd: REPO, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

/* Untracked, and NOT ignored — `--porcelain` already honours .gitignore. */
const untracked = git(["status", "--porcelain"])
  .split(/\r?\n/)
  .filter((line) => line.startsWith("?? "))
  .map((line) => line.slice(3).replace(/^"|"$/g, ""))
  .filter((path) => path !== "");

const tracked = git(["ls-files"]).split(/\r?\n/).filter((path) => path !== "");

/*
  ONE PASS OVER THE TRACKED CORPUS, not one grep per candidate. 283 greps over
  4,000 files is the shape that makes a sweep too slow to re-run — and a sweep
  too slow to re-run is the reason the list went stale in the first place.
*/
const sources: Array<string | undefined> = tracked.map((path) => {
  try {
    const stat = statSync(resolve(REPO, path));
    if (!stat.isFile() || stat.size > 4 * 1024 * 1024) return undefined;
    return readFileSync(resolve(REPO, path), "utf8");
  } catch { return undefined; /* a tracked path that will not read is not a citation */ }
});
const corpus = sources.filter((text): text is string => text !== undefined).join("\n");

/** Distinctive enough that finding it in tracked prose means something. */
function distinctive(name: string): boolean {
  return name.length >= 8 && (name.includes("-") || name.includes("."));
}

/** As a whole token — `bench.json` must not match inside `some-bench.json`. */
function tokenIn(text: string, name: string): boolean {
  let from = 0;
  for (;;) {
    const at = text.indexOf(name, from);
    if (at === -1) return false;
    const before = at === 0 ? "" : text[at - 1]!;
    const after = text[at + name.length] ?? "";
    const boundary = (character: string) => character === "" || !/[A-Za-z0-9_.-]/.test(character);
    if (boundary(before) && boundary(after)) return true;
    from = at + 1;
  }
}

/** WHO cites it, never merely whether — see the header's third self-count. */
function citers(name: string): string[] {
  return tracked.filter((path, index) => sources[index] !== undefined
    && tokenIn(sources[index]!, name));
}

const now = Date.now();
type Verdict = "CITED" | "FRESH" | "HAND" | "DELETE";
const rows: Array<{ path: string; verdict: Verdict; ageHours: number; by: string[] }> = [];
for (const entry of untracked) {
  /* git reports a directory as `output/`; the trailing slash is not a name. */
  const path = entry.replace(/\/$/, "");
  let ageHours = Number.POSITIVE_INFINITY;
  try { ageHours = (now - statSync(resolve(REPO, path)).mtimeMs) / 3_600_000; } catch { /* gone */ }
  const name = basename(path);
  const by = distinctive(name) ? citers(name) : [];
  const verdict: Verdict = !distinctive(name) ? "HAND"
    : by.length > 0 ? "CITED"
    : ageHours < FRESH_HOURS ? "FRESH"
    : "DELETE";
  rows.push({ path, verdict, ageHours, by });
}

const count = (verdict: Verdict) => rows.filter((row) => row.verdict === verdict).length;
console.log(`THE UNTRACKED HALF — ${rows.length} paths, against ${tracked.length} tracked files`);
console.log(`  CITED   ${count("CITED")}   named by something tracked — promote or retire the citation`);
console.log(`  FRESH   ${count("FRESH")}   touched inside ${FRESH_HOURS}h — work in flight, held`);
console.log(`  HAND    ${count("HAND")}   basename too generic to auto-decide — read below`);
console.log(`  DELETE  ${count("DELETE")}   named by nothing tracked, and cold`);
/*
  THE BUCKETS MUST SUM (cec38827's rule, on this instrument): a verdict whose
  parts do not add up to what it read is not a reading.
*/
if (count("CITED") + count("FRESH") + count("HAND") + count("DELETE") !== rows.length) {
  console.log("REFUSED — the buckets do not sum to what was swept.");
  process.exit(1);
}

const KILL_LIST = "docs/specs/CLEANUP_MILESTONE_TRIAGE.md";
for (const verdict of ["HAND", "CITED", "FRESH"] as const) {
  console.log(`\n${verdict}`);
  for (const row of rows.filter((r) => r.verdict === verdict)) {
    console.log(`  ${row.path}`);
    if (row.by.length > 0) {
      console.log(`      by ${row.by.slice(0, 3).join(", ")}${row.by.length > 3 ? ` +${row.by.length - 3} more` : ""}`);
    }
    if (row.by.length === 1 && row.by[0] === KILL_LIST) {
      console.log("      !! ONLY the kill list itself — a death warrant is not a citation");
    }
  }
}
if (process.argv.includes("--list-delete")) {
  console.log("\nDELETE");
  for (const row of rows.filter((r) => r.verdict === "DELETE")) console.log(row.path);
}

/*
  AND IT ENDS BY ENDING — `scriptExitDiscipline`'s rule, which this file broke
  the moment it was PROMOTED. Untracked, nothing scanned it; tracked, it is an
  entrypoint like any other. The scan walks the repository, so a run over a large
  tree holds file handles the event loop will happily wait on.
*/
process.exit(0);
