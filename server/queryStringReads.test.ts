/**
 * A PAGE READS ITS QUERY STRING WITH THE HOOK THAT CARRIES ONE (#1709).
 *
 * # The defect this exists to make impossible
 *
 * `client/src/pages/Login.tsx` read the query string as
 * `useLocation().split("?")[1]`. In wouter 3 `useLocation` returns the
 * **pathname only** — the query string is `useSearch`'s job. So the expression
 * was always `undefined`, `errorType` was always `null`, and the page's entire
 * `ERROR_MESSAGES` map was unreachable code.
 *
 * **Eleven refusal codes went to a page that showed nothing.** `suspended`,
 * `locked`, `not_approved`, `no_code`, `invalid_code`, `code_redeem_failed`,
 * `disposable_email`, `google_denied`, `google_error`, `invalid_callback`,
 * `create_failed` — each written by a real refusal in `routes/googleAuth.ts` or
 * `routes/emailAuth.ts`, each landing a customer on an ordinary sign-in page
 * with no explanation. Its twin in `VerifyEmail.tsx` read the address the same
 * way, so the Resend button did nothing for anybody arriving the way register
 * sends them.
 *
 * # Why this is a source read, and what that costs
 *
 * ⚠ **Said plainly: this is the weaker of the two guards it could be, and the
 * stronger one is not available.** The honest test is to RENDER the page with a
 * code in the query and assert the note appears — and this repository has no
 * React render harness at all (no `@testing-library/*` in `package.json`), so
 * writing one means introducing a test dependency, which is a decision for
 * somebody other than the card that tripped over this.
 *
 * So what is held here is the CLASS rather than the behaviour: no page reads a
 * query string out of `useLocation`. It would not catch a page that read the
 * query correctly and then ignored it. It would have caught this defect, and it
 * catches the next copy of it, which is what working law 7 asks for.
 *
 * The population is DERIVED by walking `client/src`, not listed — a named list
 * of two files is a list that goes stale the moment a third page is written,
 * and the whole defect is one nobody noticed for as long as it existed.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { readListedSource } from "./testing/listedSource";

const CLIENT_SRC = join(__dirname, "..", "client", "src");

/**
 * Comments out, so the guard reads CODE and never prose.
 *
 * ⚠ NOT A TIDY-UP — the first run of this file reddened on `Login.tsx`, whose
 * own docblock QUOTES the defect it fixes in order to explain it. A guard that
 * cannot tell a line of code from a sentence about that line punishes the one
 * thing worth having, which is a comment saying why. The same lesson is already
 * written into `scripts/lib/ceremonyAutoApply.mts` ("Stripping them before
 * classification is not cosmetic: the classifier reads verbs") and into
 * `client/src/foundation/token-guard.test.ts`.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

/** Every `.ts`/`.tsx` under `client/src`, tests included. */
function clientSources(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path, { throwIfNoEntry: false });
    if (!stat) continue;
    if (stat.isDirectory()) { found.push(...clientSources(path)); continue; }
    if (/\.tsx?$/.test(entry)) found.push(path);
  }
  return found;
}

describe("no page reads its query string out of a hook that does not carry one", () => {
  const files = clientSources(CLIENT_SRC);

  it("found a client tree to read — an empty walk would pass this file by proving nothing", () => {
    /* The floor arm. A guard whose population can silently become zero reports
       "clean" for the rest of its life (invariant 7's shape pointed at a
       checker). 100 is far below the real count and far above an accident. */
    expect(files.length).toBeGreaterThan(100);
  });

  it("nothing splits a wouter location on a question mark", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readListedSource(file);
      if (source === null) continue;
      /* The exact shape of the defect: a `?` split used to recover a query
         string. `useSearch()` is the hook that carries one, and
         `window.location.search` is correct where no hook is in scope
         (`useReferralClaim.ts` reads it that way). */
      if (/\blocation\s*\.\s*split\s*\(\s*["'`]\?["'`]\s*\)/.test(withoutComments(source))) {
        offenders.push(file.slice(CLIENT_SRC.length + 1).replace(/\\/g, "/"));
      }
    }
    expect(offenders, "wouter 3's `useLocation` carries no query string — use `useSearch()`").toEqual([]);
  });

  it("the two pages the defect was found on read `useSearch`", () => {
    /* The positive control on the arm above: a rule that only ever says "no
       offenders" cannot tell a clean tree from a reader that stopped working.
       These two are named because they are the measured instances. */
    for (const page of ["Login.tsx", "VerifyEmail.tsx"]) {
      const source = readListedSource(join(CLIENT_SRC, "pages", page));
      expect(source, `${page} must be readable`).not.toBeNull();
      expect(source!, `${page} must read its query string with useSearch()`).toContain("useSearch()");
    }
  });
});
