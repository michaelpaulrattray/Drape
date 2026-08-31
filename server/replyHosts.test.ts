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
