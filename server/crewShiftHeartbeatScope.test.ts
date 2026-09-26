/**
 * A SEAT'S HEARTBEAT STAMPS ITS OWN ROW (#1281, and it is #1234's defect one
 * script over).
 *
 * `crew-shift-close.mts` stopped guessing whose row to close on 2026-09-25.
 * `crew-shift-start.mts --note` — the heartbeat — kept the same guess, with a
 * comment arguing FOR it: *"a shift that has to remember its own row id will
 * eventually stamp somebody else's"*. That was true while exactly one seat ran.
 *
 * ⚠ **With N seats in one pass it inverts.** Every seat's check-in lands on the
 * newest open row, so seats 1…N-1 stop checking in, `heartbeatAt` goes quiet on
 * them, and `looksLive` / the stall reading call a working seat dead on his
 * Working-now table — while the newest row collects everybody's notes. That is
 * #288's incident (his page saying the wrong thing about a running shift) with a
 * different cause, and #1281 makes it certain rather than possible.
 *
 * # WHY THIS IS A SOURCE READING, AND HOW IT IS KEPT HONEST
 *
 * The write itself needs `crew_shift_runs`, and `vitest.setup.ts` strips
 * `DATABASE_URL` precisely so a unit suite can never reach a live database. So
 * this suite reads the statement, and — working law 2 — **every arm has a
 * POSITIVE CONTROL that doctors the source back to the old statement and
 * asserts the reader reddens.** A source reader with no control is the thing it
 * is guarding against.
 */
import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

const SOURCE = readFileSync("scripts/crew-shift-start.mts", "utf8");

/** Strips block and line comments, so a rule quoted in prose cannot pass as code. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** The heartbeat's UPDATE statement, as the file actually holds it. */
function heartbeatUpdate(source: string): string {
  const code = stripComments(source);
  const at = code.indexOf("SET heartbeatAt = UTC_TIMESTAMP()");
  expect(at, "the heartbeat's UPDATE could not be found at all").toBeGreaterThan(-1);
  /* To the end of the template literal that holds it. */
  const end = code.indexOf("`", at);
  return code.slice(Math.max(0, code.lastIndexOf("UPDATE", at)), end);
}

describe("the heartbeat's own row", () => {
  const update = heartbeatUpdate(SOURCE);

  it("writes to one row BY ID, with the scope in the writing statement", () => {
    /* Invariant 1: a SELECT to find the row followed by a write keyed on
       something looser is the check-then-write shape this repository has been
       bitten by. The id, the open-ness and the shift id are all in the WHERE. */
    expect(update).toMatch(/WHERE\s+id\s*=\s*\?/i);
    expect(update).toMatch(/endedAt IS NULL/i);
    expect(update).toMatch(/shift\s*=\s*\?/i);
  });

  it("no longer stamps whichever row happens to be newest", () => {
    expect(update).not.toMatch(/ORDER BY/i);
    expect(update).not.toMatch(/LIMIT/i);
  });

  it("CALLS the same resolver the close calls, rather than importing it", () => {
    /* ⚠ `toContain("resolveCloseTarget")` was satisfied by the IMPORT LINE alone
       (review of 2026-09-26): the symbol could be imported and never called and
       this arm stayed green. An import is not a call site — the repository has a
       whole paragraph in CLAUDE.md about that mistake. */
    const code = stripComments(SOURCE);
    expect(/const verdict = resolveCloseTarget\(\{/.test(code), "the heartbeat must CALL the resolver").toBe(true);
    expect(/openRuns: openRows\.map\(/.test(code), "and hand it every open run, not one").toBe(true);
    expect(/shift: named/.test(code), "and the shift id it was given").toBe(true);
  });

  it("POSITIVE CONTROL — the old statement reddens every arm above", () => {
    const doctored = SOURCE.replace(
      /WHERE id = \?\n\s*AND endedAt IS NULL\n\s*AND \(\? IS NULL OR shift = \?\)/,
      "WHERE endedAt IS NULL\n        ORDER BY id DESC\n        LIMIT 1",
    );
    expect(doctored, "the doctoring did not apply — the anchor moved").not.toBe(SOURCE);
    const old = heartbeatUpdate(doctored);
    expect(old).not.toMatch(/WHERE\s+id\s*=\s*\?/i);
    expect(old).toMatch(/ORDER BY/i);
    expect(old).toMatch(/LIMIT/i);
  });

  it("NEGATIVE CONTROL — the reader finds a statement at all, so a pass means something", () => {
    expect(update.length).toBeGreaterThan(40);
    expect(update).toMatch(/^UPDATE/i);
  });
});
