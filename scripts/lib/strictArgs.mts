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
 *
 * # ⚠ WITH ONE EXCEPTION, AND IT IS A HOUSE-MONEY ONE: `number()` (#625)
 *
 * The sentence above is still the rule, and `number()` is the one place it
 * bends, because *a number that is not a number does not narrow a bound — it
 * REMOVES it.* `Number("1O")` — the digit one and the letter O, one keystroke
 * apart — is NaN, and every comparison against NaN is false: `total >
 * CEILING_USD` stops refusing and `SpendGuard.reserve` stops reserving, so an
 * `--execute` run proceeds with no ceiling at all. That is #602's own class
 * wearing a different coat: an operator mistake on a script that spends house
 * money degrading QUIETLY instead of refusing.
 *
 * It is here rather than in five callers for the reason the whole module is
 * here — working law 4. Five copies of one check is how one of them quietly
 * stops checking, and the local helper #623 wrote under a capped review round
 * is deleted in the same commit that this lands, not left standing beside it.
 *
 * The test is `Number.isFinite`, never truthiness: `0`, a negative and a
 * decimal are all legitimate values a caller may want, and a refusal that
 * fired on them would be a new defect rather than a guard.
 */

/** What a script accepts. Anything outside these lists is refused. */
export type ArgSpec = {
  /** Flags taking a following value: `--outcome shipped` or `--outcome=shipped`. */
  readonly value: readonly string[];
  /** Flags that are on or off by their presence: `--dry-run`. */
  readonly boolean: readonly string[];
  /**
   * How many BARE WORDS this script legally takes, and it defaults to none.
   *
   * ⚠ **THE BLANKET REFUSAL WAS RIGHT AND IS KEPT — THIS ONLY MOVES WHO SAYS
   * SO** (#602). The docblock above explains what a swallowed positional
   * costs: `close 26` becoming *close whatever is newest*. That is still what
   * happens to a script that does not declare one, which is every script but
   * the one that asked. A positional is legal exactly where a script has
   * written down that it takes one, and the count is checked — `tilt a b` is
   * refused by a script declaring `positional: 1`, which the old reader could
   * not have told you either way.
   */
  readonly positional?: number;
};

export type StrictArgs = {
  /** The value passed for `--name`, or null when it was not passed. */
  value(name: string): string | null;
  /** Whether `--name` was present. */
  flag(name: string): boolean;
  /** The nth bare word, or null when it was not passed. */
  positional(index: number): string | null;
  /**
   * The value passed for `--name` read as a number, or `fallback` when it was
   * not passed — REFUSING anything that is not finite. See the docblock above
   * for why this one accessor judges content.
   *
   * `fallback` is the caller's own constant and is returned unexamined: it is
   * not operator input, and checking it here would mean a script could refuse
   * to start over a line nobody typed.
   *
   * ⚠ **AND THAT IS WHY THE FALLBACK IS GENERIC RATHER THAN `number`** — caught
   * by preflight on this card's own first push. `born-worn-court.mts` passes
   * `subject.floor`, which is `number | null` for a class nobody has measured
   * yet, and prints *"has no measured floor — pass one to try it"* on the very
   * next line. A `fallback: number` signature would have forced that call site
   * to invent a `?? NaN`, i.e. to put back the exact value this card exists to
   * make unreachable. The type says what the contract already said.
   */
  number<Fallback>(name: string, fallback: Fallback): number | Fallback;
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
  const positionals: string[] = [];
  const positionalLimit = spec.positional ?? 0;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;

    /*
      THE `=` FORM (#602). `--phase=gate` and `--phase gate` are one thing said
      two ways, and refusing one of them was never a safety property — it was
      simply a shape the first reader did not speak, which is why
      `calibrate-providers.mts` (whose own header documents `--phase=gate`)
      could not join the sweep without changing the command an operator types.

      ⚠ The split is on the FIRST `=` only, so `--out=a=b` is the value `a=b`
      rather than a refusal — a path or a query string is a legitimate value
      and splitting it would be a new way to lose part of one silently.
    */
    const equals = token.startsWith("--") ? token.indexOf("=") : -1;
    if (equals > 2) {
      const name = token.slice(0, equals);
      const inlineValue = token.slice(equals + 1);
      if (booleanFlags.has(name)) {
        throw new ArgumentError(`${name} takes no value, and was given ${inlineValue || "an empty one"}.`);
      }
      if (!valueFlags.has(name)) {
        throw new ArgumentError(`unknown argument ${name}.\nKnown: ${known(spec)}`);
      }
      /* An empty value is the same mistake as a missing one and reads the same
         way to the caller — `--phase=` must not become the string "". */
      if (inlineValue === "") throw new ArgumentError(`${name} needs a value.`);
      if (values.has(name)) throw new ArgumentError(`${name} was given twice.`);
      values.set(name, inlineValue);
      continue;
    }

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
    if (!token.startsWith("--") && positionals.length < positionalLimit) {
      positionals.push(token);
      continue;
    }
    throw new ArgumentError(
      `unknown argument ${token}.\nKnown: ${known(spec)}`,
    );
  }

  const value = (name: string): string | null => values.get(`--${name}`) ?? null;
  return {
    value,
    flag: (name) => flags.has(`--${name}`),
    positional: (index) => positionals[index] ?? null,
    number: <Fallback,>(name: string, fallback: Fallback): number | Fallback => {
      const raw = value(name);
      if (raw === null) return fallback;
      /*
        ⚠ AN EXPLICITLY QUOTED EMPTY VALUE IS NOT A ZERO (PR #627's review,
        finding 1). The PARSE refuses `--ceiling` at the end of the line and
        `--ceiling=`, but `--ceiling ""` and `--ceiling " "` are a token, so
        they arrive here — and `Number("")` is `0`, which `Number.isFinite`
        accepts. `--ceiling "$CEILING"` with the variable unset is the real
        way an operator types it.

        The direction is the MIRROR of the incident and costs no money — a
        zero ceiling refuses every spend, and zero repeats runs nothing — so
        this is a contract repair rather than a second hole: the accessor says
        it refuses what is not a number, and an empty string is not one.
        Checked BEFORE the coercion, because `Number` is precisely the reader
        that disagrees.
      */
      if (raw.trim() === "") {
        throw new ArgumentError(`--${name} must be a number, and an empty value is not one.`);
      }
      const parsed = Number(raw);
      /* Not `!parsed` and not `isNaN` — `Number.isFinite` is the only one of
         the three that lets `0`, `-1` and `0.5` through and stops `Infinity`,
         which is a ceiling that does not bound either. */
      if (!Number.isFinite(parsed)) {
        throw new ArgumentError(`--${name} must be a number, and "${raw}" is not.`);
      }
      return parsed;
    },
  };
}

/** The vocabulary, printed the way a caller would type it. */
export function known(spec: ArgSpec): string {
  /* The positional is named too, because a refusal that lists only flags
     against a script that takes a bare word tells the operator the opposite of
     what is true. */
  const slots = spec.positional ?? 0;
  return [
    ...spec.value.map((name) => `--${name} <value>`),
    ...spec.boolean.map((name) => `--${name}`),
    ...(slots > 0 ? [`${slots} bare word${slots === 1 ? "" : "s"}`] : []),
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
    const parsed = parseStrictArgs(argv, spec);
    /*
      `number()` is read LATER than the parse, at the caller's own line, so its
      refusal cannot ride the try/catch above — it needs the same wrapper here
      or an operator's `--ceiling 1O` would reach a script as an unhandled
      stack trace instead of one `REFUSING:` sentence. Same split as the rest
      of the module: `parseStrictArgs` throws so the arms can drive it, and
      this form is what call sites want.
    */
    return {
      ...parsed,
      number: <Fallback,>(name: string, fallback: Fallback): number | Fallback => {
        try {
          return parsed.number(name, fallback);
        } catch (cause) {
          if (!(cause instanceof ArgumentError)) throw cause;
          console.error(`REFUSING: ${cause.message}`);
          process.exit(1);
        }
      },
    };
  } catch (cause) {
    if (!(cause instanceof ArgumentError)) throw cause;
    console.error(`REFUSING: ${cause.message}`);
    process.exit(1);
  }
}
