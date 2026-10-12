/*
 * #2378 — THE PROFILE PICTURE AND BANNER ARE MEASURED FROM THE BYTES, NOT FROM
 * WHAT THE BROWSER DECLARES ABOUT THEM.
 *
 * Driven through the REAL `profileRouter` with only the database and the bucket
 * mocked, so every arm reads what the procedure actually did at its two wires:
 * the bytes handed to `storagePut` and the figure handed to the storage meter.
 *
 * Each refusal arm has a positive control beside it — an honest picture on the
 * same procedure that IS stored — so an arm cannot pass by the procedure
 * refusing everything.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db", () => ({
  getUserById: vi.fn(),
  updateUserProfile: vi.fn(),
  getUserStorageInfo: vi.fn(),
  updateUserStorageUsed: vi.fn(),
  markCanvasIntroSeen: vi.fn(),
  markFollowHintSeen: vi.fn(),
}));
vi.mock("../storage", () => ({
  storagePut: vi.fn(),
  storageDelete: vi.fn(),
  storageReadBytes: vi.fn(),
}));

import * as db from "../db";
import * as storage from "../storage";
import { profileRouter, AVATAR_MAX_BYTES, BANNER_MAX_BYTES } from "./profile";

const USER_ID = 7;
const MB = 1024 * 1024;

function caller() {
  return profileRouter.createCaller({
    user: {
      id: USER_ID,
      approved: true,
      suspendedAt: null,
      lockedUntil: null,
      role: "user",
    },
  } as never);
}

/** A buffer of `size` bytes that starts with a real JPEG signature. */
function jpegBytes(size: number): Buffer {
  const b = Buffer.alloc(size, 0x41);
  b[0] = 0xff;
  b[1] = 0xd8;
  b[2] = 0xff;
  return b;
}

function pngBytes(size: number): Buffer {
  const b = Buffer.alloc(size, 0x41);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  return b;
}

const b64 = (b: Buffer) => b.toString("base64");

beforeEach(() => {
  vi.mocked(db.getUserById).mockReset().mockResolvedValue({
    id: USER_ID,
    avatarKey: null,
    bannerKey: null,
  } as never);
  vi.mocked(db.updateUserProfile).mockReset().mockResolvedValue({ success: true } as never);
  vi.mocked(db.getUserStorageInfo)
    .mockReset()
    .mockResolvedValue({ used: 0, limit: 500 * MB } as never);
  vi.mocked(db.updateUserStorageUsed).mockReset().mockResolvedValue({ success: true } as never);
  vi.mocked(storage.storagePut)
    .mockReset()
    .mockResolvedValue({ key: "k", url: "https://bucket.test/k" } as never);
  vi.mocked(storage.storageDelete).mockReset().mockResolvedValue({ success: true } as never);
  vi.mocked(storage.storageReadBytes).mockReset();
});

describe("uploadAvatar — the cap and the meter read the decoded bytes", () => {
  it("POSITIVE: an honest JPEG is stored and the meter is charged its real length, whatever fileSize says", async () => {
    const bytes = jpegBytes(40_000);
    await caller().uploadAvatar({ base64Data: b64(bytes), mimeType: "image/jpeg", fileSize: 1 });

    expect(storage.storagePut).toHaveBeenCalledTimes(1);
    const stored = vi.mocked(storage.storagePut).mock.calls[0][1] as Buffer;
    expect(stored.length).toBe(40_000);
    expect(vi.mocked(storage.storagePut).mock.calls[0][2]).toBe("image/jpeg");
    expect(db.updateUserStorageUsed).toHaveBeenCalledWith(USER_ID, 40_000);
  });

  it("a NEGATIVE declared fileSize no longer lowers the meter", async () => {
    await caller().uploadAvatar({
      base64Data: b64(jpegBytes(3_000)),
      mimeType: "image/jpeg",
      fileSize: -100 * MB,
    });
    expect(db.updateUserStorageUsed).toHaveBeenCalledTimes(1);
    expect(db.updateUserStorageUsed).toHaveBeenCalledWith(USER_ID, 3_000);
  });

  it("still accepts a request with no fileSize at all (the field is ignored, not required)", async () => {
    await caller().uploadAvatar({ base64Data: b64(jpegBytes(900)), mimeType: "image/jpeg" });
    expect(db.updateUserStorageUsed).toHaveBeenCalledWith(USER_ID, 900);
  });

  it("refuses bytes over 5 MB that declare fileSize: 1, at the DECODED check", async () => {
    /* 5 MB + 1 fits inside the base64 string cap (the cap is rounded up to a
       whole base64 quantum), so this arm reaches the decoded-length check
       rather than the string-length one. */
    const bytes = jpegBytes(AVATAR_MAX_BYTES + 1);
    expect(b64(bytes).length).toBeLessThanOrEqual(Math.ceil(AVATAR_MAX_BYTES / 3) * 4);
    await expect(
      caller().uploadAvatar({ base64Data: b64(bytes), mimeType: "image/jpeg", fileSize: 1 }),
    ).rejects.toThrow("That picture is over 5 MB.");
    expect(storage.storagePut).not.toHaveBeenCalled();
    expect(db.updateUserStorageUsed).not.toHaveBeenCalled();
  });

  it("POSITIVE boundary: exactly 5 MB is stored", async () => {
    await caller().uploadAvatar({
      base64Data: b64(jpegBytes(AVATAR_MAX_BYTES)),
      mimeType: "image/jpeg",
      fileSize: 1,
    });
    expect(db.updateUserStorageUsed).toHaveBeenCalledWith(USER_ID, AVATAR_MAX_BYTES);
  });

  it("refuses a body far over the cap before it is decoded (the string cap)", async () => {
    await expect(
      caller().uploadAvatar({
        base64Data: b64(jpegBytes(AVATAR_MAX_BYTES + 3 * 1024)),
        mimeType: "image/jpeg",
        fileSize: 1,
      }),
    ).rejects.toThrow();
    expect(storage.storagePut).not.toHaveBeenCalled();
  });

  it("checks the storage limit against the real bytes, not the declared figure", async () => {
    vi.mocked(db.getUserStorageInfo).mockResolvedValue({ used: 500 * MB - 1_000, limit: 500 * MB } as never);
    await expect(
      caller().uploadAvatar({ base64Data: b64(jpegBytes(2_000)), mimeType: "image/jpeg", fileSize: 1 }),
    ).rejects.toThrow(/Storage limit exceeded/);
    expect(storage.storagePut).not.toHaveBeenCalled();

    /* positive control: the same account, a picture that does fit */
    await caller().uploadAvatar({ base64Data: b64(jpegBytes(900)), mimeType: "image/jpeg", fileSize: 1 });
    expect(storage.storagePut).toHaveBeenCalledTimes(1);
  });
});

describe("uploadAvatar — the bytes must be the picture they claim to be", () => {
  it("refuses bytes that are not an image at all", async () => {
    const html = Buffer.from("<html><script>alert(1)</script></html>!!");
    await expect(
      caller().uploadAvatar({ base64Data: b64(html), mimeType: "image/png", fileSize: 1 }),
    ).rejects.toThrow("That file is not a JPG, PNG or WebP picture.");
    expect(storage.storagePut).not.toHaveBeenCalled();
  });

  it("refuses a real image whose bytes are a different type than declared", async () => {
    await expect(
      caller().uploadAvatar({ base64Data: b64(pngBytes(500)), mimeType: "image/jpeg" }),
    ).rejects.toThrow("That file is not a JPG, PNG or WebP picture.");
    expect(storage.storagePut).not.toHaveBeenCalled();

    /* positive control: the same bytes declared truthfully */
    await caller().uploadAvatar({ base64Data: b64(pngBytes(500)), mimeType: "image/png" });
    expect(vi.mocked(storage.storagePut).mock.calls[0][2]).toBe("image/png");
  });

  it("refuses base64 the decoder would have to guess at (non-canonical)", async () => {
    const good = b64(jpegBytes(300));
    /* Passes the alphabet and the length-of-4 checks but carries non-zero
       unused bits before its padding, so only the round trip can catch it. */
    const padded = b64(jpegBytes(301));
    expect(padded.endsWith("==")).toBe(true);
    const lastData = padded[padded.length - 3];
    const nonCanonical = `${padded.slice(0, -3)}${lastData === "B" ? "C" : "B"}==`;
    expect(Buffer.from(nonCanonical, "base64").toString("base64")).not.toBe(nonCanonical);
    for (const bad of [nonCanonical,`${good.slice(0, 40)} ${good.slice(40)}`, `${good}A`, `${good.slice(0, -4)}!!!!`, ""]) {
      await expect(
        caller().uploadAvatar({ base64Data: bad, mimeType: "image/jpeg" }),
      ).rejects.toThrow("That file is not a JPG, PNG or WebP picture.");
    }
    expect(storage.storagePut).not.toHaveBeenCalled();
  });

  it("refuses an undeclared field (strict input), while fileSize stays accepted", async () => {
    await expect(
      caller().uploadAvatar({
        base64Data: b64(jpegBytes(300)),
        mimeType: "image/jpeg",
        fileSize: 300,
        userId: 99,
      } as never),
    ).rejects.toThrow();
    expect(storage.storagePut).not.toHaveBeenCalled();
  });
});

describe("replacing a picture gives back the old one's REAL size", () => {
  it("avatar: subtracts the old object's measured length, not a flat 100 KB", async () => {
    vi.mocked(db.getUserById).mockResolvedValue({ id: USER_ID, avatarKey: "avatars/7/old.jpg" } as never);
    vi.mocked(storage.storageReadBytes).mockResolvedValue({ bytes: Buffer.alloc(12_345), contentType: "image/jpeg" });

    await caller().uploadAvatar({ base64Data: b64(jpegBytes(4_000)), mimeType: "image/jpeg", fileSize: 1 });

    expect(storage.storageReadBytes).toHaveBeenCalledWith("avatars/7/old.jpg");
    expect(storage.storageDelete).toHaveBeenCalledWith("avatars/7/old.jpg");
    expect(vi.mocked(db.updateUserStorageUsed).mock.calls).toEqual([
      [USER_ID, 4_000],
      [USER_ID, -12_345],
    ]);
  });

  it("avatar: a failed size read subtracts nothing and still deletes", async () => {
    vi.mocked(db.getUserById).mockResolvedValue({ id: USER_ID, avatarKey: "avatars/7/old.jpg" } as never);
    vi.mocked(storage.storageReadBytes).mockRejectedValue(new Error("gone"));

    await caller().uploadAvatar({ base64Data: b64(jpegBytes(4_000)), mimeType: "image/jpeg" });

    expect(storage.storageDelete).toHaveBeenCalledWith("avatars/7/old.jpg");
    expect(vi.mocked(db.updateUserStorageUsed).mock.calls).toEqual([[USER_ID, 4_000]]);
  });

  it("banner: subtracts the old object's measured length, not a flat 500 KB", async () => {
    vi.mocked(db.getUserById).mockResolvedValue({ id: USER_ID, bannerKey: "banners/7/old.webp" } as never);
    vi.mocked(storage.storageReadBytes).mockResolvedValue({ bytes: Buffer.alloc(77_777), contentType: "image/webp" });

    await caller().uploadBanner({ base64Data: b64(jpegBytes(6_000)), mimeType: "image/jpeg", fileSize: 1 });

    expect(storage.storageDelete).toHaveBeenCalledWith("banners/7/old.webp");
    expect(vi.mocked(db.updateUserStorageUsed).mock.calls).toEqual([
      [USER_ID, 6_000],
      [USER_ID, -77_777],
    ]);
  });
});

describe("uploadBanner — the same rules at 10 MB", () => {
  it("POSITIVE: exactly 10 MB is stored and charged its real length", async () => {
    await caller().uploadBanner({
      base64Data: b64(jpegBytes(BANNER_MAX_BYTES)),
      mimeType: "image/jpeg",
      fileSize: 1,
    });
    expect(db.updateUserStorageUsed).toHaveBeenCalledWith(USER_ID, BANNER_MAX_BYTES);
  });

  it("refuses 10 MB + 1 that declares fileSize: 1", async () => {
    await expect(
      caller().uploadBanner({
        base64Data: b64(jpegBytes(BANNER_MAX_BYTES + 1)),
        mimeType: "image/jpeg",
        fileSize: 1,
      }),
    ).rejects.toThrow("That banner is over 10 MB.");
    expect(storage.storagePut).not.toHaveBeenCalled();
  });

  it("refuses bytes that are not an image", async () => {
    await expect(
      caller().uploadBanner({
        base64Data: b64(Buffer.from("just some text, not a picture")),
        mimeType: "image/webp",
        fileSize: 1,
      }),
    ).rejects.toThrow("That file is not a JPG, PNG or WebP picture.");
    expect(storage.storagePut).not.toHaveBeenCalled();
  });

  it("checks the storage limit against the real bytes", async () => {
    vi.mocked(db.getUserStorageInfo).mockResolvedValue({ used: 500 * MB - 1_000, limit: 500 * MB } as never);
    await expect(
      caller().uploadBanner({ base64Data: b64(jpegBytes(2_000)), mimeType: "image/jpeg", fileSize: 1 }),
    ).rejects.toThrow(/Storage limit exceeded/);
    expect(storage.storagePut).not.toHaveBeenCalled();
  });
});
