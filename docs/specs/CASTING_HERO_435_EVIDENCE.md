# Section 10 — casting hero column + Cast settings modal: what was measured

**Card:** #435. **Brief:** `docs/specs/Casting-ui-ux-design/drape-redesign/10-casting-hero-and-settings.md`.
**Driven:** 2026-09-03, worktree dev server on :3021, dev database, verify-bot session.
**Money:** $0 — no roll fired, no credit moved, no paid call.

His words filing it: *"the issue with our current one is its not balanced and just feels poorly designed."*

---

## 1 · His definition of done, arm by arm

Every one of these was READ IN THE RUNNING APP, not inferred from the source.
Two of them are his own unusual arms and are marked.

### Hero column

| his arm | measured |
|---|---|
| structure is pitch / spacer / ask | ✅ `.dpc-hero__pitch` + `.dpc-hero__air` + `.dpc-hero__ask`; `justify-content` on the column is `normal`, not `center` |
| the column no longer floats | ✅ copy column and deck are both **424px** — the air holds **91.5px** in the middle rather than ~46px at each end |
| headline 37px, both sentences | ✅ computed `500 37px/1.05`, `-0.042em`; *"Say who you need. / Meet eight of them."* |
| one row at rest, no scroll widget | ✅ **`scrollHeight` 27 === `clientHeight` 27, `overflowY: "hidden"`, `rows=1`** — his exact probe |
| grows, then scrolls at the cap | ✅ 27 → 46 → 105 → **131.9px (the cap)**, and only there does `overflowY` become `auto` with `scrollHeight` 144 > `clientHeight` 132 |
| returns to rest when cleared | ✅ back to 27px and `hidden` |
| placeholder is one line | ✅ `a fitness creator in their 30s, close-cropped hair` — one line at the 576px column |
| `Cast it` stays baseline-aligned | ✅ button bottom sits **12px** above the field bottom at rest AND at the cap (415.3/427.3, 421.6/433.6) |
| receipt line, all three derived | ✅ `8 CANDIDATES · ~160 CR · ~50 SECONDS`, every value from the config payload |
| settings control: no chevron, radius 8, mono value | ✅ `--r-sm`, no chevron in the button, `Photoreal · Low` from `castSettingsSummary` |
| `Start from photos` opens the concept flow | ✅ opens the dialog on its drop zone: *"UPLOAD A CONCEPT / Start from a picture / Drop a picture in…"* |
| no TRY chips, no count selector | ✅ absent |

### Modal

| his arm | measured |
|---|---|
| two columns, no nav | ✅ Style `flex: 1 1 372px`, Imagination `flex: 1 1 296px` on `--raised` with a `--rule` left border |
| card `height: 100%` / `max-height: 524px` | ✅ 476px tall in a 540px window; content-sizing never happens |
| the action is never inside a scrolling region | ✅ `Done` is **not** a descendant of `.dpc-setm__body`; head and foot are `flex: none` |
| carousel: three cards, arrows on the stage, caption on the centre card, coming styles dashed with COMING SOON | ✅ all four |
| ⚠ **step all three styles — the centre card must not change size** | ✅ **158.75px on every one of six readings across two full laps.** `descH` 38, `actH` 26, `stageH` 221.61 — all constant |
| action resolves to exactly one of three | ✅ `IN USE` / `Use {name}` / `Not available yet — we'll say when it lands.` |
| imagination: two cards, both lines, DEFAULT on Low | ✅ |
| `Reset all` only when off defaults | ✅ absent at defaults → **present after picking Max** → returns to `photoreal` + `low` → **absent again** |
| scrim rect equals the viewport | ✅ `{0, 0, 1434, 900}` = `documentElement.clientWidth/Height`. ⚠ `innerWidth` reads 1440 because it counts the scrollbar — the arm passes against the right comparand and fails against the wrong one |
| ⚠ **check at 540px viewport height specifically** | ✅ card 476px inside 540, `Done` visible, no overflow in either axis, the stage absorbed the loss (221.6 → **173.6px**, centre card 158.75 → 119.4) |
| Escape and scrim-click dismiss | ✅ both |
| both themes, `token-guard` passing | ✅ frames below; `token-guard` green |

---

## 2 · ⚠ Where his brief and the codebase disagreed — five, and each was decided rather than followed

§2b's whole point: a brief is authoritative on LOOK and cannot know the code.

**1 · `4 CR` is not what a roll costs.** The brief writes `8 CANDIDATES · 4 CR · ~40 SECONDS` and supports it with *"The sheet's own `Cast eight` says `4 cr`"*. There is no `Cast eight` string in this repository, and the sheet renders `~ {price} credits` from `CASTING_V2_ROLL_PRICE_CREDITS` — **160**. His own rule for the line settles it: *"A hand-written price that disagrees with the charge does the opposite of what this line is for."* **The line derives and reads 160.**

**2 · The duration had no constant at all, so it was MEASURED.** Read on production, `generation_operations` where `kind = 'castingV2.roll'`, **n = 234 completed rolls**:

```
min 35s · p25 42s · MEDIAN 47s · p75 53s · p90 64s · max 359s · mean 57.6s
```

His `~40` is optimistic — the fastest roll on record is 35s and better than three quarters of them overrun 40. **50 ships**: the nearest five-step at or above the median, so the median and everything under it beat the number a customer was given. The constant carries that reading and its date (`server/castingV2/rollDuration.ts`), because a figure like this goes stale silently.

**3 · ⚠ The modal already existed, and it carries a behaviour the brief does not know about.** `CastSettingsModal.tsx` has been live since #142. Its `followHeld` branch (#177 Row A) replaces the imagination half with a sentence during a standing follow, because an anchored roll never calls the author. **§3d writes "two cards" unconditionally — following it literally would have put a dead control back on the exact surface a founder ruling removed one from.** Preserved, and pinned by an arm.

**4 · ⚠ The glyph his brief names is banned by a guard standing on his own ruling.** §2e asks for *"the sliders mark (`P.filters`)"*. There is no `filters` key; the glyph he means is `P.settings`, and `foundation/icons-guard.test.ts` forbids it in every client `.tsx` on the strength of **#373** (*"i want to change the setting icon at the bottom of the rail to a cog — this looks more like a filter icon"*). That guard's own docblock records the near-miss that widened it: **brief 04 §2b instructed this same key**.

The two rulings may well reconcile — his #373 objection is to a filter mark standing for the APP's settings, and this chip tunes THIS ROLL — **but that is his call, so nothing here reinterprets it.** The chip keeps lucide's `Settings2`, which is the same two-slider drawing, already on this control. **One word from him flips it.**

**5 · ⚠ Two founder instructions meet on the brief box and they disagree.** §2c asks for `rows="1"` and `max-height: 84px` (~4.3 lines). **#375 set this box on his order** — *"to balance the space we could maybe make the prompt box slightly bigger"* — and the measurement filed with it shows briefs of his own stated length (250–350 characters) scrolling at a four-line cap **at every width tested**, and at 1024px even the 250-character one.

Brief 10 is the newer word (2026-09-02, a day after #375 closed, written looking at the current hero) and §2a's structure needs a compact resting state. So: **the resting height is brief 10's, the CAP is still #375's measured seven lines.** Each instruction taken where it is strongest, neither regressed, and the choice is on the card for him to overturn.

---

## 3 · Three things found by looking, that no test asked about

**1 · The override rule was printed twice, one glance apart.** `CAST_STYLE_LINES.photoreal` ended *"Anything your brief says about the look, light or setting overrides it."* and brief 10's new footer says *"These are defaults — anything your brief says about the look, light or setting overrides them."* **The duplication did not exist before this PR — the footer created it.** The footer owns the rule now, because it is true of both settings rather than of the style alone; the style line keeps its descriptive half. Recorded in `shared/castStyles.ts` so it is restored if the footer ever goes.

**2 · My own guard caught my own auto margin.** `.dpc-setm__mindtop .dpc-setm__inuse { margin-left: auto; }` pushed the IN USE pill right inside an imagination card. His §4 bans `margin: auto` on this whole surface; the arm fired on its author within a minute of being written, and it is a spacer element now.

**3 · The token guard caught a raw colour and two issue numbers.** The caption's scrim gradient was `rgb(0 0 0 / 62%)` — `--scrim` is this system's own bottom-gradient end and is what ships. And `#435`/`#177` in two test titles are valid three-digit hex, which is why that guard says what it says.

⚠ **And one thing I first measured wrong, kept because the correction is the lesson.** The first carousel reading had the centre card at **157.16px then 158.75px** and looked like his size-stability arm failing. It was the modal's 0.22s open animation: I measured the first card before the card had finished arriving. At rest it is 158.75px on all six readings. **A reading taken during a transition is not a reading of the thing.**

---

## 4 · The promotion pass (§6, `PROMOTION-PASS.md`)

Counted as his rule requires — **real consumers in the code, never surfaces in a design** (his own correction, #262: *"From here: two real consumers in the codebase, or it waits."*).

| device | real consumers | verdict |
|---|---|---|
| the fanned card deck (stage + 3-card fan + `container-type: size` + tilt) | **2** — `.dpc-deck` (HeroDeck) and `.dpc-setm__*` (this carousel) | **meets the bar → carded, not done here** |
| mono label + `flex: 1` hairline | **2** — `.dpc-deck__head/__rule` and `.dpc-hero__receipt/__receiptrule` | **meets the bar → carded, not done here** |
| `.dpc-hero__*` column parts, `.dpc-setm__*` shell | 1 each | stays |
| `ConceptUploadHandle`, `CASTING_V2_ROLL_TYPICAL_SECONDS` | 1 each | stays |

⚠ **His brief says the fan has THREE consumers — "the casting hero, the templates run modal, and this style carousel". The templates run modal does not exist in this codebase.** That is the error his #262 ruling names by name, appearing again: counting surfaces in the design rather than consumers in the code. **Two is still his bar, so the promotion is warranted on the corrected count** — and it is a separate PR by `PROMOTION-PASS.md`'s own rule (written card first, one PR, no behaviour change), because making one component serve both fans needs a rewrite, and *"if a promotion needs a rewrite to be general it is not ready."*

---

## 5 · Frames

Both themes, and the short window he singled out.

- `evidence/435/hero-dark-1440.png` — the restructured column beside the deck
- `evidence/435/hero-light-1440.png`
- `evidence/435/modal-dark-1440.png` — two columns, carousel, both imagination lines
- `evidence/435/modal-light-1440.png` — and the duplicated sentence gone
- `evidence/435/modal-dark-540.png` — ⚠ **his 540px case**: `Done` visible, nothing clipped

⚠ **One thing his eye should judge that no arm can:** the style cards are blank swatches, because **there is no per-style artwork in this product** and inventing some would be a picture of a look we cannot photograph. Honest, and it reads thin — a browsable deck of three empty rectangles. If the carousel is worth artwork, that is a decision and a cost, not a fix.

---

## 6 · The instrument was verified before its verdicts counted

`client/src/features/castingV2/section10-guard.test.ts` — 22 arms, every absence arm carrying a positive control, every source proven readable before it is judged.

**9 sabotages → 9 RED, each naming its own rule, tree restored in `finally`, guard green again afterwards** (`scripts/_435-sabotage-disposable.mts`): centre the column · make the spacer an auto margin · drop the description's `min-height` · give the stage a fixed height · hand-write the duration · default the duration instead of omitting it · draw the imagination cards during a follow · leave the scroll widget on at rest · put `Done` inside the scroller.

⚠ **The driver's first run scored every sabotage `UNRUN` and REFUSED to grade** — vitest colours its summary, so the ANSI escapes sat between `Tests` and the count and the regex never matched. That refusal is the behaviour it was written for: the staff-dialog driver one section ago reported five clean greens having never executed a test.
