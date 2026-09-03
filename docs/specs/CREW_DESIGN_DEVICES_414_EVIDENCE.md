# #414 — the Crew page takes his drawing's design devices. Evidence

**Card:** #414 (`founder-ordered`). **Shift:** foreman-197, 2026-09-04.
**Money: $0** — no credits, no renders, no paid calls.

**His scope, verbatim, and it is the whole of it:**

> ***"no i dont want the mock data i want the say UI/UX design principles the
> cards the loading spinners the layout etc."***

So every change here is TREATMENT. **Zero new state, zero new query, zero
invented number** — and the two guard arms that matter most are the ones
asserting exactly that.

---

## 1 · What a person sees

**The milestone steps.** They were a numbered list — `1. 2. 3.` — with the
state as a plain word at the end of each row. They now read as his frame does:

| state | marker | pill |
|---|---|---|
| `done` | filled ink disc with a tick | `Done`, greyscale outline |
| `in-progress` | ink ring, no fill | `In progress`, greyscale outline |
| `waiting` | soft ring, no fill | `Waiting`, greyscale outline |
| `blocked` | **coral ring** | **`Blocked`, coral outline** |

Hairlines between the rows, in `--ruleSoft` — the token the sheet already calls
*"divider between list rows"*, which is how the staff table reads.

**The words did not change.** `STEP_LABEL` is untouched; the card asked for the
treatment only.

**The loading state.** `Loading the briefing…` — one line in a quiet card, on
the longest page in the product. It is now skeletons at the sections' real
heights.

---

## 2 · The defect the frames found, and the numbers behind it

⚠ **THE FIRST BUILD'S `waiting` RING WAS INVISIBLE, AND EVERY AUTOMATED CHECK
WAS GREEN.** `pnpm check`, 1,258 client tests, the guard suite, all eight
sabotages — green, with a state marker nobody could see.

It wore `--border`, on the reasoning that a waiting step and a queued rung mean
the same thing so they should carry the same token. Measured against the card it
sits on:

| | light | dark |
|---|---|---|
| `--border` (as built) | **1.25:1** | 1.22:1 |
| `--faint` (shipped) | **2.6:1** | 4.96:1 |

**Why the analogy failed, and it is the lesson worth keeping:** the rung bar's
`queued` segment is an **8px filled block**, which reads as a shape at any
contrast. This is a **1.5px stroke**, where the same value disappears. *Two
devices meaning the same thing can need different tokens to SAY it* — the
opposite of the tidy-looking answer.

Frames: `evidence/414/fourstates-light-banner.png`,
`fourstates-dark-banner.png` (all four states, both themes, after the fix).

---

## 3 · What was driven, and what a source read could not have said

`scripts/_414-drive-disposable.mts` — **24 readings, 24 ok**, both themes at
1280×900. Every reading records what it SAW.

- **The jump, measured properly.** The card's bar is *"nothing jumps when the
  briefing lands."* The column's total height is **6,175px** and **no loading
  state can know that** — a skeleton sized to guess it would jump the other way
  on a short briefing, and would also be a lie about how much is coming. So the
  two things that actually move on his screen were read instead:
  - the visible pane is **occupied** while the briefing is in flight — 876px of
    skeleton against an 876px pane (it was one 40px line);
  - **the first card's top edge holds at 143px → 143px.**
- **The theme delta.** dark `rgb(237,237,239)` vs light `rgb(17,17,18)`.
  ⚠ **This arm caught a driver bug that every per-theme arm passed through**:
  pass 1 seeded the theme with `evaluateOnNewDocument`, which re-runs on every
  navigation, so the "light" pass photographed the dark page. Twelve arms went
  green on the wrong frame; only the delta arm at the foot failed. That is the
  argument for having one.
- **The ordinal, read out of the rendered text** rather than the markup — a
  number restored via a pseudo-element would pass a source read.
- **The hairline lands between rows and not under the last one** (`1px` on rows
  1–12, `0px` on 13).

---

## 4 · The law-7 class sweep

**The class:** *an element whose ONLY content is its own stroke or fill,
coloured from a token chosen by analogy with a sibling that has text or area to
carry the meaning instead.*

The four other thin strokes in `crew.css` — `.dp-crew__card`, `.dp-crew__chip`,
`.dp-crew__sev`, the eye-item pill — are **not** siblings, and the discriminator
is why: **all four have TEXT inside them**, so the meaning survives a faint
edge. `scripts/_414-sweep-disposable.mts` measured the ones that do not:

```
ok   .dp-crew__stepmark (waiting)     1.5px stroke  light 2.6:1   dark 4.96:1
ok   .dp-crew__stepmark (in progress) 1.5px stroke  light 18.87:1 dark 14.54:1
ok   .dp-crew__stepmark (blocked)     1.5px stroke  light 5:1     dark 6.56:1
ok   .dp-crew__rungseg--current       2px stroke    light 18.87:1 dark 14.54:1
FAIL .dp-crew__rungseg--parked        1px dashed    light 1.45:1  dark 1.76:1
—    .dp-crew__rungseg--queued        8px block     (not scored — a block reads as a shape)
—    .dp-crew__skelrule / step hairline  1px line   (not scored — a divider is meant to be quiet)
```

⚠ **THE ONE SIBLING WAS PHOTOGRAPHED RATHER THAN FILED OR FIXED BLIND.** No rung
is `parked` today, so there was nothing to look at — and changing a token on
arithmetic alone, with no frame, is the shortcut law 9 forbids. A rung was
doctored to `parked`, captured at 4× device scale beside its three neighbours,
and looked at: `evidence/414/parked-light-ladder-4x.png`,
`parked-dark-ladder-4x.png`.

**Verdict: not a defect, and the discriminator holds.** The dashed segment is
plainly distinct from `queued`'s solid block in both themes — **the dash pattern
is itself structure** — and the rung list one block beneath says the word
`Parked` in text. The step marker had neither of those. Changing it would also
be a visible change #414 does not ask for.

---

## 5 · The guard arm that had to move, said out loud

His card names this hazard: *"if a guard arm has to move to allow a device here,
that arm was pinning the treatment when it meant to pin the content; say so
explicitly rather than editing it quietly."*

`section08-guard.test.ts:634` asserted `dp-crew__num dp-crew__stepnum` — brief
08 §4's *"every measured value is mono"*, pointed at the step **ordinal**, which
this card deletes on his argument that *"the ordinal carries no information here
— the list is already in order."* **Its subject stopped existing; it was not
weakened to let a change through.** The rung-key half is untouched, and the
replacement arms assert the stronger thing: the ordinal is GONE, and what
replaced it is a marker rather than a number.

⚠ **AND THE §7 COLOUR ARM CAUGHT THE BLOCKED RING AS A SIXTH SANCTIONED SITE.**
The marker was built, the suite went red on the new selector, and the choice was
made in the open rather than the token being quietly swapped for a grey. It is
widened by **one named selector with its reason** — a blocked step is the
PROBLEM class that block already admits, and it is the only step state that
means something has stopped.

---

## 6 · The instrument was verified before its verdicts counted

`scripts/_414-sabotage-disposable.mts` — **8 sabotages → 8 RED, each naming its
own arm**, tree restored in `finally`.

| sabotage | arm that fired |
|---|---|
| the step ordinal comes back beside the marker | the step ordinal is gone |
| a fifth marker state the data cannot produce | the marker's states are exactly the four |
| a second pill class instead of the banner's chip | the state pill is the banner's existing chip |
| the blocked ring reaches for plain `--error` | only BLOCKED carries colour |
| the hairline becomes a gap again | step rows are separated by the row-divider token |
| the loading sentence returns | the page renders skeletons while loading |
| the skeleton reaches for the staff spinner | it uses the foundation Skeleton and NOT the staff spinner |
| the skeleton names a section | the skeleton asserts nothing |

⚠ **The driver's own control run REFUSED on its first attempt** — vitest writes
`Tests \e[1m\e[32m99 passed`, so the summary pattern never matched a perfectly
good run. **It refused rather than scoring**, which is exactly the behaviour it
was written to have: the last sabotage driver in this repo scored five clean
GREENS having never run a test. A driver that defaulted to "0 failed" would have
reported eight clean sabotages here having measured nothing.

⚠ **The law-7 sweep made the same class of mistake and also threw**: its
`[data-theme="dark"]` anchor matched line 16 of `tokens.css`, which is the token
file's own **docblock** describing the switch, so the "light block" was fifteen
lines and `--faint` read as missing. Anchored on the RULE now. Shape-matching
where a declaration exists — the fourth instance of that class in this
repository.

---

## 7 · The four devices NOT built, each with its reason at the code

The card lists eight devices and says *"CHECK EACH AGAINST WHAT EXISTS BEFORE
BUILDING IT."* Its own bar names four (1, 2, 3, 8). The other four:

- **4 · the inset `--well` notice block — ALREADY EXISTS**, with two real
  consumers (`CrewNeedsYou.tsx:64`, `CrewPipeline.tsx:97`). The card calls it
  *"a SHAPE to have available"*; it is available. The lock-glyph variant is not
  built: no surface on the page needs it, and a variant with no consumer is what
  `PROMOTION-PASS.md` forbids.
- **5 · a state pill in a card HEADER — NOT BUILT, by the card's own rule.**
  `held` is a **row-level** field, already rendered (`CrewNextUp.tsx:102`). No
  section-level state exists in `crewTypes.ts`. *"If the data cannot say HELD,
  no pill."*
- **6 · right-aligned count meta on card heads — ALREADY DONE** on the four
  heads that have a count. ⚠ **`Problems` is the only head with a count in hand
  and no count shown, and that is a PRIOR RULING rather than a gap** —
  `CrewProblems.tsx:40` says it: *"this section never had one. A new number is
  content, not surface."* Brief 08 §7 binds. Left alone.
- **7 · the milestone strip as bars with keys and captions — ALREADY EXACTLY
  THIS.** `.dp-crew__rungbar` renders a segment per rung with the key beneath
  it. The card said *"check the rung bar first — it may already be this."* It is.

Full reconciliation, posted on the card **before a line was written**:
[#414 comment](https://github.com/michaelpaulrattray/Drape/issues/414#issuecomment-5532355672).

---

## 8 · Brief 08's four content rules — checked, not assumed

- **No paragraph's order moved.** Section order untouched; guard arms pass.
- **No quote paraphrased or trimmed.** `CrewProgramBanner`'s blockquote is byte
  for byte what it was.
- **No second progress number.** `milestoneProgress` and `milestoneCountLine`
  are still called exactly once each; `progress.fraction` appears once.
- **History not split apart.** No section added or removed.

`crewTypes.test.ts` and every pre-existing `section08-guard.test.ts` arm pass
untouched, except the one named in §5.

---

## 9 · Receipts

- `pnpm check` **OK**
- `npx vitest run client/src` — **1,258 passed** (77 files)
- `npx vitest run server/crew server/briefingConformance.test.ts` — **237 passed**
- script guards — **18 passed**
- `pnpm architecture:check` **OK** (regenerated: +18/−2 — the new module and its
  two edges, nothing else moved)
- `pnpm capability:check` **OK** — 59 doors, 0 error
- drive: **24 readings, 24 ok**, both themes · four-state pass: **all readings
  ok**, 4/4 distinct in both themes
- sabotage: **8/8 reddened the arm written for them**

**Frames** — `docs/specs/evidence/414/`:

| file | what it shows |
|---|---|
| `branch-loading-dark-1280.png` | the skeleton, with the briefing held in flight |
| `branch-dark-1280-screen1.png` | the shipped steps, dark |
| `branch-light-1280-screen1.png` | the shipped steps, light |
| `fourstates-dark-banner.png` | all four marker states, dark |
| `fourstates-light-banner.png` | all four marker states, light |
| `parked-dark-ladder-4x.png` | the law-7 sibling at 4×, dark |
| `parked-light-ladder-4x.png` | the law-7 sibling at 4×, light |

⚠ **One drive condition, stated rather than left to be discovered:** the
worktree reaches the main tree's `node_modules` through a junction, so Vite logs
`outside of Vite serving allow list` for the webfonts. **The fonts loaded
anyway** — Archivo and JetBrains Mono are both visible in every frame — so the
readings stand; it is noise in the dev log, not a condition on the evidence.

---

## 10 · ⚠ THE GATE REVIEWER'S FINDING, AND IT WAS IN THIS SHIFT'S OWN FRAME

**PR #485, finding 1 — the skeleton cards drew FLUSH.** The real sections are
direct children of `.dp-crew` and take its `gap: 26px`; `CrewSkeleton` needs one
element for its testid, and a plain wrapper made the five cards children of an
unstyled div. They fused into one slab, and the column came out **104px (4 × 26)
shorter** than the same five sections render for real — *a smaller sibling of the
exact jump this card exists to remove.*

⚠ **It is visible in `branch-loading-dark-1280.png`, which is in this pack, and
which I looked at and passed.** Working law 6 says render before shipping; the
half this shift missed is that **a frame TAKEN is not a frame READ.** The
reviewer read the gap off the frame the shift had already produced.

**Fix:** `.dp-crew__skel { display: contents }` — the cards become flex children
of `.dp-crew` while the element (and the testid) stays in the tree. It also makes
the CSS block's existing sentence — *"the gaps between them come from `.dp-crew`
itself"* — TRUE, where the reviewer correctly called it false through the
wrapper; that sentence now says so out loud.

**Re-driven** (`scripts/_414-gapdrive-disposable.mts`), **8 readings, 8 ok**,
both themes — and the comparison target is **measured in the same page**, never a
constant somebody typed:

```
ok  the testid wrapper is out of the layout tree
      wrapper display: contents; .dp-crew display: flex
ok  the skeleton's gaps EQUAL the real sections' gaps
      real sections 26,26,26,26,26,26,26,26px · skeleton 26,26,26,26px
ok  the first card's top edge does not move   top 143px loading -> 143px loaded
ok  the visible pane is occupied              pane 781px · skeleton column 980px
```

⚠ **The first shape of that driver's own first arm was WRONG and failed on a
working fix**: it asserted `card.parentElement === main`, and `display: contents`
removes the wrapper from the LAYOUT tree, not from the DOM. Corrected to read the
computed display and the measured spacing — the observable facts — with the DOM
parent kept as a recorded reading that decides nothing.

**Guarded so it cannot come back:** a new arm reads `.dp-crew__skel`'s rule out
of the CSS (not its class name — the class could exist and be styled any other
way) and requires `display: contents`, with a positive control.

**Finding 2 — a stale count in an arm title.** *"one of the **five** sanctioned
selectors"* against a list of six. ⚠ **Swept per law 7, and the DESCRIBE one line
up had the same defect and was OLDER** — it said *"three"* against a list of
five, so the arm the reviewer read had been wrong twice over. The count is
derived from `SANCTIONED.length` now, or absent. **The class is *a count restated
in prose beside the list it counts*** — working law 4 in miniature.

**Frames after the fix:** `evidence/414/fixed-loading-dark-1280.png`,
`fixed-loading-light-1280.png` — the slab is gone and the cards carry the page's
own 26px rhythm. `branch-loading-dark-1280.png` is KEPT in this pack as the
before, because it is the frame the defect was visible in.
