# 06 — Templates

Pre-wired boards a user runs by bringing material. Lead categories: **UGC ads, Social content, Product ads, Short films** — outcome-led, cast-centric (7 of 12 templates take a Cast member input; that dependency on a persistent signed performer is what differentiates us).

## Tab
- Title "Templates" + blurb: "A template is a board someone already wired. Bring what it asks for — a face, a product, a page of script — and it runs the whole chain, then hands you the board to take further."
- "New template" bordered button (a template is a saved canvas — creation happens on the canvas).
- Tabs "All templates / Ours"; category chips All / UGC ads / Social content / Product ads / Short films; count right.
- Grid `auto-fill minmax(230px,1fr)`: 1:1 image card, category pill top-right, name 13px 500 + chain line 10px mono below ("Cast + Script → 30s vertical") + credits estimate.
- Card click → run modal.

## Template table (name · chain · category · output · inputs)
1. Weekly testimonial · Cast+Script→30s vertical · UGC ads · 1 clip 9:16 · Cast*, Script*, Product
2. Founder explainer · Cast+Topic→45s · UGC ads · 1 clip 9:16 · Cast*, Topic*
3. Product demo · Product+Cast→30s · UGC ads · 1 clip 9:16 · Product*, Cast
4. Three-week drop · Product+Cast→9 posts · Social · 9 frames 4:5 · Product*, Cast*
5. Day in the life · Cast+Setting→12 frames · Social · 12 frames 4:5 · Cast*, Setting*
6. Reaction set · Cast→6 expressions · Social · 6 frames 4:5 · Cast*
7. Hero shots · Product photo→9 scenes · Product ads · 9 frames 4:5 · Product*
8. Scene variation · Ad still→9 settings · Product ads · 9 frames 1:1 · Ad still*
9. Before / after · Two stills→one cut · Product ads · 1 frame 16:9 · Before*, After*
10. Opening beat · Treatment→6 shots · Short films · 6 frames 16:9 · Treatment*, Look ref
11. Character sheet · Cast→8 angles · Short films · 8 frames 4:5 · Cast*, Look ref
12. Scene coverage · Shot→5 angles · Short films · 5 frames 16:9 · Establishing*, Scene note
(* = required)

## Run modal (z-60, max 1010×~640, click-scrim closes)
**Left form panel** (hidden when the Canvas pane is showing):
- Name + category eyebrow + description.
- Input slots, one per required/optional input: icon tile + label + REQUIRED/optional mono tag; cast inputs open the roster; image inputs are drop targets; text inputs inline.
- Credits line + primary **Run it** ("Run it again" once a run exists).

**Right stage** with a segmented switch: **Examples / Generations / Canvas** + output shape line ("1 clip · 9:16").
- **Examples** — a fanned deck of 5 sample results (examples are curated samples, NOT one run's outputs — always 5, whatever the template's output count). Centre card at the template's true ratio; peek cards ±50%/±7°/.86 scale at .42 opacity; arrows (`--shadowPop`), mono counter "01 / 05", dot indicators (active dot stretches to 16px). Card sizing: stage is a size container; card width = min(52% | 100%-108px, (100cqh-12px)×ratio), height auto from aspect-ratio. Single-output templates centre one wide card.
- **Generations** — this user's runs of this template, newest first, with per-take rows and statuses. Empty state: "Nothing run yet — give it what it asks for on the left and run it."
- **Canvas** — the template's ACTUAL board rendered full-modal-width at scale 1 (the form yields; a compact title bar keeps name + category). Real canvas-language nodes: header row (icon, label, input/step/output meta), media well, prompt row with editable input + Run split-button, model line, ink pins, curved wires (control-point clamp: min(dx·.5, max(28, dx·.42)) so curves never S-kink). **Editable prompts** per step. **Pannable**: grab empty canvas to drag (grab/grabbing cursors, inputs excluded), board opens centred both axes. Footer: "Edit on canvas" + "Run it".

## Naming decision (final)
It is called **Templates**. Renames were explored and rejected — differentiation comes from the cast-centric content, not the noun.
