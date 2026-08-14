/**
 * A NEW SCOPE FLAG, WITHOUT THE THIRTEEN-SITE ARCHAEOLOGY (fable-486 §d,
 * founder-approved 2026-08-14).
 *
 * Seven scope flags were added in two weeks, each touching thirteen places, and
 * the ones that matter are not the ones you remember: the PARENT-SCOPE CHECK
 * (a child scope naming a user its parent does not cover is a feature that
 * charges for a picture nobody can see) and the REHEARSAL (2026-07-31, when an
 * evidence scope flag crash-looped production because its guard had never been
 * driven with the variable shape that was about to be set).
 *
 * So this emits both, derived from the shape the shipped flags actually have —
 * `CASTING_FACE_SCAN_SCOPE` is the model, and the test regenerates that exact
 * flag and compares against the file it came from, so the template cannot
 * silently drift from what the codebase does.
 *
 * # What it does NOT do
 *
 * It writes nothing into `castingV2Scope.ts`. That file is read constantly and
 * its comments carry the reasons; a generator editing it in place would strip
 * the one thing a reader comes for. The block is printed to be placed by hand,
 * beside a docblock the author still has to write — and `HAND_SITES` names
 * every other place, so what is left is a checklist rather than a memory.
 */

export type ScopeFlagSpec = {
  /** The env var, e.g. `CASTING_FACE_SCAN_SCOPE`. */
  env: string;
  /** The identifier stem, e.g. `CastingFaceScan` → `parseCastingFaceScanScope`. */
  stem: string;
  /** The parent scope's env const, e.g. `CASTING_REFERENCE_LIBRARY_SCOPE_ENV`. */
  parentEnvConst: string;
  /** The parent's parse function, e.g. `parseCastingReferenceLibraryScope`. */
  parentParse: string;
  /** The parent's own enabled predicate, ANDed at every call site. */
  parentEnabled: string;
  /** One clause saying why the child is inert without the parent. */
  inertWithoutParent: string;
  /** The input field name the boot fence passes for the parent's raw value. */
  parentField: string;
  /**
   * What the emitted code calls its two local bindings.
   *
   * Part of the spec rather than fixed, so the test can regenerate a SHIPPED
   * flag exactly — with these the comparison is whitespace-only and there is no
   * normaliser to be wrong about. (There was: renaming both roles to one token
   * turned `child.userIds.filter(id => !parent.userIds.includes(id))` into a
   * list compared with itself, and a template checking the child against the
   * child would have matched.)
   */
  local?: string;
  parentLocal?: string;
};

/** The identifier a spec implies, so no caller spells one twice. */
export const namesOf = (spec: ScopeFlagSpec) => ({
  envConst: `${spec.env}_ENV`,
  configurationError: `${spec.stem}ScopeConfigurationError`,
  coverageError: `${spec.stem}CoverageError`,
  parse: `parse${spec.stem}Scope`,
  enabled: `capture${spec.stem}Enabled`,
  validate: `validate${spec.stem}Environment`,
});

/**
 * The block for `server/castingV2/castingV2Scope.ts`.
 *
 * Every refusal in it is one a shipped flag already makes: the parent off, the
 * child wider than a limited parent, and the child naming users the parent does
 * not cover. A flag that cannot refuse those three is a flag that lets a user
 * pay for a surface that is not there.
 */
export function scopeFlagBlock(spec: ScopeFlagSpec): string {
  const name = namesOf(spec);
  const child = spec.local ?? "child";
  const parent = spec.parentLocal ?? "parent";
  return `export const ${name.envConst} = "${spec.env}";

export class ${name.configurationError} extends Error {
  constructor() {
    super(
      \`\${${name.envConst}} must be "off", "all", or "users:" followed by unique positive integer user ids\`,
    );
    this.name = "${name.configurationError}";
  }
}

export class ${name.coverageError} extends Error {
  constructor(detail: string) {
    super(\`\${${name.envConst}} \${detail}\`);
    this.name = "${name.coverageError}";
  }
}

export function ${name.parse}(raw: string | undefined): CastingV2Scope {
  return parseScopeGrammar(raw, () => {
    throw new ${name.configurationError}();
  });
}

export function ${name.enabled}(userId: number): boolean {
  const ${child} = ${name.parse}(process.env[${name.envConst}]);
  if (!castingV2EnabledForUser(${child}, userId)) return false;
  return ${spec.parentEnabled}(userId);
}

export function ${name.validate}(input: {
  scope: string | undefined;
  ${spec.parentField}: string | undefined;
}): CastingV2Scope {
  const ${child} = ${name.parse}(input.scope);
  if (${child}.kind === "off") return ${child};

  const ${parent} = ${spec.parentParse}(input.${spec.parentField});
  if (${parent}.kind === "off") {
    throw new ${name.coverageError}(
      \`cannot be enabled while \${${spec.parentEnvConst}} is off — ${spec.inertWithoutParent}\`,
    );
  }
  if (${parent}.kind === "all") return ${child};
  if (${child}.kind === "all") {
    throw new ${name.coverageError}(
      \`cannot be "all" while \${${spec.parentEnvConst}} is limited to specific users\`,
    );
  }
  const uncovered = ${child}.userIds.filter((userId) => !${parent}.userIds.includes(userId));
  if (uncovered.length > 0) {
    throw new ${name.coverageError}(
      \`names users outside \${${spec.parentEnvConst}}: \${uncovered.join(",")}\`,
    );
  }
  return ${child};
}`;
}

/**
 * The rehearsal, which is the step 2026-07-31 bought.
 *
 * It drives the boot validator itself — no server, no credits — with the exact
 * variable shape that is about to be set, INCLUDING every failure case, because
 * a guard that cannot refuse is not a guard.
 */
export function rehearsalScript(spec: ScopeFlagSpec, input: {
  /** Production's parent value, read BY NAME off the service. */
  parentValue: string;
  /** The value about to be set. */
  ask: string;
}): string {
  const name = namesOf(spec);
  return `/**
 * REHEARSE ${spec.env}'s BOOT GUARDS against production's exact shape.
 *
 * 2026-07-31 is why this exists: an evidence scope flag crash-looped
 * production. The rule since is that a scope is never flipped until its guards
 * have been driven locally with the same variable shape that is about to be
 * set — including the failure cases, because a guard that cannot refuse is not
 * a guard.
 *
 * The shape below is production's, read BY NAME off the Drape service (never by
 * value), with ${spec.env} ABSENT — which is the thing the flip changes.
 *
 * Drives no server and spends nothing: it calls the boot validator itself.
 */
import {
  ${name.validate},
  ${name.envConst},
  ${spec.parentEnvConst},
} from "../server/castingV2/castingV2Scope.js";

const PRODUCTION = {
  [${spec.parentEnvConst}]: "${input.parentValue}",
} as Record<string, string | undefined>;

const run = (label: string, env: Record<string, string | undefined>): boolean => {
  try {
    ${name.validate}({
      scope: env[${name.envConst}],
      ${spec.parentField}: env[${spec.parentEnvConst}],
    });
    console.log(\`BOOTS    \${label}\`);
    return true;
  } catch (error) {
    console.log(\`REFUSES  \${label}\\n           \${(error as Error).message}\`);
    return false;
  }
};

const results = {
  absentBoots: run("absent — today's production", { ...PRODUCTION }),
  offBoots: run("off", { ...PRODUCTION, [${name.envConst}]: "off" }),
  askBoots: run("${input.ask} — THE ASK", { ...PRODUCTION, [${name.envConst}]: "${input.ask}" }),
  parentOffRefuses: !run("the ask with the parent OFF", {
    ...PRODUCTION,
    [${spec.parentEnvConst}]: undefined,
    [${name.envConst}]: "${input.ask}",
  }),
  reachesPastParentRefuses: !run("users:99 while the parent does not cover 99", {
    ...PRODUCTION,
    [${name.envConst}]: "users:99",
  }),
  wideRefuses: !run("all while the parent is limited", {
    ...PRODUCTION,
    [${name.envConst}]: "all",
  }),
  malformedRefuses: !run("a malformed value", {
    ...PRODUCTION,
    [${name.envConst}]: "users:1,banana",
  }),
};

const failures = Object.entries(results).filter(([, ok]) => !ok).map(([label]) => label);
console.log("");
if (failures.length > 0) {
  console.error(\`REHEARSAL FAILED: \${failures.join(", ")}. Do not flip anything.\`);
  process.exit(1);
}
console.log("Rehearsal clean: it boots on the ask, and refuses every way it must.");
process.exit(0);
`;
}

/**
 * EVERYTHING THE GENERATOR CANNOT WRITE, named so it cannot be forgotten.
 *
 * Each line is a place a shipped flag actually lives. The order is the order
 * that is safe to do them in: the code and its rehearsal first, the environment
 * only once the guards have refused everything they must, and production last —
 * which is a founder step, never an executor's.
 */
export const HAND_SITES: ReadonlyArray<{ where: string; what: string }> = [
  { where: "server/castingV2/castingV2Scope.ts", what: "paste the block, and write the docblock the generator cannot: what is dark without this flag, and why this parent" },
  { where: "server/_core/env.ts", what: "call the validate function in the boot fence — a guard nothing invokes does not exist (invariant 7)" },
  { where: "server/castingV2/castingV2Scope.test.ts", what: "arms for every refusal, driven directly rather than through a caller" },
  { where: "scripts/rehearse-<flag>-boot-disposable.mts", what: "written by this generator; run it BEFORE the variable is set anywhere" },
  { where: "CLAUDE.md", what: "the flag's paragraph in the optional-env list, saying what is inert without it and what it costs" },
  { where: ".env", what: "the local value, so the dev world matches what is being rehearsed" },
  { where: "Railway (founder step)", what: "the production variable — never an executor's to set (standing autonomy grant)" },
  { where: "docs/architecture (pnpm architecture:generate)", what: "the Atlas reads flags from source; regenerate and review the diff" },
  { where: "scripts/drive-*.mts", what: "any driver whose surface is dark without the flag must set it, or fail rather than skip" },
  { where: "client prose", what: "only if the flag changes something a user reads; a dark landing changes nothing" },
  { where: ".agents/mailbox/founder-queue.md", what: "the flip is a founder decision — park it with a recommendation, never block on it" },
];
