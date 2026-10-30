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
