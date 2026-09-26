/**
 * THE SCRUB'S ARMS — drives `shared/errorEventScrub.ts` (#509 part 1).
 *
 * The suite is built around one asymmetry, because it is the asymmetry the
 * control lives or dies on: a guard that refuses on the WORD "prompt" would
 * refuse this product's own casting errors, whose stacks are literally
 * `promptAuthor.ts` and `briefCompiler.ts`. So there is a positive control per
 * refusing key AND a negative control made of a real casting error, and the
 * negative one is the arm that matters (law 2 — a checker that cannot pass the
 * innocent case is not a checker, it is an outage).
 *
 * The refusing population is READ OUT of the module's own constant rather than
 * typed here, so a key added to the list without an arm cannot happen.
 */
import { describe, expect, it } from "vitest";

import {
  ALLOWED_TAG_KEYS,
  FREE_TEXT_CAP,
  REDACTED,
  REFUSING_KEYS,
  findRefusingKey,
  project,
  redactFreeText,
  scrubErrorEvent,
  type IncomingEvent,
} from "../shared/errorEventScrub";

const R2_ORIGIN = "https://pub-abc123.r2.dev";

/**
 * A real error event's shape, as `@sentry/node` builds one: the throw of a
 * casting roll. Every string in it is deliberately a word the refusal must NOT
 * own — the filenames are this product's real ones.
 */
function castingErrorEvent(): IncomingEvent {
  return {
    event_id: "0a1b2c3d4e5f6071829304a5b6c7d8e9",
    timestamp: 1_790_000_000,
    level: "error",
    platform: "node",
    environment: "railway:production",
    release: "abc1234",
    transaction: "castingV2.createRoll",
    exception: {
      values: [
        {
          type: "TRPCError",
          value: "the prompt author returned no brief for slice 3",
          mechanism: { type: "onerror", handled: false },
          stacktrace: {
            frames: [
              {
                filename: "/app/server/castingV2/promptAuthor.ts",
                function: "authorSheet",
                lineno: 412,
                colno: 11,
                in_app: true,
              },
              {
                filename: "/app/server/castingV2/briefCompiler.ts",
                function: "resolveSheet",
                lineno: 935,
                colno: 7,
                in_app: true,
              },
            ],
          },
        },
      ],
    },
    user: { id: "1" },
    tags: { correlationId: "cid-9", route: "/api/trpc", trpcCode: "INTERNAL_SERVER_ERROR" },
    request: { method: "POST", url: "https://klieglabs.com/api/trpc?batch=1&input=%7B%7D" },
    contexts: { trace: { trace_id: "t1", span_id: "s1" } },
  };
}

describe("the refusing list has a floor, so it cannot be emptied quietly", () => {
  /*
    ⚠ THE ARMS BELOW ARE DERIVED FROM `REFUSING_KEYS`, WHICH MEANS DELETING A KEY
    ALSO DELETES ITS OWN ARM AND THE SUITE STAYS GREEN. That is the shape this
    repository has been bitten by — a case list every arm clears reads as 100%
    caught. So the keys that are not negotiable are named HERE, by hand, and a
    removal reddens. The derived arms still cover anything ADDED, which is the
    half a hand-written list cannot do.
  */
  it("carries the field group CLAUDE.md names as the single most sensitive one", () => {
    for (const key of ["masterPrompt", "technicalSchema", "preferences"]) {
      expect(REFUSING_KEYS).toContain(key);
    }
  });

  it("carries the customer's own words and the one credential that has leaked before", () => {
    for (const key of ["prompt", "brief", "passwordHash"]) {
      expect(REFUSING_KEYS).toContain(key);
    }
  });

  it("carries where her pictures live", () => {
    for (const key of ["resultUrl", "imageKey"]) {
      expect(REFUSING_KEYS).toContain(key);
    }
  });
});

describe("the refusal — a forbidden key drops the whole event", () => {
  /* One arm per key, derived. A key added to REFUSING_KEYS with no arm is
     impossible; a key REMOVED from it takes its own arm with it, which is the
     honest direction — the list is the contract. */
  for (const key of REFUSING_KEYS) {
    it(`refuses an event carrying \`${key}\` — at the top level`, () => {
      const event: IncomingEvent = { ...castingErrorEvent(), [key]: "…" };
      const verdict = scrubErrorEvent(event, R2_ORIGIN);
      expect(verdict.verdict).toBe("refuse");
      if (verdict.verdict === "refuse") expect(verdict.key).toBe(key);
    });

    it(`refuses an event carrying \`${key}\` — buried three deep`, () => {
      const event: IncomingEvent = {
        ...castingErrorEvent(),
        extra: { roll: { slices: [{ [key]: "the whole recipe" }] } },
      };
      const verdict = scrubErrorEvent(event, R2_ORIGIN);
      expect(verdict.verdict).toBe("refuse");
      if (verdict.verdict === "refuse") expect(verdict.key).toBe(key);
    });
  }

  it("matches the key name whatever its case", () => {
    const verdict = scrubErrorEvent({ extra: { MasterPROMPT: "…" } });
    expect(verdict.verdict).toBe("refuse");
  });

  it("names the PATH to the key and never the value", () => {
    const found = findRefusingKey({ extra: { cast: { masterPrompt: "SECRET RECIPE" } } });
    expect(found).not.toBeNull();
    expect(found?.path).toBe("event.extra.cast.masterPrompt");
    expect(JSON.stringify(found)).not.toContain("SECRET RECIPE");
  });

  it("refuses BEFORE projecting — a key inside a field the projection drops still refuses", () => {
    /* This is the order arm. Projecting first would delete `breadcrumbs`, find
       nothing wrong with what remained, and send — a control that passed
       because it had blinded itself. */
    const event: IncomingEvent = {
      ...castingErrorEvent(),
      breadcrumbs: [{ category: "console", data: { masterPrompt: "…" } }],
    };
    expect(scrubErrorEvent(event, R2_ORIGIN).verdict).toBe("refuse");
  });

  it("terminates on a circular event rather than hanging the send path", () => {
    const event: Record<string, unknown> = { ...castingErrorEvent() };
    event.self = event;
    expect(() => scrubErrorEvent(event, R2_ORIGIN)).not.toThrow();
    expect(scrubErrorEvent(event, R2_ORIGIN).verdict).toBe("send");
  });
});

describe("the negative control — the refusal must not own a real word", () => {
  it("SENDS an ordinary casting error whose message and stack say `prompt` and `brief`", () => {
    const verdict = scrubErrorEvent(castingErrorEvent(), R2_ORIGIN);
    expect(verdict.verdict).toBe("send");
  });

  it("keeps the diagnosis intact — type, message, both frames, route, account", () => {
    const verdict = scrubErrorEvent(castingErrorEvent(), R2_ORIGIN);
    if (verdict.verdict !== "send") throw new Error("the negative control refused");
    const value = verdict.event.exception?.values[0];
    expect(value?.type).toBe("TRPCError");
    expect(value?.value).toContain("the prompt author returned no brief");
    expect(value?.stacktrace?.frames).toHaveLength(2);
    expect(value?.stacktrace?.frames[1]?.filename).toContain("briefCompiler.ts");
    expect(value?.stacktrace?.frames[1]?.lineno).toBe(935);
    expect(verdict.event.transaction).toBe("castingV2.createRoll");
    expect(verdict.event.user).toEqual({ id: "1" });
    expect(verdict.event.tags?.correlationId).toBe("cid-9");
    expect(verdict.event.request?.method).toBe("POST");
    expect(verdict.event.release).toBe("abc1234");
    expect(verdict.event.contexts?.trace?.trace_id).toBe("t1");
  });
});

describe("the projection — an allowlist, so an unnamed field cannot travel", () => {
  /* Everything an SDK attaches by default or a caller might attach, in one
     event. Each of these has its own reason to be absent and the module's
     docblock carries them; what this arm proves is that NONE of them needs a
     rule of its own, because the projection names what travels. */
  const kitchenSink: IncomingEvent = {
    ...castingErrorEvent(),
    breadcrumbs: [{ category: "console", message: "her sentence, typed in the brief box" }],
    extra: { anything: "at all" },
    modules: { express: "4.21.2" },
    server_name: "railway-container-7f",
    sdkProcessingMetadata: { normalizedRequest: { data: "the whole body" } },
    fingerprint: ["{{ default }}"],
    debug_meta: { images: [] },
    threads: { values: [] },
  };

  it("drops every field it does not name", () => {
    const verdict = scrubErrorEvent(kitchenSink, R2_ORIGIN);
    if (verdict.verdict !== "send") throw new Error("the kitchen-sink event refused");
    const wire = JSON.stringify(verdict.event);
    for (const gone of [
      "breadcrumbs",
      "extra",
      "modules",
      "server_name",
      "sdkProcessingMetadata",
      "fingerprint",
      "debug_meta",
      "threads",
      "her sentence",
      "the whole body",
    ]) {
      expect(wire).not.toContain(gone);
    }
  });

  it("drops a frame's local variables — the roll path's locals ARE the prompt", () => {
    const event: IncomingEvent = {
      exception: {
        values: [
          {
            type: "Error",
            value: "boom",
            stacktrace: {
              frames: [
                {
                  filename: "a.ts",
                  lineno: 1,
                  vars: { masterPromptText: "the whole recipe, spelled out" },
                },
              ],
            },
          },
        ],
      },
    };
    const verdict = scrubErrorEvent(event);
    if (verdict.verdict !== "send") throw new Error("refused for the wrong reason");
    expect(JSON.stringify(verdict.event)).not.toContain("the whole recipe");
    expect(JSON.stringify(verdict.event)).not.toContain("vars");
  });

  it("drops a user's email, username and IP, and keeps the id", () => {
    const verdict = scrubErrorEvent({
      user: { id: 42, email: "her@example.com", username: "her", ip_address: "203.0.113.4" },
    });
    if (verdict.verdict !== "send") throw new Error("refused for the wrong reason");
    expect(verdict.event.user).toEqual({ id: "42" });
  });

  it("drops headers, cookies and the body from a request, and cuts the query string off", () => {
    const verdict = scrubErrorEvent({
      request: {
        method: "POST",
        url: "https://klieglabs.com/api/trpc?input=%7B%22slice%22%3A3%7D",
        headers: { cookie: "app_session_id=ey…", authorization: "Bearer …" },
        cookies: { app_session_id: "ey…" },
        data: { slice: 3 },
        query_string: "input=…",
      },
    });
    if (verdict.verdict !== "send") throw new Error("refused for the wrong reason");
    expect(verdict.event.request).toEqual({
      method: "POST",
      url: "https://klieglabs.com/api/trpc",
    });
  });

  /* ⚠ THE ARM ABOVE WAS WRITTEN WITH `data: { brief: "her words" }` AND WENT RED
     — correctly. `request.data` is the SDK's captured request body, which on a
     tRPC mutation is the customer's own input, so a brief travelling there is
     the realistic shape of this leak and the refusal fires on the whole event
     rather than the body being quietly trimmed. The arm is kept as its own
     case, because the fixture that produced it is the one a real roll makes. */
  it("refuses the event when the captured request BODY is a brief", () => {
    const verdict = scrubErrorEvent({
      request: { method: "POST", url: "/api/trpc", data: { brief: "her words" } },
    });
    expect(verdict.verdict).toBe("refuse");
    if (verdict.verdict === "refuse") {
      expect(verdict.path).toBe("event.request.data.brief");
    }
  });

  it("drops a tag whose key is not on the allowlist, and keeps every key that is", () => {
    const tags: Record<string, string> = { smuggled: "her words" };
    for (const key of ALLOWED_TAG_KEYS) tags[key] = `v-${key}`;
    const verdict = scrubErrorEvent({ tags });
    if (verdict.verdict !== "send") throw new Error("refused for the wrong reason");
    expect(Object.keys(verdict.event.tags ?? {}).sort()).toEqual([...ALLOWED_TAG_KEYS].sort());
  });
});

describe("the redaction of the free text that does travel", () => {
  it("redacts a URL under the image bucket's own origin", () => {
    const out = redactFreeText(
      `fetch failed for ${R2_ORIGIN}/casting/9f2b-4c.png at attempt 2`,
      R2_ORIGIN,
    );
    expect(out).not.toContain("9f2b-4c.png");
    expect(out).toContain(REDACTED);
    expect(out).toContain("at attempt 2");
  });

  it("redacts a data: payload", () => {
    const out = redactFreeText("upload rejected: data:image/png;base64,iVBORw0KGgoAAAA==");
    expect(out).not.toContain("iVBORw0KGgo");
    expect(out).toContain(REDACTED);
  });

  it("redacts a query string but keeps the URL a reader needs", () => {
    const out = redactFreeText("POST https://fal.run/v1/queue?token=abc123 failed");
    expect(out).toContain("https://fal.run/v1/queue?");
    expect(out).not.toContain("abc123");
  });

  it("caps free text and says how much it dropped", () => {
    const out = redactFreeText("x".repeat(FREE_TEXT_CAP + 250));
    expect(out.length).toBeLessThan(FREE_TEXT_CAP + 60);
    expect(out).toContain("250 more characters dropped");
  });

  it("runs the cap and the redaction on the message that leaves, not only in isolation", () => {
    const verdict = scrubErrorEvent(
      {
        exception: {
          values: [{ type: "Error", value: `saving ${R2_ORIGIN}/a/b.png — ${"y".repeat(2000)}` }],
        },
      },
      R2_ORIGIN,
    );
    if (verdict.verdict !== "send") throw new Error("refused for the wrong reason");
    const message = verdict.event.exception?.values[0]?.value ?? "";
    expect(message).not.toContain("/a/b.png");
    expect(message).toContain("more characters dropped");
  });

  it("leaves a message with nothing to redact byte-identical", () => {
    const clean = "fal returned 429 concurrent_requests_limit";
    expect(redactFreeText(clean, R2_ORIGIN)).toBe(clean);
  });
});

describe("the empty and hostile inputs", () => {
  it("sends an empty event rather than throwing", () => {
    expect(scrubErrorEvent({}).verdict).toBe("send");
    expect(project({})).toEqual({});
  });

  it("ignores a value of the wrong type where it expects a string", () => {
    const verdict = scrubErrorEvent({ transaction: 12, message: null, level: {}, user: "her" });
    if (verdict.verdict !== "send") throw new Error("refused for the wrong reason");
    expect(verdict.event).toEqual({});
  });

  it("caps the frame count at the innermost frames, which are the ones that throw", () => {
    const frames = Array.from({ length: 120 }, (_unused, index) => ({
      filename: `f${index}.ts`,
      lineno: index,
    }));
    const verdict = scrubErrorEvent({
      exception: { values: [{ type: "Error", value: "deep", stacktrace: { frames } }] },
    });
    if (verdict.verdict !== "send") throw new Error("refused for the wrong reason");
    const kept = verdict.event.exception?.values[0]?.stacktrace?.frames ?? [];
    expect(kept).toHaveLength(50);
    expect(kept[kept.length - 1]?.filename).toBe("f119.ts");
  });
});
