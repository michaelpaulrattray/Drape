# Reference-bleed assessment — mark propagation across the package

**Status: RATIFIED (founder, 2026-07-13) — detection ships now; propagation is calibration-gated, logged as a D-30 amendment pending calibration.** Raised at VC-R6 final round 3 (F4). The detection half (siblings go stale when a mark lands on one view) ships now and is proven; the **propagation** half (making the other views actually carry the mark) is **not built** — gated behind the calibration run below. If the engine can't earn it, detection-only is the feature.

## The problem the loop exposes

D-55's walkable loop is: draft → add views → mark up one view (a tattoo) → siblings go stale → refresh → they match → mint. The last "→ they match" step is the hard one. Today `refreshSlots` regenerates a stale view from **the current headshot + identity text** (`composeIdentityPayload`, D-30 strategy b). A mark added to the full-front view is **not** in that payload, so a refresh regenerates the sibling *without* the mark — it "syncs" to an identity that never had the tattoo. The views are now consistent-without-the-mark, which is not what the user asked for.

Making the sibling carry the mark means feeding **the edited view itself** as a reference. That is where the danger the founder named lives.

## Reference bleed — the failure mode

Feeding the edited view as a reference risks the generator copying **more than the mark**: the pose, the framing, the crop — or placing the mark wherever it likes rather than where anatomy dictates (the throat tattoo the founder saw could land on a refreshed headshot at the wrong size, or on the forearm of a side view that should not show it at all). A naive "here are two images, make them match" prompt gets all of this wrong.

## The proposal (three parts, in order)

### (a) Roled references with explicit per-reference intent

Never send an unlabelled image set. The repair-refresh payload is composed with each reference's job stated in the prompt:

- **Identity anchor** = the current canonical headshot. *"This is who the person is — face, skin, hair, build. Reproduce this identity exactly."*
- **Mark reference** = the edited view. *"Take ONLY the distinctive mark (the tattoo) from this image — its design, colour, and anatomical location on the body. Do NOT adopt this image's pose, framing, crop, or camera angle."*
- **Pose/framing** = dictated by the target angle's own spec (the same view-generation prompt that produced the original), never by the mark reference.

This is a net-new composition mode in `composeIdentityPayload` — call it `composeRepairPayload(modelId, targetAngle, markSourceAssetId)` — so the existing view/mint path is untouched.

### (b) Repair-refreshes run through the identityCheck-class gate

A repair-refresh is the **highest-drift generation class in the product**: two image references pulling in different directions, plus an anatomical-placement demand. It must be gated exactly like back/walk views (`verifyViewIdentity`): generate → gate → one auto-retry → then **named-and-refunded**. The gate here checks *both* identity match (it is still her) *and* mark presence/placement plausibility. A repair that fails the gate costs the user nothing and says so.

### (c) A calibration run BEFORE this ships — and the honest fallback

Before wiring propagation into the refresh button, run a **calibration**: N (≥20) repair-refreshes on a test model carrying a distinctive, unambiguous mark (a specific forearm tattoo), across all target angles, **human-graded** on three axes:

1. **Mark transfer** — did the mark appear at all?
2. **Placement** — is it in the right anatomical spot, right size, right prominence (not on the throat of a headshot)?
3. **Bleed** — did pose/framing/identity leak from the mark reference?

**Decision rule (the founder's, restated):**
- If the engine does this **reliably** (a bar the founder sets — e.g. ≥80% clean on all three) → ship propagation behind the gate, offer copy becomes "refresh to carry your edit across the views".
- If it **can't** → ship **staleness detection WITHOUT auto-propagation**. The `{N} stale` segment and the honest offer stay; the refresh regenerates from the current identity (as today, honestly labelled "regenerates against the current headshot"), and **mark propagation is logged as engine-dependent** — revisited when the engine improves or a staged-composition escape hatch (D-39d) is built. A smaller true feature over a larger lying one.

## What ships this round (r3), independent of the ruling

- **Detection** — marks are now the canonical stale trigger (`namesAPermanentMark`, deterministic; no flaky LLM verdict), the stale-writer fires on drafts, the `{N} stale` segment and bulk-refresh dialog surface on the board. Proven by unit + drive.
- **Honest offer copy** — the bulk-refresh dialog already says "regenerates against the current headshot" (no propagation promise). It stays honest until (c) rules otherwise.

So the loop **detects** divergence truthfully today; whether it can **auto-repair** it is the calibration's call, and yours.

## Where this touches the law

- Extends **D-30** (weighted reference semantics) with a new roled-reference composition mode — consistent with its escalation-path framing ("switching composition is a change to one function, not to callers").
- Extends **D-53 / F6** (the stale-writer) from detection into optional repair.
- The gate reuses the **D-39 / D-46** identityCheck-class retry-then-refund contract.
- The "guarantees over workflows" rider (Group 6h) applies: the composer must degrade gracefully if the engine can't propagate — never pretend.

---

# F6-ASSESS — the headshot refuses Refresh on a draft (fossil, or correct?)

**Status: RATIFIED + APPLIED (founder, 2026-07-13)** (raised r3, F6). The headshot stays non-refreshable; the refusal copy is now status-aware and routes the draft case to iterate-in-environment. The question was: on a draft, where identity is explicitly fluid, is the refusal a has-views⇒minted fossil?

## What "refresh the headshot" would actually mean

Refresh regenerates a view **from the current headshot + identity text**. The headshot *is* that anchor — there is nothing to regenerate it *from* except the text prompt, i.e. a re-roll of the face from scratch. That is not a refresh; it is a re-cast, and it produces a different person **regardless of status**. So the mechanism-level refusal is correct even on a draft: you can't "refresh" the thing every refresh is defined against.

The second reason it's correct: the headshot is the anchor for **every** other view (D-30). Changing it doesn't stale one sibling — it invalidates the **whole package**. A casual per-slot Refresh button is the wrong weight for a whole-package identity event.

## But the copy IS a fossil

"Fork instead" is the **minted** answer. On a draft, identity is fluid and forking is wrong — the honest route to changing a draft's face already exists and already works: **iterate the headshot in the environment** (select the headshot, type the change; the server allows identity edits on drafts, r2-proven). So:

- The refusal should **stay** (refresh-from-anchor is meaningless for the anchor), but be **status-aware**:
  - Minted: *"The headshot is this identity — changing it forks a new model."*
  - Draft: *"The headshot anchors every view. Edit it in the environment — she stays a draft, and the other views will flag for a refresh."*
- Iterating the headshot on a draft should **stale the whole package** (every other filled, unpinned view), because every view descended from the old headshot. The machinery already does this: `selectStaleSiblingHeads(assets, "frontClose")` returns all other view heads — so a headshot iterate already whole-package-stales, *if* the edit classifies identity-level (now deterministic for marks; the LLM handles the rest).

## Recommendation (one-liner for the ruling)

Not a fossil in mechanism — a fossil in **copy and routing**. Keep the headshot non-refreshable; make the refusal status-aware and route the draft case to **iterate-in-environment** (which whole-package-stales). Net honest affordance: *the headshot is edited, never refreshed; editing it on a draft is free and re-flags the package; on a minted model it forks.* No new generation path — this is copy + a confirmed stale-cascade. **Not built — your ruling.**
