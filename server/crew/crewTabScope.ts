/**
 * THE CREW TAB'S DOOR — whether `/admin/crew` and the `crew.*` procedures
 * exist at all (issue #41, design `docs/specs/CREW_TAB_DESIGN.md` §5).
 *
 * Off, and absent means off, both procedures answer `NOT_FOUND` and the nav
 * entry never renders — the surface does not exist anywhere a user can see,
 * which is what the standing autonomy grant means by dark. On, an admin
 * reaches the briefing the night shifts write and the reply box that writes
 * back to them.
 *
 * # WHY IT HAS NO BOOT-TIME VALIDATION, WHEN EVERY FLAG BESIDE IT DOES
 *
 * The casting flags refuse to boot without their transport, their worker or
 * their validator, and each of those refusals is protecting a PAID PATH: a
 * customer charged for a render that fails at dispatch, or bytes kept with
 * nothing to delete them. This flag has none of those dependencies — no
 * engine, no worker, no stored object, no credit. There is nothing it could
 * strand.
 *
 * What there IS, is the 2026-07-31 boot-guard incident: production crash-looped
 * on evidence boot guards. A page is not worth that risk, and the design says
 * so in as many words — the briefing is a page, not a dependency. So the
 * posture here is degrade-and-say-so at every level, and the one precondition
 * this flag has is named rather than enforced:
 *
 *   **`crew_replies` (migration 0054) must exist before this is flipped on.**
 *   Production takes it by `scripts/ceremony-crew-replies.mts`, a founder act.
 *
 * That is a precondition of the FLIP, in the house shape the ink studio's table
 * prerequisite already uses. A boot guard could not check it honestly anyway:
 * reading a table's existence at startup is a database round trip on the boot
 * path, taken to protect a surface whose failure mode is one admin seeing an
 * error toast.
 *
 * # AND NO PARENT FLAG
 *
 * Every casting scope names one, because each is a lane inside a road somebody
 * else opened. This is not: it is an admin panel page, gated by
 * `adminProcedure` — the strongest gate the product has — before the flag is
 * ever consulted. The flag exists to keep the page dark until the founder's
 * eyes have passed it, not to narrow an admin surface per user.
 *
 * The grammar and the parse are `castingV2Scope.ts`'s, deliberately identical:
 * a second dialect of `users:1` on a switch an operator sets by hand is a way
 * to be surprised at 2am.
 */
export const CREW_TAB_SCOPE_ENV = "CREW_TAB_SCOPE";

export type CrewTabScope =
  | { kind: "off" }
  | { kind: "users"; userIds: readonly number[] }
  | { kind: "all" };

export class CrewTabScopeConfigurationError extends Error {
  constructor() {
    super(
      `${CREW_TAB_SCOPE_ENV} must be "off", "all", or "users:" followed by unique positive integer user ids`,
    );
    this.name = "CrewTabScopeConfigurationError";
  }
}

/**
 * The house grammar, in the shape `castingV2Scope.ts` wrote it.
 *
 * It is copied rather than imported on purpose: this module is the admin
 * panel's and that one is the casting program's, and an import would make an
 * admin page's door depend on a paid road's file for no reason either side
 * would recognise. The cost of the copy is that two parsers must agree, and
 * `crewTabScope.test.ts` drives the identical value table against both.
 */
function parseScopeGrammar(raw: string | undefined, fail: () => never): CrewTabScope {
  if (raw === undefined || raw === "" || raw === "off") return { kind: "off" };
  if (raw === "all") return { kind: "all" };
  if (!raw.startsWith("users:") || /\s/.test(raw)) fail();
  const members = raw.slice("users:".length).split(",");
  if (members.length === 0 || members.some((member) => !/^[1-9]\d*$/.test(member))) fail();
  const userIds = members.map(Number);
  if (
    userIds.some((userId) => !Number.isSafeInteger(userId) || userId <= 0)
    || new Set(userIds).size !== userIds.length
  ) {
    fail();
  }
  return { kind: "users", userIds: [...userIds].sort((a, b) => a - b) };
}

export function parseCrewTabScope(raw: string | undefined): CrewTabScope {
  return parseScopeGrammar(raw, () => {
    throw new CrewTabScopeConfigurationError();
  });
}

export function crewTabEnabledForUser(scope: CrewTabScope, userId: number): boolean {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new TypeError("Crew tab scope requires a positive integer user id");
  }
  return scope.kind === "all" || (scope.kind === "users" && scope.userIds.includes(userId));
}

/**
 * Read the live scope for one user.
 *
 * Per call rather than cached at boot, for the reason its siblings give: a
 * scope change takes effect on redeploy without a code path that could hold a
 * stale `all`.
 *
 * ⚠ **A malformed value throws here rather than at startup**, which is the
 * whole difference between this flag and the casting ones. Its consumers are
 * the `crew` router (tRPC converts the throw into an error response) and the
 * eye-frame route (`routes/crewEyeFrames.ts`, which must CATCH it — Express 4
 * does not convert an async handler's rejection, so unwrapped it hangs the
 * request; PR #79 review finding 1). An admin seeing an error where a
 * briefing should be is the correct outcome of a typo in the variable. It is
 * never a customer's request, and it is never a spend.
 */
export function captureCrewTabEnabled(userId: number): boolean {
  return crewTabEnabledForUser(parseCrewTabScope(process.env[CREW_TAB_SCOPE_ENV]), userId);
}
