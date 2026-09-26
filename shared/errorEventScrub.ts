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
 * customer's own words (`prompt`, `brief`), where her pictures
 * live (`resultUrl`, `imageKey`) and a credential (`passwordHash`, the field
 * that once reached `auth.me`).
 *
 * ⚠ **A NINTH KEY WAS HERE FOR AN HOUR AND WAS WRONG — the retired persona-word
 * column, removed at `6a5f07b6`.** It read as an obvious member of *her own
 * words* and the product had already stopped writing it; #1241 retired the name
 * and `server/castingV2/candidateDispositionRetired.test.ts` refuses it anywhere
 * in the tree, which is what caught it. **A refusing key for a field that can no
 * longer appear is not harmless — it is a list nobody can trust**, because a
 * reader takes its presence as evidence the field is still written. When N2b
 * lands (personality and voice born at Sign, as editable text), whatever field
 * it writes joins this list in the same commit, under its real name.
 */
export const REFUSING_KEYS: readonly string[] = [
  "masterPrompt",
  "technicalSchema",
  "preferences",
  "prompt",
  "brief",
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
 * THE BREADCRUMB CATEGORIES THAT MAY TRAVEL — the trail of what she was doing
 * before it broke, allowed by CATEGORY because prose cannot be allowed at all
 * (#1405).
 *
 * ⚠ **THE TWO THAT ARE ABSENT ARE THE REASON THIS IS A LIST AND NOT A
 * BOOLEAN.** `console` carries whatever was logged, and this product's client
 * calls `console.error("[API Query Error]", error)` on **every** failed query,
 * so the server's own words come back through it; `ui.click` carries the TEXT
 * of the element clicked, and the brief box is a text field. Neither has a
 * field name anywhere near the sentence, so the key scan above — which is what
 * makes this module safe to run at all — cannot see either of them.
 *
 * Every other category is absent too, and absent BY DEFAULT rather than by
 * being listed: a category a future SDK adds is dropped on the day it appears,
 * with nobody having to predict its name. That is the same rule the projection
 * follows and the same reason (invariant 8).
 */
export const BREADCRUMB_CATEGORIES: readonly string[] = [
  /* Which page to which page — `data.from` and `data.to`, both paths. */
  "navigation",
  /* A request and how it went — `data.method`, `data.url`, `data.status_code`.
     Three names for one thing: `http` is the server SDK's, `xhr` and `fetch`
     are the browser's, and which one arrives is the SDK's business. */
  "http",
  "xhr",
  "fetch",
];

const BREADCRUMB_CATEGORY_SET = new Set(BREADCRUMB_CATEGORIES);

/**
 * How many crumbs travel. Sentry's own default buffer is 100, and the trail
 * that answers *"what was she doing"* is the tail of it — so this keeps the
 * LAST N, for the same reason `STACK_FRAME_CAP` keeps the innermost frames.
 */
export const BREADCRUMB_CAP = 30;

/**
 * The structural shape of an incoming event. Deliberately NOT Sentry's own
 * type: this module is the contract, and typing it against the SDK would make
 * an SDK upgrade able to widen what travels without anybody editing this file.
 */
export type IncomingEvent = Record<string, unknown>;

/** Likewise for one breadcrumb, which arrives on its own through `beforeBreadcrumb`. */
export type IncomingBreadcrumb = Record<string, unknown>;

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

/**
 * One crumb of the trail, after projection. Note what is absent, because the
 * absences are the whole control: **no `message`** (console's sentence lives
 * there, and no kept category needs it — the SDK puts a navigation's pages and
 * a request's method, URL and status in `data`), no `type`, no `level`, no
 * `event_id`, and no `data` key that this module did not name.
 */
export interface ScrubbedBreadcrumb {
  category: string;
  timestamp?: number;
  data?: { from?: string; to?: string; method?: string; url?: string; status_code?: number };
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
  breadcrumbs?: ScrubbedBreadcrumb[];
  contexts?: { trace?: { trace_id?: string; span_id?: string } };
}

export type ScrubVerdict =
  | { verdict: "send"; event: ScrubbedEvent }
  | { verdict: "refuse"; key: string; path: string };

/**
 * The same three answers for one crumb. `drop` and `refuse` both mean it does
 * not travel; they are separate because only one of them is a MESSAGE — see
 * `scrubBreadcrumb`.
 */
export type BreadcrumbVerdict =
  | { verdict: "keep"; breadcrumb: ScrubbedBreadcrumb }
  | { verdict: "drop" }
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

/**
 * A URL cut to its path. A query string is where ids, tokens and signatures
 * travel; a fragment is where a browser keeps state. Both go, and what is left
 * still goes through the redaction, because the path alone can name a picture
 * under the image bucket.
 *
 * ONE implementation with TWO consumers — `request.url` and a breadcrumb's —
 * because the same rule written out twice is exactly the drift working law 4 is
 * about, and the second copy is the one that would quietly keep a query string.
 */
function urlPathOnly(raw: string, imageOrigin?: string): string {
  const cut = raw.split(/[?#]/, 1)[0] ?? raw;
  return redactFreeText(cut, imageOrigin);
}

/**
 * Project one breadcrumb, or drop it. `null` means it does not travel, which is
 * the answer for every category not named in `BREADCRUMB_CATEGORIES` — including
 * every one a future SDK version invents.
 *
 * ⚠ **`message` IS NOT READ AT ALL, AND THAT IS THE CONTROL.** It is where a
 * console line's formatted arguments and a clicked element's text arrive, it is
 * free prose the key scan cannot see into, and no kept category needs it: the
 * SDK puts a navigation's two pages and a request's method, URL and status in
 * `data`. Dropping the whole field is a smaller promise to keep than redacting
 * it would be.
 */
export function projectBreadcrumb(
  raw: unknown,
  imageOrigin?: string,
): ScrubbedBreadcrumb | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const crumb = raw as Record<string, unknown>;

  const category = crumb.category;
  if (typeof category !== "string" || !BREADCRUMB_CATEGORY_SET.has(category)) return null;

  const out: ScrubbedBreadcrumb = { category };
  const timestamp = asFiniteNumber(crumb.timestamp);
  if (timestamp !== undefined) out.timestamp = timestamp;

  const rawData = crumb.data;
  if (rawData === null || typeof rawData !== "object" || Array.isArray(rawData)) return out;
  const data = rawData as Record<string, unknown>;
  const projected: NonNullable<ScrubbedBreadcrumb["data"]> = {};

  if (category === "navigation") {
    /* Which page to which page — the only thing this category is kept for, so
       a blanket method/status projection would keep the crumb and throw away
       the fact it exists to carry. */
    if (typeof data.from === "string" && data.from.length > 0) {
      projected.from = urlPathOnly(data.from, imageOrigin);
    }
    if (typeof data.to === "string" && data.to.length > 0) {
      projected.to = urlPathOnly(data.to, imageOrigin);
    }
  } else {
    const method = asFreeText(data.method, imageOrigin);
    if (method) projected.method = method;
    if (typeof data.url === "string" && data.url.length > 0) {
      projected.url = urlPathOnly(data.url, imageOrigin);
    }
    const status = asFiniteNumber(data.status_code);
    if (status !== undefined) projected.status_code = status;
  }

  if (Object.keys(projected).length > 0) out.data = projected;
  return out;
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
 * ⚠ **`breadcrumbs` TRAVEL BY CATEGORY (#1405), AND THE CATEGORY LIST IS THE
 * WHOLE CONTROL.** They were dropped entirely by #509 part 1 — the conservative
 * first position, and it cost real diagnostic power: an error report that says
 * *"something broke in the casting studio"* where it could have said *"she
 * pressed Roll, the sheet call 500'd, then it broke"*. What made dropping them
 * right was that two of Sentry's default categories carry a customer's own
 * words with no field name near them (`console`, because this product's client
 * logs every failed query; `ui.click`, because it records the clicked element's
 * TEXT and the brief box is a text field). So the widening is by category and
 * not by switch: `BREADCRUMB_CATEGORIES` names what may travel, `message` is
 * never read on any of them, and `data` is projected per category to the few
 * named fields. A category this module has not heard of does not travel.
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
      projectedRequest.url = urlPathOnly(raw.url, imageOrigin);
    }
    if (Object.keys(projectedRequest).length > 0) out.request = projectedRequest;
  }

  /*
    THE TRAIL. Projected HERE as well as in the SDK's own `beforeBreadcrumb`
    hook, and the two answer different questions: that hook governs what the
    SDK's buffer RETAINS, so a customer's sentence never sits in this process's
    memory waiting for a crash; this governs what LEAVES, so a crumb reaching
    the event by any other road — an integration attaching one directly, a
    `captureEvent` carrying its own — meets the same allowlist. Only the second
    one is structural (invariant 8), which is why it exists even though the
    first one already ran.

    Filtered THEN capped, in that order: a hundred console crumbs ahead of five
    navigation ones would otherwise cap to nothing and lose the whole trail.
  */
  const breadcrumbs = event.breadcrumbs;
  if (Array.isArray(breadcrumbs)) {
    const projected = breadcrumbs
      .map((crumb) => projectBreadcrumb(crumb, imageOrigin))
      .filter((crumb): crumb is ScrubbedBreadcrumb => crumb !== null)
      .slice(-BREADCRUMB_CAP);
    if (projected.length > 0) out.breadcrumbs = projected;
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
 * THE ONE FUNCTION THE RETENTION HOOK CALLS, and the reason it returns a
 * VERDICT rather than a crumb-or-null.
 *
 * ⚠ **THE ENVELOPE FOUND THIS AND A UNIT ARM COULD NOT HAVE** (#1405, driven
 * against the real SDK through a fake transport). `beforeBreadcrumb` runs long
 * before `beforeSend`, so once the trail is projected at retention there is no
 * `brief` left in the event for `findRefusingKey` to find — and a recipe field
 * wired into a crumb went from *refused loudly* to **quietly trimmed**, which
 * is the exact behaviour the refusal exists instead of. The data never left
 * either way; what was lost was the MESSAGE, and this module's own docblock is
 * where the promise to send one is written down.
 *
 * So the check runs HERE, at retention, and the caller logs and counts it.
 *
 * ⚠ **It runs only on a crumb whose category would have been KEPT, and that is
 * a decision rather than an oversight.** A dropped category cannot carry
 * anything anywhere — the channel is closed on the category alone, before its
 * data is read — so a refusal there would be a report about a leak that was
 * never possible, on `console`, which this product's client writes on every
 * failed query. A kept category is the only road a crumb's data can travel,
 * so it is the only road where a mis-wiring means something.
 */
export function scrubBreadcrumb(
  breadcrumb: IncomingBreadcrumb,
  imageOrigin?: string,
): BreadcrumbVerdict {
  const projected = projectBreadcrumb(breadcrumb, imageOrigin);
  if (projected === null) return { verdict: "drop" };

  const refusing = findRefusingKey(breadcrumb, "breadcrumb");
  if (refusing) return { verdict: "refuse", key: refusing.key, path: refusing.path };

  return { verdict: "keep", breadcrumb: projected };
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
