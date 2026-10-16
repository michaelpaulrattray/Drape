/**
 * REHEARSE #1577 SLICE 4a AT THE REAL BOOT GATE — does production still boot
 * after the repaint's children were re-parented onto the reference library?
 *
 * # Why this exists rather than reasoning about it
 *
 * Slice 4a moves four boot fences from `CASTING_REPAINT_SCOPE` to
 * `CASTING_REFERENCE_LIBRARY_SCOPE`. The unit arms prove each validator in
 * isolation; they do not prove that `validateEnv()` — the function the real
 * process calls, in the order it calls things — accepts the values the live
 * service actually holds. The switch sitting of 2026-09-24 set the precedent
 * and the reason: a scope chain is where a wrong edit crash-loops a deploy, and
 * the only honest check is to drive the gate with the target values before the
 * code ships, with negative controls that must each name the right variable.
 *
 * # ⚠ TWO DEFECTS IN THIS INSTRUMENT WERE FOUND BY RUNNING IT, AND THE SECOND
 * # IS THE ONE WORTH READING
 *
 * **1 · The fixture refused for reasons that had nothing to do with slice 4a.**
 * Production holds `R7_EVIDENCE_INGEST_SCOPE` and `CASTING_CREATION_RECORD_SCOPE`
 * at `users:1`, and each refuses boot without its own configuration — so the
 * first run failed all five arms on the evidence adapter, and the second on the
 * signing key. Those are in `BASE` now.
 *
 * **2 · THE NEGATIVE CONTROLS PASSED FOR THE WRONG REASON.** Narrowing the
 * reference library under an `all` child makes the REPAINT's own fence refuse
 * too (`CASTING_REPAINT_SCOPE cannot be "all" while
 * CASTING_REFERENCE_LIBRARY_SCOPE is limited to specific users`) and it fires
 * first — and that message CONTAINS the string the arm was asserting on, so the
 * arm printed PASS over a control that never reached the fence being tested.
 * This is `CASTING_INK_CUT_SCOPE`'s recorded trap exactly: *a regex of merely
 * `/FAL_KEY/` matched `CASTING_V2_SCOPE`'s message and printed PROVEN over a
 * control that does nothing.* The repair is both halves: the repaint is driven
 * `off` so it cannot refuse at all, and every refusal arm must name **the
 * child's own variable AND the parent's**, so only the intended fence satisfies
 * it.
 *
 * # The arms
 *
 * 1 · POSITIVE: production's own positions (from
 *     `scripts/lib/productionFlagPositions.mts`, which the deploy rite compares
 *     to the live service on every push) must pass. If this throws, the next
 *     deploy crash-loops.
 * 2 · NEGATIVE, the NEW fence: with the repaint out of the picture, a narrowed
 *     reference library must refuse each child by name. A fence that cannot
 *     refuse is not a fence (invariant 7).
 *
 * ⚠ **AND ARM 3 IS GONE, WHICH CHANGES WHAT THIS FILE IS FOR — read this before
 * keeping or deleting it (the relay's finding on PR #2569).** Arm 3 was *the
 * point*: drive `CASTING_REPAINT_SCOPE` dark and the gate must not refuse. Slice
 * 4b deleted that flag, so the arm could not fail over any value and was removed
 * (the measurement is beside its own deletion below). **Slice 4a has shipped and
 * its question is answered by tracked suites, so nothing here rehearses a
 * pending slice any more.**
 *
 * **What is NOT covered anywhere else, and is the whole reason this file was
 * kept rather than deleted:** arm 1 drives the REAL `validateEnv()` with the
 * live service's WHOLE recorded position set, in the order the process calls
 * things. Seven tracked suites import `PRODUCTION_FLAG_POSITIONS` and nine call
 * `validateEnv`, and **the two sets do not intersect** — every unit arm drives
 * one fence with a fixture, and `productionBootSettings.test.ts` compares the
 * record to the code's declarations without booting it. So no suite asks *"do
 * the values the service actually holds survive the real gate together"*, which
 * is the question a crash-looping deploy answers the expensive way (the evidence
 * boot guards, 2026-07-31). Run it before any scope edit ships; it reads
 * nothing, writes nothing and spends nothing.
 *
 * Reads nothing, writes nothing, spends nothing: no database, no network, no
 * provider. It mutates `process.env` in its own process only, and the signing
 * key it uses is generated in-process and never printed.
 */
import { generateKeyPairSync } from "node:crypto";
import { validateEnv } from "../server/_core/env";
import { PRODUCTION_FLAG_POSITIONS } from "./lib/productionFlagPositions.mts";

/** A throwaway Ed25519 private JWK, made here so no key-shaped literal is ever
    written into the repository. Never printed. */
function throwawaySigningJwk(): string {
  const { privateKey } = generateKeyPairSync("ed25519");
  const jwk = privateKey.export({ format: "jwk" }) as Record<string, string>;
  return JSON.stringify({ kty: jwk.kty, crv: jwk.crv, d: jwk.d, x: jwk.x });
}

/* The non-flag variables `validateEnv` requires before it ever reaches a scope
   chain. Values are shaped, never real: this gate reads names and grammar. */
const BASE: Record<string, string> = {
  NODE_ENV: "production",
  DATABASE_URL: "mysql://u:p@example.invalid:3306/db",
  JWT_SECRET: "x".repeat(48),
  VITE_APP_ID: "rehearsal",
  STRIPE_SECRET_KEY: "sk_test_rehearsal",
  STRIPE_WEBHOOK_SECRET: "whsec_rehearsal",
  R2_ENDPOINT: "https://example.invalid",
  R2_BUCKET: "bucket",
  R2_ACCESS_KEY_ID: "id",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_PUBLIC_URL: "https://pub-example.invalid",
  FAL_KEY: "fal-rehearsal",
  OPENROUTER_API_KEY: "or-rehearsal",
  ENABLE_STORAGE_CLEANUP_WORKER: "true",
  /* Production holds R7_EVIDENCE_INGEST_SCOPE at users:1, and that scope
     REFUSES BOOT without the private adapter — defect 1 above. */
  R2_EVIDENCE_BUCKET: "evidence-bucket",
  R2_EVIDENCE_ACCESS_KEY_ID: "evidence-id",
  R2_EVIDENCE_SECRET_ACCESS_KEY: "evidence-secret",
  /* Production holds CASTING_CREATION_RECORD_SCOPE at users:1, which refuses
     boot naming this variable — defect 1 again, one flag further on. */
  CREATION_RECORD_PRIVATE_KEY: throwawaySigningJwk(),
  /* And CASTING_VOICE_SCOPE at users:1 refuses without its transport. */
  ELEVENLABS_API_KEY: "el-rehearsal",
};

/** Production's recorded flag positions, exactly as the rite reads them. */
function productionFlags(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, row] of Object.entries(PRODUCTION_FLAG_POSITIONS)) {
    const position = (row as { position: string }).position;
    /* `off` in that table means "not set on the service" as often as it means
       the literal string, and an unset variable is the honest rehearsal. */
    if (position === "off") continue;
    out[name] = position;
  }
  return out;
}

function run(overrides: Record<string, string | undefined>): string | null {
  const saved = { ...process.env };
  try {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("CASTING_") || key.startsWith("R7_") || key in BASE) {
        delete process.env[key];
      }
    }
    for (const [k, v] of Object.entries({ ...BASE, ...productionFlags(), ...overrides })) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    validateEnv();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, saved);
  }
}

/* ⚠ THE ARM COUNT IS COUNTED, NEVER TYPED — the relay's finding on PR #2569.
   The verdict line read `6 arms` while four ran, because the number was a
   literal in the sentence and every arm this file has retired left it behind.
   The PR body then CITED that line as proof of what had run. An instrument that
   states its own population is the one place a hand-typed count cannot be
   allowed: it is the sentence a reader trusts instead of re-counting. */
let failures = 0;
let arms = 0;
function expectPass(label: string, overrides: Record<string, string | undefined>): void {
  arms += 1;
  const message = run(overrides);
  if (message === null) {
    console.log("  PASS  " + label);
  } else {
    failures += 1;
    console.log("  FAIL  " + label + "\n        it refused: " + message);
  }
}

/**
 * A refusal arm must name the CHILD's variable and the PARENT's, because the
 * parent's name alone is satisfied by a different flag's refusal firing first —
 * defect 2 above, which printed PASS over a control that proved nothing.
 */
function expectRefusal(
  label: string,
  overrides: Record<string, string | undefined>,
  child: string,
): void {
  arms += 1;
  const parent = "CASTING_REFERENCE_LIBRARY_SCOPE";
  const message = run(overrides);
  if (message === null) {
    failures += 1;
    console.log("  FAIL  " + label + "\n        it ADMITTED the configuration — the fence is inert");
    return;
  }
  const names = message.includes(child) && message.includes(parent);
  if (!names) {
    failures += 1;
    console.log(
      "  FAIL  " + label + "\n        refused, but not by " + child + "'s own fence over "
      + parent + " — so this arm proves nothing:\n        " + message,
    );
    return;
  }
  console.log("  PASS  " + label + "\n        " + message);
}

console.log("REHEARSAL — #1577 slice 4a at the real validateEnv() gate\n");

console.log("1 · POSITIVE CONTROL — production's own recorded positions");
expectPass("the live service's flag positions boot", {});

console.log(
  "\n2 · NEGATIVE CONTROL — the NEW fence must be able to refuse, BY NAME,"
  + "\n    naming the child's own variable AND its parent's (defect 2 above)."
  + "\n    Every sibling is driven `off` so only the fence under test can fire.",
);
/*
  ⚠ AND EACH ARM MUST SILENCE THE OTHER CHILDREN, which is defect 2 once more
  and was caught by this instrument's own guard rather than by reading.
  Production holds CASTING_SIDE_PHRASING_SCOPE and CASTING_OPEN_LANE_SCOPE at
  `all`, so narrowing the library for the open-lane arm made SIDE PHRASING
  refuse first — a refusal naming the parent, from a fence the arm was not
  testing. Only the child under test is left armed.
*/
const SIBLINGS = {
  /* ⚠ `CASTING_SIDE_PHRASING_SCOPE: "off"` stood here and is removed with the flag
     (#1577 slice D2). The paragraph above keeps it as the SPECIMEN because the
     lesson is the instrument's, not the flag's — but there is no fence left for it
     to fire from, so silencing it would describe a refusal that cannot happen.
     ⚠ `CASTING_OPEN_LANE_SCOPE: "off"` left the same way in slice D1, and it had to
     be found TWICE: the slice itself missed it, the relay's finding on PR #2556 missed
     it, and the sweep that caught it was a grep for the NAME after the compiler had
     already said it was finished. Nothing in this file is a type -- the flag was a key
     in a string table and a string argument -- so `tsc` was always going to be silent
     about it. */
  CASTING_REFERENCE_ATTACH_SCOPE: "off",
  /* ⚠ The reference library ALREADY had children of its own before slice 4a —
     the face scan and, under it, the kept-scan table — and the face scan stands
     at `all`, so it refused first for the open-lane and attach arms. Worth
     knowing beyond this script: the re-parent moves the four onto a flag that
     is a parent to others, not onto a leaf. */
  CASTING_FACE_SCAN_SCOPE: "off",
  CASTING_SCAN_TABLE_SCOPE: "off",
  /* The attach door's own two children cannot outlive it being off. */
  CASTING_HAIR_REFERENCE_SCOPE: "off",
  CASTING_INK_REFERENCE_SCOPE: "off",
  CASTING_INK_TRANSFORM_SCOPE: "off",
  CASTING_INK_REGION_CROP_SCOPE: "off",
} as const;

const NARROWED = {
  /* ⚠ `CASTING_REPAINT_SCOPE: "off"` stood here to stop the repaint's own fence
     firing first — defect 2 above. It is removed with the flag (slice 4b): the
     variable is read by nothing now, so setting it silenced nothing and described
     a refusal that cannot happen. Driven at four values, all admitted. */
  CASTING_REFERENCE_LIBRARY_SCOPE: "users:1",
  ...SIBLINGS,
};

/*
  ⚠ THE FIRST NEGATIVE CONTROL WAS A SIDE-PHRASING `all` OVER A NARROWED LIBRARY,
  AND IT IS REMOVED WITH THE FLAG (#1577 slice D2). It is removed rather than
  re-pointed, and that is the honest act: with the fence gone the arm would have
  found no refusal and reported it as a FAILURE of slice 4a, which is a red about
  nothing — and the opposite mistake, loosening the arm until it passed, would
  have left a rehearsal that cannot fail.

  ⚠ **AND THE OPEN-LANE ARM WENT THE SAME WAY IN SLICE D1, WHICH LEAVES EXACTLY ONE.
  This paragraph said *"two arms remain"*, and for one day it was true.** The flag's
  boot fence (`validateCastingOpenLaneEnvironment`) was deleted with the flag, so the
  arm that asserted it refuses BY NAME found no refusal -- and the thing it printed
  was not a quiet pass, it was `REHEARSAL RED -- Do NOT ship slice 4a`, two days after
  slice 4a shipped. **That is this paragraph's own prediction arriving, and it was
  driven rather than reasoned**: the arm was run on `67fed3a5` and read
  *"it ADMITTED the configuration -- the fence is inert"*. Removed rather than
  re-pointed or loosened, for the reason above. **One negative control remains and the
  rehearsal's verdict still means what it says.**
*/
expectRefusal(
  "a reference-attach user outside the reference library",
  { ...NARROWED, CASTING_REFERENCE_ATTACH_SCOPE: "users:1,9" },
  "CASTING_REFERENCE_ATTACH_SCOPE",
);

/*
  ⚠ **ARM 3 — *"THE ARM THAT IS THE POINT — the repaint no longer gates boot"*,
  two `expectPass` arms driving `CASTING_REPAINT_SCOPE` `off` and absent — IS
  REMOVED, AND IT IS THE THIRD ARM OF THIS FILE TO DIE OF ITS OWN SUBJECT
  RETIRING.** `CASTING_REPAINT_SCOPE` went with the paste road in slice 4b: it is
  out of `PRODUCTION_FLAG_POSITIONS` (that row's own stamp says so at
  `productionFlagPositions.mts:121`) and out of the server, which mentions it only
  in three historical comments. So no fence reads it and no parse sees it.

  ⚠ **DRIVEN, NOT REASONED, AND THE PROBE CARRIED A POSITIVE CONTROL** — the gate
  was given the variable at four values and ADMITTED every one, including a
  malformed `users:` that its own parse refused while the flag existed, and plain
  `gibberish`; the control, a malformed `CASTING_REFERENCE_ATTACH_SCOPE`, refused
  by name in the same probe. **So the two arms could not fail over any value at
  all** — they asserted the absence of a deleted fence, which is the one assertion
  that is true of a product that never had the feature, and they were duplicates
  of arm 1 besides.

  That is the mistake the paragraph above names in its own words: *"the opposite
  mistake, loosening the arm until it passed, would have left a rehearsal that
  cannot fail."* An arm kept past its fence does not need loosening — the deletion
  of its subject loosens it, silently, and it goes on printing PASS. **The
  question it asked is not lost**: `referenceAttachScope.test.ts` › *"is no longer
  gated on the repaint flag — the point of the re-parent"* is the tracked,
  CI-visible arm for it, and `scopeParentChain.test.ts` derives every fence's
  parent from the code and holds it against the variable `validateEnv` actually
  passes — which is the stronger reading this script could only rehearse.
*/

console.log(
  "\n" + (failures === 0
    ? "REHEARSAL GREEN — " + arms + " arms, 0 failures. Production's whole recorded"
      + " position set boots through the real validateEnv(), and the one child whose"
      + " fence is still alive refuses by its own name over its own parent."
    : "REHEARSAL RED — " + failures + " of " + arms + " arm(s) failed."),
);

process.exit(failures === 0 ? 0 : 1);
