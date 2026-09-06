import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * ARM 2 OF THE PRE-PUSH GATE, DRIVEN RATHER THAN READ (cards #606, #519).
 *
 * `pre-commit` ARM 3 (#501) keeps a branch's generated maps fresh — but git does
 * not run `pre-commit` on every road to a commit. Measured on git 2.55, one
 * scratch repository per road: `git revert`, `git cherry-pick` and a replayed
 * `git rebase` commit all skip it. Under deploy-on-merge (#508) every rollback
 * proof is a revert, so this is a road shifts walk on purpose — and #606 is it
 * happening, on PR #605, for a red gate at 3½ minutes and a second seven-minute
 * run.
 *
 * `main` already had a backstop: the rite runs both checks before it pushes.
 * A BRANCH push never meets the rite, so it had none. This arm closes that
 * asymmetry with the rite's own two commands.
 *
 * Like the commit-hook and merge-driver suites this mocks nothing: real
 * temporary repositories, a real bare remote, a real `git push`, this tree's
 * `.githooks`, git's own exit codes. The generator and the freshness check are
 * stood in for by shell commands (`drape.atlasGenerate`, `drape.atlasCheck`)
 * that compare a listing of `server/` against the tracked map — the property
 * that matters, since a check reading the wrong tree would give the wrong
 * verdict.
 *
 * ⚠ THE ARM THAT KEEPS THE REST HONEST IS `pushes` — every positive arm asserts
 * the push actually MOVED the remote. The first driver written for this had
 * three arms reading `Everything up-to-date`: nothing was pushed, so the hook's
 * verdict was never consulted and all three passed by construction.
 */

const HOOKS_DIR = resolve(".githooks").replace(/\\/g, "/");
const MAP = "docs/architecture/map.json";
/** Writes the map from the tree it is run in. */
const GENERATE = `ls server | sort > ${MAP}`;
/** Red exactly when the tracked map does not describe the tree on disk. */
const CHECK = `ls server | sort > .expected && cmp -s .expected ${MAP} `
  + `&& echo "[atlas:check] OK" || { echo "[atlas:check] FAILED - map is stale"; exit 1; }`;

type Result = { status: number; stderr: string; stdout: string };

function gitWith(config: string[], cwd: string, ...args: string[]): Result {
  const base = [
    "-c", "core.autocrlf=false",
    "-c", `core.hooksPath=${HOOKS_DIR}`,
    "-c", "user.name=gate",
    "-c", "user.email=gate@example.invalid",
    "-c", "commit.gpgsign=false",
    "-c", `drape.atlasGenerate=${GENERATE}`,
    "-c", `drape.atlasCheck=${CHECK}`,
    /* The real clones register this; the revert road below only reproduces
       what shifts actually meet when it is present. */
    "-c", `merge.atlas.driver=${HOOKS_DIR}/merge-atlas %O %A %B %P`,
  ];
  const run = spawnSync("git", [...base, ...config, ...args], { cwd, encoding: "utf8" });
  return {
    status: typeof run.status === "number" ? run.status : -1,
    stderr: String(run.stderr ?? ""),
    stdout: String(run.stdout ?? ""),
  };
}

const git = (cwd: string, ...args: string[]) => gitWith([], cwd, ...args);

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

type Repo = { work: string; remote: string };

/** A repository shaped like this one, with a bare remote to push at. */
function repoWithRemote(): Repo {
  const root = mkdtempSync(join(tmpdir(), "drape-atlas-push-"));
  dirs.push(root);
  const remote = join(root, "remote.git");
  const work = join(root, "work");
  mkdirSync(remote);
  mkdirSync(work);
  git(remote, "init", "-q", "--bare", "-b", "trunk");
  git(work, "init", "-q", "-b", "trunk");
  mkdirSync(join(work, "server"));
  mkdirSync(join(work, "docs", "architecture"), { recursive: true });
  writeFileSync(join(work, ".gitattributes"), `* -text\n${MAP} merge=atlas\n`);
  writeFileSync(join(work, "server", "a.ts"), "export const a = 1;\n");
  writeFileSync(join(work, MAP), "a.ts\n");
  git(work, "add", "-A");
  expect(git(work, "commit", "-q", "-m", "seed").status).toBe(0);
  writeFileSync(join(work, ".git", "info", "exclude"), ".expected\n");
  git(work, "remote", "add", "origin", remote.replace(/\\/g, "/"));
  return { work, remote };
}

/** Add a source file in a commit the pre-commit hook regenerates the map for. */
function commitSource(work: string, name: string): string {
  writeFileSync(join(work, "server", name), `export const x = "${name}";\n`);
  git(work, "add", `server/${name}`);
  expect(git(work, "commit", "-q", "-m", `add ${name}`).status).toBe(0);
  return git(work, "rev-parse", "HEAD").stdout.trim();
}

const push = (work: string, ...extra: string[]) => git(work, "push", ...extra, "origin", "trunk");

/** What the remote actually holds — the only proof a push landed. */
const remoteHead = (remote: string) => git(remote, "rev-parse", "trunk").stdout.trim();

describe("the pre-push atlas arm (#606, #519)", { timeout: 120_000 }, () => {
  beforeAll(() => {
    for (const hook of ["pre-push", "atlas-paths", "merge-atlas"]) {
      const at = join(HOOKS_DIR, hook);
      expect(existsSync(at), `${hook} is missing`).toBe(true);
      /* A CRLF shebang is a hook sh cannot run. */
      expect(readFileSync(at, "utf8")).not.toContain("\r");
    }
  });

  it("lets a clean tree with a fresh map through, and the remote moves", () => {
    const { work, remote } = repoWithRemote();
    const result = push(work);
    expect(result.status, result.stderr).toBe(0);
    expect(remoteHead(remote)).toBe(git(work, "rev-parse", "HEAD").stdout.trim());
  });

  it("REFUSES a stale map on a clean tree, and the remote does NOT move", () => {
    const { work, remote } = repoWithRemote();
    expect(push(work).status).toBe(0);
    const before = remoteHead(remote);

    /* --no-verify is the only way to get a stale map into a commit here, which
       is itself the point: every ordinary road already regenerates. */
    writeFileSync(join(work, "server", "b.ts"), "export const b = 1;\n");
    git(work, "add", "server/b.ts");
    expect(git(work, "commit", "-q", "--no-verify", "-m", "stale").status).toBe(0);

    const result = push(work);
    expect(result.status, "a stale map must not push").not.toBe(0);
    expect(result.stderr).toContain("REFUSED");
    expect(result.stderr).toContain("pnpm architecture:generate");
    expect(remoteHead(remote)).toBe(before);
  });

  it("⚠ THE #606 ROAD: a revert skips pre-commit, and the push is caught", () => {
    const { work, remote } = repoWithRemote();
    const b = commitSource(work, "b.ts");
    commitSource(work, "c.ts");
    expect(push(work).status).toBe(0);
    const before = remoteHead(remote);

    /* The map moved in `add c.ts`, so reverting `add b.ts` restores a map that
       describes NEITHER tree — the exact shape PR #605 hit. With merge.atlas
       registered the driver keeps a placeholder instead of conflicting, so the
       revert COMPLETES and the stale map is committed with it. */
    const revert = git(work, "revert", "--no-edit", b);
    expect(revert.status, revert.stderr).toBe(0);
    expect(readFileSync(join(work, MAP), "utf8")).not.toContain("<<<<");

    /* The fixture must really be stale, or the arm proves nothing. */
    const tree = git(work, "ls-tree", "--name-only", "HEAD", "server/").stdout;
    expect(tree).toContain("c.ts");
    expect(tree).not.toContain("b.ts");
    expect(readFileSync(join(work, MAP), "utf8")).not.toBe("a.ts\nc.ts\n");

    const result = push(work);
    expect(result.status, "the revert's stale map must not push").not.toBe(0);
    expect(result.stderr).toContain("REFUSED");
    expect(result.stderr).toContain("revert");
    expect(remoteHead(remote)).toBe(before);
  });

  it("⚠ THE #519 ROAD: a replayed rebase commit is caught the same way", () => {
    const { work, remote } = repoWithRemote();
    commitSource(work, "b.ts");
    expect(push(work).status).toBe(0);
    const before = remoteHead(remote);

    /* A branch off the seed that moves the map, replayed onto a main that also
       moved it: the replayed commit is made without pre-commit. */
    git(work, "checkout", "-q", "-b", "side", "HEAD~1");
    commitSource(work, "z.ts");
    const rebase = git(work, "rebase", "trunk");
    expect(rebase.status, rebase.stderr).toBe(0);

    const map = readFileSync(join(work, MAP), "utf8");
    expect(map).not.toContain("<<<<");
    /* Stale for real: the tree has b and z, the map cannot have both. */
    expect(git(work, "ls-tree", "--name-only", "HEAD", "server/").stdout).toContain("b.ts");
    expect(map).not.toBe("a.ts\nb.ts\nz.ts\n");

    const result = git(work, "push", "origin", "side:trunk");
    expect(result.status, "the rebase's stale map must not push").not.toBe(0);
    expect(result.stderr).toContain("REFUSED");
    expect(remoteHead(remote)).toBe(before);
  });

  it("WARNS and allows when the staleness is uncommitted work, not the commit", () => {
    const { work, remote } = repoWithRemote();
    expect(push(work).status).toBe(0);

    commitSource(work, "b.ts");
    /* Unstaged, uncommitted — the commit's map is right, the disk's is not. */
    writeFileSync(join(work, "server", "wip.ts"), "export const wip = 1;\n");

    const result = push(work);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toContain("uncommitted");
    expect(result.stderr).toContain("server/wip.ts");
    expect(result.stderr).not.toContain("REFUSED");
    expect(remoteHead(remote)).toBe(git(work, "rev-parse", "HEAD").stdout.trim());
  });

  it("does NOT pay twice on the rite's own push — the rite runs both checks itself", () => {
    const { work, remote } = repoWithRemote();
    expect(push(work).status).toBe(0);
    writeFileSync(join(work, "server", "b.ts"), "export const b = 1;\n");
    git(work, "add", "server/b.ts");
    expect(git(work, "commit", "-q", "--no-verify", "-m", "stale").status).toBe(0);

    /* Same commit the arm above refuses — allowed here only by the marker. */
    const run = spawnSync("git", [
      "-c", "core.autocrlf=false",
      "-c", `core.hooksPath=${HOOKS_DIR}`,
      "-c", "user.name=gate",
      "-c", "user.email=gate@example.invalid",
      "-c", `drape.atlasCheck=${CHECK}`,
      "push", "origin", "trunk",
    ], { cwd: work, encoding: "utf8", env: { ...process.env, DRAPE_DEPLOY_RITE: "1" } });

    expect(run.status, String(run.stderr)).toBe(0);
    expect(String(run.stderr)).not.toContain("REFUSED");
    expect(remoteHead(remote)).toBe(git(work, "rev-parse", "HEAD").stdout.trim());
  });

  it("does not fire on a branch DELETION — there is no tree to judge", () => {
    const { work, remote } = repoWithRemote();
    expect(push(work).status).toBe(0);
    expect(git(work, "push", "origin", "trunk:doomed").status).toBe(0);

    /* Make the map stale, so a firing arm would refuse the delete. */
    writeFileSync(join(work, "server", "b.ts"), "export const b = 1;\n");
    git(work, "add", "server/b.ts");
    git(work, "commit", "-q", "--no-verify", "-m", "stale");

    const result = git(work, "push", "origin", ":doomed");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).not.toContain("REFUSED");
    expect(git(remote, "rev-parse", "--verify", "-q", "doomed").status).not.toBe(0);
  });

  it("REFUSES when it cannot read the shared path filters — a control with a missing dependency refuses", () => {
    const { work } = repoWithRemote();
    writeFileSync(join(work, "server", "b.ts"), "export const b = 1;\n");
    git(work, "add", "server/b.ts");
    git(work, "commit", "-q", "--no-verify", "-m", "stale");

    /* A hooks directory holding pre-push and nothing else. */
    const lone = mkdtempSync(join(tmpdir(), "drape-atlas-lone-"));
    dirs.push(lone);
    writeFileSync(join(lone, "pre-push"), readFileSync(join(HOOKS_DIR, "pre-push"), "utf8"));
    const result = spawnSync("git", [
      "-c", `core.hooksPath=${lone.replace(/\\/g, "/")}`,
      "-c", `drape.atlasCheck=${CHECK}`,
      "push", "origin", "trunk",
    ], { cwd: work, encoding: "utf8" });

    expect(result.status).not.toBe(0);
    expect(String(result.stderr)).toContain("atlas-paths");
  });
});

describe("the shared path filters have exactly one owner (#606, working law 4)", () => {
  it("atlas-stage and pre-push both source .githooks/atlas-paths, and neither declares its own", () => {
    for (const hook of ["atlas-stage", "pre-push"]) {
      const text = readFileSync(join(HOOKS_DIR, hook), "utf8");
      expect(text, `${hook} does not source atlas-paths`).toContain("atlas-paths");
      /* A copy of either filter here is the drift this file exists to stop. */
      expect(text, `${hook} declares its own MATCHES`).not.toMatch(/^MATCHES=/m);
      expect(text, `${hook} declares its own WARN_MATCHES`).not.toMatch(/^WARN_MATCHES=/m);
    }
    const paths = readFileSync(join(HOOKS_DIR, "atlas-paths"), "utf8");
    expect(paths).toMatch(/^MATCHES=/m);
    expect(paths).toMatch(/^WARN_MATCHES=/m);
  });
});
