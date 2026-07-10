# Canvas Review Brief — read before the three canvas docs

**Status:** authoritative addendum to `CANVAS_FOUNDATIONS.md`, `DESIGN_SYSTEM.md`, and `CANVAS_AUDIT_ADDENDUM.md`. Those three were written pre-migration by an earlier model. Their product philosophy and design language are **strong first drafts written with the founder and carry his locked taste**; their code claims are partially stale. This brief records what has been independently verified against the current codebase (July 2026, post-Manus-migration), the design gaps the originals don't cover, and the founder's newly articulated pass-4 vision. Where this brief conflicts with the older docs, this brief wins.

---

## 1. Verified code drift (checked against the live repo — treat as fact)

1. **`server/_core/llm.ts` no longer exists.** It was deleted in the Manus cleanup (it proxied forge.manus.im). CANVAS_FOUNDATIONS §3a and PARSER_PROMPT_V2 both route the inline prompt parser through it. The parser needs a new home in the existing Gemini service layer (`server/casting/` — note it already has queue + circuit-breaker infrastructure the parser should reuse).
2. **Audit finding A1 is still true.** `useCastingGeneration.ts` still imports and reads `useCastingFormStore`, `useCastingGenerationStore`, and `useCastingUIStore` at the top of its body. The store-decoupling prerequisite stands as written.
3. **Partial component extraction has already happened.** `TriBlendSelector.tsx`, `HairColorWheel.tsx`, and `WarmPrimitives.tsx` exist as standalone files under `features/casting/components/`. Re-verify audit finding A2 (BrandSelector extraction) and every Section G claim against current files rather than trusting the addendum's line references.
4. **Section H is still true.** `WarmPrimitives.tsx` still carries duplicate ethnicity/hair-color constants.
5. **Both parser prerequisites are still unmet.** No `Mediterranean` in any ethnicity enum; no override fields (`castingBrandOverride` etc.) in the preferences types.
6. **No canvas-foundations code exists yet.** Zero occurrences of `provenance` or `boardOps` in the boards feature or routes. Pass 1 is greenfield on the board side.
7. **Environment changes since the docs were written:** storage is Cloudflare R2 (public-URL serving via `R2_PUBLIC_URL`; CSP img-src is derived from it — new asset origins must be added there); all Manus platform code is gone; the app deploys to Railway from the `local-migration` branch; a unified lobby exists at `/app` with a cross-tool `lobby.recentWork` union feed; studio entry is URL-driven (`useStudioEntry`). New canvas routes/nodes must slot into that navigation model, and boards created from the lobby use `startedWith: 'blank'`.

## 2. Design gaps the originals don't address (mandates for the revision)

These are the areas where competitor canvases (Luma, Flora, Higgsfield-class tools) are ahead and the docs are silent. Each needs a designed answer, not a mention:

1. **Zoom & density strategy (highest priority).** The system is specced at ~100% zoom with few nodes. 10–11px external labels, 0.5px hairlines, and below-card control strips all degrade at 40% zoom on a 50-node board. Propose zoom-adaptive rendering: what simplifies, at what thresholds, and how selection/labels behave when small. This must not compromise the flat/hairline language at working zoom.
2. **Color as information.** Monochrome + one teal means node types, statuses, and edge kinds differentiate by text and position only. Take a considered position: either defend pure monochrome at density with concrete mechanisms (shape, weight, badges), or introduce a minimal, tokenized semantic accent set. Specifically challenge the "destructive actions are never red" rule — a red confirm action inside a dialog is a universal safety convention and costs the aesthetic almost nothing.
3. **Empty states & first-run.** No chapter exists. Design the empty board state and a first-run intro in the spirit of Higgsfield's canvas intro (founder request — a welcoming, capability-showing entry moment, executed in Drape's restrained language, dismissible and never seen again). Also: empty states for a node with no output, a board with failed generations, and the views popover when all views exist.
4. **Keyboard & command surface.** `Cmd+K` is deferred to pass 3 and undo to pass 4 in the originals. Reassess: undo on a destructive spatial canvas is arguably a pass-1 trust feature. At minimum, specify the keyboard model now (selection, nudge, delete-with-confirm, escape semantics) so components are built against it rather than retrofitted.
5. **Multi-engine future (pass 3+) and video (pass 4).** The `engine` provenance field and NodeLabelRow engine slot already anticipate multiple image models. Ensure nothing in pass 1 hard-codes single-engine assumptions in `runGeneration`'s shape. Read `PASS_4_VIDEO_NOTES.md` and confirm the pass-1 primitives (kind enum extensibility, pins/edges, control strip, refinement studio hosting) accommodate a video node without rework.

## 3. What is locked vs. open

- **Locked (founder taste; challenge only with explicit argument, never silently):** the reference-asset framing of casting (§1.5), inline-first tool invocation, root/view node model, edges-as-lineage, the ten design non-negotiables, the anti-patterns list, sentence case / two weights / hairlines / no modals.
- **Open (improve freely, log decisions):** everything in §2 above; component-level specs where the current codebase has diverged; the parser's integration point and model choice; pass sequencing and estimates; anything the re-audit finds that the originals missed.

## 4. Improvement proposals (evaluate on merits; founder ratifies via the decision log)

Proposed by a second-model review with the current codebase in hand. Not locked — argue against any of them if the argument is good.

1. **Cast roots fork/recast instead of versioning.** Generic vN history is wrong for identity: a rerun cast is a different person, and downstream lineage becomes ambiguous. Rerun on a root becomes an explicit choice — fork a new root (new model) or replace identity (with full cascade invalidation). Image-gen and VTO nodes keep normal versioning.
2. **Provenance snapshots input assets at generation time.** Store the exact input asset URLs used, not just `rootItemId` pointers, so historical outputs remain truthful and reproducible after identity edits. Rework the stale flow on top of this: stale is informational, with a "pin/keep" action that marks an output as finished work exempt from regeneration pressure.
3. **Library ↔ canvas bridge.** The lobby's Models/Garments/Looks libraries postdate these docs. Spec both directions: canvas-minted casts flow into the Models library; the floating tool pill gains "Add from library" to place an existing model (provenance e.g. `type: "library_cast"`) or garment onto any board. Boards must not start from zero.
4. **Frames as export units.** Upgrade the pass-3 frame node from grouping furniture to the export mechanism: select a frame → export contents as PDF lookbook / PNG set. The canvas must produce deliverables, not just compositions.
5. **Credit cost at every point of action.** Generalize the views-popover cost pattern: every Run affordance displays its credit cost inline before execution (critical once video lands). No surprise charges anywhere.

## 5. Required outputs of the review session

1. **`CANVAS_AUDIT_ADDENDUM_V2.md`** — full re-audit of the current codebase superseding the original addendum: verify/retire each original finding, add new prerequisites, correct all file references.
2. **Revised `CANVAS_FOUNDATIONS.md` and `DESIGN_SYSTEM.md`** (or clearly-scoped delta documents) incorporating §1 corrections and §2 designs.
3. **`DECISION_LOG.md`** — every divergence from the originals, one line each: what changed, why, what it affects. This is the primary review artifact for the founder; he reviews decisions, not diffs.
4. **A pass-1 build plan** — step-by-step with founder visual checkpoints, starting with the prerequisite refactors, sized honestly.
