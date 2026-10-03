# When does a sweep backup stop being needed?

**The rule, for card #1143.** Written 2026-09-26. The instrument that applies it
is `scripts/janitor-backup-retention.mts`; the rule itself and every refusal in
it are in `scripts/lib/backupRetention.mts`, driven by
`server/backupRetention.test.ts`.

**What a customer sees: nothing.** This is about the machine the team works on.

---

## The problem, and why nine runs could not solve it

Every Janitor sweep since run 1 has done the correct thing — copy what it is
about to delete somewhere outside the repository first. **Nine runs later nothing
had ever said when a copy stops being needed, so none had ever been removed.**
Measured 2026-09-24: 14 zips, 2 directories, growing by roughly one zip per run.

Run 9 filed this rather than acting on it, and its reason was right: *"deciding
what a backup is still worth is a judgement about value, and this seat's own
doctrine is that a keep is a citation, never a judgement of value."*

## ⚠ The rule dissolves the question rather than answering it

The card asked four questions and three of them were shaped as judgements —
*how many runs is a zip worth keeping, how many days, or never?* Inventing a
taxonomy nobody wrote down is exactly what the Atlas's price reader was repaired
by **refusing** to do (`CLAUDE.md`: *"the question is DISSOLVED rather than
answered"*). The same move works here:

> **A backup expires when the thing it protects is provably recoverable
> somewhere else. That is a CHECK, not a date.**

So there is no number of runs or days to choose. There is a test, and an item
that fails it is **kept, with the reason printed beside it** — which is the
citation the Janitor's own doctrine already demands.

## The two readers, both of which this repository already had

1. **The bytes are in git.** A file's git blob sha is a function of its bytes
   alone, so `git log --all --find-object=<sha>` either names a commit holding
   exactly those bytes or names nothing. **This is the road run 9 took by hand**
   for the four briefs it deleted — *"against `315f3386` all four are
   byte-identical (LF-normalised), so the bytes are recoverable from git and the
   backup is redundant"* — mechanised, and it yields a **commit sha as the
   citation** rather than an opinion. Two hashes are asked about per text file,
   raw and LF-normalised, because a file checked out under `core.autocrlf`
   carries CRLF on this machine while git stored LF.
2. **The work it served is finished.** A swept disposable is named for the card
   or briefing edition it was cut for, and `nameAnchorOf` /`readIssues` /
   `editionDate` — `scripts/disposable-age.mts`'s own readers, **imported rather
   than re-implemented** (working law 4) — resolve that name to an id whose
   `closedAt` GitHub owns and nothing on this machine can re-stamp. That
   instrument exists precisely because **an mtime is not evidence of age**: run 3
   measured 270 of 307 disposables carrying one single hour after a mass touch,
   and a keep test built on an mtime fails toward hoarding.

### The four questions, answered

| the card's question | the rule's answer |
|---|---|
| 1. Does a backup of something recoverable from git need keeping? | **No** — and "recoverable" is proven at the bytes and cited by commit, never asserted. |
| 2. What is the expiry for a sweep zip — runs, days, or never? | **None of the three.** It expires when every entry inside it has, which is a check. A 7-day floor sits under it. |
| 3. What is the rule for the R2 orphans, which no other copy backs? | **Kept, and this reader can never lift it** — see below. The rule reaches that answer mechanically rather than by remembering. |
| 4. Is `output/`'s 7 GB a permanent record, or does it age out? | **Out of scope, and deliberately** — see below. |

## What it refuses, and why each refusal is the point

- ⚠ **An empty reading THROWS.** A zip that could not be opened yields zero
  entries, and zero entries satisfies *"every entry is recoverable"* for free.
  **An unreadable backup classified as redundant is precisely how the only copy
  of something gets deleted.** It is an error, never a verdict.
- ⚠ **A live worktree is never a backup, on two independent grounds.** The pile
  lives beside the crew's trees under the same `drape-` prefix
  (`drape-shift-seat-janitor`, `drape-pinned-42652964`, …). A directory holding
  `.git` is refused, **and** every path `git worktree list` names is refused —
  either ground is enough, because a tree whose registration was lost still holds
  work.
- ⚠ **The 7-day floor outranks the contents.** The litter purge manifest's own
  keep test is the 7-day rule, and a backup written this week is kept even when
  every entry in it is redundant. A sweep's copy is insurance against the sweep,
  and the sweep is the thing that was recent.
- ⚠ **A name the reader cannot read is a file it gets no opinion about.** No
  anchor and no matching blob means kept, whatever its age.

## The three things this rule deliberately does not decide

**`output/` (7.0 GB, 8,952 files) is not a backup, and no rule here touches it.**
Nothing in it was ever a copy of something else: it is primary evidence from paid
measurements — `masked` 1.1 GB, `framing-court` 779 MB,
`prompt-author-court-run3` 170 MB. Both readers fail on it by construction (it is
gitignored, so no blob; its directory names are not disposable names, so no
anchor), which would make this rule say KEPT about 7 GB it has no competence
over. **Whether the record of paid courts ages out is its own decision and its
own card**, and saying so is more honest than a mechanical verdict nobody should
act on.

**The R2 orphans are a keep this reader can never lift.**
`drape-janitor-run6-crew-eye-orphans` is 31 files, 14.1 MB, downloaded by run 6
§C *before deleting the originals from the bucket* — **the only copies that
exist.** No commit holds them and no name anchors them, so every entry returns
KEPT, forever. Deleting them is a founder act.

**⚠ AND THERE IS A THIRD NOW — THE 2026-10-03 WORKTREE SWEEP'S KEEP PILE, WHICH
IS DECLARED IN THE CODE RATHER THAN LEFT IN A COUNT (#1826, 2026-10-03).** This
heading read *"The two things"* until today; the third arrived because the first
one happened to land on this machine as a directory with a name.

`C:\Users\Admin\drape-worktree-keep-2026-10-03` — **1,525,013,842 bytes
(1.42 GiB) in 451 files across 12 folders**, measured at the artifact rather than
quoted. It is where the 2026-10-03 worktree sweep moved everything it was about
to delete, after #1823 found that the removal tool could not see ignored files.

| folder | size | what it is |
|---|---|---|
| `output-drape-shift-sign-engine-court-1394` | **1,390.5 MB · 188 files** | the #1394 Sign-engine court — 155 full-resolution renders (1,384.7 MB), 13 eye strips, 20 files of rows and logs. **91% of the whole pile** |
| ten `output-drape-shift-seat-*` folders | 61.7 MB · 244 files | seat worktrees' own `output/` sets, 27 Sep – 3 Oct |
| `frames-card-1447` | 2.1 MB · 19 files | a card's frames directory |

**The defect was a number with no names in it.** The run has always printed
*"N entries under `C:\Users\Admin` did not match a backup name and were not
classified"* — **78** of them the night this was written — and this directory was
one of that 78. The instruction *"do not sweep this directory"* lived in three
consecutive mailbox handoff notes, in no card and in no code, and this program's
own law is that **a fact that lives only in a message does not exist**. An
unexplained entry in an anonymous count is indistinguishable from litter to every
future sweep, which is the one thing a 1.42 GiB pile of primary evidence must not
be.

⚠ **IT IS NOT GIVEN A BACKUP NAME, AND THAT IS THE POINT.** Making it a candidate
would hand this rule a verdict over evidence it has no competence over — the
identical refusal the `output/` paragraph above makes, and **91% of this directory
IS a court's `output/` set.** Both readers fail on it by construction (gitignored,
so no blob holds its bytes; a render's name anchors at nothing), so every entry
would return KEPT — a confident-looking verdict from an instrument nobody measured
against this population. **So it is refused BEFORE the name test instead of
classified by it**: `DECLARED_NOT_A_BACKUP` in `scripts/lib/backupRetention.mts`,
consulted by `partitionByName` before anything else, and a declared name never
enters the candidate list. Nothing downstream — `classifyBackup`, `itemsToDelete`,
`--delete-expired` — ever sees it. **That is the difference between unreachable
and unlikely**, and it is why the guarantee is the shape of the walk rather than a
disposition that happens to come out right today.

**What the run prints now, and it prints on every run including when the list is
empty** (`ignoredReadingLine`'s own lesson — silence about a population cannot be
told apart from an empty one):

```
  1 declared not-a-backup, named rather than counted (docs/JANITOR_BACKUP_RETENTION.md):
    OUT OF SCOPE  drape-worktree-keep-2026-10-03 — not a backup — the 2026-10-03 worktree
                  sweep's keep pile, 1.42 GiB whose 91% is the #1394 court's full-resolution
                  renders …
  77 entries under C:\Users\Admin did not match a backup name and were not classified
```

**Nothing about what may be deleted moved.** Read at the same root in the same
tree minutes apart: **12 items, 24.4 MB, `redundant 0 · expired 1 · kept 9 ·
too-recent 2`** before and after, with the unclassified count falling 78 → 77 as
the one entry became a named line. The only thing that changed is that a reader
can now see what it is looking at.

⚠ **A LITERAL NAME, NEVER A PREFIX.** A `drape-worktree-keep-` prefix would enrol
every future sweep's pile as a permanent keep nobody decided on, which is this
card's own defect one turn later. A second such directory lands in the
unclassified count instead — `BACKUP_NAME_PATTERNS`'s own stated reasoning about a
tenth naming style, that it *"shows up as a number rather than as silence"* — and
that number is the signal it needs its own line and its own reason.

### What is NOT decided here, and by anything

- **Whether the record of a paid, founder-judged court ages out at all is HIS**,
  exactly as the `output/` paragraph says. This declaration records that the pile
  is kept and why it sits outside this rule; **it does not claim the bytes are
  worth keeping forever.** Nothing here authorises deleting any of it, and
  `--delete-expired` has never been authorised for this class.
- **The ten seat `output/` folders are a DIFFERENT CLASS and are judged
  separately.** They are law-6 frames and probe output from merged pull requests,
  not paid measurements. Folding them into the court's decision is how a
  half-decision ships under an authorised one's name, so the declared reason names
  them as separate rather than covering them.

**What a deletion would cost, measured on 2026-10-03 so a future decision starts
from numbers rather than from a question.** Every frame his *"keep NBP 2k for
signing views"* verdict was given on has a second copy in production R2: **13 of
13 strips have a published object of identical byte length, 0 exist only on
disk**, and all **359** published `crew-eye/` keys answered `200` — a figure the
deploy rite re-checks on every push (*"eye frames: ok — 359 eye frames present in
the production bucket"*, receipt `2026-10-03T05-34-06-507Z`). The written record
is committed in `docs/specs/SIGN_ENGINE_COURT_2026-09-26.md`. ⚠ **The first cut of
that reading asked only the ten keys the two `sign-engine-court-1394` eye items
name and reported three strips as existing only on disk; the other three are
published under a different eye item.** The narrower population gave the alarming
answer and the wider one is the true one — recorded because the wrong answer is
the one that would have been filed. So what is unique to this pile is exactly two
things: **155 full-resolution PNGs (1,384.7 MB)**, reproducible only by paying for
the court again (~$28 of house money across 101 renders), and **253 KB of raw rows
and logs**, the only place the rows the committed document does not quote live.
**In his words: the irreplaceable part is a quarter of a megabyte; the big part is
the full-size pictures the strips were cut from, and the verdict was given on the
strips.**

## It reports — and since #1294 it may delete ONE disposition

This section read *"It reports. It does not delete. … no flag adds one. The
deletion of a backup is a founder act"* until 2026-09-26, and that was the honest
state of the day it was written: #1143 deliberately built the check and left the
authority question open, and #1294 put it to him.

**His word, 2026-09-26 (terminal), verbatim and entire:**

> **1294) delete them itself**

So the tool may now act, and the scope of what he authorised is narrow enough to
state in four lines:

```
npx tsx scripts/janitor-backup-retention.mts                              the listing, deletes nothing
npx tsx scripts/janitor-backup-retention.mts --root <dir> --repo <dir> --json
npx tsx scripts/janitor-backup-retention.mts --delete-expired --dry-run   what WOULD go
npx tsx scripts/janitor-backup-retention.mts --delete-expired            act on it
```

| may go by itself | never, without his word |
|---|---|
| `expired` — every entry retired, at least one of them by its finished work | `kept` — something inside is the only copy that exists (the 31 R2 orphans, 13.4 MB) |
| | `too-recent` — inside the 7-day floor, not judged on its contents at all |
| | `redundant` — see below; a STRONGER proof, and outside the road his word named |
| | `output/` — 7.0 GB of primary court evidence, which no rule here covers |

⚠ **`redundant` IS EXCLUDED ON PURPOSE AND IT IS THE COUNTER-INTUITIVE ONE.**
Every entry byte-identical to a blob git holds is a stronger reading than a
closed card, so on the face of it it is the SAFER thing to delete. It is out
because his word and the card's own scope sentence both name `expired` and
nothing else, and because folding a second disposition into the road while
nobody is looking is how a half-decision ships under an authorised one's name.
It reads **0** on this pile and the section above says why it almost always
will, so the exclusion costs nothing today — and the run PRINTS a line when the
count is not zero, so a stronger case can never sit silently outside the road.

⚠ **A VERDICT CARRIES THE TREE IT WAS READ FROM, AND THAT IS WHY A DELETION
NEEDS A FRESH MAIN.** Two of the readers are tree-dependent: `commitHolding`
walks `git log --all` and `editionDate` walks the committed briefing's history,
so both answer from the clone they run in. **Measured** by the relay's review of
PR #1293: run from the main tree, `drape-census-scratch-2026-09-12.zip` and
`drape-debris-2026-08-19.zip` read **KEPT** where the same sixteen items read
from a seat's tree read them **EXPIRED**. A tree BEHIND main fails toward KEEP,
which is safe. A tree holding a commit main does not have — an abandoned local
branch, a reverted commit — fails the other way: bytes "recoverable from git" at
a commit nobody will ever fetch. So every reading is *as read from tree X at sha
Y*, the listing prints nothing it has not read, and `--delete-expired` **REFUSES**
unless:

- `git rev-parse HEAD` equals the remote's `refs/heads/main` (read with
  `git ls-remote`, which writes no ref), **both as full 40-hex** — a read that
  failed is never agreement, so two empty strings do not compare equal; and
- `git status --porcelain` is empty — a dirty tree is not the tree it claims to
  be. (Which also means a second `--delete-expired` in a row refuses, because the
  first one left its receipt uncommitted. That is correct: commit the receipt.)

**There is no `--from <file>`.** The verdicts are computed in the same process
run that acts on them, so there is no listing artifact that can go stale between
the reading and the deletion.

**The receipt is a table in `docs/JANITOR_LOG.md`** under a fixed marker, one row
per item — what went, its size, its entry count, the citation the deletion stood
on, and the tree and sha it was read from. It is deliberately **not** a `## Run`
heading: `scripts/patrol-clocks.mts` reads the Janitor's last run out of the
newest such heading, and a tool writing one would tell the clock the seat had
patrolled.

`server/backupRetention.test.ts` drives all of it, and two arms are the ones that
matter: a `kept` item admitted to the deletion set reddens on the R2-orphan
fixture, and a tree that is not main's tip reddens the freshness refusal.

## The first reading — dry run, 2026-09-26, tree `736e5354`

16 items, **25.3 MB** (the card's 7.0 GB figure is `output/`, which is not in
this reading).

| disposition | items | what they are |
|---|---|---|
| **expired** | 5 | 892.9 kB — every entry's card or edition closed more than 7 days ago |
| **kept** | 8 | the 31 R2 orphans (13.4 MB), the frames zips (9.5 MB), the two 2026-08-19 untracked zips |
| **too-recent** | 3 | runs 8 and 9, inside the 7-day floor |
| **redundant** | 0 | nothing in the pile is byte-identical to a blob git holds |

**Redundant is zero, and that is the finding.** Swept disposables were untracked
by design, so git never held their bytes — the git limb, which is the strongest
one, will almost never fire on this pile. What actually retires a sweep zip here
is limb 2, the finished work.

⚠ **The frames zips are the largest keep (9.5 MB) and they are kept for a reason
the rule states.** A screenshot in them is named `771-alerts-dark-1440.png`,
which names its card as plainly as a disposable does — but `nameAnchorOf`
requires the leading `_` of the population it was written for, so it returns
nothing and every frame is kept. **That is left alone on purpose:** widening a
reader a deletion road already depends on, to serve a second population it was
never measured against, is how a keep test quietly starts approving things. A
frames-name anchor is its own reader with its own controls, on the day somebody
wants those 9.5 MB.

## The founder question is ANSWERED (#1294, 2026-09-26)

Nothing in the rule needed a value judgement, with one exception: **five items,
892.9 kB, read as expired, and whether a patrol could delete them by itself was
his to decide.** #1294 asked it in his own terms and he answered *"delete them
itself"*. So the instrument no longer prints and stops; it prints, proves the
tree, and acts on `expired` alone.

**What was NOT asked and therefore has not changed:** the 31 R2 orphans (the only
copies that exist), the 9.5 MB of frames zips (kept because `nameAnchorOf`
requires the leading `_` of the population it was written for — a frames anchor
is its own reader with its own controls, on the day somebody wants those bytes),
`output/`'s 7.0 GB of paid-court evidence, and `redundant`. Each remains a keep
for a reason this document states rather than for a reason nobody wrote down.
