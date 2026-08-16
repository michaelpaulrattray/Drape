/**
 * ONE DOWNLOAD PER PICTURE — the claim the founder's stuck plate was caused by
 * breaking, now that a second caller exists.
 *
 * The holder was a ref inside the viewer, and the bug it fixed was a rival
 * download restarting a 2.6MB fetch that never finished. Lifting it out so a
 * neighbour can be prefetched puts that guarantee back at risk from a new
 * direction: the prefetch and the click are now two callers asking for the same
 * picture, and if they did not share the holder they would be exactly the two
 * rival downloads the incident was about.
 */
import { describe, expect, it, vi } from "vitest";

import { decodeFrame, frameIsHeld, prefetchFrames } from "./frameDecodes";

/** Unique per test — the holder is module-level on purpose, as it is in the app. */
let counter = 0;
const url = (what: string) => `https://pub-test.r2.dev/${what}-${(counter += 1)}.png`;

describe("the decode holder", () => {
  it("downloads a picture once, however many callers ask for it", async () => {
    const decode = vi.fn(async () => undefined);
    const picture = url("frame");
    const first = decodeFrame(picture, decode);
    const second = decodeFrame(picture, decode);
    const third = decodeFrame(picture, decode);
    expect(decode).toHaveBeenCalledTimes(1);
    /* The same promise, not merely an equivalent one: a joiner that got its own
       promise would settle on its own schedule and the plate would flicker. */
    expect(second).toBe(first);
    expect(third).toBe(first);
    await expect(first).resolves.toBeUndefined();
  });

  it("lets a PREFETCH and a click share one download — the incident's new shape", async () => {
    const decode = vi.fn(async () => undefined);
    const neighbour = url("neighbour");
    prefetchFrames([neighbour], decode);
    expect(frameIsHeld(neighbour), "held before anybody clicked it").toBe(true);
    await decodeFrame(neighbour, decode);
    expect(decode, "the click joined the prefetch instead of racing it").toHaveBeenCalledTimes(1);
  });

  it("CAN SAY NO — a picture nobody has asked for is not held", () => {
    /* The other half: a `frameIsHeld` that answered true for everything would
       make the test above pass over nothing. */
    expect(frameIsHeld(url("never-asked"))).toBe(false);
  });

  it("drops the empty and the absent rather than fetching them", () => {
    const decode = vi.fn(async () => undefined);
    prefetchFrames([null, undefined, ""], decode);
    expect(decode).not.toHaveBeenCalled();
  });

  it("asks for one duplicate once, in a single call", () => {
    const decode = vi.fn(async () => undefined);
    const same = url("twice");
    prefetchFrames([same, same], decode);
    expect(decode).toHaveBeenCalledTimes(1);
  });

  it("never rejects, so a viewer is never stranded by a failed decode", async () => {
    const decode = vi.fn(async () => { throw new Error("the bytes did not arrive"); });
    /*
      The holder swallows, whatever the decoder does. This test was written
      against the opposite behaviour and its own name said so — the viewer does
      `void decodeFrame(url).then(…)`, so a rejection would silently skip the
      swap AND leave an unhandled rejection behind it.
    */
    await expect(decodeFrame(url("broken"), decode)).resolves.toBeUndefined();
  });

  it("forgets the oldest picture rather than growing without a bound", () => {
    const decode = vi.fn(async () => undefined);
    const oldest = url("oldest");
    decodeFrame(oldest, decode);
    expect(frameIsHeld(oldest)).toBe(true);
    for (let index = 0; index < 60; index += 1) decodeFrame(url("filler"), decode);
    expect(frameIsHeld(oldest), "evicted, which costs a cache hit and never a wrong frame")
      .toBe(false);
  });
});
