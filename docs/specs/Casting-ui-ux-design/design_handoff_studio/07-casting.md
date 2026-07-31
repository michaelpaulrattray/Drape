# 07 — Casting

The full flow is: **brief → roll of eight candidates → keep/follow → sign one → develop them in the casting room**. The separate `design_handoff_casting/` package pitches this flow in depth; this doc covers what the studio prototype ships. The mental model: a candidate sheet shows eight different people answering one brief; the casting room develops ONE signed person.

## Casting tab (roster + new cast)
- Hero band: split image pair (signed sample portraits) + pitch copy.
- **Brief composer**: natural-language prompt ("a dad in his 30s in a cluttered garage…"), interpreted chips (locked attributes render distinctly), Generate button with credits.
- **Roster grid**: "New cast member" dashed tile first, then cast cards — 4:5 portrait slot, DRAFT pill when unsigned, name, look count, voice line (playable — bar-wave animation `dswave` while playing), usage meta. Scope-filtered. Cards open the casting room.

## Candidate roll (after Generate)
- Eight candidate cards rise in (`dsrise` stagger): portrait slot, index "01"–"08", one-line character read ("Confident, amused"), hint line.
- Per-card actions: **Keep** (accent border + "Kept" state — kept candidates SURVIVE further rolls), **Follow** (more faces like this one; children carry a "FROM 03" lineage pill), **Discard** (pure delete — card leaves the sheet).
- "New roll" re-rolls the un-kept slots. Rolls are the priced unit.
- **Sign to roster** on a candidate promotes them to a Cast member (draft → signed); signing is commitment to develop, not final mint.

## Casting room (one person)
- Back link "← Casting", person header (name, voice, status).
- Hero: large portrait + companion frames (1px `--border` gutters).
- **Takes grid**: this person's frames at 4:5, motion pills on video takes, kind pills.
- Refine composer: adjust hair/expression/permanent features; reference images; canonical views (headshot, full-body, profile, walking, back) generate here.
- Quick actions band: Talking UGC ad · Try a product on · Six-look campaign · Still to video (image cards, route to Create/Templates with this cast attached).
- IN CAMPAIGNS list: campaigns this cast appears in.

## Casting sheet
Full-bleed working surface (`isSheet`) used mid-roll: the 8 candidates at working size with keeps highlighted; reached from the tab, returns to it.
