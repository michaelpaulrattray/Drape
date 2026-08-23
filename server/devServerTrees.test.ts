/**
 * KILL THE ROOT, NEVER THE LISTENER — the mechanical form of a warning that
 * three seats read and three seats then ignored (filed fable-1450).
 *
 * `pnpm dev` is a WATCHER plus a CHILD. `netstat -ano | findstr :300` names the
 * CHILD, so the pid a person has in hand is always the wrong one: killing it
 * frees the port for about thirty seconds and then the watcher starts another
 * server, on whatever port is free by then. Four were listening at once on
 * 2026-08-23, and one paid browser drive hit a stale one — which is how an
 * instrumented run came back carrying no instrumentation.
 *
 * The fixture below is that exact process table: two trees, each with a child
 * holding a port, and one of them the founder's own from before the shift.
 *
 * ⚠ **The fixture family shares nothing that would rescue a wrong answer.** The
 * child's command line differs from its root's by ONE token (`watch`), which is
 * the only discriminator a process table offers — so an implementation matching
 * on the entrypoint alone passes every arm about counting and fails the two
 * that matter.
 */
import { describe, expect, it } from "vitest";

import {
  devServerTrees,
  isDevServerChild,
  isDevServerRoot,
  rootsStartedAfter,
  rootsToKill,
  type ProcessRow,
} from "../scripts/lib/devServerTrees.mts";

const at = (hhmm: string) => new Date(`2026-08-23T${hhmm}:00.000Z`);

/** The founder's, from before the shift; and one of mine, from during it. */
const TABLE: ProcessRow[] = [
  {
    pid: 14660,
    parentPid: 1492,
    startedAt: at("07:49"),
    commandLine: 'node "C:\\Users\\Admin\\Drape\\node_modules\\.bin\\..\\.pnpm\\tsx@4.20.6\\node_modules\\tsx\\dist\\cli.mjs" "watch" "server/_core/index.ts"',
  },
  {
    pid: 12316,
    parentPid: 14660,
    startedAt: at("13:42"),
    commandLine: '"C:\\Program Files\\nodejs\\node.exe" --require C:/Users/Admin/Drape/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/preflight.cjs server/_core/index.ts',
  },
  {
    pid: 22316,
    parentPid: 14784,
    startedAt: at("13:51"),
    commandLine: 'node "C:\\Users\\Admin\\Drape\\node_modules\\.pnpm\\tsx@4.20.6\\node_modules\\tsx\\dist\\cli.mjs" "watch" "server/_core/index.ts"',
  },
  {
    pid: 21752,
    parentPid: 22316,
    startedAt: at("13:52"),
    commandLine: '"C:\\Program Files\\nodejs\\node.exe" --require C:/Users/Admin/Drape/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/preflight.cjs server/_core/index.ts',
  },
  /* A disposable script, which runs tsx and is not a server. */
  {
    pid: 9001,
    parentPid: 4000,
    startedAt: at("14:10"),
    commandLine: 'node "C:\\Users\\Admin\\Drape\\node_modules\\.pnpm\\tsx@4.20.6\\node_modules\\tsx\\dist\\cli.mjs" "scripts/_court-glossary-disposable.mts"',
  },
];

describe("telling a watcher from the server it keeps restarting", () => {
  it("a WATCHER is the one carrying the watch verb", () => {
    expect(TABLE.filter(isDevServerRoot).map((row) => row.pid)).toEqual([14660, 22316]);
  });

  it("a CHILD runs the same entrypoint and is not a watcher", () => {
    expect(TABLE.filter(isDevServerChild).map((row) => row.pid)).toEqual([12316, 21752]);
  });

  it("a tsx script that is not a server is neither", () => {
    const script = TABLE.find((row) => row.pid === 9001)!;
    expect(isDevServerRoot(script)).toBe(false);
    expect(isDevServerChild(script)).toBe(false);
  });

  it("pairs each watcher with what it owns, oldest first", () => {
    expect(devServerTrees(TABLE)).toEqual([
      { rootPid: 14660, startedAt: at("07:49"), childPids: [12316] },
      { rootPid: 22316, startedAt: at("13:51"), childPids: [21752] },
    ]);
  });
});

describe("⚠ the refusal, which is the whole point", () => {
  it("REFUSES a child's pid and names the root it belongs to", () => {
    /*
      21752 is what `netstat` hands you. Killing it frees the port and the
      watcher starts another server thirty seconds later — the mistake, made
      three times, in one assertion.
    */
    const verdict = rootsToKill(TABLE, [21752]);
    expect(verdict.kind).toBe("refused");
    expect(verdict.kind === "refused" && verdict.reason).toContain("CHILD");
    expect(verdict.kind === "refused" && verdict.reason).toContain("22316");
  });

  it("CONTROL — the root of that very tree is accepted", () => {
    /* Without this, the refusal above could be a constant and would prove
       nothing about which pid was passed. */
    expect(rootsToKill(TABLE, [22316])).toEqual({ kind: "kill", rootPids: [22316] });
  });

  it("refuses a pid that is not a dev server at all", () => {
    expect(rootsToKill(TABLE, [9001]).kind).toBe("refused");
  });

  it("refuses the whole batch when one member is wrong", () => {
    /* A partial kill is the worst outcome: some trees gone, one respawning,
       and a report saying the cleanup ran. */
    expect(rootsToKill(TABLE, [22316, 21752]).kind).toBe("refused");
  });
});

describe("whose server is it — the only honest discriminator is time", () => {
  it("takes the shift's own and leaves the one that was already running", () => {
    /* The founder runs his own on this machine. A cleanup that kills it is
       worse than a cleanup that leaves litter. */
    expect(rootsStartedAfter(TABLE, at("13:30")).map((tree) => tree.rootPid)).toEqual([22316]);
  });

  it("takes a tree born exactly at the cutoff", () => {
    /* Leaving one of your own behind is the failure this exists to prevent;
       asking about one extra is a question rather than a loss. */
    expect(rootsStartedAfter(TABLE, at("13:51")).map((tree) => tree.rootPid)).toEqual([22316]);
  });

  it("CONTROL — a cutoff before everything takes everything", () => {
    expect(rootsStartedAfter(TABLE, at("00:00")).map((tree) => tree.rootPid)).toEqual([14660, 22316]);
  });
});
