import { readFileSync } from "fs";

const BASE_URL = process.env.FORGE_URL.replace(/\/+$/, "");
const API_KEY = process.env.FORGE_KEY;

async function upload(filePath, relKey) {
  const data = readFileSync(filePath);
  const blob = new Blob([data], { type: "image/png" });
  const form = new FormData();
  form.append("file", blob, relKey.split("/").pop());

  const url = new URL("v1/storage/upload", BASE_URL + "/");
  url.searchParams.set("path", relKey);

  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: form,
  });

  if (!resp.ok) {
    const msg = await resp.text();
    console.error(`FAIL ${relKey}: ${resp.status} ${msg}`);
    return;
  }
  const json = await resp.json();
  console.log(`OK ${relKey}: ${json.url}`);
}

const files = [
  ["/home/ubuntu/upload/poweredby_v3/3.png", "hero/base-v3.png"],
  ["/home/ubuntu/upload/poweredby_v3/4.png", "hero/styled-v3.png"],
  ["/home/ubuntu/upload/depthmap3.png", "hero/depth-v3.png"],
];

for (const [path, key] of files) {
  await upload(path, key);
}
console.log("All done!");
