/**
 * THE SENTRY IDS, IN ONE PLACE THAT A BUILD CAN ALSO READ (#1420 part 1).
 *
 * His instruction on #1419 was *"Put the three ids in one declared constant so
 * a renamed project is one edit"*, and that place was
 * `client/src/features/admin/overview/dashboards.ts`. It still is for a reader
 * on his admin page — that module re-exports these two names, so nothing about
 * its surface moved. What changed is that a SECOND reader arrived which cannot
 * reach it: `vite.config.ts` uploads the browser bundle's source maps to this
 * org and project, and that module imports `@/monitoring/errorReporter` for the
 * DSN, which reads `import.meta.env` — undefined in the node process that loads
 * a vite config.
 *
 * So the ids live here, in a module with NO imports, and both readers take them
 * from the one declaration. His card's requirement for part 1 was explicit:
 * *"the org slug and project names already live in … dashboards.ts … and must
 * not be spelled a second time."* A copy in the build config is exactly the
 * parallel list working law 4 is about, and the failure it produces is the
 * quiet one — maps uploaded to a project nobody looks at, with every log line
 * saying the upload succeeded.
 *
 * ⚠ **These are ids, not credentials.** The DSN and the auth token are secrets
 * and are read from the environment where they are used; an org slug is a
 * segment of a URL his admin page already renders. Nothing here may grow into
 * a key, and nothing here may grow a reader that FETCHES — `dashboards.ts`'s
 * header carries his *"Links — no fourth key"* ruling and it binds this file
 * for the same reason.
 */

/** Sentry's organisation slug — the one segment both projects sit under. */
export const SENTRY_ORG = "klieg-labs";

/**
 * The Node project. The server half reports here (`server/monitoring/errorTracker.ts`).
 */
export const SENTRY_SERVER_PROJECT = "klieg-server";

/**
 * The Browser project. The bundle reports here, and it is therefore the project
 * `vite.config.ts` uploads source maps to — named rather than indexed out of
 * `SENTRY_PROJECTS`, so the build says which of the two it means.
 */
export const SENTRY_BROWSER_PROJECT = "klieg-web";

/**
 * Both projects that org holds, DERIVED from the two above rather than listed
 * again beside them.
 */
export const SENTRY_PROJECTS = [SENTRY_SERVER_PROJECT, SENTRY_BROWSER_PROJECT] as const;

/**
 * ⚠ THE MARK EVERY DEPLOY-RITE PROBE EVENT CARRIES — AND THE REASON IT IS HERE
 * RATHER THAN BESIDE THE PROBE (#1650, 2026-10-01).
 *
 * The probe fires on every deploy (#1648) and its events are real Sentry
 * events: nine of the thirteen unresolved events in the server project on the
 * day this was written were probes. Two halves of the tree have to agree on
 * one string for that to be survivable — the WRITER
 * (`scripts/probe-error-tracker.mts`, through `PROBE_ERROR_CONTEXT` in
 * `server/monitoring/trackerVerdict.ts`) and the READER, which is the *Errors*
 * link his admin overview hands him (`client/src/features/admin/overview/
 * dashboards.ts`). **The client cannot import from `server/`**, so without a
 * shared declaration the link would spell the tag a second time — green
 * forever while the probe renames its own mark and his feed quietly fills up
 * again. That is working law 4, and it is the same argument that put the org
 * and project ids in this module.
 *
 * ⚠ **IT IS A TAG AND NOT A KEY, AND NOTHING HERE FETCHES.** The value travels
 * only because `kind` is on `ALLOWED_TAG_KEYS`
 * (`shared/errorEventScrub.ts`); `server/trackerVerdict.test.ts` reddens if it
 * leaves. The header's *"no reader that FETCHES"* rule is untouched — the one
 * consumer below composes a URL.
 */
export const SENTRY_PROBE_TAG = { key: "kind", value: "probe" } as const;

/**
 * WHAT HIS *ERRORS* LINK ASKS FOR, SO HE NEVER TYPES A QUERY.
 *
 * ⚠ **DRIVEN AT SENTRY'S OWN BOOKS BEFORE IT WAS BELIEVED** (#1650,
 * 2026-10-01, `GET /api/0/organizations/klieg-labs/issues/` through the
 * service's `SENTRY_AUTH_TOKEN`, read-only): `is:unresolved` returned **two**
 * issues — the probe at 9 events and the real `announcements.getActive` crash
 * at 4 — `kind:probe` returned the probe alone, and this search returned the
 * real crash alone. So the exclusion is Sentry's own behaviour measured, not a
 * syntax assumed from documentation.
 *
 * ⚠ **`is:unresolved` IS CARRIED DELIBERATELY RATHER THAN DROPPED.** Supplying
 * `?query=` REPLACES Sentry's default search, so a bare `!kind:probe` would
 * also hand him every issue somebody had already resolved. The link's own
 * header calls it *"everything that broke"*, and a resolved issue did not
 * break today.
 *
 * #1650's done-when named *"a saved Sentry filter … excludes probe"*, and this
 * is the cheapest road to it: the link already decides which view he lands on,
 * so nothing has to be saved anywhere and nothing about what Sentry STORES
 * changes. He can still clear the box and see the probes.
 */
export const SENTRY_ISSUE_SEARCH = `is:unresolved !${SENTRY_PROBE_TAG.key}:${SENTRY_PROBE_TAG.value}`;
