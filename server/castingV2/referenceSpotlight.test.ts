/**
 * THE SPOTLIGHT'S ENTRANCE, DRIVEN — #14 slice 3a-2.
 *
 * The FETCH is stubbed rather than the modules, so every arm here runs the real
 * `splitAtPoints`, the real `cutAtPoint`, the real `cleanSplit` and the real
 * detector parsing. A suite that mocked the roads would prove the entrance
 * calls functions, which is not the thing in doubt.
 *
 * Three arms are the ones worth keeping, and none of them is about a happy
 * path:
 *
 * 1. **§6's fence refuses rather than degrades.** A detector that falls over
 *    means the face boxes are unknown, and a spotlight that might light a face
 *    is the one failure this road may not have. So no boxes is a picture that
 *    does not light and a tap that is not taken — and on the tap road the
 *    refusal must come BEFORE the cut is bought, which is asserted by counting
 *    what left the machine.
 * 2. **The split and the detect are in flight together.** Sequentially they
 *    are a 4.3–6.6 s road plus ~1.8 s for nothing, since neither answer feeds
 *    the other. The arm holds the overlap rather than the wall time, because a
 *    duration is a clock and this is a fact about ordering.
 * 3. **The face noun is the one `referenceTake.ts` already uses.** Asserted on
 *    the OUTGOING detect body (invariant 5): a paraphrase here would be a
 *    second vocabulary for the same question, and the fence would quietly ask
 *    about something else.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import type { Mask } from "./maskedComposite";
import type { RegionReader } from "./maskedRefine";
import type { TextEngine } from "../providers/types";
import { createFalRegionReader } from "./falRegionReader";
import { openSpotlight, tapSpotlight } from "./referenceSpotlight";
import { TAKE_FACE_NOUN } from "./referenceTake";

const W = 64;
const H = 64;
const KEY = "test-key";

async function picture(width = W, height = H): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 20, g: 20, b: 20 } } })
    .png()
    .toBuffer();
}

/** A mask PNG where `on` decides which pixels are white. */
async function maskUri(on: (x: number, y: number) => boolean, width = W, height = H): Promise<string> {
  const raw = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) raw[y * width + x] = on(x, y) ? 255 : 0;
  }
  const bytes = await sharp(raw, { raw: { width, height, channels: 1 } }).png().toBuffer();
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

type Sent = { endpoint: string; body: any; at: number };

const SAM3 = "fal-ai/sam-3/image";
const DETECT = "fal-ai/moondream3-preview/detect";

let sent: Sent[];
let reply: (endpoint: string, body: any) => Promise<{ ok: boolean; status?: number; json?: unknown }>;
let order: string[];

beforeEach(() => {
  sent = [];
  order = [];
  vi.stubGlobal("fetch", async (url: string, init: any) => {
    const endpoint = String(url).replace("https://fal.run/", "");
    const body = JSON.parse(String(init.body));
    sent.push({ endpoint, body, at: Date.now() });
    order.push(`start:${endpoint}`);
    const answer = await reply(endpoint, body);
    order.push(`end:${endpoint}`);
    return {
      ok: answer.ok,
      status: answer.status ?? (answer.ok ? 200 : 500),
      headers: new Map(),
      text: async () => JSON.stringify(answer.json ?? {}),
      json: async () => answer.json ?? {},
    } as unknown as Response;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const about = { userId: 1, attachmentPublicId: "ref-1" };

function reader(): RegionReader {
  return createFalRegionReader({ apiKey: KEY });
}

/** A namer that answers with one bare noun, and counts its calls. */
function namer(answer: string | null): TextEngine & { calls: number } {
  const engine = {
    calls: 0,
    complete: async () => {
      engine.calls += 1;
      return answer === null ? { text: "", truncated: false } : { text: answer, truncated: false };
    },
  } as unknown as TextEngine & { calls: number };
  return engine;
}

/** A face box in the top-left quarter, in the normalized shape the detector answers with. */
const FACE_OBJECT = { x_min: 0, y_min: 0, x_max: 0.5, y_max: 0.5 };

describe("opening a picture", () => {
  it("does not light a picture when the reader cannot detect at all, and buys nothing", async () => {
    reply = async () => ({ ok: true, json: {} });
    const bare = { ...reader(), pointer: undefined } as RegionReader;

    const opened = await openSpotlight({ apiKey: KEY, frame: await picture(), reader: bare, about });

    expect(opened).toEqual({ ok: false, why: "no-pointer" });
    expect(sent).toHaveLength(0);
  });

  /* ---- §6's FENCE, THE DIRECTION THAT MATTERS ---- */
  it("does not light a picture whose faces could not be read", async () => {
    reply = async (endpoint) => {
      if (endpoint === DETECT) return { ok: false, status: 500, json: { detail: "down" } };
      return { ok: true, json: { masks: [await maskUri((x) => x > 40)] } };
    };

    const opened = await openSpotlight({ apiKey: KEY, frame: await picture(), reader: reader(), about });

    expect(opened).toEqual({ ok: false, why: "no-faces-read" });
  });

  it("asks the detector for the face noun the take road already uses", async () => {
    reply = async (endpoint) => {
      if (endpoint === DETECT) return { ok: true, json: { objects: [] } };
      return { ok: true, json: { masks: [await maskUri((x) => x > 40)] } };
    };

    await openSpotlight({ apiKey: KEY, frame: await picture(), reader: reader(), about });

    const detect = sent.find((one) => one.endpoint === DETECT);
    expect(detect?.body.prompt).toBe(TAKE_FACE_NOUN);
  });

  it("runs the split and the detect together rather than one after the other", async () => {
    reply = async (endpoint) => {
      /* The split answers slowly; the detect must have STARTED before it
         finishes, which is the fact being held. */
      if (endpoint === SAM3) {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return { ok: true, json: { masks: [await maskUri((x) => x > 40)] } };
      }
      return { ok: true, json: { objects: [] } };
    };

    await openSpotlight({ apiKey: KEY, frame: await picture(), reader: reader(), about });

    expect(order.indexOf(`start:${DETECT}`)).toBeLessThan(order.indexOf(`end:${SAM3}`));
  });

  it("reports an empty split as a picture that does not light", async () => {
    reply = async (endpoint) =>
      endpoint === DETECT ? { ok: true, json: { objects: [] } } : { ok: true, json: { masks: [] } };

    const opened = await openSpotlight({ apiKey: KEY, frame: await picture(), reader: reader(), about });

    expect(opened).toEqual({ ok: false, why: "empty-split" });
  });

  it("hands back a map naming the pieces that survived", async () => {
    reply = async (endpoint) => {
      if (endpoint === DETECT) return { ok: true, json: { objects: [] } };
      return {
        ok: true,
        json: { masks: [await maskUri((x) => x < 20), await maskUri((x) => x > 40)] },
      };
    };

    const opened = await openSpotlight({ apiKey: KEY, frame: await picture(), reader: reader(), about });

    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.map.pieces).toBe(2);
    expect(opened.map.width).toBe(W);
    expect(opened.tally.rawPieces).toBe(2);
    expect(opened.tally.faces).toBe(0);
    /* The whole point of the encoding: a photograph's worth of geometry in
       kilobytes rather than the 4 KB per piece a raw mask would be. */
    expect(opened.map.bytes.byteLength).toBeGreaterThan(0);
  });

  /* ---- §6: A PERSON IS NOT A TAKEABLE THING ---- */
  it("drops the piece that covers a detected face, so a person never lights", async () => {
    reply = async (endpoint) => {
      if (endpoint === DETECT) return { ok: true, json: { objects: [FACE_OBJECT] } };
      return {
        ok: true,
        json: {
          masks: [
            /* The whole-person piece: it holds the entire face box. */
            await maskUri((x, y) => x < 32 && y < 32),
            /* A garment well clear of it. */
            await maskUri((x, y) => y > 48),
          ],
        },
      };
    };

    const opened = await openSpotlight({ apiKey: KEY, frame: await picture(), reader: reader(), about });

    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.tally.personPiecesDropped).toBe(1);
    expect(opened.map.pieces).toBe(1);
    expect(opened.tally.dropped).toEqual([{ at: 0, reason: "covers-a-face" }]);
  });

  it("says nothing is left to light when every piece was a person", async () => {
    reply = async (endpoint) => {
      if (endpoint === DETECT) return { ok: true, json: { objects: [FACE_OBJECT] } };
      return { ok: true, json: { masks: [await maskUri((x, y) => x < 32 && y < 32)] } };
    };

    const opened = await openSpotlight({ apiKey: KEY, frame: await picture(), reader: reader(), about });

    expect(opened).toEqual({ ok: false, why: "nothing-left-to-light" });
  });
});

describe("tapping one", () => {
  it("refuses the tap when the faces cannot be read, BEFORE buying the cut", async () => {
    reply = async (endpoint) => {
      if (endpoint === DETECT) return { ok: false, status: 500, json: { detail: "down" } };
      return { ok: true, json: { masks: [await maskUri(() => true)] } };
    };

    const took = await tapSpotlight({
      apiKey: KEY,
      frame: await picture(),
      at: { x: 10, y: 50 },
      reader: reader(),
      engine: namer("jacket"),
      about,
    });

    expect(took).toEqual({ ok: false, why: "no-faces-read" });
    /* The fence refuses before the spend: no SAM 3 call left the machine. */
    expect(sent.filter((one) => one.endpoint === SAM3)).toHaveLength(0);
  });

  /* ⚠ THIS ARM EXISTS BECAUSE A SABOTAGE FOUND IT MISSING. The open road's
     noun had an arm and the tap road's did not — paraphrasing the tap's noun
     left every suite green, because the two roads ask the detector
     separately and only one of them was being read. */
  it("asks the detector for the same face noun on the tap road", async () => {
    reply = async (endpoint) => {
      if (endpoint === DETECT) return { ok: true, json: { objects: [] } };
      return { ok: true, json: { masks: [await maskUri((x, y) => y > 40)] } };
    };

    await tapSpotlight({
      apiKey: KEY,
      frame: await picture(),
      at: { x: 10, y: 50 },
      reader: reader(),
      engine: namer("jacket"),
      about,
    });

    const detect = sent.find((one) => one.endpoint === DETECT);
    expect(detect?.body.prompt).toBe(TAKE_FACE_NOUN);
  });

  it("reports a tap that found nothing as exactly that", async () => {
    reply = async (endpoint) =>
      endpoint === DETECT ? { ok: true, json: { objects: [] } } : { ok: true, json: { masks: [] } };

    const took = await tapSpotlight({
      apiKey: KEY,
      frame: await picture(),
      at: { x: 10, y: 50 },
      reader: reader(),
      engine: namer("jacket"),
      about,
    });

    expect(took).toEqual({ ok: false, why: "nothing-under-the-tap" });
  });

  it("takes the cut and names it", async () => {
    reply = async (endpoint) => {
      if (endpoint === DETECT) return { ok: true, json: { objects: [] } };
      return { ok: true, json: { masks: [await maskUri((x, y) => y > 40)] } };
    };
    const engine = namer("jacket");

    const took = await tapSpotlight({
      apiKey: KEY,
      frame: await picture(),
      at: { x: 10, y: 50 },
      reader: reader(),
      engine,
      about,
    });

    expect(took.ok).toBe(true);
    if (!took.ok) return;
    expect(took.name).toBe("jacket");
    expect(took.cut.pieces).toBe(1);
    expect(took.bounds.height).toBeGreaterThan(0);
    expect(engine.calls).toBe(1);
  });

  it("shows the cut with NO name rather than a guess when the reader will not give one", async () => {
    reply = async (endpoint) => {
      if (endpoint === DETECT) return { ok: true, json: { objects: [] } };
      return { ok: true, json: { masks: [await maskUri((x, y) => y > 40)] } };
    };

    const took = await tapSpotlight({
      apiKey: KEY,
      frame: await picture(),
      at: { x: 10, y: 50 },
      reader: reader(),
      engine: namer(null),
      about,
    });

    expect(took.ok).toBe(true);
    if (!took.ok) return;
    expect(took.name).toBeNull();
    /* The cut still comes back — a nameless chip is honest, a wrong name is not. */
    expect(took.cut.pieces).toBe(1);
  });

  /* ---- §6, IN THE BYTES ---- */
  it("subtracts the face from a cut that overlaps one", async () => {
    reply = async (endpoint) => {
      if (endpoint === DETECT) return { ok: true, json: { objects: [FACE_OBJECT] } };
      /* A cut spanning the face box AND the bottom of the frame. */
      return { ok: true, json: { masks: [await maskUri(() => true)] } };
    };

    const took = await tapSpotlight({
      apiKey: KEY,
      frame: await picture(),
      at: { x: 10, y: 50 },
      reader: reader(),
      engine: namer("coat"),
      about,
    });

    expect(took.ok).toBe(true);
    if (!took.ok) return;

    /*
      READ AT THE RETURNED BYTES, not at the bounding box. The first version of
      this arm asserted `bounds.y >= 32 || bounds.x >= 32` and failed — rightly:
      subtracting a top-left square from a full-frame cut leaves an L, and an
      L's bounding box still starts at the origin. The bounds were never going
      to be able to say this; the pixels can.
    */
    const back = await sharp(took.cut.bytes).raw().toBuffer({ resolveWithObject: true });
    const channels = back.info.channels;
    const at = (x: number, y: number) => back.data[(y * W + x) * channels]!;

    /* Inside the face box: gone. */
    expect(at(8, 8)).toBe(0);
    expect(at(30, 30)).toBe(0);
    /* Outside it: still the cut. */
    expect(at(8, 50)).toBe(1);
    expect(at(50, 8)).toBe(1);
  });

  it("refuses when the only thing under the tap was a face", async () => {
    reply = async (endpoint) => {
      if (endpoint === DETECT) return { ok: true, json: { objects: [FACE_OBJECT] } };
      return { ok: true, json: { masks: [await maskUri((x, y) => x < 32 && y < 32)] } };
    };

    const took = await tapSpotlight({
      apiKey: KEY,
      frame: await picture(),
      at: { x: 10, y: 10 },
      reader: reader(),
      engine: namer("face"),
      about,
    });

    expect(took.ok).toBe(false);
    if (took.ok) return;
    expect(took.why).toMatch(/only-a-face|cut-refused/);
  });

  it("does not name a cut it refused", async () => {
    reply = async (endpoint) => {
      if (endpoint === DETECT) return { ok: true, json: { objects: [FACE_OBJECT] } };
      return { ok: true, json: { masks: [await maskUri((x, y) => x < 32 && y < 32)] } };
    };
    const engine = namer("face");

    await tapSpotlight({
      apiKey: KEY,
      frame: await picture(),
      at: { x: 10, y: 10 },
      reader: reader(),
      engine,
      about,
    });

    /* A refused cut costs the house nothing at the text provider. */
    expect(engine.calls).toBe(0);
  });
});
