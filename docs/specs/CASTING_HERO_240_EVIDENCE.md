# The casting hero is a SHOWCASE — evidence pack (#240)

**Shift:** foreman-102, 2026-08-29 (AEST 2026-08-30 early).
**Issue:** #240 (urgent, founder-filed), with his two amendments on the same card.
**Supersedes in part:** #234 / PR #239 (`63734bcb`), which built the deck his spec §5 described.
**Advisor:** refused for the **nineteenth** consecutive time (`You've reached your Fable 5 limit`, #219). Everything below ran without it.

---

## 1. What he said, and what changed

Three rulings, all his words, all on #240.

| # | His words | What shipped |
|---|---|---|
| 1 | *"oh you messed up the casting hero, it's not meant to actually take people to a signed cast these are just images of potential casts you can make in the studio otherwise when a fresh user comes to the casting page they wouldnt see any images?"* | The deck is **one curated set, identical for every account**. It does not read the roster. **No card navigates** — the `castId` field is gone from the type, not nulled. |
| 2 | *"i agree with your reccomendation"* (on: a click fills the prompt like a TRY chip) | Clicking **any** card puts that card's brief in the prompt field and **does not submit**. A peek additionally centres itself. The caret moves to the box. |
| 3 | *"the bottom progress chips should expand the length of the hero section at the moment they are tiny it should look like this"* (+ reference frame) | The tick row spans the column, `flex: 1` each, evenly divided at every width. Hairlines 1px; the current one 3px and `--ink`. |
| 4 | *"also make the content width of the entire casting page 1240px, centred, with 32px horizontal padding — max-width: 1240px; margin: 0 auto; padding: 34px 32px 44px"* | `AppShell width="working" gutter="tight"` — **one** container for hero, entry cards, search row and roster. |

**His spec file was corrected in the same commit**, as he instructed: `docs/specs/Casting-ui-ux-design/casting-hero.md` carries a correction banner at the top and §1, §4 (rotation + ticks), §5 (data), §7 (definition of done) and §8 (container) are rewritten in place. §5 was the section that sent the previous shift down the roster road.

---

## 2. The drive — 244 checks, 0 failing

`scripts/_shift102-drive-hero-disposable.mts`, against the running app.
**Two accounts × two themes × four widths (1920 / 1440 / 1024 / 700), plus a behaviour pass.**
Screenshots and `checks.json`: `output/hero-240/`.

Every check records what it SAW (D-235).

### His headline claim, measured

```
PASS  a fresh account and an account with signed casts see the SAME faces, in the same order
      — owner [Hive-skull being, Feline humanoid, Android, Orc warrior, Cyber-goth, Hive-skull being…]
        vs fresh [Hive-skull being, Oni-cyber being, …] — same cycle, phase offset 1
PASS  …the same six faces and no others — 6 distinct each
PASS  …and the same briefs
PASS  CONTROL: the two accounts really are different (the owner's roster is not empty)
      — owner 4 roster cards vs fresh 0
```

**The control is the load-bearing line.** Two identical decks prove nothing if both accounts are empty; the owner bot really owns four signed Casts and the fresh one owns none, and they still see the same deck.

### Nothing navigates; a click fills the box

```
PASS  the centre card goes NOWHERE                     http://localhost:3000/casting -> …/casting
PASS  the centre click puts THAT card's brief in the box
PASS  …and does not submit
PASS  the caret lands in the box it just filled        activeElement "Casting brief"
PASS  a peek click still brings that card to the centre
PASS  …and puts ITS brief in the box
PASS  the peek click goes nowhere either
PASS  every card is a button and none is a link        button/button/button, 0 anchors
```

### His tick amendment, at every width and theme (16 cells each)

```
PASS  tick row spans the column      row 565px in a 565px block   (700px)
PASS  ticks divide evenly            6 ticks: 87.5 ×6             (700px)
PASS  ticks divide evenly            6 ticks: 53.2 ×6             (1024px)
PASS  the current tick is heavier    now 3px vs hairlines 1px
```

### His container amendment, at every width and theme

```
PASS  ONE content container          1 .dp-content on the page
PASS  the column is 1240px           max-width 1240px
PASS  his padding                    34px 32px 44px 32px   (≥1024)
PASS  his padding                    24px 20px 44px 20px   (700 — top and sides are the
                                     shell's narrow-rail rule; the 44px bottom is his)
PASS  every section shares one box   .dpc-hero 108–992 | .dpc-entries 108–992 |
                                     .dpc-filters 108–992 | .dpc-roster 108–992
```

His §8's own predicted failure is one section escaping the container, so **all four sections** are measured against each other rather than just the hero and the roster.

---

## 3. The instrument found three defects in itself before it found none in the product

Recorded because a driver that goes green first time is usually not looking.

1. **`deck 12px overflow`** — my own new arm read `.dpc-deck`'s `scrollWidth`, which counts the fan. Probed at the boxes: the two peek cards at `translateX(±62%) rotate(±7deg)` are what overhang, which is *why* the column is `overflow: hidden`. Re-pointed at the **brief block**, which is what #240 actually changed; the fan's overhang is now reported as an observation beside it.
2. **`centre card is 4:5 — ratio 0.840`**, on 3 of 24 cells. 0.840 is *exactly* the bounding box of a 4:5 card at `rotate(7deg)` — the arm caught a card mid-swap. `aspect-ratio` is a claim about the **layout** box, so the arm reads `offsetWidth/offsetHeight` now and the race is gone rather than slept through.
3. **the identity walk lost a step** — the 4s auto-rotation ran while the walk clicked, so the owner's deck read as five faces with one repeated, which looks exactly like "the deck differs by account". The walk holds the deck first, with a real pointer (a synthetic `.click()` in `evaluate` fires no `mouseenter`).

A fourth was in the **sabotage** rather than the driver: the anchor for *"the row stops centring its two heights"* matched `.dpc-deck__eyebrow`, which is earlier in the file and carries the same three declarations, so the sabotage removed a property nothing asserts and reported the tick guard as a hole. **A sabotage that misses its subject is indistinguishable from a guard that does not guard.**

---

## 4. Guards, and the proof they can fail

`scripts/_shift102-sabotage-disposable.py` — **15 sabotages, 15 reds**, each asserting the failure names the guard it should. It refuses to start on an already-red tree and restores in `finally`.

Fast tier (13, vitest): the deck reads the roster again · a card navigates again · the page stops handing it a brief handler · the page loses the caret · the page falls back to the browse column · the page loses the tight gutter · a tick states a width again · the row stops spanning the block · a tick refuses to shrink · the current tick stops being heavier · the row stops centring its two heights · an entry gets a room to open again · two cards share one brief.

Drive tier (2, browser — the two facts no source arm can see): **the centre card navigates again** · **the tight gutter loses to the narrow-rail media query**.

---

## 5. One real bug the drive caught in my own change

`.dp-content--tight` was first written beside `.dp-content--working` — **above** `@media (max-width: 720px)`, which restates the whole `padding` shorthand. Same specificity, later rule, so the gutter was 44px at 1920 and **80px at 700**: correct at every width anybody screenshots and wrong at the one they do not. Found by measuring the computed padding at all four widths, fixed by moving the rule below the media query, and it is now a sabotage case.

---

## 6. Copy audit

Every user-visible string on the changed surface, classified per the founder's UI contract.

| String | Class | Note |
|---|---|---|
| `Cast from these words` (eyebrow) | **prototype-verified** | His spec §4's own eyebrow. It is now the ONLY eyebrow — the `Example casts` variant is deleted with the roster road. It is true of all six cards: those words produced that face. |
| `Example` (centre caption meta) | **adapted** | Unchanged from #234. It is what stops the eyebrow being read as a claim about the viewer's own shelf, which is the honesty question this deck raises. |
| The six card names — `Hive-skull being`, `Oni-cyber being`, `Feline humanoid`, `Android`, `Orc warrior`, `Cyber-goth` | **adapted** | Types, never invented people. An unsigned candidate has no name and inventing one would be the only fiction on the surface. |
| The six briefs | **capability-true, verbatim** | Read off `casting_rolls.briefText`; each is the real sentence that cast its own frame. Unchanged from #234. |
| `Use this brief` (centre card aria-label) | **invented** | New, because the control is new. Names what the click does. |
| `Show <name> and use that brief` (peek aria-label) | **invented** | States both of a peek's effects, because both are real state changes and a screen-reader user gets no fan to watch. |

**Nothing else on the page changed its words.** No new visible copy ships — both new strings are accessible names.

### The one judgement call

**Keeping `Cast from these words` rather than `Example casts`.** The old eyebrow existed to stop a curated deck being read as *your* signed performers. That reading is no longer reachable: the deck never claims to be anybody's shelf, and the caption says `Example` in the same breath. `Cast from these words` is the true and teaching sentence — those words made that face — and it is his spec's own. **His to reverse in one line if he reads it the other way.**

---

## 7. Verification

- `pnpm check` **exit 0** (including the uncalled-export sweep: `unread 0` after `heroDeck()`, `frameMeta`, `HERO_DECK_MAX` and `RosterCast` were deleted rather than left orphaned).
- `pnpm architecture:generate` + `architecture:check` **OK** — the diff is the fingerprint line alone.
- `pnpm capability:check` **OK** — 58 doors, 62 corpus rows, 0 errors.
- `npx vitest run client/src` — **647 passed, 0 failed** (52 files).
- The drive — **244 / 244**.

### Two pre-existing test defects this change surfaced

1. **`conceptUpload.test.ts` sliced backwards.** It anchored on a bare `indexOf("focusBrief();")` from the top of the file; the moment the deck gained a caret call *above* `onDescribed={`, the slice ran backwards and returned `""`. **Two of that test's three assertions are `not.toContain`, and both pass on an empty string** — so the arm would have gone on reporting green while asserting nothing. Fixed to search forward from its own anchor, with a length floor so an empty slice can never pass again.
2. **The token guard reads a bare `#240` in a string as a hex literal** (its own message says so). The issue reference moved into a comment.

---

## 8. What is NOT in this PR

- **#238** — the hero's spec toggle and locked-traits pill. Deferred by #234 because the panel it opens does not exist; untouched here.
- **The showcase's contents.** The six frames and briefs are #234's picks, unchanged. They are a named constant (`SHOWCASE_DECK`) so they can be re-picked in one edit if he wants different ones.
- **The lobby lane (#228)** is still waiting on him to name segment 1. This is a casting-page surface, not a lobby segment, so the lane's casting freeze is untouched by it.

---

## 9. For his eyes

The deck now looks the same to him as it does to a customer who signed up ten seconds ago — that was the whole point of his correction, and it means **he can judge it as a stranger would**.

Worth his hands:

1. Open `/casting`. The deck should be six creature/sci-fi frames, rotating, whatever his roster holds.
2. **Click the centre card.** The brief drops into the prompt box and the caret lands there. Nothing is spent, nothing navigates.
3. **Click a peek.** It swings to the centre *and* its brief lands in the box.
4. Look at the tick row against his own reference frame.
5. Widen and narrow the window: the hero, the two entry cards, the search row and the roster grid should keep one left edge and one right edge at every size.
