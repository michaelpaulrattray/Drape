/**
 * Upload new hero images to project S3 storage.
 * Run with: node upload-hero-images.mjs
 */
import fs from "node:fs";
import path from "node:path";

const baseUrl = process.env.BUILT_IN_FORGE_API_URL?.replace(/\/+$/, "");
const apiKey = process.env.BUILT_IN_FORGE_API_KEY;

if (!baseUrl || !apiKey) {
  console.error("Missing BUILT_IN_FORGE_API_URL or BUILT_IN_FORGE_API_KEY in .env");
  process.exit(1);
}

async function uploadFile(localPath, s3Key) {
  const data = fs.readFileSync(localPath);
  const url = new URL("v1/storage/upload", baseUrl + "/");
  url.searchParams.set("path", s3Key);

  const blob = new Blob([data], { type: "image/png" });
  const form = new FormData();
  form.append("file", blob, path.basename(s3Key));

  console.log(`Uploading ${localPath} → ${s3Key}...`);
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const msg = await response.text().catch(() => response.statusText);
    throw new Error(`Upload failed (${response.status}): ${msg}`);
  }

  const result = await response.json();
  console.log(`  ✓ Uploaded: ${result.url}`);
  return result.url;
}

const files = [
  { local: "/home/ubuntu/upload/poweredby_v2/1.png", key: "hero/hero-base-v2.png" },
  { local: "/home/ubuntu/upload/poweredby_v2/2.png", key: "hero/hero-styled-v2.png" },
  { local: "/home/ubuntu/upload/poweredby_v2/depth.png", key: "hero/hero-depth-v2-blurred.png" },
];

for (const f of files) {
  await uploadFile(f.local, f.key);
}

console.log("\nAll hero images uploaded successfully!");
console.log("Update heroProxy.ts HERO_ASSETS to use v2 keys.");
