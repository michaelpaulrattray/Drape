/**
 * A FAILED QUERY, WITHOUT THE VALUES IT WAS WRITING (#2218).
 *
 * drizzle-orm's `DrizzleQueryError` builds its message as
 * `Failed query: <sql>\nparams: <every bound value>` and keeps `params` as an
 * enumerable property; its `cause` is mysql2's own error, whose `sql` property
 * is the statement FORMATTED WITH THE VALUES INLINED (mysql2 `command.js` sets
 * `err.sql = this.sql`, and `connection.query` formats client-side) and whose
 * message can quote a value back (`Duplicate entry '…' for key …`). So a
 * transient failure of any write — a persona line, a brief, a `masterPrompt` —
 * carried the customer's own words into the log line, the Sentry exception
 * value and, on a crash, a staff-readable audit row. The scrub cannot catch it:
 * it matches KEY NAMES, and these are prose.
 *
 * This module reduces such an error to what diagnosis needs — the SQL text with
 * its placeholders, the driver's code, errno and SQLSTATE, the stack frames —
 * and withholds every value. It is applied wherever an error cause leaves the
 * process: the tRPC error report, the error tracker (the object handed to the
 * SDK and the outgoing event), the crash handlers, and the logger's own
 * serializers, so a `log.error({ err })` anywhere in the server is covered
 * without each call site remembering.
 *
 * ⚠ WHAT IT DOES NOT DO, SAID RATHER THAN IMPLIED:
 * - It does not read a value interpolated into a log line's MESSAGE STRING by
 *   the caller (`log.error(\`… ${err.message}\`)`) — the logger receives a
 *   string, not an error. `redactQueryValuesInText` exists for those callers.
 * - A statement built with `sql.raw` carries its literals in the SQL text
 *   itself, which is kept. Drizzle's own builders bind every value as a param.
 * - The MySQL message rewrites are anchored on the server's own phrasings
 *   (`Duplicate entry`, `value:`, `near`); a message quoting a value some other
 *   way is not recognised.
 *
 * An error that carries none of these shapes is returned AS THE SAME OBJECT, so
 * nothing about an ordinary error changes.
 */
import { DrizzleQueryError } from "drizzle-orm/errors";

const WITHHELD = "[withheld]";

/** Deep enough for any real wrap chain; bounded so a cycle cannot hang a log line. */
const MAX_CAUSE_DEPTH = 8;

/**
 * The tail drizzle appends, and anything after it. `params:` is printed on its
 * own line by drizzle, so anchoring on the newline keeps an ordinary sentence
 * that happens to contain the word from being cut.
 */
const PARAMS_TAIL = /\n\s*params:[\s\S]*$/;

/**
 * MySQL server messages that quote a value back. Each is anchored on the text
 * that follows the value, because the value itself can contain a quote.
 */
const QUOTED_VALUE_FORMS: ReadonlyArray<[RegExp, string]> = [
  [/(Duplicate entry ')[\s\S]*?(' for key)/g, `$1${WITHHELD}$2`],
  [/(value: ')[\s\S]*?(' for column)/gi, `$1${WITHHELD}$2`],
  [/(near ')[\s\S]*(' at line \d+)/g, `$1${WITHHELD}$2`],
];

/**
 * Withhold every value a failed-query message carries. Safe on any string: a
 * message with none of the shapes comes back unchanged.
 */
export function redactQueryValuesInText(text: string): string {
  let out = text.replace(PARAMS_TAIL, `\nparams: ${WITHHELD}`);
  for (const [pattern, replacement] of QUOTED_VALUE_FORMS) out = out.replace(pattern, replacement);
  return out;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

/** Does this one link of the chain carry bound or inlined values? */
function carriesValues(node: unknown): boolean {
  if (node instanceof DrizzleQueryError) return true;
  if (!isObject(node)) return false;
  if (Array.isArray(node.params)) return true;
  /* mysql2's error: `sql` is the statement with the values formatted in. */
  if (typeof node.sql === "string") return true;
  if (typeof node.sqlMessage === "string") return true;
  const message = node.message;
  return typeof message === "string" && redactQueryValuesInText(message) !== message;
}

function chainCarriesValues(error: unknown): boolean {
  const seen = new Set<unknown>();
  let node: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && isObject(node) && !seen.has(node); depth += 1) {
    if (carriesValues(node)) return true;
    seen.add(node);
    node = node.cause;
  }
  return false;
}

/** The stack's frame lines only — the header line repeats the message. */
function framesOf(stack: unknown): string {
  if (typeof stack !== "string") return "";
  return stack
    .split("\n")
    .filter((line) => /^\s+at /.test(line))
    .join("\n");
}

function rebuild(node: unknown, depth: number, seen: Set<unknown>): unknown {
  if (!isObject(node) || depth >= MAX_CAUSE_DEPTH || seen.has(node)) return undefined;
  seen.add(node);

  /* drizzle never sets `name` on its query error, so it reads "Error"; the
     reduced one says what it is. */
  const name =
    node instanceof DrizzleQueryError
      ? "DrizzleQueryError"
      : typeof node.name === "string" && node.name.length > 0
        ? node.name
        : "Error";
  let message: string;
  if (node instanceof DrizzleQueryError || (typeof node.query === "string" && Array.isArray(node.params))) {
    message = `Failed query: ${String(node.query)}\nparams: ${WITHHELD}`;
  } else {
    message = redactQueryValuesInText(typeof node.message === "string" ? node.message : String(node));
  }

  const safe = new Error(message) as Error & Record<string, unknown>;
  safe.name = name;
  const frames = framesOf(node.stack);
  safe.stack = frames ? `${name}: ${message}\n${frames}` : `${name}: ${message}`;

  /* Diagnosis without content: the statement's shape and the driver's codes. */
  if (typeof node.query === "string") safe.query = node.query;
  for (const key of ["code", "errno", "sqlState"] as const) {
    const value = node[key];
    if (typeof value === "string" || typeof value === "number") safe[key] = value;
  }

  const cause = rebuild(node.cause, depth + 1, seen);
  if (cause !== undefined) safe.cause = cause;
  return safe;
}

/**
 * The error, with every value a failed query carried withheld — or the SAME
 * object when nothing in its cause chain carries one.
 *
 * The whole chain is rebuilt when any link carries values, because a wrapper's
 * message often repeats its cause's (tRPC's does: an unknown throw becomes an
 * `INTERNAL_SERVER_ERROR` whose message IS the cause's message).
 */
export function withoutQueryValues<T>(error: T): T | Error {
  if (!chainCarriesValues(error)) return error;
  return rebuild(error, 0, new Set()) as Error;
}
