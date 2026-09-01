# Crew — reconciliation, not a rebuild

**One PR. Prerequisite: the staff shell.**

Live reference: `design_handoff_studio/Klieg Studio.dc.html` → Admin → Crew, for the surface treatment only.

---

## 1. Read this before anything else

**Crew is already built, and its content architecture is better than my prototype's.** Seventeen components, and the decisions inside them are right:

- **Product impact leads every decision card**, enforced by the layout rather than by a writer remembering.
- **The recommendation is stated before the options**, so a "yes" needs no reading of alternatives.
- **A confirming quote is rendered verbatim and never paraphrased** — the word is the evidence that the word was given.
- **No relative time on a ruling.** *"A ruling's date is a fact and relative time makes it a moving one."*
- **The milestone bar is read off the steps**, never a second number beside them, so it moves the day work starts.
- **The rung bar** — filled done, ringed current, light queued, dashed parked — is a better summary than the lanes I drew.
- **Three history lists collapsed into one** (#292), because stacked history read as double-ups.

**None of that changes.** This brief is the surface: type, tokens, section grammar, width. If the diff moves a paragraph's order, deletes a quote, adds a second progress number or splits history back apart, it has gone wrong.

**Where my prototype and the built Crew disagree on content, the built one wins.** It has had more thought put into it than my mock did.

---

## 2. Width — and the one exception

Crew is a **790px reading column**, centred, not the 1240px working width the tables use. It is a briefing you read.

```css
max-width: 790px; margin: 0 auto;
padding: 26px 32px 48px;
display: flex; flex-direction: column; gap: 26px;
```

**The exception: `CrewEyeGallery` breaks out to the full 1240px.** Its whole job is judging images by eye, and at 790px a four-up grid gives 180px tiles — too small to see what you are being asked to decide. Same principle as the casting takes grid: the thing being judged is the largest thing on screen.

So the page is a 790px column with one full-width section inside it. Implement as a full-bleed wrapper on that section, not by widening the page.

---

## 3. Section heads

Every section currently opens with `<h2 className="text-[11px] uppercase tracking-[0.12em] text-[#999]">`. The letter-spacing and case are right; the face is wrong — that eyebrow is **JetBrains Mono** everywhere else in the product, and it is the single most recognisable device in the language.

The house head is three parts:

```css
display: flex; align-items: center; gap: 11px;
```
1. Eyebrow — `500 9.5px JetBrains Mono`, `.13em`, `--metaStrong`, `flex: none`
2. A `flex: 1` hairline in `--rule`
3. Optional right-aligned meta — `400 11px Archivo`, `--faint`

`THE PROGRAM` · `NEEDS YOU` · `WORKING NOW` · `IN THE BACKGROUND` · `NEXT UP` · `PROBLEMS` · `THE PIPELINE` · `FOR YOUR EYE` · `ALREADY DEALT WITH`.

The count currently rendered inline — `Needs you · 3` — moves to the head's right-hand meta as `3 open`. The hairline is what separates the label from the count, so the middle dot goes.

Inner headings — `The ladder`, `Recommendation` — take the same mono eyebrow treatment at `8.5px`.

---

## 4. Type

**Two faces, and measured values are mono.** This is the biggest visual change and it is what will make Crew look like the rest of the product.

| | Now | Becomes |
|---|---|---|
| Step numbers, rung keys | sans `tabular-nums` | `400 11px JetBrains Mono`, `--faint` |
| Dates and times | sans | `400 10.5px JetBrains Mono`, `--faint` |
| Counts, issue numbers | sans | mono |
| Prose, titles, options, quotes | sans | unchanged — Archivo is right |

**`font-semibold` goes everywhere.** It appears on card titles, milestone titles, the focus title and the current rung. The foundation states of itself that 600 *"is never used"*. Titles are `500`; emphasis comes from size, colour and space.

Sizes: card title `500 14px Archivo` `-.015em`; mission `400 14px/1.65`; body prose `400 13px/1.6`; option consequence `400 12.5px/1.55` `--metaStrong`; meta `400 10.5px` mono.

**Drop the italic on the quote.** A verbatim quote is already marked by its left rule and its attribution; italic is a third marker for one fact, and there is no italic anywhere else in the product. Keep the `2px` left border — change it to `--ink` — and keep the `— you, 24 Aug` attribution in `--faint`.

---

## 5. Tokens

Every hex literal goes. The mapping:

| Literal | Token |
|---|---|
| `#E5E5E5` (card border) | `--borderCard` |
| `#EFEFEF` (inner divider) | `--rule` |
| `#D5D5D5` (neutral chip line) | `--borderSoft` |
| `#CCC` (dashed parked) | `--dashed` |
| `#0A0A0A` | `--ink` |
| `#444` | `--secondary` |
| `#666` | `--metaStrong` |
| `#999` | `--meta` |
| `#BBB` | `--faint` |
| `#C0473A` | `--errorInk` |
| `bg-white` | `--surface` |

**`CHIP_TONE.warn`'s hard-coded `#C0473A` is `--errorInk`.** Its comment already says so, and its reasoning — *"a warn chip is a problem wearing a smaller badge"* — is right. Use the token and the argument stands.

Tailwind spacing and radii go with them: `rounded-2xl` → `var(--r-2xl)`, `p-5 sm:p-6` → a fixed `18px 19px` (the responsive step is unnecessary inside a 790px column that never narrows below it), `space-y-*` → `gap`.

Card shell throughout:
```css
border: 1px solid var(--borderCard);
border-radius: var(--r-2xl);
background: var(--surface);
padding: 18px 19px;
```

Extend `token-guard` over `components/crew/`.

---

## 6. Component deltas

Only what changes. Anything not listed keeps its current structure.

**`CrewProgramBanner`** — mono eyebrows; milestone progress track `--fill` with an `--ink` fill; step state labels in mono `--faint`; rung bar tokenised (done `--ink`, current `--surface` + `2px --ink` ring, queued `--border`, parked `1px dashed --dashed`); rung keys mono. The `truncate` on rung keys stays — with 8+ rungs at 790px they will need it.

**`CrewNeedsYou`** — **keep the empty state.** The Overview brief says a section with nothing to show should disappear; that rule does not apply here. *"Nothing is waiting on you. The crew will file a card here when something is."* is the answer to the question the page exists to answer, and its absence would read as a loading failure. Restyle it as a `--well` block rather than a full card.

Option rows: label `500 12.5px` `--ink`, consequence `400 12.5px` `--metaStrong`, on separate lines rather than run together with an em dash — at 790px a long consequence wraps under the label and the dash ends up orphaned.

**`CrewEyeGallery` / `CrewEyeViewer`** — full-bleed to 1240px. Tiles `aspect-ratio` per frame, `--media` background, `1px solid --border`, `--r-lg`. Judged items follow the casting grammar: a `3px --accentSolid` underline plus a pill when kept, never a border change and a check as well. Dashed border while undecided.

**`CrewPipeline`** — solid where merged, dashed where waiting. Mono for counts and ids.

**`CrewReplyThread` / `CrewReplyBox`** — thread entries: author `500 11.5px`, time mono `--faint`, body `400 13px/1.6`. The box uses the foundation's field and button. Acknowledged replies get a quiet `--faint` marker, not a colour.

**`CrewProblems`** — this is the one place `--error` is legitimate on this page. A problem is urgent; a waiting card is not.

**`CrewRecentHistory`** — dimmer throughout: `--metaStrong` bodies, mono dates, no card per entry. It is memory, not work.

---

## 7. What NOT to do

- **Do not restructure any card's content order.** Product impact first, recommendation before options.
- **Do not paraphrase or drop a verbatim quote.**
- **Do not add a second progress number** beside the milestone bar.
- **Do not split history back into separate lists.**
- **Do not remove the `Needs you` empty state.**
- **Do not widen the page past 790px.** One full-bleed section only.
- **Do not use `font-semibold` or `font-bold`.**
- **Do not use italic.**
- **Do not colour by state except `--errorInk` on warn chips and Problems.** No amber, no green, no blue.
- **Do not add relative timestamps** to anything decided.
- **Do not touch `useCrewState` or the visibility flag.** The query succeeding is the flag; that is right.
- **Do not add a query or change a mutation.**

---

## 8. Definition of done

**Unchanged**
- [ ] Every card's content order identical; quotes verbatim; history in one block.
- [ ] `crewTypes.test.ts` passes untouched.
- [ ] The Crew tab is still absent when `crew.getState` is not `ok`.
- [ ] Every reply, ruling and action behaves as before.

**Surface**
- [ ] 790px column; `CrewEyeGallery` full-bleed to 1240px; nothing else wider.
- [ ] Every section head is mono eyebrow + `--rule` hairline + optional right meta.
- [ ] Every measured value — step numbers, rung keys, dates, counts, ids — in JetBrains Mono.
- [ ] Zero `font-semibold` / `font-bold`; zero italic.
- [ ] Zero hex literals under `components/crew/`; `token-guard` extended and passing.
- [ ] Card shell is `--borderCard` / `--r-2xl` / `--surface` / `18px 19px` throughout.
- [ ] Rung bar states tokenised; parked is dashed.
- [ ] Eye tiles use the casting keeper grammar — underline plus pill, nothing else.
- [ ] `--error` appears only on warn chips and Problems.
- [ ] Both themes — Crew has never been dark-tested.

---

## 9. Then the promotion pass

Per `PROMOTION-PASS.md`. Crew is where several parts get their second consumer:

- **The section head** — now on Overview, the tables, Settings and here. If it is not already a component after brief 07, it must be after this one.
- **The progress bar read off states** — the milestone bar and `MilestoneRail` from section 00 are the same idea. `MilestoneRail` has had no consumer since it was built; this is it, or it should be deleted.
- **The reply thread** — one consumer today. Leave it unless the bug-report inbox wants it, in which case that is two.
- **The attention card** — Overview's *needs a human* cards and Crew's *needs you* cards are close but not identical: Crew's carry threads and options. Check whether one component with a slot serves both, and if it needs a rewrite to fit, leave them separate and log it.
