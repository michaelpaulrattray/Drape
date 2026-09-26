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

## The two things this rule deliberately does not decide

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

## It reports. It does not delete.

There is no delete path in the module or its runner, by construction and not by
discipline, and **no flag adds one**. The deletion of a backup is a founder act.
What a patrol may do mechanically is produce the list and the citation.

```
npx tsx scripts/janitor-backup-retention.mts
npx tsx scripts/janitor-backup-retention.mts --root <dir> --repo <dir> --json
```

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

## The one thing still open, and it is a founder question

Nothing above needed a value judgement, with one exception: **five items, 892.9
kB, now read as expired, and deleting them is his act, not a patrol's.** The
question on #1143 is whether a patrol may act on an `expired` verdict by itself
in future, or whether every deletion keeps coming to him. Until that is answered
the instrument prints and stops.
