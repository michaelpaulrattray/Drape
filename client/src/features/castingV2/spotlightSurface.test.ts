import { describe, expect, it, vi } from "vitest";

import { encodeSpotlightMap, spotlightMapOf } from "../../../../server/castingV2/referenceSpotlightMap";
import type { Mask } from "../../../../server/castingV2/maskedComposite";

import { SPOTLIGHT_NOT_A_FACE, SPOTLIGHT_NOTHING_THERE } from "./referenceSpotlightCopy";
import {
  settleOpen,
  settleTap,
  takenAt,
  withinStall,
  type SpotlightOpenAnswer,
  type TakenPiece,
} from "./spotlightSurface";

const W = 30;
const H = 40;

/** A real map from the server's real encoder: piece 1 on the left half, piece 2 on the right. */
async function realMap(width = W, height = H): Promise<string> {
  const left: Mask = { width, height, data: Buffer.alloc(width * height) };
  const right: Mask = { width, height, data: Buffer.alloc(width * height) };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) (x < width / 2 ? left : right).data[y * width + x] = 255;
  }
  return (await encodeSpotlightMap(spotlightMapOf([left, right]))).bytes.toString("base64");
}

/** A real one-piece cut over a rectangle, the shape a tap answers with. */
async function realCut(width = W, height = H): Promise<string> {
  const cut: Mask = { width, height, data: Buffer.alloc(width * height) };
  for (let y = 10; y < 20; y += 1) for (let x = 5; x < 12; x += 1) cut.data[y * width + x] = 255;
  return (await encodeSpotlightMap(spotlightMapOf([cut]))).bytes.toString("base64");
}

const onScreen = { width: W * 10, height: H * 10 };

describe("an opened picture lights only when everything about it agrees — otherwise it is the plain attach", () => {
  it("lights a good answer", async () => {
    const answer: SpotlightOpenAnswer = { lit: true, map: await realMap(), width: W, height: H, pieces: 2 };
    const view = await settleOpen(answer, onScreen);
    expect(view.state).toBe("lit");
    if (view.state !== "lit") return;
    expect(view.map.width).toBe(W);
    expect(view.map.indices[0]).toBe(1);
    expect(view.map.indices[W - 1]).toBe(2);
  });

  it("is unlit when the server says the picture will not light", async () => {
    expect((await settleOpen({ lit: false, why: "empty-split" }, onScreen)).state).toBe("unlit");
    /* The server's `no` is final even beside a map — measured: without this
       case the arm above was green with the `lit` check deleted, because the
       missing piece count refused the answer for it. */
    const contradictory = {
      lit: false, why: "no-faces-read", map: await realMap(), width: W, height: H, pieces: 2,
    } as unknown as SpotlightOpenAnswer;
    expect((await settleOpen(contradictory, onScreen)).state).toBe("unlit");
  });

  it("is unlit when the call threw or stalled", async () => {
    expect((await settleOpen(null, onScreen)).state).toBe("unlit");
  });

  it("is unlit when the picture never decoded in this browser", async () => {
    const answer: SpotlightOpenAnswer = { lit: true, map: await realMap(), width: W, height: H, pieces: 2 };
    expect((await settleOpen(answer, null)).state).toBe("unlit");
  });

  it("is unlit when nothing is left to light", async () => {
    const answer: SpotlightOpenAnswer = { lit: true, map: await realMap(), width: W, height: H, pieces: 0 };
    expect((await settleOpen(answer, onScreen)).state).toBe("unlit");
  });

  it("is unlit when the map will not decode", async () => {
    const answer: SpotlightOpenAnswer = { lit: true, map: btoa("not a png"), width: W, height: H, pieces: 2 };
    expect((await settleOpen(answer, onScreen)).state).toBe("unlit");
  });

  it("is unlit when the answer's size and its bytes disagree", async () => {
    const answer: SpotlightOpenAnswer = { lit: true, map: await realMap(), width: W + 2, height: H, pieces: 2 };
    expect((await settleOpen(answer, onScreen)).state).toBe("unlit");
  });

  it("is unlit when the map describes a turned picture — it would light the wrong place", async () => {
    const answer: SpotlightOpenAnswer = { lit: true, map: await realMap(), width: W, height: H, pieces: 2 };
    expect((await settleOpen(answer, { width: H * 10, height: W * 10 })).state).toBe("unlit");
  });
});

describe("a tap becomes a chip or a sentence, and never shows the road's machinery", () => {
  it("takes a good cut with its own name", async () => {
    const settled = await settleTap({
      took: true,
      cut: await realCut(),
      width: W,
      height: H,
      bounds: { x: 5, y: 10, width: 7, height: 10 },
      name: " leather jacket ",
    }, { width: W, height: H });
    expect(settled.ok).toBe(true);
    if (!settled.ok) return;
    expect(settled.taken.name).toBe("leather jacket");
    expect(settled.taken.cut.indices[15 * W + 6]).toBe(1);
    expect(settled.taken.cut.indices[0]).toBe(0);
  });

  it("keeps a missing name missing rather than guessing one", async () => {
    for (const name of [null, "", "   "]) {
      const settled = await settleTap({
        took: true,
        cut: await realCut(),
        width: W,
        height: H,
        bounds: { x: 5, y: 10, width: 7, height: 10 },
        name,
      }, { width: W, height: H });
      expect(settled.ok && settled.taken.name).toBeNull();
    }
  });

  it("says the face sentence for a face, and the design's sentence for everything else", async () => {
    expect(await settleTap({ took: false, why: "only-a-face-was-under-the-tap" }, { width: W, height: H }))
      .toEqual({ ok: false, note: SPOTLIGHT_NOT_A_FACE });
    for (const why of ["nothing-under-the-tap", "cut-refused:no-pixels", "no-faces-read", "no-reader", "cut-not-encoded"]) {
      expect(await settleTap({ took: false, why }, { width: W, height: H }))
        .toEqual({ ok: false, note: SPOTLIGHT_NOTHING_THERE });
    }
  });

  it("refuses a cut drawn at another size — it would light the wrong place", async () => {
    const settled = await settleTap({
      took: true,
      cut: await realCut(W, H + 4),
      width: W,
      height: H + 4,
      bounds: { x: 5, y: 10, width: 7, height: 10 },
      name: "belt",
    }, { width: W, height: H });
    expect(settled).toEqual({ ok: false, note: SPOTLIGHT_NOTHING_THERE });
  });
});

describe("tap again to let go", () => {
  it("finds the taken piece under a point from its CUT, and nothing elsewhere", async () => {
    const settled = await settleTap({
      took: true,
      cut: await realCut(),
      width: W,
      height: H,
      bounds: { x: 5, y: 10, width: 7, height: 10 },
      name: "earring",
    }, { width: W, height: H });
    if (!settled.ok) throw new Error("the fixture cut did not settle");
    const taken: TakenPiece[] = [{ ...settled.taken, key: "taken-1" }];
    expect(takenAt(taken, { x: 6, y: 15 })?.key).toBe("taken-1");
    expect(takenAt(taken, { x: 25, y: 35 })).toBeNull();
    expect(takenAt(taken, null)).toBeNull();
  });

  it("lets go of a thin ring when the second tap lands in its hole, within reach", () => {
    /* A 9x9 hoop: the outline is the cut, the middle is not. */
    const size = 9;
    const indices = new Uint8Array(size * size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (x === 0 || y === 0 || x === size - 1 || y === size - 1) indices[y * size + x] = 1;
      }
    }
    const hoop: TakenPiece = {
      key: "hoop",
      cut: { indices, width: size, height: size },
      bounds: { x: 0, y: 0, width: size, height: size },
      name: "hoop earring",
    };
    const centre = { x: 4, y: 4 };
    expect(takenAt([hoop], centre)).toBeNull();
    expect(takenAt([hoop], centre, 3)).toBeNull();
    expect(takenAt([hoop], centre, 4)?.key).toBe("hoop");
  });
});

describe("an open that stalls stops being waited on", () => {
  it("answers null past the ceiling, and for a throw", async () => {
    vi.useFakeTimers();
    try {
      const never = new Promise<string>(() => undefined);
      const waiting = withinStall(never, 1000);
      vi.advanceTimersByTime(1001);
      await expect(waiting).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
    await expect(withinStall(Promise.reject(new Error("boom")), 1000)).resolves.toBeNull();
    await expect(withinStall(Promise.resolve("lit"), 1000)).resolves.toBe("lit");
  });
});
