/**
 * THE RULEBOOK AND THE BRIEFING NAME THE SAME FOCUS RUNG (#1860).
 *
 * # The repeat
 *
 * Three cards in two weeks, one symptom — *the seat gate silently held
 * buildable work and nobody found out from the gate*:
 *
 * | card | how the gate's input went wrong | how it was found |
 * |---|---|---|
 * | **#1496** | every rung card held for the focus lane; four seats idle | **his question** |
 * | **#1541** | the milestone read off the top card's rung; a rungless card nulled it | a shift reading the number |
 * | **#1840** | **his word reached `PROGRAM.md` and not the briefing** | a seat finding nothing to take |
 *
 * **#1840's own body names itself the third instance.** Its repair was a
 * SENTENCE in `PROGRAM.md` — *"a focus recorded anywhere but `program.ladder` is
 * a focus no seat can act on, and the two move in ONE commit"* — and run 5's
 * closing objection applies to it: **a paragraph in the orders has no reader
 * that can fail.**
 *
 * `server/seatBatches.test.ts`'s pin holds the briefing against ITSELF (exactly
 * one `current` rung, and which one). **It cannot see the rulebook**, so a
 * briefing left on `P1` while `PROGRAM.md` declared `P2` was green — which is
 * precisely what shipped.
 *
 * # ⚠ THE PREMISE THE CARD TOLD ME TO CONFIRM, AND IT CAME BACK FALSE
 *
 * The card said: *"It must not fire during a legitimate flip: the two move in
 * one commit, so a tree mid-flip is not a state the suite ever sees — confirm
 * that at the #1840 commit rather than reasoning about it."*
 *
 * **Confirmed at the commits, and the premise does not hold.** Over
 * `PROGRAM.md`'s whole tracked history — 16 commits since `16e3706f5` put it in
 * the tree — exactly **one** commit has ever touched both files: `a9846fe6a`,
 * the N2 → P1 flip. The P1 → P2 flip took **two**: `91749d2b9` moved the
 * rulebook (`.agents/foreman/PROGRAM.md` alone, 3 insertions) and `fa7f133ff`
 * moved the briefing (`crew-briefing.json` + `seatBatches.test.ts`, no
 * `PROGRAM.md`). **So the rule #1840 wrote was not honoured by #1840's own
 * repair, and the hours between those two commits are the state this arm would
 * have reddened in.**
 *
 * That is the feature, not a reason to soften the arm: those are exactly the
 * hours his four ordered cards were unbuildable. What it does mean is that the
 * next flip WILL redden if its two halves land in two commits — so the failure
 * message names the repair (*move the other half in this commit*) rather than
 * only reporting a mismatch.
 *
 * # ⚠ ITS REACH, MEASURED, BECAUSE AN OVERSTATED GUARD IS THIS TEAM'S OLD SIN
 *
 * This arm runs in `pnpm test`, in `pnpm preflight` and at the PR gate. **It
 * does NOT run on the road `91749d2b9` actually took.** Read at the artifacts:
 * `gate.yml` triggers on `pull_request` only, that commit carries no pull
 * request number, and `scripts/deploy-rite.mts` deliberately does not run
 * `pnpm test` — its own words, on the founder's time ruling: *"`pnpm test` is
 * still not here."* The rite runs `pnpm check`, both atlases, the capability
 * check and the derived script guards, and none of them can see this.
 *
 * So what this arm guarantees is narrower than *"the two can never disagree"*:
 * **no pull request can merge while they disagree, and no shift can run the
 * suite without being told.** A rulebook-only commit riding the rite still
 * reaches `main` unchecked, and the first PR afterwards is where it surfaces —
 * hours earlier than *a seat finding nothing to take*, which is how #1840 was
 * found, and not as early as the commit itself. **Closing that last gap means a
 * step in the rite or a reading in the cut, and both are their own card.**
 *
 * # ⚠ AND THE READER REFUSES RATHER THAN GUESSING
 *
 * `PROGRAM.md` holds more than one `CURRENT FOCUS` line and **both carry `✅`**,
 * so the marker decides nothing. The reader believes one shape — the heading
 * his flips actually use, `CURRENT FOCUS: <rung> —` — and answers `ambiguous`
 * or `absent` otherwise, which this suite turns into a RED naming which way it
 * went. A reader that quietly picked one of two would hand the gate the same
 * silence #1840 was.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { focusRungFromLadder } from "../scripts/lib/seatBatches.mts";
import {
  focusDisagreementMessage,
  focusRungFromRulebook,
} from "../scripts/lib/focusRungFromRulebook.mts";

const REPO = join(__dirname, "..");
const RULEBOOK = ".agents/foreman/PROGRAM.md";
const BRIEFING = "server/crew/crew-briefing.json";
const read = (relative: string) => readFileSync(join(REPO, relative), "utf8");

describe("the reader: a declaration, never a mention", () => {
  it("reads the shape his flips actually use", () => {
    const out = focusRungFromRulebook("intro\n> ✅ **CURRENT FOCUS: P2 — PRICING, PHASE 2** blah\ntail");
    expect(out).toEqual({ kind: "rung", rung: "P2", line: 2 });
  });

  it("⚠ THE KEPT-HISTORY SHAPE IS NOT A DECLARATION — the real `:288` line, verbatim", () => {
    /* `> ✅ **N2 IS THE CURRENT FOCUS — HIS WORD, 2026-09-23 (terminal), the same`
       is live in the rulebook today as kept history. It carries the SAME `✅`
       marker as the live line, so the marker cannot discriminate; the shape
       can, because it puts the rung first and takes no colon. */
    const kept = "> ✅ **N2 IS THE CURRENT FOCUS — HIS WORD, 2026-09-23 (terminal), the same";
    expect(focusRungFromRulebook(kept)).toEqual({ kind: "absent", mentions: 1 });
  });

  it("every dash flavour, because the file is hand-written prose", () => {
    for (const dash of ["—", "–", "-"]) {
      expect(focusRungFromRulebook(`**CURRENT FOCUS: N2b ${dash} whatever**`))
        .toMatchObject({ kind: "rung", rung: "N2b" });
    }
  });

  it("⚠ TWO DECLARATIONS IS A REFUSAL, never a pick — and it says which lines", () => {
    const two = "**CURRENT FOCUS: P2 — a**\nfiller\n**CURRENT FOCUS: N2b — b**";
    expect(focusRungFromRulebook(two)).toEqual({ kind: "ambiguous", rungs: ["P2", "N2b"], lines: [1, 3] });
  });

  it("⚠ NO DECLARATION IS A REFUSAL TOO, and it counts the mentions so the red can say so", () => {
    expect(focusRungFromRulebook("nothing here")).toEqual({ kind: "absent", mentions: 0 });
    /* The nastiest case: the phrase is all over the file and the shape is gone
       — a reader answering `null` here would read as "he has named no focus",
       which the seat gate treats as hold-everything. */
    expect(focusRungFromRulebook("CURRENT FOCUS is now P2\nand CURRENT FOCUS stays"))
      .toEqual({ kind: "absent", mentions: 2 });
  });

  it("a rung token must start with a letter and carry no punctuation", () => {
    expect(focusRungFromRulebook("**CURRENT FOCUS: 2 — x**")).toMatchObject({ kind: "absent" });
    expect(focusRungFromRulebook("**CURRENT FOCUS: — x**")).toMatchObject({ kind: "absent" });
    /* A dotted token is not a rung this product has ever had, and the dash
       must follow the token — so it refuses rather than silently reading `P2`. */
    expect(focusRungFromRulebook("**CURRENT FOCUS: P2.1 — x**")).toMatchObject({ kind: "absent" });
  });

  it("the `g` regex does not skip a line because the previous one matched", () => {
    /* A module-level `/g` regex carries `lastIndex` between calls, and a loop
       reusing one silently drops every other match. Three in a row must all be
       seen, or the ambiguity refusal could go quiet exactly when it matters. */
    const three = "**CURRENT FOCUS: A — x**\n**CURRENT FOCUS: B — x**\n**CURRENT FOCUS: C — x**";
    expect(focusRungFromRulebook(three)).toEqual({ kind: "ambiguous", rungs: ["A", "B", "C"], lines: [1, 2, 3] });
  });
});

describe("the message a disagreement prints", () => {
  it("names both values, both files, and the repair", () => {
    const text = focusDisagreementMessage({ rulebookRung: "P2", rulebookLine: 155, ladderRung: "P1" });
    expect(text).toContain("PROGRAM.md:155");
    expect(text).toContain("CURRENT FOCUS: P2");
    expect(text).toContain("P1");
    expect(text).toContain("crew-briefing.json");
    expect(text).toContain("rung:P2");
    /* The repair, for the shift that is mid-flip and reading this. */
    expect(text).toContain("move the other half in THIS commit");
  });

  it("a ladder naming NO rung reads as that, never as a rung called null", () => {
    const text = focusDisagreementMessage({ rulebookRung: "P2", rulebookLine: 155, ladderRung: null });
    expect(text).toContain("NO rung");
    expect(text).not.toContain("null");
    /* ⚠ And it must not invent a stale rung it does not have. */
    expect(text).not.toContain("on a stale");
  });
});

describe("⚠ THE DERIVED ARM — the two real artifacts, held equal", () => {
  /**
   * The reading, as ONE function, so the arm and its controls run the same one.
   *
   * It takes both texts rather than reading the files itself, which is what
   * lets the sabotage controls below drive the disagreeing state without
   * touching either file on disk.
   */
  const agree = (rulebook: string, briefingJson: string): { ok: boolean; why: string } => {
    const declared = focusRungFromRulebook(rulebook);
    if (declared.kind === "ambiguous") {
      return {
        ok: false,
        why: `${RULEBOOK} declares ${declared.rungs.length} focus rungs `
          + `(${declared.rungs.join(", ")} at lines ${declared.lines.join(", ")}). `
          + "One of them is live and this reader will not guess which — strike the superseded "
          + "heading's `CURRENT FOCUS:` shape, the way the `:288` kept-history line already reads.",
      };
    }
    if (declared.kind === "absent") {
      return {
        ok: false,
        why: `${RULEBOOK} declares no focus rung in the shape this reader believes `
          + `(\`CURRENT FOCUS: <rung> —\`), though the phrase appears ${declared.mentions} time(s). `
          + "Both tracked flips used that shape (`a9846fe6a`, `91749d2b9`). If the heading has "
          + "genuinely moved on, change this reader in the same commit — do not delete the arm.",
      };
    }
    let ladderRung: string | null;
    try {
      const briefing = JSON.parse(briefingJson) as { program?: { ladder?: readonly unknown[] } };
      ladderRung = focusRungFromLadder(
        briefing.program?.ladder as readonly { key?: unknown; state?: unknown }[] | undefined,
      );
    } catch (cause) {
      return { ok: false, why: `${BRIEFING} could not be parsed: ${(cause as Error).message}` };
    }
    if (ladderRung === declared.rung) return { ok: true, why: "" };
    return {
      ok: false,
      why: focusDisagreementMessage({
        rulebookRung: declared.rung,
        rulebookLine: declared.line,
        ladderRung,
      }),
    };
  };

  it("the rulebook is in the tree, so this arm can run at the gate at all", () => {
    /* ⚠ `.agents/` is gitignored BUT FOR THIS FILE — `.gitignore` carries
       `!.agents/foreman/PROGRAM.md` (#1468, 2026-09-29), which is the only
       reason a repository suite can read the rulebook. If that exclusion is
       ever removed, THIS is the arm to change, in the same commit — an
       unreadable rulebook must never read as agreement. */
    const ignore = read(".gitignore");
    expect(ignore, "the rulebook must stay un-ignored or this arm has nothing to read")
      .toContain("!.agents/foreman/PROGRAM.md");
    expect(read(RULEBOOK).length).toBeGreaterThan(1000);
  });

  it("THE RULEBOOK AND THE BRIEFING NAME THE SAME RUNG", () => {
    const verdict = agree(read(RULEBOOK), read(BRIEFING));
    expect(verdict.ok, verdict.why).toBe(true);
  });

  it("and the rung they agree on is the one the seat gate acts on", () => {
    /* The value, not only the agreement — so a reader of this file sees which
       rung is open tonight, the way `seatBatches.test.ts`'s pin does.

       ⚠ THIS PIN MOVES ONLY ON HIS WORD. P1 → P2 on 2026-10-03, verbatim
       (terminal): *"phase 2 gets built next not n2b"*. The next flip is
       P2 → N2b, on P2's completion card and his word — and when it happens,
       BOTH files move, which is what the arm above now enforces. */
    const declared = focusRungFromRulebook(read(RULEBOOK));
    expect(declared).toMatchObject({ kind: "rung", rung: "P2" });
  });

  it("⚠ PROVEN ABLE TO FAIL — the ladder sabotaged back to P1 with the rulebook on P2", () => {
    /*
      #1840's exact state, driven: the briefing left behind while his word has
      reached the rulebook. The card asks for this one by name.

      The sabotage is on a COPY of the real briefing's text, not a fixture, so
      the arm it drives is the arm above and not a lookalike.
    */
    const rulebook = read(RULEBOOK);
    const real = read(BRIEFING);
    /* ⚠ ANCHORED ON THE FILE'S REAL FORMATTING — the ladder is pretty-printed
       one field per line, so a one-line anchor matches nothing and the control
       goes inert. The assertion below is what catches that, and it did. */
    const stale = real.replace('"key": "P2",', '"key": "P2x",');
    expect(stale, "the doctored copy must differ, or this control proves nothing").not.toBe(real);
    /* P1 is `done` and P2 is now `P2x`, so the ladder's one `current` rung is
       `P2x` — a rung the rulebook does not declare. */
    const verdict = agree(rulebook, stale);
    expect(verdict.ok, "a disagreeing pair MUST fail, or the arm above is decoration").toBe(false);
    expect(verdict.why).toContain("TWO SOURCES OF TRUTH");
    expect(verdict.why).toContain("P2x");
  });

  it("⚠ PROVEN ABLE TO FAIL — a ladder with NO current rung, which is #1541's shape", () => {
    const stale = read(BRIEFING).replace('"state": "current"', '"state": "queued"');
    const verdict = agree(read(RULEBOOK), stale);
    expect(verdict.ok).toBe(false);
    expect(verdict.why).toContain("NO rung");
  });

  it("⚠ PROVEN ABLE TO FAIL — a rulebook whose declaration has gone, or doubled", () => {
    const real = read(RULEBOOK);
    /* The live heading struck out entirely. */
    const gone = real.replace(/CURRENT FOCUS: ([A-Za-z][A-Za-z0-9]*)\s*—/, "CURRENT FOCUS was $1 —");
    expect(gone, "the doctored copy must differ").not.toBe(real);
    const goneVerdict = agree(gone, read(BRIEFING));
    expect(goneVerdict.ok).toBe(false);
    expect(goneVerdict.why).toContain("no focus rung");
    /* A superseded heading left in the live shape — the trap the card names. */
    const doubled = `${real}\n\n> ✅ **CURRENT FOCUS: N2b — a heading nobody struck**`;
    const doubledVerdict = agree(doubled, read(BRIEFING));
    expect(doubledVerdict.ok, "two live-shaped headings must refuse, not resolve").toBe(false);
    expect(doubledVerdict.why).toContain("will not guess");
  });

  it("an unparseable briefing fails rather than passing for want of a value", () => {
    const verdict = agree(read(RULEBOOK), "{ not json");
    expect(verdict.ok).toBe(false);
    expect(verdict.why).toContain("could not be parsed");
  });

  it("NEGATIVE CONTROL — an agreeing pair passes, so the arm is not simply always red", () => {
    const verdict = agree(
      "**CURRENT FOCUS: N7 — something**",
      JSON.stringify({ program: { ladder: [{ key: "N7", state: "current" }] } }),
    );
    expect(verdict.ok, verdict.why).toBe(true);
  });
});
