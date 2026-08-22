/**
 * INVARIANT 9's LIST — WHICH WAS CALLED ENUMERATED AND WAS NOT WRITTEN DOWN.
 *
 * CLAUDE.md, access-control invariant 9:
 *
 *   "Every route that mints a session cookie enforces the same gates as login.
 *    `/api/auth/verify-email` issuing sessions without the approval check (M8)
 *    is the counterexample. **A new issuance site is an enumerated decision,
 *    like a new public endpoint.**"
 *
 * The public-endpoint list it compares itself to is written out, name by name,
 * and is now checked from two directions. Invariant 9's list was **neither
 * written nor counted**: nothing in the tree named the issuance sites, no test
 * mentioned them, and a new `res.cookie(COOKIE_NAME, …)` in a new module would
 * have shipped with a green suite. That is the same failure as the Express and
 * flag lists, on the invariant whose own paragraph records that one issuance
 * site already slipped the gates — M8, and it is still there.
 *
 * The population is DERIVED from the code and the document is read as the other
 * side, so neither can move alone (working law 4):
 *
 *   the code       every `res.cookie(COOKIE_NAME, …)` under `server/`
 *   the document   the count word and the module names in invariant 9
 *
 * ⚠ WHY THE MINT AND NOT THE HELPER. There is no `setSessionCookie()` to count
 * call sites of — `getSessionCookieOptions` is shared, but every site writes the
 * cookie itself. So the thing counted is the write, which is the act the
 * invariant is about: `clearCookie` on the same constant is a LOGOUT and must
 * not be counted, and there are two of those in `routes/auth.ts`. That is a
 * negative control below rather than a hope.
 *
 * WHAT THIS ARM DOES NOT DO, said plainly: it does not check that each site
 * applies the right gates. It checks that the LIST is the list — that a sixth
 * site cannot arrive unnamed. What each of the five does at the mint was read
 * at the code on 2026-08-23 and written into invariant 9 in the same commit; a
 * gate moving inside a site that is already on the list is not something this
 * file can see, and saying so is cheaper than the reader assuming otherwise.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const COUNT_WORDS: Record<string, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6,
  SEVEN: 7, EIGHT: 8, NINE: 9, TEN: 10,
};

/** Every session-cookie WRITE in the server tree, as `module` → count. */
function sessionIssuanceSites(): Record<string, number> {
  const sites: Record<string, number> = {};
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
      const hits = [...readFileSync(full, "utf8").matchAll(/\bres\.cookie\(\s*COOKIE_NAME\b/g)];
      if (hits.length > 0) sites[path.basename(entry, ".ts")] = hits.length;
    }
  };
  walk(path.join(repoRoot, "server"));
  return sites;
}

function invariantNine(): string {
  const claude = readFileSync(path.join(repoRoot, "CLAUDE.md"), "utf8");
  const paragraph = /^9\. \*\*Every route that mints a session cookie.*$/m.exec(claude);
  if (!paragraph) {
    throw new Error(
      "CLAUDE.md's invariant 9 has been renumbered or reworded — re-point this arm at it rather than deleting it",
    );
  }
  return paragraph[0];
}

describe("the session-issuance sites, derived", () => {
  const sites = sessionIssuanceSites();
  const total = Object.values(sites).reduce((sum, n) => sum + n, 0);

  it("finds the mints and NOT the logouts", () => {
    /*
      NEGATIVE CONTROL, and it is a real one rather than a fixture:
      `routes/auth.ts` calls `clearCookie(COOKIE_NAME, …)` twice, on logout and
      on a session whose user has vanished. Counting those would inflate the
      list by two and make the document's number wrong in the direction that
      looks like extra caution.
    */
    expect(Object.keys(sites).sort()).toEqual(["emailAuth", "emailVerification", "googleAuth"]);
    expect(sites).toEqual({ emailAuth: 2, emailVerification: 1, googleAuth: 2 });
    expect(readFileSync(path.join(repoRoot, "server/routes/auth.ts"), "utf8"))
      .toContain("clearCookie(COOKIE_NAME");
  });

  it("⚠ every module that mints a session is named in invariant 9", () => {
    /*
      The tripwire. A new file that writes the session cookie — a second OAuth
      provider, a magic-link route, an impersonation tool — reddens here with
      its own name, because the document cannot name a module that did not
      exist when it was written.
    */
    const paragraph = invariantNine();

    /* The paragraph must be the real one before any `toContain` means
       anything: an empty match fails them all for the wrong reason, and an
       over-wide one passes them all for a worse one. */
    expect(paragraph.length).toBeGreaterThan(400);
    expect(paragraph).toContain("/api/auth/verify-email");

    expect(Object.keys(sites).length).toBeGreaterThan(2);
    for (const module of Object.keys(sites)) {
      expect(
        paragraph.includes(`${module}.ts`),
        `${module}.ts writes the session cookie and invariant 9 does not name it — "a new issuance site is an enumerated decision", so either it should not mint one or the sentence has not been updated`,
      ).toBe(true);
    }
  });

  it("⚠ and the COUNT the sentence states is tied to the same population", () => {
    /*
      The names and the number drift independently — the Express half of
      invariant 5 proved it, where a repair added the missing names and left the
      number unanswerable, and the list went stale a second time. A SIXTH mint
      inside a module already named here would pass the arm above and fails this
      one.
    */
    const stated = /there are (\w+), in \w+ modules/.exec(invariantNine());
    expect(stated, "invariant 9 no longer states how many issuance sites there are").not.toBeNull();
    expect(
      COUNT_WORDS[stated![1]!],
      `invariant 9 states a different number of session-issuance sites than the code has (${total} found: ${JSON.stringify(sites)})`,
    ).toBe(total);
  });

  it("CONTROL — a mint in an unnamed module is caught", () => {
    /*
      The arms above pass today, so on their own they say only that nothing is
      wrong right now. This drives the defect: the document is asked about a
      module that does not exist, which is what a new issuance site looks like
      from here the moment before somebody writes it down.
    */
    const paragraph = invariantNine();
    expect(paragraph.includes("magicLink.ts")).toBe(false);
    expect(paragraph.includes("emailVerification.ts")).toBe(true);
  });
});
