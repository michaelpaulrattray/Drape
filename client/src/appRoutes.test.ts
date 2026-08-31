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
 * #364: `/studio` — the legacy studio, carrying legacy casting AND wardrobe —
 * was unlinked from the navigation by #302 and still resolved for anyone signed
 * in. The founder ordered it SEALED, not deleted: "they should be completely
 * unlinked from the public being able to reach them. that way as we continue
 * development we can cleanly retire them?" So the arms assert three things that
 * pull against each other on purpose — the route is still registered, the page
 * refuses everyone but an admin, and it refuses by answering 404 rather than by
 * saying no (a refusal page tells a stranger there is something there).
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

/** Every routed page, read from the directory rather than from a list. */
const pageFiles = () =>
  readdirSync(PAGES_DIR)
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => ({ name, text: code(read(resolve(PAGES_DIR, name))) }));

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

describe("App routes — the legacy studio is sealed, not deleted (#364)", () => {
  const studio = () => code(read(resolve(PAGES_DIR, "DrapeStudio.tsx")));

  it("keeps the /studio route registered — the door closes, nothing is removed", () => {
    /*
      His order was explicit that N8 owns retirement and the Atlas is the
      deletion authority. A shift that "tidied" this route away would be
      deleting on a closed door rather than on no callers.
    */
    expect(appSource).toContain('<Route path="/studio" component={DrapeStudio} />');
  });

  it("renders only for an admin", () => {
    expect(studio()).toMatch(/user\?\.role === 'admin'/);
  });

  it("answers 404 rather than refusing out loud", () => {
    /*
      "A non-admin hitting it must get the SAME answer the address would give if
      it did not exist" — so NotFound, never a Redirect to a login page and never
      an access-denied screen.
    */
    const text = studio();
    expect(text).toContain("import NotFound from '@/pages/NotFound'");
    expect(text).toMatch(/if \(!authLoading && !isAdmin\) \{\s*return <NotFound \/>;/);
  });

  it("navigates a sealed visitor nowhere — the 404 is not raced by a redirect", () => {
    /*
      MEASURED, not reasoned about. The first cut of this seal returned
      <NotFound /> and a signed-in non-admin still landed on /app, because
      `useStudioEntry` holds "the ONLY bare-/studio redirect" and it fired on
      `isAuthenticated`. A 404 that a redirect overtakes is not a 404.

      So both session hooks take `isAdmin`, and the null-tool watcher refuses
      before it can navigate. All three are asserted because each one is a
      separate way for the page to move somebody it has already refused.
    */
    const text = studio();
    expect(text).toContain("useSessionRestore(isAdmin)");
    expect(text).toContain("useStudioEntry({ isAuthenticated: isAdmin, isRestoring })");
    expect(text).toMatch(/if \(!isAdmin\) return;[\s\S]{0,120}?entryStatus !== 'settled'/);
  });

  it("and no staff page sends a wrong-role visitor to it", () => {
    /*
      Nine admin and moderator pages bounced a non-admin to /studio. Sealing it
      without moving them would have made every one of those a dead end for
      exactly the population they exist for — the seal's own second-order
      defect, and the reason this arm is derived from the directory rather than
      from a list of the nine.
    */
    const offenders = pageFiles()
      .filter(({ text }) => /Redirect to="\/studio"/.test(text))
      .map(({ name }) => name);

    expect(offenders).toEqual([]);
  });
});
