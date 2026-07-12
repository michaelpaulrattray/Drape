# The draft-state trap — assessment (VC-R6b; founder rules before builds)

**Status: REPORT ONLY.** Commissioned at VC-R6b (2026-07-13). The immutability rules have made the F6/F5 story partially unreachable: marks are refused on minted models (correct, D-43), allowed on drafts — but drafts are headshot-only by construction (D-46 rider 1: view generation IS the mint gate). "Iterate a distinctive mark onto a draft's views" is a state that cannot exist; the stale-writer's motivating case has no real-flow path; and the refusal's "fork to explore it" door leads to the same trap one generation later. Question: what state does a fork actually arrive in, can any state hold views + free identity iteration, and what is the honest resolution?

---

## 1. The truth of the current states (verified against code, 2026-07-13)

| Question | Code truth |
|---|---|
| What does a fork arrive as? | `executeApplyModelEdit` (decision `fork`) → `generateCastCandidate` generates a **new headshot** from the merged prefs → a **new model, `status: 'draft'`, ONE `frontClose` asset**, landed as an unnamed-draft `library_cast` node with a `forked_from` edge (`server/lib/boardOps.ts:738–762`). **A fork is a headshot-only draft** — the exact state the trap describes. |
| Can a draft hold views? | Structurally no, today: the only view generators are `executeMintPackage` (which **calls `mintModel` in the same op** — views and identity-freeze are fused) and `refreshSlots` (refuses `unfilled` slots — it regenerates, never creates). A draft's ghost tiles route to the mint gate by D-46 rider 1, ratified knowingly. |
| Can a minted model take identity iteration? | No — the A1 seal (`shouldRefuseIteration`: `status !== 'draft' && identityLevel`). Cosmetic only, by D-43.2. |
| So which state holds views + free identity iteration? | **None.** Draft = free iteration, no views. Minted = views, sealed iteration. The C5 stale-writer (`model.status === 'draft' && identityLevel` → stale siblings) is live code whose trigger condition requires a state that no flow can produce. |
| Do the gates depend on minted status? | No — the back/walk identity gate verifies against the **current headshot**, not against mint state. Nothing in the generation pipeline itself requires the model to be minted; the fusion is one `mintModel` call inside `executeMintPackage`. |
| Is F5's promise honest today? | Partially: "add a small tattoo" works on a draft's **headshot** (single view — nothing to stale) and is refused on minted. The multi-view mark story the placeholder implies is unreachable. |

## 2. The options, priced

**(a) Views without minting — drafts (forks included) can build their card pre-mint.** *Recommended.* Decouple the `mintModel` step from view generation: `executeMintPackage` gains a `mint: boolean` (or a draft-tier variant) — same slots, same per-slot pricing, same identity gates (they already key off the headshot, not mint state), same failed-slot contract; the model simply **stays a draft** until the user names-and-mints deliberately. The tier dialog on a draft offers "add views — stays a draft" alongside the mint tiers; ghost tiles and the strip verb route unchanged.
- What it repairs: the fork door's promise becomes true (fork → draft-with-views → iterate marks freely → siblings stale → bulk refresh → re-mint when done — the ENTIRE C5 machinery lights up on real flows); F5's placeholders stop overselling; D-46's "one view system" is preserved (one generator, one gate set, one pricing).
- What it amends: **D-46 rider 1** (knowingly-ratified "exploring beyond the headshot is a Core mint away") — reversed for exactly the reason rider 1 flagged it: the mint gate turned out to also be an identity freeze, and freezing at view-time contradicts the draft tier's exploration covenant. D-43 is untouched — mint remains the immutability moment; it just stops being the only door to views.
- Cost: **~0.75–1d** (mint-flag split + tier-dialog draft path + drive leg: draft mints views without status flip; stale-writer fires end-to-end).

**(b) A "revision session" state on minted models.** A deliberate mode where a minted model temporarily accepts identity iteration, re-verifying on exit. Rejected on the law: it reintroduces the exact D-43 bypass class the seal closed (identity mutation on a minted `modelId` that downstream work already references), plus a new state machine (~1.5d+) and a re-verification story nobody asked for.

**(c) The copy stops promising.** Refusal copy drops "fork to explore it" for mark-type edits (or reframes: "marks join at casting time"); F5's placeholder examples drop the mark examples on minted models. Cheapest (~0.1d) and honest — but it retires the F6 story rather than completing it: the stale-writer stays live-but-unreachable (draft headshot edits have no siblings to stale), and "candidate comparison with distinctive marks" (D-42's core workflow) remains impossible past the headshot.

## 3. Folded question: the popped-view toolbar

A popped view is a **reference** (D-30: per-view edges are intent annotations; the pop-out is a work surface, not a wiring requirement). Its current toolbar is the root's six verbs with Rerun/Variations disabled — three dead slots and an Edit-equivalent strip that routes identity-shaped expectations at a view. **Recommend slimming to view-appropriate verbs: `Return to sheet` · `Download` · `Delete` · `Info`** — Edit reserved for the root (identity work has one door), refresh stays in the tile popover where its plan/cost lives. Cost ~0.25d; rides C6 if ruled.

## 4. Recommendation

**(a)**, with the D-46 rider-1 amendment recorded in the decision log. It is the only option where the shipped trust machinery (seal, stale-writer, fork door, bulk refresh) forms a closed loop on flows a user can actually walk; (c) is the honest fallback if the rider-1 amendment feels wrong. Nothing builds against this until you rule.
