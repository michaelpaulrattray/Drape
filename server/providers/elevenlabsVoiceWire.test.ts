/**
 * THE VOICE ENGINE, AT THE WIRE — N4b-1 (#2469; working law 5: a contract about
 * what gets SENT is proven on the outgoing request, never on a constant near
 * it).
 *
 * Four things in this transport are decided in the request and are invisible to
 * anyone reading the service above it, and each has a way of failing quietly:
 *
 *   · **the output format.** `mp3_44100_128` is ASKED FOR, because the format is
 *     a request parameter and the previous candidate engine returned WAV. A
 *     road that inherits whatever arrives stores a file whose type it does not
 *     know and writes that wrong type into `cast_voices.clipContentType`.
 *   · **the two model ids**, which are the dated capability choices.
 *   · **the design's `voice_description`**, which is the customer's own voice
 *     line — so this suite also proves the floor refusal happens BEFORE the
 *     wire, since a 422 bought with a customer's short sentence is a cost and a
 *     worse message.
 *   · **the save's `generated_voice_id`**, which is the one id that makes Keep
 *     keep the voice the customer actually picked rather than a sibling.
 *
 * The transport is stubbed at `global.fetch`: nothing leaves the machine, no
 * key is read for real, and no money moves.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProviderError } from "./types";
import {
  classifyElevenLabsHttp,
  createElevenLabsVoiceEngine,
  ELEVENLABS_API_KEY_VARIABLE,
  ELEVENLABS_DESCRIPTION_MIN_CHARS,
  ELEVENLABS_DESIGN_MODEL,
  ELEVENLABS_OUTPUT_FORMAT,
  ELEVENLABS_SPEECH_MODEL,
} from "./elevenlabsVoice";

/** Legal preview text — 100–1000 characters, which the provider REQUIRES. */
const PREVIEW_TEXT = "x".repeat(140);

/** A believable MP3 payload — the bytes are never decoded, only measured. */
const CLIP = Buffer.from("ID3\u0004\u0000\u0000\u0000a voice", "utf8");

type Captured = { url: string; method: string; body: Record<string, unknown> | null; key: string | null };

function stubVoiceTransport(responses: {
  subscription?: Record<string, unknown>;
  design?: Record<string, unknown>;
  save?: Record<string, unknown>;
  speakStatus?: number;
}): { captured: Captured[] } {
  const captured: Captured[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const address = String(url);
      const headers = (init?.headers ?? {}) as Record<string, string>;
      captured.push({
        url: address,
        method: init?.method ?? "GET",
        body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null,
        key: headers["xi-api-key"] ?? null,
      });
      if (address.includes("/v1/user/subscription")) {
        return new Response(JSON.stringify(responses.subscription ?? {
          tier: "creator",
          voice_limit: 30,
          voice_slots_used: 0,
          max_voice_add_edits: 95,
          voice_add_edit_counter: 4,
          /* A real answer carries these — read live 2026-10-14 (#2509). The
             default mirrors the provider so every other arm here sees the
             shape production sees; the absent case has its own arm below. */
          character_limit: 182297,
          character_count: 8782,
          can_use_instant_voice_cloning: true,
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (address.includes("/v1/text-to-voice/design")) {
        return new Response(JSON.stringify(responses.design ?? {
          previews: [1, 2, 3].map((n) => ({
            generated_voice_id: `preview-${n}`,
            audio_base_64: CLIP.toString("base64"),
            media_type: "audio/mpeg",
            duration_secs: 14.2,
          })),
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (address.includes("/v1/text-to-speech/")) {
        const status = responses.speakStatus ?? 200;
        if (status !== 200) return new Response("{}", { status });
        return new Response(CLIP, { status: 200, headers: { "content-type": "audio/mpeg" } });
      }
      if (address.includes("/v1/text-to-voice")) {
        return new Response(JSON.stringify(responses.save ?? { voice_id: "saved-voice-7" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (address.includes("/v1/voices/")) return new Response("", { status: 200 });
      throw new Error(`unexpected call: ${address}`);
    }),
  );
  return { captured };
}

/** A description long enough to clear the engine's own floor. */
const LONG_LINE = "A low, unhurried voice with a dry edge and a habit of trailing off.";

describe("the voice transport's outgoing requests", () => {
  const originalKey = process.env[ELEVENLABS_API_KEY_VARIABLE];

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalKey === undefined) delete process.env[ELEVENLABS_API_KEY_VARIABLE];
    else process.env[ELEVENLABS_API_KEY_VARIABLE] = originalKey;
  });

  it("asks for MP3 and the dated design model, and sends the customer's line as the description", async () => {
    process.env[ELEVENLABS_API_KEY_VARIABLE] = "sk_test_key";
    const { captured } = stubVoiceTransport({});

    const { previews } = await createElevenLabsVoiceEngine().designVoices({
      description: LONG_LINE,
      previewText: PREVIEW_TEXT,
    });

    expect(previews).toHaveLength(3);
    expect(previews[0]!.previewId).toBe("preview-1");
    expect(previews[0]!.bytes.equals(CLIP)).toBe(true);
    expect(previews[0]!.contentType).toBe("audio/mpeg");

    const design = captured.find((call) => call.url.includes("/design"));
    expect(design?.method).toBe("POST");
    expect(design?.key).toBe("sk_test_key");
    expect(design?.body).toMatchObject({
      voice_description: LONG_LINE,
      model_id: ELEVENLABS_DESIGN_MODEL,
      output_format: ELEVENLABS_OUTPUT_FORMAT,
    });
    expect(ELEVENLABS_OUTPUT_FORMAT).toBe("mp3_44100_128");
  });

  it("asks for MP3 and the dated speech model on the URL and in the body", async () => {
    process.env[ELEVENLABS_API_KEY_VARIABLE] = "sk_test_key";
    const { captured } = stubVoiceTransport({});

    const spoken = await createElevenLabsVoiceEngine().speak({
      voiceId: "saved-voice-7",
      text: "the house passage",
    });

    expect(spoken.bytes.equals(CLIP)).toBe(true);
    expect(spoken.contentType).toBe("audio/mpeg");
    const speak = captured.find((call) => call.url.includes("/text-to-speech/"));
    expect(speak?.url).toContain("saved-voice-7");
    expect(speak?.url).toContain(`output_format=${ELEVENLABS_OUTPUT_FORMAT}`);
    expect(speak?.body).toMatchObject({ model_id: ELEVENLABS_SPEECH_MODEL, text: "the house passage" });
  });

  it("saves THE PREVIEW THE CUSTOMER PICKED, by its own id", async () => {
    process.env[ELEVENLABS_API_KEY_VARIABLE] = "sk_test_key";
    const { captured } = stubVoiceTransport({});

    const saved = await createElevenLabsVoiceEngine().saveVoice({
      previewId: "preview-2",
      name: "klieg-1-42",
      description: LONG_LINE,
    });

    expect(saved.voiceId).toBe("saved-voice-7");
    const save = captured.find((call) => call.url.endsWith("/v1/text-to-voice"));
    expect(save?.body).toMatchObject({ generated_voice_id: "preview-2", voice_name: "klieg-1-42" });
  });

  it("reads BOTH ceilings off the live subscription and never a constant", async () => {
    process.env[ELEVENLABS_API_KEY_VARIABLE] = "sk_test_key";
    stubVoiceTransport({
      subscription: {
        tier: "pay-as-you-go",
        voice_limit: 3,
        voice_slots_used: 3,
        max_voice_add_edits: 54,
        voice_add_edit_counter: 54,
        character_limit: 30000,
        character_count: 29998,
        can_use_instant_voice_cloning: false,
      },
    });

    const allowance = await createElevenLabsVoiceEngine().readAllowance();

    /*
      THE WHOLE POINT OF THE ARM: these are #2469's own superseded figures. A
      reader that answered 30/95 here would be reading our source instead of
      the account, which is the defect the card's correction exists to stop.
    */
    expect(allowance).toEqual({
      slotsTotal: 3,
      slotsUsed: 3,
      operationsTotal: 54,
      operationsUsed: 54,
      charactersTotal: 30000,
      charactersUsed: 29998,
      instantCloning: false,
      tier: "pay-as-you-go",
    });
  });

  it("REFUSES rather than guessing when a ceiling is missing from the answer", async () => {
    process.env[ELEVENLABS_API_KEY_VARIABLE] = "sk_test_key";
    stubVoiceTransport({
      subscription: { tier: "creator", voice_slots_used: 0, max_voice_add_edits: 95, voice_add_edit_counter: 4 },
    });

    /* No `voice_limit`. A zero or a default here is a refusal with slots free. */
    await expect(createElevenLabsVoiceEngine().readAllowance()).rejects.toThrow(/voice_limit/);
  });

  /*
    THE ASYMMETRY ARM, AND IT IS THE REASON #2509 CHOSE A NULLABLE FIELD. The
    arm above proves a missing SPEND ceiling refuses; this proves a missing
    house METER does not. Both directions are needed, because getting this one
    wrong is invisible until the provider drops a field and every Keep in the
    product starts refusing on a number the panel only ever displayed.
  */
  it("does NOT refuse when the house character meter is missing — it reports it absent", async () => {
    process.env[ELEVENLABS_API_KEY_VARIABLE] = "sk_test_key";
    stubVoiceTransport({
      subscription: {
        tier: "creator",
        voice_limit: 30,
        voice_slots_used: 2,
        max_voice_add_edits: 95,
        voice_add_edit_counter: 10,
        can_use_instant_voice_cloning: true,
        /* Both character fields absent — the shape a plan that does not report
           them would send. The spend ceilings are all present. */
      },
    });

    const allowance = await createElevenLabsVoiceEngine().readAllowance();

    expect(allowance.charactersTotal).toBeNull();
    expect(allowance.charactersUsed).toBeNull();
    /* And the reading a Keep depends on is untouched — the whole point. */
    expect(allowance.slotsTotal).toBe(30);
    expect(allowance.operationsTotal).toBe(95);
  });

  it("reads a zero character meter as zero and never as absent", async () => {
    process.env[ELEVENLABS_API_KEY_VARIABLE] = "sk_test_key";
    stubVoiceTransport({
      subscription: {
        tier: "creator",
        voice_limit: 30,
        voice_slots_used: 2,
        max_voice_add_edits: 95,
        voice_add_edit_counter: 10,
        can_use_instant_voice_cloning: true,
        /* A spent month, which is a FACT and not an absence. The two render
           differently on the panel, so a reader that conflated them would say
           "Not reported" about a house that cannot speak. */
        character_limit: 182297,
        character_count: 182297,
      },
    });

    const allowance = await createElevenLabsVoiceEngine().readAllowance();

    expect(allowance.charactersUsed).toBe(182297);
    expect(allowance.charactersTotal).toBe(182297);
  });

  it("⚠ ALWAYS sends `text`, because a design without it is a 400 the provider will not serve", async () => {
    /*
      Driven at the real wire on 2026-10-13, both arms: with no `text` the
      provider answers **400 `"You need to provide either 'text' or
      'auto_generate_text'"`**, and with it, 200 and three previews. So an
      outgoing design request that carries no `text` is one that can only ever
      be refused — and `previewText` was OPTIONAL in `VoiceEngine` until that
      run, which no shipped road could have exposed because the service always
      sends the house passage's opening. The field is required now; this arm is
      the wire half of that, since a type cannot prove what was SENT
      (working law 5).
    */
    process.env[ELEVENLABS_API_KEY_VARIABLE] = "sk_test_key";
    const { captured } = stubVoiceTransport({});

    await createElevenLabsVoiceEngine().designVoices({
      description: LONG_LINE,
      previewText: PREVIEW_TEXT,
    });

    const design = captured.find((call) => call.url.includes("/design"));
    expect(design?.body?.text).toBe(PREVIEW_TEXT);
  });

  it("refuses a short line BEFORE the wire, so a customer's words never buy a 422", async () => {
    process.env[ELEVENLABS_API_KEY_VARIABLE] = "sk_test_key";
    const { captured } = stubVoiceTransport({});

    const short = "x".repeat(ELEVENLABS_DESCRIPTION_MIN_CHARS - 1);
    await expect(
      createElevenLabsVoiceEngine().designVoices({ description: short, previewText: PREVIEW_TEXT }),
    ).rejects.toBeInstanceOf(ProviderError);

    /* NOTHING was sent — that is the claim, and only the wire can prove it. */
    expect(captured).toHaveLength(0);
  });

  it("refuses with the VARIABLE NAME and never its value when the key is absent", async () => {
    delete process.env[ELEVENLABS_API_KEY_VARIABLE];
    const { captured } = stubVoiceTransport({});

    const error = await createElevenLabsVoiceEngine()
      .readAllowance()
      .then(() => null, (caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).failureClass).toBe("provider_account");
    expect((error as ProviderError).message).toContain(ELEVENLABS_API_KEY_VARIABLE);
    expect(captured).toHaveLength(0);
  });

  it("marks a save that answered 200 with no id as BILLED, so no road retries it", async () => {
    process.env[ELEVENLABS_API_KEY_VARIABLE] = "sk_test_key";
    stubVoiceTransport({ save: { detail: "ok but empty" } });

    const error = await createElevenLabsVoiceEngine()
      .saveVoice({ previewId: "preview-1", name: "klieg-1-42", description: LONG_LINE })
      .then(() => null, (caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    /*
      A save spends a voice operation that a delete does NOT refund (measured),
      so a retry buys a second one. `completed` is how a road knows.
    */
    expect((error as ProviderError).completed).toBe(true);
  });

  it("maps a provider status onto the one failure taxonomy, including OUR account", () => {
    expect(classifyElevenLabsHttp(429, "")).toBe("rate_limit");
    expect(classifyElevenLabsHttp(503, "")).toBe("transport");
    expect(classifyElevenLabsHttp(401, "")).toBe("provider_account");
    expect(classifyElevenLabsHttp(402, "")).toBe("provider_account");
    /* Their own ceiling refusals are OUR account, not the request. */
    expect(classifyElevenLabsHttp(422, '{"detail":{"status":"voice_add_edit_limit_reached"}}'))
      .toBe("provider_account");
    expect(classifyElevenLabsHttp(400, '{"detail":"max_voice_limit"}')).toBe("provider_account");
    /* And an ordinary bad request stays a capability refusal. */
    expect(classifyElevenLabsHttp(422, '{"detail":"text too short"}')).toBe("capability");
    /* The M3 lesson: a transient error must not be read as a refusal. */
    expect(classifyElevenLabsHttp(500, '{"detail":"content_type"}')).toBe("transport");
  });

  it("never puts the provider's error BODY in the error it throws", async () => {
    process.env[ELEVENLABS_API_KEY_VARIABLE] = "sk_test_key";
    const leak = "A low, unhurried voice — the customer's own sentence, echoed back";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ detail: { request: leak } }), { status: 422 })),
    );

    const error = await createElevenLabsVoiceEngine()
      .designVoices({ description: LONG_LINE, previewText: PREVIEW_TEXT })
      .then(() => null, (caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    /*
      A provider's 4xx body echoes the request, and a design request carries the
      customer's voice line — which is on `REFUSING_KEYS` for this reason.
    */
    expect((error as ProviderError).message).not.toContain(leak);
    expect(String((error as ProviderError).message)).toBe("The voice call was refused");
  });
});

/**
 * THE RE-MINT, AT THE WIRE — N4b-4 (#2472).
 *
 * The court drove `POST /v1/voices/add` on his account (multipart: a `name`
 * and the clip as `files`), and his ear passed what it made. What can go wrong
 * here quietly is the BODY: a JSON content type set by hand on a multipart
 * request strips the boundary, and a clip sent as anything but its own bytes
 * clones the wrong voice. So the request is captured and read back.
 */
describe("the re-mint's outgoing request (#2472)", () => {
  const originalKey = process.env[ELEVENLABS_API_KEY_VARIABLE];

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalKey === undefined) delete process.env[ELEVENLABS_API_KEY_VARIABLE];
    else process.env[ELEVENLABS_API_KEY_VARIABLE] = originalKey;
  });

  function stubClone(answer: Record<string, unknown>): Array<{ url: string; init: RequestInit }> {
    const seen: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        seen.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify(answer), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );
    return seen;
  }

  it("⚠ posts the clip's OWN bytes as a multipart file to /v1/voices/add, with our name and nothing else", async () => {
    process.env[ELEVENLABS_API_KEY_VARIABLE] = "sk_test_key";
    const seen = stubClone({ voice_id: "reminted-1", requires_verification: false });

    const result = await createElevenLabsVoiceEngine().cloneVoice({
      name: "klieg-1-904",
      bytes: CLIP,
      contentType: "audio/mpeg",
    });

    expect(result.voiceId).toBe("reminted-1");
    expect(seen).toHaveLength(1);
    const [request] = seen;
    expect(request?.url).toBe("https://api.elevenlabs.io/v1/voices/add");
    expect(request?.init.method).toBe("POST");
    const headers = request?.init.headers as Record<string, string>;
    expect(headers["xi-api-key"]).toBe("sk_test_key");
    /* No hand-set content type: fetch writes the multipart boundary itself. */
    expect(headers["Content-Type"]).toBeUndefined();
    const form = request?.init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect([...form.keys()].sort()).toEqual(["files", "name"]);
    expect(form.get("name")).toBe("klieg-1-904");
    const file = form.get("files") as Blob;
    expect(file.type).toBe("audio/mpeg");
    expect(Buffer.from(await file.arrayBuffer()).equals(CLIP)).toBe(true);
  });

  it("marks a clone that answered 200 with no id as BILLED, so no road retries it", async () => {
    process.env[ELEVENLABS_API_KEY_VARIABLE] = "sk_test_key";
    stubClone({ requires_verification: false });

    const error = await createElevenLabsVoiceEngine()
      .cloneVoice({ name: "klieg-1-904", bytes: CLIP, contentType: "audio/mpeg" })
      .then(() => null, (caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).completed).toBe(true);
  });
});

/**
 * THE ORPHAN SWEEP'S LOOKUP, AT THE WIRE — #2507 (the relay's finding, item 3).
 *
 * A save or clone that did not answer may have made a voice. The service looks
 * it up by its unique attempt name and releases what it finds — so what must
 * hold here is that the lookup trusts the provider's FUZZY search for nothing:
 * only a voice whose name is EXACTLY the attempt's comes back, and a near miss
 * (another attempt for the same cast) is never handed over to be deleted.
 */
describe("the orphan sweep's lookup (#2507)", () => {
  const originalKey = process.env[ELEVENLABS_API_KEY_VARIABLE];

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalKey === undefined) delete process.env[ELEVENLABS_API_KEY_VARIABLE];
    else process.env[ELEVENLABS_API_KEY_VARIABLE] = originalKey;
  });

  it("⚠ reads /v2/voices for our personal voices by name, and returns ONLY exact-name matches", async () => {
    process.env[ELEVENLABS_API_KEY_VARIABLE] = "sk_test_key";
    const seen: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        seen.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify({
          voices: [
            { voice_id: "orphan-1", name: "klieg-1-904-a1b2c3d4" },
            /* The fuzzy search's near misses: another attempt, and a prefix. */
            { voice_id: "someone-elses", name: "klieg-1-904-ffffffff" },
            { voice_id: "prefix-only", name: "klieg-1-904" },
            { name: "klieg-1-904-a1b2c3d4" },
          ],
          has_more: false,
        }), { status: 200, headers: { "content-type": "application/json" } });
      }),
    );

    const found = await createElevenLabsVoiceEngine().findVoicesByName({ name: "klieg-1-904-a1b2c3d4" });

    expect(found).toEqual(["orphan-1"]);
    expect(seen).toHaveLength(1);
    const url = new URL(seen[0]!.url);
    expect(`${url.origin}${url.pathname}`).toBe("https://api.elevenlabs.io/v2/voices");
    expect(url.searchParams.get("search")).toBe("klieg-1-904-a1b2c3d4");
    expect(url.searchParams.get("voice_type")).toBe("personal");
    expect(seen[0]!.init.method).toBe("GET");
    expect(seen[0]!.init.body).toBeUndefined();
  });

  it("NEGATIVE CONTROL: an answer with no voices list finds nothing", async () => {
    process.env[ELEVENLABS_API_KEY_VARIABLE] = "sk_test_key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    })));

    expect(await createElevenLabsVoiceEngine().findVoicesByName({ name: "klieg-1-904-a1b2c3d4" })).toEqual([]);
  });
});
