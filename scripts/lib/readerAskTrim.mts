/**
 * TRIMMING THE BRIEF READER'S ASK — the surgery #1123's court measures.
 *
 * The reader's system prompt (`interpreterSystemPrompt`) states each field
 * TWICE: once as a schema line inside the reply-shape object, and once as an
 * instruction paragraph under `WHAT TO EXTRACT`. Dropping a field means
 * dropping both, and nothing else.
 *
 * ⚠ **THIS MODULE NEVER EDITS THE PRODUCT.** It takes the string the real
 * composer produced and returns a variant, so the court's arms differ by the
 * bytes on the wire and by nothing else — same entrance, same transport, same
 * model, same temperature, same ceiling. The one arm that must be
 * byte-identical to production is the arm that applies no surgery at all.
 *
 * # Every removal ASSERTS IT APPLIED
 *
 * `String.replace` that matches nothing returns its input silently, which is
 * the footprint class this repository has already been bitten by
 * (`interpreterSystemPrompt`'s own fidelity swap throws for the same reason).
 * A trim that quietly removed nothing would make the trimmed arm a SECOND COPY
 * of the full arm, and a court whose two arms are the same ask reports perfect
 * agreement and proves nothing. So each step throws when its anchor is missing,
 * when it is ambiguous, or when the field's own name survives in the schema.
 */

/**
 * The three fields the #180 ghost audit found genuinely dead on the author road
 * — no prompt, no lock, no persisted reader, no surface (audited at HEAD
 * 2026-09-26: `reads` has ZERO read sites anywhere; `composedDirection`'s only
 * consumer is the per-slice prompt the author road overwrites at
 * `briefCompiler.ts:1417`; `poolTendencies` reaches only that prompt, the
 * `unsent: true` record, and the variance blob that stopped being projected at
 * `rollProjection.ts:90-94`).
 */
export const DEAD_FIELDS = ["reads", "composedDirection", "poolTendencies"] as const;

/**
 * The four the CARD proposes dropping.
 *
 * ⚠ `variationAxis` is the fourth and it is NOT dead: `promoteStatedRole`
 * reads it at `heritagePromotion.ts:126` on both roads (called at
 * `briefCompiler.ts:1268`) and turns it into the `role` the brief echo shows,
 * and `axisTwin` reads it at `briefEcho.ts:316-318` to decide which open axis
 * the "left to the roll" sentence leaves out. That is why the court runs both
 * trims rather than only the card's.
 */
export const CARD_FIELDS = [...DEAD_FIELDS, "variationAxis"] as const;

/**
 * THE POSITIVE CONTROL'S FIELDS — two KEPT facts, removed by the same surgery.
 *
 * `sex` and `heritage` are the two the founder's own sentence names as the
 * facts a sheet is judged on, both reach `lockContract` and the brief echo, and
 * between them nearly every brief in the corpus states one. Two rather than one
 * because a control must reliably show a difference: a single field whose key
 * the model volunteered anyway would leave the instrument uncertified.
 */
export const CONTROL_FIELDS = ["sex", "heritage"] as const;

const countMatches = (lines: readonly string[], predicate: (line: string) => boolean): number =>
  lines.reduce((total, line) => (predicate(line) ? total + 1 : total), 0);

/**
 * Remove one field's SCHEMA LINE — the `  "field": …,` line inside the object.
 *
 * Exactly one line may start that way. Zero means the anchor moved; more than
 * one means the schema grew a second statement of the same field and the caller
 * is about to remove an arbitrary one of them.
 */
export function dropSchemaLine(prompt: string, field: string): string {
  const lines = prompt.split("\n");
  const starts = (line: string): boolean => line.startsWith(`  "${field}":`);
  const found = countMatches(lines, starts);
  if (found !== 1) {
    throw new Error(
      `[readerAskTrim] the schema line for "${field}" appears ${found} times in the reader's ask, `
      + "and exactly one was expected — the prompt moved and this trim would remove the wrong bytes",
    );
  }
  return lines.filter((line) => !starts(line)).join("\n");
}

/**
 * Remove one field's INSTRUCTION PARAGRAPH — from its `- "field":` line to the
 * line before the next field's `- "` line.
 *
 * The block's continuation lines are indented, so the next unindented `- "` is
 * the boundary. The last block in the list is followed by `- "cohort":`
 * (`COHORT_INSTRUCTION`), so no field here is the final one and a missing
 * boundary is an error rather than "run to the end".
 */
export function dropInstructionBlock(prompt: string, field: string): string {
  const lines = prompt.split("\n");
  const opens = (line: string): boolean => line.startsWith(`- "${field}":`);
  const found = countMatches(lines, opens);
  if (found !== 1) {
    throw new Error(
      `[readerAskTrim] the instruction block for "${field}" opens ${found} times, and exactly one `
      + "was expected — the prompt moved and this trim would remove the wrong bytes",
    );
  }
  const start = lines.findIndex(opens);
  const after = lines.findIndex((line, index) => index > start && line.startsWith("- \""));
  if (after < 0) {
    throw new Error(
      `[readerAskTrim] the instruction block for "${field}" has no following field, so its end `
      + "cannot be located — the prompt's shape changed",
    );
  }
  return [...lines.slice(0, start), ...lines.slice(after)].join("\n");
}

/**
 * The schema object's last line carries no comma. Removing the field that WAS
 * last leaves one dangling, so it goes — the schema is illustrative rather than
 * parsed, but a trailing comma before `}` is a change to the ask nobody chose.
 */
export function closeDanglingComma(prompt: string): string {
  return prompt.replace(/,\n\}\n/, "\n}\n");
}

/** One field, both statements, with the field's own name proven gone. */
export function dropField(prompt: string, field: string): string {
  const next = closeDanglingComma(dropInstructionBlock(dropSchemaLine(prompt, field), field));
  if (next.length >= prompt.length) {
    throw new Error(`[readerAskTrim] dropping "${field}" removed nothing`);
  }
  if (next.includes(`"${field}":`)) {
    throw new Error(
      `[readerAskTrim] "${field}" is still asked for after the trim — a third statement of it `
      + "exists that this surgery does not know about",
    );
  }
  return next;
}

/**
 * The trimmed ask.
 *
 * Every field is dropped, in the order given, and the result is proven to
 * differ from the input — a no-op trim is the one outcome that would make the
 * court's arms the same ask while reporting them as two.
 */
export function trimAsk(prompt: string, fields: readonly string[]): string {
  if (fields.length === 0) {
    throw new Error("[readerAskTrim] a trim of no fields is the full ask and must not be built as an arm");
  }
  const trimmed = fields.reduce((text, field) => dropField(text, field), prompt);
  if (trimmed === prompt) {
    throw new Error("[readerAskTrim] the trim returned the full ask unchanged");
  }
  return trimmed;
}
