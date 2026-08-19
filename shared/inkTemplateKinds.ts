/**
 * THE TWO BLANK FAMILIES A DESIGN CAN BE PLATED ONTO — the vocabulary, apart
 * from the files.
 *
 * # THE KIND NAMES THE FAMILY; THE DIGEST NAMES THE MEMBER
 *
 * Ruled fable-1032 §1 when the single-view spec turned two blanks into six.
 * `arm` and `body` are still exactly two families of form, and both are still
 * true of every blank in the set — but there are now a left arm and a right arm,
 * and a female and a male front and back. **A reader wanting the exact form
 * reads the DIGEST, not the kind.**
 *
 * That is not a workaround for a migration we did not want to run. The plate row
 * already carries `templateDigest`, which identifies WHICH of the six a plate
 * stands on exactly and unambiguously — pinning bytes is what a digest is for.
 * Widening this enum would give the table a second, COARSER encoding of a fact
 * it already holds precisely, which is working law 4 pointed at itself. The
 * digest → descriptor lookup lives in `server/castingV2/inkTemplates.ts`
 * (`inkTemplateByDigest`), so the join is a function call rather than a hunt
 * through the source tree.
 *
 * # WHAT WOULD EARN THE MIGRATION, pre-priced so nobody relitigates it
 *
 * **The day any code wants to BRANCH on the finer kind.** Nothing does today —
 * the mint writes the column, the db layer passes it through and selects it in
 * one projection, and that is the entire population; no logic anywhere reads
 * `templateKind` and decides something. It is a record field, not a control
 * field. On the day a caller needs `armLeft` as a *decision*, the enum earns its
 * widening, `casting_ink_plates.templateKind` is a written column, and that is a
 * migration and a production ceremony in that order.
 *
 * # Why this is a shared file and not a line in `server/castingV2/inkTemplates.ts`
 *
 * Because the plate table has a `templateKind` column, and `drizzle/schema.ts`
 * derives its enum from a constant rather than retyping one (working law 4 —
 * the same reason `INK_PLACEMENTS`, `INK_SIDES` and `INK_PROVENANCES` live in
 * `shared/`). The templates module reads bytes off disk and hashes them, which
 * is server work the schema has no business importing; the NAMES are a plain
 * fact both sides need.
 *
 * # What a kind is, and what it is not
 *
 * It is which family of artwork the design stands on: `arm` is a single bare
 * limb, shoulder to wrist; `body` is a torso. It is NOT the placement — three
 * placements map onto these two families, and that mapping is a total function
 * in the templates module so a fourth placement cannot compile until somebody
 * has decided which family it belongs to. It is also not the SIDE and not the
 * BUILD: those pick the member within the family, and the digest records which
 * member was used.
 */
export const INK_TEMPLATE_KINDS = ["arm", "body"] as const;

export type InkTemplateKind = (typeof INK_TEMPLATE_KINDS)[number];

export function isInkTemplateKind(value: string): value is InkTemplateKind {
  return (INK_TEMPLATE_KINDS as readonly string[]).includes(value);
}
