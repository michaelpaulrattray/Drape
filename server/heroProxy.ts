/**
 * Proxy hero textures through our server to avoid CORS issues with CloudFront.
 * Serves cached S3 URLs at /api/hero/:asset with proper CORS headers.
 */
import { Router, type Request, type Response } from "express";
import { storageGet } from "./storage";

const router = Router();

const HERO_ASSETS: Record<string, string> = {
  base: "hero/hero-base-v1.png",
  styled: "hero/hero-styled-v1.png",
  depth: "hero/hero-depth-v1.png",
};

// Cache fetched images in memory (they're static assets, ~2MB each)
const imageCache = new Map<string, { buffer: Buffer; contentType: string }>();

router.get("/api/hero/:asset", async (req: Request, res: Response) => {
  const assetKey = req.params.asset;
  const s3Key = HERO_ASSETS[assetKey];

  if (!s3Key) {
    res.status(404).json({ error: "Unknown asset" });
    return;
  }

  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=86400, immutable");

  // Serve from memory cache if available
  const cached = imageCache.get(assetKey);
  if (cached) {
    res.setHeader("Content-Type", cached.contentType);
    res.send(cached.buffer);
    return;
  }

  try {
    const { url } = await storageGet(s3Key);
    const response = await fetch(url);

    if (!response.ok) {
      res.status(502).json({ error: "Failed to fetch from storage" });
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/png";

    // Cache in memory
    imageCache.set(assetKey, { buffer, contentType });

    res.setHeader("Content-Type", contentType);
    res.send(buffer);
  } catch (err: any) {
    console.error(`[Hero Proxy] Error fetching ${assetKey}:`, err.message);
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
