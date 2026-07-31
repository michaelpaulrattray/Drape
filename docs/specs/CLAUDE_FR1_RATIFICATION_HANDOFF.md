# Claude prompt — FR-1 founder ratification handoff

The founder has now answered and approved the remaining FR-1 policy rulings.

This task is **documentation only**. Fold the decisions into the policy, perform a consistency review, report the result, and stop.

Do not implement code. Do not begin Batch B, Batch A-coupled, or Batch C. Do not stage, commit, push, deploy, migrate, or contact production.

## Primary document

Revise:

- `docs/specs/IDENTITY_EDIT_INTERIM_POLICY.md`

Preserve the verified Revision 7 architecture and code evidence. Convert the document from an open decision report into the founder-ratified implementation contract.

## Required status

After all decisions have been folded faithfully, mark the policy:

> **Status: FOUNDER-RATIFIED 2026-07-16 — binding implementation contract; Batch C implementation pending. This ratification approves the policy, not a claim that current code enforces it. Until the shared guard and test matrix are implemented and verified, no newly permitted identity-edit capability is considered available; existing safety refusals remain.**

Remove the old `DRAFT`, `NOT IN FORCE`, and `nothing is approved` status language.

Do not claim R6, Batch C, or any new capability is implemented merely because its policy is ratified.

## Ratified founder decisions

### R1 — supported draft face/hair identity edits

**Ratified: allow.**

Allow only ledger-supported face/hair identity leaves on a draft model's authoritative `frontClose` edit path.

A successful authorized edit:

- Produces the normalized typed identity patch.
- Becomes the new identity anchor.
- Creates a new identity revision.
- Updates the matching identity fields atomically.
- Marks every filled sibling view stale, pinned included.
- Leaves no partially updated identity state.

Non-anchor identity edits refuse with routing to the headshot. Minted identity edits follow the existing fork rule.

This ruling does **not** include localized permanent marks.

Beauty spots, moles, freckles or freckle clusters, birthmarks, scars, tattoos, piercings, pigmentation marks, and other location-specific marks remain outside R1 and refuse as edits during R6. They require the Batch D/R7 evidence-composer architecture.

### R1b — below-shoulder hair length

**Ratified: refuse during R6.**

The current headshot cannot reliably evidence hair extending below the shoulders.

Above-shoulder supported hair edits remain eligible under R1.

Below-shoulder hair-length edits refuse during R6. Record them as a candidate for reconsideration in Batch D/R7 after full-body evidence, revision-wide regeneration, and calibration exist. Do not promise that the capability automatically becomes available merely because R7 begins.

### R1c — natural skin texture

**Ratified: allow as text-only on the draft authoritative headshot.**

Natural skin texture means diffuse physical surface qualities such as visible pores or naturally smooth, coarse, or fine-grained skin.

It excludes:

- Beauty spots, moles, freckles, localized pigmentation, scars, tattoos, and other permanent marks.
- Makeup.
- Cosmetic skin treatments.
- Temporary retouching or blemish cleanup.

Reference-assisted skin-texture transfer remains unavailable while the live prompt rejects it. Image-only retouching remains asset-only and never changes identity.

### R2 — classifier outage or uncertainty

**Ratified: fail safely.**

When classification is unavailable, malformed, ambiguous, parent-only, or uncertain, refuse before credits, generation records, image calls, or identity writes.

The refusal is free, retryable, and explained clearly. Never fall back to an unchecked image-only edit.

### R3 — structured attribute editor

**Ratified: harden it.**

Use a strict server-owned field schema. Supported draft changes to build, age, gender, skin tone, ethnicity, and ethnicity blends may proceed only through the typed normalized patch, field-specific persistence handlers, new-anchor/new-revision commit, and stale-all-siblings flow.

Until that implementation exists, refuse unsupported structured changes and route users to re-cast. Unknown keys never pass through.

### R6 — marks advertised during initial casting

**Ratified: advertise tattoo/ink only during R6.**

Use honest wording that the design may vary between views.

Do not advertise or promise scars, birthmarks, beauty spots, pigmentation marks, piercings, or other mark families during R6. Existing mark-edit refusals remain.

### R7 — automatic reconcile

**Ratified: keep automatic reconcile off.**

Identity documents change only through deliberate authorized operations. The newest image never silently rewrites the identity document.

### R8 — mint integrity

**Ratified: enforce the three separate validity checks.**

Mint checks:

1. Identity-anchor validity.
2. Display-headshot validity.
3. Selected-tier view validity.

Refuse stale, failed, missing, cross-revision, or unknown-authority states as specified by the policy.

Every refusal must tell the user gracefully and specifically what is wrong and how to resolve it. Do not use one vague `headshot out of sync` message for every state.

### R9 — chin shape and brow colour

**Ratified: refuse during R6.**

Do not add rushed persistence fields during R6. Chin shape and brow-colour edits remain unsupported until dedicated durable mappings are designed later. Jaw-adjacent supported requests may route through the mapped jawline leaf when semantically accurate; never silently reinterpret an explicitly different request.

## Additional founder clarification — makeup and eyelashes

Record this product boundary explicitly without creating an accidental new R6 edit capability:

- Casting remains a neutral reusable identity environment.
- Makeup, mascara, false eyelashes, lash extensions, lash lifts, and other cosmetic lash treatments are presentation/styling. Refuse them in Casting and route them to Canvas.
- These presentation changes never update cast identity documents or canonical views.
- Naturally long, dense, sparse, straight, or curled eyelashes are natural anatomy in principle and may be described in the initial physical casting brief.
- R6 has no dedicated eyelash leaf, durable mapping, scoped prompt contract, or post-creation tests. Therefore post-creation natural-eyelash edits remain unsupported and refuse during R6.
- Do not smuggle eyelashes through `eyeShape`, `browShape`, `features`, or any generic parent category.
- A dedicated `person.face.eyelashes` identity field may be considered later if product demand justifies it.
- Future styled reference sheets may carry production makeup downstream without changing the neutral canonical cast.

## Remove resolved decision ambiguity

Convert the founder-rulings section from open questions and recommendations into a dated ratification record containing the selected decisions above.

Perform a complete document sweep so resolved choices are no longer described as pending or optional.

Remove or rewrite, where applicable:

- `pending R1`
- `pending R1b`
- `pending R1c`
- `pending R3`
- `pending R9`
- `recommended` language for the now-decided rulings
- safe/permissive alternatives that are no longer live choices
- statements implying no supported subset has been approved

Preserve genuine **implementation pending** language. The policy is ratified, but the code still does not enforce it.

Ensure the body, identity-leaf ledger, authorization registry, refusal behaviour, test matrix, footer, and status all agree with the ratified answers.

Conditional registry gates should now reflect the chosen policy while remaining unavailable at runtime until Batch C implements and verifies the shared boundary.

## D-56 timing

Do **not** write the operational D-56 entry yet.

The execution plan places D-56 in Batch C after the shared guard and tests exist. Keep wording truthful:

> The ratified policy and its supersessions will be recorded operationally in D-56 when Batch C implementation lands.

Do not make a decision-log entry imply that enforcement is already shipped.

The existing D-30 future reference-sheet pointer is unrelated and should remain unchanged unless a factual correction is required.

## Consistency review

After editing, run a read-only consistency sweep proving:

1. No `DRAFT` or `NOT IN FORCE` status remains for this policy.
2. The status clearly says founder-ratified but implementation pending.
3. All nine rulings are recorded as decisions, not questions.
4. R1 and R1c explicitly exclude localized permanent marks.
5. Below-shoulder hair is refused in R6 and only reconsidered—not promised—in R7.
6. Makeup and cosmetic lashes route out of Casting.
7. Natural eyelashes create no post-creation R6 authorization.
8. Mint refusal copy is state-specific and graceful.
9. No newly ratified capability is described as currently implemented.
10. D-56 remains deferred until Batch C.
11. The test matrix reflects every ratified choice.

## Final response

Report:

1. Exactly what changed in the policy.
2. The final status line.
3. A compact table of all nine ratified rulings.
4. How beauty spots/marks, natural skin texture, makeup, and eyelashes are distinguished.
5. Every remaining code contradiction and required Batch C implementation item.
6. Whether any genuine founder decision remains open for FR-1.
7. Any direction you disagree with, with plain-English reasoning.
8. The exact files changed.

Confirm explicitly:

- No production code was changed.
- No implementation batch was started.
- Nothing was staged or committed.
- Nothing was pushed or deployed.
- Production was not contacted.

Stop for founder/Codex review.
