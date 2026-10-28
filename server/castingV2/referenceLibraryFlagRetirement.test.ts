/**
 * THE REFERENCE LIBRARY'S FLAG IS RETIRED, AND IT STAYS RETIRED — #1577 slice D5.
 *
 * `CASTING_REFERENCE_LIBRARY_SCOPE` decided whether a face built a library at
 * all: off, the face panel answered `enabled: false` with no rows, a refine read
 * no carried crops and the mint stored none; on, every paid edit filed a crop of
 * what it delivered and every later render carried it. It reached `all` on
 * production on 2026-08-24 and stood there, so its off arm had been reached by
 * no account for two months. **His word retiring it, 2026-10-15, verbatim and
 * entire: _"yes approve the plan and switch off the six settings"_** — the last
 * of those six, and the ghost audit's own last flag retirement (row D5, which
 * ordered it *"retire last… it is the root of the chain C and D1–D2 hang
 * from"*).
 *
 * **THE LIBRARY IS LIVE AND IS NOT WHAT RETIRED.** `casting_reference_library`,
 * `recordReferenceRows`, `listLineageReferences`, `mintReferencesForRender`, the
 * retention sweep and the face panel are untouched. What went is the SWITCH.
 *
 * # Why this file exists rather than a sentence in a document
 *
 * A flag retirement is reversible by accident. The variable's name is still in
 * the tree on purpose — the retirement record names it, three fence notes
 * explain why their children read `CASTING_V2_SCOPE` instead, and several
 * disposables carry it in their own history — so a shift grepping for it will
 * find it and could reasonably re-add a reader. These arms say what may not come
 * back, and `repaintFlagRetirement.test.ts` is the shape they follow.
 *
 * # ⚠ IT DOES NOT ASSERT THE NAME IS ABSENT FROM THE TREE, AND THAT IS DELIBERATE
 *
 * The whole point of a retirement record is that the next reader learns WHAT
 * died and why, and that record has to name it. So these arms read the
 * RESURRECTION SHAPES instead — the three ways a flag gets a reader in this
 * repository — and the floor is stated rather than implied: a fourth shape would
 * be invisible here.
 *
 * Every arm is an ABSENCE, and an absence is green against a reader that finds
 * nothing at all. So each reader is first made to find a flag that genuinely
 * exists, in the same call, in the same shape. If the control reddens, no verdict
 * in this file means anything.
 *
 * # ⚠ AND THE CONTROL FLAG IS CHOSEN RATHER THAN CONVENIENT
 *
 * `repaintFlagRetirement.test.ts` used THIS flag as its positive control,
 * because it was the retired flag's own live parent — and then this flag died
 * too, which is the hazard only a retirement guard has: its controls are flags,
 * and a flag can die. A control naming a dead flag does not fail loudly; it stops
 * proving the reader works while the file keeps passing. So the control here is a
 * flag the ghost audit's own band E marks KEEP (`CASTING_FACE_SCAN_SCOPE`:
 * widening it is his, because a scan spends house money), not one on any
 * retirement list.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { declaredEnvNames, serverAndSharedSources } from "../../scripts/lib/declaredEnvNames.mts";
import { cataloguedFlags, flagCatalogue, indexedFlags, lawText } from "../../scripts/lib/lawText.mts";
import { PRODUCTION_FLAG_POSITIONS } from "../../scripts/lib/productionFlagPositions.mts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The retired flag. */
const RETIRED = "CASTING_REFERENCE_LIBRARY_SCOPE";
/** The chain root, which cannot go — every control below finds this one. */
const LIVE = "CASTING_V2_SCOPE";
/** A second live flag, off every retirement list (band E: KEEP). */
const KEPT = "CASTING_FACE_SCAN_SCOPE";

const SOURCES = serverAndSharedSources(repoRoot);
const DECLARED = declaredEnvNames(SOURCES);
const LAW = lawText(repoRoot);
const CATALOGUE = flagCatalogue(repoRoot);
const COMMENT_BLOCK = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = new RegExp("(^|[^:])" + "\\/\\/[^\\n]*", "g");

/*
  ⚠ COMMENTS ARE STRIPPED EVERYWHERE IN THIS FILE, AND ITS FIRST RUN IS WHY.

  The retirement record in `candidateStoreTolerance.ts` says, in prose, that the
  entry there used to call `castingReferenceLibraryArmed()` — so a reader over
  the RAW bytes found the flag in its own obituary and reported a live reader
  that does not exist. A guard that cannot tell code from a comment ABOUT code
  makes every retirement record unwritable, which is the whole point of this
  family of files.

  Stripping also narrows the claim honestly: a read hidden in a comment is not a
  read. The stripper gets a two-way control inside every arm that leans on it.
*/
function strip(text: string): string {
  return text.replace(COMMENT_BLOCK, " ").replace(LINE_COMMENT, "$1 ");
}

const TEXTS = SOURCES.map((file) => ({ file, text: strip(readFileSync(file, "utf8")) }));

describe("the reference library's flag is retired (#1577 slice D5)", () => {
  it("⚠ CONTROL — every reader in this file finds flags that ARE there", () => {
    expect(SOURCES.length, "the file walk found a real tree").toBeGreaterThan(100);
    expect(DECLARED, "the constant scan read a real population").toContain(LIVE);
    expect(DECLARED, "and a second live flag, which band E marks KEEP").toContain(KEPT);
    expect(LAW).toContain(LIVE);
    expect(Object.keys(PRODUCTION_FLAG_POSITIONS)).toContain(LIVE);
    expect(Object.keys(PRODUCTION_FLAG_POSITIONS)).toContain(KEPT);
  });

  it("no code DECLARES it — the constant, its parse, its capture, its armed read and its fence are gone", () => {
    expect(DECLARED).not.toContain(RETIRED);
  });

  it("⚠ and no code READS it by any of the three shapes that give a flag a reader", () => {
    /*
      The constant pattern above is one way. These are the other two this
      repository actually uses, read on the raw bytes rather than through a
      resolver: a direct `process.env` lookup under either subscript form, and a
      symbol named for the flag. `captureCastingReferenceLibraryEnabled` was the
      point-of-use AND, `castingReferenceLibraryArmed` the sweep's armed read,
      and `validateCastingReferenceLibraryEnvironment` the boot fence.
    */
    const shapes = [
      `process.env.${RETIRED}`,
      `process.env["${RETIRED}"]`,
      "captureCastingReferenceLibraryEnabled(",
      "castingReferenceLibraryArmed(",
      "validateCastingReferenceLibraryEnvironment(",
      "parseCastingReferenceLibraryScope(",
    ];
    const found = TEXTS.flatMap((source) => shapes
      .filter((shape) => source.text.includes(shape))
      .map((shape) => `${source.file}: ${shape}`));
    expect(found, "these are reads of a flag that does not exist").toEqual([]);
    /*
      CONTROL FOR THE STRIPPER, both directions, on the one file that carries
      both a surviving call and an obituary naming a dead one. Without it, a
      stripper that ate a whole file would make every absence above green.
    */
    const tolerance = TEXTS.find((source) => source.file.endsWith("candidateStoreTolerance.ts"));
    expect(tolerance, "the tolerance module was walked at all").toBeTruthy();
    expect(tolerance!.text, "the stripper kept a call that survived")
      .toContain("castingReferenceAttachArmed");
    expect(tolerance!.text, "and it dropped the obituary naming the one that did not")
      .not.toContain("castingReferenceLibraryArmed");
    /*
      CONTROL for this same reader, in the same call: a LIVE flag IS read both
      ways, so a scan that found nothing would be caught here rather than
      passing as coverage.
    */
    expect(
      TEXTS.some((source) => source.text.includes("captureCastingFaceScanEnabled(")),
      "the predicate shape finds a live flag's own reader",
    ).toBe(true);
    expect(
      TEXTS.some((source) => source.text.includes(`process.env[${KEPT}_ENV]`)
        || source.text.includes(`process.env.${KEPT}`)),
      "and the env-lookup shape finds a real lookup",
    ).toBe(true);
  });

  it("⚠ the production position table does not name it — the row and the variable moved together", () => {
    /*
      Both directions bite. A row standing while the service still holds the
      variable reports a healthy position for a feature that does not exist; and
      `comparePositions` reports a governed variable with NO row, so the row
      cannot simply be dropped early either. The variable is deleted from the
      service in the same act as the MERGE of this row — and between the merge
      and the deletion the rite reports exactly one mismatch naming it, by
      design, which the retirement record says in capitals.
    */
    expect(Object.keys(PRODUCTION_FLAG_POSITIONS)).not.toContain(RETIRED);
  });

  it("⚠ the law surfaces describe it as RETIRED rather than live, in both places", () => {
    /*
      The index and the catalogue are read SEPARATELY, because a name surviving
      as live in one of them is exactly the drift `claudeMdFlagEnumeration`'s
      agreement arm exists to catch. Both still carry a row — the segment store's
      precedent (#1160), not an oversight: a reader who meets the name in the
      code's own retirement notes must be able to look it up and be told it is
      gone. What is asserted is that neither row reads as a live capability.
    */
    expect(indexedFlags(LAW), "CLAUDE.md's index table still has its row").toContain(RETIRED);
    expect(cataloguedFlags(CATALOGUE), "and so does the catalogue").toContain(RETIRED);

    const indexRow = LAW.split("\n").find((line) => line.startsWith(`| \`${RETIRED}\``));
    expect(indexRow, "the index row was found at all").toBeTruthy();
    expect(indexRow, "and it says the flag is retired").toMatch(/RETIRED/);

    const entry = CATALOGUE.split("\n").find((line) => line.startsWith(`- \`${RETIRED}\``));
    expect(entry, "the catalogue entry was found at all").toBeTruthy();
    expect(entry, "and it opens with the retirement, not with what the flag used to do")
      .toMatch(/^- `CASTING_REFERENCE_LIBRARY_SCOPE` — ✅ \*\*RETIRED/);
    expect(entry, "naming his word").toContain("switch off the six settings");
  });

  it("⚠ the three children name the chain root as their parent, not the dead flag", () => {
    /*
      THE RE-PARENT IS THE HALF OF THIS SLICE A READER IS MOST LIKELY TO UNDO,
      because the three fences sit hundreds of lines apart and each one's note
      explains only its own move. Read at the validator INPUTS rather than at
      prose: the key is `castingScope` on all three now, and
      `referenceLibraryScope` and `libraryScope` are keys no input has.

      The unit arms in `castingV2Scope.test.ts`, `inkStudioScope.test.ts` and
      `referenceAttachScope.test.ts` drive each fence's behaviour; this arm is
      the one that would notice a FOURTH child added with the dead parent, which
      no behaviour arm would see.
    */
    const code = strip(readFileSync(
      path.join(repoRoot, "server/castingV2/castingV2Scope.ts"),
      "utf8",
    ));
    /* CONTROL for the stripper, both ways: it keeps code and drops comments. */
    expect(code, "the stripper kept a declaration that survived").toContain("castingScope:");
    expect(code, "and it dropped the obituary that names the flag that did not")
      .not.toContain("It was `CASTING_REFERENCE_LIBRARY_SCOPE`");

    expect(code, "no validator input still takes the retired flag's scope")
      .not.toContain("referenceLibraryScope");
    expect(code, "and none takes the face scan's old spelling for it either")
      .not.toContain("libraryScope");
  });

  it("⚠ the cleanup-worker condition survives on every child that keeps bytes", () => {
    /*
      THE ONE PROPERTY THIS RETIREMENT LOST is the cleanup-worker fence over the
      LIBRARY'S OWN writes, and it is the only part of the slice that could have
      quietly weakened a retention promise. What makes that loss narrow is that
      each surviving child asks for the sweep in its own body rather than
      inheriting the question — so this arm holds exactly that, at the code.

      ⚠ It reads the SOURCE rather than driving the validators because the point
      is structural: a child that stopped asking and started relying on a parent
      would still pass every behaviour arm on a service where the worker is on.
    */
    const scope = readFileSync(
      path.join(repoRoot, "server/castingV2/castingV2Scope.ts"),
      "utf8",
    );
    for (const fence of [
      "validateCastingInkStudioEnvironment",
      "validateCastingReferenceAttachEnvironment",
      "validateCastingScanTableEnvironment",
    ]) {
      const at = scope.indexOf(`export function ${fence}(input: {`);
      expect(at, `${fence} was found at all`).toBeGreaterThan(-1);
      const body = scope.slice(at, at + 2_000);
      expect(body, `${fence} asks for the cleanup worker itself`)
        .toContain("cleanupWorker");
      /*
        ⚠ THE REFUSAL IS READ STRUCTURALLY RATHER THAN BY THE VARIABLE'S NAME,
        and the first run of this arm is why: the scan table refuses through a
        NAMED ERROR CLASS (`CastingScanTableCleanupWorkerError`), so the literal
        `ENABLE_STORAGE_CLEANUP_WORKER` lives at the class and not in the fence.
        Asserting that name would have failed a fence doing exactly the right
        thing — and a looser reader would have passed one that merely READ the
        value and carried on.
      */
      expect(body, `${fence} refuses on it rather than merely reading it`)
        .toMatch(/input\.cleanupWorker !== "true"/);
      expect(body, `${fence}'s refusal is a throw`).toMatch(/throw new Casting\w+/);
    }
  });
});
