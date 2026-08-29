/**
 * THE IMAGINATION METER — how opinionated the prompt author is (#131 slice E;
 * the founder's spec is `PROMPT_AUTHOR_RULING_2026-08-26.md` §5, verbatim).
 *
 * Two positions, his words: LOW is the default (*"build the author
 * verbatim-first with LOW as the default"*) and adds only the photoreal bundle
 * where the brief is silent; MAX treats the request as a seed and invents an
 * ownable look while leaving the face and a few axes open (*"casting call, not
 * a portrait"*). Shared because the client draws the control and the server
 * reads the value, and a second copy of a two-member list is still a second
 * copy (working law 4).
 */
export const IMAGINATIONS = ["low", "max"] as const;
export type Imagination = (typeof IMAGINATIONS)[number];
export const DEFAULT_IMAGINATION: Imagination = "low";

/** The word on the pill. */
export const IMAGINATION_NAMES: Readonly<Record<Imagination, string>> = {
  low: "Low",
  max: "Max",
};

/**
 * The line under the selected pill — what the author will do with the brief.
 * Honest about today's capability: LOW's bundle is the photoreal preset (the
 * only style), MAX invents; neither promises a style picker that does not
 * exist yet.
 */
export const IMAGINATION_LINES: Readonly<Record<Imagination, string>> = {
  low: "Your words, then the studio's locked camera, light and grey seamless — nothing invented. Everything you leave unsaid, the engine decides.",
  /*
    #230 — MAX rewrites now, so a line promising an ADDITION would describe a
    road the product no longer takes. His own words for the shape: *"author
    rewrites the seed into a single type + look paragraph. Facts stay. Taste
    goes up."*
  */
  max: "Your words, rewritten by the author into one brief — your facts kept, the mood, materials and styling language raised, never an exact face, hairstyle or item, so the eight are eight people in one editorial universe.",
};
