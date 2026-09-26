/**
 * `janitor-backup-retention` — WHAT IN THE BACKUP PILE IS STILL NEEDED? (#1143)
 *
 *     npx tsx scripts/janitor-backup-retention.mts                 the listing
 *     npx tsx scripts/janitor-backup-retention.mts --root <dir>    where the pile lives
 *     npx tsx scripts/janitor-backup-retention.mts --repo <dir>    the tree to ask about bytes
 *     npx tsx scripts/janitor-backup-retention.mts --json          the same, machine-readable
 *
 * The rule it applies, why each refusal exists, and what it deliberately does
 * not cover are all in `scripts/lib/backupRetention.mts` and in
 * `docs/JANITOR_BACKUP_RETENTION.md`. This file only finds the items, reads
 * their bytes, asks git and GitHub, and prints.
 *
 * # ⚠ IT DOES NOT DELETE, AND THERE IS NO FLAG THAT MAKES IT
 *
 * By construction: this module imports no removal function at all. Deleting a
 * backup is a founder act (#1143 was filed rather than worked for that reason,
 * and this is the instrument its "what is actually being asked for" section
 * asked for). What a patrol may do mechanically is produce the list and the
 * citation for every keep.
 *
 * # ⚠ THE FALSE POSITIVE THAT WOULD HAVE COST THE TREE
 *
 * The pile lives beside the worktrees: `C:\Users\Admin` holds
 * `drape-shift-seat-janitor`, `drape-pinned-42652964` and the rest of the crew's
 * trees under the same `drape-*` prefix a backup uses. A name-pattern sweep that
 * called one of those a backup would put a LIVE WORKING TREE on a list whose
 * next reader is a founder holding a delete key. So two independent refusals
 * stand in front of it, and neither trusts the name:
 *
 *  1. a directory holding `.git` (a file for a worktree, a directory for a
 *     clone) is refused outright, and
 *  2. every path `git worktree list` names in the repo being asked about is
 *     refused by absolute path.
 *
 * Both, not either — a worktree whose registration was lost is still a tree with
 * work in it, and a registered tree whose `.git` this reader cannot stat is
 * still registered. `server/backupRetention.test.ts` drives arm 1 against a real
 * directory pair.
 *
 * # WHY AN EMPTY POPULATION IS A REFUSAL
 *
 * `disposable-age`'s founding lesson: it was first run from a fresh worktree and
 * printed **0 of everything, cheerfully**, a reading indistinguishable from "the
 * pile is gone". The pile here lives outside the repository, so a wrong `--root`
 * produces exactly that. Zero items is an error with the root named in it.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import JSZip from "jszip";

import { editionDate, gitIn, nameAnchorOf, readIssues } from "./disposable-age.mts";
import {
  BACKUP_RETENTION_FLOOR_DAYS,
  type BackupEntry,
  type BackupItem,
  type BackupVerdict,
  classifyBackup,
  hashesOf,
  isBackupName,
  summarise,
  treeRefusal,
} from "./lib/backupRetention.mts";

const KNOWN_FLAGS = new Set(["--root", "--repo", "--json"]);

function parseArgs(argv: readonly string[]): { root: string; repo: string; json: boolean } {
  for (const a of argv) {
    if (!a.startsWith("--")) continue;
    /* The `=` form is REFUSED, not tolerated — `disposable-age`'s finding 1,
       whose worked example is a run that went ahead on the defaults having
       silently dropped `--root`. This report feeds a deletion decision, so a
       silently-wrong parameter is the one place "it only reports" stops being a
       defence. */
    if (a.includes("=")) {
      console.error(`janitor-backup-retention: REFUSING — write \`${a.split("=")[0]} <value>\`, not \`${a}\`.`);
      process.exit(2);
    }
    if (!KNOWN_FLAGS.has(a)) {
      console.error(`janitor-backup-retention: REFUSING — unknown flag ${a}. Known: ${[...KNOWN_FLAGS].join(", ")}`);
      process.exit(2);
    }
  }
  const valueOf = (flag: string): string | null => {
    const at = argv.indexOf(flag);
    return at >= 0 && argv[at + 1] && !argv[at + 1]!.startsWith("--") ? argv[at + 1]! : null;
  };
  const repo = path.resolve(valueOf("--repo") ?? path.join(import.meta.dirname, ".."));
  /* The pile's home is the parent of the worktrees, which is where every run
     has written it. Derived from the repo rather than hard-coded so a clone
     somewhere else reads its own neighbourhood. */
  const root = path.resolve(valueOf("--root") ?? path.join(repo, ".."));
  return { root, repo, json: argv.includes("--json") };
}

/** Every absolute path `git worktree list` names, lower-cased for the comparison Windows needs. */
function worktreePaths(repo: string): Set<string> {
  const out = gitIn(repo)("worktree", "list", "--porcelain");
  const paths = new Set<string>();
  for (const line of out.split(/\r?\n/)) {
    const m = /^worktree (.+)$/.exec(line.trim());
    if (m) paths.add(path.resolve(m[1]!).toLowerCase());
  }
  return paths;
}

/** Read one zip's entries. jszip rather than a hand-rolled central directory parser (the fidelity law). */
async function zipEntries(file: string): Promise<BackupEntry[]> {
  const zip = await JSZip.loadAsync(readFileSync(file));
  const entries: BackupEntry[] = [];
  for (const name of Object.keys(zip.files)) {
    const f = zip.files[name]!;
    if (f.dir) continue;
    const bytes = Buffer.from(await f.async("nodebuffer"));
    entries.push({ name, bytes: bytes.length, ...hashesOf(bytes) });
  }
  return entries;
}

function directoryEntries(dir: string): BackupEntry[] {
  const entries: BackupEntry[] = [];
  const walk = (at: string): void => {
    for (const child of readdirSync(at, { withFileTypes: true })) {
      const full = path.join(at, child.name);
      if (child.isDirectory()) {
        walk(full);
        continue;
      }
      if (!child.isFile()) continue;
      const bytes = readFileSync(full);
      entries.push({
        name: path.relative(dir, full).replace(/\\/g, "/"),
        bytes: bytes.length,
        ...hashesOf(bytes),
      });
    }
  };
  walk(dir);
  return entries;
}

function itemBytes(item: { path: string; kind: "zip" | "directory" }, entries: readonly BackupEntry[]): number {
  if (item.kind === "zip") return statSync(item.path).size;
  return entries.reduce((n, e) => n + e.bytes, 0);
}

/**
 * Does git hold these bytes, and which commit shows them?
 *
 * Two calls, cheapest first: `cat-file -e` answers *is this object in the
 * database* instantly, and only an object that IS there is worth a history walk.
 * ⚠ **The history walk is not an optimisation, it is the finding** — an object
 * can sit in the database unreachable (a deleted branch, a pre-gc write), and
 * "recoverable" has to mean recoverable from a commit somebody can name, which
 * is also the citation the ledger wants.
 */
function commitHolding(repo: string, shas: readonly (string | null)[], cache: Map<string, string | null>): string | null {
  const git = gitIn(repo);
  for (const sha of shas) {
    if (!sha) continue;
    const cached = cache.get(sha);
    if (cached !== undefined) {
      if (cached) return cached;
      continue;
    }
    let found: string | null = null;
    try {
      execFileSync("git", ["cat-file", "-e", sha], { cwd: repo, stdio: "ignore" });
      const out = git("log", "--all", "--find-object", sha, "--format=%H", "-1");
      const first = out.split(/\r?\n/).find((l) => l.length > 0);
      found = first ?? null;
    } catch {
      found = null;
    }
    cache.set(sha, found);
    if (found) return found;
  }
  return null;
}

function kb(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} kB`;
}

async function main(): Promise<void> {
  const { root, repo, json } = parseArgs(process.argv.slice(2));
  const now = new Date();
  const trees = worktreePaths(repo);

  const candidates: Array<{ path: string; kind: "zip" | "directory" }> = [];
  let skippedByName = 0;
  let refusedAsTree = 0;
  for (const child of readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, child.name);
    if (child.isFile() && /\.zip$/i.test(child.name)) {
      if (!isBackupName(child.name)) {
        skippedByName += 1;
        continue;
      }
      candidates.push({ path: full, kind: "zip" });
      continue;
    }
    if (!child.isDirectory()) continue;
    if (!isBackupName(child.name)) {
      skippedByName += 1;
      continue;
    }
    /* BOTH grounds, never either — the decision is `treeRefusal`'s so it can be
       driven; the two filesystem reads are this caller's. */
    let holdsGit = false;
    try {
      statSync(path.join(full, ".git"));
      holdsGit = true;
    } catch { /* no .git — an ordinary directory */ }
    const refusal = treeRefusal(full, holdsGit, trees);
    if (refusal) {
      console.error(`  REFUSED (${refusal})  ${child.name}`);
      refusedAsTree += 1;
      continue;
    }
    candidates.push({ path: full, kind: "directory" });
  }

  if (candidates.length === 0) {
    throw new Error(
      `no sweep backups found under ${root} — refusing rather than reporting an empty pile. ` +
        `${skippedByName} names did not match and ${refusedAsTree} directories were refused as trees. ` +
        "A wrong --root reads exactly like a cleared pile (disposable-age's founding lesson).",
    );
  }

  const issues = readIssues(repo);
  const git = gitIn(repo);
  const blobCache = new Map<string, string | null>();
  const verdicts: BackupVerdict[] = [];

  for (const candidate of candidates) {
    const entries = candidate.kind === "zip"
      ? await zipEntries(candidate.path)
      : directoryEntries(candidate.path);
    const item: BackupItem = {
      path: candidate.path,
      kind: candidate.kind,
      bytes: itemBytes(candidate, entries),
      modified: statSync(candidate.path).mtime,
    };
    verdicts.push(
      classifyBackup(
        item,
        entries,
        (entry) => {
          const anchor = nameAnchorOf(entry.name);
          let anchorClosedAt: Date | null = null;
          if (anchor?.kind === "card") {
            const issue = issues.get(anchor.id);
            anchorClosedAt = issue?.state === "CLOSED" ? issue.closedAt : null;
          } else if (anchor?.kind === "edition") {
            anchorClosedAt = editionDate(git, anchor.id);
          }
          return {
            recoverableAt: commitHolding(repo, [entry.rawBlobSha, entry.lfBlobSha], blobCache),
            anchorClosedAt,
          };
        },
        BACKUP_RETENTION_FLOOR_DAYS,
        now,
      ),
    );
  }

  if (json) {
    console.log(JSON.stringify({ root, repo, floorDays: BACKUP_RETENTION_FLOOR_DAYS, verdicts }, null, 2));
    return;
  }

  console.log(`backup retention — ${candidates.length} items under ${root}`);
  console.log(`  the rule: docs/JANITOR_BACKUP_RETENTION.md · floor ${BACKUP_RETENTION_FLOOR_DAYS} days · THIS DELETES NOTHING\n`);
  for (const v of [...verdicts].sort((a, b) => a.item.path.localeCompare(b.item.path))) {
    console.log(
      `  ${v.disposition.toUpperCase().padEnd(10)} ${kb(v.item.bytes).padStart(9)}  ${path.basename(v.item.path)}`,
    );
    console.log(`             ${v.citation}`);
    for (const kept of v.kept.slice(0, 3)) console.log(`             keep: ${kept.name} — ${kept.reason}`);
    if (v.kept.length > 3) console.log(`             keep: …and ${v.kept.length - 3} more`);
  }
  const s = summarise(verdicts);
  console.log(
    `\n  ${s.items} items, ${kb(s.bytes)} · redundant ${s.byDisposition.redundant}` +
      ` · expired ${s.byDisposition.expired} · kept ${s.byDisposition.kept}` +
      ` · too-recent ${s.byDisposition["too-recent"]}`,
  );
  console.log(`  a founder act on the reclaimable ones would free ${kb(s.reclaimableBytes)} across ${s.reclaimableItems} items`);
  if (skippedByName > 0) console.log(`  ${skippedByName} entries under ${root} did not match a backup name and were not classified`);
  console.log("  output/ is NOT in this reading and no rule here covers it — see the doc's own section on why");
}

if (typeof import.meta.main === "undefined") {
  throw new Error(
    "REFUSED — this Node does not support `import.meta.main` (needs >= 24.2, this is "
      + `${process.version}). Without it this reader would exit 0 having read nothing.`,
  );
}

/* Ends by ending the process (scriptExitDiscipline): nothing imports this file, so
   it is a command, and a command's LAST top-level statement exits. The refusals
   inside `main` exit with their own codes before this line is reached. */
main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(`janitor-backup-retention: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
