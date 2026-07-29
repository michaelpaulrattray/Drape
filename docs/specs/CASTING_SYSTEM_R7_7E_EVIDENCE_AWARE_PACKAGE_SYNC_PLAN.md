# Casting System R7-7E — Evidence-aware package synchronization

**Status:** implementation plan only. This document does not enable a route,
generate an image, spend credits, write storage, change a Railway variable, or
contact production by itself.

**Authority:** D-15, D-39, D-43, D-56, D-62, D-65, D-68, D-70, D-71,
`CASTING_SYSTEM_R7_6_EVIDENCE_COMPOSER_DESIGN.md`, the completed R7-7A/B/C/D
snapshot and evidence boundaries, and the access-control invariants in
`CLAUDE.md`.

## 1. Product result

R7-7D proves the first accepted Ink edit, but deliberately fences later
package operations because the ordinary generator cannot preserve selected
typed evidence. R7-7E removes the package-sync and mint dead end without
weakening evidence authority; other evidence-blind edit paths remain fenced.

After a user explicitly accepts a supported tattoo:

- only views whose framing may show the changed region become stale;
- each stale or missing package view exposes an ordinary, deliberate priced
  action;
- the server composes the selected typed evidence into any view that may show
  it and explicitly prevents invention in views that cannot;
- a generated view lands only after strict view-specific probes pass;
- one internal retry is included; repeated failure or unknown probe truth
  leaves canon unchanged and refunds that view;
- no sibling refreshes automatically;
- once the required package is complete and current, Mint may seal it without
  regenerating any view or changing identity evidence.

For the first enabled recipe, the feature surface is anterior pec.
Left/centre/right locates the tattoo within that front surface; it does not
make the surface reliably visible in a strict `sideFull` / Walk profile.
Accepting the tattoo therefore leaves an existing Walk current for every side
and shows no Walk refresh action.

If Walk is genuinely missing and the person deliberately adds that optional
coverage, the evidence-aware generator creates a strict profile in which the
anterior-pec tattoo is hidden and must be absent. That ordinary 300-credit
missing-view action lands directly into the Walk slot after strict identity,
framing, continuity, omission, and anti-invention probes. There is no second
Accept ceremony.

## 2. Non-negotiable experience

- No placement chip, anatomical form, hidden-view selector, or technical
  confirmation is exposed.
- The user never chooses the evidence source, crop, ontology, recipe, engine,
  probe, visibility law, operation kind, or facing direction.
- Cost is returned by the server plan from `slotCost`; the client contains no
  credit literal.
- The action is never fired on mount, hover, Accept, tab change, or cache
  invalidation.
- The stale tile and the accepted-Ink panel may both open the same action, but
  one click creates one idempotent operation.
- Failure copy is closed and human: the view was not updated and any charged
  credits were refunded.
- Successful synchronization returns the user to the normal Cast workspace;
  Package Health remains a diagnostic surface, not a required workflow.

R7-7E does not add another tattoo, replace or remove one, edit identity
documents, refresh the identity anchor, or expose arbitrary evidence controls.
Freeform Recast, Iterate, Variations, and per-version Restore also remain
evidence-blind in E and continue to refuse on a Cast with selected evidence.
The accepted-Ink panel must say this plainly before the user spends on package
sync or mints; E removes the package/mint dead end, not every later editing
restriction.

## 3. Current facts

1. `casting.refresh` is classified `evidence_blind`; the operation start fence
   correctly refuses any current identity snapshot with a selected feature.
2. `commitRefreshedSlotsSnapshot` is likewise evidence-blind and cannot be
   reused by merely changing prompt text.
3. `sideFull` is the ratified walking-profile slot and costs
   `CREDIT_COSTS.multiView` (currently 300). A requested facing direction is
   not anatomical proof: image generation may drift or mirror it.
4. The accepted Ink feature version owns:
   - closed ontology/zone/surface/side/descriptor;
   - the exact accepted private candidate plate;
   - the creating operation and immutable selection.
5. The current accepted `frontFull` is public package truth; the matching
   accepted candidate plate remains private durable evidence.
6. Private evidence reads are size-bounded, MIME-verified, owner-scoped, and
   use the dedicated private adapter.
7. The accepted plate is a complete image. The server can derive a contextual
   upper-torso crop in memory with `sharp`; no new storage key or cleanup row is
   needed.
8. Generation operation kinds are durable strings, not a database enum, so E
   needs no migration.
9. The existing back/Walk identity gate fails open on checker outages. It may
   remain for evidence-free generation, but it cannot authorize an
   evidence-bearing canon commit.
10. The current operation claimant treats `kind` as part of replay identity.
    A route that derives a different kind from changed model state must first
    resolve an existing receipt, or the same `clientRequestId` can become a
    false payload conflict.

## 4. Bounded first release

The first runtime registry entry supports exactly:

```text
category: ink
operation: present
ontologyVersion: body-zones.front-upper-torso.v1
zone: front_upper_torso
surface: anterior
side: left | centre | right
authoring view: frontFull
conditionally-visible generated sibling: none
optional hidden-only generated sibling:
  sideFull for side left | centre | right when the view is missing
```

Unknown category, operation, ontology, zone, surface, side, feature selection,
canonical angle, or recipe fails before money/provider.

The registry classifies every canonical angle exhaustively:

| Angle | Feature visibility directive |
|---|---|
| `frontClose` | region outside frame; no generated refresh (identity anchor) |
| `threeQuarter` | region outside the head-and-shoulders crop; forbid invented marks |
| `frontFull` | accepted authoring truth; never regenerated by E |
| `sideClose` | region outside the head-and-shoulders crop; forbid invented marks |
| `sideFull` | every side: an existing Walk is unaffected because the pilot surface is anterior pec; when missing, generate a strict profile, omit the anterior-pec mark, and probe framing plus omission |
| `backFull` | anterior region hidden; forbid invented posterior marks |

Adding a canonical angle or feature capability is a compile-time registry
failure until its directive and probes are explicitly supplied.

The registry key is not angle alone. It is the exhaustive tuple
`(canonical angle, ontology version, zone, surface, feature side)`. For any
future visible tuple it also owns:

- the intended visible anatomical side;
- the server-selected travel/facing directive;
- a normalized target rectangle for that angle and side;
- the strict probe expectations.

The generated image, not the prompt, is final truth. If a future recipe
requires a visible anatomical side, the probe must establish it from pixels.
For the current anterior-pec Walk directive, the probe instead must establish
that the region is hidden and the tattoo is absent.

E1 replaces D8's temporary `sideFull` conditional with this tuple registry so
staleness, missing-view composition, prompt guidance, and probe expectations
share one exhaustive authority.

## 5. Durable operation authority

Add two explicit operation kinds:

```text
evidence_package_sync
evidence_mint
```

Both map to `evidence_aware` in `FEATURE_TRANSITION_AUTHORITY`.

The existing `casting.refresh`, `casting.add_views`, and `casting.mint` kinds
remain evidence-blind. A future caller therefore cannot accidentally gain
feature authority by reaching an old executor.

For a brand-new `clientRequestId`, the route chooses an operation kind only
after a server-owned effective-state read:

- no selected feature -> existing operation and executor;
- one supported selected Ink feature -> E planner/executor;
- any unsupported or ambiguous feature graph -> free refusal.

Operation start then locks the model and re-captures exact stateVersion,
identity snapshot, and package snapshot. The E executor re-reads the complete
feature graph under that operation lock. The earlier route read grants no
write authority.

### 5.1 Replay-family law

The existing refresh and mint endpoints each become one replay family:

```text
refresh family: casting.refresh | evidence_package_sync
mint family:    casting.mint | casting.add_views | evidence_mint
```

Before deriving a kind from current state, the route looks up any existing
owner-scoped receipt by `clientRequestId`. If one exists:

1. its kind must belong to the endpoint's replay family;
2. the request payload is hashed using that stored kind;
3. matching payload replays or resumes the stored operation kind even if the
   model's feature state has changed since the first request;
4. only a real payload difference returns `payload_conflict`;
5. a stored kind outside the family refuses closed.

Only when no receipt exists may current server-owned state select the ordinary
or evidence-aware kind. This prevents a retry from changing authority class or
falsely conflicting merely because the first attempt already changed state.

The reverse case is equally deliberate: if an ordinary stored receipt is
replayed after the Cast has gained evidence, replay still resolves the stored
ordinary kind, then the ordinary executor's locked feature-blind start fence
refuses it. The route must not re-derive an evidence-aware kind for that old
request ID.

Evidence-aware operation start has a positive fence: it requires exactly the
supported single-feature graph, not merely the absence of a known
incompatibility. Unknown, additional, unverified, or version-drifted feature
truth refuses before charge or provider.

## 6. Evidence-aware plan

`planEvidencePackageSync` returns only public package facts:

- model ID;
- supported boolean;
- per-angle label, status, cost, and closed refusal;
- refreshable/missing angles;
- total cost for the requested set;
- whether a zero-generation evidence-aware mint is available.

It never returns feature text, plate/crop IDs, storage keys, hashes, private
delivery locators, probe truth, snapshot IDs, or recipe internals.

For each requested angle the plan requires:

1. owner-scoped live model and current snapshot pair;
2. available draft or minted status for progressive package synchronization;
3. exactly one selected feature for the pilot;
4. selected version belongs to that feature/model and matches the closed
   registry;
5. accepted candidate plate belongs to the same owner/model and exact version;
6. the selected slot's compatibility is positively `current` or a closed
   actionable stale/failed state; missing or unverified compatibility never
   guesses;
7. requested angle is canonical, registry-supported for the exact feature
   tuple, and is not `frontClose` or `frontFull`;
8. filled current slots are no-ops, not billable;
9. filled stale or failed slots are refreshable;
10. missing non-anchor slots are addable through the same evidence-aware
   recipe;
11. no unresolved intent or ready candidate exists.

This avoids a product trap: a user need not purchase every canonical view
before adding a tattoo. After Accept, E may explicitly add a missing package
view or refresh a stale one using the selected evidence.

## 7. Server-owned composition

### 7.1 Inputs

For each angle, the executor loads:

1. immutable identity anchor bytes;
2. the current target bytes when refreshing an existing slot, otherwise the
   current accepted `frontFull` as body/framing reference, then renders an
   in-memory angle-and-side-specific visual placement guide over that target;
3. accepted private candidate plate bytes, cropped in memory to a generous
   contextual upper-torso region.

The crop rectangle and target guide rectangle are separate server-owned
geometry. Both come from the exhaustive `(angle, zone, surface, side)` registry.
The crop includes surrounding anatomy and skin so the model can project the
feature physically. The target guide marks where the accepted feature belongs
in the requested view and which anatomical side must be visible. Neither is a
client value, a flattened tattoo overlay, or a persisted object.

Every input is decoded, bounded, canonicalized, and content-verified before
provider contact. Public package inputs use `fetchTrustedImage`; private plate
inputs use the private evidence adapter with exact byte-size/hash closure.

### 7.2 Prompt law

The composer receives no client-authored prompt beyond the already accepted
normalized descriptor stored in feature truth.

It must:

- preserve the exact identity from the anchor;
- preserve the target angle, pose, crop, clothing, background, and lighting
  when an old target exists;
- produce the exact canonical framing when the slot is missing;
- reproduce only the selected accepted tattoo when the region is visible;
- apply correct anatomical laterality and perspective;
- omit the tattoo when the anatomical region is genuinely hidden or outside
  frame;
- invent no other tattoo, mark, text, scar, jewellery, object, or body change;
- output one complete flattened image only.

For the current anterior-pec tattoo, a missing Walk uses a flexible strict
profile direction and explicitly omits the hidden feature. `side` is placement
laterality on the anterior surface, not authority to rotate or mirror the body
until the tattoo appears. A future lateral-surface recipe must introduce a
distinct ontology/surface and calibrate its own facing law.

### 7.3 Reference budget

Maximum three images:

- identity anchor;
- guided target/body reference (derived in memory from the original target);
- contextual accepted-evidence crop.

No raw uploaded reference is forwarded. Once the feature is accepted, the
accepted feature image is canon evidence; the original inspiration image is
not package-generation authority.

## 8. Strict view-specific probes

Evidence package generation uses a new fail-closed probe recipe, not
`backViewGate`.

For each candidate, strict structured probes establish:

- exact same person;
- canonical angle/pose/framing;
- body, hair, skin, clothing, and background continuity;
- predicted versus observed feature-region visibility;
- the actually visible anatomical side and actual travel/facing direction
  when a future directive requires them;
- accepted tattoo match when visible;
- correct anatomical placement/laterality/perspective;
- correct omission when hidden;
- no unexpected tattoo or mark.

Every response uses an exact closed JSON schema with bounded confidence.
Malformed JSON, extra fields, missing fields, provider outage, or `unknown`
means no canon commit.

For current Walk generation, the observed feature region must be hidden and
the authorized feature absent. Requested direction, filename, canonical slot
name, prompt text, or a left/right placement label is never substituted for
image-derived visibility proof.

Attempt one failure may produce one server-owned retry directive. Attempt two
failure refunds the view in full. Retry directives are closed values; raw probe
prose is never stored, logged, or sent to the client.

## 9. Billing and provider boundary

- One requested view costs `slotCost(angle)`.
- Current pilot missing-Walk generation costs 300 credits. Existing Walk
  selections are unaffected and never quote a preservation refresh.
- The server plan is the only price source.
- Structural/authority refusal occurs before operation start, charge, storage,
  or provider.
- One parent operation deducts the requested total once.
- The included second attempt costs zero.
- Each terminal view failure has one deterministic named refund.
- A total failure refunds the full parent charge.
- Replay never repeats charge, provider, storage settlement, or refund.
- Daily quota counts one deliberate parent view action, not internal attempts.

## 10. Public output and atomic commit

Provider output remains non-canonical until all probes pass.

Successful bytes are written to the normal public model namespace through the
existing bounded image-storage path. Then one
`commitEvidencePackageSyncSnapshot` transaction:

1. locks the live owner-scoped model under the operation receipt;
2. requires operation kind `evidence_package_sync`;
3. re-checks exact expected snapshot head;
4. re-loads and validates the selected feature graph;
5. re-validates that each requested slot still needs the operation;
6. inserts one immutable `model_assets` row per successful view;
7. records provenance with engine, recipe, source angle, accepted feature
   version ID, identity stamp, guide-recipe version, required visible
   anatomical side, probe-observed anatomical side, and observed travel
   direction — never a private key or URL;
8. inserts one package snapshot copying unchanged selections;
9. selects successful outputs as `current` / `refreshed`;
10. copies feature selections byte-for-byte;
11. CAS-updates the model head;
12. finalizes the operation and accounting truth.

Any failure rolls back all database writes for that settlement. Public bytes
written before a failed transaction enter the existing exact-key
cleanup/refund path.

Legacy `model_assets.status` remains parity-compatible:

- superseded stale/failed selected rows remain immutable history;
- the newly generated selected rows are current;
- unrelated rows are untouched.

## 11. Evidence-aware mint unlock

E never lets the old evidence-blind mint executor cross feature truth.

`planEvidenceMint` is available only when:

- the current identity has exactly the supported selected feature graph;
- every requested tier slot already exists and is `current`;
- no failure marker, stale selection, missing selection, or unverified
  compatibility remains inside the requested tier;
- no unresolved intent or ready candidate remains;
- the model is a named draft;
- ordinary mint integrity and seal checks pass.

Missing, stale, or failed optional views outside the chosen tier do not block
mint. They remain eligible for a later deliberate evidence-aware package
action after mint; the identity stays immutable and no view is generated
implicitly.

The action costs zero when no view generation is needed. It creates operation
kind `evidence_mint`, then one evidence-aware snapshot transaction:

1. locks/re-checks the exact current snapshot and selected feature graph;
2. generates no image and calls no provider;
3. changes no identity document, feature version, feature selection, asset,
   or package selection;
4. sets the existing package/identity seal and lifecycle fields atomically;
5. allocates the cryptographic KI public ID through the existing bounded
   unique-index retry;
6. finalizes one idempotent operation receipt.

If a required slot is missing or stale, Mint returns the E package-sync plan
instead of generating implicitly. This keeps every spend visible and keeps
mint settlement small.

## 12. API and client integration

No new client authority fields are added.

Existing endpoints remain the product surface:

- `generation.refreshSlotsPlan`
- `generation.refreshSlots`
- `generation.mintPackagePlan`
- `generation.mintPackage`

The server chooses the ordinary or evidence-aware implementation from current
durable state. Inputs stay strict and contain only model ID, canonical angle
set/tier, name where already required, and client request ID.

Client changes:

- accepted panel changes its terminal copy from a dead-end warning to
  “Tattoo saved. Views that cannot show it stay unchanged.”
- anterior-pec acceptance leaves every existing Walk alone and shows no Walk
  refresh action;
- a genuinely missing Walk remains an ordinary deliberate 300-credit optional
  coverage action;
- Package Health uses the same server plan and action;
- before any E spend or mint, the accepted-Ink panel states that freeform
  Recast, Iterate, Variations, and Restore remain unavailable for this
  evidence-bearing Cast in the current release;
- loading/success/failure use the existing operation bridge and cross-tab
  invalidation;
- after all required slots are current, the ordinary Mint affordance becomes
  available;
- no extra modal, anatomy form, or automatic navigation is introduced.

## 13. Recovery, deletion, and rollback

Operation recovery recognizes `evidence_package_sync` and `evidence_mint`.
Every operation-kind dispatch in public-result reconstruction, recovery
adjudication, cleanup, and receipt presentation becomes compile-exhaustive
over `GenerationOperationKind` using an exhaustive `Record` or `assertNever`.
Adding either E kind without an explicit branch must fail typecheck.

- Pre-provider crash: fail free, release lock.
- Charged/pre-result crash: exact refund.
- Valid generated result/pre-commit crash: cleanup exact public key and refund.
- Ambiguous package commit: re-read receipt, asset, package snapshot,
  selection, feature graph, and model head; never guess.
- Ambiguous mint commit: existing mint seal/KI/receipt truth adjudicates; never
  retry an unknown commit.
- Model/account deletion includes generated public assets through the existing
  ledger and keeps private accepted evidence under existing exact-key
  deletion.
- Fork copies the selected evidence graph as already proven; E works on the
  fork's copied private keys.

Scope-off rollback hides new authoring/package-sync controls and refuses new E
operations. Existing accepted and synchronized flattened assets remain
ordinary snapshot-readable truth. No data rollback is required.
An accepted-feature Cast with a stale/missing evidence-dependent slot is
therefore intentionally frozen while E scope is off; ordinary feature-blind
refresh/mint/edit routes must not bypass that freeze.

## 14. Implementation slices

Each slice receives typecheck, focused tests, and independent Opus/Fable
review. A slice does not authorize the next production operation.

### E1 — registry, plan, and pure recipes

- operation kinds and feature-authority classification;
- compile-exhaustive operation recovery/result dispatch;
- replay-family resolver preserving the stored operation kind;
- exhaustive angle/side feature directive and normalized guide registry;
- owner-safe public plan shape;
- in-memory contextual crop recipe;
- in-memory guided-target renderer;
- composer and strict probe request builders/parsers;
- no routed writer, provider, credit, or storage call.

### E2 — evidence package-sync executor

- locked feature graph loader;
- bounded public/private image loading;
- provider attempt + included retry;
- exact charge/refund and cleanup law;
- atomic evidence-aware package snapshot settlement;
- recovery/adjudication;
- route branch remains server-owned and founder-scoped.

### E3 — evidence-aware mint seal

- zero-generation plan and executor;
- no missing/stale implicit generation;
- unchanged KI/seal/lifecycle laws;
- progressive evidence-aware package expansion remains available after mint;
- recovery and replay.

### E4 — inline UX

- accepted-panel follow-up action;
- Walk tile and Package Health plan integration;
- replace the pilot `FEATURE_BLIND_OPERATION_MESSAGE` so refresh and mint copy
  reflects their new evidence-aware availability while the remaining
  evidence-blind edit paths stay honestly listed;
- operation bridge/cross-tab truth;
- no auto action and no new technical UI.

### E5 — disabled deployment and founder gate

- full unit/build evidence;
- disposable-MySQL failure matrix;
- scope-off deploy first;
- founder-only enablement using existing composer dependency fences;
- one bounded false-staleness compatibility repair and zero-generation mint
  ceremony, with no paid regeneration;
- empirically compare the missing-Walk three-reference composition, where the
  guided body reference and evidence crop derive from the same accepted image,
  and retain both only if the crop materially improves feature fidelity;
- rollback scope off on any failure;
- no cohort widening without separate review.

## 15. Verification

### Pure/unit

- exhaustive angle/side registry and unknown fail-closed;
- all anterior-pec sides keep existing Walk compatible;
- exact zero-cost refusal for a falsely stale Walk and exact 300-credit plan
  only for a genuinely missing Walk;
- no client price/feature/crop/recipe authority;
- crop and angle/side guide bounds/context and no persisted object;
- prompt reference order and three-image maximum;
- strict probe JSON and sticky unknown;
- hidden anterior-pec Walk cannot pass when the tattoo is visible or invented;
- replay uses the stored family kind after state changes;
- every operation-kind dispatch is compile-exhaustive;
- hidden-region omission versus visible-region preservation;
- retry truth table and refund math;
- ordinary featureless refresh/mint behavior unchanged.

### Disposable MySQL

- foreign model/feature/version/plate/asset refusal with victim unchanged;
- exact selected-feature closure under lock;
- a falsely stale parent-current Walk is restored only by the exact-cohort
  compatibility repair, with no new asset or package snapshot;
- missing view success uses the same evidence authority;
- unsupported feature/angle refuses before charge;
- snapshot race, feature race, delete, fork, and operation-lock races;
- every provider/probe/storage/commit failure boundary;
- exactly-once charge/refund and cleanup;
- successful E output makes only its slot current;
- pre-existing stale unrelated slots stay stale;
- zero-generation evidence mint seals exact current truth;
- evidence mint refuses missing/stale/failed/unresolved state;
- no provider or charge on evidence mint.

### Browser/founder

- accepted anterior-pec Ink shows no Walk refresh action for any side;
- the existing Walk remains the same selected image and becomes current after
  the separately authorized compatibility-only repair;
- no generation, provider call, storage write, or credit movement occurs for
  that repair;
- if a missing Walk is calibrated later, it retains the same person, uses a
  strict profile, omits the hidden tattoo, and invents no mark;
- Mint becomes available only when the tier is complete/current;
- Mint generates nothing and preserves all selected evidence;
- scope-off restores the pre-E refusal without breaking reads.

## 16. Explicit exclusions

- automatic refresh or spend;
- a second first-region Accept;
- arbitrary tattoos/zones/categories;
- add/replace/remove/erase;
- client-selected evidence or visibility;
- feature-aware freeform Iterate/Recast/Variations;
- identity-anchor refresh;
- minted identity editing;
- true whole-Cast restore (R7-7F);
- customer/cohort widening;
- persistent crop migration unless later evidence proves in-memory contextual
  crops insufficient.

## 17. Founder decisions

The founder supplied the required visibility correction on 2026-07-29:

- explicit paid actions are already ratified;
- `slotCost` fixes a genuinely missing Walk at 300 credits; it does not make an
  unaffected existing Walk billable;
- natural-language interaction and server-owned anatomy are D-70;
- D-71 remains the law for any future truly visible lateral feature, but the
  current anterior-pec tuple is hidden in Walk and may not borrow that law from
  its left/right placement label;
- no automatic spend is existing law;
- zero-generation mint merely unlocks the already-ratified mint ceremony once
  evidence-safe preconditions hold.

Any proposal to auto-refresh, change price, add a second feature, expose
placement controls, widen beyond founder scope, or let Mint generate missing
evidence-aware views implicitly requires a separate founder ruling.
