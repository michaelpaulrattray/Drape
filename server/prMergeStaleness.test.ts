/**
 * THE STALENESS READING, DRIVEN AGAINST REAL REPOSITORIES (#2590).
 *
 * # What this proves and why a fixture could not
 *
 * `readMainGained` decides whether `pr-merge-in-order` refuses a merge, and it
 * decides it by asking git five questions. A suite that handed it a fake
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
 * pair that produced #2589: #2581's gate run was created at 09:32Z against a
 * main that did not yet hold #2585; #2585 landed at 11:13Z; #2581 merged at
 * 12:44Z on a `CLEAN` reading, and `main` was red a minute later.
 *
 * # ⚠ THE QUESTION IT ASKS WAS WRONG ONCE, WHICH IS WHY THESE ARMS LOOK AS
 *   THEY DO (repaired on the relay's finding, 2026-10-16)
 *
 * The first reader asked whether main's tip was inside the HEAD's history. But
 * `gate.yml` runs on `pull_request`, so it tests the MERGE REF — the head merged
 * onto main as main stood when the RUN was created — and never the head's own
 * tree. A branch cut before main moved but PUSHED after it moved was therefore
 * gated on the newer main while reading "behind" by ancestry: re-measured over
 * the last 50 merges, **16 of them would have been refused for nothing**, and
 * the figure that argued for this feature fell from 33 to 17.
 *
 * So the reader is given the base recorded on the gate RUN, and **the head is
 * not consulted at all** — which `the head is never consulted` below pins by
 * handing it a head that is wildly behind and asserting it still reads fresh.
 * Without that arm a reader that quietly went back to looking at the head would
 * pass everything else here.
 *
 * # Both directions, because only one of them can be seen in the output
 *
 * A reader that reported staleness for everything would pass every positive arm
 * here, so the fresh-base arms are not decoration: they are the control. And
 * the `null` arms are the ones that keep this safe to ship — a reading that
 * cannot be taken must leave the merge tool behaving exactly as it did before
 * this card, never refusing on the strength of not seeing anything.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it, vi } from "vitest";

import { gateRunIdOf, type GitRun, readMainGained } from "../scripts/lib/prMergeOrder.mts";
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
  it("says nothing was gained when the gate's base is still main's tip", () => {
    const { work } = world();
    const gateBase = must(work, "rev-parse", "main");
    branchWith(work, "team/current", { "server/castingV2/a.ts": "export const a = 1;\n" });
    /* THE CONTROL. A reader that reported staleness unconditionally would pass
       every arm below this one, and this is the only arm that says so. */
    expect(readMainGained(runnerAt(work), gateBase)).toEqual({ commits: [], files: [] });
  });

  it("the head is never consulted — a head miles behind main reads FRESH when its gate base is current", () => {
    /*
      ⚠ THE ARM THE RELAY'S FINDING EXISTS FOR, AND THE ONE THIS READER GOT
      WRONG FIRST. `gate.yml` runs on `pull_request`, so the run tests the head
      merged onto main AS MAIN STOOD WHEN THE RUN WAS CREATED. A branch cut long
      before main moved, but pushed AFTER it moved, was therefore gated against
      the newer main — its green is about the right tree — while being "behind"
      by ancestry. Re-measured over the last 50 merges, the ancestry question
      refused 33 and this one refuses 17: **16 of those were over-refusals**, a
      seven-minute re-gate each, for nothing.

      So the branch here is cut from the SEED, main then moves twice, and the
      gate base is main's CURRENT tip. The head contains none of it. The answer
      must still be "nothing gained".
    */
    const { work } = world();
    const head = branchWith(work, "team/cut-early", {
      "server/castingV2/a.ts": "export const a = 1;\n",
    });
    landOnMain(work, "first", { "server/castingV2/b.ts": "export const b = 1;\n" });
    const gateBase = landOnMain(work, "second", { "scripts/lib/c.mts": "export const c = 1;\n" });

    /* The precondition, so the pass cannot come from the bench: the head really
       is behind, which is exactly what the old reader keyed on. */
    expect(
      runnerAt(work)(["merge-base", "--is-ancestor", gateBase, head]).code,
      "the head genuinely does NOT contain main's tip",
    ).not.toBe(0);

    expect(readMainGained(runnerAt(work), gateBase)).toEqual({ commits: [], files: [] });
  });

  it("names the commits and files main gained after the gate ran", () => {
    const { work } = world();
    const gateBase = must(work, "rev-parse", "main");
    branchWith(work, "team/stale", {
      "server/castingV2/inkPlacement.ts": "export const placement = 1;\n",
    });
    const landed = landOnMain(work, "a later merge", {
      "server/castingV2/inkPlacementResolve.ts": "export const resolve = 1;\n",
    });

    const gained = readMainGained(runnerAt(work), gateBase);
    expect(gained).not.toBeNull();
    expect(gained!.commits).toHaveLength(1);
    /* Abbreviated, so the assertion is on a prefix of the real sha rather than
       on this suite's idea of how git abbreviates. */
    expect(landed.startsWith(gained!.commits[0]!)).toBe(true);
    expect(gained!.files).toEqual(["server/castingV2/inkPlacementResolve.ts"]);
  });

  it("counts every commit main gained, not just the newest", () => {
    const { work } = world();
    const gateBase = must(work, "rev-parse", "main");
    landOnMain(work, "first", { "server/castingV2/b.ts": "export const b = 1;\n" });
    landOnMain(work, "second", { "docs/architecture/capability-atlas.md": "# map\n" });

    const gained = readMainGained(runnerAt(work), gateBase);
    expect(gained!.commits).toHaveLength(2);
    /* Both commits' files, in one diff from the gate's base — one diff answers
       for every gained commit, so a per-commit walk would cost a process each
       and tell us nothing more. */
    expect([...gained!.files].sort()).toEqual([
      "docs/architecture/capability-atlas.md",
      "server/castingV2/b.ts",
    ]);
  });

  it("counts a squash merge that arrived as a merge's SECOND parent", () => {
    /*
      ⚠ WHY THE WALK IS NOT `--first-parent`, WHICH THE FIRST READER USED. The
      deploy rite commits locally and then merges `origin/main`, so every PR's
      squash commit reaches main as the SECOND parent of the rite's merge.
      Driven on the real history: `rev-list --first-parent f52f667ae..bdf1587af`
      returns ONLY the rite's merge and drops `6df095528` — PR #2585, the very
      commit that turned `main` red and caused this card.

      This arm reproduces that history in miniature: a squash lands on main, the
      rite commits beside it and merges, and the reader must see BOTH plus the
      merge. A `--first-parent` walk sees one.
    */
    const { work } = world();
    const gateBase = must(work, "rev-parse", "main");

    /* The squash merge, landing on main the way a PR does. */
    const squash = landOnMain(work, "a PR squashed onto main", {
      "server/castingV2/inkPlacementResolve.ts": "export const resolve = 1;\n",
    });

    /* The rite: a local commit on an older main, then a merge of origin/main. */
    must(work, "checkout", "-q", "-b", "rite", gateBase);
    writeFileSync(join(work, "editionNote.md"), "# edition\n");
    must(work, "add", "-A");
    must(work, "commit", "-q", "-m", "chore(crew): an edition");
    must(work, "merge", "-q", "--no-edit", squash);
    must(work, "push", "-q", "origin", "HEAD:main");
    must(work, "checkout", "-q", "main");
    must(work, "fetch", "-q", "origin", "main");

    const gained = readMainGained(runnerAt(work), gateBase);
    expect(gained).not.toBeNull();
    /* The squash, the rite's own commit, and the rite's merge. */
    expect(gained!.commits).toHaveLength(3);
    const seen = gained!.commits.some((short) => squash.startsWith(short));
    expect(seen, "the squash merge must be among the gained commits").toBe(true);
    expect(gained!.files).toContain("server/castingV2/inkPlacementResolve.ts");
  });

  it("reads a base this clone has never heard of as null, not as current", () => {
    /* A run GitHub still reports but whose base is unreachable here. The
       dangerous answer is `{commits: [], files: []}` — "the gate saw
       everything" — so the arm pins the other one. */
    const { work } = world();
    const absent = "0".repeat(40);
    expect(readMainGained(runnerAt(work), absent)).toBeNull();
  });

  it("is null when there is no gate base to read at all", () => {
    /* The road an absent run, a closed PR or a failed API read takes — GitHub
       empties a run's `pull_requests` once a PR closes, measured on #2581's own
       merged head. `null` in, `null` out, and the merge tool behaves exactly as
       it did before this card. */
    const { work } = world();
    landOnMain(work, "a later merge", { "server/castingV2/b.ts": "export const b = 1;\n" });
    expect(readMainGained(runnerAt(work), null)).toBeNull();
  });

  it("is null when the gate's base is not an ancestor of main", () => {
    /* A rewritten main, or a base from a fork: `gateBase..tip` would answer a
       question nobody asked, so the reading is refused rather than returned as
       an empty gain. */
    const { work } = world();
    const divergent = branchWith(work, "team/divergent", {
      "server/castingV2/other.ts": "export const other = 1;\n",
    });
    landOnMain(work, "main goes its own way", { "server/castingV2/b.ts": "export const b = 1;\n" });
    expect(
      runnerAt(work)(["merge-base", "--is-ancestor", divergent, "origin/main"]).code,
      "the bench really is divergent",
    ).not.toBe(0);
    expect(readMainGained(runnerAt(work), divergent)).toBeNull();
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

    /* A second clone, pinned at the seed, which then goes blind. Its view of
       main IS the gate's base, which is what makes the stale comparison
       indistinguishable from a fresh one without the guard. */
    const other = join(mkdtempSync(join(tmpdir(), "drape-2590-blind-")), "clone");
    dirs.push(other);
    must(tmpdir(), "clone", "-q", remote.replace(/\\/g, "/"), other);
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

    expect(readMainGained(runnerAt(other), staleTip)).toBeNull();
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
    const base = must(root, "rev-parse", "HEAD");
    expect(readMainGained(runnerAt(root), base)).toBeNull();
  });

  it("reads correctly in a clone that has never held the PR's branch", () => {
    /* The shape a PR with no worktree here takes — the commonest one in a
       multi-seat night.

       ⚠ AND IT IS NOW TRUE BY CONSTRUCTION RATHER THAN BY A FETCH. The old
       reader had to fetch the PR's branch by name because it compared against
       the HEAD; this one compares against the gate's base, which is a commit on
       MAIN, so a clone that fetches main has everything the reading needs and
       the branch may stay absent for ever. That is one fewer network road and
       one fewer way to answer "the gate saw everything" wrongly. */
    const { work, remote } = world();
    const gateBase = must(work, "rev-parse", "main");
    branchWith(work, "team/elsewhere", { "server/castingV2/c.ts": "export const c = 1;\n" });
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

    const gained = readMainGained(runnerAt(other), gateBase);
    expect(gained).not.toBeNull();
    expect(gained!.files).toEqual(["server/castingV2/d.ts"]);
  });
});

/**
 * THE RUN BEHIND THE CHECK — the one road from a rollup entry to the base the
 * gate tested, so a wrong parse is a silent `null` and a whole reading lost.
 *
 * These are string arms rather than repository arms because that is honestly
 * all the function is; the shape they assert was read off a REAL rollup entry
 * (`gh pr view 2593 --json statusCheckRollup`) rather than imagined.
 */
describe("gateRunIdOf", () => {
  const entry = (overrides: Record<string, unknown>) => ({
    __typename: "CheckRun",
    name: "gate-checks",
    startedAt: "2026-10-16T14:57:25Z",
    ...overrides,
  });

  it("takes the RUN id from a real check run's details URL, not the job id", () => {
    /* The exact string GitHub returned for PR #2593's gate check. The job id
       trails the run id, so a lazy `\\d+` would pick the wrong one. */
    const rollup = [
      entry({
        detailsUrl:
          "https://github.com/michaelpaulrattray/Drape/actions/runs/38919959834/job/117037071112",
      }),
    ];
    expect(gateRunIdOf(rollup, "gate-checks")).toBe("38919959834");
  });

  it("reads the NEWEST run of the named check, the same one the green is read from", () => {
    /* A re-run leaves two entries. Reading the base off one run and the
       conclusion off another is the one way this could be worse than useless. */
    const rollup = [
      entry({
        startedAt: "2026-10-16T09:00:00Z",
        detailsUrl: "https://github.com/o/r/actions/runs/111/job/1",
      }),
      entry({
        startedAt: "2026-10-16T14:57:25Z",
        detailsUrl: "https://github.com/o/r/actions/runs/222/job/2",
      }),
    ];
    expect(gateRunIdOf(rollup, "gate-checks")).toBe("222");
  });

  it("ignores a check of another name", () => {
    const rollup = [entry({ name: "bundle-budget", detailsUrl: "https://github.com/o/r/actions/runs/999/job/1" })];
    expect(gateRunIdOf(rollup, "gate-checks")).toBeNull();
  });

  it("is null for a status context that carries no run at all", () => {
    /* A `StatusContext` entry — an external reporter, not an Actions run. */
    expect(gateRunIdOf([{ __typename: "StatusContext", name: "gate-checks" }], "gate-checks")).toBeNull();
  });

  it("is null for a details URL that is not a run page", () => {
    const rollup = [entry({ detailsUrl: "https://example.invalid/somewhere/else" })];
    expect(gateRunIdOf(rollup, "gate-checks")).toBeNull();
  });

  it("is null for an empty rollup", () => {
    expect(gateRunIdOf([], "gate-checks")).toBeNull();
  });
});
