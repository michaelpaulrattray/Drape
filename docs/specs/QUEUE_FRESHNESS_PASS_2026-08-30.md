# The queue freshness pass — read at the code, 2026-08-30

**Founder-ordered (#271), verbatim:** *"yeah we need a freshness path done to
find whats relevant and whats not."* Origin: *"some of these seem like they are
not relevant anymore double check against the codebase."*

This is the full pass the #271 spot-check asked for. **83 open cards**, one line
each — *built / partly built / obsolete / figure stale / still true* — plus the
three other populations the card's own comments added: `PROGRAM.md`'s
standing-exceptions ranking, `CLAUDE.md`'s founder quotes, and (found on the
way) the `urgent` label itself.

It is a **reading, not a build**. Nothing in the product changed.

---

## 0. The tree every row was read at, and why the sentence is here

**Every code claim below was read at `origin/main@dc93314b`.**

That is not a formality: #271's own §A had a row read off an uncommitted working
tree, and the correction on that card asks the full pass to state its tree. On
this machine two seats share one checkout, so *"the file on disk says X"* is a
claim and *"`origin/main` says X"* is the artifact.

**The discharge is mechanical rather than promised.** At the start of this pass:

```
git diff origin/main --name-only   →   CLAUDE.md
```

**One file, and it is a document.** Every `.ts`/`.tsx` in the tracked tree was
byte-identical to `origin/main@dc93314b`, so reading the disk *was* reading the
artifact for every code row here. Where a row is about `CLAUDE.md` itself, §3
says so explicitly and names the two unpushed commits.

---

## 1. THE FIVE ROWS THAT CHANGE WHAT A SHIFT WOULD DO

The other 78 are inventory. These five would have sent a shift somewhere wrong.

### 1.1 ⚠ #20 says "NOTHING IS BUILT" and it is BUILT, running, on both roads

The card's own header: **"STATUS: DESIGN REPORT, AWAITING COUNTERSIGN. NOTHING
IS BUILT."** It was ordered from a live founder walling mid-dogfood — he was
refused by his own product — so a shift picking it up would have built the
ask-twice double check a second time.

At the code:

| artifact | says |
|---|---|
| `server/castingV2/interpreter.ts:1037` | `export const COHORT_WALL_RETRIED = "cohortWallRetried";` |
| `interpreter.ts:1325` | `if (parsed.reason !== "unreadable") { const second = await runOnce(); … }` |
| `interpreter.ts:1336` | logs `rescued` / `walled` whatever happens — "the absence of a count is what let this hide" |
| `briefCompiler.ts:1216` | "Both are the reader's judgement taken twice (`cohortWallRetried`)" |

**And it covers the road the card was filed about.** `interpreter.ts:1320`
states the scope in as many words: *"the wall has three names on the author road
(`likeness`, `not_a_being`) and one off it (`unsupported_cohort`); all of them
are a MODEL'S JUDGEMENT and all of them get the second read."* So the
unflagged-account road the founder met is covered too.

It shipped inside **#131 slice C** — the creative register's own build — which
is why nobody closed #20: the card was never the vehicle. That is the path-three
shape pointed at the QUEUE instead of at a control. **Recommend: close #20,
citing the three line numbers.**

### 1.2 ⚠ #25's rate was measured BEFORE the thing that fixes it shipped

*"His cyborg brief is refused as a video-game character about 1 time in 7"* —
two walls in fifteen drives, measured 2026-08-25.

**#20's double read is exactly the remedy, and it is live** (§1.1). The card's
own evidence base predates it. `interpreter.ts:1300` records that the two reads
were tested for independence — *"the second one is a genuinely independent
draw"* — which is the arithmetic that makes a repeated draw worth anything.

The card is **not obsolete** — `unsupported_cohort` is still thrown
(`briefCompiler.ts:1208`) and a brief that fails both reads still walls. But
**1-in-7 is not the current rate and must not be quoted as one.** Re-measure
before any build.

### 1.3 ⚠ #15 is PARTLY BUILT, and #271's own §F mis-identified it

§F of #271 reads: *"#15 — the settings modal, designed with six founder rulings,
unbuilt. It is the founder's NEXT brief."* Both halves need correcting.

**Not unbuilt.** `client/src/features/castingV2/components/CastSettingsModal.tsx`
exists and its docblock names this card's own design doc as its source:

> THE MINIMAL SETTINGS MODAL (#142 …). The design it is cut from is
> `CASTING_SETTINGS_MODAL_DESIGN.md` §10 (his six rulings) …

That is PR #150, merged 2026-08-27, live at `users:1`. The remainder is the FULL
N3 modal (advanced settings, other art styles) — which is what `PROGRAM.md`
already says: *"the full modal with advanced settings and other art styles stays
in N3."*

**And it is not the next brief.** His new brief
`drape-redesign/03-settings-modal.md` is the **lobby account Settings modal** —
Profile / Billing / Usage / Security / Members, folding `ProfileSettingsModal`,
`BillingModal` and `ReferralModal`. #15 is the **casting roll-settings popout**.
Two different surfaces on two different pages. **Filing them as one card would
lose six founder rulings on one of them** — the exact failure §F was trying to
prevent, aimed at the wrong card.

### 1.4 ⚠ #234 is BUILT and still carries `urgent` — so the derived ranking's top band opens with finished work

`HeroDeck.tsx` is on `origin/main` (`2112b7d0`) and mounted at
`CastingV2.tsx:768`. `PROGRAM.md` already records it as built, merged and
deployed (`63734bcb`); #271 §A said the same. Its two deferrals have their own
cards — **#238 open, #240 closed.**

**Nothing on #234 itself is outstanding, and it sits fifth in the urgent band**
(§2). This is the ranking rot from §2 recurring one layer down: the *label* is
now the stale list. **Recommend: close #234, pointing at #238.**

### 1.5 ⚠ #63 is #120's twin, and #120's recommendation was never applied to it

#271 §C found #120 obsolete: it asks a shift to correct
`DEFAULT_CASTING_PATH` — still `wardrobe` at `shared/castingPaths.ts:76`,
confirmed today — on machinery **#203 carries his ruling to delete**
(*"yeah we will retire the wardrobe/basics path obviously"*).

**#63 is the same card in different words.** *"L&F: Basics-default courts 2 and
4 — court 1 built and HELD ON FUNDING"* — two unbuilt COURTS on the
wardrobe/basics default, i.e. paid measurements of a road he has ruled retired.
§C caught the instance; the class has two members. **Recommend: fold #63 into
#203 alongside #120**, and let #203's retirement decide both.

---

## 2. `PROGRAM.md`'s standing-exceptions ranking — all eight closed, now DERIVED

Read at the artifact, not asserted:

| # | state | closed |
|---|---|---|
| #54 refine lockKey | CLOSED | 2026-08-25T11:01Z |
| #39 suite green on CI | CLOSED | 2026-08-25T09:16Z |
| #41 the Crew tab | CLOSED | 2026-08-25T12:43Z |
| #40 the rebaseline | CLOSED | 2026-08-25T11:42Z |
| #38 face-scan cost model | CLOSED | 2026-08-25T12:51Z |
| #37 capability:check | CLOSED | 2026-08-25T09:17Z |
| #32 gitleaks | CLOSED | 2026-08-25T19:14Z |
| #33 Semgrep | CLOSED | 2026-08-25T22:28Z |

**Eight of eight, all on one day, five days ago.** The list that every shift
opens to decide what matters most pointed entirely at finished work — including
its own §1, *"right now #54, the refine lockKey … money path first"*, which had
closed before the sentence was five hours old.

**The repair is working law 4: derive, never mirror.**
`scripts/queue-standing-exceptions.mts` reads the ranking out of the queue's
`urgent` label. A card closing removes itself with no edit anywhere.

**Only band 1 is derivable and it is the one that rotted.** Bands 2 (blocks
every merge) and 3 (a patrol whose clock has fired) are judgements, not labels,
and stay prose in the Program — said out loud so the next seat does not read the
script's silence about them as their absence.

⚠ **A derived view inherits the labels' own honesty**, which §1.4 is the first
instance of. That is still strictly better than a transcription: a wrong label is
one field to fix, in the place the ranking is actually read from.

---

## 3. `CLAUDE.md`'s founder quotes — the fourth population

#271's fourth comment calls this *"the highest-value population in the pass,
because CLAUDE.md is what every agent reads as law — a superseded ruling there is
acted on, not merely believed."*

**One was already repaired before this shift, and is the reason the population
exists.** The MAX rule: the file carried a 2026-08-26 verdict as governing until
he read it back and said *"no that max statement is old thats not [it]."* Fixed
at `33f6d118`, with his current six lines and the finding that
`promptAuthor.ts` had implemented all six the whole time. Both that commit and
`485a12cf` (law 7c) are on local `main`, **unpushed at the start of this shift**
— they go out with this pass.

**This pass found one more, and it is the same shape.**

### ⚠ `CASTING_TWO_PATHS_SCOPE`'s entry does not know it has been retired

The entry (CLAUDE.md:627) is one of the longest flag paragraphs in the file. It
reads as a live road with a live future: ticks for `users:1` on production,
*"the road is COMPLETE"*, a numbered list of discharged preconditions, and **one
open item stated as a gate — "the `build`/`skin` honesty claim before BASICS
widens."**

**He ruled the whole thing retired on 2026-08-28** (#203, verbatim: *"yeah we
will retire the wardrobe/basics path obviously"*), and the author road had
already retired the toggle. `grep "retire the wardrobe" CLAUDE.md` → **no hit
outside this pass.** The word "retire" reaches the file only inside the
*creative register's* entry, about the switch not being drawn.

So a shift reading the flags section — which is how a shift learns what the
product does — meets a paragraph whose remaining work is *widening a road he has
ruled to delete*. That is #120 and #63's class a third time, and this time in
the file every agent reads as law.

**Repaired in this pass**: the entry now opens with his ruling and points at
#203, so the paragraph's history stays readable (rows written under it still
exist) while its FUTURE is correctly closed.

`PROGRAM.md` carries the same premise one layer up — *"basics is the default
birth state"* listed as a law riding in the focus's orbit — and is stamped in
the same commit.

**Not swept and declared as such:** the file holds well over a hundred dated
founder quotes. This pass swept the ones whose subject has a later card in the
queue (the tractable population). A quote superseded by a ruling that never
became a card is not reachable this way, and finding those is its own sitting.

---

## 4. The 45 from 2026-08-25 — one line each, read at the code

The population the founder asked about. `45 of 83` open cards were created on
2026-08-25 by the catalogue sweep; nothing had re-read them since.

**Verdicts: 4 changed class, 4 have stale figures, 37 are still exactly true.**

| # | verdict | read at |
|---|---|---|
| 4 | **still true** | no E1 court exists; only the design's own §0b mention |
| 6 | **still true** | four R7 flags at their recorded positions in `productionFlagPositions.mts` |
| 8 | ⚠ **figure stale** | card *"440 paths"*; measured **6,977 files / 484 dirs**. ~16× |
| 10 | **still true** | no ink-cut preview anywhere in `client/src` |
| 11 | ⚠ **figure stale** | card `T = 31.6%`; `framingTrimStep.test.ts:339` pins `FRAMING_TRIM_TARGET.headShare` at **0.230**. It moved twice since (#182's court, which he ratified). Its population figure — *"ONE sheet, roll 216"* — also predates five days at `users:1` and is not re-measured here |
| 12 | **still true** | `applySheetTaste` still called at `briefCompiler.ts:949`; `FACIAL_HAIR_BY_AGE` unchanged; repair unbuilt |
| 13 | **still true** | the `PHYSIQUE:` yield prose is verbatim at `cohortPhotorealHuman.ts:1563/1580` |
| 14 | **still true** | design doc present, no selector code |
| 15 | ⚠ **partly built + mis-scoped** | see §1.3 |
| 16 | ⚠ **title stale** | *"designed and unbuilt"* — built and live (`promptAuthor.ts`; `creativeRegister.ts` deleted). Stays open for his GATE, not for the build |
| 17 | **still true** | discussion draft, nothing scheduled |
| 18 | **still true** | direction only |
| 19 | **still true** | `surfaceCoverageUnread` exists only as an enum member in a migration test — no reader |
| 20 | ⚠ **BUILT** | see §1.1 |
| 21 | **still true** | awaiting countersign |
| 22 | **still true** | research, gated on his own sentence |
| 23 | **still true** | four designs, none built |
| 24 | **still true** | both evaluations present, no decision attached |
| 25 | ⚠ **figure stale** | see §1.2 |
| 26 | **still true** | `REFINE_INSTRUCTION_MAX_LENGTH = 200` at `shared/refineLimits.ts:25` |
| 27 | **still true** | 18 `maxLength=` sites in `client/src`, matching the card's own count |
| 28 | **still true** | 10 server test files carry `Simulate` |
| 29 | **still true** | the finish line; its tool (`diff-importer-count-across-time.mts`) present as the card says |
| 30 | **still true** | gated per §5c, behind #14 |
| 31 | **still true** | `bornInkMint` is the WORDS lane; 7b-ii (the sign-mint) absent |
| 35 | ⚠ **partly built** | **zizmor + actionlint are IN the gate** (`gate.yml:182`, via `scripts/workflow-lint.sh`). hyperfine, the bundle visualizer and Socket.dev remain |
| 45 | **still true** | parked to launch prep by his own word |
| 55 | **still true** | no refine stage-name surface in `features/castingV2` |
| 57 | **still true** | no refund execution trace; 20cr still owed |
| 58 | ⚠ **partly** | `docs/MACHINIST_LEDGER.md` exists (patrol #1 ran). The three founder-elevated orders remain a program |
| 59 | **still true** | `REFERENCE_INTENTS` names `makeup`, and `referenceSlotCatalogue.ts:65` still calls it *"the parked makeup"* — declared, not built |
| 60 | **still true** | no back-of-body vocabulary; the `backFull` hits are the legacy `backViewGate` |
| 61 | **still true** | no point-cutter anywhere |
| 62 | **still true** | `shared/referenceIntents.ts:88` — *"`hair.open` is `false`"* |
| 63 | ⚠ **obsolete-adjacent** | see §1.5 |
| 64 | **still true**, one citation drifted | the card's item (1) names `stopline --prove`; the module is `scripts/lib/stopline.mts` and no `scripts/stopline*` entrypoint exists. Fact unchecked, path wrong |
| 65 | **still true** | no words-only sale copy in the client |
| 66 | **still true** | its ORDERING is superseded by #228 for the cap's duration, which `PROGRAM.md` already says |
| 69 | **still true** | 3 docs in `docs/specs/` carry a supersession stamp; the sweep has not run |
| 70 | **still true** | no ElevenLabs code anywhere |
| 80 | ⚠ **partly built** | **`workflow_dispatch` with a PR input IS in `gate.yml:51`** — the manual re-trigger half shipped. The stall ALARM has not |
| 105 | **still true** | 53 files in `client/src/components/ui/`, consistent with 40 unused |
| 106 | **still true** | |
| 108 | **still true** | |
| 111 | **still true** | a reading brief; no fix proposed, none built |

---

## 5. The other 38 — recent, and mostly self-checked

Cards from 2026-08-26 onward. These were written by shifts that read the code as
they filed, several under law 7c explicitly, so the failure kind this pass exists
to catch is structurally rarer in them. **Spot-checked rather than swept, and
that limit is stated rather than implied.**

| # | verdict |
|---|---|
| 129, 179, 180, 190, 194, 202, 203, 209, 219, 220, 228, 231, 236, 238, 242, 243, 246, 249, 251, 252, 257, 262, 263, 265, 267, 268, 270, 271, 272, 274, 275, 276, 277, 279 | **recent — not re-read** |
| **234** | ⚠ **BUILT** — see §1.4. Recommend close |
| **260** | **still true** — 28 `SEVERITY_COLORS`/`CATEGORY_COLORS` hits remain |
| **261** | **still true** — `App.tsx:93` registers `/casting/foundation` with no guard |
| **278** | **still true**, line ref drifted — the mount is `CastingV2.tsx:389`, not `:578`; it carries no chrome props, exactly as filed |

---

## 6. What this pass does NOT license

- **It closes nothing.** Every recommendation above is a recommendation. Closing
  a founder-filed card is his, and the four that changed class are commented on
  rather than acted on.
- **It changed no product code.** Two documents (`CLAUDE.md`,
  `PROGRAM.md`) and one new read-only script.
- **#277's count is now defensible, not correct.** The panel's per-category
  count was the reason this was ordered first. After this pass the 83 are
  classified — but five of them want a founder decision before the count is
  honest, and until #20/#234 close, a count of "open urgent" still includes
  finished work.

## 7. Recurrence — the one-line version

Every failure kind in this pass is **a list transcribed from a source of truth
and then read as the source of truth**: the ranking transcribed from the queue,
§F's read of #15 transcribed from a card title, #120/#63/`CASTING_TWO_PATHS_SCOPE`
transcribed from a road he later closed, and #20's card transcribed from a design
that got built somewhere else.

Working law 4 already names it. What this pass adds is that **the queue itself is
subject to it** — a card is a report, and the code is the artifact, which is law
7c pointed at the system of record.
