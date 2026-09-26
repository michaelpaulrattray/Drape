import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BOOT_GOVERNED_FLOOR,
  BOOT_GOVERNED_ENV_NAMES,
  bootOwnerOf,
  bootSettingClaims,
  foldBootClaims,
} from "../scripts/lib/governedBootSettings.mts";
import {
  PRODUCTION_FLAG_POSITIONS,
  comparePositions,
  isGovernedName,
} from "../scripts/lib/productionFlagPositions.mts";

/**
 * THE PUSH GATE CAN SEE A SETTING WHOSE NAME LACKS `SCOPE` OR `STAGE` (#1174).
 *
 * The hole, and it was live: `GOVERNED_NAME` was a name pattern, so every other
 * setting the product reads at boot was invisible to the gate **in both
 * directions** — it could not say one was set when the record said nothing about
 * it, and it could not say the record was wrong about one.
 *
 * ⚠ **Measured at the live service 2026-09-26: `CASTING_ROLL_ENGINE_MODEL` is
 * SET to `sunburst`** — it decides which image model every roll on his account
 * renders on, his own word chose it, and the gate could not see it.
 *
 * # THE SECOND READER IS A TEXT SCAN, AND IT IS THE POINT OF THIS FILE
 *
 * `governedBootSettings.mts` IMPORTS the three declarations, which is right:
 * a hand-typed second list is what produced the card. But a reader that imports
 * cannot notice a declaration that has quietly stopped being read at boot, and
 * an import that resolves is not proof the name is still in the file a human
 * would open. So the arms below re-read those same three files as TEXT and
 * refuse if the two readings disagree — different resolver, neither inheriting
 * the other's blind spot, which is the shape `productionFlagPositions.test.ts`
 * already uses for the flag population.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceOf = (relative: string) => readFileSync(path.join(repoRoot, relative), "utf8");

/** `NUMERIC_ENV_VARS = { NAME: 5, ... }` — the keys, scanned rather than imported. */
function numericNamesByScan(): string[] {
  const source = sourceOf("server/_core/env.ts");
  const block = /export const NUMERIC_ENV_VARS = \{([\s\S]*?)\n\} as const;/.exec(source);
  if (!block) throw new Error("NUMERIC_ENV_VARS is not declared the way this scan reads it");
  return [...block[1]!.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*:/gm)].map((hit) => hit[1]!);
}

/** `FAL_ALLOWANCES = [ { env: "NAME", ... } ]` plus the ceiling's own constant. */
function falNamesByScan(): string[] {
  const source = sourceOf("server/castingV2/falBudget.ts");
  const block = /export const FAL_ALLOWANCES: readonly FalAllowance\[\] = \[([\s\S]*?)\n\];/.exec(source);
  if (!block) throw new Error("FAL_ALLOWANCES is not declared the way this scan reads it");
  const allowances = [...block[1]!.matchAll(/env:\s*"([A-Z][A-Z0-9_]*)"/g)].map((hit) => hit[1]!);
  const ceiling = /export const FAL_ACCOUNT_CEILING_ENV = "([A-Z][A-Z0-9_]*)";/.exec(source);
  if (!ceiling) throw new Error("the fal ceiling's env name is not a declared constant any more");
  return [...allowances, ceiling[1]!];
}

function rollEngineModelByScan(): string {
  const source = sourceOf("server/castingV2/castingV2Scope.ts");
  const hit = /export const CASTING_ROLL_ENGINE_MODEL_ENV = "([A-Z][A-Z0-9_]*)";/.exec(source);
  if (!hit) throw new Error("the roll engine model's env name is not a declared constant any more");
  return hit[1]!;
}

describe("the boot-governed population", () => {
  it("⚠ CONTROL — the scan found real declarations, and each one's specimen", () => {
    /* POSITIVE CONTROLS FIRST. Every comparison below is vacuously true over an
       empty scan, which is exactly how an enumeration guard goes green while
       enumerating nothing. */
    expect(numericNamesByScan()).toContain("DAILY_GENERATION_LIMIT");
    expect(numericNamesByScan().length).toBeGreaterThanOrEqual(5);
    expect(falNamesByScan()).toContain("FAL_CONCURRENCY");
    expect(falNamesByScan()).toContain("FAL_ACCOUNT_CEILING");
    expect(rollEngineModelByScan()).toBe("CASTING_ROLL_ENGINE_MODEL");
  });

  it("the imported population and the text scan agree, name for name", () => {
    const scanned = [...numericNamesByScan(), ...falNamesByScan(), rollEngineModelByScan()].sort();
    expect([...BOOT_GOVERNED_ENV_NAMES]).toEqual(scanned);
  });

  it("every name says where it is read at boot", () => {
    for (const name of BOOT_GOVERNED_ENV_NAMES) {
      expect(bootOwnerOf(name), `${name} is governed and nothing says why`).toBeTruthy();
    }
    /* And a name that is NOT governed has no owner — or the reader would answer
       for anything it was handed. */
    expect(bootOwnerOf("DATABASE_URL")).toBeNull();
    expect(bootOwnerOf("CASTING_V2_SCOPE")).toBeNull();
  });

  it("⚠ no credential can arrive here, which is what makes printing the value safe", () => {
    /* The rite's flag block prints the VALUE of every name on the position
       table, so the allowlist's whole safety argument is that its names are
       known-harmless (`never-filter-a-secret-listing`: a redaction rule fails
       OPEN). A derived population must therefore be held to that too. */
    for (const name of BOOT_GOVERNED_ENV_NAMES) {
      expect(name, "a secret-shaped name must never become governed").not.toMatch(
        /KEY|SECRET|TOKEN|PASSWORD|URL|ENDPOINT|CLIENT_ID/,
      );
    }
  });

  it("⚠ REFUSES a short collection rather than returning one — driven, because it cannot occur", () => {
    /*
      ⚠ **THE SABOTAGE RUN BOUGHT THIS ARM AND ITS SIBLING BELOW.** Both
      refusals are unreachable at the real tree — the population is complete and
      no name is claimed twice — so neutering either one changed nothing any arm
      could see and the suite stayed green at 27 with the guard gone. A guard
      reachable only through data that never occurs is not a guard (working law
      3), so the fold is its own function and is driven with data that does.

      What a short list would cost: the settings it dropped stop being governed
      and the gate still reports a clean block — a green over nothing.
    */
    const short = bootSettingClaims().slice(0, 3);
    expect(() => foldBootClaims(short)).toThrow(/under the floor of/);
    /* POSITIVE CONTROL — the same fold passes the real claims, so the refusal is
       about the SIZE and not about the function refusing everything. */
    expect(foldBootClaims(bootSettingClaims()).length).toBe(BOOT_GOVERNED_ENV_NAMES.length);
    /* And a low floor lets the short list through, which pins that the number is
       what decides it rather than some other property of the slice. */
    expect(foldBootClaims(short, 3)).toHaveLength(3);
  });

  it("⚠ REFUSES one variable claimed by two boot owners — driven, because it cannot occur", () => {
    /* `NUMERIC_ENV_VARS`'s own docblock refuses this by hand today ("the fal
       allowances are deliberately not here, two owners for one variable would be
       worse than the defect this table fixes"). This is that rule mechanised,
       and it matters because the boot behaviour would be ambiguous — which
       reader wins? — and no single position could describe it. */
    const doubled = [
      ...bootSettingClaims(),
      { name: "FAL_CONCURRENCY", from: "NUMERIC_ENV_VARS" },
    ];
    expect(() => foldBootClaims(doubled)).toThrow(/two boot owners/);
    /* And the message names BOTH owners, or a reader cannot find the second one. */
    try {
      foldBootClaims(doubled);
    } catch (error) {
      expect((error as Error).message).toContain("FAL_ALLOWANCES");
      expect((error as Error).message).toContain("NUMERIC_ENV_VARS");
    }
  });

  it("the floor is real and the population clears it", () => {
    expect(BOOT_GOVERNED_FLOOR).toBeGreaterThan(5);
    expect(BOOT_GOVERNED_ENV_NAMES.length).toBeGreaterThanOrEqual(BOOT_GOVERNED_FLOOR);
    /* No duplicates — two boot owners for one variable is a state no position
       can describe, and the collector refuses it. */
    expect(new Set(BOOT_GOVERNED_ENV_NAMES).size).toBe(BOOT_GOVERNED_ENV_NAMES.length);
  });
});

describe("the gate can now see them", () => {
  it("⚠ CASTING_ROLL_ENGINE_MODEL is governed — the live specimen", () => {
    expect(isGovernedName("CASTING_ROLL_ENGINE_MODEL")).toBe(true);
    /* Its sibling was only ever governed because the NAME happened to carry
       SCOPE, which is the accident this card is about. */
    expect(isGovernedName("CASTING_ROLL_ENGINE_SCOPE")).toBe(true);
  });

  it("⚠ NEGATIVE CONTROL — it did NOT become 'govern every variable'", () => {
    /* The card is emphatic: the service holds 67 variables and most are
       credentials. A gate that had to carry `DATABASE_URL` would be a worse
       thing than the gap. */
    for (const name of ["DATABASE_URL", "JWT_SECRET", "GEMINI_API_KEY", "R2_SECRET_ACCESS_KEY", "FAL_KEY"]) {
      expect(isGovernedName(name), `${name} must never be governed`).toBe(false);
    }
    /* And the two deliberately-out settings, each with its own reason in the
       module: PORT catches its own empty string before the server listens, and
       LOG_LEVEL changes what is written rather than what is done. */
    expect(isGovernedName("PORT")).toBe(false);
    expect(isGovernedName("LOG_LEVEL")).toBe(false);
  });

  it("says nothing about a concurrency-shaped name the code does not declare", () => {
    /* The narrowness, driven from the other end: the population is what the
       product READS at boot, never everything that looks like a setting. A
       variable somebody invents on the service is not governed by resemblance,
       and its value is never printed. */
    const verdict = comparePositions([{ name: "SOME_NEW_CONCURRENCY", value: "9" }]);
    expect(verdict.mismatches.some((line) => line.includes("SOME_NEW_CONCURRENCY"))).toBe(false);
    expect(verdict.block.some((line) => line.includes("SOME_NEW_CONCURRENCY"))).toBe(false);

    /* And every governed name really does have a row, which is the property that
       makes "absent from the table" unreachable for this population rather than
       merely unlikely. */
    for (const governed of BOOT_GOVERNED_ENV_NAMES) {
      expect(governed in PRODUCTION_FLAG_POSITIONS, `${governed} has no row`).toBe(true);
    }
  });

  it("reports a boot setting standing somewhere other than the record says", () => {
    const verdict = comparePositions([{ name: "FAL_CONCURRENCY", value: "12" }]);
    const line = verdict.mismatches.find((entry) => entry.startsWith("FAL_CONCURRENCY"));
    expect(line, "a fal allowance moved on the service and the gate said nothing").toBeTruthy();
    expect(line).toContain("`12`");
    expect(line).toContain("`off`");
  });

  it("⚠ the model's recorded position is the one READ at the service, not a default", () => {
    /* It is `sunburst` because that is what production holds — measured
       2026-09-26 with an allowlist by exact name. A row carrying a guessed
       position is a row that agrees with nothing. */
    expect(PRODUCTION_FLAG_POSITIONS.CASTING_ROLL_ENGINE_MODEL!.position).toBe("sunburst");
    const agrees = comparePositions([{ name: "CASTING_ROLL_ENGINE_MODEL", value: "sunburst" }]);
    expect(agrees.mismatches.some((line) => line.startsWith("CASTING_ROLL_ENGINE_MODEL"))).toBe(false);
    const flipped = comparePositions([{ name: "CASTING_ROLL_ENGINE_MODEL", value: "flare" }]);
    expect(flipped.mismatches.some((line) => line.startsWith("CASTING_ROLL_ENGINE_MODEL"))).toBe(true);
  });

  it("⚠ an unset boot setting is verified rather than skipped — that is the whole point of the rows", () => {
    /* "They are all unset today" is the argument FOR them: it is exactly the
       fact four documents got wrong about INK_PLATE_CONCURRENCY, where a live
       boot line reading `ink plates 1` was equally true of set-to-1 and of
       unset-defaulting-to-1. */
    const unsetToday = BOOT_GOVERNED_ENV_NAMES.filter(
      (name) => PRODUCTION_FLAG_POSITIONS[name]!.position === "off",
    );
    expect(unsetToday.length).toBeGreaterThan(5);
    /* A service holding NONE of them agrees with the record, and the block still
       prints a line for each — a verified `<unset>` rather than a silence. */
    const clean = comparePositions([{ name: "CASTING_V2_SCOPE", value: "all" }]);
    for (const name of unsetToday) {
      expect(clean.mismatches.some((line) => line.startsWith(`${name}:`))).toBe(false);
      expect(clean.block.some((line) => line.includes(`${name}=<unset>`))).toBe(true);
    }
  });

  it("every boot row carries a reason thick enough to be one", () => {
    for (const name of BOOT_GOVERNED_ENV_NAMES) {
      const row = PRODUCTION_FLAG_POSITIONS[name]!;
      expect(row.why.length, `${name}'s reason is too thin`).toBeGreaterThan(40);
      expect(row.why, `${name} must say where it is read at boot`).toMatch(/boot/i);
    }
  });
});
