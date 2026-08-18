/**
 * WHERE THE INSTANCES OF A KIND SIT RELATIVE TO EACH OTHER — the locality class
 * (founder ruling, relayed fable-951 §2).
 *
 * His question was about fangs: *"fangs are apart of teeth as a whole though
 * right? no need for a left and right fang?"* — and his instruction with it:
 * *"agreed but this must not be just a fang upgrade it must apply to anything
 * of the sort."* So this is a property of every kind, catalogued or open, and
 * not a carve-out for one word.
 *
 * # WHY PAIREDNESS WAS THE WRONG QUESTION
 *
 * The store asked *is this kind paired* and refused a crop whenever the answer
 * was yes. That was right for wings and wrong for fangs, and the difference is
 * not how many there are — it is **whether one crop can hold them all**.
 *
 * ```
 * single       one instance                        a halo, a snout
 * coLocated    several, sharing one region — one crop holds the whole set
 * distributed  instances on opposite sides — one crop cannot hold both
 * ```
 *
 * # WHAT EACH ONE BUYS
 *
 * - **`single`** — unchanged by this ruling. One thing, one region, one crop.
 * - **`coLocated`** — THE CROP ROAD OPENS. The completeness and ceiling
 *   instruments already decide whether a crop holds the whole of what it
 *   claims; that is exactly what they are for. The failure the pairedness gate
 *   existed to prevent — one instance minted under a plural name — cannot
 *   structurally arise when one crop holds the set.
 * - **`distributed`** — counting-gated, exactly as built. A whole-frame read of
 *   a distributed pair returns ONE instance (measured on the wings frame: the
 *   mask the mint would have carried was the image-left wing to thirteen
 *   pixels), so the crop would be half a picture wearing the whole picture's
 *   name. That is the earring history and it does not get a second run.
 */

export const KIND_LOCALITIES = ["single", "coLocated", "distributed"] as const;
export type KindLocality = (typeof KIND_LOCALITIES)[number];

export function isKindLocality(value: unknown): value is KindLocality {
  return typeof value === "string" && (KIND_LOCALITIES as readonly string[]).includes(value);
}

/**
 * MAY A CROP CARRY THIS KIND? — derived from the locality, never stored beside
 * it (law 4).
 *
 * `distributed` is the only no, and it is a no about GEOMETRY rather than about
 * count: one rectangle cannot hold two things on opposite sides of a body.
 *
 * **That no no longer ends the ask** (founder verdict fable-987 §1, shape ruled
 * fable-1001). A distributed kind files the earring architecture instead — one
 * library row per side, each a picture of exactly what its name says — gated on
 * a COUNT bought at the mint, on the frame the crop would be cut from. So read
 * this predicate as what it says rather than as *may this kind carry pixels*: it
 * answers whether a SINGLE crop suffices, and the mint routes the no to two.
 */
export function cropMayCarry(locality: KindLocality): boolean {
  return locality !== "distributed";
}
