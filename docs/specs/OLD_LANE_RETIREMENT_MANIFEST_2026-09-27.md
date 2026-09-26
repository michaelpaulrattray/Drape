# THE OLD LANE RETIREMENT — the manifest, written before anything is deleted

**His word, Crew reply #228, 2026-09-26 23:06:38Z, verbatim and entire, on card
#1398 (*"The old casting lane is switched off for everyone — do we delete it?"*):**

> **Delete it**

**What that authorises, in #1398's own words:** *"the old lane comes out of the
product, and so does the switch that used to choose between the two."* Both
halves — the house-road WRITE path, and `CASTING_CREATIVE_REGISTER_SCOPE`
itself. A production flag position is his word alone (PROGRAM.md); this sentence
is that word, and nothing here widens it.

**Why a manifest before a branch:** his own rule, and this program's — a
deletion is the one kind of change a gate cannot give back, so the population is
written down and read before it is touched. Every figure below was read at the
code or at the live service on 2026-09-27, and each says where. The ghost audit
re-read (`GHOST_AUDIT_2026-09-23.md`, from the line headed *THE RE-READ*) is
this manifest's source for the row counts and for the two rows that read as
deletions and are not.

---

## ⚠ THE ONE FINDING THAT DECIDES WHETHER THIS RETIREMENT IS SAFE

**The word `authorRoad` names TWO different things, and one of them must never
be deleted.** Read at the code:

| | derived from | lives for | in the retirement |
|---|---|---|---|
| **the WRITE road** | the FLAG (`captureCastingCreativeRegisterEnabled`) | the length of one roll | **DIES** — collapses to always-author |
| **the READ road** | the ROW (`compiledBrief.register.kind === "author"`) | forever | **STAYS** |

The read road is `rollComposedOnAuthorRoad` (`server/castingV2/rollProjection.ts:486`),
and it reads the row's own compiled brief — never the flag. **220 of 306
production sheets have no `register` at all or `register.kind` that is not
`author`** (counted read-only on production by the ghost audit's re-read,
2026-09-26: total 306 · `author` 86 · no register 216 · `house` 2 ·
`creative` 2). The newest of those 220 is 2026-08-26. **They read through that
function for good**, so the line this retirement must not cross is exactly:
**the WRITE path can go, the READ path cannot.**

⚠ **AND BOTH ROADS MEET IN ONE FILE, UNDER ONE NAME.**
`client/src/pages/CastingSheet.tsx` holds both:

- `:1039` — `const authorRoad = config.data?.authorRoadEnabled === true;` — **the
  flag. Dies.** Passed on at `:913`, `:939`, `:1040`, `:2568`, `:2569`, `:2604`,
  `:2876`.
- `:2211`, `:2561` — `roll.data.authorRoad` — **the row. Stays.** Passed to
  `SheetNotice` and `BriefEcho`.

So a shift collapsing `authorRoad` **by name** in that file deletes the read
path in the same edit that collapses the write path, with no test naming the
word and no error at the wire — and the 220 sheets would start reading as
author-road rows. **Every slice below names which of the two each site is, and
no slice is cut by grepping the word.**

Downstream, the same split runs through the feature modules:

| module | its `authorRoad` is | fate |
|---|---|---|
| `client/src/features/castingV2/chipEdit.ts` (`:70`, `:87`, `:119`) | the FLAG — fed from `CastingSheet:1039` | dies |
| `client/src/features/castingV2/briefEcho.ts` (`:202`, `:358`) | the FLAG — via `BriefEcho`'s prop | dies |
| `client/src/features/castingV2/components/BriefEcho.tsx` (`:130`, `:144`, `:156`) | **BOTH** — `authorRoad` prop is the ROW (`:2561`), `VaryPolicy.authorRoad` is the FLAG (`:2569`) | split |
| `client/src/features/castingV2/sheetNotice.ts` (`:35`, `:42`, `:124`) | the ROW — its own docblock says `RollProjection.authorRoad` | **stays** |

## ⚠ THE SECOND ORDERING FACT: THE FLAG HAS A CHILD, AND THE CHILD CRASHES THE BOOT

`CASTING_CREATIVE_REGISTER_SCOPE` is the parent of exactly **ONE** sub-flag —
`CASTING_CONCEPT_UPLOAD_SCOPE` — and it is the only flag in `server/_core/env.ts`
whose parent is not `CASTING_V2_SCOPE`. Read at the code, not at the catalogue:

- `server/castingV2/castingV2Scope.ts:2605` — `captureCastingConceptUploadEnabled`
  ends `return captureCastingCreativeRegisterEnabled(userId);`
- `server/castingV2/castingV2Scope.ts:2615` — `validateCastingConceptUploadEnvironment`
  parses the register as its `parent` and **throws** when the parent is `off` or
  narrower than the child.
- `server/_core/env.ts:578` — that validator is called at boot with
  `registerScope: process.env[CASTING_CREATIVE_REGISTER_SCOPE_ENV]`.

**So deleting the register variable from the service while that code stands is a
crash-looping deploy**: the variable reads `undefined` → parses `off` → the child
is `all` → `CastingConceptUploadCoverageError` → the boot refuses. That is the
`unset-a-scope-chain-child-first` class, and it is why the re-parent is slice 1
and not a tidy-up inside slice 2.

Live positions, read at the service 2026-09-27 (`railway variables --service Drape`):

```
CASTING_V2_SCOPE                 = all
CASTING_CREATIVE_REGISTER_SCOPE  = all
CASTING_CONCEPT_UPLOAD_SCOPE     = all
```

All three `all`, so **the re-parent is behaviour-identical on production** — the
child's gate goes from `all AND all` to `all`, which is the same answer for every
account. It is not a widening asked for by anybody: the child's stated reason for
having the register as its parent is that *"the house block is appended by code
on the author road alone"*, and once every account is on that road the casting
parent carries the whole of that reason.

---

## THE SLICES

Five, in this order, each its own card and its own PR. **Nothing new is folded
into any of them** — his rule, quoted on #1398: *"I would not fold anything new
into it — a retirement that also adds a feature is how a half-built thing ships
under a cleanup's name."*

### SLICE 1 — re-parent the concept-upload flag onto `CASTING_V2_SCOPE`

**Why first:** the ordering fact above. Nothing else can move until the child no
longer names a parent that is about to leave.

| file | what changes |
|---|---|
| `server/castingV2/castingV2Scope.ts` | `captureCastingConceptUploadEnabled` calls `captureCastingV2Enabled`; `validateCastingConceptUploadEnvironment` takes `castingScope` and parses `CASTING_V2_SCOPE`; both error messages name the new parent |
| `server/_core/env.ts` | the call site passes `castingScope` |
| `server/castingV2/conceptUploadScope.test.ts` | the parent arms re-pointed — **including the negative arm** (child `all` under a parent that is `off` still refuses) |
| `scripts/lib/productionFlagPositions.mts` | the concept-upload row's `why` records the re-parent and his word |
| `docs/architecture/FEATURE_FLAGS.md` | the same, in the child's entry and in the register's |

**Behaviour on production: none** — proven by the three `all`s above, and the
suite keeps a positive control (a narrower parent still refuses) so the arm
cannot pass by being inert.

### SLICE 2 — the house-road WRITE path comes out of the server, and the flag with it

**One act, deliberately.** Collapsing the code while the flag still exists ships
a flag the product ignores; deleting the flag while the code reads it crashes the
boot. So the code collapse, the flag's removal from the boot fence, and the
variable's deletion from the service are one slice with a stated order inside it:
**deploy the code, then delete the row.** Between those two moments the variable
still reads `all` and the behaviour is always-author — flag and behaviour
**agree**, so the window cannot produce a wrong answer; it can only be ignored.

Population, read at the code 2026-09-27 (`grep -c authorRoad`):

| file | sites | each one |
|---|---|---|
| `server/castingV2/briefCompiler.ts` | **15** | `:1119` the decision (`input.creativeRegister === true`) — deleted; `:729`/`:732` `buildChips`' `carry.authorRoad` → `removable()` is always `false`; `:1139` `author:`, `:1151` `statedWardrobe:` → literal `true`; `:1233` the styled-brief refusal's `&& !authorRoad` → **the whole branch is unreachable and goes**; `:1300` `carried`, `:1313` `rewritten`, `:1321` `briefSent`, `:1382` `seeded`, `:1545` `wardrobeLine` → the author arm alone; `:1451`/`:1517` `buildChips(… { authorRoad })` → the carry argument goes with `:729`; `:1346` a docblock; `:1588` **`deterministicBriefCompiler`'s literal `false` — slice 4, not this one** |
| `server/castingV2/rollService.ts` | **6** | `:543`/`:544` the capture and the alias — deleted; `:562` the follow-candidate arm → always taken; `:706` `inheritedWardrobe && !authorRoad` → `null`; `:791` `inheritWardrobe: !authorRoad` → `false`; `:616`/`:671` docblocks recording history |
| `server/routes/castingV2.ts` | **2** | `:946` `authorRoadEnabled:` — **the client wire field: slice 3**; `:1238` `if (!captureCastingCreativeRegisterEnabled(…))` → the refusal is unreachable and goes |
| `server/castingV2/castingV2Scope.ts` | the register's whole block (`:2427`–`:2549`) | constant, two error classes, parser, capture, validator |
| `server/_core/env.ts` | `:51`, `:565` | the import and the boot call |
| `scripts/lib/productionFlagPositions.mts` | `:300` | the row is **REMOVED, not set to `off`** — the precedent is `CASTING_TWO_PATHS_SCOPE` (#203 slice 2 step (e)), and the table's own suite refuses a row for a variable the code no longer declares |
| `scripts/capability-atlas-roads.mts` | `:125`, `:316`, `:348` | two roads cite the flag in their `flags` and one in a note; **citations are validated against source at generate time, so this MUST ride the same commit or `capability:generate` refuses** |
| `scripts/capability-atlas-corpus.mts` | `:393` | a `becomesReachable` line naming an account outside the flag — a door that can no longer become reachable that way |
| docblocks quoting the flag as a live gate | `briefCompiler.ts:416`, `briefLength.ts:19`, `castingIntent.ts:633`, `cohortPhotorealHuman.ts:43`,`:2801`, `interpreter.ts:488`, `shared/briefLength.ts:12`, `routes/castingV2.ts:1233` | re-stated as history, never deleted |
| suites stubbing the flag | `rollService.test.ts` (`:502`, `:528`, `:649`, `:1502`, `:1504`, `:1622`), `creativeRegisterScope.test.ts`, `castingConfigReaders.test.ts:105`, `capabilityAtlas.test.ts:912`, `readerAskTrim.test.ts:36`, `conceptUploadScope.test.ts` (slice 1 already) | the `off` arms are the ones to read carefully: an arm asserting the HOUSE composition is an arm asserting a road that no longer exists |

⚠ **`rollService.test.ts:1622` sets the flag to `off` and is the arm most worth
reading before it is touched** — an arm that proves the old road still works is
not a bug in the suite, it is the suite doing its job until the day the road
goes. It is deleted with its subject, in this slice, and the deletion is named in
the PR rather than shown as a diff line.

### SLICE 3 — the client's write-path wire field

`config.authorRoadEnabled` is read in **four** places, all flag-derived, all
collapsing to always-true:

- `client/src/pages/CastingSheet.tsx:604` (a query's `enabled`), `:1039`
- `client/src/pages/CastingV2.tsx:317` (a query's `enabled`), `:548`

and it governs what a customer SEES: the Re-imagine press (`CastingV2.tsx:817`),
the gear and the settings modal (`:872`, `CastSettingsModal.tsx:51`), the dock's
settings (`CastingSheet.tsx:1040`), and the vary/chip policy (`:2568`, `:2569`,
`:2604`, `:2876`). **Every one of those is drawn today for every account**,
because the flag is `all` — so the slice removes a branch, not a control.

⚠ **It is a `client/src` diff outside tests and admin, so it earns the relay's
eye on the rendered frames, both themes** (his rule, #1328) — and law 6 either
way. The wire field itself (`routes/castingV2.ts:946`,
`castingConfigReaders.test.ts:105`, `wardrobeEditCopy.test.ts:121`) leaves in
this slice, **after** the client has stopped reading it for one deploy.

⚠ **AND THE READ-PATH SITES IN THOSE SAME FILES ARE NOT TOUCHED** —
`CastingSheet.tsx:2211`, `:2561` and everything `sheetNotice.ts` reads. The
finding at the top of this manifest is this slice's whole risk.

### SLICE 4 — the house composer's prose-to-engine reader

`composeCandidatePrompt` (`server/castingV2/cohortPhotorealHuman.ts`) is the
**only** reader of the three prose tables' `thesis` / `avoid` / `whisper`
strings, and with slice 2 landed nothing in production reaches it. Its callers,
read at the code:

- `briefCompiler.ts` — the house compile (dies with slice 2)
- `briefCompiler.ts:1559` `deterministicBriefCompiler` — its own docblock calls
  it test-only and invites live callers. **Settled deliberately in this slice's
  card, never incidentally**, which is the ghost audit's own instruction.
- `briefCompiler.test.ts`, `hairStyles.test.ts`, `skinTonePin.test.ts`,
  `statedCovering.test.ts` — four suites that compose through it

⚠ **THE THREE PROSE TABLES SURVIVE THIS SLICE.** `LOOKS`, `ARCHETYPES` and
`ENERGIES` have five other readers and every one of them is live on the author
road: `stylingResolution.ts:128`,`:134` (reached from `briefCompiler.ts:935`
inside `resolveSheet`, which runs on both roads), `properNouns.ts:35` (the brand
and proper-noun wall is built from the KEYS), `interpreter.ts:627` and
`castingIntent.ts:808` (the reader's ask and schema — **his *"leave it"* on
#1123 protects these**), and `axisRegistry.ts:726`,`:739`,`:1048`. What dies is
their prose reaching an engine, not the tables.

⚠ **`resolveArchetype`'s RETURN VALUE is live and is not in this slice.**
`briefCompiler.ts:1334` hands it to `resolveSheet` — the dice — whose
`resolvedIdentity` the author road keeps, marked `unsent: true`, as the honest
record of what was rolled. It goes when the dice go, and **the dice are not on
this card at all.**

### SLICE 5 — the record closes

The atlas entries, `FEATURE_FLAGS.md`'s register entry re-stated as history,
`CLAUDE.md`'s flag index row, and the ghost audit's table stamped with what
actually shipped. No code. This is the slice that makes the next reader's
`git log -S` land on a document that agrees with the tree.

**It has no card of its own on purpose** — it IS #180's close, and a fifth row in
the queue for a paperwork act is the queue-shape noise his own ruling names. The
cards are **#1442** (slice 1), **#1443** (slice 2), **#1444** (slice 3) and
**#1445** (slice 4); 2, 3 and 4 are `blocked` on the one before them, each with
the reason on the card rather than only here.

---

## WHAT IS NOT IN THIS RETIREMENT, AND WHY

| not touched | why |
|---|---|
| `rollComposedOnAuthorRoad` and every reader of it | **220 of 306 sheets.** The read path is permanent |
| the per-slice identity dice / `resolveSheet` / `resolvedIdentity` | runs on BOTH roads; the author road keeps the record marked unsent. Not on #180 |
| `intent.reads` | **his word on #1123, verbatim: *"leave it"*.** The trim was offered and not ordered |
| `intent.composedDirection`, `intent.variationAxis` | measured LIVE on both roads (`needsAestheticRetry`, `promoteStatedRole`, `cohortPhotorealHuman.ts:1710`, `axisRegistry.ts:1080`) — the 2026-09-23 audit had these wrong and the re-read corrected them |
| `validateLocks` over the dice | **#1125, open, `rung:N3`** — inert for every account, and its own card |
| the refine road's old-lane machinery | his timing correction of 2026-08-28 puts it at N3's opening act |
| the `CASTING_V2_SCOPE` parent | untouched. This retirement is one rung of its chain, not the chain |

## THE FLOOR ON THIS MANIFEST

**Every population above is a FLOOR, and the reader that produced it is named
beside it** — `grep -c authorRoad` per file, `grep -rn` for the flag constant,
and the ghost audit's own row counts. No derived list stands behind the site
classifications: each was opened at the code in this sitting, but a call reached
through a barrel, a namespace import or a destructured dynamic `import()` is
exactly what this repository's house style hides from a grep, and the
un-wiring differ's own docblock says so. **Slice 2 re-counts before it cuts**,
and the count it finds is what its PR quotes.
