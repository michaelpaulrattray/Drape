import { describe, expect, it } from "vitest";

import { bridgeWithinCandidate, candidateOfQueryKey } from "./panelBridge";

/**
 * THE BRIDGE MAY CROSS VERSIONS AND NEVER FACES (fable-491).
 *
 * The founder, the evening the bridge shipped: open cast A, let the panel fill,
 * click out and quickly into cast B — and A's rows and A's bounding boxes were
 * drawn on B's face until B's scan landed. `keepPreviousData` keeps the
 * previous answer whatever changed in the key, and the previous answer belonged
 * to another woman.
 *
 * Both arms here, because either alone is a different defect: bridging nothing
 * is the blink coming back, and bridging everything is somebody else's face.
 */

const key = (candidateId: string, variantId: string | null) => [
  ["castingV2", "facePanel"],
  { input: { candidateId, variantId }, type: "query" },
];

describe("what the key says the answer was about", () => {
  it("reads the candidate out of a tRPC query key", () => {
    expect(candidateOfQueryKey(key("cand-a", "v1"))).toBe("cand-a");
  });

  it("says null for a key it cannot vouch for", () => {
    /* A shape this cannot read is unbridgeable on purpose: the cold state is
       the safe answer, and a guess here is somebody else's face. */
    expect(candidateOfQueryKey(undefined)).toBe(null);
    expect(candidateOfQueryKey([["castingV2", "facePanel"]])).toBe(null);
    expect(candidateOfQueryKey([["x"], { input: {} }])).toBe(null);
    expect(candidateOfQueryKey([["x"], { input: { candidateId: "" } }])).toBe(null);
  });
});

describe("the bridge", () => {
  const held = { rows: ["her eyes"] };

  it("holds the last version's answer while the next version loads", () => {
    const bridge = bridgeWithinCandidate<typeof held>("cand-a");
    expect(bridge(held, { queryKey: key("cand-a", "v1") })).toBe(held);
  });

  it("holds NOTHING when the answer was about another face", () => {
    const bridge = bridgeWithinCandidate<typeof held>("cand-b");
    expect(bridge(held, { queryKey: key("cand-a", "v1") })).toBeUndefined();
  });

  it("holds nothing when there is no face open, and nothing to hold", () => {
    expect(bridgeWithinCandidate<typeof held>(null)(held, { queryKey: key("cand-a", null) }))
      .toBeUndefined();
    expect(bridgeWithinCandidate<typeof held>("cand-a")(undefined, { queryKey: key("cand-a", null) }))
      .toBeUndefined();
  });

  it("holds nothing when the previous query is not offered at all", () => {
    /* TanStack passes the query on a placeholder call; a caller that does not
       is a caller this cannot check, so it declines rather than assumes. */
    expect(bridgeWithinCandidate<typeof held>("cand-a")(held)).toBeUndefined();
  });
});
