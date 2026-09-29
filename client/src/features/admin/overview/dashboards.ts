/**
 * THE TWO DASHBOARDS THE OVERVIEW LINKS TO (#1441) — his *"Links — no fourth
 * key"* on #1419, Desk reply #229, 2026-09-27.
 *
 * # What he chose, and what he chose it over
 *
 * He was asked, back on 4 September, for a row on his admin page showing errors
 * in the last day and the worst-failing route. Two of the four things he named
 * were already on that page; the other two come out of Sentry, and the keys he
 * pasted only let this product SEND to Sentry, never read back. Reading back
 * needs a fourth key of a different kind.
 *
 * ⚠ **HE TOOK THE LINKS, AND THAT DECIDES MORE THAN THE MARKUP.** Nothing is
 * copied onto his page, so nothing on it can go stale, and there is no
 * credential here — a link is a string. **This module must never grow a reader.**
 * The moment something here fetches from a vendor, it is the fourth key he
 * declined, and the page starts carrying numbers that can disagree with the
 * dashboard they came from.
 *
 * # The ids, in ONE place
 *
 * His card's own instruction: *"Put the three ids in one declared constant so a
 * renamed project is one edit."* They are the ids from #1419's own receipt —
 * Sentry org `klieg-labs` with the projects `klieg-server` (Node) and
 * `klieg-web` (Browser), and PostHog US Cloud project `593474`.
 *
 * ⚠ **THE TWO SENTRY PROJECT SLUGS ARE RECORDED HERE AND ARE DELIBERATELY NOT
 * IN THE URL, WHICH IS A FACT ABOUT SENTRY RATHER THAN A CHOICE.** Its issue
 * stream filters by NUMERIC project id, not by slug, and this product holds no
 * numeric id — the only place one exists is inside the DSN, which is a secret
 * on the service and is not something a bundle may carry. The org's unfiltered
 * stream is both projects at once, which is the one click he asked for. They are
 * named in `SENTRY_PROJECTS` because the constant's job is to be the place
 * somebody looks when a project is renamed, and a slug that is real and absent
 * from the URL is exactly what that reader needs to be told.
 *
 * # ⚠ What was NOT verified from here, said plainly (law 7b)
 *
 * The two URL SHAPES below are the vendors' documented ones and were **not**
 * driven. There is no credential for either service in this tree, and a build
 * does not reach out to a third party to check that a link resolves. So the
 * first click is the verification, and a wrong one costs one edit **in this
 * file** — which is the whole reason the ids are declared here rather than
 * spelled into the markup.
 *
 * A move to PostHog's European region (the optional `POSTHOG_HOST` offered on
 * #1419, unset today) is the one configuration change that would also need
 * `POSTHOG_APP_HOST` edited: the app host and the ingest host are different
 * names, so the server's own `POSTHOG_HOST` cannot be reused for this.
 */
import { clientSentryDsn } from "@/monitoring/errorReporter";

/** Sentry's organisation slug — the one segment both projects sit under. */
export const SENTRY_ORG = "klieg-labs";

/**
 * The two projects that org holds, by slug. Recorded rather than used — see the
 * header's note on why Sentry's issue stream cannot filter on these.
 */
export const SENTRY_PROJECTS = ["klieg-server", "klieg-web"] as const;

/** PostHog's project id, on the US cloud. */
export const POSTHOG_PROJECT_ID = "593474";

/** PostHog's APP host, which is not its ingest host (`us.i.posthog.com`). */
export const POSTHOG_APP_HOST = "https://us.posthog.com";

/**
 * Everything that broke, both halves of the product in one stream.
 *
 * The org-level issue view rather than a project one, so the server's crashes
 * and the browser's arrive on the same page — which is what "one click to the
 * real dashboard" has to mean when the product reports from two places.
 */
export const SENTRY_ISSUES_URL = `https://${SENTRY_ORG}.sentry.io/issues/`;

/** What people actually did. */
export const POSTHOG_PROJECT_URL = `${POSTHOG_APP_HOST}/project/${POSTHOG_PROJECT_ID}`;

/** What `admin.getOverview` says about which dashboards exist to link to. */
export interface MonitoringConfigured {
  errorsConfigured: boolean;
  eventsConfigured: boolean;
}

/** One link, as the head renders it. */
export interface DashboardLink {
  /** What he reads — never the vendor. */
  label: string;
  href: string;
  /** What he sees on hover, and the only place a vendor is named. */
  vendor: string;
}

/**
 * ⚠ WHICH LINKS TO DRAW — AND A LINK APPEARS ONLY WHERE SOMETHING IS ACTUALLY
 * REPORTING.
 *
 * A link to a project no key points at is #1419's own *"0 errors today"* lie
 * wearing a different hat: he clicks, finds an empty dashboard, and reads it as
 * *nothing is broken* rather than as *nobody switched it on*. So each link is
 * drawn from the live answer to "is that key set", which `admin.getOverview`
 * re-reads on every poll — a key pasted onto the service shows up within thirty
 * seconds rather than on the next deploy.
 *
 * ⚠ **ERRORS ASKS ABOUT BOTH HALVES, AND THAT IS NOT BELT AND BRACES.** The two
 * Sentry keys can legitimately disagree, and #1419's own closing note is why:
 * `SENTRY_DSN` is read when the service STARTS, while `VITE_SENTRY_DSN` is baked
 * into the page when it is BUILT — so a variable changed without a rebuild
 * leaves the browser half off while the server half reports. The stream this
 * link opens is the ORG's, carrying both projects, so it is worth opening when
 * EITHER is live. The browser's answer comes from `clientSentryDsn()`, the one
 * reader that already owns that question, rather than a second copy of it
 * (working law 4).
 *
 * ⚠ **A PURE FUNCTION, DELIBERATELY, AND NOT A COMPONENT.** `vitest.config.ts`
 * runs the client's suites in a node environment with no DOM — *"component
 * rendering stays out of `pnpm test`"* — so a rule expressed inside JSX is a
 * rule no arm can reach. The rule here is the whole of what is worth proving,
 * so it is written where it can be driven. The browser's DSN is a defaulted
 * PARAMETER for the same reason `bootLineFor` takes its mode: both branches of
 * a build-time value have to be reachable from a test that is not a build.
 *
 * `monitoring` is optional because the overview renders on `getOverview` alone
 * and an older bundle against a newer server — or the reverse — must draw no
 * link rather than throw. Absent, nothing is drawn, which is the honest answer
 * to a question that was not asked.
 */
export function visibleDashboardLinks(
  monitoring: MonitoringConfigured | undefined,
  browserSentryDsn: string = clientSentryDsn(),
): DashboardLink[] {
  if (!monitoring) return [];
  const links: DashboardLink[] = [];

  if (monitoring.errorsConfigured || browserSentryDsn.length > 0) {
    links.push({ label: "Errors", href: SENTRY_ISSUES_URL, vendor: "Sentry" });
  }
  if (monitoring.eventsConfigured) {
    links.push({ label: "Usage", href: POSTHOG_PROJECT_URL, vendor: "PostHog" });
  }
  return links;
}
