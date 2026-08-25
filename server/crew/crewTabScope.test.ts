/**
 * THE CREW TAB'S DOOR — grammar, parity, and the per-user answer (issue #41,
 * design `docs/specs/CREW_TAB_DESIGN.md` §5).
 *
 * `crewTabScope.ts` COPIES the house scope grammar rather than importing it,
 * on the stated ground that an admin page's door should not depend on a paid
 * road's file — and its own docblock names the cost: *two parsers must agree,
 * and `crewTabScope.test.ts` drives the identical value table against both.*
 * This is that table. Every row below is parsed by BOTH modules, so a dialect
 * split — `users: 1` with a space accepted by one and refused by the other, a
 * duplicate id tolerated on one side — reddens here rather than surprising an
 * operator setting a variable by hand at 2am.
 */
import { describe, expect, it } from "vitest";

import { parseCastingV2Scope } from "../castingV2/castingV2Scope";
import {
  CREW_TAB_SCOPE_ENV,
  crewTabEnabledForUser,
  parseCrewTabScope,
} from "./crewTabScope";

/** Every value both parsers must agree on, with the verdict they must share. */
const VALUE_TABLE: Array<{ raw: string | undefined; verdict: "off" | "all" | "users" | "refuse" }> = [
  { raw: undefined, verdict: "off" },
  { raw: "", verdict: "off" },
  { raw: "off", verdict: "off" },
  { raw: "all", verdict: "all" },
  { raw: "users:1", verdict: "users" },
  { raw: "users:1,2,17", verdict: "users" },
  // The refusals, each a plausible operator typo:
  { raw: "on", verdict: "refuse" },
  { raw: "ALL", verdict: "refuse" },
  { raw: "users:", verdict: "refuse" },
  { raw: "users: 1", verdict: "refuse" },
  { raw: "users:1,", verdict: "refuse" },
  { raw: "users:0", verdict: "refuse" },
  { raw: "users:-1", verdict: "refuse" },
  { raw: "users:1,1", verdict: "refuse" },
  { raw: "users:1;2", verdict: "refuse" },
  { raw: "user:1", verdict: "refuse" },
];

function verdictOf(parse: (raw: string | undefined) => { kind: string }, raw: string | undefined): string {
  try {
    return parse(raw).kind;
  } catch {
    return "refuse";
  }
}

describe("the crew tab scope grammar", () => {
  it("⚠ PARITY — both parsers give the same verdict on every value in the table", () => {
    for (const row of VALUE_TABLE) {
      const crew = verdictOf(parseCrewTabScope, row.raw);
      const casting = verdictOf(parseCastingV2Scope, row.raw);
      expect(
        crew,
        `the two scope dialects disagree on ${JSON.stringify(row.raw)} — the copy has drifted from the house grammar`,
      ).toBe(casting);
      expect(crew, `unexpected verdict for ${JSON.stringify(row.raw)}`).toBe(row.verdict);
    }
    /* POSITIVE CONTROL on the table itself: it holds accepts AND refusals, so
       a parser that threw on everything (or nothing) could not pass. */
    expect(VALUE_TABLE.some((row) => row.verdict === "refuse")).toBe(true);
    expect(VALUE_TABLE.some((row) => row.verdict === "users")).toBe(true);
  });

  it("sorts and keeps the member list", () => {
    const scope = parseCrewTabScope("users:17,2,1");
    expect(scope).toEqual({ kind: "users", userIds: [1, 2, 17] });
  });

  it("answers per user: named ids are in, everyone else is out", () => {
    const scope = parseCrewTabScope("users:1,17");
    expect(crewTabEnabledForUser(scope, 1)).toBe(true);
    expect(crewTabEnabledForUser(scope, 17)).toBe(true);
    expect(crewTabEnabledForUser(scope, 2)).toBe(false);
    expect(crewTabEnabledForUser(parseCrewTabScope("all"), 2)).toBe(true);
    expect(crewTabEnabledForUser(parseCrewTabScope(undefined), 1)).toBe(false);
  });

  it("refuses a nonsense user id rather than answering about nobody", () => {
    expect(() => crewTabEnabledForUser(parseCrewTabScope("all"), 0)).toThrow();
    expect(() => crewTabEnabledForUser(parseCrewTabScope("all"), 1.5)).toThrow();
  });

  it("the exported env name is the one the enumeration guard counts", () => {
    /* The `*_ENV` constant pattern is what puts this flag into
       `claudeMdFlagEnumeration`'s population — a rename breaks that silently,
       so the name is pinned where the scope is tested. */
    expect(CREW_TAB_SCOPE_ENV).toBe("CREW_TAB_SCOPE");
  });
});
