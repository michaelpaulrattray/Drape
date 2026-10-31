/**
 * THE SPOTLIGHT'S TWO READS, ASSERTED ON THE OUTGOING REQUEST (#14 slice 3a).
 *
 * Invariant 5 — *contracts about what gets sent are proven on the outgoing
 * request, not on a constant near it.* Two fields on this road are the kind
 * that break silently rather than loudly, which is why they are driven here
 * and not reviewed by eye:
 *
 * - **`prompt: ""`** — the provider's own schema gives `prompt` a DEFAULT OF
 *   `"wheel"`. A body that drops the field still gets a 200 and still gets
 *   masks; they are just masks of wheels. There is no error to notice.
 * - **`include_scores` ABSENT** — the disappearing-technology law's clause 4
 *   has its founding instance in this exact model, scores bought and
 *   discarded. Nothing on this road reads a score, so nothing on this road
 *   buys one, and the arm below fails if a later edit turns it back on without
 *   a reader.
 *
 * The fetch is stubbed, so no call leaves the machine and no key is needed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SPLIT_MAX_MASKS,
  cutAtPoint,
  splitAtPoints,
} from "./falRegionReader";

/** A real PNG, because `assertPicture` and sharp both insist on one. */
async function picture(width: number, height: number): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 10, b: 10 } },
  })
    .png()
    .toBuffer();
}

/** A 1x1 white PNG standing in for a returned mask. */
async function maskPng(width: number, height: number): Promise<string> {
  const sharp = (await import("sharp")).default;
  const bytes = await sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .png()
    .toBuffer();
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

type Sent = { endpoint: string; body: any };

let sent: Sent[];
let answer: (endpoint: string) => { ok: boolean; status?: number; json?: unknown };

beforeEach(() => {
  sent = [];
  vi.stubGlobal("fetch", async (url: string, init: any) => {
    const endpoint = String(url).replace("https://fal.run/", "");
    sent.push({ endpoint, body: JSON.parse(String(init.body)) });
    const reply = answer(endpoint);
    return {
      ok: reply.ok,
      status: reply.status ?? (reply.ok ? 200 : 500),
      headers: new Map(),
      text: async () => JSON.stringify(reply.json ?? {}),
      json: async () => reply.json ?? {},
    } as unknown as Response;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the split, at the wire", () => {
  it("sends an EMPTY text prompt, a 32-point grid, and no scores", async () => {
    const mask = await maskPng(800, 400);
    answer = () => ({ ok: true, json: { masks: [{ url: mask }] } });

    await splitAtPoints({ apiKey: "k", image: await picture(800, 400) });

    expect(sent).toHaveLength(1);
    const { endpoint, body } = sent[0]!;
    expect(endpoint).toBe("fal-ai/sam-3/image");

    /* THE TRAP: absent is not empty — absent means "wheel". */
    expect(body).toHaveProperty("prompt");
    expect(body.prompt).toBe("");

    expect(body.max_masks).toBe(SPLIT_MAX_MASKS);
    expect(body.max_masks).toBe(32);
    expect(body.return_multiple_masks).toBe(true);
    expect(body.apply_mask).toBe(false);

    /* CLAUSE 4: a signal nobody reads is a signal nobody buys. */
    expect(body).not.toHaveProperty("include_scores");

    expect(body.point_prompts).toHaveLength(32);
    expect(new Set(body.point_prompts.map((p: any) => p.object_id)).size).toBe(32);
    expect(body.point_prompts.every((p: any) => p.label === 1)).toBe(true);
    /* 8 x 4 on a landscape frame, at cell centres. */
    expect(body.point_prompts[0]).toMatchObject({ x: 50, y: 50 });
    expect(new Set(body.point_prompts.map((p: any) => p.x)).size).toBe(8);
    expect(new Set(body.point_prompts.map((p: any) => p.y)).size).toBe(4);
    expect(body.point_prompts.every((p: any) => p.x >= 0 && p.x < 800 && p.y >= 0 && p.y < 400)).toBe(true);
  });

  it("turns the grid on its side for a portrait frame", async () => {
    const mask = await maskPng(400, 800);
    answer = () => ({ ok: true, json: { masks: [{ url: mask }] } });

    await splitAtPoints({ apiKey: "k", image: await picture(400, 800) });

    const points = sent[0]!.body.point_prompts;
    expect(points).toHaveLength(32);
    expect(new Set(points.map((p: any) => p.x)).size).toBe(4);
    expect(new Set(points.map((p: any) => p.y)).size).toBe(8);
  });

  it("fails open with no pieces when the provider refuses, and never throws", async () => {
    answer = () => ({ ok: false, status: 429, json: { detail: "concurrent_requests_limit" } });

    await expect(splitAtPoints({ apiKey: "k", image: await picture(800, 400) })).resolves.toEqual([]);
  });

  it("fails open when the provider answers with no masks at all", async () => {
    answer = () => ({ ok: true, json: {} });

    await expect(splitAtPoints({ apiKey: "k", image: await picture(800, 400) })).resolves.toEqual([]);
  });
});

describe("the tap's cut, at the wire", () => {
  it("sends ONE point at the tap, an empty prompt, and asks for no extra masks", async () => {
    const mask = await maskPng(800, 400);
    answer = () => ({ ok: true, json: { masks: [{ url: mask }] } });

    const cut = await cutAtPoint({ apiKey: "k", image: await picture(800, 400), at: { x: 123, y: 77 } });

    expect(cut).not.toBeNull();
    const { body } = sent[0]!;
    expect(body.prompt).toBe("");
    expect(body.point_prompts).toEqual([{ x: 123, y: 77, label: 1, object_id: 1 }]);
    /* One tap is one object: asking for several would hand the caller a part
       AND a whole with nothing to choose between them. */
    expect(body).not.toHaveProperty("max_masks");
    expect(body).not.toHaveProperty("return_multiple_masks");
    expect(body).not.toHaveProperty("include_scores");
  });

  it("answers null for a tap outside the picture, and buys nothing", async () => {
    answer = () => ({ ok: true, json: { masks: [] } });

    const cut = await cutAtPoint({ apiKey: "k", image: await picture(800, 400), at: { x: 800, y: 10 } });

    expect(cut).toBeNull();
    expect(sent).toHaveLength(0);
  });

  it("answers null when the tap found nothing, and never throws", async () => {
    answer = () => ({ ok: true, json: { masks: [] } });

    await expect(
      cutAtPoint({ apiKey: "k", image: await picture(800, 400), at: { x: 10, y: 10 } }),
    ).resolves.toBeNull();
  });
});

/**
 * THE MASK DOWNLOADS — added 2026-10-31 (#14 slice 3a-2), after the entrance's
 * first real split measured 32 sequential round trips at 32,710 ms against
 * 1,025 ms overlapped: 69% of a 47.7 s road, and the court's 4.3–6.6 s had only
 * ever been the provider call.
 *
 * Overlapping them is a one-line change with two properties that are NOT
 * incidental, so both are held here: the ORDER, because a piece's index becomes
 * its id in the hit-test map and `cleanSplit`'s drop reasons refer to arrival
 * order; and the per-mask TOLERANCE, because one unreadable mask must stay one
 * missing piece rather than becoming a failed split.
 */
describe("the split's mask downloads", () => {
  /*
    ⚠ THESE ARMS SERVE THE MASKS OVER http, NOT AS `data:` URIs, AND THAT IS
    THE WHOLE REASON THEY WORK. `fetchMask` decodes a `data:` URI inline with
    no network call at all, so an arm built on data URIs exercises the DECODE
    path and can never see a download overlap — the first draft of the
    in-flight arm did exactly that and read a peak of 1 against correct code.
    The provider answers with http urls, so that is what is driven here.
  */
  const PNG_BY_URL = new Map<string, Buffer>();

  async function bandPng(rows: number): Promise<Buffer> {
    const sharp = (await import("sharp")).default;
    const raw = Buffer.alloc(32 * 32);
    for (let y = 0; y < rows; y += 1) raw.fill(255, y * 32, (y + 1) * 32);
    return sharp(raw, { raw: { width: 32, height: 32, channels: 1 } }).png().toBuffer();
  }

  /** A fetch that answers the split POST with urls, and those urls with bytes. */
  function serve(options: {
    urls: string[];
    delayFor?: (url: string) => number;
    onMaskOpen?: () => void;
    onMaskClose?: () => void;
    corrupt?: string;
  }): void {
    vi.stubGlobal("fetch", async (url: string) => {
      const asString = String(url);
      if (asString.startsWith("https://fal.run/")) {
        return {
          ok: true,
          status: 200,
          headers: new Map(),
          text: async () => JSON.stringify({ masks: options.urls }),
          json: async () => ({ masks: options.urls }),
        } as unknown as Response;
      }
      options.onMaskOpen?.();
      const wait = options.delayFor?.(asString) ?? 0;
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      options.onMaskClose?.();
      const bytes = asString === options.corrupt
        ? Buffer.from([0x9e, 0x8b, 0x7e, 0x6b, 0xea, 0x67])
        : PNG_BY_URL.get(asString)!;
      return {
        ok: true,
        status: 200,
        headers: new Map(),
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      } as unknown as Response;
    });
  }

  it("hands the pieces back in the order the provider listed them", async () => {
    /* Three bands holding visibly different amounts of white, with the FIRST
       url served SLOWEST — so a road that kept them as they arrived rather
       than as they were listed would reorder them and this arm would redden. */
    const urls = ["https://masks.example/a", "https://masks.example/b", "https://masks.example/c"];
    PNG_BY_URL.set(urls[0]!, await bandPng(4));
    PNG_BY_URL.set(urls[1]!, await bandPng(10));
    PNG_BY_URL.set(urls[2]!, await bandPng(20));
    const delays = new Map([[urls[0]!, 60], [urls[1]!, 20], [urls[2]!, 0]]);
    serve({ urls, delayFor: (url) => delays.get(url) ?? 0 });

    const pieces = await splitAtPoints({ apiKey: "k", image: await picture(32, 32) });

    expect(pieces).toHaveLength(3);
    const live = pieces.map((piece) => {
      let n = 0;
      for (let at = 0; at < piece.data.length; at += 1) if (piece.data[at]! > 127) n += 1;
      return n;
    });
    expect(live[0]).toBeLessThan(live[1]!);
    expect(live[1]).toBeLessThan(live[2]!);
  });

  it("has more than one download in flight at once", async () => {
    /* ⚠ THE PROPERTY, NOT THE CLOCK. A latency assertion here would be a timer
       on somebody else's machine; what the change actually did is overlap the
       round trips, and the honest way to hold that is to count how many were
       open at the same moment. Reverting to `for … await` makes this peak
       exactly 1 and reddens the arm. */
    const urls = [1, 2, 3, 4].map((n) => `https://masks.example/${n}`);
    for (const url of urls) PNG_BY_URL.set(url, await bandPng(8));
    let open = 0;
    let peak = 0;
    serve({
      urls,
      delayFor: () => 15,
      onMaskOpen: () => {
        open += 1;
        peak = Math.max(peak, open);
      },
      onMaskClose: () => {
        open -= 1;
      },
    });

    await splitAtPoints({ apiKey: "k", image: await picture(32, 32) });

    expect(peak).toBeGreaterThan(1);
  });

  it("keeps the readable pieces when one mask cannot be read", async () => {
    const urls = ["https://masks.example/x", "https://masks.example/bad", "https://masks.example/z"];
    PNG_BY_URL.set(urls[0]!, await bandPng(8));
    PNG_BY_URL.set(urls[2]!, await bandPng(8));
    serve({ urls, corrupt: urls[1] });

    const pieces = await splitAtPoints({ apiKey: "k", image: await picture(32, 32) });

    /* One missing piece, never a failed split. */
    expect(pieces).toHaveLength(2);
  });
});
