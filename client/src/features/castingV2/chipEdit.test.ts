import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { BOX_EDITED_MARK, boxDiffersFromSheet } from "./chipEdit";

/**
 * ⚠ **HIS STATED MERGE CONDITION (Crew reply #134, 2026-09-05):** *"Chips and
 * box can never disagree, and the guard must prove that before it merges."*
 *
 * This suite used to prove it in two directions, because there were two
 * channels to the engine and the question was whether they could contradict
 * each other. **There is one channel now — `briefText`, the box — and this
 * asks the stronger question instead: that no second one exists.**
 *
 * ## What happened to the other direction, and why it is not a loss
 *
 * `chipEditOutcome` turned a chip click into new box text, and the arms below
 * drove it per field over the whole echo vocabulary. **The day after he wrote
 * the reply above he removed the chips** — *"make the top sentence read-only
 * with no pickers at all, and make the prompt box the only place I edit"* — so
 * nothing has been able to call it since that shipped. Slice 3 of the old-lane
 * retirement deleted it along with `rollAdjustments` and `pendingAdjustments`,
 * both of which decided what a QUEUED adjustment sends and shows.
 *
 * **What those arms proved is still proved, one layer up and structurally:**
 * `readOnlyEcho.test.ts` holds that the reading sentence carries no picker, no
 * button and no write channel, so there is no click to resolve; the wire arms
 * below read the page's own outgoing payloads. A rewriter with no caller is not
 * a covered behaviour, it is a dead export (invariant 7).
 *
 * ## The wire arms read the PAGE, not a helper
 *
 * Enforcement invariant 5: *a contract about what gets sent is proven on the
 * outgoing request, not on a constant near it.* The helper those arms used to
 * drive is gone, and a suite that replaced it with its own copy of the rule
 * would be asserting its own opinion. So they read `CastingSheet.tsx`'s two
 * mutation payloads — both of them, because the follow branch and the plain
 * roll each carried their own arm of this and drifting apart is exactly what
 * one owner was there to prevent.
 */

const HIS_BRIEF = "a fitness creator in their 30s, close-cropped hair";
const SHEET = join(process.cwd(), "client/src/pages/CastingSheet.tsx");

/** Prose quotes the retired channel by name on purpose — strip it before asking. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** The object literal handed to one of the sheet's paid mutations. */
function payloadAfter(sheet: string, call: string): string {
  const at = sheet.indexOf(call);
  expect(at, `${call} must be dispatched from the sheet`).toBeGreaterThan(-1);
  const from = sheet.indexOf("{", at);
  return sheet.slice(from, sheet.indexOf("options,", from));
}

describe("the box is the only channel to the engine", () => {
  describe("the wire — read at the sheet's own payloads", () => {
    const sheet = code(readFileSync(SHEET, "utf8"));

    it("positive control: both paid mutations are dispatched and both carry the box", () => {
      /*
        Every assertion below this is an ABSENCE, and an absence over a string
        that was never found passes. This is what stops the whole section going
        green on a page that stopped rolling altogether.
      */
      for (const call of ["createRoll.mutate(", "follow.mutate("]) {
        const payload = payloadAfter(sheet, call);
        expect(payload, `${call} sends the box`).toContain("briefText");
        expect(payload, `${call} sends the roll's own claim`).toContain("clientRequestId");
      }
    });

    it("neither mutation carries an adjustment channel beside the brief", () => {
      /*
        `overrides` and `unlock` were the house road's edit channel. The server
        still ACCEPTS both — removing a wire input is the unsafe direction and
        is its own act — so nothing but this arm stands between a future edit
        and a second statement of intent riding beside the sentence.
      */
      for (const call of ["createRoll.mutate(", "follow.mutate("]) {
        const payload = payloadAfter(sheet, call);
        expect(payload, `${call} sends no overrides`).not.toContain("overrides");
        expect(payload, `${call} sends no unlock`).not.toContain("unlock");
        expect(payload, `${call} spreads no adjustment helper`).not.toContain("rollAdjustments");
      }
    });

    it("and the page holds no store slice that could fill one", () => {
      /*
        The reader's half of the same rule. A payload with no adjustments and a
        page still holding the store is one edit away from carrying them again,
        and that edit would look like a fix rather than a regression.
      */
      expect(sheet, "the page no longer reads the store's overrides").not.toContain("setOverride");
      expect(sheet, "the page no longer reads the store's unlocks").not.toContain("unlock(");
      expect(sheet, "no chip click is resolved any more").not.toContain("chipEditOutcome");
    });
  });

  describe("the mark — the only note about a difference (his §16)", () => {
    it("is silent until the box leaves the sheet, and says so once it has", () => {
      expect(boxDiffersFromSheet(HIS_BRIEF, HIS_BRIEF)).toBe(false);
      expect(boxDiffersFromSheet(`${HIS_BRIEF} in a linen shirt`, HIS_BRIEF)).toBe(true);
    });

    it("whitespace alone is not an edit — it asks the draft's own question", () => {
      expect(boxDiffersFromSheet(`  ${HIS_BRIEF}  `, HIS_BRIEF)).toBe(false);
      expect(boxDiffersFromSheet(HIS_BRIEF.replace(", ", ",  "), HIS_BRIEF)).toBe(false);
    });

    it("is worded exactly as he wrote it", () => {
      expect(BOX_EDITED_MARK).toBe("edited below, not cast yet");
    });
  });

  /*
    THE RECORD SAYS NOTHING ELSE ABOUT A DIFFERENCE (his reply #134: "Drop
    'Changed on this roll'; I made the change, I don't need it repeated").

    Read at the page's source because the thing being asserted is an ABSENCE
    from a surface, and this suite runs in a node environment with no DOM.
  */
  describe("the sheet renders no second account of the change", () => {
    const sheet = readFileSync(SHEET, "utf8");

    it("carries no 'Changed on this roll' label and reads no briefChanges field", () => {
      expect(sheet).not.toContain("Changed on this roll<");
      expect(sheet).not.toContain(">Changed on this roll");
      expect(sheet).not.toContain("roll.data?.briefChanges");
      expect(sheet).not.toContain("dpc-prompt__changes");
    });

    it("positive control: the record and the mark it kept ARE both there", () => {
      /* Without this, the arm above passes on a file that lost the whole block. */
      expect(sheet).toContain("The brief this sheet was cast from");
      expect(sheet).toContain("BOX_EDITED_MARK");
    });
  });
});
