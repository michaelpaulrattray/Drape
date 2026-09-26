/**
 * THE SCRUB AT THE WIRE — what an error report may carry out of the building,
 * and what refuses it (#509 part 1).
 *
 * A third-party error tracker is a place customer data can leave to, and
 * CLAUDE.md's metadata-only boundary applies to a third party exactly as it
 * applies to staff: an outside service may learn that a generation failed, on
 * which route, for which account — never `masterPrompt`, `technicalSchema`,
 * `preferences`, a brief, a customer's prose or an image URL. The founder's own
 * ruling behind that sentence: *"If a marketing team or content creator comes
 * on the platform and makes a model that's theirs, no one should be able to
 * steal or copy that work."*
 *
 * So this module is the control, and the SDK is only the transport. It is
 * deliberately here in `shared/` and imports nothing: the server and the client
 * are two consumers of ONE implementation rather than two copies that drift
 * (working law 4), and a `shared/` module that imported `@sentry/*` would drag
 * the SDK into the client's first download.
 *
 * # Two mechanisms, and they answer different questions
 *
 * **1 · PROJECTION — an explicit allowlist, never a filter.** `project()`
 * REBUILDS the outgoing event from named fields; anything not named cannot
 * travel, including a field some future SDK version starts attaching. That is
 * invariant 8 (*"Read paths return an explicit projection … Sensitive field
 * groups stay out by construction, not by callers remembering to omit them"*)
 * pointed at an outgoing request instead of a response. A filter would have to
 * predict every key; a projection has to predict none.
 *
 * **2 · REFUSAL — a forbidden KEY anywhere in the event drops the whole
 * event.** The projection alone would already leave the recipe behind. The
 * refusal exists because a recipe field appearing in an error event at all
 * means somebody wired one in, and the rest of that event is then untrusted —
 * so it is refused loudly (the caller logs the KEY NAME, never the value)
 * rather than quietly trimmed. A mis-wiring that leaks is a defect; a
 * mis-wiring that is refused is a message.
 *
 * ⚠ **THE REFUSAL MATCHES KEY NAMES, NEVER PROSE, AND THAT IS THE WHOLE REASON
 * IT IS SAFE TO RUN.** `prompt` and `brief` are real words in this product's
 * own error messages and real substrings of its own filenames
 * (`promptAuthor.ts`, `briefCompiler.ts`), and a guard that refused on those
 * words would refuse exactly the casting errors most worth reading — the
 * `shave`→`shape` typo gate owned a real word the same way and blocked the
 * founder's own ask. As a KEY, `prompt` can only be there because our code put
 * it there. Every name on the list below is one of ours.
 *
 * ⚠ **AND `beforeSend` IS NOT LITERALLY THE LAST THING THAT TOUCHES THE
 * ENVELOPE — read at the bytes, not assumed.** Driving the real SDK through a
 * fake transport (`output/_509-wire-drive.mts`) showed the envelope arriving
 * with an `sdk` block (`{ name: "sentry.javascript.node", version, packages }`)
 * that the projection never emitted: the SDK stamps its own identity AFTER the
 * gate returns. It is the SDK naming itself and carries nothing of ours, and it
 * is written here because *"nothing unnamed can travel"* would otherwise be a
 * sentence this module cannot keep. The channels that bypass the gate are
 * enumerated in `server/monitoring/errorTracker.ts` beside the options that
 * close or declare each one.
 *
 * # What the values that DO leave are put through
 *
 * A message and a stack are the point of an error tracker, so they travel — and
 * they are free text, which the key scan cannot see into. They are redacted for
 * the three leaks that are decidable at a glance (an image location, a `data:`
 * payload, a URL's query string) and capped.
 *
 * ⚠ **THE CAP IS A BOUND, NOT A PROOF, AND SAYING OTHERWISE WOULD BE THE
 * DISHONEST PART.** A developer who interpolates a customer's sentence into an
 * error message, under the cap, with no forbidden key beside it, leaks that
 * sentence. Nothing here can see that. The cap makes a full brief or a master
 * prompt unable to fit; the key scan catches the wiring mistake; a repo guard
 * over `new Error(...)` interpolation is the thing that would close the
 * remainder, and it is CARDED rather than claimed here.
 */

/** The cap on every free-text value that leaves. See the docblock's warning. */
export const FREE_TEXT_CAP = 1000;

/** How many stack frames travel. Sentry's own default is the full stack. */
export const STACK_FRAME_CAP = 50;

/** The token a redacted run is replaced by, so a reader can see it happened. */
export const REDACTED = "[redacted]";

/**
 * THE KEYS THAT REFUSE AN EVENT — every one of them a field this product
 * writes, so its presence is our wiring and never a coincidence of prose.
 * Matched case-insensitively against key names at every depth.
 *
 * `masterPrompt`, `technicalSchema` and `preferences` are CLAUDE.md's named
 * field group — *"Together they are the complete recipe for reproducing the
 * cast … treat it the way you would treat a password"*. The rest are the
 * customer's own words (`prompt`, `brief`, `personaLine`), where her pictures
 * live (`resultUrl`, `imageKey`) and a credential (`passwordHash`, the field
 * that once reached `auth.me`).
 */
export const REFUSING_KEYS: readonly string[] = [
  "masterPrompt",
  "technicalSchema",
  "preferences",
  "prompt",
  "brief",
  "personaLine",
  "resultUrl",
  "imageKey",
  "passwordHash",
];

const REFUSING_KEY_SET = new Set(REFUSING_KEYS.map((key) => key.toLowerCase()));

/** Tag keys that may travel. A tag not named here is dropped by the projection. */
export const ALLOWED_TAG_KEYS: readonly string[] = [
  "correlationId",
  "route",
  "trpcPath",
  "trpcType",
  "trpcCode",
  "kind",
  "world",
];

const ALLOWED_TAG_KEY_SET = new Set(ALLOWED_TAG_KEYS);

/**
 * The structural shape of an incoming event. Deliberately NOT Sentry's own
 * type: this module is the contract, and typing it against the SDK would make
 * an SDK upgrade able to widen what travels without anybody editing this file.
 */
export type IncomingEvent = Record<string, unknown>;

/** A stack frame, after projection. Note what is absent: `vars`. */
export interface ScrubbedFrame {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
}

export interface ScrubbedException {
  type?: string;
  value?: string;
  stacktrace?: { frames: ScrubbedFrame[] };
  mechanism?: { type?: string; handled?: boolean };
}

/** Everything that may leave, and nothing else. */
export interface ScrubbedEvent {
  event_id?: string;
  timestamp?: number;
  level?: string;
  platform?: string;
  environment?: string;
  release?: string;
  transaction?: string;
  message?: string;
  logentry?: { message: string };
  exception?: { values: ScrubbedException[] };
  user?: { id: string };
  tags?: Record<string, string>;
  request?: { method?: string; url?: string };
  contexts?: { trace?: { trace_id?: string; span_id?: string } };
}

export type ScrubVerdict =
  | { verdict: "send"; event: ScrubbedEvent }
  | { verdict: "refuse"; key: string; path: string };

/**
 * Is a forbidden key anywhere in this graph? Returns the key and the path to
 * it so the caller can say WHERE the mis-wiring is without quoting the value.
 *
 * Walks arrays and plain objects, with a seen-set so a circular event (Sentry
 * events can carry one) terminates rather than hanging the send path.
 */
export function findRefusingKey(
  value: unknown,
  path = "event",
  seen: Set<object> = new Set(),
): { key: string; path: string } | null {
  if (value === null || typeof value !== "object") return null;
  if (seen.has(value)) return null;
  seen.add(value);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findRefusingKey(value[index], `${path}[${index}]`, seen);
      if (found) return found;
    }
    return null;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (REFUSING_KEY_SET.has(key.toLowerCase())) {
      return { key, path: `${path}.${key}` };
    }
    const found = findRefusingKey(child, `${path}.${key}`, seen);
    if (found) return found;
  }
  return null;
}

/**
 * Redact the three decidable leaks in free text, then cap it.
 *
 * `imageOrigin` is the R2 public bucket's origin — a URL under it IS a
 * customer's picture, and `server/storage.ts` says in its own header that those
 * URLs never expire, so one quoted in an error message is permanent access.
 * Absent (a test, a client with no such literal), the other two still run.
 */
export function redactFreeText(text: string, imageOrigin?: string): string {
  let out = text;

  if (imageOrigin) {
    // The origin and everything that looks like a path after it.
    const escaped = imageOrigin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`${escaped}[^\\s"')]*`, "g"), REDACTED);
  }

  // A `data:` payload — an inlined picture, or a blob of anything.
  out = out.replace(/data:[a-z0-9.+-]*\/?[a-z0-9.+-]*;base64,[A-Za-z0-9+/=]+/gi, REDACTED);

  // A query string on any URL: ids, tokens and signatures travel there.
  out = out.replace(/(https?:\/\/[^\s"')?]+)\?[^\s"')]*/gi, `$1?${REDACTED}`);

  if (out.length > FREE_TEXT_CAP) {
    out = `${out.slice(0, FREE_TEXT_CAP)}… [${out.length - FREE_TEXT_CAP} more characters dropped]`;
  }
  return out;
}

function asFreeText(value: unknown, imageOrigin?: string): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  return redactFreeText(value, imageOrigin);
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function projectFrame(raw: unknown, imageOrigin?: string): ScrubbedFrame | null {
  if (raw === null || typeof raw !== "object") return null;
  const frame = raw as Record<string, unknown>;
  const out: ScrubbedFrame = {};
  /* A filename is a path on OUR disk or a URL of OUR bundle, so it goes through
     the same redaction as prose — a dev machine's path can name a person. */
  const filename = asFreeText(frame.filename ?? frame.abs_path, imageOrigin);
  if (filename) out.filename = filename;
  const fn = asFreeText(frame.function, imageOrigin);
  if (fn) out.function = fn;
  const lineno = asFiniteNumber(frame.lineno);
  if (lineno !== undefined) out.lineno = lineno;
  const colno = asFiniteNumber(frame.colno);
  if (colno !== undefined) out.colno = colno;
  if (typeof frame.in_app === "boolean") out.in_app = frame.in_app;
  /* `vars` is absent on purpose and this line is the only place to say it:
     Sentry's local-variables integration attaches every local in scope at the
     throw, which on this product's roll path is the composed prompt itself. */
  return Object.keys(out).length > 0 ? out : null;
}

function projectException(raw: unknown, imageOrigin?: string): ScrubbedException | null {
  if (raw === null || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const out: ScrubbedException = {};
  const type = asFreeText(value.type, imageOrigin);
  if (type) out.type = type;
  const message = asFreeText(value.value, imageOrigin);
  if (message) out.value = message;

  const stack = value.stacktrace;
  if (stack !== null && typeof stack === "object") {
    const frames = (stack as Record<string, unknown>).frames;
    if (Array.isArray(frames)) {
      const projected = frames
        .slice(-STACK_FRAME_CAP)
        .map((frame) => projectFrame(frame, imageOrigin))
        .filter((frame): frame is ScrubbedFrame => frame !== null);
      if (projected.length > 0) out.stacktrace = { frames: projected };
    }
  }

  const mechanism = value.mechanism;
  if (mechanism !== null && typeof mechanism === "object") {
    const raw2 = mechanism as Record<string, unknown>;
    const projectedMechanism: { type?: string; handled?: boolean } = {};
    if (typeof raw2.type === "string") projectedMechanism.type = raw2.type;
    if (typeof raw2.handled === "boolean") projectedMechanism.handled = raw2.handled;
    if (Object.keys(projectedMechanism).length > 0) out.mechanism = projectedMechanism;
  }

  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Rebuild the event from the allowlist. Nothing reaches the output that is not
 * named in this function — that is the point, and it is why a new SDK field is
 * absent by default rather than present by default.
 *
 * ⚠ **`breadcrumbs` ARE DROPPED, AND IT IS THE ONE DELIBERATE LOSS OF VALUE
 * HERE.** Sentry's default breadcrumbs carry console arguments and clicked
 * element text; this product's own client calls
 * `console.error("[API Query Error]", error)` on every failed query and the
 * brief box is a text field, so both shapes can hold a customer's sentence with
 * no forbidden key anywhere near it. An allowlist by category (navigation and
 * http, URLs reduced to a path) is a real improvement and a SECOND decision,
 * carded rather than folded in here — because a widening of what leaves the
 * building should be its own diff with its own arms.
 */
export function project(event: IncomingEvent, imageOrigin?: string): ScrubbedEvent {
  const out: ScrubbedEvent = {};

  if (typeof event.event_id === "string") out.event_id = event.event_id;
  const timestamp = asFiniteNumber(event.timestamp);
  if (timestamp !== undefined) out.timestamp = timestamp;
  if (typeof event.level === "string") out.level = event.level;
  if (typeof event.platform === "string") out.platform = event.platform;
  if (typeof event.environment === "string") out.environment = event.environment;
  if (typeof event.release === "string") out.release = event.release;

  const transaction = asFreeText(event.transaction, imageOrigin);
  if (transaction) out.transaction = transaction;

  const message = asFreeText(event.message, imageOrigin);
  if (message) out.message = message;

  /* Sentry moved `captureMessage` text into `logentry.message`; both shapes are
     read because which one arrives is the SDK's business, not this module's. */
  const logentry = event.logentry;
  if (logentry !== null && typeof logentry === "object") {
    const text = asFreeText((logentry as Record<string, unknown>).message, imageOrigin);
    if (text) out.logentry = { message: text };
  }

  const exception = event.exception;
  if (exception !== null && typeof exception === "object") {
    const values = (exception as Record<string, unknown>).values;
    if (Array.isArray(values)) {
      const projected = values
        .map((value) => projectException(value, imageOrigin))
        .filter((value): value is ScrubbedException => value !== null);
      if (projected.length > 0) out.exception = { values: projected };
    }
  }

  /* The id and NOTHING else. `email`, `username` and `ip_address` are the
     fields Sentry fills by default when `sendDefaultPii` is on, and the
     boundary this module exists for is the reason it is off. */
  const user = event.user;
  if (user !== null && typeof user === "object") {
    const id = (user as Record<string, unknown>).id;
    if (typeof id === "string" && id.length > 0) out.user = { id };
    else if (typeof id === "number") out.user = { id: String(id) };
  }

  const tags = event.tags;
  if (tags !== null && typeof tags === "object") {
    const projectedTags: Record<string, string> = {};
    for (const [key, value] of Object.entries(tags as Record<string, unknown>)) {
      if (!ALLOWED_TAG_KEY_SET.has(key)) continue;
      if (typeof value === "string") projectedTags[key] = redactFreeText(value, imageOrigin);
      else if (typeof value === "number" || typeof value === "boolean") {
        projectedTags[key] = String(value);
      }
    }
    if (Object.keys(projectedTags).length > 0) out.tags = projectedTags;
  }

  /* The method and the PATH. A query string is where ids and tokens travel, so
     the URL is cut at the `?` rather than redacted after it — and no headers,
     no cookies, no body reach this function's output at all. */
  const request = event.request;
  if (request !== null && typeof request === "object") {
    const raw = request as Record<string, unknown>;
    const projectedRequest: { method?: string; url?: string } = {};
    if (typeof raw.method === "string") projectedRequest.method = raw.method;
    if (typeof raw.url === "string" && raw.url.length > 0) {
      const cut = raw.url.split("?")[0] ?? raw.url;
      projectedRequest.url = redactFreeText(cut, imageOrigin);
    }
    if (Object.keys(projectedRequest).length > 0) out.request = projectedRequest;
  }

  const contexts = event.contexts;
  if (contexts !== null && typeof contexts === "object") {
    const trace = (contexts as Record<string, unknown>).trace;
    if (trace !== null && typeof trace === "object") {
      const raw = trace as Record<string, unknown>;
      const projectedTrace: { trace_id?: string; span_id?: string } = {};
      if (typeof raw.trace_id === "string") projectedTrace.trace_id = raw.trace_id;
      if (typeof raw.span_id === "string") projectedTrace.span_id = raw.span_id;
      if (Object.keys(projectedTrace).length > 0) out.contexts = { trace: projectedTrace };
    }
  }

  return out;
}

/**
 * THE ONE FUNCTION THE TRANSPORT CALLS. Refuse first, then project — in that
 * order, because the refusal reads the event as it ARRIVED. Projecting first
 * would throw the evidence away and then find nothing wrong with what was left,
 * which is a control that passes because it blinded itself.
 */
export function scrubErrorEvent(event: IncomingEvent, imageOrigin?: string): ScrubVerdict {
  const refusing = findRefusingKey(event);
  if (refusing) return { verdict: "refuse", key: refusing.key, path: refusing.path };
  return { verdict: "send", event: project(event, imageOrigin) };
}
