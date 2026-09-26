/**
 * SABOTAGE FOR #509 PART 2 — can these suites actually fail?
 *
 * Every case edits ONE line of production source, runs the suites, and requires
 * a RED. The verdict is keyed on the TALLY rather than on "nothing survived":
 * a case list every arm clears reads as 100% caught, and a runner whose vitest
 * invocation is broken reports exactly the same thing as a perfect guard
 * (memory: `sabotage-runner-needs-its-own-control`).
 *
 * Four protections against a green that means nothing:
 *   · a CONTROL run first, on the untouched tree — it must be GREEN, and its
 *     arm count is recorded, so a runner that runs nothing is visible;
 *   · every anchor is asserted UNIQUE in its file before it is replaced;
 *   · every edit is asserted to have CHANGED the bytes;
 *   · every file is restored and asserted byte-identical afterwards.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const SUITES = [
  "server/productEventCatalogue.test.ts",
  "server/productEvents.test.ts",
  "server/productEventWire.test.ts",
  "server/productEventOptionsDeclared.test.ts",
  "server/directOperationProductEvents.test.ts",
];

interface Edit {
  file: string;
  from: string;
  to: string;
}

interface Case {
  name: string;
  file: string;
  from: string;
  to: string;
  /**
   * A SECOND edit applied in the same case.
   *
   * ⚠ It exists for one shape and it earns its keep: a protection that is
   * REDUNDANT while another protection holds cannot be sabotaged on its own —
   * removing it changes nothing, so the suite is green and the runner reports a
   * survivor that is not a blind spot. Removing BOTH is the only edit that can
   * prove the pair. See the capture-placement case.
   */
  also?: Edit;
}

const CASES: Case[] = [
  /* ── the control: what may leave the building ─────────────────────────── */
  {
    name: "the gate stops refusing a malformed declared property",
    file: "shared/productEventCatalogue.ts",
    from: "      return { verdict: \"refuse\", key, reason: \"wrong shape\" };",
    to: "      continue;",
  },
  {
    name: "an undeclared property is passed through instead of dropped",
    file: "shared/productEventCatalogue.ts",
    from: "      dropped.push(key);\n      continue;",
    to: "      projected[key] = value as number | boolean | string;\n      continue;",
  },
  {
    name: "a vocabulary accepts any string at all",
    file: "shared/productEventCatalogue.ts",
    from: "      return typeof value === \"string\" && shape.allowed.includes(value);",
    to: "      return typeof value === \"string\";",
  },
  {
    name: "a count accepts a negative number",
    file: "shared/productEventCatalogue.ts",
    from: "  return typeof value === \"number\" && Number.isSafeInteger(value) && value >= 0;",
    to: "  return typeof value === \"number\";",
  },
  {
    name: "the world is accepted without its shape being checked",
    file: "shared/productEventCatalogue.ts",
    from: "  return value === \"local\" || value === \"node:production\" || /^railway:[\\w.-]{1,64}$/.test(value);",
    to: "  return true;",
  },
  {
    name: "the release is accepted without being a sha",
    file: "shared/productEventCatalogue.ts",
    from: "  return typeof value === \"string\" && /^[0-9a-f]{7,40}$/.test(value);",
    to: "  return typeof value === \"string\";",
  },
  {
    name: "an unknown event name is allowed through",
    file: "shared/productEventCatalogue.ts",
    from: "    return { verdict: \"refuse\", key: name, reason: \"unknown event\" };",
    to: "    return { verdict: \"send\", properties: {}, dropped: [] };",
  },
  {
    name: "an operation kind loses its English noun",
    file: "shared/productEventCatalogue.ts",
    from: "  \"castingV2.sign\": \"sign\",",
    to: "",
  },
  {
    name: "a noun is left behind that no operation kind has",
    file: "shared/productEventCatalogue.ts",
    from: "  \"castingV2.roll\": \"roll\",",
    to: "  \"castingV2.roll\": \"roll\",\n  \"castingV2.ghost\": \"ghost\",",
  },
  {
    name: "a noun leaks the pipeline's own vocabulary",
    file: "shared/productEventCatalogue.ts",
    from: "  \"castingV2.refine\": \"refine\",",
    to: "  \"castingV2.refine\": \"castingV2.refine\",",
  },
  {
    name: "the error vocabulary loses the code a failing provider returns",
    file: "shared/productEventCatalogue.ts",
    from: "  \"SERVICE_UNAVAILABLE\",",
    to: "",
  },
  {
    name: "an unknown error code becomes free text instead of a named unknown",
    file: "shared/productEventCatalogue.ts",
    from: "  return (PRODUCT_EVENT_ERROR_CODES as readonly string[]).includes(code) ? code : UNRECOGNISED;",
    to: "  return code;",
  },

  /* ── the transport ────────────────────────────────────────────────────── */
  {
    name: "the transport sends the caller's object instead of the projected one",
    file: "server/monitoring/productEvents.ts",
    from: "      properties: verdict.properties,",
    to: "      properties: properties as Record<string, unknown>,",
  },
  {
    /*
      ⚠ THIS CASE WAS REWRITTEN AFTER IT SURVIVED ONCE, AND THE FIRST SHAPE IS
      WORTH RECORDING. It deleted the `return;` alone, which leaves the refuse
      branch falling into `verdict.properties` — a field the narrowed type does
      not have. That is a TYPE error (`pnpm check` reddens it) and at runtime it
      throws inside the transport's own catch-all, so no event is sent and the
      arm passes for a reason that has nothing to do with the guard. A sabotage
      whose edit cannot compile is not a test of a suite. This shape is
      type-valid and genuinely sends.
    */
    name: "a refusal is sent anyway",
    file: "server/monitoring/productEvents.ts",
    from: "      state.refused += 1;",
    to: "      state.refused += 1;\n      client.capture({ distinctId: String(userId), event: name, properties: properties as Record<string, unknown> });",
  },
  {
    name: "the boot line claims a stream that is not configured",
    file: "server/monitoring/productEvents.ts",
    from: "    return \"[Events] POSTHOG_API_KEY is not set — what people do in the product is recorded nowhere\";",
    to: "    return `[Events] recording to PostHog · ${world} · ${where}`;",
  },
  {
    name: "a blank key is treated as a real one",
    file: "server/monitoring/productEvents.ts",
    from: "  return (process.env.POSTHOG_API_KEY ?? \"\").trim();",
    to: "  return process.env.POSTHOG_API_KEY ?? \"\";",
  },
  {
    name: "geo resolution is left on",
    file: "server/monitoring/productEvents.ts",
    from: "    disableGeoip: true,",
    to: "    disableGeoip: false,",
  },
  {
    name: "an option the SDK has never heard of is sent",
    file: "server/monitoring/productEvents.ts",
    from: "    personProfiles: \"identified_only\",",
    to: "    personProfiles: \"identified_only\",\n    sendDefaultPii: false,",
  },
  {
    name: "feature flags are left on, so the SDK polls a third party on a timer",
    file: "server/monitoring/productEvents.ts",
    from: "    preloadFeatureFlags: false,",
    to: "    preloadFeatureFlags: true,",
  },
  {
    name: "the host default points somewhere else",
    file: "server/monitoring/productEvents.ts",
    from: "const DEFAULT_HOST = \"https://us.i.posthog.com\";",
    to: "const DEFAULT_HOST = \"https://app.posthog.com\";",
  },
  {
    name: "the transport throws instead of swallowing an SDK fault",
    file: "server/monitoring/productEvents.ts",
    from: "  } catch (reportingError) {\n    log.warn({ err: reportingError }, \"the product event stream threw while recording an event\");\n  }",
    to: "  } catch (reportingError) {\n    throw reportingError;\n  }",
  },
  {
    name: "the shutdown no longer drains the buffer",
    file: "server/monitoring/productEvents.ts",
    from: "    await client.shutdown(timeoutMs);",
    to: "    return;",
  },
  {
    name: "the account id is replaced by something that is not an id",
    file: "server/monitoring/productEvents.ts",
    from: "      distinctId: String(userId),",
    to: "      distinctId: `user-${userId}@example.com`,",
  },

  /* ── the seam ─────────────────────────────────────────────────────────── */
  {
    name: "a replayed request id counts as a second start",
    file: "server/casting/directOperation.ts",
    from: "      return { type: \"replay\", operationId: claim.operationId, result: claim.result };",
    to: "      captureProductEvent(\"generation started\", input.userId, { action: productNoun(input.kind) });\n      return { type: \"replay\", operationId: claim.operationId, result: claim.result };",
  },
  {
    name: "the start is not recorded at all",
    file: "server/casting/directOperation.ts",
    from: "  captureProductEvent(\"generation started\", input.userId, {\n    action: productNoun(input.kind),\n  });",
    to: "",
  },
  {
    name: "a delivery is not recorded at all",
    file: "server/casting/directOperation.ts",
    from: "  captureProductEvent(\"generation delivered\", input.userId, {\n    action: takeAction(input.operationId),\n    outcome: input.terminalStatus === \"partial\" ? \"partial\" : \"complete\",",
    to: "  void 0; ((): void => undefined)(); const _unused = {\n    action: takeAction(input.operationId),\n    outcome: input.terminalStatus === \"partial\" ? \"partial\" : \"complete\",",
  },
  {
    name: "a partial roll is reported as a whole delivery",
    file: "server/casting/directOperation.ts",
    from: "    outcome: input.terminalStatus === \"partial\" ? \"partial\" : \"complete\",",
    to: "    outcome: \"complete\",",
  },
  {
    name: "the refusal's sentence is attached to the failure event",
    file: "server/casting/directOperation.ts",
    from: "  captureProductEvent(\"generation failed\", input.userId, {\n    action: takeAction(input.operationId),\n    errorCode: productErrorCode(error.code),\n    creditsCharged: input.chargedCredits,",
    to: "  captureProductEvent(\"generation failed\", input.userId, {\n    action: takeAction(input.operationId),\n    errorCode: productErrorCode(error.code),\n    publicMessage: error.message,\n    creditsCharged: input.chargedCredits,",
  },
  {
    /*
      ⚠ THIS CASE ALSO SURVIVED ITS FIRST SHAPE, AND THAT SURVIVAL WAS THE
      RUNNER'S FAULT RATHER THAN THE SUITE'S. It appended `if (false as boolean)
      return;` after the catch — bytes changed, behaviour identical. An INERT
      EDIT is one of the four reasons a sabotage comes back green, and the only
      one that uniqueness and byte-change checks cannot see. This shape performs
      the real move: the capture goes back inside the `try` that guards the
      receipt, which is where the first draft of the production code had it.

      ⚠ AND IT SURVIVED IN THAT SHAPE TOO, FOR A THIRD REASON WORTH MORE THAN
      EITHER OF THE FIRST TWO: the placement is REDUNDANT while the transport's
      own catch-all holds. `captureProductEvent` swallows everything, so moving
      it inside the `try` genuinely changes nothing — no suite could tell the
      two apart, and none should be contrived to. The placement is defence in
      depth against a transport that CAN throw, so the only edit that can prove
      it is the one that removes both protections at once. `also` does exactly
      that. The transport's own swallow is sabotaged separately above and is
      caught on its own, so neither is resting on the other.
    */
    name: "the capture moves INSIDE the guard AND the transport stops swallowing",
    also: {
      file: "server/monitoring/productEvents.ts",
      from: "  } catch (reportingError) {\n    log.warn({ err: reportingError }, \"the product event stream threw while recording an event\");\n  }",
      to: "  } catch (reportingError) {\n    throw reportingError;\n  }",
    },
    file: "server/casting/directOperation.ts",
    from: "    await finalizeGenerationOperationSuccess(input);\n  } catch (error) {",
    to: "    await finalizeGenerationOperationSuccess(input);\n    captureProductEvent(\"generation delivered\", input.userId, {\n      action: takeAction(input.operationId),\n      outcome: input.terminalStatus === \"partial\" ? \"partial\" : \"complete\",\n      creditsCharged: input.chargedCredits,\n      creditsRefunded: input.refundedCredits,\n    });\n    return;\n  } catch (error) {",
  },
  {
    name: "an already-written receipt is counted as a fresh delivery",
    file: "server/casting/directOperation.ts",
    from: "    if (existing?.type === \"replay_success\") return;\n    await markRecoveryAfterReceiptFailure({ ...input, cause: error });",
    to: "    await markRecoveryAfterReceiptFailure({ ...input, cause: error });",
  },
  {
    name: "the remembered action is never taken, so the map grows without bound",
    file: "server/casting/directOperation.ts",
    from: "  const action = actionByOperation.get(operationId);\n  actionByOperation.delete(operationId);",
    to: "  const action = actionByOperation.get(operationId);",
  },
  {
    name: "a missing action guesses `roll` instead of saying it does not know",
    file: "server/casting/directOperation.ts",
    from: "  return action ?? UNNAMED_ACTION;",
    to: "  return action ?? \"roll\";",
  },
  {
    name: "a free pre-start answer is recorded as a paid delivery",
    file: "server/casting/directOperation.ts",
    from: "  captureProductEvent(\"generation delivered\", input.userId, {\n    action: takeAction(input.operationId),\n    outcome: \"complete\",\n    creditsCharged: 0,",
    to: "  captureProductEvent(\"generation delivered\", input.userId, {\n    action: takeAction(input.operationId),\n    outcome: \"complete\",\n    creditsCharged: 160,",
  },
];

function run(): { ok: boolean; passed: number; failed: number; output: string } {
  const result = spawnSync(
    process.execPath,
    [path.join(ROOT, "node_modules/vitest/vitest.mjs"), "run", ...SUITES],
    { cwd: ROOT, encoding: "utf8", env: { ...process.env, CI: "1" }, timeout: 600_000 },
  );
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const tests = /Tests\s+(?:(\d+) failed \| )?(\d+) passed/.exec(output);
  return {
    ok: result.status === 0,
    failed: tests?.[1] ? Number(tests[1]) : 0,
    passed: tests?.[2] ? Number(tests[2]) : 0,
    output,
  };
}

function main(): void {
  /* ── THE CONTROL, FIRST, ON THE UNTOUCHED TREE ───────────────────────── */
  const control = run();
  if (!control.ok || control.passed === 0) {
    console.error(`CONTROL IS NOT GREEN (${control.passed} passed, ${control.failed} failed) — every verdict below would be meaningless.`);
    console.error(control.output.slice(-3000));
    process.exit(1);
  }
  console.log(`CONTROL: green, ${control.passed} arms.\n`);

  let caught = 0;
  const survivors: string[] = [];

  for (const testCase of CASES) {
    const edits: Edit[] = [
      { file: testCase.file, from: testCase.from, to: testCase.to },
      ...(testCase.also ? [testCase.also] : []),
    ];
    const originals = new Map<string, string>();

    for (const edit of edits) {
      const file = path.join(ROOT, edit.file);
      if (!originals.has(file)) originals.set(file, readFileSync(file, "utf8"));
      const before = readFileSync(file, "utf8");

      const occurrences = before.split(edit.from).length - 1;
      if (occurrences !== 1) {
        console.error(`ANCHOR NOT UNIQUE (${occurrences}) for "${testCase.name}" in ${edit.file}`);
        process.exit(1);
      }

      const sabotaged = before.replace(edit.from, edit.to);
      if (sabotaged === before) {
        console.error(`EDIT CHANGED NOTHING for "${testCase.name}"`);
        process.exit(1);
      }
      writeFileSync(file, sabotaged);
    }

    let verdict: { ok: boolean; passed: number; failed: number };
    try {
      verdict = run();
    } finally {
      for (const [file, original] of originals) {
        writeFileSync(file, original);
        if (readFileSync(file, "utf8") !== original) {
          console.error(`RESTORE FAILED for ${file} — STOP, the tree is dirty.`);
          process.exit(1);
        }
      }
    }

    if (verdict.ok) {
      survivors.push(testCase.name);
      console.log(`  SURVIVED  ${testCase.name}`);
    } else {
      caught += 1;
      console.log(`  caught    ${testCase.name}`);
    }
  }

  console.log(`\nTALLY: ${caught} of ${CASES.length} caught · control ${control.passed} arms.`);
  if (survivors.length > 0) {
    console.log("SURVIVORS:");
    for (const name of survivors) console.log(`  · ${name}`);
  }
  process.exit(survivors.length === 0 ? 0 : 2);
}

main();
