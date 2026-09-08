/**
 * THE RITE'S DESK GUARD — narrowed, not relaxed (#479).
 *
 * The deploy rite refused on ANY uncommitted tracked file, and the shared
 * tree means the founder's own parked law-doc edits blocked three shifts in
 * one night (editions 229–231 held off his page). His word on the card,
 * 2026-09-09: *"go with all your recommendations"* — option 2: refuse only a
 * dirty file the deploy would CARRY or READ. `scripts/lib/dirtyTreeGuard.mts`
 * owns the judgement; these are its arms.
 *
 * Three kinds of arm, because the guard has three ways to be wrong:
 *  - the JUDGEMENT arms drive `judgeDirtyTree` on both sides of every line it
 *    draws (carried / disk-read / desk-only / unprovable), boundaries included;
 *  - the DERIVATION arm walks the rite's real static import graph and refuses
 *    any reached repo file `RITE_DISK_READS` does not cover — the list is an
 *    enumeration, but a NEW import cannot drift past it silently (working law
 *    4: the derivation checks the enumeration);
 *  - the WIRING arms hold the rite's bytes to invoking the guard at all
 *    (invariant 7: a control that is not invoked does not exist) and to the
 *    disk reads the list claims to cover still existing where it says.
 *
 * Stated limit, same as the lib's docblock: `readFileSync`/`readdirSync`
 * reads are pinned as bytes, not derived — a NEW disk read added to the rite
 * must add its path to `RITE_DISK_READS` in the same commit, and the rite's
 * guard comment says so at the place it happens.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  RITE_DISK_READS,
  dirtyEntriesFrom,
  judgeDirtyTree,
} from "../scripts/lib/dirtyTreeGuard.mts";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/* One arm drives real git child processes on a fixture repository (#548). */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const ROOT = path.resolve(__dirname, "..");
const RITE = readFileSync(path.join(ROOT, "scripts", "deploy-rite.mts"), "utf8");

const covered = (file: string): boolean =>
  RITE_DISK_READS.some((reader) =>
    reader.path.endsWith("/") ? file.startsWith(reader.path) : file === reader.path,
  );

describe("dirtyEntriesFrom parses `git status --porcelain -z --no-renames`", () => {
  it("keeps tracked changes with their status, drops untracked and ignored", () => {
    const raw = " M CLAUDE.md\0?? 479-shot.png\0M  drizzle/schema.ts\0!! output/x.txt\0 D docs/specs/OLD.md\0";
    expect(dirtyEntriesFrom(raw)).toEqual([
      { status: " M", path: "CLAUDE.md" },
      { status: "M ", path: "drizzle/schema.ts" },
      { status: " D", path: "docs/specs/OLD.md" },
    ]);
  });

  it("a path with spaces parses whole — the reason -z is used at all", () => {
    expect(dirtyEntriesFrom(' M docs/a name with spaces.md\0')).toEqual([
      { status: " M", path: "docs/a name with spaces.md" },
    ]);
  });

  it("a clean tree is an empty list, not a crash", () => {
    expect(dirtyEntriesFrom("")).toEqual([]);
  });
});

describe("judgeDirtyTree draws exactly the approved line (#479 option 2)", () => {
  const entry = (p: string) => ({ status: " M", path: p });

  it("the #479 fixture passes: his parked CLAUDE.md and a specs draft are desk-only", () => {
    /* The scenario that cost three shifts, judged as the narrowed guard would
       have judged it: an edition push (briefing + mailbox-adjacent docs) with
       his two files parked. Nothing refuses; both are named. */
    const verdict = judgeDirtyTree(
      [entry("CLAUDE.md"), entry("docs/specs/CASTING_V2_PLAN_REBASELINE.md")],
      new Set(["server/crew/crew-briefing.json"]),
    );
    expect(verdict.refused).toEqual([]);
    expect(verdict.deskOnly.map((e) => e.path)).toEqual([
      "CLAUDE.md",
      "docs/specs/CASTING_V2_PLAN_REBASELINE.md",
    ]);
  });

  it("a dirty file the push's commits change REFUSES, and names why", () => {
    const verdict = judgeDirtyTree([entry("CLAUDE.md")], new Set(["CLAUDE.md"]));
    expect(verdict.refused).toHaveLength(1);
    expect(verdict.refused[0]!.why).toContain("this push's commits change this file");
    expect(verdict.deskOnly).toEqual([]);
  });

  it("an unresolvable remote tip refuses EVERYTHING — fail closed, never fail open", () => {
    const verdict = judgeDirtyTree([entry("CLAUDE.md"), entry("docs/x.md")], null);
    expect(verdict.refused).toHaveLength(2);
    for (const refusal of verdict.refused) {
      expect(refusal.why).toContain("could not be resolved");
    }
    expect(verdict.deskOnly).toEqual([]);
  });

  it("dirty `drizzle/` refuses — §5b turns those bytes into production DDL", () => {
    const verdict = judgeDirtyTree([entry("drizzle/schema.ts")], new Set());
    expect(verdict.refused).toHaveLength(1);
    expect(verdict.refused[0]!.why).toContain("PRODUCTION database");
  });

  it("every disk-read entry refuses its own path, on both match kinds", () => {
    /* One arm per entry, derived from the list itself, so adding an entry
       without a working matcher reddens here rather than passing silently. */
    for (const reader of RITE_DISK_READS) {
      const specimen = reader.path.endsWith("/") ? `${reader.path}anything.ts` : reader.path;
      const verdict = judgeDirtyTree([entry(specimen)], new Set());
      expect(verdict.refused, `${reader.path} must refuse ${specimen}`).toHaveLength(1);
      expect(verdict.refused[0]!.why).toBe(reader.why);
    }
  });

  it("prefix boundaries hold: a sibling directory or suffixed file is desk-only", () => {
    const verdict = judgeDirtyTree(
      [entry("scripts-archive/old.mts"), entry(".gitattributes.bak"), entry("server/crewless.ts")],
      new Set(),
    );
    expect(verdict.refused).toEqual([]);
    expect(verdict.deskOnly).toHaveLength(3);
  });

  it("a mixed desk splits: the drizzle file refuses, his doc rides the receipt", () => {
    const verdict = judgeDirtyTree([entry("CLAUDE.md"), entry("drizzle/0061_x.sql")], new Set());
    expect(verdict.refused.map((r) => r.entry.path)).toEqual(["drizzle/0061_x.sql"]);
    expect(verdict.deskOnly.map((e) => e.path)).toEqual(["CLAUDE.md"]);
  });
});

describe("RITE_DISK_READS covers the rite's real import graph — derived, not remembered", () => {
  /* Walk the rite's static imports the way tsx will load them: relative
     specifiers only (bare imports are node_modules, not this repository),
     `.js` specifiers resolving to `.ts` sources, dynamic `import("...")`
     included. Type-only imports are walked too — erased at runtime, but
     over-demanding coverage is the safe direction and costs one list line. */
  const resolveSpec = (from: string, spec: string): string | null => {
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
    const candidates = [
      base,
      base.replace(/\.js$/, ".ts"),
      base.replace(/\.js$/, ".tsx"),
      `${base}.ts`,
      `${base}.mts`,
      `${base}.tsx`,
    ];
    return candidates.find((candidate) => existsSync(path.join(ROOT, candidate))) ?? null;
  };

  const walk = (): { reached: string[]; unresolved: string[] } => {
    const seen = new Set<string>();
    const unresolved: string[] = [];
    const queue = ["scripts/deploy-rite.mts"];
    while (queue.length > 0) {
      const file = queue.shift()!;
      if (seen.has(file)) continue;
      seen.add(file);
      if (!/\.(m?ts|tsx)$/.test(file)) continue;
      const text = readFileSync(path.join(ROOT, file), "utf8");
      /* Three shapes: `from "…"` (covers import-from AND export-from — the
         barrel shape that blinded the Atlas for months), dynamic
         `import("…")`, and the bare side-effect `import "…"` (#707 review,
         finding 4 — it matched neither alternative and so landed in neither
         `reached` nor `unresolved`, escaping the refuse-never-shrug rule). */
      for (const match of text.matchAll(/from\s+"(\.[^"]+)"|import\s*\(\s*"(\.[^"]+)"\s*\)|import\s+"(\.[^"]+)"/g)) {
        const spec = match[1] ?? match[2] ?? match[3]!;
        const resolved = resolveSpec(file, spec);
        if (resolved) queue.push(resolved);
        else unresolved.push(`${file} -> ${spec}`);
      }
    }
    return { reached: [...seen].sort(), unresolved };
  };

  it("every file the rite loads at runtime is covered, and the walker provably walked", () => {
    const { reached, unresolved } = walk();
    /* A walker that cannot resolve a specifier is blind about that edge —
       refuse, never shrug (invariant 7). */
    expect(unresolved, "unresolvable import specifiers in the rite's graph").toEqual([]);
    /* Negative control on the instrument: a regex that stopped matching would
       return a tiny graph and pass any coverage test. The graph is known to
       reach these, and to be at least this big. */
    expect(reached).toContain("scripts/lib/ceremonyAutoApply.mts");
    expect(reached).toContain("server/crew/crewBriefing.ts");
    expect(reached).toContain("shared/crewWorkSwitches.ts");
    expect(reached.length).toBeGreaterThanOrEqual(20);
    const escaped = reached.filter((file) => !covered(file));
    expect(escaped, "rite-loaded files RITE_DISK_READS does not cover — add each to the list").toEqual([]);
  });
});

describe("the two path reads agree on encoding — driven on a real repository (#707 review, finding 1)", () => {
  it("a carried dirty café file refuses as carried; the unquoted read provably misses it", () => {
    /* The rite's EXACT argv on both sides, against a repository whose pushed
       commit and desk both touch a non-ASCII filename. The negative control
       is the bug itself: the pre-fix diff read (no -z) C-quotes the path, the
       carried set spells it differently from the -z dirty set, and the judge
       fails open on the one case rule 1 exists to refuse. */
    const repo = mkdtempSync(path.join(os.tmpdir(), "drape-quotepath-"));
    try {
      const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" });
      git("init", "--quiet");
      git("config", "user.email", "suite@drape.test");
      git("config", "user.name", "suite");
      /* Pinned so the negative control demonstrates on any machine's global
         config; the -z reads under test are quoting-immune either way. */
      git("config", "core.quotePath", "true");
      writeFileSync(path.join(repo, "base.txt"), "tip\n");
      git("add", "base.txt");
      git("commit", "--quiet", "-m", "the remote tip");
      const tip = git("rev-parse", "HEAD").trim();
      mkdirSync(path.join(repo, "docs"));
      writeFileSync(path.join(repo, "docs", "café-brief.md"), "committed\n");
      git("add", "docs");
      git("commit", "--quiet", "-m", "the push");
      writeFileSync(path.join(repo, "docs", "café-brief.md"), "desk edit\n");

      const dirty = dirtyEntriesFrom(git("status", "--porcelain", "-z", "--no-renames"));
      expect(dirty.map((entry) => entry.path)).toContain("docs/café-brief.md");
      const carried = new Set(
        git("diff", "--name-only", "--no-renames", "-z", `${tip}..HEAD`).split("\0").filter(Boolean),
      );
      const verdict = judgeDirtyTree(dirty, carried);
      expect(verdict.refused).toHaveLength(1);
      expect(verdict.refused[0]!.why).toContain("this push's commits change this file");

      const unquoted = new Set(
        git("diff", "--name-only", "--no-renames", `${tip}..HEAD`).split(/\r?\n/).filter(Boolean),
      );
      expect([...unquoted].some((p) => p.startsWith('"')), "git did C-quote the path — the control is live").toBe(true);
      expect(judgeDirtyTree(dirty, unquoted).refused, "the pre-fix read fails open — the bug was real").toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe("the rite invokes the guard, and the disk reads the list claims still exist", () => {
  it("the guard is wired: -z on BOTH path reads, throwing reads, the judge invoked", () => {
    expect(RITE).toContain("dirtyEntriesFrom(");
    expect(RITE).toContain("judgeDirtyTree(");
    /* Both reads -z (#707 review, finding 1: name-only C-quotes unusual paths
       while -z status does not, and two spellings of one path fail open) and
       both through the throwing runner (finding 3: `run()` hands a failed
       git's stderr to the parser, which reads it as a clean tree). */
    expect(RITE).toContain('gitOrThrow("status", "--porcelain", "-z", "--no-renames")');
    expect(RITE).toContain('gitOrThrow("diff", "--name-only", "--no-renames", "-z"');
  });

  it("the atlas and capability custody checks run on the COMMIT, not the desk", () => {
    /* #707 review, finding 2 — the same desk-vs-commit class as the script
       guards. The worktree recipe is pinned at the bytes: the custody block
       hands `sha` to `inWorktreeOf` and spawns the checks with the tree as
       cwd, so desk dirt in a scanned root can neither redden them nor let a
       stale committed map ride a desk that happens to agree. */
    expect(RITE).toContain("const custody = inWorktreeOf(");
    expect(RITE).toContain('cwd: tree, encoding: "utf8", shell: true');
    expect(RITE).toContain("the commit being pushed — the push does not fire");
  });

  it("the pinned disk reads are where the list says: drizzle bytes and .gitattributes", () => {
    /* Byte pins, not proofs of absence: they hold the KNOWN reads to their
       covering entries. If one moves, this arm asks the list question again. */
    expect(RITE).toContain('readFileSync("drizzle/schema.ts"');
    expect(RITE).toContain("migrationFilesFrom(readdirSync");
    expect(RITE).toContain('".gitattributes"');
    for (const known of ["drizzle/", "scripts/", "server/crew/", ".githooks/", ".gitattributes"]) {
      expect(RITE_DISK_READS.map((reader) => reader.path)).toContain(known);
    }
  });

  it("the blanket refusal is gone — the guard cannot quietly be both", () => {
    /* The old shape refused on `dirty.length > 0` with no judgement. Its exact
       die-line is absent; the narrowed one is present. */
    expect(RITE).not.toContain("the working tree has ${dirty.length} uncommitted tracked change(s)");
    expect(RITE).toContain("sit where this deploy would carry or read them");
  });
});
