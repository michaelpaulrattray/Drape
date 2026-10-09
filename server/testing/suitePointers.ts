import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A DOCBLOCK THAT NAMES ITS OWN GUARD IS A CLAIM, AND IT IS ONE OF THE FEW A
 * MACHINE CAN SETTLE COMPLETELY (#647).
 *
 * *"<something>.test.ts drives it"* is either true or it is not: a file by that
 * name is tracked, or it is not. No line numbers, no judgement.
 *
 * ⚠ **NOTE THE ANGLE BRACKETS, BECAUSE THIS READER CAUGHT ITS OWN AUTHOR.** The
 * first draft of this docblock used a backticked example filename, and the arm
 * below correctly reported it — a backticked name in prose is a pointer, and
 * nothing in the bytes distinguishes an illustration from a claim. **So the
 * rule for writing ABOUT pointers is: do not backtick an example.** Exempting
 * them instead would have punched a hole in the reader for the sake of a
 * comment.
 *
 * ⚠ **THE HARM IS NOT UNTIDINESS, AND THIS REPOSITORY HAS PAID FOR IT TWICE.**
 * A reader who follows the pointer, finds nothing, and concludes *the guard was
 * never written* has just re-filed a LIVE control as a dead one. That is the
 * wrong-road class `CLAUDE.md`'s law-7 section documents at length — the
 * sensitive-action gate moved to "wired and lost" on the strength of a dead
 * import, the login-attack detector filed as "never wired" when it had run in
 * production for two months. Both cost months, and both were a record
 * disagreeing with the tree.
 *
 * # WHY A BASENAME AND NOT A RESOLVER
 *
 * `prosePointerDiscipline.test.ts` refused a *pointer-resolver* and its header
 * says why: built, run and refused, 46 broken pointers found and all three live
 * instances MISSED, because a line number is ambiguous — a line that still
 * holds something else reads as fine.
 *
 * **A basename is not ambiguous.** This closes the strictly smaller question
 * that has a yes/no answer, and leaves the one that does not exactly where that
 * suite left it.
 *
 * # SCOPE, STATED RATHER THAN IMPLIED
 *
 * ⚠ **THIS SECTION DECLARED TWO WHOLE FILE TYPES OUT OF SCOPE AND THE QUESTION
 * HAD NEVER BEEN ASKED — WIDENED 2026-10-03 (#1821).** It read *"Tracked `.ts`
 * and `.tsx` only. `.md` and `.mts` are a second population and are not claimed
 * here — a clean reading over this one says nothing about them."* Honest, and
 * **never measured** — which is what a stated limit looks like when nobody has
 * driven it: indistinguishable from a clean tree.
 *
 * Measured the day it was widened: **1,976 pointers across 3,091 files, 1,933
 * resolve, 43 dangle.** Of the 966 the widening ADDED — 728 in `.md`, 238 in
 * `.mts` — **20 dangle across 14 basenames, and every one of the 20 is correct
 * as written**: deliberate history (the credit-velocity caps, the Slack
 * retirement, the imagination meter, the ink plate road, the two paths, the
 * framing trim) or a backticked illustration. **So there was no dirt to sweep.
 * The finding was that a dangling pointer written in a `.md` or an `.mts`
 * shipped green** — and `docs/` is where this repository's law files live.
 * `CLAUDE.md` is in the population now, and its law-7 section is the paragraph
 * the harm above is quoted from.
 *
 * **Tracked `.ts`, `.tsx`, `.mts` and `.md` may POINT. Only `.ts`/`.tsx` is what
 * a pointer may RESOLVE TO**, and the two lists are read separately below rather
 * than one being used twice — a suite file is only ever a `.ts` or a `.tsx`, and
 * deriving the resolution target from the widened list would let a later
 * widening quietly make some other file satisfy a pointer.
 */

/**
 * A backticked reference to a test file, bare or path-qualified — a backticked
 * <name>.test.ts, or a backticked server/<name>.test.ts.
 *
 * ⚠ **THE PATH-QUALIFIED HALF WAS MISSING AND IT WAS A QUARTER OF THE
 * POPULATION** (PR #651's review, findings 1 and 2). The first version matched
 * `[A-Za-z0-9_.-]+`, which excludes `/`, so ~113 pointers written in the
 * <dir>/<name> style were invisible — and the module's own comment explained
 * their absence with a reason that was FALSE at the bytes, claiming those
 * mentions were unbackticked when `preflight.test.ts` backticks all three.
 * **A record disagreeing with the tree, inside the guard built to stop records
 * disagreeing with the tree.**
 *
 * The gap is CLOSED here rather than declared, because the reviewer had already
 * checked all ~113 against the tree and none dangled undeliberately — so
 * widening costs nothing today and stops a dangling pointer written in path
 * form from shipping green tomorrow. Resolution is still by BASENAME: the
 * question this guard answers is whether a file by that name is tracked, and a
 * path that has merely moved is a different, ambiguous question.
 */
const POINTER = /`((?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.test\.tsx?)`/g;

export type PointerReading = {
  /** Repo-relative, forward-slashed, of the file doing the pointing. */
  file: string;
  /** The basename it names. */
  names: string;
  /** 1-indexed line it sits on. */
  line: number;
  /** Whether a tracked file with that basename exists. */
  resolves: boolean;
};

/**
 * ⚠ **DELIBERATE MENTIONS OF A SUITE THAT DOES NOT EXIST — EACH WITH ITS OWN
 * REASON, AND THE REASON IS THE POINT.**
 *
 * Some sentences name a dead or never-born suite ON PURPOSE, and they are the
 * most valuable sentences of their kind rather than the sloppiest: a paragraph
 * explaining that a control DIED is worthless without naming what died. A guard
 * that indicts them teaches people to delete the history instead.
 *
 * So they are enumerated here, the way this repository already enumerates its
 * push paths and its capability debts — never inferred, never pattern-matched.
 * Adding a line is a deliberate act, and the `why` is what a later reader gets
 * instead of a mystery.
 */
export const DELIBERATELY_ABSENT: Record<string, { readonly why: string }> = {
  "viewRetryFreeOnce.test.ts": {
    why:
      "Deleted with the free Try again it drove (#1903 slice 3, 2026-10-07, on his ruling 'i " +
      "think we ditch the measure and checker... it should only detect catastropic failure'). " +
      "All 18 of its arms were about #1601 item 4 — the first ask on an unchecked view is free, " +
      "once, the second is paid — and both halves of that rule are gone: there is no free ask, " +
      "so there is nothing to ration, and `spentFreeViewRetryFilter` and " +
      "`listSpentFreeViewRetryAngles` are deleted with it. " +
      "⚠ THE POINTER THAT NAMES IT IS IN ITS REPLACEMENT, `viewRetryNoFreeAsk.test.ts`, AND " +
      "THAT IS DELIBERATE: the absence is the content of that suite's own docblock, which has " +
      "to say what coverage was removed and what replaced it, because a deletion that only " +
      "removes arms leaves the product less guarded than the day before. The replacement " +
      "INVERTS them — it holds that NO slot shape can produce a zero price, walked over the " +
      "offer's whole input space, which is strictly stronger than the rule it replaces because " +
      "the old one permitted a free ask and this one permits none. " +
      "⚠ AND ITS ARMS WERE CHECKED FOR ONE THAT WAS NOT COVERAGE OF THE DELETED THING, which " +
      "is the lesson the entry below this one paid for: the one worth keeping was the stale " +
      "free button — a tab opened before this deploy, carrying `priceCredits: 0`, pressed " +
      "after it — and it is carried into `viewRetryService.test.ts` as the hardest of the five " +
      "money arms rather than the easiest, because it is the only one of those shapes that can " +
      "still arrive at the till in production.",
  },
  "falSignViewWire.test.ts": {
    why:
      "Deleted with `createFalSunburstViewEngine` (#1554, 2026-09-30, on his ruling 'DELETE'). " +
      "It drove that FACTORY at the wire, so it was coverage of the thing removed rather than " +
      "of anything that survives — the factory had been the Sign's view engine for two days " +
      "(#1459) and path E took the delivered views back to Nano Banana Pro, leaving it wired " +
      "to nothing but this suite. Both remaining mentions are in " +
      "`signViewEngineChain.test.ts`, which is what the road is proved by now: one recording " +
      "what its own docblock used to claim, one recording what the deletion would have cost. " +
      "⚠ THE COST IS THE PART WORTH KEEPING: this suite held the tree's only mechanical arm " +
      "that a Sunburst `image_size` is a multiple of 16, as the door requires — and it read " +
      "`SIGNED_VIEW_SIZE` alone, while `OUTFIT_PLATE_SIZE`, the size a real Sign asks for " +
      "every time, had none at all. That arm was carried across covering the LIVE constant " +
      "first, and driven red by sabotage before it was believed. A deleted suite's arms are " +
      "not all coverage of the deleted thing, and this is the check that found the one that " +
      "was not.",
  },
  "castingV2-segment-store-db.test.ts": {
    why:
      "Deleted with the segment store's database layer (#1160 slice 3, 2026-09-25, on his " +
      "ruling 'Retire both. The paste road is gone; nothing reads these'). All six symbols it " +
      "drove — recordEditPatchSegments, recordDetectedSegments, listLiveSegments, " +
      "listLineageSegments, listSegmentHistory, retireSegmentFacet — are gone. " +
      "⚠ BUT TWO OF ITS ARMS WERE NEVER THE STORE'S AND THIS GUARD IS WHAT CAUGHT THEM: it " +
      "reported three live modules pointing here, and two of those cite this file as the " +
      "RECEIPT for the migration-before-code rule about " +
      "`casting_candidate_variants.parentVariantId` — the lineage column the reference " +
      "library's carry rests on, written on every claim. That arm and the invariant-2 arm " +
      "beside it (a parent variant on another face is refused inside the statement) were " +
      "MOVED to `castingV2-variant-lineage-db.test.ts`, unchanged. The four mentions that " +
      "remain are all prose explaining where those arms used to live and what the deletion " +
      "cost, which is the provenance a later reader needs: a suite's NAME is not its " +
      "population, and this is the fourth time #1160 was handed that lesson after " +
      "maskFetchUrl (slice 2), resolveOwnedCandidateId and the ceremony script's live half.",
  },
  "segmentsOnFaceEndpoint.test.ts": {
    why:
      "Deleted with the segment store's route (#1160 slice 2, 2026-09-25, on his ruling " +
      "'Retire both. The paste road is gone; nothing reads these'). It drove the " +
      "`castingV2.segmentsOnFace` PROCEDURE end to end, so it was coverage of the thing " +
      "removed rather than of anything that survives. It is named in " +
      "`scripts/lib/capabilityAtlas.mts`, which records a PR #615 review finding that used " +
      "this file as its worked example — that paragraph is the provenance a later reader " +
      "needs, and it is kept in the past tense rather than deleted, because the argument it " +
      "settles (a specifier naming `castingV2` while resolving elsewhere earns no door pin) " +
      "does not depend on the file existing. The arm proving it in " +
      "`server/capabilityAtlas.test.ts` passes the path as a STRING to a pure function, so it " +
      "never read the file from disk.",
  },
  "castingV2InkUpload.test.ts": {
    why:
      "Deleted with the ink studio's upload door (#1158 slice 1, 2026-09-24, on his ruling " +
      "'It retires with N2'). It drove the PROCEDURE, so it is coverage of the thing removed " +
      "rather than of anything that survives. `inkUploadEntranceRetired.test.ts` — the absence " +
      "guard that replaced it — names it in the sentence explaining what stood there and why " +
      "the replacement is half positive control. The mention is the provenance.",
  },
  "inkUploadService.test.ts": {
    why:
      "Deleted with the studio upload's orchestration (#1158 slice 2, 2026-09-24). It drove " +
      "`uploadInkDesign` and `defaultMintPlate` end to end with fakes and referenced neither of " +
      "the two exports that survive, so it was coverage of the thing removed. " +
      "`castingV2-ink-design-db.test.ts` names it in the sentence saying where the ORDER used to " +
      "be proved, which is the provenance a later reader of that file needs; the surviving " +
      "exports are driven by `inkReferenceMint.test.ts` (as identities) and pinned by " +
      "`inkStudioServiceRetired.test.ts`.",
  },
  "inkPlateDoor.test.ts": {
    why:
      "Deleted with the plate road (#1158 slice 2). The ink studio's second half — drawing a " +
      "design onto a blank form — retired with the studio itself, and this suite drove the " +
      "door's refusals and its prompt. `castingV2-ink-plate-db.test.ts` names it to say where " +
      "the DECISIONS used to be proved. ⚠ That file is no longer the table's proof of its RULES: " +
      "#1158 slice 4e deleted `recordInkPlate` and eight of its nine arms went with the writer, " +
      "leaving one arm on the live retention purge. The mention is the provenance and that is now " +
      "the whole of what it is.",
  },
  "inkPlateMint.test.ts": {
    why:
      "Deleted with the plate road (#1158 slice 2), for `inkPlateDoor.test.ts`'s reason — it " +
      "drove the mint's ORDER, and `mintInkPlate`'s only non-test caller went with the upload. " +
      "Named in `castingV2-ink-plate-db.test.ts` alongside its sibling — and that mention was " +
      "briefly LOST when slice 4e rewrote that file's header, which this guard caught. Both " +
      "names are load-bearing there, not decoration.",
  },
  "velocityLimits.test.ts": {
    why:
      "Deleted with the credit-velocity caps (2026-08-19). `prosePointerDiscipline.test.ts` " +
      "and `loginAttackAlert.test.ts` quote it as the worked example of a suite that could " +
      "not fail when its own subject was deleted. Naming it is the whole content of those " +
      "sentences.",
  },
  "framingTrimStep.test.ts": {
    why:
      "Deleted when the founder retired the framing trim (2026-09-03, card #11). " +
      "`rollService.test.ts` names it in the sentence that explains WHY those arms moved " +
      "there — 'deleting it took its sheet arm with it'. The mention is the provenance.",
  },
  "planLadder.test.ts": {
    why:
      "`client/src/features/settings/planLadder.ts` documents this defect about ITSELF — " +
      "'for a file that has never existed'. It is the negative control this guard is " +
      "measured against, and indicting it would be the guard failing its own subject.",
  },
  "referenceAttachDoor.test.ts": {
    why:
      "`uploadRefusalCopy.ts` names it in the ⚠ paragraph recording that this very " +
      "pointer never resolved (#647) — the same self-documenting shape as planLadder. " +
      "The correction cannot be written without naming what was corrected. " +
      "It sat in `referenceAttachDoor.ts` until #209 item 1 moved the cap sentence " +
      "into the copy table the capability map imports; the paragraph travelled WITH " +
      "the sentence, because a note about a sentence's guard is orphaned by leaving it " +
      "behind — and this arm is what said so.",
  },
  "foo.test.ts": {
    why:
      "A worked example inside `preflight.test.ts`'s own comments, describing the " +
      "selector shape that was silently green — 'server/foo.test.ts while server/bar.test.ts " +
      "imports it'. Naming a file that does not exist is the whole point of an example.",
  },
  "bar.test.ts": {
    why: "The second half of the same worked example in `preflight.test.ts`'s comments.",
  },
  "thing.test.ts": {
    why:
      "The third, at `preflight.test.ts:372` — 'a shift writes server/thing.test.ts'. Same " +
      "example, same reason: it describes a file a shift is about to create.",
  },

  /* ── THE NINE THE WIDENING ADDED (#1821, 2026-10-03) ──────────────────────
     Every one was read at its own deletion commit before it was written here,
     because "deleted with X" is a claim and `git log --diff-filter=D` is the
     artifact. Not one of them is dirt: the widening found 20 dangling pointers
     across 14 basenames in `.md` and `.mts`, five of those basenames were
     already enumerated above, and all 20 are correct as written. ⚠ THE CARD
     THAT ORDERED THIS SAID FOURTEEN ENTRIES WERE OWED; NINE WERE, and the
     difference is the five already here — a population counted from a reading
     the card did not re-take against this list. */

  "castingPathCopy.test.ts": {
    why:
      "Deleted when the sheet and the ask box stopped asking which path a cast was born on " +
      "(#203 slice 2 step c, `d77568565`, PR #1152). It is named in " +
      "`docs/specs/CASTING_V2_TWO_PATHS_TOGGLE_EVIDENCE.md`'s copy-provenance table, in the " +
      "row for the Basics line, as the arm that refused either path sentence containing the " +
      "struck word 'anywhere' — the roll frame being waist-up is why that word was struck in " +
      "the first place. The mention is the provenance of a CORRECTION, which is the kind of " +
      "sentence this list exists to protect: the evidence document records what the copy used " +
      "to say and what refused it, and neither half can be written without naming the guard.",
  },
  "imaginationMeter.test.ts": {
    why:
      "Deleted with the imagination level itself (#535, `ce886cac2`, PR #598, 2026-09-06 — " +
      "Re-imagine replaced the meter with a press on the brief box, on his word 'build it'). " +
      "`docs/specs/REIMAGINE_DESIGN_2026-09-06.md` names it at the head of the list of suites " +
      "that 'retire or move with their subjects', beside the imagination arms of four suites " +
      "that survived. That list is the design's own account of what the feature's removal cost " +
      "in coverage, and a list of retired suites that may not name them is not a list.",
  },
  "inkTemplates.test.ts": {
    why:
      "Deleted with the ink studio's plate road (#1158 slice 2, `eef3c5c42`, PR #1165, on his " +
      "ruling 'It retires with N2'). `docs/specs/V3B_INK_AND_MARKS_DESIGN_NOTE.md` names it in " +
      "the clause saying it 'goes red the moment `views` moves in either direction' — the " +
      "sentence is recording which of two unbuilt alternatives the template set did NOT settle, " +
      "and the guard it cites is how the reader knows the question was held open rather than " +
      "answered by whichever blank the routing happened to name.",
  },
  "inkPlateEngines.test.ts": {
    why:
      "Deleted with the plate road in the same commit as `inkTemplates.test.ts` (#1158 slice 2). " +
      "The V3B design note names it for a lesson that outlived both the suite and the road: its " +
      "'leaves an already legal canvas alone' control was moved to a CONSTRUCTED size, because " +
      "not one of the six live blanks is a multiple of 16 on both edges while the retired arm " +
      "sheet was — 'a control tied to whichever asset happens to be legal this week is a control " +
      "that stops testing anything the week that changes'. That is the paragraph, and it needs " +
      "the name.",
  },
  "slackApproval.test.ts": {
    why:
      "Deleted with Slack entire (#800, `dad85ae5d`, PR #802, on his word 'retire slack " +
      "everything runs through moderator and admin at the moment'). `docs/archive/CODEBASE_AUDIT.md` " +
      "names it in a table of the repository's largest test files AS IT STOOD when that audit was " +
      "taken — 527 lines of Slack approval flow. ⚠ It sits under `docs/archive/`, and an archived " +
      "audit is a DATED READING: repointing it would make it describe a tree it was never taken " +
      "over, and editing it to satisfy a guard is the shape this list refuses — the guard would " +
      "be teaching people to rewrite history to stay green.",
  },
  "slackThreeChannel.test.ts": {
    why:
      "Deleted with Slack entire (#800), in the same commit as `slackApproval.test.ts`. The same " +
      "archived audit cites it as the worked EXAMPLE of its third test-naming style — the " +
      "<feature><noun> shape — so the sentence needs a real name from that tree to make its " +
      "point, and the tree it names is the one the audit was taken over. Same reason as its " +
      "sibling: an archived reading is dated, not stale.",
  },
  "feature.test.ts": {
    why:
      "NOT a suite and never was: a naming-convention PLACEHOLDER in " +
      "`docs/archive/CODEBASE_AUDIT.md`'s inconsistent-naming table, where the three styles are " +
      "written as <feature>, <feature><action> and <feature><noun> with a real file beside each. " +
      "It is the `foo`/`bar`/`thing` shape one document over, and it is enumerated rather than " +
      "un-backticked for the archive reason above. ⚠ The rule for writing ABOUT pointers is " +
      "still the one this module's header states — do not backtick an example — and it binds " +
      "every file a shift may edit; an archived audit is not one of those.",
  },
  "featureAction.test.ts": {
    why:
      "The second placeholder in the same table row of the same archived audit, for the same " +
      "reason as `feature.test.ts`. Its real example beside it is a file that still exists.",
  },
  "featureNoun.test.ts": {
    why:
      "The third placeholder in that row, and the one whose real example — " +
      "`slackThreeChannel.test.ts` — is itself enumerated above, deleted with #800. One table " +
      "row, three placeholders and one genuinely dead name, which is a fair picture of why this " +
      "population had never been measured.",
  },
};

/*
  ⚠ THE `foo`/`bar`/`thing` ENTRIES CAME OFF THIS LIST AND WENT BACK ON, AND
  THE ROUND TRIP IS THE LESSON RATHER THAN AN EMBARRASSMENT.

  The card that ordered this guard named them among its false positives. They
  were written here, then REMOVED when the first reading did not find them —
  with a comment in this spot explaining that the reader keys on a backticked
  reference and those fixtures are "bare strings".

  ⚠ **THAT EXPLANATION WAS FALSE AT THE BYTES, and PR #651's review read them.**
  `preflight.test.ts:72` and `:372` backtick all three; they were invisible only
  because they are PATH-QUALIFIED and the regex excluded `/`. So the guard built
  to stop records disagreeing with the tree was carrying a record that
  disagreed with the tree — about its own population, in a comment that read
  like a measurement.

  The regex is widened and the three are enumerated with the reason that is
  actually true. **The rule that survives both directions: an entry earns its
  place from a reading, and so does its absence — a removal justified by a
  mechanism nobody drove is the same mistake as a dead entry kept just in
  case.** The "still mentioned" arm is what now checks that continuously.
*/

/**
 * WHO MAY POINT — every tracked file type that carries prose about suites
 * (#1821). `.md` is here because this repository's law files are `.md`, and
 * `.mts` because its scripts and generators are.
 */
export const POINTER_POPULATION = ["*.ts", "*.tsx", "*.mts", "*.md"] as const;

/**
 * WHAT A POINTER MAY RESOLVE TO — deliberately NOT {@link POINTER_POPULATION}.
 * A suite file is only ever a `.ts` or a `.tsx`; reading one list for both
 * questions would let a later widening of the first quietly answer the second.
 */
export const SUITE_POPULATION = ["*.ts", "*.tsx"] as const;

/** Every backticked suite pointer in the tracked prose population. */
export function suitePointers(repoRoot: string): PointerReading[] {
  /*
    ⚠ THE LISTING HELPER IS INSIDE THIS FUNCTION ON PURPOSE, AND IT WAS MOVED
    HERE BY A GUARD RATHER THAN BY TASTE (#1821). `populationDerivers` in
    scripts/lib/preflight.mts finds a deriver by splitting a module at its
    `export function` boundaries and keeping the chunk whose OWN text runs the
    `git ls-files` call — so the first draft of this widening, which factored
    the listing out to a module-level const, silently dropped
    suitePointerDiscipline.test.ts out of preflight's ALWAYS-RUN set. The guard
    said so in its own words: *an ALWAYS_RUN_SUITES member no longer derives its
    population — it runs for nothing*. A refactor that reads as tidying and
    removes a guard from the always-run set is the path-three death class one
    floor down, and the detector's reading is a reasonable rule to stay inside
    rather than to erode from in here.
  */
  const trackedUnder = (globs: readonly string[], what: string): string[] => {
    const files = execFileSync("git", ["ls-files", ...globs], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    /* A sweep over no files answers every question with "clean" — and it names
       WHICH of the two listings came back empty, because they ask different
       questions and only one of them can be answered by a `.md`. */
    if (files.length === 0) {
      throw new Error(
        `suitePointers: git ls-files returned no ${what} under ${repoRoot}. ` +
          "An empty population is a broken reading, not a clean tree.",
      );
    }
    return files;
  };

  const tracked = trackedUnder(POINTER_POPULATION, "prose files");

  /* The resolution target is its own reading, for the reason SUITE_POPULATION
     states: widening who may point must never widen what counts as a suite. */
  const suiteFiles = trackedUnder(SUITE_POPULATION, "suite files");
  const basenames = new Set(suiteFiles.map((file) => file.split("/").pop() ?? file));
  const readings: PointerReading[] = [];

  for (const file of tracked) {
    let source: string;
    try {
      source = readFileSync(join(repoRoot, file), "utf8");
    } catch {
      continue;
    }
    if (!source.includes(".test.ts")) continue;

    source.split("\n").forEach((text, index) => {
      POINTER.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = POINTER.exec(text))) {
        /* A path-qualified pointer resolves on its LAST segment: this guard
           answers "is a file by that name tracked", and a file that has merely
           moved directory is the ambiguous question it deliberately avoids. */
        const named = match[1].split("/").pop() ?? match[1];
        readings.push({ file, names: named, line: index + 1, resolves: basenames.has(named) });
      }
    });
  }

  return readings;
}

/*
  ⚠ THERE IS NO `danglingPointers` HELPER HERE, AND THAT IS THE GATE'S DOING
  RATHER THAN AN OVERSIGHT. One was written — `suitePointers` filtered by
  `!resolves && !(names in DELIBERATELY_ABSENT)` — and `pnpm check`'s
  uncalled-export arm refused the commit: its only consumer was the suite that
  drives it, which that reader does not count. An export nothing in the product
  calls is a control that does not exist, and this repository's own
  "currently not enforced" list is that mistake four times over.

  So the two facts a caller needs are exported and the one-line join that
  combines them lives in `suitePointerDiscipline.test.ts`, which is the only
  place that ever wanted it.
*/
