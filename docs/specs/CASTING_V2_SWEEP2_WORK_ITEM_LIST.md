# Sweep #2 — every work item not yet live, on the CORRECTED population

> **Status: live.** A governing plan (PROGRAM.md) (#69 stamping sweep, 2026-08-28).


**Ordered by the founder, verbatim** (2026-08-25, relayed fable-1680):

> *"do another full sweep make sure nothing else like this is missed clearly the
> sweep you did initially wasnt good enough"*

**He is right, and the defect has a name.**

---

## §0 THE POPULATION CORRECTION — his catch, and why it was a class

Sweep #1's rollout-debt register derived its population from the **32 governed
flags**. That is a real population and its rows stand. But it can only see work
that has a flag — and **a designed-but-unbuilt thing has no flag yet, because a
flag is something you add when you start building.**

**He found two in ten minutes** — the Pinterest-style reference selector
(now #14) and the settings modal (now #15) — which is the correct test of a
census: not whether it is long, but whether the person who knows the product can
break it on sight.

**The corrected population is a UNION** (fable-1680), and it is stated here so
the next sweep inherits it rather than re-deriving it:

```
1  the 32 governed flags                     sweep #1's population — rows kept
2  every doc in docs/specs/ whose status is  279 read at their headers;
   not built-and-live                        96 name a not-yet-live status
3  POST_SIGN_ROADMAP.md's active queue       81 headings, 10 open rows
4  DECISION_LOG open/deferred + founder-queue
5  the capability atlas's KNOWN_DEBTS        13 enumerated doors
6  the mailbox's ordered-but-undischarged
7  CLAUDE.md's own ⚠ pending-build paragraphs
```

⚠ **AND THE CORRECTED POPULATION HAS ITS OWN BLIND SPOT, NAMED RATHER THAN
DISCOVERED LATER.** Of the 279 spec docs, **183 say nothing about their status at
all.** They are not thereby live. A doc that never wrote a status line is
invisible to a status grep exactly as an unflagged design was invisible to a flag
census — **the same blind spot in a new costume.** This sweep classified at the
words for the 96 that speak; the 183 silent ones are a known remainder and the
next sweep should start there.

`scripts/_sweep2-population-disposable.mts` derives it and **throws** if the
listing comes back short, so a failed read cannot present itself as a clean
sweep.

---

## §1 THE DELTA — what the corrected population found that flags could not

**This is the headline, because it is his question.** Sixteen work items, none of
which had a governing flag, and therefore none of which sweep #1 could see:

| item | state | where truth lives | issue |
|---|---|---|---|
| ⚠ **THE CREATIVE REGISTER** — the program's own centre of gravity | designed §1a–§5, **not built** | `CREATIVE_REGISTER_DESIGN.md` | **#16** |
| The Pinterest-style reference selector | countersigned, unbuilt | `OPEN_LANE_REFERENCE_SELECTOR_DESIGN.md` | #14 |
| The settings modal | designed, six founder rulings, unbuilt | `CASTING_SETTINGS_MODAL_DESIGN.md` | #15 |
| The Film Engine | discussion draft, nothing scheduled | `FILM_ENGINE_DESIGN.md` | **#17** |
| Takes | founder-endorsed direction, founder gates on pricing | `CASTING_TAKES_DESIGN.md` | **#18** |
| 7a-bis, the coverage reader | countersigned, **waiting on a NUMBER** | `CASTING_V2_7A_BIS_COVERAGE_READER_DESIGN.md` | **#19** |
| The cohort wall's double check | awaiting countersign, **court already run** | `CASTING_V2_COHORT_WALL_DOUBLE_CHECK_DESIGN.md` | **#20** |
| Dense-brief rationing | awaiting countersign; **supersedes a countersigned design** | `CASTING_V2_DENSE_BRIEF_RATIONING_DESIGN.md` | **#21** |
| Creative Casts research | research only, gated on his own sentence | `CREATIVE_CASTS_RESEARCH.md` | **#22** |
| The auto-scan prefill (3 OPEN decisions) | not built | `AUTO_SCAN_PANEL_DESIGN.md` | **#23** |
| The panel's absent state — **a founder ruling with an unbuilt executor** | not built | `PANEL_ABSENT_STATE_DESIGN.md` | **#23** |
| Open-kind properties | not built | `OPEN_KIND_PROPERTIES_DESIGN.md` | **#23** |
| Removal universality | not built | `V3_REMOVAL_UNIVERSALITY.md` | **#23** |
| Retro-mint evaluation | delivered, no decision attached | `RETRO_MINT_EVALUATION.md` | **#24** |
| The skin-thumbnail bench — **a PRE-REGISTERED BAR that was never run** | not run | `SKIN_THUMBNAIL_BENCH.md` | **#24** |
| The R7-7D ink/add pilot plan | plan for review | `CASTING_SYSTEM_R7_7D_INK_ADD_PILOT_PLAN.md` | #6 (R7 family) |

**And ten roadmap rows**, which the register also could not see because the
roadmap is not a flag:

| roadmap | item | issue |
|---|---|---|
| 3c | the brief has no skin lane → superseded by dense-brief rationing | #21 |
| 3d | ⚠ **his cyborg brief is refused as a video-game character ~1 in 7** | **#25** |
| 3e | the inspired EDIT is capped at 200 chars against a 2000-char BRIEF | **#26** |
| 3f | the client types its own copy of every server cap — 16 sites, one drifted | **#27** |
| 3g | the suite re-implements the product it tests — ~28 sites | **#28** |
| 5 | the two paths — live at `users:1`, one open honesty claim | #5 |
| 6 | cast-born ink discovery — **its population has just arrived** | **#31** |
| 7 | retirement + cleanup — **its missing tool now exists** | **#29** |
| 8 | the open-lane reference road | #14 |
| 9 | any-feature discovery, gated per §5c | **#30** |

**Sixteen new issues were opened by this sweep (#16–#31).** Every work item on
the corrected population now has one, which is the founder's ordered system of
record.

---

## §2 The three that should be read first, and why

Not a priority order for building — a reading order, because each one changes
what another means.

1. **#16, the creative register.** It is the program's centre of gravity, it had
   no issue at all, and #22's entire research programme is gated behind one
   flagged cyborg sheet passing his eye.
2. **#25 with #20.** His own brief is refused as a video-game character about one
   time in seven, and the design for the wall that refuses it is awaiting a
   countersign with a court that already ran and found the rate WORSE than the
   design assumed. **They are the same wall from two directions.**
3. **#24's bench.** A pre-registered bar is the most perishable artifact this
   program produces — it exists so a later run cannot move it, and every week it
   sits unrun is a week its subject may have changed underneath it.

---

## §3 What this sweep did NOT do, stated rather than implied

- **The 183 status-silent docs were not classified**, only counted. See §0.
- **`DECISION_LOG.md`'s open/deferred rulings were not enumerated one by one.**
  The log is thousands of lines and its open items are largely mirrored into the
  roadmap, which WAS read — but *largely* is not *entirely*, and this is the
  honest gap.
- **The capability atlas's `KNOWN_DEBTS` were read as a list (13 doors) and not
  opened individually.** Each is a work item by the order's own definition; they
  are enumerated in `scripts/capability-atlas-corpus.mts` and that list only
  shrinks, so it is self-maintaining in a way the others are not.
- **No item was judged on merit.** This is a census. The recommendations that
  exist live in `CASTING_V2_ROLLOUT_DEBT_REGISTER.md` for the flags, and in each
  issue for the rest.
