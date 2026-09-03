/**
 * #401 — the toolKind column: a credit charge records WHAT it made.
 *
 * The founder's taxonomy is output-kind ("was an image generated? its filed
 * as image or video? its video or LLM its LLM or Text … but it can grow").
 * The enforcement is the TYPE SYSTEM: `deductCredits` requires a
 * CreditDeductionAttribution, so a new charge site cannot compile without its
 * author stating what the charge made — that is what keeps toolKind from
 * rotting the way engineUsed did (null on 53% of real spend, #387).
 *
 * Test files are excluded from `pnpm check` (root tsconfig excludes
 * `**\/*.test.ts`), so a @ts-expect-error arm here would never be read. These
 * arms therefore pin the SOURCE: the requirement lives in the signature, and
 * this suite reddens if someone makes it optional again. The row-level proof
 * (a charge persists "image", the revoke persists NULL) is the disposable-DB
 * arm in r7-credit-ledger-db.test.ts.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CREDITS = "server/db/credits.ts";

describe("deductCredits requires attribution (#401)", () => {
  it("the attribution parameter is REQUIRED — not optional, not defaulted", async () => {
    const source = await readFile(CREDITS, "utf8");
    // The exact declared shape: a required parameter after referenceId.
    expect(source).toMatch(
      /referenceId: string \| undefined,\s*\n\s*attribution: CreditDeductionAttribution\s*\n\s*\): Promise<CreditWriteResult>/,
    );
    // Neither loosening survives: no `attribution?:` and no `= {` default.
    expect(source).not.toMatch(/attribution\?\s*:/);
    expect(source).not.toMatch(/attribution\s*:\s*CreditDeductionAttribution\s*=/);
  });

  it("positive control: the arm can fail — a loosened signature is caught", () => {
    const loosened = "referenceId: string | undefined,\n  attribution?: CreditDeductionAttribution\n): Promise<CreditWriteResult>";
    expect(loosened).toMatch(/attribution\?\s*:/);
    expect(loosened).not.toMatch(
      /referenceId: string \| undefined,\s*\n\s*attribution: CreditDeductionAttribution\s*\n\s*\): Promise<CreditWriteResult>/,
    );
  });

  it("the ledger insert writes the attribution through to the row — the wire, not a constant near it", async () => {
    const source = await readFile(CREDITS, "utf8");
    expect(source).toMatch(/engineUsed: attribution\.engineUsed \|\| null,\s*\n\s*toolKind: attribution\.toolKind,/);
  });

  it("the documented value set exists and holds the founder's kinds", async () => {
    const source = await readFile(CREDITS, "utf8");
    expect(source).toMatch(/export type CreditToolKind = "image" \| "video" \| "text";/);
  });

  it("withAtomicCredits requires a NON-NULL toolKind — everything through it is a tool charge", async () => {
    const source = await readFile("server/casting/atomicCredits.ts", "utf8");
    expect(source).toMatch(/toolKind: CreditToolKind;/);
    expect(source).not.toMatch(/toolKind\?\s*:/);
    expect(source).toMatch(/\{ toolKind, engineUsed \}/); // forwarded into deductCredits
  });

  it("the schema declares the column on point_transactions", async () => {
    const source = await readFile("drizzle/schema.ts", "utf8");
    expect(source).toMatch(/toolKind: varchar\("toolKind", \{ length: 16 \}\),/);
  });
});

describe("toolKind: null is an ENUMERATED decision, not a default (#401)", () => {
  /**
   * Null means "not a tool charge" — the chargeback revoke is the one live
   * case. A second `toolKind: null` in production code is a new decision and
   * must be added here deliberately, with its reason, the way a new public
   * endpoint is. (The population is derived from the code, not transcribed:
   * a prose list with no arm deriving it is how a list stops being the list.)
   */
  const EXPECTED_NULL_SITES = ["server/stripe/webhooks.ts"];

  async function collectServerFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        files.push(...(await collectServerFiles(full)));
      } else if (
        entry.name.endsWith(".ts")
        && !entry.name.endsWith(".test.ts")
        && !entry.name.endsWith(".integration.test.ts")
      ) {
        files.push(full);
      }
    }
    return files;
  }

  function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  }

  it("exactly one production file passes toolKind: null, and it is the revoke", async () => {
    const files = await collectServerFiles("server");
    // The scanner itself is proven able to see: it must find the credits
    // module and the webhook module before its verdict counts for anything.
    expect(files.some((f) => f.replace(/\\/g, "/") === CREDITS)).toBe(true);

    const nullSites: string[] = [];
    for (const file of files) {
      const source = stripComments(await readFile(file, "utf8"));
      if (/toolKind:\s*null\b/.test(source)) {
        nullSites.push(file.replace(/\\/g, "/"));
      }
    }
    expect(nullSites.sort()).toEqual(EXPECTED_NULL_SITES);
  });

  it("positive control: the null scanner matches the shape it hunts", () => {
    expect(/toolKind:\s*null\b/.test(stripComments("await deduct(1, 2, 'refund', 'x', ref, { toolKind: null })"))).toBe(true);
    // And comments do not count — prose about null is not a decision.
    expect(/toolKind:\s*null\b/.test(stripComments("// toolKind: null is documented here"))).toBe(false);
  });
});
