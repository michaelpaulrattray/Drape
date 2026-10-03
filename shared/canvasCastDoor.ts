/**
 * THE CANVAS CASTING DOOR — shut, on his word (#1785, 2026-10-03).
 *
 * **His reply, verbatim and entire: *"1758) seal."*** Said of the canvas
 * "Refresh" road after #1785 read it link by link: a cast node that has gone
 * out of sync draws a primary button, pressing it charges
 * `CREDIT_COSTS.castingImage` (70 display credits / 350 ledger), and the render
 * goes to `gemini-3-pro-image-preview` and its only fallback
 * `gemini-3.1-flash-image-preview` — both of which Google's own deprecations
 * page lists as **shut down on 2026-06-25** (`shared/vendorModelStatus.ts`).
 * His three options were SEAL, RE-POINT or LEAVE; he took the first.
 *
 * # Why this is a sibling of `shared/wardrobeTryOnDoor.ts` and not a new idea
 *
 * That file is the same ruling on the same engines three days earlier (#1537,
 * *"SWITCH IT OFF"*), and this road's shape is identical: a paid ask whose
 * engine is dead, on a surface that is not being worked on. Everything here is
 * that file's structure — the one compiled fact, the customer sentence beside
 * it, the machine-readable code, the derived procedure list — because a second
 * door invented from scratch is a second set of rules to keep honest, and this
 * repository has paid for that before (working law 4).
 *
 * # It is a DOOR, not a retirement
 *
 * Nothing is deleted, no id is re-pointed, no row is dropped, and no board,
 * node, cast or picture a customer already has is touched. Reading a board,
 * moving nodes, filling a node from the Library, popping out a view, editing a
 * label, deleting and undoing all still work — none of them reaches an engine.
 * What closes is exactly the set of asks that would spend a customer's credits
 * on a render that cannot succeed.
 *
 * # Why it says nothing about engines
 *
 * The disappearing-technology law's one narrow prohibition: no engine name on a
 * path somebody must walk. A customer meeting this door is told the thing is
 * unavailable and that their work is safe — never that a vendor shut a model
 * down, which is our homework and not theirs. The vendor fact lives in
 * `shared/vendorModelStatus.ts`, which no customer reads.
 *
 * # What is deliberately NOT closed here, and the difference is stated
 *
 * `generation.refreshSlots` is the OTHER live canvas road on the same dead
 * ids. It is left open by this card on purpose, and
 * `server/legacySpendSeal.test.ts`'s *"what is deliberately NOT sealed"* arm is
 * where that record already lives. The reason is that its canvas surface is the
 * bulk-refresh DIALOG (`BulkRefreshDialog`, reached from `CastNode.tsx`), which
 * names a cost and lists the stale angles — closing it is a different product
 * act from not drawing one button, #1654 put three options for it to him that
 * he has not chosen among, and folding it in here would be a second capability
 * decision shipped under this one's name. It is filed with its recommendation
 * rather than taken.
 */

/**
 * WHETHER THE DOOR IS OPEN — the one fact, read by the server's refusal and by
 * the canvas surface alike, so the button a customer sees and the refusal a
 * request meets cannot disagree.
 *
 * ⚠ **This is not a feature flag and must not become one.** It is his word
 * compiled in: no environment variable, no per-user scope, no runtime read,
 * nothing to set on a service. A flag would imply somebody may turn this back
 * on from a dashboard, and they may not — he chose SEAL over RE-POINT, so the
 * road returns when the canvas is rebuilt on a live engine, which is a build
 * and his word, not a variable. Re-opening is this line plus deleting the calls
 * to {@link assertCanvasCastOpen}, and nothing else, which is why the road
 * behind the door stays compiled and tested.
 *
 * Typed `boolean` rather than left to infer `false`, for the same reason the
 * wardrobe door is: a literal type makes TypeScript narrow every guarded branch
 * to unreachable, and both surfaces want ordinary conditionals that still
 * typecheck when this flips.
 */
export const CANVAS_CAST_OPEN: boolean = false;

/**
 * What a customer is told. One sentence, present tense, no machinery, and it
 * says the thing is UNAVAILABLE rather than that something failed — because
 * nothing failed: we declined to charge them for a render we know cannot land.
 *
 * It names what is safe in the customer's own nouns, which is the half of the
 * wardrobe door's sentence that did the real work: the fear a door like this
 * creates is not "why can't I press this", it is "where did my work go".
 */
export const CANVAS_CAST_CLOSED =
  "Making new pictures on the canvas is unavailable while we rebuild it. Your boards, casts and pictures are safe and still here.";

/**
 * The machine-readable half, carried in the refusal's `cause` so a client can
 * tell this door from an ordinary failure without matching on prose.
 *
 * A code rather than a sentence, because a sentence is allowed to be rewritten
 * for a customer and a branch is not allowed to break when it is.
 */
export const CANVAS_CAST_CLOSED_CODE = "CANVAS_CAST_CLOSED" as const;

/**
 * Every ask that is closed, named once so the guard's population is derived
 * from the same list the router reads rather than typed twice.
 *
 * These are exactly the procedures in `server/routes/boardOps.ts` that spend
 * `CREDIT_COSTS.castingImage` — read at the code 2026-10-03, at every
 * `plannedCredits:` in that router. Each reaches `generateCastingImage` (or
 * `generateCastingImageRaw`) in `server/casting/geminiGeneration.ts`, whose
 * primary and whose entire fallback chain are shut-down ids:
 *
 *   `runGeneration.execute`  → `canvas.cast`       → `executeRunGeneration`
 *   `applyModelEdit.execute` → `canvas.recast`     → `executeApplyModelEdit`
 *   `runVariations.execute`  → `canvas.variations` → `executeRunVariations`
 *                                                  → `generateCastCandidate`
 *
 * ⚠ **`applyModelEdit.execute` IS CLOSED ON ITS RECAST BRANCH ONLY, and that is
 * a fact about the procedure rather than a softening of the door.** The same
 * handler's `decision === "fork"` path declares `plannedCredits: 0`, copies a
 * Cast through `forkEvidenceAwareCast`, and reaches no engine at all — read at
 * the code 2026-10-03. Gating it at the handler's mouth would close a free road
 * that still works perfectly, which is the "deletion wearing a door" this file
 * opens by refusing. `executeApplyModelEdit` proves the split in its own first
 * statement: anything but `update` is refused there as *"Fork is handled by the
 * free exact-copy service."*
 *
 * ⚠ **The `plan` queries beside them stay OPEN, deliberately.** Each is a
 * price-and-eligibility READ that spends nothing and reaches no engine — the
 * same call #1654 made for `mintPackagePlan`, in its own words: *"Sealing a
 * read to close a spend would take a working surface away for nothing."* What
 * stops a customer being quoted a price for a road they cannot walk is the
 * canvas not drawing the action, which is this door's client half.
 */
export const CANVAS_CAST_CLOSED_PROCEDURES = [
  "boardOps.runGeneration.execute",
  "boardOps.applyModelEdit.execute",
  "boardOps.runVariations.execute",
] as const;

export type CanvasCastClosedProcedure = (typeof CANVAS_CAST_CLOSED_PROCEDURES)[number];
