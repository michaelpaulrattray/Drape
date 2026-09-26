import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/* `runHook` drives the GATE — it must distinguish "refused" from "never ran"
   (#640). The bare `execFileSync` below reads repository state, where throwing
   on any failure is the wanted behaviour and there is no verdict to confuse. */
import { runHook } from "./testing/hookDriver";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/* This suite drives a real child process, so it declares the class's timeout
   rather than racing vitest's 5 s default under a parallel run (#548). */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

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
  /* A `git` that never starts throws rather than returning `-1` — see
     `server/testing/hookDriver.ts` and #640. Five arms here assert refusal as
     `not.toBe(0)`, which the old sentinel satisfied. */
  return runHook("git", [...base, ...config, ...args], { cwd });
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

/**
 * ⚠ THE DRIVER ABOVE IS LOCAL, AND GITHUB IS WHERE THE TAX WAS PAID (#1307).
 *
 * `merge-atlas` is why a merge-forward is one command on this machine. GitHub
 * runs none of it — no `merge.atlas.driver`, no hooks, just git's own text merge
 * — so the question *"can two open PRs both carry this file?"* is answered
 * there, and the standing memory `local-merge-probe-cannot-predict-github` is
 * the record of that being learned the hard way.
 *
 * What it cost, measured on the sixteen seat branches of 2026-09-26 with git's
 * own three-way merge over the real blobs: **120 of 120 pairs conflicted on
 * `drape-architecture.json`**, every one of them on `meta.sourceFingerprint`
 * alone — a hash of every scanned file, so no two branches can agree on it. And
 * a CONFLICTING PR fires no workflow run at all (the #566 absent state), so the
 * gate went silent with it. With the line removed from all three sides: **0 of
 * 120**, while 44 pairs still both changed the map and merged clean.
 *
 * So these arms drive GitHub's world with git configured the way GitHub has it,
 * on the REAL committed map, in both directions: the map as it ships merges, and
 * the same two edits with the old fingerprint line put back CONFLICT. The second
 * arm is the positive control — without it the first is satisfied by a fixture
 * whose two sides never really diverged.
 */
describe("what GitHub merges — no driver, no hooks (#1307)", { timeout: 120_000 }, () => {
  const COMMITTED_MAP = resolve("docs/architecture/drape-architecture.json");

  /* git as GitHub has it: the last `-c` for a key wins, so this overrides
     `gitWith`'s own hooks path with a directory that holds no hooks. A fixture
     that ran THIS repository's hooks would be measuring the wrong machine. */
  const github = (cwd: string, ...args: string[]) =>
    gitWith(["-c", `core.hooksPath=${join(cwd, ".no-hooks")}`], cwd, ...args);

  /** The committed map, LF, as git stores it — never this checkout's CRLF smudge. */
  const committedMap = (): string[] =>
    readFileSync(COMMITTED_MAP, "utf8").split("\r\n").join("\n").split("\n");

  /** A new entry of `kind`, inserted where the generator would have put one. */
  function withEntry(lines: string[], kind: "module" | "test", id: string): string[] {
    const at = lines.findIndex((line) => line.includes(`"id": "${kind}:`));
    expect(at, `the committed map names no ${kind} — this fixture describes nothing`).toBeGreaterThan(0);
    const pad = /^\s*/.exec(lines[at]!)![0];
    const copy = [...lines];
    copy.splice(
      at - 1,
      0,
      `${pad.slice(2)}{`,
      `${pad}"id": "${kind}:${id}",`,
      `${pad}"path": "${id}"`,
      `${pad.slice(2)}},`,
    );
    return copy;
  }

  /** The pre-#1307 world: a per-tree hash line inside `meta`, one per side. */
  function withFingerprint(lines: string[], hash: string): string[] {
    const at = lines.findIndex((line) => line.includes('"generatorVersion"'));
    expect(at, "meta no longer carries generatorVersion — this fixture is stale").toBeGreaterThan(0);
    const copy = [...lines];
    copy[at] = `${copy[at]!.replace(/,\s*$/, "")},`;
    copy.splice(at + 1, 0, `    "sourceFingerprint": "${hash}"`);
    return copy;
  }

  /**
   * Two branches off one base, each editing the map where its own PR would, then
   * merged by a git with nothing of ours configured. Returns git's verdict.
   */
  function mergeTwoWays(mutate: (lines: string[], side: "a" | "b") => string[]): Result & { markers: boolean } {
    const dir = mkdtempSync(join(tmpdir(), "drape-atlas-github-"));
    repos.push(dir);
    const map = join(dir, "drape-architecture.json");
    github(dir, "init", "-q", "-b", "main");
    /* The attribute is on the real file, so the fixture carries it too: an
       UNKNOWN driver is precisely GitHub's state, and git falls back to the text
       merge. A fixture without it would be testing a different path. */
    writeFileSync(join(dir, ".gitattributes"), "drape-architecture.json merge=atlas\n");
    writeFileSync(map, `${committedMap().join("\n")}`);
    github(dir, "add", "-A");
    expect(github(dir, "commit", "-q", "-m", "base").status).toBe(0);
    for (const side of ["a", "b"] as const) {
      github(dir, "checkout", "-q", "-b", side, "main");
      writeFileSync(map, `${mutate(committedMap(), side).join("\n")}`);
      github(dir, "add", "-A");
      expect(github(dir, "commit", "-q", "-m", side).status).toBe(0);
    }
    github(dir, "checkout", "-q", "b");
    const merge = github(dir, "merge", "--no-edit", "a");
    return { ...merge, markers: readFileSync(map, "utf8").includes("<<<<<<<") };
  }

  /* Two edits in DIFFERENT regions of the document — a new module near the top,
     a new test near the bottom — which is what two unrelated seat PRs produce. */
  const twoRegions = (lines: string[], side: "a" | "b"): string[] =>
    side === "a"
      ? withEntry(lines, "module", "server/_probe/a.ts")
      : withEntry(lines, "test", "server/_probe/b.test.ts");

  it("the map as it ships: two PRs touching different parts of the architecture MERGE", () => {
    /* Population control first: the two edits must land far apart, or this arm
       passes because git's 3-line context happened not to overlap. */
    const base = committedMap();
    const moduleAt = base.findIndex((line) => line.includes('"id": "module:'));
    const testAt = base.findIndex((line) => line.includes('"id": "test:'));
    expect(Math.abs(testAt - moduleAt), "the two edits must be in different regions").toBeGreaterThan(100);

    const merge = mergeTwoWays(twoRegions);
    expect(merge.stdout + merge.stderr).not.toContain("CONFLICT");
    expect(merge.markers, "the merged map carries no conflict markers").toBe(false);
    expect(merge.status, merge.stderr).toBe(0);
  });

  it("CONTROL — put the source fingerprint back and the SAME two edits conflict", () => {
    const merge = mergeTwoWays((lines, side) =>
      withFingerprint(twoRegions(lines, side), side === "a" ? "a".repeat(16) : "b".repeat(16)),
    );
    expect(merge.status, "a per-tree hash in the committed map is a guaranteed conflict").not.toBe(0);
    expect(merge.stdout + merge.stderr).toContain("CONFLICT (content)");
    expect(merge.markers, "and the markers land in the map itself").toBe(true);
  });

  it("the fingerprint is written beside the maps and git cannot carry it", () => {
    /* The sidecar is the whole reason the field could leave: the reading stays
       available locally. If it were ever tracked, every branch would move it and
       the tax would come straight back through a new file name. */
    const generator = readFileSync("scripts/generate-architecture.mts", "utf8");
    expect(generator).toContain('export const SOURCE_FINGERPRINT_FILE = "source-fingerprint.txt";');
    expect(generator).toContain("fs.writeFileSync(path.join(outDir, SOURCE_FINGERPRINT_FILE)");

    const ignored = runHook("git", ["check-ignore", "docs/architecture/source-fingerprint.txt"], { cwd: resolve(".") });
    expect(ignored.status, "the sidecar must be gitignored — a tracked one is the conflict again").toBe(0);
    const tracked = runHook("git", ["ls-files", "--error-unmatch", "docs/architecture/source-fingerprint.txt"], { cwd: resolve(".") });
    expect(tracked.status, "and it must not already be tracked").not.toBe(0);
  });
});
