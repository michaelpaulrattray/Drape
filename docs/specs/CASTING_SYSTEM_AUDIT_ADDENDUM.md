> **SUPERSEDED (2026-07-15).** This is the first propagation addendum (2026-07-14 bench session), kept for the evidence record per the P-2 precedent. Its repair sequencing and canon architecture are governed by `CASTING_SYSTEM_AUDIT_ADDENDUM_REVISED.md` (corrections C1–C11) and the execution order by `CASTING_SYSTEM_R6_EXECUTION_PLAN.md`. Do not implement from this document.

# Casting system audit — addendum: the propagation architecture

**Status: REPORT — supersedes parts of R-A. Nothing here is built.** Written after a bench session (2026-07-14) that tested the two candidate propagation mechanisms against the live Gemini pipeline (`gemini-3-pro-image-preview`) and against the pre-repair codebase.

**Why this exists:** R-A was ratified on 2026-07-13 with a consequence clause asserting that text-channel propagation was sufficient and that image-reference propagation could stay post-pass. That clause is **empirically false**. This addendum records the evidence, inverts the clause, adds six divergences the original register missed, and re-scopes the repair sequence.

**Read this before continuing the R-A implementation leg.** Batch A and Batch B are unaffected and should proceed.

---

## 1. The headline

**The identity document cannot carry a tattoo. Only an image can.**

R-A said:

> *"text-channel propagation becomes the DESIGNED propagation path — a mark that stales siblings enters the document deliberately, so refreshes inherit it through the identity text; this is cheaper and safer than image-reference propagation, which stays post-pass and may never be needed."*

Two facts kill it:

1. **`refreshSlots.ts:144-165` passes exactly one reference image: the headshot.** A chest tattoo is not in the headshot. The plate that *does* contain the mark — the `frontFull` the user just edited — is never passed to anything.
2. **Text describes a class, not an instance.** "Large blackwork lion chest piece" produces *a* lion, not *his* lion. Gemini is told he has body art, told not to remove it, and has never seen it. It invents one — differently, every view, every generation.

So the current system is not F4's detection-only, nor its calibration-gated propagation, nor even V6's "accidental text propagation." It is **hallucinated propagation**. Worse than the register said.

**The mechanism that does work — validated on the bench, four views, one model:** compose each view from multiple roled references (identity + body + mark evidence crops). Marks held. Views read as one continuous piece on one person.

---

## 2. Bench evidence (2026-07-14)

Subject: minted-shape male draft, silver hair, deep brown skin. Mark applied: large blackwork chest piece (roaring lion, filigree, a rose per pectoral) continuous with an ornamental collar around the neck and a yoke across the clavicles.

### 2.1 Delta editing degrades at edit 3

Chained realistic edits with a preservation clause ("keep everything else exactly as is") onto an existing plate.

- **Result: visible breakdown by the third edit.** Detail collapsed into a painterly rendering — the re-encoding signature. Monotonic, baked into the new base, invisible per step.
- **Verdict: delta-edit-as-default is dead.** An edit budget of 2 is a countdown, not a mechanism. All associated design (`deltaDepth` counter, compose-reset threshold, hard gate, "this view has been edited several times" copy) is **cancelled** — it managed a mechanism we are not shipping.
- It also never solved the problem: a delta edit on a *sibling* view still has to invent the mark, because the base image doesn't contain it. Degradation **and** divergence.

### 2.2 Compose-from-references holds the mark

Three roled reference images + structured identity + per-view visibility lines, run against `sideClose`, `sideFull`, `backFull`.

| Check | Result |
|---|---|
| Mark reads as one continuous piece across all four views | **Pass** |
| Macro composition (lion centred on sternum, rose per pec, collar into neck) | **Pass** |
| Base image quality — any accumulation? | **Pass** — every view at generation-1 quality. No accumulation is possible by construction. |
| Back view: clean back, no invented ink | **Pass** — the `DO NOT INVENT ADDITIONAL BODY ART` clause held. The `backFull` hard-coded hack `"No new back tattoos."` can be retired. |
| Micro linework identical view-to-view | **Fail** — the neck ornament renders as different art (same style, same density, same placement, different geometry). |
| Nape continuity with the front collar | **Fail** — the model authored a discrete medallion; it does not visibly join the front band. |

**Two failures, both informational, not degradational.** The nape had no canon to reproduce — nothing had ever rendered it, so the model invented. That is fixable by feeding it more canon. Delta's failure gets worse with use; compose's failure gets *better* with use, because canon accretes. That asymmetry is the verdict.

### 2.3 Honest limit, for the product

**Fidelity is compositional, not linework-exact.** Placement, scale, style and composition transfer reliably. Fine filigree does not. Acceptable for a casting sheet; state it plainly rather than discovering it in a client pack.

---

## 3. Divergences the register missed (V16–V21)

All verified first-hand in the pre-repair codebase.

| # | Class | Divergence | Mechanism |
|---|---|---|---|
| **V16** | **BUG (armed)** | **`hasBodyArt` is a keyword grep.** `getStudioSettings(masterPrompt)` scans for `tattoo` / ` ink ` / `body art` / `wax seal` / `body branding`. A miss appends **`CLEAN_SKIN_RULE`: "6. TATTOOS: STRICTLY CLEAN SKIN. NO TATTOOS, NO INK, NO BODY ART."** — i.e. the pipeline instructs Gemini to **erase** the model's marks. Today it usually passes by luck, because `input.feedback` is appended raw and users type "tattoo". A mark described as a *birthmark*, *scar*, or *branding* misses the list. **Critical interaction: if R-A moves marks into `technicalSchema` rather than the `masterPrompt` string, `hasBodyArt` returns false and the pipeline begins erasing tattoos on every generation.** | `geminiPrompts.ts:243-256` |
| **V17** | **BUG (delayed)** | **The compaction bomb.** At 5 `APPLIED MODIFICATION:` amendments, `compactMasterPrompt` hands the whole document to an LLM to rewrite as a clean paragraph. If it paraphrases "tattoo" as "chest piece" or "body artwork", `hasBodyArt` (V16) flips false and every subsequent generation erases the model's ink. Silent, delayed, non-deterministic, presents to the user as *"his tattoos just vanished."* Defused by killing freeze-and-append — but only by the corrected R-A. | `castingRefinement.ts:105-114` |
| **V18** | **LEGACY(0) — GAP** | **The identity document is a recipe for one photograph, not a description of a person.** The `masterPrompt` contains pose (*"Straight-on, square to camera, head straight with no tilt or turn. Eyes looking directly into the camera lens"*), expression (*"mouth slightly parted… as if captured mid-conversation"*), camera (*"85mm equivalent, f/5.6-f/8"*), lighting, background, and wardrobe (*"Bare skin, no clothing or straps"*). It is sent verbatim as the identity anchor for **every** view — so `TASK: FULL BODY SIDE PROFILE. Walking motion.` arrives alongside an instruction to face straight into the lens, and `Attire: Simple black boxer briefs` arrives alongside `Bare skin, no clothing`. Camera/lighting/background are also **duplicated** with `VISUAL DIRECTIVES` and free to disagree. **Every non-frontal generation has been fighting itself since Era 0.** R-A addressed the document being a *diary*; it did not address the document being a *shot list*. | `geminiViews.ts` (all three generators) × any real `masterPrompt` |
| **V19** | **BUG (structural)** | **Refresh cannot propagate a mark, by construction.** `refreshSlots` builds `SlotGenContext` with a single image — `headshotUrl: headshot.url`. Every view regenerates from the headshot alone. A chest mark is not in the headshot; the plate that contains it is discarded. With V16's persistence rule firing, Gemini is told the subject has body art, told not to remove it, and shown a reference that does not contain it. **It hallucinates a new one per view, per generation.** This is the true form of V6. | `refreshSlots.ts:144-165` |
| **V20** | BUG | **`sideClose` and `sideFull` render facing opposite directions**, despite both prompts specifying `Facing Right.` Benign for a symmetric mark; with an asymmetric one (forearm, single-shoulder piece, cheek scar) the two side views show opposite sides of the body and nothing in the system knows. Survivable only because the visibility probe (§4) reads actual pixels rather than trusting the view name — which is itself the argument for probing over mapping. | `geminiViews.ts` viewPrompts; observed on bench |
| **V21** | LEGACY(0) | **View naming has three vocabularies.** Canonical `sideClose`/`sideFull` vs `generateSingleView` params `'side'`/`'walk'` vs prompt text. Same trio-era residue as V3/V4; belongs in the same Batch A sweep. | `geminiViews.ts:generateSingleView` vs `boardTypes.ts:10-25` |

| **V22** | **DESIGN CONFLICT (future-armed)** | **The view identity gate is marks-blind and will fight the composer.** `verifyViewIdentity` (D-39/D-44/D-46) gates every `backFull`/`sideFull` generation by comparing it against the **headshot**, instructing: *"any visible tattoos or marks (the back view must not INVENT new ones)… Answer NO if the markings clearly do not match."* The headshot does not show a chest piece — so once the composer correctly renders the nape collar on a back view, the gate reads it as invented ink → NO → one retry → NO → **named failure + refund churn on correct generations.** The gate must become canon-aware in Batch D (compare against the mark registry, not the bare headshot). Note also: this gate **already replaced** the `"No new back tattoos."` prompt plea (per its own header) — the prompt line is vestigial; the gate is the live anti-invention mechanism, and §2.2's attribution is corrected accordingly. | `backViewGate.ts:38-58,66-105`; `mintPackage.ts:148-156` |

Also noted, minor: `BASE_STUDIO_SETTINGS` and the tattoo rule are **both numbered "6."** in every prompt, diluting the directive. And `iterateModel` (`aiService.ts:275`) already accepts an `additionalReference` second image part — multi-reference plumbing partially exists on the iterate path, reducing Batch D's build cost. The live V19 reference path is `generatePackageSlot → buildIdentityAnchor` (`mintPackage.ts:128`); the original register's V6 citation (`composeIdentityPayload.ts:101`) points at a function with **zero callers** — same conclusion, corrected mechanism.

---

## 4. The corrected architecture

### 4.1 Canon — immutable, never regenerated

- **`identity_plate`** — the original headshot. Frozen forever. Never edited, never refreshed, never overwritten. It is the reference for every generation the model will ever have.
- **`clean_body_plate`** — the `frontFull` as first generated, **mark-free**. Frozen forever. It is what allows a view to be generated *without* a mark that isn't visible in it. Must survive every mark edit.
- **`mark_registry`** — versioned. Per mark: description, zone set, and **evidence crops**.

**Everything else is derived and disposable.** Any view can be thrown away and rebuilt exactly.

### 4.2 Zones, not marks, are the crop unit

The unit of evidence is **the current canonical appearance of a body zone, containing whatever marks live there.**

- Zone boundaries follow **anatomical contiguity**. A neck-and-chest piece is one zone because cutting it produces two mutilated fragments that neither reproduce alone. A sleeve running chest→shoulder→wrist is one zone. Two isolated arm marks are two zones.
- A face mole crops **the whole face** — the face is the smallest coherent unit.
- **Crops carry anatomical context, not just the art.** The bench crop ran chin to lower ribs, shoulder to shoulder, so the model could *place* the design rather than merely copy it. A tight art-only crop cannot be positioned.
- **Zones are re-cut, not supplemented.** Adding a stomach piece re-cuts `zone[torso_front]` from the *new* plate — it now contains the lion **and** the stomach piece, one image, true relative positions, on one body. Continuity can never be severed because it is never assembled from fragments.
- **Reference count is bounded by zones, not marks.** Eight torso tattoos still refresh with one torso crop.
- **The crop is part of the commit, not part of the refresh.** Otherwise a deferred refresh composes from stale evidence.

### 4.3 The visibility probe — not a map

R-A logged *"mark-category→view mapping"* as a deferred refinement. **It is load-bearing, and it must not be a static table.**

A table (`left_forearm → visible in frontFull, sideFull, backFull`) is confidently wrong about *this* model: chirality (a left forearm is occluded in a right-side profile), pose (arms crossed, hands in pockets), wardrobe, hair over a neck piece, occlusion generally. V20 makes it worse.

**Instead: probe the actual image.** One cheap VLM call per sibling view, per zone: *"Is the subject's left forearm visible in this image? yes / no / partial."*

- Handles chirality, pose, occlusion, framing — per instance, for free, no table to maintain.
- **It resolves V7 at the root.** The headshot is probed, the forearm isn't in it, the headshot is not stale. Not *excluded by rule* — **evidenced as unaffected**.
- It makes R-B's copy honest and specific: **"2 views affected"**, not five.
- **Visibility is a generation requirement, not just a staling scope.** An image model asked to add a left-forearm tattoo to a view where the forearm isn't visible will not decline — **it will move her arm.** A visibility miss doesn't produce a missing mark, it produces a corrupted pose.
- The probe also runs on the **edit target**: a mark cannot be born in a view that cannot show it (no evidence can be cropped). Refuse and route: *"The left forearm isn't visible here — edit this on the full body view."*

### 4.4 The composer

`SlotGenContext` carries more than `headshotUrl`. Every generation passes N roled image parts:

1. **Identity** — `identity_plate`
2. **Body** — `clean_body_plate`, explicitly labelled *build and proportions only; this reference shows him without body art*
3. **Zone crops** — one per zone the probe says is visible in this view. **Zero if none are.**

Plus a structured text prompt: identity block (person only — §4.6), `BODY ART` registry section with **per-view visibility lines**, `VISUAL DIRECTIVES`, and a **`BODY ART PERSISTENCE`** directive that both preserves real marks and forbids invented ones (retiring the `backFull`-only `"No new back tattoos."` hack).

**Depth is always 1.** Every generation composes from immutable canon. No accumulation is possible. The edit-3 degradation is structurally excluded.

**Refresh and first-generation are the same operation.** A slot that is out of date and a slot that never existed both compose from current canon. An empty slot is simply a view at version `null`, trivially behind. No special case — so a core-4 package can be topped up to six views at any time, before or after mint, and the new views will be correct.

**Law conflict requiring explicit supersession:** the composer's N-reference payload contradicts **D-30 strategy (b)** (founder-ratified with Group 6c), whose rationale reads *"two images + text avoids multi-ref dilution."* D-30 itself anticipated this escalation (*"if dogfooding shows identity drift, switching to full-package payloads is a change to THIS function"*) — the bench evidence is that escalation trigger. The §7 ruling must supersede D-30's payload shape explicitly, not silently.

**Build cost note:** the visibility probe is not a new subsystem. `backViewGate.ts` already runs a per-angle VLM verification (`toInlinePart` + `withTextQueue` + `TEXT_ECONOMY`, fail-open contract) — the probe is a new prompt on that plumbing. But the gate itself must become **canon-aware in the same batch** (V22) or it will reject the composer's correct mark renders.

### 4.5 Canon accretes — first render authors, later renders reproduce

The bench proved this. The nape had no evidence — nothing had ever rendered the back of his neck — so `backFull` **invented** a medallion.

**Rule:** if the probe says a zone is visible in this view **and no evidence crop exists for that zone**, this generation is a **creative act**. It must be sealed, cropped, and registered as canon. Every later render of that zone is a **reproduction**.

- Generation order matters, and the system must know which case it is in.
- Deferred bulk refreshes can be *simultaneously* reproducing some zones and authoring others.
- The user should be told: *"This is the first view of his nape — it becomes the reference for that area."*
- Clean write points: **marks are born at iterate; zones are born at generate.**

### 4.6 The identity document is a person, not a photograph

R-A's *portrait, not a diary* survives — rename it **identity document** (the metaphor collided with the actual headshot asset). But R-A only fixed the *diary* half. V18 is the other half.

**In the document** — only what is true of the person in every possible photograph: sex, age, ethnicity, build, skin tone and finish, face geometry, eyes, nose, lips, brows, hair, facial hair, **and marks (structured)**.

**Out of the document** — pose, expression, gaze, camera, lens, lighting, background, framing, wardrobe. These are **per-view parameters** already owned by the view config and `VISUAL DIRECTIVES`. Removing them also kills the duplication (camera/lighting/background were specified twice, free to disagree).

**Consequence for V16:** `hasBodyArt` must **not** remain a keyword grep. It becomes registry-driven — `model.marks.length > 0`. Deterministic, vocabulary-proof, compaction-proof, and immune to whatever R-A does with the document's internals.

### 4.7 `frontClose` splits — and the stuck headshot dissolves

Today `frontClose` is doing two jobs: it is the immutable identity anchor **and** the visible, iterable headshot slot. That collision *is* V8's stuck-headshot bug.

- **`identity_plate`** — original, immutable, hidden, canon. The reference for every generation.
- **`frontClose`** — the displayed headshot. Derived from `identity_plate` + visible zone crops. Editable, **refreshable**, versioned like any other slot.

Once separated, F6's refusal finally makes sense — the *plate* isn't refreshable because it isn't derived from anything; it *is* the source. And the headshot slot becomes ordinary:

- The forearm mark never stales it (the probe says the forearm isn't in it).
- A face mark *does* stale it — and refresh now works, because there is something to refresh it *against*.
- **The permanently-stuck "1 stale" has nowhere left to live.**

Headshot edits still compose from `identity_plate` + full mark registry — **never** from the previous headshot. Depth stays 1 and the edit-3 degradation cannot occur.

### 4.8 Package-level canon versioning — stale becomes derived

The single largest simplification available.

**Two version axes, not one:**

- **`canon_version`** — the model's identity state. Package-wide, single-valued. `v1` clean → `v2` +chest → `v3` +stomach/arm. This is what undo/redo walks.
- **`asset_version`** — generation N of this slot. Per-view. Restore-a-previous-generation is unaffected and does not touch canon.

**Then:**

```
stale  ⟺  asset.canon_version < model.canon_version
```

- **No flag. No stale-writer. No two ledgers.** `markModelAssetsStale` and `selectStaleSiblingHeads` are deleted. **V8 and V12 dissolve at the source** — the count cannot mismatch, because both surfaces derive from one comparison.
- **Canon bumps at commit**, not when refreshes finish. The probe immediately **stamps forward** every view where no affected zone is visible — those views are *correct at the new version*, not stale. Record the provenance (`unchanged — no visible zones affected`) so "correct at v3" is distinguishable from "stale and pretending."
- **Mint gate is one line:** `slots.every(s => s.canon_version === model.canon_version)`. No per-view stale audit, no ledger reconciliation.
- **Deferred refresh is free and cheaper.** A view at `v2` while canon is at `v5` is not holding a queue of deltas — it is simply *behind*. Refresh derives from current canon in **one** generation. Refreshing after every edit would cost four. The lazy user is rewarded. *(This retires the "stale as a pending changeset" idea explored on the bench — that was delta-edit thinking.)*
- **A view may only be edited when it is at current canon.** Editing a stale plate paints onto an image missing an existing mark; the zone crop cut from it would be evidence that omits a real mark, poisoning canon. Copy: *"This view is behind — it doesn't show her chest piece yet. Editing here would lose it. **Refresh & edit** / Cancel."* One button, both actions.

### 4.9 Undo is a version checkout

- `model.canon_version = v2` → every slot restores the asset it holds at v2. **Free, instant, exact.** `restoreSlotVersion` already does copy-forward; call it across the package.
- Redo is the same move forward.
- The mark registry and zone crops rewind with it — which requires **zone version history** (the pre-re-cut `zone[torso_front]` must be retained).
- **This is only possible because R-A kills freeze-and-append.** You cannot cleanly pop an appended prose paragraph; you can trivially pop a structured field.
- **Honest edge:** undo restores views that *were generated* at that version. A view first generated at v3 has no v2 asset — it becomes **stale**, and the copy says so: *"Back to the chest piece only. 4 views restored. The ¾ view was never generated at this version — it's out of sync."* Restore what you have, stale what you don't, say which is which.
- Removing *one* mark from the middle of the stack is **not undo** — it is mark deletion, re-deriving from a canon state that never existed. It will be asked for. Log it; don't build it.

### 4.10 Edit tools write canon — there are no pixel-only edits

The surgical/eraser mask tools currently bypass the classifier entirely (mask edits were "cosmetic by construction" when nothing propagated). Under canon this is a live hole: erase the nape collar from the back view → the image no longer shows it, but the registry, the nape evidence crop, and the identity document all still assert it → **the next refresh regenerates what the user just erased.** The product refuses their edit. Same species as the round-4 walk findings.

**Principle: there are no image edits — only canon edits, expressed through images.** The LLM box, surgical tool, and eraser are input *modes* of one operation: a classified edit. The classifier's input becomes **(text OR mask region) × registry** — the mask's location is a stronger classification signal than text, since it names the touched zones exactly.

**The eraser is an instruction, not a compositing op.** A Photoshop-style layer-reveal (canon plate underneath, brush reveals through) fails structurally: composed versions are fresh rolls (pose/lighting shift a few degrees per generation) and even in-place edits re-synthesize the frame — the reveal composites offset skin with visible seams, and the flattened canvas export becomes a baked-seam asset in an otherwise clean ledger. Instead the eraser rides the existing `maskBase64` path (`iterateModel`, already plumbed): mask + fixed instruction (*"remove the ink in the masked region, restore natural skin, change nothing outside the mask"*) → one depth-1 generation on the current plate, inside the degradation floor. The layered composite survives only as a free client-side **preview** during the brush gesture (never saved); the aligned-composite eraser as a real mechanism is logged, not built — version restore already covers its use case, pixel-perfect and free. Cost is surfaced honestly: **erase (~refresh cost) vs restore a previous version (free)** — amend canon vs rewind canon, the same line the architecture draws everywhere.

**Partial erasure resolves through the registry, not through text.** The classifier's question is: *which zones did the mask touch, and does the post-edit image still have registered art in them?*

- Touched a registered zone, art remains → **re-cut** the zone from the edited image (erasing one rose off the chest piece is the same mechanism as adding the stomach piece — the crop carries the artwork; the text stays coarse and never attempts to describe a partial instance)
- Touched a registered zone, region now empty → **shrink** the mark's region set; no regions left → **delete** the mark (document updates, evidence deleted, siblings probed and staled)
- The erase severs a contiguous piece → **split** the zone (one sleeve becomes shoulder + wrist, each cropped separately). Corollary, now explicit: **zone contiguity is recomputed after every canon commit** — zones merge when new art connects them and split when erasure severs them
- Touched no registered zone but an identity feature (an eyebrow, a beard patch) → identity edit in an eraser costume: document writes, canon bumps, siblings stale — or the next refresh regenerates the eyebrow
- Touched neither → **artifact-level cosmetic fix** (extra finger, stray shadow): new asset version only, no canon write. This is the eraser's legitimate cheap path and must stay cheap.

**Any view can author; any view can amend; canon follows the commit.** Erasing on a non-birth view re-cuts the zone from the view where the edit happened (the only image showing post-edit truth); the old birth view goes stale like any sibling. Birth view was first, not privileged. Editing on side views works by the same rules as everywhere (born-in-a-view-that-shows-it is satisfied by definition — they drew on it) — restricting edit tools to front/back/portrait would be **V1 reintroduced with fresh justification**. One honest caveat for the calibration list: mark fidelity by birth-view angle (evidence photographed at 90° is a weaker reference for a frontal reproduction).

**The §4.8 stale-view gate is load-bearing here, not polish.** Partial erasure on an out-of-date plate is the maximum-damage case: the re-cut crop omits a real mark and poisons canon.

**UI consequence — one persistent toolbar.** The scattered per-view tools (chat box, overlay tools, differing affordances) visually imply view-specific capabilities — true in Era 0, false under canon. One floating toolbar under the image, persistent across all six views, presenting LLM/surgical/eraser as a segmented control (modes of one edit), disabled by **canon state** (stale → the Refresh & edit gate; minted → seal/fork copy), never by view type. It is also where R-B's staling-moment line renders — one consistent D-40 location instead of per-view improvisation.

**Ruling required (R-A rider):** *all edit tools write canon through the classifier; no tool writes pixels only, except artifact-level cosmetic fixes touching no registered zone and no identity feature.* This is policy with real consequences (erasure stales siblings and costs refreshes), not a mechanical fix.

### 4.11 Mint seals canon, not assets

- Mint requires all slots at current canon — **or** an explicit mint-anyway that records which slots are absent/behind.
- Safe, because canon is frozen at mint: a missing side view generated six months later composes from **exactly the same canon** and lands correctly. It is late, not wrong.
- Copy: *"2 views not generated — you can add them anytime; her identity is sealed."*

---

### 4.12 The canvas casting node — version swap is a ledger write, never a display state

The casting node currently lets the user flip any view to any of its prior generations independently. Under per-view versioning that was coherent. Under package-level canon it is a **third write path into the same hole as the eraser**: flip the `frontFull` back to its pre-tattoo generation while canon sits at v3 and the package now shows five views wearing the lion and one clean — the registry still asserts the mark, and the mint gate either blocks with no explanation or passes on a self-contradicting package. The switcher silently manufactures the cross-view incoherence the whole architecture exists to prevent.

Per-view version swap splits into the two operations the design already has:

- **Cross-canon travel is package-level checkout only** (§4.9). "Show her before the stomach tattoo" is `model.canon_version = v2` — **one control for the whole node**, every view snaps together, free, coherent. This is also where undo/redo gets its visible surface: a **canon timeline on the node** (v1 · v2 · v3). Honest about the §4.9 edge — a version where a slot was never generated renders that slot as *stale-at-that-version*, not blank-and-lying.
- **Per-view selection survives as re-roll choice, correctly caged**: the picker is **filtered to assets whose `canon_version` matches current canon** — two rolls of the same identity state, pick the one you prefer (`restoreSlotVersion`, free, safe by construction).

Flipping a single view to an asset from a *different* canon version is the §4.8 stale-plate hazard by another door. The derived rule catches it automatically (the slot's effective version stops matching canon → stale) — **but only if the swap writes the asset pointer through the ledger.** If the node's switcher is client-side display state, it is invisible to the mint gate, the probe, and the count. Hence the rule: **a version swap is a ledger write, never a display state.**

### 4.13 Slot pinning is deleted — its job no longer exists

Pin (`setSlotPinned`, the D-21 "accepted-final" exemption) existed to protect an approved image from a destructive refresh, in a world where refresh was a dice roll from the headshot, staleness was flag-based and spammy, and there was no version history to fall back on. All three premises are dead:

- Refresh is a **compose from canon** and nothing is ever destroyed — the previous asset always exists. **Restore is the protection pin was faking.**
- Staleness is **derived and probe-scoped** — the false-pressure problem pin relieved (D-43.2's "staleness spam") no longer occurs.
- "Keep the generation I liked" is now **re-roll choice** via the §4.12 picker. Free.

What remains is pure cost: a founder ruling pin would have forced on the checkout design (does pin travel with canon version?) for a feature with no job; special-case branches in `refusalFor` and `selectStaleSiblingHeads`; and a genuinely bad canon interaction — a pinned stale view is *wrong on purpose and protected from being fixed*, which deadlocks against the mint gate.

**Delete pin. Do not delete seal.** Sealing (§4.5) looks pin-shaped but is a different animal: it is a **system invariant protecting a zone's canonical crop** (regenerating a birth view re-rolls the mark and destroys the reference), not a user preference protecting an image. Seal does not even need to block regeneration — it needs the crop taken and stored before any regeneration happens. The agent must not conflate the two.

Scope note: the codebase has **two pin systems** — `setSlotPinned` on the model-asset ledger (this one dies) and board pins on the canvas (layout concern, out of scope, untouched).

Consequences: `refusalFor` loses its `pinned` branch (after the §4.7 split, effectively only `unfilled` remains); `selectStaleSiblingHeads` loses its pinned exemption (then dies with the stale-writer in Batch D anyway); the pin/checkout ruling evaporates; the node UI has no pin badges — timeline + re-roll picker only. **D-21 is superseded** — add to the ruling riders, explicit like D-30, never silent.

## 5. What this does to the ratified rulings

### R-A — amended

| Clause | Status |
|---|---|
| The identity document is not a diary; freeze-and-append dies | **Holds.** Central and correct. |
| Cosmetic iterates never write it | **Holds.** |
| Identity iterates on drafts write it; marks enter structurally | **Holds** — and now also carry a zone crop. |
| Minted models: document immutable except through fork | **Holds.** |
| Rename *portrait* → **identity document** | New — the metaphor collided with the headshot asset. |
| *"Text-channel propagation becomes the DESIGNED propagation path"* | **INVERTED.** Text describes a class, not an instance. Images propagate. |
| *"Image-reference propagation stays post-pass and may never be needed"* | **INVERTED.** It is the only mechanism that works, and it is mandatory. |
| *"All-sibling staling is data-honest"* | **SUPERSEDED** by the probe. Views are staled on **evidence**, not on principle. |
| *"The headshot is excluded from the count per F6, never counted"* | **SUPERSEDED** by the `identity_plate` / `frontClose` split. The bug dissolves rather than being patched. |
| *"Mark-category→view mapping is the logged refinement, not built now"* | **REVERSED.** Visibility is load-bearing for generation. But it is a **probe**, not a map. |
| *"F4 calibration tests text-channel mark fidelity"* | **RE-SCOPED.** The bench already answered it: text cannot carry an instance mark. F4's calibration becomes: probe accuracy, crop tightness, and multi-zone reference limits. |

### R-B — holds, with two notes

The principle is unchanged and correct: speak at the staling moment (D-40), tooltips on both surfaces, mint-dialog checkpoint.

- *"N views affected"* is only honest once the probe exists. Before then the number is region-blind.
- The **stuck-headshot exit copy is no longer needed** — §4.7 removes the state it describes.
- Add: the **first-render-of-a-zone** notice (§4.5) and the **edit-a-stale-view** gate copy (§4.8).

### R-C — absorbed

V14 (un-composed iterate payload) is **subsumed**: iterate composes from canon like everything else. It stops being its own track.

---

## 6. Revised repair sequence

### Batch A — mechanical, unchanged, ship it

V1 (allowlist), V2 (dead lock UI), V3/V4 (six-slot maps, `hasAllViews`), V9 (mint name field), V15 (one `staleTime`). **Add V21** (view naming) — same sweep, same era.

- **V8 (count honesty)** — proceed only if already in flight. It patches a read model §4.8 deletes. Harmless, throwaway.
- **V13 (DS reconciliation)** — **defer.** The docs will be rewritten again by this architecture. Don't write them twice.

### Batch B — unchanged, ship it

V10: one status-driven `isModelMinted(model)`. `locked` folds into minted (legacy alias); `archived` reads as deleted everywhere.

### Batch C — the identity document split (was "R-A build")

1. **V18** — split the document: person-only in, per-view parameters out. Kill the camera/lighting/background duplication and the wardrobe contradiction.
2. **R-A core** — freeze-and-append dies. Marks enter as a **structured field**. Cosmetic edits write nothing. *(This also defuses **V17** — no `APPLIED MODIFICATION` lines means the compactor never fires.)*
3. **V16 — do this in the same commit or you ship a tattoo-eraser.** `hasBodyArt` becomes `model.marks.length > 0`. If marks move to a structured field while `hasBodyArt` still greps prose, `CLEAN_SKIN_RULE` fires and the pipeline erases every mark on every generation.

### Batch D — the composer (new; this is a design pass, not a repair)

Mark registry with zone crops · zone re-cutting on commit (including **recompute of zone contiguity — merge/split — after every canon commit**, §4.10) · visibility probe (built on the `backViewGate` plumbing) · multi-reference `SlotGenContext` · canon accretion + sealing · `identity_plate` / `frontClose` split · package-level `canon_version` (deleting the stale-writer, V8, V12) · undo-as-checkout · **all edit tools routed through the classifier** (mask edits stop bypassing it; eraser = mask + fixed removal instruction on the existing `maskBase64` path; partial-erase resolution per §4.10) · **the persistent edit toolbar** (one control surface across all six views, disabled by canon state, never by view type; hosts R-B's staling-moment copy) · **canvas node versioning** (§4.12: canon timeline for cross-version travel, per-view picker caged to current-canon assets, every swap a ledger write) · **slot-pin deletion** (§4.13: `setSlotPinned`, the `refusalFor` pinned branch, the stale-writer exemption; board pins untouched; seal retained) · **V22: make `verifyViewIdentity` canon-aware** (gate against the mark registry, not the bare headshot) — mandatory in the same batch, or the gate refund-churns correct generations.

**Retire in this batch:** the vestigial `"No new back tattoos."` prompt line (the gate is the live mechanism per D-39/D-44; the composer's anti-invention clause covers the prompt side) and the duplicate `6.` numbering.

**Re-scoped F4 calibration list:** probe accuracy per zone/angle · crop tightness (anatomical context vs contamination) · multi-zone reference ceiling (does the clean body plate start winning at 4–5 crops?) · per-view identity refs (is a sealed side view a better anchor for side regenerations than the frontal plate? — test, don't assume) · **mark fidelity by birth-view angle** (evidence photographed at 90° is a weaker reference for frontal reproduction) · **mask-removal fidelity** (does the erase instruction cleanly restore skin without disturbing surrounding art?). *(Pin-state-across-checkout is struck — pin is deleted, §4.13.)*

---

## 7. The R6 question

R-A's build was sized at **0.5–1d**. Batch C is roughly that. **Batch D is not a repair** — it is the mechanism the product needs, and it is a design pass.

**Option 1 — close R6 on Batches A + B + C, with honest refusal.**
Marks stale siblings (probe-scoped where cheap, region-blind otherwise), and refresh **refuses** to carry an instance mark: *"This mark can't be carried to other views yet."* The loop is walkable and honest; the hole is named rather than hidden. Batch D is the immediate next pass.

**Option 2 — pull Batch D into R6.**
It is the real product, it is bench-validated, and it dissolves V7, V8, V12 and V14 rather than patching them. But R6 stops being a repair and becomes open-ended.

**The audit's own logic says Option 1** — scope creep is exactly what has kept R6 open. But Batch D is now *evidenced*, not speculative, which is the strongest argument yet for Option 2.

**Either way: shipping the current R-A as ratified is the one thing that must not happen.** It builds a mechanism that produces a different tattoo in every view, and calls it propagation.

**Riders needed in the same founder ruling, whichever option is chosen:**

- **D-30 supersession** (§4.4): the composer's N-reference payload explicitly supersedes D-30 strategy (b)'s "two images + text avoids multi-ref dilution" — the bench evidence is the escalation D-30 itself anticipated.
- **Edit-tools-write-canon** (§4.10): *all edit tools write canon through the classifier; no tool writes pixels only, except artifact-level cosmetic fixes touching no registered zone and no identity feature.* Policy, not mechanics — erasure stales siblings and costs refreshes.
- **D-21 supersession** (§4.13): slot pinning is deleted — restore + re-roll choice + probe-scoped staleness cover its entire job. Seal (§4.5) is retained and is not pin.

---

## 8. Immediate action

1. **Halt the R-A implementation leg.** Batch A and Batch B continue.
2. **Audit anything already touched in that leg for V16.** If marks have been moved out of the `masterPrompt` string while `hasBodyArt` still greps for keywords, the pipeline is now instructing Gemini to erase every mark on the model. This is the single most dangerous change currently in flight.
3. **Founder ruling on §7** — Option 1 or Option 2.

**Nothing in this addendum has been built.**
