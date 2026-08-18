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
 * # THE COORDINATION SURFACE — the citer universe the tracked corpus cannot see
 *
 * "Named by something tracked" is the right evidence bar for KEEPING and the
 * WRONG completeness bar for DELETING (ruled fable-998 §2, measured). This
 * program's standing instruments are cited by the mailbox, the founder queue and
 * the memory files — none of which are in `git ls-files`, by construction. The
 * measured case: the campaign ledger pair was eight days cold and squarely in
 * DELETE, while being the instrument every campaign state block re-runs.
 *
 * So a second surface is read, and a hit there is COURTESY: held, printed with
 * its citers, and NOT deleted. It does not change the evidence rule — a courtesy
 * citer never promotes anything — it changes the delete list.
 *
 * Until 2026-08-19 this pass was a shell loop typed by hand at the knife, and
 * **its first run returned a false zero**: a malformed `grep -c … || echo 0`
 * emitted two lines and the integer comparison collapsed every condition to
 * false. It reads 0-of-143 exactly as a working sweep that found nothing reads.
 * That is why it lives here now, with controls, instead of in a shell.
 *
 * ## And why the negative control does not PRINT its own token
 *
 * The hand-run version was contaminated inside one shift: the control token — a
 * name git has never seen — was quoted in the report filed to the mailbox, and
 * the next run grepped the mailbox and found it. The specimen joined the
 * vocabulary. So the token is declared HERE, in tracked source that the surface
 * reader does not read, and the control line prints its VERDICT without ever
 * printing the string. An instrument that publishes its own control specimen
 * into the corpus it searches is an instrument with an expiry date.
 *
 * Memory lives outside the repository at a machine-specific path, so it is not
 * hardcoded: set `CLEANUP_COORDINATION_DIRS` (comma- or semicolon-separated) to
 * add surfaces. Absent, the surface is `.agents/` — which holds the mailbox and
 * the founder queue, the two that matter most.
 *
 * # The date fence
 *
 * §2 kept the last two days' worth because they belong to work in flight. That
 * is a moving fence and it moves with the run, so it is computed from the
 * clock rather than from the recon's date: anything touched inside FRESH_HOURS
 * is held regardless of citation.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import type { Dirent } from "node:fs";
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

/*
  THE SECOND SURFACE. Read once, concatenated once — same reason as the tracked
  corpus above: a sweep too slow to re-run is how a list goes stale.
*/
function surfaceRoots(): string[] {
  const extra = (process.env.CLEANUP_COORDINATION_DIRS ?? "")
    .split(/[,;]/).map((entry) => entry.trim()).filter((entry) => entry !== "");
  return [resolve(REPO, ".agents"), ...extra];
}

function walkText(dir: string, out: Array<{ path: string; text: string }> = []): Array<{ path: string; text: string }> {
  let entries: Dirent[];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) { walkText(full, out); continue; }
    if (!/\.(md|txt)$/i.test(entry.name)) continue;
    try {
      const stat = statSync(full);
      if (stat.size > 4 * 1024 * 1024) continue;
      out.push({ path: full, text: readFileSync(full, "utf8") });
    } catch { /* unreadable is not a citation */ }
  }
  return out;
}

const surface = surfaceRoots().flatMap((root) => walkText(root));

/** WHO on the coordination surface names it — never merely whether. */
function courtesyCiters(name: string): string[] {
  return surface
    .filter((file) => tokenIn(file.text, name))
    .map((file) => file.path.slice(REPO.length + 1).split("\\").join("/"));
}

/*
  CONTROLS, BOTH DIRECTIONS, AND THE READER REFUSES RATHER THAN GOES BLIND.
  This predicate can only ever move files OUT of DELETE, so its silent failure
  mode is a surface that reads as empty — which deletes the very instruments it
  exists to protect. An empty surface is therefore fatal, not quiet.
*/
const COURTESY_POSITIVE = "campaign-ledger-window-disposable";
/* Declared here on purpose — see the header. Never printed. */
const COURTESY_NEGATIVE = "zz-no-such-instrument-7f31b9-disposable";
const courtesyPositive = courtesyCiters(COURTESY_POSITIVE).length > 0;
const courtesyNegative = courtesyCiters(COURTESY_NEGATIVE).length === 0;
console.log(`  surface   ${surface.length} coordination files read`);
console.log(`  control   positive ${COURTESY_POSITIVE} ${courtesyPositive ? "FOUND     PASS" : "NOT FOUND  FAIL"}`);
console.log(`  control   negative (token withheld by design) ${courtesyNegative ? "absent    PASS" : "PRESENT — CORPUS CONTAMINATED  FAIL"}`);
if (surface.length === 0 || !courtesyPositive || !courtesyNegative) {
  console.log("REFUSED — the coordination surface cannot be trusted, so nothing here may be called deletable.");
  process.exit(1);
}

const now = Date.now();
type Verdict = "CITED" | "FRESH" | "HAND" | "COURTESY" | "DELETE";
const rows: Array<{ path: string; verdict: Verdict; ageHours: number; by: string[] }> = [];
for (const entry of untracked) {
  /* git reports a directory as `output/`; the trailing slash is not a name. */
  const path = entry.replace(/\/$/, "");
  let ageHours = Number.POSITIVE_INFINITY;
  try { ageHours = (now - statSync(resolve(REPO, path)).mtimeMs) / 3_600_000; } catch { /* gone */ }
  const name = basename(path);
  const by = distinctive(name) ? citers(name) : [];
  const courtesy = distinctive(name) && by.length === 0 ? courtesyCiters(name) : [];
  const verdict: Verdict = !distinctive(name) ? "HAND"
    : by.length > 0 ? "CITED"
    : ageHours < FRESH_HOURS ? "FRESH"
    : courtesy.length > 0 ? "COURTESY"
    : "DELETE";
  rows.push({ path, verdict, ageHours, by: by.length > 0 ? by : courtesy });
}

const count = (verdict: Verdict) => rows.filter((row) => row.verdict === verdict).length;
console.log(`THE UNTRACKED HALF — ${rows.length} paths, against ${tracked.length} tracked files`);
console.log(`  CITED   ${count("CITED")}   named by something tracked — promote or retire the citation`);
console.log(`  FRESH   ${count("FRESH")}   touched inside ${FRESH_HOURS}h — work in flight, held`);
console.log(`  HAND    ${count("HAND")}   basename too generic to auto-decide — read below`);
console.log(`  COURTESY ${count("COURTESY")}  cold, but the mailbox/queue names it — HELD, not deleted`);
console.log(`  DELETE  ${count("DELETE")}   named by nothing tracked OR coordinating, and cold`);
/*
  THE BUCKETS MUST SUM (cec38827's rule, on this instrument): a verdict whose
  parts do not add up to what it read is not a reading.
*/
if (count("CITED") + count("FRESH") + count("HAND") + count("COURTESY") + count("DELETE") !== rows.length) {
  console.log("REFUSED — the buckets do not sum to what was swept.");
  process.exit(1);
}

const KILL_LIST = "docs/specs/CLEANUP_MILESTONE_TRIAGE.md";
for (const verdict of ["HAND", "CITED", "COURTESY", "FRESH"] as const) {
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
