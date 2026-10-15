/**
 * WHAT THE REFINE BOX ACCEPTS — the one number, where both sides can see it.
 *
 * # Why it is here and not in `server/castingV2/refineLimits.ts`
 *
 * It used to be there alone, and the client held two hand-typed copies of it
 * (`RefinePanel.tsx`, `FaceRegions.tsx`, both `maxLength={200}`). That is
 * working law 4 — a second list shadowing a source of truth — with a specific
 * and expensive consequence: **the refine-fidelity row's entire content is
 * raising this number, and raising it would have changed nothing for any
 * customer.** The server would accept a longer ask; both boxes would still stop
 * at 200, silently, and the suite would have been green about it.
 *
 * So the declaration moved to the one place a browser and a router can both
 * import, and the server's own module now re-exports it rather than restating
 * it. The derived `REFINE_ANSWERING_MAX_LENGTH` stays server-side, because it
 * is built from a handle length nothing on the client needs to know.
 *
 * # 2,000 — HIS WORD, 2026-10-15 (#26)
 *
 * Verbatim: *"yes raise the refine limit to 2000"*. It was 200 — about 35
 * words — under the framing *"one adjustment, not a brief"*: the brief box was
 * where a paragraph belonged, and a long instruction here read as somebody
 * trying to re-cast rather than refine. His word retires that framing for the
 * box's LENGTH; it was the reason the number was small, and the number is no
 * longer small. A customer may now change a person in as many words as the
 * product once let them describe one in.
 *
 * ⚠ **It is a literal, not derived from the brief's cap, on purpose.** The card
 * compared the two (200 against the brief's 2,000), but the brief's entrance
 * has admitted 4,000 since #1204 (`shared/briefLength.ts`), and his number is
 * 2,000. Deriving it would have quietly made the refine box 4,000.
 *
 * ⚠ **The number is bolted to a column.** An unanswered refine stores what was
 * typed in `casting_candidate_variants.requestText`, and an ANSWERED one stores
 * up to this plus the longest re-ask handle plus the studio's own clause, so
 * `REFINE_REQUEST_TEXT_MAX_LENGTH` (`server/castingV2/refineReask.ts`) and the
 * schema's declared width must hold that sum — `server/refineEchoWidth.test.ts`
 * reddens the day this number outgrows them.
 */
export const REFINE_INSTRUCTION_MAX_LENGTH = 2000;

/**
 * The room a SCOPED ask actually has to type in.
 *
 * # The defect this closes, which nobody typed on purpose
 *
 * The region popover submits `prefill + said` — *"his upper chest tattoo — "*
 * followed by her sentence — while its field capped `said` alone at the number
 * above and the router caps the WHOLE at it. So the box accepted 200 characters
 * and composed an ask the server refused, with the one sentence a person cannot
 * act on: *"please keep it to 200 characters or fewer"*, said to somebody the
 * box would not let past 200, about characters she cannot see.
 *
 * It was correct by construction until `44369835`, where the founder's own
 * ruling (fable-1270 §1) moved the prefill out of the field so the box could
 * open empty behind hint text. **The ruling is right and the arithmetic was
 * bolted to the prefill's location** — law 7's second half, leaving no failing
 * test and no error.
 *
 * # Why a function rather than the subtraction at the call site
 *
 * Because the subtraction IS the contract, and a contract spelled out at one of
 * two call sites is the same mirror one layer down. `refineComposedWireLength`
 * below is its inverse, and the arm drives both against the real catalogue.
 */
export function refineTypingAllowance(prefill: string): number {
  return REFINE_INSTRUCTION_MAX_LENGTH - prefill.length;
}

/**
 * What the wire will actually carry for a scoped ask — the thing the router
 * measures, expressed once so a test can assert on it rather than on a
 * re-derivation of it.
 *
 * The router trims before it measures, and so does the popover's submit, so the
 * length that matters is the trimmed composition.
 */
export function refineComposedWireLength(prefill: string, said: string): number {
  return `${prefill}${said}`.trim().length;
}
