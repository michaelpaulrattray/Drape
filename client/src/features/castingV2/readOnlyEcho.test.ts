/**
 * THE READING SENTENCE IS READ-ONLY (#535 — his ruling, 2026-09-06, verbatim:
 * *"make the top sentence read-only with no pickers at all, and make the
 * prompt box the only place I edit"*).
 *
 * This replaces the §19 guard's question the way the ruling itself does: with
 * no control on the sentence, chips and box cannot disagree because only the
 * box can write.
 *
 * ⚠ **IT ASKS A STRICTLY STRONGER QUESTION THAN IT DID BEFORE #1444, AND THE
 * WEAKER ONE IS WHY.** His ruling used to be delivered as a POLICY — a
 * `VaryPolicy { authorRoad }` fed from `config.authorRoadEnabled` — so the
 * component held both a read-only branch and a full picker apparatus, and the
 * only thing this guard could ask was that the branch stood FIRST. That was a
 * true question about a file with two answers in it. Slice 3 of the old-lane
 * retirement removed the flag, and with it the road whose pickers those were,
 * so the honest question now is the absolute one: **the component contains no
 * control at all.** An ordering guard cannot fail on a file with nothing to
 * order; this one can, and does under sabotage.
 *
 * There is no render harness in this client (no jsdom), so it reads the
 * component's source — with a positive control, because a reader that silently
 * matched nothing would pass every absence assertion below for the wrong
 * reason.
 */
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const SOURCE = new URL("./components/BriefEcho.tsx", import.meta.url);

/** Comments quote the retired pickers by name on purpose — strip them before asking. */
async function componentCode(): Promise<string> {
  const source = await readFile(SOURCE, "utf8");
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("the reading sentence", () => {
  it("renders prose and nothing else — the positive control first", async () => {
    const code = await componentCode();
    /*
      THE POSITIVE CONTROL. Every other assertion in this file is an ABSENCE,
      and an absence over an empty string passes. These two are what the
      sentence is actually made of, so a reader that stopped reading the file
      reddens here rather than passing the whole suite silently.
    */
    expect(code, "the reader must have the component's code").toContain("function EchoSpanView");
    expect(code, "a span renders as prose").toContain("dpc-echo__role");
    expect(code, "connective text renders as prose").toContain("dpc-echo__prose");
  });

  it("carries no control: no picker, no button, no write channel", async () => {
    const code = await componentCode();
    expect(code, "no picker on the sentence — his read-only ruling").not.toContain("<Popover");
    expect(code, "no button on the sentence — his read-only ruling").not.toContain("<button");
    /*
      The write channel itself. `onAdjust` was the only way a control on this
      sentence ever reached the page, so its absence is the structural form of
      "only the box can write" — and it is the thing a future edit would have
      to add back before a picker could do anything.
    */
    expect(code, "the sentence has no way to write — only the box does").not.toContain("onAdjust");
  });

  it("exports no adjustability policy — there is no road with pickers to key on", async () => {
    const code = await componentCode();
    /*
      ⚠ The flag is gone (#1444) and so is the second road. A policy object
      reappearing here would mean the sentence had become conditional again,
      which is the shape his ruling removed.
    */
    expect(code).not.toContain("VaryPolicy");
    expect(code).not.toContain("factsHeld");
    expect(code).not.toContain("varyOffered");
  });
});
