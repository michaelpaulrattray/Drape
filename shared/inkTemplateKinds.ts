/**
 * THE TWO BLANK FORMS A DESIGN CAN BE PLATED ONTO — the vocabulary, apart from
 * the files.
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
 * It is which artwork the design stands on: `arm` is the four-rotation
 * turnaround (a wrap-around design has to stay consistent from every angle),
 * `body` is front and back on one plate. It is NOT the placement — three
 * placements map onto these two forms, and that mapping is a total function in
 * the templates module so a fourth placement cannot compile until somebody has
 * decided which form it belongs to.
 *
 * There is no male form: absent by fable-934 §1a, drawn when needed or at his
 * word. When one arrives it is a member here, a migration on the enum, and a
 * decision about which placements route to it — in that order.
 */
export const INK_TEMPLATE_KINDS = ["arm", "body"] as const;

export type InkTemplateKind = (typeof INK_TEMPLATE_KINDS)[number];

export function isInkTemplateKind(value: string): value is InkTemplateKind {
  return (INK_TEMPLATE_KINDS as readonly string[]).includes(value);
}
