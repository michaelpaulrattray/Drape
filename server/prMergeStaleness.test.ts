/**
 * THE STALENESS READING, DRIVEN AGAINST REAL REPOSITORIES (#2590).
 *
 * # What this proves and why a fixture could not
 *
 * `readMainGained` decides whether `pr-merge-in-order` refuses a merge, and it
 * decides it by asking git four questions. A suite that handed it a fake
 * `GitRun` would be asserting that this file knows what `merge-base
 * --is-ancestor` prints — which is the belief under test, not a control over
 * it. So every arm here builds a real repository with a real bare remote, makes
 * real commits, and lets the reader shell out: the same road
 * `server/atlasPushGate.test.ts` takes for the push gate, and for the same
 * reason.
 *
 * # The defect it exists for
 *
 * `main` does not require branches to be up to date, so GitHub reports
 * `MERGEABLE/CLEAN` for a head it has moved past — a true statement about TEXT,
 * and not the question the gate's green is trusted to answer. Driven on the
 * pair that produced #2589: #2581's gated head was cut at 09:32Z, #2585 merged
 * at 11:13Z, #2581 merged at 12:44Z on a `CLEAN` reading, and `main` was red a
 * minute later.
 *
 * # Both directions, because only one of them can be seen in the output
 *
 * A reader that reported staleness for everything would pass every positive arm
 * here, so the current-head arms are not decoration: they are the control. And
 * the `null` arms are the ones that keep this safe to ship — a reading that
 * cannot be taken must leave the merge tool behaving exactly as it did before
 * this card, never refusing on the strength of not seeing anything.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it, vi } from "vitest";

import { type GitRun, readMainGained } from "../scripts/lib/prMergeOrder.mts";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/*
  ⚠ EVERY ARM HERE SPAWNS REAL `git` PROCESSES — dozens of them — so the
  class's own timeout is declared rather than vitest's 5s default, which would
  go red under load on somebody's machine and never in CI (#548).
  `server/childProcessTestTimeouts.test.ts` derives this suite into its
  population from the `execFileSync` in it and said so on the first preflight,
  which is the guard doing exactly its job.
*/
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

/** One git invocation in `cwd`, in the shape `readMainGained` is given. */
function runnerAt(cwd: string): GitRun {
  return (args) => {
    try {
      return { code: 0, out: execFileSync("git", [...args], { cwd, encoding: "utf8" }) };
    } catch (error) {
      const e = error as { status?: number; stdout?: string; stderr?: string };
      return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
    }
  };
}

const must = (cwd: string, ...args: string[]): string => {
  const result = runnerAt(cwd)(args);
  expect(result.code, `git ${args.join(" ")} in ${cwd} said: ${result.out}`).toBe(0);
  return result.out.trim();
};

type World = {
  /** The clone the reader runs in — stands for the tool's own repository. */
  work: string;
  /** The bare remote it fetches `main` from. */
  remote: string;
};

/**
 * A repository with a real bare remote and a `main` the reader can fetch.
 *
 * The seed commit carries two directories, because the locality half of this
 * card is about directories and a one-folder repository could not show a
 * reading that got them wrong.
 */
function world(): World {
  const root = mkdtempSync(join(tmpdir(), "drape-2590-stale-"));
  dirs.push(root);
  const remote = join(root, "remote.git");
  const work = join(root, "work");
  mkdirSync(remote);
  must(root, "init", "-q", "--bare", "-b", "main", remote);
  must(root, "clone", "-q", remote.replace(/\\/g, "/"), work);
  must(work, "config", "user.email", "seat@example.invalid");
  must(work, "config", "user.name", "seat");
  /* This machine runs `core.autocrlf=true`, which has nothing to do with what
     is under test and fills the run with smudge warnings. */
  must(work, "config", "core.autocrlf", "false");
  mkdirSync(join(work, "server", "castingV2"), { recursive: true });
  mkdirSync(join(work, "docs", "architecture"), { recursive: true });
  writeFileSync(join(work, "server", "castingV2", "seed.ts"), "export const seed = 1;\n");
  must(work, "add", "-A");
  must(work, "commit", "-q", "-m", "seed");
  must(work, "push", "-q", "origin", "main");
  return { work, remote };
}

/** Commit `files` on `main` and push, as a merge to main does. */
function landOnMain(work: string, message: string, files: Record<string, string>): string {
  must(work, "checkout", "-q", "main");
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(work, ...path.split("/").slice(0, -1)), { recursive: true });
    writeFileSync(join(work, path), body);
  }
  must(work, "add", "-A");
  must(work, "commit", "-q", "-m", message);
  must(work, "push", "-q", "origin", "main");
  return must(work, "rev-parse", "HEAD");
}

/** Cut a branch from wherever main is now, commit `files`, push it. */
function branchWith(work: string, name: string, files: Record<string, string>): string {
  must(work, "checkout", "-q", "-b", name, "main");
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(work, ...path.split("/").slice(0, -1)), { recursive: true });
    writeFileSync(join(work, path), body);
  }
  must(work, "add", "-A");
  must(work, "commit", "-q", "-m", `work on ${name}`);
  must(work, "push", "-q", "origin", name);
  return must(work, "rev-parse", "HEAD");
}

describe("readMainGained — against a real repository", () => {
  it("says nothing was gained when the head already contains main", () => {
    const { work } = world();
    const head = branchWith(work, "team/current", { "server/castingV2/a.ts": "export const a = 1;\n" });
    /* THE CONTROL. A reader that reported staleness unconditionally would pass
       every arm below this one, and this is the only arm that says so. */
    expect(readMainGained(runnerAt(work), head, "team/current")).toEqual({ commits: [], files: [] });
  });

  it("names the commits and files main gained after the branch was cut", () => {
    const { work } = world();
    const head = branchWith(work, "team/stale", {
      "server/castingV2/inkPlacement.ts": "export const placement = 1;\n",
    });
    const landed = landOnMain(work, "a later merge", {
      "server/castingV2/inkPlacementResolve.ts": "export const resolve = 1;\n",
    });

    const gained = readMainGained(runnerAt(work), head, "team/stale");
    expect(gained).not.toBeNull();
    expect(gained!.commits).toHaveLength(1);
    /* Abbreviated, so the assertion is on a prefix of the real sha rather than
       on this suite's idea of how git abbreviates. */
    expect(landed.startsWith(gained!.commits[0]!)).toBe(true);
    expect(gained!.files).toEqual(["server/castingV2/inkPlacementResolve.ts"]);
  });

  it("counts every commit main gained, not just the newest", () => {
    const { work } = world();
    const head = branchWith(work, "team/old", { "client/src/a.tsx": "export const a = 1;\n" });
    landOnMain(work, "first", { "server/castingV2/b.ts": "export const b = 1;\n" });
    landOnMain(work, "second", { "docs/architecture/capability-atlas.md": "# map\n" });

    const gained = readMainGained(runnerAt(work), head, "team/old");
    expect(gained!.commits).toHaveLength(2);
    /* Both commits' files, in one diff from the common base — the shape a
       squash-merged history needs, since the gained commits are not ancestors
       of the head and a per-commit walk would cost a process each. */
    expect([...gained!.files].sort()).toEqual([
      "docs/architecture/capability-atlas.md",
      "server/castingV2/b.ts",
    ]);
  });

  it("reads a head that was never fetched here as null, not as current", () => {
    /* The road a PR takes when its branch lives only on another machine. The
       dangerous answer is `{commits: [], files: []}` — "the gate saw
       everything" — so the arm pins the other one. */
    const { work } = world();
    const absent = "0".repeat(40);
    expect(readMainGained(runnerAt(work), absent, "team/never-pushed")).toBeNull();
  });

  it("is null when the fetch fails and `origin/main` is STALE — the dangerous case", () => {
    /*
      ⚠ THE ARM THE FETCH GUARD EXISTS FOR, AND IT WAS MISSING UNTIL SABOTAGE
      SAID SO. Deleting the `return null` on main's fetch left this whole suite
      green, because the no-origin arm below fails at `rev-parse origin/main`
      anyway — the fetch check is redundant there and load-bearing only here:
      an origin that EXISTS with a ref that still parses, and a fetch that
      cannot reach it.

      Without the guard the reader compares against a stale tip and answers
      `{commits: [], files: []}` — *"the gate saw everything"* — confidently and
      wrongly, which is the one direction this card cannot afford.
    */
    const { work, remote } = world();
    const head = branchWith(work, "team/unreachable", {
      "server/castingV2/a.ts": "export const a = 1;\n",
    });

    /* A second clone, pinned at the seed, which then goes blind. */
    const other = join(mkdtempSync(join(tmpdir(), "drape-2590-blind-")), "clone");
    dirs.push(other);
    must(tmpdir(), "clone", "-q", remote.replace(/\\/g, "/"), other);
    must(other, "fetch", "-q", "origin", "team/unreachable");
    const staleTip = must(other, "rev-parse", "origin/main");

    /* main moves on the real remote; this clone never hears about it. */
    const landed = landOnMain(work, "a later merge", {
      "server/castingV2/b.ts": "export const b = 1;\n",
    });
    must(other, "remote", "set-url", "origin", join(tmpdir(), "drape-2590-gone.git"));

    /* The preconditions, so a pass cannot come from the bench being broken in
       some other way: the ref still parses, it is stale, and the fetch fails. */
    expect(must(other, "rev-parse", "origin/main"), "the stale ref still parses").toBe(staleTip);
    expect(staleTip).not.toBe(landed);
    expect(runnerAt(other)(["fetch", "--quiet", "origin", "main"]).code, "the fetch fails")
      .not.toBe(0);

    expect(readMainGained(runnerAt(other), head, "team/unreachable")).toBeNull();
  });

  it("is null where there is no origin at all", () => {
    /* main's fetch is the one road that may not fail quietly: a comparison
       against a stale `origin/main` would call a current head stale and send a
       shift to re-gate for nothing. */
    const root = mkdtempSync(join(tmpdir(), "drape-2590-lone-"));
    dirs.push(root);
    must(root, "init", "-q", "-b", "main");
    must(root, "config", "user.email", "seat@example.invalid");
    must(root, "config", "user.name", "seat");
    must(root, "config", "core.autocrlf", "false");
    writeFileSync(join(root, "a.ts"), "export const a = 1;\n");
    must(root, "add", "-A");
    must(root, "commit", "-q", "-m", "seed");
    const head = must(root, "rev-parse", "HEAD");
    expect(readMainGained(runnerAt(root), head, "main")).toBeNull();
  });

  it("reads correctly in a clone that has never held the branch", () => {
    /* The shape a PR with no worktree here takes — the commonest one in a
       multi-seat night. The reader fetches the branch by name for exactly this
       case.

       ⚠ ITS PRECONDITION IS THE REF AND NOT THE OBJECT, and the first draft of
       this arm asserted the object and went red: git optimises a clone from a
       LOCAL path by sharing the whole object store, so the head commit is
       present in a fresh clone here even though no ref points at it. That is a
       property of the bench and not of GitHub, so the object-absent road is
       covered by the all-zeros arm above instead of being faked here. */
    const { work, remote } = world();
    const head = branchWith(work, "team/elsewhere", { "server/castingV2/c.ts": "export const c = 1;\n" });
    landOnMain(work, "later", { "server/castingV2/d.ts": "export const d = 1;\n" });

    /* A SECOND clone that has never seen the branch — the fresh tree a tool
       run from another machine would have. */
    const other = join(mkdtempSync(join(tmpdir(), "drape-2590-other-")), "clone");
    dirs.push(other);
    must(tmpdir(), "clone", "-q", "--single-branch", "-b", "main", remote.replace(/\\/g, "/"), other);
    expect(
      runnerAt(other)(["rev-parse", "--verify", "-q", "refs/remotes/origin/team/elsewhere"]).code,
      "the branch ref is absent to begin with",
    ).not.toBe(0);

    const gained = readMainGained(runnerAt(other), head, "team/elsewhere");
    expect(gained).not.toBeNull();
    expect(gained!.files).toEqual(["server/castingV2/d.ts"]);
  });

  it("does not call a head stale for commits it already contains", () => {
    /* A branch cut AFTER the later merge: main moved, then the branch was cut
       from the moved main. The commit is in main's first-parent history and in
       the head's, so a reader keying on "main has commits" rather than on
       ancestry would report it — and would refuse a perfectly current head. */
    const { work } = world();
    landOnMain(work, "first", { "server/castingV2/b.ts": "export const b = 1;\n" });
    const head = branchWith(work, "team/after", { "server/castingV2/a.ts": "export const a = 1;\n" });
    expect(readMainGained(runnerAt(work), head, "team/after")).toEqual({ commits: [], files: [] });
  });
});
