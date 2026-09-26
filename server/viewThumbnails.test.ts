/**
 * THE SMALL COPY OF A SIGNED VIEW — its derivation, its mint and its sweep (#1389).
 *
 * The thing most worth driving here is not any one function: it is that the
 * CLIENT and the SERVER cannot answer differently. The server derives a storage
 * KEY and the browser derives a URL, from the same suffix, and a second copy of
 * that suffix in either place is the mirror working law 4 is about. The first
 * arm below is that cross-reading; everything after it is the behaviour.
 */
import { describe, expect, it, vi } from "vitest";
import {
  VIEW_THUMBNAIL_SUFFIX,
  VIEW_THUMBNAIL_WIDTH,
  isViewThumbnailBearingKey,
  withViewThumbnailSuffix,
} from "../shared/viewThumbnails";
import { mintViewThumbnail } from "./castingV2/viewThumbnailMint";

const VIEW_KEY = "casting-v2/casts/op-7/views/2f1c9e4a-0000-4000-8000-abcdef012345.png";
/* The shape read off the dev fixture on 2026-09-26 — a signed cast's six
   assets are five under `views/` and the headshot under `anchor/`. */
const ANCHOR_KEY = "casting-v2/casts/op-7/anchor/1c5efec2-aea4-45c9-98dc-0caac8cec1a6.png";

/* A stand-in for `storagePublicUrl` — the one thing it does that matters here
   is percent-encode each path segment, and the suffix must survive that. */
function publicUrl(key: string): string {
  return `https://pub-x.r2.dev/${key.split("/").map(encodeURIComponent).join("/")}`;
}

describe("the client and the server derive the same object", () => {
  it("gives the same answer whether the suffix is added before or after the URL is built", () => {
    /* The server's road: derive the key, then publish it. */
    const serverAnswer = publicUrl(withViewThumbnailSuffix(VIEW_KEY));
    /* The browser's road: it only ever has the published URL. */
    const clientAnswer = withViewThumbnailSuffix(publicUrl(VIEW_KEY));
    expect(clientAnswer).toBe(serverAnswer);
  });

  it("refuses to stack, so a sweep cannot walk off into x.thumb.jpg.thumb.jpg", () => {
    const once = withViewThumbnailSuffix(VIEW_KEY);
    expect(withViewThumbnailSuffix(once)).toBe(once);
    expect(once.endsWith(VIEW_THUMBNAIL_SUFFIX)).toBe(true);
  });
});

describe("which keys carry a small copy", () => {
  it("says yes to a signed view", () => {
    expect(isViewThumbnailBearingKey(VIEW_KEY)).toBe(true);
    expect(isViewThumbnailBearingKey(`/${VIEW_KEY}`)).toBe(true);
  });

  /*
    ⚠ THE ARM THE FIRST SHAPE OF THIS RULE WOULD HAVE FAILED, and it was found
    by opening a real signed cast rather than by reading the code. The strip's
    FIRST tile is `frontClose`, and that object is not a rendered view: a cast's
    headshot is a byte-exact copy of the signed candidate and lands under
    `anchor/`. A predicate written from the rendered views alone left the tile
    he looks at most on the 19 MB file, with every other arm here still green.
  */
  it("says yes to the anchor, which is the headshot tile and not under views/", () => {
    expect(isViewThumbnailBearingKey(ANCHOR_KEY)).toBe(true);
  });

  /*
    The NEGATIVE half is the one that keeps the sweep narrow. A blanket rule
    would make every deletion in the product issue a second request for an
    object that does not exist — including the cleanup worker's bulk sweeps.
  */
  it.each([
    ["its own derivative, so nothing recurses", withViewThumbnailSuffix(VIEW_KEY)],
    ["a garment", "wardrobe/garments/abc.png"],
    ["an avatar", "avatars/9/abc.png"],
    ["a candidate, which is not a signed view", "casting-v2/rolls/op-7/candidates/abc.png"],
    ["a cast object outside the views folder", "casting-v2/casts/op-7/sheet/abc.png"],
    ["a deeper path under views", "casting-v2/casts/op-7/views/nested/abc.png"],
  ])("says no to %s", (_why, key) => {
    expect(isViewThumbnailBearingKey(key)).toBe(false);
  });
});

describe("minting the small copy", () => {
  it("writes a JPEG at the derived key and nowhere else", async () => {
    const put = vi.fn().mockResolvedValue({ key: "k", url: "u" });
    await mintViewThumbnail(VIEW_KEY, Buffer.alloc(500_000), {
      put,
      shrink: async () => Buffer.alloc(9_000),
    });
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][0]).toBe(`${VIEW_KEY}${VIEW_THUMBNAIL_SUFFIX}`);
    expect(put.mock.calls[0][2]).toBe("image/jpeg");
  });

  it("mints the anchor's small copy too, at its own derived key", async () => {
    const put = vi.fn().mockResolvedValue({ key: "k", url: "u" });
    await mintViewThumbnail(ANCHOR_KEY, Buffer.alloc(500_000), {
      put,
      shrink: async () => Buffer.alloc(9_000),
    });
    expect(put.mock.calls[0][0]).toBe(`${ANCHOR_KEY}${VIEW_THUMBNAIL_SUFFIX}`);
  });

  it("refuses a key outside the views prefix rather than trusting its caller", async () => {
    const put = vi.fn();
    await mintViewThumbnail("wardrobe/garments/abc.png", Buffer.alloc(500_000), {
      put,
      shrink: async () => Buffer.alloc(9_000),
    });
    expect(put).not.toHaveBeenCalled();
  });

  /*
    ⚠ THE TWO ARMS THIS MODULE EXISTS FOR. A view costs the customer credits and
    40-120 seconds; a thumbnail is a convenience built from a picture that
    already exists. Neither failure may reach the caller.
  */
  it("swallows a shrink that throws", async () => {
    const put = vi.fn();
    await expect(
      mintViewThumbnail(VIEW_KEY, Buffer.alloc(500_000), {
        put,
        shrink: async () => { throw new Error("sharp refused these bytes"); },
      }),
    ).resolves.toBeUndefined();
    expect(put).not.toHaveBeenCalled();
  });

  it("swallows a bucket that refuses the write", async () => {
    await expect(
      mintViewThumbnail(VIEW_KEY, Buffer.alloc(500_000), {
        put: async () => { throw new Error("the bucket said no"); },
        shrink: async () => Buffer.alloc(9_000),
      }),
    ).resolves.toBeUndefined();
  });

  /*
    A "small" copy larger than its source is the one outcome that turns this fix
    into the defect it was written to remove. It cannot happen for a 4K view at
    288px; the case it guards is a future view minted small.
  */
  it("does not write a copy that is not smaller than its source", async () => {
    const put = vi.fn();
    await mintViewThumbnail(VIEW_KEY, Buffer.alloc(9_000), {
      put,
      shrink: async () => Buffer.alloc(9_000),
    });
    expect(put).not.toHaveBeenCalled();
  });

  /* A positive control on the real encoder: sharp is not mocked here, and a
     288px JPEG of a large picture must actually come back much smaller. */
  it("really does shrink real bytes, with sharp rather than a stand-in", async () => {
    const sharp = (await import("sharp")).default;
    const full = await sharp({
      create: { width: 1696, height: 2528, channels: 3, background: { r: 180, g: 140, b: 120 } },
    }).png().toBuffer();
    const put = vi.fn().mockResolvedValue({ key: "k", url: "u" });
    await mintViewThumbnail(VIEW_KEY, full, { put });
    expect(put).toHaveBeenCalledTimes(1);

    const written: Buffer = put.mock.calls[0][1];
    expect(written.length).toBeLessThan(full.length);
    const meta = await sharp(written).metadata();
    expect(meta.width).toBe(VIEW_THUMBNAIL_WIDTH);
    expect(meta.format).toBe("jpeg");
  });

  it("does not enlarge a view that is already narrower than the target", async () => {
    const sharp = (await import("sharp")).default;
    const tiny = await sharp({
      create: { width: 120, height: 180, channels: 3, background: { r: 10, g: 10, b: 10 } },
    }).png().toBuffer();
    const put = vi.fn().mockResolvedValue({ key: "k", url: "u" });
    await mintViewThumbnail(VIEW_KEY, tiny, { put });
    /* Either it was skipped for not being smaller, or it was written at its own
       width — never blown up to 288. Both are correct; enlarging is not. */
    if (put.mock.calls.length > 0) {
      const meta = await sharp(put.mock.calls[0][1] as Buffer).metadata();
      expect(meta.width).toBeLessThanOrEqual(120);
    }
  });
});
