/**
 * THE BACKUP RETENTION RULE'S OWN CONTROLS (#1143).
 *
 * The rule's next reader is a founder holding a delete key, so every arm here
 * is a control on a verdict that could cost work:
 *
 *  - the blob hash is checked against REAL `git hash-object` output, never
 *    against itself — a hash function verified by its own implementation is not
 *    verified, and this one decides whether a file's only copy is redundant;
 *  - the empty reading THROWS, driven, because zero entries satisfies "every
 *    entry is recoverable" for free and that is exactly how a sole copy would be
 *    deleted by a green-looking report;
 *  - the tree refusal is driven on BOTH of its grounds against a real directory
 *    pair, because the pile lives beside the crew's live worktrees under the
 *    same `drape-` prefix;
 *  - each disposition is produced AND its neighbours are proven not to be, so a
 *    classifier that returned one constant could not pass.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it, vi } from "vitest";

import {
  BACKUP_DELETION_MARKER,
  BACKUP_RETENTION_FLOOR_DAYS,
  type BackupDisposition,
  type BackupEntry,
  type BackupItem,
  DELETABLE_DISPOSITIONS,
  classifyBackup,
  classifyEntry,
  deletionReceiptRow,
  deletionRefusal,
  gitBlobSha,
  hashesOf,
  insertDeletionRows,
  isBackupName,
  itemsToDelete,
  looksBinary,
  summarise,
  treeRefusal,
} from "../scripts/lib/backupRetention.mts";

import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/* This suite spawns real `git` processes (init, add, commit, hash-object) in throwaway repositories, so it
   declares the child-process class timeout (#548) — the gate reddened #1293 for the missing line. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

/** A tree-walking / spawning suite declares its own ceiling (the contended-timeout guard). */
const CONTENDED_TEST_TIMEOUT_MS = 30_000;

const NOW = new Date("2026-09-26T00:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number): Date => new Date(NOW.getTime() - n * DAY_MS);

const scratch: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "backup-retention-"));
  scratch.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

function entry(name: string, bytes: Buffer): BackupEntry {
  return { name, bytes: bytes.length, ...hashesOf(bytes) };
}

function item(overrides: Partial<BackupItem> = {}): BackupItem {
  return {
    path: "C:/Users/Admin/drape-janitor-run1-disposables-2026-08-19.zip",
    kind: "zip",
    bytes: 1234,
    modified: daysAgo(30),
    ...overrides,
  };
}

describe("the blob hash — checked against git, not against itself", () => {
  it(
    "gitBlobSha equals `git hash-object` for text and for binary bytes",
    () => {
      const dir = tempDir();
      const cases: Array<{ name: string; bytes: Buffer }> = [
        { name: "text.txt", bytes: Buffer.from("hello\nworld\n", "utf8") },
        { name: "empty.txt", bytes: Buffer.alloc(0) },
        { name: "crlf.txt", bytes: Buffer.from("a\r\nb\r\n", "utf8") },
        { name: "bin.dat", bytes: Buffer.from([0x89, 0x50, 0x00, 0x4e, 0x47, 0xff]) },
        { name: "utf8.txt", bytes: Buffer.from("héllo — em dash\n", "utf8") },
      ];
      for (const c of cases) {
        const file = path.join(dir, c.name);
        writeFileSync(file, c.bytes);
        /* `--no-filters` so git hashes the bytes on disk rather than applying
           this clone's own autocrlf — the question here is about bytes. */
        const fromGit = execFileSync("git", ["hash-object", "--no-filters", file], { encoding: "utf8" }).trim();
        expect(gitBlobSha(c.bytes), c.name).toBe(fromGit);
      }
    },
    CONTENDED_TEST_TIMEOUT_MS,
  );

  it("the binary test is a NUL test, and a CRLF text file gets a SECOND hash while an LF one does not", () => {
    expect(looksBinary(Buffer.from([1, 2, 0, 3]))).toBe(true);
    expect(looksBinary(Buffer.from("plain text\n", "utf8"))).toBe(false);

    const crlf = hashesOf(Buffer.from("a\r\nb\r\n", "utf8"));
    expect(crlf.lfBlobSha).not.toBeNull();
    expect(crlf.lfBlobSha).not.toBe(crlf.rawBlobSha);
    /* And the second hash is the hash of the normalised bytes, not of something else. */
    expect(crlf.lfBlobSha).toBe(gitBlobSha(Buffer.from("a\nb\n", "utf8")));

    /* NEGATIVE CONTROL: nothing to normalise means no second question is asked. */
    expect(hashesOf(Buffer.from("a\nb\n", "utf8")).lfBlobSha).toBeNull();
    /* And binary is never normalised, whatever it happens to contain. */
    expect(hashesOf(Buffer.from([0x0d, 0x0a, 0x00, 0x0d, 0x0a])).lfBlobSha).toBeNull();
  });
});

describe("⚠ the empty reading is an ERROR, never a verdict", () => {
  it("classifyBackup THROWS on zero entries and says why", () => {
    expect(() => classifyBackup(item(), [], () => ({ recoverableAt: null, anchorClosedAt: null }), 7, NOW))
      .toThrow(/read as ZERO entries/);
  });

  it("POSITIVE CONTROL: one entry with the same evidence classifies rather than throwing", () => {
    const verdict = classifyBackup(
      item(),
      [entry("_1.txt", Buffer.from("x"))],
      () => ({ recoverableAt: null, anchorClosedAt: null }),
      7,
      NOW,
    );
    expect(verdict.disposition).toBe("kept");
  });
});

describe("⚠ a live worktree is never a backup — both grounds", () => {
  it("refuses a registered worktree by path, case-insensitively (Windows)", () => {
    const registered = new Set(["c:/users/admin/drape-shift-seat-janitor"]);
    expect(treeRefusal("C:/Users/Admin/drape-shift-seat-janitor", false, registered))
      .toBe("registered worktree, not a backup");
  });

  it("refuses an UNregistered directory that holds .git — and that is a real pair on disk", () => {
    const root = tempDir();
    const tree = path.join(root, "drape-janitor-run1-looks-like-a-backup");
    const plain = path.join(root, "drape-janitor-run1-really-a-backup");
    mkdirSync(tree);
    mkdirSync(plain);
    writeFileSync(path.join(tree, ".git"), "gitdir: ../.git/worktrees/x\n");
    writeFileSync(path.join(plain, "_1-thing-disposable.mts"), "x");

    /* `throwIfNoEntry: false` — the absent case is an answer here, not an
       exception, and the repo-wide stat guard asks for this spelling. */
    const holdsGit = (dir: string): boolean =>
      statSync(path.join(dir, ".git"), { throwIfNoEntry: false }) !== undefined;
    expect(holdsGit(tree)).toBe(true);
    expect(holdsGit(plain)).toBe(false);

    /* Registered by nothing, so only the `.git` ground can refuse it. */
    expect(treeRefusal(tree, holdsGit(tree), new Set())).toBe("holds .git, not a backup");
    /* NEGATIVE CONTROL: an ordinary directory of the same name shape passes. */
    expect(treeRefusal(plain, holdsGit(plain), new Set())).toBeNull();
    expect(isBackupName(path.basename(plain))).toBe(true);
  }, CONTENDED_TEST_TIMEOUT_MS);

  it("the name list admits every naming style nine runs produced and refuses a worktree's", () => {
    for (const yes of [
      "drape-debris-2026-08-19.zip",
      "drape-untracked-2026-08-19.zip",
      "drape-untracked-tail-2026-08-19.zip",
      "drape-disposables-sweep-2026-09-12.zip",
      "drape-janitor-run6-crew-eye-orphans",
      "drape-census-scratch-2026-09-12.zip",
      "drape-root-frames-sweep-2026-09-21.zip",
      "drape-shift-frames-624-2026-09-18.zip",
    ]) expect(isBackupName(yes), yes).toBe(true);
    /* The trees that live in the same directory, by their real names. */
    for (const no of [
      "drape-shift-seat-janitor",
      "drape-pinned-42652964",
      "drape-shift-edition538",
      "Drape",
      "output",
    ]) expect(isBackupName(no), no).toBe(false);
  });
});

describe("one entry's verdict, limb by limb", () => {
  const e = entry("_1141-thing-disposable.mts", Buffer.from("x"));

  it("bytes in git expire it, and the CITATION is the commit", () => {
    const v = classifyEntry(e, { recoverableAt: "315f3386", anchorClosedAt: null }, 7, NOW);
    expect(v.expired).toBe(true);
    expect(v.reason).toContain("315f3386");
  });

  it("a closed card past the floor expires it; inside the floor it does not", () => {
    expect(classifyEntry(e, { recoverableAt: null, anchorClosedAt: daysAgo(30) }, 7, NOW).expired).toBe(true);
    const recent = classifyEntry(e, { recoverableAt: null, anchorClosedAt: daysAgo(2) }, 7, NOW);
    expect(recent.expired).toBe(false);
    expect(recent.reason).toContain("inside the 7-day floor");
  });

  it("an OPEN card is kept and says the work may be live", () => {
    const v = classifyEntry(e, { recoverableAt: null, anchorClosedAt: null }, 7, NOW);
    expect(v.expired).toBe(false);
    expect(v.reason).toContain("card #1141 is not closed");
  });

  it("⚠ a name that anchors at nothing is kept whatever its age — the R2-orphan shape", () => {
    const orphan = entry("013c8fa6-59fb-4169-9594-7f93e64a3071.png", Buffer.from([0x89, 0x50, 0x00]));
    const v = classifyEntry(orphan, { recoverableAt: null, anchorClosedAt: null }, 7, NOW);
    expect(v.expired).toBe(false);
    expect(v.reason).toContain("anchors at nothing");
    /* And no amount of evidence about OTHER entries can change it — the only
       thing that expires this one is its own bytes turning up in git. */
    expect(classifyEntry(orphan, { recoverableAt: "abc1234", anchorClosedAt: null }, 7, NOW).expired).toBe(true);
  });
});

describe("the item's disposition, and each one excludes the others", () => {
  const closed = { recoverableAt: null, anchorClosedAt: daysAgo(30) };
  const inGit = { recoverableAt: "deadbee", anchorClosedAt: null };
  const open = { recoverableAt: null, anchorClosedAt: null };
  const two = [entry("_1-a-disposable.mts", Buffer.from("a")), entry("_2-b-disposable.mts", Buffer.from("b"))];

  it("REDUNDANT only when every entry is in git — one non-git expiry makes it EXPIRED instead", () => {
    expect(classifyBackup(item(), two, () => inGit, 7, NOW).disposition).toBe("redundant");
    const mixedExpiry = classifyBackup(
      item(),
      two,
      (x) => (x.name.startsWith("_1") ? inGit : closed),
      7,
      NOW,
    );
    expect(mixedExpiry.disposition).toBe("expired");
    expect(mixedExpiry.kept).toHaveLength(0);
    expect(mixedExpiry.citation).toContain("1 by git");
  });

  it("KEPT the moment ONE entry is not recoverable, and the citation names it", () => {
    const v = classifyBackup(item(), two, (x) => (x.name.startsWith("_1") ? inGit : open), 7, NOW);
    expect(v.disposition).toBe("kept");
    expect(v.kept.map((k) => k.name)).toEqual(["_2-b-disposable.mts"]);
    expect(v.citation).toContain("1 of 2");
    expect(v.citation).toContain("_2-b-disposable.mts");
  });

  it("⚠ TOO-RECENT outranks its contents: a zip written this week is kept even when everything in it is redundant", () => {
    const v = classifyBackup(item({ modified: daysAgo(2) }), two, () => inGit, 7, NOW);
    expect(v.disposition).toBe("too-recent");
    expect(v.citation).toContain("inside the 7-day floor");
    /* NEGATIVE CONTROL: the same contents one day past the floor is redundant,
       so the floor is what moved the verdict and not the evidence. */
    expect(classifyBackup(item({ modified: daysAgo(8) }), two, () => inGit, 7, NOW).disposition)
      .toBe("redundant");
  });

  it("the floor is the litter manifest's 7 days, declared once", () => {
    expect(BACKUP_RETENTION_FLOOR_DAYS).toBe(7);
  });
});

describe("the summary counts what a founder act would free, and nothing else", () => {
  it("reclaimable excludes KEPT and TOO-RECENT bytes", () => {
    const inGit = { recoverableAt: "deadbee", anchorClosedAt: null };
    const open = { recoverableAt: null, anchorClosedAt: null };
    const one = [entry("_1-a-disposable.mts", Buffer.from("a"))];
    const verdicts = [
      classifyBackup(item({ path: "a.zip", bytes: 100 }), one, () => inGit, 7, NOW),
      classifyBackup(item({ path: "b.zip", bytes: 200 }), one, () => open, 7, NOW),
      classifyBackup(item({ path: "c.zip", bytes: 400, modified: daysAgo(1) }), one, () => inGit, 7, NOW),
    ];
    const s = summarise(verdicts);
    expect(s.items).toBe(3);
    expect(s.bytes).toBe(700);
    /* Only the redundant one is reclaimable — 200 is a sole copy and 400 is recent. */
    expect(s.reclaimableItems).toBe(1);
    expect(s.reclaimableBytes).toBe(100);
    expect(s.byDisposition).toEqual({ redundant: 1, expired: 0, kept: 1, "too-recent": 1 });
  });
});

/* ───────────────────────────────────────────────────────────────────────────
   THE DELETION ARM'S OWN CONTROLS (#1294, his word: "delete them itself")

   The rule's next reader used to be a founder holding a delete key; since his
   word it can be the script itself, so these arms are the difference between a
   check and a shredder. The two the card named are the first two below: a KEPT
   item admitted to the deletion set must go red, and a listing read from a tree
   that is not main's tip must be refused.
   ─────────────────────────────────────────────────────────────────────────── */

describe("what a patrol may delete by itself — his word on #1294, and nothing wider", () => {
  const closed = { recoverableAt: null, anchorClosedAt: daysAgo(30) };
  const inGit = { recoverableAt: "deadbee", anchorClosedAt: null };
  const open = { recoverableAt: null, anchorClosedAt: null };
  const one = [entry("_1141-thing-disposable.mts", Buffer.from("x"))];
  /* The real keep this arm exists for: 31 files downloaded before their
     originals were deleted from the bucket, so the backup IS the only copy. */
  const orphan = [entry("013c8fa6-59fb-4169-9594-7f93e64a3071.png", Buffer.from([0x89, 0x50, 0x00]))];

  const expired = classifyBackup(item({ path: "C:/p/drape-janitor-run6-late-sweep" }), one, () => closed, 7, NOW);
  const redundant = classifyBackup(item({ path: "C:/p/drape-debris-2026-08-19.zip" }), one, () => inGit, 7, NOW);
  const kept = classifyBackup(item({ path: "C:/p/drape-janitor-run6-crew-eye-orphans" }), orphan, () => open, 7, NOW);
  const tooRecent = classifyBackup(item({ path: "C:/p/drape-janitor-run9-disposables-2026-09-24.zip", modified: daysAgo(2) }), one, () => closed, 7, NOW);

  it("the four dispositions are the fixtures they claim to be — otherwise the arms below prove nothing", () => {
    expect(expired.disposition).toBe("expired");
    expect(redundant.disposition).toBe("redundant");
    expect(kept.disposition).toBe("kept");
    expect(tooRecent.disposition).toBe("too-recent");
  });

  it("⚠ itemsToDelete takes the EXPIRED one and leaves the other three — the KEPT one is 31 files' only copy", () => {
    const doomed = itemsToDelete([kept, tooRecent, redundant, expired]);
    expect(doomed).toHaveLength(1);
    expect(doomed[0]!.item.path).toBe(expired.item.path);
    /* Named individually rather than only by the count, so a filter that let two
       through could not pass by accident of ordering. */
    const paths = doomed.map((v) => v.item.path);
    expect(paths, "the R2 orphans are the only copies that exist").not.toContain(kept.item.path);
    expect(paths, "inside the 7-day floor, not judged on its contents").not.toContain(tooRecent.item.path);
    expect(paths, "a stronger proof, and outside the road his word named").not.toContain(redundant.item.path);
  });

  it("the deletable set is exactly {expired}, held against the FULL population rather than a sentence", () => {
    /*
      `summarise` enumerates every member of BackupDisposition because its record
      type forces it to, so this population is derived from the module and not
      typed here (working law 4). A fifth disposition is visible to this arm the
      day it lands, and defaults to not deletable.
    */
    const population = Object.keys(summarise([]).byDisposition) as BackupDisposition[];
    expect(population.sort()).toEqual(["expired", "kept", "redundant", "too-recent"]);
    expect(population.filter((d) => DELETABLE_DISPOSITIONS.has(d))).toEqual(["expired"]);
  });

  it("an empty listing deletes nothing — the shape that would otherwise pass every arm above", () => {
    expect(itemsToDelete([])).toEqual([]);
  });
});

describe("a verdict is only as good as the tree it was read from (PR #1293's review)", () => {
  const sha = (c: string): string => c.repeat(40);
  const fresh = { headSha: sha("a"), remoteMainSha: sha("a"), dirtyPaths: [] as string[] };

  it("POSITIVE — main's tip, clean, is actionable", () => {
    expect(deletionRefusal(fresh)).toBeNull();
    /* Case and whitespace are what `git` and `ls-remote` actually differ by. */
    expect(deletionRefusal({ ...fresh, headSha: `${sha("A")}\n`, remoteMainSha: ` ${sha("a")} ` })).toBeNull();
  });

  it("⚠ a tree that is NOT main's tip is refused, and the message names both shas", () => {
    const refusal = deletionRefusal({ ...fresh, remoteMainSha: sha("b") });
    expect(refusal).toBeTruthy();
    expect(refusal).toContain("aaaaaaaa");
    expect(refusal).toContain("bbbbbbbb");
  });

  it("⚠ a failed read is NEVER agreement — two empty strings do not compare equal", () => {
    /*
      The failure this arm exists for: `git ls-remote` with no network prints
      nothing, and a refusal written as `head !== remote` would then compare ""
      with "" and let the deletion through — a guard that passes hardest exactly
      when its evidence is missing.
    */
    expect(deletionRefusal({ headSha: "", remoteMainSha: "", dirtyPaths: [] })).toContain("failed read is not agreement");
    expect(deletionRefusal({ ...fresh, remoteMainSha: "" })).toContain("refs/heads/main");
    expect(deletionRefusal({ ...fresh, headSha: "abc1234" })).toContain("HEAD");
    /* A short sha is not a prefix match either — 40-hex or it is not an answer. */
    expect(deletionRefusal({ headSha: "aaaaaaaa", remoteMainSha: "aaaaaaaa", dirtyPaths: [] })).toBeTruthy();
  });

  it("a dirty tree is refused, and the message names the first path", () => {
    const refusal = deletionRefusal({ ...fresh, dirtyPaths: [" M docs/JANITOR_LOG.md"] });
    expect(refusal).toContain("uncommitted");
    expect(refusal).toContain("JANITOR_LOG.md");
  });
});

describe("the receipt — the only record of what a deletion destroyed", () => {
  const closed = { recoverableAt: null, anchorClosedAt: daysAgo(30) };
  const one = [entry("_1141-thing-disposable.mts", Buffer.from("x"))];
  const verdict = classifyBackup(
    item({ path: "C:\\Users\\Admin\\drape-janitor-run6-late-sweep", bytes: 16_900 }),
    one,
    () => closed,
    7,
    NOW,
  );
  const row = deletionReceiptRow(verdict, NOW, { tree: "C:\\Users\\Admin\\Drape", sha: "fa8ac509".padEnd(40, "0") });

  it("a row carries what went, what it stood on, and the tree it was read from", () => {
    expect(row.startsWith("| ")).toBe(true);
    expect(row).toContain("drape-janitor-run6-late-sweep");
    expect(row).toContain("16.5 kB");
    expect(row).toContain(verdict.citation);
    expect(row).toContain("fa8ac50");
    expect(row).toContain("C:/Users/Admin/Drape");
  });

  it("rows go under the marker, newest first, and nothing else in the file moves", () => {
    const log = `# log\n\n| when | item |\n|---|---|\n${BACKUP_DELETION_MARKER}\n| older |\n\n## Run 1 — 2026-08-26\n`;
    const out = insertDeletionRows(log, [row]);
    const lines = out.split("\n");
    const at = lines.indexOf(BACKUP_DELETION_MARKER);
    expect(lines[at + 1]).toBe(row);
    expect(lines[at + 2]).toBe("| older |");
    expect(out.endsWith("## Run 1 — 2026-08-26\n")).toBe(true);
  });

  it("no rows leaves the file byte-identical", () => {
    const log = `# log\n${BACKUP_DELETION_MARKER}\n`;
    expect(insertDeletionRows(log, [])).toBe(log);
  });

  it("⚠ a missing marker THROWS rather than appending somewhere nobody reads", () => {
    expect(() => insertDeletionRows("# log\nno marker here\n", [row])).toThrow(/receipt marker/);
  });

  it("the real docs/JANITOR_LOG.md holds the marker — the receipt has a home in the tree", () => {
    const log = readFileSync(path.join(process.cwd(), "docs", "JANITOR_LOG.md"), "utf8");
    expect(log, "the tool refuses to delete without somewhere to write the receipt").toContain(BACKUP_DELETION_MARKER);
  });

  it(
    "⚠ a receipt row can never read as a patrol run — the clock's OWN patterns, not a copy of them",
    () => {
      /*
        `scripts/patrol-clocks.mts` reads the Janitor's last run out of the newest
        `## Run` heading in that same file. A tool appending a heading there would
        tell the clock the seat had patrolled and push its next run three days
        out. The patterns are extracted from the clock reader's source rather than
        retyped, so this arm follows them if they move (working law 4).
      */
      const clockSource = readFileSync(path.join(process.cwd(), "scripts", "patrol-clocks.mts"), "utf8");
      const runPatterns = [...clockSource.matchAll(/\/(\^##[^/\n]*Run[^/\n]*)\//g)].map((m) => new RegExp(m[1]!));
      expect(runPatterns.length, "the clock reader's run-heading patterns must be found, or this arm proves nothing")
        .toBeGreaterThanOrEqual(2);
      /* POSITIVE CONTROL: they do match a real run heading. */
      const realHeading = "## Run 9 — 2026-09-24 01:15–0x:xx AEST (Janitor, patrol #9, card #1141)";
      expect(runPatterns.some((re) => re.test(realHeading))).toBe(true);
      /* And they match neither the receipt section's heading nor any row. */
      for (const re of runPatterns) {
        expect(re.test("## Backup deletions — the receipt table (#1294)"), String(re)).toBe(false);
        expect(re.test(row), String(re)).toBe(false);
        expect(re.test(BACKUP_DELETION_MARKER), String(re)).toBe(false);
      }
    },
    CONTENDED_TEST_TIMEOUT_MS,
  );
});
