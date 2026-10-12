/**
 * THE REBUILD DOOR — every road that would send a customer's pictures or words
 * to the retired Gemini client, shut (#2315 step 1).
 *
 * **His word, 2026-10-12 (terminal), verbatim:** *"1) wardrobe is getting
 * retired. 2) canvas is gertting redesigned and is calling gemini since its old
 * routing. 3) older casting refine route is getting retired. // id retire the
 * paths and remove the key"* — and, asked *"OK to switch off the wardrobe and
 * editing a cast on the canvas now, so no pictures go to Google?"*, **"yes"**.
 *
 * Why now: N2d's terms promise (#2314) that we do not train on a customer's
 * characters has to be true of every provider that receives their pictures, and
 * the unpaid tier of that provider's API does train.
 *
 * # What this is, and what it deliberately is not
 *
 * It is a DOOR, in the shape of the two before it (`shared/wardrobeTryOnDoor.ts`,
 * #1537; `shared/canvasCastDoor.ts`, #1785): a compiled fact both halves read,
 * a refusal thrown at each procedure's mouth BEFORE any charge, rate-limit slot
 * or operation row, and a structural backstop the mouth list cannot miss. The
 * backstop here is stronger than theirs: it is `getAiClient()` itself
 * (`server/casting/geminiClient.ts`), the ONE place in the server that reads the
 * key and constructs the client, so a road nobody listed below still sends
 * nothing — it fails instead. Deleting the code is step 2 of the card; removing
 * the key is step 3. Nothing a customer owns is touched: reading, listing,
 * renaming, restoring and deleting casts, garments, looks and boards all stay
 * open.
 *
 * # Why it says nothing about engines
 *
 * The disappearing-technology law's one narrow prohibition: no engine name on a
 * path somebody must walk. The customer is told the thing is not available
 * right now and that their work is safe — never which vendor, model or key
 * is involved.
 */

/**
 * WHETHER THE DOOR IS OPEN — the one fact, read by the server's refusal, by the
 * client's surfaces and by the Gemini client factory alike.
 *
 * ⚠ **Not a feature flag, and must not become one.** His word is compiled in:
 * no environment variable, no per-user scope. The road does not come back by a
 * switch — step 2 deletes it.
 *
 * Typed `boolean` rather than left to infer `false`, so guarded branches stay
 * ordinary conditionals that still typecheck (the wardrobe door records the 16
 * errors a literal type cost).
 */
export const REBUILD_DOOR_OPEN: boolean = false;

/**
 * What a customer is told. One sentence of state, one of reassurance, no
 * machinery; it says NOT AVAILABLE rather than failed.
 *
 * #2329: it no longer says "while we rebuild it" — true only of the canvas,
 * which is being redesigned, while the wardrobe and the old refine road behind
 * this same door are being RETIRED — and it says "characters", the customer's
 * word since #2320/#2322, never "casts". It no longer names garments in the
 * sentence; that promise is not dropped, it is #2315 step 2's to keep: deleting
 * the wardrobe code must never delete a customer's garments.
 */
export const REBUILD_DOOR_CLOSED =
  "This isn't available right now. Your characters and pictures are safe and still here.";

/** The machine-readable half, carried in the refusal's `cause`. */
export const REBUILD_DOOR_CLOSED_CODE = "REBUILD_DOOR_CLOSED" as const;

/**
 * Every procedure refused at its mouth, named once so the guard's population is
 * derived from the list the routers are written against.
 *
 * Read at the code 2026-10-12 — each one's handler reaches a function that calls
 * `getAiClient()` (`server/casting/gemini*.ts`, `server/wardrobe/*.ts`,
 * `server/casting/backViewGate.ts`, `server/casting/identity/editAuthority.ts`,
 * `server/casting/promptParser.ts`) on its ordinary path:
 *
 * - the legacy casting environment the canvas opens (`CastingTakeover`):
 *   `parsePrompt`, `enhance`, `suggestions`, `analyzeReference`,
 *   `compactPrompt`, `models.create`, and the canvas comp card's paid view
 *   refresh `refreshSlots` (left open by #1785 as "a second product act" —
 *   this card is that act);
 * - the admin-only legacy roads sealed to staff by #1654 (`castingImage`,
 *   `iterate`, `mintPackage`), because a staff account's pictures are pictures
 *   too;
 * - the seven wardrobe asks the try-on door did not cover, because they reach a
 *   text-tier model rather than a shut-down image id.
 *
 * NOT here, each for a stated reason: the six try-on procedures (their own door,
 * #1537); `boardOps.runGeneration.execute`, `runVariations.execute` and the
 * recast branch of `applyModelEdit.execute` (their own door, #1785);
 * `generation.reconcile` (already refuses unconditionally); and the `evidence.*`
 * ink roads, which refuse at their own scope flag (`R7_EVIDENCE_COMPOSER_SCOPE`,
 * `off` in production) — and all of these meet the `getAiClient()` backstop
 * regardless. (`refreshSlots`'s evidence-package branch sits behind the same
 * mouth as its ordinary branch, so it is refused here too.)
 *
 * Deliberately left OPEN: `wardrobe.model.upload` and `wardrobe.sessions.create`
 * store a photograph in our own bucket and call no provider; the restore, plan,
 * history and package-state reads only rearrange what is already stored.
 */
export const REBUILD_DOOR_CLOSED_PROCEDURES = [
  "generation.parsePrompt",
  "generation.enhance",
  "generation.suggestions",
  "generation.analyzeReference",
  "generation.compactPrompt",
  "generation.iterate",
  "generation.castingImage",
  "generation.mintPackage",
  "generation.refreshSlots",
  "models.create",
  "wardrobe.garments.quickDetect",
  "wardrobe.vto.detectResultGarments",
  "wardrobe.vto.classifyEdit",
  "wardrobe.vto.checkIdentity",
  "wardrobe.decompose.analyze",
  "wardrobe.model.analyzeTattoos",
  "wardrobe.model.checkQuality",
] as const;

export type RebuildDoorClosedProcedure = (typeof REBUILD_DOOR_CLOSED_PROCEDURES)[number];
