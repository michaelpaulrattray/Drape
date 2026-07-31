# 05 — Node toolbar (the floating strip) & model picker

## The strip
Appears ONLY when exactly one generator node is selected, centred 12px below the card (screenshot 02): a glass bar of segments split by 1×12px hairlines:
1. **Model picker chip** — "Klieg V2" + chevron.
2. **RATIO** — stacked mono micro-label over value ("4:5").
3. **SIZE** — same pattern ("2K").
4. **Download** icon.
5. **···** overflow (routes to the context-menu actions).
6. **Delete** (trash).

**Run lives on the node card itself**, not the strip: a split button on the prompt row — "Run" + chevron. The chevron opens the **run-scopes popover**: "Run forward — this node, then downstream · 14cr · 2 nodes" / "Run inputs first — upstream, then this node · 8cr · 3 nodes". A generating node's Run becomes Stop.

There is also a **references popover** (attach inputs without dragging wires): rows Try-on v3 "Image output" (attached) · Product — silk blouson "Upload" · Avatar — Maya R. "Locked identity" · Video — runway walk "Generating", footer actions Upload files / Browse assets.

## Model picker (the canonical instance — screenshot 04)
The studio composers copied THIS design; `design_handoff_studio/04-model-picker.md` has the shared spec and the placement engine — build ONE component. Canvas specifics:
- Kind band: "Try-on models · set by the node" — the NODE's kind decides the model class.
- Intent band eyebrow: **"FROM WHAT IS WIRED IN"** — it reads the actual wired inputs ("Maya and an approved frame are wired in. What are you making with them?"), ghost intent ("keep her exactly, new outfit, rooftop at dusk"), verdict "SOUNDS LIKE A WARDROBE SWAP · RANKED BY CONSISTENCY". The agent's graph-read, surfaced as the ranking explanation.
- RANK BY Cost / Speed / Consistency / Creative; section header follows ("MOST CONSISTENT FIRST").
- Rows: tag tile · name · capability · pips + spec · credits; SUGGESTED on the top-ranked (Nano Banana Pro); active (Klieg V2) carries the left ink bar.
- Placement: opens downward, flips upward when space below < 412px (from the strip it usually opens upward — screenshot 04).
- Model table: G GPT Image 2 · invents a scene · 2K ~14s · 3cr · 100/38 — K Klieg Draft · loose and quick · 1K ~6s · 1cr · 62/26 — N Nano Banana Pro · holds a face · 4K ~20s · 4cr · 48/100 — K Klieg V2 · garment structure · 4K ~18s · 2cr · 40/80 — K Klieg Fine · identity lock · 4K ~42s · 6cr · 26/92.
