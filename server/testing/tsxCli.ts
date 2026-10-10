import { resolve } from "node:path";

/**
 * TSX'S OWN ENTRY — how a suite runs a `.mts` script WITHOUT a shell (#2227).
 *
 * # What this is for
 *
 * An arm that takes a binary away from its child does it by handing the child a
 * PATH that cannot reach it. `npx` is then unreachable too, for a reason that
 * has nothing to do with the thing under test: **`npx` spawns `sh`, `sh` lives
 * in `/bin`, and a PATH stripped to node's own directory deliberately does not
 * carry it.** So the arm fails on its launcher and reports that failure as the
 * subject's verdict.
 *
 * The remedy, and it is the only one that needs no PATH lookup at all:
 *
 * ```
 * runHook(process.execPath, [TSX_CLI, SCRIPT, ...args], { env })
 * ```
 *
 * `process.execPath` is an absolute path to the node binary already running, so
 * nothing is resolved; tsx starts its child from that same path, so nothing
 * consults a shell on the way down either.
 *
 * # Why it is declared HERE rather than in each suite
 *
 * It was declared twice — `server/nextUpEscalation.test.ts` and
 * `server/patrolClocks.test.ts` — each with a comment saying it was the same
 * spelling as the other. That is working law 4 (*a second list shadowing a
 * source of truth always drifts from it*) with the drift not yet arrived, and
 * the promotion rule's own threshold: two real consumers promotes.
 *
 * `server/shellLessPathLaunch.test.ts` names this module in the sentence it
 * prints when it catches the third instance, which is the other half of the
 * reason it is one declaration: advice that points at a path string makes the
 * next suite a third copy.
 *
 * # Its limit, stated rather than discovered
 *
 * Resolved against the CURRENT WORKING DIRECTORY, which vitest sets to the repo
 * root. It is not resolved against `import.meta.dirname`, because the file it
 * names is a dependency of the repo rather than a neighbour of this module, and
 * a suite run from elsewhere would be reaching for a `node_modules` that is not
 * the one it was installed with.
 */
export const TSX_CLI = resolve("node_modules/tsx/dist/cli.mjs");
