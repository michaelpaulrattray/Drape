import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  VOICE_DESIGN_STORE_MAX,
  VOICE_DESIGN_TTL_MS,
  forgetVoiceDesign,
  rememberVoiceDesign,
  resetVoiceDesignStore,
  resolveVoiceDesignHandle,
  voiceDesignStoreSize,
} from "./voiceDesignStore";

/**
 * WHICH VOICE A CUSTOMER IS KEEPING, DRIVEN — N4b-2 (#2470).
 *
 * The arms that matter are the refusals, and the one worth a reviewer's eye is
 * the OWNER arm: a handle is a bearer name, so another account holding one must
 * not be able to resolve it. It is a second lock — `keepCastVoice` re-proves
 * the owned live signed cast inside its own INSERT — and a second lock is still
 * a lock worth testing, because what a resolved handle buys is a provider call
 * on somebody else's design sentence.
 */

beforeEach(() => resetVoiceDesignStore());
afterEach(() => {
  vi.useRealTimers();
  resetVoiceDesignStore();
});

const DESIGN = {
  userId: 1,
  modelId: 300,
  designSentence: "Low, unhurried, a north Atlantic rasp.",
  previewIds: ["gen-a", "gen-b", "gen-c"],
};

describe("remembering a design", () => {
  it("hands back one handle per voice, in the order they were made", () => {
    /* The card labels them Voice 1-3 in this order; a shuffled pair would mean
       a customer keeps a voice other than the one they heard. */
    const { designId, handles } = rememberVoiceDesign(DESIGN);
    expect(handles).toHaveLength(3);
    expect(new Set(handles).size).toBe(3);
    for (const [index, handle] of handles.entries()) {
      expect(resolveVoiceDesignHandle({
        userId: 1, modelId: 300, designId, handle,
      })?.previewId).toBe(DESIGN.previewIds[index]);
    }
  });

  it("never reuses a handle or a design id across designs", () => {
    const first = rememberVoiceDesign(DESIGN);
    const second = rememberVoiceDesign(DESIGN);
    expect(second.designId).not.toBe(first.designId);
    for (const handle of second.handles) expect(first.handles).not.toContain(handle);
  });

  it("gives back the SENTENCE it stored, which the client never supplies", () => {
    /*
      The record says what the voice was made from, and the line can be edited
      between the design and the Keep — so the stored sentence is the only true
      answer, and a client-supplied one could make the record lie.
    */
    const { designId, handles } = rememberVoiceDesign(DESIGN);
    expect(resolveVoiceDesignHandle({
      userId: 1, modelId: 300, designId, handle: handles[0],
    })?.designSentence).toBe(DESIGN.designSentence);
  });
});

describe("what a handle will not resolve for", () => {
  it("refuses another ACCOUNT holding the handle", () => {
    const { designId, handles } = rememberVoiceDesign(DESIGN);
    expect(resolveVoiceDesignHandle({
      userId: 2, modelId: 300, designId, handle: handles[0],
    })).toBeNull();
  });

  it("refuses the owner's OTHER cast", () => {
    /* One voice per cast, and a design belongs to the cast whose line made it:
       resolving it against a different cast would store this cast's sentence on
       that one. */
    const { designId, handles } = rememberVoiceDesign(DESIGN);
    expect(resolveVoiceDesignHandle({
      userId: 1, modelId: 301, designId, handle: handles[0],
    })).toBeNull();
  });

  it("refuses a handle from a different design", () => {
    const first = rememberVoiceDesign(DESIGN);
    const second = rememberVoiceDesign(DESIGN);
    expect(resolveVoiceDesignHandle({
      userId: 1, modelId: 300, designId: first.designId, handle: second.handles[0],
    })).toBeNull();
  });

  it("refuses an unknown design id and an unknown handle", () => {
    const { designId, handles } = rememberVoiceDesign(DESIGN);
    expect(resolveVoiceDesignHandle({
      userId: 1, modelId: 300, designId: "not-a-design", handle: handles[0],
    })).toBeNull();
    expect(resolveVoiceDesignHandle({
      userId: 1, modelId: 300, designId, handle: "not-a-handle",
    })).toBeNull();
  });
});

describe("the two bounds", () => {
  it("stops resolving once the window has passed", () => {
    vi.useFakeTimers();
    const { designId, handles } = rememberVoiceDesign(DESIGN);
    vi.advanceTimersByTime(VOICE_DESIGN_TTL_MS - 1);
    expect(resolveVoiceDesignHandle({
      userId: 1, modelId: 300, designId, handle: handles[0],
    })).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(resolveVoiceDesignHandle({
      userId: 1, modelId: 300, designId, handle: handles[0],
    })).toBeNull();
  });

  it("drops an expired entry rather than holding it for ever", () => {
    vi.useFakeTimers();
    rememberVoiceDesign(DESIGN);
    expect(voiceDesignStoreSize()).toBe(1);
    vi.advanceTimersByTime(VOICE_DESIGN_TTL_MS);
    /* Any call sweeps: an unbounded map on a long-lived process is a leak
       however small each entry is. */
    rememberVoiceDesign(DESIGN);
    expect(voiceDesignStoreSize()).toBe(1);
  });

  it("evicts the oldest at the ceiling and keeps the newest resolvable", () => {
    const first = rememberVoiceDesign(DESIGN);
    for (let index = 0; index < VOICE_DESIGN_STORE_MAX; index += 1) {
      rememberVoiceDesign({ ...DESIGN, modelId: 400 + index });
    }
    expect(voiceDesignStoreSize()).toBeLessThanOrEqual(VOICE_DESIGN_STORE_MAX);
    expect(resolveVoiceDesignHandle({
      userId: 1, modelId: 300, designId: first.designId, handle: first.handles[0],
    })).toBeNull();
    const last = rememberVoiceDesign({ ...DESIGN, modelId: 999 });
    expect(resolveVoiceDesignHandle({
      userId: 1, modelId: 999, designId: last.designId, handle: last.handles[0],
    })).not.toBeNull();
  });
});

describe("forgetting a design", () => {
  it("drops every handle of a design once one of them has been kept", () => {
    /* One voice per cast: the other two can never be kept now, and a resolvable
       handle for a voice nothing may keep is a name with no referent. */
    const { designId, handles } = rememberVoiceDesign(DESIGN);
    forgetVoiceDesign(designId);
    for (const handle of handles) {
      expect(resolveVoiceDesignHandle({ userId: 1, modelId: 300, designId, handle })).toBeNull();
    }
  });

  it("is harmless on a design that is already gone", () => {
    expect(() => forgetVoiceDesign("never-existed")).not.toThrow();
  });
});
