import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * ARM 3 OF THE PRE-COMMIT GATE, DRIVEN RATHER THAN READ (card #501).
 *
 * `.githooks/atlas-stage` regenerates the generated maps on any commit staging
 * a path they are built from, so the map a branch pushes is the map of its own
 * tree. It exists because five of the last sixty `gate.yml` runs failed on one
 * step — `Architecture Atlas freshness` — each costing the shift a red, a local
 * regenerate, a re-push and a second seven-minute gate.
 *
 * Like the pre-commit and merge-driver suites this mocks neither `sh` nor git:
 * real temporary repositories, this tree's `.githooks`, git's own exit codes.
 * The generator is stood in for by a shell command (`drape.atlasGenerate`) that
 * lists the tree's `server/` into the tracked map — which is the property that
 * matters, since a regeneration reading the wrong tree would write the wrong
 * map, and a hook that staged the map WITHOUT regenerating would write a stale
 * one.
 *
 * BOTH DIRECTIONS OF EVERY ARM (law 2). The negative controls are the
 * load-bearing ones here and are deliberately first in the file: a hook that
 * fired on EVERY commit would pass every "it regenerated" arm by accident, and
 * would be a nine-second tax on the founder's own docs commits. So one arm
 * proves a docs-only commit does not fire, and one proves the merge path is not
 * paid for twice.
 */

const HOOKS_DIR = resolve(".githooks").replace(/\\/g, "/");
/** Writes the map from the tree it is run in — a wrong tree writes a wrong map. */
const GENERATE = "ls server | sort > docs/architecture/map.json";
const MAP = "docs/architecture/map.json";

type Result = { status: number; stderr: string; stdout: string };

function gitWith(config: string[], cwd: string, ...args: string[]): Result {
  const base = [
    "-c", "core.autocrlf=false",
    "-c", `core.hooksPath=${HOOKS_DIR}`,
    "-c", "user.name=gate",
    "-c", "user.email=gate@example.invalid",
    "-c", "commit.gpgsign=false",
  ];
  /* spawnSync, not execFileSync, and the reason is a defect this suite caught in
     itself: execFileSync returns stdout alone and surfaces stderr only by
     THROWING, so on a successful commit `stderr` was the empty string. Two
     positive arms failed honestly — and the negative control's
     `not.toContain("regenerating")` was passing over nothing at all, which is
     the absence-only-expect class. The hook says what it did on stderr whether
     it succeeds or fails, so the reading must be able to see both. */
  const run = spawnSync("git", [...base, ...config, ...args], { cwd, encoding: "utf8" });
  return {
    status: typeof run.status === "number" ? run.status : -1,
    stderr: String(run.stderr ?? ""),
    stdout: String(run.stdout ?? ""),
  };
}

/** git with a generator that works. */
const armed = (cwd: string, ...args: string[]) =>
  gitWith(["-c", `drape.atlasGenerate=${GENERATE}`], cwd, ...args);
/** git with a generator that FAILS — a map that could not be built must not ship as fresh. */
const broken = (cwd: string, ...args: string[]) =>
  gitWith(["-c", "drape.atlasGenerate=false"], cwd, ...args);

const repos: string[] = [];
afterAll(() => {
  for (const dir of repos) rmSync(dir, { recursive: true, force: true });
});

/**
 * A repository shaped like this one: a `server/` tree, a tracked generated map
 * under `docs/architecture/`, and `.gitattributes` naming it `merge=atlas` —
 * which is the only place either hook learns which files are generated.
 */
function repoWithMap(): string {
  const dir = mkdtempSync(join(tmpdir(), "drape-atlas-commit-"));
  repos.push(dir);
  armed(dir, "init", "-q", "-b", "main");
  mkdirSync(join(dir, "server"));
  mkdirSync(join(dir, "docs", "architecture"), { recursive: true });
  writeFileSync(join(dir, "server", "seed.ts"), "export const seed = 1;\n");
  writeFileSync(join(dir, ".gitattributes"), `${MAP} merge=atlas\n`);
  writeFileSync(join(dir, MAP), "seed.ts\n");
  /* The seed commit stages `server/seed.ts` and so fires the arm once, writing
     the map it would write. That is not what any arm below measures: every arm
     acts and then reads the map produced by its OWN commit. */
  armed(dir, "add", "-A");
  expect(armed(dir, "commit", "-q", "-m", "seed").status).toBe(0);
  return dir;
}

const headMap = (dir: string) => armed(dir, "show", `HEAD:${MAP}`).stdout;

describe("the pre-commit atlas arm (#501)", { timeout: 60_000 }, () => {
  beforeAll(() => {
    for (const hook of ["atlas-stage", "pre-commit"]) {
      const at = join(HOOKS_DIR, hook);
      expect(existsSync(at), `${hook} is missing`).toBe(true);
      /* A CRLF shebang is a hook sh cannot run; `.githooks/**` is pinned LF in
         .gitattributes and this pins the bytes on disk. */
      expect(readFileSync(at, "utf8")).not.toContain("\r");
    }
  });

  describe("the negative controls — what must NOT happen", () => {
    it("does NOT fire on a commit that stages only docs and workflows", () => {
      const dir = repoWithMap();
      /* A source file on disk but NOT staged: if the hook fired it would
         regenerate, notice `late.ts`, and rewrite the map. It must not. */
      writeFileSync(join(dir, "server", "late.ts"), "export const late = 1;\n");
      mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
      writeFileSync(join(dir, ".github", "workflows", "note.yml"), "name: note\n");
      writeFileSync(join(dir, "README.md"), "prose\n");
      armed(dir, "add", "README.md", ".github/workflows/note.yml");
      const result = armed(dir, "commit", "-q", "-m", "docs only");
      expect(result.status).toBe(0);
      expect(result.stderr).not.toContain("regenerating");
      expect(headMap(dir)).toBe("seed.ts\n");
      expect(headMap(dir)).not.toContain("late.ts");
    });

    it("does NOT regenerate a second time when the MERGE path already did", () => {
      /* ARM 0 clears its marker as it runs, so ARM 3 cannot see afterwards that
         the work was done — the marker is read BEFORE ARM 0 for exactly this.
         Proven with a generator that FAILS: if ARM 3 ran at all, this dies. */
      const dir = repoWithMap();
      writeFileSync(join(dir, "server", "next.ts"), "export const next = 1;\n");
      broken(dir, "add", "server/next.ts");
      /* The marker is what merge-atlas leaves behind for the merged tree. */
      writeFileSync(join(dir, ".git", "DRAPE_ATLAS_REGENERATE"), "");
      const result = gitWith(
        ["-c", `merge.atlas.regenerate=${GENERATE}`, "-c", "drape.atlasGenerate=false"],
        dir, "commit", "-q", "-m", "post-merge",
      );
      expect(result.status, result.stderr).toBe(0);
      expect(headMap(dir)).toContain("next.ts");
      expect(existsSync(join(dir, ".git", "DRAPE_ATLAS_REGENERATE"))).toBe(false);
    });
  });

  describe("the positive controls — it fires, and the COMMIT carries the map", () => {
    it("regenerates and stages on a staged source path, in the same commit", () => {
      /* Not "the file on disk changed": the measured trap on the merge path was
         a hook-staged file the commit did not carry (atlas-regenerate's own
         docblock). `git show HEAD:` is the only reading that settles it. */
      const dir = repoWithMap();
      writeFileSync(join(dir, "server", "added.ts"), "export const added = 1;\n");
      armed(dir, "add", "server/added.ts");
      const result = armed(dir, "commit", "-q", "-m", "a source change");
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toContain("regenerating");
      expect(headMap(dir)).toBe("added.ts\nseed.ts\n");
      /* And nothing is left dirty behind it — a hook that regenerates without
         staging leaves the next author looking at a mystery diff. */
      expect(armed(dir, "status", "--porcelain").stdout.trim()).toBe("");
    });

    it("fires on docs/architecture/annotations.yaml — the file #501's own body would have skipped", () => {
      /* The card said "skip when only `docs/` is staged". annotations.yaml is
         under docs/ and IS hashed into the architecture fingerprint, so a commit
         editing it alone goes stale — the exact failure this arm prevents, filed
         against the card that proposed it. */
      const dir = repoWithMap();
      writeFileSync(join(dir, "server", "unstaged.ts"), "export const u = 1;\n");
      writeFileSync(join(dir, "docs", "architecture", "annotations.yaml"), "annotations: []\n");
      armed(dir, "add", "docs/architecture/annotations.yaml");
      const result = armed(dir, "commit", "-q", "-m", "annotations");
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toContain("regenerating");
      expect(headMap(dir)).toContain("unstaged.ts");
    });

    it("fires on a DELETED source file, which has no blob to look at", () => {
      const dir = repoWithMap();
      expect(armed(dir, "rm", "-q", "server/seed.ts").status).toBe(0);
      const committed = armed(dir, "commit", "-q", "-m", "remove a module");
      expect(committed.status, committed.stderr).toBe(0);
      expect(headMap(dir).trim()).toBe("");
    });
  });

  describe("it refuses rather than shipping a map it could not build", () => {
    it("REFUSES the commit when the generator fails, and names the command", () => {
      const dir = repoWithMap();
      writeFileSync(join(dir, "server", "added.ts"), "export const added = 1;\n");
      broken(dir, "add", "server/added.ts");
      const result = broken(dir, "commit", "-q", "-m", "a source change");
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("REFUSED");
      expect(result.stderr).toContain("pnpm architecture:generate");
      /* The refusal is the whole point: nothing was committed. */
      expect(armed(dir, "log", "--oneline").stdout.trim().split("\n")).toHaveLength(1);
    });

    it("REFUSES when .gitattributes names no merge=atlas file, rather than staging nothing", () => {
      /* A hook that quietly staged an empty set would regenerate the map, leave
         it unstaged and report success — the map on disk and the map in the
         commit silently disagreeing. */
      const dir = repoWithMap();
      writeFileSync(join(dir, ".gitattributes"), "# nothing is generated here\n");
      writeFileSync(join(dir, "server", "added.ts"), "export const added = 1;\n");
      armed(dir, "add", "-A");
      const result = armed(dir, "commit", "-q", "-m", "drop the attribute");
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("merge=atlas");
    });
  });

  describe("the filter cannot drift away from what the generator scans", () => {
    it("covers every root in SCANNED_ROOTS, derived from the generator itself", () => {
      /* Working law 4: the hook's path filter is a MIRROR of the generator's
         scan roots, and a mirror drifts. A root added to the generator without a
         line in the hook is a map that goes stale on exactly the commits that
         moved it — silent, and indistinguishable from the bug this card fixes.
         So the population is read from the source of truth, here, every run. */
      const generator = readFileSync(resolve("scripts/generate-architecture.mts"), "utf8");
      const declaration = /const SCANNED_ROOTS = \[([^\]]+)\]/.exec(generator);
      expect(declaration, "SCANNED_ROOTS is no longer declared the way this arm reads it").not.toBeNull();
      const roots = [...declaration![1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
      /* The arm must not pass on an empty population — an absence-only expect is
         green when the thing it reads is undefined. */
      expect(roots.length).toBeGreaterThanOrEqual(4);
      expect(roots).toContain("server");

      const hook = readFileSync(resolve(".githooks/atlas-stage"), "utf8");
      const pattern = /grep -E '(\^\([^']+)'/.exec(hook);
      expect(pattern, "atlas-stage no longer filters with the grep this arm reads").not.toBeNull();
      const filter = new RegExp(pattern![1]!);

      for (const root of roots) {
        /* A root only matters through the files inside it, and the filter is on
           paths, so the reading is a representative file. */
        expect(
          filter.test(`${root}/somewhere/module.ts`),
          `SCANNED_ROOTS has "${root}" and .githooks/atlas-stage does not fire on it`,
        ).toBe(true);
      }
      /* And the filter is not simply "everything", which would pass the loop
         above while taxing every docs commit nine seconds. */
      expect(filter.test("docs/specs/PLAN.md")).toBe(false);
      expect(filter.test("README.md")).toBe(false);
      expect(filter.test(".github/workflows/gate.yml")).toBe(false);
      /* The fingerprint reads annotations.yaml, so the filter must too. */
      expect(filter.test("docs/architecture/annotations.yaml")).toBe(true);
    });
  });
});
