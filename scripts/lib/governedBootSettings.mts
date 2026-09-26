/**
 * THE NON-SCOPE SETTINGS THE PUSH GATE GOVERNS — DERIVED FROM THE CODE THAT
 * READS THEM AT BOOT (#1174).
 *
 * # The hole, and it was live
 *
 * `productionFlagPositions.mts` compared a written record of where our settings
 * stand against the settings the live service actually holds, and refused if
 * they disagreed — for every name matching `SCOPE` or `STAGE` and **for nothing
 * else.** So for every other setting the product reads at boot the deploy rite
 * was blind in both directions: it could not tell us one was set when the record
 * said nothing about it, and it could not tell us the record was wrong about one.
 *
 * ⚠ **Measured at the live service on 2026-09-26, and this is not a
 * hypothetical**: `CASTING_ROLL_ENGINE_MODEL` is **SET to `sunburst`** on
 * production. It decides which image model every roll on his account renders on
 * — his own word chose it ("flare is producing bad results - switch over to
 * sunburst") — and **the push gate could not see it.** Its sibling
 * `CASTING_ROLL_ENGINE_SCOPE` is governed only because the name happens to
 * contain SCOPE.
 *
 * The two earlier bites, both on #1158, both by accident:
 *
 *   1. Slice 4c's boot rehearsal passed its NEGATIVE CONTROLS for the wrong
 *      reason — allowlisting by the position table let `CASTING_ROLL_ENGINE_MODEL`
 *      fall through to the machine's own `.env`, so both controls "passed" while
 *      naming a setting with nothing to do with the work.
 *   2. Slice 4d's stated premise was false. Four places said
 *      `INK_PLATE_CONCURRENCY` *"is SET on the service"*; not one of the fal
 *      allowance variables is set on production and none ever has been. The live
 *      boot line `ink plates 1` is equally true of *set to 1* and of *unset,
 *      defaulting to 1*, and nothing on the push path could say which.
 *      (Re-measured 2026-09-26: still unset, all of them.)
 *
 * # ⚠ WHAT IS NOT PROPOSED, AND THE CARD IS EMPHATIC ABOUT IT
 *
 * **Not "govern every variable".** The service holds 67 and most are
 * credentials; the rite deliberately never prints an unrecognised value, and a
 * table that had to carry `DATABASE_URL` would be a worse thing than the gap.
 * The question is narrower: **which non-scope settings does the product READ AT
 * BOOT in a way that changes behaviour?**
 *
 * # THREE DECLARATIONS ANSWER IT, AND EACH IS A PLACE THE PRODUCT REFUSES TO BOOT
 *
 *   `NUMERIC_ENV_VARS`  — `assertNumericEnv()` reads every one at boot and
 *     (server/_core/env.ts)  throws on a malformed value, because a blank
 *                         variable turned four sites into silent outages.
 *   `FAL_ALLOWANCES`    — `assertFalBudget()` refuses to boot if the sum passes
 *     + the ceiling       the provider's ceiling or any path has no slots.
 *     (castingV2/falBudget.ts)
 *   the roll engine     — the boot gate refuses if `CASTING_ROLL_ENGINE_SCOPE`
 *     model name          names anyone and the model is unset or unknown.
 *     (castingV2/castingV2Scope.ts)
 *
 * # ⚠ IT READS THEM AS TEXT, AND THE FIRST SHAPE IMPORTED THEM — THE GATE SAID NO
 *
 * Importing the three declarations is the obvious reading of working law 4, and
 * it is what this module did first. **`server/dirtyTreeGuard.test.ts` refused
 * it**: that suite derives the DEPLOY RITE's static import graph, and pulling
 * `server/_core/env.ts` in brought **41 server modules** — the whole casting
 * scope module among them — into the graph of a script that pushes to
 * production. Every one would then have to become a `RITE_DISK_READS` entry, so
 * a founder's parked edit anywhere in that tree would block a deploy.
 *
 * So the readers are the other way round, and the assignment is the honest one:
 *
 *   **here**, on the rite's path, a TEXT SCAN of three files and nothing else;
 *   **in `server/productionBootSettings.test.ts`**, the real TypeScript
 *   declarations, IMPORTED, and held to equal this scan name for name.
 *
 * A suite can afford the import; a deploy script cannot. The two readers do not
 * share a resolver either way round, which is the property law 4 actually wants
 * — and the scan is not trusted on its own: every extractor REFUSES rather than
 * returning a short list, because a reader that can come up empty reports a
 * complete answer either way.
 *
 * ⚠ **The three paths are `RITE_DISK_READS` entries**, because this is the rite
 * reading the working tree's disk to decide something real.
 *
 * ⚠ **Every name here is safe to PRINT WITH ITS VALUE**, which is a condition of
 * being on the table at all (`never-filter-a-secret-listing`: the rite's flag
 * block is an allowlist of known-harmless names, never a redaction rule). These
 * are concurrency counts, queue depths, a daily limit and a model nickname. A
 * credential must never join them, and `PORT`/`LOG_LEVEL` are deliberately out:
 * `PORT` catches its own empty string and `findAvailablePort` throws before the
 * server listens, and `LOG_LEVEL` changes what is written, not what is done.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The three files this scan reads — named so the rite's disk-read list can quote them. */
export const BOOT_DECLARATION_PATHS = [
  "server/_core/env.ts",
  "server/castingV2/falBudget.ts",
  "server/castingV2/castingV2Scope.ts",
] as const;

function sourceOf(relative: string): string {
  return readFileSync(path.join(REPO_ROOT, relative), "utf8");
}

/**
 * The floor a derived collector must clear before its answer counts.
 *
 * ⚠ **A collector that can come up empty THROWS rather than returning a short
 * list** — the Atlas has paid for this four times over, and here a short list
 * reads as a clean gate: the settings it dropped simply stop being governed and
 * nothing says so. The figure is the three declarations at their smallest
 * credible size (six numerics, four allowances, a ceiling, a model) minus room
 * for one legitimate retirement.
 */
export const BOOT_GOVERNED_FLOOR = 10;

/** One declared name and the declaration it came from. */
export type BootSettingClaim = { readonly name: string; readonly from: string };

function refuse(what: string, file: string): never {
  throw new Error(
    `governedBootSettings: ${what} in ${file}. This reader is on the deploy rite's path and `
    + "refuses rather than returning a short list — a setting it silently dropped would stop "
    + "being governed with nothing anywhere saying so.",
  );
}

/** `NUMERIC_ENV_VARS = { NAME: 5, … } as const;` — the keys. */
export function numericEnvNames(source: string): string[] {
  const block = /export const NUMERIC_ENV_VARS = \{([\s\S]*?)\n\} as const;/.exec(source);
  if (!block) refuse("NUMERIC_ENV_VARS is not declared the way this reader reads it", BOOT_DECLARATION_PATHS[0]);
  const names = [...block[1]!.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*:/gm)].map((hit) => hit[1]!);
  if (names.length === 0) refuse("NUMERIC_ENV_VARS came back with no names", BOOT_DECLARATION_PATHS[0]);
  return names;
}

/** `FAL_ALLOWANCES = [ { env: "NAME", … } ]` plus the ceiling's own constant. */
export function falEnvNames(source: string): string[] {
  const block = /export const FAL_ALLOWANCES: readonly FalAllowance\[\] = \[([\s\S]*?)\n\];/.exec(source);
  if (!block) refuse("FAL_ALLOWANCES is not declared the way this reader reads it", BOOT_DECLARATION_PATHS[1]);
  const allowances = [...block[1]!.matchAll(/env:\s*"([A-Z][A-Z0-9_]*)"/g)].map((hit) => hit[1]!);
  if (allowances.length === 0) refuse("FAL_ALLOWANCES came back with no rows", BOOT_DECLARATION_PATHS[1]);
  const ceiling = /export const FAL_ACCOUNT_CEILING_ENV = "([A-Z][A-Z0-9_]*)";/.exec(source);
  if (!ceiling) refuse("the fal ceiling's env name is not a declared constant", BOOT_DECLARATION_PATHS[1]);
  return [...allowances, ceiling[1]!];
}

/** `CASTING_ROLL_ENGINE_MODEL_ENV = "…"` — the model gate's variable. */
export function rollEngineModelEnvName(source: string): string {
  const hit = /export const CASTING_ROLL_ENGINE_MODEL_ENV = "([A-Z][A-Z0-9_]*)";/.exec(source);
  if (!hit) refuse("the roll engine model's env name is not a declared constant", BOOT_DECLARATION_PATHS[2]);
  return hit[1]!;
}

/**
 * FOLD THE CLAIMS INTO A POPULATION, OR REFUSE — AND IT IS ITS OWN FUNCTION SO
 * IT CAN BE DRIVEN DIRECTLY.
 *
 * ⚠ **The sabotage run is why this is not three lines inside the collector**
 * (working law 3). Both refusals below are unreachable at the real tree: the
 * population is complete and no name is claimed twice, so neutering either one
 * changed nothing any arm could see and the suite stayed green with the guard
 * gone. A guard reachable only through data that never occurs is not a guard —
 * the same finding `jevCardCategory.mts`'s coverage guard records.
 *
 * The two failures are different and both are quiet:
 *
 *   a SHORT list   the settings it dropped stop being governed and the gate
 *                  still reports a clean block — a green over nothing.
 *   a name claimed the boot behaviour is ambiguous (which reader wins?) and no
 *   TWICE          single position can describe it. `NUMERIC_ENV_VARS`'s own
 *                  docblock refuses this by hand today ("the fal allowances are
 *                  deliberately not here"); this is that rule, mechanised.
 */
export function foldBootClaims(
  claims: readonly BootSettingClaim[],
  floor: number = BOOT_GOVERNED_FLOOR,
): string[] {
  const seen = new Map<string, string>();
  for (const entry of claims) {
    const first = seen.get(entry.name);
    if (first !== undefined) {
      throw new Error(
        `governedBootSettings: ${entry.name} is declared by both ${first} and ${entry.from} — `
        + "one variable, two boot owners, and no position can describe that",
      );
    }
    seen.set(entry.name, entry.from);
  }

  const names = [...seen.keys()].sort();
  if (names.length < floor) {
    throw new Error(
      `governedBootSettings: only ${names.length} boot settings were collected, under the floor of `
      + `${floor}. A short list here reads as a clean gate over ungoverned settings — `
      + "one of NUMERIC_ENV_VARS, FAL_ALLOWANCES or the roll engine model gate has moved",
    );
  }
  return names;
}

/** The claims the three declarations actually make, at this tree. */
export function bootSettingClaims(): BootSettingClaim[] {
  return [
    ...numericEnvNames(sourceOf(BOOT_DECLARATION_PATHS[0])).map((name) => ({
      name,
      from: "NUMERIC_ENV_VARS",
    })),
    ...falEnvNames(sourceOf(BOOT_DECLARATION_PATHS[1])).map((name) => ({
      name,
      from: "FAL_ALLOWANCES",
    })),
    { name: rollEngineModelEnvName(sourceOf(BOOT_DECLARATION_PATHS[2])), from: "the roll engine model gate" },
  ];
}

/**
 * Every non-scope setting the push gate governs, sorted.
 *
 * ⚠ It is computed at import time on purpose: a collector that throws must do so
 * where the rite cannot proceed past it, not lazily inside one comparison.
 */
export const BOOT_GOVERNED_ENV_NAMES: readonly string[] = foldBootClaims(bootSettingClaims());

/** Where each one is read at boot — for a message that says why it is governed. */
export function bootOwnerOf(name: string): string | null {
  const claim = bootSettingClaims().find((entry) => entry.name === name);
  if (!claim) return null;
  if (claim.from === "NUMERIC_ENV_VARS") return "assertNumericEnv() at boot";
  if (claim.from === "FAL_ALLOWANCES") {
    return name === "FAL_ACCOUNT_CEILING"
      ? "assertFalBudget()'s ceiling at boot"
      : "assertFalBudget() at boot";
  }
  return "the roll engine model gate at boot";
}
