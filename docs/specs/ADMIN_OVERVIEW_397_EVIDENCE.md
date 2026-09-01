# Brief 07 — the admin dashboard. Evidence (#397)

Law 6: *"No visual change ships without being looked at in the running app
first."* This records what was driven, what was measured, and — the part worth
reading — **what looking found that the assertions had passed.**

---

## 1 · The readings

Both trees, both themes, 1440 and 1024, through the real entrance with an
admin session. `scripts/_397-drive-disposable.mts`, pointed at either port and
at either tree's pane selector, so the same arms measure both.

| | branch (`:3000`) | `main` (`:3100`) |
|---|---|---|
| readings | **72** | 72 |
| pass | **72** | **29** |

Reports: `output/397-frames/branch-reading.txt`, `main-reading.txt`.
Frames: 14 for the branch (3–4 scrolled screens × 2 themes × 2 widths) plus
2 of the banner form.

`main` fails 43 of the 72 on the same arms — including every colour arm, the
gradient arm, the KPI type arm, the inner-scroll arm and the `Data as of` arm.
**That is the control**: the arms discriminate rather than agreeing with
whatever they are pointed at.

### The one reading that mattered most

§11's last line: *"Both themes — including the charts, which is the part most
likely to be missed."*

| | dark | light |
|---|---|---|
| branch chart stroke | `rgb(237, 237, 239)` | `rgb(17, 17, 18)` |
| `main` chart stroke | `rgb(16, 185, 129)` | `rgb(16, 185, 129)` |

A hard-coded hex is **identical in both themes**, and that is exactly the
signature `main` shows. The branch's stroke follows the theme because
`chartTokens.ts` reads `:root` and re-reads it when `data-theme` changes.

---

## 2 · ⚠ The instrument was wrong four times before the code was

Every one of these made the driver report a pass it had not earned. They are
recorded because each is a repeatable class, not a slip.

**(a) The control was measuring a loading page.** The readiness wait polled
`.dp-skeleton` — *this card's* primitive. `main`'s dashboard draws its loading
state as `animate-pulse` divs, so on `main` the wait returned instantly, every
arm measured an unrendered page, and the colour arms reported *"30 distinct
paints, all greyscale"* over a page with emerald KPIs on it. Now waits on both
spellings **and** on real content, and the colour arms carry a **population
floor** — under 12 distinct paints they FAIL rather than reporting a clean
sweep they never took.

**(b) The tint detector could not see Tailwind's colours.** It parsed `rgb(`
only. **Tailwind v4 computes its entire palette as `oklch()`**, so all 51
tint-classed elements on `main` returned a string the matcher did not
recognise. Fixed by normalising through a canvas.

**(c) …and the first canvas fix was silently worse.** It read back
`ctx.fillStyle`, which — measured in this browser, `_397-oklch-probe` —
returns the **oklch string unchanged** rather than a hex. So the
`startsWith("#")` check rejected it and the colour was **dropped from the set
entirely**: not misclassified, never judged. Fixed by painting one pixel and
reading it back, which handles hex, rgb, rgba, oklch and named colours alike.

**(d) The driver was crashing and the stale report looked like a result.**
esbuild compiles `const toRgb = (x) => {}` inside `page.evaluate` into
`__name(fn, "toRgb")`, and `__name` does not exist in the browser — so the
evaluate threw, the driver died, and `main-reading.txt` from the previous run
sat on disk being read three times as though it were fresh. Rewritten with
inline loops and no named function expressions.

**(e) `fullPage` cannot photograph this page.** The staff shell is
`overflow: hidden` with the scroll on `.dp-staff__pane` (brief 05), so a
full-page capture returns exactly one viewport — **the frames were the top
third of the surface** while the report said both themes were driven. The
driver now scrolls the pane and captures every screen, and records how many.

**The permitted hues are derived from `:root`**, not typed into the driver, so
widening the palette widens the arm. Its stated limit: Tailwind's `orange-600`
sits ~13° from our accent, so the hue arm alone would not separate those two —
the **source** guard bans the class strings outright and is the arm that
catches them. Emerald, blue, amber, purple, teal and indigo are all far outside
the band.

---

## 3 · ⚠ What LOOKING found that 62 passing arms did not

This is the section that justifies law 6.

### (a) Nine of twelve alert rows printed a raw machine identifier

The top card of `NEEDS A HUMAN` — the first thing on the page, the section
whose entire job is *"does anything need me"* — read
`security.unauthorized_admin_access`. The feed below it read
`credits.admin_added`, `admin.action`, `auth.email_verification_failed`.

**It is structural, not an omission.** `getRecentAlerts` selects
`severity IN ('critical','warning') OR action IN (…thirteen names…)`, so the
severity arm admits **any** action the product ever writes while a
hand-written label map only knows the thirteen. The map cannot be completed —
it is a list shadowing a source of truth (working law 4).

Fixed by **deriving**: `actionLabel.ts` turns the identifier into words
(`Credits · admin added`) and keeps a hand-written phrase only where one beats
the identifier. It invents no meaning — `credits.admin_added` does not become
"An admin granted credits", because this module cannot know that. Six guard
arms hold it, including one that refuses any label still matching `[a-z]\.[a-z]`.

### (b) `SYSTEM` was printed twice, six pixels apart

The section eyebrow and the card's own label. His §4 says both — `SYSTEM` in
its eyebrow list, "System and banners" in its section-order list. Driven, the
one-word version was plainly a duplication. The head now reads **System and
banners**, which is his own name for the section.

### (c) A fifth section eyebrow that his brief does not have

§4 names exactly four: `NEEDS A HUMAN`, `LAST 24 HOURS`, `SYSTEM`,
`RECENT ALERTS` — **five sections, four heads**. A `CHARTS` head had been
added, and on screen it was one redundant word above four already-titled
cards. Removed.

### (d) A selected chip that could not show it was selected

`BannerManagement` used `dp-chip--on` — **a class that exists nowhere**,
because the foundation's `Chip` has no selected state at all. The chosen
banner type looked identical to the three unchosen ones. **The drive missed
this** because the form is behind a click; it was caught by grepping the
foundation while writing the promotion pass. The driver now opens the form,
asserts one of four chips is selected with **two distinct computed looks**, and
photographs it scrolled into view.

⚠ **(d) also produced its own smaller lesson.** The first version of that arm
passed while its screenshot showed the *top of the page* — the assertion read
the DOM and the camera pointed somewhere else. A measurement and a photograph
of two different things is not evidence for either.

---

## 4 · What was deliberately NOT built, and why

Four departures from a literal reading of the brief, each a reconciliation
finding recorded on #397 before a line was written.

1. **`NEEDS A HUMAN` sources two kinds, not four.** Pending change requests and
   critical alerts have readers on this page. *Unanswered Crew cards* would
   need `crew.getState` and *flagged discrepancies* would need
   `moderatorReconciliation.getUsersWithDiscrepancies(threshold)` — a second
   query each, which §10 forbids, and the second would need this card to invent
   a threshold. The brief's own §2 hedges to exactly this: *"already hold
   **most** of this data."*
2. **Three sparklines, not four.** `ACTIVE USERS` has no 14-day series;
   `dailySignups` is `COUNT(*) FROM users WHERE createdAt >= …` — accounts
   created, not users active. His own 00b ruling governs: *"a number in a
   screenshot that no server produces is a lie that survives into the build."*
3. **No delta on any KPI.** The value is a rolling 24-hour figure; the only
   comparable series is calendar-day, whose last bucket is today-so-far. A
   "today vs yesterday" delta compares a partial day against a complete one and
   would report a collapse every morning — the wrong-boundary class CLAUDE.md
   law 7 names.
4. **Critical text takes `--errorInk`, not `--error`.** `tokens.css` records
   that plain `--error` on the dark surface measures **3.40:1**, below the
   4.5:1 AA floor, which is why `--errorInk` is overridden in dark and
   `--error` deliberately is not. `--error` sets borders and fills here and
   never a word. A guard arm holds it — anchored, because `color:` is a
   substring of `border-color:` and the first matcher flagged two legitimate
   border declarations. Its own positive control is what caught that.

---

## 5 · The machine record

- `client/src/features/admin/overview/section07-guard.test.ts` — **61 arms**,
  population derived from the directory listing plus the page, every absence
  arm paired with a positive control.
- `token-guard` extended over the whole directory — **zero** hex literals
  across eleven files, and the enrolment is **proven able to fail**: a planted
  `#BADA55` reddens exactly one arm, naming the file; restored and verified
  clean.
- `pnpm check` clean · `pnpm test` green · Atlas regenerated
  (**993 modules, 280 procedures, 288 findings, 0 error**) ·
  `capability:check` **OK — 59 doors, 62 corpus rows, 0 error**.
- Queries untouched: an arm asserts both `useQuery` calls, their `undefined`
  input, the 30s interval and the 10s `staleTime`, and that the only tRPC
  callers in the section are the page and the banner card — the three banner
  mutations each keeping both of their invalidations.
