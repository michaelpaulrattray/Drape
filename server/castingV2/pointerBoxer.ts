/**
 * THE BOXER — one request per picture, every name in it (#2863).
 *
 * His ruling of 2026-10-30, on #2846 part 5's blind marks: the box round a named
 * thing moves from `moondream3-preview/detect` to **Gemini 4 Argon**, with
 * **Qwen3-VL** behind it. His answer to the relay's recommendation, verbatim:
 * *"yes"*. What he judged, blind, on a clean one-name-per-thing key of 65 items
 * over 12 casts, 4 engines × 3 runs:
 *
 *   Gemini 4 Argon    62 right · 3 partly · 0 wrong   4.6 s a scan   0.51¢
 *   Qwen3-VL 235B     60 right · 5 partly · 0 wrong   2.0 s a scan   0.08¢
 *   moondream3 today  57 right · 3 partly · 5 wrong   5.1 s a scan   0.16¢
 *
 * **Price, stated out loud (the law's clause 3):** about $5 per 1,000 scans
 * against today's ~$1.60. House money, never a customer credit.
 *
 * # The request is #2846's, ported rather than re-invented
 *
 * `part5/scripts/bench5.mjs` is the request his eye judged, and every clause
 * here is that script's: the sentence below word for word, the picture FIRST
 * and the sentence after it in one user turn with no system turn, temperature
 * 0, an 8,000-token ceiling, Argon at `reasoning.effort: "low"` answering
 * `box_2d` as `[ymin, xmin, ymax, xmax]` on 0–1000, Qwen in OpenRouter's
 * structured-output mode answering `bbox_2d` as `[x1, y1, x2, y2]` on 0–1000,
 * and the picture at 1024 on its short side. The reader of the answer is
 * `part5/scripts/reparse5.mjs`'s: strict JSON first (a list, or
 * `{"detections": [...]}`), then the label-before-box text reading, then the
 * box-before-label one Gemini 3.8 Flash wrote on part 4.
 *
 * # Why it is not `createOpenRouterTextEngine`
 *
 * It is that transport's ADDRESS, KEY and FAILURE CLASSIFIER, imported rather
 * than copied (`OPENROUTER_BASE_URL`, `classifyOpenRouterTextHttp`). The text
 * engine's request is a different request: it always sends a system turn, puts
 * the sentence before the picture, cannot say `effort: "low"`, does not ask
 * for the price, and retries inside itself — and here the retry IS the next
 * engine. Bending a transport every paid read rides on to fit this one would
 * move bytes on roads this card was never about.
 *
 * # It never sees a customer's word in a log
 *
 * Every line here is numbers and engine ids: how many names, how many boxes,
 * how long, why a step was passed over. The names go to the provider because
 * they ARE the question; they go nowhere else.
 */
import { createModuleLogger } from "../logging/logger";
import { OPENROUTER_BASE_URL, classifyOpenRouterTextHttp } from "../providers/openrouterText";
import { throughCensus } from "./callCensus";
import { captureCastingPointerEngineEnabled } from "./castingV2Scope";
import type { PointerBox } from "./maskedRefine";

const log = createModuleLogger("castingV2/pointerBoxer");

/** How a step's calls are labelled in the call census — a fixed word, never a noun. */
export const POINTER_BOXER_ABOUT = "pointer.boxer";

/** The two box layouts the engines answer in, both on a 0–1000 scale. */
export type BoxLayout = "yxyx" | "xyxy";

export type BoxerStep = {
  /** A fixed id for logs. */
  readonly engine: "argon" | "qwen";
  /** The model as OpenRouter names it — what goes out on the wire. */
  readonly model: string;
  readonly layout: BoxLayout;
  /** The answer's key for the box, as the measured sentence names it. */
  readonly key: "box_2d" | "bbox_2d";
  /** How the measured sentence spells the layout. */
  readonly spec: string;
  /**
   * How long a step may take before the next one is asked — a DEADLINE TO HAND
   * OVER, and deliberately NOT the worst time either engine has ever taken.
   *
   * Argon 12 s then Qwen 10 s, so the worst wait to an answer is about 22 s and
   * today's detector still waits behind both. ⚠ They were 25 s and 15 s until
   * #2863's review, which is the reason this block is long: the two stacked to
   * **40 seconds before a fallback answered**, and on the take a customer who
   * has already paid waits through all of it — on the face panel, every found
   * row does.
   *
   * ⚠ **12 s is the worst Argon took on the blind marks that CHOSE it** (#2846
   * part 5). It is not its worst anywhere, and the difference is the cost of
   * this number rather than a footnote: part 4 measured **20.1 s**, and on
   * #14's reference photos this PR measured **24 s** on the product shot and
   * one outright timeout at 25 s. **So a picture Argon would have boxed in 20 s
   * now goes to Qwen instead**, and that costs the Argon call the account has
   * already paid for plus Qwen's — two priced census rows for one answer. Qwen
   * answered those same three photos in 5–8 s.
   *
   * **What makes the trade cheap is quality, measured on the same blind marks:**
   * Argon 62 right / 3 partly / 0 wrong, Qwen3-VL 60 right / 0 wrong, today's
   * detector 57 right / **5 wrong**. Handing over early loses very little; it
   * is the 40-second wait that the customer could not be asked to pay.
   *
   * ⚠ **Qwen's 10 s sits just UNDER its own measured worst** (10.9 s on part 4,
   * 4 s on part 5), so the slowest Qwen reading on record would itself hand
   * over — to today's detector, which is the road every one of these surfaces
   * ran on until this card. That is the stated floor of this ladder, not a
   * failure of it.
   */
  readonly timeoutMs: number;
};

/** THE ORDER IS THE RULING: Argon, then Qwen3-VL. Today's detector is the reader's. */
export const BOXER_STEPS: readonly BoxerStep[] = [
  {
    engine: "argon",
    model: "google/gemini-4-argon",
    layout: "yxyx",
    key: "box_2d",
    spec: "[ymin, xmin, ymax, xmax]",
    timeoutMs: 12_000,
  },
  {
    engine: "qwen",
    model: "qwen/qwen3-vl-235b-a22b-instruct",
    layout: "xyxy",
    key: "bbox_2d",
    spec: "[x1, y1, x2, y2]",
    timeoutMs: 10_000,
  },
];

/** The scale both engines answer on, named once: the box guard's arms read it. */
export const BOX_SCALE = 1000;

/**
 * THE MOST NAMES ONE REQUEST CARRIES. #2846 asked up to 14 names of one
 * picture; nothing above that has been measured, so a bigger batch is split
 * into requests of this size rather than sent as one nobody has judged.
 */
export const BOXER_MAX_NAMES = 14;

/** The picture's short side, as #2846 sent it (its fixtures were 1024 wide). */
const SHORT_SIDE = 1024;

/**
 * THE SENTENCE HIS EYE JUDGED — `bench5.mjs`'s, word for word.
 *
 * ⚠ A paraphrase of this is a different request from the one that was marked,
 * so it is not "tidied". Names are quoted exactly as asked, because the answer
 * is matched back to them by that spelling.
 */
export function boxerSentence(names: readonly string[], step: BoxerStep): string {
  const list = names.map((name) => `"${name}"`).join(", ");
  return `Detect each of these things on the character in the image: ${list}. For every name, return one entry per visible instance: {"label": <the name exactly as asked>, "${step.key}": ${step.spec}} with coordinates normalized to 0-1000. If a name is not visible in the image, return no entry for it. Return a JSON list only.`;
}

/** Qwen's structured-output schema, `bench5.mjs`'s `QWEN_SCHEMA`. */
export const QWEN_DETECTIONS_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "detections",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["detections"],
      properties: {
        detections: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["label", "bbox_2d"],
            properties: { label: { type: "string" }, bbox_2d: { type: "array", items: { type: "number" } } },
          },
        },
      },
    },
  },
} as const;

/** The request body for one step — exported so the wire can be asserted against it. */
export function boxerRequestBody(step: BoxerStep, names: readonly string[], png: Buffer): Record<string, unknown> {
  return {
    model: step.model,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:image/png;base64,${png.toString("base64")}` } },
        { type: "text", text: boxerSentence(names, step) },
      ],
    }],
    usage: { include: true },
    max_tokens: 8000,
    temperature: 0,
    ...(step.engine === "argon" ? { reasoning: { effort: "low" } } : { response_format: QWEN_DETECTIONS_SCHEMA }),
  };
}

type RawEntry = { label: string; raw: [number, number, number, number] };

function looseJson(text: string): unknown {
  const s = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(s); } catch { /* the lenient readers below */ }
  const a = s.indexOf("[");
  const o = s.indexOf("{");
  const start = a >= 0 && (o < 0 || a < o) ? a : o;
  const end = Math.max(s.lastIndexOf("]"), s.lastIndexOf("}"));
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(s.slice(start, end + 1)); } catch { return null; }
}

const fourNumbers = (value: unknown): [number, number, number, number] | null => {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const numbers = value.map(Number);
  return numbers.every((one) => Number.isFinite(one)) ? numbers as [number, number, number, number] : null;
};

/**
 * WHAT THE ANSWER SAID, or `null` for an answer nothing could read.
 *
 * `reparse5.mjs`'s three readers in its order. An empty list is an ANSWER —
 * nothing asked is in the picture — and is returned as `[]`, never `null`: the
 * pointer road rests on that difference.
 */
export function readBoxerAnswer(text: string, step: BoxerStep): RawEntry[] | null {
  let parsed = looseJson(text);
  if (parsed && !Array.isArray(parsed) && Array.isArray((parsed as { detections?: unknown }).detections)) {
    parsed = (parsed as { detections: unknown[] }).detections;
  }
  const entries: RawEntry[] = [];
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const raw = fourNumbers((item as Record<string, unknown> | null)?.[step.key]);
      const label = (item as { label?: unknown } | null)?.label;
      if (raw !== null && typeof label === "string") entries.push({ label, raw });
    }
    if (entries.length > 0 || parsed.length === 0) return entries;
  }
  /* Label before box — part 2's lenient reader. */
  const before = new RegExp(`"label"\\s*:\\s*"([^"]+)"\\s*,\\s*"${step.key}"\\s*:\\s*\\[([^\\]]+)\\]`, "g");
  for (let match = before.exec(text); match !== null; match = before.exec(text)) {
    const raw = fourNumbers(match[2].split(","));
    if (raw !== null) entries.push({ label: match[1], raw });
  }
  if (entries.length > 0) return entries;
  /* Box before label — the order part 4 saw Gemini 3.8 Flash write. */
  const after = new RegExp(`"${step.key}"\\s*:\\s*\\[([^\\]]+)\\]\\s*,\\s*"label"\\s*:\\s*"([^"]+)"`, "g");
  for (let match = after.exec(text); match !== null; match = after.exec(text)) {
    const raw = fourNumbers(match[1].split(","));
    if (raw !== null) entries.push({ label: match[2], raw });
  }
  return entries.length > 0 ? entries : null;
}

/**
 * ONE ANSWERED BOX INTO THIS FRAME'S OWN PIXELS, or `null` for a box with no area.
 *
 * Clamped to the picture and ordered, for the reason `detectBoxes` clamps the
 * detector's: a rectangle is the QUESTION the segmenter answers next, and an
 * edge past the frame is not a tighter box. The two layouts land on the same
 * pixels for the same rectangle — the guard's arm drives exactly that.
 */
export function toPixelBox(
  raw: readonly [number, number, number, number],
  layout: BoxLayout,
  width: number,
  height: number,
): PointerBox | null {
  const [a, b, c, d] = raw;
  const [top, left, bottom, right] = layout === "yxyx" ? [a, b, c, d] : [b, a, d, c];
  const clamp = (value: number): number => Math.min(Math.max(value, 0), BOX_SCALE) / BOX_SCALE;
  const x = Math.round(clamp(Math.min(left, right)) * width);
  const y = Math.round(clamp(Math.min(top, bottom)) * height);
  const far = Math.round(clamp(Math.max(left, right)) * width);
  const low = Math.round(clamp(Math.max(top, bottom)) * height);
  if (far <= x || low <= y) return null;
  return { x, y, width: far - x, height: low - y };
}

/** A label back to the name that was asked: exactly, then ignoring case and edges. */
function askedNameOf(label: string, names: readonly string[]): string | null {
  if (names.includes(label)) return label;
  const loose = label.trim().toLowerCase();
  return names.find((name) => name.trim().toLowerCase() === loose) ?? null;
}

/** The picture as #2846 sent it: PNG, 1024 on its short side, never enlarged. */
async function boxerPicture(image: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const meta = await sharp(image).metadata();
  const shortSide = Math.min(meta.width ?? 0, meta.height ?? 0);
  /* Never `.rotate()`: the boxes come back in the sent picture's own grid and
     are mapped onto the frame's metadata size, which is the UN-rotated grid
     every other reader of these bytes uses too. */
  const pipeline = sharp(image);
  if (shortSide > SHORT_SIDE) {
    const portrait = (meta.height ?? 0) >= (meta.width ?? 0);
    pipeline.resize(portrait ? { width: SHORT_SIDE } : { height: SHORT_SIDE });
  }
  return pipeline.png().toBuffer();
}

export type PointerBoxer = {
  /**
   * Every name's boxes in this frame's pixels, from ONE request per
   * {@link BOXER_MAX_NAMES} names — or `null` when every step failed, and the
   * caller's own detector answers instead. A name with no entry is `[]`: the
   * engine answering that it is not there.
   */
  boxAll(input: {
    image: Buffer;
    width: number;
    height: number;
    names: readonly string[];
    signal?: AbortSignal;
  }): Promise<ReadonlyMap<string, readonly PointerBox[]> | null>;
};

type StepFailure = { why: "timeout" | "refused" | "unreachable" | "truncated" | "unreadable" | "cancelled"; status?: number };

export function createOpenRouterBoxer(config: { apiKey: string; steps?: readonly BoxerStep[] }): PointerBoxer {
  const steps = config.steps ?? BOXER_STEPS;

  /** One step's answer for one batch of names, or why it gave none. */
  const ask = async (
    step: BoxerStep,
    names: readonly string[],
    png: Buffer,
    signal: AbortSignal | undefined,
  ): Promise<{ entries: RawEntry[] } | StepFailure> => {
    const timeout = AbortSignal.timeout(step.timeoutMs);
    const theirs = signal ? AbortSignal.any([signal, timeout]) : timeout;
    /* Counted INSIDE, and resolved rather than thrown on an unreadable 200, so
       a call the account paid for is a priced row even when its answer was no
       use. A transport failure throws and is a failed row with no price. */
    let reply: { text: string; finish: string | undefined };
    try {
      reply = await throughCensus(
        { stage: "segment", provider: "openrouter", model: step.model, about: POINTER_BOXER_ABOUT },
        async () => {
          const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
            method: "POST",
            headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify(boxerRequestBody(step, names, png)),
            signal: theirs,
          });
          if (!response.ok) {
            const body = await response.text().catch(() => "");
            throw Object.assign(new Error("refused"), {
              boxerFailure: { why: "refused", status: response.status, failureClass: classifyOpenRouterTextHttp(response.status, body) },
            });
          }
          const payload = (await response.json()) as {
            choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
            usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; cost?: unknown };
          };
          return {
            text: payload.choices?.[0]?.message?.content ?? "",
            finish: payload.choices?.[0]?.finish_reason,
            usage: payload.usage,
          };
        },
        (value) => {
          const count = (one: unknown): number | null =>
            typeof one === "number" && Number.isFinite(one) && one >= 0 ? one : null;
          const tokensIn = count(value.usage?.prompt_tokens);
          const tokensOut = count(value.usage?.completion_tokens);
          const cost = count(value.usage?.cost);
          return {
            ...(tokensIn !== null && tokensOut !== null ? { tokens: { in: tokensIn, out: tokensOut } } : {}),
            ...(cost !== null ? { costUsd: cost } : {}),
          };
        },
      );
    } catch (error) {
      const known = (error as { boxerFailure?: { why: "refused"; status: number } }).boxerFailure;
      if (known) return { why: "refused", status: known.status };
      const name = (error as Error)?.name;
      if (name === "TimeoutError" || timeout.aborted) return { why: "timeout" };
      if (name === "AbortError") return { why: "cancelled" };
      return { why: "unreachable" };
    }
    /* A reply cut off at the ceiling is a fragment, and a fragment that still
       parses reads as a SHORTER list — a missing row filed as an absence. */
    if (reply.finish === "length") return { why: "truncated" };
    const entries = readBoxerAnswer(reply.text, step);
    if (entries === null) return { why: "unreadable" };
    /* Boxes came back and not one carries a name that was asked: the answer is
       about something else, which is not the same as "none of them is there". */
    if (entries.length > 0 && entries.every((entry) => askedNameOf(entry.label, names) === null)) {
      return { why: "unreadable" };
    }
    return { entries };
  };

  const oneBatch = async (
    names: readonly string[],
    png: Buffer,
    width: number,
    height: number,
    signal: AbortSignal | undefined,
  ): Promise<Map<string, PointerBox[]> | null> => {
    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      const startedAt = Date.now();
      const answer = await ask(step, names, png, signal);
      if ("why" in answer) {
        log.warn(
          { engine: step.engine, model: step.model, step: index + 1, names: names.length, ms: Date.now() - startedAt, why: answer.why, ...(answer.status ? { status: answer.status } : {}) },
          "[pointerBoxer] this engine gave no usable boxes — the next one is asked",
        );
        if (answer.why === "cancelled") return null;
        continue;
      }
      const boxes = new Map<string, PointerBox[]>(names.map((name) => [name, []]));
      let unmatched = 0;
      for (const entry of answer.entries) {
        const asked = askedNameOf(entry.label, names);
        const box = toPixelBox(entry.raw, step.layout, width, height);
        if (asked === null) { unmatched += 1; continue; }
        if (box !== null) boxes.get(asked)!.push(box);
      }
      log.info(
        {
          engine: step.engine,
          model: step.model,
          step: index + 1,
          names: names.length,
          entries: answer.entries.length,
          unmatched,
          found: Array.from(boxes.values()).filter((list) => list.length > 0).length,
          ms: Date.now() - startedAt,
        },
        "[pointerBoxer] boxed a picture's names in one request",
      );
      return boxes;
    }
    return null;
  };

  return {
    async boxAll({ image, width, height, names, signal }) {
      const unique = Array.from(new Set(names));
      if (unique.length === 0) return new Map();
      let png: Buffer;
      try {
        png = await boxerPicture(image);
      } catch {
        log.warn({ names: unique.length }, "[pointerBoxer] the picture could not be prepared — today's detector answers");
        return null;
      }
      const batches: string[][] = [];
      for (let at = 0; at < unique.length; at += BOXER_MAX_NAMES) batches.push(unique.slice(at, at + BOXER_MAX_NAMES));
      const answers = await Promise.all(batches.map((batch) => oneBatch(batch, png, width, height, signal)));
      /* All or nothing: a batch the engines failed falls back WITH its picture's
         other names rather than leaving two engines' boxes on one panel. */
      if (answers.some((answer) => answer === null)) {
        log.warn({ names: unique.length, batches: batches.length }, "[pointerBoxer] every engine failed — today's detector answers");
        return null;
      }
      const all = new Map<string, readonly PointerBox[]>();
      for (const answer of answers) answer!.forEach((boxes, name) => all.set(name, boxes));
      return all;
    },
  };
}

/** One boxer for the process: it holds nothing per customer. */
let shared: { apiKey: string; boxer: PointerBoxer } | null = null;

/**
 * THE GATE AT THE POINT OF USE — the boxer for this user's reads, or
 * `undefined` for today's detector.
 *
 * Every road that builds a region reader for a `pointer` question asks this
 * with the account it is reading for, so one flag moves every road at once.
 * Off, or with no OpenRouter key, nothing is built and nothing changes.
 */
export function pointerBoxerFor(userId: number): PointerBoxer | undefined {
  if (!captureCastingPointerEngineEnabled(userId)) return undefined;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    log.warn({ userId }, "[pointerBoxer] the boxer is switched on with no OPENROUTER_API_KEY — today's detector answers");
    return undefined;
  }
  if (shared === null || shared.apiKey !== apiKey) shared = { apiKey, boxer: createOpenRouterBoxer({ apiKey }) };
  return shared.boxer;
}
