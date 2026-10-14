/**
 * THE VOICE TRANSPORT — ElevenLabs, N4b-1 (#2469).
 *
 * Design: `docs/specs/N4B_VOICE_DESIGN_2026-10-13.md`. One engine for creatures
 * and people alike, on his ear over six creature pairs (2026-10-13, verbatim):
 * *"okay ellevenlabs is clearly better and converting it to inworld is a hit
 * and a miss."* **Inworld is dropped** — no provider, no key, no fallback — so
 * this module is the only voice transport in the product and there is no engine
 * choice to leak (the disappearing-technology law's clause 5: a picker is a
 * feature, and voice is a casting door rather than a generator).
 *
 * # EVERY MODEL AND FORMAT HERE IS DATED AND REASONED, NEVER INHERITED
 *
 * Clause 1 of that law: *"best" has an expiry*, so a choice carries its date
 * and its reason and a rung that touches this road re-asks.
 *
 *   · `eleven_ttv_v3` for DESIGN — the only text-to-voice design model the
 *     spike reached (2026-10-13). Measured 6.4–9.9 s over ten designs, about
 *     $0.01 each, previews 13.6–16.9 s long. Re-measured through THIS module on
 *     2026-10-13: **6.5–8.3 s, three previews of 13.1–23.1 s, 314–554 KB each**.
 *     ⚠ **AND WHAT A DESIGN IS BILLED IS NOW KNOWN RATHER THAN GUESSED: the
 *     PREVIEW TEXT'S OWN CHARACTER COUNT, once, and ZERO voice operations** —
 *     driven with the counter read either side (204 characters in, 204 charged,
 *     operations unmoved). So the six unexplained 350-character *"Voice
 *     Generation"* charges the design flagged on #499 are six designs whose
 *     preview text was 350 characters; **nothing there is unaccounted for**, and
 *     the figure scales with our own preview text rather than with previews
 *     returned.
 *   · `eleven_v3` for SPEECH — the spike's model (2026-10-13). Measured
 *     1.4–5.3 s a line, about $0.001; and for the ~90 s audition, **29.3 s for
 *     1,348 characters returning 2.15 MB** (2026-10-13, through this module).
 *     `eleven_v4` is now listed and is UNJUDGED: whether it is the better
 *     speaking model is his ear's call and is named in the design's own
 *     unmeasured list, not decided here.
 *   · `mp3_44100_128` ASKED FOR EXPLICITLY on every call that returns audio.
 *     The format is a request parameter, and the spike's own note is why it is
 *     never left to a default: Inworld returned WAV where this returns MP3, so
 *     a road that inherits whatever arrives stores a file whose type it does
 *     not know. A stored clip's `contentType` is the one the provider reports,
 *     and the ask is what makes the two agree.
 *
 * # NOTHING PROVIDER-SHAPED LEAVES THIS FILE
 *
 * §E rule 1. A `generated_voice_id`, a `voice_id`, a request id, a raw provider
 * message: internal, every one. Callers get bytes, an opaque id this product
 * stores, and a {@link ProviderError} from the closed taxonomy. The key's value
 * is never logged and never put in a message.
 */
import { ProviderError, type ProviderFailureClass } from "./types";
import type { VoiceAllowance, VoiceEngine, VoicePreview } from "./voiceTypes";
import { createModuleLogger } from "../logging/logger";

const log = createModuleLogger("providers/elevenlabsVoice");

export const ELEVENLABS_API_KEY_VARIABLE = "ELEVENLABS_API_KEY";
const API_BASE = "https://api.elevenlabs.io";

/** Dated 2026-10-13 — see the header. A change here is a quality decision. */
export const ELEVENLABS_DESIGN_MODEL = "eleven_ttv_v3";
export const ELEVENLABS_SPEECH_MODEL = "eleven_v3";
export const ELEVENLABS_OUTPUT_FORMAT = "mp3_44100_128";

/**
 * The provider's own floors on a design call, and they are REFUSALS rather than
 * advice — driven on 2026-10-13, both arms:
 *
 *   · `voice_description` under 20 characters → 422.
 *   · `text`, when sent, outside 100–1000 characters → 422.
 *
 * They are named here because the customer's voice line is free text and can be
 * shorter than 20 characters, so the road above must be able to tell "your
 * words are too short to make a voice from" apart from an outage. A 422 with no
 * floor to point at is indistinguishable from the provider having moved.
 */
export const ELEVENLABS_DESCRIPTION_MIN_CHARS = 20;
export const ELEVENLABS_DESCRIPTION_MAX_CHARS = 1000;
export const ELEVENLABS_PREVIEW_TEXT_MIN_CHARS = 100;
export const ELEVENLABS_PREVIEW_TEXT_MAX_CHARS = 1000;

/** How long any one call may take before it is OUR timeout rather than theirs. */
const DESIGN_TIMEOUT_MS = 120_000;
const SPEAK_TIMEOUT_MS = 180_000;
const SHORT_TIMEOUT_MS = 30_000;

/**
 * Status → failure class, on `openrouterText.ts`'s reasoning clause for clause.
 *
 * ⚠ **401/403 is OUR account and never the request** — the split that exists
 * because an overdrawn OpenRouter balance once read as *"the judge could not be
 * reached"*, an outage dressed as weather. A bad or missing voice key fails
 * every subsequent call identically and no customer action fixes it.
 */
export function classifyElevenLabsHttp(status: number, body: string): ProviderFailureClass {
  if (status === 429) return "rate_limit";
  if (status >= 500) return "transport";
  if (status === 408 || status === 504) return "timeout";
  if (status === 401 || status === 402 || status === 403) return "provider_account";
  if (status === 404) return "capability";
  if (status === 400 || status === 422) {
    /*
      Their own refusal taxonomy, matched on named phrases only. The M3 lesson
      this inherits: a classifier that read the substring "content" inside
      `content_type` turned five transient errors into permanent refusals.
    */
    const lowered = body.toLowerCase();
    if (
      lowered.includes("voice_add_edit_limit")
      || lowered.includes("voice_limit_reached")
      || lowered.includes("max_voice")
      || lowered.includes("subscription")
    ) {
      return "provider_account";
    }
    if (lowered.includes("moderation") || lowered.includes("blocked")) return "content_policy";
    return "capability";
  }
  return "unknown";
}

function requireKey(): string {
  const key = process.env[ELEVENLABS_API_KEY_VARIABLE];
  if (!key) {
    /*
      `provider_account` and not `capability`: an absent key is our account
      being unusable, it fails every call the same way, and no customer action
      fixes it. The message names the VARIABLE and never its value.
    */
    throw new ProviderError(
      "provider_account",
      `The voice transport is not configured (${ELEVENLABS_API_KEY_VARIABLE})`,
    );
  }
  return key;
}

type RequestInitLike = {
  method: "GET" | "POST" | "DELETE";
  path: string;
  body?: unknown;
  /**
   * A multipart body — the clone call (#2472) uploads the clip as a file.
   * `fetch` writes the boundary into the content type itself, so no
   * `Content-Type` header is set for it here (setting one drops the boundary).
   */
  form?: FormData;
  timeoutMs: number;
  signal?: AbortSignal;
  /** Audio comes back as bytes; everything else as JSON. */
  expect: "json" | "bytes" | "empty";
};

async function call(input: RequestInitLike): Promise<{
  json?: unknown;
  bytes?: Buffer;
  contentType?: string;
  providerRef?: string;
  latencyMs: number;
}> {
  const key = requireKey();
  const started = Date.now();
  /*
    OUR deadline, composed with the caller's cancellation. `AbortSignal.any` so
    a cancelled Keep stops the request instead of waiting out the timeout, and
    the two are told apart below — a timeout may still be billed, a cancel is
    ours.
  */
  const deadline = AbortSignal.timeout(input.timeoutMs);
  const signal = input.signal ? AbortSignal.any([deadline, input.signal]) : deadline;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${input.path}`, {
      method: input.method,
      headers: {
        "xi-api-key": key,
        ...(input.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(input.form !== undefined
        ? { body: input.form }
        : input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
      signal,
    });
  } catch (error) {
    const name = (error as Error)?.name;
    if (name === "TimeoutError") {
      throw new ProviderError("timeout", "The voice call exceeded its deadline", { cause: error });
    }
    if (name === "AbortError") {
      throw new ProviderError("capability", "cancelled", { cause: error });
    }
    throw new ProviderError("transport", "The voice transport is unreachable", { cause: error });
  }

  const providerRef = response.headers.get("request-id")
    ?? response.headers.get("x-request-id")
    ?? undefined;

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const failureClass = classifyElevenLabsHttp(response.status, body);
    /*
      The STATUS and the CLASS are logged; the body is not. A provider error
      body echoes the request, and a design request carries the customer's own
      voice line — which is on `REFUSING_KEYS` for exactly this reason.
    */
    log.warn(
      { status: response.status, failureClass, providerRef, path: input.path },
      "[ElevenLabsVoice] request refused",
    );
    throw new ProviderError(failureClass, "The voice call was refused", {
      status: response.status,
      providerRef,
    });
  }

  const latencyMs = Date.now() - started;
  if (input.expect === "empty") return { providerRef, latencyMs };
  if (input.expect === "bytes") {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0) {
      throw new ProviderError("unknown", "The voice call returned no audio", {
        status: response.status,
        providerRef,
        /* The call SUCCEEDED, so it is billed whatever happens next (#1982). */
        completed: true,
      });
    }
    return {
      bytes: buffer,
      contentType: response.headers.get("content-type") ?? "audio/mpeg",
      providerRef,
      latencyMs,
    };
  }
  return { json: await response.json(), providerRef, latencyMs };
}

function readNumber(source: Record<string, unknown>, field: string): number {
  const value = source[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    /*
      ⚠ A MISSING CEILING IS A REFUSAL, NOT A ZERO AND NOT A DEFAULT. This is
      the read a Keep asks before it spends, and #2469's own correction is the
      cost of guessing: a hard-coded 3 would have refused a Keep with 27 slots
      free. An unparseable answer has to refuse the spend (invariant 7) rather
      than fall back to a number nobody measured.
    */
    throw new ProviderError("unknown", `The voice allowance did not report ${field}`, {
      completed: true,
    });
  }
  return value;
}

/**
 * The same read for a field that is a READING rather than a ceiling on a spend.
 *
 * ⚠ **IT RETURNS `null` AND DOES NOT REFUSE, AND THE ASYMMETRY WITH
 * {@link readNumber} ABOVE IS THE WHOLE POINT (#2509).** That function's
 * reasoning is *"this is the read a Keep asks before it spends"* — true of the
 * slot and operation ceilings, which gate money. The character meter gates
 * nothing in this product today: it is projected to the staff panel so the
 * house's one shared budget is visible at all. Reading it with `readNumber`
 * would hand a diagnostic field the power to refuse every Keep the first time
 * the provider omitted it on some plan shape, which is a worse failure than the
 * row it would protect.
 *
 * **`null` means NOT REPORTED and is never shown as a zero** — the staff
 * projection carries the absence through rather than inventing a number, which
 * is the distinction a previous shift's own mistake turned on: an absent field
 * and an unfetched field look identical unless something says which.
 */
function readOptionalNumber(source: Record<string, unknown>, field: string): number | null {
  const value = source[field];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function createElevenLabsVoiceEngine(): VoiceEngine {
  return {
    id: "elevenlabs",

    async readAllowance(input = {}) {
      const { json } = await call({
        method: "GET",
        path: "/v1/user/subscription",
        timeoutMs: SHORT_TIMEOUT_MS,
        signal: input.signal,
        expect: "json",
      });
      const body = (json ?? {}) as Record<string, unknown>;
      const allowance: VoiceAllowance = {
        slotsTotal: readNumber(body, "voice_limit"),
        slotsUsed: readNumber(body, "voice_slots_used"),
        operationsTotal: readNumber(body, "max_voice_add_edits"),
        operationsUsed: readNumber(body, "voice_add_edit_counter"),
        /* The house-wide character meter — same call, same body, nothing extra
           spent. #2509, and the reasoning is on the field in `voiceTypes.ts`:
           these two were already arriving and being thrown away. Optional on
           purpose — see `readOptionalNumber`: a meter nothing gates on must not
           be able to refuse a Keep. */
        charactersTotal: readOptionalNumber(body, "character_limit"),
        charactersUsed: readOptionalNumber(body, "character_count"),
        instantCloning: body.can_use_instant_voice_cloning === true,
        tier: typeof body.tier === "string" ? body.tier : "unknown",
      };
      return allowance;
    },

    async designVoices(input) {
      const description = input.description.trim();
      if (description.length < ELEVENLABS_DESCRIPTION_MIN_CHARS) {
        /*
          Refused HERE rather than at the wire so the road above gets a class it
          can act on, and so a customer's short voice line never buys a 422. It
          is a `capability` refusal: the request asked for something this engine
          cannot do, and nothing was spent.
        */
        throw new ProviderError(
          "capability",
          `A voice needs at least ${ELEVENLABS_DESCRIPTION_MIN_CHARS} characters to design from`,
        );
      }
      const payload: Record<string, unknown> = {
        voice_description: description.slice(0, ELEVENLABS_DESCRIPTION_MAX_CHARS),
        model_id: ELEVENLABS_DESIGN_MODEL,
        output_format: ELEVENLABS_OUTPUT_FORMAT,
      };
      /*
        ⚠ ALWAYS SENT, NEVER CONDITIONAL — driven at the wire 2026-10-13. With
        no `text` the provider answers 400 `"You need to provide either 'text'
        or 'auto_generate_text'"`, so the old `if (previewText !== undefined)`
        could build a request that could only ever be refused. The field is
        required in {@link VoiceEngine} now, which makes that a typecheck error
        instead of a 400; this stays a REFUSAL on length rather than a silent
        truncation, because a preview read from the wrong number of words is a
        worse answer than a clear one.
      */
      const text = input.previewText.trim();
      if (
        text.length < ELEVENLABS_PREVIEW_TEXT_MIN_CHARS
        || text.length > ELEVENLABS_PREVIEW_TEXT_MAX_CHARS
      ) {
        throw new ProviderError(
          "capability",
          `Preview text must be ${ELEVENLABS_PREVIEW_TEXT_MIN_CHARS}–${ELEVENLABS_PREVIEW_TEXT_MAX_CHARS} characters`,
        );
      }
      payload.text = text;

      const { json, latencyMs, providerRef } = await call({
        method: "POST",
        path: "/v1/text-to-voice/design",
        body: payload,
        timeoutMs: DESIGN_TIMEOUT_MS,
        signal: input.signal,
        expect: "json",
      });

      const raw = ((json ?? {}) as { previews?: unknown }).previews;
      if (!Array.isArray(raw) || raw.length === 0) {
        /* Succeeded and produced nothing — billed, and not retryable here. */
        throw new ProviderError("unknown", "The design returned no voices", {
          providerRef,
          completed: true,
        });
      }

      const previews: VoicePreview[] = [];
      for (const entry of raw) {
        const row = (entry ?? {}) as Record<string, unknown>;
        const previewId = row.generated_voice_id;
        const audio = row.audio_base_64;
        if (typeof previewId !== "string" || typeof audio !== "string" || audio.length === 0) {
          throw new ProviderError("unknown", "A designed voice arrived incomplete", {
            providerRef,
            completed: true,
          });
        }
        previews.push({
          previewId,
          bytes: Buffer.from(audio, "base64"),
          contentType: typeof row.media_type === "string" ? row.media_type : "audio/mpeg",
          ...(typeof row.duration_secs === "number" ? { durationSeconds: row.duration_secs } : {}),
        });
      }
      return { previews, latencyMs };
    },

    async saveVoice(input) {
      const { json, latencyMs, providerRef } = await call({
        method: "POST",
        path: "/v1/text-to-voice",
        body: {
          voice_name: input.name,
          voice_description: input.description.slice(0, ELEVENLABS_DESCRIPTION_MAX_CHARS),
          generated_voice_id: input.previewId,
        },
        timeoutMs: SHORT_TIMEOUT_MS,
        signal: input.signal,
        expect: "json",
      });
      const voiceId = ((json ?? {}) as { voice_id?: unknown }).voice_id;
      if (typeof voiceId !== "string" || voiceId.length === 0) {
        /*
          ⚠ `completed: true` AND IT MATTERS MORE HERE THAN ANYWHERE ELSE IN
          THIS FILE. A save that answered 200 has already spent a voice
          operation and a slot; a retry would spend a second one and the
          operation is NOT refundable by a delete (measured). So the road must
          see "we were billed" even though it holds no id.
        */
        throw new ProviderError("unknown", "The saved voice came back without an id", {
          providerRef,
          completed: true,
        });
      }
      return { voiceId, latencyMs };
    },

    async speak(input) {
      const { bytes, contentType, latencyMs } = await call({
        method: "POST",
        path: `/v1/text-to-speech/${encodeURIComponent(input.voiceId)}?output_format=${ELEVENLABS_OUTPUT_FORMAT}`,
        body: { text: input.text, model_id: ELEVENLABS_SPEECH_MODEL },
        timeoutMs: SPEAK_TIMEOUT_MS,
        signal: input.signal,
        expect: "bytes",
      });
      return { bytes: bytes as Buffer, contentType: contentType ?? "audio/mpeg", latencyMs };
    },

    async cloneVoice(input) {
      /*
        THE RE-MINT'S WIRE — the shape the re-mint court drove on his account
        (2026-10-13, `drape-scratch/n4b-spike/10-remint.mjs`): `POST
        /v1/voices/add`, multipart, a `name` and the clip as `files`. Answered
        200 in 2.7–4.7 s with `requires_verification: false`, and his ear passed
        what it made. Nothing else is sent: no description and no labels, since
        a provider-side label is one more place a customer's words could travel.
      */
      const form = new FormData();
      form.append("name", input.name);
      form.append(
        "files",
        new Blob([new Uint8Array(input.bytes)], { type: input.contentType }),
        "audition.mp3",
      );
      const { json, latencyMs, providerRef } = await call({
        method: "POST",
        path: "/v1/voices/add",
        form,
        timeoutMs: DESIGN_TIMEOUT_MS,
        signal: input.signal,
        expect: "json",
      });
      const voiceId = ((json ?? {}) as { voice_id?: unknown }).voice_id;
      if (typeof voiceId !== "string" || voiceId.length === 0) {
        /* Billed exactly as a save that came back without an id is (above). */
        throw new ProviderError("unknown", "The re-minted voice came back without an id", {
          providerRef,
          completed: true,
        });
      }
      return { voiceId, latencyMs };
    },

    async findVoicesByName(input) {
      /*
        `GET /v2/voices` — the same read the voice spike's probe drove on his
        account (`drape-scratch/n4b-spike/00-probe.mjs`: `voice_type=personal`,
        200 in 261 ms, `voices[]` of `voice_id` / `name`). `search` narrows the
        page; it is a fuzzy match, so the EXACT name is compared here and
        nothing else is trusted. One page of 100: an attempt name is unique, so
        more than a handful of hits is already not ours.
      */
      const query = new URLSearchParams({
        search: input.name,
        voice_type: "personal",
        page_size: "100",
      });
      const { json } = await call({
        method: "GET",
        path: `/v2/voices?${query.toString()}`,
        timeoutMs: SHORT_TIMEOUT_MS,
        signal: input.signal,
        expect: "json",
      });
      const voices = ((json ?? {}) as { voices?: unknown }).voices;
      if (!Array.isArray(voices)) return [];
      return voices
        .filter((voice): voice is { voice_id: string; name: string } =>
          typeof voice === "object" && voice !== null
          && typeof (voice as { voice_id?: unknown }).voice_id === "string"
          && (voice as { name?: unknown }).name === input.name)
        .map((voice) => voice.voice_id);
    },

    async deleteVoice(input) {
      await call({
        method: "DELETE",
        path: `/v1/voices/${encodeURIComponent(input.voiceId)}`,
        timeoutMs: SHORT_TIMEOUT_MS,
        signal: input.signal,
        expect: "empty",
      });
    },
  };
}
