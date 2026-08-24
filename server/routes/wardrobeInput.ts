/**
 * wardrobeInput — the wardrobe wire schemas, in a dependency-light module so
 * the validation tests can import them without dragging in the route's
 * database, storage and provider imports. **These ARE the production schemas
 * (`wardrobe.ts` uses them directly), not a copy.**
 *
 * Same shape as `emailAuthInput.ts` and `modelCreateInput.ts`, and for the same
 * reason — this is the THIRD instance of one class, which is why it gets a
 * module rather than an argument.
 *
 * # Extracted because the copy was the bug
 *
 * `server/wardrobe.test.ts` carried its own transcription of four of these
 * under `describe("Wardrobe Router Input Validation")`, declaring them inline
 * with `const uploadSchema = z.object({ … })` and then validating against that.
 * **A test that re-declares its subject is not testing the subject** — it is a
 * scripted reader agreeing with whoever wrote the script, and it stays green
 * for as long as the real schema drifts.
 *
 * It had already drifted, and in the direction that matters: the test's `refine`
 * copy had no `.strict()` while the real one has had it for months. So the four
 * arms would have accepted an unknown field that the product refuses — the
 * opposite verdict from the one they claim to give.
 *
 * # Why a MODULE and not an export from `wardrobe.ts`
 *
 * Exporting the schemas from the router would have been fewer lines and is the
 * wrong shape here: the only reader would be a test, and the disposition door
 * refuses an export with no production reader (it refused `REFERRAL_CODE_LENGTH`
 * for exactly this, `0efe3f9f`). Lifting them here gives each one a production
 * reader — the router — with the test as a second. The door pushes toward the
 * shape that was right anyway.
 *
 * Found by §10 row 3f's sweep (opus-1243 §3), countersigned fable-1619.
 */
import { z } from "zod";
import { OUTFIT_NAME_MAX_LENGTH } from "../../shared/inputLimits";

/** `wardrobe.garments.upload` — a digitized garment entering the rack. */
export const wardrobeUploadInput = z.object({
  imageBase64: z.string().max(10_000_000),
  slotType: z.enum(["full_look", "tops", "bottoms", "shoes", "accessories"]),
  fileName: z.string().max(256).optional(),
});

/**
 * `wardrobe.garments.quickDetect` — the lightweight scan.
 *
 * It is NOT `wardrobeUploadInput` with a renamed field, however alike they
 * read: its slot enum has no `full_look`, because a quick detect targets one
 * garment. Kept apart rather than derived, so narrowing one cannot silently
 * narrow the other.
 */
export const wardrobeQuickDetectInput = z.object({
  imageBase64: z.string().max(10_000_000),
  targetSlot: z.enum(["tops", "bottoms", "shoes", "accessories"]),
});

/**
 * `wardrobe.vto.refine` — a try-on result plus an instruction to change it.
 *
 * ⚠ `.strict()` IS PART OF THE SCHEMA AND IS THE THING THE OLD COPY LOST.
 * Invariant 4: an unknown field is rejected rather than silently dropped.
 */
export const wardrobeRefineInput = z.object({
  currentResultUrl: z.string().url(),
  modelImageUrl: z.string().url(),
  garmentId: z.number(),
  instruction: z.string().max(500),
  allGarmentIds: z.array(z.number()).optional(),
  tattooMap: z.object({
    hasTattoos: z.boolean(),
    tattooAreas: z.array(z.string()),
    cleanAreas: z.array(z.string()),
    promptFragment: z.string(),
  }).optional(),
  sessionId: z.number().optional(),
}).strict();

/** `wardrobe.vto.classifyEdit` — is this instruction a small edit or a re-shoot? */
export const wardrobeClassifyEditInput = z.object({
  instruction: z.string().min(1).max(500),
});

/** `wardrobe.outfits.save` — a named set of garments. */
export const wardrobeOutfitSaveInput = z.object({
  name: z.string().min(1).max(OUTFIT_NAME_MAX_LENGTH),
  garmentIds: z.array(z.number()).min(1),
  styleNotes: z.record(z.string(), z.string()).optional(),
  resultThumbUrl: z.string().url().optional(),
});

/**
 * `wardrobe.vto.generate` — the try-on itself.
 *
 * ⚠ `.strict()`, and the old copy had lost it. Its `garmentIds` ceiling of 5 is
 * the one number in this module that is a product rule rather than a storage
 * bound, which is why it is not in `shared/inputLimits.ts`: nothing on the
 * client caps a box with it.
 */
export const wardrobeVtoGenerateInput = z.object({
  modelImageUrl: z.string().url(),
  garmentIds: z.array(z.number()).min(1).max(5),
  styleNotes: z.record(z.string(), z.string()).optional(),
  tattooMap: z.object({
    hasTattoos: z.boolean(),
    tattooAreas: z.array(z.string()),
    cleanAreas: z.array(z.string()),
    promptFragment: z.string(),
  }).optional(),
  sessionId: z.number().optional(),
}).strict();

/** `wardrobe.sessions.create` — a try-on session against one model image. */
export const wardrobeSessionCreateInput = z.object({
  modelId: z.number().optional(),
  modelImageUrl: z.string().url(),
}).strict();

/**
 * `wardrobe.garments.import` — a garment cut out of a decomposed photograph.
 *
 * ⚠ `cropUrl` was ABSENT from the old copy altogether, so the three arms
 * validating against it could say nothing about the field that carries the cut.
 */
export const wardrobeImportInput = z.object({
  sourceImageUrl: z.string().url(),
  cropUrl: z.string().url().optional(),
  label: z.string(),
  slotType: z.enum(["full_look", "tops", "bottoms", "shoes", "accessories"]),
});
