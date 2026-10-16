/**
 * THE CLOSE IS THE LAST MOMENT ANYBODY KNOWS WHOSE DEV SERVER IT WAS (#2563).
 *
 * `scripts/dev-servers.mts` could list and kill these from #783 onward and had
 * **no mechanical caller**: the standing orders' *"kill every process you
 * started"* is prose, and skipping it leaves no failing test, no error and no
 * trace. So the population was always found LATER, by a patrol, in a finished
 * seat's worktree — by which time *whose is it* was unanswerable, which is
 * precisely why #1481 swept two and filed the prevention as somebody else's
 * question, and why #2563 found seven and declined to touch five of them.
 *
 * A closing run row carries the one fact that makes the question answerable:
 * `startedAt`. These arms hold the two halves that matter — the finding says
 * enough to act on, and **no road through it can cost a shift its close**.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  closingDevServerFinding,
  type ClosingDevServerReading,
} from "../scripts/lib/crewClosingDevServers.mts";
import { rootsStartedAfter, type ProcessRow } from "../scripts/lib/devServerTrees.mts";

const tree = (rootPid: number, from: string | null, hhmm: string) => ({
  rootPid,
  startedAt: new Date(`2026-10-16T${hhmm}:00.000Z`),
  childPids: [rootPid + 1],
  watched: true,
  launchedFrom: from,
});

describe("⚠ the close names a shift's own dev servers, and never kills one (#2563)", () => {
  it("THE CONTROL THAT MATTERS — an unreadable process table is NOT a finding", () => {
    /* This script's standing rule: a check that can cost a shift its close is a
       check that gets skipped, and an OPEN row reads on his page as a shift
       still running (#288). The reader says why out loud on its `say` channel;
       what it must never do is produce a finding, which carries exit 2. */
    const reading: ClosingDevServerReading = { kind: "unreadable", reason: "powershell is not on PATH" };
    expect(closingDevServerFinding({ runId: 759, reading })).toBeNull();
  });

  it("a clean machine is not a finding either", () => {
    expect(closingDevServerFinding({ runId: 759, reading: { kind: "read", trees: [] } })).toBeNull();
  });

  it("names every root, its directory, and the kill command for the lot", () => {
    const found = closingDevServerFinding({
      runId: 759,
      reading: {
        kind: "read",
        trees: [
          tree(40408, "C:/Users/Admin/drape-shift-voicemoney", "13:00"),
          tree(44160, "C:/Users/Admin/drape-shift-2471-ration", "16:25"),
        ],
      },
    });
    expect(found).not.toBeNull();
    const text = String(found);
    expect(text).toContain("run #759");
    expect(text).toContain("2 dev server tree(s) still running");
    /* The pid to act on, and the directory that says whose it is — both, for
       both trees. A finding naming only a count sends the shift to re-derive
       what the close already had in hand. */
    expect(text).toContain("root 40408");
    expect(text).toContain("root 44160");
    expect(text).toContain("drape-shift-voicemoney");
    expect(text).toContain("drape-shift-2471-ration");
    expect(text).toContain("--kill 40408,44160");
  });

  it("⚠ it tells the shift to READ the directories first, because time cannot tell", () => {
    /* Up to four seats run in one pass, so *started after my row opened* also
       catches a lane-mate's live tree. The finding must not read as an
       instruction to kill everything it listed. */
    const text = String(closingDevServerFinding({
      runId: 760,
      reading: { kind: "read", trees: [tree(1, "C:/Users/Admin/drape-shift-other", "13:00")] },
    }));
    expect(text).toMatch(/READ THE DIRECTORIES FIRST/);
    expect(text).toMatch(/lane-mate/);
    expect(text).not.toMatch(/safe to kill/i);
  });

  it("says ROOT, never the pid netstat shows — the mistake three seats made", () => {
    const text = String(closingDevServerFinding({
      runId: 761,
      reading: { kind: "read", trees: [tree(99, null, "13:00")] },
    }));
    expect(text).toContain("Kill the ROOT");
    /* A tree whose command lines name no directory still gets a line, and says
       so rather than printing `null`. */
    expect(text).toContain("a directory its command lines do not name");
    expect(text).not.toContain("null");
  });

  it("⚠ the cutoff is INCLUSIVE, so a `pnpm dev` in the row's own second counts", () => {
    /* The close passes `row.startedAt` straight to `rootsStartedAfter`, and a
       shift's first act after opening its row can be `pnpm dev`. If this
       boundary were exclusive the commonest case would be the one it missed. */
    const opened = new Date("2026-10-16T13:00:00.000Z");
    const rows: ProcessRow[] = [{
      pid: 40408,
      parentPid: 1,
      name: "node.exe",
      startedAt: opened,
      commandLine: String.raw`node "C:\Users\Admin\drape-shift-x\node_modules\.bin\..\tsx\dist\cli.mjs" "watch" "server/_core/index.ts"`,
    }];
    expect(rootsStartedAfter(rows, opened).map((one) => one.rootPid)).toEqual([40408]);
    /* And a tree from before the row is not this shift's — the founder's own
       server is the case that protects. */
    expect(rootsStartedAfter(rows, new Date("2026-10-16T13:00:01.000Z"))).toEqual([]);
  });
});

/**
 * ⚠ AND THE CALLER, BECAUSE A CONTROL THAT IS NOT INVOKED DOES NOT EXIST
 * (invariant 7).
 *
 * This is the whole point of the card: `dev-servers.mts` could do the job from
 * #783 onward and nothing called it. So the arms below are about the CALL SITE,
 * in the sibling convention `crewCloseShippedPullRequest.test.ts` set for the
 * pull-request reading — same three rules, same reasons.
 */
const CLOSE = "scripts/crew-shift-close.mts";
const read = (relative: string) =>
  readFileSync(path.join(process.cwd(), relative), "utf8");

describe("⚠ the close actually asks (#2563)", () => {
  const consultsTheRule = (source: string): boolean => source.includes("readClosingDevServers(")
    && source.includes("closingDevServerFinding({");

  it("the close reads the process table and asks the rule", () => {
    expect(
      consultsTheRule(read(CLOSE)),
      "the close does not consult the rule — and a reader with no caller is exactly what left"
      + " seven of these resident across four worktrees",
    ).toBe(true);
  });

  it("POSITIVE CONTROL — that reading goes red on a copy carrying each defect", () => {
    const real = read(CLOSE);
    expect(consultsTheRule(real.replace(/readClosingDevServers\(/g, "somethingElse("))).toBe(false);
    expect(consultsTheRule(real.replace(/closingDevServerFinding\(\{/g, "somethingElse({"))).toBe(false);
  });

  it("the finding is collected AFTER the row is stamped, and never refuses or exits", () => {
    const source = read(CLOSE);
    const update = source.indexOf("SET endedAt = UTC_TIMESTAMP()");
    const site = source.indexOf("readClosingDevServers(");
    expect(update, "the close no longer writes — this arm is reading the wrong file").toBeGreaterThan(0);
    expect(site, "the reading must come AFTER the row is stamped").toBeGreaterThan(update);
    /* ⚠ SLICED to the block, not the whole file — a `not.toContain` over the
       file would be satisfied by any `refuse(` anywhere in it, and the file has
       several (memory: a guard arm satisfied by a sibling). The bound is the
       guard ON the slice: this arm is worthless the moment the slice quietly
       becomes the rest of the file, which is how the sibling arm caught this
       card's first draft inserting itself between ITS two anchors. */
    const block = source.slice(site, source.indexOf("if (findings.length > 0) {", site));
    expect(block.length, "the slice must be the block, not the rest of the file").toBeLessThan(700);
    expect(block).not.toContain("refuse(");
    expect(block).not.toContain("process.exit");
    expect(block).toContain("findings.push(");
  });

  it("the cutoff is the row's own stamp, never a number this script invents", () => {
    /* `--since` exists because a process table cannot say whose a server is and
       an operator must state when their shift began. The close is the one
       caller that already holds that answer — if it passed anything else, the
       finding would be about an arbitrary window. */
    const source = read(CLOSE);
    const site = source.indexOf("readClosingDevServers(");
    const block = source.slice(site, site + 200);
    expect(block).toContain("new Date(row.startedAt)");
  });
});
