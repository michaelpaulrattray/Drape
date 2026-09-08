/**
 * HOW OLD IS A DISPOSABLE? — the reading that is not an mtime (#526).
 *
 * # The defect this replaces
 *
 * The litter purge manifest's keep test is the **7-day rule**, and for an
 * untracked file it can only read the filesystem's mtime. Janitor run 3
 * measured what that is worth: run 2 had preserved the original mtimes of all
 * 307 disposables **specifically so run 3 could sweep on real ages**, and when
 * that record was read back file by file, **270 of the 307 had moved to a
 * single hour — 2026-08-30, hour 11.** Not one file in the population was
 * older than that event.
 *
 * ⚠ **An mtime is not evidence of age. It is evidence of the last thing that
 * touched the file.** And a keep test built on one fails toward HOARDING:
 * every reset says "too new, keep it", the population can only grow, and
 * nothing anywhere goes red. Run 3 found it by reading a preserved record;
 * there was no other way it could have been found.
 *
 * # The reading this does instead
 *
 * A disposable is named for the work it served, and that work left an artifact
 * with a real date that **nothing on this machine can re-stamp**:
 *
 * - `_<N>-…` — card #N. Anchored at the issue's `closedAt` (GitHub owns it).
 *   An issue still OPEN anchors at nothing and the file is KEPT: the work may
 *   be live, and that is the safe direction. ⚠ `gh issue list` excludes PULL
 *   REQUESTS, so a disposable named for a PR number resolves to "not an issue"
 *   — also a KEEP, and stated here rather than looking like a bug later.
 * - `_briefing-e<N>-…` — briefing edition N. Anchored at the commit that first
 *   shipped that edition in `server/crew/crew-briefing.json`. This is the road
 *   run 3 took by hand for the seven writers it deleted; it is mechanised here.
 * - anything else — UNRESOLVED, and therefore KEPT. There is deliberately no
 *   cleverness in the fallback: a name this cannot read is a file it does not
 *   get an opinion about.
 *
 * # What it will not do
 *
 * **It reports. It does not delete.** The manifest's doctrine binds any sweep
 * and one clause of it is not mechanisable: *a KEEP is a CITATION, never a
 * judgement of value.* So the citation sweep runs here too, and anything named
 * by another file is KEPT with the citing file printed beside it, whatever its
 * age.
 *
 * ⚠ **It reads TWO kinds of edge, because the first draft read one and would
 * have deleted three files.** `git grep` sees the tracked tree; it cannot see
 * a candidate that another UNTRACKED disposable imports or names. That is the
 * hole the litter purge itself fell into — *"a citation index that excludes
 * the population it is classifying cannot see that population's internal
 * edges"*, twelve restored scripts across three rounds — and it reappeared
 * here immediately: of 131 candidates, **3 were named by files being kept**.
 * So `scripts/` is an authority over itself, and the population's own text is
 * folded into the same shape `git grep` produces so one tested reader sees
 * both. Folding it in makes a file name ITSELF, which is why the self-citation
 * is excluded explicitly rather than left to luck.
 *
 * ⚠ **AND IT PRINTS THE MTIME VERDICT BESIDE ITS OWN, because two readers that
 * agree are worth more than one that is merely newer.** Where they disagree is
 * the interesting column: a file the mtime calls NEW and the artifact calls OLD
 * is a file the mass-reset touched. A sweep should want both.
 *
 * Usage:
 *   npx tsx scripts/disposable-age.mts              # the summary
 *   npx tsx scripts/disposable-age.mts --list       # every file and its verdict
 *   npx tsx scripts/disposable-age.mts --days 14    # a different window
 *   npx tsx scripts/disposable-age.mts --json       # for a later reader
 *
 * No database, no network beyond `gh`, no writes. Free.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

export type Anchor =
  | { kind: "card"; id: number; at: Date; note: string }
  | { kind: "edition"; id: number; at: Date; note: string }
  | { kind: "none"; note: string };

export type Verdict = {
  file: string;
  anchor: Anchor;
  /** The tracked files that name this one. A non-empty list is a KEEP. */
  citations: string[];
  /** The filesystem's answer, kept only so the two can be compared. */
  mtime: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * ⚠ WHICH TREE — and it is not the one this file sits in by default.
 *
 * The population is UNTRACKED, so it exists only in the working tree that
 * wrote it, and a shift always runs from a worktree that has none of it. The
 * first run of this reader was from a fresh worktree and printed **0 of
 * everything, cheerfully** — a reading that looks identical to "the pile is
 * gone". Hence `--root`, and hence the refusal below when the population is
 * empty: a reader whose null result is indistinguishable from success is the
 * shape that produced this card in the first place.
 */
const gitIn = (root: string) => (...args: string[]): string =>
  execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

/**
 * Every UNTRACKED path under `scripts/`, decoded.
 *
 * `--untracked-files=all` and not the default: git collapses an untracked
 * DIRECTORY to one line, and a population read from the collapsed form is
 * short by everything inside it.
 *
 * ⚠ **A C-QUOTED NAME IS DROPPED AND NAMED, NEVER HALF-DECODED** (PR #693
 * review, finding 4). git quotes a path it considers unusual and C-escapes the
 * contents (`\"`, `\\`, octal for non-ASCII). Stripping the quotes alone
 * yields a path that does not exist, which then crashes the `statSync` later
 * with a message that does not say why. So a quoted name whose body still
 * carries a backslash is returned in `undecodable` instead: it is kept (it is
 * never in the population, so it can never be swept) and the run says so,
 * which is the fail-loud direction on a reader that feeds a deletion.
 */
export const untrackedUnderScripts = (
  statusPorcelain: string,
): { paths: string[]; undecodable: string[] } => {
  const paths: string[] = [];
  const undecodable: string[] = [];
  for (const line of statusPorcelain.split(/\r?\n/)) {
    if (!line.startsWith("?? ")) continue;
    const raw = line.slice(3).trim();
    const quoted = raw.startsWith('"') && raw.endsWith('"');
    const body = quoted ? raw.slice(1, -1) : raw;
    if (quoted && body.includes("\\")) { undecodable.push(raw); continue; }
    if (body.startsWith("scripts/")) paths.push(body);
  }
  return { paths, undecodable };
};

/** The population itself: the untracked disposables among those paths. */
export const untrackedDisposables = (statusPorcelain: string): string[] =>
  untrackedUnderScripts(statusPorcelain).paths
    .filter((p) => /-disposable\.[a-z]+$/i.test(p));

/**
 * The id a disposable's NAME points at, or null.
 *
 * ⚠ The edition shape is tested FIRST and the two are mutually exclusive by
 * construction: `_briefing-e88-…` also matches nothing in the card shape
 * (`briefing` is not digits), but writing the order down is cheaper than
 * relying on that staying true.
 */
export const nameAnchorOf = (file: string): { kind: "card" | "edition"; id: number } | null => {
  const base = path.basename(file);
  const edition = /^_briefing-e(\d+)[-_]/.exec(base);
  if (edition) return { kind: "edition", id: Number(edition[1]) };
  const card = /^_(\d{1,4})[-_]/.exec(base);
  if (card) return { kind: "card", id: Number(card[1]) };
  return null;
};

/**
 * Which tracked files name each disposable.
 *
 * ONE `git grep` over the tracked tree rather than one per file: 749 spawns is
 * a minute of process creation on Windows for a question that is one pass.
 * The grep is for the SUFFIX every member of the population shares, and the
 * basenames are then read back out of the matching lines — so a citation of a
 * file that is not in the population simply matches nothing here.
 */
export const citationsFrom = (grepOutput: string, population: string[]): Map<string, string[]> => {
  const byBase = new Map<string, string>();
  for (const file of population) byBase.set(path.basename(file), file);
  const found = new Map<string, string[]>();
  for (const line of grepOutput.split(/\r?\n/)) {
    if (line.length === 0) continue;
    const sep = line.indexOf(":");
    if (sep < 0) continue;
    const citing = line.slice(0, sep);
    for (const [base, file] of byBase) {
      if (!line.includes(base)) continue;
      /* ⚠ A FILE NEVER CITES ITSELF INTO A KEEP. Once the population's own
         text is read (below), every script names itself in its own header —
         so without this line everything would read as cited and nothing could
         ever be swept. That is the hoarding failure again, wearing a hat. */
      if (citing === file) continue;
      const list = found.get(file) ?? [];
      if (!list.includes(citing)) list.push(citing);
      found.set(file, list);
    }
  }
  return found;
};

/**
 * The population's own INTERNAL edges, in the `path:line:text` shape `git grep`
 * produces so one tested reader sees both kinds.
 *
 * ⚠ **IT TAKES EVERY UNTRACKED FILE UNDER `scripts/`, NOT ONLY THE DISPOSABLES
 * AMONG THEM** (PR #693 review, finding 2 — this PR's own class, one shape
 * over, and the reviewer was right). Folding in only the population left an
 * untracked NON-disposable keeper invisible to both readers, and
 * `scripts/lib/sabotage.mts` is exactly that shape. A helper the team keeps,
 * importing a disposable, would have left that disposable at zero citations and
 * reported it sweepable. The excluded set is empty now rather than merely
 * narrower, which is the only version of this fix that ends.
 *
 * ⚠ **AND IT IS A FUNCTION RATHER THAN A LOOP INSIDE `read()` BECAUSE THE FIRST
 * CUT OF THIS FIX HAD NO ARM.** Narrowing the loop back to the disposables
 * reddened NOTHING — the arm written for it drove `citationsFrom`, which does
 * not care which list fed it, so the helper was proven and the call site was
 * not. That is the `derive-adds-a-hop` class arriving inside the repair for
 * another one. The reader is injected so the WALK itself can be driven.
 */
export const internalCitationLines = (
  files: string[],
  readText: (file: string) => string | null,
): string[] => {
  const lines: string[] = [];
  for (const file of files) {
    const text = readText(file);
    if (text === null) continue;
    for (const line of text.split(/\r?\n/)) {
      if (line.includes("-disposable.")) lines.push(`${file}:0:${line}`);
    }
  }
  return lines;
};

/** Every issue this repository has, by number, with the date it closed. */
const ISSUE_LIMIT = 2000;

const readIssues = (root: string): Map<number, { state: string; closedAt: Date | null }> => {
  const raw = execFileSync(
    process.platform === "win32" ? "gh.exe" : "gh",
    ["issue", "list", "--state", "all", "--limit", String(ISSUE_LIMIT), "--json", "number,state,closedAt"],
    { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  const rows = JSON.parse(raw) as { number: number; state: string; closedAt: string | null }[];
  if (rows.length >= ISSUE_LIMIT) {
    /* ⚠ THE TRUNCATION ANNOUNCES ITSELF (PR #693 review, finding 3). `gh issue
       list` returns NEWEST FIRST, so at the ceiling it is the OLDEST cards that
       fall off — and their disposables would then read "#N is not an issue in
       this repository" and be kept forever, with nothing anywhere going red.
       That is the hoarding failure this card exists to remove, returning
       silently through the door built to fix it. ~700 issues today, so this is
       latent; the refusal is what makes it stop being latent. */
    throw new Error(
      `gh returned ${rows.length} issues at the --limit of ${ISSUE_LIMIT}, so the list is TRUNCATED and`
      + " the oldest cards are missing. Their files would read as unresolvable and be kept forever."
      + " Raise ISSUE_LIMIT or page the read.",
    );
  }
  if (rows.length === 0) {
    /* An unauthenticated `gh` prints an empty list, which looks exactly like a
       repository with no issues — and every card anchor would then read
       UNRESOLVED, i.e. KEEP. That is the safe direction, but it is silent, and
       a silent reading that keeps everything is how this whole card started. */
    throw new Error("gh returned no issues at all — refusing rather than reporting every card as unresolvable");
  }
  return new Map(rows.map((r) => [r.number, { state: r.state, closedAt: r.closedAt ? new Date(r.closedAt) : null }]));
};

/**
 * The date a briefing edition first appeared in the committed briefing.
 *
 * `git log -S` on the edition's own literal: the pickaxe reports the commits
 * where the count of that string CHANGED, so the last of them is the commit
 * that introduced it. Memoised — 46 editions in the current population and the
 * same edition is named by several writers.
 */
const editionDates = new Map<number, Date | null>();
const editionDate = (git: (...a: string[]) => string, n: number): Date | null => {
  const cached = editionDates.get(n);
  if (cached !== undefined) return cached;
  let at: Date | null = null;
  try {
    const out = git("log", "-S", `"edition": ${n},`, "--format=%aI", "--", "server/crew/crew-briefing.json");
    const lines = out.split(/\r?\n/).filter((l) => l.length > 0);
    /* Oldest last in git log order: the introducing commit. */
    if (lines.length > 0) at = new Date(lines[lines.length - 1]);
  } catch { /* never shipped, or the file was renamed — unresolved is a keep */ }
  editionDates.set(n, at);
  return at;
};

export const read = (root: string): Verdict[] => {
  const git = gitIn(root);
  const porcelain = git("status", "--porcelain", "--untracked-files=all");
  const { paths: untracked, undecodable } = untrackedUnderScripts(porcelain);
  for (const raw of undecodable) {
    console.error(`disposable-age: UNDECODABLE NAME, kept and not classified — ${raw}`);
  }
  const population = untracked.filter((p) => /-disposable\.[a-z]+$/i.test(p));
  let grepOut = "";
  try {
    /* ⚠ NOTHING IS EXCLUDED, AND THE FIRST DRAFT EXCLUDED `docs/JANITOR_LOG.md`.
       The reasoning was that this seat's own log RECORDS deletions, so a file
       it names as deleted would read as cited and keep itself alive. Measured
       rather than argued: the log names 12 disposables, 3 are still on disk,
       and all 3 are unresolved-by-name and therefore KEPT anyway — the
       exclusion changed **zero verdicts**. It bought nothing, `docs/` is an
       authority under the manifest, and excluding an authority in order to
       delete more is the wrong direction to lean on the one question where
       being wrong is unrecoverable. */
    grepOut = git("grep", "-I", "-n", "-F", "-e", "-disposable.");
  } catch { /* git grep exits 1 on no match */ }
  /*
    ⚠ AND `scripts/` IS AN AUTHORITY OVER ITSELF — THIS POPULATION'S OWN
    INTERNAL EDGES, WHICH THE GREP ABOVE CANNOT SEE.

    `git grep` reads TRACKED files only, so a candidate imported or quoted by
    another UNTRACKED disposable is invisible to it. That is precisely the hole
    the litter purge fell into and wrote up: *"a citation index that excludes
    the population it is classifying cannot see that population's internal
    edges"* — it cost twelve restored scripts across three rounds, each found
    by an instrument rather than by judgement.

    **And it was not theoretical here.** Measured on the live pile the hour
    this block was written, with the tracked grep alone: of 131 sweep
    candidates, **3 were named by files being KEPT** — `_327-max-author-read`
    by `_466-authorread` and `_477-court-read`, `_327-strip` by `_477-strip`,
    and `_briefing-e81` by `_patch195l`. All three would have been deleted out
    from under a script that still names them.

    The population's own text is folded into the same `path:line:text` shape
    `git grep` produces, so ONE tested reader sees both kinds of edge.
  */
  const internal = internalCitationLines(untracked, (file) => {
    try { return readFileSync(path.join(root, file), "utf8"); } catch { return null; }
  });
  const citations = citationsFrom([grepOut, internal.join("\n")].join("\n"), population);
  const issues = readIssues(root);

  return population.map((file) => {
    const named = nameAnchorOf(file);
    let anchor: Anchor = { kind: "none", note: "the name points at no card or edition" };
    if (named?.kind === "card") {
      const issue = issues.get(named.id);
      if (!issue) anchor = { kind: "none", note: `#${named.id} is not an issue in this repository` };
      else if (issue.state !== "CLOSED" || issue.closedAt === null)
        anchor = { kind: "none", note: `#${named.id} is still open — the work may be live` };
      else anchor = { kind: "card", id: named.id, at: issue.closedAt, note: `#${named.id} closed` };
    } else if (named?.kind === "edition") {
      const at = editionDate(git, named.id);
      if (at === null) anchor = { kind: "none", note: `edition ${named.id} is in no commit of the briefing` };
      else anchor = { kind: "edition", id: named.id, at, note: `edition ${named.id} shipped` };
    }
    return { file, anchor, citations: citations.get(file) ?? [], mtime: statSync(path.join(root, file)).mtime };
  });
};

/**
 * The verdict, and it takes BOTH readers plus the citation sweep.
 *
 * A file is sweepable only when the artifact says it is old, the filesystem
 * agrees, and no tracked file names it. Requiring the mtime to agree costs
 * nothing in the direction that matters — the mass reset only ever made files
 * look NEWER, so it can only ever hold a deletion back.
 */
export const sweepable = (v: Verdict, days: number, now: Date): boolean =>
  v.citations.length === 0 &&
  v.anchor.kind !== "none" &&
  now.getTime() - v.anchor.at.getTime() > days * DAY_MS &&
  now.getTime() - v.mtime.getTime() > days * DAY_MS;

const main = (): void => {
  const args = process.argv.slice(2);
  const known = new Set(["--list", "--json", "--days", "--root"]);
  for (const a of args) {
    if (!a.startsWith("--")) continue;
    /* ⚠ THE `=` FORM IS REFUSED, NOT TOLERATED (PR #693 review, finding 1).
       The first cut checked `known.has(a.split("=")[0])`, so `--days=60` and
       `--root=<tree>` PASSED this guard — and then the value parsers, which
       are exact `indexOf("--days")` matches, never saw them. The run went
       ahead on the DEFAULTS: the operator's own tree, a 7-day window, and a
       sweep list they did not ask for. This report is the input to a deletion
       act, so a silently-wrong parameter is the one place "it only reports"
       stops being a defence. */
    if (a.includes("=")) {
      console.error(`disposable-age: REFUSING — write \`${a.split("=")[0]} ${a.split("=").slice(1).join("=")}\`, not \`${a}\`.`);
      console.error("  The value form is not parsed here, and accepting it silently would run on defaults.");
      process.exit(1);
    }
    if (!known.has(a)) {
      console.error(`disposable-age: REFUSING — unknown flag ${a}`);
      process.exit(1);
    }
  }
  const daysAt = args.indexOf("--days");
  const days = daysAt >= 0 && args[daysAt + 1] ? Number(args[daysAt + 1]) : 7;
  if (!Number.isFinite(days) || days < 0) {
    console.error("disposable-age: REFUSING — --days must be a non-negative number");
    process.exit(1);
  }
  const rootAt = args.indexOf("--root");
  const root = rootAt >= 0 && args[rootAt + 1]
    ? path.resolve(args[rootAt + 1])
    : path.resolve(import.meta.dirname, "..");
  const now = new Date();
  const rows = read(root);
  if (rows.length === 0) {
    console.error(`disposable-age: REFUSING — no untracked disposables under ${root}/scripts.`);
    console.error("  A fresh worktree legitimately has none, and that reading is indistinguishable");
    console.error("  from a swept pile. Pass --root <the tree that holds them>.");
    process.exit(1);
  }

  if (args.includes("--json")) {
    console.log(JSON.stringify(rows.map((v) => ({ ...v, sweepable: sweepable(v, days, now) })), null, 2));
    process.exit(0);
  }

  const ageDays = (d: Date) => Math.floor((now.getTime() - d.getTime()) / DAY_MS);
  const cited = rows.filter((v) => v.citations.length > 0);
  const resolved = rows.filter((v) => v.anchor.kind !== "none");
  const sweep = rows.filter((v) => sweepable(v, days, now));
  const mtimeOld = rows.filter((v) => ageDays(v.mtime) > days);
  const disagree = resolved.filter(
    (v) => v.anchor.kind !== "none" && ageDays(v.anchor.at) > days && ageDays(v.mtime) <= days,
  );

  console.log("DISPOSABLE AGE — dated at an artifact, not at an mtime (#526)");
  console.log(`tree:   ${root}`);
  console.log(`window: ${days} days · now ${now.toISOString()}`);
  console.log("");
  console.log(`  untracked disposables under scripts/   ${rows.length}`);
  console.log(`  cited by a tracked file (always KEEP)  ${cited.length}`);
  console.log(`  anchored at a card or an edition       ${resolved.length}`);
  console.log(`  unresolved by name (therefore KEEP)    ${rows.length - resolved.length}`);
  console.log("");
  console.log(`  the filesystem calls OLD               ${mtimeOld.length}`);
  console.log(`  BOTH readers call old, and uncited     ${sweep.length}   <- sweepable`);
  console.log(`  artifact says old, filesystem says new ${disagree.length}   <- the mass-reset's shadow`);
  console.log("");

  if (args.includes("--list")) {
    for (const v of rows.slice().sort((a, b) => a.file.localeCompare(b.file))) {
      const verdict = v.citations.length > 0
        ? `KEEP  cited by ${v.citations.join(", ")}`
        : v.anchor.kind === "none"
          ? `KEEP  ${v.anchor.note}`
          : sweepable(v, days, now)
            ? `SWEEP ${v.anchor.note} ${ageDays(v.anchor.at)}d ago`
            : `KEEP  ${v.anchor.note} ${ageDays(v.anchor.at)}d ago, mtime ${ageDays(v.mtime)}d`;
      console.log(`  ${verdict.padEnd(64)} ${v.file}`);
    }
    console.log("");
  }

  console.log("This reader NEVER deletes. A sweep is a Janitor act with a written manifest,");
  console.log("and a KEEP is a citation rather than a judgement of value.");
  process.exit(0);
};

/*
  "AM I THE THING THAT WAS RUN?" — ASKED OF THE PLATFORM, NEVER OF argv (#668).

  This file is both a library (the suite imports its readers) and a command, so
  it needs the question — and the hand-rolled spelling it carried first is the
  one #668 removed from eight other scripts: on Windows `import.meta.url` is
  `file:///C:/…` while `process.argv[1]` is backslashed, so the comparison never
  matches, the script prints nothing and exits 0, and a silent no-op is
  indistinguishable from a clean run. There is deliberately no shared helper —
  a helper leaves a hop to get wrong.

  The refusal is a THROW rather than an exit: this module is imported by a
  vitest suite, and a `process.exit(1)` inside a worker kills it mid-run.
*/
if (typeof import.meta.main === "undefined") {
  throw new Error(
    "REFUSED — this Node does not support `import.meta.main` (needs >= 24.2, this is "
      + `${process.version}). Without it this reader would exit 0 having read nothing, `
      + "and an empty sweep list looks exactly like a swept pile.",
  );
}

if (import.meta.main) main();
