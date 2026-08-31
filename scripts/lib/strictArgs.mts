/**
 * A COMMAND LINE THAT REFUSES WHAT IT DOES NOT UNDERSTAND (issue #288).
 *
 * On 2026-08-30, against PRODUCTION, an operator trying to READ the live shift
 * row typed:
 *
 *   … scripts/crew-shift-close.mts --outcome shipped --note probe --dry-run
 *
 * `--dry-run` is not a flag that script has. **It ignored the word and did the
 * close** — stamping a running shift's row terminal, so the founder's page read
 * *"Nothing running"* while a shift ran. That is the exact failure the live row
 * exists to prevent, caused by the safest-sounding word an operator can type.
 *
 * The same class has now fired three times in this repository, twice on
 * spending scripts (memory: *inspecting a spending script spends* — a `--help`
 * it did not know started a 42-cell sweep) and once here. Every instance is one
 * shape: **a reader that looks up the flags it wants and never looks at what it
 * was actually given.** `indexOf("--outcome")` cannot fail on a word it was
 * never asked about.
 *
 * # WHY THIS IS SHARED RATHER THAN COPIED INTO EACH SCRIPT
 *
 * Working law 4 — derive, never mirror. `crew-desk-sweep.mts` already carries a
 * hand-rolled version of this (a `Set` of two known flags), and a second and
 * third hand-rolled copy is how one of them quietly stops refusing. One parser,
 * one set of arms, and a caller declares only its own vocabulary.
 *
 * # WHAT IT REFUSES, AND WHY EACH ONE IS A REAL MISTAKE
 *
 *   - **an unknown flag** — the incident above;
 *   - **a value flag with no value** (`--outcome` at the end, or `--outcome
 *     --note x`) — the old readers returned `null` here, which is
 *     indistinguishable from *not passed*, so `--outcome --note x` refused with
 *     *"--outcome is required"* and sent the operator looking in the wrong
 *     place;
 *   - **the same flag twice** — one of the two values is silently discarded,
 *     and which one is an implementation detail nobody should have to know;
 *   - **a bare word** (`close 26`) — a positional argument these scripts have
 *     never had, and reading it as nothing is how `26` becomes *close whatever
 *     is newest*.
 *
 * # ⚠ WHAT IT DOES NOT DO
 *
 * It does not validate a value's CONTENT. `--outcome banana` parses fine here
 * and is refused by the caller against its own closed vocabulary, where the
 * list of legal outcomes actually lives. This reader is about the SHAPE of the
 * line; the caller owns its meaning.
 */

/** What a script accepts. Anything outside these two lists is refused. */
export type ArgSpec = {
  /** Flags taking a following value: `--outcome shipped`. */
  readonly value: readonly string[];
  /** Flags that are on or off by their presence: `--dry-run`. */
  readonly boolean: readonly string[];
};

export type StrictArgs = {
  /** The value passed for `--name`, or null when it was not passed. */
  value(name: string): string | null;
  /** Whether `--name` was present. */
  flag(name: string): boolean;
};

export class ArgumentError extends Error {}

/**
 * Parse `argv` against `spec`, THROWING on anything the spec does not name.
 *
 * Throws rather than exits so that the arms can drive it directly — working law
 * 3: a guard whose only test path is a child process is a guard nobody drives.
 * `parseStrictArgsOrRefuse` below is the one-line call sites want.
 */
export function parseStrictArgs(argv: readonly string[], spec: ArgSpec): StrictArgs {
  const valueFlags = new Set(spec.value.map((name) => `--${name}`));
  const booleanFlags = new Set(spec.boolean.map((name) => `--${name}`));
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (valueFlags.has(token)) {
      if (values.has(token)) throw new ArgumentError(`${token} was given twice.`);
      const next = argv[index + 1];
      /* A value flag whose value is the next flag is a typo, and saying so is
         the whole point: the old readers turned this into "not passed". */
      if (next === undefined || next.startsWith("--")) {
        throw new ArgumentError(`${token} needs a value${next === undefined ? "" : `, and was followed by ${next}`}.`);
      }
      values.set(token, next);
      index += 1;
      continue;
    }
    if (booleanFlags.has(token)) {
      if (flags.has(token)) throw new ArgumentError(`${token} was given twice.`);
      flags.add(token);
      continue;
    }
    throw new ArgumentError(
      `unknown argument ${token}.\nKnown: ${known(spec)}`,
    );
  }

  return {
    value: (name) => values.get(`--${name}`) ?? null,
    flag: (name) => flags.has(`--${name}`),
  };
}

/** The vocabulary, printed the way a caller would type it. */
export function known(spec: ArgSpec): string {
  return [
    ...spec.value.map((name) => `--${name} <value>`),
    ...spec.boolean.map((name) => `--${name}`),
  ].join(", ");
}

/**
 * The call-site form: parse `process.argv.slice(2)` or print the refusal and
 * exit 1.
 *
 * The exit code is 1 — a refusal, the same code every other `REFUSING:` in
 * these scripts uses. It is deliberately NOT 2, which this family has given a
 * meaning to (a finding reported after the work succeeded).
 */
export function parseStrictArgsOrRefuse(argv: readonly string[], spec: ArgSpec): StrictArgs {
  try {
    return parseStrictArgs(argv, spec);
  } catch (cause) {
    if (!(cause instanceof ArgumentError)) throw cause;
    console.error(`REFUSING: ${cause.message}`);
    process.exit(1);
  }
}
