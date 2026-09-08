/**
 * THE DESK DOES NOT BLOCK A DEPLOY IT IS PROVABLY NO PART OF (#479 — his word
 * on the card, 2026-09-09: *"go with all your recommendations"* — option 2).
 *
 * The rite used to refuse when the working tree held ANY uncommitted tracked
 * file. The tree is shared (`two-seats-one-tree`): the founder's own
 * interactive sessions park law-doc edits in it, and in one night three shifts
 * closed blocked behind two of his files — editions 229–231 held off his page
 * while `CLAUDE.md`'s mtime sat unchanged for three hours (#479's table).
 * Neither side was wrong: a shift must not commit another seat's files, and
 * the guard was doing what it said. The guard was just guarding too much.
 *
 * What the blanket refusal actually protected, read at the rite rather than
 * assumed: the push ships COMMITS (Railway builds main's committed bytes), the
 * script guards and `pnpm check` run in a throwaway worktree OF THE COMMIT,
 * and the quiet/briefing/eye judges read `git show <sha>:…`. A dirty tracked
 * file can therefore only corrupt a deploy in two ways, and both still refuse:
 *
 *  1. **It is a file the push's own commits change** — then the desk holds a
 *     different version of something this deploy ships, and "which bytes am I
 *     deploying" must never be a puzzle. Judged against
 *     `git diff --name-only --no-renames <remoteTip>..HEAD` (renames off so a
 *     rename shows both its old and new path).
 *  2. **It sits where the rite READS THE DISK to decide something real** —
 *     `RITE_DISK_READS` below, `drizzle/` above all: §5b of the rite turns
 *     those bytes into DDL run against the PRODUCTION database, which is the
 *     one place the ceremony converts desk bytes into an irreversible act.
 *
 * Anything else — his parked `CLAUDE.md`, a `docs/specs` draft, a client file
 * mid-design — is named on the receipt as desk-only and does not block.
 *
 * FAIL-CLOSED IS KEPT: when the remote tip cannot be resolved, "not carried"
 * is unproven, so every dirty file refuses — the caller passes `carried: null`
 * and this module treats it as "refuse all", never as "carried nothing".
 *
 * STATED LIMITS, pointing the same way as the pre-push hook's own (#606):
 *  - `RITE_DISK_READS` is an enumerated FLOOR, not derived coverage. The suite
 *    (`server/dirtyTreeGuard.test.ts`) holds it to the rite's bytes with a
 *    second reader — the known disk reads must still exist and be covered —
 *    but a NEW disk read added to the rite must add its prefix here in the
 *    same commit. The rite's guard comment says so at the place it happens.
 *  - The rite's post-push static-asset reading (§5c) reads client/shared/server
 *    bytes from the DESK. A dirty file there can mis-state a RECEIPT line about
 *    bucket assets — never a refusal, never what deploys — so it is reported
 *    (desk-only files are named on the receipt) rather than blocked on.
 */

/** One tracked change, as `git status --porcelain -z --no-renames` records it. */
export type DirtyEntry = { readonly status: string; readonly path: string };

/**
 * Where the rite reads the working tree's DISK to decide something real.
 * A trailing `/` means prefix; anything else matches the exact path.
 * Paths are as git prints them: forward slashes, repo-relative.
 */
export const RITE_DISK_READS: ReadonlyArray<{ readonly path: string; readonly why: string }> = [
  {
    path: "drizzle/",
    why: "§5b reads these bytes (`drizzle/schema.ts`, the migration listing) and auto-applies the SQL against the PRODUCTION database",
  },
  {
    path: "scripts/",
    why: "the rite itself and every lib it imports run from these bytes — a rite that reaches the push must be a committed rite",
  },
  {
    path: "server/crew/",
    why: "the briefing schema judging this push is imported from these bytes at module load",
  },
  {
    path: ".githooks/",
    why: "the pre-push hook that will run on this push executes from these bytes",
  },
  {
    path: ".gitattributes",
    why: "the quiet-edition judge derives its generated-file set from these bytes",
  },
  /* The four `shared/` modules the briefing judge imports at module load —
     exact entries, not a `shared/` prefix, so the founder's parked product
     edits under `shared/` stay desk-only. The suite DERIVES the rite's static
     import graph and refuses any reached file this list does not cover, so a
     fifth import cannot drift past it. */
  {
    path: "shared/crewCardState.ts",
    why: "imported by the briefing schema judging this push, at module load",
  },
  {
    path: "shared/crewNextUpHold.ts",
    why: "imported by the briefing schema judging this push, at module load",
  },
  {
    path: "shared/crewPipelineGroups.ts",
    why: "imported by the briefing schema judging this push, at module load",
  },
  {
    path: "shared/crewWorkSwitches.ts",
    why: "imported by the briefing schema judging this push, at module load",
  },
];

/**
 * Tracked entries out of `git status --porcelain -z --no-renames` output.
 * `-z` because porcelain v1 C-quotes unusual paths and NUL-separated records
 * do not — a path with a space or a quote parses identically to any other.
 * Untracked (`??`) and ignored (`!!`) records are not tracked changes.
 */
export function dirtyEntriesFrom(porcelainZ: string): DirtyEntry[] {
  return porcelainZ
    .split("\0")
    .filter((record) => record.length > 3 && record[2] === " ")
    .map((record) => ({ status: record.slice(0, 2), path: record.slice(3) }))
    .filter((entry) => entry.status !== "??" && entry.status !== "!!");
}

export type DirtyVerdict = {
  /** Entries that refuse the push, each with the reason a person can act on. */
  readonly refused: ReadonlyArray<{ readonly entry: DirtyEntry; readonly why: string }>;
  /** Entries provably no part of the deploy — named on the receipt, never blocking. */
  readonly deskOnly: ReadonlyArray<DirtyEntry>;
};

/**
 * The judgement. `carried` is the set of paths the push's commits change
 * (`git diff --name-only --no-renames <remoteTip>..HEAD`), or `null` when the
 * remote tip could not be resolved — in which case nothing is provable and
 * every entry refuses.
 */
export function judgeDirtyTree(
  entries: ReadonlyArray<DirtyEntry>,
  carried: ReadonlySet<string> | null,
): DirtyVerdict {
  const refused: Array<{ entry: DirtyEntry; why: string }> = [];
  const deskOnly: DirtyEntry[] = [];
  for (const entry of entries) {
    if (carried === null) {
      refused.push({
        entry,
        why: "the remote tip of main could not be resolved, so nothing proves this file is not part of the deploy",
      });
      continue;
    }
    if (carried.has(entry.path)) {
      refused.push({
        entry,
        why: "this push's commits change this file — the desk's version is not what would deploy, and which bytes ship must not be a puzzle",
      });
      continue;
    }
    const read = RITE_DISK_READS.find((reader) =>
      reader.path.endsWith("/") ? entry.path.startsWith(reader.path) : entry.path === reader.path,
    );
    if (read) {
      refused.push({ entry, why: read.why });
      continue;
    }
    deskOnly.push(entry);
  }
  return { refused, deskOnly };
}
