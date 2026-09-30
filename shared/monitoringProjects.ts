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
