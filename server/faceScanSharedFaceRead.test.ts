/**
 * THE ONE QUESTION A SCAN ASKS TWICE, PAID FOR ONCE — driven at the wire
 * (#2191, his goal of 2026-10-10: *"our goal would be to reduce this cost by as
 * much as possible"*).
 *
 * A face scan asks SAM 3 for `face` on two separate errands — the midline every
 * bilateral region is split on (`axisOf`) and the head box the build row is cut
 * under (`faceScan`'s composed plan) — and until this change it paid for both.
 * They are the same request, fal bills SAM 3 per request, so the second was
 * half a cent for an answer already in hand. `falRegionReader`'s `SHARED_PROMPT`
 * memoises it per frame.
 *
 * # What this suite is actually for, and it is not the saving
 *
 * The saving is held by `faceScanSpend.test.ts`, which counts every request a
 * whole scan makes and pins the floor and the ceiling. **This suite holds the
 * PRECONDITION that makes the memo safe**, and that precondition is the only
 * reason a memo is allowed here at all:
 *
 *   ⚠ The scan asks some questions TWICE ON PURPOSE — an empty anatomy read
 *   gets a second look (fable-468 ruling 1) and a half-answered pair gets one
 *   more (fable-749 §3a). A memo over all prompts would swallow both, and it
 *   would do it silently: the panel would look the same on every face whose
 *   first read was good, and quietly lose the rows those re-asks were built to
 *   rescue.
 *
 * `face` is safe only because nothing in the scan's plan asks it. That is a
 * fact about `SLOT_CATALOGUE`, not about this reader, so it is read out of the
 * catalogue here rather than asserted in prose — the day a slot asks `face`,
 * this goes red at the line below instead of a re-ask disappearing.
 */
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createFalRegionReader } from "./castingV2/falRegionReader";
import { catalogueSlots, isAskable } from "./castingV2/referenceSlotCatalogue";
import { scanPlan } from "./castingV2/faceScan";

const SAM3 = "fal-ai/sam-3/image";
const WIDTH = 120;
const HEIGHT = 160;

/** A frame-sized mask covering the middle of the picture, as a data URI. */
async function blob(width: number, height: number): Promise<string> {
  const data = Buffer.alloc(width * height, 0);
  for (let y = Math.floor(height * 0.25); y < Math.floor(height * 0.75); y += 1) {
    data.fill(255, y * width + Math.floor(width * 0.25), y * width + Math.floor(width * 0.75));
  }
  const png = await sharp(data, { raw: { width, height, channels: 1 } }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

async function frame(): Promise<Buffer> {
  return sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: { r: 90, g: 90, b: 90 } } })
    .png()
    .toBuffer();
}

type Wire = { byPrompt: Map<string, number> };

/**
 * A fake fal that counts the prompts it is asked and answers every one.
 *
 * `fail` makes the FIRST ask of that prompt a transport error, so the "a
 * rejection is forgotten" arm can prove the next ask really re-asks rather
 * than inheriting the broken promise.
 */
function stubFal(options: { failFirst?: string } = {}): Wire {
  const wire: Wire = { byPrompt: new Map() };
  const failed = new Set<string>();
  vi.stubGlobal("fetch", async (url: unknown, init?: { body?: unknown }) => {
    const address = String(url);
    if (!address.startsWith("https://fal.run/")) {
      /* The mask fetch: served from the data URI the body carried, so no
         second network shape has to be faked. */
      return new Response("not served by this fake", { status: 404 });
    }
    const endpoint = address.slice("https://fal.run/".length);
    if (endpoint !== SAM3) return new Response(JSON.stringify({}), { status: 200 });
    const body = JSON.parse(String(init?.body ?? "{}"));
    const prompt = String(body.prompt);
    wire.byPrompt.set(prompt, (wire.byPrompt.get(prompt) ?? 0) + 1);
    if (options.failFirst === prompt && !failed.has(prompt)) {
      failed.add(prompt);
      return new Response("upstream is unwell", { status: 503 });
    }
    const image = Buffer.from(String(body.image_url).split(",")[1], "base64");
    const meta = await sharp(image).metadata();
    return new Response(
      JSON.stringify({ masks: [{ url: await blob(meta.width ?? 0, meta.height ?? 0) }] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });
  return wire;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the precondition the shared read rests on", () => {
  it("no slot in the catalogue asks for the bare `face` region", () => {
    /*
      THE LINE THAT MAKES THE MEMO SAFE. The catalogue's questions are
      `face skin`, `eyes`, `hair` and the rest; the bare noun belongs to the
      midline and the head box alone. If a slot ever asks it, the scan's
      deliberate re-ask of that slot would be served the memoised answer and
      the second look would silently stop happening.
    */
    const asked = catalogueSlots()
      .filter((definition) => isAskable(definition))
      .map((definition) => definition.question);
    /* POSITIVE CONTROL FIRST: an empty list contains nothing, so a reader that
       came back with nothing would pass the real assertion by accident. These
       are the near neighbours — the words that make `face` look available. */
    expect(asked).toContain("hair");
    expect(asked).toContain("eyes");
    expect(asked).not.toContain("face");
    /* And through the plan as well, which is what the scan actually sends —
       a `display` region reaches the wire without being `isAskable`. */
    const planned = scanPlan().map((region) => region.question);
    expect(planned).toContain("face skin");
    expect(planned.length).toBeGreaterThan(8);
    expect(planned).not.toContain("face");
  });
});

describe("what the reader asks fal for one frame", () => {
  it("asks `face` ONCE however many errands need it, and answers both the same", async () => {
    const wire = stubFal();
    const reader = createFalRegionReader({ apiKey: "test-key" });
    const bytes = await frame();

    /* The two real errands, in the order a scan makes them: the composed head
       read goes through `region`, and the midline read is what `regionSides`
       needs before it can cut the frame. */
    const head = await reader.region({ image: bytes, name: "face", absentIsAnswer: true });
    const sides = await reader.regionSides!({ image: bytes, name: "eyes", absentIsAnswer: true });

    expect(wire.byPrompt.get("face")).toBe(1);
    expect(head.width).toBe(WIDTH);
    expect(head.height).toBe(HEIGHT);
    /* The pair still came back, so the midline really was needed and really
       was answered from the shared read. */
    expect(sides).not.toBeNull();
    expect(sides!.left.width).toBe(WIDTH);
  }, 30_000);

  it("two errands racing join one call, which is how a scan actually asks", async () => {
    const wire = stubFal();
    const reader = createFalRegionReader({ apiKey: "test-key" });
    const bytes = await frame();
    /*
      THE PATH THAT MATTERS, because the scan asks everything in parallel.
      A memo holding the settled VALUE rather than the promise would miss on
      both of these and pay twice — the same mistake `axes` records one
      function below, and the same one the face-scan cache records in
      `faceScanService.ts`.
    */
    const [head, sides] = await Promise.all([
      reader.region({ image: bytes, name: "face", absentIsAnswer: true }),
      reader.regionSides!({ image: bytes, name: "ear", absentIsAnswer: true }),
    ]);
    expect(wire.byPrompt.get("face")).toBe(1);
    expect(head.width).toBe(WIDTH);
    expect(sides).not.toBeNull();
  }, 30_000);

  it("gives the second asker the same mask the first one got", async () => {
    stubFal();
    const reader = createFalRegionReader({ apiKey: "test-key" });
    const bytes = await frame();
    const first = await reader.region({ image: bytes, name: "face", absentIsAnswer: true });
    const second = await reader.region({ image: bytes, name: "face", absentIsAnswer: true });
    /* Byte for byte: a shared answer that differed from the one it replaced
       would be a change to what the panel draws, which this card may not make. */
    expect(second.data.equals(first.data)).toBe(true);
  }, 30_000);

  it("NEGATIVE CONTROL — a deliberate re-ask of any other question still costs a call", async () => {
    const wire = stubFal();
    const reader = createFalRegionReader({ apiKey: "test-key" });
    const bytes = await frame();
    /*
      This is the arm that would have caught a memo written one prompt too
      wide. The scan asks `the lips` twice when the first read is empty; if
      that second ask were free, the row the re-ask exists to rescue would
      quietly stop being rescued.
    */
    await reader.region({ image: bytes, name: "lips", absentIsAnswer: true });
    await reader.region({ image: bytes, name: "lips", absentIsAnswer: true });
    expect(wire.byPrompt.get("the lips")).toBe(2);
  }, 30_000);

  it("a caller that brings its own deadline asks fresh rather than having it dropped", async () => {
    const wire = stubFal();
    const reader = createFalRegionReader({ apiKey: "test-key" });
    const bytes = await frame();
    await reader.region({ image: bytes, name: "face", absentIsAnswer: true });
    /*
      The shared-read rule this file already applies to `axes` and `referenced`:
      a memoised promise may not carry one caller's abort into another caller's
      await. So a caller with a signal is served its own call — nobody's
      deadline is silently discarded, and nobody else's read is cancellable by
      it.
    */
    await reader.region({
      image: bytes,
      name: "face",
      absentIsAnswer: true,
      signal: new AbortController().signal,
    });
    expect(wire.byPrompt.get("face")).toBe(2);
  }, 30_000);

  it("forgets a failed read, so the next errand re-asks instead of inheriting one bad minute", async () => {
    const wire = stubFal({ failFirst: "face" });
    const reader = createFalRegionReader({ apiKey: "test-key" });
    const bytes = await frame();
    await expect(reader.region({ image: bytes, name: "face", absentIsAnswer: true })).rejects.toThrow();
    const after = await reader.region({ image: bytes, name: "face", absentIsAnswer: true });
    expect(wire.byPrompt.get("face")).toBe(2);
    expect(after.width).toBe(WIDTH);
  }, 30_000);

  it("NEGATIVE CONTROL — two different questions about one frame get their own answers", async () => {
    const wire = stubFal();
    const reader = createFalRegionReader({ apiKey: "test-key" });
    const bytes = await frame();
    /*
      THE ARM THAT EXISTS BECAUSE THE FIRST VERSION OF THIS MEMO WAS KEYED ON
      THE PICTURE ALONE.

      Seven of the scan's questions are asked of the same buffer, so a
      frame-only key makes whichever asks first the answer to all of them —
      `hair` served the face mask, measured by widening the filter: all seven
      vanished from the wire table and the floor read a flattering 11. The key
      is (prompt, frame) now, and this is the shape of that promise even though
      only one prompt shares today.
    */
    await reader.region({ image: bytes, name: "face", absentIsAnswer: true });
    await reader.region({ image: bytes, name: "hair", absentIsAnswer: true });
    await reader.region({ image: bytes, name: "nose", absentIsAnswer: true });
    expect(wire.byPrompt.get("face")).toBe(1);
    expect(wire.byPrompt.get("hair")).toBe(1);
    expect(wire.byPrompt.get("nose")).toBe(1);
  }, 30_000);

  it("holds one answer per frame, not one per reader — a second picture asks again", async () => {
    const wire = stubFal();
    const reader = createFalRegionReader({ apiKey: "test-key" });
    const one = await frame();
    const two = await sharp({
      create: { width: WIDTH, height: HEIGHT, channels: 3, background: { r: 10, g: 10, b: 10 } },
    }).png().toBuffer();
    await reader.region({ image: one, name: "face", absentIsAnswer: true });
    await reader.region({ image: two, name: "face", absentIsAnswer: true });
    /* A memo keyed on the reader rather than the frame would hand the second
       picture the first picture's head box — the stalest answer in the file. */
    expect(wire.byPrompt.get("face")).toBe(2);
  }, 30_000);
});
