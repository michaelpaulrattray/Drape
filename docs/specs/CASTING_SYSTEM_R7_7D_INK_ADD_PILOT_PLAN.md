# R7-7D - ink/add pilot execution plan

**Status:** implementation plan for review. It authorizes no migration,
generation, credit movement, storage write, feature-flag change, production
operation, or deployment by itself.

**Authority:** D-43, D-56, D-62, D-65, D-68, D-70,
`CASTING_SYSTEM_R7_6_EVIDENCE_COMPOSER_DESIGN.md`, the completed R7-7A/B/C
snapshot and private-evidence boundaries, the R7 operation/credit contract,
and the access-control invariants in `CLAUDE.md`.

**Planning baseline:** local main commit `ac6ad29` (`R7-7C5D: close founder
evidence ceremony`).

## 1. Product result and fixed pilot boundary

R7-7D adds the first real evidence-composer action:

- a user selects the current `frontFull` view of a draft Cast;
- the user describes one tattoo and chooses left, centre, or right within the
  one closed `front_upper_torso` zone;
- the user may attach one private reference image;
- the server shows the exact 350-credit quote before generation;
- one deliberate Generate action creates a private, reviewable candidate;
- the candidate is visibly labelled as a preview and is not part of the Cast;
- Accept is free and is the only action that changes Cast identity/package
  truth;
- Retry rejects the old candidate and starts a new quoted 350-credit
  generation;
- Cancel changes no Cast truth, gives no refund for an already delivered valid
  candidate, and queues exact-key cleanup;
- an undecided candidate expires after 30 days under the same no-refund and
  cleanup law as Cancel;
- Accept selects the complete flattened output as the new `frontFull`, records
  typed feature evidence, and marks only selected views whose framing can show
  the accepted anatomical region stale, without regenerating or charging for
  any sibling. Unknown future regions fail closed to all views.

The first enabled recipe is exactly:

```text
ink.add.front_upper_torso.v1
```

It is limited to:

- draft models;
- snapshot read mode;
- a current, non-stale selected `frontFull`;
- no previously selected typed ink feature;
- category `ink`;
- operation `add`;
- zone `front_upper_torso`;
- surface `anterior`;
- side `left`, `centre`, or `right`;
- one bounded text descriptor;
- zero or one intent-owned uploaded reference plate;
- one pinned image-generation engine and one pinned probe model;
- one included internal retry only after a deterministic probe failure.

Replace, remove, scars, pigmentation, piercings, other body zones, initial
creation intents, multiple accepted ink features, sibling generation, whole
Cast restore, and masked erasure remain unavailable.

## 2. Non-negotiable user experience

Security and durability may not make the workflow feel ceremonial or
technical.

The Studio interaction is inline:

1. On the selected Full view, an `Add tattoo` action opens a restrained panel
   in the existing Studio control area, not a blocking modal.
2. The panel contains:
   - one short design description field;
   - three placement chips: Left chest, Centre chest, Right chest;
   - one optional reference-image drop area;
   - the server-returned `350 credits` quote;
   - one primary `Generate preview` action.
3. One click may perform the free intent creation and optional private upload
   before the charged generation, but no step may spend until the quote and
   exact request have been confirmed.
4. A ready candidate occupies the normal image review surface with a clear
   `Preview - not part of this Cast yet` label and its expiry date.
5. The only candidate actions are:
   - `Accept`;
   - `Retry - 350 credits`;
   - `Cancel`.
6. Reloading the page or opening another tab resumes the same server-owned
   active intent/candidate. The client never reconstructs authority from
   local state.
7. No upload, generation, Accept, Retry, refresh, mint, or spend fires on
   mount, navigation, hover, selection, or dialog/panel open.
8. Transient private-image delivery failure retains the stable preview frame
   and retry affordance. It never becomes the browser's broken-image icon.

The candidate is not inserted into version history before Accept. After
Accept, the normal package/history UI shows the new selected `frontFull` and
the earlier view remains ordinary immutable history.

The D founder pilot is intentionally not a generally releasable stopping
point. Once ink is accepted, every feature-blind generation/edit door is
fenced until R7-7E can compose that selected evidence. Accept marks only
possibly-visible views stale, but mint remains fenced until evidence-aware
refresh and mint authority exist. The UI discloses this pilot limitation
before Generate; it is never discovered only after the user pays.

**D-70 amendment:** the three placement chips above are a founder calibration
harness, not the final public interaction. The finished composer accepts one
natural-language instruction and derives the same server-owned zone, surface,
side, and visibility footprint internally. It does not require users to
operate placement controls or a technical confirmation form.

## 3. Current-code facts this plan builds on

The implementation must extend, not bypass, these deployed contracts:

- `models.currentPackageSnapshotId` plus `stateVersion` is the sole effective
  Cast head in snapshot mode.
- `model_identity_snapshots`, `model_package_snapshots`, and package slot rows
  are immutable and append-only.
- operation receipts already carry expected state/package/identity snapshot
  IDs, deterministic charge references, replay truth, and model locks.
- child `generations` rows already support multiple `stepKey` attempts under
  one parent operation.
- the credit price used by one existing casting iteration is 350 credits.
- uploaded reference plates/crops use owner-scoped database reads, canonical
  WebP validation, private R2, authenticated same-origin delivery, and the
  exact-key cleanup worker.
- public `model_assets` use permanent public R2 URLs. They cannot be changed
  to expiring or authenticated URLs inside this slice.
- `verifyViewIdentity` is fail-open on checker errors. It remains unchanged
  for its current R6 consumers and is forbidden from the evidence candidate
  commit path.
- current Gemini iteration accepts a target, a guide overlay, and one
  additional reference, but it has no separately pinned anchor + target +
  evidence recipe or fail-closed typed probe. R7-7D therefore gets a
  dedicated composer; it does not overload the ordinary iterate route.
- current Canvas fork/recast creates a newly generated person. It is not yet
  an evidence-preserving editable clone. The founder gate in section 14 must
  close before any accepted feature can be enabled.

## 4. Migration 0013 - exact additive schema

Migration `0013_r7_ink_add_candidates.sql` is additive except for widening
closed enums and replacing operation-only uniqueness with operation+step
uniqueness where Fork must copy more than one owned evidence object.

Old runtime plus the new schema remains valid. New runtime with composer scope
off remains inert. Non-off composer scope refuses startup until the exact 0013
shape is present.

### 4.1 Existing closed-vocabulary changes

Add:

- `models.status`: `provisioning`, used only by the evidence-aware Fork saga
  and unavailable to every ordinary reader/writer until its final commit;
- `generations.type`: `evidenceCandidate`;
- `storage_cleanup_batches.kind`: `candidate_cleanup`;
- `model_reference_plates.kind`: `accepted_candidate`;
- `casting_evidence_ingestions.purpose`: `fork_copy`;
- `model_identity_snapshots.reason`: already contains `evidence_accept`;
- `model_package_snapshots.reason`: `evidence_accept`;
- `model_package_snapshot_slots.selectionReason`: `evidence_accept`.

Add operation kinds:

```text
evidence_intent_begin
evidence_intent_reference
evidence_candidate_generate
evidence_candidate_retry
evidence_candidate_accept
evidence_candidate_cancel
evidence_fork_copy
```

Add operation phases:

```text
validating
probing
awaiting_acceptance
cleaning
```

The operation kinds/phases are TypeScript closed vocabularies over varchar
columns, so they need runtime/test changes but no SQL enum change.

`evidenceCandidate` child generation rows are deliberately not image-delivery
records:

- `resultUrl` is always null;
- `errorMessage` is closed, sanitized public copy only;
- `metadata` is an allowlist containing only candidate ID, attempt number,
  billing role (`charged_attempt` or `included_retry`), engine ID, and recipe
  version;
- it never contains a description, prompt, reference, key, URL, hash, probe
  response, or provider error.

Moderator generation history/CSV must either omit this type or project its
`resultUrl` as null and the same closed metadata. A regression test feeds a
private candidate child through the real moderator projections and proves no
image location or private content escapes.

### 4.2 `model_identity_feature_intents`

One intent is the resumable authoring session. It owns the normalized request
and optional input reference across an included retry or a user Retry.

Columns:

- `id` UUID primary key;
- `userId`, `modelId`;
- `capabilityKey`;
- nullable `activeCapabilityKey`;
- status `pending`, `resolved`, or `cancelled`;
- fixed category `ink` and operation `add`;
- `ontologyVersion`, `zone`, `surface`, `side`;
- nullable bounded `normalizedDescriptor`;
- `sourceAssetId`, expected `stateVersion`, identity snapshot ID, and package
  snapshot ID;
- `createdByOperationId`;
- nullable `resolvedByOperationId`, `resolvedCandidateId`, `resolvedFeatureId`;
- created/resolved timestamps.

Constraints:

- unique `(modelId, activeCapabilityKey)`;
- unique `createdByOperationId`;
- indexes on `(userId, modelId, status)` and `(modelId, createdAt)`.

`activeCapabilityKey` is the recipe key while pending and becomes null on
resolve/cancel. MySQL's multiple-null behaviour permits historical tombstones
while the non-null unique pair enforces at most one active ink authoring
session per model.

The descriptor is returned only to its owner while pending. Cancel/expiry
scrubs it after exact-key cleanup. Accepted wording lives in the immutable
feature version instead.

### 4.3 Existing reference/crop rows become multi-object-operation safe

Add nullable `featureIntentId` to `model_reference_plates` and a unique index
on it. In this pilot, an uploaded reference is intent-owned and one intent can
own at most one input reference.

Add non-null `createdByOperationStepKey` with default `primary` to
`model_reference_plates` and `model_evidence_crops`.

Replace:

```text
UNIQUE(createdByOperationId)
```

with:

```text
UNIQUE(createdByOperationId, createdByOperationStepKey)
```

Add non-null `stepKey` default `primary` to
`casting_evidence_ingestions`, and replace its operation-only unique index
with `UNIQUE(operationId, stepKey)`.

The defaults preserve every 0011/0012 row. Runtime always supplies step keys
after this migration. This is required for copying an accepted feature's
input plate, accepted candidate plate, and later crop under one Fork
operation without weakening idempotency.

### 4.4 `casting_evidence_candidates`

One candidate row represents one user-paid candidate operation, which may
contain up to two internal provider/probe attempts.

Columns:

- `id` UUID primary key;
- `userId`, `modelId`, `intentId`;
- `originatingOperationId`;
- `capabilityKey`;
- nullable `activeSlot`;
- expected `stateVersion`, identity snapshot ID, and package snapshot ID;
- `targetViewAngle` fixed to `frontFull`;
- `sourceAssetId`;
- status `processing`, `ready`, `accepted`, `rejected`, `cancelled`,
  `expired`, or `invalid`;
- nullable `readyAttemptId`;
- nullable accepted asset, identity snapshot, and package snapshot IDs;
- nullable `cleanupBatchId`;
- composer and probe recipe versions;
- `createdAt`, nullable `expiresAt`, `resolvedAt`, and
  `resolvedByOperationId`.

Constraints:

- unique `originatingOperationId`;
- unique `(intentId, activeSlot)`;
- indexes on `(userId, modelId, status)`, `(intentId, createdAt)`, and
  `(status, expiresAt)`.

`activeSlot` is `active` while processing/ready and null for every terminal
state. This enforces one active candidate per intent in the database, while
the intent's own active-capability index enforces one active candidate
workflow per model/capability.

### 4.5 `casting_evidence_candidate_attempts`

This table is the crash-recovery receipt and exact-key owner for each internal
attempt before Accept.

Columns:

- UUID primary key and `candidateId`;
- attempt number 1 or 2;
- nullable `generationId`;
- status `planned`, `generating`, `stored`, `probe_passed`, `probe_failed`,
  `probe_unknown`, `promoted`, `cleanup_pending`, or `cleaned`;
- `privatePlateId`;
- nullable exact private storage key;
- nullable MIME, dimensions, byte size, and content hash;
- nullable exact promoted public storage key;
- nullable `cleanupBatchId`;
- actual image engine, composer recipe, probe model, and probe recipe;
- closed probe columns:
  - predicted visibility;
  - identity outcome;
  - placement outcome;
  - feature-match outcome;
  - pose/framing outcome;
  - unexpected-ink outcome;
  - overall outcome;
- created/stored/probed/promoted timestamps.

Probe outcomes are only `pass`, `fail`, or `unknown`. No raw model response,
reasoning, prompt, image URL, reference URL, or free-text provider message is
stored.

Constraints:

- unique `(candidateId, attemptNumber)`;
- unique `generationId`;
- unique `privatePlateId`;
- unique private storage key when non-null;
- unique promoted public storage key when non-null;
- index `(candidateId, status)`.

The attempt row and exact private key are inserted before the external private
put. A missing object is safe to delete idempotently; an object written before
a crash is recoverable from the planned row. Before Accept copies to public
R2, the exact public key is persisted on the attempt so an ambiguous write or
commit also remains adjudicable.

Cleanup-batch `operationId` values for candidate lifecycle episodes are fresh
internal UUIDs recorded on the candidate/attempt, not necessarily the parent
generation operation ID. This permits old-candidate rejection cleanup and
new-attempt failure cleanup to settle as separate immutable batches during
one user Retry without appending to, reopening, or colliding with a batch the
worker may already have claimed.

### 4.6 Typed accepted feature tables

`model_identity_features`:

- UUID primary key;
- `modelId`;
- category fixed to `ink`;
- `createdByOperationId`;
- `createdAt`;
- unique `createdByOperationId`;
- index `(modelId, createdAt)`.

`model_identity_feature_versions`:

- UUID primary key;
- `modelId`, `featureId`;
- operation fixed to `present`;
- ontology version, zone, surface, side;
- bounded normalized physical descriptor;
- source asset ID and source view angle;
- nullable source reference plate ID;
- required accepted-candidate plate ID;
- nullable evidence-crop ID reserved for R7-7E;
- recipe version, created operation, timestamp;
- unique `createdByOperationId`;
- indexes on `(modelId, createdAt)` and `featureId`.

`model_snapshot_feature_selections`:

- UUID primary key;
- `modelId`, identity snapshot ID, feature ID, feature version ID;
- selection reason `accepted`, `carried`, or `restored`;
- nullable source selection ID;
- timestamp;
- unique `(identitySnapshotId, featureId)`;
- unique `(identitySnapshotId, featureVersionId)`;
- indexes on `modelId`, identity snapshot ID, and feature version ID.

There is no mutable `active` flag. Selection by the current identity snapshot
is the only active-feature authority.

### 4.7 No database foreign keys

The project deliberately uses application-enforced closure instead of
database cascades for these lifecycle rows. Every write must verify:

- authenticated owner and live model in the same transaction;
- candidate -> intent -> model agreement;
- plate/crop -> owner/model/intent agreement;
- source asset -> selected package/model/view agreement;
- feature version -> feature/model agreement;
- snapshot selection -> snapshot/feature/version/model agreement.

Deletion must create the complete mixed-backend cleanup manifest before
deleting or scrubbing any of these rows.

## 5. Server-owned scope and boot fences

Add:

```text
R7_EVIDENCE_COMPOSER_SCOPE=off|users:<ids>|all
R7_EVIDENCE_COMPOSER_RECIPE=off|ink.add.front_upper_torso.v1
ENABLE_EVIDENCE_CANDIDATE_WORKER=true|false
```

Non-off composer scope is valid only when all are true:

- the recipe value is exactly `ink.add.front_upper_torso.v1`;
- every enabled composer user is also enabled by
  `R7_SNAPSHOT_READ_SCOPE`;
- every enabled composer user is also enabled by
  `R7_EVIDENCE_INGEST_SCOPE`;
- authenticated private evidence delivery is installed;
- the private adapter is configured;
- `ENABLE_STORAGE_CLEANUP_WORKER=true`;
- `ENABLE_EVIDENCE_CANDIDATE_WORKER=true`;
- startup schema inspection proves the full 0013 shape.

Subset comparison is server-side and fail-closed for `users`/`all`; malformed
or broader composer scope stops boot. A client can observe only the protected
capability DTO. It never supplies a mode, recipe, price, model owner, snapshot
ID, feature type, zone ontology, storage key, engine, probe result, or expiry.

The capability DTO is an explicit allowlist:

```text
{
  inkAdd: boolean,
  priceCredits: 350,
  targetView: "frontFull",
  placements: ["left", "centre", "right"],
  activeIntent: null | {
    intentId,
    description,
    side,
    referenceDeliveryUrl,
    candidateId,
    candidateStatus,
    candidateDeliveryUrl,
    expiresAt
  }
}
```

Private delivery URLs are same-origin routes. No key, raw hash, bucket, model
prompt, provider text, or probe internals cross this response.

`buildOwnerPrivateEvidenceEtag` gains an explicit candidate namespace keyed by
candidate ID. It never reuses the post-Accept plate ETag namespace.

## 6. Intent and optional reference flow

### 6.1 Begin intent

`beginInkAddIntent` is a free protected mutation with a strict input:

```text
modelId
sourceAssetId
side
description
clientRequestId
```

It:

1. captures the composer capability from authenticated `ctx.user.id`;
2. deterministically validates length, Unicode control characters, and the
   fixed side vocabulary;
3. runs a dedicated fail-closed tattoo-only authorization/normalization
   boundary;
4. refuses replacement/removal, person/face/body changes, clothing,
   presentation, camera/framing, vague reference copying, multiple marks,
   instructions about hidden zones, and prompt-control language;
5. retains the user's bounded tattoo design wording after normalization
   rather than creatively rewriting it;
6. begins the operation and takes the model operation lock;
7. locks the live owner-scoped draft model and resolves its effective
   snapshot;
8. requires the supplied source asset to be the current selected,
   `compatibility=current`, `frontFull`;
9. requires no selected typed ink feature and no active ink intent;
10. writes the intent with exact expected head fields and returns its ID.

Every refusal before the intent write is free. A duplicate request ID replays
the same intent. A different payload under the same request ID conflicts.

Generate may safely rebase a pending intent after an unrelated package-only
change only when, under the model lock:

- the identity snapshot is unchanged;
- the selected `frontFull` is still the same source asset and still current;
- the selected feature set is unchanged and empty for ink;
- the model remains a live draft.

The service then updates the intent's expected state/package head before
creating the candidate. An identity change, source-view change/staleness, or
feature change refuses and asks the user to restart. This avoids discarding an
uploaded reference because an unrelated view was added while preserving the
exact-head law for the paid candidate.

### 6.2 Attach optional reference

The UI keeps an uploaded file local until the user presses Generate. It then
creates/resumes the intent and calls `attachInkIntentReference` before the
paid candidate mutation.

The attach mutation reuses R7-7C validation/storage but adds durable
intent scoping:

- exact owner/model/intent in one statement;
- intent pending and head expectations still current;
- at most one plate for the intent;
- canonical still JPEG/PNG/WebP input only;
- private plate key only;
- operation `evidence_intent_reference`, step `reference`;
- the plate's `featureIntentId` is set atomically with receipt attachment.

The reference is owned by the intent, not a hidden permanent upload library.
User Retry reuses it. Accept promotes it into accepted feature evidence.
Cancel/expiry cleans it. A later evidence-library product requires its own
retention choice and is not smuggled into this pilot.

## 7. Dedicated composition recipe

The composer lives in new modules under
`server/casting/evidence/composer/`. It does not call ordinary
`generation.iterate` and does not accept arbitrary URLs or images from a
route.

### 7.1 Inputs

The service resolves:

- immutable identity text and `frontClose` anchor from the expected identity
  snapshot;
- current selected `frontFull` target from the expected package snapshot;
- the closed intent descriptor/placement;
- zero or one intent-owned private plate.

The route supplies only `intentId` and `clientRequestId`.

All image bytes are loaded server-side:

- public anchor/target through the trusted bounded image fetch authority;
- private reference through `readCanonical` with exact byte count/hash checks.

The input budget is exactly:

```text
identity anchor + selected target view + optional one evidence plate
```

No historical row, client URL, Canvas image, hidden sibling, crop chosen by
the client, or extra reference enters the request.

### 7.2 Zone guide

The ontology/recipe defines one normalized upper-torso guide for each closed
side. Sharp builds a composited copy of the target with a restrained guide
overlay. The overlay and target are one image input, preserving the three
reference budget. Client pixels or coordinates never define the zone.

Before money, a fail-closed visibility check requires the selected canonical
Full view to show the upper torso sufficiently for this recipe. Hidden,
occluded, malformed, or unknown results refuse free.

### 7.3 Generation engine

The pilot pins `IMAGE_PRO` (`gemini-3-pro-image-preview`) and records that
exact engine on every attempt. It does not fall back to the uncalibrated Flash
engine. Engine unavailability yields no candidate and the normal full-refund
path.

The prompt is built only from:

- immutable identity text;
- server-owned anchor/target roles;
- closed placement/zone directives;
- the authorized bounded tattoo descriptor;
- optional reference-design role;
- preserve-person, preserve-pose, preserve-framing, healed-ink, and
  no-additional-ink rules.

The raw user sentence is not appended as a general instruction. The output is
one complete flattened image, never a layer.

## 8. Fail-closed probe and included retry

R7-7D adds a new structured probe boundary pinned to `TEXT_ECONOMY`
(`gemini-2.5-flash`) and a versioned response schema. It never imports or
calls `verifyViewIdentity`.

Each attempt uses two independent bounded checks:

1. **Identity/pose probe:** anchor + original target + candidate;
2. **Feature/placement probe:** original target + candidate + optional
   reference.

The model returns strict JSON only. Runtime rejects extra keys, missing keys,
out-of-range confidence, prose, malformed JSON, and unknown enum values.
Persisted truth is limited to the closed probe columns in section 4.5.

A candidate passes only when all are pass:

- predicted zone visible;
- same person;
- correct front-upper-torso side/placement;
- requested tattoo visibly present and recognisable;
- pose/framing preserved;
- no additional visible ink invented outside the authorized region.

Resolution:

- all pass -> persist private candidate and offer it;
- deterministic fail on attempt 1 -> clean/reset the image session and run
  one included attempt 2 with typed failure directives;
- deterministic fail on attempt 2 -> no candidate, full refund, exact cleanup;
- probe unavailable/malformed/unknown on either attempt -> no automatic canon,
  no uncalibrated retry, full refund, exact cleanup;
- provider/storage failure before a ready candidate -> full refund and exact
  cleanup.

Probe confidence is calibration evidence, never authority by itself.

R7-7D does not generate siblings, so it cannot claim R7-7E's hidden-view
generation threshold. Its structural guarantee is stronger for this slice:
no hidden sibling bytes or selections change on Accept; they are only marked
stale.

## 9. Candidate generation and billing state machine

### 9.1 Generate

`generateInkAddCandidate` accepts only:

```text
intentId
clientRequestId
```

It:

1. requires capability and rate limit;
2. begins `evidence_candidate_generate`, or
   `evidence_candidate_retry` for the explicit Retry route;
3. takes the model operation lock;
4. locks and re-proves owner/model/intent/current expected snapshot state;
5. creates one `processing` candidate and planned attempt row;
6. creates the first `evidenceCandidate` child generation row;
7. marks the parent running with expected snapshot fields and planned 350
   credits;
8. reasserts the captured snapshot head before charge;
9. deducts once under the parent operation's deterministic charge reference;
10. composes, generates, canonicalizes the candidate to lossless WebP, probes
    those exact deliverable pixels, and if necessary runs the included
    attempt;
11. retains only a passing canonical candidate;
12. writes it to the private evidence bucket under the pre-recorded plate key;
13. under model/candidate locks, re-proves unchanged head/intent and commits
    attempt `probe_passed` plus candidate `ready`;
14. sets expiry to exactly 30 days and completes the parent with the explicit
    public candidate result.

Public operation result:

```text
{
  candidateId,
  status: "ready",
  expiresAt,
  chargedCredits: 350
}
```

No URL/key/probe/descriptor appears in the operation receipt. The protected
candidate/capability query derives the authenticated delivery URL.

The first child attempt records `pointsCost=350`; the included second child
records `pointsCost=0`. A user Retry is a new operation whose first child is
again 350. Parent receipt charge/refund totals remain the accounting
authority.

Both attempts share one parent charge, not two semantic refund references.
Candidate-aware recovery derives exactly one possible charge/refund from the
parent operation's deterministic charge reference and the real point ledger:

- attempt 1 has billing role `charged_attempt`;
- attempt 2 has billing role `included_retry` and never creates a refund
  expectation;
- child count/status is probe evidence, never a multiplier for refunds.

Daily user generation quota also counts one billable parent candidate
operation, not both internal child attempts. The included system retry cannot
consume a second user quota slot.

### 9.2 Durable paid-result boundary

The paid result is a `ready` candidate row whose private object and closed
probe truth are durably attached. Before that boundary, any terminal failure
refunds exactly once. After it, a receipt-finalization error is an audit/replay
recovery problem and never a reason to erase a delivered candidate or grant a
duplicate retry.

Unknown database commit outcomes are adjudicated from candidate/attempt rows,
not R2 object existence. A private object alone never proves delivery or
canon.

### 9.3 Crashed-operation adjudication

D4 extends stale-operation recovery for every new evidence operation kind.
The generic current fallback to `recovery_required` is not sufficient.

Under the model/candidate/intent locks, recovery uses the candidate and attempt
rows plus the parent charge ledger:

- ready candidate + passing ready attempt -> reconstruct success and retain
  the one charge;
- accepted candidate + matching accepted graph -> reconstruct Accept success;
- pre-boundary processing/stored/probe-failed/unknown attempt with no ready
  candidate -> mark candidate invalid, clear its active slot, queue exact
  cleanup, record the one deterministic refund when a charge exists, and
  leave the intent pending for a later deliberate request;
- rejected/cancelled/expired terminal truth -> reconstruct that terminal
  result without another cleanup or refund;
- mixed or unprovable truth -> `recovery_required`, preserve keys and block
  user retry.

The adjudicator never infers one refund per failed child. It ignores the
zero-cost included retry for refund counting. A crashed processing candidate
cannot retain `activeSlot=active` indefinitely after its outcome becomes
provable.

### 9.4 User Retry

Retry is not an in-place regenerate:

1. show the new 350-credit quote;
2. begin a new request ID;
3. under model/intent/candidate locks, reject the old ready candidate and
   create its exact private cleanup manifest;
4. reserve the new processing candidate in the same transaction;
5. only then run the new charged operation.

If the new generation fails, the old candidate remains rejected. UI copy must
state this before confirmation. The intent and its input reference remain for
the new candidate.

## 10. Private candidate delivery

Extend the authenticated evidence route with:

```text
GET /api/evidence/candidate/:candidateId
```

The route:

1. authenticates and checks suspension;
2. rate limits by authenticated user;
3. owner-scopes candidate -> intent -> live model in the query;
4. requires candidate status `ready` and `expiresAt > now`;
5. resolves its `readyAttemptId`;
6. verifies the attempt's private plate key parses to the same
   owner/model/privatePlateId;
7. reads the exact declared private bytes;
8. emits the same owner-private cache/ETag/nosniff contract as plate/crop
   delivery.

Foreign, missing, terminal, and expired candidates share one 404. A candidate
query/delivery GET never mutates expiry state or queues cleanup; the worker is
the sole expiry writer.

## 11. Accept - the only canon commit

`acceptInkAddCandidate` is a free protected mutation accepting only
`candidateId` and `clientRequestId`.

### 11.1 Prepare the public object

Accept:

1. begins `evidence_candidate_accept` and takes the model operation lock;
2. re-proves owner, draft status, candidate ready/not expired, intent pending,
   expected snapshot head, and selected source `frontFull`;
3. persists a write-once exact public destination key on the ready attempt,
   or reuses that same recorded key during adjudication/retry;
4. reads the private candidate with exact size/hash verification;
5. uploads those verified bytes as `image/webp` to public generated-image R2.

The unaccepted candidate never had a public URL. This copy is the first public
object, and it exists solely to satisfy the permanent public `model_assets`
delivery contract after acceptance.

If public copy fails, Accept fails free and the candidate remains ready. If a
public object exists but canon commit does not, the pre-recorded key is
adjudicated/cleaned; it is never orphaned.

### 11.2 Atomic transaction

Under the established lock order, one transaction:

1. locks live owner-scoped model;
2. locks the Accept operation receipt/operation lock;
3. locks candidate then intent;
4. re-reads the complete effective snapshot and exact expected head;
5. re-verifies source asset, reference plate, ready attempt, private/public
   keys, and no previously selected ink feature;
6. inserts the public candidate as a `frontFull` `model_asset` with typed,
   non-secret provenance and the 350-credit candidate cost;
7. inserts an `accepted_candidate` private plate using the attempt's existing
   private plate ID/key;
8. inserts the feature and immutable feature version;
9. inserts a new identity snapshot with reason `evidence_accept`, documents
   and anchor byte-identical to the parent;
10. copies prior feature selections and adds the new accepted selection;
11. inserts the paired package snapshot with reason `evidence_accept`;
12. selects the new `frontFull` as `current`/`evidence_accept`;
13. copies filled selected slots as `carried`, preserving prior compatibility
    for views that cannot show the accepted evidence and marking only
    possibly-visible views `stale`; for the first recipe, lateral left/right
    placement stales Walk while centre placement does not, because a strict
    profile cannot reliably show the centre chest;
14. updates the model head with exact stateVersion/package/identity CAS;
15. marks intent resolved, candidate accepted, attempt promoted, and clears
    both active-slot fields;
16. finalizes the operation success with accepted IDs and zero charged/refunded
    credits.

No provider, storage, probe, or image work occurs inside this transaction.
Any failed affected-row/closure/CAS assertion rolls the entire transaction
back.

Accept advances the legacy `models.identityRevisionId` and stamps the new
frontFull asset with that revision as part of the existing snapshot
dual-write law. Accepted ink is an identity change even though the documents
and anchor stay byte-identical. The legacy `model_assets` sibling-stale truth
is updated in the same transaction so a snapshot-scope rollback remains
honest. The transition engine's existing requirement that an
`evidence_accept` identity transition advances the legacy revision is
preserved, not exempted.

The running operation receipt is finalized through a new transaction-scoped
success helper in the same commit. The current claimed-only in-transaction
helper is not sufficient once the operation has moved to `running`.

Accept never changes the mutable identity documents, anchor, mint seal, model
status, credits, Canvas rows, or Wardrobe rows. Unrelated view bytes remain
unchanged. Their selected compatibility and legacy status remain unchanged
unless the server-owned visibility mapping says the accepted region may
appear in that view. Pre-existing stale truth is never promoted to current.

### 11.3 Ambiguous Accept recovery

Recovery proves one of:

- candidate accepted + expected accepted asset/snapshots/feature selection
  + model head agree -> success;
- candidate still ready + no accepted rows -> public key is cleaned or reused
  for a deliberate recovery, never silently committed;
- mixed truth -> `recovery_required`, no user retry, support-only adjudication.

Object existence alone never decides the result.

## 12. Cancel, expiry, cleanup, and scrubbing

### 12.1 Cancel

`cancelInkAddIntent` is a free operation accepting only `intentId` and a
client request ID. It locks model -> intent -> any active candidate and:

- marks a ready candidate cancelled when one exists and always marks the
  pending intent cancelled;
- clears active slots;
- creates one `candidate_cleanup` batch containing:
  - every private candidate attempt key;
  - any unaccepted promoted-public key;
  - the intent-owned uploaded reference plate;
- deletes the unaccepted reference-plate row only after the manifest is
  durable;
- records no refund;
- completes with IDs/status only.

The current Cast head and every selected asset/snapshot/feature remain
byte-for-byte unchanged.

### 12.2 Expiry worker

The candidate worker runs only when explicitly enabled. It:

- claims one `ready` candidate with `expiresAt <= now`;
- locks in deterministic candidate ID order;
- performs the same transition and manifest construction as Cancel;
- uses a fresh internal cleanup operation UUID stored as
  `resolvedByOperationId`;
- records no generation operation or charge/refund;
- never trusts client time or a browser visit.

Processing candidates use the existing operation lease/recovery contract, not
the 30-day ready expiry.

### 12.2a The panel's own expiry check runs on the customer's clock

Filed 2026-08-16 (fable-670 §3) for whoever reworks this surface. Not a defect
today, and deliberately not fixed while the flag is off.

The worker above never trusts client time. The PANEL does:
`inkCandidateIsExpired` (`client/src/features/casting/evidence/inkAddUxPolicy.ts`)
and the re-check timer in `InkAddPanel.tsx` both compare a server-written
`expiresAt` against the browser's `Date.now()`. That is two moments taken off
two clocks — entry 13 of `docs/specs/INSTRUMENT_DOCTRINE.md`, and the same shape
that made the casting sheet's supervised-wait promise fire on a laptop two
minutes fast and never fire on one two minutes slow (fixed in `f4b126e5`).

**It is harmless here because the horizon is 30 days** (`CANDIDATE_EXPIRY_MS`),
so minutes of ordinary clock error cannot change the answer. The reason it is
written down rather than fixed: if this surface ever acquires a SHORT deadline —
a hold, a reservation, a countdown measured in minutes — the shape becomes the
defect on the day the number shrinks, and nothing in the code will say so. The
fix, when it is needed, is the one the casting sheet took: the server subtracts
and ships a duration, because the server owns both terms.

### 12.3 Cleanup reconciliation

The existing storage worker deletes each explicit backend/key. A candidate
reconciler, parallel to evidence-receipt reconciliation, acts only after its
batch succeeds:

- attempt private/public keys, hashes, sizes, and MIME are scrubbed;
- attempt status becomes `cleaned`;
- cancelled/expired intent descriptor and reference link are scrubbed;
- candidate/intent tombstones retain only identifiers, closed statuses,
  counts, recipe versions, and timestamps needed for replay/accounting;
- failed/partial batches retain exact keys only in cleanup items for support.

Retry cleanup removes only the old candidate output. It does not scrub the
still-pending intent or its reference.

Model deletion and account deletion are extended before enablement to collect
candidate attempts, intents, feature rows, accepted candidate plates, crops,
and any promoted public key. They create the complete mixed-backend manifest
before deleting/scrubbing database rows.

## 13. Deletion, export, downstream, and flag-off behaviour

- **Flag off:** existing R6 permanent-mark refusal stays byte-for-byte. No
  composer route may call generation, credits, storage, or snapshots.
- **Mint:** a pending intent or ready candidate blocks mint with actionable
  Resolve/Cancel copy. During D, an accepted feature also blocks mint because
  its stale siblings cannot yet be regenerated with evidence. Public
  availability waits for R7-7E; no package that visually contradicts typed
  identity evidence may be sealed.
- **Export:** exports selected flattened package views. It does not expose
  private plates, crops, candidate images, descriptors, storage keys, or probe
  truth.
- **Wardrobe:** continues to consume the selected flattened image. Existing
  pixel tattoo analysis remains presentation guidance and never backfills
  typed feature truth.
- **Canvas:** live Cast nodes follow the selected package after Accept;
  independent downstream outputs remain independent.
- **GDPR/account export:** a separately authenticated export includes the
  user's accepted evidence metadata/files according to policy. No
  unauthenticated evidence URL is created.
- **Model/account deletion:** removes all new rows and exact owned objects
  under the existing immediate-DB/background-object law.
- **R7-7E:** later sibling refresh composes selected typed evidence and gets
  its own quote, generation, probe, and acceptance law. D never auto-refreshes.

### 13.1 Feature-blind writer fence

Typed feature truth must survive snapshot-scope rollback and every ordinary
route. Therefore the fence is scope-independent: whenever the current
identity snapshot selects any typed feature, a writer that cannot compose and
validate that feature must refuse before receipt execution, money, provider,
storage, or state change.

Until separately adopted by an evidence-aware recipe, the following refuse:

- ordinary `casting.refresh`, including stale siblings and the accepted
  tattoo view itself;
- `casting.add_views` and late-view generation;
- image-refine/iterate on any selected Cast view;
- slot restore/use-version when it could select pixels from before the
  feature;
- headshot reroll, structured recast, and free-text/reference identity edits;
- Canvas recast/adoption paths that would append feature-blind snapshots;
- whole-Cast restore;
- mint while any feature-dependent selection remains stale/unverified.

This is enforced in the shared snapshot transition/writer authority, not only
in router guards. A repo-level operation inventory and source guard make every
new snapshot/package writer choose one of two explicit contracts:

1. evidence-aware: server composes the selected feature versions, validates
   the result, and copies `model_snapshot_feature_selections` forward in the
   same transaction; or
2. evidence-blind: refuses on a feature-bearing current identity.

Pure document compaction may copy the exact current feature selections
forward because it changes no identity pixels or feature meaning. No other
identity-snapshot-creating transition may silently create an empty feature
selection set.

The D UI explains before Generate:

> This pilot can add and preserve the tattoo on the Full view. Other Cast
> edits, view refreshes, and minting stay unavailable until evidence-aware
> refresh is enabled.

That limitation is acceptable only for the bounded founder/calibration cohort.
D scope cannot widen to ordinary customers until R7-7E restores the complete
edit/refresh/mint experience.

## 14. Mandatory founder gates

### 14.1 Evidence-aware Fork

The design authority requires accepted evidence to survive deletion of the
parent through copy-on-Fork. The current product's `canvas.fork` generates a
potentially different person and has no evidence-copy transaction. Silently
copying a tattoo onto a newly generated person, or silently dropping it, is
not acceptable.

Before composer enablement the founder must ratify one explicit Fork product
meaning. The strongest UX/security recommendation is:

> **Fork to edit** creates a full independent editable duplicate of the same
> Cast: selected public package images and every selected private evidence
> object are copied to new owner/model keys; snapshots/features are cloned
> with new IDs; the new model opens as a draft; the minted original is
> unchanged. Because no AI generation occurs, the clone itself is free.
> **Recast** remains the separately labelled paid action that may create a
> different person.

If ratified, implement an operation-bound clone service:

1. reserve an invisible provisioning model;
2. pre-record every destination public/private key;
3. copy and byte/hash verify all selected package/evidence objects;
4. atomically create the target snapshot/feature graph and make the model
   visible as a draft;
5. on any failure keep it invisible, queue every destination key, and report
   a free named failure;
6. count every copied public/private object in the target's storage/audit
   inventory even though no generation credits are charged;
7. prove the child survives permanent deletion of the parent.

Migration 0013 adds the closed `provisioning` model status and one shared
positive availability predicate equivalent to:

```text
status IN ("draft", "active", "locked") AND deletedAt IS NULL
```

Every ordinary model reader, writer, snapshot/bootstrap/shadow/convergence
service, operation claim, evidence delivery query, deletion planner, and
consumer projection uses that predicate. The current negative idiom
`status != "archived"` fails open for a new status and is removed from runtime
authority. Explicit admin/support/deletion exceptions are narrowly
allowlisted and documented.

A repo guard fails if a raw negative archived-status predicate is reintroduced
outside that allowlist. Disposable tests prove a provisioning model is absent
from Models, direct `models.get`, Studio, Canvas, Wardrobe, billing, snapshot
bootstrap/backfill/shadow, evidence delivery, generation operations, and
export.

Provisioning is not draft authority, cannot generate, cannot spend, cannot be
selected by a client, and is permanently deleted through the normal exact-key
lifecycle if the saga fails.

Until this gate and its implementation pass, evidence-bearing minted models
must show a typed unavailable state rather than the old generic Fork action.
R7-7D may be built and deployed scope-off, but accepted ink cannot be enabled.

### 14.2 Pilot price

The founder must deliberately ratify the first candidate price as **350
credits**, equal to one current Cast iteration. The recommendation is:

- one valid delivered candidate costs 350;
- the included system retry costs the user zero;
- Accept/Cancel are zero;
- user Retry is a new disclosed 350-credit operation.

This is mechanically compatible with the current ledger but remains a
product-price choice. It cannot become true merely because the code happened
to reuse `POINT_COSTS.iterate`.

## 15. Operation, race, and replay laws

All mutations use strict schemas and authenticated `ctx.user.id`.

Global order remains:

```text
model row -> operation receipt -> operation lock -> candidate -> intent
-> snapshot/feature/evidence children -> writes
```

Required race outcomes:

- Generate vs identity/package change: unchanged head required before a ready
  candidate; otherwise cleanup + full refund.
- Generate vs delete/archive/mint: lock/live/draft fence refuses and refunds
  if money moved.
- Accept vs Accept: one wins; the other replays success or conflicts without
  a second canon commit.
- Accept vs Retry/Cancel/expiry: candidate row lock permits exactly one
  terminal transition.
- Accept vs identity edit/refresh/mint/delete: model operation lock plus
  stateVersion/head CAS prevents mixed truth.
- Any feature-blind writer after Accept: the shared transition fence refuses
  before receipt execution, money, provider, storage, or state change; it
  cannot erase the selected feature or create an identity snapshot with empty
  feature selections.
- Retry vs Retry: intent/candidate unique active slots permit one replacement.
- Candidate expiry vs page load: reads may display only not-yet-expired ready
  truth; worker owns terminal mutation.
- Reference discard vs Generate/Accept: intent ownership and row locks prevent
  a missing input from being used.
- Storage or DB disconnect: no guessed success; exact pre-recorded keys and
  durable rows drive recovery.
- Process loss during either internal attempt: candidate-aware stale-operation
  adjudication derives at most one parent refund, clears a provably failed
  active slot, and never treats the zero-cost second child as another charge.
- Duplicate client submission: exact replay, no second provider call, charge,
  Accept, Cancel, or cleanup batch.

No operation steals an expired generation lock. Existing recovery/adjudication
rules remain.

## 16. Public API surface

Protected tRPC procedures:

```text
evidence.composerCapability
evidence.beginInkAddIntent
evidence.attachInkIntentReference
evidence.generateInkAddCandidate
evidence.retryInkAddCandidate
evidence.acceptInkAddCandidate
evidence.cancelInkAddIntent
evidence.getActiveInkIntent
```

Only capability/get-active are queries. Every other procedure is a mutation
with a strict schema and a UUID client request ID.

No procedure accepts:

- `userId`, workspace/role, mode, capability, recipe, price;
- snapshot/state IDs;
- category/operation/zone/surface;
- storage key, URL, bucket, MIME/dimensions/hash;
- anchor/target/reference URL;
- probe result, confidence, engine, expiry;
- candidate output bytes.

The only open user content is the bounded tattoo design description and the
optional reference bytes at the dedicated upload boundary.

## 17. Implementation slices

Each slice is a local commit with focused tests and an independent Fable
review. No slice authorizes the next.

### D1 - contracts and migration

- migration 0013 and Drizzle schema;
- closed intent/candidate/probe/feature types;
- pure state machines and billing truth table;
- startup schema/scope validation;
- no runtime route caller;
- disposable migration up/mixed-version proof.

### D2 - storage/lifecycle/fork prerequisites

- candidate private-key ownership and delivery query;
- cleanup/reconciliation/expiry primitives;
- model/account deletion inventory;
- multi-object ingestion step keys;
- evidence-aware Fork after founder ratification;
- all flags off and no generation caller.

The non-Fork D2 prerequisites (multi-object step keys, candidate
storage/delivery ownership, cleanup/reconciliation/expiry primitives, and
deletion inventory) may begin after D1. The evidence-aware Fork implementation
may not begin, and D2 may not complete, before the founder Fork ruling.

### D3 - pure composer and calibration harness

- closed tattoo authorization/normalization;
- ontology/zone guide;
- exact three-reference composer;
- pinned Pro image engine;
- two fail-closed structured probes;
- included-retry decision engine;
- synthetic/consented local calibration recorder;
- no route, credit, snapshot, or storage writer.

D3 may proceed after D1 while D2 waits on the founder Fork ruling. That
parallelism does not authorize D4 or any capability enablement.

### D4 - operation-bound server workflow

- intent/reference/generate/retry/accept/cancel services;
- exact parent/child operation receipts;
- 350-credit charge and deterministic refund law;
- private candidate storage/delivery;
- atomic Accept snapshot/feature/package commit;
- recovery/adjudication and deletion closure;
- feature-blind writer/mint fences and the exact feature-selection
  copy-forward contract;
- moderator/admin candidate-child privacy projections;
- capability remains false.

### D5 - inline Studio UX

- capability query and active-candidate resume;
- inline Add tattoo panel on selected Full view;
- local file held until Generate;
- stable private preview;
- Accept/Retry/Cancel and expiry copy;
- cross-tab invalidation without write loops;
- no automatic mutation/spend;
- capability remains false.

### D6 - disabled deployment gate

- migration production review and apply;
- deploy complete runtime with composer scope/recipe off;
- typecheck, focused/full tests, build;
- disposable MySQL failure matrix;
- counts-only orphan/cleanup audit;
- ordinary R6/snapshot smoke;
- cumulative Fable deployment review.

### D7 - calibration and founder-only rollout

- synthetic/consented dataset only;
- pinned recipe/model versions;
- read-only pre-audit;
- enable snapshot + ingest + composer for founder user only;
- founder paid browser ceremony;
- inspect candidate, Accept/Retry/Cancel/expiry, reload, deletion, and Fork;
- return scope off on any gate failure;
- widen only after a separate reviewed recommendation.

## 18. Verification matrix

### 18.1 Pure/unit

- strict tattoo-only authorization and exact descriptor retention;
- zone/side vocabulary and server mask geometry;
- active intent/candidate uniqueness;
- lifecycle transition truth table;
- charge/refund table;
- two-attempt limit;
- probe strict JSON and unknown/fail-closed handling;
- candidate result/projection private-field allowlists;
- composer input order and maximum reference count;
- fixed engine/probe/recipe versions;
- no ordinary `verifyViewIdentity` import;
- no raw URL/key/prompt/probe result in operation results;
- `evidenceCandidate` child rows and moderator projections contain no result
  URL, private key, descriptor, probe prose, or provider error;
- no runtime raw negative archived-status authority outside the reviewed
  availability-predicate allowlist.

### 18.2 Disposable MySQL

- migration over 0012 data and old-runtime-compatible defaults;
- owner/model/source-snapshot closure;
- foreign intent/candidate/plate/asset refusal with victim rows unchanged;
- begin replay and active-intent conflicts;
- one active candidate under parallel Generate/Retry;
- first invalid + second pass, both invalid, and unknown probe;
- one charge, included retry cost zero, exact refund;
- stale-operation recovery with two children but exactly one semantic charge
  and refund;
- daily quota counts one billable parent candidate operation: one attempt and
  an included two-attempt run each consume exactly one slot, while a user
  Retry consumes one new slot;
- ready-candidate durable boundary at every injected failure;
- Accept success creates exactly one asset, plate, feature/version, identity
  snapshot, package snapshot, feature selection, and head CAS;
- documents/anchor unchanged; only possibly-visible siblings stale; no sibling
  generated; unaffected and previously-stale compatibility remains honest;
- Accept vs Accept/Edit/Mint/Delete/Cancel/Retry/expiry;
- every feature-blind refresh/add-view/iterate/restore/recast/identity-edit
  path refuses before money/provider and leaves feature selections unchanged;
- document-only feature-selection carry-forward never deselects the feature;
- public-copy write then transaction rollback leaves a cleanup manifest;
- ambiguous Accept adjudication;
- Cancel/Retry/expiry exact mixed cleanup and scrub;
- model/account deletion before/after candidate ready/accepted;
- Fork copies all selected evidence to new keys and survives parent deletion;
- no partial/invisible provisioning model leaks.

Every DB test uses disposable MySQL. No unit command receives production
`DATABASE_URL`.

### 18.3 Router/service

- every schema `.strict()`;
- forged `userId`, state, price, recipe, zone, key, URL, engine, probe, or
  expiry rejected before service work;
- scope/recipe off refuses before intent, storage, money, or provider;
- minted and stale/missing `frontFull` refuse free;
- reference belongs to the exact intent/model/owner;
- candidate delivery owner-only, 401 unauthenticated, same 404 foreign/missing;
- no mount/query performs a mutation;
- operation replay never repeats provider/charge/commit/cleanup;
- legacy R6 marks refusal unchanged flag-off.

### 18.4 Browser/founder

- text-only and reference-assisted preview;
- quote visible before spend;
- one click from filled panel to generation;
- candidate visibly noncanonical;
- reload/another tab resumes;
- Accept updates Full and dims/stales only possibly-visible siblings without
  auto refresh; unaffected views keep their prior compatibility;
- Cancel leaves Cast unchanged;
- Retry warns replacement and charges exactly once;
- private preview never leaks unauthenticated;
- minted route uses the ratified Fork-to-edit meaning;
- parent deletion does not break copied fork;
- no broken-image, unexpected modal, or background action.

## 19. Calibration and release gates

Record each engine/probe/recipe cohort separately. No fallback result is mixed
into the pilot cohort.

Minimum gates:

- 100% of first-region canon commits have explicit Accept;
- 0 canon commits on unknown or malformed probe;
- at least 95% same-person after the included retry;
- at least 95% correct zone/side after retry;
- at least 90% founder/human-accepted design composition fidelity;
- 100% selected hidden-sibling bytes remain unchanged in D;
- 100% candidate/charge/refund/cleanup reconciliation;
- no skin-tone, gender-presentation, body-build, pose, or occlusion cohort
  failure hidden by the aggregate.

The R7-7E generated-hidden-view anti-invention threshold is recorded
separately and cannot be claimed by D.

The first run uses consented/synthetic Casts only. No customer evidence is
used for calibration.

## 20. Deployment, rollback, and observability

Rollout order:

1. D1/D2/D3/D4/D5 reviewed locally;
2. disposable migration/tests;
3. production migration 0013 under separate approval;
4. scope-off runtime deployment;
5. health and R6/snapshot smoke;
6. founder Fork ruling and implementation proof;
7. founder-only scope variables in dependency order;
8. calibration/paid browser ceremony;
9. stop and return composer scope off on any failure;
10. separately review any widening.

Rollback is primarily:

```text
R7_EVIDENCE_COMPOSER_SCOPE=off
R7_EVIDENCE_COMPOSER_RECIPE=off
```

Turning composer off:

- hides authoring controls;
- prevents new intent/candidate/accept operations;
- leaves accepted flattened selected assets readable by ordinary snapshot
  consumers;
- leaves candidate and cleanup workers running so existing private objects do
  not become orphaned;
- never deletes accepted evidence or rolls back a snapshot.

After the first candidate object exists, a pre-D adapter/cleanup runtime is
not a valid rollback build. Rollback must use an adapter- and
candidate-cleanup-capable build.

Observe counts and closed codes only:

- active intents/candidates by status/age;
- ready candidates nearing expiry;
- operation charged/refunded/net totals;
- first/second attempt pass/fail/unknown counts;
- candidate cleanup pending/partial/failed;
- private/public orphan count;
- Accept CAS/recovery-required count;
- cohort calibration outcomes.

Logs never contain descriptions, prompts, reference/candidate URLs or keys,
hashes, image bytes, provider responses, or probe prose.

## 21. Explicit exclusions

This plan does not authorize or include:

- implementation before this plan is approved;
- D2 Fork completion, D4 billing work, or any enablement before the Fork
  meaning and 350-credit pilot price are founder-ratified;
- R7-7E sibling refresh;
- R7-7F whole-Cast restore;
- creation-time tattoo intents;
- more zones/categories;
- replace/remove/erase;
- automatic Accept, Retry, refresh, or spend;
- client-selected evidence/recipe/engine/probe authority;
- public or presigned private-evidence URLs;
- storage migration of existing public model assets;
- workspace/team migration;
- production migration/deploy/variable/database/provider action.

## 22. Review and authorization gates

Before implementation, Fable must challenge:

- the schema and mixed-version migration;
- intent/reference ownership and retention;
- candidate/public promotion crash windows;
- operation replay and exact credit law;
- probe fail-closed truth and calibration claims;
- cleanup scrubbing and deletion coverage;
- snapshot feature-selection closure;
- current Fork semantics versus the copy-on-Fork requirement;
- every route/client authority boundary.

Allowed verdicts:

- `APPROVE - safe for founder ratification and bounded implementation`; or
- `REQUEST CHANGES` with reachable contradictions.

Founder ratification of the Fork meaning and the 350-credit price in section
14 is mandatory before D2 completes, D4 starts, or any composer capability can
return true. D1 and D3 may begin after this plan itself is approved because
they have no routed mutation, storage writer, credit path, or Fork behavior.
