/**
 * appRoutes — pins the entrances App.tsx must keep answering, and the one it
 * must NOT.
 *
 * #68: the founder typed /admin from the lobby and met a 404, because every
 * admin page lives one segment deeper and the bare address had no route.
 * The redirect is the fix; this suite is what stops a route reshuffle from
 * silently reopening that dead end.
 *
 * #261: `/casting/foundation` — the component specimen sheet, a house-only page
 * showing invented prices and a fake transcript of a night shift — rendered for
 * anyone, signed out included, at a public address inside the customer's own
 * product namespace. There is no route-level guard in `App.tsx`; every page owns
 * its gate, and that page consulted nothing at all. The founder ruled the
 * address rather than a gate ("A component specimen has no business inside the
 * /casting namespace at all" … "it should be admin"), so the arms below assert
 * BOTH halves: the old address is gone, and the page that took the new one
 * actually refuses.
 *
 * Reads are newline-normalized on purpose: these assertions are about tokens
 * on one line, and a CRLF working copy (issue #71) must not fail them.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PAGES_DIR = resolve(__dirname, "pages");

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

const appSource = read(resolve(__dirname, "App.tsx"));

/** Comments quote the rule; matching on them would pass on the promise. */
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");

describe("App routes — the admin entrance (#68)", () => {
  it("routes the bare /admin address", () => {
    expect(appSource).toContain('<Route path="/admin">');
  });

  it("redirects it to the overview, replacing the history entry", () => {
    expect(appSource).toContain('<Redirect to="/admin/overview" replace />');
  });

  it("still holds the real admin pages one segment deeper", () => {
    expect(appSource).toContain('<Route path="/admin/overview"');
    expect(appSource).toContain('<Route path="/admin/users"');
  });
});

describe("App routes — the specimen sheet is a staff surface (#261)", () => {
  it("no longer answers inside the customer's casting namespace", () => {
    /*
      His ruling was the address, not a gate: "An admin gate on a customer route
      leaves the wrong thing in the wrong place." So the old path must be GONE,
      not guarded — a 404 for everyone, admins included.
    */
    expect(code(appSource)).not.toContain("/casting/foundation");
  });

  it("answers at /admin/foundation instead", () => {
    expect(code(appSource)).toContain('<Route path="/admin/foundation" component={AdminFoundation} />');
  });

  it("and the page it points at consults a session and refuses a non-admin", () => {
    /*
      The route line alone proves nothing — `App.tsx` has no route-level guard,
      so a page reached under /admin is exactly as open as one reached under
      /casting unless the page itself refuses. This is the assertion the defect
      would have failed.
    */
    const page = code(read(resolve(PAGES_DIR, "AdminFoundation.tsx")));
    expect(page).toContain("useAuth(");
    expect(page).toContain('<Redirect to="/login" />');
    expect(page).toMatch(/user\?\.role\s*!==\s*"admin"/);
  });
});

describe("App routes — the class the #261 sweep named", () => {
  /*
    THE CLASS: a house-only page registered beside the customer's pages, gating
    on nothing. `/casting/foundation` was found by eye; this arm is the sweep
    kept running, so the next one is found by the suite.

    The population is DERIVED from the pages directory rather than transcribed,
    because a hand-kept list of pages drifts from the directory the first time
    somebody adds one (working law 4). Each page is asked one question: does it
    consult a session at all? A page that does not must be on the enumerated
    public list below, and adding a row there is a deliberate decision.
  */
  const PUBLIC_BY_DESIGN: Record<string, string> = {
    "Home.tsx": "the marketing home page — public by design",
    "VerifyEmail.tsx": "the email-verification landing, reached from a mail link",
    "NotFound.tsx": "the 404",
  };
  /* Login.tsx is public too and is deliberately NOT here: it calls the auth
     procedures, so it consults a session and never reaches this list. The list
     is "allowed to consult nothing", not "allowed to be public". */

  const pageFiles = () =>
    readdirSync(PAGES_DIR)
      .filter((name) => name.endsWith(".tsx"))
      .map((name) => ({ name, text: code(read(resolve(PAGES_DIR, name))) }));

  it("finds the pages it is supposed to find", () => {
    /* A matcher that silently matches nothing is a green suite proving nothing. */
    expect(pageFiles().length).toBeGreaterThan(10);
  });

  it("every routed page either consults a session or is on the public list", () => {
    const ungated = pageFiles()
      .filter(({ text }) => !/useAuth\(|trpc\./.test(text))
      .map(({ name }) => name)
      .sort();

    expect(ungated).toEqual(Object.keys(PUBLIC_BY_DESIGN).sort());
  });
});
