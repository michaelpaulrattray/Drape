/**
 * DRIVE THE INK-REFERENCE BOOT GUARD THROUGH `validateEnv()` ITSELF.
 *
 * `inkReferenceScope.test.ts` proves the guard REFUSES. It cannot prove the
 * guard is CALLED — and a control nobody invoked is not a control (invariant 7,
 * and the reason four of them are named in `CLAUDE.md` as inert). The unit test
 * and this script fail for different reasons and neither substitutes.
 *
 * So this drives the real `validateEnv()`, the function the server calls at
 * boot, against the real local environment:
 *
 *   ABSENT      must BOOT — today's production, the road unreachable
 *   users:1     must REFUSE, and the reason must be the TAKE, not a parent
 *
 * The second arm is the whole point. If somebody deletes the call site in
 * `_core/env.ts`, the unit test stays green and this goes red.
 *
 *   npx tsx scripts/rehearse-ink-reference-boot-disposable.mts
 *
 * It reads only. It sets nothing outside this process, touches no database, and
 * writes nothing anywhere.
 */
import "dotenv/config";
import { validateEnv } from "../server/_core/env.js";
import { CASTING_INK_REFERENCE_SCOPE_ENV } from "../server/castingV2/castingV2Scope.js";

type Attempt = { booted: boolean; message: string };

function attempt(label: string, value: string | undefined): Attempt {
  const before = process.env[CASTING_INK_REFERENCE_SCOPE_ENV];
  if (value === undefined) delete process.env[CASTING_INK_REFERENCE_SCOPE_ENV];
  else process.env[CASTING_INK_REFERENCE_SCOPE_ENV] = value;
  try {
    validateEnv();
    console.log(`BOOTS    ${label}`);
    return { booted: true, message: "" };
  } catch (error) {
    const message = (error as Error).message;
    console.log(`REFUSES  ${label}\n           ${message}`);
    return { booted: false, message };
  } finally {
    if (before === undefined) delete process.env[CASTING_INK_REFERENCE_SCOPE_ENV];
    else process.env[CASTING_INK_REFERENCE_SCOPE_ENV] = before;
  }
}

const absent = attempt("absent — today's production", undefined);
const off = attempt("off", "off");
const asked = attempt("users:1 — the ask", "users:1");
const wide = attempt("all", "all");

console.log("");
const failures: string[] = [];

/*
  THE POSITIVE CONTROL FIRST. If the local environment is short of something
  unrelated, every arm below "refuses" and the summary would read PROVEN while
  proving nothing — five arms all refusing for a reason nobody read is a scar
  this campaign already carries.
*/
if (!absent.booted) failures.push("the ABSENT arm did not boot — this environment is short of something else, and no refusal below can be trusted");
if (!off.booted) failures.push("`off` did not boot — absent and off must behave identically");

/* And each refusal must be THE TAKE'S refusal, not a parent's and not a typo's. */
for (const [label, arm] of [["users:1", asked], ["all", wide]] as const) {
  if (arm.booted) failures.push(`${label} BOOTED — the guard is not wired into validateEnv(), or it no longer refuses`);
  else if (!/tattoo TAKE does not exist/.test(arm.message)) {
    failures.push(`${label} refused for the WRONG REASON: ${arm.message.slice(0, 120)}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.log(`FAILED  ${failure}`);
  console.log("\n[boot] NOT PROVEN");
} else {
  console.log("[boot] PROVEN — absent and off boot; users:1 and all are refused by the TAKE guard, through validateEnv() itself.");
}

process.exit(failures.length === 0 ? 0 : 1);
