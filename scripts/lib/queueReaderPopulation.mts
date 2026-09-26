/**
 * WHICH SCRIPTS OFFER A SHIFT A CARD — the DERIVED population, so a sixth queue
 * reader cannot re-open #1094's class (piece 3).
 *
 * # ⚠ WHY THIS EXISTS, IN ONE SENTENCE FROM THE CARD ITSELF
 *
 * #1094's own sweep is honest about its floor: *"A floor, not a proof — the
 * reader is a grep for `\"pr\"` over five named files, not a derived population."*
 * Five files were named by hand, four of them turned out to have the defect, and
 * **nothing anywhere would have noticed a sixth.** The re-scope's piece 3 is
 * exactly that: *"an arm reads every script under `scripts/` that lists open
 * issues and holds each to consulting that one reader."* Working law 4 pointed at
 * a POPULATION rather than at a value.
 *
 * # HOW THE POPULATION IS READ, AND WHY IT IS THE ARRAY FORM
 *
 * A script that lists issues does it through `gh`, with the arguments as an
 * array of strings — `["issue", "list", …]` — because every `gh` call in this
 * repository goes through `execFileSync` with no shell (the DEP0190 note is in
 * four separate docblocks). So the token pair `"issue", "list"` IS the reading,
 * and it cannot be faked by prose: a docblock that mentions `gh issue list` has
 * no quotes around the words and does not match. That is the whole matcher, and
 * it is deliberately narrower than a comment-stripper — a matcher that needed to
 * parse TypeScript to find a `gh` call would be its own source of silence.
 *
 * ⚠ **THE MATCH IS DELIBERATELY WIDER THAN `--state open`.** A reader that listed
 * `--state all` and offered a card from the answer would sail past a narrower
 * test, so state is not read at all: EVERY issue listing joins the population and
 * each one is then either a consulter or an EXEMPTION WITH A WRITTEN REASON.
 *
 * # ⚠ THE EXEMPTIONS ARE ENUMERATED AND REASONED, WHICH IS THE POINT OF THEM
 *
 * Not every script that lists issues offers a shift work — some file labels, some
 * measure ages. A mechanical reader cannot tell "offers work" from "reads the
 * queue for another purpose", and inventing a rule for it would be a taxonomy
 * nobody wrote down (the price-reader lesson in CLAUDE.md's Atlas section: the
 * question is DISSOLVED rather than answered). So the population is mechanical and
 * the remainder is enumerated, the way `KNOWN_DEBTS` and the cleanup dispositions
 * table are: **a new script that lists issues reddens the arm, and its author
 * either consults the reader or writes down here why it does not offer a card.**
 * Neither is something a shift can do by accident.
 */

/** The one reader every queue reader consults — `scripts/lib/cardBuildState.mts`. */
export const BUILD_BOARD_MODULE = "cardBuildState.mts";

/**
 * Does this source LIST ISSUES through `gh`? Whitespace-normalised first, because
 * `shift-digest.mts` writes one argument per line.
 */
export function listsIssues(source: string): boolean {
  return /"issue"\s*,\s*"list"/.test(source.replace(/\r\n/g, "\n"));
}

/**
 * Does it consult the one reader? An import of the module, by any of the relative
 * spellings a script or a lib uses to reach it.
 *
 * ⚠ **AN IMPORT IS NOT A CALL SITE** — CLAUDE.md's own correction, and it applies
 * here. This test is a FLOOR: it catches the reader that consults nothing at all,
 * which is what all five of #1094's readers did. It cannot prove the board's
 * answer is acted on, and the five behaviour arms elsewhere are what prove that
 * (`nextUpEscalation`, `shiftDigest`, `standingExceptions`, `crewQueueCount*`,
 * and the sweep's own). Said out loud rather than left to be assumed of it.
 */
export function consultsBuildBoard(source: string): boolean {
  const text = source.replace(/\r\n/g, "\n");
  return new RegExp(`from\\s+"[^"]*${BUILD_BOARD_MODULE.replace(".", "\\.")}"`).test(text)
    /* A lib whose caller hands it the board rather than reading one — the type is
       the consultation, and it comes from the same module. */
    || /CardBuildBoard/.test(text);
}

/**
 * THE REMAINDER, EACH WITH THE REASON IT OFFERS NOBODY A CARD.
 *
 * Paths are repo-relative with forward slashes. A row whose file no longer lists
 * issues is STALE and reddens too — an exemption that has stopped being needed is
 * a sentence that will be believed about the wrong thing later.
 */
export const QUEUE_READER_EXEMPTIONS: ReadonlyArray<{ path: string; because: string }> = [
  {
    path: "scripts/disposable-age.mts",
    because:
      "it lists `--state all` to age DISPOSABLE SCRIPTS against the cards that named them."
      + " Its output is a sweep of files in `scripts/`, never a card a shift could take.",
  },
  {
    path: "scripts/jev-card-category-check.mts",
    because:
      "it reads the open queue to measure Jev's category READER against the labels cards"
      + " already carry (#1064). It reports a calibration, offers nothing, and writes nothing.",
  },
  {
    path: "scripts/jev-card-category-file.mts",
    because:
      "it reads the open queue to FILE a work label onto an unlabelled card. It offers no"
      + " card to anybody — the label is what a later reader offers from, and every one of"
      + " those readers is in the population and consults the board.",
  },
];

/** One file's verdict. `ok` is "consults the reader, or is exempt for a stated reason". */
export type QueueReaderVerdict =
  | { path: string; ok: true; why: "consults" | "exempt" }
  | { path: string; ok: false; why: "lists issues and consults nothing" };

/**
 * THE JUDGEMENT, over `{ path → source }`. Pure, so the arm drives it on planted
 * sources as well as on the real tree — a walk of a real directory cannot produce
 * the negative case, and a guard that cannot be made to fail is not a guard.
 */
export function judgeQueueReaders(
  sources: ReadonlyMap<string, string>,
  exemptions: ReadonlyArray<{ path: string; because: string }> = QUEUE_READER_EXEMPTIONS,
): { population: string[]; verdicts: QueueReaderVerdict[]; staleExemptions: string[] } {
  const exempt = new Set(exemptions.map((row) => row.path));
  const population: string[] = [];
  const verdicts: QueueReaderVerdict[] = [];
  for (const [path, source] of sources) {
    if (!listsIssues(source)) continue;
    population.push(path);
    if (consultsBuildBoard(source)) {
      verdicts.push({ path, ok: true, why: "consults" });
    } else if (exempt.has(path)) {
      verdicts.push({ path, ok: true, why: "exempt" });
    } else {
      verdicts.push({ path, ok: false, why: "lists issues and consults nothing" });
    }
  }
  const listed = new Set(population);
  return {
    population: population.sort(),
    verdicts: verdicts.sort((a, b) => a.path.localeCompare(b.path)),
    /* An exemption for a file that no longer lists issues, or is gone. */
    staleExemptions: exemptions.map((row) => row.path).filter((path) => !listed.has(path)).sort(),
  };
}
