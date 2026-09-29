/**
 * ⚠ WHICH DASHBOARD LINKS THE OVERVIEW DRAWS (#1441) — his *"Links — no fourth
 * key"* on #1419.
 *
 * The server's half — that `admin.getOverview` really sends the two booleans,
 * and that they read the variable rather than boot state — is
 * `server/adminOverviewMonitoringLinks.test.ts`. This is the decision made on
 * them, and the two arms worth the most are the ones nothing else can see:
 *
 *   · **a link is drawn ONLY where something is reporting**, because a link to
 *     a project no key points at is #1419's own *"0 errors today"* lie in
 *     another costume;
 *   · **the label never names the vendor**, which is the disappearing-technology
 *     law's clause on a staff surface — the page three people see is exactly
 *     where an engine name goes unchallenged.
 *
 * `vitest.config.ts` runs the client's suites in a node environment and
 * *"component rendering stays out of `pnpm test`"*, which is precisely why the
 * rule under test is a pure function rather than a condition inside JSX.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  POSTHOG_APP_HOST,
  POSTHOG_PROJECT_ID,
  POSTHOG_PROJECT_URL,
  SENTRY_ISSUES_URL,
  SENTRY_ORG,
  SENTRY_PROJECTS,
  visibleDashboardLinks,
} from "./dashboards";

const BOTH = { errorsConfigured: true, eventsConfigured: true };
const NEITHER = { errorsConfigured: false, eventsConfigured: false };

/** No browser DSN, which is every developer's machine and the default state. */
const NO_BROWSER_DSN = "";
const BROWSER_DSN = "https://publickey@o1.ingest.de.sentry.io/2";

beforeEach(() => {
  vi.stubEnv("VITE_SENTRY_DSN", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("a link appears only where something is actually reporting", () => {
  it("draws both when both keys are set", () => {
    expect(visibleDashboardLinks(BOTH, NO_BROWSER_DSN).map((l) => l.label)).toEqual([
      "Errors",
      "Usage",
    ]);
  });

  it("⚠ draws NOTHING when neither is — never a link to an empty dashboard", () => {
    expect(visibleDashboardLinks(NEITHER, NO_BROWSER_DSN)).toEqual([]);
  });

  it("draws each one on its own key, in the order the head reads them", () => {
    expect(
      visibleDashboardLinks({ errorsConfigured: true, eventsConfigured: false }, NO_BROWSER_DSN)
        .map((l) => l.label),
    ).toEqual(["Errors"]);
    expect(
      visibleDashboardLinks({ errorsConfigured: false, eventsConfigured: true }, NO_BROWSER_DSN)
        .map((l) => l.label),
    ).toEqual(["Usage"]);
  });

  it("draws nothing at all when the server said nothing — an older payload must not throw", () => {
    expect(visibleDashboardLinks(undefined, BROWSER_DSN)).toEqual([]);
  });
});

describe("⚠ Errors asks about BOTH Sentry halves — they can legitimately disagree", () => {
  /*
    #1419's own closing note is the reason: `SENTRY_DSN` is read when the
    service STARTS and `VITE_SENTRY_DSN` is baked into the page when it is
    BUILT, so a variable changed without a rebuild leaves the browser half off
    while the server half reports. The stream this link opens is the ORG's,
    carrying both projects, so it is worth opening when either is live.
  */
  it("draws Errors on the BROWSER key alone, with the server's unset", () => {
    expect(
      visibleDashboardLinks({ errorsConfigured: false, eventsConfigured: false }, BROWSER_DSN)
        .map((l) => l.label),
    ).toEqual(["Errors"]);
  });

  it("draws Errors on the SERVER key alone, with the browser's unset", () => {
    expect(
      visibleDashboardLinks({ errorsConfigured: true, eventsConfigured: false }, NO_BROWSER_DSN)
        .map((l) => l.label),
    ).toEqual(["Errors"]);
  });

  it("reads the browser's key from the one reader when it is not passed", () => {
    /* The default parameter is `clientSentryDsn()`, which is where the eager
       reporter already decides whether this page reports — not a second copy of
       the same question (working law 4). */
    vi.stubEnv("VITE_SENTRY_DSN", BROWSER_DSN);
    expect(visibleDashboardLinks(NEITHER).map((l) => l.label)).toEqual(["Errors"]);
    vi.stubEnv("VITE_SENTRY_DSN", "");
    expect(visibleDashboardLinks(NEITHER)).toEqual([]);
  });
});

describe("⚠ the disappearing-technology gate, on a staff surface too", () => {
  it("names no vendor in anything he reads — only in the hover", () => {
    for (const link of visibleDashboardLinks(BOTH, BROWSER_DSN)) {
      for (const vendor of ["Sentry", "PostHog", "sentry", "posthog"]) {
        expect(link.label, `${link.label} must not name ${vendor}`).not.toContain(vendor);
      }
    }
  });

  it("says what he would look at, in his own words", () => {
    expect(visibleDashboardLinks(BOTH, BROWSER_DSN).map((l) => l.label)).toEqual([
      "Errors",
      "Usage",
    ]);
  });

  it("puts the vendor on the hover, so the tab he opened is identifiable", () => {
    /* The other half of the same clause: hiding the name from somebody who
       WANTS it is the disrespect, not the leak (the law's own wording on
       pickers). It is one `title` away, and nowhere on the page. */
    expect(visibleDashboardLinks(BOTH, BROWSER_DSN).map((l) => l.vendor)).toEqual([
      "Sentry",
      "PostHog",
    ]);
  });
});

describe("the ids are declared once, and the URLs are built from them", () => {
  it("⚠ builds every href from a declared id — a renamed project is ONE edit", () => {
    /* His card's own instruction. The arm is not decoration: the failure it
       catches is somebody spelling a URL into the markup later, at which point
       the constant stops being the place to change. */
    expect(SENTRY_ISSUES_URL).toContain(SENTRY_ORG);
    expect(POSTHOG_PROJECT_URL).toContain(POSTHOG_PROJECT_ID);
    expect(POSTHOG_PROJECT_URL.startsWith(POSTHOG_APP_HOST)).toBe(true);

    for (const link of visibleDashboardLinks(BOTH, BROWSER_DSN)) {
      expect([SENTRY_ISSUES_URL, POSTHOG_PROJECT_URL]).toContain(link.href);
    }
  });

  it("⚠ carries NO credential — a link is a string, which is the whole of his ruling", () => {
    /* The option he declined was a fourth key that could read his errors back.
       Nothing in this module may ever hold one: a bundle is public, and a
       reading key in it is a reading key for anybody who opens the page. */
    for (const href of [SENTRY_ISSUES_URL, POSTHOG_PROJECT_URL]) {
      expect(href).not.toMatch(/[?&](token|key|api_key|auth)=/i);
      expect(href.startsWith("https://")).toBe(true);
    }
  });

  it("names both Sentry projects, which the org's stream covers in one page", () => {
    /* They are recorded and not in the URL — Sentry's issue stream filters by
       numeric project id, not by slug, and the only numeric id this product
       holds is inside the DSN, which is a secret. The org's unfiltered stream
       is both at once, which is the one click he asked for. */
    expect([...SENTRY_PROJECTS]).toEqual(["klieg-server", "klieg-web"]);
    expect(SENTRY_ISSUES_URL).toBe("https://klieg-labs.sentry.io/issues/");
  });
});
