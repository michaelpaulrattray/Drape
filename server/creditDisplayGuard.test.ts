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
import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();

/**
 * The census as it stood when this guard landed: 79 distinct shapes covering
 * 106 real occurrences. `UNROUTED` may fall to zero and may never rise — a
 * routing PR decrements or deletes rows, and a NEW unrouted site is a defect
 * rather than a row to add.
 */
const OCCURRENCES_AT_LANDING = 106;

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
});

describe("the census is held to its contract", () => {
  it("only shrinks — in occurrences, which is the thing that measures the work", () => {
    expect(censusedOccurrences).toBeLessThanOrEqual(OCCURRENCES_AT_LANDING);
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
