/**
 * THE WARDROBE TRY-ON DOOR — shut, on his word (#1537, 2026-09-30).
 *
 * **His reply, verbatim and entire: *"SWITCH IT OFF"*.** Said of the virtual
 * try-on road after the weekly research scrape (#1535) found it calling
 * `gemini-3-pro-image-preview` and `gemini-3.1-flash-image-preview`, which
 * Google's own deprecations page lists as **shut down on 2026-06-25**. His two
 * options were re-point or retire; he took neither and closed the door until
 * the wardrobe milestone (N8), which is the honest third answer: the feature is
 * not being worked on, so it should not be reachable while its engines are
 * dead.
 *
 * # What this file is, and what it deliberately is not
 *
 * It is a DOOR, not a retirement. Nothing is deleted, no id is re-pointed, no
 * table is dropped, no garment or session a customer already owns is touched —
 * reading, listing, renaming and deleting all still work, because a door that
 * eats somebody's saved work is not a door, it is a deletion wearing one. What
 * closes is exactly the set of asks that would reach a shut-down model.
 *
 * ⚠ **The sentence lives HERE, in `shared/`, so the client's copy and the
 * server's refusal cannot drift.** `resolveVtoErrorCopy` reads this constant
 * rather than matching on a string the server happens to send today — working
 * law 4, and the `vtoErrorCopy` docblock one directory over records what a
 * hand-typed copy of a customer sentence already cost this feature once.
 *
 * # Why it says nothing about engines
 *
 * The disappearing-technology law's one narrow prohibition: no engine name on a
 * path somebody must walk. A customer meeting this door is told the feature is
 * not available and when to expect it back — never that a vendor shut a model
 * down, which is our homework and not theirs. The vendor fact lives in
 * `shared/vendorModelStatus.ts`, which no customer reads.
 */

/**
 * WHETHER THE DOOR IS OPEN — the one fact, read by the server's refusal and by
 * the client's surface alike, so the two cannot disagree about what a customer
 * may ask for.
 *
 * ⚠ **This is not a feature flag and must not become one.** It is his word
 * compiled in: no environment variable, no per-user scope, no runtime read,
 * nothing to set on a service. A flag would imply somebody may turn this back
 * on from a dashboard, and they may not — the road returns on N8 re-pointed or
 * retired, which is a build. Re-opening is this line plus deleting the calls to
 * {@link WARDROBE_TRY_ON_CLOSED_PROCEDURES}' gates, and nothing else, which is
 * why the road behind the door stays compiled and tested.
 *
 * Typed `boolean` rather than left to infer `false`: a literal type makes
 * TypeScript narrow every guarded branch to unreachable, and the two surfaces
 * below want ordinary conditionals that still typecheck when this flips.
 */
export const WARDROBE_TRY_ON_OPEN: boolean = false;

/**
 * What a customer is told. One sentence, present tense, no machinery, and it
 * says the thing is UNAVAILABLE rather than that something failed — which is
 * the whole of his instruction as it reached the card: *"the door's copy says
 * the feature is not available rather than failing"*.
 */
export const WARDROBE_TRY_ON_CLOSED =
  "Virtual try-on is unavailable while we rebuild it. Your garments and looks are safe and still here.";

/**
 * The machine-readable half, carried in the refusal's `cause` so a client can
 * tell this door from an ordinary failure without matching on prose.
 *
 * A code rather than a sentence, because a sentence is allowed to be rewritten
 * for a customer and a branch is not allowed to break when it is.
 */
export const WARDROBE_TRY_ON_CLOSED_CODE = "WARDROBE_TRY_ON_CLOSED" as const;

/**
 * Every ask that is closed, named once so the guard's population is derived
 * from the same list the router reads rather than typed twice.
 *
 * These are exactly the procedures whose road reaches a shut-down image id —
 * read at the code 2026-09-30, at the seven call sites of `digitizeGarment`,
 * `generateVirtualTryOn`, `incrementalComposite`, `refineGarment` and
 * `seedSession` in `server/routes/wardrobe.ts`. Nothing else in the wardrobe
 * router touches an engine at all.
 */
export const WARDROBE_TRY_ON_CLOSED_PROCEDURES = [
  "wardrobe.garments.upload",
  "wardrobe.vto.generate",
  "wardrobe.vto.incremental",
  "wardrobe.vto.refine",
  "wardrobe.decompose.import",
  "wardrobe.sessions.seedChat",
] as const;

export type WardrobeClosedProcedure = (typeof WARDROBE_TRY_ON_CLOSED_PROCEDURES)[number];
