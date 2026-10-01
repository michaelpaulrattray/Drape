/**
 * A PRICE NARRATED IN A COMMENT MAY NOT BE A FIGURE THE PRODUCT NO LONGER
 * CHARGES — #1702, the Retro's card, 2026-10-02.
 *
 * # Why this is a guard and not a sweep
 *
 * `#1601` item 1 moved five prices in one commit (Roll 160 → 1,200, Follow →
 * 1,600, Sign 450 → 8,500, Refine 25 → 1,750, a view 50 → 1,000, the promotion
 * 200 → 3,500) and the comments narrating them did not move with it. **A comment
 * cannot be run, so nothing went red** — which is the same sentence
 * `castingV2Scope.ts`'s own commit message wrote when that docblock had carried
 * three wrong numbers for six months.
 *
 * ⚠ **AND THE PIN THAT WAS WRITTEN TO STOP IT HAPPENING AGAIN DID FIRE AND DID
 * NOT PREVENT IT.** `castingV2Scope.test.ts`'s arm (*"the fail-closed docblock's
 * numbers are the product's"*) reads both constants beside a COPY of the
 * sentence, in the test file, three modules from the authoritative docblock. It
 * reddened on #1601's branch, sent a shift to the copy, and the source docblock
 * stayed wrong. **The fix tracked readership, not authority** — so this suite
 * reads the real modules a reader actually meets.
 *
 * # The rule, stated exactly, because its limit is the interesting half
 *
 * *A comment in a module that names a price constant may not state, as a figure
 * beside the word "credits", a number that is not a current price of ANYTHING in
 * the product.*
 *
 * ⚠ **IT IS DELIBERATELY NOT "the price THIS module charges", and that variant
 * was driven and rejected rather than imagined.** Scoring each file against only
 * the constants it names produces **25 findings against this rule's 16**, and
 * the nine extra are all the same false positive: a docblock legitimately
 * quoting a price declared somewhere else. `carriedGeometry.ts` compares its
 * house cost against what a refine charges; `db/castingV2.ts` says how many
 * credits are committed while a roll compiles. Neither declares a price, both
 * are right to name one, and a guard that reddens on a correct cross-reference
 * is a guard a shift learns to delete.
 *
 * **So what this cannot see, said plainly: a figure that is still a current
 * price of something ELSE.** A docblock saying a refine charges 350 would pass,
 * because 350 is the ink-add price. Two live instances were measured and both
 * are in fact correct history — `castProjection.ts:120` and
 * `viewRetryService.ts:12` quote his own #1208 words (*"a refund of 50credits"*)
 * and pass because 50 is still the wardrobe garment-analyze price. They pass for
 * the wrong reason, and that is the honest floor of this reading.
 *
 * # What it found, which is the argument for it
 *
 * Over its own population at the commit that wrote it: **16 figures, and reading
 * every one of them split 8 / 8.** The eight stale ones are fixed in this same
 * commit; the eight that are history are declared below with the reading that
 * classified them.
 *
 * ⚠ **THE CARD'S OWN RECOMMENDED SHAPE WOULD HAVE CAUGHT TWO OF ITS OWN EIGHT
 * SPECIMENS, NOT EIGHT.** #1702 recommends scoping this to modules that DECLARE
 * a price constant and says *"eight of the eight lines fixed in `f11573a8e`
 * would have been caught by that"*. Read at that commit: its eight figures sit
 * in four source files — `castingV2Scope.ts`, `castViewPackage.ts`,
 * `outfitPlate.ts`, `packageOrchestrator.ts` — and only `castViewPackage.ts`
 * declares a price, carrying two of the eight. The population here is every
 * module that NAMES a price constant, which covers three of those four and
 * seven of the eight figures. `outfitPlate.ts` names no constant and is the one
 * this reading would still have missed; it is in the stated remainder rather
 * than in a claim.
 *
 * # Where the population comes from
 *
 * The Atlas's own price list (`creditCosts` — every number the generator finds
 * declared under its scanned roots, keyed by its declaring constant and module),
 * exactly as `creditPriceScale.test.ts` reads it. Nothing is transcribed: a new
 * price constant enrols its value the moment it is declared, and a module that
 * starts naming one joins the population with no edit here.
 *
 * ⚠ **A MODULE IS ENROLLED ON ITS RAW SOURCE, COMMENTS INCLUDED, AND THAT IS
 * THE POINT RATHER THAN A SHORTCUT.** `castingV2Scope.ts` imports no price
 * constant and is where a reader asks why the scope refuses to boot — the exact
 * docblock this card is named after. A module that only TALKS about a price is a
 * module somebody reads to learn one.
 *
 * # What counts as a comment is the house stripper's answer, not a new one
 *
 * `withoutComments` keeps string literals and drops comments, preserving line
 * positions. So a figure is PROSE when it matches in the raw line and does not
 * survive in the stripped one. Two consequences, both wanted: a price inside a
 * customer-facing copy string is NOT read as prose (it survives stripping, and
 * it is a different subject with its own guards), and a `/*` inside a quoted
 * string cannot open a comment this reader then misreads — the defect #1636
 * measured at 3,778 characters of unseen code in a privately-written stripper.
 *
 * # Scope, and the one thing deliberately outside it
 *
 * Non-test source only. A test file's price prose is already a solved problem
 * with a precedent: `signService.test.ts` declares its own (*"The `450`s and
 * `50`s left in this file are PROSE, narrating what a decision cost on the day
 * it was made; rewriting those would falsify a record"*). Widening to tests
 * would enrol every such declaration as a finding needing a second declaration
 * here, which is the mirror this repository has been bitten by. If a test's
 * prose ever matters, it opts in by that sentence, not by this file growing.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";
import { readListedSource } from "./testing/listedSource";
import { withoutComments } from "./testing/withoutComments";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const repoRoot = process.cwd();
const ROOTS = ["server", "shared", path.join("client", "src")];

type PriceRow = { constant: string; credits: number | null; file: string };

const ATLAS = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "docs/architecture/drape-architecture.json"), "utf8"),
) as { creditCosts: PriceRow[] };

/**
 * Every figure the product currently prices something at, and every constant
 * name that declares one — both read off the Atlas, neither typed here.
 */
function priceVocabulary(): { values: ReadonlySet<number>; constants: readonly string[] } {
  const values = new Set<number>();
  const constants = new Set<string>();
  for (const row of ATLAS.creditCosts) {
    constants.add(row.constant);
    if (typeof row.credits === "number") values.add(row.credits);
  }
  return { values, constants: [...constants].sort() };
}

/**
 * A figure stated as a price: `1,750 credits`, `25 credit`, `450-credit`.
 *
 * Separators are tolerated because the product writes both (`1,750` in prose and
 * `1_750` in code), and the word is required because a bare number in a comment
 * is almost never a price — requiring it is what keeps this reader's output small
 * enough that every line of it gets read.
 */
const PRICE_IN_PROSE = /\b([0-9][0-9,_]*)\s*(?:credits?\b|-credits?\b)/gi;

export type ProseFigure = { line: number; credits: number; text: string };

/**
 * THE READER, EXPORTED SO ITS CONTROLS GO THROUGH IT RATHER THAN PAST IT
 * (working law 3: a backstop needs a test its subject cannot rescue).
 *
 * A control that re-implemented this matching would stay green if the real
 * reader were reverted to something blind, which is the revert it exists to
 * refuse.
 */
export function priceFiguresInProse(source: string): ProseFigure[] {
  const rawLines = source.split("\n");
  const codeLines = withoutComments(source).split("\n");
  const found: ProseFigure[] = [];
  for (let index = 0; index < rawLines.length; index += 1) {
    const raw = rawLines[index]!;
    const code = codeLines[index] ?? "";
    for (const hit of raw.matchAll(PRICE_IN_PROSE)) {
      /* Survives stripping ⇒ it is code or a string literal, not prose. */
      if (code.includes(hit[0])) continue;
      const credits = Number(hit[1]!.replace(/[,_]/g, ""));
      if (!Number.isFinite(credits)) continue;
      found.push({ line: index + 1, credits, text: raw.trim() });
    }
  }
  return found;
}

type Module = { relative: string; source: string };

/**
 * Every non-test TypeScript module under the three roots that names a price
 * constant.
 *
 * `statSync` takes `throwIfNoEntry: false` and the read goes through
 * `readListedSource` because this working tree is shared between seats: a listed
 * entry can be gone before it is opened, and skipping it is the correct answer
 * rather than a tolerated failure (`server/testing/listedSource.ts`).
 */
function pricedModules(constants: readonly string[]): Module[] {
  const names = new RegExp(`\\b(?:${constants.join("|")})\\b`);
  const found: Module[] = [];
  const walk = (dir: string): void => {
    const entries = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    for (const entry of entries) {
      const full = path.join(dir, entry);
      const stat = fs.statSync(full, { throwIfNoEntry: false });
      if (!stat) continue;
      if (stat.isDirectory()) {
        if (entry === "node_modules") continue;
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry)) continue;
      if (/\.test\.tsx?$/.test(entry)) continue;
      const source = readListedSource(full);
      if (source === null) continue;
      if (!names.test(source)) continue;
      found.push({ relative: path.relative(repoRoot, full).replace(/\\/g, "/"), source });
    }
  };
  for (const root of ROOTS) walk(path.join(repoRoot, root));
  return found;
}

/**
 * PROSE FIGURES THAT ARE NOT A CLAIM ABOUT TODAY'S PRICE — each read at its own
 * line before it was written here, with what it actually is.
 *
 * ⚠ **THIS LIST EXISTS BECAUSE THE DISTINCTION IS NOT MECHANICAL AND SAYING SO
 * IS BETTER THAN INVENTING A TAXONOMY.** #1702's own sentence: *"A comment that
 * states a moved price as CURRENT behaviour is stale; one that records what an
 * incident cost is history. Nothing distinguishes them."* So the rule fires on
 * both and a reader judges in public — the same shape `creditPriceScale.test.ts`
 * uses for numbers in a price module that are not prices, and the same shape
 * `suitePointerDiscipline` uses for a named file that is deliberately absent.
 *
 * It fails toward NOISE: a new history line reddens this suite and has to be
 * read. That is the direction the card asked for, and it is the only direction
 * that keeps the list honest — a guard that guessed "history" from tense would
 * silently absolve the next stale line that happens to be written in the past.
 *
 * ⚠ **A DECLARATION IS NOT A LICENCE TO STOP LOOKING: the arm below proves each
 * `quote` still matches exactly one line in its file.** Reword the sentence or
 * delete it and this suite reddens, so the list cannot outlive its subject — the
 * rot that makes an exemption list the second copy working law 4 warns about.
 */
const PROSE_NOT_A_CURRENT_PRICE: ReadonlyArray<{
  file: string;
  credits: number;
  quote: string;
  why: string;
}> = [
  {
    file: "server/casting/aiService.ts",
    credits: 1,
    quote: "1 credit",
    why:
      "A UNIT RATE, not a price — `1 credit ≈ $0.01`, the line that converts the "
      + "house cost of a model call into the product's own units. It is what every "
      + "price is quoted IN, so it cannot be one.",
  },
  {
    file: "server/casting/atomicCredits.ts",
    credits: 25,
    quote: "total: 25 credits deducted",
    why:
      "A WORKED EXAMPLE of the lost-update race this module exists to prevent — "
      + "five concurrent requests against a balance of ten, with round numbers "
      + "chosen so the arithmetic reads at a glance. Nothing is priced at 5 or 25; "
      + "changing them to real prices would make the example harder to follow and "
      + "no truer.",
  },
  {
    file: "server/casting/castingCreditCosts.ts",
    credits: 370,
    quote: "350 -> 370 credits",
    why:
      "HIS FINANCE GUY'S NOTE, VERBATIM, and in DISPLAY credits — recorded on "
      + "#1601 at 08:59Z and quoted beside the ledger constant it set "
      + "(`CASTING_V2_VIEW_RETRY_PRICE_CREDITS = 1850`, which is 370 display). "
      + "Rewriting a quotation to the ledger scale would falsify what he was sent.",
  },
  {
    file: "server/castingV2/refineService.ts",
    credits: 25,
    quote: "charged 25 credits and refunded them.",
    why:
      "A NAMED INCIDENT: *\"take his chest tattoo off\"* on a mid-chain branch "
      + "before fable-1324, where `slotsForFacet(\"ink\", …)` returned nothing and "
      + "the customer was charged and refunded. What that cost on the day is the "
      + "evidence for the two-reader derivation above it.",
  },
  {
    file: "server/castingV2/refineService.ts",
    credits: 25,
    quote: "was charged 25 credits for taking a tattoo off and given them back",
    why:
      "THE SAME fable-1324 INCIDENT, driven at the wire — `repaintCannotRemove()` "
      + "after the claim, charge class `refunded`. It is the measurement the free "
      + "pre-claim door was built from, and three lines in this module narrate it "
      + "because three separate doors were argued from it.",
  },
  {
    file: "server/castingV2/refineService.ts",
    credits: 25,
    quote: "charged 25 credits and refunded them in the same second",
    why:
      "A DIFFERENT INCIDENT, fable-489 §3: the founder tapped the EARS row and "
      + "asked for a cauliflower ear, the reading filed it as a mark, and the "
      + "repaint's door refused it correctly but AFTER the claim. The near-twin of "
      + "the fable-1324 line above, and the reason both quotes are exact.",
  },
  {
    file: "server/castingV2/refineService.ts",
    credits: 25,
    quote: "charged 25 credits, ask 2 with a photograph of a different person was",
    why:
      "A MEASUREMENT, one branch with the picture as the only variable "
      + "(fable-1430): ask 1 rendered and charged, ask 2 with a different "
      + "photograph was refused free as already-true, because the persisted "
      + "placeholder phrase matched word for word. What ask 1 cost is the evidence.",
  },
  {
    file: "server/castingV2/refineService.ts",
    credits: 25,
    quote: "door down, which charged somebody 25 credits without asking",
    why:
      "WHAT AN EARLIER VERSION OF THIS CODE DID — the offer used to be raised "
      + "inside the already-true door, which charged before it offered. The figure "
      + "is the cost of the version that was replaced, not of today's.",
  },
  {
    file: "server/castingV2/refineService.ts",
    credits: 25,
    quote: "unavailable, and she is charged 25 credits for an eye edit that may be a",
    why:
      "A DATED MEASUREMENT (2026-08-09): the tilt reads on 6 of 6 bare faces and 4 "
      + "of 8 bespectacled ones, so the protection was silently unavailable about "
      + "half the time. The figure is what that fall-through cost when it was "
      + "measured; the branch it describes was closed by the same commit.",
  },
  {
    file: "server/castingV2/refineService.ts",
    credits: 25,
    quote: "times and 25 credits charged each time, on the same facet that had",
    why:
      "RUN 1 OF THE REPLAY WALK, which paid for the specimens this widening was "
      + "conditioned on: *\"wear her hair down\"* delivered a high bun twice, the "
      + "reader saying so both times. A re-scaled figure would misstate what the "
      + "walk cost and what the condition was met with.",
  },
  {
    file: "server/db/discrepancyQueries.ts",
    credits: 5525,
    quote: "221 refines, 5,525 credits, on one account",
    why:
      "A MEASUREMENT of real production rows — the population that justified this "
      + "reconciliation reading at all. A measurement re-scaled to today's prices "
      + "is not a measurement.",
  },
  {
    file: "server/db/discrepancyQueries.ts",
    credits: 11450,
    quote: "11,450 credits, for work its operations had already charged",
    why:
      "The same measurement's other half — what the rows-only reading would have "
      + "reported against what the operations had charged. Both figures are "
      + "historical sums, not prices.",
  },
  {
    file: "server/routes/castingV2.ts",
    credits: 500,
    quote: "he had paid 500 credits for",
    why:
      "THE FOUNDER'S OWN LOST CAST, at the Sign price of the day (500, two "
      + "repricings ago) — the incident this roster procedure exists because of. "
      + "The number is the size of what went missing, which is the whole argument "
      + "for the surface.",
  },
  {
    file: "server/testing/creditDisplaySites.ts",
    credits: 200_000,
    quote: "200,000 credits/month with 75% rollover",
    why:
      "AN EXAMPLE OF A STRIPE PRODUCT DESCRIPTION, quoted to show the shape this "
      + "guard's subject must never take. Not a credit price in this product's "
      + "ledger at all, and no plan grants it.",
  },
];

function declaredFor(file: string, figure: ProseFigure): boolean {
  return PROSE_NOT_A_CURRENT_PRICE.some(
    (entry) => entry.file === file && entry.credits === figure.credits
      && figure.text.includes(entry.quote),
  );
}

describe("the reader itself, driven directly", () => {
  it("reads a price figure out of a line comment and a docblock alike", () => {
    expect(priceFiguresInProse("// a refine charges 25 credits\n")[0]).toMatchObject({
      line: 1,
      credits: 25,
    });
    expect(priceFiguresInProse("/**\n * paid 8,500 credits for five views\n */\n")[0])
      .toMatchObject({ line: 2, credits: 8500 });
    expect(priceFiguresInProse("/* a 450-credit ceremony */\n")[0]).toMatchObject({
      credits: 450,
    });
    expect(priceFiguresInProse("// 1_750 credits\n")[0]).toMatchObject({ credits: 1750 });
  });

  it("⚠ reads a CONTINUATION line of a block comment, which a naive reader does not", () => {
    /*
      THE ARM THAT CHANGED THIS SUITE'S ANSWER. A first pass at this card measured
      the population with a line filter — a stripped line had to START with `*`,
      `//` or `/*` — and reported SIXTEEN figures. The house stripper reports
      TWENTY-EIGHT, and the twelve it adds are all this shape: a wrapped sentence
      inside a block comment whose continuation lines carry no leading marker,
      which is how most of this repository's long comments are written.
      SEVEN of those twelve were genuinely stale. A reader that stops at the
      marker reports a smaller, cleaner, wrong answer, and nothing downstream
      disagrees with it.

      A bare `* …` line with no opener is NOT a comment, and the stripper is right
      to say so — the fixture above proves the opener matters rather than
      assuming it.
    */
    const block = "/*\n  a refusal that cost\n  somebody 450 credits in the end\n*/\n";
    expect(priceFiguresInProse(block)).toHaveLength(1);
    expect(priceFiguresInProse(block)[0]).toMatchObject({ line: 3, credits: 450 });
    expect(priceFiguresInProse(" * paid 450 credits\n"), "no opener, no comment").toEqual([]);
  });

  it("⚠ does NOT read a figure that survives comment stripping — code and copy are not prose", () => {
    /*
      THE NEGATIVE CONTROL THAT MATTERS. A customer-facing copy string carrying a
      price is a different subject with its own guards, and reading it here would
      flood this suite with lines nobody filed a card about. The code arm is the
      cheaper half of the same proof: a reader that matched raw text alone would
      report every `pointsCost` comparison in the tree.
    */
    expect(priceFiguresInProse('const label = "25 credits";\n')).toEqual([]);
    expect(priceFiguresInProse("const twentyFiveCredits = 25;\n")).toEqual([]);
    /* A string literal holding what looks like a comment opener cannot make the
       rest of the file read as prose (#1636's measured defect, one stripper over). */
    expect(priceFiguresInProse('const s = "/*";\nconst n = 25;\n')).toEqual([]);
  });

  it("reports the line the figure is actually on, so a finding can be opened", () => {
    const found = priceFiguresInProse("const a = 1;\n\n// paid 450 credits\n");
    expect(found).toHaveLength(1);
    expect(found[0]!.line).toBe(3);
  });

  it("reads BOTH figures when one comment states two", () => {
    /* `discrepancyQueries.ts` does exactly this, and a reader that stopped at the
       first hit per line would have declared one of its two figures and silently
       passed the other. */
    const found = priceFiguresInProse("// 450 credits then, 8,500 credits now\n");
    expect(found.map((hit) => hit.credits)).toEqual([450, 8500]);
  });
});

describe("the price vocabulary comes from the Atlas, not from this file", () => {
  it("⚠ has a population at all — the floor, before any verdict counts", () => {
    /*
      An unreadable price list yields an empty value set, under which EVERY prose
      figure is a finding — loud, and therefore safe. The dangerous direction is
      the module walk: an empty population passes every arm below in silence. So
      this arm is two-sided and names the modules the card is about rather than
      only counting them.
    */
    const { values, constants } = priceVocabulary();
    expect(values.size, "the Atlas price list is empty or unreadable").toBeGreaterThan(10);
    expect(constants).toContain("CASTING_V2_REFINE_PRICE_CREDITS");
    expect(constants).toContain("CASTING_V2_SIGN_PRICE_CREDITS");

    const modules = pricedModules(constants).map((module) => module.relative);
    expect(modules.length, "the walk found no priced modules").toBeGreaterThan(20);
    for (const named of [
      /* The procedure docblocks a reader meets when asking what a thing costs —
         two of them carried a stale figure until this commit. */
      "server/routes/castingV2.ts",
      "server/castingV2/refineService.ts",
      /* The authoritative docblock #1702 is named after, which declares no price
         and is enrolled by naming one. */
      "server/castingV2/castingV2Scope.ts",
      /* Where the prices themselves live. */
      "server/casting/castingCreditCosts.ts",
      "server/castingV2/castViewPackage.ts",
    ]) {
      expect(modules, `${named} must be in the population`).toContain(named);
    }
  });

  it("⚠ is proven able to FAIL — a stale figure in a real module's shape is a finding", () => {
    /*
      THE POSITIVE CONTROL. 25 is the refine price #1601 moved and is the figure
      this card's worst specimen carried, in the refine procedure's own docblock.
      A guard whose only proof is a green tree is a guard that cannot be
      distinguished from one that reads nothing.
    */
    const { values } = priceVocabulary();
    const stale = priceFiguresInProse("/** Refine one face — one paid edit, 25 credits. */\n");
    expect(stale).toHaveLength(1);
    expect(values.has(stale[0]!.credits), "25 must not be a current price").toBe(false);

    const current = priceFiguresInProse("/** Refine one face — one paid edit, 1,750 credits. */\n");
    expect(current).toHaveLength(1);
    expect(values.has(current[0]!.credits), "1,750 must be a current price").toBe(true);
  });
});

describe("every priced module's prose", () => {
  it("names no figure the product has stopped charging", () => {
    const { values, constants } = priceVocabulary();
    const findings: string[] = [];
    for (const module of pricedModules(constants)) {
      for (const figure of priceFiguresInProse(module.source)) {
        if (values.has(figure.credits)) continue;
        if (declaredFor(module.relative, figure)) continue;
        findings.push(`${module.relative}:${figure.line} — ${figure.credits}: ${figure.text}`);
      }
    }
    expect(
      findings,
      "A comment states a credit figure the product no longer charges. Either the "
      + "prose is stale and the figure moves to the current one, or it is a record "
      + "of what something cost on a day — in which case add it to "
      + "PROSE_NOT_A_CURRENT_PRICE with the reading that classified it. Do not "
      + "rewrite a historical figure: that falsifies a record.",
    ).toEqual([]);
  });
});

describe("the declared exemptions cannot outlive their subject", () => {
  it("⚠ each one still matches exactly one line in its own file", () => {
    /*
      THE ARM THAT STOPS THIS LIST BECOMING THE SECOND COPY. An exemption whose
      sentence has been reworded or deleted is a claim about a line that no longer
      exists, and nothing else in the tree would ever disagree with it — which is
      precisely how the pin this card was filed about came to sit beside a copy.
      Exactly one, not at least one: two matches means the quote stopped
      identifying a single line and the declaration no longer says which one it
      absolves.
    */
    for (const entry of PROSE_NOT_A_CURRENT_PRICE) {
      const source = readListedSource(path.join(repoRoot, entry.file));
      expect(source, `${entry.file} is declared here and missing from the tree`).not.toBeNull();
      const matches = priceFiguresInProse(source!).filter(
        (figure) => figure.credits === entry.credits && figure.text.includes(entry.quote),
      );
      expect(
        matches.map((figure) => figure.line),
        `${entry.file}: the declared quote "${entry.quote}" (${entry.credits}) must match exactly `
        + "one comment line. Re-read the line and re-word this entry, or delete it.",
      ).toHaveLength(1);
    }
  });

  it("⚠ every one of them carries a reason, which is the bar rather than tidiness", () => {
    /*
      An undeclared reason is an exemption nobody can audit — the same failure as
      a `@ts-expect-error` with no sentence. The length floor is deliberately low
      and the real check is that each names WHAT the figure is, which the reader
      above cannot verify and a human review can.
    */
    for (const entry of PROSE_NOT_A_CURRENT_PRICE) {
      expect(entry.why.length, `${entry.file} (${entry.credits}) has no reason`).toBeGreaterThan(60);
    }
  });

  it("declares no identical entry twice, so a duplicate cannot stand in for a second line", () => {
    /*
      Keyed on the QUOTE as well as the file and the figure, because one module
      legitimately carries several: `refineService.ts` narrates five separate
      incidents and measurements at the same old refine price, and three of them
      are near-twins. Collapsing them to one entry per file+figure is what would
      let a genuinely stale 25 hide behind an incident record — the exactly-one
      arm above is what keeps each honest, and this one keeps the list from
      carrying a second copy of one of them.
    */
    const keys = PROSE_NOT_A_CURRENT_PRICE.map(
      (entry) => `${entry.file}:${entry.credits}:${entry.quote}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});
