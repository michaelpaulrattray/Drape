# Promotion pass — section 10, the casting hero column and the Cast settings modal

Per `docs/specs/Casting-ui-ux-design/drape-redesign/PROMOTION-PASS.md`, the back
half of brief 10 (#435). **Written as the card first (#482, 2026-09-03), re-read
at the code twice (2026-09-13, 2026-09-14), and the verdict is that NOTHING
MOVES.**

⚠ **"Nothing was promotable" is a discharge; silence is not** — the pass's own
rule, and this file is why section 10 now has the record every other section from
02 has. Sections 02, 03, 04, 05, 06, 07, 08, 09 and 11 each carry one; section 10
carried its output only in a GitHub issue body, which is the #893 shape (a fact
that lives in one place nobody re-reads).

---

## 1 · What the section added, and who really imports it

Counted at the tree on 2026-09-14 — files that import it TODAY, never surfaces in
the design. His own correction from #262: *"two real consumers in the codebase,
or it waits."*

| thing section 10 added | real consumers | verdict |
|---|---|---|
| the fanned card deck (`.dpc-deck__stage/__card--centre/--peek/--left/--right`) | **2** — the hero deck (`HeroDeck.tsx`), the style carousel (`CastSettingsModal.tsx`) | **STAYS — not ready.** §2: serving both needs a rewrite, not a parameterisation |
| the mono label + `flex: 1` hairline | **2** — `HeroDeck.tsx`, `CastingV2.tsx` | **STAYS — collision, and a bigger one than the card knew.** §3: the device is drawn FIVE times, and `.dp-menugroup` in the foundation is the deck's eyebrow **byte for byte**. The fold is real and is carded; it is foundation-wide, not section 10's |
| `HeroDeck` | 1 (`CastingV2.tsx`) | stays — rule 4 |
| `ConceptUploadHandle` | 1 (`CastingV2.tsx`) | stays — rule 4 |
| `.dpc-hero__pitch/__air/__ask/__explainer/__actions/__photos` | 1 each | stays — rule 4 |
| the whole `.dpc-setm__*` modal shell | 1 (`CastSettingsModal.tsx`) | stays — rule 4 |
| `CASTING_V2_ROLL_TYPICAL_SECONDS` | 1 (`server/routes/castingV2.ts`) | stays — rule 4, and it is a **server** constant; the client never sees the number, it receives it |

**Nothing in this section reaches two real consumers without colliding with
something the foundation already has.** That is the whole finding.

---

## 2 · The fan — two real consumers, and still not ready

The card's count is right and its own escape clause is the answer: *"if that
turns out to need a rewrite rather than a parameterisation, this card says so and
stops."* It does. Measured at `castingV2.css` (deck ~210–290, carousel
~4430–4490):

| property | hero deck | style carousel |
|---|---|---|
| how a card is centred | flex `align-items` / `justify-content` on the stage; cards carry no `top`/`left` | `top: 50%; left: 50%` plus `translate(-50%, -50%)` on **every** card, so every transform must re-state it |
| centre width | `min(58%, calc((100cqh - 18px) * 0.8))` | `min(46%, calc((100cqh - 6px) * 0.82))` |
| peek width | `min(46%, calc((100cqh - 18px) * 0.8))` — **same height factor as the centre** | `min(34%, calc((100cqh - 6px) * 0.62))` — **a different height factor from its own centre** |
| peek | `translateX(±62%) rotate(±7deg) scale(0.9)`, opacity `0.34` | `translateX(±80%) rotate(±6deg) scale(0.88)`, opacity `0.44` |
| background | `var(--media)` | `var(--surface)` |
| border | `1px solid var(--border)` on the base, centre overrides to `--borderCard` | no base border; centre and peek each declare their own |
| transition | `transform, opacity, box-shadow` at `0.52s` | `width, opacity, transform` at `0.2s` |
| what it is | a `<button>` — `cursor: pointer`, `font/color: inherit`, a `:focus-visible` outline | a `<div>`, not focusable |
| what is inside | an absolutely-filled `<img>` under `overflow: hidden` | a caption, and no image at all |
| extra state | none | `--coming`, a dashed border for a style that does not exist yet |

**Eleven settings, and two of them are structural rather than numeric** — how a
card is centred, and whether the thing is a button wrapping an image or a div
wrapping a caption. The peek row is the one that shows it is not a tidy-up
waiting to happen: the carousel's peek scales its height by a *different* factor
from its own centre and the deck's does not, so even the sizing rule is not one
rule with two numbers in it.

`PROMOTION-PASS.md`: *"Not a refactor. If a promotion needs the component
rewritten to be general, it is not ready — leave it and log it."* **Logged.**

⚠ **The card also corrected his brief's count and that correction stands.** Brief
10 §6 says the fan has three consumers — *"the casting hero, the templates run
modal, and this style carousel"* — and **there is no templates run modal in this
codebase**; re-grepped 2026-09-14, still nothing. Two is his own bar (#262:
*"From here: two real consumers in the codebase, or it waits"*), so the count
clears the bar and the divergence above is what stops it, not the count.

---

## 3 · ⚠ The label + hairline — the collision the card's own check MISSED

**The card recorded, twice, that the foundation holds no label-plus-rule device:**

> *"Foundation collision check, done before proposing anything:
> `client/src/foundation/` contains no card-fan and no label-plus-rule device
> today, so neither promotion would displace an existing one."*

> *"no fan device in the foundation — `grep -l "deck__card\|--peek\|card3--centre"`
> returns **nothing**"* (the 2026-09-13 re-read)

**It is wrong about the second half, and the grep is why.** Both checks searched
for the CLASS NAMES casting uses. A device that exists in the foundation under
its own vocabulary cannot answer to casting's spelling — so the grep was asking
whether the foundation had copied casting, not whether the foundation already had
the thing. Searching for the DRAWING instead (`flex: 1` + `height: 1px` +
`background`, over every stylesheet) finds it immediately.

### The real population — FIVE declarations, and they are TWO devices

Swept over every `.css` under `client/src`, comments stripped. **The sweep I first
wrote by hand missed two of these**; the arm described in §5 found them, which is
the only reason this table can be trusted over the card's.

| declaration | the type beside it | gap | rule | real consumers |
|---|---|---|---|---|
| **`TableHead` → `.dp-eyebrow` + `.dp-tablehead__rule`** | `500 10.5px` mono, `.12em`, uppercase, `--meta` | 11px | `flex: 1; min-width: 20px; height: 1px; background: var(--rule)` | **27 files, 31 mounts** |
| `.dp-crew__skelrule` (`crew.css`) | none — a loading skeleton | — | `flex: 1; height: 1px; background: var(--rule)` | 1, and **its own comment already says what it is**: *"The rule `TableHead` draws to the right of its eyebrow"* |
| **`.dp-menugroup` + `__label` + `__rule`** (`foundation.css`) | `500 8.5px` mono, `.13em`, `--faint` | `var(--s-3)` = **8px** | `flex: 1; height: 1px; background: var(--rule)` | **2** — `LobbyUtilityMenu.tsx`, `UserCard.tsx` |
| **`.dpc-deck__eyebrow` + `.dpc-deck__rule`** (`HeroDeck.tsx`) | `500 8.5px` mono, `.13em`, `--faint` | 8px | `flex: 1; height: 1px; background: var(--rule)` | 1 |
| `.dpc-hero__receipt` + `__receiptvals` + `__receiptrule` (`CastingV2.tsx`) | `400 10.5px/1.4` mono, `.03em`, **no** uppercase, `--faint` | 10px | `flex: 1; height: 1px; min-width: 0; background: var(--rule)` | 1 |

**The near-miss, named so nobody re-derives it:** `.dpc-deck__tick` is `flex: 1`
and `height: 1px` too, and is **not** this device — there are N of them dividing
a row rather than one filling the remainder, and it paints `var(--border)`. The
card said so in prose; my sweep collected it anyway until the `var(--rule)`
discriminator went in, which is why that discriminator carries a sabotage arm.

`TableHead`'s docblock describes the device exactly, and separates it from
`SectionHead` on the property that matters here — *"this is a wrapping cluster
whose rule runs THROUGH it."* That is the sentence the card wrote about the
casting pair without knowing it had already been written.

### ⚠ Rows 3 and 4 are the same drawing, to the byte

**`.dp-menugroup__label` and `.dpc-deck__eyebrow` declare identical type** —
`500 8.5px var(--font-mono)`, `letter-spacing: .13em`, `color: var(--faint)` —
beside identical hairlines, in containers with the same 8px gap (`--s-3` is
`8px`, read at `tokens.css`). **The foundation has been drawing the casting
hero's eyebrow, under the menu's vocabulary, since before section 10 existed.**
Neither surface knew.

The two differences are real and both belong to the context rather than to the
device:

- **`text-transform: uppercase`** sits on the deck's container; the menu's call
  sites type their caps into the markup instead (`STAFF`, and a `{label}` prop).
- **`padding: var(--s-4) var(--s-5) var(--s-2)`** sits on `.dp-menugroup`; the
  deck is spaced by `.dpc-deck__brief` and wants none.

### So there IS a promotion here, and it is not section 10's to take

Three real consumer files for one drawing — `LobbyUtilityMenu`, `UserCard`,
`HeroDeck` — against the pass's bar of two, and **no component anywhere**: the
lobby wraps its copy in a local `MenuGroup`, the account card inlines the same
three elements, and casting wrote its own classes. Rule 6 has a clear answer.

**It is carded rather than folded tonight, for a reason from the pass's own
Naming section read in the direction nobody reads it.** The cheap fold is to
point `HeroDeck` at `.dp-menugroup__*` and delete casting's two classes — one
file, visually neutral, ten minutes. **It would also put the MENU's vocabulary on
the casting hero**, which is the same error as a promoted component arriving
still called `BriefField`. Doing it properly means a renamed foundation component
that all three call sites take, with `.dp-menugroup`'s padding moved out to the
two menu sites — a foundation-wide act touching the lobby, the account card and a
founder-judged surface, with its own render check. That is its own card, not a
line item in section 10's pass.

**Until it lands, `section10-guard.test.ts` holds the two type declarations
equal**, so the pair cannot quietly become a third scale while the card waits.

### Rows 1 and 5 do NOT fold — a different answer, for a different reason

Rule 6 says *"the one with real customers wins… fold in anything the loser has
that the winner lacks, then delete it."* Across the two SCALES it cannot be
obeyed without repainting. Converging the 8.5px pair onto `TableHead` moves the
deck's label from 8.5px to 10.5px, `--faint` to `--meta`, and its gap from 8 to
11; converging the receipt line moves it from `400`/no-uppercase to
`500`/uppercase. Both land on the casting hero — **a surface the founder judged
with his own eyes** (#435, evidence at `docs/specs/CASTING_HERO_435_EVIDENCE.md`)
— and collide head-on with the pass's Output rule: *"No behaviour changes. The
thing you should see afterwards is nothing at all."*

**Whether the hero's eyebrow IS the house eyebrow at a smaller size cannot be
answered from a consumer count.** It is a design question and it goes on a card.

⚠ **This is the section 11 precedent, not a new kind of outcome.** That pass found
`SettingsField` colliding with the promoted `ModalField`, measured that folding
either onto the other *"repaints a shipped surface"*, and **logged it as a design
card (#841) rather than folding it.** Section 10 lands in the same place for the
same reason — with the difference that it also found an exact duplicate
underneath, which is a promotion rather than a question.

The honest cost is stated rather than implied: **the tree draws a
label-with-a-rule-through-it five ways for another cycle**, and all five
declarations now carry a comment saying so, so none of them can read as the only
one.

## 4 · A naming accident, recorded and NOT fixed

The pass's Output asks for *"any naming accident that should be fixed first."*
There is one, and it is inert rather than harmful:

`CastingV2.tsx:771` renders `<span className="dp-chrome dpc-hero__receiptvals">`.
`.dp-chrome` declares `font: 500 10px var(--font-mono)`, `letter-spacing: 0.1em`
and `color: var(--muted)` — and `.dpc-hero__receiptvals` overrides **all three**.
Equal specificity, so source order decides, and `CastingV2.tsx` imports
`@/foundation` (line 15) before `castingV2.css` (line 51), which puts casting's
sheet last. **So `dp-chrome` on that element paints nothing.**

It is left alone deliberately. Removing a class from a founder-judged surface on
a cascade argument wants a render check in the running app, which is not what
#482 asked for and is not a no-behaviour-change move until it has been looked at.
It is written here so the next reader of that line does not assume the chrome
face is doing work, and so it can be swept with the convergence when that is
decided.

---

## 5 · What this PR changes

**Nothing a customer can see, and no declaration anywhere is altered** — the CSS
diff is comments only, checked at the diff rather than claimed.

1. **This record.** Section 10 was the one section from 02 onward with no written
   pass output.
2. **A comment at each of the five hairline declarations**, naming the other four
   and which of the two scales it belongs to, so the next pass that greps a class
   name finds the population instead of re-deriving it.
3. **Two arms in `section10-guard.test.ts`**, because a document cannot notice a
   sixth copy:
   - the sweep over every `client/src/**/*.css`, pinned to the five;
   - **`.dp-menugroup__label` and `.dpc-deck__eyebrow` held equal on `font`,
     `letter-spacing` and `color`** — the pair that must not drift into a third
     scale while the promotion card waits.

   Driven with four sabotages, each caught by the arm that should catch it and
   each clean when restored: a sixth hairline added (the population arm, naming
   it); the deck eyebrow's size moved (the type arm); the sweep's root pointed at
   a directory with no stylesheets (the positive control — **a reader that has
   gone blind looks exactly like a clean tree**); and the `var(--rule)`
   discriminator removed, which brings `.dpc-deck__tick` back and proves the
   discriminator is load-bearing rather than decorative.

The thing you should see afterwards is nothing at all.

---

## 6 · The method note, for the next pass

⚠ **A foundation collision check that greps the class names you are about to add
cannot find a device the foundation already has.** It can only find a copy of
YOUR spelling. Both of #482's checks did this and both returned a clean answer
over a device with 27 consumer files.

**Grep the drawing, not the name.** For a CSS device that means the two or three
declarations that make it what it is (here: `flex: 1` + `height: 1px` +
`background: var(--rule)`), swept over every stylesheet; for a component it means
the shape of the markup, not the prop names. This is the Atlas's own recorded
class — *a regex standing in for something the code already states* — arriving in
a design pass instead of a collector.

⚠ **And the drawing-shaped sweep needs its own discriminator, which the first
attempt did not have.** `flex: 1` + `height: 1px` + any `background` collects a
progress tick, and the tick was a thing #482 had ALREADY named as a near-miss in
prose — so the loose sweep would have handed the next reader a "finding" the card
had disposed of a week earlier. **The token is what says the thing is a RULE**;
geometry alone cannot, because a 1px filling box is also how you draw a tick, a
track and a divider. Pick the property that carries the MEANING, not the ones
that carry the shape.
