# Fable 5 — required corrections to the W5 execution plan

> **Status: historical record.** A one-shot working prompt/handoff from the R6/R7 review era; not current guidance. Current law lives in CLAUDE.md and the governing plans in `docs/specs/` (#69 stamping sweep, 2026-08-28).


Revise `docs/specs/CASTING_SYSTEM_R6_W5_EXECUTION_PLAN.md` only. Do not implement product code, stage, commit, push, deploy, contact production, or spend credits.

The revised strip-first Package Health direction is approved. Keep it as written:

- W5 establishes truthful current/stale/refreshing/failed/missing states in the Casting view strip.
- R7 adds the priced per-view refresh/retry/add controls and refresh-all action.
- Package Health remains the optional detailed surface.
- Nothing refreshes or charges automatically.

Before Codex executes W5, correct the following W5-A holes.

## 1. The plan cannot leave structured identity edits ungated

The current plan gates only `generation.iterate` when `authorization.class === "identity"`, then explicitly leaves `applyModelEdit`'s structured identity update ungated.

That does not close the release blocker.

`server/lib/boardOps.ts` currently proves that a non-rerun structured update:

1. builds an authorized structured identity patch;
2. computes the updated identity document;
3. generates a fresh headshot in NEW mode;
4. commits that generated image as the new anchor through `commitIdentityEdit`;
5. stales sibling views.

This path permits structured changes including skin tone, hair, and face fields. It has the same dangerous outcome as the live pink-hair failure: a generated image can become canonical without proving that only the authorized structured delta changed.

Revise W5-A so the post-generation protected-identity gate covers both:

- free-text/reference-assisted identity iteration in `castingRefinement.ts`; and
- non-rerun structured identity updates in `executeApplyModelEdit`.

The old current anchor is the comparison source; the normalized structured patch is the authorized delta. The `intent: "rerun"` re-roll path is a separate deliberate behavior and must be classified explicitly rather than accidentally treated as a structured patch.

If the fresh-render structured path cannot pass an honest same-person gate reliably, the plan must stop and surface that as a release-blocking architecture/product decision. It may not declare the risk R7 while leaving the identity-changing door enabled in R6.

Add deterministic tests proving structured hair color, structured skin tone, and a structured face-field update all pass through the gate; a failed verdict commits no anchor, document, board landing, version, or stale state and refunds truthfully.

## 2. Validate before uploading the candidate to R2

The current plan sequences:

1. generate;
2. upload candidate to R2;
3. validate;
4. possibly generate and upload a second candidate;
5. best-effort delete "the" uploaded object on final refusal.

That can orphan the first rejected object when the retry succeeds, and can orphan two objects when both attempts fail. Deriving a deletion key from a public URL also adds avoidable cleanup risk.

Prefer this sequence:

1. generate a raw candidate image;
2. compare the original source and raw candidate;
3. retry from the original source when required;
4. upload only the candidate that passed;
5. commit only the uploaded passing candidate.

Refactor the AI-service boundary narrowly enough to expose a validate-before-upload path without changing unrelated generation consumers. Do not persist failed candidates merely to make the validator convenient.

If pre-upload validation is genuinely impossible, the fallback plan must track every uploaded candidate key explicitly and prove cleanup of:

- the first failed candidate when a retry passes;
- both candidates when both fail;
- the uploaded passing candidate when the later database commit fails.

Add tests that count uploads/deletes. A gate failure before persistence should leave no R2 object behind.

## 3. A failed candidate must not poison the retry conversation

The plan's retry currently calls `iterateModel` again after the first candidate fails the gate. With chat-backed iteration, that retry can reuse the same model-scoped conversation that just produced the rejected identity.

Revise the retry contract so it:

- uses the original pre-edit source image and the same authorized normalized delta;
- does not treat the rejected candidate as its new source;
- clears/resets only that model's failed chat session or forces the retry through a stateless/fresh-session path;
- never clears another model's session;
- records which attempt passed or failed for audit/debugging without exposing provider internals to the user.

Add a test proving that a first failed verdict cannot feed candidate 1 or its chat state into candidate 2.

The proposed session key `userId:modelId` is otherwise sound. `generateCastCandidate` creates its new model row before calling image generation, so fork/variation creation can and must pass the newly created `model.modelId`, not the parent model ID.

## 4. Protected dimensions must be granular and observable

The proposed protected list groups independent identity leaves, for example:

- `hair style/length/texture`;
- `face shape/jawline/cheekbones`.

If authorizing one leaf subtracts the whole group, an authorized hairstyle edit could silently permit unrequested hair-length and texture changes. A jawline edit could exempt face shape and cheekbones.

Revise the gate contract so authorization exempts only the exact normalized leaves being changed. Keep separate protected dimensions for every independently authorizable identity leaf.

Also make the verdict frame-aware. A headshot cannot honestly verify full-body build or a mark that is not visible in either comparison image. The validator must distinguish:

- verified unchanged;
- verified changed;
- not observable in this frame;
- uncertain/unverifiable.

Hidden document fields remain protected by the typed patch/atomic document commit; the visual gate must not pretend it visually inspected attributes outside the frame. Define when an unobservable visual field is acceptable and when uncertainty in a visible protected field must fail closed.

Use a strict per-dimension response schema rather than relying only on a broad `same_person` boolean plus a free list of violations. Unknown dimensions, malformed responses, or uncertainty about a visible protected dimension fail closed.

Add exhaustive tests showing that authorizing each leaf exempts that leaf only, especially:

- hair color does not exempt hair length, texture, style, hairline, or skin tone;
- hair style does not exempt length or texture;
- jawline does not exempt face shape or cheekbones;
- a headshot does not falsely claim to have verified a non-visible full-body attribute.

## 5. Update the W5-A proof and stop conditions

Replace the single ad-hoc “more than ~1 in 5” browser-drive threshold with a small fixed calibration matrix covering at least:

- legitimate hair-color edit;
- legitimate hairstyle or length edit;
- legitimate structured skin-tone edit;
- legitimate structured face-field edit;
- deliberately injected skin-tone drift;
- deliberately injected face drift;
- validator timeout/malformed response;
- retry after a failed first candidate.

The browser drive remains human-graded evidence, not a deterministic unit assertion. Unit/integration tests must prove sequencing, persistence, refunds, exact authorized-delta mapping, retry isolation, and upload hygiene. If legitimate structured edits cannot pass reliably, stop for founder/Fable review rather than shipping an ungated path or weakening the protected set.

## Deliverable

Update the existing W5 plan in place. In your final response, state:

- how structured identity edits are now covered;
- whether validation occurs before R2 upload;
- how a failed attempt's conversation is isolated from the retry;
- how exact-leaf and frame-aware protection works;
- which tests were added to the plan;
- that only the uncommitted plan document changed.
