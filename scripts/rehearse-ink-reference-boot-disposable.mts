/**
 * DRIVE THE INK-REFERENCE BOOT CHECK THROUGH `validateEnv()` ITSELF.
 *
 * `inkReferenceScope.test.ts` proves the coverage rules REFUSE. It cannot prove
 * they are CALLED — and a control nobody invoked is not a control (invariant 7,
 * and the reason four of them are named in `CLAUDE.md` as inert). The unit test
 * and this script fail for different reasons and neither substitutes.
 *
 * # ⚠ WHY THIS SCRIPT WAS REWRITTEN RATHER THAN DELETED
 *
 * Its first subject was `INK_REFERENCE_TAKE_BUILT`, the guard that refused the
 * flag while nothing read a placement out of her sentence. **The take landed and
 * the guard was deleted in that same commit, as its own message ordered** — and
 * deleting the only thing this script watched, then deleting the script, is
 * precisely how a live call site stops being watched by anybody. The call site
 * did not change; only which refusal proves it is reachable.
 *
 * So the arms now aim at the PARENT COVERAGE, which is the only thing left
 * between this flag and the road:
 *
 *   ABSENT                          must BOOT — today's production
 *   off                             must BOOT — the negative control
 *   users:1, attach off             must REFUSE, naming the ATTACH DOOR
 *   users:1, attach users:1         must BOOT — a covered user is admitted
 *
 * The third arm is what proves the wire. If somebody deletes the call in
 * `_core/env.ts`, the unit test stays green and this goes red.
 *
 *   npx tsx scripts/rehearse-ink-reference-boot-disposable.mts
 *
 * It reads only. It sets nothing outside this process, touches no database, and
 * writes nothing anywhere.
 */
import "dotenv/config";
import { validateEnv } from "../server/_core/env.js";
import {
  CASTING_INK_REFERENCE_SCOPE_ENV,
  CASTING_REFERENCE_ATTACH_SCOPE_ENV,
} from "../server/castingV2/castingV2Scope.js";

type Attempt = { booted: boolean; message: string };

function attempt(label: string, scope: string | undefined, attach: string | undefined): Attempt {
  const before = {
    scope: process.env[CASTING_INK_REFERENCE_SCOPE_ENV],
    attach: process.env[CASTING_REFERENCE_ATTACH_SCOPE_ENV],
  };
  const set = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };
  set(CASTING_INK_REFERENCE_SCOPE_ENV, scope);
  set(CASTING_REFERENCE_ATTACH_SCOPE_ENV, attach);
  try {
    validateEnv();
    console.log(`BOOTS    ${label}`);
    return { booted: true, message: "" };
  } catch (error) {
    const message = (error as Error).message;
    console.log(`REFUSES  ${label}\n           ${message}`);
    return { booted: false, message };
  } finally {
    set(CASTING_INK_REFERENCE_SCOPE_ENV, before.scope);
    set(CASTING_REFERENCE_ATTACH_SCOPE_ENV, before.attach);
  }
}

const absent = attempt("absent — today's production", undefined, undefined);
const off = attempt("off", "off", undefined);
const uncovered = attempt("users:1 with the attach door shut — the wire's own arm", "users:1", "off");
const covered = attempt("users:1 with the attach door open to her", "users:1", "users:1");

console.log("");
const failures: string[] = [];

/*
  THE POSITIVE CONTROL FIRST. If the local environment is short of something
  unrelated, every arm below "refuses" and the summary would read PROVEN while
  proving nothing — arms all refusing for a reason nobody read is a scar this
  campaign already carries.
*/
if (!absent.booted) failures.push("the ABSENT arm did not boot — this environment is short of something else, and no refusal below can be trusted");
if (!off.booted) failures.push("`off` did not boot — absent and off must behave identically");

if (uncovered.booted) {
  failures.push("users:1 with the attach door SHUT booted — the coverage check is not wired into validateEnv()");
} else if (!/CASTING_REFERENCE_ATTACH_SCOPE is off/.test(uncovered.message)) {
  failures.push(`the uncovered arm refused for the WRONG REASON: ${uncovered.message.slice(0, 140)}`);
}

/*
  AND THE ADMITTING ARM, which is not decoration: a check that refused every
  non-off scope would pass the arm above and make the flag unopenable, which is
  a different bug wearing this one's clothes.
*/
if (!covered.booted) {
  failures.push(`a COVERED user was refused — the flag cannot be opened at all: ${covered.message.slice(0, 140)}`);
}

if (failures.length > 0) {
  for (const failure of failures) console.log(`FAILED  ${failure}`);
  console.log("\n[boot] NOT PROVEN");
} else {
  console.log("[boot] PROVEN — absent and off boot; an uncovered user is refused BY NAME through validateEnv() itself; a covered one is admitted.");
}

process.exit(failures.length === 0 ? 0 : 1);
