/**
 * THE ENGINE AND VENDOR NAMES, IN ONE PLACE (#1560).
 *
 * The disappearing-technology law's one narrow prohibition, verbatim from
 * `CLAUDE.md`: **no engine name on a path someone must walk to reach their
 * picture — not the primary button, not a loader, not an error, not a required
 * step.** Two guards now enforce it on two different surfaces — a failed
 * candidate's chip (#1551, `client/src/features/castingV2/candidateFailureWords.test.ts`)
 * and the landing page (#1560, `server/landingEngineNames.test.ts`) — and each
 * needs the same answer to the same question: *which words are engine names?*
 *
 * ⚠ **IT IS ONE LIST BECAUSE TWO WOULD DRIFT, AND THE DRIFT WOULD BE SILENT IN
 * THE EXPENSIVE DIRECTION.** Working law 4: a second list shadowing a source of
 * truth always drifts from it. The engine this product rolls on changed three
 * times in September 2026 alone — GPT Image 2 → 2.5 Sunburst (#1340), the signed
 * views to Sunburst `high` (#1459) and back to Nano Banana Pro (#1278 path E) —
 * and a guard whose vocabulary was written against the previous engine reads
 * green over the new one's name. #1560's own origin is exactly that: a badge
 * nobody re-read *since the engines moved.*
 *
 * ⚠ **WHAT THIS LIST IS NOT: A BAN ON NAMING MODELS.** His own correction, the
 * day he set the law down: *"pickers will exist in the future purely because
 * that in itself is something we are offering the user"* — for an AI studio the
 * model is MATERIAL, and a picker that names its models plainly is a feature
 * this product intends to sell. So a guard reading this list scopes itself to a
 * surface where a picker will never live and says so; none of them may be
 * pointed at `client/src` whole.
 *
 * ⚠ **IT CARRIES THE WORDS AND NOT A READER, ON PURPOSE.** The two guards
 * match differently and must keep doing so: #1551's compares a chip's own
 * lowercase text, while #1560's normalises every separator first, because a
 * landing page can carry a model SLUG (`openai/gpt-image-2.5/sunburst/…`) that a
 * plain comparison would not match. One shared matcher would have to be the
 * looser of the two, and the looser one belongs nowhere near a surface where a
 * PICKER may legitimately name a model. The data is what drifts; the reading is
 * each surface's own business, and each says so in its own header.
 *
 * ⚠ **AND IT IS A FLOOR, NOT A CENSUS.** A customer-facing brand phrase is not
 * mechanically derivable from a model slug — *"Nano Banana Pro"* is not a
 * transformation of `fal-ai/nano-banana-pro` that any rule states — so these
 * words are hand-kept. What is NOT left to memory is the other direction:
 * `server/landingEngineNames.test.ts` holds every model id the provider modules
 * declare against this list, so an engine cannot arrive in the product without a
 * red telling somebody to add its name here.
 */

/**
 * One entry per name, each with the reason it is refused rather than a bare
 * blocklist — because the next person to read a red needs to know what to write
 * INSTEAD, and *"the word Gemini is banned"* does not tell them.
 *
 * Spelled with SPACES, which is what both readers normalise to: `gpt-image-2.5`
 * and `gpt image 2.5` are the same name wearing two separators, and a list that
 * held only one of them would be a guard against one spelling.
 */
export const ENGINE_AND_VENDOR_NAMES: ReadonlyArray<{
  readonly word: string;
  readonly why: string;
}> = [
  { word: "nano banana", why: "an engine name on a path someone must walk" },
  { word: "sunburst", why: "an engine name on a path someone must walk" },
  { word: "gpt image", why: "an engine name on a path someone must walk" },
  { word: "gemini", why: "an engine name on a path someone must walk" },
  { word: "openrouter", why: "a vendor name on a path someone must walk" },
  { word: "fal.ai", why: "a vendor name on a path someone must walk" },
  { word: "deepmind", why: "a vendor name on a path someone must walk" },
  /*
    ⚠ DELIBERATELY ABSENT: `flare`. It is a real engine name — GPT Image 2.5's
    other model, the one `CASTING_ROLL_ENGINE_MODEL` names beside `sunburst` —
    and it is also an ordinary English word a creative studio's own copy may
    legitimately want (a lens flare, a flare of light). Listing it would refuse
    a sentence about light on the landing page to catch a name no surface has
    ever written. Nothing is lost on the derived side: every `flare` model id
    the provider modules declare also carries `gpt image`, so the arm in
    `server/landingEngineNames.test.ts` that holds the slugs against this list
    still matches each of them. Named here rather than omitted, because a gap a
    reader cannot see reads as an oversight.
  */
];
