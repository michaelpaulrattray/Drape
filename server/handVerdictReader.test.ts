/**
 * THE VERDICT READER IS PINNED WHERE IT IS, AND THAT IS THE POINT (#1568).
 *
 * # It is the third member of #1559's family and the one that must NOT be
 * loosened
 *
 * #1559 repaired two readers of a card body that ordinary markdown defeated — a
 * `**RELEASED — …**` under a heading read as prose, so a released card still
 * looked claimed. Its sweep found a third reader with the same shape,
 * `shared/handVerdict.ts`'s `isHandVerdict`, anchored at the start of the whole
 * body after whitespace and nothing else. It was deliberately NOT fixed with
 * them, because **the failure direction is the opposite one and that changes the
 * answer.**
 *
 * | reader | a false NEGATIVE costs | a false POSITIVE costs |
 * |---|---|---|
 * | #1559's two | a released card reads as claimed; a seat's time | a card reads as free while a seat builds it |
 * | **this one** | **a reviewed pull request waits for another look** | **an UNREVIEWED money/auth pull request MERGES** |
 *
 * `scripts/lib/reviewRounds.mts`'s `classifyComment` reads it to decide whether
 * a verdict exists, and `scripts/pr-merge-in-order.mts` reads that. So widening
 * what counts as a verdict on the merge road is a decision about the review
 * gate, not a markdown repair — and his own ruling names the shape it would
 * have taken: *a new capability shipping under a cleanup's name.*
 *
 * # So this suite is a GUARD, not a fix
 *
 * It exists because the reader had **no arm driving it against a decorated body
 * in either direction**. `server/prMergeOrder.test.ts` pins the marker's
 * spelling and two accepting cases; nothing anywhere said what a `##` heading
 * above the marker does, or that the answer is *deliberate*. Without that, the
 * only symptom of a decorated verdict is a pull request that quietly does not
 * merge — and the next shift would hunt the gate, not the reader.
 *
 * ⚠ **IF YOU ARE HERE BECAUSE A VERDICT DID NOT REGISTER, READ THIS BEFORE
 * EDITING `isHandVerdict`.** The relay's own standing orders fix the form: the
 * verdict is a comment *headed* `**Fable review — by hand`. One writer, one
 * shape. Repost the comment with the marker first; that is one keystroke, and
 * loosening the merge gate is not.
 *
 * ⚠ **AND IF IT IS EVER WIDENED ANYWAY, TWO THINGS MUST TRAVEL WITH IT**, which
 * is the card's own recommendation and is pinned below rather than left in
 * prose: it goes through `shared/crewMarkdownLead.ts`'s `blockOpeningLines` —
 * the strict population, which already refuses a wrapped paragraph's
 * continuation line — and it keeps the AUTHOR GATE on both roads.
 */
import { describe, expect, it } from "vitest";

import { crewCardCommentFact } from "@shared/crewCardBuildState";
import { blockOpeningLines } from "@shared/crewMarkdownLead";
import { HAND_VERDICT_MARKER, isHandVerdict } from "@shared/handVerdict";

import { classifyComment, type PrIdentity } from "../scripts/lib/reviewRounds.mts";

/** The relay's account, and the pull request it is reviewing. */
const PR: PrIdentity = {
  number: 1568,
  headRefName: "team/example",
  createdAt: "2026-09-30T01:00:00Z",
  headCommittedAt: "2026-09-30T01:05:00Z",
  ownerLogin: "michaelpaulrattray",
};

const comment = (body: string, over: { author?: string; at?: string } = {}) => ({
  id: 1,
  authorLogin: over.author ?? PR.ownerLogin,
  createdAt: over.at ?? "2026-09-30T02:00:00Z",
  body,
});

/** The shape the standing orders describe, as the relay actually posts it. */
const REAL_VERDICT = `${HAND_VERDICT_MARKER}**\n\nPass. Two notes, neither blocking.`;

describe("what counts as the relay's hand verdict (#1568)", () => {
  it("accepts the form the standing orders fix, and the merge tool agrees", () => {
    expect(isHandVerdict(REAL_VERDICT)).toBe(true);
    expect(classifyComment(comment(REAL_VERDICT), PR)).toBe("verdict");

    /* Leading whitespace only — a paste that carried a blank first line. */
    expect(isHandVerdict(`  \n\n${REAL_VERDICT}`)).toBe(true);
    expect(classifyComment(comment(`  \n\n${REAL_VERDICT}`), PR)).toBe("verdict");
  });

  it("REFUSES a decorated marker, and this is the deliberate answer", () => {
    /*
      THE ARM THE CARD IS. Each of these is a verdict a human would call a
      verdict, and each one the reader refuses — on purpose, because the refusal
      holds a pull request and the alternative merges an unreviewed one.
      Recorded with the exact bodies so the next person who meets one knows the
      cheap repair is to repost, not to widen.
    */
    for (const body of [
      `## Review of PR #1234\n\n${REAL_VERDICT}`,
      `> ${REAL_VERDICT}`,
      `- ${REAL_VERDICT}`,
      `Sorry for the delay. ${REAL_VERDICT}`,
      `#1568\n${REAL_VERDICT}`,
    ]) {
      expect(isHandVerdict(body), `must NOT read as a verdict: ${JSON.stringify(body.slice(0, 40))}`).toBe(false);
      expect(classifyComment(comment(body), PR)).toBe("not-a-verdict");
    }
  });

  it("refuses a near-miss spelling too, which is the same safety in a smaller hat", () => {
    /* The marker carries an EM DASH. A hyphen, a lowercase f, a missing
       asterisk pair — each is a body that looks right to a person and is not the
       one string three readers agree on. */
    expect(isHandVerdict("**Fable review - by hand**")).toBe(false);
    expect(isHandVerdict("**fable review — by hand**")).toBe(false);
    expect(isHandVerdict("Fable review — by hand")).toBe(false);
    /* …and the marker itself is the one spelling, pinned here as well as in the
       merge-order suite because a guard about this string that could not see it
       change would be decoration. */
    expect(HAND_VERDICT_MARKER).toBe("**Fable review — by hand");
  });

  it("holds the AUTHOR GATE on BOTH roads — the half a widening must not drop", () => {
    /*
      ⚠ THE ARM THAT SURVIVES A FUTURE WIDENING. If somebody one day loosens the
      body test, the body alone must still not be enough on either road: a shift
      and the relay both run as accounts that can comment, and the tool cannot
      tell them apart by anything but the login. The standing orders say a shift
      NEVER posts that comment; this is the half a machine can check.
    */
    expect(classifyComment(comment(REAL_VERDICT, { author: "some-seat" }), PR)).toBe(
      "not-a-verdict",
    );

    /* The Desk's road, driven directly rather than through the page (law 3). */
    const fact = (author: string, owner: string) =>
      crewCardCommentFact({
        card: 1568,
        body: REAL_VERDICT,
        createdAt: "2026-09-30T02:00:00Z",
        authorLogin: author,
        ownerLogin: owner,
      });
    expect(fact(PR.ownerLogin, PR.ownerLogin)?.kind).toBe("verdict");
    expect(fact("some-seat", PR.ownerLogin)).toBeNull();
    /* A caller that cannot supply the two logins reports NO verdict rather than
       believing a body — the module's own sentence, driven. */
    expect(fact(PR.ownerLogin, "")).toBeNull();
  });

  it("a stale verdict is still a verdict body — the two refusals are not the same refusal", () => {
    /*
      Told apart on purpose: `not-a-verdict` means nobody reviewed this, and
      `stale-verdict` means somebody did and then the head moved. A guard that
      collapsed them would let a loosened reader hide behind the friendlier word.
    */
    expect(classifyComment(comment(REAL_VERDICT, { at: "2026-09-30T01:02:00Z" }), PR)).toBe(
      "stale-verdict",
    );
    expect(
      classifyComment(comment(`## Heading\n\n${REAL_VERDICT}`, { at: "2026-09-30T01:02:00Z" }), PR),
    ).toBe("not-a-verdict");
  });

  it("names the population a widening would have to use, and shows it already refuses the trap", () => {
    /*
      NOT a promise that the reader will be widened — it should not be. This is
      the card's second recommendation made checkable: IF it ever is, the strict
      population is `blockOpeningLines`, and the reason is that a hard-wrapped
      paragraph can put the marker at the start of its own second line, where it
      is prose rather than a heading. Anchoring on "any line that starts with the
      marker" would accept that; this population does not.
    */
    const headed = `## Review of PR #1234\n\n${REAL_VERDICT}`;
    expect(blockOpeningLines(headed).some((line) => line.startsWith(HAND_VERDICT_MARKER))).toBe(
      true,
    );

    const wrapped = `I read the diff and I am happy with it, so here is the\n${HAND_VERDICT_MARKER}** verdict I owe you.`;
    expect(blockOpeningLines(wrapped).some((line) => line.startsWith(HAND_VERDICT_MARKER))).toBe(
      false,
    );
    /* And the naive alternative — any line at all — accepts exactly that trap,
       which is why it is written down beside the safe one. */
    expect(
      wrapped.split("\n").some((line) => line.trimStart().startsWith(HAND_VERDICT_MARKER)),
    ).toBe(true);
  });

  it("CAN FAIL — the reader is real, not a stub that answers false", () => {
    /*
      THE POSITIVE CONTROL (working law 2). Most arms above assert `false`, and
      `false` is also what a reader that had stopped working would return — an
      `isHandVerdict` replaced by `() => false` passes every refusal arm in this
      file and would hold every pull request in the queue for ever. The accepting
      arms are that control, and this one states it: the two answers are
      genuinely different for the same reader.
    */
    expect(isHandVerdict(REAL_VERDICT)).toBe(true);
    expect(isHandVerdict(`## Heading\n\n${REAL_VERDICT}`)).toBe(false);
    expect(isHandVerdict("")).toBe(false);
  });
});
