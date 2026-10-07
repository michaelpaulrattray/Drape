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
function pricedModules(constants: readonly string[], values: ReadonlySet<number>): Module[] {
  /*
    ⚠ **A MODULE THAT STATES A CURRENT PRICE HAS OPTED IN — the relay's own
    option (b) on PR #1716, measured before it was taken.**

    The first population was *names a price constant*, and the relay's finding
    said what that misses: the twelve lines #1702 was FILED about sit in
    modules that name none, so the card's own remainder was outside its own
    guard twice over. Fixing them without widening would have been the
    unguarded sweep this card exists to argue against — proven by sabotage,
    with `450` put back on `signTarget.ts` and the suite staying green.

    So a module joins the population if it names a price CONSTANT **or** its
    prose states a figure that is a current price. The second half is an opt-in
    by the module itself: a comment saying *an 8,500-credit ceremony* is a
    claim about today, and the day the Sign price moves, 8,500 leaves the
    vocabulary and that sentence becomes a finding — which is the whole
    mechanism, now pointed at the files a reader actually meets.

    **Measured on the tree before it was built**, so the cost is a number
    rather than a hope: population 47 → 79 modules, 32 newly enrolled, 27 new
    figures raised. Twelve of the 27 were genuinely stale claims about today —
    seven of them in `client/src/pages/CastingSheet.tsx`, the casting surface
    itself, which the card's hand-written enumeration never reached — and the
    other fifteen are records, declared below.

    ⚠ **ITS HONEST LIMIT IS THE MIRROR OF THE FIRST POPULATION'S.** A module
    whose prose names ONLY stale figures and no constant is still invisible:
    nothing about it is current, so nothing opts it in. The entrance is a
    correct sentence, which means this reading protects a line from GOING
    stale and cannot find one that already is.
  */
  const statesCurrentPrice = (source: string): boolean =>
    priceFiguresInProse(source).some((figure) => values.has(figure.credits));
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
      if (!names.test(source) && !statesCurrentPrice(source)) continue;
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
    file: "shared/castingReceipt.ts",
    credits: 30,
    quote: "30 credits a face",
    why:
      "THE DRAFT THAT MADE THE CARD, quoted as the reason the figure is derived "
      + "rather than written (#1908). Yuna's wording for this legend read "
      + "*\"~240 … 30 credits a face\"*, and both numbers were true of the price "
      + "table before 2026-10-01 and false on the day she wrote them — a Roll is "
      + "1,600 ledger / 320 display now, so a face is 40. The module's whole "
      + "subject is that a hand-typed per-face figure goes stale, and the "
      + "evidence for it is the stale figure. Rewriting it to 40 would delete "
      + "the argument and leave a paragraph asserting that 40 was once wrong. "
      + "`server/castingV2/receiptPerFace.test.ts` holds the code to typing no "
      + "numeral at all, so this quote cannot hide a real one.",
  },
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
    file: "server/routes/billing.ts",
    credits: 200_000,
    quote: '("200,000 credits/month with',
    why:
      "A QUOTATION OF A DELETED FIELD'S TEXT. `getPlans` served a composed "
      + "Stripe `description` no client ever rendered; #1605 removed it and this "
      + "comment records what it said, which is the evidence for calling it a "
      + "second copy of a number. Rewriting the quotation would falsify the "
      + "record of what was removed.",
  },
  {
    file: "shared/creditTopups.ts",
    credits: 100_000,
    quote: "The largest single top-up, in units",
    why:
      "⚠ TRUE TODAY, AND THE ONLY ENTRY ON THIS LIST THAT IS — so it is the "
      + "only one that can ROT, and saying so is the point of writing it here. "
      + "It is the largest order this product sells, DERIVED (`TOPUP_MAX_UNITS` "
      + "× `TOPUP_UNIT_DISPLAY_CREDITS`) rather than declared, so the Atlas's "
      + "price collector cannot see the product of two constants and the figure "
      + "reads as a price nothing charges. If the bound ever moves, this "
      + "sentence goes stale and this line absolves it — the arm that forecloses "
      + "that is #1606 slice 2's, which holds the product equal to 100,000 "
      + "against the two constants.",
  },
  {
    file: "client/src/features/billing/AddCreditsModal.tsx",
    credits: 9_000,
    quote: "**Name the delta, not the tier**",
    why:
      "THE BRIEF'S OWN §7.2 EXAMPLE, quoted to explain the rule it states. The "
      + "figure is an illustration of a DELTA between two plan rungs, not a "
      + "price of anything, and the delta it illustrates depends on which two "
      + "rungs a customer is between.",
  },
  {
    file: "client/src/features/billing/AddCreditsModal.tsx",
    credits: 11_300,
    quote: "A free account read",
    why:
      "#1761's DEFECT FIGURE — what this pane printed before it was fixed, when "
      + "it subtracted the free rung's ONE-TIME signup grant from a monthly "
      + "allowance. The card's whole argument is the gap between 11,300 and "
      + "Starter's 14,000; re-scaling either would delete the argument.",
  },
  {
    file: "client/src/features/billing/AddCreditsModal.tsx",
    credits: 2_778,
    quote: "up from free",
    why:
      "A RATE, NOT A PRICE — credits per dollar, and quoted from what was seen "
      + "in the running app on a free account (`2,778 credits per $1, up from "
      + "free`), which is the sentence #403 was filed about. The figure is the "
      + "evidence that the clause was drawn where it had nothing to compare.",
  },
  {
    file: "client/src/features/billing/AddCreditsModal.tsx",
    credits: 519,
    quote: "a free account looking at Starter read",
    why:
      "A RATE, NOT A PRICE — credits per dollar, and the MEASURED reading of "
      + "the sentence #1845 removed: a free account opening this pane read "
      + "`519 credits per $1` under the heading *Choose a plan*, which is the "
      + "line his #1773 word forbids on a plan surface. It is recorded in the "
      + "paragraph that replaces the sentence, because three cards' findings "
      + "rode it and a deletion with no record of what it said re-opens them. "
      + "Re-scaling it would falsify a measurement.",
  },
  {
    file: "client/src/features/billing/AddCreditsModal.tsx",
    credits: 11_300,
    quote: "opening Add credits read",
    why:
      "THE SAME #1761 FIGURE, in the paragraph that records the repair rather "
      + "than the one that records the card. Both lines quote the sentence a "
      + "customer actually read, and each is pinned separately so a reword of "
      + "one cannot be absolved by the other's declaration.",
  },
  {
    file: "client/src/features/billing/AddCreditsModal.tsx",
    credits: 3_688,
    quote: "credits that they had",
    why:
      "A BALANCE IN AN INCIDENT RECORD (#1703, measured on this very surface): "
      + "a customer holding 3,688 credits was told they had 0 for about a "
      + "second. It is what somebody's balance was, not what anything costs.",
  },
  {
    file: "client/src/features/billing/ChangePlanModal.tsx",
    credits: 15_000,
    quote: "one pool for",
    why:
      "RINOA'S DESIGN LINE, QUOTED VERBATIM (#1607, P1-8) — the shape §6c's "
      + "credits line was rewritten into, written before the grant ladder he "
      + "rounded on 2026-10-01 (#1602). It is an example of a SENTENCE, and the "
      + "figure the surface actually draws comes off `PLAN_TIERS`.",
  },
  {
    file: "client/src/features/billing/ChangePlanModal.tsx",
    credits: 2_700,
    quote: "A MONTH",
    why:
      "THE FREE RUNG'S ONE-TIME SIGNUP GRANT, in the record of what the card "
      + "printed about it: a free account read `2,700 A MONTH` about credits "
      + "that arrive once. A grant is not a price, and this one is a grant two "
      + "ladders ago (13,500 display since #1601).",
  },
  {
    file: "server/castingV2/cannotSayCopy.ts",
    credits: 25,
    quote: "AFTER the claim, so the customer was charged",
    why:
      "WHAT AN EARLIER VERSION OF THIS CODE DID — a transform whose source "
      + "picture was missing found out after the claim, so it charged and "
      + "refunded to say so. The figure is the cost of the version that was "
      + "replaced, which is the argument for the pre-claim door that replaced it.",
  },
  {
    file: "server/castingV2/prunedSlots.ts",
    credits: 25,
    quote: "then charged 25 credits and refunded them, on the shipped stated",
    why:
      "A MEASUREMENT AT THE WIRE — *\"take his chest tattoo off\"* on a mid-chain "
      + "branch, live for every repaint customer, computing the prune perfectly "
      + "and then charging and refunding. The figure is what that cost the day it "
      + "was driven; re-scaling it would misstate the measurement.",
  },
  {
    file: "server/castingV2/retryService.ts",
    credits: 20,
    quote: "same prompt, one slice, 20 credits, refunded again on failure",
    why:
      "HIS OWN WORDS, VERBATIM (2026-08-26), quoted as the design's provenance. "
      + "A slice has been 200 since #1753 and the charge has come off any single "
      + "price since #1601 item 2 — but a quotation is a record of what he said, "
      + "and editing his sentence to today's price would falsify it.",
  },
  {
    file: "server/stripe/stripeService.ts",
    credits: 10_000,
    quote: "which turned a 10,000-credit top-up into 7",
    why:
      "A DEFECT RECORD (#418): a bare magic float on the moderator's client "
      + "recomputed a refund's original amount and turned a 10,000-credit top-up "
      + "into 7 cents. The figure is the worked example that shows the error's "
      + "size, not a price — and 10,000 is a top-up SIZE in display credits, "
      + "which this guard's vocabulary of casting prices does not carry.",
  },
  {
    file: "server/stripe/webhooks.ts",
    credits: 1_400,
    quote: "credits bought\" when 600 were bought",
    why:
      "A HYPOTHETICAL, and the whole point of the sentence: it contrasts the "
      + "GRANT with the new balance, so the two figures must differ and neither "
      + "is a price of anything. Making them real prices would delete the "
      + "distinction the comment exists to draw.",
  },
  {
    file: "client/src/components/UserCard.tsx",
    credits: 1_240,
    quote: "balance in mono because it is a measured",
    why:
      "A RENDERING EXAMPLE of a BALANCE, quoted to explain why one half of the "
      + "line is mono and the other is sans. Any figure would do; it is a "
      + "typographic specimen, not a claim about what anything costs.",
  },
  {
    file: "client/src/features/castingV2/components/KeptTray.tsx",
    credits: 500,
    quote: "the price the day he said it; 8,500 since #1601",
    why:
      "THE FOUNDER'S OWN FINDING, at the Sign price of the day — the tray's one "
      + "job is comparing a shortlist before a Sign, and 24px chips were not "
      + "comparable. ⚠ It is STAMPED rather than rewritten (`500 … 8,500 since "
      + "#1601`), which is the one shape that serves both readers: a human sees "
      + "today's price without the record being falsified, and this declaration "
      + "quotes the stamp so a bare `500` coming back is still a finding. The "
      + "claim about today in the same file — *an 8,500-credit ceremony* — is "
      + "corrected rather than declared, which is the distinction this card names.",
  },
  {
    file: "client/src/features/settings/sections/UsageSection.tsx",
    credits: 45_295,
    quote: "`castingV2` 462 rows / 45,295 credits",
    why:
      "A MEASUREMENT OF HIS 622 REAL SPEND ROWS, and the evidence for his option "
      + "2 (no per-tool bars). A sum of real rows re-scaled to today's prices is "
      + "not a sum of real rows.",
  },
  {
    file: "client/src/features/settings/sections/UsageSection.tsx",
    credits: 61_100,
    quote: "131 rows / 61,100 credits",
    why:
      "THE SAME MEASUREMENT'S HEADLINE HALF — the 53% of his spend with no "
      + "engine recorded at all, which is the finding that killed the per-tool "
      + "bars. Historical sums, not prices.",
  },
  {
    file: "client/src/features/settings/sections/UsageSection.tsx",
    credits: 9_300,
    quote: "9,300 credits. **53% of his spend by credits",
    why:
      "THE THIRD ROW OF THE SAME MEASUREMENT. All three are declared "
      + "individually rather than as one entry for the file, so a reword of any "
      + "one of them is still read.",
  },
  {
    file: "client/src/features/settings/usageWindow.ts",
    credits: 61_000,
    quote: "61,000 credits left",
    why:
      "A SENTENCE A SUBSCRIBER ACTUALLY READ for one render beat (PR #634's one "
      + "review finding): real data attached to a window nobody had summed. The "
      + "figure is the evidence that the words were confident while the figures "
      + "were honestly em-dashed.",
  },
  {
    file: "client/src/pages/CastingSheet.tsx",
    credits: 160,
    quote: "credits were refunded.\" The money is right and the sentence is true",
    why:
      "THE SERVER'S OWN SENTENCE, QUOTED — the cancel message a customer read, "
      + "at the roll price of the day. The point being made is about WHEN it "
      + "arrives rather than what it says, and rewriting a quotation would make "
      + "it a sentence nobody was ever sent.",
  },
  {
    file: "client/src/pages/CastingSheet.tsx",
    credits: 640,
    quote: "Four extra rolls, 640 credits",
    why:
      "THE DEFECT THE FOUNDER HIT, costed: Follow showed nothing for ~2.5s, he "
      + "clicked again, and each click was a separate paid roll. Four rolls at "
      + "the price of the day is what it cost him, which is the whole argument "
      + "for the optimistic row.",
  },
  {
    file: "client/src/pages/CastingSheet.tsx",
    credits: 240,
    quote: "FOLLOW sheet drew `~ 240 credits` for a few hundred milliseconds",
    why:
      "A RENDER DEFECT RECORDED AT THE FRAME — the figure that flashed before it "
      + "flipped to 320, in DISPLAY credits. The sentence's whole subject is that "
      + "a price changed under the cursor, so both figures have to stay as they "
      + "were seen. (320 happens to still be a Roll's display price, which is "
      + "coincidence rather than currency.)",
  },
  {
    file: "client/src/pages/CastingSheet.tsx",
    credits: 160,
    quote: "already finished, so there was nothing to refund\" while 160 credits",
    why:
      "A WRONG SENTENCE AND THE MONEY MOVING UNDER IT, recorded together: the "
      + "array shrank 8 → 5 → 0, the surface announced there was nothing to "
      + "refund, and a roll's worth of credits was on its way back. The figure "
      + "is what was in flight at the time.",
  },
  {
    file: "server/castingV2/viewRetryService.ts",
    credits: 370,
    quote: "already spent and was asked to pay",
    why:
      "⚠ CURRENT AND CORRECT, ON THE CUSTOMER'S SCALE RATHER THAN THE LEDGER'S "
      + "— a paid Try again is `CASTING_V2_VIEW_RETRY_PRICE_CREDITS` = 1,850 "
      + "ledger, which is 370 displayed, and the sentence is about what she was "
      + "ASKED TO PAY. This guard's vocabulary is the Atlas's ledger figures, so "
      + "every display price in prose arrives here as a figure nothing charges; "
      + "`castingCreditCosts.ts`'s `350 -> 370 credits` is the same shape one "
      + "module over. Stated rather than solved: folding `ledger ÷ 5` into the "
      + "vocabulary would quiet this and blind the guard wherever a stale ledger "
      + "figure equals a live display one — 350 is both the ink-add price and a "
      + "Refine's display price today, which is the collision that makes it a "
      + "trade rather than a fix.",
  },
  /*
    ⚠ **THREE ROWS FOR ONE MODULE, AND IT JOINED THE POPULATION BY BEING
    CORRECT — #1905.** `server/testing/creditDisplaySites.ts` is the credit
    census's own reader. It named no price constant and stated no current
    figure, so it sat outside this guard entirely while carrying three priced
    quotations in its header. #1905 widened its JSX reader and wrote the defect
    into the docblock — *"it read ~1,600 credits where every sibling read
    ~320"* — and **1,600 and 320 are both current**, so the module opted itself
    in exactly as the population note above describes, and its three existing
    figures surfaced in the same run.

    **Not one of the three is a claim about today**, which is why they are
    declared rather than rewritten: each is a QUOTATION — a deleted Stripe
    string, a sentence production really printed between two timestamps, and a
    stored ledger description. The guard's own instruction governs: *do not
    rewrite a historical figure, that falsifies a record.*
  */
  {
    file: "server/testing/creditDisplaySites.ts",
    credits: 200000,
    quote: "200,000 credits/month with 75% rollover",
    why:
      "A QUOTATION OF A STRING THAT NO LONGER EXISTS — the `product_data."
      + "description` `stripeProducts.ts` composed per rung, deleted outright by "
      + "#1605, and quoted here as what the census's first shrink (122 → 108) "
      + "removed. It was a plan's monthly DISPLAY credits, never a price, and "
      + "the sentence is a record of a deletion: rewriting the number would "
      + "describe a string the commit it reports on did not delete.",
  },
  {
    file: "server/testing/creditDisplaySites.ts",
    credits: 150,
    quote: "150 credits were refunded.",
    why:
      "A SENTENCE PRODUCTION REALLY PRINTED, with the minute it started — the "
      + "price table landed at `143e5b30` (2026-10-01 17:34Z) and from then a "
      + "per-candidate refund of 30 display read this, on a screen whose every "
      + "other number said 240. It is the measured specimen of the 19 unrouted "
      + "money sentences that slice fixed, dated on both sides. A record of a "
      + "defect, not a price.",
  },
  {
    file: "server/testing/creditDisplaySites.ts",
    credits: 180000,
    quote: "Monthly credit refresh (180000 credits + 0 rollover)",
    why:
      "A STORED `creditTransactions` DESCRIPTION, quoted in LEDGER units on "
      + "purpose — it is the worked example of that slice's one judgement, that "
      + "four such rows STAY in ledger because their only live reader is the "
      + "moderator credit history, which prints them beside the ledger `amount`. "
      + "The same reasoning is already declared row by row in `UNROUTED` itself. "
      + "Putting a display figure in this quotation would make the example argue "
      + "against the decision it exists to explain.",
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

    const modules = pricedModules(constants, values).map((module) => module.relative);
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
    for (const module of pricedModules(constants, values)) {
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

  it("⚠ ABSOLVES A FINDING THAT CAN ACTUALLY HAPPEN — an unreachable exemption is theatre", () => {
    /*
      ⚠ **THE RELAY FOUND A DEAD ENTRY ON THIS LIST THE DAY IT WAS WRITTEN, AND
      THE ARM ABOVE COULD NOT SEE IT** (PR #1716's finding, 2026-10-01). The
      `server/testing/creditDisplaySites.ts` entry declared a 200,000 figure
      that **the population never reaches**: that module names no price
      constant, so it is not a priced module and its prose is never read. The
      quote matched a real line — `:280` still carries it — so the
      exactly-one arm passed, and the entry sat there reading as diligence
      while absolving nothing.

      **A quote that matches is not an exemption that is needed.** The arm above
      asks whether the SENTENCE still exists; this asks whether the FINDING
      does. They are different questions and only the second can see an entry
      whose file left the population — which is how an exemption list quietly
      becomes a list of excuses for things that cannot happen, and then gets
      copied forward by the next shift who assumes each line was earned.

      Driven both ways by the two arms below it, so this is not a claim about a
      list that happens to be clean today.
    */
    const { values, constants } = priceVocabulary();
    const reached = new Set<string>();
    for (const module of pricedModules(constants, values)) {
      for (const figure of priceFiguresInProse(module.source)) {
        if (values.has(figure.credits)) continue;
        for (const entry of PROSE_NOT_A_CURRENT_PRICE) {
          if (entry.file !== module.relative) continue;
          if (entry.credits !== figure.credits) continue;
          if (!figure.text.includes(entry.quote)) continue;
          reached.add(`${entry.file}:${entry.credits}:${entry.quote}`);
        }
      }
    }
    const unreached = PROSE_NOT_A_CURRENT_PRICE
      .map((entry) => `${entry.file}:${entry.credits}:${entry.quote}`)
      .filter((key) => !reached.has(key));
    expect(
      unreached,
      "an exemption absolves no finding this guard can raise — either its file names no "
      + "price constant (so the module is outside the population and the entry is "
      + "theatre), or the figure has become a current price again. Read it and delete it.",
    ).toEqual([]);
  });

  it("⚠ the arm above has a POPULATION, so an empty list cannot pass it vacuously", () => {
    /* Working law 2's floor. With no exemptions the arm is trivially green, and
       the number it should be looking at is the whole list. */
    expect(PROSE_NOT_A_CURRENT_PRICE.length).toBeGreaterThan(15);
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
