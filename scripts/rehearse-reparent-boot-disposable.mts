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
 * 3 · THE POINT: drive `CASTING_REPAINT_SCOPE` dark and the gate must NOT
 *     refuse. This is the only arm here that fails on the tree as it was.
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

let failures = 0;
function expectPass(label: string, overrides: Record<string, string | undefined>): void {
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
  "\n2 · NEGATIVE CONTROLS — the NEW fence must be able to refuse, BY NAME."
  + "\n    The repaint is driven `off` in each so its own fence cannot fire first.",
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
  CASTING_REPAINT_SCOPE: "off",
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

console.log(
  "\n3 · THE ARM THAT IS THE POINT — the repaint no longer gates boot."
  + "\n    This is the only arm here that fails on the tree as it was.",
);
expectPass("production's positions with CASTING_REPAINT_SCOPE off", {
  CASTING_REPAINT_SCOPE: "off",
});
expectPass("production's positions with CASTING_REPAINT_SCOPE absent", {
  CASTING_REPAINT_SCOPE: undefined,
});

console.log(
  "\n" + (failures === 0
    ? "REHEARSAL GREEN — 6 arms, 0 failures. Production boots after the re-parent, each"
      + " child's new fence refuses by its own name, and the repaint is no longer in any"
      + " child's chain."
    : "REHEARSAL RED — " + failures + " arm(s) failed. Do NOT ship slice 4a."),
);

process.exit(failures === 0 ? 0 : 1);
