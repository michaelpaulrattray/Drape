# The `output/` citation pass — the manifest, and the receipt (#527)

> **His word, 2026-09-16 15:45 AEST (terminal), on the card:** *"527 do it"* —
> the citation pass with a written manifest: **every `output/` path a record
> cites is a KEEP; the rest is swept; the manifest is the receipt.**

**Status: APPLIED, 2026-09-16.** `output/` went **7.2 GB → 6.9 GB**, **1,650
top-level entries → 762**. 889 entries removed, 0 failures. Nothing tracked by
git was touched; `output/` is gitignored and always has been.

*(The tables below read 7.08 → 6.81 GB. Both are right: `du` counts disk blocks,
the reader counts bytes. Every table here is bytes.)*

**Re-read after the sweep, as a fixpoint check:** 761 entries, 6.81 GB, and the
remainder is down to **75 entries / 0.06 GB** — exactly the set reader 2 spared.
The pass is stable: running it again proposes nothing new.

**THIS FILE IS THE RECEIPT AND IT LIVES IN THE REPOSITORY ON PURPOSE.** The
reader's own working files sit under `output/_527/`, which a future pass would
sweep. A receipt that can be deleted by the next run of the thing it is a
receipt for is not a receipt.

---

## 1 · The headline, and it is not the one the card expected

**The citation rule, applied honestly, does not shrink `output/`.** Measured at
the tree before anything was deleted:

| | entries | size |
|---|---|---|
| the whole tree | 1,650 | **7.08 GB** |
| **KEEP** — a record names them | 680 | **6.71 GB (95%)** |
| remainder — nothing names them | 970 | 0.37 GB (5%) |

**So 95% of the bytes are cited evidence and stay.** The recoverable part was
never the courts; it was 970 small scratch files, and **660 of them were stale
test and suite logs** (639 of those were swept). The card's own framing is confirmed rather than
overturned — this really is court evidence and not litter — and the useful
number for him is that **the 7 GB is not going to come down, because deleting
it would delete the proof behind verdicts he has already given with his eyes.**

The ten largest keeps and who keeps them:

| entry | size | first citing record |
|---|---|---|
| `masked` | 1023.1 MB | `docs/specs/masked-editing/FIXTURE_glasses_results-2026-08-06.md` |
| `framing-court` | 777.5 MB | `docs/specs/CASTING_FRAMING_CONSISTENCY_COURT.md` |
| `_shift599-fangs` | 192.7 MB | `docs/specs/FANGS_AT_REST_COURT_2026-09-09.md` |
| `_shift93` | 169.6 MB | `docs/specs/SOFTER_WORDING_COURT_2026-08-27.md` |
| `prompt-author-court-run3` | 169.3 MB | `docs/specs/PROMPT_AUTHOR_COURT_2026-08-26.md` |
| `glossary-court` | 165.4 MB | `scripts/_await-court-frames-disposable.mts` |
| `prompt-author-court-run2` | 155.7 MB | `docs/specs/PROMPT_AUTHOR_COURT_2026-08-26.md` |
| `view-reference-court` | 140.5 MB | `scripts/build-neck-court-panel-disposable.mts` |
| `imagegen` | 133.4 MB | `scripts/build-armless-plate-panel-disposable.mts` |
| `_shift128` | 125.4 MB | `docs/specs/LIGHTING_COURT_2026-08-27.md` |

---

## 2 · ⚠ THE CARD'S DEEPEST WORRY, MEASURED: ZERO VERDICTS ARE BROKEN

The card was filed because *"deleting a directory here does not remove litter;
it silently breaks the proof behind a verdict the founder has already given with
his own eyes."* That is a claim about the PAST as much as the future, so it was
measured rather than assumed.

**915 cited paths resolve to nothing on disk. Read at the sources, they are
three populations and only one of them would be a defect:**

| | count | what it is |
|---|---|---|
| `CASTING_V2_LITTER_PURGE_MANIFEST.md` | 760 | **a record of DELETIONS.** A purge manifest naming things that are gone is correct, not broken. |
| a script's own write target | 49 | `scripts/calibration/*.mts` naming where it WILL write. A destination is not a citation. |
| residual — a doc, a mailbox entry or a card naming evidence | 106 | shift scratch that a later Janitor sweep removed |
| ⚠ **of that residual, a `docs/specs` VERDICT record** | **0** | — |

**No verdict in `docs/specs/` cites a frame that is not on disk.** The failure
the card exists to prevent has not happened yet, and that is now on the record
with the reading behind it.

⚠ **It read as TWO until it was run down to the bytes, and both were the
instrument's fault, not the tree's.** `ATLAS_SUITE_TIMEOUT_DIAGNOSIS_2026-08-30.md`
cites `output/_shift107-*.log` (a glob — all eleven files exist) and
`CASTING_V2_STATED_SKIN_LANE_DESIGN.md` cites `output/brief-fidelity-` across a
markdown line wrap (`brief-fidelity-corpus` and `-court` both exist). **A report
of "2 broken proofs" would have been a false alarm filed as a fact.**

---

## 3 · ⚠ THE READER HAD A DEFECT IN THE DELETION DIRECTION, AND IT WAS FOUND BEFORE IT COST ANYTHING

The same glob shape that produced those two false alarms was **also putting real
files into the deletion list.** `output/_shift107-*.log` parses to a top-level
name `_shift107-` that does not exist, so the eleven files a `docs/specs`
diagnosis record cites were proposed for deletion — along with 66 others cited
the same way.

**77 entries were rescued by fixing it**, and the fix is stated as a rule rather
than a patch: a citation cut short by `*`, `{` or a line-wrapped trailing `-` is
resolved as a **prefix**, never as a name. A prefix can only ADD keeps, so the
error it can still make is hoarding — which is the only direction a sweep
manifest is allowed to fail in.

**This is why a one-hour-old instrument does not get to delete anything on its
own word**, and it is the Janitor seat's own precedent: run 4 wrote a 128-file
manifest and refused to sweep on a reader that had landed that shift.

---

## 4 · The method, and the controls that were driven before any of it was believed

**TWO READERS WITH DIFFERENT RESOLVERS. Only what BOTH call uncited was swept.**

- **Reader 1** (`scripts/_527-citation-pass-disposable.mts`, disposable) parses
  path tokens out of the corpus, splits on `/`, and resolves the first segment
  against the tree, with the prefix rule above.
- **Reader 2** (`scripts/_527-second-reader-disposable.mts`, disposable) parses
  nothing. It takes each proposed entry's bare NAME and asks whether that literal
  string occurs anywhere in the corpus at all. Substring matching over-keeps by
  construction.

**Reader 2 spared 75 more entries (56.6 MB)** that reader 1 had proposed — among
them `basics-colour-court-run2`, `popover-glass`, `reference-thumbnails` and
`shift-logs`, each named in a mailbox entry or a script in a form reader 1's
parser could not see. **The disagreement is itself the argument for two
readers**, and the spared list is at `output/_527/sweep-spared.txt`.

**The corpus is wider than the card asked for, deliberately.** The card says
`docs/specs/`. That is the floor: a citation in `docs/JANITOR_LOG.md`, in a
shift's mailbox entry, in a script, or in a card body breaks in exactly the same
way, and a card body outlives its road. So the corpus is **7,991 records** —
`docs/specs` 428, `docs` 57, code 2,994, mailbox 3,506, and **1,006 GitHub
issues and PRs with all their comments** — yielding 4,482 citations over 2,590
distinct paths. **Widening the keep test can only keep more**, which is the
direction to be wrong in. `output/530` (89.7 MB) is kept by a comment on PR #562
and by nothing else; under a `docs/specs`-only test it would have gone.

**Controls, driven on the finished reader, all three green:**

| arm | expectation | result |
|---|---|---|
| a scratch directory cited by an exact path | KEEP | ✅ |
| a scratch directory cited by nobody | REMAINDER | ✅ |
| a scratch file cited only by a `*` glob | KEEP | ✅ |

The two scratch directories differ **only** in whether a record names them, so
the citation is proven to be the thing doing the discriminating. The controls
were re-driven after the prefix fix, because a changed instrument is a new one.
Four real rows were then read by hand at the artifacts — two keeps, two sweeps.

---

## 5 · What was SPARED beyond the readers, and it is a shift's own bound stated out loud

**Six directories that both readers called uncited were NOT deleted, because
they hold pictures:**

```
output/roll103-sheet                       20,450,078 B   8 frames  2026-08-27
output/his-roll-216                        16,841,115 B   6 frames  2026-08-25
output/verify-makeup-chip                  10,519,706 B   8 frames  2026-08-18
output/refusal-viewer-rehearsal-control     1,041,408 B   2 frames  2026-08-10
output/_eyefix                                159,223 B   2 frames  2026-08-30
output/_cinema-glyph                           88,588 B   4 frames  2026-08-30
```

**46.8 MB of a 7.08 GB tree — 0.7%.** A frame is a paid render, its deletion is
irreversible, and the readers can only prove that nothing names it *by name*:
`roll103-sheet` is uncited, while *"roll 103"* with a space appears in three
mailbox entries. **Buying 0.7% at exactly the risk this card was filed about is
the path of least resistance on quality, and the fidelity law forbids taking it
silently.** So they are named here instead, and one word from him takes them.

**The remaining five uncited directories held no picture and were swept**:
`prompt-author-court-dryrun`, `sign-refusal-court-run2`, `316-fix`,
`janitor-cards`, `_shift85-carry`.

---

## 6 · What the card's "zip beside the record" option is actually worth

The card names zipping court frames beside their verdict as a candidate. **It is
priced rather than assumed** — `output/two-paths-court-round4`, compressed for
real:

```
11,916,812 B  →  11,383,325 B      a 4.5% saving
```

**PNG is already compressed, so zipping the 6.71 GB of kept evidence would
recover roughly 300 MB and make every frame unopenable without a step first.**
Recommendation: **don't.** If the disk ever genuinely matters, the answer is
moving old court directories off this machine, not squeezing them on it.

---

## 7 · ⚠ One guard from the precedent manifest that this pass did NOT apply

`CASTING_V2_LITTER_PURGE_MANIFEST.md` carries two added guards. **Guard (a) —
anything on the founder's desk is kept — held here and was checked after the
fact**: `server/crew/crew-briefing.json` cites `output/900-clock` and
`output/janitor/run6-branch-manifest.txt`, and **both survive.**

**Guard (b), the 7-day rule, was NOT applied, and 78 of the 889 swept entries
fall inside that window.** Read at the receipt, they are: **36 markdown drafts**
(PR bodies and card comments — four were probed against the GitHub corpus and
**all four are already posted**, so the staging copy was redundant), **16 rite
and dev logs**, **18 one-shot disposables from cards #938/#939/#941, all
closed**, and 8 `.err`/`.txt` scraps. Nothing in the window was evidence or an
instrument a record names. **Stated because the number exists, not because it
turned out to matter** — a pass that quietly drops a guard its own precedent
carries is how a discipline erodes.

---

## 8 · ⚠ THE HOLE THIS PASS HIT, AND THE LOG ALREADY KNEW ITS NAME

`docs/JANITOR_LOG.md` run 6 §C states the class in as many words: *"a citation
index that excludes the population it is classifying cannot see that
population's internal edges."*

**This pass's corpus read `docs/`, the code, the mailbox and every card — and NOT
`output/` itself.** So a file named only by a SURVIVING file inside `output/` was
invisible to both readers. Checked after the fact against the surviving tree
(`output/_527/internal-edges.txt`): **10 of the 889 were named by a survivor**,
and all ten by the same one — `output/_janitor5/wide-citers.txt`, run 5's own
index OF filenames, which is a list about files rather than a proof depending on
them.

⚠ **Three of the ten were patrol records, and that is the real cost of the
night, stated rather than buried:**

```
output/janitor-run4-full-read.txt     92,835 B   run 4's full reading
output/janitor-run4-temp-manifest.txt  2,811 B   run 4's %TEMP% manifest
output/_janitor-run2-chunk.md         11,987 B   run 2 scratch
```

**Why they went and the sweep manifest beside them did not is the whole lesson.**
`docs/JANITOR_LOG.md:576` reads *"the manifest is written
(`output/janitor-run4-sweep-manifest.txt`, and the full read beside it)"* — the
manifest is cited BY PATH and survives; **the full read is cited in PROSE and a
path-based keeper cannot see a prose citation.** Their verdicts are safe (they
are written into run 4's own sections of the log, and run 5 re-ran and superseded
that sweep), so what was lost is the working paper, not the finding.

**The discipline that follows, and it is written into the Janitor log in the same
commit: a reading a future run will need is cited BY PATH in the log, or it is
not a record.** "Beside it" is not a citation.

---

## 9 · THE MANIFEST — 889 entries, swept

Machine-written receipt, the full list with byte counts and dates:
`output/_527/sweep-receipt.txt` (mirrored below in full).

The working readings, all under `output/_527/` and therefore KEPT by this pass's
own rule now that this record cites them:

- `output/_527/full-read.md` — every entry, who cites it, and the broken-citation sections
- `output/_527/sweep-manifest.txt` — reader 1's proposal (970)
- `output/_527/sweep-agreed.txt` — what both readers called uncited (895)
- `output/_527/sweep-spared.txt` — the 75 reader 2 saved
- `output/_527/sweep-receipt.txt` — what was actually removed (889)

`output/_527/card-corpus.json` (8.6 MB, the GitHub dump) is a cache and was
deleted at shift close; re-running reader 1 rebuilds it.

```
# kind  bytes  mtime  path   (889 entries, machine-written)
SWEPT	     4393189	2026-09-07	output/_548-after.json
SWEPT	     4376025	2026-09-07	output/_548-underload.json
SWEPT	     3706882	2026-08-29	output/_shift109-wt-load3.json
SWEPT	     3695811	2026-08-29	output/_shift109-suite-r2.json
SWEPT	     2212782	2026-08-23	output/_vitest-1103.log
SWEPT	     2117126	2026-08-30	output/_shift117-suite2.log
SWEPT	     2073200	2026-08-28	output/_shift84-test.log
SWEPT	     1928428	2026-09-07	output/_650-preflight4.txt
SWEPT	     1925662	2026-08-28	output/_shift88-test.log
SWEPT	     1919219	2026-09-07	output/_650-pf5.txt
SWEPT	     1917595	2026-09-07	output/_647-preflight2.txt
SWEPT	     1909262	2026-08-28	output/_shift85-full.log
SWEPT	     1904717	2026-09-07	output/_651-preflight2.txt
SWEPT	     1899360	2026-08-29	output/_shift91-test.log
SWEPT	     1869314	2026-08-23	output/_vitest-1111.log
SWEPT	     1868038	2026-08-22	output/_vitest-1062.log
SWEPT	     1867123	2026-09-07	output/_651-pf3.txt
SWEPT	     1865678	2026-08-22	output/_vitest-1048a.log
SWEPT	     1856023	2026-08-22	output/_vitest-1054.log
SWEPT	     1854573	2026-08-22	output/_vitest-1021b.log
SWEPT	     1853388	2026-08-29	output/_shift109-r3.txt
SWEPT	     1852956	2026-08-22	output/_vitest-1045.log
SWEPT	     1838536	2026-09-07	output/_548-preflight.txt
SWEPT	     1832314	2026-08-23	output/_vitest-ink.log
SWEPT	     1828879	2026-08-29	output/_shift109-r2.txt
SWEPT	     1814097	2026-09-07	output/_651-preflight.txt
SWEPT	     1799932	2026-08-22	output/_vitest-1034.log
SWEPT	     1789285	2026-08-29	output/_shift96-suite.log
SWEPT	     1778860	2026-08-23	output/_vitest-1112.log
SWEPT	     1776504	2026-08-23	output/_vitest-hair.log
SWEPT	     1776429	2026-08-23	output/_vitest-chest2.log
SWEPT	     1768747	2026-08-22	output/_vitest-1039.log
SWEPT	     1768050	2026-08-22	output/_vitest-1092b.log
SWEPT	     1768003	2026-08-28	output/_shift88-test2.log
SWEPT	     1767804	2026-08-23	output/_vitest-1104b.log
SWEPT	     1767787	2026-08-24	output/_1217_suite.log
SWEPT	     1767239	2026-08-23	output/_vitest-1096.log
SWEPT	     1766255	2026-08-23	output/_vitest-1100.log
SWEPT	     1765676	2026-08-24	output/_1220_suite.log
SWEPT	     1764150	2026-08-23	output/_vitest-1119.log
SWEPT	     1758775	2026-08-22	output/_vitest-1092.log
SWEPT	     1756826	2026-08-22	output/_vitest-1029.log
SWEPT	     1755568	2026-08-22	output/_vitest-1081.log
SWEPT	     1753838	2026-08-22	output/_vitest-1062b.log
SWEPT	     1753631	2026-08-23	output/_vitest-devservers2.log
SWEPT	     1752256	2026-08-24	output/_1200_suite.log
SWEPT	     1751989	2026-08-22	output/_vitest-1025.log
SWEPT	     1751176	2026-08-29	output/_shift93-test.log
SWEPT	     1750824	2026-08-23	output/_vitest-1108b.log
SWEPT	     1749186	2026-08-22	output/_vitest-roadmap.log
SWEPT	     1749186	2026-08-22	output/_vitest-shift-start.log
SWEPT	     1746777	2026-08-22	output/_vitest-1093.log
SWEPT	     1745942	2026-08-22	output/_vitest-1028.log
SWEPT	     1745338	2026-08-25	output/_shift-suite.log
SWEPT	     1742133	2026-08-23	output/_vitest-1117.log
SWEPT	     1741423	2026-08-22	output/_vitest-1045b.log
SWEPT	     1740714	2026-08-23	output/_vitest-1098b.log
SWEPT	     1740363	2026-08-22	output/_vitest-1088.log
SWEPT	     1738978	2026-08-22	output/_vitest-1061.log
SWEPT	     1736489	2026-08-23	output/_vitest-caption.log
SWEPT	     1734830	2026-08-23	output/_vitest-ink2.log
SWEPT	     1731675	2026-08-24	output/_1195_suite.log
SWEPT	     1731544	2026-08-22	output/_vitest-1049b.log
SWEPT	     1727193	2026-08-22	output/_vitest-1027.log
SWEPT	     1726296	2026-08-23	output/_vitest-hair2.log
SWEPT	     1714771	2026-08-23	output/_vitest-ghost.log
SWEPT	     1714550	2026-08-23	output/_vitest-chest3.log
SWEPT	     1713335	2026-08-22	output/_vitest-1057b.log
SWEPT	     1710985	2026-08-23	output/_vitest-1113.log
SWEPT	     1710488	2026-08-23	output/_vitest-1120.log
SWEPT	     1710095	2026-08-22	output/_vitest-1094.log
SWEPT	     1709747	2026-08-29	output/_shift109-suite-stdout.txt
SWEPT	     1707764	2026-08-22	output/_vitest-1092c.log
SWEPT	     1707003	2026-08-23	output/_vitest-1099.log
SWEPT	     1704826	2026-08-29	output/_shift92-test.log
SWEPT	     1703404	2026-08-22	output/_vitest-1038b.log
SWEPT	     1700356	2026-08-22	output/_vitest-1082.log
SWEPT	     1697418	2026-08-23	output/_1161_suite.log
SWEPT	     1697109	2026-08-23	output/_vitest-1110.log
SWEPT	     1695271	2026-08-23	output/_vitest-1118.log
SWEPT	     1694883	2026-08-23	output/_v.log
SWEPT	     1693463	2026-08-23	output/_vitest-chest.log
SWEPT	     1689390	2026-08-24	output/_1216_suite.log
SWEPT	     1682727	2026-08-22	output/_vitest-1095.log
SWEPT	     1682425	2026-08-23	output/_vitest-1108.log
SWEPT	     1680945	2026-08-22	output/_vitest-1087.log
SWEPT	     1666818	2026-08-22	output/_vitest-1047.log
SWEPT	     1666283	2026-08-22	output/_vitest-1020.log
SWEPT	     1663163	2026-08-24	output/_1198_suite.log
SWEPT	     1654119	2026-08-22	output/_vitest-1031.log
SWEPT	     1650909	2026-08-23	output/_vitest-1123.log
SWEPT	     1642185	2026-08-23	output/_vitest-chest4.log
SWEPT	     1632159	2026-08-23	output/_vitest-1105.log
SWEPT	     1630580	2026-08-22	output/_vitest-1080.log
SWEPT	     1626536	2026-08-23	output/_vitest-1098.log
SWEPT	     1610275	2026-08-20	output/_suite7.log
SWEPT	     1609729	2026-08-23	output/_vitest-1101.log
SWEPT	     1608004	2026-08-20	output/_suite6.log
SWEPT	     1597399	2026-08-20	output/_suite4.log
SWEPT	     1583670	2026-08-22	output/_vitest-1038.log
SWEPT	     1573115	2026-08-22	output/_vitest-1017.log
SWEPT	     1572150	2026-08-22	output/_vitest-unwiring.log
SWEPT	     1567323	2026-08-23	output/_vitest-devservers.log
SWEPT	     1566355	2026-08-21	output/_vitest.log
SWEPT	     1546685	2026-08-22	output/_vitest-1057.log
SWEPT	     1532923	2026-08-18	output/suite10.log
SWEPT	     1524365	2026-08-22	output/_vitest-flags.log
SWEPT	     1524223	2026-08-18	output/suite12.log
SWEPT	     1522178	2026-08-20	output/_suite5.log
SWEPT	     1521322	2026-08-18	output/suite7.log
SWEPT	     1511973	2026-08-18	output/suite9.log
SWEPT	     1501275	2026-08-18	output/suite3.log
SWEPT	     1488118	2026-08-18	output/suite4.log
SWEPT	     1486429	2026-08-20	output/_suite8.log
SWEPT	     1464861	2026-08-18	output/suite13.log
SWEPT	     1458689	2026-08-18	output/suite5.log
SWEPT	     1409221	2026-08-18	output/suite8.log
SWEPT	     1401772	2026-08-30	output/_shift117-suite.log
SWEPT	     1275801	2026-08-29	output/_shift93-test2.log
SWEPT	     1274745	2026-08-12	output/shift63-suite2.log
SWEPT	     1270273	2026-08-12	output/shift63-suite4.log
SWEPT	     1269406	2026-08-12	output/shift63-suite.log
SWEPT	     1232329	2026-08-09	output/test-run1.log
SWEPT	     1230491	2026-08-09	output/test-shift10-6.log
SWEPT	     1228693	2026-08-09	output/test-run5.log
SWEPT	     1225923	2026-08-09	output/test-shift10-4.log
SWEPT	     1225523	2026-08-09	output/test-shift10-8.log
SWEPT	     1224455	2026-08-09	output/test-shift10-2.log
SWEPT	     1220132	2026-08-09	output/test-run2.log
SWEPT	     1218035	2026-08-09	output/test-run4.log
SWEPT	     1207027	2026-08-08	output/suite-purge2.log
SWEPT	     1206951	2026-08-12	output/shift63-suite3.log
SWEPT	     1206839	2026-08-08	output/suite-inherit.log
SWEPT	     1200702	2026-08-08	output/suite-gate.log
SWEPT	     1200194	2026-08-09	output/test-shift10-1.log
SWEPT	     1196069	2026-08-08	output/suite-ship2.log
SWEPT	     1195589	2026-08-09	output/test-shift8b.log
SWEPT	     1192466	2026-08-08	output/suite-purge.log
SWEPT	     1192176	2026-08-08	output/suite-merge2.log
SWEPT	     1191881	2026-08-08	output/suite-shift5-final.log
SWEPT	     1187188	2026-08-08	output/suite-final.log
SWEPT	     1186998	2026-08-08	output/suite-shift7-1.log
SWEPT	     1186448	2026-08-08	output/suite-merge.log
SWEPT	     1186223	2026-08-08	output/suite-park.log
SWEPT	     1183991	2026-08-08	output/suite-prune-final2.log
SWEPT	     1183786	2026-08-08	output/suite-merge3.log
SWEPT	     1178269	2026-08-09	output/test-shift8.log
SWEPT	     1178265	2026-08-08	output/suite-shift5.log
SWEPT	     1177926	2026-08-08	output/suite-prune-final.log
SWEPT	     1163449	2026-08-09	output/test-run3.log
SWEPT	     1162704	2026-08-09	output/test-shift10-7.log
SWEPT	     1162565	2026-08-08	output/suite-shift7-3.log
SWEPT	     1162395	2026-08-08	output/suite-prune-fix.log
SWEPT	     1152541	2026-08-23	output/_vitest-carried.log
SWEPT	     1140658	2026-08-09	output/test-shift10-9.log
SWEPT	     1118975	2026-08-08	output/suite-failcopy.log
SWEPT	     1108385	2026-08-22	output/_vitest-1026.log
SWEPT	     1106808	2026-08-09	output/test-shift10-3.log
SWEPT	     1101496	2026-08-23	output/_c3_suite.log
SWEPT	     1096640	2026-08-23	output/_vitest-82c.log
SWEPT	     1088244	2026-08-23	output/_v2_shift.log
SWEPT	     1085521	2026-08-24	output/_1214_suite.log
SWEPT	     1075253	2026-08-22	output/_vitest-1052.log
SWEPT	     1071850	2026-08-23	output/_vitest-1122.log
SWEPT	     1065922	2026-08-22	output/_vitest-1033.log
SWEPT	     1060444	2026-08-22	output/_vitest-1049.log
SWEPT	     1045746	2026-08-24	output/_1203_suite.log
SWEPT	     1019684	2026-08-23	output/_vitest-1116.log
SWEPT	      984761	2026-08-23	output/_vitest-1104.log
SWEPT	      981703	2026-08-24	output/_1215_suite.log
SWEPT	      971555	2026-08-23	output/_v2_3b.log
SWEPT	      964301	2026-08-24	output/_1211_suite.log
SWEPT	      959286	2026-08-24	output/_1222_suite.log
SWEPT	      953460	2026-08-22	output/_vitest-1055.log
SWEPT	      943161	2026-08-23	output/_vitest-caption2.log
SWEPT	      932662	2026-08-22	output/_vitest-1016.log
SWEPT	      918253	2026-08-20	output/_suite3.log
SWEPT	      873980	2026-08-18	output/suite11.log
SWEPT	      843441	2026-08-18	output/suite6.log
SWEPT	      831660	2026-08-26	output/prompt-author-court-dryrun
SWEPT	      615223	2026-08-25	output/_devrepro.log
SWEPT	      553028	2026-08-29	output/_shift109-load.txt
SWEPT	      532028	2026-08-08	output/suite-purge3.log
SWEPT	      515803	2026-08-08	output/suite-ship.log
SWEPT	      504835	2026-08-08	output/suite-rel.log
SWEPT	      499305	2026-08-08	output/suite-shift7-2.log
SWEPT	      471896	2026-08-09	output/test-shift10-5.log
SWEPT	      471448	2026-08-08	output/suite-adv.log
SWEPT	      343232	2026-08-15	output/service-road-doors-run2.log
SWEPT	      329004	2026-08-15	output/service-road-doors-null.log
SWEPT	      204244	2026-08-14	output/devserver-shift61.log
SWEPT	      136528	2026-08-09	output/refineService.fixed.bak
SWEPT	      120211	2026-08-25	output/sign-refusal-court-run2
SWEPT	      100625	2026-08-22	output/_timeline-corrected.log
SWEPT	      100625	2026-08-22	output/_timeline-final.log
SWEPT	      100189	2026-08-22	output/_timeline-promoted.log
SWEPT	       98334	2026-08-22	output/_unwiring-timeline-nsfixed.log
SWEPT	       98326	2026-08-22	output/_unwiring-timeline.log
SWEPT	       93120	2026-08-22	output/_timeline-deadimport.log
SWEPT	       93026	2026-08-22	output/_biography.log
SWEPT	       92835	2026-09-08	output/janitor-run4-full-read.txt
SWEPT	       83444	2026-08-21	output/devserver-midchain.log
SWEPT	       82086	2026-08-22	output/_devserver.log
SWEPT	       52326	2026-08-20	output/_devserver-shift94.log
SWEPT	       47069	2026-08-14	output/dev-skeleton.log
SWEPT	       46377	2026-08-12	output/shift58-dev.log
SWEPT	       40281	2026-08-18	output/imagegen-b.log
SWEPT	       38134	2026-08-15	output/stage-pressure-after.log
SWEPT	       37499	2026-09-12	output/_855-digest.md
SWEPT	       33938	2026-08-15	output/service-road-after.log
SWEPT	       33455	2026-08-20	output/_dev2.log
SWEPT	       32914	2026-08-08	output/prune-fix-1.log
SWEPT	       31636	2026-08-08	output/prune-fix-2.log
SWEPT	       31565	2026-09-02	output/_q2-shift.json
SWEPT	       31534	2026-08-20	output/_lane.log
SWEPT	       30851	2026-09-02	output/_q-shift.json
SWEPT	       30831	2026-08-22	output/_dev-1060.log
SWEPT	       30383	2026-08-15	output/stage-pressure-run.log
SWEPT	       29495	2026-08-20	output/_take.log
SWEPT	       29484	2026-08-21	output/devserver-bareskin.log
SWEPT	       28735	2026-08-08	output/prune-fix-3.log
SWEPT	       26972	2026-08-22	output/_ledger-1091.log
SWEPT	       26163	2026-08-08	output/atlas-inherit.log
SWEPT	       25880	2026-08-31	output/316-fix
SWEPT	       25561	2026-08-09	output/check-scripts-shift8.log
SWEPT	       25173	2026-08-08	output/check-scripts-1.log
SWEPT	       25173	2026-08-08	output/check-scripts-2.log
SWEPT	       25173	2026-08-08	output/check-scripts-3.log
SWEPT	       25173	2026-08-08	output/check-scripts-4.log
SWEPT	       25173	2026-08-08	output/check-scripts-5.log
SWEPT	       25173	2026-08-08	output/cs.log
SWEPT	       25051	2026-08-08	output/gate-2.log
SWEPT	       24982	2026-08-08	output/gate-1.log
SWEPT	       24556	2026-08-12	output/shift62-fiveask.log
SWEPT	       24132	2026-08-08	output/prune-fix-4.log
SWEPT	       23557	2026-08-15	output/stage-pressure-interleaved.log
SWEPT	       22307	2026-08-20	output/_dev-shift88.log
SWEPT	       21744	2026-08-17	output/open-lane-bench-run.log
SWEPT	       20237	2026-08-23	output/_devserver-carried.log
SWEPT	       19374	2026-08-12	output/shift58-fiveask-2.log
SWEPT	       18663	2026-08-30	output/_shift117-dev.log
SWEPT	       18536	2026-08-20	output/_dev3.log
SWEPT	       18352	2026-08-12	output/shift62-dev.log
SWEPT	       18164	2026-08-13	output/removal-routing-run4-n6.log
SWEPT	       17922	2026-08-22	output/_strict-class.log
SWEPT	       17376	2026-08-20	output/_dev-shift87.log
SWEPT	       16864	2026-08-21	output/_gate-server.log
SWEPT	       16809	2026-08-09	output/bench-a-controlled.log
SWEPT	       16754	2026-08-09	output/bench-a-reshaped.log
SWEPT	       16702	2026-08-15	output/bisect-run.log
SWEPT	       16398	2026-08-18	output/imagegen-a.log
SWEPT	       15749	2026-08-13	output/stage-run.log
SWEPT	       15659	2026-08-20	output/_dev-shift92.log
SWEPT	       15636	2026-08-13	output/stage-run2.log
SWEPT	       15148	2026-08-28	output/_shift85-dev.log
SWEPT	       15062	2026-08-13	output/shift74-readd-run.log
SWEPT	       14801	2026-08-21	output/_ui-server2.log
SWEPT	       14583	2026-08-13	output/dev-server.log
SWEPT	       14286	2026-08-22	output/_devserver2.log
SWEPT	       13988	2026-08-22	output/_dev-1066.log
SWEPT	       13610	2026-08-20	output/_server-before.log
SWEPT	       13593	2026-08-15	output/corner-run.log
SWEPT	       13107	2026-08-15	output/corner-run2.log
SWEPT	       13057	2026-08-23	output/_devserver-ghost.log
SWEPT	       12423	2026-08-13	output/removal-routing-run2.log
SWEPT	       12298	2026-08-22	output/_dev-fix.log
SWEPT	       12157	2026-08-09	output/bench-a-n3.log
SWEPT	       12141	2026-08-09	output/bench-a-final.log
SWEPT	       11987	2026-08-28	output/_janitor-run2-chunk.md
SWEPT	       11824	2026-08-23	output/_dev-drive2.log
SWEPT	       11803	2026-08-28	output/_court190-s1.log
SWEPT	       11563	2026-08-10	output/shift27-dev.log
SWEPT	       11387	2026-08-23	output/_dev-1104.log
SWEPT	       11124	2026-08-12	output/shift65-earring-acceptance-2.log
SWEPT	       11065	2026-08-13	output/scoped-verification-run1.log
SWEPT	       10803	2026-08-08	output/compound-chip.log
SWEPT	       10632	2026-08-15	output/recorder-run.log
SWEPT	       10421	2026-08-08	output/diag.log
SWEPT	       10362	2026-08-09	output/guards-shift10-2.log
SWEPT	       10234	2026-08-12	output/shift64-strict-read.log
SWEPT	       10222	2026-09-01	output/365-edition.py
SWEPT	       10029	2026-08-09	output/bench-b-1.log
SWEPT	       10020	2026-08-09	output/bench-b-final.log
SWEPT	        9977	2026-08-13	output/shift68-dev.log
SWEPT	        9929	2026-08-13	output/shift68-dev2.log
SWEPT	        9903	2026-08-20	output/_server-after.log
SWEPT	        9797	2026-08-09	output/guards-shift10-1.log
SWEPT	        9780	2026-08-21	output/_ui-server.log
SWEPT	        9775	2026-08-15	output/recorder-after.log
SWEPT	        9580	2026-09-07	output/_qe-backup.ts
SWEPT	        9567	2026-08-09	output/bench-b-reshaped.log
SWEPT	        9228	2026-08-25	output/machinist-reread-60d.txt
SWEPT	        9065	2026-08-09	output/segments-watch.log
SWEPT	        9036	2026-08-08	output/adv.log
SWEPT	        8979	2026-08-09	output/segstore-shift10-4.log
SWEPT	        8941	2026-08-12	output/shift64-bench-per-instance.log
SWEPT	        8883	2026-08-29	output/_shift96-replies.txt
SWEPT	        8763	2026-09-14	output/_edition400-disposable.mjs
SWEPT	        8640	2026-08-23	output/_dev-drive.log
SWEPT	        8292	2026-08-12	output/shift64-paid-two-step-2.log
SWEPT	        7867	2026-08-13	output/removal-routing-run3.log
SWEPT	        7652	2026-08-08	output/prune-hole-proof.log
SWEPT	        7516	2026-08-30	output/_shift117-262-answer.md
SWEPT	        7513	2026-08-28	output/_shift88-issue216.md
SWEPT	        7499	2026-09-07	output/_548-sg-3.txt
SWEPT	        7420	2026-08-12	output/shift58-fiveask.log
SWEPT	        7394	2026-08-20	output/_dev4.log
SWEPT	        7352	2026-08-23	output/_recourt-arm2-round4.log
SWEPT	        7308	2026-08-28	output/_shift84-pr.md
SWEPT	        7226	2026-08-08	output/marks-court-run15.log
SWEPT	        7177	2026-09-13	output/_916-new.md
SWEPT	        7082	2026-08-25	output/janitor-cards
SWEPT	        7049	2026-08-20	output/_server-after2.log
SWEPT	        6906	2026-08-28	output/_shift89-issue219.md
SWEPT	        6887	2026-08-09	output/segstore-shift10-2.log
SWEPT	        6879	2026-09-01	output/365-pr-body.md
SWEPT	        6753	2026-08-29	output/_shift90-inspect.txt
SWEPT	        6749	2026-09-13	output/_903-new2.md
SWEPT	        6509	2026-08-30	output/_shift114-r42.md
SWEPT	        6446	2026-08-28	output/_shift86-pr.md
SWEPT	        6386	2026-08-08	output/rel-1.log
SWEPT	        6344	2026-08-13	output/bald-walk-run1.log
SWEPT	        6251	2026-08-29	output/_shift95-mailbox.md
SWEPT	        6220	2026-08-09	output/guards-shift8b.log
SWEPT	        6203	2026-09-11	output/_697-kept-block.txt
SWEPT	        6101	2026-08-28	output/_shift85-issue210.md
SWEPT	        6072	2026-08-27	output/_shift129-run3-console.log
SWEPT	        6050	2026-08-23	output/_sign-arm3b.log
SWEPT	        6025	2026-08-29	output/_shift93-prbody.md
SWEPT	        5944	2026-08-23	output/_recourt-arm2-round3.log
SWEPT	        5935	2026-08-10	output/shift27-dev2.log
SWEPT	        5890	2026-08-20	output/_server-before2.log
SWEPT	        5885	2026-08-23	output/_devserver-final.log
SWEPT	        5881	2026-09-05	output/530-reimagine-run.log
SWEPT	        5869	2026-08-08	output/sabotage-ship.log
SWEPT	        5833	2026-08-27	output/_shift129-run3b-console.log
SWEPT	        5829	2026-08-08	output/sabotage-shift7.log
SWEPT	        5827	2026-09-13	output/_card-menugroup-promotion.md
SWEPT	        5782	2026-09-14	output/_967-pr-body.md
SWEPT	        5754	2026-08-08	output/diag2.log
SWEPT	        5725	2026-08-16	output/regen-drive.log
SWEPT	        5725	2026-08-16	output/regen-drive2.log
SWEPT	        5725	2026-08-16	output/regen-drive3.log
SWEPT	        5722	2026-08-23	output/_sign-arm4.log
SWEPT	        5712	2026-08-29	output/_shift90-shape.txt
SWEPT	        5704	2026-08-20	output/_server-words-after.log
SWEPT	        5695	2026-08-09	output/bench-a-smoke.log
SWEPT	        5685	2026-08-28	output/_shift88-pr.md
SWEPT	        5571	2026-08-16	output/shift-open-state.log
SWEPT	        5565	2026-08-17	output/shift-park-state.log
SWEPT	        5548	2026-08-29	output/_shift94-pr.md
SWEPT	        5532	2026-08-28	output/_shift85-pr.md
SWEPT	        5445	2026-09-07	output/_548-sg-1.txt
SWEPT	        5445	2026-09-07	output/_548-sg-2.txt
SWEPT	        5438	2026-08-22	output/_court-roll-a.log
SWEPT	        5436	2026-09-07	output/_548-pr-body.md
SWEPT	        5397	2026-09-13	output/_919-dev.log
SWEPT	        5357	2026-09-08	output/_638-feasibility.md
SWEPT	        5347	2026-09-13	output/_903-cur.md
SWEPT	        5346	2026-09-13	output/_903-new.md
SWEPT	        5321	2026-09-09	output/419-pr-body.md
SWEPT	        5315	2026-08-29	output/_shift108-233-comment.md
SWEPT	        5299	2026-08-08	output/run15-verdicts.log
SWEPT	        5292	2026-09-05	output/530-verdict2.md
SWEPT	        5292	2026-08-30	output/_shift117-262-comment.md
SWEPT	        5240	2026-08-29	output/_shift95-pr.md
SWEPT	        5177	2026-09-14	output/_card-auditcat.md
SWEPT	        5177	2026-08-29	output/_shift108-prbody.md
SWEPT	        5167	2026-08-23	output/_bald-accept.log
SWEPT	        5124	2026-09-14	output/pr-933-body.md
SWEPT	        5020	2026-08-28	output/_shift86-issue111.md
SWEPT	        4984	2026-08-30	output/_shift117-commit2.txt
SWEPT	        4966	2026-09-13	output/_comment-482.md
SWEPT	        4958	2026-09-14	output/_939pr.md
SWEPT	        4914	2026-08-29	output/_shift91-commitmsg.txt
SWEPT	        4904	2026-08-23	output/_dev-price.log
SWEPT	        4851	2026-08-29	output/_shift93-dev.log
SWEPT	        4846	2026-08-25	output/machinist-reread-14d.txt
SWEPT	        4846	2026-08-29	output/_shift93-185.md
SWEPT	        4840	2026-08-30	output/_shift117-00b-followup.md
SWEPT	        4834	2026-08-20	output/_dev.log
SWEPT	        4827	2026-09-12	output/_rite-20260912-1215.log
SWEPT	        4820	2026-08-29	output/_shift92-newcard.md
SWEPT	        4772	2026-08-09	output/segstore-shift10-5.log
SWEPT	        4753	2026-09-07	output/_647-pr-body.md
SWEPT	        4751	2026-08-29	output/_shift91-221.md
SWEPT	        4731	2026-08-25	output/machinist-reading-2026-08-26.txt
SWEPT	        4721	2026-09-11	output/_346-rite.log
SWEPT	        4713	2026-09-14	output/_941-rite.log
SWEPT	        4711	2026-08-28	output/_shift88-commitmsg.txt
SWEPT	        4698	2026-08-28	output/_shift84-rite.log
SWEPT	        4694	2026-08-08	output/sabotage-d238.log
SWEPT	        4694	2026-08-08	output/sabotage-merge.log
SWEPT	        4694	2026-08-08	output/sabotage-park.log
SWEPT	        4693	2026-08-08	output/sabotage-ship2.log
SWEPT	        4655	2026-09-14	output/_965-rite2.log
SWEPT	        4649	2026-08-09	output/segstore-shift10-3.log
SWEPT	        4641	2026-09-14	output/_941-pager.mts
SWEPT	        4608	2026-08-22	output/_glossary-sitting2.log
SWEPT	        4587	2026-08-23	output/_devserver-ink.log
SWEPT	        4585	2026-08-17	output/carry-walk.log
SWEPT	        4557	2026-08-28	output/_shift89-issue219b.md
SWEPT	        4549	2026-08-12	output/shift64-earring-two-step.log
SWEPT	        4529	2026-08-12	output/shift64-earring-two-step-2.log
SWEPT	        4497	2026-09-08	output/_pr428-body.md
SWEPT	        4497	2026-08-28	output/_shift85-issue210b.md
SWEPT	        4483	2026-08-23	output/_sign-accept.log
SWEPT	        4463	2026-08-29	output/_shift93-crop-pr.md
SWEPT	        4460	2026-08-09	output/nocaption-n8.log
SWEPT	        4439	2026-08-12	output/shift65-earring-acceptance.log
SWEPT	        4402	2026-08-29	output/_shift108-newcard.md
SWEPT	        4323	2026-09-07	output/pr642-body.md
SWEPT	        4320	2026-08-17	output/crop-carry-2.log
SWEPT	        4306	2026-08-29	output/_shift92-prbody.md
SWEPT	        4295	2026-09-13	output/_902-new.md
SWEPT	        4286	2026-08-09	output/segstore-shift10-1.log
SWEPT	        4285	2026-09-14	output/_rite400.log
SWEPT	        4232	2026-08-28	output/_shift86-commitmsg.txt
SWEPT	        4221	2026-08-28	output/_shift89-retro.md
SWEPT	        4204	2026-09-14	output/_941-drive.mts
SWEPT	        4198	2026-08-12	output/shift64-paid-two-step.log
SWEPT	        4195	2026-08-29	output/_shift93-commitmsg.txt
SWEPT	        4165	2026-08-28	output/_janitor-issue8-comment.md
SWEPT	        4161	2026-09-14	output/_939commitmsg.txt
SWEPT	        4154	2026-08-24	output/_1215_rite.log
SWEPT	        4154	2026-08-24	output/_1222_rite.log
SWEPT	        4144	2026-08-24	output/_1200_rite.log
SWEPT	        4141	2026-08-24	output/_1221_rite.log
SWEPT	        4140	2026-08-24	output/_1217_rite.log
SWEPT	        4137	2026-08-29	output/_shift97-228-comment.md
SWEPT	        4133	2026-08-22	output/_clean-sheet3.log
SWEPT	        4129	2026-08-22	output/_clean-sheet.log
SWEPT	        4129	2026-08-22	output/_clean-sheet2.log
SWEPT	        4116	2026-08-24	output/_armR-run.log
SWEPT	        4106	2026-08-24	output/_1203_rite.log
SWEPT	        4103	2026-08-24	output/_1216b_rite.log
SWEPT	        4103	2026-09-14	output/_938-frames.mts
SWEPT	        4100	2026-09-14	output/_941-frames.mts
SWEPT	        4099	2026-08-25	output/edition17.py
SWEPT	        4099	2026-08-24	output/_1214_rite.log
SWEPT	        4098	2026-08-24	output/_1211_rite.log
SWEPT	        4097	2026-09-14	output/_938-modframes.mts
SWEPT	        4086	2026-08-29	output/_shift90-issue120.md
SWEPT	        4066	2026-08-30	output/_shift117-prbody.md
SWEPT	        4018	2026-09-09	output/_716-body.md
SWEPT	        4015	2026-08-12	output/shift64-earring-acceptance.log
SWEPT	        4006	2026-08-28	output/_shift84-209-comment.md
SWEPT	        3958	2026-08-29	output/_shift96-pr.md
SWEPT	        3951	2026-08-29	output/_shift93-219.md
SWEPT	        3950	2026-08-17	output/crop-carry.log
SWEPT	        3906	2026-08-31	output/stale-recommendation-card.md
SWEPT	        3889	2026-09-02	output/_422-pr-body.md
SWEPT	        3865	2026-08-30	output/_shift114-r38.md
SWEPT	        3817	2026-09-14	output/card-audit-category.md
SWEPT	        3810	2026-08-29	output/_shift94-185.md
SWEPT	        3808	2026-08-28	output/_shift84-sabotage.log
SWEPT	        3798	2026-08-12	output/shift64-sided-repeat.log
SWEPT	        3788	2026-09-07	output/_650-preflight3.txt
SWEPT	        3780	2026-08-28	output/_janitor-card-guard.md
SWEPT	        3776	2026-08-09	output/skin-sweep.log
SWEPT	        3772	2026-08-31	output/stale-body.md
SWEPT	        3748	2026-08-28	output/_janitor-card-recurrence.md
SWEPT	        3720	2026-08-28	output/_shift85-commitmsg2.txt
SWEPT	        3716	2026-08-12	output/shift63-removal-class-run.log
SWEPT	        3693	2026-08-10	output/count-bisect.log
SWEPT	        3682	2026-08-28	output/_shift88-card-review.md
SWEPT	        3681	2026-08-30	output/_shift117-commit3.txt
SWEPT	        3676	2026-09-07	output/_548-litter-backup-probe-combo-drop.mts.txt
SWEPT	        3648	2026-08-29	output/_shift91-221b.md
SWEPT	        3645	2026-09-13	output/_916-body.md
SWEPT	        3605	2026-08-29	output/_shift90-commitmsg.txt
SWEPT	        3604	2026-08-29	output/_shift93-cropmsg.txt
SWEPT	        3560	2026-08-09	output/guards-shift8.log
SWEPT	        3557	2026-08-30	output/_shift117-prbody3.md
SWEPT	        3551	2026-09-14	output/_card-sictimeout.md
SWEPT	        3532	2026-09-13	output/_916-head.md
SWEPT	        3527	2026-09-14	output/_card-paging.md
SWEPT	        3515	2026-09-02	output/_422-comment.md
SWEPT	        3491	2026-09-14	output/pr-931-body.md
SWEPT	        3490	2026-08-30	output/_shift114-r39.md
SWEPT	        3449	2026-09-13	output/_884-run5.md
SWEPT	        3389	2026-09-08	output/_server-labels-card.md
SWEPT	        3376	2026-08-09	output/hair-sweep.log
SWEPT	        3365	2026-08-29	output/_shift93-223.md
SWEPT	        3342	2026-09-07	output/devservers-overcount.md
SWEPT	        3308	2026-08-29	output/_shift92-219.md
SWEPT	        3275	2026-08-08	output/interpreter-ceiling-2.log
SWEPT	        3271	2026-09-08	output/_login-hex-card.md
SWEPT	        3264	2026-08-25	output/_court3b.log
SWEPT	        3261	2026-08-25	output/_court3.log
SWEPT	        3253	2026-09-05	output/pr-420-body.md
SWEPT	        3238	2026-08-12	output/shift64-brief-extraction.log
SWEPT	        3238	2026-09-13	output/_903-body.md
SWEPT	        3229	2026-08-25	output/janitor-briefing-patch.mjs
SWEPT	        3227	2026-08-17	output/open-lane-walk.log
SWEPT	        3188	2026-08-29	output/_shift101-sphinx.json
SWEPT	        3171	2026-09-14	output/_card-groupb.md
SWEPT	        3166	2026-08-29	output/_shift108-commitmsg.txt
SWEPT	        3163	2026-09-14	output/_esection.md
SWEPT	        3146	2026-08-24	output/_strips.log
SWEPT	        3142	2026-08-28	output/_shift85-commitmsg.txt
SWEPT	        3112	2026-08-29	output/_shift90-stall-card.md
SWEPT	        3102	2026-08-30	output/_shift117-commitmsg.txt
SWEPT	        3083	2026-08-29	output/_shift91-221d.md
SWEPT	        3080	2026-08-23	output/_chest-court.log
SWEPT	        3049	2026-09-14	output/_941comment.md
SWEPT	        3040	2026-08-29	output/_shift92-220.md
SWEPT	        3026	2026-08-28	output/_shift84-8-comment.md
SWEPT	        3019	2026-08-10	output/shift27-dev-flagoff.log
SWEPT	        2992	2026-08-22	output/_glossary-court-run.log
SWEPT	        2959	2026-08-23	output/_c3_cap.log
SWEPT	        2959	2026-08-25	output/_cap.log
SWEPT	        2959	2026-08-29	output/_shift96-cap.log
SWEPT	        2943	2026-09-07	output/_scriptguards-card.md
SWEPT	        2922	2026-09-14	output/_939drive-disposable.mts
SWEPT	        2917	2026-08-28	output/_shift86-issue8.md
SWEPT	        2907	2026-08-12	output/shift64-sided-both.log
SWEPT	        2906	2026-08-16	output/regen-dim.log
SWEPT	        2898	2026-08-13	output/devserver-shift74.log
SWEPT	        2895	2026-09-07	output/_647-preflight.txt
SWEPT	        2890	2026-09-14	output/_941reach-disposable.mts
SWEPT	        2888	2026-08-29	output/_shift95-185.md
SWEPT	        2884	2026-09-05	output/530-estimate2.md
SWEPT	        2851	2026-09-11	output/_811-card-body.md
SWEPT	        2831	2026-09-14	output/_965-rite.log
SWEPT	        2818	2026-08-18	output/verify-server.log
SWEPT	        2811	2026-09-08	output/janitor-run4-temp-manifest.txt
SWEPT	        2751	2026-09-01	output/365-commit-msg.txt
SWEPT	        2730	2026-08-29	output/_shift94-commit.txt
SWEPT	        2708	2026-09-13	output/_902-body.md
SWEPT	        2706	2026-08-28	output/_janitor-issue108-comment.md
SWEPT	        2678	2026-09-14	output/_dev3000.log
SWEPT	        2629	2026-09-07	output/561-close.md
SWEPT	        2608	2026-08-25	output/card-111-body.md
SWEPT	        2608	2026-08-29	output/_shift93-198.md
SWEPT	        2603	2026-08-13	output/albino-run.log
SWEPT	        2565	2026-08-28	output/_shift89-commitmsg.txt
SWEPT	        2562	2026-09-14	output/_dev3001.log
SWEPT	        2561	2026-09-12	output/_merge-847-848.log
SWEPT	        2539	2026-08-23	output/_dev3010.log
SWEPT	        2532	2026-08-28	output/_shift84-commitmsg.txt
SWEPT	        2527	2026-08-28	output/_shift88-issue217.md
SWEPT	        2504	2026-09-14	output/_939sideeffects-disposable.mts
SWEPT	        2504	2026-08-28	output/_shift84-211-comment.md
SWEPT	        2500	2026-09-01	output/_381-dev.log
SWEPT	        2499	2026-08-29	output/_shift90-open.txt
SWEPT	        2469	2026-08-09	output/assembly-lines.log
SWEPT	        2444	2026-09-14	output/_fsection.md
SWEPT	        2427	2026-08-10	output/carry-diff.log
SWEPT	        2413	2026-08-29	output/_shift90-issue219.md
SWEPT	        2391	2026-08-13	output/body-run.log
SWEPT	        2380	2026-08-22	output/_court-sign-b.log
SWEPT	        2366	2026-09-16	output/dev-main.log
SWEPT	        2336	2026-09-08	output/_677-findings.md
SWEPT	        2334	2026-08-17	output/wings-per-side-run.log
SWEPT	        2297	2026-08-29	output/_shift91-220.md
SWEPT	        2294	2026-08-09	output/captionlast.log
SWEPT	        2231	2026-09-16	output/c1002-reread.md
SWEPT	        2231	2026-08-29	output/_shift91-221c.md
SWEPT	        2230	2026-09-14	output/_938sweep2-disposable.mjs
SWEPT	        2228	2026-08-29	output/_shift92-commitmsg.txt
SWEPT	        2219	2026-08-29	output/_shift108-219-comment.md
SWEPT	        2215	2026-08-12	output/shift63-vacate-run3.log
SWEPT	        2169	2026-08-30	output/_shift114-r41.md
SWEPT	        2160	2026-08-29	output/_shift96-220.md
SWEPT	        2141	2026-08-29	output/_shift93-sabotage2.log
SWEPT	        2125	2026-08-29	output/_shift94-219.md
SWEPT	        2119	2026-08-30	output/_shift114-briefcommit2.txt
SWEPT	        2118	2026-08-29	output/_shift92-129b.md
SWEPT	        2108	2026-09-13	output/_903-head.md
SWEPT	        2103	2026-08-22	output/_dev-1048.log
SWEPT	        2061	2026-08-13	output/smile-walk-run1.log
SWEPT	        2052	2026-08-23	output/_check-1112.log
SWEPT	        2052	2026-08-23	output/_check-1113.log
SWEPT	        2052	2026-08-23	output/_check-1116.log
SWEPT	        2052	2026-08-23	output/_check-1117.log
SWEPT	        2052	2026-08-23	output/_check-1118.log
SWEPT	        2052	2026-08-23	output/_check-1119.log
SWEPT	        2052	2026-08-23	output/_check-1120.log
SWEPT	        2052	2026-08-23	output/_check-1122.log
SWEPT	        2052	2026-08-23	output/_check-1123.log
SWEPT	        2047	2026-08-24	output/_1195_check.log
SWEPT	        2047	2026-08-24	output/_1198_check.log
SWEPT	        2047	2026-08-24	output/_1200_check.log
SWEPT	        2047	2026-08-24	output/_1203_check.log
SWEPT	        2047	2026-08-24	output/_1211_check.log
SWEPT	        2047	2026-08-24	output/_1214_check.log
SWEPT	        2047	2026-08-24	output/_1215_check.log
SWEPT	        2047	2026-08-24	output/_1216_check.log
SWEPT	        2047	2026-08-24	output/_1217_check.log
SWEPT	        2047	2026-08-24	output/_1220_check.log
SWEPT	        2047	2026-08-24	output/_1222_check.log
SWEPT	        2034	2026-08-09	output/nbp-sweep.log
SWEPT	        2034	2026-08-23	output/_1161_check.log
SWEPT	        2034	2026-08-23	output/_check-1104.log
SWEPT	        2034	2026-08-23	output/_check-1107.log
SWEPT	        2034	2026-08-23	output/_check-1108.log
SWEPT	        2034	2026-08-23	output/_check-1108b.log
SWEPT	        2034	2026-08-23	output/_check-1109.log
SWEPT	        2034	2026-08-23	output/_check-caption.log
SWEPT	        2034	2026-08-23	output/_check-carried.log
SWEPT	        2034	2026-08-23	output/_check-chest.log
SWEPT	        2034	2026-08-23	output/_check-hair.log
SWEPT	        2034	2026-08-23	output/_check-ink.log
SWEPT	        2034	2026-08-25	output/_shift-check.log
SWEPT	        2034	2026-08-28	output/_shift88-check.log
SWEPT	        2034	2026-08-28	output/_shift88-check2.log
SWEPT	        2034	2026-08-29	output/_shift92-check.log
SWEPT	        2034	2026-08-29	output/_shift92-check2.log
SWEPT	        2034	2026-08-29	output/_shift93-check.log
SWEPT	        2034	2026-08-29	output/_shift93-check2.log
SWEPT	        2034	2026-08-29	output/_shift93-check3.log
SWEPT	        2033	2026-08-23	output/_check-1103.log
SWEPT	        2033	2026-08-23	output/_check-1105.log
SWEPT	        2033	2026-08-23	output/_check-82c.log
SWEPT	        2033	2026-08-23	output/_check-devservers.log
SWEPT	        2002	2026-08-29	output/_shift93-briefmsg.txt
SWEPT	        1956	2026-08-09	output/engine-848.log
SWEPT	        1950	2026-08-29	output/_shift93-sabotage.log
SWEPT	        1938	2026-08-29	output/_shift95-commit.txt
SWEPT	        1932	2026-08-30	output/_shift114-r34.md
SWEPT	        1931	2026-08-08	output/freckles-ani-r1.log
SWEPT	        1931	2026-08-08	output/freckles-ani-r2.log
SWEPT	        1929	2026-08-08	output/freckles-ani-r3.log
SWEPT	        1929	2026-08-08	output/freckles-imp-r2.log
SWEPT	        1929	2026-08-08	output/freckles-imp-r3.log
SWEPT	        1929	2026-08-08	output/freckles-nocaption.log
SWEPT	        1929	2026-08-22	output/_check-1039.log
SWEPT	        1928	2026-08-08	output/freckles-imp-r1.log
SWEPT	        1927	2026-08-08	output/freckles-anc-r1.log
SWEPT	        1927	2026-08-08	output/freckles-anc-r2.log
SWEPT	        1925	2026-08-08	output/freckles-anc-r3.log
SWEPT	        1923	2026-08-08	output/freckles-nobare.log
SWEPT	        1920	2026-08-08	output/freckles-carried-r2.log
SWEPT	        1920	2026-08-08	output/freckles-carried-r3.log
SWEPT	        1918	2026-09-12	output/_855-claim.md
SWEPT	        1916	2026-08-08	output/freckles-carried.log
SWEPT	        1912	2026-08-08	output/freckles-w15-r4.log
SWEPT	        1912	2026-08-08	output/freckles-w15-r8.log
SWEPT	        1911	2026-08-08	output/freckles-w15-r5.log
SWEPT	        1911	2026-08-08	output/freckles-w15-r9.log
SWEPT	        1911	2026-08-08	output/freckles-written-run15-r2.log
SWEPT	        1910	2026-08-08	output/freckles-written-run15-r3.log
SWEPT	        1908	2026-08-08	output/freckles-w15-r7.log
SWEPT	        1907	2026-08-08	output/freckles-carried-alone-r3.log
SWEPT	        1907	2026-08-08	output/freckles-written15.log
SWEPT	        1906	2026-08-30	output/_shift114-briefcommit4.txt
SWEPT	        1904	2026-08-08	output/freckles-carried-alone-r2.log
SWEPT	        1902	2026-08-08	output/freckles-alone.log
SWEPT	        1879	2026-09-16	output/dev-main2.log
SWEPT	        1849	2026-08-29	output/_shift90-221b.md
SWEPT	        1820	2026-08-29	output/_shift91-8.md
SWEPT	        1812	2026-08-29	output/_shift94-220.md
SWEPT	        1799	2026-09-08	output/_428-render.md
SWEPT	        1792	2026-09-14	output/_941-main.log
SWEPT	        1750	2026-08-23	output/_sign-arm3.log
SWEPT	        1749	2026-08-22	output/_check-1017.log
SWEPT	        1749	2026-08-22	output/_check-1031.log
SWEPT	        1749	2026-08-22	output/_check-1033.log
SWEPT	        1749	2026-08-22	output/_check-1034.log
SWEPT	        1749	2026-08-22	output/_check-1045.log
SWEPT	        1749	2026-08-22	output/_check-1047.log
SWEPT	        1749	2026-08-22	output/_check-1048a.log
SWEPT	        1749	2026-08-22	output/_check-1052.log
SWEPT	        1749	2026-08-22	output/_check-1057b.log
SWEPT	        1749	2026-08-22	output/_check-1062.log
SWEPT	        1749	2026-08-22	output/_check-1087.log
SWEPT	        1749	2026-08-22	output/_check-roadmap.log
SWEPT	        1749	2026-08-22	output/_check-shift-start.log
SWEPT	        1748	2026-08-22	output/_check-1016.log
SWEPT	        1748	2026-08-22	output/_check-1020.log
SWEPT	        1748	2026-08-22	output/_check-1038.log
SWEPT	        1748	2026-08-22	output/_check-1061.log
SWEPT	        1730	2026-08-22	output/_check-1092.log
SWEPT	        1730	2026-08-22	output/_check-1092b.log
SWEPT	        1730	2026-08-22	output/_check-1094.log
SWEPT	        1730	2026-08-23	output/_check-1096.log
SWEPT	        1730	2026-08-23	output/_check-1101.log
SWEPT	        1729	2026-08-22	output/_check-1092c.log
SWEPT	        1729	2026-08-22	output/_check-1093.log
SWEPT	        1729	2026-08-23	output/_check-1100.log
SWEPT	        1729	2026-08-23	output/_check-1100b.log
SWEPT	        1726	2026-08-22	output/_dev-1067.log
SWEPT	        1722	2026-08-28	output/_shift86-commitmsg2.txt
SWEPT	        1710	2026-08-16	output/burst-named.log
SWEPT	        1686	2026-09-13	output/_513-close.md
SWEPT	        1673	2026-08-29	output/_shift91-219.md
SWEPT	        1661	2026-08-30	output/_shift114-r36.md
SWEPT	        1653	2026-09-14	output/_rite400b.log
SWEPT	        1637	2026-08-30	output/_shift114-briefcommit3.txt
SWEPT	        1633	2026-08-08	output/freckle-density-run15.log
SWEPT	        1632	2026-08-30	output/_shift114-briefcommit5.txt
SWEPT	        1627	2026-08-09	output/cheek-sweep.log
SWEPT	        1600	2026-08-22	output/_check-1025.log
SWEPT	        1600	2026-08-22	output/_check-1026.log
SWEPT	        1600	2026-08-22	output/_check-1027.log
SWEPT	        1600	2026-08-22	output/_check-1028.log
SWEPT	        1587	2026-09-13	output/_902-head.md
SWEPT	        1573	2026-09-14	output/_939rows-disposable.mts
SWEPT	        1558	2026-09-11	output/_811-pr-body.md
SWEPT	        1558	2026-08-29	output/_shift96-219.md
SWEPT	        1525	2026-08-30	output/_shift114-r35.md
SWEPT	        1503	2026-08-12	output/shift63-vacate-run.log
SWEPT	        1472	2026-08-20	output/_court-words-before.log
SWEPT	        1467	2026-08-13	output/removal-routing-run1.log
SWEPT	        1447	2026-08-12	output/shift63-removal-synthesis-run.log
SWEPT	        1434	2026-08-08	output/freckles-w15-r6.log
SWEPT	        1402	2026-09-13	output/_903-head2.md
SWEPT	        1391	2026-08-22	output/_dev-1058.log
SWEPT	        1390	2026-08-16	output/eaten-honest.log
SWEPT	        1377	2026-08-29	output/_shift108-202-comment.md
SWEPT	        1358	2026-08-20	output/_check5.log
SWEPT	        1358	2026-08-20	output/_check6.log
SWEPT	        1357	2026-08-21	output/check-971.log
SWEPT	        1344	2026-08-21	output/check-4a.log
SWEPT	        1344	2026-08-21	output/check-census.log
SWEPT	        1344	2026-08-21	output/check-fix2.log
SWEPT	        1343	2026-08-21	output/check-route.log
SWEPT	        1343	2026-08-18	output/check5.log
SWEPT	        1343	2026-08-18	output/check6.log
SWEPT	        1343	2026-08-18	output/check7.log
SWEPT	        1342	2026-08-12	output/shift63-vacate-run2.log
SWEPT	        1333	2026-08-29	output/_shift96-202.md
SWEPT	        1321	2026-08-29	output/_shift92-129.md
SWEPT	        1293	2026-08-29	output/_shift94-202.md
SWEPT	        1283	2026-08-08	output/bespectacled-roll-prod.log
SWEPT	        1283	2026-08-08	output/bespectacled-roll.log
SWEPT	        1231	2026-09-14	output/_938-seed.mts
SWEPT	        1227	2026-09-08	output/_428-dev.log
SWEPT	        1216	2026-08-08	output/inherit-1.log
SWEPT	        1192	2026-09-14	output/_938sweep-disposable.mjs
SWEPT	        1181	2026-08-29	output/_shift92-briefmsg.txt
SWEPT	        1179	2026-08-29	output/_shift90-draft.md
SWEPT	        1178	2026-08-29	output/_shift90-issue203.md
SWEPT	        1146	2026-08-29	output/_shift95-219.md
SWEPT	        1145	2026-08-12	output/shift63-removal-synthesis-earring-run.log
SWEPT	        1143	2026-08-16	output/burst-diag.log
SWEPT	        1135	2026-08-29	output/_shift95-202.md
SWEPT	        1119	2026-09-05	output/420-drive.json
SWEPT	        1111	2026-08-13	output/devserver-shift74b.log
SWEPT	        1106	2026-08-13	output/smile-walk-run2-oldroad.log
SWEPT	        1105	2026-08-08	output/sabotage-5.log
SWEPT	        1086	2026-08-08	output/reflake.log
SWEPT	        1069	2026-08-16	output/burst-fixed.log
SWEPT	        1069	2026-08-16	output/burst-sabotage.log
SWEPT	        1066	2026-08-28	output/_shift85-202.md
SWEPT	        1061	2026-08-12	output/shift64-suite.log
SWEPT	        1039	2026-08-29	output/_shift93-race.log
SWEPT	        1001	2026-09-14	output/_c2section.md
SWEPT	         995	2026-09-14	output/_e400commit.txt
SWEPT	         988	2026-08-16	output/eaten.log
SWEPT	         979	2026-08-09	output/sitting-shift8.log
SWEPT	         975	2026-08-12	output/shift64-earring-cast.log
SWEPT	         973	2026-08-20	output/ink-carry-fixed-run3.log
SWEPT	         958	2026-08-29	output/_shift90-inspect.py
SWEPT	         956	2026-08-28	output/_shift85-suite.log
SWEPT	         935	2026-08-15	output/safety-run.log
SWEPT	         922	2026-08-08	output/sabotage-3.log
SWEPT	         922	2026-08-29	output/_shift108-briefmsg.txt
SWEPT	         912	2026-08-08	output/sabotage-4.log
SWEPT	         889	2026-08-20	output/_court-words-after.log
SWEPT	         885	2026-08-08	output/walk-dryrun.log
SWEPT	         885	2026-08-29	output/_shift95-briefcommit.txt
SWEPT	         870	2026-08-22	output/_dev-direct.log
SWEPT	         869	2026-08-20	output/_court-carry-b2.log
SWEPT	         859	2026-08-22	output/_check-1048b.log
SWEPT	         844	2026-08-24	output/_tmin-after.log
SWEPT	         844	2026-08-24	output/_tmin-before.log
SWEPT	         838	2026-08-20	output/_court-before-step2.log
SWEPT	         835	2026-08-20	output/_court-after-step2.log
SWEPT	         835	2026-08-20	output/_court-carry-b.log
SWEPT	         819	2026-08-16	output/eaten-sabotage.log
SWEPT	         817	2026-08-20	output/ink-carry-fixed-run.log
SWEPT	         810	2026-08-20	output/_court-after-run.log
SWEPT	         808	2026-08-30	output/_shift114-briefcommit.txt
SWEPT	         803	2026-08-20	output/_court-before-run.log
SWEPT	         773	2026-09-14	output/_938-unseed.mts
SWEPT	         755	2026-08-09	output/sitting-shift8b.log
SWEPT	         752	2026-08-29	output/_shift97-202-comment.md
SWEPT	         731	2026-08-08	output/guards.log
SWEPT	         698	2026-08-09	output/test-lanes.log
SWEPT	         672	2026-08-29	output/_shift97-219-comment.md
SWEPT	         667	2026-08-22	output/_integration-1091.log
SWEPT	         618	2026-08-29	output/_shift96-reader-after.txt
SWEPT	         604	2026-08-20	output/_atlascheck.log
SWEPT	         600	2026-08-08	output/failcopy.log
SWEPT	         600	2026-08-23	output/_atlas-1123.log
SWEPT	         589	2026-08-08	output/atlas-test.log
SWEPT	         583	2026-08-12	output/shift64-mirror.log
SWEPT	         581	2026-08-20	output/ink-carry-fixed-run5.log
SWEPT	         567	2026-08-08	output/interpreter-ceiling.log
SWEPT	         559	2026-08-08	output/fixture-composed-final2.log
SWEPT	         550	2026-08-20	output/_ink.log
SWEPT	         518	2026-08-30	output/_shift114-r40.md
SWEPT	         488	2026-08-20	output/_cut.log
SWEPT	         486	2026-09-14	output/_938writers-disposable.sh
SWEPT	         485	2026-09-14	output/_939token-disposable.mts
SWEPT	         482	2026-08-29	output/_shift90-shape.py
SWEPT	         480	2026-08-08	output/fixture-composed-final.log
SWEPT	         479	2026-08-29	output/_shift90-221c.md
SWEPT	         478	2026-08-20	output/_reask.log
SWEPT	         467	2026-08-08	output/rel-2.log
SWEPT	         467	2026-08-08	output/rel-3.log
SWEPT	         467	2026-08-08	output/rel-4.log
SWEPT	         463	2026-08-09	output/test-refinedelta.log
SWEPT	         462	2026-08-22	output/_check-1049b.log
SWEPT	         460	2026-08-22	output/_check-unwiring.log
SWEPT	         455	2026-08-29	output/_shift90-open.py
SWEPT	         437	2026-08-28	output/_shift85-commitmsg3.txt
SWEPT	         434	2026-08-12	output/shift64-suite2.log
SWEPT	         433	2026-08-12	output/shift64-suite3.log
SWEPT	         427	2026-08-29	output/_shift91-check.log
SWEPT	         424	2026-08-23	output/_check-1098.log
SWEPT	         413	2026-08-24	output/_1216_rite.log
SWEPT	         398	2026-08-29	output/_shift96-orphans.txt
SWEPT	         394	2026-09-14	output/_939bot-disposable.mts
SWEPT	         394	2026-09-14	output/_rite400.err
SWEPT	         384	2026-08-28	output/_shift84-files.txt
SWEPT	         375	2026-09-14	output/_938-rows.mts
SWEPT	         357	2026-08-20	output/ink-carry-step2-run.log
SWEPT	         354	2026-08-09	output/sitting-848.log
SWEPT	         336	2026-08-09	output/sitting-cheek.log
SWEPT	         336	2026-08-09	output/sitting-hair.log
SWEPT	         312	2026-09-16	output/dev-main.err.log
SWEPT	         290	2026-08-08	output/check-3.log
SWEPT	         289	2026-08-20	output/ink-carry-fixed-run4.log
SWEPT	         276	2026-09-13	output/_919-dev.err
SWEPT	         233	2026-08-09	output/atlas-gen.log
SWEPT	         233	2026-08-08	output/atlas-gen2.log
SWEPT	         233	2026-08-08	output/atlas-gen3.log
SWEPT	         233	2026-08-08	output/atlas-gen4.log
SWEPT	         233	2026-08-08	output/atlas-gen5.log
SWEPT	         233	2026-08-09	output/atlas-shift10-1.log
SWEPT	         233	2026-08-09	output/atlas-shift10-2.log
SWEPT	         233	2026-08-09	output/atlas-shift10-3.log
SWEPT	         233	2026-08-09	output/atlas-shift10-4.log
SWEPT	         233	2026-08-09	output/atlas-shift10-5.log
SWEPT	         233	2026-08-08	output/atlas-shift7.log
SWEPT	         233	2026-08-08	output/atlas-shift7b.log
SWEPT	         233	2026-08-09	output/atlas-shift8.log
SWEPT	         233	2026-08-23	output/_1161_atlas.log
SWEPT	         233	2026-08-20	output/_atlas-shift87.log
SWEPT	         233	2026-08-20	output/_atlas-shift87b.log
SWEPT	         233	2026-08-20	output/_atlas-shift90.log
SWEPT	         233	2026-08-20	output/_atlas-shift90b.log
SWEPT	         233	2026-08-20	output/_atlas-shift90c.log
SWEPT	         233	2026-08-25	output/_atlas.log
SWEPT	         233	2026-08-20	output/_atlas2.log
SWEPT	         233	2026-08-20	output/_atlas3.log
SWEPT	         233	2026-08-23	output/_c3_atlas.log
SWEPT	         233	2026-08-29	output/_shift93-atlas.log
SWEPT	         233	2026-08-29	output/_shift96-arch.log
SWEPT	         220	2026-08-28	output/_janitor-delete-probe.log
SWEPT	         201	2026-08-22	output/_cap-1066.log
SWEPT	         189	2026-08-23	output/_c3_capcheck.log
SWEPT	         176	2026-08-28	output/_janitor-delete-probe2.log
SWEPT	         175	2026-08-23	output/_c3_atlascheck.log
SWEPT	         151	2026-08-24	output/_bal-1200.log
SWEPT	         138	2026-08-24	output/_bal-1199.log
SWEPT	         129	2026-08-20	output/ink-carry-fixed-run2.log
SWEPT	         128	2026-08-24	output/_bal-1206.log
SWEPT	         113	2026-08-28	output/_janitor-control-log.txt
SWEPT	         106	2026-08-22	output/_dev-1091.log
SWEPT	         105	2026-08-08	output/check-1.log
SWEPT	         105	2026-08-08	output/check-10.log
SWEPT	         105	2026-08-08	output/check-11.log
SWEPT	         105	2026-08-08	output/check-12.log
SWEPT	         105	2026-08-08	output/check-13.log
SWEPT	         105	2026-08-08	output/check-2.log
SWEPT	         105	2026-08-08	output/check-4.log
SWEPT	         105	2026-08-08	output/check-5.log
SWEPT	         105	2026-08-08	output/check-6.log
SWEPT	         105	2026-08-08	output/check-7.log
SWEPT	         105	2026-08-08	output/check-8.log
SWEPT	         105	2026-08-08	output/check-9.log
SWEPT	         105	2026-08-09	output/check-shift10-1.log
SWEPT	         105	2026-08-09	output/check-shift10-2.log
SWEPT	         105	2026-08-08	output/check-shift7.log
SWEPT	         105	2026-08-09	output/check-shift8.log
SWEPT	         105	2026-08-09	output/check-shift8b.log
SWEPT	          98	2026-08-28	output/_shift86-commitmsg3.txt
SWEPT	          92	2026-09-16	output/dev-main2.err.log
SWEPT	          92	2026-09-14	output/_941-main.err
SWEPT	          92	2026-09-14	output/_dev3000.err
SWEPT	          92	2026-09-14	output/_dev3001.err
SWEPT	          38	2026-08-29	output/_shift90-depid.txt
SWEPT	           0	2026-09-01	output/_381-dev.err.log
SWEPT	           0	2026-08-26	output/_shift130-issue.txt
SWEPT	           0	2026-08-28	output/_shift85-carry
```
