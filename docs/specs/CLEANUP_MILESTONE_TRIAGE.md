# The cleanup milestone — RECON, and nothing else yet

**Read-only reconnaissance, ordered fable-975 §5, taken 2026-08-18.** The
founder ordered this milestone in person (fable-710 §2, *"we have done so much
testing and changing of systems with this design"*) and its slot is after V5 and
M12's close-out and before M8 (`POST_SIGN_ROADMAP.md` §0b). M12 is
done-bar-verdicts, so this opens it WARM: **nothing here is deleted, no code
path is retired, no flag is touched.** Every line below is a reading with a
recommendation attached, so that when the milestone opens, the expensive half —
the triage — is already done.

---

## 0. THE FIRST FINDING IS ABOUT THE INSTRUMENT, NOT THE CODE

The sweep this milestone is budgeted against
(`scripts/sweep-uncalled-exports-disposable.mts`) **refused to run**:

```
CONTROLS
  positive  EYE_SHAPE_ENGINE          NOT FOUND  FAIL
REFUSED — the instrument failed its own controls; no verdict printed.
```

Its positive control named `EYE_SHAPE_ENGINE` — the founder-ratified routing row
the sweep was built around — and **he retired that row in person** (D-248,
fable-848). A grep now returns the sweep's own prose and nothing else. The
control died with the code it named, and the refusal is the instrument working:
a control that cannot be found is indistinguishable from a sweep that cannot
find anything.

**Repaired** with a specimen that cannot drift — `SYSTEM_PROMPT_FOR_TESTS`,
whose own NAME is the reason it will stay test-only, hand-verified as declared
once and imported by exactly two `.test.ts` files — with `catalogueBornWorn`
kept beside it as the independent second positive. One more repair rode along:
the label now prints from the same constant the control uses, because during
this recon the file printed `positive EYE_SHAPE_ENGINE ... PASS` for a run that
had tested something else entirely.

> **The class, for the milestone's own use:** an instrument whose control is a
> real specimen dies when the product retires that specimen. Prefer controls
> that are true *by construction* (a symbol named `...ForTests`) over controls
> that are true *by circumstance* (today's dead code).

---

## 1. THE UNCALLED EXPORTS — 175 candidates, and 64 of them are not candidates

Sweep, after repair: **431 production files · 3,104 named exports · 2,157
consumer files.** It prints two lists — 111 test-only and 64 named-by-nobody —
and says its own three biases (namespace imports, dynamic specifiers, barrel
re-exports) make the total a floor.

**That is true of the count and misleading about the work**, so this recon added
a second reader — `scripts/triage-uncalled-exports-disposable.mts` — which asks
of each symbol: *is there any non-test mention anywhere that is not its own
declaration, and of what kind?* Its own controls (`shouldSendGlobalAttackAlert`
must classify `none`; `isAccountLocked` must not, because it is reached as
`db.isAccountLocked` from two auth routes) both pass.

```
175 symbols off the sweep
  NONE     111   nothing but its own declaration and its tests — THE REAL LIST
  OTHER     23   some other production mention — a hand read decides
  BARREL    34   re-exported through server/db/index.ts and used as db.NAME(
  DYNAMIC    7   reached through await import("...") with a static specifier
```

**Every one of the 64 "named by nobody" entries has a production mention.** The
sweep's biases are not a theoretical caveat; they are 100% of its second list
and 37% of the total. Three that matter, because they are security-adjacent and
would have been read as dead controls:

| symbol | reads as | actually |
|---|---|---|
| `isAccountLocked` | named by nobody | `db.isAccountLocked` in `emailAuth.ts:238` and `googleAuth.ts:173` — **lockout is wired** |
| `recordFailedLogin` | named by nobody | `db.recordFailedLogin` in `emailAuth.ts:277` |
| `handleSlackInteraction` | named by nobody | `await import("../slack/slackInteractions")` in `_core/index.ts:225` |

**Recommendation: the reading list is 118, not 175** — the 111 test-only plus
seven of the OTHER entries, per the pass below. The 41 barrel/dynamic entries
need no reading at all, and exactly one OTHER entry turned out to have a
caller.

### 1a-pre. THE OTHER PASS — done, so the list is exact rather than approximate

All 23, read (ordered fable-976 §5). None of them cost more than a glance, and
two of them are findings:

| what the mention was | n | verdict |
|---|---|---|
| a sentence in a COMMENT naming the symbol (`rasterise`, `requestMatte`, `openKindZoneScope`, `openKindIsPlural`, `openKindDeparture`, `presentPair`, `isDistributed`, `HAIR_STYLE_NAMES`, `refusalTallies`) | 9 | prose, not a caller — **stays on the reading list** |
| a same-named LOCAL in a disposable script (`FACET_KEYS`, `stepLabel`, `cutOf`) | 3 | coincidence — **stays on the list** |
| an object KEY spelled like the symbol (`INSTRUCTION_MAY_OVERRIDE`, `OPEN_QUESTIONS`) | 2 | coincidence — **stays on the list** |
| a SUBSTRING of a longer symbol (`REFUSAL_REASONS` inside `GUARD_REFUSAL_REASONS`) | 1 | the reader's own bias, declared below — **stays on the list** |
| re-exported through a module barrel and imported by NOBODY from it (`getSessionCount`, `stopSessionEviction`, `clearAllUserSessions`, `_clearDedupCache`, `getDedupCacheSize`) | 5 | **stays on the list** — a re-export is a door, not a caller |
| a real consumer in a TRACKED script (`inspectStorageCleanupReconciliation`, used by `scripts/run-storage-cleanup.mts`) | 1 | **off the list** — it has a caller |
| **findings** (below) | 2 | **on the list, and named** |

**So the exact reading list is 118**: the 111 test-only, plus the 5
re-export-only, plus the two findings. One symbol — exactly one — left the list
because it had a caller.

⚠ **The reader's own bias, stated rather than discovered:** it matches on
substrings, so `REFUSAL_REASONS` was "mentioned" by `GUARD_REFUSAL_REASONS`. The
bias runs toward **not-dead** — it can keep a dead symbol on the maybe-alive
pile, never invent a dead one — which is the safe direction for a triage whose
next step is deletion.

#### The two findings

- **`beginInkAddIntent` is superseded, and its NAME is what hides that.**
  `server/routes/evidence.ts` declares a tRPC procedure called
  `beginInkAddIntent` — and imports `beginInkAnywhereIntent`, its successor. The
  client calls `trpc.evidence.beginInkAddIntent`, so every grep for the name
  finds a live path, and the function of that name has had no caller since the
  successor landed. **RETIRE candidate**, and the class is worth naming for the
  milestone: *a dead function whose name is also a live procedure's key reads as
  alive from every direction except an import graph.*
- **`STATED_WARDROBE_NOTICE` exists TWICE, and the live copy is the client's.**
  `server/castingV2/statedWardrobe.ts` declares the sentence and nothing imports
  it; `client/src/features/castingV2/sheetNotice.ts` declares the same sentence
  again and shows it. They are byte-identical today — *"Casting sheets keep the
  studio tee — outfits come after Sign, in takes."* — which is precisely the
  state law 4 describes before drift. **RETIRE the server copy** (or make the
  client import it), and read the neighbouring notices in the same sitting:
  `FELL_BACK_NOTICE` sits beside it and may be the same shape.

### 1a. The 111, by family, with a recommended disposition

| family | n | recommendation |
|---|---|---|
| test hooks by name (`...ForTests`, `reset...`, `...Stats`) | 9 | **KEEP.** A hook whose name says test-only is doing its job; the sweep cannot tell it apart and a human can. |
| contract assertions (`assert...`, `canTransition...`) | 8 | **KEEP, and check one.** These are the R7 status contracts; a `canTransition` with no production caller is either a guard nobody invokes (invariant 7) or a contract used only to prove the table. One read settles the family. |
| named constants (`SHOUTY_CASE`) | 15 | **INVESTIGATE cheaply.** A constant nothing imports is either dead or the thing a test pins a behaviour to; the second is legitimate and common here. |
| everything else | 79 | **INVESTIGATE, in file order.** `server/castingV2` holds 67 of the 111 — the newest and most-rewritten area, exactly as the founder's grounds predict. |

### 1b. Named for a first read, on evidence rather than on a hunch

- **`catalogueBornWorn`** — already owned by this milestone
  (`POST_SIGN_ROADMAP.md` §0b): read to the bottom, verdict is **wire-or-retire**,
  and a RETIRE lean goes to the founder as a card. ⚠ It is also this sweep's
  second positive control, so any change to it **chooses a replacement control in
  the same commit** — and after §0 that replacement should be a by-construction
  one.
- **`commitIdentityEdit` / `commitAnchorReRoll`** (`server/casting/identity/`) —
  test-only, and `batchC-sourceGuards.test.ts` asserts they must NOT appear in
  the iterate block. So the suite holds an opinion about where they may not be
  called while nothing calls them at all. **INVESTIGATE first**: either legacy
  superseded by V2 (M14's authority decides that, not this milestone) or a live
  authority path that lost its caller.
- **`shouldSendGlobalAttackAlert` / `markGlobalAttackAlertSent` /
  `recordGlobalFailedLogin`** (`server/security/rateLimit.ts`) — genuinely no
  production mention. This is the shape CLAUDE.md already documents for other
  controls ("helper written, docs written, call site never added"), and it is
  security-adjacent. **INVESTIGATE, and expect a wire-or-delete decision** —
  never a silent deletion, because a deleted alert looks identical to an alert
  that never fires.
- **`getRecentTopupCount` / `getRecentTopupCredits`** — barrel-reached, so not
  dead by import; but CLAUDE.md already lists credit-purchase velocity limits as
  *"helpers and Slack alert exist, no call site in the checkout path"*. The
  import graph cannot settle that one; the checkout path must be read.

---

## 2. THE UNTRACKED DISPOSABLES — 285 of them, and 25 are cited by tracked work

```
untracked files in the tree   292   (285 under scripts/)
cited by tracked content       25   docs, CLAUDE.md, tracked scripts or code name them
named by nothing tracked      260
dated                         2026-08-11 to 2026-08-18; 34 written on 2026-08-17 alone
```

**The 25 are the finding.** A disposable that a standing document names is not
disposable any more — it is an instrument the repository does not contain.

- **`scripts/slots-per-render-disposable.mts`** is the roadmap's own
  **mechanical shift-open trigger** (*"every shift OPEN runs the one-query
  coverage check"*, §1) — and it existed only on this machine. **PROMOTED with
  this document.**
- **`scripts/prove-refine-idempotency-disposable.mts`** was the same shape and
  was promoted earlier this shift, when fable-974 made it a standing regression.
- **`scripts/sweep-uncalled-exports-disposable.mts`** and its new companion
  `scripts/triage-uncalled-exports-disposable.mts` are promoted here too: this
  milestone is budgeted against a script nobody else could run.

**Recommendation, in this order:**

1. **PROMOTE** the remaining cited files, or retire the citation, per file — a
   document that names a dead script is the other half of the same defect.
2. **DELETE** the 260 nothing names, with one exception stated rather than
   discovered: the last two days' worth (66 files) belong to work still in
   flight, so the sweep runs at the milestone's own date rather than against
   this list.
3. `output/`, `errfiles.tmp`, `scripterrors.tmp`, `0`, and the two
   `FABLE_R7_*_REVIEW.md` files at the repository root are untracked debris —
   **DELETE**, after confirming the two review files are not the only copy of a
   review (nothing tracked names them).

---

## 3. THE NAMED FORKS

- **`client/src/components/ui/sidebar.tsx`** (from the L7 read, fable-823 §2) —
  a shadcn primitive nothing in `client/src` imports, and the product's only
  other cookie writer (`sidebar:state`, never set). Out of the sweep's scope,
  which is server exports. **DELETE candidate**, and the cookie inventory should
  be re-read in the same sitting so the deletion can be stated as *"the product
  writes one cookie"*.
- **The Manus CSP/SSRF remnant** (`files.manuscdn.com`, `*.cloudfront.net`) is
  NOT this milestone's: CLAUDE.md ties it to running
  `scripts/migrate-storage-urls.ts` against production at final cutover. Named
  here only so the next reader does not find it and think it was missed.

---

## 4. WHAT THIS RECON DID NOT DO

No export was deleted, no flag retired, no spec section marked superseded, and
no Atlas retirement view consulted for a removal — the Atlas remains the
deletion authority when the milestone opens, and nothing goes while its
retirement view shows live callers. The only edits this recon made were to its
own two instruments: repairing a dead control, and stopping a reader from
counting its own prose as evidence.

---

# THE MILESTONE PROPER — the reading, and the first removals

**Opened 2026-08-18 under fable-978/979.** The recon above is the input; this
half is the reading it ordered, the dispositions it produced, and the two
commits that discharged the ruled ones. Everything below was read against the
source, not against the recon's prose.

## 5. THE MECHANICAL CUT — none of the 175 is used inside its own module

The cheapest reading in the milestone, and it removes a whole disposition from
the table. For each symbol, how many lines of its OWN file name it:

```
CONTROL  positive  WORN_CLOTHING_WORDS (declared + used in-file)   2   pass
         negative  ZZZ_NOT_A_SYMBOL                                0   pass
RESULT   175 of 175                                                1   declaration only
```

**So "un-export it, keep the code" is never the answer for any entry on either
list.** Every symbol is keep-for-tests or dead, with nothing in between.

## 5a. THE DECLARED/SILENT SPLIT — `scripts/triage-declared-intent-disposable.mts`

A large share of these symbols answer the milestone's question in their own
docblock ("Test seam: …", "Exported for the contract test", "for the
reverse-direction test", "never used at runtime"). The instrument reads the
comment block immediately above each declaration and asks only whether it names
a test, a suite or a report.

```
CONTROLS
  positive  SYSTEM_PROMPT_FOR_TESTS    DECLARED   pass
  negative  isBilateral                SILENT     pass

111 symbols read
  DECLARED   18   the declaration names a test, suite or report
  SILENT     93   no stated reason — this is the reading list
  NOT FOUND   0
```

⚠ **Its bias, stated rather than discovered: it reads only the NEAREST comment
block, so a symbol carrying two adjacent blocks is judged on the closer one.**
`COHORT_CONSTANT_MARKERS` reads SILENT although a block above it says "Exported
for the contract test". **The bias runs toward SILENT** — it inflates the
reading list and can never shrink it — which is the safe direction, the same
way the recon's substring reader was biased toward not-dead. `DECLARED` is a
floor; `SILENT` is a ceiling.

⚠ **And the eyeball estimate this instrument was built to check was WRONG.** A
docblock dump of the castingV2 entries read as though *most* declared their
intent; the measurement says 16%. The dump showed the striking ones. Filed
because the milestone's remaining budget was about to be set from that
impression.

## 5b. NO DEAD MODULES — the disposition is per-symbol

| module | exports | flagged | production importers |
|---|---|---|---|
| `maskGeometry.ts` | 37 | 7 | 8+ |
| `axisRegistry.ts` | 28 | 4 | 2 |
| `maskedRefine.ts` | 23 | 4 | 8+ |
| `openKindPolicy.ts` | 20 | 9 | 3 |
| `zoneScope.ts` | 9 | 4 | 4 |

**No file on this list can be deleted whole**, which is worth knowing before
anyone budgets the milestone in files rather than in symbols.

## 6. THE FAMILIES, with dispositions

### 6a. Derived views the test asserts the TABLE through — **KEEP, as a family**

`axesOnShelf`, `edgeTableNames`, `fringeTableNames`, `neighbourTableNames`,
`segmentableRegionNames`, `namingTableFacets`, `exemptSubjects`,
`neighbourPairs`, `arrangementsWithPrecedent`, `unmeasuredAmplitudes`,
`unprotectedFacets`, `facetsWithUnreliabilityPrior`, `unreadFacts`,
`splitByInheritance`, `courtSeparationFor`, `REFUSAL_REASONS`, `VACANCY_KINDS`,
`FACET_KEYS`, `COHORT_CONSTANT_MARKERS`.

One says it in its own docblock — *"Facets declared in the edge table — for the
reverse-direction test"*. **Deleting these pushes their tests back onto
hardcoded lists, which is law 4 in reverse** and precisely the drift the
derivations were built to stop.

### 6b. Contract assertions — **KEEP; the derive is a BUILD, filed** (fable-979)

The eight assert/canTransition exports of `evidenceCandidateContract.ts` are
imported by their own test alone, while the module around them is imported by
**21 production files** for its status arrays and types.

**The transition table is not the enforcement.** The writers enforce in SQL,
every time:

```
inkAddCandidates.ts:1223  .set({ status: "generating" })   … WHERE status = "planned"
                  :1319  .set({ status: "probe_failed" })  … WHERE status = "stored"
                  :1394  .set({ status: "probe_passed" })  … WHERE status = "stored"
```

So `CANDIDATE_TRANSITIONS` is a second copy of that rule in TypeScript, proven by
its own test and consulted by nobody. **Disposition: KEEP** — it is also the only
place the machine is written whole, and a deleted state machine looks identical
to one that was never specified. **Filed as a post-milestone build: make the SQL
writers take their predecessor FROM the table**, so the mirror becomes a source.

### 6c. Test seams and hooks by name — **KEEP** (9, unchanged from §1a)

## 7. TWO FINDINGS ABOUT LIVE CODE, neither of them a deletion

### 7a. `INSTRUCTION_MAY_OVERRIDE` is declared, tested, and applied by nothing

`zoneScope.ts:99` declares that the INSTRUCTION can override a facet's scope, with
the audit's own reasoning beside it (*"scope is a property of the facet AND the
instruction"*):

```
marks : default distributedFacet → override "object"           (a single named scar)
ink   : default object           → override "distributedFacet" (a sleeve)
```

**The applier does not exist.** The only production consumer of scope is
`maskedRefine.ts` → `scopedZone(facet, region)`, which takes **no instruction
argument at all** and switches on `zoneScopeOf(facet)` alone. The table's only
other mentions are its own test — which asserts the table's CONTENTS, a pure
mirror test — and a documentation row inside `openKindPolicy`.

So *"a scar on her cheek"* takes the `distributedFacet` branch and is dilated 48px
and rendered whole, where the table says it should be scoped as an object.
**Invariant 7's shape in live geometry, not a dead export.**

⚠ **NOT claimed: that this is visible.** No frame has been put in front of
anyone, and the repaint road renders full-frame, so it is a paste-road question
at most. What is proven is that **the rule is not invoked**; the consequence is
unmeasured.

### 7b. The `openKind*` accessors are a POLICY RECORD, not a policy engine

Nine of `openKindPolicy.ts`'s twenty exports are per-property accessors.
Production imports exactly three things from the module — `isOpenKindKey`,
`openKindNoSpecimenReason`, `openKindPresenceBindsToday`. The nine are not
ignored: they are **quoted in comments by the code that implements their answers
independently**.

```
inheritedVerdict.ts:94         "…and `openKindZoneScope()` answers `fullFrame` — so there is no…"
referenceSlotCatalogue.ts:1178 "`openKindZoneScope()` is `fullFrame`, and `ownSide` is meaningless…"
```

**Disposition: KEEP** — it is the open lane's written answer sheet and D-241's
road is young. **Filed with 7a as one class: a policy stated in one place and
implemented in another, with a comment as the only join.**

### 7c. A disposition already written in the code, honoured

`OPEN_QUESTIONS` (`zoneScope.ts:108`) is an empty map with its reason inline —
*"Kept as an empty map rather than deleted… the next one added has somewhere to
go"*, founder-ruled 2026-08-06. **KEEP, no further reading.**

## 8. WHAT WAS REMOVED, and what each removal cost

### 8a. The server's duplicate `STATED_WARDROBE_NOTICE`

Declared twice, byte-identical, and only the client's was ever read:
`rollProjection.ts:488` sends the BOOLEAN and `sheetNotice.ts` owns the sentence.
The server's copy was imported by nothing — **not even a test**. Deleted; the
reasoning that stood over it moved to the surviving declaration rather than being
deleted with it.

**`FELL_BACK_NOTICE` is NOT the same shape** — single-copy, declared beside the
function that uses it. The recon flagged it as possibly a sibling; it is not.

### 8b. `READ_PURPOSES` — **derived, not deleted** (fable-979)

It was annotated `: readonly ReadPurpose[]`, which rejects an array member that is
not a purpose and says **nothing** about a purpose missing from the array. A
thirteenth `ReadPurpose` would have compiled and quietly fallen out of every
sweep that walks the list. Now `satisfies` keeps the first direction and a
type-level `AssertNever<Exclude<…>>` buys the second.

**Its control was driven, not assumed:** removing `"gate"` from the array while it
stays in the union gives

```
server/providers/types.ts(396,15): error TS2344: Type '"gate"' does not satisfy the constraint 'never'.
```

and restoring it returns `tsc --noEmit` to exit 0.

### 8c. `beginInkAddIntent` and its private ring — its own commit (fable-979)

The placement-picker intent (`{ sourceAssetId, side }`), superseded by
`beginInkAnywhereIntent` (`{ instruction }`). The route that still carries its
NAME — `evidence.beginInkAddIntent`, kept because the client calls it — has
validated an `instruction` and called the successor since that landed, **which is
why the dead function reads as alive from every direction except an import
graph.**

Removed with it: `InkAddIntentDependencies` (its one live borrower,
`InkAnywhereIntentDependencies.warnAuthorizationUnknown`, now names a local type),
`closedIntentResult`, and the private `classifyInkAdd` whose only caller it was.

> **The tests were RE-POINTED, not deleted — and that is the finding.** Five tests
> drove the dead function. Three of them were the only coverage anywhere of
> branches that exist in the LIVE function: **the flag door, the operation replay,
> and warn-once on unavailable authorization truth.** Deleting the dead road's
> tests would have taken three live branches' only coverage with it. Each was
> re-pointed at `beginInkAnywhereIntent` and **each reddens ALONE under its own
> sabotage** (door removed → only the door arm fails; replay branch falling
> through → only the replay arm; the warn call disabled → only the warn arm).
>
> **The class, for the rest of this milestone:** when a dead road's tests are
> deleted, ask which of them were testing the LIVE road through the dead one. A
> superseded function and its successor usually share their scaffolding.

### 8d. THE SECOND RING — filed by name, deliberately NOT taken

Deleting `beginInkAddIntent` orphans a further ring that this commit stops short
of, because each item needs something this sitting did not have:

| symbol | why it is held |
|---|---|
| `commitBeginInkAddIntent` (`db/inkAddIntents.ts`) | its only remaining consumer is `r7-ink-add-lifecycle-db.test.ts`, which uses it to BUILD intents for the whole downstream lifecycle — and that suite **skips without `TEST_DATABASE_URL`**. Rewriting its setup onto `commitBeginInkAnywhereIntent` would ship an unverified rewrite of a suite that cannot be run green here. **Needs a disposable database.** |
| `BeginInkAddIntentResult` | dies with the above |
| `buildInkAuthorizationProviderConfig` | now test-only; it will appear on the NEXT sweep, which is the honest way for it to arrive |
| `authorizeInkAddDescription` + `composer/inkAuthorization.ts` | the placement-picker road's whole authorization module, with its own suite. A module-sized retirement, not a symbol-sized one — **and `inkAddRecipe.ts` is already marked retire with 18 remaining callers in the Atlas.** |

**Not a deferral without an owner:** these are named here with their blockers, and
the first two are unblocked by exactly one thing (a disposable database).

## 9. THE SECURITY FAMILY — read, and going to the founder as ONE card (fable-979)

Neither is a deletion the milestone may take on its own, because **a deleted alert
and an alert that never fires look identical**.

- **`recordGlobalFailedLogin` / `shouldSendGlobalAttackAlert` /
  `markGlobalAttackAlertSent`** (`server/security/rateLimit.ts`) — zero production
  mentions, and `docs/RATE_LIMITING.md:285-294` carries a worked example of the
  wiring **that was never done**. Documentation of a call site that does not exist
  reads as a live control to anyone auditing.
- **`getRecentTopupCount` / `getRecentTopupCredits`** (`db/moderatorQueries.ts`) —
  barrel-reached, no caller; `SlackAlerts.velocityLimitHit` exists with no caller;
  and `server/velocityLimits.test.ts:108` asserts **that the alert is a function**.
  A suite that proves a control exists and never that it fires.

Both are already in CLAUDE.md's *"Currently not enforced — do not rely on these"*
list. **A deletion changes what that list means**, so the choice is the founder's:
wire them, or delete them and say so in that list.

## 10. THE CLASS both §7 findings belong to (ruled fable-980)

> **A policy stated in one place and implemented in another, with a comment as
> the only join — the record and the behaviour agree today and nothing holds
> them together.**

Two instances found in one pass, and both cite this line: `INSTRUCTION_MAY_OVERRIDE`
(§7a) and the `openKind*` accessor family (§7b). It is law 4's cousin: not a second
LIST shadowing a source of truth, but a second STATEMENT of a rule, in prose or in
a table, that no execution path consults. It fails the same way — silently, at the
moment somebody changes one side.

**Where to look for more of it:** any table or accessor whose only importer is a
test, whose values are ALSO quoted in a comment somewhere in the production path.
The comment is the tell — it is what a developer writes when they have read the
policy, agreed with it, and implemented it by hand.

### 10a. §7a's card carries one more fact than the finding does (fable-980)

`scopedZone` is on the **PASTE road**, and the paste road is the legacy one —
`CASTING_REPAINT_SCOPE` supersedes it, and a repaint renders full-frame with no
mask scoping at all. So the honest repair may be **"the road retires"** rather
than **"the override wires"**, and that choice belongs to the road's own
planning, not to a cleanup milestone. The finding is filed; the fix is not this
milestone's to choose.

---

## 11. THE CORRECTION — the reading list is 98, not 118, and the recon's own
## finding is why

**§1 above is wrong, and it is wrong in the way §1 itself warned about.** The
recon proved that 100% of the sweep's *named-by-nobody* list (64) had production
mentions — and it did not re-run that check against the sweep's OTHER list. **It
fixed the instance and not the class** (law 7).

The arithmetic hid it. The sweep prints a TEST-ONLY list that was **111** long.
The triage reader classifies all 175 into four buckets, and its **NONE** bucket
was **also 111** at that moment. They are different sets. §1's *"the reading list
is 118 — the 111 test-only plus seven of the OTHER"* silently used one 111 where
it meant the other.

Crossed properly:

```
sweep TEST-ONLY 111  →  NONE 75 · OTHER 21 · BARREL 11 · DYNAMIC 4
```

### 11a. Thirteen entries on the reading list have live production callers

Verified at the call site, not from the reader's classification:

| symbol | live caller |
|---|---|
| `adjustUserCredits` | `lib/adminActions/directActions.ts:219`, `changeRequestActions.ts:288` |
| `updateUserRole` | `routes/admin/roles.ts:35` |
| `listAllUsers` | `routes/admin/users.ts:296`, `routes/moderator.ts:137` |
| `getUserFullDetails` | `routes/admin/users.ts:331` |
| `getUserStatistics` | `routes/admin/users.ts:323`, `routes/moderator.ts:182` |
| `unblockIp` | `routes/admin/ipBlocking.ts:81`, `directActions.ts:180` |
| `getBlockedIps` | `routes/admin/ipBlocking.ts:134`, `routes/moderator.ts:107` |
| `getFlaggedReferrals` | `routes/moderator.ts:403` |
| `expireStalePendingReferrals` | `_core/index.ts:307` |
| `getFilteredAuditLogs` | `routes/admin/auditLogs.ts:17,65` |
| `getAbuseAlertsSummary` | `routes/admin/auditLogs.ts:36`, `routes/moderator.ts:36` |
| `getAuditStatistics` | `routes/admin/auditLogs.ts:43`, `routes/moderator.ts:43` |
| `getAuditLogById` | `routes/admin/auditLogs.ts:51` |

Every one is reached as `const { X } = await import("../../db")` — a **dynamic
barrel import**, which is the sweep's declared bias arriving on the list it was
not checked against.

**Admin credit adjustment and admin role changes are live.** A triage opened
against the uncorrected list would have spent its first hour proving that, which
is the recon's three-security-controls finding one size larger.

### 11b. Two BARREL entries are NOT live, and both are findings

- **`mintModelAtomically`** (`db/models.ts:134`) — no mention anywhere outside its
  own file and the barrel, and its docblock reads *"Mint a model on export —
  assigns agencyId and locks the identity. **Called when a user exports their
  model for the first time.**"* **A docblock asserting a call site that does not
  exist** — the same shape as `docs/RATE_LIMITING.md`'s worked example of wiring
  that was never done, this time on a mint that claims to lock an identity.
- **`markModelAssetsStale`** (`db/models.ts`) — one COMMENT mention in
  `mintPackage.ts:805`, no caller.

### 11c. The class, for anyone building the next sweep

> **Two lists that are the same LENGTH are not the same LIST.** The conflation
> survived a written recon because both numbers were 111 and the sentence joining
> them read as arithmetic. Where two instruments' outputs are combined, combine
> them **mechanically and print the intersection** — a number carried across a
> paragraph in prose is a claim about a join nobody performed.

---

## 12. THE INTERSECTION IS NOW PRINTED BY THE SWEEP — and it corrects §11 too

**Ordered fable-982 §3**, and building it found a SECOND error in §1, in the
opposite direction from §11's.

The classifier moved to `scripts/lib/productionMention.mts`, imported by both
instruments, and the sweep now ends by asking it about every symbol it flagged
and printing the join itself:

```
INTERSECTION CONTROLS
  positive  shouldSendGlobalAttackAlert → none    PASS
  negative  isAccountLocked             → barrel  PASS

THE READING LIST - 110 of 175 flagged
  with a production mention  65  (barrel 34 - dynamic 7 - other 24)
  nothing but a declaration  110   <- THE LIST
```

Split by which of the sweep's two lists each came from:

```
test-only        111  →  77 on the reading list
named-by-nobody   64  →  33 on the reading list
```

### 12a. §1's other claim was also wrong: **33 of the 64 have no mention at all**

§1 says *"Every single one of the 64 'named by nobody' entries has a production
mention."* **It is not true of 33 of them.** Hand-verified rather than taken from
the classifier:

```
verifyBackView    declared server/casting/backViewGate.ts:106 — no other mention anywhere
isTasteWritable   declared server/castingV2/axisRegistry.ts:1092 — no other mention
pairSlots         declared server/castingV2/facePanel.ts:911 — no other mention
```

So the recon was wrong in **both** directions: §11 showed it kept thirteen LIVE
symbols on the reading list; this shows it removed thirty-three DEAD ones from
it. Both errors have the same cause — a join performed in prose — and both are
now impossible to make, because the join is printed by the instrument.

### 12b. And §11's own figure of 98 inherited the false premise

§11 derived *"111 − 13 = 98"* while quoting §1's 100% claim as established. **The
figure to use is the sweep's own printed one.** The strict reading is **110**,
and the remaining hand work is the **OTHER bucket (24)** — a mention that is a
COMMENT is not a caller, and only a person can tell those apart. The recon's
OTHER pass (§1a) already did that for 23 of them and kept 20 on the list.

> **The class, sharpened:** §11c said combine mechanically. This says why it
> matters twice over — **a prose join fails in BOTH directions, and neither
> failure announces itself.** One left admin credit adjustment on a deletion
> list; the other hid a third of the dead code from the milestone that was
> looking for it.

---

## 13. THE EXACT LIST, BY AREA — and the tail outside casting is read

With the intersection printed rather than reasoned, the milestone finally has a
list it can be budgeted against:

```
110  server/castingV2 65 · server/casting 31 · server/db 7 · server/security 3
     · server/monitoring 2 · server/slack 1 · server/testing 1
```

The 14 outside `casting`/`castingV2` are read here, because they are the ones a
casting-shaped reading would never reach.

### 13a. Underscore-prefixed test seams — **KEEP** (4)

`_clearCooldowns`, `_getCooldownCount` (`monitoring/healthMonitor.ts`),
`_clearPendingActions` (`slack/slackApproval.ts`), `allowColdImports`
(`testing/coldImportTimeout.ts`). The leading underscore is this codebase's own
convention for a seam, and `server/testing/` is test infrastructure by
directory. The sweep cannot see a convention; a human can.

### 13b. The security three — the founder card of §9

`recordGlobalFailedLogin` / `shouldSendGlobalAttackAlert` /
`markGlobalAttackAlertSent`. Unchanged from §9: wire-or-delete, his call.

### 13c. THE FINDING — `removeEdgesForItems` is the deletion path's other half,
### and nothing calls it

`server/db/boardEdges.ts:79` exists to remove the edges belonging to deleted
board items. **The deletion path does not call it.**

```
routes/boards.ts:339  deleteItems  →  db/boards.ts:610  deleteBoardItems
                                      deletes boardItems, and only boardItems
drizzle/schema.ts:1894  boardEdges.sourceItemId / targetItemId
                        plain int columns with indexes — NO foreign key,
                        so no ON DELETE CASCADE is doing it either
db/boardEdges.ts:22     getBoardEdges(boardId) selects every edge on the board
                        with no join to items — orphans are RETURNED
```

So deleting an item leaves its edges in the table and in the payload. **Three
readings, no join between them, and each was taken from the file rather than
recalled.**

⚠ **NOT claimed: that a user sees anything.** React Flow drops edges whose
endpoints are absent, so the likely surface cost is nothing and the likely real
cost is unbounded row growth on a table nobody prunes. **What is proven is that
the helper written for this exact path is not invoked** — invariant 7, and the
THIRD instance this milestone has found (after `INSTRUCTION_MAY_OVERRIDE` and
the security alert family).

**Disposition: NOT a deletion.** `removeEdgesForItems` is the fix, not the
debris — wiring it into `deleteBoardItems`'s transaction is a one-line build
with an owner, and it is filed as one rather than taken here, because a boards
write path is not a cleanup milestone's to change on its own reading.

### 13d. The rest of `server/db` — INVESTIGATE with the milestone's own list (4)

`listSegmentHistory`, `listOrphanedVariants`, `dbReferencePlateIngestionPersistence`,
`inspectOwnedInkAddAvailability`, `getStorageCleanupBatchByOperation`,
`getStorageCleanupItemsForBatch` — reporting and inspection helpers around
casting V2 and the cleanup worker. Each needs the same question asked of it as
§13c: *is this debris, or the unwired half of something?* — and after `removeEdgesForItems`
that question is no longer rhetorical.
