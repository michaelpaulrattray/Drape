import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";

// Mock dependencies before importing the module
vi.mock("./garmentDetection", () => ({
  detectGarmentsInImage: vi.fn(),
}));

vi.mock("../storage", () => ({
  storagePut: vi.fn(),
}));

vi.mock("./utils", () => ({
  uploadBase64ToS3: vi.fn(),
}));

vi.mock("../logging/logger", () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { decomposeOutfit } from "./outfitDecomposition";
import { detectGarmentsInImage } from "./garmentDetection";
import { storagePut } from "../storage";

const mockDetect = vi.mocked(detectGarmentsInImage);
const mockStoragePut = vi.mocked(storagePut);

/**
 * Create a 200x400 red PNG test image buffer using sharp.
 */
async function createTestImage(width = 200, height = 400): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer();
}

// Mock global fetch to return our test image
const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("decomposeOutfit", () => {
  it("returns empty garments when detection finds nothing", async () => {
    mockDetect.mockResolvedValue([]);

    const result = await decomposeOutfit("https://example.com/outfit.jpg", "user-1");

    expect(result.garments).toHaveLength(0);
    expect(result.sourceImageUrl).toBe("https://example.com/outfit.jpg");
  });

  it("crops each detected garment and uploads to S3 with real cropUrl", async () => {
    const testImage = await createTestImage(200, 400);

    // Mock fetch to return our test image
    globalThis.fetch = vi.fn().mockImplementation((url: string | URL) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr === "https://example.com/outfit.jpg") {
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(testImage.buffer.slice(testImage.byteOffset, testImage.byteOffset + testImage.byteLength)),
        });
      }
      return originalFetch(url);
    }) as typeof fetch;

    mockDetect.mockResolvedValue([
      {
        id: "g1",
        category: "top",
        label: "White T-Shirt",
        confidence: 0.95,
        box_2d: [0.0, 0.1, 0.5, 0.9] as [number, number, number, number],
      },
      {
        id: "g2",
        category: "bottom",
        label: "Blue Jeans",
        confidence: 0.9,
        box_2d: [0.5, 0.1, 1.0, 0.9] as [number, number, number, number],
      },
    ]);

    mockStoragePut.mockImplementation(async (key: string) => ({
      key,
      url: `https://s3.example.com/${key}`,
    }));

    const result = await decomposeOutfit("https://example.com/outfit.jpg", "user-1");

    // Should have 2 garments
    expect(result.garments).toHaveLength(2);

    // Each garment should have a REAL S3 crop URL, not the source image
    for (const garment of result.garments) {
      expect(garment.cropUrl).not.toBe("https://example.com/outfit.jpg");
      expect(garment.cropUrl).toContain("s3.example.com");
      expect(garment.cropUrl).toContain("user-1-wardrobe/decomposed/");
    }

    // storagePut should have been called once per garment
    expect(mockStoragePut).toHaveBeenCalledTimes(2);

    // Verify the uploaded buffers are valid PNGs (not the full source image)
    for (const call of mockStoragePut.mock.calls) {
      const [key, buffer, contentType] = call;
      expect(key).toContain("user-1-wardrobe/decomposed/");
      expect(contentType).toBe("image/png");
      expect(Buffer.isBuffer(buffer)).toBe(true);

      // The crop should be smaller than the source image
      const cropMeta = await sharp(buffer as Buffer).metadata();
      expect(cropMeta.width).toBeLessThan(200);
      expect(cropMeta.height).toBeLessThanOrEqual(400);
      expect(cropMeta.width).toBeGreaterThan(0);
      expect(cropMeta.height).toBeGreaterThan(0);
    }

    // Restore fetch
    globalThis.fetch = originalFetch;
  });

  it("skips garments that fail to crop without failing the whole operation", async () => {
    const testImage = await createTestImage(200, 400);

    globalThis.fetch = vi.fn().mockImplementation((url: string | URL) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr === "https://example.com/outfit.jpg") {
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(testImage.buffer.slice(testImage.byteOffset, testImage.byteOffset + testImage.byteLength)),
        });
      }
      return originalFetch(url);
    }) as typeof fetch;

    mockDetect.mockResolvedValue([
      {
        id: "g1",
        category: "top",
        label: "Good Garment",
        confidence: 0.95,
        box_2d: [0.0, 0.1, 0.5, 0.9] as [number, number, number, number],
      },
      {
        id: "g2",
        category: "bottom",
        label: "Bad Garment",
        confidence: 0.9,
        // Invalid box_2d — ymin > ymax, will produce 0 or negative height
        box_2d: [0.9, 0.1, 0.1, 0.9] as [number, number, number, number],
      },
    ]);

    mockStoragePut.mockImplementation(async (key: string) => ({
      key,
      url: `https://s3.example.com/${key}`,
    }));

    const result = await decomposeOutfit("https://example.com/outfit.jpg", "user-1");

    // Only the valid garment should be in results
    expect(result.garments).toHaveLength(1);
    expect(result.garments[0].label).toBe("Good Garment");

    globalThis.fetch = originalFetch;
  });

  it("produces crops with correct pixel dimensions from normalized box_2d", async () => {
    // 1000x2000 image
    const testImage = await createTestImage(1000, 2000);

    globalThis.fetch = vi.fn().mockImplementation((url: string | URL) => {
      const urlStr = typeof url === "string" ? url : url.toString();
      if (urlStr === "https://example.com/outfit.jpg") {
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(testImage.buffer.slice(testImage.byteOffset, testImage.byteOffset + testImage.byteLength)),
        });
      }
      return originalFetch(url);
    }) as typeof fetch;

    // box_2d: [ymin=0.1, xmin=0.2, ymax=0.6, xmax=0.8]
    // Expected pixel crop: left=200, top=200, width=600, height=1000
    mockDetect.mockResolvedValue([
      {
        id: "g1",
        category: "top",
        label: "Shirt",
        confidence: 0.95,
        box_2d: [0.1, 0.2, 0.6, 0.8] as [number, number, number, number],
      },
    ]);

    mockStoragePut.mockImplementation(async (key: string, buffer: Buffer | Uint8Array | string) => {
      const meta = await sharp(buffer as Buffer).metadata();
      // Verify exact pixel dimensions
      expect(meta.width).toBe(600);   // (0.8 - 0.2) * 1000
      expect(meta.height).toBe(1000); // (0.6 - 0.1) * 2000
      return { key, url: `https://s3.example.com/${key}` };
    });

    await decomposeOutfit("https://example.com/outfit.jpg", "user-1");

    expect(mockStoragePut).toHaveBeenCalledTimes(1);

    globalThis.fetch = originalFetch;
  });
});
