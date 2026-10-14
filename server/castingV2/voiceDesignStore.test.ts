import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  VOICE_DESIGN_STORE_MAX,
  VOICE_DESIGN_TTL_MS,
  claimVoiceDesignHandle,
  claimedVoiceDesignCount,
  forgetVoiceDesign,
  rememberVoiceDesign,
  resetVoiceDesignStore,
  resolveVoiceDesignHandle,
  restoreVoiceDesign,
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

  it("drops a design that was CLAIMED and never restored", () => {
    /* The claimed map is swept by the same call, so a landed Keep leaves
       nothing behind in either of them. */
    const { designId, handles } = rememberVoiceDesign(DESIGN);
    expect(claimVoiceDesignHandle({
      userId: 1, modelId: 300, designId, handle: handles[0],
    })).not.toBeNull();
    expect(claimedVoiceDesignCount()).toBe(1);

    forgetVoiceDesign(designId);

    expect(claimedVoiceDesignCount()).toBe(0);
    restoreVoiceDesign(designId);
    expect(resolveVoiceDesignHandle({
      userId: 1, modelId: 300, designId, handle: handles[0],
    })).toBeNull();
  });
});

/**
 * CLAIMING A HANDLE — #2470's finding, item 3.
 *
 * Keep spends one of the account's 95 monthly voice operations and the
 * provider's save takes tens of seconds. Resolving first and forgetting after
 * left a window in which two presses on ONE handle both resolved and both
 * reached the provider: the loser released its slot, but its operation was
 * spent and no delete refunds it. `disabled={working}` is render-time and stops
 * none of a double-click, a retry, or a second tab.
 */
describe("claiming a handle, so one press cannot become two", () => {
  it("⚠ A SECOND CLAIM ON THE SAME HANDLE GETS NOTHING — the double-press, driven", () => {
    const { designId, handles } = rememberVoiceDesign(DESIGN);
    const one = { userId: 1, modelId: 300, designId, handle: handles[0] };

    const first = claimVoiceDesignHandle(one);
    const second = claimVoiceDesignHandle(one);

    expect(first).toMatchObject({
      previewId: "gen-a",
      designSentence: DESIGN.designSentence,
    });
    /* THE CLAIM OF THIS SUITE. Before the repair this was a second resolve, and
       the route then made a second provider call on it. */
    expect(second).toBeNull();
  });

  it("takes the WHOLE design out of reach, not just the handle pressed", () => {
    /* One voice per cast, so while a Keep is in flight none of the three may
       start another. */
    const { designId, handles } = rememberVoiceDesign(DESIGN);
    claimVoiceDesignHandle({ userId: 1, modelId: 300, designId, handle: handles[0] });

    for (const handle of handles) {
      expect(claimVoiceDesignHandle({ userId: 1, modelId: 300, designId, handle })).toBeNull();
    }
    expect(voiceDesignStoreSize()).toBe(0);
    expect(claimedVoiceDesignCount()).toBe(1);
  });

  it("still refuses another account and another cast, exactly as the resolve did", () => {
    /*
      The claim replaced the resolve on the Keep road, so the bearer-name lock
      had to move with it. A claim that skipped these would be a worse hole than
      the one it closed.
    */
    const { designId, handles } = rememberVoiceDesign(DESIGN);

    expect(claimVoiceDesignHandle({
      userId: 2, modelId: 300, designId, handle: handles[0],
    })).toBeNull();
    expect(claimVoiceDesignHandle({
      userId: 1, modelId: 301, designId, handle: handles[0],
    })).toBeNull();
    expect(claimVoiceDesignHandle({
      userId: 1, modelId: 300, designId, handle: "not-a-handle",
    })).toBeNull();
    /* None of those refusals consumed it: the owner's press still works. */
    expect(claimVoiceDesignHandle({
      userId: 1, modelId: 300, designId, handle: handles[0],
    })).not.toBeNull();
  });

  it("gives the design back when a Keep does not land, so three voices are not lost", () => {
    const { designId, handles } = rememberVoiceDesign(DESIGN);
    claimVoiceDesignHandle({ userId: 1, modelId: 300, designId, handle: handles[0] });

    restoreVoiceDesign(designId);

    expect(claimedVoiceDesignCount()).toBe(0);
    for (const handle of handles) {
      expect(resolveVoiceDesignHandle({
        userId: 1, modelId: 300, designId, handle,
      })).not.toBeNull();
    }
  });

  it("⚠ A RESTORE DOES NOT RE-STAMP THE CLOCK", () => {
    /*
      The restored design keeps its ORIGINAL age. Re-stamping it would let a
      failing Keep extend a preview's life past the provider's own window, and
      turn an honest provider refusal into a refusal about our bookkeeping —
      the trade this module's header picks the other way.
    */
    vi.useFakeTimers();
    try {
      const { designId, handles } = rememberVoiceDesign(DESIGN);
      claimVoiceDesignHandle({ userId: 1, modelId: 300, designId, handle: handles[0] });

      vi.advanceTimersByTime(VOICE_DESIGN_TTL_MS + 1);
      restoreVoiceDesign(designId);

      expect(resolveVoiceDesignHandle({
        userId: 1, modelId: 300, designId, handle: handles[0],
      })).toBeNull();
      expect(claimedVoiceDesignCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("is harmless to restore a design nothing claimed", () => {
    expect(() => restoreVoiceDesign("never-claimed")).not.toThrow();
    expect(voiceDesignStoreSize()).toBe(0);
  });
});
