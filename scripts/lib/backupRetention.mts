/**
 * WHEN DOES A SWEEP BACKUP STOP BEING NEEDED? (#1143)
 *
 * Every Janitor sweep since run 1 has done the correct thing — copy what it is
 * about to delete somewhere outside the repository first. Nine runs later
 * nothing had ever said when a copy stops being needed, so **none had ever been
 * removed**: 14 zips (2026-08-19 → 2026-09-24) and 2 directories, growing by
 * roughly one zip per run.
 *
 * # ⚠ THE QUESTION IS DISSOLVED, NOT ANSWERED
 *
 * The card asked four questions and three of them read as judgements about
 * value — *how many runs is a zip worth keeping, how many days, or never?* A
 * taxonomy nobody wrote down is exactly what the Atlas's price reader was
 * repaired by refusing to invent (CLAUDE.md, *"the question is DISSOLVED rather
 * than answered"*), and the same move works here:
 *
 * **A backup expires when the thing it protects is provably recoverable
 * somewhere else. That is a CHECK, not a date.** So there is no expiry in runs
 * or days to choose; there is a test to run, and an item that fails it is kept
 * with the reason printed beside it.
 *
 * Two readers answer it, and they are both ones this repository already has:
 *
 *  1. **THE BYTES ARE IN GIT.** A file's git blob sha is a function of its
 *     bytes alone, so `git log --all --find-object=<sha>` either names a commit
 *     that holds exactly these bytes or names nothing. This is the road Janitor
 *     run 9 took BY HAND for the four briefs it deleted — *"against `315f3386`
 *     all four are byte-identical (LF-normalised), so the bytes are recoverable
 *     from git and the backup is redundant"* — mechanised here, and it produces
 *     the CITATION the ledger wants (a commit sha) rather than an opinion.
 *  2. **THE WORK IT SERVED IS FINISHED.** A swept disposable is named for the
 *     card or briefing edition it was cut for, and {@link nameAnchorOf} —
 *     `scripts/disposable-age.mts`'s own reader, imported rather than
 *     re-implemented (working law 4) — resolves that name to an id whose
 *     `closedAt` GitHub owns and nothing on this machine can re-stamp. That
 *     instrument exists precisely because an mtime is not evidence of age: run 3
 *     measured 270 of 307 disposables carrying one single hour after a mass
 *     touch, and a keep test built on an mtime fails toward HOARDING.
 *
 * # WHAT IT REFUSES, AND WHY EACH REFUSAL IS THE POINT
 *
 * ⚠ **AN EMPTY READING THROWS.** A zip that could not be opened, or a directory
 * that could not be walked, yields zero entries — and zero entries trivially
 * satisfies *"every entry is recoverable"*. **An unreadable backup classified as
 * redundant is precisely how the only copy of something gets deleted**, and it
 * is the failure shape `disposable-age` was built around (a reader whose null
 * result is indistinguishable from success). So it is an error, never a verdict.
 *
 * ⚠ **A NAME THIS CANNOT READ IS A FILE IT GETS NO OPINION ABOUT.** No anchor
 * and no matching blob means KEPT, whatever its age. `disposable-age`'s own
 * fallback, for its reason: there is deliberately no cleverness in it.
 *
 * ⚠ **AND THE STATED CONSEQUENCE, MEASURED RATHER THAN GUESSED, IS THAT THE
 * FRAMES ZIPS ALL READ AS KEPT — 9.5 MB OF THE 25.3 MB PILE.** A screenshot in
 * them is named `771-alerts-dark-1440.png`, which names its card as plainly as
 * a disposable does; {@link nameAnchorOf} requires the leading `_` of the
 * `scripts/_<N>-…-disposable` population it was written for, so it returns
 * nothing here and every frame is kept. **That is left alone on purpose.**
 * Widening a reader that a DELETION road already depends on, to serve a second
 * population it was not measured against, is how a keep test quietly starts
 * approving things; a frames-name anchor is its own reader, with its own
 * controls, on the day somebody wants those 9.5 MB. Until then the pile's
 * largest keep is a keep for a reason this file states rather than for a reason
 * nobody wrote down, which is the whole point of the card.
 *
 * ⚠ **THE 7-DAY FLOOR STILL BINDS, ABOVE EVERYTHING ELSE.** The litter purge
 * manifest's own keep test is the 7-day rule, and a backup written this week is
 * kept even when every entry in it is redundant. A sweep's copy is insurance
 * against the sweep, and the sweep is the thing that was recent.
 *
 * # WHAT THIS DELIBERATELY DOES NOT COVER
 *
 * **`output/` (7.0 GB, 8,952 files) is not a backup and no rule here touches
 * it.** Nothing in it was ever a copy of something else: it is primary evidence
 * from paid measurements — `masked` 1.1 GB, `framing-court` 779 MB,
 * `prompt-author-court-run3` 170 MB. Both readers above fail on it by
 * construction (it is gitignored, so no blob; the directory names are not
 * disposable names, so no anchor), which would make this module say KEPT about
 * 7 GB it has no competence over. Whether the record of paid courts ages out is
 * its own decision and its own card, and saying so is more honest than a
 * mechanical verdict nobody should act on.
 *
 * **And the R2 orphans are a KEEP this reader can never lift.**
 * `drape-janitor-run6-crew-eye-orphans` is 31 files, 14.1 MB, downloaded by run
 * 6 §C *before deleting the originals from the bucket* — **the only copies that
 * exist.** No commit holds them and no name anchors them, so the test above
 * returns KEPT for every entry, forever, which is the right answer arrived at
 * by the rule rather than by remembering. Deleting them is a founder act.
 *
 * # IT REPORTS — AND SINCE #1294 IT MAY DELETE ONE DISPOSITION
 *
 * This section read *"IT REPORTS. IT DOES NOT DELETE. There is no delete path in
 * this module or in its runner, by construction and not by discipline"* until
 * 2026-09-26, and it was true of the day it was written: #1143 built the check
 * and deliberately left the authority question open. **#1294 put it to him and he
 * answered, verbatim and entire: _"1294) delete them itself"_.**
 *
 * So there IS a delete path now, it acts on the `expired` disposition and on
 * nothing else, and every limb of it is at the foot of this file —
 * {@link itemsToDelete}, {@link deletionRefusal}, {@link insertDeletionRows} —
 * with the reason each refusal exists stated there rather than here.
 *
 * `server/backupRetention.test.ts` drives every arm, including the empty-reading
 * refusal, against real temporary repositories and real bytes.
 */
import { createHash } from "node:crypto";

import { nameAnchorOf } from "../disposable-age.mts";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The floor, and it is the litter purge manifest's own — *"the 7-day rule keeps
 * anything recent"*. Declared once here and read by the runner; it is the same
 * number `disposable-age --days` defaults to, and if that ever moves this is the
 * place the two are reconciled rather than a second copy to drift.
 */
export const BACKUP_RETENTION_FLOOR_DAYS = 7;

export type BackupKind = "zip" | "directory";

/**
 * What counts as a sweep backup, by name.
 *
 * One declared list because the pile's names were chosen run by run and there
 * is no convention to derive from — nine runs produced `drape-debris-`,
 * `drape-untracked-`, `drape-disposables-sweep-`, `drape-janitor-run<N>-`,
 * `drape-census-scratch-`, `drape-root-frames-sweep-` and
 * `drape-shift-frames-`. A name not on this list is not classified and the run
 * says how many it skipped, so a tenth naming style shows up as a number rather
 * than as silence.
 */
export const BACKUP_NAME_PATTERNS: readonly RegExp[] = [
  /^drape-debris-/,
  /^drape-untracked(-tail)?-/,
  /^drape-disposables-sweep-/,
  /^drape-janitor-run\d+-/,
  /^drape-census-scratch-/,
  /^drape-root-frames-sweep-/,
  /^drape-shift-frames-/,
];

export function isBackupName(name: string): boolean {
  return BACKUP_NAME_PATTERNS.some((re) => re.test(name.replace(/\.zip$/i, "")));
}

/**
 * ⚠ THE REFUSAL THAT WOULD HAVE COST THE TREE.
 *
 * The pile lives beside the worktrees: `C:\Users\Admin` holds
 * `drape-shift-seat-janitor`, `drape-pinned-42652964` and the rest of the crew's
 * trees under the same `drape-` prefix a backup name uses. A name-pattern sweep
 * that called one of those a backup would put a LIVE WORKING TREE on a list
 * whose next reader is a founder holding a delete key.
 *
 * **Two independent grounds, and it refuses on EITHER.** A worktree whose
 * registration was lost is still a tree with work in it, and a registered tree
 * whose `.git` the caller could not stat is still registered. The caller does
 * the two filesystem reads; this decides, so the decision is drivable.
 *
 * Returns the reason, or null when the directory is an ordinary one.
 */
export function treeRefusal(
  dir: string,
  holdsGit: boolean,
  registeredWorktreesLower: ReadonlySet<string>,
): string | null {
  if (registeredWorktreesLower.has(dir.toLowerCase())) return "registered worktree, not a backup";
  if (holdsGit) return "holds .git, not a backup";
  return null;
}

export type BackupItem = {
  readonly path: string;
  readonly kind: BackupKind;
  readonly bytes: number;
  readonly modified: Date;
};

/** One file inside a backup, as the reader found it. */
export type BackupEntry = {
  /** The path as the archive or the walk names it — a basename for most sweep zips. */
  readonly name: string;
  readonly bytes: number;
  /**
   * The git blob sha of these bytes. Two are offered because a text file
   * checked out under `core.autocrlf` carries CRLF on this machine while git
   * stored it with LF, and a single raw hash would call every such file absent.
   */
  readonly rawBlobSha: string;
  /** The LF-normalised hash, or null for bytes that hold a NUL (normalising binary corrupts it). */
  readonly lfBlobSha: string | null;
};

/**
 * What the two readers found for one entry, injected rather than fetched so the
 * classifier is pure and its suite needs neither git nor GitHub.
 */
export type EntryEvidence = {
  /** A commit holding these exact bytes, or null when git has never seen them. */
  readonly recoverableAt: string | null;
  /** When the card or edition the name anchors at closed, or null when the name says nothing. */
  readonly anchorClosedAt: Date | null;
};

export type EntryVerdict = {
  readonly name: string;
  readonly expired: boolean;
  /** The sentence that goes in the listing, and for a keep it is the citation. */
  readonly reason: string;
};

export type BackupDisposition =
  /** every entry's bytes are in git — the backup adds nothing */
  | "redundant"
  /** every entry has expired, at least one of them by its finished work rather than by git */
  | "expired"
  /** something inside it is still the only copy, or still live */
  | "kept"
  /** inside the 7-day floor: not judged on its contents at all */
  | "too-recent";

export type BackupVerdict = {
  readonly item: BackupItem;
  readonly disposition: BackupDisposition;
  readonly entries: readonly EntryVerdict[];
  /** The entries that are NOT expired — empty on `redundant` and `expired`. */
  readonly kept: readonly EntryVerdict[];
  /** One line a run copies into `docs/JANITOR_LOG.md` beside the item. */
  readonly citation: string;
};

/**
 * The git blob sha of some bytes: `sha1("blob " + length + "\0" + bytes)`.
 *
 * Computed here rather than by spawning `git hash-object` per file — the shape
 * is git's own and is stable, and 300 spawns is a minute of process creation on
 * Windows for an arithmetic answer. The suite proves this against real
 * `git hash-object` output rather than against itself, because a hash function
 * checked against its own implementation is not checked.
 */
export function gitBlobSha(bytes: Buffer): string {
  return createHash("sha1")
    .update(`blob ${bytes.length}\0`, "utf8")
    .update(bytes)
    .digest("hex");
}

/** True when the bytes hold a NUL — git's own binary test, and ours for whether LF-normalising is safe. */
export function looksBinary(bytes: Buffer): boolean {
  return bytes.includes(0);
}

/**
 * Both hashes for one file's bytes. The LF one is null for binary, which is why
 * a PNG in a frames zip is asked about once and not twice.
 */
export function hashesOf(bytes: Buffer): { rawBlobSha: string; lfBlobSha: string | null } {
  const rawBlobSha = gitBlobSha(bytes);
  if (looksBinary(bytes)) return { rawBlobSha, lfBlobSha: null };
  const lf = Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
  const lfBlobSha = gitBlobSha(lf);
  return { rawBlobSha, lfBlobSha: lfBlobSha === rawBlobSha ? null : lfBlobSha };
}

/**
 * One entry's verdict. The order of the limbs is the order of their strength:
 * a commit sha is a fact about the bytes, a closed card is a fact about the
 * work, and silence is a keep.
 */
export function classifyEntry(
  entry: BackupEntry,
  evidence: EntryEvidence,
  floorDays: number,
  now: Date,
): EntryVerdict {
  if (evidence.recoverableAt) {
    return {
      name: entry.name,
      expired: true,
      reason: `bytes recoverable from git at ${evidence.recoverableAt}`,
    };
  }
  const anchor = nameAnchorOf(entry.name);
  if (!anchor || !evidence.anchorClosedAt) {
    return {
      name: entry.name,
      expired: false,
      reason: anchor
        ? `${anchor.kind} #${anchor.id} is not closed — the work may be live`
        : "its name anchors at nothing and git has never held these bytes",
    };
  }
  const ageDays = (now.getTime() - evidence.anchorClosedAt.getTime()) / DAY_MS;
  if (ageDays <= floorDays) {
    return {
      name: entry.name,
      expired: false,
      reason: `${anchor.kind} #${anchor.id} closed ${ageDays.toFixed(1)} days ago — inside the ${floorDays}-day floor`,
    };
  }
  return {
    name: entry.name,
    expired: true,
    reason: `${anchor.kind} #${anchor.id} closed ${ageDays.toFixed(1)} days ago`,
  };
}

/**
 * The item's verdict.
 *
 * ⚠ THROWS on an empty reading. See the header: zero entries satisfies "every
 * entry is recoverable" for free, and that is how a sole copy would be deleted
 * by a green-looking report.
 */
export function classifyBackup(
  item: BackupItem,
  entries: readonly BackupEntry[],
  evidenceFor: (entry: BackupEntry) => EntryEvidence,
  floorDays: number,
  now: Date,
): BackupVerdict {
  if (entries.length === 0) {
    throw new Error(
      `backup-retention: ${item.path} read as ZERO entries — refusing to judge it. ` +
        "An unreadable backup and an empty one are the same reading here, and " +
        '"every entry is recoverable" is trivially true of nothing.',
    );
  }
  const ageDays = (now.getTime() - item.modified.getTime()) / DAY_MS;
  const verdicts = entries.map((entry) => classifyEntry(entry, evidenceFor(entry), floorDays, now));
  const kept = verdicts.filter((v) => !v.expired);
  if (ageDays <= floorDays) {
    return {
      item,
      disposition: "too-recent",
      entries: verdicts,
      kept,
      citation:
        `written ${ageDays.toFixed(1)} days ago — inside the ${floorDays}-day floor, ` +
        "not judged on its contents",
    };
  }
  if (kept.length > 0) {
    return {
      item,
      disposition: "kept",
      entries: verdicts,
      kept,
      citation:
        `${kept.length} of ${verdicts.length} entries are not recoverable elsewhere — ` +
        `first: ${kept[0]!.name} (${kept[0]!.reason})`,
    };
  }
  const allByGit = verdicts.every((v) => v.reason.startsWith("bytes recoverable"));
  return {
    item,
    disposition: allByGit ? "redundant" : "expired",
    entries: verdicts,
    kept,
    citation: allByGit
      ? `every one of ${verdicts.length} entries is byte-identical to a blob git holds`
      : `every one of ${verdicts.length} entries has expired; ` +
        `${verdicts.filter((v) => v.reason.startsWith("bytes recoverable")).length} by git, the rest by finished work`,
  };
}

/**
 * The pile's summary, derived from the verdicts and never counted twice.
 *
 * `reclaimable` counts only `redundant` and `expired`, so the number printed is
 * the number a founder act would actually free — a summary that folded `kept`
 * bytes into it would overstate the case for the very decision it informs.
 */
export function summarise(verdicts: readonly BackupVerdict[]): {
  readonly items: number;
  readonly bytes: number;
  readonly reclaimableItems: number;
  readonly reclaimableBytes: number;
  readonly byDisposition: Readonly<Record<BackupDisposition, number>>;
} {
  const byDisposition: Record<BackupDisposition, number> = {
    redundant: 0,
    expired: 0,
    kept: 0,
    "too-recent": 0,
  };
  let bytes = 0;
  let reclaimableItems = 0;
  let reclaimableBytes = 0;
  for (const v of verdicts) {
    byDisposition[v.disposition] += 1;
    bytes += v.item.bytes;
    if (v.disposition === "redundant" || v.disposition === "expired") {
      reclaimableItems += 1;
      reclaimableBytes += v.item.bytes;
    }
  }
  return { items: verdicts.length, bytes, reclaimableItems, reclaimableBytes, byDisposition };
}

/* ───────────────────────────────────────────────────────────────────────────
   MAY A PATROL DELETE WHAT THE CHECK HAS RETIRED? — HIS WORD, AND ITS GUARDS

   #1294, 2026-09-26 (terminal), verbatim and entire: **"1294) delete them
   itself"**. Asked whether the team may act on the retention check's `expired`
   verdict by itself or whether every list comes to him, he chose the first. So
   the header above — *"there is no delete path in this module or in its runner,
   by construction"* — is superseded for exactly one disposition and for nothing
   else, and the functions below are the whole of it.

   ⚠ THE SCOPE IS ONE ENUM VALUE, AND IT IS NARROWER THAN THE STRONGEST PROOF.
   `redundant` — every entry byte-identical to a blob git holds — is a STRONGER
   reading than `expired`, and it is deliberately NOT deletable here, because his
   word and the card's own scope sentence both name `expired` and nothing else.
   It reads 0 on this pile and the doc says why (swept disposables were untracked
   by design, so git never held their bytes), so the exclusion costs nothing
   today; the runner PRINTS a line when the count is not zero rather than letting
   a stronger case sit silently outside the road. Widening this set is his word,
   not a shift's tidy-up.

   ⚠ AND THE REAL RISK IS NOT THE FILTER, IT IS THE TREE THE VERDICT WAS READ
   FROM. The relay's review of PR #1293 measured it: run from the main tree, two
   of the same sixteen items read KEPT where the seat's tree read them EXPIRED,
   because `commitHolding` walks `git log --all` and `editionDate` walks the
   briefing's history — both answer from the clone they run in. A tree BEHIND
   main fails toward KEEP, which is safe. A tree holding a commit main does NOT
   have — an abandoned local branch, a reverted commit — fails the other way:
   bytes "recoverable from git" at a commit nobody will ever fetch. That is the
   direction {@link deletionRefusal} exists for, and it is why the relay's
   verdict asked this card to require a fresh main before any deletion.
   ─────────────────────────────────────────────────────────────────────────── */

/**
 * The dispositions a patrol may act on by itself — a SET so the arms can hold it
 * against the full population rather than against a sentence.
 *
 * The population is derivable: `summarise([]).byDisposition` enumerates every
 * member of {@link BackupDisposition} because its record type forces it, so a
 * fifth disposition arriving one day is visible to the suite the day it lands
 * and defaults to NOT deletable.
 */
export const DELETABLE_DISPOSITIONS: ReadonlySet<BackupDisposition> = new Set<BackupDisposition>(["expired"]);

/**
 * Which items of a listing a patrol may delete.
 *
 * Nothing else in this module decides it, and no caller re-implements the test:
 * the one place a `kept`, `too-recent` or `redundant` item could become
 * deletable is the set above. **This is the function the sabotage arm breaks** —
 * widen it to admit `kept` and `server/backupRetention.test.ts` reddens on the
 * R2-orphan fixture, which is the only copy of 31 files.
 */
export function itemsToDelete(verdicts: readonly BackupVerdict[]): readonly BackupVerdict[] {
  return verdicts.filter((v) => DELETABLE_DISPOSITIONS.has(v.disposition));
}

/** What the runner must prove about the tree it read the verdicts from. */
export type TreeFreshness = {
  /** `git rev-parse HEAD` in the tree the listing was read from. */
  readonly headSha: string;
  /** The remote's `refs/heads/main`, read with `git ls-remote` — a read, so no ref is written. */
  readonly remoteMainSha: string;
  /** `git status --porcelain` lines; a dirty tree is not the tree it claims to be. */
  readonly dirtyPaths: readonly string[];
};

const FULL_SHA = /^[0-9a-f]{40}$/;

/**
 * May this reading be acted on? The reason it may not, or null when it may.
 *
 * ⚠ **A READ THAT FAILED IS NEVER AGREEMENT.** Both shas must be full 40-hex
 * before they are compared, so an empty `ls-remote` (no network, no remote, a
 * renamed branch) refuses rather than comparing two empty strings and finding
 * them equal — the shape that makes a guard pass hardest exactly when its
 * evidence is missing.
 *
 * ⚠ **AND A STALE LISTING CANNOT BE ACTED ON, BY CONSTRUCTION RATHER THAN BY
 * THIS FUNCTION.** The runner computes the verdicts in the same process run that
 * deletes; there is no `--from <file>`, so there is no artifact to go stale. What
 * this adds is the other half: the TREE those verdicts were computed from is the
 * tip of `main` and clean, which is the only thing that makes a verdict
 * comparable to the one the founder was shown.
 */
export function deletionRefusal(freshness: TreeFreshness): string | null {
  const head = freshness.headSha.trim().toLowerCase();
  const remote = freshness.remoteMainSha.trim().toLowerCase();
  if (!FULL_SHA.test(head)) {
    return `the tree's HEAD did not read as a commit sha (${JSON.stringify(freshness.headSha)}) — a failed read is not agreement`;
  }
  if (!FULL_SHA.test(remote)) {
    return `the remote's refs/heads/main did not read as a commit sha (${JSON.stringify(freshness.remoteMainSha)}) — a failed read is not agreement`;
  }
  if (head !== remote) {
    return `the tree is at ${head.slice(0, 8)} and origin/main is at ${remote.slice(0, 8)} — a verdict is only as good as the tree it was read from (PR #1293's review: the same 16 items read differently from two trees)`;
  }
  if (freshness.dirtyPaths.length > 0) {
    return `the tree has ${freshness.dirtyPaths.length} uncommitted path(s), first ${JSON.stringify(freshness.dirtyPaths[0])} — a dirty tree is not the tree it claims to be`;
  }
  return null;
}

/**
 * The receipt marker in `docs/JANITOR_LOG.md`.
 *
 * ⚠ **IT IS A TABLE ROW AND DELIBERATELY NOT A `## Run` HEADING.**
 * `scripts/patrol-clocks.mts` reads each seat's last run out of the newest
 * `^##\s+Run\b` heading in its own log, so a tool appending a heading there
 * would tell the clock the Janitor had patrolled and push its next run a full
 * period out. A row under a fixed marker is a receipt the clock cannot see.
 */
export const BACKUP_DELETION_MARKER = "<!-- BACKUP-DELETION-ROWS -->";

/** One receipt row: what went, how big, what the deletion stood on, and the tree it was read from. */
export function deletionReceiptRow(
  verdict: BackupVerdict,
  now: Date,
  readFrom: { readonly tree: string; readonly sha: string },
): string {
  const name = verdict.item.path.replace(/\\/g, "/").split("/").pop() ?? verdict.item.path;
  const cells = [
    now.toISOString().replace(/\.\d+Z$/, "Z"),
    "`" + name + "`",
    `${(verdict.item.bytes / 1024).toFixed(1)} kB`,
    String(verdict.entries.length),
    verdict.citation,
    "`" + readFrom.sha.slice(0, 8) + "` in `" + readFrom.tree.replace(/\\/g, "/") + "`",
  ];
  return `| ${cells.join(" | ")} |`;
}

/**
 * The log text with the rows inserted, newest first, directly under the marker.
 *
 * THROWS when the marker is absent rather than appending to the end of the file:
 * a receipt written somewhere nobody reads is the same as no receipt, and this is
 * the one artifact that says what a deletion destroyed.
 */
export function insertDeletionRows(logText: string, rows: readonly string[]): string {
  if (rows.length === 0) return logText;
  const at = logText.indexOf(BACKUP_DELETION_MARKER);
  if (at < 0) {
    throw new Error(
      `backup-retention: the receipt marker ${BACKUP_DELETION_MARKER} is not in the log — refusing to write the receipt anywhere else. `
        + "A deletion whose receipt lands where nobody reads it is an undocumented deletion.",
    );
  }
  const end = at + BACKUP_DELETION_MARKER.length;
  return `${logText.slice(0, end)}\n${rows.join("\n")}${logText.slice(end)}`;
}
