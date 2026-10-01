/**
 * WHAT THE VENDOR SAYS ABOUT EVERY MODEL ID WE SHIP, WITH THE DATE IT WAS READ
 * AND WHERE IT WAS READ (#1537).
 *
 * # The defect this answers
 *
 * `shared/modelRegistry.ts` carried `IMAGE_PRO = "gemini-3-pro-image-preview"`
 * and `IMAGE_FLASH = "gemini-3.1-flash-image-preview"` as live constants for
 * three months after Google shut both ids down (2026-06-25). Nothing in the
 * tree knew. `MODEL_CHANGELOG.md`'s own Watch List called the first one
 * **"Active · Monitor for deprecation"**, which is the shape of the failure:
 * the watching was a sentence in a document, and a sentence does not watch.
 *
 * What made it invisible for three months is worth more than the instance.
 * The registry's docblock states the upgrade workflow as *"change the model ID
 * … document the change in MODEL_CHANGELOG.md"* — so the provenance of an id
 * lived in prose, in a second file, with nothing binding the two. A shut-down
 * id and a healthy one are the same string to every reader in the repository.
 *
 * ⚠ **AND A SHUT-DOWN ID DOES NOT RELIABLY FAIL LOUDLY, WHICH IS WHY ZERO
 * TRAFFIC PROVED NOTHING.** `MODEL_CHANGELOG.md`'s 2026-03-25 entry records the
 * previous `TEXT_PRO` shutdown with the words *"alias redirects silently"*. So
 * "nobody has walked this road in 30 days, which is why nothing has failed yet"
 * (#1537's own evidence) is two claims, and only the first was measured.
 *
 * # What this file is, and what it is NOT
 *
 * It is the dated, sourced status of each id — a different fact from the one
 * `modelRegistry.ts` states. The registry says *which slot uses which id*;
 * this says *what the vendor said about that id, when we last looked, and
 * where.* Neither is derivable from the other, so this is not a mirror of the
 * registry (working law 4) — `server/vendorModelStatus.test.ts` is what binds
 * them, and an id in the registry with no row here is a RED.
 *
 * It is **not** a decision about what to do. Re-pointing a slot changes what
 * the product renders and is a founder call with a court behind it (#1537's own
 * two options); retiring the wardrobe door is the same. This file records the
 * reading so the decision is made against facts, and so the next shutdown is a
 * failing suite rather than another three quiet months.
 *
 * # The two enumerated remainders, and they only shrink
 *
 * `WIRED_DESPITE_SHUTDOWN` and `STATUS_UNCLEAR_AT_SOURCE` are the KNOWN_DEBTS
 * shape this repository already trusts: every entry names its card, and an
 * entry whose row no longer carries that status is a RED rather than a line
 * nobody deletes. Adding an id to the registry without a row here, or letting a
 * third id go shut-down unacknowledged, cannot pass the gate.
 *
 * # ⚠ A READING IS DATED BECAUSE IT EXPIRES
 *
 * `readOn` is not decoration. CLAUDE.md's disappearing-technology law clause 1:
 * *"a model chosen well eighteen months ago is not thereby chosen well now"*,
 * and *"best has an expiry"*. A row read in September is evidence about
 * September. Re-read at the source before quoting one of these as current.
 *
 * ⚠ Not to be confused with `shared/modelLifecycle.ts`, which is a different
 * subject entirely — the CAST lifecycle read-model (draft / active / locked /
 * archived). This file is about vendor model IDS.
 */

/** The vendor's posture toward an id, as read at `source` on `readOn`. */
export type VendorModelStatus =
  /** Not on the vendor's deprecation list at the reading. */
  | "current"
  /** On the deprecation list, no shutdown date announced at the reading. */
  | "deprecated"
  /** The vendor gives a shutdown date and it has passed. */
  | "shutdown";

export interface VendorModelRow {
  readonly status: VendorModelStatus;
  /** ISO `YYYY-MM-DD`. The day this row was read at `source`, not the day it was typed. */
  readonly readOn: string;
  /** Where it was read — a URL, or the card recording a reading somebody did. */
  readonly source: string;
  /** ISO `YYYY-MM-DD`. Required when `status` is `shutdown`; the date the vendor gives. */
  readonly shutdownOn?: string;
  /**
   * The replacement id the vendor names, when the source states one
   * unambiguously. Deliberately absent where it did not — see
   * `STATUS_UNCLEAR_AT_SOURCE`.
   */
  readonly replacement?: string;
}

const GOOGLE_DEPRECATIONS = "https://ai.google.dev/gemini-api/docs/deprecations";

/**
 * Every model id `shared/modelRegistry.ts` exports, keyed by the id itself.
 *
 * Read at `GOOGLE_DEPRECATIONS` on 2026-09-30 for all five. The two image ids
 * were read twice by two different readers — the relay's own reading at the
 * page, recorded on #1537, and this one — and both agree on the shutdown date.
 *
 * ⚠ **FOUR OF THE FIVE SLOTS ARE ON DEPRECATED IDS.** #1537 was filed about the
 * two image ids; reading all five (working law 7 — fix the class, not the
 * instance) found both text preview slots on the deprecation table too, with no
 * shutdown date announced. Only `TEXT_ECONOMY` is clear.
 */
export const VENDOR_MODEL_STATUS: Readonly<Record<string, VendorModelRow>> = {
  "gemini-3-pro-image-preview": {
    status: "shutdown",
    shutdownOn: "2026-06-25",
    replacement: "gemini-3-pro-image",
    readOn: "2026-09-30",
    source: GOOGLE_DEPRECATIONS,
  },
  "gemini-3.1-flash-image-preview": {
    status: "shutdown",
    shutdownOn: "2026-06-25",
    replacement: "gemini-3.1-flash-image",
    readOn: "2026-09-30",
    source: GOOGLE_DEPRECATIONS,
  },
  /**
   * On the deprecation table with no shutdown date announced. The page's
   * replacement cell for this row read as `gemini-3-pro-image-preview` — an
   * IMAGE id, itself shut down, offered as the successor to a TEXT model — so
   * it is not recorded here and the id is enumerated in
   * `STATUS_UNCLEAR_AT_SOURCE` instead. Two reads agreed on the value, which
   * settles nothing: both were the same extraction of the same page and
   * therefore shared a resolver.
   */
  "gemini-3.1-pro-preview": {
    status: "deprecated",
    readOn: "2026-09-30",
    source: GOOGLE_DEPRECATIONS,
  },
  "gemini-3-flash-preview": {
    status: "deprecated",
    replacement: "gemini-3.6-flash",
    readOn: "2026-09-30",
    source: GOOGLE_DEPRECATIONS,
  },
  /**
   * Absent from the deprecation table entirely, which is what `current` means
   * here — not a promise the vendor made. `MODEL_CHANGELOG.md`'s 2026-03-25
   * audit read it the same way ("stable GA, no deprecation").
   */
  "gemini-2.5-flash": {
    status: "current",
    readOn: "2026-09-30",
    source: GOOGLE_DEPRECATIONS,
  },
};

export interface AcknowledgedModelDebt {
  readonly id: string;
  /** The card where the decision lives. */
  readonly card: string;
  /** Why it is still wired, in one sentence. */
  readonly why: string;
}

/**
 * Shut-down ids still shipped as live constants.
 *
 * ⚠ **AN ENTRY HERE IS A DEBT, NOT A DISPENSATION.** It exists so the tree
 * states a known-bad id out loud instead of carrying it as an ordinary string,
 * and so a THIRD one cannot arrive quietly. Removing a line requires the id to
 * stop being shut-down in `VENDOR_MODEL_STATUS` or to leave the registry;
 * deleting it while both still hold is a RED.
 */
export const WIRED_DESPITE_SHUTDOWN: readonly AcknowledgedModelDebt[] = [
  {
    id: "gemini-3-pro-image-preview",
    card: "#1537",
    why:
      "ANSWERED 2026-09-30 — his word, verbatim and entire: 'SWITCH IT OFF'. The wardrobe try-on " +
      "door is SHUT (`shared/wardrobeTryOnDoor.ts`), so no wardrobe road reaches this id any more: " +
      "six procedures refuse at the mouth and the five pipeline entries refuse again as the " +
      "structural backstop. The id stays in the registry because he chose neither of the card's " +
      "two options — no re-point, no retirement — and the road returns on N8 as a build. " +
      "⚠ WHAT IS STILL WIRED IS THE LEGACY CASTING STUDIO'S three image paths " +
      "(`server/casting/geminiGeneration.ts`, `geminiViews.ts`, `aiService.ts`). That is N8's " +
      "retirement (#29) and was never this card's scope; it is named here so the next reader does " +
      "not take this line as covering it. " +
      "⚠ THIS CLAUSE READ 'reachable only at /studio, which is admin-only since #364' UNTIL " +
      "2026-10-01 AND THAT WAS FALSE — corrected at the code while sealing the lane's paid " +
      "procedures (#1654). THREE of the four paid legacy procedures were indeed /studio-only and " +
      "are now `adminProcedure`; the fourth, `generation.refreshSlots`, is reached by the LIVE " +
      "CANVAS (`features/boards/canvas/nodes/useSheetController.ts:137` on `/app/canvas/:id`, with " +
      "no admin check in `CastNode.tsx`), charges at `server/casting/refreshSlots.ts:261`, and " +
      "renders through `generatePackageSlotCandidate` → `aiService.generateRemainingViews` → " +
      "`geminiViews` — so a customer can be charged for a render on this id. It is NOT sealed " +
      "because sealing it removes a live feature, which is a product decision; the three options " +
      "and the recommendation are on #1654. ⚠ And this file's own warning applies to the " +
      "reachability question exactly as it applies to the id: 'a shut-down id does not reliably " +
      "fail loudly', so no complaint is not evidence of no traffic.",
  },
  {
    id: "gemini-3.1-flash-image-preview",
    card: "#1537",
    why:
      "ANSWERED 2026-09-30 with the id above, on the same word. It was the garment digitiser's " +
      "engine and that door is shut; it remains the image fallback's second leg on the legacy " +
      "casting road, which is N8's.",
  },
];

/**
 * Ids whose row could not be completed from the source, with what is missing.
 * Separate from the debt list above because an unread fact and a known-bad fact
 * are different problems: one wants a reader, the other wants a decision.
 */
export const STATUS_UNCLEAR_AT_SOURCE: readonly AcknowledgedModelDebt[] = [
  {
    id: "gemini-3.1-pro-preview",
    card: "#1537",
    why: "Deprecated with no shutdown date, so the status is firm; the vendor's replacement cell read as an image id and is not trustworthy, so no successor is recorded. A human reading of the page settles it.",
  },
];
