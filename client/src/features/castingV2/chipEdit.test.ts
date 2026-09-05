import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { rewriteBrief } from "@shared/briefRewrite";
import {
  BOX_EDITED_MARK,
  boxDiffersFromSheet,
  chipEditOutcome,
  pendingAdjustments,
  rollAdjustments,
} from "./chipEdit";

/**
 * ⚠ **HIS STATED MERGE CONDITION (#534, Crew reply #134, 2026-09-05):**
 * *"Chips and box can never disagree, and the guard must prove that before it
 * merges."*
 *
 * A guard that reads one way does not meet it, so this drives BOTH directions.
 * The two are different KINDS of claim and only one of them is about a value:
 *
 *   **Chip → box.** A chip edit's fact is in the box afterwards, stated in the
 *   box's own words. Driven per field over the whole echo vocabulary, so no
 *   field is covered by luck.
 *
 *   **Box → wire.** After a hand edit of the box there is no second channel
 *   left that could carry the old fact. This is the direction the first build
 *   of this card failed on and the one his frame caught: the record said
 *   "CHANGED ON THIS ROLL · Age — 40s" while the dock still read "in their
 *   30s", because the chip edit was a STORE beside the box rather than a write
 *   into it. It is asserted as an ABSENCE at the outgoing payload (enforcement
 *   invariant 5) rather than as agreement between two values, because a wire
 *   with one channel on it cannot disagree with itself.
 *
 * The house road is asserted UNCHANGED beside both, because it is the arm that
 * would otherwise be broken silently: an account off the author road composes
 * per-candidate prose from the intent, and its overrides must still ride.
 */

const HIS_BRIEF = "a fitness creator in their 30s, close-cropped hair";

/**
 * Every field the echo offers a picker for, with the box his brief produces.
 *
 * The wording is PINNED rather than searched for a substring, and that is the
 * point of the table: the value a chip carries is a vocabulary key, and the
 * word the box says is English ("male" lands as "Cast a man."). A `contains`
 * assertion over the key passes on a box that never mentions the fact — the
 * first draft of this arm did exactly that and reported the sex chip broken.
 */
const CHIP_LANDS_AS = [
  { field: "sex", value: "male", box: `${HIS_BRIEF}. Cast a man.` },
  { field: "ageBand", value: "40s", box: "a fitness creator in their 40s, close-cropped hair" },
  { field: "heritage", value: "Nordic", box: `${HIS_BRIEF}. Of Nordic heritage.` },
  { field: "build", value: "athletic", box: `${HIS_BRIEF}. Athletic build.` },
  { field: "energy", value: "warm", box: `${HIS_BRIEF}. A warm, unhurried presence.` },
  { field: "look", value: "quiet luxury", box: `${HIS_BRIEF}. A quiet luxury look.` },
] as const;

/** A brief that STATES every one of those facts, so each edit replaces rather than appends. */
const STATED = "a Nordic woman in her 30s with an athletic build, a severe minimal look";

/* The card is #534 — named in the docblock above rather than in this title,
   because the foundation's token guard reads a `#534` in CODE as a hex literal
   and its own message says to move the reference into a comment. */
describe("a chip edit writes into the box, and the box is the only channel", () => {
  describe("direction 1 — chip to box", () => {
    it("his own frame: the age chip rewrites the sentence, and 30s is nowhere in it", () => {
      const outcome = chipEditOutcome({ authorRoad: true, brief: HIS_BRIEF, field: "ageBand", value: "40s" });
      expect(outcome.kind).toBe("box");
      const text = outcome.kind === "box" ? outcome.text : "";
      expect(text).toBe("a fitness creator in their 40s, close-cropped hair");
      /* The defect his frame showed was the OLD value surviving beside the new one. */
      expect(text).not.toContain("30s");
    });

    it("every field the echo offers lands in the box — none of them by luck", () => {
      for (const { field, value, box } of CHIP_LANDS_AS) {
        const outcome = chipEditOutcome({ authorRoad: true, brief: HIS_BRIEF, field, value });
        expect(outcome.kind, field).toBe("box");
        expect(outcome.kind === "box" ? outcome.text : null, field).toBe(box);
      }
    });

    it("where the brief STATES the fact, the edit replaces it and the old value is gone", () => {
      /*
        The append path leaves the brief's own wording standing beside a new
        sentence (a declared limit of `rewriteBrief`). The replace path is the
        one his frame was about — the old value surviving is precisely the
        disagreement — so it gets its own table over a brief that states
        everything.
      */
      const replaced = [
        { field: "sex", value: "male", box: "a Nordic man in his 30s with an athletic build, a severe minimal look", gone: "woman" },
        { field: "ageBand", value: "40s", box: "a Nordic woman in her 40s with an athletic build, a severe minimal look", gone: "30s" },
        { field: "heritage", value: "Slavic", box: "a Slavic woman in her 30s with an athletic build, a severe minimal look", gone: "Nordic" },
        { field: "build", value: "heavy", box: "a Nordic woman in her 30s with a heavy build, a severe minimal look", gone: "athletic" },
        { field: "look", value: "quiet luxury", box: "a Nordic woman in her 30s with an athletic build, a quiet luxury look", gone: "severe minimal" },
      ] as const;
      for (const { field, value, box, gone } of replaced) {
        const outcome = chipEditOutcome({ authorRoad: true, brief: STATED, field, value });
        const text = outcome.kind === "box" ? outcome.text : "";
        expect(text, field).toBe(box);
        expect(text, `${field}: the old value must not survive`).not.toContain(gone);
      }
    });

    it("a second edit compounds on the first rather than reverting it", () => {
      const first = chipEditOutcome({ authorRoad: true, brief: HIS_BRIEF, field: "ageBand", value: "40s" });
      const box = first.kind === "box" ? first.text : "";
      const second = chipEditOutcome({ authorRoad: true, brief: box, field: "sex", value: "male" });
      const text = second.kind === "box" ? second.text : "";
      /* Both edits stand — the box is the running brief, not a one-shot render of one chip. */
      expect(text).toContain("40s");
      expect(text.toLowerCase()).toContain("man");
      expect(text).not.toContain("30s");
    });

    it("re-picking the value the brief already states leaves the box byte-identical", () => {
      const outcome = chipEditOutcome({ authorRoad: true, brief: HIS_BRIEF, field: "ageBand", value: "30s" });
      /* Not a claim about the outcome's shape — a claim that nothing was corrupted. */
      const text = outcome.kind === "box" ? outcome.text : HIS_BRIEF;
      expect(text).toBe(HIS_BRIEF);
    });

    it("agePhase is the seventh EchoField and no picker can fire it — pinned, because if one ever does the click is eaten", () => {
      /*
        Round 2 of the review, informational finding: the table above covers
        six of `EchoField`'s seven. `writersOf` has no agePhase-only writer
        (the phase rides the ageBand edit), so on the author road the outcome
        is `none` — no box change, no store, no feedback — while the same
        click off that road becomes a live override.

        It is DORMANT, not live: `briefEcho.ts`'s span builder folds the phase
        into the ageBand span's text and never emits `field: "agePhase"`, so
        nothing can reach it today. But the vocabulary, the heading and the
        popover machinery all exist for it, and `none` had no coverage at all.
        This arm states the current contract so the day a span emits agePhase
        the difference is a failing test rather than a click that does nothing.
      */
      expect(chipEditOutcome({ authorRoad: true, brief: HIS_BRIEF, field: "agePhase", value: "late" }))
        .toEqual({ kind: "none" });
      /* And off the author road the same click is a live override — the asymmetry, stated. */
      expect(chipEditOutcome({ authorRoad: false, brief: HIS_BRIEF, field: "agePhase", value: "late" }))
        .toEqual({ kind: "override", field: "agePhase", value: "late" });
    });

    it("the client runs the SAME rewriter the compiler ran, not a second copy of it", () => {
      /*
        Working law 4. If this ever stops being true, a chip edit shows the
        customer one sentence and sends the engine another — the exact defect,
        moved one layer down.
      */
      const outcome = chipEditOutcome({ authorRoad: true, brief: HIS_BRIEF, field: "heritage", value: "Nordic" });
      const direct = rewriteBrief(HIS_BRIEF, { heritage: "Nordic" });
      expect(outcome.kind === "box" ? outcome.text : null).toBe(direct?.text ?? null);
    });
  });

  describe("direction 2 — box to wire: nothing else can carry a fact", () => {
    it("on the author road a roll sends NO adjustments, whatever is in the store", () => {
      /*
        The store can be non-empty for real reasons — a sheet cast on the house
        road, then the flag flipped; a stale slice from before this change
        deployed. His condition has to hold in that state too, so the arm feeds
        it a FULL store rather than an empty one.
      */
      const payload = rollAdjustments({
        authorRoad: true,
        unlocked: ["ageBand", "sex"],
        overrides: { ageBand: "40s", sex: "female" },
      });
      expect(payload).toEqual({});
      expect(Object.keys(payload)).toHaveLength(0);
    });

    it("positive control: off the author road the same store DOES ride — so the arm above is not vacuous", () => {
      const payload = rollAdjustments({
        authorRoad: false,
        unlocked: ["ageBand", "sex"],
        overrides: { ageBand: "40s", sex: "female" },
      });
      expect(payload.unlock).toEqual(["ageBand", "sex"]);
      expect(payload.overrides).toEqual({ ageBand: "40s", sex: "female" });
    });

    it("and the ECHO cannot promise more than the wire carries — the same stale store draws no arrow (review finding 1)", () => {
      /*
        The display half of the same class. A store CAN be non-empty on the
        author road (a chip queued on the house road, then the flag widened
        while the tab was open), and the echo used to read it directly — so it
        drew "30s → 40s · next roll" over a roll that sends nothing. Derived
        from `rollAdjustments` now, so the two cannot come apart again.
      */
      const pending = pendingAdjustments({
        authorRoad: true,
        unlocked: ["ageBand", "sex"],
        overrides: { ageBand: "40s", sex: "female" },
      });
      expect(pending).toEqual({ overrides: {}, unlocked: [] });
    });

    it("positive control: off the author road the echo still draws the queued change", () => {
      const pending = pendingAdjustments({
        authorRoad: false,
        unlocked: ["ageBand"],
        overrides: { ageBand: "40s" },
      });
      expect(pending).toEqual({ overrides: { ageBand: "40s" }, unlocked: ["ageBand"] });
    });

    it("off the author road an empty store still sends nothing — undefined, not an empty object", () => {
      const payload = rollAdjustments({ authorRoad: false, unlocked: [], overrides: {} });
      expect(payload.unlock).toBeUndefined();
      expect(payload.overrides).toBeUndefined();
    });

    it("a chip edit off the author road stays a store and does NOT touch the box", () => {
      /*
        The mirror of the whole card: on the house road the engine never reads
        these facts out of the brief text, so rewriting the box would change
        what the customer reads and nothing that is sent — the same
        disagreement, pointing the other way.
      */
      const outcome = chipEditOutcome({ authorRoad: false, brief: HIS_BRIEF, field: "ageBand", value: "40s" });
      expect(outcome).toEqual({ kind: "override", field: "ageBand", value: "40s" });
    });
  });

  describe("the mark — the only note about a difference (his §16)", () => {
    it("is silent until the box leaves the sheet, and says so once it has", () => {
      expect(boxDiffersFromSheet(HIS_BRIEF, HIS_BRIEF)).toBe(false);
      const edited = chipEditOutcome({ authorRoad: true, brief: HIS_BRIEF, field: "ageBand", value: "40s" });
      expect(boxDiffersFromSheet(edited.kind === "box" ? edited.text : "", HIS_BRIEF)).toBe(true);
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
    from a surface, and this suite runs in a node environment with no DOM. It
    is deliberately the weaker half of the guard — the two behavioural
    directions above are the strong half, and his eye on the sheet closes the
    card either way.
  */
  describe("the sheet renders no second account of the change", () => {
    const sheet = readFileSync(join(process.cwd(), "client/src/pages/CastingSheet.tsx"), "utf8");

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
