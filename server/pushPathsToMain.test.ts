/**
 * THE DOORS TO `main` ARE ENUMERATED, AND THE POPULATION IS DERIVED (#263).
 *
 * Founder ruling, 2026-08-30: *"A gate that only runs on pull requests, plus a
 * path that pushes straight to main, means the gate is optional in practice …
 * Worth checking whether anything else can reach main without a PR."* His bar:
 * *"the sweep reports the full list of push paths whether or not it finds a
 * second offender — 'only the rite' is a real and valuable answer, but only
 * when it comes from a search rather than from an assumption."*
 *
 * Read at the tree on 2026-09-03, the answer IS "only the rite". This suite is
 * what keeps that sentence true: the population comes from
 * `scripts/lib/pushPaths.mts` and is compared to an allowlist that names each
 * door and its reason. `docs/specs/PUSH_PATHS_TO_MAIN.md` carries the three
 * doors no repository check can see.
 *
 * ⚠ **Every absence arm here has a POSITIVE CONTROL beside it**, because this
 * suite's whole output is a set of empty-ish answers — "one pusher", "no
 * workflow writers" — and an absence assertion is green when the reader is
 * broken as well as when the tree is clean. Working law 2: verify the
 * instrument before believing its finding.
 */
import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  gitTreeReader,
  ORIGIN_PUSHER,
  readProtectedRefs,
  readPushPaths,
  type TreeReader,
} from "../scripts/lib/pushPaths.mts";
import { listScriptGuardSuites, ORIGIN_SUITE, PUSH_PATH_SUITES } from "../scripts/lib/scriptGuards.mts";

const ROOT = path.resolve(import.meta.dirname, "..");

/**
 * EVERY FILE THE DETECTOR FLAGS, AND WHETHER IT IS ACTUALLY A DOOR.
 *
 * Adding an entry is a decision, exactly like adding a public endpoint or a
 * session-issuance site. An unenumerated one is the bug this card was filed on.
 *
 * ⚠ **`door: false` entries are the price of the over-inclusive contract, and
 * they are the RIGHT price.** The detector flags an executable file whose text
 * says `git push` even in a comment, because under-inclusion is a door nobody
 * sees and over-inclusion costs one line of writing. Two of the three entries
 * below are prose — and both of them are files THIS CARD ADDED, which is the
 * over-inclusion arriving the same hour the rule was written rather than in
 * some future nobody was watching. Each still has to be read and judged before
 * it may sit here, which is the whole mechanism.
 */
const FLAGGED: Record<string, { door: boolean; why: string }> = {
  "scripts/deploy-rite.mts": {
    door: true,
    why: "THE DEPLOY RITE — the one door by design. It sets DRAPE_DEPLOY_RITE on the "
      + "push child, which is the only thing .githooks/pre-push accepts for main and "
      + "local-migration. Its custody checks: hooksPath armed, atlas merge driver, "
      + "architecture:check, capability:check, dirty-tree refusal, briefing "
      + "conformance, eye frames, the script guards, and — since #263 — pnpm check, "
      + "all over the commit being pushed.",
  },
  "scripts/lib/pushPaths.mts": {
    door: false,
    why: "The detector itself. Its docblock states the contract in prose ('contains a "
      + "git push invocation'), which its own shell pattern then matches. It spawns "
      + "nothing: its only child processes are `git ls-files` and reads from disk.",
  },
  "server/pushPathsToMain.test.ts": {
    door: false,
    why: "This suite. Its NEGATIVE CONTROL feeds the reader a fake markdown file "
      + "containing `git push origin main`, so the literal is in its own source. Its "
      + "only child process is `git ls-files`, through gitTreeReader.",
  },
};

/** The subset that can really reach main. Derived from the map, never a second list. */
const DOORS = Object.entries(FLAGGED).filter(([, entry]) => entry.door).map(([file]) => file);

/** A tree reader over a literal map, for driving the derivation at shapes the real tree does not hold. */
const fakeTree = (files: Record<string, string>): TreeReader => ({
  files: () => Object.keys(files).sort(),
  read: (file) => files[file] ?? "",
});

/** The real hook text, so a synthetic tree can keep the origin floor satisfied. */
const realHook = gitTreeReader(ROOT).read(".githooks/pre-push");
const realRite = 'run("git", ["push", ...args], false, { ...process.env, DRAPE_DEPLOY_RITE: "1" })';

/**
 * The minimum a synthetic tree needs to get past the reader's own refusals: the
 * hook it parses, the origin pusher its floor requires, and one well-formed
 * workflow (it refuses a tree with no workflows at all, since that reading is
 * indistinguishable from a blind reader).
 */
const baseline = {
  ".githooks/pre-push": realHook,
  [ORIGIN_PUSHER]: realRite,
  ".github/workflows/gate.yml": "permissions:\n  contents: read\n",
};

describe("the doors to main are enumerated (#263)", () => {
  it("every file in the tree that says `git push` is on the list, judged", () => {
    const { pushers } = readPushPaths(gitTreeReader(ROOT));

    /* Named individually so a failure says WHICH file appeared, not "4 !== 3". */
    for (const pusher of pushers) {
      expect(
        FLAGGED[pusher],
        `${pusher} names \`git push\` and is not enumerated. A new path to main is a `
        + `DECISION: add it to FLAGGED — door: true with the checks it runs, or `
        + `door: false with the reason it only mentions pushing — and to `
        + `docs/specs/PUSH_PATHS_TO_MAIN.md. (#263)`,
      ).toBeDefined();
    }
    expect(pushers.sort()).toEqual(Object.keys(FLAGGED).sort());
  });

  it("the rite is a door, and it is the only one", () => {
    /* The list could rot into all-prose entries and still pass the arm above,
       which would read as "no doors" — the reading this instrument must never
       produce by accident. */
    expect(DOORS).toEqual([ORIGIN_PUSHER]);
  });

  it("POSITIVE CONTROL — a new pushing script IS caught, in both invocation shapes", () => {
    const shell = readPushPaths(fakeTree({ ...baseline, "scripts/sneaky.sh": "git push origin main\n" }));
    expect(shell.pushers).toContain("scripts/sneaky.sh");

    const argv = readPushPaths(fakeTree({ ...baseline, "scripts/sneaky.mts": 'execFileSync("git", ["push", "origin", "main"])' }));
    expect(argv.pushers).toContain("scripts/sneaky.mts");

    /* And the arm above would then FAIL on it — the control proves the finding
       reaches the assertion, not merely the reader. */
    expect(FLAGGED["scripts/sneaky.sh"]).toBeUndefined();
  });

  it("NEGATIVE CONTROL — prose about pushing is not a door, and neither is a markdown file", () => {
    const reading = readPushPaths(fakeTree({
      ...baseline,
      /* The real sentence in scripts/check-architecture.mts, which is not a pusher. */
      "scripts/check-architecture.mts": "the Atlas walks the working tree, git pushes the index",
      "docs/HOWTO.md": "run `git push origin main` when you are done",
      "server/thing.ts": "const items = []; items.push(1);",
    }));
    expect(reading.pushers).toEqual([ORIGIN_PUSHER]);
  });

  it("REFUSES rather than reporting an empty list when the reader goes blind", () => {
    expect(() => readPushPaths(fakeTree({}))).toThrow(/no tracked files/);
    /* A tree with files but no rite: the floor fires, so a derivation that has
       silently stopped matching cannot pass itself off as "no doors". */
    expect(() => readPushPaths(fakeTree({ ".githooks/pre-push": realHook, "server/a.ts": "nothing" })))
      .toThrow(/lost its origin case/);
  });
});

describe("nothing in CI can reach main (#263)", () => {
  it("no workflow grants contents: write", () => {
    const { workflowWriters } = readPushPaths(gitTreeReader(ROOT));
    expect(
      workflowWriters,
      "a workflow now has write access to the repository contents. It can commit and push "
      + "without a pull request — enumerate it in docs/specs/PUSH_PATHS_TO_MAIN.md and say "
      + "what stops it reaching main. (#263)",
    ).toEqual([]);
  });

  it("POSITIVE CONTROL — a workflow that granted write WOULD be reported", () => {
    const reading = readPushPaths(fakeTree({
      ...baseline,
      ".github/workflows/release.yml": "permissions:\n  contents: write\n",
    }));
    expect(reading.workflowWriters).toEqual([".github/workflows/release.yml"]);
  });

  it("every workflow SAYS what it gets — an absent permissions block inherits the default", () => {
    /* The arm above only sees the word `write`. A workflow with no block at all
       inherits the repository's default workflow token permissions — server-side
       state, `read` when door A was read on 2026-09-03, and one settings change
       away from write. Both production-deploying branches are protected as of
       2026-09-03 (#461), and a workflow token is not an admin, so the required
       checks would bind such a job on those two refs — which narrows this door
       rather than closing it: the setting is still unreadable from here, and a
       job can still write wherever protection does not reach. (review finding 2) */
    const { workflowsWithoutPermissions } = readPushPaths(gitTreeReader(ROOT));
    expect(
      workflowsWithoutPermissions,
      "a workflow declares no top-level `permissions:` block, so what it can do is "
      + "decided by a GitHub setting rather than by this repository. Declare it "
      + "explicitly — `permissions:\\n  contents: read` — whatever the default is today. (#263)",
    ).toEqual([]);
  });

  it("POSITIVE CONTROL — a workflow with no permissions block IS reported", () => {
    const reading = readPushPaths(fakeTree({
      ...baseline,
      ".github/workflows/silent.yml": "on: push\njobs:\n  a:\n    runs-on: ubuntu-latest\n",
    }));
    expect(reading.workflowsWithoutPermissions).toEqual([".github/workflows/silent.yml"]);
    /* And it is NOT caught by the writers arm — which is the whole finding. */
    expect(reading.workflowWriters).toEqual([]);
  });

  it("REFUSES when it can see no workflows at all", () => {
    /* Not `baseline` — that carries a workflow on purpose. A tree with none is
       a reader that has lost sight of `.github/`, and "no workflow can push" is
       then a sentence about the reader, not about the repository. */
    expect(() => readPushPaths(fakeTree({
      ".githooks/pre-push": realHook,
      [ORIGIN_PUSHER]: realRite,
    }))).toThrow(/no workflows/);
  });
});

describe("the enumeration runs on the path it guards (#263, review finding 1)", () => {
  /* ⚠ THE SHARPEST ARM IN THIS FILE. This suite was built to catch a new script
     that can push to `main`, and it shipped running ONLY on pull requests — the
     exact hole its own card was filed to close. A shift rite-pushing a
     disposable that pushes would have landed an unenumerated door and reddened
     the NEXT pull request's gate, which is #152's origin incident happening
     again to #152's own successor. */
  it("is in the population the rite runs before it pushes", () => {
    const suites = listScriptGuardSuites(ROOT);
    expect(
      suites,
      "the push-path enumeration must run on the push path, or it only ever sees "
      + "changes that arrive by pull request — which is 31% of what reaches main. (#263)",
    ).toContain("server/pushPathsToMain.test.ts");
  });

  it("POSITIVE CONTROL — the grep alone does NOT reach it, which is why the named list exists", () => {
    /* Driven, not asserted from the docblock: the derivation's own contract is
       the bare quoted token `"scripts"`, and this file never contains it. */
    const grepOnly = listScriptGuardSuites(ROOT, () => [ORIGIN_SUITE, "server/scriptConnectionDiscipline.test.ts"].join("\n"));
    expect(grepOnly).toContain("server/pushPathsToMain.test.ts"); // added by the named list
    expect(PUSH_PATH_SUITES).toContain("server/pushPathsToMain.test.ts");
  });

  it("a named suite cannot rescue a grep that has stopped working", () => {
    /* The origin floor is checked on the DERIVED list alone. Without that, the
       named list would keep the population non-empty while the derivation was
       silently returning nothing. */
    expect(() => listScriptGuardSuites(ROOT, () => "server/somethingElse.test.ts"))
      .toThrow(/lost its origin case/);
  });
});

describe("the pre-push gate covers both deploying branches (#263)", () => {
  it("main and local-migration are both refused without the rite's marker", () => {
    const refs = readProtectedRefs(gitTreeReader(ROOT));
    expect(
      refs,
      "both branches deploy production. A branch that deploys and is not in the hook's "
      + "case arm can be pushed by hand with no freeze check and no custody checks. (#263)",
    ).toEqual(["local-migration", "main"]);
  });

  it("POSITIVE CONTROL — a hook that lost a branch is reported, and an unreadable one REFUSES", () => {
    const narrowed = realHook.replace("|refs/heads/local-migration", "");
    expect(narrowed).not.toEqual(realHook); // the sabotage landed
    expect(readProtectedRefs(fakeTree({ ".githooks/pre-push": narrowed }))).toEqual(["main"]);

    expect(() => readProtectedRefs(fakeTree({}))).toThrow(/missing or unreadable/);
    expect(() => readProtectedRefs(fakeTree({ ".githooks/pre-push": "#!/bin/sh\nexit 0\n" })))
      .toThrow(/no longer states its protected refs/);
  });
});

describe("the rite actually runs the checks it is credited with (#263)", () => {
  /* Invariant 7 pointed at this card's own fix: the enumeration above CLAIMS
     the rite typechecks the commit. A claim about a control is worth nothing
     unless something asserts the call site exists — this repository has three
     recorded deaths of exactly that shape.

     `sha` is the rite's own name for the commit being pushed, so the comma
     before it is asserted too: `runTypecheckOnCommit(root, sha)` passes and a
     call handed some other value does not. */
  const rite = gitTreeReader(ROOT).read(ORIGIN_PUSHER);
  const CALLS_TYPECHECK = /runTypecheckOnCommit\([\s\S]{0,80}?, sha\)/;
  const CALLS_GUARDS = /runScriptGuardsOnCommit\([\s\S]{0,80}?, sha\)/;

  it("calls runTypecheckOnCommit on the commit being pushed", () => {
    expect(rite).toContain('from "./lib/typecheckOnCommit.mts"');
    expect(rite).toMatch(CALLS_TYPECHECK);
  });

  it("calls runScriptGuardsOnCommit on the same commit", () => {
    expect(rite).toMatch(CALLS_GUARDS);
  });

  it("POSITIVE CONTROL — the assertion fails on a rite that lost the call", () => {
    const withoutCall = rite.replace(/runTypecheckOnCommit\(/g, "noop(");
    expect(withoutCall).not.toEqual(rite); // the sabotage landed
    expect(withoutCall).not.toMatch(CALLS_TYPECHECK);
  });
});
