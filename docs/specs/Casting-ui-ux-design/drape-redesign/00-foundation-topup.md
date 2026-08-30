# 00 — Foundation top-up

**Ships nothing visible. Unblocks everything after it.**

## What this section is

The repo already describes these as *patterns*, in `../design_handoff_studio/10-shared-patterns.md` (sibling of this folder). This section turns them into *React components* in `client/src/foundation/`, once, so no surface invents its own. It also adds four keyframes and the one CSS rule that cannot be expressed inline.

**Read `10-shared-patterns.md` first.** It is the visual spec for six of the nine components below; this brief gives the API and the bugs, not the look. Where they disagree, that doc wins.

**Excluded:** any change to an existing primitive's API, any surface work, any new token colours. The token set is already correct — it needs no additions.

## Files

**Read first**
- `../design_handoff_studio/10-shared-patterns.md` — the grammar. Read before the API below.
- `client/src/foundation/tokens.css` — the token set. Already correct.
- `client/src/foundation/primitives.tsx` — what exists: `Button Card Chip CreditsChip DerivedChip Dock DropZone EmptyState Field GradientTile IconButton Input Instruction MediaFrame Progress RequiredMarker ScopePill SectionHead Skeleton StatusPill`.
- `client/src/foundation/foundation.css` — where class-based rules live.
- `client/src/foundation/token-guard.test.ts` — the no-hex rule. Extend its allow-list only if genuinely needed; prefer not needing it.

**Change**
- `client/src/foundation/primitives.tsx` — add the components below.
- `client/src/foundation/foundation.css` — add the keyframes and the hover rule.
- `client/src/foundation/index.ts` — export the new components.
- `client/src/foundation/tokens.css` — the three additions in §5.

**Leave alone**
Every page and feature. This section touches no surface.

## 1. The hex → token map

Every colour in the prototype resolves to a token. Use this when reading values out of it.

| Prototype literal | Token |
|---|---|
| `#FFFFFF` (surface) | `--surface` |
| `#FAFAFB` | `--raised` |
| `#FCFCFD` | `--page` |
| `#F6F6F8` | `--well` |
| `#F4F4F6` | `--fill` |
| `#F2F2F4` | `--fillStrong` |
| `#F1F1F3` | `--media` |
| `#F0F0F2` | `--rule` |
| `#ECECEE` | `--border` |
| `#E8E8EB` | `--borderMedia` |
| `#E6E6E9` | `--borderInput` |
| `#E4E4E7` | `--borderCard` |
| `#DEDEE2` | `--dots` |
| `#DADADE` | `--dotsStrong` |
| `#D6D6DA` | `--dashed` |
| `#C8C8CC` | `--lineStrong` |
| `#B4B4BA` | `--muted` |
| `#A0A0A6` | `--faint` |
| `#8E8E94` | `--meta` |
| `#6B6B70` | `--metaStrong` |
| `#3E3E42` | `--secondary` |
| `#111112` | `--ink` |
| `#E2685A` | `--accentSolid` |
| `rgba(17,17,18,.62)` | `--scrimChip` |
| `rgba(17,17,18,.72)` | `--scrimPill` |
| `rgba(0,0,0,.66)` | `--scrim` |
| `#FFFFFF` on a scrim | `--onScrim` |
| `#C0473A` | `--error` |

The prototype's `rgba(17,17,18,.66)` snaps to `--scrimPill`. It was an inconsistency, not a third value.

## 2. New primitives

Each one below appears on three or more surfaces. Nothing else earns a place in the foundation.

### `MediaCard`

**Grammar:** `10-shared-patterns.md` → *Media card*. The single most reused thing in the redesign — Library, Assets, Home, Casting, Templates, Cinema, Crew.

```tsx
<MediaCard
  ratio="4/5"            // "4/5" | "16/9" | "1/1" | "16/10" | "2.39/1"
  src={frame.url}
  alt="Rooftop, overcast"
  badge="IMAGE"          // optional pill, top-left, over the media
  corner={<BrandDot />}  // optional, bottom-right
  label="Rooftop, overcast"
  meta="09:41"           // mono, right of the label
  actions={[…]}          // optional hover row, see HoverActions
  state="default"        // "default" | "kept" | "pending" | "gap"
  onClick={…}
/>
```

Beyond the grammar doc, three things it must enforce:

- **Label row below the media, never over it.** A filled slot's caption centres in the card, which on a short 4:3 is exactly where a bottom overlay's text lands. This collided in the prototype and is why the rule is absolute.
- `state="kept"` adds a 3px `--accentSolid` bar along the bottom of the media plus an accent pill — the only accent a card ever carries.
- `state="gap"` swaps the media for a dashed `--dashed` box with a plus glyph and a mono `NEEDED` label. This is the *dashed create tile* pattern generalised; it also covers "New canvas" / "New cast member" / "Upload", which must stay **first** in every collection grid so the create action never hides behind eight items.

### `HoverActions`

**Grammar:** `10-shared-patterns.md` → *Hover reveal*. A row of icon buttons revealed by hovering **the card**, not the row itself.

```tsx
<HoverActions items={[{ icon: <Download/>, title: "Download", onClick }]} />
```

Requires the CSS rule in §3 — parent-hover cannot be expressed inline. The prototype originally put `:hover` on the action row, so the buttons only appeared once the cursor was already inside the thin strip at the bottom of the card. That is the bug this component exists to prevent.

Standard set, in order: **Use as reference · Download · Copy image · Save to assets**, with an optional right-aligned mono meta (kind · ratio · time).

### `SurfaceBar`

**New — not in the handoff.** The bar at the top of a full-height working surface. Used by Cinema (production bar) and by staff (ops bar). One component, two consumers.

```tsx
<SurfaceBar
  eyebrow="ADMIN"
  title="Klieg Studio — everything"
  segments={{ value, options, onChange }}   // the view/tab switch
  meta={<>updated 07:14</>}
  right={<Button variant="primary">3 to decide</Button>}
/>
```

- `flex-wrap: wrap`, `gap: 12px 16px`, `padding: 13px 24px`, bottom `1px --border`, background `--surface`.
- **The title column takes `min-width: 0` and ellipsis; the meta cluster takes a `min-width` floor and may wrap; the spacer is `flex: 1 1 0` with `min-width: 0`.** Four separate overflow bugs in the prototype came from getting this wrong — the last one put the primary action fully off-screen at 924px. Never `overflow-x: auto` on this bar; a header behind a horizontal scroll is a control nobody finds.

### `DataTable` + `ExpandableRow`

**New — not in the handoff.** Staff surfaces only, but they replace five modals, so they belong here.

```tsx
<DataTable
  columns={[{ label: "SEVERITY", width: "0 0 104px" }, { label: "ACTION", width: "1 1 0" }, …]}
  rows={rows}
  footer={{ meta: "7 of 4,471 entries", onNext, onBack }}
/>
```

- Header row: `--well` background, `500 8.5px JetBrains Mono`, `.1em`, `--faint`.
- Rows: `11px 15px` padding, `1px --ruleSoft` divider, hover `--well`, open row stays `--well`.
- Columns are flex strings, not a grid — a fixed `0 0 104px` for pills and stamps, `1 1 0` for the one column that gives way.
- `ExpandableRow` opens **in place** with: a fact grid (`repeat(auto-fit, minmax(168px,1fr))`, mono values), an optional plain-English evidence paragraph on `--well`, and an action row. This is what replaces `UserDetailModal`, `AuditLogDetailModal`, `LogDetailModal`, `ReviewModal` and `ChangeRequestDetail` for read-and-decide flows. Keep modals only where a form must be filled.

### `CostedOption`

**New — not in the handoff.** A choice with its consequence priced. Crew decisions, run scopes, model picks.

```tsx
<CostedOption
  optionKey="TAKE"
  label="Ship looks only"
  costs={[{ sign: "−", text: "3 items out of M4" }, { sign: "!", text: "per-garment moves to M5" }]}
  onClick={…}
/>
```

Sign colours: `+` → `--ink`, `−` → `--metaStrong`, `!` → `--errorInk`, `=` → `--faint`. A decision with no stated consequence is a conversation, not a decision — this component is the mechanism that stops us shipping the former.

### `MilestoneRail`

**New — not in the handoff.** Crew only today, but it is the shape of any plan-progress display we add later.

```tsx
<MilestoneRail milestones={[{ id: "M3", name: "Shelf + composer", weight: 5, done: 6, total: 9 }]} held={false} />
```

- Segment width is `flex: weight` — **proportional to milestone size, not equal**. Equal segments lie about where the work is.
- Closed: `--lineStrong` fill. Current: `--ink` fill (or `--muted` when the lane is held). Not started: transparent with `inset 0 0 0 1px --dashed`.

### `Transcript`

**New — not in the handoff.** Two-speaker conversation record. Crew today.

```tsx
<Transcript entries={[{ who: "you", when: "07:14", body: "…", ref: { kind: "RULING", text: "M4 gains an item" } }]} />
```

- Speaker column **80px** — `"night shift"` needs 69.3px at 10.5px mono and clips at 64px. Do not shrink the font to fit; 10.5px is the mono floor.
- The user's own entries: `500` weight, `--ink`, solid `--ink` spine. Others: `400`, `--secondary`, `--rule` spine.

### `Marquee`

**Grammar:** `10-shared-patterns.md` → *Motion vocabulary* (`dsmarq`), and `05-canvas-tab.md`. Auto-scrolling row, Canvas tab header.

```tsx
<Marquee items={…} itemWidth={172} gap={14} duration={62} pauseOnHover />
```

**The animated track must carry no padding and no `gap`** — `translateX(-50%)` has to equal exactly one copy's stride, so items space themselves with `margin-right` and the inset lives on the wrapper. Getting this wrong produces a visible jump every loop. Fade edges are `--page` → transparent, 36px.

## 3. `foundation.css` additions

```css
/* Parent-hover reveal — cannot be inline; the whole reason HoverActions exists. */
[data-hoverhost] [data-hoverfade] { opacity: 0; transition: opacity .14s; }
[data-hoverhost]:hover [data-hoverfade] { opacity: 1; }

@keyframes dp-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
@keyframes dp-slidein { from { opacity: 0; transform: translateX(-14px) scale(.94) } to { opacity: 1; transform: none } }
@keyframes dp-pop     { 0% { transform: scale(1) } 45% { transform: scale(1.18) } 100% { transform: scale(1) } }
@keyframes dp-prog    { from { width: 12% } to { width: 84% } }
```

`dp-slidein` is for a kept take arriving in the cut strip; `dp-pop` for the star that sent it there. They are one gesture in two halves and should stay a matched pair.

## 4. Retire the colour constants

`features/admin/adminConstants.ts` and `features/moderator/moderatorConstants.ts` each export `SEVERITY_COLORS` and `CATEGORY_COLORS` as Tailwind tint classes. Both are replaced by one helper in the foundation:

```ts
export function severityLook(sev: "info" | "warning" | "critical")
```

- `critical` → border `--error`, background `--surface`, text `--errorInk`
- `warning` → border `--borderInput`, background `--fill`, text `--metaStrong`
- `info` → border `--rule`, background transparent, text `--faint`

Category is carried by the mono action string (`stripe.refund.manual`), not by colour. Delete `CATEGORY_COLORS` rather than porting it.

Keep `formatDate`, `formatFullDate`, `formatRelativeTime`, `getActionCategory`, `formatAction`, `PAGE_SIZE`. They are fine.

## 5. Two rules already written down — enforce them in code here

`10-shared-patterns.md` ends with two hard-won rules. Section 00 is where they stop being prose:

- **Popover discipline** — capture-phase click-away on a data-marker, Escape closes, fixed panels measure their trigger *and* correct for containing-block ancestors, close on outside scroll but never on internal scroll. Put this in one `usePopover` hook rather than in each dropdown. The prototype's model picker was clipped by an ancestor's `overflow:hidden` until it went `position:fixed`; a hook makes that unrepeatable.
- **Aspect-ratio sizing** — `container-type: size` on the pane, then set ONE axis derived from the other (`width: min(cap, 100cqh × ratio); height: auto; aspect-ratio: R`). Never pin one axis and cap the other; `aspect-ratio` only resolves an *auto* axis. Bake this into `MediaFrame`/`MediaCard` so no surface has to remember it.

## 6. `tokens.css` additions

Only if not already present — check before adding:

- `--r-2xl: 14px` through `--r-chip: 7px` — already there.
- Nothing else. **The token set does not need new colours.** If a section brief seems to need one, that is a signal the design is wrong, not the tokens.

Do add the canvas layer as its own file if it is not already loaded: `client/src/styles/canvas-tokens.css` holds `--cv*`. Cinema (section 10) consumes it.

## What NOT to do

- **Do not restate `10-shared-patterns.md` in code comments.** Link to it.
- **Do not port the prototype's inline styles.** They exist so the design paints while streaming; in React they are noise.
- **Do not add a component here that only one surface uses.** `GapTile` is arguably one of these — it is folded into `MediaCard` as `state="gap"` for that reason.
- **Do not extend `token-guard.test.ts`'s allow-list** to let a component keep a hex. Fix the component.
- **Do not touch `Rail.tsx`.** Cinema is not in `RAIL_DESTINATIONS` and adding it is section 10's decision, taken deliberately — the rail's own rule is that it never changes shape.
- **Do not change `DEFAULT_THEME`.** Light is a founder ruling (2026-07-30) that holds until every surface follows tokens. Section 11 is when to revisit.

## Definition of done

- [ ] `MediaCard`, `HoverActions`, `SurfaceBar`, `DataTable`, `ExpandableRow`, `CostedOption`, `MilestoneRail`, `Transcript`, `Marquee` exported from `foundation/index.ts`.
- [ ] Four keyframes and the parent-hover rule in `foundation.css`.
- [ ] `severityLook` in the foundation; `SEVERITY_COLORS` and `CATEGORY_COLORS` deleted from both constants files.
- [ ] `token-guard.test.ts` passes with no new allow-list entries.
- [ ] `usePopover` hook exists and the containing-block correction is in it, not in a component.
- [ ] A stories/dev route renders every new primitive in both themes.
- [ ] `SurfaceBar` verified at 924px: no child clipped, `documentElement.scrollWidth === clientWidth`.
- [ ] `Marquee` verified: no visible jump at the loop point.
- [ ] `Transcript` speaker column verified at 80px with the string `"night shift"`.
- [ ] **No visible change to any existing page.** If a surface moved, something in this section overreached.
