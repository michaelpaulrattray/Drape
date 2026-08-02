# Polish round — evidence pack (items 1–6)

**Gate:** D-101. Render-first: every claim below was measured in a headless
browser against the running build, not inferred from the diff.

Cast `KI-MUQH-Q4NT-LBXC-C2MX`, session `af5011d8`, 1440×1150 @2x, both themes.

---

## Item 1 — the sheet card blends

`polish-cards-dark.png`, `polish-cards-light.png`

| Card | Kept | Thumbs shown |
|---|---|---|
| latest | 2 | **4** — 2 kept, then 2 backfilled from the roll |
| 5 others | 0 | 0 |

The four with zero thumbs were checked against the database rather than
assumed: four sessions have **no candidate rows at all** (rolls that never
produced) and one has **8 failed**. Zero is the honest answer there, not a
regression.

Deduplication verified by test: a kept candidate is usually also in the latest
roll, and a naive concatenation would show her twice — the same "looks emptier
than it is" failure the blend was written to fix.

Pinned in `server/castingV2/sheetPreview.test.ts` (6 tests). Extracted from the
route because the rule had been wrong twice with nowhere to assert it.

---

## Item 2 — the rename field

`polish-rename-dark.png`

Measured on the focused input:

```
outlineStyle: "none"        (was a 2px accent rectangle)
borderBottom: rgb(17,17,18) (--ink, the foundation's focus signal)
aria-invalid: "false"       (flips true on an empty name)
```

Root cause was a specificity trap, not a colour choice: `.dpc-room__nameinput:focus`
is (0,1,1) and the blanket `.dp-root :focus-visible { outline: 2px }` is (0,2,0),
so the local `outline: none` lost and the accent ring drew around the text. The
same trap is documented in `foundation.css` for `.dp-input`; this field simply
never inherited the fix.

**Why the law never caught it:** law 1 in `scripts/drive-casting-design-laws.mts`
scanned `.dp-input` only, and the rename is a bare styled `<input>`. A law that
inspects only the controls that opted in is a law the next control opts out of.
It now scans `.dp-input, input[type=text], input:not([type]), textarea`.

---

## Item 3 — siblings navigate by state

Measured `aria-label` on the live sibling tiles:

```
"Open Soft-spoken's room"          → signed  → /casting/cast/<id>
"Find Unbothered on her sheet"     → unsigned → /casting/s/<id>?focus=<candidate>
"Find Quietly cool on her sheet"   → unsigned → /casting/s/<id>?focus=<candidate>
```

**The third route exists and could not be derived on the client.** §G.6's
retention exemption protects a signed Cast's kept siblings — the rows and the
objects — but it does not hold their SESSION open, so the faces outlive the
sheet they lived on. A client assuming "unsigned means sheet" would hand out a
404. The projection therefore derives
`destination: "cast" | "sheet" | "viewer"` server-side, and falls back to the
viewer when the face is genuinely all that is left.

**The same rot was already latent** in the Siblings card's "Open the sheet she
came from" — that button is now gated on a new top-level `sheetOpen`.

`?focus=` lands on the **kept tray**, not the roll grid: siblings are kept by
definition, and the tray is cross-roll, so she is there regardless of which roll
she came from. The tray expands before scrolling — she may sit past the resting
six, and scrolling to a chip that has not rendered scrolls to nothing.

**Assumption stated:** the founder ruled two routes; the expired-sheet fallback
is mine, on the reasoning that a dead link is worse than the picture. Say the
word if you would rather it said something instead.

---

## Item 4 — one image grammar

`polish-viewer-dark.png`, `polish-sheetviewer-dark.png`

Room, measured live:

```
media frames:        9, all <button>   (were divs with handlers)
hover action rows:   0                 (was one per image)
download anchors:    0 on the page     (download is in the viewer only)
"Download package":  present
onDoubleClick:       absent
```

Viewer, driven for real:

| | room | sheet |
|---|---|---|
| opens on click | ✅ | ✅ |
| caption | `Master · Package Three · 1 / 6` | `01 · Unbothered · 1 / 8` |
| → after ArrowRight | `Close-up · Package Three · 2 / 6` | `02 · Quietly cool · 2 / 8` |
| download filename | `Package Three-master.png` → `Package Three-closeUp.png` | `candidate-01.png` |
| Escape closes | ✅ | — |

Filenames are **product names, never storage keys** — someone saving her own
face gets `Package Three-closeUp.png`, not a UUID.

**Sheet candidates are downloadable**, per the ruling that they own what they
generated. No access control changed: those objects already sat at persistently
public URLs. What changed is the product's posture, which was previously
silence.

**No retention warning accompanies it**, deliberately. Download is the *remedy*
for the seven-day purge, not its victim — handing the owner the bytes is how a
face outlives §G.6. The retention confession already has one ratified home and
tone (`retentionCopy.ts`), and repeating it under a download button would be the
same sentence, off-tone, in the wrong place. Say so if you want a word there.

**"Download package"** is a staggered sequence of the same public URLs the
viewer serves — not a server-side archive. An archive would mean an endpoint, a
temp file and a new way for someone else's Cast to be read out of the wrong
scope. The character-sheet artifact joins it there when it ships.

### The mechanical devices

Fixing the four sites does nothing about the fifth, so:

- **`client/src/features/castingV2/imageGrammar.test.ts`** scans every casting
  source and fails CI on a `download=` attribute outside the viewer (and the
  room's one named bulk helper), on any `Maximize` import, on `onDoubleClick`,
  and on a viewer missing any of its four bindings.
- **`CandidateTile` takes a required `onOpenViewer`** — a tile that forgets the
  grammar fails to compile.
- **The viewer takes the SET**, so a caller cannot ship arrows that do nothing.
  The three near-identical modulo walks are now one.

`dockAnatomy.test.ts`'s "opens a room image large" case was **superseded in
place** — it pinned double-click and the hover row, both now defects. It defers
to the grammar lint and keeps only the promise the dock made.

---

## Item 5 — the second escape hatch

`backToSheetTopRight: false`. The breadcrumb still leaves the room; the Siblings
card still offers the sheet, with the context that makes it worth offering.

---

## Item 6 — recorded, not built

**D-104**: identity anchors WHO; takes re-enter as STYLE references. Campaign
generation feeds the identity pack plus a selected take for outfit and styling
continuity. Permanent changes are M12 revisions, never takes — a take that
quietly became canonical is the record-lies class in its most expensive form.
The choice surfaces in the UI when M12 ships, and not before, because offering
it earlier would name a capability the product does not have.

Consequence noted in the entry: the character-sheet artifact composes from the
identity pack only. A take is never composited into it.

---

## Copy audit — new and changed strings only

| String | Class | Note |
|---|---|---|
| `Download package` | invented | the bulk-ownership control |
| `Download {label}` (viewer aria-label) | invented | per-image, in the viewer chrome |
| `View {name} larger` / `View {label} larger` | invented | the affordance the expand icon used to carry |
| `Open {persona}'s room` | invented | sibling → cast |
| `Find {persona} on her sheet` | invented | sibling → sheet |
| `Look at {persona}` | prototype-verified | retained for the viewer fallback |
| `{n} / {total}` (viewer count) | invented | says the set exists, so the arrows are discoverable |
| `Back to the sheet` | **removed** | item 5 |

---

## Suite

3,960 passing, typecheck clean, build green, Atlas fresh. Commit `efbec09e`,
deployed dark.
