/**
 * DRIVE THE BORN-INK BOOT CHECK THROUGH `validateEnv()` ITSELF — 7b(a).
 *
 * `castingV2Scope.test.ts` proves the coverage rules REFUSE. It cannot prove
 * they are CALLED — and a control nobody invoked is not a control (invariant 7,
 * and the reason four of them are named in `CLAUDE.md` as inert). The unit test
 * and this script fail for different reasons and neither substitutes.
 *
 *   ABSENT                            must BOOT — today's production
 *   off                               must BOOT — the negative control
 *   users:1, casting off              must REFUSE, naming CASTING_V2_SCOPE
 *   all, casting users:1              must REFUSE — a child cannot outrun its
 *                                     parent
 *   users:2, casting users:1          must REFUSE, NAMING THE UNCOVERED USER
 *   users:1, casting users:1          must BOOT — a covered user is admitted
 *
 * The middle four are what prove the wire. If somebody deletes the call in
 * `_core/env.ts`, the unit test stays green and all four go red.
 *
 * # EACH ARM ASSERTS ITS OWN REASON — AND THIS SCRIPT LEARNED THAT THE HARD WAY
 *
 * Five rehearsal arms once all refused on `missing columns` while two of them
 * were inert and the summary read REHEARSED; a regex of merely `/FAL_KEY/` once
 * printed PROVEN over a check that could never fire.
 *
 * ⚠ **The first run of THIS script did it again, in the same shift the warning
 * was copied in.** The casting-off arm matched `/CASTING_V2_SCOPE is off/` — and
 * the sentence it matched was `CASTING_SEGMENTS_SCOPE cannot be enabled while
 * CASTING_V2_SCOPE is off`. A SIBLING flag refused first, this flag's own check
 * never ran, and the summary printed REHEARSED.
 *
 * Two repairs, and both are needed:
 *
 *   every arm names THIS FLAG    the regex requires `CASTING_BORN_INK_SCOPE`,
 *                                so a sibling's refusal can never stand in
 *   the arm runs SOLO            every other `CASTING_*_SCOPE` in the process is
 *                                turned off for the attempt, DERIVED from
 *                                `process.env` rather than listed — a list of
 *                                siblings is the parallel copy that goes stale
 *                                the next time a flag is added, which is exactly
 *                                the population this failure came from
 *
 *   npx tsx scripts/rehearse-born-ink-boot-disposable.mts
 *
 * It reads only. It sets nothing outside this process, touches no database, and
 * writes nothing anywhere.
 */
import "dotenv/config";
import { validateEnv } from "../server/_core/env.js";
import {
  CASTING_BORN_INK_SCOPE_ENV,
  CASTING_V2_SCOPE_ENV,
} from "../server/castingV2/castingV2Scope.js";

type Attempt = { booted: boolean; message: string };

function set(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

/**
 * Every OTHER casting scope in this process — derived, never listed.
 *
 * A named list of siblings is the second copy that goes stale the next time
 * somebody adds a flag, and the failure this function exists to prevent came
 * from exactly that population. The two this script is about are excluded by
 * name because they are its subject.
 */
function otherCastingScopes(): string[] {
  return Object.keys(process.env).filter((key) => (
    /^CASTING_[A-Z0-9_]*_SCOPE$/.test(key)
    && key !== CASTING_BORN_INK_SCOPE_ENV
    && key !== CASTING_V2_SCOPE_ENV
  ));
}

function attempt(label: string, scope: string | undefined, casting: string | undefined): Attempt {
  const before = new Map<string, string | undefined>([
    [CASTING_BORN_INK_SCOPE_ENV, process.env[CASTING_BORN_INK_SCOPE_ENV]],
    [CASTING_V2_SCOPE_ENV, process.env[CASTING_V2_SCOPE_ENV]],
  ]);
  /* SOLO: a sibling that refuses first makes this flag's own check invisible,
     and the summary reads REHEARSED over a control that never ran. */
  for (const key of otherCastingScopes()) {
    before.set(key, process.env[key]);
    set(key, "off");
  }
  set(CASTING_BORN_INK_SCOPE_ENV, scope);
  set(CASTING_V2_SCOPE_ENV, casting);
  try {
    validateEnv();
    console.log(`BOOTS    ${label}`);
    return { booted: true, message: "" };
  } catch (error) {
    const message = (error as Error).message;
    console.log(`REFUSES  ${label}\n           ${message}`);
    return { booted: false, message };
  } finally {
    for (const [key, value] of before) set(key, value);
  }
}

/* The environment as it stands is the baseline every arm departs from. */
const castingNow = process.env[CASTING_V2_SCOPE_ENV];
console.log(`[baseline] ${CASTING_V2_SCOPE_ENV}=${castingNow ?? "absent"}\n`);

const absent = attempt("absent — today's production", undefined, castingNow);
const off = attempt("off", "off", castingNow);
const noCasting = attempt("users:1 with casting OFF — the wire's own arm", "users:1", "off");
const outrun = attempt("all while casting is users:1 — a child cannot outrun its parent", "all", "users:1");
const uncovered = attempt("users:2 while casting is users:1 — names the uncovered user", "users:2", "users:1");
const covered = attempt("users:1 with casting open to her", "users:1", "users:1");

console.log("");
const failures: string[] = [];

/*
  THE POSITIVE CONTROL FIRST. If this environment is short of something
  unrelated, every arm below "refuses" and the summary would read PROVEN while
  proving nothing — arms all refusing for a reason nobody read is a scar this
  campaign already carries.
*/
if (!absent.booted) {
  failures.push(
    "the ABSENT arm did not boot — this environment is short of something else, "
    + "and no refusal below can be trusted",
  );
}
if (!off.booted) failures.push("`off` did not boot — absent and off must behave identically");

if (noCasting.booted) {
  failures.push("users:1 with casting OFF booted — the coverage check is not wired into validateEnv()");
} else if (!new RegExp(
  `^${CASTING_BORN_INK_SCOPE_ENV} cannot be enabled while ${CASTING_V2_SCOPE_ENV} is off`,
).test(noCasting.message)) {
  /* ⚠ THE LINE THAT DID THE WORK. A regex of merely `/CASTING_V2_SCOPE is off/`
     matched `CASTING_SEGMENTS_SCOPE`'s message and printed REHEARSED over a
     check that never ran. The arm names THIS flag or it proves nothing. */
  failures.push(`the casting-off arm refused for the WRONG REASON: ${noCasting.message.slice(0, 160)}`);
}

if (outrun.booted) {
  failures.push('"all" booted while its parent named specific users — the child outran the parent');
} else if (!new RegExp(`^${CASTING_BORN_INK_SCOPE_ENV} cannot be "all" while`).test(outrun.message)) {
  failures.push(`the outrun arm refused for the WRONG REASON: ${outrun.message.slice(0, 160)}`);
}

if (uncovered.booted) {
  failures.push("users:2 booted while only user 1 has casting — an uncovered user was admitted");
} else if (!new RegExp(`^${CASTING_BORN_INK_SCOPE_ENV} names users outside .*: *2`).test(uncovered.message)) {
  /* The user ID has to be IN the message: "someone is uncovered" is not a
     finding an operator can act on, and this is the line that proves the
     validator says which. */
  failures.push(`the uncovered arm did not name the user: ${uncovered.message.slice(0, 160)}`);
}

if (!covered.booted) {
  failures.push(`a covered user was refused: ${covered.message.slice(0, 200)}`);
}

console.log(failures.length === 0
  ? "REHEARSED — the boot guard is wired, and every arm refused for its own reason."
  : `NOT REHEARSED — ${failures.length} problem(s):\n  · ${failures.join("\n  · ")}`);
process.exit(failures.length === 0 ? 0 : 1);
