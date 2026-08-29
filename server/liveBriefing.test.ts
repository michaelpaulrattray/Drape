/**
 * THE REPLY READER READS THE WORLD HE IS LOOKING AT (#221 §4).
 *
 * On 2026-08-29 deployment `465bb66c` built its image and never started a
 * container. `main` held briefing edition 93; production served 92; and
 * `crew-read-replies.mts` printed `briefing edition 93` because it read the
 * working tree. Two shifts and issue #221's own repair list took that number
 * as a fact about production.
 *
 * These arms drive `chooseBriefing` on that night's exact shape and on the
 * failure roads around it. The one that matters most is the third: the
 * acknowledgement set must come from the DEPLOYED briefing, because the tool's
 * own contract is that a reply is seen when a deploy proves it was read — so a
 * reply acknowledged only in an undeployed edition must still print as NEW
 * (working law 2: the arm is the incident's shape, and the fixture could
 * produce the wrong answer — it did, for months).
 */
import { describe, expect, it } from "vitest";

import type { DeploymentRow } from "../scripts/lib/deployWatch.mts";
import { chooseBriefing, describeSource, liveCommit } from "../scripts/lib/liveBriefing.mts";

const briefing = (edition: number, acknowledgedReplyIds: number[]) =>
  JSON.stringify({ edition, acknowledgedReplyIds, needsYou: [{ id: `card-${edition}`, title: `card of ${edition}` }] });

const row = (id: string, status: string, commitHash: string | null): DeploymentRow =>
  ({ id, status, at: "", commitHash });

/** The night itself: a FAILED newest row on e93, a SUCCESS row under it on e92. */
const THE_NIGHT: DeploymentRow[] = [
  row("465bb66c", "FAILED", "b788abb336bfb06abbc979677a17f5ba375fbd4e"),
  row("f6653937", "SUCCESS", "26139176269563077032daf1a186a6d6d1d1d246"),
];

const showsE92 = (sha: string) =>
  sha.startsWith("26139176") ? briefing(92, [1, 2, 3]) : briefing(93, [1, 2, 3, 4]);

describe("chooseBriefing", () => {
  it("the incident: takes the SUCCESS row's edition, not the newest row's and not the tree's", () => {
    const choice = chooseBriefing(THE_NIGHT, briefing(93, [1, 2, 3, 4]), showsE92);
    expect(choice.kind).toBe("deployed");
    expect(choice.facts?.edition).toBe(92);
    expect(choice.sha?.startsWith("26139176")).toBe(true);
  });

  it("says the tree is AHEAD, so a shift cannot read 93 as live", () => {
    const choice = chooseBriefing(THE_NIGHT, briefing(93, [1, 2, 3, 4]), showsE92);
    expect(choice.treeAhead).toBe(true);
    expect(choice.treeEdition).toBe(93);
    expect(describeSource(choice)).toContain("edition 93 is committed but NOT on his page");
    expect(describeSource(choice)).toContain("edition 92");
  });

  /* THE ONE THAT COSTS A REPLY. Reply #4 is acknowledged in the tree's edition
     93 and in no deployed edition; his page says "Not read yet". The reader
     must not treat it as seen. */
  it("a reply acknowledged ONLY in an undeployed edition is NOT acknowledged", () => {
    const choice = chooseBriefing(THE_NIGHT, briefing(93, [1, 2, 3, 4]), showsE92);
    expect(choice.facts?.acknowledgedReplyIds).toEqual([1, 2, 3]);
    expect(choice.facts?.acknowledgedReplyIds).not.toContain(4);
  });

  it("negative control: with the tree BEHIND the live edition, nothing claims ahead", () => {
    const choice = chooseBriefing(THE_NIGHT, briefing(91, [1]), showsE92);
    expect(choice.facts?.edition).toBe(92);
    expect(choice.treeAhead).toBe(false);
    expect(describeSource(choice)).not.toContain("AHEAD");
  });

  it("titles come from the deployed briefing too — his page's cards, not the tree's", () => {
    const choice = chooseBriefing(THE_NIGHT, briefing(93, []), showsE92);
    expect(choice.facts?.needsYou.map((card) => card.id)).toEqual(["card-92"]);
  });

  describe("every fallback road says which road it took", () => {
    it("no readable listing → the tree, named as the tree", () => {
      const choice = chooseBriefing([], briefing(93, [1, 2, 3, 4]), showsE92);
      expect(choice.kind).toBe("tree");
      expect(choice.facts?.edition).toBe(93);
      expect(choice.why).toContain("no SUCCESS deployment row");
      expect(describeSource(choice)).toContain("WORKING TREE");
    });

    it("rows with no SUCCESS at all → the tree", () => {
      const choice = chooseBriefing([row("a", "FAILED", "aa")], briefing(93, []), showsE92);
      expect(choice.kind).toBe("tree");
    });

    it("a SUCCESS row with no commit hash cannot be attributed → the tree", () => {
      const choice = chooseBriefing([row("a", "SUCCESS", null)], briefing(93, []), showsE92);
      expect(choice.kind).toBe("tree");
    });

    it("git cannot show the commit → the tree, naming the sha it wanted", () => {
      const choice = chooseBriefing(THE_NIGHT, briefing(93, []), () => null);
      expect(choice.kind).toBe("tree");
      expect(choice.why).toContain("26139176");
    });

    it("the deployed bytes do not parse → the tree", () => {
      const choice = chooseBriefing(THE_NIGHT, briefing(93, []), () => "{not json");
      expect(choice.kind).toBe("tree");
      expect(choice.why).toContain("does not parse");
    });

    it("no tree either → no facts, and the caller shows the whole thread", () => {
      const choice = chooseBriefing([], null, showsE92);
      expect(choice.facts).toBeNull();
      expect(choice.treeEdition).toBeNull();
    });
  });

  it("liveCommit skips FAILED rows even when they are newest", () => {
    expect(liveCommit(THE_NIGHT)?.startsWith("26139176")).toBe(true);
    expect(liveCommit([])).toBeNull();
  });
});

/* INVARIANT 7 — the chooser is CALLED by the tool it repairs. A decision module
   nothing invokes is the un-wired control this repository has four of. */
describe("the reply reader invokes it", () => {
  it("crew-read-replies.mts imports and prints the choice", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("scripts/crew-read-replies.mts", "utf8");
    expect(source).toContain("./lib/liveBriefing.mts");
    expect(source).toContain("chooseBriefing(");
    expect(source).toContain("describeSource(choice)");
  });
});
