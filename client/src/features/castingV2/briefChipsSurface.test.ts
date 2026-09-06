/**
 * THE CHIP STRIP'S SURFACE CONTRACT (#535 decision 12).
 *
 * There is no render harness in this client (no jsdom), so the pin is the
 * `readOnlyEcho` suite's two-layered shape: the POLICY functions are driven
 * as values, and the two sources are read for the three things a render test
 * would otherwise be the only witness to — that nothing is drawn while the
 * studio is writing, that the query is keyed on the ROLL's brief rather than
 * on the live box, and that the strip never appears during a standing follow.
 *
 * Each of those is a real regression this feature invites, not a hypothetical:
 * a skeleton row is the reflex fix for "it takes a few seconds", keying on the
 * box is one word's difference in the sheet, and the follow case is the one
 * his §17 already ruled on for the press beside it.
 */
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { chipsAsked, chipsShown } from "./components/BriefChips";

const sheetSource = () =>
  readFile(new URL("../../pages/CastingSheet.tsx", import.meta.url), "utf8");
const chipsSource = () =>
  readFile(new URL("./components/BriefChips.tsx", import.meta.url), "utf8");

describe("the policy", () => {
  it("spends nothing without a brief, and nothing when the strip is off", () => {
    expect(chipsAsked({ enabled: true, briefText: "an ogre chieftain" })).toBe(true);
    expect(chipsAsked({ enabled: true, briefText: "   " })).toBe(false);
    expect(chipsAsked({ enabled: false, briefText: "an ogre chieftain" })).toBe(false);
  });

  it("nothing to show is ONE answer — pinned brief, refusal and outage read alike", () => {
    expect(chipsShown({ enabled: true, chips: undefined })).toEqual([]);
    expect(chipsShown({ enabled: true, chips: [] })).toEqual([]);
    expect(chipsShown({ enabled: false, chips: ["weathered by a hard country"] })).toEqual([]);
    expect(chipsShown({ enabled: true, chips: ["weathered by a hard country", "  "] })).toEqual([
      "weathered by a hard country",
    ]);
  });
});

describe("the component", () => {
  it("draws nothing rather than a loading row", async () => {
    const code = (await chipsSource()).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).toContain("if (offered.length === 0) return null;");
    /* A skeleton, a spinner or an "isLoading" branch would each be a promise the empty case cannot keep. */
    expect(code).not.toContain("isLoading");
    expect(code).not.toContain("isPending");
    expect(code).not.toContain("skeleton");
  });

  it("a tap goes through the ONE author road, never a second write into the box", async () => {
    const code = (await chipsSource()).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).toContain("reimagine.tap(chip)");
    /* If this file ever writes the box itself, the fold has been bypassed and his ruling with it. */
    expect(code).not.toContain("onValue");
    expect(code).not.toContain("setDraft");
  });

  /*
    Driven before it was written: tapping the same chip twice folds the same
    direction in twice. It goes inert while its fold STANDS — tied to
    `canUndo`, so Undo or typing puts it back on offer — and it is dimmed
    rather than removed, because removing it reflows the row under a finger.
  */
  it("the chip already folded in goes inert while its fold stands", async () => {
    const code = (await chipsSource()).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).toContain("const inert = reimagine.pending || reimagine.written === chip;");
    expect(code).toContain("if (inert) return;");
    /* Dimmed, never filtered out of the row — removing it reflows under a finger. */
    expect(code).not.toContain(".filter((chip) => chip !==");
    /*
      ⚠ Read off the direction that is actually STANDING, never off a local
      optimistic flag gated on the shared undo slot (review of PR #601,
      finding 1): that shape dimmed a chip whose tap had FAILED, on the
      strength of an earlier press.
    */
    expect(code).not.toContain("canUndo");
    expect(code).not.toContain("useState");
  });

  it("the standing direction is set only by a tap that landed, and cleared by press, undo and typing", async () => {
    const code = (await readFile(new URL("./components/Reimagine.tsx", import.meta.url), "utf8"))
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    /* Inside the success branch, so a failed or "nothing" reply changes nothing. */
    const success = code.slice(code.indexOf('if (outcome.kind === "idea")'));
    expect(success.slice(0, 320)).toContain("setWritten(direction)");
    /* A press carries `direction === null`, so the same line clears it. */
    expect(code).toContain('const press = () => send(null, "idea");');
    /* And both ways back out clear it. */
    const undo = code.slice(code.indexOf("const undo = () =>"));
    expect(undo.slice(0, 260)).toContain("setWritten(null)");
    const typed = code.slice(code.indexOf("const typed = () =>"));
    expect(typed.slice(0, 260)).toContain("setWritten(null)");
  });
});

describe("the sheet", () => {
  it("keys the directions on the ROLL's brief, never on the live box", async () => {
    const code = (await sheetSource()).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const strip = code.slice(code.indexOf("<BriefChips"));
    expect(strip.slice(0, 200)).toContain("briefText={shownBrief}");
    /*
      `brief` is the live box (draft over the roll's text). Keying on it would
      fire a house text call on a keystroke and hand the customer a list that
      twitches while they type.
    */
    expect(strip.slice(0, 200)).not.toContain("briefText={brief}");
  });

  it("is off the house road and off during a standing follow (his §17)", async () => {
    const code = (await sheetSource()).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const at = code.indexOf("<BriefChips");
    expect(at).toBeGreaterThan(-1);
    const strip = code.slice(at, at + 200);
    expect(strip).toContain("enabled={standingFollowId === null}");
    /* Drawn inside the author-road branch, like the glyph it belongs to. */
    expect(code.slice(Math.max(0, at - 120), at)).toContain("authorRoad ?");
  });
});
