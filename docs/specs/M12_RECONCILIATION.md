# M12 close-out — the plan's spec beside the road that was actually built

*First pass, shift 81 (2026-08-17). Opened by fable-784 §5, shaped by fable-707
§1 (the founder's own sequencing: finish Refine → close M12 completely → only
then think about Takes) and fable-711 (his ruling that M12 does not close
without reference-guided edits).*

## What this document is, and what it is not

It lays each clause of the plan's M12 spec beside what the refine road actually
does today, and marks it **DELIVERED**, **REMAINING** or **SUPERSEDED**. It is
the same table shape V4 closed on.

**It is a reading, not a decision.** Every SUPERSEDED row is a claim that the
built road answers the plan's intent by another route, and each of those is a
founder question rather than an executor's ruling — they are marked so.

**Its limits, stated here rather than discovered later:**

- The evidence is code and production rows, not a running-app walk. A row marked
  DELIVERED means the mechanism exists and is reachable; it does not mean it has
  been dogfooded against this clause.
- Rows marked **(shallow)** were settled by one targeted read and deserve a
  deeper one before the remainder list goes to the founder.
- The plan text is quoted from `CASTING_V2_ARCHITECTURE_PLAN.md` lines 143, 269
  and 440. Nothing here is quoted from memory.

## The spec, clause by clause

The plan's M12 (line 440): *"focused editor (pan/zoom master, NL instruction,
current-vs-proposed, one price, Apply/Cancel), intent classifier
(take/revision/fork routing), affected-view derivation (fail-closed), NBP
regeneration + presence/absence/likeness probes, atomic commit/rollback."*
And the ceremony (line 143): *"draft request → classified (take|revision|fork) →
priced → approved → frozen snapshot → affected views derived → generate+validate
all affected → atomic commit | full rollback."*

| # | Clause | Verdict | Evidence |
|---|---|---|---|
| 1 | Focused editor — NL instruction, one price, Apply/Cancel | **DELIVERED** | The refine panel is that editor. `RefinePanel.tsx` carries the price stated once and never on the button (D-15/D-109), and the ask box is the NL instruction. |
| 2 | …pan/zoom master | **(shallow) likely DELIVERED** | `CandidateViewer` carries the scoped box on the picture; the pan/zoom half was not read this pass. |
| 3 | …current-vs-proposed | **REMAINING — and it is a founder framing question** | No before/after surface found in `client/src/features/castingV2/components`. fable-707 named "the current-vs-proposed ceremony framing" as a likely remainder and it is one. The refine road shows the delivered frame *instead of* the previous one, not beside it. |
| 4 | Intent classifier — take / revision / fork routing | **REMAINING** | No classifier in the built road; the shipped operation kinds are `castingV2.refine` and `castingV2.sign` (plus roll). There is no `castingV2.take` and no `castingV2.revision`. Every ask is a refine. |
| 5 | Affected-view derivation, fail-closed | **SUPERSEDED — founder question** | The only implementation is the legacy ink cluster's `inkViewImpact.ts`, which the plan itself keeps as a *law* and retires as a pipeline (line 376). The refine road has one view, so there is nothing to derive: the question "which other views does this change touch" does not arise until a cast has views again. **Whether M12 closes with one view is his call, not mine.** |
| 6 | NBP regeneration | **DELIVERED, by another engine** | The repaint road regenerates the whole frame from the pristine master plus cropped references (D-241, `CASTING_REPAINT_SCOPE=users:1` in production). The plan named Nano Banana Pro; the road dispatches GPT Image 2 for the edit and NBP for identity work. Same intent, different transport — flag it for him as a wording change, not a gap. |
| 7 | Presence / absence / likeness probes | **DELIVERED** | The render verifier reads the delivered frame per facet (`verification.checks`, `read`/`verified`), the content gate reads the region, and a failed reading refunds. This is the probe taxonomy under a different name. |
| 8 | Atomic commit / full rollback of a package | **SUPERSEDED — founder question** | No package: a refine produces one versioned variant, and the money is per-render with a refund on failure (D-187/D-246). The plan's all-or-nothing law existed because a half-updated *package* of views would be incoherent; with one view there is no half state to protect. Same question as row 5, same owner. |
| 9 | Frozen snapshot before generation | **DELIVERED in substance** | Every render anchors on `candidate.imageKey`, the pristine master, and the library rows are immutable versions along an ancestry. The freeze is structural rather than ceremonial. |
| 10 | Priced once, approved before it runs | **DELIVERED** | One price, stated once, confirmed before dispatch. |
| 11 | Migration `0020_casting_v2_revision_ops` | **REMAINING (and may be SUPERSEDED with row 4)** | Not present. `kind` is varchar(48) and needs no migration to carry a new operation kind, which the plan itself notes (line 323) — so this row lives or dies with the classifier. |
| 12 | Tests: the R7-7E-style suite re-pointed (partial failure keeps the previous package; refund truth) | **PARTLY DELIVERED** | Refund truth is heavily covered (`deployCollision.test.ts` asserts money conserved and every candidate terminal). The "previous package survives a partial failure" half has no subject until rows 5/8 are answered. |
| 13 | Gate: the founder performs a real revision and a refused one | **REMAINING — a founder gate, unchanged** | Both halves are reachable today (a paid refine that lands; a refusal that refunds). It has not been performed *as this gate*. |
| 14 | Rollback: revision flag off, the room simply lacks the Edit door | **DELIVERED** | `CASTING_REPAINT_SCOPE` off returns the road to paste-and-blend; `CASTING_V2_SCOPE` off removes the surface. |
| 15 | **Reference-guided edits** — "add features from reference images like tattoos or hair styles or makeup or whatever we want" | **REMAINING — founder-ruled, and M12 does not close without it** (fable-711) | Not built. The machinery it lands on exists: the library carries features as crops with digests and frozen bytes, the repaint road paints from references, and the flash-sheet design specifies upload → converted. What is missing is the DISTILLATION step — an uploaded image becoming the product's own reference form — and the upload path itself. |

## What the table says when you stand back

Three groups, and they are not the same kind of work.

1. **Mostly done, differently.** Rows 1, 6, 7, 9, 10, 14: the refine road
   delivers the plan's intent under other names, because the plan was written
   for a package-of-views product and the road was built for one frame.
2. **Two questions that are really one question, and they are his.** Rows 5 and
   8 — affected-view derivation and atomic package commit — are both answered
   by "there is one view". That is either a correct simplification or a deferred
   obligation, and which one it is depends on whether a Cast regains multiple
   views before launch. **This is the single decision that decides how much of
   M12 remains.**
3. **Genuinely not built.** Rows 3, 4, 15: current-vs-proposed, the intent
   classifier, and reference-guided edits. Row 15 is founder-ruled as blocking.

## What the next pass owes

- Deepen rows 2 and 12 (marked shallow / partial).
- Row 3: read the panel's own framing properly before calling it absent — a
  "current-vs-proposed" surface may exist under another name.
- Bring rows 5/8 to the founder as ONE question about views, not two.
- Size row 15 against `fable-711` §2's landing points, which is the only row
  that is a build rather than a reading.
