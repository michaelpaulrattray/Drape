# Canvas Pass 1 — Audit Addendum

> **SUPERSEDED (July 2026).** This document is retained for provenance only. It has been replaced in full by `CANVAS_AUDIT_ADDENDUM_V2.md`, which re-verifies every finding below against the post-migration codebase and corrects stale file references. Do not implement from this document. Design content formerly in Section G now lives in the revised `DESIGN_SYSTEM.md` §13; divergences are recorded in `DECISION_LOG.md`.

**Read this alongside `CANVAS_FOUNDATIONS.md` and `DESIGN_SYSTEM.md`.**

This document captures the findings from a code audit run after the main spec was written. It corrects, clarifies, or adds detail to the main docs based on what the actual codebase looks like. Where this addendum disagrees with the main docs, **this addendum wins** — it's grounded in real code.

The core architectural decisions in `CANVAS_FOUNDATIONS.md` (root/view model, kind+provenance, edges as data, per-node state, agent-ready primitives) all hold up against the real code. What's corrected here is implementation detail, naming, and a handful of M1 prerequisites that the main docs underestimated.

---

## Section A — Two prerequisite refactors that must happen before M1 starts

The main docs say "lift the existing casting hooks unchanged into the new architecture." The audit found this is not literally possible. Two mechanical refactors are required first. Both are on the M1 critical path.

### A1 — Hook refactor: `useCastingGeneration` and `useCastingViewGeneration`

**Estimated effort:** 1–2 focused days, both hooks combined.

**The problem:** Both hooks read directly from global Zustand stores at the top of their bodies. They cannot be called from a node-local context as long as those stores exist. From `useCastingGeneration.ts`:

```ts
const { prefs, modelName } = useCastingFormStore();
const { genState, setGenState, currentModelId, setCurrentModelId, currentAssets, setCurrentAssets, /* ... 14 more ... */ } = useCastingGenerationStore();
const { activeView, setActiveView, /* ... */ } = useCastingUIStore();
useStudioStore.getState().setCanvas({ hasModel: true, modelSource: 'cast' }); // line 286
```

`useCastingViewGeneration` follows the same pattern with three stores.

**The refactor:** convert each hook from store-reading to parameter-taking. The function body's logic stays identical; only the source of `prefs`, `modelName`, `genState`, `currentAssets`, etc. changes from `useCastingFormStore()` to `props`. The new shape:

```ts
export function useCastingGeneration({
  isAuthenticated,
  activeTool,
  isMasking,
  getGuideOverlayDataUrl,
  clearMask,
  // NEW — explicit state inputs
  prefs,
  modelName,
  currentModelId,
  currentAssets,
  currentMasterPrompt,
  currentTechnicalSchema,
  history,
  historyIndex,
  amendments,
  // NEW — explicit state setters
  setGenState,
  setCurrentModelId,
  setCurrentAssets,
  setCurrentMasterPrompt,
  setCurrentTechnicalSchema,
  pushHistory,
  setSuggestions,
  setIsLoadingSuggestions,
  addAmendment,
  clearAmendments,
  setIdentityWarning,
}: UseCastingGenerationParams) {
  // existing logic — every store reference becomes a param reference
}
```

**The `useStudioStore.getState().setCanvas(...)` call on line 286 of the current code is removed entirely** — it's a side effect into the legacy linear-studio's state and has no meaning on the canvas. It is not replaced.

**On the canvas, the controller hook `useCastNodeController` (in the new architecture) is what supplies the parameters.** It reads node config from `board_items.metadata` via tRPC, holds in-flight job state in `useGenerationJobs`, and passes everything down to the refactored generation hook as parameters. Local React state inside the controller takes the place of the deleted Zustand stores for any genuinely transient values.

**Why this is a one-time refactor not a rewrite:** the generation logic itself — the mutation calls, the credit checks, the LLM prompt building, the asset stitching, the history pushes, the amendment tracking, the identity warning detection — all of that is good code and stays unchanged. We're only moving the *source* of the inputs from globals to params.

**Order of operations within M1:**
1. Refactor `useCastingGeneration` to parameter-taking. Verify the legacy `/studio` route still works by passing the existing global stores' values through as params at the call site. The existing studio keeps working through this transition.
2. Same for `useCastingViewGeneration`.
3. Build the new `useCastNodeController` that calls the refactored hooks with node-local state.
4. Delete the three casting stores. The legacy `/studio` route's `ControlPanel` is the only file that still reads from them at this point — `ControlPanel` either gets retired entirely (if `/studio` is being deleted) or gets a small adapter shim. **Decision needed before M1:** do we keep `/studio` alive, or retire it as part of pass 1? The main doc says keep it alive. If so, `ControlPanel` needs to migrate to local React state too, OR the three stores survive only as `/studio`-local state.

**Recommendation:** keep `/studio` alive but migrate it to use props from a local `useState` hook in the route component. The three stores get fully deleted. This is ~1 extra hour of work and removes the awkward "two stores serving one feature" state that would otherwise exist during the transition. The main doc's commitment to deleting all three stores stays valid.

### A2 — Extract `BrandSelector` from `ControlPanel.tsx`

**Estimated effort:** ~30 minutes.

**The problem:** the brand picker is inline JSX inside `ControlPanel.tsx` (lines 167–191), not a standalone component. The blender chip strip needs to open the brand selector in a popover, which requires it to be a standalone component.

**The refactor:** copy the JSX out into `client/src/features/casting/components/BrandSelector.tsx`:

```tsx
import { BRAND_OPTIONS } from "@/features/casting/constants";

interface BrandSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function BrandSelector({ value, onChange }: BrandSelectorProps) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
      {BRAND_OPTIONS.map(b => {
        const sel = value === b.value;
        return (
          <button
            key={b.value}
            onClick={() => onChange(b.value)}
            className="rounded-xl text-center transition-all"
            style={{
              padding: '8px 4px 7px',
              background: sel ? '#1a1a1a' : '#ffffff',
              color: sel ? '#fff' : '#52524B',
              fontSize: 12, fontWeight: sel ? 600 : 500,
              border: sel ? '1px solid #1a1a1a' : '1px solid #E8E4DF',
              boxShadow: sel ? '0 2px 8px rgba(26,26,26,0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
            }}
            onMouseEnter={(e) => { if (!sel) { e.currentTarget.style.borderColor = '#C5BFB6'; e.currentTarget.style.background = '#FAFAF8'; } }}
            onMouseLeave={(e) => { if (!sel) { e.currentTarget.style.borderColor = '#E8E4DF'; e.currentTarget.style.background = '#ffffff'; } }}
          >
            <div>{b.value}</div>
            <div style={{ fontSize: 10, fontWeight: 400, marginTop: 1, color: sel ? 'rgba(255,255,255,0.5)' : '#71716A' }}>{b.desc}</div>
          </button>
        );
      })}
    </div>
  );
}
```

`ControlPanel.tsx` then imports and uses `<BrandSelector value={prefs.castingBrand} onChange={(v) => updatePref('castingBrand', v)} />` in place of the inline JSX. Cleaner anyway, and the new `BrandSelectorPopover` in the canvas chip strip wraps it.

---

## Section B — Field naming corrections

The main docs use a few field names that don't match the actual schema. Whenever there's a conflict, **align the docs to the existing code**, not the other way around — the casting engine reads these names as-is and changing them would touch the backend.

### B1 — Field count

Main docs say "27 attributes." The actual count from `client/src/features/casting/stores/useCastingFormStore.ts` is **33 fields** in `DEFAULT_PREFERENCES`:

```
castingBrand, castingVibe, gender, age, ethnicity (legacy string), ethnicityBlend (structured),
bodyType, faceShape, skinTone, skinTexture, skinFinish, eyeColor,
hairColor, hairStyle, hairLength, hairTexture, hairFringe, hairParting,
hairVolume, hairFlyaways, hairHairline, hairTuck, hairFade, facialHair,
jawline, cheekbones, cheeks, eyeShape, noseShape, lipShape, eyebrowStyle,
features, userPrompt
```

Treat any reference to "27 attributes" in the main docs as "the ~33 prefs fields." The refinement studio's Attributes tab needs to surface all of them, grouped into the existing 5 sections (Casting basics, Physique, Face structure, Skin, Eyes & hair).

### B2 — `skinTone`, not `skin`

The chip on the canvas should be labelled `Skin` (the user-facing word), but **the underlying field name is `skinTone`** in `prefs.skinTone`. Wherever the main docs say `attrs.skin`, the actual access is `attrs.skinTone`.

Skin tone values are compound strings like `"Porcelain / Pale"`, `"Fair / Light"`, `"Medium / Olive"` etc. (see `WarmPrimitives.tsx` lines 483–490). The chip display should show only the first half: `attrs.skinTone?.split(' / ')[0]` produces `"Porcelain"`, `"Fair"`, etc. The existing `SummaryStrip` already does this (line 434) — follow that pattern.

### B3 — `castingBrand` and `castingVibe`, not `brand` and `vibe`

Same pattern. Chip labels are `Brand` and `Vibe` for the user, but the underlying fields are `prefs.castingBrand` and `prefs.castingVibe`. The vibe field is a `{editorial, commercial, runway}` object, not a string.

### B4 — `ethnicityBlend` is structured, `ethnicity` is legacy

Two fields exist for historical reasons:
- `prefs.ethnicityBlend: { name: string; pct: number }[]` — the structured one used by the blender component
- `prefs.ethnicity: string` — a legacy comma-joined string maintained for backward compat

The casting engine reads both. When the user changes the blend, both get updated atomically (see `ControlPanel.tsx` line 91). The new architecture must maintain this dual-write:

```ts
boardOps.updateAttributes({
  itemId,
  changes: {
    ethnicityBlend: blend,
    ethnicity: blend.map(e => e.name).join(', '),
  }
});
```

The legacy `ethnicity` string field will eventually be retired, but not in pass 1.

---

## Section C — `EthnicityBlender` only supports 1 or 2 ethnicities, not 3+

The main docs specified a `formatEthnicity` helper that returned `"3 mixed"` for blends of 3 or more. **This case never happens.** The `EthnicityBlender` component's `toggleEth` function (lines 214–227 of `WarmPrimitives.tsx`) caps the selection at 2 — adding a third one replaces the second:

```ts
} else if (selected.length >= 2) {
  onChange([{ ...selected[selected.length - 1], pct: 50 }, { name, pct: 50 }]);
}
```

The chip display formatter simplifies to:

```ts
function formatEthnicity(blend: { name: string; pct: number }[]): string | null {
  if (blend.length === 0) return null;
  if (blend.length === 1) return blend[0].name;
  // length === 2
  return `${blend[0].name} + ${blend[1].name}`;
}
```

If the product later wants 3+ ethnicity blends, the `EthnicityBlender` component itself needs a logic change, not just the formatter. Out of scope for pass 1.

---

## Section D — Hair: color vs. style is two different things

The main docs treated "Hair" as one canvas chip, but the schema has both `hairColor` AND `hairStyle` as distinct fields, plus 9 more hair-related fields (`hairLength`, `hairTexture`, `hairFringe`, `hairParting`, `hairVolume`, `hairFlyaways`, `hairHairline`, `hairTuck`, `hairFade`).

**The decision:** the canvas chip labelled `Hair` is **hair color only**. It opens the `HairColorWheel` component in a popover. The other 10 hair-related fields are refinement-studio-only — they live in the Attributes tab under the "Eyes & hair" section, accessed via the existing `WarmSelectControl` and other primitives.

The chip display formatter:

```ts
function formatHair(attrs: CastAttributes): string | null {
  return attrs.hairColor || null;
}
```

`Hair · Dark Brown` reads naturally, doesn't promise more than the chip delivers, and matches the user's mental model that "the canvas chip handles the broad-strokes choice."

### D1 — Cross-field reset on gender change

`ControlPanel.tsx` line 204 contains a critical cross-field side effect:

```ts
onSelect={(val) => {
  if (val !== (prefs.gender || 'Female')) {
    updatePrefs({ gender: val, hairStyle: '', hairFade: '', facialHair: '' });
  } else updatePref('gender', val);
}}
```

When the user changes gender, `hairStyle`, `hairFade`, and `facialHair` are cleared. This is because these fields are gendered (the `HAIR_STYLE_CONFIG` filters by gender). **The new `boardOps.updateAttributes` operation must preserve this reset behavior.** If a `gender` change is in the changes object, the operation must atomically also clear those three fields.

Recommended implementation: a small set of cross-field invalidation rules in `boardOps`:

```ts
const CROSS_FIELD_INVALIDATIONS: Record<string, string[]> = {
  gender: ['hairStyle', 'hairFade', 'facialHair'],
};
```

When applying changes, any field in this map causes its dependent fields to be cleared (or set to their gendered defaults) in the same atomic update.

---

## Section E — `EyeGrid` exists; should there be a 6th canvas chip?

The audit surfaced an `EyeGrid` component in `WarmPrimitives.tsx` (lines 154–178) that I missed when writing the main docs. It's a tactile 15-color iris picker with radial gradients — same visual register as the other expressive controls. It's currently used in `ControlPanel`'s "Eyes & hair" section.

**The question:** does eye color earn a 6th canvas chip alongside Brand, Vibe, Ethnicity, Skin, Hair?

**The case for yes:** eye color is genuinely expressive. `Eyes · Hazel` vs `Eyes · Steel` is a meaningful identity dimension. The `EyeGrid` component is small (fits in a 200px popover easily). Adding the chip is mechanical: extend the chip strip from 5 to 6 chips, add `EyeColorPopover` wrapping `EyeGrid`, done in maybe an hour. The five-chip cap was an arbitrary number I picked, not a principled limit.

**The case for no:** five chips already produce a fairly busy strip below a selected node. Six is busier. The 80% case for casting is set the brand and vibe, maybe ethnicity, and let everything else default. Eye color is a refinement-studio concern in practice.

**Recommendation:** add it. The expressive-control bar is the load-bearing identity surface for casts on the canvas, and eye color is genuinely identity-level. Six chips is fine. The chip strip already wraps to two rows on narrow widths anyway. If dogfooding proves it's clutter, removing it later is one line of code.

If you take this recommendation, the `BlenderChipStrip` chip array from design system 5.9 becomes:

```ts
const blenderChips = [
  { id: "brand",     label: "Brand",     value: attrs.castingBrand ?? null,                            popoverContent: <BrandSelectorPopover ... /> },
  { id: "vibe",      label: "Vibe",      value: attrs.castingVibe ? formatVibe(attrs.castingVibe) : null, popoverContent: <VibeBlenderPopover ... /> },
  { id: "ethnicity", label: "Ethnicity", value: formatEthnicity(attrs.ethnicityBlend ?? []),             popoverContent: <EthnicityBlenderPopover ... /> },
  { id: "skin",      label: "Skin",      value: attrs.skinTone?.split(' / ')[0] ?? null,                 popoverContent: <SkinTonePopover ... /> },
  { id: "hair",      label: "Hair",      value: attrs.hairColor ?? null,                                 popoverContent: <HairColorPopover ... /> },
  { id: "eyes",      label: "Eyes",      value: attrs.eyeColor ?? null,                                  popoverContent: <EyeColorPopover ... /> },
];
```

---

## Section F — Vibe display: preset name, not percentages

The main docs specified `formatVibe` returning `"55 / 25 / 20"` — three percentages joined with slashes. The audit revealed that **`TriBlendSelector` already maps the 2D point to one of 8 named presets** when within snap distance:

```ts
const PRESETS = [
  { label: 'Catalogue',   edge: 300, heat: 333 },
  { label: 'Commercial',  edge: 200, heat: 500 },
  { label: 'High-Com',    edge: 400, heat: 250 },
  { label: 'Balanced',    edge: 660, heat: 500 },
  { label: 'Street-Ed',   edge: 750, heat: 333 },
  { label: 'Editorial',   edge: 900, heat: 111 },
  { label: 'Avant-Garde', edge: 950, heat: 368 },
  { label: 'Runway',      edge: 900, heat: 889 },
];
```

`Vibe · Editorial` is much more legible on a canvas chip than `Vibe · 55 / 25 / 20`. The display should show the preset name when one is matched, falling back to `Custom` when the point is between presets:

```ts
function formatVibe(vibe: { editorial: number; commercial: number; runway: number }): string {
  // Convert weights to (edge, heat) using the same math as TriBlendSelector
  const edge = Math.round((1 - vibe.commercial) * 1000);
  const nonCom = vibe.editorial + vibe.runway;
  const heat = nonCom > 0.001 ? Math.round((vibe.runway / nonCom) * 1000) : 500;

  // Find nearest preset within snap threshold (35)
  const SNAP_THRESHOLD = 35;
  let best: { label: string; edge: number; heat: number } | null = null;
  let bestDist = Infinity;
  for (const p of PRESETS) {
    const dist = Math.sqrt((edge - p.edge) ** 2 + (heat - p.heat) ** 2);
    if (dist < bestDist) { bestDist = dist; best = p; }
  }

  return bestDist < SNAP_THRESHOLD && best ? best.label : "Custom";
}
```

The `PRESETS` array should be exported from `TriBlendSelector.tsx` so the formatter can reuse it instead of duplicating it. Small refactor, ~5 minutes.

---

## Section G — Lifted components are redesigned in the canvas language

### G.0 — Override of original recommendation

An earlier draft of this section said "lifted components keep their warm tactile identity, the popover provides the canvas-language shell." That recommendation was wrong and is overridden here.

**The corrected position:** every lifted casting component is redesigned to use canvas tokens, hairline borders, monochrome ink, sentence-case typography, and the component patterns from the design system. The functional behavior of each component (drag, snap-to-preset, blend bar manipulation, color selection, collapsible sections) is preserved unchanged. **Only the visual styling is redesigned.** No structural rewrites in pass 1 — those are deferred to a future polish pass.

**Why the original recommendation was wrong.** It rested on an aesthetic argument ("the warm components have character") rather than a principled one. The canvas product is positioned as a clean, coherent surface in the Luma/ElevenLabs space. Visual consistency is a feature in that category — every plugin that fails to match its host app's design language reads as third-party intrusion. The "tactility" argument also doesn't hold under examination: tactility comes from real spatial controls, direct manipulation, drag interactions, snap behaviors, and live readouts — none of which require warm colors or gradient tracks. A flat white TriBlendSelector with hairline borders, the same dragging and snapping, would be exactly as tactile.

**The principled exception — color data stays colored.** Three components display data that is intrinsically chromatic: `SkinToneGrid` (skin tones), `HairColorWheel` (hair colors), `EyeGrid` (iris colors). You cannot render a skin tone picker in monochrome and have it work. For these three components, **the data swatches themselves remain colored**, but everything around them — borders, hover states, selected indicators, hover rings, surrounding chrome, axis labels, and typography — conforms fully to the canvas language. The exception is "when the data is color, the data stays colored," not "warm aesthetic survives."

**Update to the design system anti-patterns section (Section 3):** add the line *"The 'no gradients, monochrome' rules apply to lifted casting components too. Color-data swatches in `SkinToneGrid`, `HairColorWheel`, and `EyeGrid` are the only exception, and only for the data swatches themselves — their borders, hover states, and surrounding chrome follow the canvas language."*

The remaining subsections G.1 through G.9 specify the redesign per component. G.10 is a token mapping reference table for search-and-replace.

---

### G.1 — `TriBlendSelector` redesign

**File:** `client/src/features/casting/components/TriBlendSelector.tsx`. ~324 lines today, ~280 after redesign. Functional behavior unchanged.

**Note on structure.** The current implementation uses **two horizontal sliders** (edge and heat) plus a collapsible 8-preset grid, not a 2D plane. Earlier mockups showed a 2D edge×heat plane — that visual was aspirational, not what the code currently does. **Redesign in pass 1 keeps the two-slider structure.** Converting to a 2D plane is a structural rewrite worth doing later as a polish enhancement, but it is explicitly out of scope for pass 1.

**Outer container (lines 140–148):** delete the inline beige container styling. The component now relies on the host popover (`CanvasPopoverContent`) to provide the surface. Replace with:

```tsx
<div className="w-full select-none space-y-3">
```

**Header (lines 149–161):** strip warm colors, drop the explicit fontWeight-600. Replace with:

```tsx
<div className="flex items-center justify-between mb-3">
  <div className="flex items-center gap-1.5">
    <span className="text-canvas-md font-medium text-canvas-ink">Tone & energy</span>
    <Tooltip content="Drag the sliders or type a value (0–1000). Tap a preset to snap to a known vibe." />
  </div>
  <span className={cn(
    "text-canvas-xs italic transition-opacity",
    activePreset ? "text-canvas-ink-soft opacity-100" : "text-canvas-ink-faint opacity-60"
  )}>
    {activePreset ? activePreset.label : "Custom"}
  </span>
</div>
```

Note the title change from `"Tone & Energy"` to `"Tone & energy"` — sentence case per the anti-patterns rule.

**Edge slider (lines 163–210) and heat slider (lines 212–259):** identical refactor. Replace each with the canvas-language slider pattern. The track becomes a single 4px hairline-bordered surface with the filled portion in `bg-canvas-ink` (no gradient). The thumb becomes a simple 14px circle in `bg-canvas-ink`. The label goes from lowercase warm gray to sentence case canvas-ink-soft. The number input loses its hardcoded font weight and adopts canvas typography.

```tsx
<div>
  <div className="flex items-baseline justify-between mb-2">
    <span className="text-canvas-xs text-canvas-ink-soft">Edge</span>
    <input
      type="number"
      value={edgeInputVal}
      onChange={handleEdgeInput}
      onBlur={handleEdgeBlur}
      min={0} max={1000} step={10}
      className="w-11 text-right text-canvas-sm text-canvas-ink bg-transparent border-0 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  </div>
  <div
    ref={edgeTrackRef}
    onMouseDown={onEdgeDrag}
    onTouchStart={onEdgeDrag}
    className="relative h-7 flex items-center cursor-pointer touch-none"
  >
    <div className="w-full h-1 rounded-full relative bg-canvas-surface-inset border-hairline border-canvas-border">
      <div
        className="absolute top-0 left-0 h-full rounded-full bg-canvas-ink transition-[width] duration-150 ease-out"
        style={{ width: `${pctEdge}%` }}
      />
    </div>
    <div
      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-canvas-ink border-2 border-canvas-surface cursor-grab z-10 transition-[left] duration-150 ease-out"
      style={{ left: `${pctEdge}%` }}
    />
  </div>
  <div className="flex justify-between mt-1">
    <span className="text-canvas-xs text-canvas-ink-faint">Safe</span>
    <span className="text-canvas-xs text-canvas-ink-faint">Bold</span>
  </div>
</div>
```

The heat slider is identical except for variable names and labels (`narrative` → `Narrative`, `commanding` → `Commanding`). Note: the thumb's white border (line `border-2 border-canvas-surface`) is the only piece that simulates a "ring" effect — it gives the dot definition against the track without any actual shadow. This is the same technique used by `ConnectionDot` in the canvas spec.

**Description text (line 262):** swap colors:

```tsx
<div className="text-canvas-xs text-canvas-ink-soft mt-3 pl-0.5 leading-relaxed min-h-[14px]">
  {activePreset ? activePreset.desc : getCustomDesc(edge, heat)}
</div>
```

**Presets toggle (lines 266–284):** the chevron and "PRESETS" label both need updating. Replace with sentence case, swap the inline SVG for `lucide-react`'s `ChevronRight`, and use canvas typography:

```tsx
<button
  type="button"
  onClick={() => setPresetsOpen(!presetsOpen)}
  className="flex items-center gap-1.5 mt-2.5 p-0 bg-transparent border-0 cursor-pointer text-canvas-xs text-canvas-ink-soft hover:text-canvas-ink transition-colors"
>
  <ChevronRight
    className={cn("w-2 h-2 transition-transform duration-200", presetsOpen && "rotate-90")}
    strokeWidth={2}
  />
  Presets
</button>
```

**Preset grid (lines 286–318):** the eight preset buttons get the same chip pattern as `BlenderChip` (G.6 below). Hairline border, surface bg, hover surface-inset, active 1px canvas-ink with surface-inset bg. No shadows, no scale transforms.

```tsx
<div
  style={{ maxHeight: presetsOpen ? 120 : 0 }}
  className="overflow-hidden transition-[max-height] duration-250 ease-out"
>
  <div className="grid grid-cols-4 gap-1.5 pt-2.5">
    {PRESETS.map(p => {
      const dist = Math.sqrt((edge - p.edge) ** 2 + (heat - p.heat) ** 2);
      const isActive = dist < SNAP_THRESHOLD;
      return (
        <button
          key={p.label}
          type="button"
          onClick={() => onChange(edgeHeatToWeights(p.edge, p.heat))}
          className={cn(
            "py-2 rounded-canvas-md text-center text-canvas-xs transition-colors",
            isActive
              ? "bg-canvas-surface-inset border border-canvas-ink text-canvas-ink font-medium"
              : "bg-canvas-surface border-hairline border-canvas-border text-canvas-ink-soft hover:border-canvas-border-strong"
          )}
        >
          {p.label}
        </button>
      );
    })}
  </div>
</div>
```

---

### G.2 — `EthnicityBlender` redesign

**File:** `client/src/features/casting/components/WarmPrimitives.tsx`, lines 182–285. Functional behavior unchanged including the 2-ethnicity cap (Section C).

**Ethnicity grid buttons (lines 231–249):** swap to the standard chip pattern. Same as the preset chips in G.1. Replace the entire button styling block with:

```tsx
<button
  key={eth}
  type="button"
  onClick={() => toggleEth(eth)}
  className={cn(
    "py-2.5 rounded-canvas-md text-center text-canvas-xs transition-colors",
    active
      ? "bg-canvas-surface-inset border border-canvas-ink text-canvas-ink font-medium"
      : "bg-canvas-surface border-hairline border-canvas-border text-canvas-ink-soft hover:border-canvas-border-strong"
  )}
>
  {eth}
</button>
```

The grid layout itself stays as `grid-cols-3 gap-1.5`.

**Blend bar (lines 250–278):** this is the biggest visual change. Currently the bar shows two segments filled with linear gradients in warm ethnic colors. **Drop the per-ethnicity color encoding entirely.** The new bar is two flat segments using canvas tokens, with the divider draggable. The point of the bar is to show *proportions*, not *which ethnicity is which color* — the labels already convey identity.

```tsx
{selected.length === 2 && (
  <div className="space-y-1 pt-1">
    <div
      ref={barRef}
      className="relative flex h-8 rounded-canvas-md overflow-hidden border-hairline border-canvas-border select-none"
      style={{ cursor: dragging ? 'col-resize' : 'default' }}
    >
      {selected.map((eth, i) => (
        <div
          key={eth.name}
          className="h-full flex items-center justify-center relative bg-canvas-surface-inset"
          style={{
            width: `${eth.pct}%`,
            transition: dragging ? 'none' : 'width 200ms ease',
            // Subtle inset border between segments
            ...(i === 0 && selected.length === 2 ? { borderRight: '0.5px solid var(--color-canvas-border)' } : {}),
          }}
        >
          {eth.pct > 20 && (
            <span className="text-canvas-xs font-medium text-canvas-ink-soft">
              {eth.name}
            </span>
          )}
          <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-canvas-xs text-canvas-ink-faint whitespace-nowrap">
            {eth.pct}%
          </span>
        </div>
      ))}
      <div
        onMouseDown={(e) => { e.preventDefault(); setDragging(true); }}
        onTouchStart={() => setDragging(true)}
        className="absolute top-0 h-full w-3.5 -ml-1.5 cursor-col-resize flex items-center justify-center z-10 touch-none"
        style={{ left: `${selected[0].pct}%` }}
      >
        <div className={cn(
          "w-0.5 h-3.5 rounded-full transition-colors",
          dragging ? "bg-canvas-ink" : "bg-canvas-border-strong"
        )} />
      </div>
    </div>
    <div className="h-3.5" /> {/* spacer for the absolutely-positioned percentages */}
  </div>
)}
```

**Caps the case where text labels stop showing.** The current code only shows the ethnicity label when `pct > 20`. Keep that — at smaller widths the label would clip anyway. Below the bar, the percentage is always shown via the absolutely-positioned span.

**Single-ethnicity hint (line 280–282):** swap to canvas tokens:

```tsx
{selected.length === 1 && (
  <div className="text-canvas-xs text-canvas-ink-soft pl-0.5 mt-0.5">
    Tap a second ethnicity to create a blend
  </div>
)}
```

**Important gotcha:** the `<div className="h-3.5" />` spacer is necessary because the percentage labels are absolutely positioned with `bottom: -14px` (currently `-bottom-4` in Tailwind terms). Without the spacer, the percentages would be clipped by the popover's bottom padding. The popover wrapping this component should also be wider than the default (320px instead of 280px) to give the 3-column ethnicity grid breathing room.

---

### G.3 — `SkinToneGrid` redesign (color-data exception)

**File:** `client/src/features/casting/components/WarmPrimitives.tsx`, lines 492–505. Functional behavior unchanged.

**Color data stays colored, everything else goes monochrome.** The 6 swatches keep their actual skin tone colors (the `base` value from the `SKIN_TONES` array), but the gradient overlay, the chunky borders, and the scale transform all go.

**Replacement:**

```tsx
export const SkinToneGrid = ({ selected, onSelect }: { selected: string; onSelect: (v: string) => void }) => (
  <div className="grid grid-cols-6 gap-2">
    {SKIN_TONES.map(tone => {
      const isSelected = selected === tone.value;
      return (
        <button
          key={tone.label}
          type="button"
          onClick={() => onSelect(tone.value)}
          title={tone.label}
          className={cn(
            "h-9 rounded-canvas-md transition-all",
            isSelected
              ? "border border-canvas-ink ring-1 ring-canvas-ink ring-offset-1 ring-offset-canvas-surface"
              : "border-hairline border-canvas-border hover:border-canvas-border-strong"
          )}
          style={{ background: tone.base }} // flat color, not gradient
        />
      );
    })}
  </div>
);
```

**Changes from current:**
- `background: \`linear-gradient(135deg, ${tone.base}, ${tone.shadow})\`` → `background: tone.base` (flat color)
- `border: '2.5px solid #1a1a1a'` (selected) → `border border-canvas-ink ring-1 ring-canvas-ink ring-offset-1` (canvas-language ring effect, gives prominence without thick borders)
- `border: '2px solid rgba(0,0,0,0.06)'` (default) → `border-hairline border-canvas-border` with hover-strong
- `transform: 'scale(1.1)'` (selected) → removed (no scale transforms; the ring provides emphasis)
- Height bumped from `h-8` (32px) to `h-9` (36px) for slightly better visibility

The `tone.shadow` color is no longer used. It can be removed from the `SKIN_TONES` array if you want, but it's harmless to leave in.

---

### G.4 — `HairColorWheel` redesign (color-data exception)

**File:** `client/src/features/casting/components/HairColorWheel.tsx`. ~290 lines, no structural change.

This is the most complex redesign because the component has multiple sub-elements: tab switcher (Dyed/Natural), tone segmented control (Warm/Neutral/Cool), the wheel itself, and the center selection display. Each gets canvas-language treatment except the wheel segments themselves, which retain their actual hair colors.

**Tabs (Dyed/Natural):** match the refinement studio's tab styling from design system section 6:

```tsx
<div className="flex border-b-hairline border-canvas-border mb-4 -mx-0">
  {(['Dyed', 'Natural'] as const).map(tab => (
    <button
      key={tab}
      type="button"
      onClick={() => setActiveTab(tab)}
      className={cn(
        "px-3 py-2 text-canvas-sm transition-colors -mb-px",
        activeTab === tab
          ? "text-canvas-ink font-medium border-b border-canvas-ink"
          : "text-canvas-ink-faint hover:text-canvas-ink-soft"
      )}
    >
      {tab}
    </button>
  ))}
</div>
```

**Tone segmented control (Warm/Neutral/Cool):** same pattern as the Refine tab's strength buttons in design system 6.2:

```tsx
<div className="grid grid-cols-3 gap-1 mb-4">
  {(['Warm', 'Neutral', 'Cool'] as const).map(t => (
    <button
      key={t}
      type="button"
      onClick={() => setTone(t)}
      className={cn(
        "py-1.5 rounded-canvas-md text-canvas-xs transition-colors border-hairline",
        tone === t
          ? "border-canvas-ink text-canvas-ink font-medium"
          : "border-canvas-border text-canvas-ink-faint hover:border-canvas-border-strong"
      )}
    >
      {t}
    </button>
  ))}
</div>
```

**The wheel itself (color-data exception):** the circular wheel has 16 segments, each filled with an actual hair color. **Keep the colors.** What changes:
- The wheel container background goes from any warm bg to `bg-canvas-surface-inset` with `border-hairline border-canvas-border`.
- The segment borders (currently with shadow effects) become flat. Selected segment gets a 1.5px `border-canvas-ink` ring on its outer arc instead of the current drop shadow.
- The center label goes from warm typography to `text-canvas-md text-canvas-ink font-medium`.
- The selected color name displayed in the center: same canvas typography.

The exact SVG/path implementation of the wheel itself stays unchanged — the wheel's geometry and the per-segment color fills are not what we're redesigning. Only the wrapping container, the center text, the selection ring, and any chrome around the wheel.

**Tone preview / current color readout under the wheel:** wherever it currently shows the selected color name plus tone qualifier ("Warm Honey" etc.), update typography:

```tsx
<div className="text-center mt-3">
  <div className="text-canvas-md font-medium text-canvas-ink">{displayName}</div>
  <div className="text-canvas-xs text-canvas-ink-faint mt-0.5">{tone} tone</div>
</div>
```

**Drop the warm beige outer container.** Like TriBlendSelector, the component should rely on the host popover to provide the surface. The outer wrapper becomes:

```tsx
<div className="w-full select-none">
```

The wheel's natural rendering inside this should fit the popover at ~300px width.

---

### G.5 — `EyeGrid` redesign (color-data exception, plus simplification)

**File:** `client/src/features/casting/components/WarmPrimitives.tsx`, lines 154–178. Functional behavior unchanged.

The 15 iris circles are color data and stay colored. **Two specific simplifications:**

1. The radial gradient that mimics iris depth (`radial-gradient(circle at 35% 35%, ${opt.hex} 0%, #333 80%)`) is **kept** — it's not pure decoration, it's what makes the swatch read as "an eye iris" rather than "a color dot." This is a meaningful visual aid for the user, distinct from skin tones (which are just color).
2. The white highlight dot (line 173: `<div className="absolute top-[25%] left-[25%] w-[15%] h-[15%] bg-white rounded-full blur-[1px] opacity-50" />`) is **removed.** It's gratuitous detail that adds nothing to selection clarity.

**Borders, hover, selection:** same canvas-language treatment as `SkinToneGrid`:

```tsx
export const EyeGrid = ({ selected, onSelect }: {
  selected: string; onSelect: (v: string) => void;
}) => (
  <div className="grid grid-cols-5 gap-2">
    {EYE_PRESETS.map(opt => {
      const isSelected = selected === opt.label;
      return (
        <button
          key={opt.label}
          type="button"
          onClick={() => onSelect(opt.label)}
          title={opt.label}
          className={cn(
            "relative w-full aspect-square rounded-full overflow-hidden transition-all",
            isSelected
              ? "border border-canvas-ink ring-1 ring-canvas-ink ring-offset-1 ring-offset-canvas-surface"
              : "border-hairline border-canvas-border hover:border-canvas-border-strong"
          )}
        >
          <div
            className="absolute inset-0"
            style={{ background: `radial-gradient(circle at 35% 35%, ${opt.hex} 0%, #333 80%)` }}
          />
        </button>
      );
    })}
  </div>
);
```

The radial-gradient inline style is the only acceptable gradient in the redesigned components — it's color data conveying iris depth.

---

### G.6 — `BrandSelector` redesign

**File:** `client/src/features/casting/components/BrandSelector.tsx` (created in Section A2 by extracting from `ControlPanel`). When you extract the inline JSX, **redesign it during the extraction** rather than copying the warm styling and redesigning later. Drop the inline style blocks entirely.

**New version:**

```tsx
import { cn } from "@/lib/utils";
import { BRAND_OPTIONS } from "@/features/casting/constants";

interface BrandSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function BrandSelector({ value, onChange }: BrandSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {BRAND_OPTIONS.map(b => {
        const sel = value === b.value;
        return (
          <button
            key={b.value}
            type="button"
            onClick={() => onChange(b.value)}
            className={cn(
              "rounded-canvas-md text-center transition-colors px-1 py-2",
              sel
                ? "bg-canvas-surface-inset border border-canvas-ink"
                : "bg-canvas-surface border-hairline border-canvas-border hover:border-canvas-border-strong"
            )}
          >
            <div className={cn(
              "text-canvas-sm",
              sel ? "text-canvas-ink font-medium" : "text-canvas-ink-soft"
            )}>
              {b.value}
            </div>
            <div className={cn(
              "text-canvas-xs mt-0.5",
              sel ? "text-canvas-ink-soft" : "text-canvas-ink-faint"
            )}>
              {b.desc}
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

---

### G.7 — `CollapsibleSection`, `WarmSelectControl`, `ChipRow`, `OptionGrid`, `SummaryStrip`, `FieldLabel`

These are smaller utility components used across the Attributes tab. All get the same token-swap treatment without structural change.

**`FieldLabel` (lines 29–33 of `WarmPrimitives.tsx`):** swap inline style to tokens.

```tsx
export const FieldLabel = ({ children, filled = true }: { children: React.ReactNode; filled?: boolean }) => (
  <div className="text-canvas-xs text-canvas-ink-soft mb-1.5">
    {children}<ReqDot filled={filled} />
  </div>
);
```

The `ReqDot` (line 25) — the small orange "required" indicator — stays orange because it's a semantic warning. Update to use a token:

```tsx
const ReqDot = ({ filled }: { filled: boolean }) => (
  !filled ? <span className="inline-block w-1 h-1 rounded-full bg-canvas-warning ml-1 align-middle" /> : null
);
```

Add `--color-canvas-warning: #E07C5A` to `canvas-tokens.css` if you want the same warm orange, or use a more standard semantic warning color. Either works.

**`ChipRow` (lines 37–63):** delete the inline style block. Each button becomes:

```tsx
<button
  key={opt}
  type="button"
  onClick={() => allowDeselect && selected === opt ? onSelect('') : onSelect(opt)}
  className={cn(
    "py-2 rounded-canvas-md text-center text-canvas-xs transition-colors",
    selected === opt
      ? "bg-canvas-surface-inset border border-canvas-ink text-canvas-ink font-medium"
      : "bg-canvas-surface border-hairline border-canvas-border text-canvas-ink-soft hover:border-canvas-border-strong"
  )}
>
  {opt}
</button>
```

**`OptionGrid` (lines 67–115):** identical button refactor to `ChipRow`. The "Reset to Auto" link at the bottom (lines 96–110) becomes:

```tsx
<button
  type="button"
  onClick={() => onSelect('Auto')}
  className="flex items-center gap-1 text-canvas-xs text-canvas-ink-faint hover:text-canvas-ink-soft transition-colors p-0 bg-transparent border-0 cursor-pointer"
>
  <RotateCcw className="w-2 h-2" strokeWidth={2} />
  Reset to auto
</button>
```

(Use `RotateCcw` from `lucide-react` instead of the inline SVG. Sentence case "auto" not "Auto".)

The "Guided by casting direction" message:

```tsx
<span className="text-canvas-xs text-canvas-ink-faint">Guided by casting direction</span>
```

**`WarmSelectControl` (lines 119–139):** the cleanest fix is to replace the native `<select>` entirely with shadcn's `Select` component (`@/components/ui/select`). This gets you correct dropdown styling, accessibility, keyboard navigation, and consistency for free.

```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const WarmSelectControl = ({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) => (
  <div>
    <div className="text-canvas-xs text-canvas-ink-soft mb-1">{label}</div>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full h-9 bg-canvas-surface border-hairline border-canvas-border rounded-canvas-md text-canvas-sm text-canvas-ink shadow-none hover:border-canvas-border-strong focus:ring-0 focus:border-canvas-ink">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent className="bg-canvas-surface border-hairline border-canvas-border-strong rounded-canvas-md shadow-none">
        {options.map(o => (
          <SelectItem
            key={o}
            value={o}
            className="text-canvas-sm text-canvas-ink-soft focus:bg-canvas-surface-inset focus:text-canvas-ink"
          >
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);
```

You may need to override more shadcn defaults to fully match — the `shadow-none` and the specific border colors are the most important ones. The component name `WarmSelectControl` is now misleading; rename to `CanvasSelectControl` if you want, but renaming touches every import site, so it's optional.

**`CollapsibleSection` (lines 289–348):** three changes.

1. **Drop the `.toUpperCase()` (line 325).** This is the explicit anti-pattern violation. Title becomes:

```tsx
<span className="text-canvas-sm font-medium text-canvas-ink-soft">{title}</span>
```

(No letter-spacing, no uppercase.)

2. **Replace the inline chevron SVG with `ChevronRight` from `lucide-react`:**

```tsx
import { ChevronRight } from "lucide-react";

// In the header:
<ChevronRight
  className={cn(
    "w-2.5 h-2.5 text-canvas-ink-faint transition-transform duration-200",
    isOpen && "rotate-90"
  )}
  strokeWidth={2}
/>
```

3. **Completion dots (lines 327–331):** keep the 3-dot pattern, swap to tokens:

```tsx
<div className="flex items-center gap-1">
  {Array.from({ length: dots }).map((_, i) => (
    <div
      key={i}
      className={cn(
        "w-1 h-1 rounded-full transition-colors",
        i < filled ? "bg-canvas-ink" : "bg-canvas-border"
      )}
    />
  ))}
</div>
```

The section header button itself drops its inline padding/styling:

```tsx
<button
  type="button"
  onClick={() => onToggle(id)}
  className="w-full flex items-center justify-between px-4 py-3 cursor-pointer bg-transparent border-0 hover:bg-canvas-surface-inset/50 transition-colors"
>
```

The outer container border-top swaps to a token:

```tsx
<div className="border-t-hairline border-canvas-border">
```

**`SummaryStrip` (lines 421–479):** swap colors and typography, drop letter-spacing:

```tsx
return (
  <div
    className="custom-scrollbar flex gap-1 px-4 py-1.5 border-b-hairline border-canvas-border bg-canvas-surface-inset overflow-x-auto"
    style={{ scrollbarWidth: 'none' }}
  >
    {items.map((item, i) => {
      const IconComp = SUMMARY_ICON_MAP[item.iconKey];
      return (
        <span
          key={i}
          className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-canvas-pill bg-canvas-surface text-canvas-xs text-canvas-ink-soft whitespace-nowrap border-hairline border-canvas-border"
        >
          <span className="opacity-60 flex items-center text-canvas-ink-faint">
            {IconComp && <IconComp />}
          </span>
          {item.label}
        </span>
      );
    })}
  </div>
);
```

---

### G.8 — Casting components NOT touched by the redesign

For clarity, these stay as-is:

- The hooks (`useCastingGeneration`, `useCastingViewGeneration`, `useCastingCanvas`, `useCastingExport`) — they're logic, not visuals. The hook refactor in Section A1 happens for store-coupling reasons, not visual ones.
- The `castingHelpers.ts` utility module.
- The `constants.ts` data file (option lists, brand definitions, view types).
- The `hairStyleConfig.ts` data file.
- Any backend code in `server/casting/`.

---

### G.9 — `ControlPanel.tsx` is NOT redesigned in pass 1

`ControlPanel.tsx` is 491 lines of warm-aesthetic JSX. The right approach is **not** to redesign it during pass 1 — it lives in the legacy `/studio` route which is preserved as a fallback. Touching it would risk breaking the legacy studio.

Instead, the *new* refinement studio's Attributes tab in pass 1 builds its layout from scratch using the redesigned primitives (G.1 through G.7) directly. The existing `ControlPanel` is kept untouched. When `/studio` is eventually retired post-pass-3, `ControlPanel` is deleted along with it.

This means there will be a temporary period where the same primitive components are used in two visually different contexts: the legacy `ControlPanel` (warm aesthetic) and the new refinement studio Attributes tab (canvas language). **The primitive components themselves use canvas tokens, so when used inside the legacy `ControlPanel`'s warm container, they'll create visual dissonance there.** That's acceptable because `/studio` is on a known retirement path. Better to have one consistent canvas-language version of each primitive than two parallel implementations.

If the visual dissonance in `/studio` is genuinely jarring during the transition, the mitigation is to wrap the legacy `ControlPanel` in a class scope and override the canvas tokens locally to the warm values inside that scope. That's a CSS-only fix and takes maybe an hour. But test first — it might not be necessary.

---

### G.10 — Token mapping reference table

For Manus's quick-reference during the redesign, here is every hardcoded value used by the lifted components and its canvas token replacement. Search-and-replace works as long as you understand the context (some values map to different tokens depending on whether they're a background, a border, or text).

| Hardcoded value     | Canvas replacement                          | Used as          | Notes |
|---------------------|---------------------------------------------|------------------|-------|
| `#1a1a1a`           | `var(--color-canvas-ink)`                   | text, bg, border | Primary ink |
| `#52524B`           | `var(--color-canvas-ink-soft)`              | text             | Secondary text |
| `#71716A`           | `var(--color-canvas-ink-soft)`              | text             | Same as above |
| `#777168`           | `var(--color-canvas-ink-soft)`              | text             | Same |
| `#999`              | `var(--color-canvas-ink-faint)`             | text             | Tertiary/placeholder |
| `#bbb`              | `var(--color-canvas-ink-faint)`             | icon stroke      | |
| `#d4d0c9`           | `var(--color-canvas-ink-faint)`             | tertiary labels  | |
| `#d8d4ce`           | `var(--color-canvas-ink-faint)`             | hint text        | |
| `#ffffff`           | `var(--color-canvas-surface)`               | bg               | Card surface |
| `#FAFAFA`           | `var(--color-canvas-bg)`                    | bg               | Page bg |
| `#FAFAF8`           | `var(--color-canvas-surface-inset)`         | hover bg, inset  | |
| `#E8E4DF`           | `var(--color-canvas-border)`                | border           | Default border |
| `#C5BFB6`           | `var(--color-canvas-border-strong)`         | hover border     | |
| `rgba(0,0,0,0.04)`  | `var(--color-canvas-surface-inset)`         | bg               | |
| `rgba(0,0,0,0.05)`  | `var(--color-canvas-border)`                | border-top       | |
| `rgba(0,0,0,0.06)`  | `var(--color-canvas-border)`                | border           | |
| `rgba(0,0,0,0.08)`  | `var(--color-canvas-border)`                | dot inactive     | |
| `rgba(0,0,0,0.15)`  | `var(--color-canvas-border-strong)`         | drag handle      | |
| `0 1px 3px rgba(0,0,0,0.04)` | (removed)                          | shadow           | All shadows removed |
| `0 2px 8px rgba(26,26,26,0.12)` | (removed)                       | shadow           | All shadows removed |
| `0 1px 6px rgba(0,0,0,0.15)` | (removed)                          | shadow           | All shadows removed |
| `0 1px 8px rgba(196,149,106,0.3)` | (removed)                     | shadow           | |
| `font-weight: 600`  | `font-weight: 500`                          | font weight      | Per anti-patterns |
| `font-weight: 700`  | `font-weight: 500`                          | font weight      | Per anti-patterns |
| `letter-spacing: 0.06em` | (removed)                             | letter-spacing   | Per design language |
| `borderRadius: 14`  | `var(--radius-canvas-md)` (8px)             | border-radius    | |
| `borderRadius: 8`   | `var(--radius-canvas-md)` (8px)             | border-radius    | |
| `rounded-xl` (12px) | `rounded-canvas-md` (8px)                   | Tailwind class   | |
| `text-transform: uppercase` | (removed)                           | text-transform   | Per anti-patterns |
| `.toUpperCase()` in JSX | (removed)                               | string method    | Sentence case only |
| `linear-gradient(...)` on UI elements | (removed)                | bg               | Color-data swatches keep their data, not gradients |
| `radial-gradient(circle at 35% 35%, hex, #333)` | **kept on `EyeGrid`** | bg | Conveys "iris depth" — color data exception |

For elements that the table maps to "removed," replace the visual effect with one of the token-based alternatives in the canvas language: ring effects via Tailwind's `ring-1 ring-canvas-ink`, border weight changes (0.5px → 1px on select), or background swaps (canvas-surface → canvas-surface-inset).

---

### G.11 — Estimated effort

Time to redesign all lifted components, assuming the Section A1/A2 prerequisites are already done:

| Component           | Estimated time | Notes |
|---------------------|----------------|-------|
| `TriBlendSelector`  | 2–3 hours      | Most complex; two sliders + presets grid |
| `EthnicityBlender`  | 1.5–2 hours    | Blend bar redesign is the trickiest piece |
| `SkinToneGrid`      | 30 minutes     | Smallest change |
| `HairColorWheel`    | 2–3 hours      | Tabs + tone control + wheel container chrome |
| `EyeGrid`           | 30 minutes     | Same as skin tone grid |
| `BrandSelector`     | 30 minutes     | Done as part of Section A2 extraction |
| `CollapsibleSection` | 45 minutes    | Plus removing `.toUpperCase` everywhere |
| `WarmSelectControl` | 1 hour         | Migration to shadcn `Select` |
| `ChipRow`, `OptionGrid`, `SummaryStrip`, `FieldLabel` | 1 hour combined | Mostly token swaps |

**Total: roughly 1–1.5 days of focused redesign work** on top of M1.0 prerequisites and M1.1 mechanical prep. Add this to the M1 critical path. The result is a single coherent canvas language across all surfaces, with the principled exception of color-data swatches.

This is well worth the time. The product feels meaningfully more like one thing instead of "a canvas with embedded warm-aesthetic tools," and the design system finally enforces itself end to end.

---

## Section H — Constants file has duplicates worth cleaning up

`client/src/features/casting/constants.ts` exports `ETHNICITIES` (line 23). `client/src/features/casting/components/WarmPrimitives.tsx` also exports `ETHNICITIES` (line 11). Same name, possibly drifted values. The components currently use the one from `WarmPrimitives.tsx`.

Same situation with `SKIN_TONES` (defined in both places) and `EYE_PRESETS` (defined in both `constants.ts` and `WarmPrimitives.tsx`).

Not a blocker. Worth cleaning up during M1 by deleting the duplicates from `WarmPrimitives.tsx` and importing from `constants.ts` as the single source of truth. Maybe 30 minutes including verifying the values match.

---

## Section I — Honest revised M1 sequencing

With the audit findings folded in, M1 grows from "drop a cast node, type a prompt, hit Run, see a headshot" to:

1. **M1.0a — Prerequisite refactors (1–2 days).**
   - Refactor `useCastingGeneration` to parameter-taking (Section A1)
   - Refactor `useCastingViewGeneration` to parameter-taking (Section A1)
   - Extract `BrandSelector` from `ControlPanel` (Section A2)
   - Verify legacy `/studio` route still works after the hook refactor by passing the existing global stores' values through as params at the call site
   - Clean up the duplicate constants between `constants.ts` and `WarmPrimitives.tsx` (Section H)

2. **M1.0b — Lifted component redesign (1–1.5 days).** Apply Section G's redesign specs to every lifted casting primitive: `TriBlendSelector`, `EthnicityBlender`, `SkinToneGrid`, `HairColorWheel`, `EyeGrid`, `BrandSelector`, `CollapsibleSection`, `WarmSelectControl`, `ChipRow`, `OptionGrid`, `SummaryStrip`, `FieldLabel`. Use the token mapping table in G.10 as a search-and-replace guide. Each component is functionally unchanged — only visuals shift to the canvas language. Color-data swatches in `SkinToneGrid`, `HairColorWheel`, and `EyeGrid` keep their actual colors; everything around them goes monochrome. After this step, the legacy `/studio` route's `ControlPanel` will have visual dissonance because its embedded primitives are now flat — that's expected and acceptable since `/studio` is on a known retirement path. If the dissonance is bad enough to disturb dogfooding, the optional `/studio`-scoped CSS override in G.9 takes about an hour.

3. **M1.1 — Schema and tokens (half a day).** Same as the original M1 mechanical prep — `board_edges` table, `kind` column on `board_items`, `canvas-tokens.css` (now load-bearing for M1.0b too), `border-hairline` utility. **Note that M1.0b depends on this**, so M1.1 should actually run *before* M1.0b, not after. Reordered: M1.0a (refactor) → M1.1 (tokens + schema) → M1.0b (component redesign) → M1.2 (canvas shell). The canvas-tokens.css file must exist before the redesign work begins, or the new Tailwind classes won't resolve.

4. **M1.2 — Canvas shell + empty cast node + LLM parser + first generation.** Same as the original M1, but now feasible because the hooks are refactored, the design tokens exist, and the lifted components are already in canvas language. Delete the three casting stores at the end of this milestone (or earlier if `/studio` is migrated to local state by then).

**The corrected order in one sentence:** refactor the hooks and extract BrandSelector → write the schema migration and canvas tokens file → redesign all lifted components against the new tokens → build the canvas shell and the first cast node.

The total time-to-M1 stretches from "a few days" to **roughly a week and a half** once the prerequisites are honest. That's still pass 1 territory and doesn't change the architectural shape of anything. The week-and-a-half estimate produces a meaningfully better product because the design language is enforced end to end from day one — no future "we should really redesign these warm components" debt.

---

## Section J — Quick reference: corrections to the main docs

For Manus's convenience, here is a tight list of every place in the main docs where the audit surfaced a correction. When implementing, treat this addendum as authoritative.

| Main docs say                                              | Corrected to                                                          | Reason |
|------------------------------------------------------------|----------------------------------------------------------------------|--------|
| "27 casting attributes"                                    | ~33 fields in `DEFAULT_PREFERENCES`                                   | B1     |
| `attrs.skin`                                               | `attrs.skinTone` (display via `.split(' / ')[0]`)                     | B2     |
| `attrs.brand`                                              | `attrs.castingBrand`                                                  | B3     |
| `attrs.vibe`                                               | `attrs.castingVibe` (object, not string)                              | B3     |
| `attrs.hair`                                               | `attrs.hairColor` (chip is hair color only, not style)                | D      |
| `formatEthnicity` returns `"3 mixed"` for 3+               | Cap at 2: `"Brazilian + Japanese"`                                    | C      |
| `formatVibe` returns `"55 / 25 / 20"`                      | Returns preset name like `"Editorial"` or `"Custom"`                  | F      |
| 5 blender chips on the canvas                              | 6 chips (add Eyes alongside Brand/Vibe/Ethnicity/Skin/Hair) — recommended | E      |
| Lifted components match canvas flat language               | Lifted components ARE redesigned in the canvas language; only color-data swatches stay chromatic | G      |
| "Lift the casting hooks unchanged"                         | Hooks need a parameter-taking refactor first                          | A1     |
| `BrandSelector` exists as a component                      | Doesn't exist yet — extract from `ControlPanel` as M1.0                | A2     |
| `boardOps.updateAttributes` only writes the changed fields | Cross-field invalidation: changing `gender` clears `hairStyle`, `hairFade`, `facialHair` atomically | D1 |
| `ethnicityBlend` is the only ethnicity field               | Dual-write: also maintain legacy `ethnicity` comma-joined string      | B4     |

---

## Section K — What the audit did NOT find

For confidence and to set expectations correctly:

1. **No architectural problems.** The four foundational decisions, the root/view model, the kind+provenance split, the edges-as-data, the per-node state architecture — all of it is implementable on the existing codebase without rework.
2. **No leaf component problems.** `TriBlendSelector`, `EthnicityBlender`, `SkinToneGrid`, `HairColorWheel`, `EyeGrid`, `WarmSelectControl`, `CollapsibleSection`, `OptionGrid`, `ChipRow`, `SummaryStrip` — all are pure, parameter-taking, and lift cleanly into popovers without modification.
3. **No tRPC routing problems.** The existing `boards` router has the right shape for new operations to slot in. `boardOps` can be built as a new `server/lib/boardOps.ts` calling existing tRPC procedures plus a few new ones (`generateViews`, `refreshStaleViews`, `markNodeStatus`, `updateAttributes`, etc.) without disturbing existing routes.
4. **No schema problems.** The `board_items` table accepts the new `kind` column additively. The new `board_edges` table is purely additive. Existing rows migrate cleanly. No data loss, no breaking changes.
5. **`useCastingCanvas` and `useCastingExport` are already clean** — pure parameter-taking hooks with no store reads. They lift unchanged. The Surgical tab and Export functionality are unblocked.

The audit's core finding is: **the main docs were architecturally right and tactically optimistic about what "lift unchanged" meant for two specific hooks.** Fix those two hooks, fix the field naming, add 1–2 days to M1's estimate, and the rest of the spec stands.

---

**End of audit addendum. Use this alongside `CANVAS_FOUNDATIONS.md` and `DESIGN_SYSTEM.md`. When the addendum disagrees with the main docs, the addendum wins.**
