/**
 * THE REPLY READER CAN SEE BOTH HALVES OF THE NAMESPACE, AND SAYS WHEN HIS
 * PAGE IS STILL SHOWING AN ANSWERED ITEM AS OPEN (shift 96, 2026-08-29).
 *
 * The incident is his own, verbatim on the relay: *"the desk still shows items
 * he has already answered (concept-cast-it-196, concept-review-modal, both
 * answered by replies #23/#24/#25 on 08-28, still 'open' on edition 98)."*
 *
 * Measured at the artifact before a line was written: **20 of his 28 replies
 * printed "(not in the current briefing)", the 17 distinct ids under it were
 * ALL in the briefing's `eyeItems`, and 0 were genuinely absent** — because
 * the reader's index was built from `needsYou` alone while
 * `crewBriefingSchema` states the namespace is the union of both and refuses a
 * collision across them (working law 4).
 *
 * The first arm below is that exact shape, so the fixture COULD produce the
 * wrong answer — it did, for the whole life of the Crew tab. The rest are the
 * controls that stop the sweep from being green for the wrong reason: an
 * unacknowledged reply must NOT be swept (the default read already prints it
 * in full), an answered item must NOT be swept, and an id no edition carries
 * must stay out of the list entirely rather than quietly widening it.
 */
import { describe, expect, it } from "vitest";

import type { BriefingFacts } from "../scripts/lib/liveBriefing.mts";
import { hostIndex, staleOpenHosts, type ReplyRow } from "../scripts/lib/replyHosts.mts";
import { testDriveCardId } from "../shared/crewTestDrive";

/**
 * Edition 99 as it actually stood, cut to the ids this judgement turns on:
 * one needs-you card, and the two eye items he answered on 08-28.
 */
const EDITION_99: BriefingFacts = {
  edition: 99,
  acknowledgedReplyIds: [23, 24, 25, 28],
  needsYou: [
    { id: "fable-cap-review-arm-219", title: "Your Claude usage limit is still out", state: "open" },
    { id: "cyborg-eye-piece-185", title: "Is a machine part fitted to a cyborg's face…", state: "answered" },
  ],
  eyeItems: [
    { id: "concept-cast-it-196", title: "Upload a concept now casts from the modal", state: "open" },
    { id: "concept-review-modal", title: "Upload a concept now opens a review", state: "open" },
    { id: "portrait-crop-198", title: "ANSWERED — you said top crop on both", state: "answered" },
  ],
};

/** The rows his replies actually carry: #23/#24 on one item, #25 on the other. */
const REPLIES: ReplyRow[] = [
  { id: 23, cardId: "concept-cast-it-196" },
  { id: 24, cardId: "concept-cast-it-196" },
  { id: 25, cardId: "concept-review-modal" },
  { id: 27, cardId: "portrait-crop-198" },
  { id: 28, cardId: "cyborg-eye-piece-185" },
];

describe("hostIndex", () => {
  it("the incident: an eye item is FOUND, where the needsYou-only index called it absent", () => {
    const index = hostIndex(EDITION_99);
    const host = index.get("concept-cast-it-196");
    expect(host).toBeDefined();
    expect(host!.kind).toBe("eye item");
    expect(host!.state).toBe("open");
  });

  it("carries both halves of the namespace, and names which half each id came from", () => {
    const index = hostIndex(EDITION_99);
    /* Five slugs; none of edition 99's rows carries an issue number, so no
       derived `card-<n>` key joins them. */
    expect(index.size).toBe(5);
    expect(index.get("fable-cap-review-arm-219")!.kind).toBe("card");
    expect(index.get("portrait-crop-198")!.kind).toBe("eye item");
  });

  it("an id no edition carries stays absent — the honest 'not in the current briefing'", () => {
    expect(hostIndex(EDITION_99).get("some-retired-card")).toBeUndefined();
  });

  it("a briefing that could not be read at all is an empty index, never a throw", () => {
    expect(hostIndex(null).size).toBe(0);
  });
});

describe("staleOpenHosts", () => {
  it("the incident: BOTH items he answered on 08-28 are reported, with the replies that answered them", () => {
    const stale = staleOpenHosts(EDITION_99, REPLIES);
    expect(stale.map((entry) => entry.host.id).sort()).toEqual(["concept-cast-it-196", "concept-review-modal"]);
    /* Two replies land on one item; it is reported ONCE, carrying both. */
    expect(stale.find((entry) => entry.host.id === "concept-cast-it-196")!.replyIds).toEqual([23, 24]);
  });

  it("an item already ANSWERED is not swept — that is the state this asks him to reach", () => {
    expect(staleOpenHosts(EDITION_99, REPLIES).map((entry) => entry.host.id))
      .not.toContain("portrait-crop-198");
  });

  it("a WAITING card is not swept — the reply that moved it there is the one that would flag it", () => {
    /*
      ⚠ #649 FINDING 1'S DECISION, PINNED WHERE THE FUNCTION IS DRIVEN rather
      than only in the scanner that reads the source line (PR #656 review,
      finding 3 — working law 3's shape: a guard whose only test runs through
      text-matching is a guard on the text, not on the behaviour).

      `waiting` (#354) still needs him, so `crewCardNeedsHim` would return true
      for it — and that is exactly why widening the predicate here is wrong. A
      shift moves a card to `waiting` BECAUSE he replied and the reply was
      acknowledged, so every correctly-handled card would be reported. The
      accepted gap this leaves — a reply landing on an already-`waiting` card —
      is written at `replyHosts.mts` and cannot be closed without a record of
      when a state moved, which no briefing row carries.
    */
    const withWaiting: BriefingFacts = {
      ...EDITION_99,
      needsYou: [...EDITION_99.needsYou, { id: "icon-set-262", title: "Answered, and still yours to do", state: "waiting" }],
    };
    const replies: ReplyRow[] = [{ id: 23, cardId: "icon-set-262" }];
    expect(staleOpenHosts(withWaiting, replies)).toEqual([]);
    /* The control on that arm: the SAME reply on the SAME card is swept while
       the card still reads `open`, so the arm above is about the state and not
       about the fixture being unreachable. */
    const stillOpen: BriefingFacts = {
      ...EDITION_99,
      needsYou: [...EDITION_99.needsYou, { id: "icon-set-262", title: "Answered, and still yours to do", state: "open" }],
    };
    expect(staleOpenHosts(stillOpen, replies).map((entry) => entry.host.id)).toEqual(["icon-set-262"]);
  });

  it("an UNACKNOWLEDGED reply is not swept — the default read already prints it in full", () => {
    const unread: BriefingFacts = { ...EDITION_99, acknowledgedReplyIds: [28] };
    expect(staleOpenHosts(unread, REPLIES)).toEqual([]);
  });

  it("an acknowledged reply naming an id the briefing does not hold is NOT folded in", () => {
    const gone: ReplyRow[] = [{ id: 23, cardId: "a-card-no-edition-carries" }];
    expect(staleOpenHosts(EDITION_99, gone)).toEqual([]);
  });

  it("a general note (no cardId) addresses nothing and is never swept", () => {
    expect(staleOpenHosts(EDITION_99, [{ id: 23, cardId: null }])).toEqual([]);
  });

  it("no briefing means no verdict — an empty list, never a false all-clear that throws", () => {
    expect(staleOpenHosts(null, REPLIES)).toEqual([]);
  });

  /*
    THE POSITIVE CONTROL FOR THE SWEEP ITSELF (working law 2): with the two
    items moved to `answered` — the exact edit this shift makes to the real
    briefing — the sweep must go quiet. A checker that reports the same list
    whatever the briefing says would pass every arm above.
  */
  it("moving the two items to `answered` empties the sweep", () => {
    const fixed: BriefingFacts = {
      ...EDITION_99,
      eyeItems: EDITION_99.eyeItems.map((item) =>
        item.state === "open" ? { ...item, state: "answered" } : item),
    };
    expect(staleOpenHosts(fixed, REPLIES)).toEqual([]);
  });
});

/**
 * THE THIRD SPELLING — `card-<issueNumber>`, the id a test-drive answer is
 * addressed by (#2466).
 *
 * Measured over production 2026-10-13: 31 of his 292 replies printed "(not in
 * the current briefing)" over six cards the briefing was holding, because
 * `testDriveCardId` writes `card-<n>` and the index held only slugs. The
 * fixture is the bug hunt's real shape: a completion card holding the issue
 * under its slug, an eye item sharing one issue with a card, and a retired id.
 */
const EDITION_694: BriefingFacts = {
  edition: 694,
  acknowledgedReplyIds: [301, 302, 303, 304],
  needsYou: [
    { id: "bughunt-complete-2462", title: "The bug hunt is done", state: "open", issueNumber: 2462 },
    { id: "n2d-complete-2359", title: "N2d is done", state: "done", issueNumber: 2359 },
    { id: "no-issue-card", title: "A card with no GitHub card", state: "open", issueNumber: null },
  ],
  eyeItems: [
    { id: "n2-test-drive-1644", title: "Drive N2", state: "done", issueNumber: 1644 },
    { id: "n2d-three-surfaces-2359", title: "Three surfaces", state: "done", issueNumber: 2359 },
  ],
};

describe("hostIndex — a test-drive answer's card-<n> id (#2466)", () => {
  it("resolves card-<n> to the needs-you card holding that issue under a slug, and names the slug", () => {
    const host = hostIndex(EDITION_694).get(testDriveCardId(2462));
    expect(host).toBeDefined();
    expect(host!.id).toBe("bughunt-complete-2462");
    expect(host!.kind).toBe("card");
    expect(host!.via).toBe("card number");
  });

  it("resolves card-<n> to an eye item when that is the only row naming the issue", () => {
    const host = hostIndex(EDITION_694).get(testDriveCardId(1644));
    expect(host?.id).toBe("n2-test-drive-1644");
    expect(host?.kind).toBe("eye item");
  });

  it("a card and an eye item on one issue: the card wins, as needsYou wins on slugs", () => {
    expect(hostIndex(EDITION_694).get(testDriveCardId(2359))?.id).toBe("n2d-complete-2359");
  });

  it("NEGATIVE CONTROL: a card-<n> no row carries stays absent — the 9 genuinely gone ids", () => {
    expect(hostIndex(EDITION_694).get(testDriveCardId(1999))).toBeUndefined();
    /* and a retired eye item's slug, the 42nd reply on the day */
    expect(hostIndex(EDITION_694).get("eye-398-crew-surface")).toBeUndefined();
  });

  it("a row with no issue number derives no key, and nothing derives card-null", () => {
    const keys = [...hostIndex(EDITION_694).keys()];
    expect(keys.filter((key) => key.startsWith("card-")).sort())
      .toEqual([testDriveCardId(1644), testDriveCardId(2359), testDriveCardId(2462)].sort());
  });

  it("an explicit slug that reads card-<n> keeps its own row — nothing that resolved moves", () => {
    const facts: BriefingFacts = {
      ...EDITION_694,
      eyeItems: [...EDITION_694.eyeItems, { id: testDriveCardId(2462), title: "Slug that looks numeric", state: "open" }],
    };
    const host = hostIndex(facts).get(testDriveCardId(2462));
    expect(host?.title).toBe("Slug that looks numeric");
    expect(host?.via).toBe("id");
  });

  it("every slug still resolves by its own id, exactly as before", () => {
    const index = hostIndex(EDITION_694);
    for (const row of [...EDITION_694.needsYou, ...EDITION_694.eyeItems]) {
      expect(index.get(row.id)?.id).toBe(row.id);
      expect(index.get(row.id)?.via).toBe("id");
    }
  });
});

describe("staleOpenHosts — a card-<n> answer is not an answer to the card's question (#2466)", () => {
  /* His six matched bug-hunt verdicts, acknowledged, on a completion card that
     is `open` on purpose: it waits on his word on the next rung. */
  const DRIVE: ReplyRow[] = [301, 302, 303].map((id) => ({ id, cardId: testDriveCardId(2462) }));

  it("an acknowledged test-drive answer on an open completion card is NOT swept", () => {
    expect(staleOpenHosts(EDITION_694, DRIVE)).toEqual([]);
  });

  it("CONTROL: the same acknowledged reply addressed by the card's own slug IS swept", () => {
    const bySlug: ReplyRow[] = [{ id: 304, cardId: "bughunt-complete-2462" }];
    expect(staleOpenHosts(EDITION_694, bySlug).map((entry) => entry.host.id)).toEqual(["bughunt-complete-2462"]);
  });
});
