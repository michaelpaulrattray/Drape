/**
 * THE CREDIT-DISPLAY GUARD'S ARMS — #1600 done-when 1, driven.
 *
 * `server/testing/creditDisplaySites.ts` carries the design and the stated
 * limits. This file carries the four things that make it an instrument rather
 * than a claim:
 *
 * **1 · A NEGATIVE CONTROL FIRST.** The tree as it stands must pass. A guard
 * over the words "cost", "price" and "credit" in a product whose plan table
 * stores a `price` in CENTS is one substring from refusing correct code, and a
 * guard that refuses correct code gets deleted rather than fixed. The
 * precision arms below are that risk, driven.
 *
 * **2 · POSITIVE CONTROLS THAT CANNOT BE ARGUED WITH.** Each rule reddens on a
 * fixture, and the finding names the file and the line — a guard that reddens
 * without saying where is a guard nobody can act on. The one the card asks for
 * by name is the LAST of them: a routed site, un-routed again, must redden.
 *
 * **3 · FLOORS ON THE POPULATION.** A reader that silently stopped parsing
 * reports zero sites, which is byte-identical to a fully routed product. So
 * the walk's own counts are asserted.
 *
 * **4 · THE CENSUS IS HELD TO ITS CONTRACT.** `UNROUTED` may only shrink, may
 * hold no duplicate, and — the arm that stops it rotting — every row in it
 * must still match a site the reader really finds. A list that outlives its
 * sites excuses the wrong code while reporting a clean shrink (working law 4).
 */
import { execFileSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";

import { readListedSource } from "./testing/listedSource";
import { join } from "node:path";
import {
  DISPLAY_HELPERS,
  STAFF_SURFACES,
  THE_HELPER,
  UNROUTED,
  censusKey,
  creditDisplaySites,
  creditSitesIn,
  creditDisplayPopulation,
} from "./testing/creditDisplaySites";
import { CHILD_PROCESS_TEST_TIMEOUT_MS } from "./testing/childProcessTimeout";

/* This suite both SPAWNS git (rev-parse, and `git ls-files` inside the
   deriver) and SWEEPS the source tree, so it is in the population of both
   timeout guards. The child-process constant satisfies each of them — the
   sweep guard accepts either — and is the one the spawning class asks for. */
vi.setConfig({ testTimeout: CHILD_PROCESS_TEST_TIMEOUT_MS });

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();

/**
 * The census as it stood when this guard landed: 79 distinct shapes covering
 * 106 real occurrences. `UNROUTED` may fall to zero and may never rise — a
 * routing PR decrements or deletes rows, and a NEW unrouted site is a defect
 * rather than a row to add.
 *
 * ⚠ **IT ROSE TWICE ON 2026-10-01 — 106 → 108 → 122 — AND BOTH TIMES BECAUSE THE
 * READER COULD NOT SEE A SITE THE PRODUCT ALREADY HAD.** Neither rise is a new
 * place a customer reads a ledger number.
 *
 * **THE SECOND (#1676) IS THE FIRST ONE'S CLASS.** The first added a word to
 * rule 1's vocabulary; this card asked whether the vocabulary was the mistake,
 * and the measurement said it was: **fourteen credit numbers a customer reads
 * were in no rule's reach**, called `delta`, `reward`, `earned`, `cap`, `spent`
 * and `perDollar` — including *"${delta} credits a month"*, which says the word
 * out loud. Three structural repairs and ONE argued word close all fourteen,
 * and the eleven `toLocaleString` calls that are correctly NOT credits (three
 * frame counts, four dates, two dollar figures, two character counts) are
 * still correctly not indicted — which is the arm that matters, because a
 * widening that indicts a date is worse than the hole.
 * `server/testing/creditDisplaySites.ts` carries the table. **Nothing was
 * routed; the shrink that measures the work starts from 122.**
 *
 * ⚠ **THE FIRST ROSE TO 108 AND SAID IT WAS THE ONLY RISE IT MAY EVER HAVE.**
 * The reason is a HOLE IN THE READER, not a new site in the product: rule 1's
 * vocabulary was `[a-z]cost$`, which needs a letter before "cost", so the bare
 * four-letter `cost` never matched it. `ViewTabs.tsx`'s GhostSlot and FailedSlot
 * face labels — `` `${action} · ${cost.toLocaleString()}` ``, the number a
 * customer reads ON the tile — said no "credit" beside them either, so neither
 * rule reached them and the census could not hold them. A routing slice would
 * have routed the hover title on the same component and left the face on the
 * ledger scale. Widening the rule found exactly those two and nothing else
 * (derived over the guard's own population), so the budget rises by two while
 * the shape count stays at 79. **Nothing was routed by this change** — the
 * shrink that measures the work starts from 108.
 *
 * ✅ **AND IT HAS SHRUNK FOR THE FIRST TIME — 122 → 108 (#1605) — SO THE
 * CONSTANT IS A RATCHET AND IS LOWERED BY EACH SLICE THAT LANDS.** It was
 * named `OCCURRENCES_AT_LANDING` and compared with `<=`, which made it a
 * ceiling that never came down: once a slice had routed or deleted sites, the
 * budget still permitted every one of them to come back. A ratchet nobody
 * lowers measures the work once and then stops measuring it. The seven
 * `stripeProducts.ts` rows went by DELETION — the composed Stripe product
 * text — which is why this shrink precedes the new price table rather than
 * riding with it.
 *
 * ✅ **108 → 42 (#1600 slice 2, the client routing) — the first shrink by
 * ROUTING rather than by deletion.** 66 occurrences across 31 files under
 * `client/src/` now go through the helper. ⚠ **The remaining 42 do NOT all
 * represent work**: five of them are client rows that must never be routed —
 * the three `formatCreditsPerDollar` call sites whose conversion happens inside
 * that function, a FRAME count, and a RATE — each argued in
 * `creditDisplaySites.ts`'s own header. So this ratchet bottoms out above zero,
 * and a later slice reporting 0 has broken something rather than finished it.
 *
 * ✅ **42 → 19 (#1600 slice 3, the server routing) — AND THE RATCHET IS NOW AT
 * ITS FLOOR, which is why the shape of the contract changes with this number.**
 * 22 occurrences routed, 9 corrected in the reader, and **3 ADDED that no rule
 * could previously see** — all three in `atomicCredits.ts`, the shared charge
 * wrapper, called `amount`. **Not one row left is work**: every row carries a
 * `stays` reason, so the question this constant used to answer — *how much is
 * left to do* — is answered instead by `stillToRoute` below, which must be ZERO.
 * A bare count could never tell a remaining site from a declared one, and the
 * five client rows are the proof that it had already stopped being able to.
 *
 * ⚠ **IT ROSE AND FELL IN THE SAME COMMIT, WHICH IS WHY THE NUMBER ALONE IS NO
 * LONGER THE CONTRACT.** 42 → 16 by routing, 16 → 22 when `amount$` joined rule
 * 2's vocabulary and found eight more, 22 → 19 once the three real ones were
 * routed and the two dollar figures ruled out. A reader that reaches further
 * raises this count while the product gets BETTER, and a reader that quietly
 * stops parsing lowers it to zero.
 *
 * ⚠ **A RISE IS STILL A DEFECT, and the number is still here for the reason it
 * always was**: an excess site reddens the negative control, and the ratchet
 * catches the other direction — a row quietly re-admitted with a bigger count.
 */
const OCCURRENCES_CEILING = 19;

const censusedOccurrences = UNROUTED.reduce((total, row) => total + row.count, 0);

const reading = creditDisplaySites(repoRoot);

describe("the negative control — the tree as it stands passes", () => {
  it("finds no credit number reaching a customer outside the census", () => {
    const named = reading.sites.map((site) => `${site.file}:${site.line} [${site.rule}] ${site.expression}`);
    expect(named).toEqual([]);
  });

  it("read the product, rather than reporting silence about an empty walk", () => {
    expect(reading.files).toBeGreaterThan(800);
  });

  it("saw the shapes its rules are about, so silence means something", () => {
    /* Both floors: a parser that gave up would report zero of each, and zero
       sites, which is exactly what a fully routed product reports. */
    expect(reading.formatCalls).toBeGreaterThan(80);
    expect(reading.interpolations).toBeGreaterThan(5_000);
  });

  it("walks the product's source and not its tests or its own reader", () => {
    const files = creditDisplayPopulation(repoRoot);
    expect(files.some((file) => /\.test\.tsx?$/.test(file))).toBe(false);
    expect(files).not.toContain(THE_HELPER);
    expect(files.some((file) => file.startsWith("server/testing/"))).toBe(false);
  });
});

describe("the positive controls — each rule reddens, and says where", () => {
  it("catches a credit balance handed straight to toLocaleString", () => {
    const sites = creditSitesIn(
      "client/src/features/billing/Fixture.tsx",
      "export const F = () => <span>{creditsBalance.toLocaleString()}</span>;\n",
    );
    expect(sites).toHaveLength(1);
    expect(sites[0]?.rule).toBe("formatted");
    expect(sites[0]?.line).toBe(1);
    expect(sites[0]?.file).toBe("client/src/features/billing/Fixture.tsx");
  });

  it("catches a credit number interpolated beside the word credit", () => {
    const sites = creditSitesIn(
      "client/src/features/casting/Fixture.tsx",
      ["export const F = ({ cost }: { cost: number }) => (", "  <p>Need {cost} credits</p>", ");", ""].join("\n"),
    );
    expect(sites.map((site) => site.rule)).toEqual(["beside-the-word"]);
    expect(sites[0]?.line).toBe(2);
  });

  it("⚠ THE RELAY'S ARM — a bare `cost` handed to toLocaleString with NO word beside it reddens", () => {
    /* The hole that shipped on PR #1649 and was found from outside, reproduced
       at the real shape: `ViewTabs.tsx`'s GhostSlot/FailedSlot face label. Rule
       2 cannot see it (no "credit" in the surrounding text) and rule 1 could
       not see it either, because the vocabulary was `[a-z]cost$` and this name
       is the bare four-letter `cost`. It is the number a customer READS on the
       tile, while the hover title two lines up WAS censused — so a routing
       slice would have shown 240 in the tooltip and 1,200 on the face.

       This arm fails on the rule as it stood: revert `cost$` to `[a-z]cost$`
       and it reports zero sites. */
    const sites = creditSitesIn(
      "client/src/features/casting/components/Fixture.tsx",
      [
        "export const F = ({ action, cost }: { action: string; cost?: number }) => (",
        "  <span>{cost === undefined ? action : `${action} · ${cost.toLocaleString()}`}</span>",
        ");",
        "",
      ].join("\n"),
    );
    expect(sites).toHaveLength(1);
    expect(sites[0]?.rule).toBe("formatted");
    expect(sites[0]?.line).toBe(2);
    expect(sites[0]?.expression).toBe("cost.toLocaleString()");
  });

  it("catches a bare `cost` on the plainest shape too, so the arm above is not passing on its template", () => {
    const sites = creditSitesIn(
      "client/src/features/billing/Fixture.tsx",
      "export const F = ({ cost }: { cost: number }) => <span>{cost.toLocaleString()}</span>;\n",
    );
    expect(sites.map((site) => site.rule)).toEqual(["formatted"]);
  });

  it("catches the same shape in a server sentence, not only in JSX", () => {
    const sites = creditSitesIn(
      "server/lib/fixture.ts",
      "export const m = (price: number) => `Not enough credits. A refinement costs ${price} credits.`;\n",
    );
    expect(sites.map((site) => site.rule)).toEqual(["beside-the-word"]);
  });

  it("catches scale arithmetic written out by hand, in each of its three shapes", () => {
    for (const expression of ["credits / 5", "creditsBalance / 50", "creditCost * 50"]) {
      const sites = creditSitesIn("client/src/Fixture.tsx", `export const n = ${expression};\n`);
      expect(sites.map((site) => site.rule)).toEqual(["scale-arithmetic"]);
    }
  });

  it("catches scale arithmetic on a STAFF surface too — they are exempt from the display scale, not from inventing it", () => {
    const staff = `${STAFF_SURFACES[0]}Fixture.tsx`;
    const sites = creditSitesIn(staff, "export const n = creditsBalance / 5;\n");
    expect(sites.map((site) => site.rule)).toEqual(["scale-arithmetic"]);
  });

  it("⚠ THE CARD'S OWN ARM — a routed site passes, and the same site un-routed reddens", () => {
    const routed =
      "export const F = () => <span>{formatCredits(displayBalance(creditsBalance))} credits</span>;\n";
    const unrouted = "export const F = () => <span>{creditsBalance.toLocaleString()} credits</span>;\n";

    expect(creditSitesIn("client/src/features/billing/Fixture.tsx", routed)).toEqual([]);

    const reverted = creditSitesIn("client/src/features/billing/Fixture.tsx", unrouted);
    expect(reverted).toHaveLength(1);
    expect(reverted[0]?.rule).toBe("formatted");
  });

  it("accepts every display helper as the wrapper, not only the two above", () => {
    for (const helper of DISPLAY_HELPERS) {
      const source = `export const F = () => <span>{${helper}(creditsBalance)} credits</span>;\n`;
      expect(creditSitesIn("client/src/features/billing/Fixture.tsx", source)).toEqual([]);
    }
  });
});

describe("#1600 slice 2 — a helper NESTED in the indicted expression is routed", () => {
  /*
    ⚠ THE DEFECT THESE ARMS WERE WRITTEN FOR, AND IT INDICTED CORRECT CODE.

    `insideDisplayHelper` walks UP from the indicted node, so a helper call
    nested inside a larger expression was invisible to it — and rule 2 limb A
    then fired on the enclosing expression, because `namesIn` found a
    credit-ish name inside it. **The name it found was `formatCredits`
    itself**: `/credit/i` matches the helper, so routing a site supplied the
    very name that re-indicted it. Three real sites hit this on the client
    routing slice — a cap clause in `ReferralBlock`, the sheet dock's "left"
    tail, and the usage per-day rate.

    The pair that matters is the last two: routed-inside-a-conditional must
    PASS, and half-routed must still REDDEN. A fix that only widened would have
    excused the one shape that actually ships a mixed scale.
  */
  it("passes a conditional whose branch routes through the helper", () => {
    const sites = creditSitesIn(
      "client/src/features/settings/Fixture.tsx",
      [
        "export const F = ({ cap }: { cap: number }) => (",
        "  <p>They get credits{cap > 0 ? ` — up to ${formatCredits(displayBalance(cap))} in total` : \"\"}.</p>",
        ");",
        "",
      ].join("\n"),
    );
    expect(sites).toEqual([]);
  });

  it("passes a routed value wrapped in arithmetic, where the helper is not the outer call", () => {
    const sites = creditSitesIn(
      "client/src/features/settings/Fixture.tsx",
      [
        "export const F = ({ spent, days }: { spent: number; days: number }) => (",
        "  <p>{formatCredits(displayBalance(Math.round(spent / days)))} credits a day</p>",
        ");",
        "",
      ].join("\n"),
    );
    expect(sites).toEqual([]);
  });

  it("⚠ STILL REDDENS on a HALF-routed expression — the shape that ships a mixed scale", () => {
    /*
      ⚠ THE BARE HALF HERE IS DELIBERATELY *NOT* A `toLocaleString` CALL, AND
      THAT IS THE WHOLE POINT OF THE ARM.

      The first version of it used `` `${spent.toLocaleString()} of …` `` — and
      **rule 1 catches that on its own**, so the arm passed no matter what
      `routedThroughHelper` did. Both sabotage cases written for it SURVIVED.
      A raw `${cost}` spliced into a credit sentence is reachable by rule 2 and
      by nothing else, so this arm can only be satisfied by the behaviour it is
      about.

      Drive it by counting only `toLocaleString` as bare — the function's first
      cut — and this goes green while a ledger number sits in a sentence next
      to a converted one.
    */
    const sites = creditSitesIn(
      "client/src/features/billing/Fixture.tsx",
      [
        "export const F = ({ cost, total, show }: { cost: number; total: number; show: boolean }) => (",
        "  <p>Need {show ? `${cost} and ${formatCredits(displayBalance(total))}` : \"\"} credits</p>",
        ");",
        "",
      ].join("\n"),
    );
    expect(sites.length).toBeGreaterThan(0);
    expect(sites.some((site) => site.expression.includes("cost"))).toBe(true);
  });

  it("⚠ and reddens when the bare half IS formatted, caught by rule 1 as well", () => {
    /* Kept beside the arm above rather than instead of it: this shape is real
       and must redden, but it proves rule 1 rather than this function. Saying
       which is which is the difference between two arms and one. */
    const sites = creditSitesIn(
      "client/src/features/billing/Fixture.tsx",
      [
        "export const F = ({ spent, total }: { spent: number; total: number }) => (",
        "  <p>{`${spent.toLocaleString()} of ${formatCredits(displayBalance(total))} credits`}</p>",
        ");",
        "",
      ].join("\n"),
    );
    expect(sites.some((site) => site.expression.includes("spent.toLocaleString()"))).toBe(true);
  });

  it("⚠ STILL REDDENS on an expression that mentions a helper without calling one", () => {
    /* `formatCredits` as a bare reference — passed as a callback, say — is not
       a conversion. Counting a mention rather than a call is the cheap version
       of this fix and it would excuse every site that merely imported the
       helper. No `toLocaleString` in the fixture on purpose: with one, the
       expression is bare for a second reason and the arm stops isolating this. */
    const sites = creditSitesIn(
      "client/src/features/billing/Fixture.tsx",
      [
        "export const F = ({ balance, show }: { balance: number; show: boolean }) => (",
        "  <p>Need {show ? render(balance, formatCredits) : null} credits</p>",
        ");",
        "",
      ].join("\n"),
    );
    expect(sites.length).toBeGreaterThan(0);
  });
});

describe("#1600 slice 2 — `CR` is the product's own word for credits", () => {
  /*
    ⚠ FOUND BY LOOKING AT THE RUNNING APP, WHICH IS THE ONLY THING THAT COULD
    HAVE FOUND IT. The casting entrance's receipt line is `` {price} CR `` —
    the price of the button beside it. Rule 1 cannot reach it, because `price`
    is deliberately out of the strict vocabulary (`PLAN_TIERS.price` is cents),
    and rule 2's text test was `/credit/i` while the word on screen is two
    letters. So the routing slice rendered a balance of 3,688 beside a roll
    price of 160 — two scales on one screen — with every instrument green.
  */
  it("catches a credit price labelled CR", () => {
    const sites = creditSitesIn(
      "client/src/pages/Fixture.tsx",
      [
        "export const F = ({ price }: { price: number }) => (",
        "  <span><span>~</span>{price} CR</span>",
        ");",
        "",
      ].join("\n"),
    );
    expect(sites.map((site) => site.rule)).toEqual(["beside-the-word"]);
  });

  it("passes the same line once it is routed", () => {
    const sites = creditSitesIn(
      "client/src/pages/Fixture.tsx",
      [
        "export const F = ({ price }: { price: number }) => (",
        "  <span><span>~</span>{formatCredits(displayPrice(price))} CR</span>",
        ");",
        "",
      ].join("\n"),
    );
    expect(sites).toEqual([]);
  });

  it("⚠ does NOT fire on `CREDITS PER $1`, where CR is the start of a longer word", () => {
    /* The word boundary is what keeps the widening narrow, and this is the
       neighbouring line it could plausibly have swept in. It is already routed
       by the rate's own helper, so an indictment here would be a false refusal
       on correct code. */
    expect(/\bCR\b/.test("CREDITS PER $1")).toBe(false);
  });

  it("⚠ is case-SENSITIVE, so ordinary prose containing `cr` is not a credit sentence", () => {
    /* A case-insensitive `\bcr\b` was the obvious form and it would start
       reading any two-letter token in a sentence as this product's currency. */
    expect(/\bCR\b/.test("the cr of it")).toBe(false);
    const sites = creditSitesIn(
      "client/src/pages/Fixture.tsx",
      ["export const F = ({ price }: { price: number }) => <span>{price} cr</span>;", ""].join("\n"),
    );
    expect(sites).toEqual([]);
  });
});

describe("the precision arms — correct code must not be refused", () => {
  it("passes a plan price, which is CENTS and not credits", () => {
    /* `PLAN_TIERS.starter.price` is 2700 — twenty-seven dollars. Indicting it
       would make this guard refuse the billing surface it is meant to protect. */
    const sites = creditSitesIn(
      "client/src/features/billing/Fixture.tsx",
      "export const F = () => <span>{plan.price.toLocaleString()}</span>;\n",
    );
    expect(sites).toEqual([]);
  });

  it("⚠ passes a BARE `price`, which is the live boundary now that a bare `cost` is admitted", () => {
    /* `plan.price` above is the compound shape; this is the bare identifier,
       and it is the one the widening could plausibly have swept in. It stays
       out because `PLAN_TIERS.price` is cents, and it costs nothing to keep
       out: derived over this guard's own population at the repair, of every
       `toLocaleString` receiver mentioning cost or price, ZERO mention a bare
       `price`. If that ever stops being true the answer is to read the sites,
       not to widen the rule. */
    const sites = creditSitesIn(
      "client/src/features/billing/Fixture.tsx",
      "export const F = ({ price }: { price: number }) => <span>{price.toLocaleString()}</span>;\n",
    );
    expect(sites).toEqual([]);
  });

  it("passes a log line that happens to say credits", () => {
    const sites = creditSitesIn(
      "server/stripe/fixture.ts",
      "export const f = () => log.info(`[Webhook] Refreshed credits: ${grantCredits} granted`);\n",
    );
    expect(sites).toEqual([]);
  });

  it("passes a pluralising ternary beside the word credit", () => {
    const sites = creditSitesIn(
      "server/stripe/fixture.ts",
      'export const f = (grantMonths: number) => `credits for ${grantMonths === 1 ? "" : "s"}`;\n',
    );
    expect(sites).toEqual([]);
  });

  it("passes an identifier that is not an amount, however credit-named its object", () => {
    const sites = creditSitesIn(
      "server/stripe/fixture.ts",
      "export const f = (refund: { id: string }) => `Refund ${refund.id} moved no credits`;\n",
    );
    expect(sites).toEqual([]);
  });

  it("passes a staff surface showing ledger units, which is what the card asks of it", () => {
    for (const surface of STAFF_SURFACES) {
      const file = `${surface}${surface.endsWith("/") ? "Fixture.tsx" : "Fixture.tsx"}`;
      const sites = creditSitesIn(file, "export const F = () => <span>{creditsBalance.toLocaleString()} units</span>;\n");
      expect(sites.filter((site) => site.rule !== "scale-arithmetic")).toEqual([]);
    }
  });

  it("passes a division by a number that is not the scale", () => {
    const sites = creditSitesIn("client/src/Fixture.tsx", "export const n = creditsBalance / 3;\n");
    expect(sites).toEqual([]);
  });

  it("passes prose that merely mentions credits with no number in it", () => {
    const sites = creditSitesIn(
      "client/src/features/billing/Fixture.tsx",
      "export const F = ({ name }: { name: string }) => <p>{name} has credits</p>;\n",
    );
    expect(sites).toEqual([]);
  });

  /*
    #1600 SLICE 3 — THE NAME IS READ AS A camelCase TAIL NOW, AND THESE THREE
    ARE WHY. All three sat in the census for two days as rows nobody could ever
    route: an id, a word and a dollar amount, each indicted because the sentence
    around it says "credits" somewhere else. `NOT_AN_AMOUNT` already held every
    word; it was matched EXACTLY, and on a property name only.

    ⚠ The arm that matters is the LAST of the four, not the first three. A rule
    that silences a sentence's non-numbers is only safe if the sentence's real
    credit number still reddens — otherwise the repair for a false positive is a
    false negative, which is the direction that ships a wrong number.
  */
  it("⚠ passes `refundResult.refundId` — a property whose name ENDS in a word that is never an amount", () => {
    const sites = creditSitesIn(
      "server/lib/adminActions/fixture.ts",
      "export const f = (refundResult: { refundId: string }) =>\n"
      + "  `Stripe refund ${refundResult.refundId}: 3 credits deducted.`;\n",
    );
    expect(sites).toEqual([]);
  });

  it("⚠ passes a BARE `refundType` — the same reading applied to an identifier, not only a property", () => {
    const sites = creditSitesIn(
      "server/lib/adminActions/fixture.ts",
      "export const f = (refundType: string) => `A ${refundType} refund moved 3 credits.`;\n",
    );
    expect(sites).toEqual([]);
  });

  it("⚠ passes a figure in CENTS, which is money and not credits", () => {
    const sites = creditSitesIn(
      "server/lib/adminActions/fixture.ts",
      "export const f = (refundAmountCents: number) =>\n"
      + "  `Refund of $${(refundAmountCents / 100).toFixed(2)} issued, 3 credits deducted.`;\n",
    );
    expect(sites).toEqual([]);
  });

  it("⚠ THE ARM THAT GUARDS THE THREE ABOVE — the real sentence's CREDIT number still reddens, and it is the only hole that does", () => {
    /* `changeRequestActions.ts:368`, the sentence those three rows came from:
       four interpolations, of which exactly one is a quantity of credits. */
    const sites = creditSitesIn(
      "server/lib/adminActions/fixture.ts",
      "export const f = (refundAmountCents: number, refundType: string, creditsToDeduct: number, refundResult: { refundId: string }) =>\n"
      + "  `Stripe refund of $${(refundAmountCents / 100).toFixed(2)} issued (${refundType}). "
      + "${creditsToDeduct} credits deducted. Refund ID: ${refundResult.refundId}`;\n",
    );
    expect(sites.map((site) => site.expression)).toEqual(["creditsToDeduct"]);
  });

  it("⚠ THE SLICE-3 FIND — a credit figure called `amount`, in the shared charge wrapper", () => {
    /*
      `atomicCredits.ts`'s `refundTruth`, which `withAtomicCredits` throws for
      boards, mint, the legacy imaging lane and rolls. It quoted the LEDGER
      figure and sat in no census row for as long as this guard has existed,
      because rule 2's vocabulary had `credit`, `balance`, `cost` and `refund`
      and this value is called `amount`. Third instance of one class, after
      `cost` (#1649) and `delta` (#1676).
    */
    const sites = creditSitesIn(
      "server/casting/fixture.ts",
      "export const f = (outcome: { amount: number }) => `${outcome.amount} credits were refunded.`;\n",
    );
    expect(sites.map((site) => site.expression)).toEqual(["outcome.amount"]);
  });

  it("⚠ and the bare identifier too — the refusal `withAtomicCredits` throws", () => {
    const sites = creditSitesIn(
      "server/casting/fixture.ts",
      "export const f = (amount: number) => `Insufficient credits. Need ${amount} credits.`;\n",
    );
    expect(sites.map((site) => site.expression)).toEqual(["amount"]);
  });

  it("⚠ `amount$` IS ANCHORED AT THE END, so a COMPOUND amount is not a credit name", () => {
    /* The anchor is the whole reason the widening is safe: an unanchored
       `amount` would read every `amountDue`, `amountPaid` and `amountCents` in
       the billing tree as credits.

       ⚠ **THIS ARM READ `amountCents` FIRST AND SURVIVED ITS OWN SABOTAGE
       GREEN.** Removing the anchor changed nothing, because the `Cents` clause
       in `cannotBeAnAmount` caught that fixture anyway — so the arm proved the
       clause, not the anchor it is named after. A name NO other clause can reach
       is what makes the anchor load-bearing. Memory
       `surviving-sabotage-may-be-inert`, found on this guard's own arm. */
    const sites = creditSitesIn(
      "server/stripe/fixture.ts",
      "export const f = (amountDue: number) => `${amountDue} credits`;\n",
    );
    expect(sites).toEqual([]);
  });

  it("⚠ and the `Cents` clause is what keeps a cents value out when its NAME says price", () => {
    /* `priceInCents` matches rule 2's vocabulary on `price`, and carries no
       `toFixed`, so neither the anchor nor the decimal rule reaches it. This is
       the arm that makes the `Cents` clause load-bearing rather than a third
       spelling of the other two — without it, sabotage case 6 (drop the clause)
       survives GREEN, which is how the redundancy was found. */
    const sites = creditSitesIn(
      "server/stripe/fixture.ts",
      "export const f = (priceInCents: number) => `${priceInCents} credits`;\n",
    );
    expect(sites).toEqual([]);
  });

  it("⚠ passes a DOLLAR figure in a credit sentence — the ledger is integer-only, so decimals are never credits", () => {
    /* `webhooks.ts:1401`, reachable only once `amount$` was admitted. Two sites
       in the real tree, and they are the measured price of that widening. */
    const sites = creditSitesIn(
      "server/stripe/fixture.ts",
      "export const f = (amount: number, currency: string) =>\n"
      + "  `Credits frozen: chargeback — $${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;\n",
    );
    expect(sites).toEqual([]);
  });

  it("⚠ CONTROL — the decimal rule does not excuse the WHOLE sentence, only the decimal hole", () => {
    const sites = creditSitesIn(
      "server/stripe/fixture.ts",
      "export const f = (amount: number, creditsRestored: number) =>\n"
      + "  `Refund of $${(amount / 100).toFixed(2)} failed. ${creditsRestored.toLocaleString()} credits restored.`;\n",
    );
    expect(sites.map((site) => site.expression)).toEqual(["creditsRestored.toLocaleString()"]);
  });

  it("⚠ CONTROL — a name whose tail merely LOOKS like one of the words is still read, because the match is case-sensitive", () => {
    /* `paid` ends in a lowercase "id"; `Id` is the tail the rule reads. Without
       the case, every `…paid` and `…valid` credit figure would go silent. */
    const sites = creditSitesIn(
      "server/stripe/fixture.ts",
      "export const f = (creditsPaid: number) => `${creditsPaid.toLocaleString()} credits paid`;\n",
    );
    expect(sites.map((site) => site.expression)).toEqual(["creditsPaid.toLocaleString()"]);
  });
});

/*
  #1676 — THE PRECISION ARMS COME FIRST, AND THE CARD ASKED FOR THEM FIRST.

  Its own words: *"a widening that indicts a date or a dollar figure is worse
  than the hole, and those 11 are the ready-made negative controls."* These are
  those eleven as fixtures: every `toLocaleString` call on a customer surface
  the reader must still NOT indict. They are kept as source rather than as a
  count, so a later widening that catches one fails here BY NAME instead of
  quietly moving a number.

  ⚠ THE SECOND BLOCK IS THE ONE THAT MATTERS MOST. The first shape of this
  repair dropped rule 2's name check against the WIDE window, and the real tree
  answered with **74 indicted sites** — `refreshVerb`, `label`, `action`,
  `planName`, `userId`, `invoiceId`, `status`, `failureReason`,
  `currency.toUpperCase()`: every string spliced into a sentence that happens to
  mention credits. The rule that replaced it is one clause away from that one,
  so each of those shapes is an arm.
*/
describe("#1676 — the eleven that are NOT credit numbers stay uncaught", () => {
  const passes = (file: string, source: string) =>
    expect(creditSitesIn(file, source).filter((site) => site.rule !== "scale-arithmetic")).toEqual([]);

  it("a FRAME COUNT in a sentence that also says credits", () => {
    /* AddCreditsModal:362-363 and ChangePlanModal:637 — and the enclosing modal
       is CALLED AddCreditsModal, which is what defeated the first shape of
       rule 4. */
    passes(
      "client/src/features/billing/AddCreditsModal.tsx",
      [
        "export function AddCreditsModal({ framesNext, framesNow }: { framesNext: number; framesNow: number }) {",
        "  return (",
        "    <p>Add more credits. That is about {framesNext.toLocaleString()} casting frames a month,",
        "    up from about {framesNow.toLocaleString()}.</p>",
        "  );",
        "}",
      ].join("\n"),
    );
  });

  it("a DOLLAR figure formatted from cents", () => {
    passes(
      "client/src/features/settings/planMath.ts",
      [
        "export function formatDollars(cents: number): string {",
        "  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;",
        "}",
        "export function formatWholeDollars(cents: number): string {",
        "  return `$${Math.round(cents / 100).toLocaleString('en-US')}`;",
        "}",
      ].join("\n"),
    );
  });

  it("a DATE", () => {
    passes(
      "client/src/foundation/staffDate.ts",
      [
        "export function staffFullDateTime(date: Date | string): string {",
        "  return new Date(date).toLocaleString(STAFF_LOCALE, { year: 'numeric', month: 'short' });",
        "}",
      ].join("\n"),
    );
    passes(
      "client/src/features/boards/components/VersionHistoryModal.tsx",
      [
        "export function when(date: string): string {",
        "  const d = new Date(date);",
        "  return d.toLocaleString(undefined, { month: 'short', day: 'numeric' });",
        "}",
      ].join("\n"),
    );
  });

  it("a CHARACTER COUNT in a refusal sentence", () => {
    passes(
      "server/_core/invalidInputMessage.ts",
      [
        "export function tooBig(issue: { maximum: number }): string {",
        "  return `Please keep it to ${issue.maximum.toLocaleString('en-GB')} characters.`;",
        "}",
      ].join("\n"),
    );
  });
});

describe("#1676 — ⚠ the 74 the first shape indicted, kept as arms", () => {
  const passes = (file: string, source: string) =>
    expect(creditSitesIn(file, source).filter((site) => site.rule !== "scale-arithmetic")).toEqual([]);

  it("a VERB, a LABEL and an ACTION spliced into a credit sentence", () => {
    /* Rule 2 limb B needs the value to be formatted as a NUMBER: a sentence
       says "credits", it does not say which of its holes is the number. */
    passes(
      "client/src/features/casting/components/ImageViewer/ViewTabs.tsx",
      [
        "export const t = (refreshVerb: string, label: string, action: string, n: number) =>",
        "  `${refreshVerb} ${label} · ${action} for ${n} credits`;",
      ].join("\n"),
    );
  });

  it("a plan name, a user id and a failure reason in a credit sentence", () => {
    passes(
      "server/stripe/webhooks.ts",
      [
        "export const m = (planName: string, userId: string, failureReason: string, currency: string) =>",
        "  `${planName} for ${userId}: no credits restored — ${failureReason} (${currency.toUpperCase()})`;",
      ].join("\n"),
    );
  });

  it("a COUNT of things that are not credits, in a credit sentence", () => {
    passes(
      "client/src/features/casting/components/PackageHealthDialog.tsx",
      ["export const m = (actionable: readonly string[]) => `${actionable.length} to redo for credits`;"].join("\n"),
    );
  });

  it("⚠ a component called AddCreditsModal does not name every number inside it", () => {
    /* Rule 4's own boundary, and the measurement that put it there: walking
       every ancestor reached the FUNCTION DECLARATION, whose name says credits
       in this file, and indicted two frame counts. */
    passes(
      "client/src/features/billing/AddCreditsModal.tsx",
      [
        "export function AddCreditsModal({ frames }: { frames: number }) {",
        "  return <p>{frames.toLocaleString()} frames</p>;",
        "}",
      ].join("\n"),
    );
  });
});

describe("#1676 — the positive control for each newly-caught shape", () => {
  const caught = (file: string, source: string) =>
    creditSitesIn(file, source).filter((site) => site.rule !== "scale-arithmetic");

  it("LIMB B — a formatted number in a sentence that says credits, whatever it is named", () => {
    /* `delta`, `reward`, `earned`: three names no vocabulary held, each in a
       sentence that says the word out loud. */
    const sites = caught(
      "client/src/features/billing/Fixture.tsx",
      ["export const a = (delta: number) => `+ ${delta.toLocaleString()} credits a month`;"].join("\n"),
    );
    expect(sites.map((site) => [site.rule, site.expression]))
      .toEqual([["beside-the-word", "delta.toLocaleString()"]]);
  });

  it("LIMB B — the sentence is the OUTERMOST template, so a nested one is not a second sentence", () => {
    /* `ReferralBlock.tsx:88`: `cap` lives in an inner template whose own words
       say nothing about credits, spliced into one that does. */
    const sites = caught(
      "client/src/features/settings/Fixture.tsx",
      [
        "export const a = (reward: number, cap: number) =>",
        "  `They get ${reward.toLocaleString()} credits${cap > 0 ? ` — up to ${cap.toLocaleString()} in total` : ''}.`;",
      ].join("\n"),
    );
    expect(sites.map((site) => site.expression).sort())
      .toEqual(["cap.toLocaleString()", "reward.toLocaleString()"]);
  });

  it("RULE 4 — the name the value is GIVEN, when nothing about the value says it", () => {
    const byFunction = caught(
      "client/src/features/settings/planMath.ts",
      [
        "export function formatCreditsPerDollar(perDollar: number): string {",
        "  return Math.round(perDollar).toLocaleString('en-US');",
        "}",
      ].join("\n"),
    );
    expect(byFunction.map((site) => site.rule)).toEqual(["named-on-the-way-out"]);

    /* The `const` limb. `spend.spent` now also trips rule 1's `spent$`, which is
       the stronger signal and wins the tie — so this arm proves the const limb
       on a receiver rule 1 cannot see. */
    const byConst = caught(
      "client/src/features/settings/Fixture.tsx",
      [
        "export const f = (usage: { used: number }) => {",
        "  const creditsUsed = usage.used.toLocaleString();",
        "  return creditsUsed;",
        "};",
      ].join("\n"),
    );
    expect(byConst.map((site) => site.rule)).toEqual(["named-on-the-way-out"]);
  });

  it("RULE 1 — `spent$`, the one word added, where the sentence says nothing", () => {
    /* `AddCreditsModal:227` — "{spent} of {total} spent with 4 days left in this
       cycle". No window widening reaches it; the name does. */
    const sites = caught(
      "client/src/features/billing/Fixture.tsx",
      [
        "export const a = (cycle: { spent: number; remaining: number }) => (",
        "  <p>{cycle.spent.toLocaleString()} of {(cycle.spent + cycle.remaining).toLocaleString()} spent this cycle</p>",
        ");",
      ].join("\n"),
    );
    expect(sites.map((site) => site.rule)).toEqual(["formatted", "formatted"]);
  });

  it("⚠ CONTROL — `remaining` alone is NOT in the vocabulary, and that is on purpose", () => {
    /* Every real site mentioning it also mentions `spent`, so carrying the word
       would be carrying it for no measured site — the practice this card is
       about, one word smaller. */
    expect(caught(
      "client/src/features/billing/Fixture.tsx",
      ["export const a = (cycle: { remaining: number }) => <p>{cycle.remaining.toLocaleString()} left</p>;"].join("\n"),
    )).toEqual([]);
  });
});

describe("the census is held to its contract", () => {
  it("only shrinks — in occurrences, which is the thing that measures the work", () => {
    expect(censusedOccurrences).toBeLessThanOrEqual(OCCURRENCES_CEILING);
  });

  /* The ratchet's other half, and without it the ceiling is decoration: a
     slice that lands work and leaves the number above it has bought the
     product nothing the next slice can measure from. Equality is the only
     honest state at rest — the census IS the budget. */
  it("⚠ holds NOTHING still to route — the routing is finished, and that is a checkable fact", () => {
    /*
      THE CARD'S OWN DONE-WHEN 1, AS AN ASSERTION RATHER THAN A HEADER.
      Until slice 3 the list meant "still to route" by convention, and the five
      client rows that were never work had their reasons in prose. A reason in
      the DATA lets the suite say the difference out loud: a `stays: null` row is
      outstanding work, and there are none.
    */
    const stillToRoute = UNROUTED.filter((row) => row.stays === null);
    expect(stillToRoute.map((row) => `${row.file} ${row.expression}`)).toEqual([]);
  });

  it("⚠ holds every row to a REASON, so a row can never be parked silently", () => {
    /*
      The failure this refuses is the one the census was built against: a site
      nobody wants to route, added as a row, and the list reading as progress.
      A reason is prose and cannot be checked for truth — what CAN be checked is
      that somebody wrote one, and the stale-row arm below checks the site is
      still really there.
    */
    const unexplained = UNROUTED.filter(
      (row) => row.stays !== null && row.stays.trim().length < 20,
    );
    expect(unexplained.map((row) => `${row.file} ${row.expression}`)).toEqual([]);
  });

  it("⚠ keeps the ceiling AT the census, so a landed slice cannot leave slack behind", () => {
    expect(censusedOccurrences).toBe(OCCURRENCES_CEILING);
  });

  it("holds no duplicate key, and every count is a positive integer", () => {
    const keys = UNROUTED.map((row) => censusKey(row));
    expect(new Set(keys).size).toBe(keys.length);
    const bad = UNROUTED.filter((row) => !Number.isInteger(row.count) || row.count < 1);
    expect(bad).toEqual([]);
  });

  it("⚠ holds no STALE row — each row's count must equal what the reader really finds", () => {
    /* The arm that stops the list rotting. A row whose site was routed, moved
       or deleted goes on excusing something, and the shrink still reads clean
       because nothing ever checks the rows against the tree (working law 4).
       Counting both ways matters: a row budgeted for 3 against 2 real sites
       has a spare excuse in it, and a spare excuse is how the next unrouted
       site ships green. The OTHER direction — more real sites than budget —
       is the negative control's job, and is reported there as a site. */
    const byFile = new Map<string, (typeof UNROUTED)[number][]>();
    for (const row of UNROUTED) {
      const held = byFile.get(row.file) ?? [];
      held.push(row);
      byFile.set(row.file, held);
    }

    const stale: string[] = [];
    for (const [file, rows] of Array.from(byFile)) {
      const source = readListedSource(join(repoRoot, file));
      if (source === null) {
        stale.push(`${file} — the file is gone`);
        continue;
      }
      const found = creditSitesIn(file, source);
      for (const row of rows) {
        const real = found.filter(
          (site) => site.rule === row.rule && site.expression === row.expression,
        ).length;
        if (real < row.count) {
          stale.push(`${file} [${row.rule}] ${row.expression} — budgeted ${row.count}, found ${real}`);
        }
      }
    }
    expect(stale).toEqual([]);
  });

  it("names only files the guard actually walks", () => {
    const walked = new Set(creditDisplayPopulation(repoRoot));
    const orphans = UNROUTED.map((row) => row.file).filter((file) => !walked.has(file));
    expect(Array.from(new Set(orphans))).toEqual([]);
  });
});
