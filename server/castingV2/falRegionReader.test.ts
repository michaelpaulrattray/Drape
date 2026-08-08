import { afterEach, describe, expect, it, vi } from "vitest";

import { createFalRegionReader } from "./falRegionReader";
import { MaskError } from "./maskGeometry";

/**
 * WHAT THE READER MUST DO WITH BYTES THAT ARE NOT A PICTURE.
 *
 * The specimen is real and it cost a whole sweep (opus-052 §3): masters fetched
 * from a bucket base that answers unknown keys with the app's own HTML index at
 * HTTP 200, handed straight to this reader with `absentIsAnswer: true`. The
 * caller's `.catch(() => null)` turned the resulting mess into a coverage of
 * zero, and zero coverage reads as *this face wears no glasses*. Thirty faces
 * were declared bare on the strength of thirty error pages.
 *
 * `absentIsAnswer` is the dangerous door because it is the only one that turns
 * a failed reading into a confident negative. So the guard sits at the reader's
 * entrance, before any provider call: a question about a picture is refused
 * unless it is asked of one, and it is refused by name.
 */
const APP_INDEX_HTML = Buffer.from(
  '<!DOCTYPE html>\n<html lang="en">\n  <head><title>Drape</title></head>\n',
  "utf8",
);

/**
 * A real 1×1 PNG, not a magic-byte stub — the absent path sizes the empty mask
 * with sharp, so the positive control has to be a picture all the way down.
 */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("falRegionReader refuses a question asked of a document", () => {
  it("refuses an HTML error page even when absence is an acceptable answer", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const reader = createFalRegionReader({ apiKey: "test-key" });

    const error = await reader
      .region({ image: APP_INDEX_HTML, name: "glasses", absentIsAnswer: true })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(MaskError);
    expect((error as Error).message).toContain('asked "glasses"');
    expect((error as Error).message).toContain("an HTML page");
    /* The half that fails on the code this was written against: the refusal
       happens BEFORE the provider is paid to look at a web page. */
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses the same bytes on the subject and landmark doors too", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const reader = createFalRegionReader({ apiKey: "test-key" });

    await expect(reader.subject({ image: APP_INDEX_HTML }))
      .rejects.toBeInstanceOf(MaskError);
    await expect(reader.landmark({ image: APP_INDEX_HTML, name: "left ear" }))
      .rejects.toBeInstanceOf(MaskError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("lets a real picture through to the provider — the guard is not a wall", async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ masks: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchSpy);
    const reader = createFalRegionReader({ apiKey: "test-key" });

    /* No masks and absence permitted: the honest empty answer, which is the
       behaviour a removal depends on and must survive the new guard. */
    const mask = await reader.region({ image: PNG, name: "glasses", absentIsAnswer: true });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(mask.data.every((value) => value === 0)).toBe(true);
    expect(mask.width).toBeGreaterThan(0);
  });
});
