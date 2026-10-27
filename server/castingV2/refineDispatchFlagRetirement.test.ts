/**
 * THE DISPATCH SWAP'S FLAG IS RETIRED, AND IT STAYS RETIRED — #1577 slice D4.
 *
 * `CASTING_REFINE_DISPATCH_SCOPE` decided whether the paid half of a refine
 * stopped holding the request. Off, `castingV2.refine` awaited the whole render
 * before answering — median 121 s, p95 276 s, and 1.7% of refines answering
 * past the observed ~305 s gateway wall, where the socket carrying the answer
 * is gone before the answer exists, the money safe and the REASON lost. On, the
 * same ask claims, charges and dispatches and then returns a receipt, and the
 * outcome arrives on the surface like every other durable fact. It reached
 * `all` on production on 2026-08-25, so nothing was on the arm that was
 * removed. **His word retiring it, 2026-10-15, verbatim and entire: _"yes
 * approve the plan and switch off the six settings"_** (the ghost audit's row
 * D4).
 *
 * # ⚠ THIS FLAG'S OFF ARM WAS THE DEFECT, NOT AN OLD FEATURE
 *
 * Every other flag in that batch of six chose between a retired road and a
 * current one, so retiring it deleted dead code. This one was raised to FIX the
 * figures above, which means what the retirement buys is that the fix can no
 * longer be switched off by a variable. There is no dead road to assert the
 * absence of — the whole cut is the GATE — so the last arm here reads the one
 * thing that could resurrect it: a second question in front of the receipt.
 *
 * # ⚠ AND THE HELD ROAD SURVIVED THE FLAG, WHICH IS WHY A WHOLE ARM GUARDS IT
 *
 * Our own measuring scripts need the awaited road: handed a receipt a script
 * reaches the end of its work and exits, abandoning a render it paid for (the
 * #801 incident — three copies of the unedited master written as results). That
 * road is now reached by a CALLER saying `cannotTakeAReceipt` (#2560), a
 * property of the caller that nothing on the wire can set, and
 * `server/refineReceiptDiscipline.test.ts` holds every tracked script to it.
 * **So "retired" here must not be read as "the held road is gone".**
 *
 * # ⚠ IT DOES NOT ASSERT THE NAME IS ABSENT FROM THE TREE, AND THAT IS DELIBERATE
 *
 * The whole point of a retirement record is that the next reader learns WHAT
 * died and why, and that record has to name it. So these arms read the
 * RESURRECTION SHAPES — the three ways a flag gets a reader in this repository
 * — and the floor is stated rather than implied: a fourth shape would be
 * invisible here. The repaint flag's own guard
 * (`repaintFlagRetirement.test.ts`, slice 4b) is the shape this follows.
 *
 * Every arm is an ABSENCE, and an absence is green against a reader that finds
 * nothing at all. So each reader is first made to find a flag that genuinely
 * exists, in the same call, in the same shape. If the control reddens, no
 * verdict in this file means anything.
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
const RETIRED = "CASTING_REFINE_DISPATCH_SCOPE";
/**
 * A flag that exists and cannot go — every control below finds this one.
 *
 * ⚠ It is ALSO the retired flag's own parent, which is why there is no separate
 * `PARENT` constant here as there is in the repaint flag's guard. That is a
 * fact about this flag rather than a shortcut: it was the one sub-flag on the
 * refine road parented on the casting scope itself, because it changed WHEN the
 * answer arrived and never what was painted, so a paste-road customer was a
 * legitimate subject. `SIBLING` below is therefore the second live specimen, so
 * that no control in this file rests on one name.
 */
const LIVE = "CASTING_V2_SCOPE";
/** A second live flag, so a control cannot pass on the parent alone. */
const SIBLING = "CASTING_RETRY_SCOPE";

const SOURCES = serverAndSharedSources(repoRoot);
const DECLARED = declaredEnvNames(SOURCES);
const LAW = lawText(repoRoot);
const CATALOGUE = flagCatalogue(repoRoot);
const TEXTS = SOURCES.map((file) => ({ file, text: readFileSync(file, "utf8") }));

describe("the dispatch swap's flag is retired (#1577 slice D4)", () => {
  it("⚠ CONTROL — every reader in this file finds a flag that IS there", () => {
    expect(SOURCES.length, "the file walk found a real tree").toBeGreaterThan(100);
    expect(DECLARED, "the constant scan read a real population").toContain(LIVE);
    expect(DECLARED, "and a second one, so no control rests on the parent alone").toContain(SIBLING);
    expect(LAW).toContain(LIVE);
    expect(Object.keys(PRODUCTION_FLAG_POSITIONS)).toContain(LIVE);
    expect(Object.keys(PRODUCTION_FLAG_POSITIONS)).toContain(SIBLING);
  });

  it("no code DECLARES it — the constant, its parse, its capture and its fence are gone", () => {
    expect(DECLARED).not.toContain(RETIRED);
  });

  it("⚠ and no code READS it by any of the three shapes that give a flag a reader", () => {
    /*
      The constant pattern above is one way. These are the other two this
      repository actually uses, read on the raw bytes rather than through a
      resolver: a direct `process.env` lookup under either subscript form, and a
      predicate named for the flag. `captureCastingRefineDispatchEnabled` was
      the point-of-use AND; `validateCastingRefineDispatchEnvironment` was the
      boot fence; the two error classes were how both of them refused.
    */
    const shapes = [
      "process.env." + RETIRED,
      'process.env["' + RETIRED + '"]',
      "process.env['" + RETIRED + "']",
      "captureCastingRefineDispatchEnabled(",
      "validateCastingRefineDispatchEnvironment(",
      "parseCastingRefineDispatchScope(",
      "CastingRefineDispatchScopeConfigurationError",
      "CastingRefineDispatchCoverageError",
    ];
    const found = TEXTS.flatMap((source) => shapes
      .filter((shape) => source.text.includes(shape))
      .map((shape) => `${source.file}: ${shape}`));
    expect(found, "these are reads of a flag that does not exist").toEqual([]);
    /*
      CONTROL for this same reader, in the same call: the live sibling IS read
      both ways, so a scan that found nothing would be caught here rather than
      passing as coverage.
    */
    expect(
      TEXTS.some((source) => source.text.includes("captureCastingRetryEnabled(")),
      "the predicate shape finds a live flag's own reader",
    ).toBe(true);
    expect(
      TEXTS.some((source) => source.text.includes("process.env[" + SIBLING + "_ENV]")
        || source.text.includes("process.env." + SIBLING)),
      "and the env-lookup shape finds a real lookup",
    ).toBe(true);
  });

  it("⚠ the production position table does not name it — the row and the variable moved together", () => {
    /*
      Both directions bite. A row standing while the service still holds the
      variable reports a healthy position for a feature that does not exist; and
      `comparePositions` reports a governed variable with NO row, so the row
      cannot simply be dropped early either. The variable is deleted from the
      service AFTER this code is deployed — code first, variable second, because
      an absent variable parses as `off` and the old build would then put every
      customer back on the held road. Between the merge and the deletion the
      rite reports exactly that one mismatch, by design.
    */
    expect(Object.keys(PRODUCTION_FLAG_POSITIONS)).not.toContain(RETIRED);
  });

  it("⚠ the law surfaces describe it as RETIRED rather than live, in both places", () => {
    /*
      The index and the catalogue are read SEPARATELY, because a name surviving
      in one of them is exactly the drift `claudeMdFlagEnumeration`'s agreement
      arm exists to catch — and slice D2's copy of this arm went green on the
      catalogue alone after its index row was deleted. Both still carry a row: a
      reader who meets the name in the code's own retirement notes must be able
      to look it up and be told it is gone.
    */
    expect(indexedFlags(LAW), "CLAUDE.md's index table still has its row").toContain(RETIRED);
    expect(cataloguedFlags(CATALOGUE), "and so does the catalogue").toContain(RETIRED);

    const indexRow = LAW.split("\n").find((line) => line.startsWith("| `" + RETIRED + "`"));
    expect(indexRow, "the index row was found at all").toBeTruthy();
    expect(indexRow, "and it says the flag is retired").toMatch(/RETIRED/);

    const entry = CATALOGUE.split("\n").find((line) => line.startsWith("- `" + RETIRED + "`"));
    expect(entry, "the catalogue entry was found at all").toBeTruthy();
    expect(entry, "and it opens with the retirement, not with what the flag used to do")
      .toMatch(/^- `CASTING_REFINE_DISPATCH_SCOPE` — ✅ \*\*RETIRED/);
    expect(entry, "naming his word").toContain("switch off the six settings");
  });

  it("⚠ the receipt has ONE question in front of it, and it is about the caller", () => {
    /*
      THE ARM THAT REPLACES "the dead road is gone", because here there is no
      dead road — the cut WAS the gate. What can resurrect this flag is not a
      fork left behind; it is a SECOND condition in front of the receipt. So
      this reads the one line that decides, at the service's own bytes.

      ⚠ COMMENTS ARE STRIPPED FIRST, and it is not optional: the retirement
      notes in that file NAME the flag and quote what it used to do, so a reader
      over the raw text finds the gate in its own obituary. A guard that cannot
      tell code from a comment about code would make every retirement record
      unwritable — the repaint flag's guard paid for that lesson on its first
      run.
    */
    const service = readFileSync(
      path.join(repoRoot, "server/castingV2/refineService.ts"),
      "utf8",
    );
    const code = service
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(new RegExp("(^|[^:])" + "\\/\\/[^\\n]*", "g"), "$1 ");
    /* CONTROL for the stripper, both ways: it keeps code and drops comments. */
    expect(code, "the stripper kept the condition that survived")
      .toContain("dependencies.cannotTakeAReceipt !== true");
    expect(code, "and it dropped the obituary that names the flag")
      .not.toContain("IS THE ONLY CUSTOMER ROAD NOW");

    /*
      The gate, read as the whole statement rather than as a token: a second
      condition ANDed onto it moves the brace and fails this, which is the
      resurrection shape this arm exists for.
    */
    expect(
      code,
      "the dispatch decision asks about the caller and nothing else",
    ).toContain("if (dependencies.cannotTakeAReceipt !== true) {");
    expect(code, "and no flag predicate stands beside it")
      .not.toContain("captureCastingRefineDispatchEnabled");
  });
});
