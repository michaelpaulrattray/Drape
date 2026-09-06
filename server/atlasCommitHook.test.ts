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
      /* ⚠ THE FIRST VERSION OF THIS ARM PROVED THE FIRING BY LEAVING AN
         UNSTAGED source on disk and asserting the committed map CONTAINED it —
         which is the partial-stage defect below, asserted as though it were the
         desired behaviour (review of PR #517, finding 1). The firing is proven
         by the hook saying so and by the map moving, with the tree clean. */
      const dir = repoWithMap();
      writeFileSync(join(dir, "server", "second.ts"), "export const s = 1;\n");
      writeFileSync(join(dir, "docs", "architecture", "annotations.yaml"), "annotations: []\n");
      armed(dir, "add", "docs/architecture/annotations.yaml", "server/second.ts");
      const result = armed(dir, "commit", "-q", "-m", "annotations");
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toContain("regenerating");
      expect(headMap(dir)).toBe("second.ts\nseed.ts\n");
      expect(armed(dir, "status", "--porcelain").stdout.trim()).toBe("");
    });

    it("fires on annotations.yaml ALONE, with no source file staged beside it", () => {
      /* The narrowest form of the correction to the card's body: a commit whose
         entire content is that one file under docs/. */
      const dir = repoWithMap();
      writeFileSync(join(dir, "docs", "architecture", "annotations.yaml"), "annotations: []\n");
      armed(dir, "add", "docs/architecture/annotations.yaml");
      const result = armed(dir, "commit", "-q", "-m", "annotations alone");
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toContain("regenerating");
    });

    it("fires on a DELETED source file, which has no blob to look at", () => {
      const dir = repoWithMap();
      expect(armed(dir, "rm", "-q", "server/seed.ts").status).toBe(0);
      const committed = armed(dir, "commit", "-q", "-m", "remove a module");
      expect(committed.status, committed.stderr).toBe(0);
      expect(headMap(dir).trim()).toBe("");
    });
  });

  describe("the other two commit roads, which build the commit through a TEMPORARY index", () => {
    /* `git commit -a` and `git commit -- <path>` do not commit the real index:
       git's prepare_index() builds a temporary one, and a pre-commit hook that
       runs `git add` on those roads is the classic place where the staged file
       misses the commit — the hook would print "this commit carries the map of
       its own tree" over a commit that does not carry it, which is precisely the
       false claim the positive arms exist to rule out. Raised as PLAUSIBLE and
       explicitly undriven by the second review of PR #517; driven here, because
       an unverified claim about a road nobody exercises is what law 7b is for. */

    it("`git commit -a` carries the regenerated map", () => {
      const dir = repoWithMap();
      writeFileSync(join(dir, "server", "added.ts"), "export const added = 1;\n");
      armed(dir, "add", "server/added.ts");
      /* A tracked file modified but not staged, so -a has real work to sweep. */
      writeFileSync(join(dir, MAP), "deliberately wrong\n");
      const result = armed(dir, "commit", "-q", "-a", "-m", "commit -a");
      expect(result.status, result.stderr).toBe(0);
      expect(headMap(dir)).toBe("added.ts\nseed.ts\n");
      expect(armed(dir, "status", "--porcelain").stdout.trim()).toBe("");
    });

    it("`git commit -- <path>` carries the regenerated map and leaves the index sane", () => {
      /* The pathspec form is the historically notorious one: git commits the
         named paths through a temporary index and then has to reconcile the real
         one afterwards. */
      const dir = repoWithMap();
      writeFileSync(join(dir, "server", "added.ts"), "export const added = 1;\n");
      writeFileSync(join(dir, "server", "other.ts"), "export const other = 1;\n");
      /* `git commit -- <path>` only accepts paths git already knows, so both are
         staged and only one is named — which is the partial-commit road proper:
         the named path goes in, `other.ts` stays behind in the real index. */
      armed(dir, "add", "server/added.ts", "server/other.ts");
      const result = armed(dir, "commit", "-q", "-m", "pathspec", "--", "server/added.ts");
      expect(result.status, result.stderr).toBe(0);
      /* The map is generated from the WORKING TREE, so it lists both — the
         question this arm settles is whether the hook's `git add` survived the
         temporary index at all, and an absent map row would say it did not. */
      expect(headMap(dir)).toBe("added.ts\nother.ts\nseed.ts\n");
      /* And the real index is intact afterwards: `other.ts` is still staged. */
      expect(armed(dir, "status", "--porcelain").stdout).toContain("server/other.ts");
    });
  });

  describe("⚠ the partial stage — the map is built from the WORKING TREE", () => {
    /* The generators hash bytes on disk, not the index, so a commit that stages
       some sources and leaves others dirty carries a map of a tree that is not
       the one committed — and the gate, which rebuilds from the COMMITTED tree,
       still reddens. Not a regression (a manual generate read the same disk) and
       not refused (committing part of a working tree is legitimate). It WARNS,
       because the failure mode is a hook telling you it carried the map of your
       own tree when it carried someone else's. Review of PR #517, finding 1. */

    it("WARNS and names the unstaged sources rather than claiming the map matches", () => {
      const dir = repoWithMap();
      writeFileSync(join(dir, "server", "staged.ts"), "export const a = 1;\n");
      writeFileSync(join(dir, "server", "wip.ts"), "export const b = 1;\n");
      armed(dir, "add", "server/staged.ts");
      const result = armed(dir, "commit", "-q", "-m", "partial stage");
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toContain("WORKING TREE");
      expect(result.stderr).toContain("server/wip.ts");
      /* And it does NOT tell the author the opposite. */
      expect(result.stderr).not.toContain("the map of its own tree");
    });

    it("catches a MODIFIED-but-unstaged source, not only an untracked one", () => {
      /* Two different git listings answer this — `git diff --name-only` and
         `git ls-files --others`. An arm covering one would pass a hook that
         only read the other, which is how a warning ends up half-armed. */
      const dir = repoWithMap();
      writeFileSync(join(dir, "server", "seed.ts"), "export const seed = 2;\n");
      writeFileSync(join(dir, "server", "staged.ts"), "export const a = 1;\n");
      armed(dir, "add", "server/staged.ts");
      const result = armed(dir, "commit", "-q", "-m", "partial stage, modified file");
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toContain("server/seed.ts");
    });

    it("stays SILENT when everything is staged — the warning must not cry wolf", () => {
      /* The positive control's mirror: a warning that fired on every commit
         would pass both arms above and teach everyone to ignore it. */
      const dir = repoWithMap();
      writeFileSync(join(dir, "server", "staged.ts"), "export const a = 1;\n");
      armed(dir, "add", "server/staged.ts");
      const result = armed(dir, "commit", "-q", "-m", "everything staged");
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toContain("the map of its own tree");
      expect(result.stderr).not.toContain("WORKING TREE");
    });

    it("ignores dirt the maps are not built from — a stray README is not a warning", () => {
      const dir = repoWithMap();
      writeFileSync(join(dir, "server", "staged.ts"), "export const a = 1;\n");
      writeFileSync(join(dir, "NOTES.md"), "scratch\n");
      armed(dir, "add", "server/staged.ts");
      const result = armed(dir, "commit", "-q", "-m", "dirty docs");
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).not.toContain("WORKING TREE");
    });

    it("stays silent on an untracked scripts/ disposable — measured, not imagined", () => {
      /* ⚠ THE FIRST VERSION OF THIS WARNING FIRED ON `MATCHES`, THE WIDE
         REGENERATION FILTER, AND ITS FIRST REAL COMMIT PROVED WHY THAT IS
         WRONG: it warned about an untracked `scripts/_501-sabotage-disposable.mts`
         while `pnpm architecture:check` said the map was fresh — `scripts/` is
         not one of the generator's scanned roots. Every shift carries untracked
         disposables there, so it would have fired on nearly every commit the
         team makes. A warning that always fires is one nobody reads. */
      const dir = repoWithMap();
      mkdirSync(join(dir, "scripts"), { recursive: true });
      writeFileSync(join(dir, "scripts", "_throwaway-disposable.mts"), "process.exit(0);\n");
      writeFileSync(join(dir, "server", "staged.ts"), "export const a = 1;\n");
      armed(dir, "add", "server/staged.ts");
      const result = armed(dir, "commit", "-q", "-m", "with a disposable lying about");
      expect(result.status, result.stderr).toBe(0);
      /* It still REGENERATED — the wide trigger is unchanged and correct. */
      expect(result.stderr).toContain("regenerating");
      expect(result.stderr).not.toContain("WORKING TREE");
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

      /* The filters moved out of this hook and into `.githooks/atlas-paths`
         when `pre-push` became their second consumer (#606, #519) — one owner,
         per working law 4. This arm follows them rather than being relaxed;
         `server/atlasPushGate.test.ts` holds both hooks to sourcing it. */
      const hook = readFileSync(resolve(".githooks/atlas-paths"), "utf8");
      const declared = (name: string): RegExp => {
        const found = new RegExp(`\\n${name}='([^']+)'`).exec(hook);
        expect(found, `atlas-paths no longer declares ${name}='…'`).not.toBeNull();
        return new RegExp(found![1]!);
      };
      /* WARN_MATCHES is the one held to the generator: it is the population
         `fingerprint()` actually hashes, so it is what decides whether the
         author is told their map may not match the commit. */
      const filter = declared("WARN_MATCHES");
      const trigger = declared("MATCHES");

      /* ⚠ AND THE ROOTS ARE NOT THE WHOLE INPUT. `fingerprint()` hashes every
         scanned file PLUS whatever else it reads by name — today that is
         annotations.yaml, which is why the filter carries it. The first version
         of this arm derived the roots and then hard-coded that one extra on
         both sides, so a future out-of-roots input would have repeated this
         card's defect silently (review of PR #517). So the extras are derived
         too: every `path.join(repoRoot, …)` inside the fingerprint function
         must be a path the filter fires on. */
      const body = /function fingerprint\(\): string \{([\s\S]*?)\n\}/.exec(generator);
      expect(body, "fingerprint() is no longer declared the way this arm reads it").not.toBeNull();
      const extras = [...body![1]!.matchAll(/path\.join\(repoRoot,\s*([^)]+)\)/g)].map((m) =>
        [...m[1]!.matchAll(/"([^"]+)"/g)].map((s) => s[1]!).join("/"),
      );
      expect(extras.length).toBeGreaterThanOrEqual(1);
      for (const extra of extras) {
        expect(
          filter.test(extra),
          `fingerprint() hashes "${extra}" and WARN_MATCHES does not fire on it`,
        ).toBe(true);
        expect(
          trigger.test(extra),
          `fingerprint() hashes "${extra}" and MATCHES does not regenerate on it`,
        ).toBe(true);
      }

      /* The extensions are declared beside the roots and narrow them: warning on
         ANY file under a scanned root fires on unstaged `drizzle/*.sql` that
         `fingerprint()` never hashes (second review of PR #517). */
      const extDecl = /const SOURCE_EXTENSIONS = \[([^\]]+)\]/.exec(generator);
      expect(extDecl, "SOURCE_EXTENSIONS is no longer declared the way this arm reads it").not.toBeNull();
      const extensions = [...extDecl![1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
      expect(extensions.length).toBeGreaterThanOrEqual(2);
      expect(filter.test("drizzle/0001_init.sql"), "an extension the generator never hashes must not warn").toBe(false);

      /* ⚠ THE CAPABILITY MAP IS STAGED BY THIS HOOK TOO, AND ITS INPUTS ARE NOT
         UNDER THE ARCHITECTURE ROOTS. A dirty corpus with a clean "map of its
         own tree" message is a `capability:check` red with false assurance
         attached — the exact pairing this card exists to end. Derived from the
         capability generator's own relative imports, ONE HOP: an input reached
         only through `lib/capabilityAtlas.mts` is not seen here, which is a
         stated limit rather than a silent one. */
      const capability = readFileSync(resolve("scripts/generate-capability-atlas.mts"), "utf8");
      const capabilityInputs = [...capability.matchAll(/from "\.\/([^"]+)"/g)].map(
        (m) => `scripts/${m[1]!}`,
      );
      expect(capabilityInputs.length).toBeGreaterThanOrEqual(2);
      for (const input of capabilityInputs) {
        expect(
          filter.test(input),
          `generate-capability-atlas.mts reads "${input}" and WARN_MATCHES does not fire on it`,
        ).toBe(true);
        expect(trigger.test(input), `MATCHES does not regenerate on "${input}"`).toBe(true);
      }

      for (const root of roots) {
        for (const ext of extensions) {
          expect(
            filter.test(`${root}/somewhere/module${ext}`),
            `the generator hashes "${ext}" under "${root}" and WARN_MATCHES does not fire on it`,
          ).toBe(true);
        }
        /* A root only matters through the files inside it, and the filter is on
           paths, so the reading is a representative file. */
        const sample = `${root}/somewhere/module.ts`;
        expect(
          filter.test(sample),
          `SCANNED_ROOTS has "${root}" and WARN_MATCHES does not fire on it`,
        ).toBe(true);
        /* ⚠ AND REGENERATION MUST COVER EVERYTHING THE WARNING COVERS. The two
           widths are allowed to differ in one direction only: a path that can
           move the map but does not regenerate it is the original defect back
           again, wearing a narrower filter. */
        expect(
          trigger.test(sample),
          `WARN_MATCHES fires on "${sample}" but MATCHES does not — the map would go stale unregenerated`,
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
