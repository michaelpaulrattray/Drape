import { describe, expect, it } from "vitest";

import {
  EXAMPLE_DECK,
  HERO_DECK_MAX,
  deckOffsets,
  entryAt,
  frameMeta,
  heroDeck,
  type RosterCast,
} from "./heroDeck";

/**
 * The casting hero's deck (#234).
 *
 * The arms here are the spec's own load-bearing promises, and each one is a
 * promise that would fail SILENTLY — a deck full of the right faces beside the
 * wrong words looks perfectly fine, which is why it gets a test rather than a
 * review.
 */

function cast(over: Partial<RosterCast> = {}): RosterCast {
  return {
    castId: "KI-1",
    name: "Kade",
    imageUrl: "https://example.invalid/kade.png",
    brief: "Bald male, mid-40s, severe bone structure.",
    frameCount: 6,
    status: "ready",
    ...over,
  };
}

describe("heroDeck", () => {
  it("shows the account's own signed casts, newest first, when it has any", () => {
    const deck = heroDeck([
      cast({ castId: "KI-3", name: "Kade" }),
      cast({ castId: "KI-2", name: "Jericho", brief: "A skincare founder in his 40s" }),
    ]);
    expect(deck.live).toBe(true);
    expect(deck.entries.map((entry) => entry.name)).toEqual(["Kade", "Jericho"]);
  });

  /*
    THE PAIRING LAW (spec §4). Face and words are one row and travel together;
    a deck that read its briefs from a second list would pass every other arm
    here and still show a stranger's sentence under a customer's Cast.
  */
  it("carries each cast's OWN brief on its own card", () => {
    const deck = heroDeck([
      cast({ castId: "KI-3", name: "Kade", brief: "a bald man" }),
      cast({ castId: "KI-2", name: "Shina", brief: "an editorial model in glasses" }),
    ]);
    expect(deck.entries.find((entry) => entry.name === "Shina")?.brief).toBe(
      "an editorial model in glasses",
    );
    expect(deck.entries.find((entry) => entry.name === "Kade")?.brief).toBe("a bald man");
  });

  it("falls back to the curated deck — and says so — when nothing is signed", () => {
    expect(heroDeck([])).toEqual({ entries: EXAMPLE_DECK, live: false });
    expect(heroDeck(undefined).live).toBe(false);
  });

  /*
    Half a card is worse than no card: the block would draw an empty quote
    under a real face, which is the one thing the section exists to avoid.
  */
  it("refuses a cast with no face or no brief", () => {
    expect(heroDeck([cast({ imageUrl: null })]).live).toBe(false);
    expect(heroDeck([cast({ brief: null })]).live).toBe(false);
    expect(heroDeck([cast({ brief: "   " })]).live).toBe(false);
  });

  it("caps the deck at the spec's upper bound", () => {
    const many = Array.from({ length: 12 }, (_unused, index) =>
      cast({ castId: `KI-${index}`, name: `Cast ${index}` }));
    expect(heroDeck(many).entries).toHaveLength(HERO_DECK_MAX);
  });

  it("states a counted frame total, never a declared one", () => {
    expect(frameMeta(cast({ frameCount: 6 }))).toBe("6 frames");
    expect(frameMeta(cast({ frameCount: 1 }))).toBe("1 frame");
    expect(frameMeta(cast({ frameCount: 0 }))).toBe("Signed");
    expect(frameMeta(cast({ status: "building", frameCount: 2 }))).toBe("Building");
  });

  /* Every curated entry is a real render with a real brief and no room to open. */
  it("keeps the curated deck honest", () => {
    expect(EXAMPLE_DECK.length).toBeGreaterThanOrEqual(5);
    for (const entry of EXAMPLE_DECK) {
      expect(entry.castId).toBeNull();
      expect(entry.meta).toBe("Example");
      expect(entry.brief.length).toBeGreaterThan(20);
      expect(entry.imageUrl.startsWith("/casting-hero/deck/")).toBe(true);
    }
  });
});

describe("deck geometry", () => {
  /*
    A short deck draws fewer cards rather than repeating a face — the peeks
    have to be other people or the fan is an effect rather than a shelf.
  */
  it("never puts one face in two slots", () => {
    expect(deckOffsets(1)).toEqual([0]);
    expect(deckOffsets(2)).toEqual([0, 1]);
    expect(deckOffsets(3)).toEqual([-1, 0, 1]);
    expect(deckOffsets(7)).toEqual([-1, 0, 1]);
  });

  it("wraps in both directions", () => {
    const entries = EXAMPLE_DECK.slice(0, 3);
    expect(entryAt(entries, 0, -1).key).toBe(entries[2]!.key);
    expect(entryAt(entries, 2, 1).key).toBe(entries[0]!.key);
    expect(entryAt(entries, 1, 0).key).toBe(entries[1]!.key);
  });
});
