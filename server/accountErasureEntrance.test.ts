/**
 * THERE IS ONE ERASURE ENTRANCE — #1962, and this is the absence test that
 * stops the second one coming back quietly.
 *
 * ## What was retired, and why retired rather than repaired
 *
 * `account.deleteAccount` ran the same `deleteUserData` as `auth.deleteAccount`,
 * had no caller in the app, and carried a rate limit that enforced nothing — it
 * called `checkRateLimit` and dropped the verdict, where that function returns
 * `{ allowed }` and never throws (invariants 6 and 7). Its input schema was also
 * not `.strict()` (invariant 4).
 *
 * The card's own preference was to retire it, and it is the right one: one
 * erasure entrance is the one that carries #1954/#1960's in-flight-render
 * refusal, and a second is a second place to keep every future rule about
 * erasure. The surviving entrance is also the better of the two — it clears the
 * session cookie, which the retired one never did.
 *
 * ## Why an absence test at all
 *
 * The repository's own precedent, in CLAUDE.md's access-control grid: the
 * deleted public Cast registry has *"absence tests [that] prevent it from being
 * silently restored"*. A deletion with nothing holding it open is a deletion
 * somebody re-adds in six months while fixing something else, and this is a
 * money/privacy surface where a second entrance means a second set of rules to
 * keep in step.
 *
 * ⚠ **THE ARMS READ THE RUNNING ROUTER, NOT THE SOURCE.** A text search for
 * `deleteAccount` in `routes/account.ts` would be satisfied by this file's own
 * prose moving, and would miss the procedure being restored under another name
 * in another module and spread into the same namespace. The procedure table of
 * the composed router is the artifact (working law 1).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { accountRouter } from "./routes/account";
import { authRouter } from "./routes/auth";
import { withoutComments } from "./testing/withoutComments";

const HERE = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function procedureNames(router: unknown): string[] {
  return Object.keys((router as { _def: { procedures: Record<string, unknown> } })._def.procedures);
}

describe("#1962 — exactly one procedure erases an account", () => {
  it("the account namespace offers the export and nothing else", () => {
    expect(procedureNames(accountRouter).sort()).toEqual(["exportData"]);
  });

  it("⚠ `account.deleteAccount` is gone and does not come back", () => {
    expect(
      procedureNames(accountRouter),
      "a second erasure entrance is a second place to keep every rule about erasure —"
        + " #1954's in-flight-render refusal lives on `auth.deleteAccount`, and this one"
        + " would not have it",
    ).not.toContain("deleteAccount");
  });

  it("the surviving entrance is `auth.deleteAccount`, so the retirement removed a twin and not the feature", () => {
    /* The POSITIVE control, and it is the arm that matters: an absence test
       whose subject was deleted outright would pass just as happily with the
       whole capability gone. */
    expect(procedureNames(authRouter)).toContain("deleteAccount");
  });

  it("⚠ it is the entrance that clears the session cookie, and reads its own rate limit", () => {
    /*
      The two behavioural differences between the twins, named so the
      retirement cannot read as arbitrary — and read at the SURVIVOR's own
      procedure body rather than at the file, because a whole-file `toContain`
      is satisfied by `auth.logout` three procedures up, which also clears the
      cookie (the memory's `guard-arm-satisfied-by-a-sibling` class).

      The retired procedure left the browser holding a session for a user row
      that no longer existed. `verifySession` rejects a session whose user is
      missing, so what the customer met was a silent failure rather than a
      sign-out.
    */
    const source = withoutComments(readFileSync(join(HERE, "routes", "auth.ts"), "utf8"));
    const start = source.indexOf("deleteAccount:");
    expect(start, "`auth.deleteAccount` is not declared there any more").toBeGreaterThan(-1);
    const body = source.slice(start);

    expect(body, "the surviving entrance no longer clears the session cookie").toContain("clearCookie");
    expect(body, "the surviving entrance no longer refuses a second attempt").toContain("TOO_MANY_REQUESTS");
  });
});
