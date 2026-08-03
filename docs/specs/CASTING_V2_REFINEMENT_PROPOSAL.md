# Refine — pre-Sign candidate refinement

**Status: RATIFIED AS A FEATURE, SEQUENCED SECOND IN THE POST-M7 ORDER
(founder, 2026-08-01). Nothing built yet, and nothing may be built from this
document until its M8 slot.** Recorded now as design-before-build, the same
discipline the brand translation got: the spec is written and reviewed while it
is still cheap to argue with, and the build reads one authoritative document
rather than a chat transcript.

Ordering context: **Sign → Refine → Path B → Takes → invites open → Voice →
Fantasy** (D-86). M7 owes Refine exactly one thing in advance, and it is
one line: **Sign reads the candidate's SELECTED image key and never assumes a
single image per candidate.**

---

## 1. What it is

A candidate on the sheet can be *refined before it is signed*: open it in a
viewer, type an instruction, get a new variant of that same face. The pattern
is the one the founder named from Grok — a viewer with an instruction box, not
a form — and the engine underneath is Nano Banana Pro reference-guided editing,
which is already the identity engine M7's package orchestrator uses.

The whole feature exists **before** the Sign ceremony, on a candidate that is
still a candidate. That placement is the design, not an implementation
convenience — see §7.

## 2. Why it is second in the order

Two reasons, and the second is the one that decides it.

**It is the conversion mechanism.** Every refine is a deposit toward a Sign. A
user who has spent three instructions getting a face right has made the
decision that Sign merely records; a user staring at eight candidates none of
which is quite right has no next move except rolling again or leaving.

**It moves identity decisions upstream, where they are cheap.** Today the only
way to change a face is to Sign it and then revise the package (M12), which
means the decision gets made against a built package — six 2K views and a
snapshot — rather than against one 1K candidate image. Refine reduces post-Sign
revision churn by letting the expensive commitment happen after the face is
already right rather than before.

## 3. Anatomy

**The viewer.** A candidate opens into a viewer with the image large, an
instruction box, and the variant stack. It is a viewer, not a second cockpit:
one text input, no parameter panel. The 31-field identity form is the thing V2
exists to have replaced, and a refinement panel is exactly where it would grow
back.

**The variant stack lives inside the candidate card, and is viewer-only depth.**
The sheet always shows **ONE face per slot** — the selected variant. This is
non-negotiable and it is the framing law applied to a new surface: eight tiles
that compare as characters. A sheet where one slot has fanned into four images
is a sheet you cannot read at a glance, and the whole product is the glance.

**The selected variant is the candidate's face.** It is what the tile shows,
what Follow anchors from, what the echo describes, and what Sign signs. There
is exactly one selected variant at any time; selecting is free and instant
(no generation), the same way Keep is.

## 4. Base-anchored edits — the law that keeps it from degrading

> **Variant N = edit(ORIGINAL, composed instructions 1..N).** Never
> edit-of-edit. The original is immutable.

Every variant is generated from the **original candidate image** with the
accumulated instructions composed into one edit, not from the previous variant.

The failure this prevents is generation loss: each reference-guided edit is a
lossy re-render, so a chain of five edits is five generations of drift away
from the face the user actually picked, and the drift is invisible per step and
obvious at the end. Base-anchoring means instruction five is as faithful as
instruction one, and it means an instruction can be *removed* — the stack
re-composes and re-renders from the original rather than being stuck with
whatever the third edit did to the jaw.

It also makes the record honest: the original is what lineage points at, and
"this is candidate 04 with three instructions applied" is a true and complete
description of any variant.

## 5. Scope tier at v1: eyes-only

v1 refinement is deliberately narrow — the **eyes-only tier**. Colour, shape,
the things a user looks at a face and wants nudged. Not age, not heritage, not
sex, not build: those are casting decisions and the answer to "I want an older
one" is to roll or to adjust the brief, not to edit a photograph into a
different person.

**There is no validator pre-Sign, and that is deliberate.** The cohort
validator's job is to guarantee that a signed identity is preserved across
views, and pre-Sign there is no signed identity to preserve — the candidate is
still exploratory. **Sign remains the only identity guarantee in the product.**

That line is a UX battle, and it is fought in **copy**, not in a gate. A user
who has refined a face four times feels they have committed to it, and Sign
must not read as bureaucracy asking them to commit again. The copy has to make
Sign read as *what makes this face permanent and reproducible* rather than as
*confirm your confirmation*. Naming it here so the M8 copy pass treats it as a
known hard problem rather than discovering it at the gate.

## 6. THE HARD CONDITION — the record round-trip ships with v1

> **Every edit instruction goes through the interpreter to update the variant's
> persisted identity.** Not a later hardening pass. v1 or the feature does not
> ship.

An edit changes the image. If it does not also change the record, then the
record describes a face that no longer exists — and the record is what Follow
anchors from, what the sheet-taste pass reasons over, what the echo says out
loud, and what Sign snapshots as identity truth. A user who refines a
candidate's eyes to green and then follows it would get eight cousins of the
brown-eyed original, and nothing anywhere would explain why.

This is **the record-that-lies class, minted in reverse.** Every previous
instance was a value resolved and persisted but never composed into the prompt
(five founder-caught cases, [[unowned-axis-collapse]]). This one is a value
composed into the picture but never written to the record — the same
disagreement, arrived at from the other side. The class is expensive enough
already; shipping a fresh source of it would be indefensible.

**Mechanism:** the instruction text goes through the same interpreter path a
brief does, under the golden-harness rules — which means the goldens gain
refinement instructions, and an interpreter-prompt change is verified against
them live before it ships. The interpreter proposes; code disposes; the
structured result updates the variant's `resolvedIdentity`. An instruction the
interpreter cannot read into a structured change is refused honestly rather
than applied to the image and dropped from the record.

## 7. Why pre-Sign rather than post-Sign

Post-Sign revision already exists as a planned ceremony (M12): frozen snapshot,
derived affected views, atomic commit or full rollback. That machinery is
correct *for a Cast*, and it is heavy because a Cast is a durable commitment
with a package hanging off it.

A candidate has none of that. It has one image, no package, no snapshot, no
downstream consumers. So refinement there is cheap, reversible, and needs no
atomicity — which is exactly why it can be a viewer and a text box rather than
a priced ceremony with a confirmation. Trying to give a candidate the M12
treatment would make it as expensive as the thing it exists to avoid.

## 8. What M7 must not violate

M7 builds Sign now, before this exists. One requirement carries back, and it is
the only one:

- **Sign reads the candidate's selected image key.** Never `candidate.imageKey`
  as though there could only ever be one. Today there is exactly one, so this
  costs a single indirection and no schema; when variants land, Sign signs the
  face the user is actually looking at rather than the one they started with.

Everything else in this document is M8 work.

## 9. Open questions for the M8 slot

Recorded rather than answered, because answering them now would be guessing
twice:

1. **Pricing.** A refine is a real NBP generation with a real COGS. Priced per
   variant like everything else in V2 (D-15: a price on every paid affordance),
   but the number is set when M3's unit costs are re-checked against the
   edit endpoint, not now.
2. **Variant retention.** Variants are candidate-scoped, so §G.6's "nothing
   unused outlives its sheet" presumably governs — but the signed candidate's
   siblings survive with the Cast, and whether *unselected variants of the
   signed candidate* do is a real question with a storage cost attached.
3. **Refusal surface.** An eyes-only tier needs an honest refusal for
   out-of-tier instructions ("make her older"), and the copy for that refusal
   is the difference between a boundary that reads as care and one that reads
   as a broken feature.
4. **Follow from a variant.** Presumably legal and presumably anchors from the
   variant's updated identity — but it interacts with lineage in a way that
   wants stating before it is built.

---

**Provenance.** Founder feature, ratified 2026-08-01 alongside the post-M7
ordering (D-86). This document is the spec of record; amend it in place rather
than writing a delta (P-1).

---

# PART II — THE SETTLED DESIGN (advisor-ruled 2026-08-03, before any code)

Part I proposed. This is what gets built. Where the two differ, this wins.

## 10. Instructions are parsed AT ENTRY, never at render

The crux Part I left ambiguous. "Compose instructions 1..N" is easy to say and
has at least three meanings, and the wrong one produces "green eyes" and "brown
eyes" fighting inside a single prompt.

**Each instruction goes through the interpreter ONCE, when it is typed**, with
the current composed identity as context, and returns an **absolute structured
delta** — closed vocabularies wherever one exists, plus a capped labelled
free-text slot for things no enum holds (makeup finishes), which is the same
doctrine the intent's two free-text fields already live under.

Composition is then **mechanical code**: per-axis last-writer-wins over the
original's `resolvedIdentity`. No interpreter call at render time, so:

- a re-render is deterministic;
- removing an instruction is arithmetic, not a re-interpretation;
- **a refusal happens before any charge**, mirroring the roll's own
  "compile and admit first" arrow.

### The load-bearing consequence

**The edit prompt AND the variant's `resolvedIdentity` derive from the SAME
deltas.** The user's raw sentence is kept as provenance and is never sent to the
image model alongside the parsed deltas as parallel bookkeeping — that is the
record-lies class rebuilt with extra steps. One source, so the record cannot
drift from the picture by construction rather than by discipline.

### Recorded, because it is a real edge

Relative instructions ("shorter still") resolve to **absolutes at entry**. So
removing an earlier instruction leaves a later one holding the value it resolved
to at the time. That is honest and deterministic, and it is not what a naive
reader expects, so it is written down rather than discovered.

### Registry, not convention

Any refinement axis with no existing home — eye shape, makeup — is **registered
in `axisRegistry`**, so the D-87 composed-boundary sweep proves it is composed
everywhere it is read. A refinement persisted but never composed into Follow's
prompt would be unowned-axis instance seven.

## 11. The record round-trip, and the two live landmines

A variant owns a **full** `resolvedIdentity` = `apply(original, deltas)`,
persisted in the same `internalPrompt: { prompt, resolved }` shape the candidate
already uses.

**Sheet-level taste is NOT re-run.** It balanced eight faces at roll time; a
per-face edit is the user's deliberate choice, and re-balancing would move faces
they never touched.

Two places in today's code would quietly betray this, and both read the
candidate directly rather than through selection:

- **`signService.ts` → `identityDocumentsFor(source.candidate.internalPrompt)`.**
  If Refine only swaps the image key, **Sign snapshots the ORIGINAL's record
  under the VARIANT's face** — record-lies at the single most expensive site in
  the product. The selected variant must supply the key *and* the identity
  documents, read in one statement.
- **`rollService.ts` → `readResolvedIdentity(parent.internalPrompt)`.** Follow
  reads the parent candidate directly, so Part I's own green-eyes/brown-cousins
  example is live at that line until Follow routes through selection.

`rollProjection` and the echo project the selected variant for the same reason.

## 12. Money — Sign's pattern, not the roll's

A direct-operation kind, **`castingV2.refine`**:

`beginDirectOperation` (with `clientRequestId` as the idempotency gate — a
replay returns the existing variant rather than buying a second) → `markRunning`
→ pinned deduct via `operationChargeReference` → generate → land.

**Whole-charge refund on throw**, which `withAtomicCredits` already does. This
is the one place that is right: a refine is ONE image and one unit, unlike a
roll's eight independently refundable slices. Do not invent per-slice here.

Riding along, none of it optional:

- **admission against the provider budget before the claim**, the roll's rule;
- a **recovery-adjudicator rule** for an expired refine operation — variant
  landed means complete, otherwise refund — in `signRecovery.ts`'s shape, with a
  `deployCollision`-style test;
- `assertNotFrozen` and the `CASTING_V2_SCOPE` refusal, like everything else.

**Pricing note for the founder gate:** removing a mid-stack instruction is a
PAID re-render — new composition, new generation. Backing up to a variant that
already exists is free selection. D-15 therefore puts a price on the remove
affordance, and the UI must not make the two look alike.

## 13. Eyes-only: what the copy actually is

The tier is a copy problem by ruling, and the temptation is a banner. Resisted.

- **One sentence at the Sign confirm**, making Sign the upgrade rather than a
  re-confirmation of something already promised: *Sign locks this exact face as
  her permanent, reproducible reference.*
- **Honest refusal copy at the instruction box** for asks outside the tier.
- **No drift warnings on the viewer or the variant cards.** A standing banner
  reads as hedging, and the restrained register is the house voice.

`renderFault` is borrowed on variant landings — same landing path, and garbage
refunds. **An embedding-drift signal is deliberately NOT borrowed:** a measured
and surfaced drift score is the validator wearing different clothes, and D-115's
own logic is that accumulated measurement becomes a gate by drift. Evidence for
later belongs in D-111's private bucket, post-v1.

## 14. Selection — a pointer, not a flag

`casting_candidate_variants`, append-only: the ordered instruction list
denormalized per variant, the deltas, `internalPrompt`, `imageKey`, a status
CAS, `operationId`, `pointsCost`, `expiresAt`.

Plus **`selectedVariantId` on the candidate** (null = the original).

**A pointer rather than a `selected` flag, and the reason is mechanical:** MySQL
has no partial unique index, so "exactly one selected" enforced by flag is a
race. A pointer holds one value by construction.

**The fence:** `getSignableCandidate` returns the pointer, the variant's key and
the variant's documents in one read; `signCandidateIntoCast`'s candidate CAS
gains `AND selectedVariantId = <the value that was read>`. A selection switched
mid-Sign therefore lands as `commit_conflict` and refunds, exactly like a racing
discard already does.

**The tree needs no schema.** It is emergent from prefix-sharing of instruction
lists, and every row stays self-describing — "candidate 04 plus these three
instructions". v1's UI is a linear stack with "edit from here"; no visualizer.

## 15. Not in v1

No reference images (v1.5). No multi-candidate refine. No post-Sign refine —
that is M12 revisions. No validator. **No batch instructions** — one
instruction, one variant, one price. No taste-pass re-run. No tree UI. No
embedding signals.

Must-ship, not optional: goldens gain refinement instructions (the hard
condition already requires it), axis registration, and the recovery plus
deploy-collision tests.

## 16. Founder items — batched, not assumed

1. **The per-edit price.** Proposed separately with rationale; nothing billing
   is built until it is ruled.
2. **Retention of unselected variants of a SIGNED candidate.** Recommendation:
   they follow ordinary candidate retention, because Sign copies its own anchor
   and the Cast therefore depends on nothing in the variant table. Part I §9.2
   recorded this as open, so it gets ratified rather than assumed.
3. **Follow-from-variant lineage** (Part I §9.4). Recommendation: Follow reads
   the SELECTED variant only, and the roll stamps `parentVariantId`. Cheap now,
   painful to backfill later.
