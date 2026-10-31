/**
 * THE SPOTLIGHT'S ENTRANCE, DRIVEN — #14 slice 3a-2, re-pointed by #2902.
 *
 * The FETCH is stubbed rather than the modules, so every arm here runs the real
 * reading road, the real `markReferenceThings`, the real `regionInBox`, the real
 * `cutAtPoint`, the real `cleanSplit` and the real detector parsing. ⚠ **Only
 * the TEXT engine is a fake**, and it answers in the shape `parseDiscovery`
 * reads, so the parser under it is real too. A suite that mocked the roads would
 * prove the entrance calls functions, which is not the thing in doubt.
 *
 * ⚠ **#2902's OWN ARMS ARE THE LAST THREE GROUPS, AND EACH CARRIES A CONTROL
 * THAT RUNS THE OTHER WAY** — his four complaints are properties of the
 * construction, so each is held by asserting what was BOUGHT (one cut per name,
 * inside that name's own rectangle, and none for anything unnamed), and the
 * face fence is held by a pair: the mask read taking nothing off the hair, and
 * the same picture with the mask read FAILING taking all 256 pixels, which is
 * the fence that shipped.
 *
 * Three arms are the ones worth keeping from 3a-2, and none of them is about a
 * happy path:
 *
 * 1. **§6's fence refuses rather than degrades.** A detector that falls over
 *    means the face boxes are unknown, and a spotlight that might light a face
 *    is the one failure this road may not have. So no boxes is a picture that
 *    does not light and a tap that is not taken — and on the tap road the
 *    refusal must come BEFORE the cut is bought, which is asserted by counting
 *    what left the machine.
 * 2. **The reading road and the face detect are in flight together.**
 *    Sequentially they are a multi-stage road plus ~1.8 s for nothing, since
 *    neither answer feeds the other. The arm holds the overlap rather than the
 *    wall time, because a duration is a clock and this is a fact about
 *    ordering. ⚠ The face's OWN MASK cannot join them and is bought after —
 *    the rectangle to cut inside is the detect's own answer, so it does not
 *    exist until that resolves.
 * 3. **The face noun is the one `referenceTake.ts` already uses.** Asserted on
 *    the OUTGOING detect body (invariant 5): a paraphrase here would be a
 *    second vocabulary for the same question, and the fence would quietly ask
 *    about something else.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

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

/**
 * A READING, in the shape `parseDiscovery` reads — #2902.
 *
 * The pieces come from the picture being READ now, so every open-road arm needs
 * an engine that names things. It is the real parser on the other side of this:
 * the text goes through `parseDiscovery` exactly as a provider's would.
 */
function readingOf(
  names: readonly { name: string; kind?: string }[],
  personPresent = false,
): TextEngine & { calls: number } {
  const engine = {
    calls: 0,
    complete: async () => {
      engine.calls += 1;
      return {
        text: JSON.stringify({
          personPresent,
          features: names.map((one) => ({
            name: one.name,
            count: 1,
            about: "",
            kind: one.kind ?? "clothing",
            on: "",
            coverage: "single",
          })),
          cannotSee: [],
        }),
        truncated: false,
      };
    },
  } as unknown as TextEngine & { calls: number };
  return engine;
}

/** A pixel rectangle as the detector would answer it on a W x H frame. */
function normalized(box: { x: number; y: number; width: number; height: number }) {
  return {
    x_min: box.x / W,
    y_min: box.y / H,
    x_max: (box.x + box.width) / W,
    y_max: (box.y + box.height) / H,
  };
}

/** The key a SAM 3 `box_prompts` body carries, so a cut can be matched to its rectangle. */
function boxKey(box: { x_min: number; y_min: number; x_max: number; y_max: number }): string {
  return `${box.x_min},${box.y_min},${box.x_max},${box.y_max}`;
}

function rectKey(box: { x: number; y: number; width: number; height: number }): string {
  return boxKey({ x_min: box.x, y_min: box.y, x_max: box.x + box.width, y_max: box.y + box.height });
}

type Rect = { x: number; y: number; width: number; height: number };

/**
 * THE WHOLE WIRE FOR THE READING ROAD, so every arm drives the real roads.
 *
 * A detect is keyed on its prompt — the face noun, or one of the reading's own
 * names. A cut is keyed on the RECTANGLE in its body, which is the only thing
 * `regionInBox` sends (its prompt goes out empty on purpose), and that is what
 * tells a piece's cut apart from the face's own.
 */
function wire(input: {
  faces?: readonly Rect[];
  /** Which rectangle the detector puts round each name. */
  boxes?: Readonly<Record<string, Rect>>;
  /** Which pixels the segmenter answers inside a given rectangle. */
  cuts?: readonly { box: Rect; on: (x: number, y: number) => boolean }[];
  /** `undefined` leaves the face's own mask unread, so the rectangle stands in. */
  faceCut?: (x: number, y: number) => boolean;
}): (endpoint: string, body: any) => Promise<{ ok: boolean; status?: number; json?: unknown }> {
  const byRect = new Map<string, (x: number, y: number) => boolean>();
  for (const cut of input.cuts ?? []) byRect.set(rectKey(cut.box), cut.on);
  if (input.faceCut !== undefined) {
    for (const face of input.faces ?? []) byRect.set(rectKey(face), input.faceCut);
  }
  return async (endpoint, body) => {
    if (endpoint === DETECT) {
      if (body.prompt === TAKE_FACE_NOUN) {
        return { ok: true, json: { objects: (input.faces ?? []).map(normalized) } };
      }
      const box = (input.boxes ?? {})[String(body.prompt)];
      return { ok: true, json: { objects: box === undefined ? [] : [normalized(box)] } };
    }
    const asked = Array.isArray(body.box_prompts) ? body.box_prompts[0] : undefined;
    const on = asked === undefined ? undefined : byRect.get(boxKey(asked));
    if (on === undefined) return { ok: true, json: { masks: [] } };
    return { ok: true, json: { masks: [await maskUri(on)] } };
  };
}

/** Every rectangle a cut was asked inside, in the order they were asked. */
function cutsAsked(): Rect[] {
  return sent
    .filter((one) => one.endpoint === SAM3 && Array.isArray(one.body.box_prompts))
    .map((one) => {
      const box = one.body.box_prompts[0];
      return { x: box.x_min, y: box.y_min, width: box.x_max - box.x_min, height: box.y_max - box.y_min };
    });
}

/** The frame these arms open, and the size the attachment row would carry. */
const SIZE = { width: W, height: H };

/* A top and a pair of pants, well clear of each other and of the frame's edges. */
const TOP: Rect = { x: 8, y: 8, width: 48, height: 20 };
const PANTS: Rect = { x: 8, y: 36, width: 48, height: 20 };

describe("opening a picture", () => {
  it("does not light a picture when the reader cannot detect at all, and buys nothing", async () => {
    reply = async () => ({ ok: true, json: {} });
    const bare = { ...reader(), pointer: undefined } as RegionReader;

    const opened = await openSpotlight({
      apiKey: KEY, frame: await picture(), size: SIZE, reader: bare, engine: readingOf([]), about,
    });

    expect(opened).toEqual({ ok: false, why: "no-pointer" });
    expect(sent).toHaveLength(0);
  });

  it("does not light a picture when the reader cannot cut inside a rectangle", async () => {
    reply = async () => ({ ok: true, json: {} });
    /* The pieces come from named cuts now, so a reader with no `regionInBox`
       has no road at all — and it must say so rather than falling back to a
       grid, which is the shape #2902 replaced. */
    const bare = { ...reader(), regionInBox: undefined } as RegionReader;

    const opened = await openSpotlight({
      apiKey: KEY, frame: await picture(), size: SIZE, reader: bare, engine: readingOf([{ name: "top" }]), about,
    });

    expect(opened).toEqual({ ok: false, why: "no-cutter" });
  });

  /* ---- §6's FENCE, THE DIRECTION THAT MATTERS ---- */
  it("does not light a picture whose faces could not be read", async () => {
    reply = async (endpoint, body) => {
      if (endpoint === DETECT && body.prompt === TAKE_FACE_NOUN) {
        return { ok: false, status: 500, json: { detail: "down" } };
      }
      if (endpoint === DETECT) return { ok: true, json: { objects: [normalized(TOP)] } };
      return { ok: true, json: { masks: [await maskUri((x, y) => y > 8 && y < 28)] } };
    };

    const opened = await openSpotlight({
      apiKey: KEY, frame: await picture(), size: SIZE, reader: reader(), engine: readingOf([{ name: "top" }]), about,
    });

    expect(opened).toEqual({ ok: false, why: "no-faces-read" });
  });

  it("asks the detector for the face noun the take road already uses", async () => {
    reply = wire({ faces: [], boxes: { top: TOP }, cuts: [{ box: TOP, on: (_x, y) => y > 8 && y < 28 }] });

    await openSpotlight({
      apiKey: KEY, frame: await picture(), size: SIZE, reader: reader(), engine: readingOf([{ name: "top" }]), about,
    });

    expect(sent.some((one) => one.endpoint === DETECT && one.body.prompt === TAKE_FACE_NOUN)).toBe(true);
  });

  it("runs the reading road and the face detect together rather than one after the other", async () => {
    const slow = wire({ faces: [], boxes: { top: TOP }, cuts: [{ box: TOP, on: (_x, y) => y > 8 && y < 28 }] });
    reply = async (endpoint, body) => {
      /* A piece's cut answers slowly; the face detect must have STARTED before
         it finishes, which is the fact being held — not a wall time. */
      if (endpoint === SAM3) await new Promise((resolve) => setTimeout(resolve, 40));
      return slow(endpoint, body);
    };

    await openSpotlight({
      apiKey: KEY, frame: await picture(), size: SIZE, reader: reader(), engine: readingOf([{ name: "top" }]), about,
    });

    expect(order.indexOf(`start:${DETECT}`)).toBeLessThan(order.indexOf(`end:${SAM3}`));
  });

  it("does not light a picture it could not read, and buys no cut for it", async () => {
    reply = wire({ faces: [] });
    /* An engine that answers nothing usable: the reading fails, so there are no
       names, so there is nothing to cut. The second half is the one worth
       holding — a failed reading must not spend the segmenter. */
    const mute = { complete: async () => ({ text: "", truncated: false }) } as unknown as TextEngine;

    const opened = await openSpotlight({
      apiKey: KEY, frame: await picture(), size: SIZE, reader: reader(), engine: mute, about,
    });

    expect(opened.ok).toBe(false);
    if (opened.ok) return;
    expect(opened.why.startsWith("not-read:")).toBe(true);
    expect(cutsAsked()).toEqual([]);
  });

  /* ---- HIS FOUR COMPLAINTS, AS PROPERTIES OF THE CONSTRUCTION ---- */
  it("cuts one whole thing per name the reading gave, and nothing it did not name", async () => {
    reply = wire({
      faces: [],
      boxes: { top: TOP, pants: PANTS },
      cuts: [
        { box: TOP, on: (_x, y) => y >= 8 && y < 28 },
        { box: PANTS, on: (_x, y) => y >= 36 && y < 56 },
      ],
    });

    const opened = await openSpotlight({
      apiKey: KEY,
      frame: await picture(),
      size: SIZE,
      reader: reader(),
      engine: readingOf([{ name: "top" }, { name: "pants" }]),
      about,
    });

    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    /*
      THE WHOLE OF HIS COMPLAINT, IN ONE ASSERTION PAIR. *"i select her pants
      and only half her pants light up i select her shoe and only 1 shoes
      lights up"* was a grid of 32 dots, each answering about its own dot. Here
      the cuts bought are EXACTLY one per name, each asked inside that name's
      own rectangle — so what comes back for `pants` is the pair, and nothing
      the reading did not name has a piece at all.
    */
    expect(cutsAsked()).toEqual([TOP, PANTS]);
    expect(opened.names).toEqual(["top", "pants"]);
    expect(opened.map.pieces).toBe(2);
    expect(opened.map.width).toBe(W);
    expect(opened.tally.rawPieces).toBe(2);
    expect(opened.tally.reading.named).toBe(2);
    expect(opened.tally.reading.cutsAnswered).toBe(2);
    expect(opened.tally.faces).toBe(0);
    expect(opened.map.bytes.byteLength).toBeGreaterThan(0);
  });

  it("buys no face-mask read when the picture holds no face", async () => {
    reply = wire({ faces: [], boxes: { top: TOP }, cuts: [{ box: TOP, on: (_x, y) => y >= 8 && y < 28 }] });

    const opened = await openSpotlight({
      apiKey: KEY, frame: await picture(), size: SIZE, reader: reader(), engine: readingOf([{ name: "top" }]), about,
    });

    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.tally.faceMaskRead).toBe(false);
    /* One cut, for the one name — no second SAM 3 call for a face that is not
       there. The fence costs nothing on a hanger shot. */
    expect(cutsAsked()).toEqual([TOP]);
  });

  /* ---- §6: A PERSON IS NOT A TAKEABLE THING ---- */
  it("drops the piece that covers a detected face, so a person never lights", async () => {
    const FACE: Rect = { x: 0, y: 0, width: 32, height: 32 };
    const PERSON: Rect = { x: 0, y: 0, width: 32, height: 32 };
    reply = wire({
      faces: [FACE],
      boxes: { person: PERSON, pants: PANTS },
      cuts: [
        /* The whole-person piece: it holds the entire face box. */
        { box: PERSON, on: (x, y) => x < 32 && y < 32 },
        { box: PANTS, on: (_x, y) => y >= 36 && y < 56 },
      ],
      /* The face's own pixels fill its rectangle here, so the person piece is
         caught by the coverage rule exactly as it was before this card. */
      faceCut: (x, y) => x < 32 && y < 32,
    });

    const opened = await openSpotlight({
      apiKey: KEY,
      frame: await picture(),
      size: SIZE,
      reader: reader(),
      engine: readingOf([{ name: "person", kind: "anatomy" }, { name: "pants" }], true),
      about,
    });

    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.tally.personPiecesDropped).toBe(1);
    expect(opened.map.pieces).toBe(1);
    expect(opened.tally.dropped).toEqual([{ at: 0, reason: "covers-a-face" }]);
    /* AND THE NAMES FOLLOW THE DROP. The derived mapping is the quiet defect
       available here — the right shape with the wrong word — so the arm holds
       the surviving name rather than only the count. */
    expect(opened.names).toEqual(["pants"]);
  });

  it("says nothing is left to light when every piece was a person", async () => {
    const FACE: Rect = { x: 0, y: 0, width: 32, height: 32 };
    reply = wire({
      faces: [FACE],
      boxes: { person: FACE },
      cuts: [{ box: FACE, on: (x, y) => x < 32 && y < 32 }],
      faceCut: (x, y) => x < 32 && y < 32,
    });

    const opened = await openSpotlight({
      apiKey: KEY,
      frame: await picture(),
      size: SIZE,
      reader: reader(),
      engine: readingOf([{ name: "person", kind: "anatomy" }], true),
      about,
    });

    expect(opened).toEqual({ ok: false, why: "nothing-left-to-light" });
  });

  /* ---- HAIR IS A PIECE, AND THE FACE STILL NEVER LIGHTS (#2902, his ruling) ---- */
  describe("the face fence is the face's own pixels", () => {
    /* A face rectangle in the middle, and a face that fills only its centre —
       which is what a real face box looks like next to hair. */
    const FACE_BOX: Rect = { x: 16, y: 16, width: 32, height: 32 };
    const FACE_PIXELS = (x: number, y: number) => x >= 24 && x < 40 && y >= 24 && y < 40;
    /* Hair as one connected band: half of it inside the face RECTANGLE but
       clear of the face itself, half of it above the rectangle. */
    const HAIR: Rect = { x: 16, y: 8, width: 32, height: 16 };
    const HAIR_PIXELS = (x: number, y: number) => x >= 16 && x < 48 && y >= 8 && y < 24;

    it("keeps the hair that frames a face when the face's own mask was read", async () => {
      reply = wire({
        faces: [FACE_BOX],
        boxes: { hair: HAIR },
        cuts: [{ box: HAIR, on: HAIR_PIXELS }],
        faceCut: FACE_PIXELS,
      });

      const opened = await openSpotlight({
        apiKey: KEY,
        frame: await picture(),
        size: SIZE,
        reader: reader(),
        engine: readingOf([{ name: "hair", kind: "anatomy" }], true),
        about,
      });

      expect(opened.ok).toBe(true);
      if (!opened.ok) return;
      expect(opened.tally.faceMaskRead).toBe(true);
      expect(opened.names).toEqual(["hair"]);
      /*
        THE NUMBER HIS RULING TURNS ON. The hair's band inside the face
        rectangle is 32 x 8 = 256 pixels and the face's own pixels are nowhere
        near it, so NOTHING is taken off the hair — where the rectangle fence
        took all 256 (the arm below).
      */
      expect(opened.tally.facePixelsRemoved).toBe(0);
    });

    it("falls back to the rectangle when the face's own mask cannot be read, which is the old fence exactly", async () => {
      /* THE NEGATIVE CONTROL, and it is the whole evidence for the arm above:
         the same picture, the same hair, the same face rectangle — only the
         mask read fails. 256 pixels of hair go, which is the behaviour that
         shipped and is what `cleanSplit`'s header measured as 0.935 -> 0.503. */
      reply = wire({ faces: [FACE_BOX], boxes: { hair: HAIR }, cuts: [{ box: HAIR, on: HAIR_PIXELS }] });

      const opened = await openSpotlight({
        apiKey: KEY,
        frame: await picture(),
        size: SIZE,
        reader: reader(),
        engine: readingOf([{ name: "hair", kind: "anatomy" }], true),
        about,
      });

      expect(opened.ok).toBe(true);
      if (!opened.ok) return;
      expect(opened.tally.faceMaskRead).toBe(false);
      expect(opened.tally.facePixelsRemoved).toBe(256);
    });

    it("stands the rectangle in for every face when one face's mask is missing", async () => {
      /* TWO faces, one of which answers. A fence made of one face's mask and
         one face's rectangle would have a hole exactly where a read failed, so
         the road refuses the mix and subtracts rectangles for both. */
      const SECOND: Rect = { x: 0, y: 48, width: 8, height: 8 };
      const answered = new Set([rectKey(FACE_BOX)]);
      reply = async (endpoint, body) => {
        if (endpoint === DETECT) {
          if (body.prompt === TAKE_FACE_NOUN) {
            return { ok: true, json: { objects: [normalized(FACE_BOX), normalized(SECOND)] } };
          }
          return { ok: true, json: { objects: [normalized(HAIR)] } };
        }
        const asked = Array.isArray(body.box_prompts) ? body.box_prompts[0] : undefined;
        if (asked !== undefined && boxKey(asked) === rectKey(HAIR)) {
          return { ok: true, json: { masks: [await maskUri(HAIR_PIXELS)] } };
        }
        if (asked !== undefined && answered.has(boxKey(asked))) {
          return { ok: true, json: { masks: [await maskUri(FACE_PIXELS)] } };
        }
        /* The second face's own pixels come back empty — a real outcome. */
        return { ok: true, json: { masks: [] } };
      };

      const opened = await openSpotlight({
        apiKey: KEY,
        frame: await picture(),
        size: SIZE,
        reader: reader(),
        engine: readingOf([{ name: "hair", kind: "anatomy" }], true),
        about,
      });

      expect(opened.ok).toBe(true);
      if (!opened.ok) return;
      expect(opened.tally.faceMaskRead).toBe(false);
      expect(opened.tally.facePixelsRemoved).toBe(256);
    });
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
