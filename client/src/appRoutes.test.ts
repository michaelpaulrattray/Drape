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
 * #1545: `/app/models` — the library's address — became `/app/library` on his
 * word (*"library hasnt been designed yet regardless it should read /library not
 * /models"*). A rename is a MOVE, not a deletion: every bookmark, every link in
 * a sent email and the crew's own notes point at the old one, so the arms below
 * assert BOTH halves exactly as #68's and #261's do — the new address is routed,
 * and the old address still answers, as a `replace` redirect rather than a 404.
 *
 * Reads are newline-normalized on purpose: these assertions are about tokens
 * on one line, and a CRLF working copy (issue #71) must not fail them.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { withoutComments } from "../../server/testing/withoutComments";

const PAGES_DIR = resolve(__dirname, "pages");

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

const appSource = read(resolve(__dirname, "App.tsx"));

/** Every routed page, read from the directory rather than from a list. */
const pageFiles = () =>
  readdirSync(PAGES_DIR)
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => ({ name, text: code(read(resolve(PAGES_DIR, name))) }));

/**
 * Comments quote the rule; matching on them would pass on the promise.
 *
 * ⚠ **THE SHARED READER, AND THE ORDER IS LOAD-BEARING (#1636).** The private
 * trio it replaces — a block regex, a JSX-comment regex and an anchored line
 * regex — knows nothing about STRING LITERALS: a `/*` inside a quoted string
 * opens a comment it never opened and everything to the next one is deleted
 * from what this guard then reads. Measured across the tree, the block half
 * alone read 41 of 1,969 files short. **A guard that reads less passes for the
 * wrong reason** — and this suite's arms are about addresses, which are
 * quoted strings.
 *
 * The JSX-comment strip runs FIRST so the whole `{…}` leaves; the shared
 * reader would take the block comment and leave a bare `{}` behind. That
 * ordering is slice 1's finding on `foundation/section00-guard.test.ts`,
 * applied here rather than rediscovered.
 *
 * Every input is `.tsx` — `App.tsx` and the files under `pages/` — read at the
 * call sites rather than assumed, so a JS/TS reader is the right one. A
 * stylesheet must never come through here: `//` is not a comment in CSS, so an
 * unquoted `url(https://…)` would be truncated at the scheme.
 */
const code = (s: string) => withoutComments(s.replace(/\{\/\*[\s\S]*?\*\/\}/g, ""));

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

describe("App routes — the library moved and its old address still answers (#1545)", () => {
  /*
    ⚠ The two halves are asserted TOGETHER, out of the same block, rather than
    as two `toContain`s on two tokens. Two independent token reads both pass on a
    tree where the route and the redirect exist but are not paired — a
    `/app/models` route sitting empty, or a redirect pointing at the address it
    came from — and "the old address answers" is exactly the claim that would
    then be false while green. `#68`'s arms above read two tokens because its
    redirect target is a page that cannot be confused with its source; a rename's
    can, because the two strings differ by one word.
  */
  const modelsRoute = /<Route path="\/app\/models">([\s\S]*?)<\/Route>/.exec(appSource);

  it("routes the library at its new address", () => {
    expect(appSource).toContain('<Route path="/app/library" component={AppLobby} />');
  });

  it("keeps the old address registered — a bookmark is not a 404", () => {
    expect(
      modelsRoute,
      "/app/models must still have a Route block — a rename that drops it breaks every saved link",
    ).not.toBeNull();
  });

  it("forwards it to the new address, replacing the history entry", () => {
    expect(modelsRoute?.[1]).toContain('<Redirect to="/app/library" replace />');
  });

  it("no longer renders the lobby AT the old address — one door, not two", () => {
    /* Two live addresses for one page is the drift this card is about; the old
       one must FORWARD, never serve. */
    expect(appSource).not.toContain('<Route path="/app/models" component={AppLobby} />');
  });

  it("leaves no /app/models link behind in the customer's own navigation", () => {
    /* The rail is the only thing that ever pointed here, and a stale href would
       send a click through the redirect forever rather than to the real door. */
    const rail = read(resolve(__dirname, "foundation/Rail.tsx"));
    expect(rail).toContain('href: "/app/library"');
    expect(rail).not.toContain('"/app/models"');
  });
});

describe("App routes — one address family under /app, and every old address forwards (#1583)", () => {
  /*
    His word, 2026-09-30: *"yes i want that shape"*. The signed-in product moved
    under `/app` because the domain's root belongs to the marketing site, and
    casting was the last top-level entrance.

    ⚠ EACH PAIR IS READ OUT OF ONE BLOCK, for #1545's reason and one more.
    #1545's: two independent token reads both pass on a tree where the route and
    the redirect exist but are not paired. The second is this card's own — five
    addresses moved at once, and four of the five differ from their destination
    by an inserted `/app` alone. A `toContain("/app/casting")` is satisfied by
    the string sitting INSIDE `<Route path="/app/casting/s/:sessionId">`, so
    three of these arms would pass on a router that had lost the very route they
    name.
  */
  const forward = (from: string) =>
    new RegExp(`<Route path="${from.replace(/[/:]/g, (c) => `\\${c}`)}">([\\s\\S]*?)</Route>`).exec(appSource);

  /** new address → [how it is routed, the old address that must forward to it] */
  const MOVED: Array<{ now: string; routedAs: string; from: string; forwardsWith: string }> = [
    {
      now: "/app/casting",
      routedAs: '<Route path="/app/casting" component={CastingV2} />',
      from: "/casting",
      forwardsWith: '<Redirect to="/app/casting" replace />',
    },
    {
      now: "/app/casting/s/:sessionId",
      routedAs: '<Route path="/app/casting/s/:sessionId">',
      from: "/casting/s/:sessionId",
      forwardsWith: "<Redirect to={`/app/casting/s/${params.sessionId}`} replace />",
    },
    {
      now: "/app/casting/cast/:castId",
      routedAs: '<Route path="/app/casting/cast/:castId">',
      from: "/casting/cast/:castId",
      forwardsWith: "<Redirect to={`/app/casting/cast/${params.castId}`} replace />",
    },
    {
      now: "/app/canvas",
      routedAs: '<Route path="/app/canvas" component={AppLobby} />',
      from: "/app/boards",
      forwardsWith: '<Redirect to="/app/canvas" replace />',
    },
    {
      now: "/app/canvas/:id",
      routedAs: '<Route path="/app/canvas/:id" component={BoardRoute} />',
      from: "/app/board/:id",
      forwardsWith: "<Redirect to={`/app/canvas/${params.id}`} replace />",
    },
  ];

  it("finds the five moved addresses it is supposed to find", () => {
    /* A matcher that silently matches nothing is a green suite proving nothing. */
    expect(MOVED).toHaveLength(5);
  });

  for (const { now, routedAs, from, forwardsWith } of MOVED) {
    it(`routes ${now}, and keeps ${from} answering as a forward to it`, () => {
      expect(appSource, `${now} must be routed — this is the address the product now uses`).toContain(
        routedAs,
      );

      const block = forward(from);
      expect(
        block,
        `${from} must still have a Route block — a rename that drops it breaks every saved link, his own test casts and every driver in scripts/`,
      ).not.toBeNull();
      expect(
        block?.[1],
        `${from} must forward to ${now}, replacing the history entry so Back does not bounce off it`,
      ).toContain(forwardsWith);
    });
  }

  it("serves no page at an old address — one door, not two", () => {
    /*
      The negative half, and the one that would catch a forward added BESIDE a
      live route rather than in place of it. Only `component=` is asked about: a
      Route block carrying a Redirect is exactly what the arms above require.
    */
    for (const { from } of MOVED) {
      expect(appSource, `${from} must forward, never serve`).not.toMatch(
        new RegExp(`<Route path="${from.replace(/[/:]/g, (c) => `\\${c}`)}" component=`),
      );
    }
  });

  it("leaves no old address in the rail — a stale href sends every click through a redirect", () => {
    const rail = read(resolve(__dirname, "foundation/Rail.tsx"));
    expect(rail).toContain('href: "/app/casting"');
    expect(rail).toContain('href: "/app/canvas"');
    expect(rail).not.toMatch(/href: "\/casting"/);
    expect(rail).not.toMatch(/href: "\/app\/boards"/);
  });

  it("leaves no old address anywhere in the customer's own navigation", () => {
    /*
      THE SWEEP, and it is the arm that actually holds this card shut. The five
      pairs above prove the router; this proves nothing in the product still
      POINTS at an old address — which is the drift a forward quietly absorbs,
      because a stale link keeps working and nobody ever sees it fail.

      The population is DERIVED by walking the tree, never a list of the files
      this card happened to touch. `App.tsx` is the one exception and it is
      excluded BY NAME with its reason: the forwards themselves are the only
      place an old address is supposed to survive.
    */
    const CLIENT_SRC = resolve(__dirname);
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = resolve(dir, e.name);
        if (e.isDirectory()) return walk(full);
        return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [full] : [];
      });

    const files = walk(CLIENT_SRC).filter((f) => f !== resolve(CLIENT_SRC, "App.tsx"));
    expect(files.length, "the walker found no source files — a sweep over nothing is green and proves nothing").toBeGreaterThan(50);

    /*
      Anchored on the opening quote of a string literal, so `/casting-hero/deck/…`
      (an asset under `public/`, not an address) and `../pages/casting/…` (a file
      path) are never matched. Comments are stripped first: a docblock recording
      where a page USED to live is history, and #261's own is still true.
    */
    const OLD = /(['"`])(\/casting(?:\/|\1)|\/app\/boards\1|\/app\/board\/)/;
    const offenders = files
      .filter((f) => OLD.test(code(read(f))))
      .map((f) => f.slice(CLIENT_SRC.length + 1).replace(/\\/g, "/"))
      .sort();

    expect(offenders, "these still point at an address the product no longer serves (#1583)").toEqual([]);
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

describe("the reader these arms match on (#1636)", () => {
  /*
    A CONTROL, not a demonstration. Two things about `code` above are
    load-bearing and neither is visible at any call site, so a later edit could
    undo either one with every arm in this file still green:

      1. the JSX-comment strip runs FIRST, so the whole `{…}` leaves rather
         than a bare `{}` — the shared reader alone would take the comment and
         leave the braces;
      2. the shared reader takes a TRAILING line comment, which the
         line-start-anchored shape it replaces could not see. Measured on the real pages
         the day this landed: three such comments across the eighteen, one of
         them `if (!isAdmin) return; // sealed: … (#364)` — prose naming this
         suite's own subject, sitting in what these arms read.

    And the positive control matters more than either: a reader that reads
    LESS passes for the wrong reason, so a quoted address must survive intact.
  */
  const specimen = [
    'const seal = true; // sealed: nothing on this page navigates for anyone else',
    "<div>{/* a JSX comment naming /studio */}</div>",
    'const href = "https://example.test/studio";',
  ].join("\n");

  it("takes the whole JSX comment expression, braces included", () => {
    expect(code(specimen)).not.toContain("a JSX comment");
    expect(code(specimen)).not.toContain("{}");
  });

  it("takes a trailing line comment the anchored shape could not see", () => {
    expect(code(specimen)).not.toContain("sealed: nothing on this page");
    expect(code(specimen)).toContain("const seal = true;");
  });

  it("and leaves a quoted address whole — reading less is the other failure", () => {
    expect(code(specimen)).toContain('"https://example.test/studio"');
  });
});
