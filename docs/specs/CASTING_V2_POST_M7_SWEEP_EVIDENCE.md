# Post-M7 recovered-queue sweep — evidence pack

Commit `71c3dd53`. Surfaces touched: the casting sheet's brief box, its notice
slot, and the lobby's unsigned-sheets strip. Advisor-reviewed **before** any code
was written; every ruling below that changed my intended design is marked.

Verified in the real app (headless Edge, minted session, dev server on 3007,
verify-bot fixture — no credits spent; the fixture was removed afterwards).

---

## 1. The paid-input bug (a) — the box now shows the brief that produced the roll

### The mechanism, named

Not a guess. The on-sheet edit path *cannot* reproduce the founder's symptom:
after an edited dispatch the box holds the edit, which equals the new roll's
`briefText`. The symptom requires the box to be **empty while the sheet's roll
identity is transiently stale**, and there are exactly two entries, both
remounts:

1. **Reload or navigate-back during the compile window.** A roll's rows commit
   only after the interpreter answers, so the session still reports the previous
   roll as active for several seconds. A remount seeds roll N−1's sentence into
   the empty box and burns the one-shot; roll N lands, finds the box non-empty,
   leaves it alone — permanently.
2. **Return against a warm query cache.** Leave before the 2.5s poll sees roll
   N; the cached `activeRollId` renders synchronously as N−1. Same burn.

### Reproduced deterministically, then fixed

The regression test drives two rolls arriving with nothing typed between them.
Run against a reconstruction of the old seed-and-burn mechanism it fails with
**exactly the founder's symptom**:

```
× the old mechanism fails the regression sequence
  AssertionError: expected 'a dad in his 30s'
                  to be 'a dad in his 30s, chunky glasses'
```

The negative control was run and then deleted — a test written green has never
proved it can go red.

### Browser evidence

One sheet, three rolls, three distinct briefs. The box follows the rail:

| Viewing | Box reads | Shot |
|---|---|---|
| Roll 1 | `a dad in his 30s` | `evidence/post-m7-sweep/02-walked-to-roll-1.png` |
| Roll 2 | `a dad in his 30s, chunky glasses` | `evidence/post-m7-sweep/03-walked-to-roll-2.png` |
| Roll 3 | `a musician in a red leather jacket, late 20s` | `evidence/post-m7-sweep/04-wardrobe-confession.png` |
| Cold load | the active roll's own brief, at t=4s once the roll query resolves | `evidence/post-m7-sweep/07-cold-load-settled.png` |

Clearing the box stays cleared **on the roll it was cleared on** — the backspace
defect the old comment records stays fixed — and an empty draft does not follow
the user to another roll as a blank.

### The follow, which is the half that cost money

A follow sends the visible box. That is the design and it is right; the bug was
that the box could show a sentence no roll on the sheet was cast from. The rule
now guarantees the displayed value is either the user's own words or the viewed
roll's own brief, and never a third thing — pinned as a property test.

### Named behaviour change

With no draft, **Roll again from a history view now re-rolls that roll's brief.**
The sentence you are looking at is the one that fires. An improvement, but a
change.

---

## 2. The six-cap (b)

`listOpenCastingSessions` defaulted to `limit = 6`. The lobby's strip already
scrolls sideways without limit, so sheets seven and beyond were not further along
the row — they were unreachable, with nothing on screen saying anything was
missing.

**Advisor ruling, and I had this wrong:** I had filed this as decision-free
("show all"). An owner `SELECT` with no ceiling is bounded by user behaviour, not
by the statement. Raised to a stated `OPEN_SESSION_CEILING = 40` — sessions
expire after seven quiet days, so forty covers a heavy week several times over
while the query keeps a limit at all.

---

## 3. The truncation notice (d) — the premise did not survive measurement

**The advisor made measurement blocking before any copy was wired, and it was
right to.** The proposed line was "Your brief was longer than a casting note —
the sheet used the first part." That is a record-that-lies twice over: the thing
capped is the *interpreter's output*, not the brief, and the whole brief *was*
read.

Then the measurement killed the trigger as well:

| Instrument | Result |
|---|---|
| 29 stored compiled rolls | role cap (80) fired **0 times**, max 28 chars, median 13 |
| same | notes cap (180) fired **0 times**, max 11 chars, median 0 |
| live interpreter, 307-char brief | role 22/80, notes 128/180 |
| live interpreter, 342-char brief | role 28/80, notes 142/180 |

The caps do not fire. A notice for them would confess an event that does not
happen.

### What the measurement found instead

**The compiler has recorded `interpreted: false` since Path A shipped and nothing
has ever shown it.** When the interpreter cannot be read, the compile falls back
to the raw sentence and **every lock the user stated is lost** — on a roll that
still runs and is still charged, and looks exactly like an ordinary one. That is
the true form of "a silent cut on a paid input", and it is now the sheet's
highest-priority notice.

Fail-open is unchanged (an interpreter outage must never cost someone their
roll). Only the silence changed.

Shot: `evidence/post-m7-sweep/08-fellback-notice.png`

> The brief reader was unavailable — this roll was cast from your sentence as
> written, with nothing pinned.

**Deliberately does not say "roll again".** That is a paid action, and pushing
someone to spend again over our outage is the product charging for its bad day.
Pinned by test. *Whether a fallback roll should refund is a founder question and
this line does not pre-empt it in either direction* — see the founder items.

### A second finding, not acted on

Long briefs **stochastically exceed the interpreter's 1800-token ceiling** and
are rescued by D-83's retry — 2 of 3 on one pass, 0 of 3 on the next. The
ceiling has already been raised 500 → 1200 → 1800, each time after a silent lock
loss, and the retry is now load-bearing on a majority of long briefs on a bad
sample. **Not sized off n=6.** Folded into the twitch role-null measurement pass,
which is already a live per-brief sampling harness at real n.

---

## 4. The stated-wardrobe confession (e)

> Casting sheets keep the studio tee — outfits come after Sign, in takes.

Fires on the viewed roll only. Shot: `04-wardrobe-confession.png`.

### The detector is deliberately NOT `mentionsGarments`

The advisor's steer was to reuse it. Reading it closely, that would make the line
**lie**: `GARMENT_WORDS` includes `earring`, `necklace`, `jewellery`,
`accessory` — and stated accessories are the framing law's one carve-out. They
*do* reach the picture. Confessing "outfits come after Sign" to someone who asked
for chunky glasses would claim we ignored the one instruction we honoured.

So `statedWardrobe.ts` carries a narrower list — worn clothing only — and a test
pins the divergence so the two lists are not quietly unified later:

```
never confesses over an accessory the sheet actually honours
  ✓ a dad in his 30s wearing chunky glasses
  ✓ a woman in her 40s, gold earrings
  ✓ a man with a chain and a wedding ring
  ✓ an idol, small nose stud
```

Whole-word matching is load-bearing: `it suits her` must not match `suit`,
`a printed brief` must not match `print`. Both pinned.

**Why a word list is allowed here at all**, when `briefCompiler` calls them
theatre: that criticism is about lists used as *spend guards*, where a wrong
answer changes what the user is charged for. This one decides nothing — the line
is unconditionally true whatever the brief said, so a false positive costs a line
of noise and a false negative reproduces today's silence. Neither can produce a
false statement.

---

## 5. One notice slot, not three lines

All three lines can be true at once. Stacked, they are how a quiet confession
becomes small print nobody reads — including the one that mattered. Precedence,
mirroring the dock's own chain, by how much the line changes what the user is
looking at:

**fell back** (this is not the sheet you asked for, and you paid for it) →
**wardrobe** (one stated instruction deliberately not followed) → **expiry**
(true, and about the sheet's future rather than its content).

Losing a lower line is acceptable by construction: expiry repeats on the lobby
card, and the wardrobe rule is permanent and said again next roll. Neither is a
one-shot.

---

## 6. The brief box grows (d, second half)

Past about sixty characters a single-line input scrolled the beginning of your
own sentence out of view — so a long brief could not be read before it was spent.

| Viewport | Brief | Lines | Scrolls | Dock visible |
|---|---|---|---|---|
| 1440 | founder-length, 334 chars | 2 | no | yes |
| 1440 | 900 chars | 4 (capped) | yes | yes |
| 1280 | founder-length, 334 chars | 3 | no | yes |
| 1280 | 900 chars | 4 (capped) | yes | yes |

Shots: `10-cap-1440.png`, `10-cap-1280.png`. The cap lives in CSS `max-height`
and the effect only measures the natural height, so one place decides the
maximum. **Dock visible without scroll** — the mechanizable design law from the
UI milestone contract — asserted at both widths.

---

## 7. Copy audit

Every user-visible string added, classified.

| String | Class | Note |
|---|---|---|
| "Casting sheets keep the studio tee — outfits come after Sign, in takes." | **founder-verbatim** | quoted from the queue item; ships as written |
| "The brief reader was unavailable — this roll was cast from your sentence as written, with nothing pinned." | **invented** | the founder's truncation copy was re-derived against capability truth (§3); this describes the event that actually occurs |
| "Your brief was longer than a casting note — the sheet used the first part." | **rejected** | describes an event that does not happen — caps measured at 0 firings |

No other user-visible string changed. The Sign confirm was checked while here and
already reads "Sign them to your roster" / "THEIR NAME" (queue item (i), verified
— the remaining "her" occurrences are internal JSDoc, which the pronoun lint
strips).

---

## 8. Gates

- `pnpm check` — clean.
- `pnpm test` — **4039 passed**, 318 files, 0 failed.
- `pnpm architecture:generate` + `check` — fresh; diff is exactly the four new
  modules and their tests, findings unchanged (298, 0 error).
- Process hygiene — verification server killed by tree, fixture removed from the
  dev database, temp scripts deleted.

## 9. Still open in this queue item

- **(c) echo accessories clause** — deliberately last. The advisor ruled against
  my closed-source-detector proposal in favour of a `statedAccessories` field
  mirroring `statedHair`, which makes it an **interpreter-prompt change**, and
  D-89 makes the live golden driver the permanent bar for those. Not a client
  sweep item; it ships with a driver run.
- **(f), (g), (h)** — each needs a ruling before building; see the founder note.
