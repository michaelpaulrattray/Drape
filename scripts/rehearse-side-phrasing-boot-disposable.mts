/**
 * REHEARSE CASTING_SIDE_PHRASING_SCOPE's BOOT GUARDS against production's exact shape.
 *
 * 2026-07-31 is why this exists: an evidence scope flag crash-looped
 * production. The rule since is that a scope is never flipped until its guards
 * have been driven locally with the same variable shape that is about to be
 * set — including the failure cases, because a guard that cannot refuse is not
 * a guard.
 *
 * The shape below is production's, read BY NAME off the Drape service (never by
 * value), with CASTING_SIDE_PHRASING_SCOPE ABSENT — which is the thing the flip changes.
 *
 * Drives no server and spends nothing: it calls the boot validator itself.
 */
import {
  validateCastingSidePhrasingEnvironment,
  CASTING_SIDE_PHRASING_SCOPE_ENV,
  CASTING_REPAINT_SCOPE_ENV,
} from "../server/castingV2/castingV2Scope.js";

const PRODUCTION = {
  [CASTING_REPAINT_SCOPE_ENV]: "users:1",
} as Record<string, string | undefined>;

const run = (label: string, env: Record<string, string | undefined>): boolean => {
  try {
    validateCastingSidePhrasingEnvironment({
      scope: env[CASTING_SIDE_PHRASING_SCOPE_ENV],
      repaintScope: env[CASTING_REPAINT_SCOPE_ENV],
    });
    console.log(`BOOTS    ${label}`);
    return true;
  } catch (error) {
    console.log(`REFUSES  ${label}\n           ${(error as Error).message}`);
    return false;
  }
};

const results = {
  absentBoots: run("absent — today's production", { ...PRODUCTION }),
  offBoots: run("off", { ...PRODUCTION, [CASTING_SIDE_PHRASING_SCOPE_ENV]: "off" }),
  askBoots: run("users:1 — THE ASK", { ...PRODUCTION, [CASTING_SIDE_PHRASING_SCOPE_ENV]: "users:1" }),
  parentOffRefuses: !run("the ask with the parent OFF", {
    ...PRODUCTION,
    [CASTING_REPAINT_SCOPE_ENV]: undefined,
    [CASTING_SIDE_PHRASING_SCOPE_ENV]: "users:1",
  }),
  reachesPastParentRefuses: !run("users:99 while the parent does not cover 99", {
    ...PRODUCTION,
    [CASTING_SIDE_PHRASING_SCOPE_ENV]: "users:99",
  }),
  wideRefuses: !run("all while the parent is limited", {
    ...PRODUCTION,
    [CASTING_SIDE_PHRASING_SCOPE_ENV]: "all",
  }),
  malformedRefuses: !run("a malformed value", {
    ...PRODUCTION,
    [CASTING_SIDE_PHRASING_SCOPE_ENV]: "users:1,banana",
  }),
};

const failures = Object.entries(results).filter(([, ok]) => !ok).map(([label]) => label);
console.log("");
if (failures.length > 0) {
  console.error(`REHEARSAL FAILED: ${failures.join(", ")}. Do not flip anything.`);
  process.exit(1);
}
console.log("Rehearsal clean: it boots on the ask, and refuses every way it must.");
process.exit(0);
