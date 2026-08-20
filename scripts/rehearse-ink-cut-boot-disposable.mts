/**
 * DRIVE THE INK-CUT BOOT CHECK THROUGH `validateEnv()` ITSELF.
 *
 * `inkCutScope.test.ts` proves the coverage rules REFUSE. It cannot prove they
 * are CALLED — and a control nobody invoked is not a control (invariant 7, and
 * the reason four of them are named in `CLAUDE.md` as inert). The unit test and
 * this script fail for different reasons and neither substitutes.
 *
 *   ABSENT                                must BOOT — today's production
 *   off                                   must BOOT — the negative control
 *   users:1, studio off                   must REFUSE, naming the STUDIO DOOR
 *   users:1, studio users:1, no FAL_KEY   must REFUSE, naming CASTING_V2_SCOPE
 *                                         (the chain, not this flag — see below)
 *   users:1, studio users:1, FAL_KEY      must BOOT — a covered user is admitted
 *
 * The third and fourth arms are what prove the wire. If somebody deletes the
 * call in `_core/env.ts`, the unit test stays green and both of these go red.
 *
 * # ⚠ THE FAL_KEY ARM IS AIMED AT THE FACT, NOT AT THIS FLAG'S OWN VALIDATOR
 *
 * The cutter refuses rather than storing a photograph when its two questions go
 * unanswered — fail-closed, and right — so a deployment without a segmenter
 * transport would refuse EVERY upload behind this flag. `castingV2Scope.ts`
 * therefore grew a `FAL_KEY` check, **and this script is what deleted it**: the
 * arm refused, and refused on `CASTING_V2_SCOPE`'s message, because the parent
 * chain already requires the key. A check that cannot fire is a control with a
 * live reputation, which is the shape half of `CLAUDE.md`'s inert list has.
 *
 * So the arm below asserts the FACT — a keyless deployment cannot arm this flag
 * — and asserts the reason it is actually refused for. It goes red if anybody
 * removes the transport requirement upstream, which is the only way this fact
 * could stop being true.
 *
 *   npx tsx scripts/rehearse-ink-cut-boot-disposable.mts
 *
 * It reads only. It sets nothing outside this process, touches no database, and
 * writes nothing anywhere.
 */
import "dotenv/config";
import { validateEnv } from "../server/_core/env.js";
import {
  CASTING_INK_CUT_SCOPE_ENV,
  CASTING_INK_STUDIO_SCOPE_ENV,
} from "../server/castingV2/castingV2Scope.js";

type Attempt = { booted: boolean; message: string };

function set(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function attempt(
  label: string,
  scope: string | undefined,
  studio: string | undefined,
  falKey: string | undefined,
): Attempt {
  const before = {
    scope: process.env[CASTING_INK_CUT_SCOPE_ENV],
    studio: process.env[CASTING_INK_STUDIO_SCOPE_ENV],
    fal: process.env.FAL_KEY,
  };
  set(CASTING_INK_CUT_SCOPE_ENV, scope);
  set(CASTING_INK_STUDIO_SCOPE_ENV, studio);
  set("FAL_KEY", falKey);
  try {
    validateEnv();
    console.log(`BOOTS    ${label}`);
    return { booted: true, message: "" };
  } catch (error) {
    const message = (error as Error).message;
    console.log(`REFUSES  ${label}\n           ${message}`);
    return { booted: false, message };
  } finally {
    set(CASTING_INK_CUT_SCOPE_ENV, before.scope);
    set(CASTING_INK_STUDIO_SCOPE_ENV, before.studio);
    set("FAL_KEY", before.fal);
  }
}

/*
  The environment as it stands is the baseline every arm is a departure from —
  read once, never printed. A key is a secret and this script prints only
  whether one was present.
*/
const studioNow = process.env[CASTING_INK_STUDIO_SCOPE_ENV];
const falNow = process.env.FAL_KEY;
console.log(`[baseline] studio=${studioNow ?? "absent"} · FAL_KEY ${falNow ? "present" : "ABSENT"}\n`);

const absent = attempt("absent — today's production", undefined, studioNow, falNow);
const off = attempt("off", "off", studioNow, falNow);
const noStudio = attempt("users:1 with the studio door shut — the wire's own arm", "users:1", "off", falNow);
const noKey = attempt("users:1, studio open, NO FAL_KEY — refused BY THE CHAIN", "users:1", "users:1", undefined);
const covered = attempt("users:1 with the studio open to her and a key", "users:1", "users:1", falNow ?? "rehearsal-key");

console.log("");
const failures: string[] = [];

/*
  THE POSITIVE CONTROL FIRST. If the local environment is short of something
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

if (noStudio.booted) {
  failures.push("users:1 with the studio door SHUT booted — the coverage check is not wired into validateEnv()");
} else if (!new RegExp(`${CASTING_INK_STUDIO_SCOPE_ENV} is off`).test(noStudio.message)) {
  failures.push(`the uncovered arm refused for the WRONG REASON: ${noStudio.message.slice(0, 160)}`);
}

if (noKey.booted) {
  failures.push("users:1 with NO FAL_KEY booted — every upload behind the flag would refuse as unreadable");
} else if (!/CASTING_V2_SCOPE cannot be enabled unless the casting image transport/.test(noKey.message)) {
  /*
    THE ARM ASSERTS ITS OWN REASON, and this is the line that did the work. A
    regex of merely `/FAL_KEY/` matched `CASTING_V2_SCOPE`'s message and printed
    PROVEN over a check in this flag's own validator that could never fire.
    Five rehearsal arms once all refused on `missing columns` while two of them
    were inert and the summary read REHEARSED.
  */
  failures.push(`the no-key arm refused for the WRONG REASON: ${noKey.message.slice(0, 160)}`);
}

/*
  AND THE ADMITTING ARM, which is not decoration either: a check that refused
  every non-off scope would pass both arms above and make the flag unopenable,
  which is a different bug wearing this one's clothes.
*/
if (!covered.booted) {
  failures.push(`a COVERED user was refused — the flag cannot be opened at all: ${covered.message.slice(0, 160)}`);
}

if (failures.length > 0) {
  for (const failure of failures) console.log(`FAILED  ${failure}`);
  console.log("\n[boot] NOT PROVEN");
} else {
  console.log(
    "[boot] PROVEN — absent and off boot; a user outside the studio door is refused BY NAME through "
    + "validateEnv() itself; a keyless deployment is refused by the CHAIN, on CASTING_V2_SCOPE's own "
    + "message; a covered user is admitted.",
  );
}

process.exit(failures.length === 0 ? 0 : 1);
