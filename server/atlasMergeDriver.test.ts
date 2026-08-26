import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * THE ATLAS MERGE DRIVER, DRIVEN RATHER THAN READ (Retro guard R1,
 * docs/RETRO_LOG.md; card #100).
 *
 * The generated map is regenerated on every branch, so two branches that both
 * touched it conflict the moment one merges, and the only correct resolution
 * is a fresh generation on the MERGED tree. `.githooks/merge-atlas` accepts a
 * placeholder and queues that regeneration; `.githooks/atlas-regenerate`, run
 * from `pre-merge-commit` and `pre-commit`, performs it and stages the result.
 *
 * Like the other hook suites this mocks neither `sh` nor git: real temporary
 * repositories, this tree's `.githooks`, git's exit codes. The generator is
 * stood in for by a shell command (`merge.atlas.regenerate`) that lists the
 * merged tree's `src/` into `map.json` — which is the property that matters,
 * since a regeneration that read the wrong tree would list the wrong files.
 *
 * Both directions of every arm (law 2): the no-driver arm proves the fixture
 * really conflicts, and the broken-generator arm proves a failure cannot
 * "resolve" anything.
 */

const HOOKS_DIR = resolve(".githooks").replace(/\\/g, "/");
const DRIVER = `${HOOKS_DIR}/merge-atlas %O %A %B %P`;
const REGENERATE = "ls src | sort > map.json";

type Result = { status: number; stderr: string; stdout: string };

function gitWith(config: string[], cwd: string, ...args: string[]): Result {
  const base = [
    "-c", "core.autocrlf=false",
    "-c", `core.hooksPath=${HOOKS_DIR}`,
    "-c", "user.name=gate",
    "-c", "user.email=gate@example.invalid",
    "-c", "commit.gpgsign=false",
  ];
  try {
    const stdout = execFileSync("git", [...base, ...config, ...args], { cwd, encoding: "utf8", stdio: "pipe" });
    return { status: 0, stderr: "", stdout };
  } catch (error: any) {
    return {
      status: typeof error?.status === "number" ? error.status : -1,
      stderr: String(error?.stderr ?? ""),
      stdout: String(error?.stdout ?? ""),
    };
  }
}

/** git with the driver registered and the stand-in generator. */
const armed = (cwd: string, ...args: string[]) =>
  gitWith(["-c", `merge.atlas.driver=${DRIVER}`, "-c", `merge.atlas.regenerate=${REGENERATE}`], cwd, ...args);
/** git with the driver registered and a generator that FAILS. */
const broken = (cwd: string, ...args: string[]) =>
  gitWith(["-c", `merge.atlas.driver=${DRIVER}`, "-c", "merge.atlas.regenerate=false"], cwd, ...args);
/** git with no driver at all — the world before this guard. */
const unarmed = (cwd: string, ...args: string[]) => gitWith([], cwd, ...args);

function regenerate(cwd: string) {
  const files = readdirSync(join(cwd, "src")).sort();
  writeFileSync(join(cwd, "map.json"), `${files.join("\n")}\n`);
}

function addSource(cwd: string, name: string, body = name) {
  writeFileSync(join(cwd, "src", name), `${body}\n`);
}

const repos: string[] = [];
afterAll(() => {
  for (const dir of repos) rmSync(dir, { recursive: true, force: true });
});

/** main: src/seed.ts + a map of it; branch `a` adds src/a.ts; branch `b` adds src/b.ts; both regenerate. Leaves `b` checked out. */
function twoBranches(): string {
  const dir = mkdtempSync(join(tmpdir(), "drape-atlas-merge-"));
  repos.push(dir);
  armed(dir, "init", "-q", "-b", "main");
  mkdirSync(join(dir, "src"));
  addSource(dir, "seed.ts");
  writeFileSync(join(dir, ".gitattributes"), "map.json merge=atlas\n");
  regenerate(dir);
  armed(dir, "add", "-A");
  expect(armed(dir, "commit", "-q", "-m", "seed").status).toBe(0);
  for (const name of ["a", "b"]) {
    armed(dir, "checkout", "-q", "-b", name, "main");
    addSource(dir, `${name}.ts`);
    regenerate(dir);
    armed(dir, "add", "-A");
    expect(armed(dir, "commit", "-q", "-m", name).status).toBe(0);
  }
  armed(dir, "checkout", "-q", "b");
  return dir;
}

const marker = (dir: string) => join(dir, ".git", "DRAPE_ATLAS_REGENERATE");
const headMap = (dir: string) => armed(dir, "show", "HEAD:map.json").stdout;
const workingMap = (dir: string) => readFileSync(join(dir, "map.json"), "utf8");
const MERGED_TREE_MAP = "a.ts\nb.ts\nseed.ts\n"; // both sides' sources — neither branch's own map

/* Each arm is two to three seconds of real git on its own; under the full
   suite's load that is three times slower, and vitest's 5 s default timed two
   of them out on 2026-08-26 (the first full run of this file). */
describe("the atlas merge driver", { timeout: 60_000 }, () => {
  beforeAll(() => {
    for (const hook of ["merge-atlas", "atlas-regenerate", "pre-merge-commit", "pre-commit"]) {
      const at = join(HOOKS_DIR, hook);
      expect(existsSync(at), at).toBe(true);
      expect(readFileSync(at, "utf8"), `${hook} must be LF`).not.toContain("\r");
    }
  });

  it("this repository gives every generated atlas file merge=atlas, and the hand-edited annotations none", () => {
    const out = execFileSync(
      "git",
      [
        "check-attr", "merge", "--",
        "docs/architecture/drape-architecture.json",
        "docs/architecture/capability-atlas.json",
        "docs/architecture/capability-atlas.md",
        "docs/architecture/annotations.yaml",
      ],
      { encoding: "utf8" },
    );
    expect(out).toContain("drape-architecture.json: merge: atlas");
    expect(out).toContain("capability-atlas.json: merge: atlas");
    expect(out).toContain("capability-atlas.md: merge: atlas");
    expect(out).toContain("annotations.yaml: merge: unspecified");
  });

  it("the deploy rite refuses to run without the driver registered, and prints the repair beside a freshness refusal", () => {
    const rite = readFileSync("scripts/deploy-rite.mts", "utf8");
    expect(rite).toContain('git("config", "merge.atlas.driver")');
    expect(rite).toContain("git config merge.atlas.driver '.githooks/merge-atlas %O %A %B %P'");
    expect(rite).toContain("repair: pnpm architecture:generate && pnpm capability:generate");
  });

  it("NEGATIVE CONTROL — without the driver the fixture really conflicts, with markers in the map", () => {
    const dir = twoBranches();
    const merge = unarmed(dir, "merge", "--no-edit", "a");
    expect(merge.status).not.toBe(0);
    expect(workingMap(dir)).toContain("<<<<<<<");
  });

  it("an automatic merge regenerates on the MERGED tree, stages it, and hands back the last step", () => {
    const dir = twoBranches();
    const merge = armed(dir, "merge", "--no-edit", "a");
    /* git does not re-read the index after pre-merge-commit (measured), so the
       hook stops the automatic commit rather than let it carry the placeholder. */
    expect(merge.status).not.toBe(0);
    expect(merge.stderr).toContain("git commit --no-edit");
    expect(workingMap(dir)).not.toContain("<<<<<<<");
    expect(existsSync(join(dir, ".git", "MERGE_HEAD")), "the merge state is kept").toBe(true);
    expect(existsSync(marker(dir)), "the marker is consumed by the regeneration").toBe(false);

    const commit = armed(dir, "commit", "-q", "--no-edit");
    expect(commit.status, commit.stderr).toBe(0);
    expect(headMap(dir)).toBe(MERGED_TREE_MAP);
    expect(armed(dir, "status", "--short").stdout.trim()).toBe("");
    expect(armed(dir, "rev-list", "--parents", "-n", "1", "HEAD").stdout.trim().split(" "), "a real merge commit").toHaveLength(3);
  });

  it("a merge that also conflicts elsewhere: resolving it by hand and committing runs the pre-commit arm", () => {
    const dir = twoBranches();
    // Both branches rewrite seed.ts differently, so the merge stops before any hook can commit.
    for (const name of ["a", "b"]) {
      armed(dir, "checkout", "-q", name);
      addSource(dir, "seed.ts", `${name} side`);
      armed(dir, "add", "-A");
      expect(armed(dir, "commit", "-q", "-m", `${name} seed`).status).toBe(0);
    }
    const merge = armed(dir, "merge", "--no-edit", "a");
    expect(merge.status).not.toBe(0);
    expect(merge.stdout + merge.stderr).toContain("CONFLICT (content): Merge conflict in src/seed.ts");
    expect(workingMap(dir), "the map itself carries no markers").not.toContain("<<<<<<<");
    expect(existsSync(marker(dir)), "queued, waiting for the commit").toBe(true);

    addSource(dir, "seed.ts", "resolved");
    armed(dir, "add", "src/seed.ts");
    const commit = armed(dir, "commit", "-q", "-m", "merged by hand");
    expect(commit.status, commit.stderr).toBe(0);
    expect(headMap(dir)).toBe(MERGED_TREE_MAP);
    expect(existsSync(marker(dir))).toBe(false);
  });

  it("REFUSES the commit when the generator fails, keeps the marker, and commits once it is repaired", () => {
    const dir = twoBranches();
    const merge = broken(dir, "merge", "--no-edit", "a");
    expect(merge.status).not.toBe(0);
    expect(merge.stderr).toContain("REFUSED");
    expect(merge.stderr).toContain("could not be regenerated");
    expect(existsSync(marker(dir)), "a failed regeneration keeps the debt on the books").toBe(true);
    expect(armed(dir, "rev-parse", "HEAD").stdout).toBe(armed(dir, "rev-parse", "b").stdout);

    const stillBroken = broken(dir, "commit", "-q", "--no-edit");
    expect(stillBroken.status).not.toBe(0);
    expect(stillBroken.stderr).toContain("REFUSED");

    const repaired = armed(dir, "commit", "-q", "--no-edit");
    expect(repaired.status, repaired.stderr).toBe(0);
    expect(headMap(dir)).toBe(MERGED_TREE_MAP);
    expect(existsSync(marker(dir))).toBe(false);
  });

  it("a merge that changes the map on ONE side only never consults the generator", () => {
    const dir = twoBranches();
    // A third branch off main touching only source: merging it into `b` changes
    // map.json on b's side alone, so git resolves it without the driver.
    armed(dir, "checkout", "-q", "-b", "c", "main");
    addSource(dir, "c.ts");
    armed(dir, "add", "-A");
    expect(armed(dir, "commit", "-q", "-m", "c").status).toBe(0);
    armed(dir, "checkout", "-q", "b");
    const merge = broken(dir, "merge", "--no-edit", "c"); // a generator that would refuse if consulted
    expect(merge.status, merge.stderr).toBe(0);
    expect(existsSync(marker(dir))).toBe(false);
    // b's own map, now stale for c.ts — a fact about the tree the rite's freshness check exists to catch, not this guard's.
    expect(headMap(dir)).toBe("b.ts\nseed.ts\n");
  });
});
