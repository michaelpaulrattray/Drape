# Claude prompt — final identity-edit interim policy revision

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Revise `docs/specs/IDENTITY_EDIT_INTERIM_POLICY.md` one final time using the founder direction below.

This remains a report-only Batch C-prep task. Do not implement code, modify any other file, stage, commit, push, deploy, contact production, or begin Batch A-coupled/Batch C implementation.

Compare every statement against:

- The live code
- `CASTING_SYSTEM_R6_EXECUTION_PLAN.md`
- `CASTING_SYSTEM_AUDIT_ADDENDUM_REVISED.md`
- The original propagation/composer addendum
- `IDENTITY_WRITER_INVENTORY.md`

Challenge any direction you believe conflicts with evidence. State the disagreement and exact evidence rather than silently changing the decision.

## 1. State the product boundary clearly

Casting Studio creates Drape’s reusable character identity and neutral character/casting sheet.

It establishes:

- Face and facial structure
- Hair
- Body build and proportions
- Skin and natural physical features
- Permanent marks once the Batch D composer exists
- Neutral casting presentation
- The canonical views used to preserve identity downstream

Casting is not the primary outfit-styling environment.

Downstream responsibilities are:

- Canvas: flexible image creation by combining the cast character with outfit/reference images and prompts.
- Wardrobe: precise garment digitization, virtual try-on and reusable controlled outfit workflows.

The product promise is:

> Cast the person once. Dress and direct them downstream.

Canvas and Wardrobe outputs must not rewrite the underlying cast identity.

Add an explicit early statement that this policy:

- Governs every current Casting Studio editing and generation surface.
- Is an R6 interim policy, not the final capability ceiling.
- Will be superseded where appropriate by the Batch D/R7 evidence-composer architecture.
- Temporarily refuses operations that the final product is intended to support once persistent visual evidence exists.

## 2. Replace the identity-versus-cosmetic binary with three practical classes

The current policy’s `cosmetic` category is too broad. It treats lighting corrections and adding a hat as if they were the same product operation.

Define three semantic classes:

### A. Identity changes

Changes to who the person is:

- Face
- Hair
- Build
- Age presentation
- Gender presentation
- Skin tone
- Permanent marks

These follow the evidence, status and view rules in the policy.

### B. Presentation/styling changes

Changes to what the person is wearing or how they are styled:

- Clothing and complete outfits
- Hats and other headwear
- Jewelry and accessories
- Shoes and props
- Makeup and other applied looks

These do not change identity, but they are outside the neutral cast sheet.

In Casting, refuse and route them honestly:

> “Casting creates the reusable character identity. Apply this on Canvas for a quick creative result, or continue to Wardrobe for precise garment control.”

Do not write presentation changes into the cast identity document and do not propagate them through the Casting composer.

### C. Image-only refinements

Changes to the selected photograph:

- Lighting and colour correction
- Background
- Pose and expression
- Framing
- Sharpness and quality
- Artifact correction and retouching that does not alter identity
- Other clearly photograph-specific adjustments

Supported image-only refinements may proceed on the selected view, but they are asset-only.

They must not update:

- `masterPrompt`
- `technicalSchema`
- preferences
- identity attributes
- identity amendments
- any other identity-document representation

They must not run automatic compaction or reconcile the resulting photograph back into identity. They do not stale identity siblings.

Update the classifier contract and test matrix so styling/presentation cannot be mistaken for an allowed image-only refinement.

Common terms such as hat, cap, beanie, headpiece, helmet, glasses, sunglasses, necklace, earrings, jacket, dress, shirt, trousers, shoes, garment, outfit and look must route correctly. Do not rely only on a small keyword list; the typed classifier still needs a closed presentation taxonomy and fail-closed unknown state.

## 3. Reference images provide evidence, never authorization

Add the existing reference-upload and reference-assisted iterate path as a first-class policy surface. It is live today and cannot be deferred merely by calling future Batch D references out of scope.

The user must explicitly name what they want transferred.

Examples:

- “Apply the hairstyle from the reference” → hair identity rules.
- “Use the jawline from the reference” → face identity rules.
- “Apply the tattoo from the reference” → permanent-mark rules.
- “Put her in the outfit from the reference” → presentation/styling refusal with Canvas/Wardrobe routing.
- “Add the hat from the reference” → presentation/styling refusal.
- “Apply this” / “use this look” / “make her like the reference” → refuse as ambiguous before credits move.

An attached image must never weaken the ordinary classifier. Classify the explicitly requested attribute exactly as if the instruction were text-only.

Mixed reference requests remain most-restrictive-wins.

The current code has contradictions that must be documented:

- The UI advertises “apply eye makeup from reference.”
- The UI advertises hairstyles, tattoos, accessories and looks.
- `analyzeReferenceForTransfer` excludes makeup and garments.
- The generation transfer prompt blocks makeup, clothing, styling, jewelry and accessories regardless of the request.
- Reference-generated suggestions include identity-level features such as hair, lips, brows, eye shape, nose, jawline and cheekbones.

Update the policy so:

- The UI advertises only operations the server actually supports.
- Every suggestion passes through the same server-side guard.
- Suggestion generation never constitutes authorization.
- Vague reference requests refuse before money moves.
- Styling references route to Canvas/Wardrobe.
- Hairstyle/face references follow the same draft/headshot restrictions as typed identity edits.

## 4. Preserve the intended hairstyle workflow

Pending the ratified face/hair ruling:

- A hairstyle reference may be applied to a draft’s `frontClose` headshot.
- The edited headshot becomes the newest visual anchor.
- If sibling views already exist, every affected sibling is marked out of date.
- Refresh regenerates those views from the new anchor and deliberate identity text.
- If the views do not yet exist, later generation uses the edited anchor.
- The reference cannot authorize the same edit on a minted model or a non-anchor view.
- Below-shoulder hair-length limitations remain an explicit founder choice because the headshot may not evidence them.

This is an identity edit, not an image-only cosmetic adjustment.

## 5. Preserve the intended tattoo/composer future without pretending it exists now

The original addendum’s intended Batch D flow remains the target:

1. A permanent mark is authored on a view that can show it.
2. Drape captures a contextual anatomical zone crop from the successful edited image.
3. The crop includes enough surrounding anatomy to preserve placement.
4. The mark registry stores its category, body zone and evidence.
5. A visibility probe checks which sibling views expose that zone.
6. Affected views are generated from the identity plate, clean body plate and relevant zone crops.
7. Unaffected views are not regenerated.
8. Generative drift is expected and honestly disclosed; visual evidence improves consistency but does not promise pixel-identical reproduction.

This is not implemented in R6.

Therefore, under the interim:

- Adding, removing or modifying permanent marks on an existing cast is refused.
- Reference-assisted tattoo edits are also refused.
- Refusal copy should explain that consistent mark propagation is not available yet.
- Do not permanently describe the product as incapable of this; identify the temporary refusal as superseded when the Batch D composer is built.

The Casting composer is for persistent identity evidence such as permanent marks. It is not an outfit-propagation system. Outfit application belongs downstream on Canvas or in Wardrobe.

## 6. Cosmetic/image refinements must not rewrite identity

Correct the existing contradiction where the report says cosmetic edits behave as today, including freeze-and-append.

The binding Batch C outcome is:

- Image-only refinements create an asset version only.
- Freeze-and-append dies.
- Identity-document fields remain unchanged.
- Automatic compaction does not run.
- Automatic reconcile does not write the resulting photograph back into identity.

Add byte-unchanged or equivalent tests for identity fields through every applicable writer and status.

Clearly distinguish CURRENT CODE from REQUIRED IMPLEMENTATION.

## 7. Disable automatic reconcile for the interim

A newest-image check is insufficient authorization.

Current reconcile:

- Runs after successful iterations, including cosmetic ones.
- Rewrites the whole identity description from an image.
- Does not prove the operation was an authorized identity edit.
- Has no durable classification provenance or document-version protection.

Recommend disabling automatic reconcile during the interim.

Keeping it would require durable operation provenance, ratified classification authorization, source-document version/hash checking, compare-and-swap behaviour, a newest-head recheck at commit and protection for every identity field. Do not recommend that complexity without strong evidence that it is necessary for R6.

Update the test matrix and founder ruling accordingly.

## 8. Use three-state mark prompt selection

The prompt selector must not remain a binary choice between clean skin and tattoo persistence once the broad mark vocabulary is shared.

Required target:

- Ink/tattoo/body art → tattoo persistence rule.
- Non-ink permanent mark → neither clean-skin/no-piercing negatives nor tattoo-specific persistence.
- No permanent mark → clean-skin rule.

Tests must prove:

- Non-ink marks never receive `CLEAN_SKIN_RULE`.
- Non-ink marks never receive `TATTOO_PERSISTENCE_RULE`.
- Ink receives tattoo persistence.
- Mark-free identities receive clean-skin prompting.

Do not claim that the neutral non-ink branch provides persistence. It only prevents active erasure and incorrect tattoo instructions.

## 9. Pinned views must not bypass package integrity

A view pinned before an identity change can currently avoid being marked stale and remain falsely labelled fresh.

Interim rule:

- Identity-changing anchor operations mark every affected sibling stale, including pinned siblings.
- Pinning prevents automatic replacement; it does not hide staleness.
- Mint refuses any known-outdated selected-tier view, pinned or unpinned.
- Resolution is unpin and refresh, restore a coherent identity/view state, or cancel/rollback where available.
- Pinning cannot waive character-sheet integrity.

Update the evidence matrix, mint policy and tests.

## 10. Correct failed-generation credit wording

A failed slot attempt is refunded. A later successful retry is charged normally because it remains a missing slot.

Remove wording such as:

- “Retry is free.”
- “Retrying at no extra cost.”
- “Retry this failed view—it’s free.”

Use honest wording equivalent to:

> “The failed attempt was refunded. Retrying charges the normal view price only if generation succeeds.”

Confirm this against the atomic-credit implementation.

## 11. Plain-English and test requirements

Replace ambiguous language such as “every typed edit” with “every free-text image-edit instruction” where that is what is meant.

Replace “stale marks fire” with “stale flags are applied.”

Expand the test matrix to cover:

- Identity, presentation and image-only classes.
- Text-only and reference-assisted requests.
- Hat/outfit/accessory routing.
- Hairstyle reference transfer under the draft/headshot rule.
- Tattoo reference refusal before charging.
- Vague reference refusal before charging.
- Mixed reference requests.
- Reference suggestions passing through the guard.
- Image-only refinement leaving all identity fields unchanged.
- Reconcile disabled.
- Mark prompt three-state selection.
- Pinned stale views blocking mint.
- Correct refund and retry behaviour.
- No Canvas or Wardrobe result mutating the source cast identity.

## Deliverable

Revise only `docs/specs/IDENTITY_EDIT_INTERIM_POLICY.md`.

Then report:

1. Exactly what changed for each numbered section above.
2. Any direction challenged, with exact code/document evidence.
3. The revised founder rulings in concise plain English.
4. Any remaining genuine founder choice.
5. Any live UI promise that still contradicts server behaviour.
6. Confirmation that only the policy document changed.
7. Confirmation that nothing was staged, committed, pushed, deployed or implemented.

Stop and wait for founder review.
