# THE PROMOTION AUDIT — casting's 23 against foundation's nine

**Issue #262. A written proposal, not a PR. Nothing in this document has been
moved, renamed or deleted; no code changed in the commit that carries it.**

His ruling, verbatim, and it is the whole brief:

> "I read `features/castingV2/` properly. There are 23 components and 148KB of
> CSS in there — HeroDeck, ConceptUploadCard, ConceptReviewModal,
> DeleteCastConfirm, RenameCastDialog, SignConfirm, ConfirmDialog, CardMenu. My
> briefs called casting 'the reference' meaning its look. That was too narrow:
> most of the shared parts already exist, they're just in the wrong folder.
>
> So before 00b, a written proposal — not a PR:
>
> 1. Cross-check the nine you just built against casting's 23, and against
>    `foundation/Popover.tsx`. If 00 has re-implemented something that already
>    existed, I want to know now, while it's three days old. The popover hook is
>    the likeliest collision.
> 2. List which of casting's 23 are general. A confirm dialog, a card menu, a
>    modal shell, a hero deck are app concepts that happened to be built in
>    casting first. Those get promoted into `foundation/` keeping casting's
>    behaviour, with casting importing them back. Anything genuinely about
>    faces, briefs or refinement stays.
> 3. Show me the list before anything moves."

⚠ **It arrived twelve minutes after 00b merged.** The audit is therefore partly
retrospective: §4 covers the one adoption that shipped in the gap.

---

## §0 — THE LIST, first

**Six of casting's 23 are general and should be promoted. Two more are general
in shape but carry a casting dependency and are promoted only after it is cut.
Fifteen stay.**

| | component | lines | verdict |
|---|---|---|---|
| 1 | `CastingModal` | 218 | **PROMOTE** — the modal shell. Zero casting imports. |
| 2 | `ConfirmDialog` | 121 | **PROMOTE** — a destructive confirm. Zero casting imports. |
| 3 | `CardMenu` | 208 | **PROMOTE** — the overflow menu. Zero casting imports. |
| 4 | `RenameCastDialog` | 143 | **PROMOTE as `RenameDialog`** — rename-a-thing, one noun away from general. |
| 5 | `BriefField` | 125 | **PROMOTE as `GrowField`** — an auto-growing textarea where Enter submits. Nothing in it is about briefs but the name. |
| 6 | `DeleteCastConfirm` | 140 | **PROMOTE as `DestructiveConfirm`** — type-the-name-to-delete. The desaturated portrait is a prop, not a face fact. |
| 7 | `HeroDeck` | 208 | **promote LATER** — general shape (a fanned deck + a caption moving on one index) but it imports casting's `../heroDeck` data module. Cut the data out first. |
| 8 | `ConceptUploadCard` | 361 | **promote the DROP ZONE only** — the drag-and-drop entrance is general; the describer call, the credit copy and the gating are casting's. |
| — | the other 15 | — | **STAY.** Faces, briefs, refinement, candidates, versions, paths, imagination, segments, signing. |

**And the finding he asked for in question 1, which is the one that changes the
order of operations:**

> ⚠ **EIGHT OF THE NINE COMPONENTS SEGMENT 00 BUILT HAVE ZERO PRODUCTION
> CONSUMERS.** They render only on the `/casting/foundation` specimen page.
> Only `usePopover` reached a real surface (one consumer, `LobbyUtilityMenu`,
> via 00b) and `showsMenuCount` (two).

That is not a criticism of 00 — it built a kit ahead of the surfaces that will
use it, which is what its brief asked for. It matters because it settles the
reconciliation question cheaply: **casting's implementations are in front of
customers and foundation's are not, so where the two collide, casting's
behaviour survives and foundation's three-day-old copy yields.** That is his own
instruction ("keeping casting's behaviour") and the consumer counts say it costs
almost nothing to obey.

---

## §1 — The collision table (his question 1)

Each of the nine, plus the three helpers 00 shipped beside them, against
casting's 23 **and** against what `foundation/` exported before 00.

⚠ **Searched by FILE PATH as well as by barrel export.** `Popover.tsx` is not in
`foundation/index.ts`; a search of what the barrel exports reports it as having
no consumers, which is wrong. Any component here may be reached the same way.

| # | 00's component | vs casting's 23 | vs pre-00 foundation | verdict |
|---|---|---|---|---|
| 1 | `usePopover` (182 L) | **`CardMenu.tsx:1–208`** — portal, viewport placement, re-place on scroll/resize, Escape, outside pointerdown | **`Popover.tsx` (168 L)** — one-open-at-a-time, full keyboard, arrow walk | ⚠ **DUPLICATE ×3** |
| 2 | `MediaCard` (89 L) | **`CandidateTile.tsx`** — partial: same grammar (4:5 well, caption below, kept accent, skeleton-then-swap) | **`MediaFrame` + `Card`** — partial: `MediaCard` renders its own `<img>` in its own `dp-mediacard__well` and does **not** compose `MediaFrame` | ⚠ **PARTIAL ×2** |
| 3 | `HoverActions` (32 L) | `CardMenu`'s reveal ladder is a *trigger* reveal, not an action row | none | **no collision** |
| 4 | `SurfaceBar` (49 L) | none — casting's top chrome is the page shell's | `Dock` is the *bottom* dock; `SectionHead` is an eyebrow | **no collision** |
| 5 | `DataTable` (54 L) | none — casting renders no table (`<table>`: 0 hits) | none | **no collision** |
| 6 | `ExpandableRow` (63 L) | none | none | **no collision** |
| 7 | `CostedOption` (31 L) | **adjacent** — `SignConfirm.tsx:115` and `RefinePanel.tsx:1077` are two hand-built *cost lines*; a cost line is not a costed choice | `CreditsChip` shows a figure, not a choice | **adjacent, see §1a** |
| 8 | `MilestoneRail` (41 L) | none (3 "milestone" hits in casting are all prose in comments) | `Progress` — a single-value bar against a weighted segmented rail | **adjacent** |
| 9 | `Transcript` (40 L) | none — `BriefEcho` is a chip row, not a two-speaker record | none | **no collision** |
| 10 | `Marquee` (30 L) | none (0 hits) | none | **no collision** |
| 11 | `severityLook` | none | none | **no collision** (its own declared deviation stands — nine staff call sites still render `SEVERITY_COLORS`; that is #260, not this) |
| 12 | `showsMenuCount` | none | none | **no collision** |

**So: one true duplicate, two partials, one adjacency worth naming. The rest of
the nine are clean.** His prediction — *"the popover hook is the likeliest
collision"* — was right, and it is worse than he guessed by one.

### §1a — The one adjacency worth a line

`SignConfirm` and `RefinePanel` each build their own "~N credits" line by hand.
Two copies of a money display is the shape that becomes three. It is **not**
`CostedOption` (which is a *selectable option carrying its price*, and casting
under D-109 states cost as metadata beside the action, never on it). The right
answer is a small `CostLine` primitive later, not a promotion now. **Filed as a
note, not proposed as work.**

---

## §2 — The promote / stay split of the 23 (his question 2)

His test, applied one line each: *an app concept that happened to be built in
casting first is promoted; anything genuinely about faces, briefs or refinement
stays.*

### PROMOTE — 6 now

| component | consumers today | why it is general |
|---|---|---|
| **`CastingModal`** | 3 | Its own docblock calls it *"the shell the sign, delete and concept-review dialogs share"* — a 664px two-column card with a portrait, wrapping below 560px. Nothing in it knows what a cast is. |
| **`ConfirmDialog`** | 1 | *"A destructive confirmation, in our own voice."* It replaced `window.confirm`. The reasoning in its docblock is app-wide, not casting-wide. |
| **`CardMenu`** | 2 | *"THE overflow menu. One component, one behaviour, everywhere."* Written to end three copies inside casting; it is now one of three copies across the app. |
| **`RenameCastDialog`** | 1 | Rename-a-thing with the field the old one was missing. The only casting fact is the word "Cast" in its copy. |
| **`BriefField`** | 2 | An auto-growing textarea where Enter submits, Shift+Enter newlines, and an IME composition guard stops a Japanese/Chinese/Korean customer spending credits by committing characters. Every long-text box in the redesign needs exactly this and none of them will reinvent the guard. |
| **`DeleteCastConfirm`** | 2 | Type-the-name-to-delete, with `PERMANENT · NOT REFUNDABLE` in the eyebrow. The desaturated portrait is a **prop**; the ceremony is general. |

### PROMOTE LATER — 2, each blocked on one cut

| component | what blocks it |
|---|---|
| **`HeroDeck`** | Imports `SHOWCASE_DECK`, `deckOffsets`, `entryAt`, `HeroDeckEntry` from `../heroDeck`. The *deck* is general; the *showcase* is casting's. Promote the renderer, leave the data. |
| **`ConceptUploadCard`** | Only its drop zone is general. The rest is the describer road — bytes, gating, credit copy, `pictureBytes`, `failureCopy`. Extract `DropTarget`, leave the card. |

### STAY — 15

`BriefEcho` (brief chips), `CandidateTile` (a candidate's streaming arrival),
`CandidateViewer` (the compare surface), `CastSettingsModal` (style +
imagination), `ConceptReviewModal` (the describer's review step), `FacePanel`,
`FaceRegions`, `SegmentsOnFace` (faces), `ImaginationToggle`, `PathToggle`
(casting settings), `KeptTray` (the shortlist before a Sign), `RefinePanel`
(refinement, 1,084 lines), `SignConfirm` (signing), `VersionRail` (versions of a
face), `faceSelection.ts` (selection maths).

Each is *genuinely about faces, briefs or refinement* by his own wording. Two
are worth one sentence of caution:

- **`CandidateTile` stays but should COMPOSE the promoted `MediaCard`**, not be
  promoted itself. It already imports `Button` and `Skeleton` from foundation,
  so the direction is established.
- **`SignConfirm` stays but owns the shell's CSS prefix.** See §3.

---

## §3 — How much of the 148 KB moves (his question 3)

**148,226 bytes, 4,759 lines, one file.** And the answer runs the *opposite* way
to the card's worry that a single-file stylesheet makes the split hard:

> **96.9% of it (143,585 B) is attributable to a single `.dpc-<prefix>` block by
> its selector.** Only 4,641 B (3.1%) is comments, `@media` wrappers, keyframes
> and non-`dpc` selectors. **The split is mechanical.**

Per promoted component (measured, `scripts/_shift117-cssweight-disposable.mts`):

| promoted component | prefix(es) | bytes | % of file |
|---|---|---|---|
| `CardMenu` | `.dpc-cardmenu` + `.dpc-menuhost` | **5,008** | 3.4% |
| `ConfirmDialog` | `.dpc-confirm` | **2,553** | 1.7% |
| `RenameCastDialog` | `.dpc-renamem` | **2,311** | 1.6% |
| `BriefField` | `.dpc-brieffield` | **1,044** | 0.7% |
| `HeroDeck` (later) | `.dpc-deck` | **5,885** | 4.0% |
| `ConceptUploadCard` (later) | `.dpc-entry` | **2,661** | 1.8% |

### ⚠ The one hard case, and it is a finding about the CSS rather than the components

**`CastingModal` and `DeleteCastConfirm` both live in `.dpc-signm` — 16,572 B
named after `SignConfirm`, its first consumer.** Six components draw on it. Split
by which component names each class (zero bytes unclaimed):

| bytes | named by |
|---|---|
| 5,915 | `CastingModal` alone — **the shell proper** |
| 5,995 | shared vocabulary — classes named by the shell *and* its consumers |
| 3,121 | `ConceptReviewModal` alone |
| 1,541 | `DeleteCastConfirm` alone |

So promoting the shell moves **5,915 B of its own plus a 5,995 B vocabulary its
consumers also name**. A shell promoted without that vocabulary leaves five
casting components naming classes that live in another file — which is exactly
the "a component promoted without its CSS looks different in its new home"
failure the card names, in its precise form.

**The finding underneath it: the shared shell's CSS is named after its first
consumer.** `.dpc-signm` should have been `.dpc-modal` the day `CastingModal`
was extracted. That is a rename inside casting, cheap today, and it is the
prerequisite that makes the shell's promotion a clean move rather than a
negotiation. **It is proposed, not done.**

---

## §4 — Reconciliation of each duplicate (and the adoption that shipped in the gap)

His rule governs: *not automatically the newer one*; behaviour is preserved from
whichever copy is in front of customers.

### The popover, three owners, 558 lines

| owner | lines | consumers | standing |
|---|---|---|---|
| `CardMenu` | 208 | **2** (`CastingRoom`, `CastingV2`) | production; customers use it daily |
| `Popover.tsx` | 168 | **1** (`BriefEcho`, by direct path — not in the barrel) | production, one surface |
| `usePopover` | 182 | **1** (`LobbyUtilityMenu`) | **three days old** |

**Recommendation: `CardMenu`'s behaviour survives; it is promoted as the
foundation's menu, and `usePopover` becomes its hook rather than a third
owner.** `CardMenu` is the only one of the three with more than one consumer,
the only one carrying a founder ruling in its behaviour (the 2026-08-03 reveal
ladder), and the only one whose loss a customer would feel. `Popover.tsx`'s
arrow-key walk is the one capability the other two lack and is kept.

⚠ **And 00b's adoption must be named rather than treated as settled because it
merged first.** `LobbyUtilityMenu` now runs on `usePopover` — the three-day-old
third implementation — while casting keeps `CardMenu`. That is the drift his
ruling predicted, and it happened in the twelve minutes between his card and the
merge. **It is one file and one consumer**, so re-pointing it is small whatever
he rules. **Recommendation: the account menu moves to the reconciled component.**

⚠ **One behaviour must not be lost in the move, and it has already bitten once.**
`usePopover` owns four of the five ways a panel closes; when 00b adopted it, the
form reset hanging off the *old* handler was orphaned with no compile error and
no failing test (found at the running app, fixed in the same PR). **Any
reconciliation of these three must re-check what local state hangs off each
handler it replaces.**

### `MediaCard` vs `MediaFrame`

`MediaCard` re-implements the image well instead of composing `MediaFrame`.
`MediaFrame` has **one consumer, the specimen page** — no production standing at
all. **Recommendation: `MediaCard` composes `MediaFrame`, or `MediaFrame` is
retired into it.** Both are foundation's own; neither is in front of a customer;
this is the cheapest of the three and should be settled before either gets a
consumer.

### `MediaCard` vs `CandidateTile`

Not a duplicate to resolve — `CandidateTile` composes the promoted `MediaCard`
and keeps its streaming, keep/discard and cancelling behaviour on top.

---

## §5 — What breaks on the way (his question 5, import churn and cycles)

**The direction already exists.** Casting imports foundation at **six** sites
today (`CandidateTile`, `CastSettingsModal`, `ImaginationToggle`, `PathToggle`,
`RefinePanel`, `BriefEcho`). Promotion adds more of the same edge; it creates no
new direction.

**Cycle risk on the six PROMOTE-now components: none, and it is measured rather
than assumed.**

| component | its imports |
|---|---|
| `CardMenu` | `react`, `react-dom`, `lucide-react` |
| `ConfirmDialog` | `react`, `react-dom` |
| `CastingModal` | `react`, `react-dom` |
| `BriefField` | `react`, `@/hooks/useComposition`, `@/lib/utils` |
| `RenameCastDialog` | `react`, `react-dom`, `@shared/inputLimits` |
| `DeleteCastConfirm` | `react`, `lucide-react`, `./CastingModal` |

**FIVE of the six import nothing from `features/castingV2` at all**, and the
sixth imports only the shell that is being promoted alongside it. There is no
cycle to untangle on this set.

⚠ **`BriefField` is a stronger promotion than its size suggests.** It carries an
IME composition guard — on a page where Enter dispatches a **160-credit roll**, a
Japanese, Chinese or Korean customer pressing Enter to *commit their characters*
would otherwise spend the credits. Every future long-text box in the redesign
needs that, and none of them will rediscover it.

⚠ **And one structural oddity found on the way: `RenameCastDialog` uses the
shell's `.dpc-signm` CSS but does NOT import `CastingModal`** — it builds its own
portal and borrows the shell's classes. So the shell's CSS already has a consumer
the shell itself does not know about. This is a second, independent reason the
`.dpc-signm` → `.dpc-modal` rename in §3 should happen before anything moves.

**The two PROMOTE-LATER components are exactly the ones that would create a
cycle** — `HeroDeck` → `../heroDeck`, `ConceptUploadCard` → `../pictureBytes`,
`../failureCopy`, `../conceptUpload`. That is why they are second, and it is the
whole reason for the split.

**The rule that must hold: `foundation/` never imports `features/`.** It is true
today. Every promotion must keep it true, and it is worth a guard arm the day the
first component moves.

**Churn, if he approves the six:** 10 import sites rewritten to `@/foundation`,
6 files moved, ~11 KB of CSS relocated plus the `.dpc-signm` → `.dpc-modal`
rename inside casting. No behaviour change is intended anywhere.

---

## §6 — Corrections to this card's own earlier reading

Working law 1 — the card's comment is a claim; these were read at the artifacts.

1. ⚠ **`CardMenu` has TWO consumers, not three.** The comment listed
   `CandidateViewer.tsx` as the third. `CandidateViewer` names `CardMenu` **only
   in a comment** (line 562, describing why the viewer does not clip it). It
   imports nothing. This is the same class the previous shift hit twice in one
   day — *a source read that counts a comment as a fact* — and it is worth
   stating because it makes `CardMenu`'s standing slightly weaker than the card
   claimed, and `CardMenu` still wins §4 on every other ground.
2. **`CastSettingsModal` has 2 consumers, not 0.** A first probe keyed on the
   filename and missed it: the module's export is `CastSettingsButton`. Named
   here because the same probe shape would have reported a live component as
   dead.
3. **`.dpc-delete`, `.dpc-concept` and `.dpc-settings` are not classless CSS
   blocks** — they are DOM `id` attributes. Chased and cleared, so the next
   reader does not chase them again.

---

## §7 — Limits of this audit, stated

- **Scope is his three questions.** The nine, casting's 23, and pre-00
  foundation. It is not an app-wide component audit.
- ⚠ **But the popover sprawl is app-wide and larger than three.** **Thirty**
  files across the client own their own Escape handling, and `boards/` has its
  own menu family (`NodeContextMenu` 241 L, `SpawnMenu`, `GroupContextMenu`,
  `AddNodeMenu`). **This audit does not propose touching them** — that is a
  finding for a later segment, filed here so it is on the record and not
  rediscovered.
- **No runtime measurement.** This is a source reading. Nothing was driven at the
  running app because nothing is proposed to move yet.
- **The 15 STAY verdicts are one line of reasoning each**, as the card asked. If
  he disagrees with any of them, the disagreement is about his own test, not
  about a measurement.

---

## §8 — The bars this document keeps

- **Nothing moved. Nothing was deleted. No PR opened.**
- The two disposable measuring scripts are named where their numbers appear.
- **The lobby lane stays STOPPED.** This is the proposal his order placed
  *before* 00b, delivered late; it is not a segment and does not restart the
  lane.
