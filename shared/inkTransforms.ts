/**
 * WHAT MAY BE CHANGED ABOUT A TATTOO SHE ALREADY HAS — the closed vocabulary.
 *
 * Founder-ordered 2026-08-21 (fable-1269 §2), designed opus-940, countersigned
 * fable-1274. His words, the hour his tattoo card went live: *"Can i actually
 * make edits to the upper chest tattoo? like make it bigger or somthing now it
 * has a bounding box?"*
 *
 * # A transform is never a new design
 *
 * The whole road exists so that *"make it bigger"* does not misroute as a fresh
 * words-tattoo and replace his specific piece with a reinvention. What rides is
 * THE SAME DELIVERED CROP — the design as it actually sits on him, at his own
 * tone and in his own light — with one clause of the instruction changed. So
 * this file names the clause, and nothing here can describe a design: there is
 * no field for what the tattoo IS, because the picture already says that.
 *
 * # Closed, for the placement vocabulary's reason
 *
 * An open axis is an axis whose sentence nobody has written and whose result
 * nobody has looked at. Each member below has one clause and that clause is
 * measured or it is named as unmeasured.
 *
 * # ⚠ THE AXIS THAT IS DELIBERATELY ABSENT: sideways
 *
 * *"Move it to the left"* is not here, and its absence is a measurement rather
 * than an oversight. The engine paints by POSITION rather than by anatomy —
 * twelve renders on one eye, four of which painted the other one when the ask
 * did not say which half of the picture it meant (`V4_SIDE_INFERENCE_COURT.md`
 * §3b) — and the legacy ink road refunded 300 credits twice for a design on the
 * wrong anatomical side. A horizontal move is that hazard with a paid render
 * attached, so it refuses free and says so, in a product that can already move
 * the same design up and down. `sidePhrasing.imageHalfClause` is the owner of
 * what "left" means the day this opens; nothing here may re-spell it.
 */

/** The axes a customer may ask about, in the order the copy names them. */
export const INK_TRANSFORM_AXES = ["size", "height", "intensity"] as const;

export type InkTransformAxis = (typeof INK_TRANSFORM_AXES)[number];

/**
 * One asked change, as read out of HER OWN SENTENCE.
 *
 * `factor` is present only when she stated a number — *"twice the size"* — and
 * is null for a bare *"bigger"*. It is never derived from anything: a magnitude
 * nobody typed is a magnitude nobody agreed to, and the crop on the wire is the
 * only frame of reference this lane has ever had that worked.
 */
export type InkTransform =
  | { readonly axis: "size"; readonly direction: "bigger" | "smaller"; readonly factor: number | null }
  | { readonly axis: "height"; readonly direction: "higher" | "lower" }
  | { readonly axis: "intensity"; readonly direction: "darker" | "lighter" };

/**
 * THE ONE CLAUSE — what the painter is told to change, and nothing else.
 *
 * Every member says the same two things in the same order: what changes, and
 * that nothing else does. The second half is not politeness — the carry lane
 * measured that *"put it back exactly as it is"* said alone is the decal
 * instruction, and a transform that only says "bigger" is the same sentence
 * with its anchor removed.
 */
export function inkTransformClause(change: InkTransform, pronouns: { object: string }): string {
  const them = pronouns.object;
  const unchanged = `Everything else about it stays exactly as this picture shows it — the same `
    + `design, the same artwork, the same ink, in the same place on ${them}.`;
  switch (change.axis) {
    case "size":
      /*
        TWO SENTENCES, because one template cannot carry both grammars. A stated
        factor is a size ("at about twice the size it appears here") and a bare
        direction is a comparison ("noticeably larger than it appears here") —
        written as one string with a substituted phrase, the factor form reads
        "about twice the size it is here than it appears in this picture".
      */
      return change.factor === null
        ? `Draw this same tattoo noticeably ${change.direction === "bigger" ? "larger" : "smaller"} `
          + `than it appears in this picture. ${unchanged}`
        : `Draw this same tattoo at about ${spellFactor(change.factor)} the size it appears in `
          + `this picture. ${unchanged}`;
    case "height":
      return change.direction === "higher"
        ? `Draw this same tattoo a little HIGHER on ${them} than it sits in this picture. ${unchanged}`
        : `Draw this same tattoo a little LOWER on ${them} than it sits in this picture. ${unchanged}`;
    case "intensity":
      return change.direction === "darker"
        ? `Draw this same tattoo with DARKER, denser ink than it has in this picture — still a `
          + `healed tattoo in the skin, just stronger. ${unchanged}`
        : `Draw this same tattoo with LIGHTER, more faded ink than it has in this picture — an `
          + `older tattoo that has softened. ${unchanged}`;
  }
}

/**
 * A stated factor in words, because "2x" is not a sentence.
 *
 * Only the factors a person actually types are spelled; anything else falls
 * back to the number, which reads acceptably in *"about 1.5 times the size"*.
 */
function spellFactor(factor: number): string {
  if (factor === 2) return "twice";
  if (factor === 3) return "three times";
  if (factor === 0.5) return "half";
  return `${factor} times`;
}
