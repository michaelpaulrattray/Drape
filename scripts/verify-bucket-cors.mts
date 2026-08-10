/**
 * DOES THE BROWSER ACTUALLY ACCEPT THE BUCKET'S PIXELS? — driven, both ways.
 *
 * The founder applied a CORS policy to both image buckets by hand (fable-176),
 * which is what would let the panel and the face chart read stencils directly
 * instead of through `/api/image-proxy`. Before any path drops the proxy, this
 * has to be VERIFIED rather than assumed, and the reason is the whole point:
 *
 *   **A CORS misfire is silent.** No error dialog, no failed request — the image
 *   loads, paints, looks perfect, and the canvas is quietly *tainted*, so the
 *   first thing that reads a pixel throws. That is the CSS-blank-panel lesson in
 *   a new costume: every test green, every surface empty.
 *
 * So the probe is not "did the request succeed". It is **`getImageData` on a
 * canvas the image was drawn into** — the exact operation a stencil composite
 * performs, and the only one that can tell an untainted canvas from a tainted
 * one.
 *
 * # It has a negative control, and the control is the point
 *
 * A checker that only ever runs against the allowed origin cannot fail. So the
 * same page is served twice, on two ports:
 *
 *   http://localhost:3000   ON the bucket's allow-list   must SUCCEED
 *   http://localhost:4321   NOT on it                    must be REFUSED
 *
 * If the negative control passes, the bucket is open to every origin and the
 * policy is not doing what it says — which is a finding, not a pass. If the
 * positive fails, the proxy stays. Either way the answer is read off a browser
 * rather than off a header.
 *
 * Run: `npx tsx scripts/verify-bucket-cors.mts`
 * Needs Edge or Chrome installed; drives it headless via puppeteer-core.
 */
import { createServer, type Server } from "node:http";

import puppeteer from "puppeteer-core";

const BUCKET = process.env.R2_PUBLIC_URL ?? "https://pub-7624aa691e414b0889b42bd217b79ec5.r2.dev";
/** A real object, small, and one the app itself reads. */
const OBJECT = `${BUCKET}/assets/hair-texture.png`;

const ALLOWED_PORT = 3000;
const FOREIGN_PORT = 4321;

const PAGE = `<!doctype html><meta charset="utf-8"><title>cors probe</title>`;

/** The probe, run inside the page so the browser's own origin governs it. */
const probe = async (url: string) => {
  const result: Record<string, unknown> = { origin: window.location.origin };
  try {
    const response = await fetch(url, { mode: "cors" });
    result.fetchOk = response.ok;
    result.allowOrigin = response.headers.get("access-control-allow-origin");
  } catch (error) {
    result.fetchError = String(error).slice(0, 120);
  }

  /*
    THE ONE THAT MATTERS. A tainted canvas draws perfectly and throws only when
    somebody reads it, which is why "the image loaded" is not the question.
  */
  await new Promise<void>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      result.loaded = true;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d")!;
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, 1, 1).data;
        result.readPixels = true;
        result.firstPixel = [pixels[0], pixels[1], pixels[2], pixels[3]];
      } catch (error) {
        result.readPixels = false;
        result.taintError = String(error).slice(0, 120);
      }
      resolve();
    };
    image.onerror = () => { result.loaded = false; resolve(); };
    image.src = url;
  });
  return result;
};

function serve(port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(PAGE);
    });
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

const EDGE_CANDIDATES = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
];

async function main() {
  const { existsSync } = await import("node:fs");
  const executablePath = EDGE_CANDIDATES.find((path) => existsSync(path));
  if (!executablePath) throw new Error("no Edge or Chrome found — this check needs a real browser");

  const servers = await Promise.all([serve(ALLOWED_PORT), serve(FOREIGN_PORT)]);
  const browser = await puppeteer.launch({ executablePath, headless: true });

  try {
    console.log(`object   ${OBJECT}\n`);
    const rows: { label: string; port: number; expect: "succeed" | "refused" }[] = [
      { label: "ON the allow-list", port: ALLOWED_PORT, expect: "succeed" },
      { label: "NOT on it (control)", port: FOREIGN_PORT, expect: "refused" },
    ];

    let failures = 0;
    for (const row of rows) {
      const page = await browser.newPage();
      await page.goto(`http://localhost:${row.port}/`, { waitUntil: "domcontentloaded" });
      const result = await page.evaluate(probe, OBJECT) as Record<string, unknown>;
      await page.close();

      const readable = result.readPixels === true;
      const passed = row.expect === "succeed" ? readable : !readable;
      if (!passed) failures += 1;
      console.log(`${passed ? "PASS" : "FAIL"}  ${row.label.padEnd(22)} origin ${result.origin}`);
      console.log(`      allow-origin header   ${result.allowOrigin ?? "(none)"}`);
      console.log(`      image loaded          ${result.loaded}`);
      console.log(`      pixels readable       ${result.readPixels}${result.taintError ? `  — ${result.taintError}` : ""}`);
      if (result.firstPixel) console.log(`      first pixel           ${JSON.stringify(result.firstPixel)}`);
      console.log();
    }

    if (failures > 0) {
      console.log(
        failures === 2
          ? "BOTH ARMS FAILED — the object or the browser is the problem, not the policy."
          : "A CHECK FAILED. If the control passed, the bucket answers every origin and the\n"
            + "policy is not doing what it says. If the allowed arm failed, the proxy stays.",
      );
      process.exitCode = 1;
    } else {
      console.log("The policy holds in a real browser, in both directions.");
    }
  } finally {
    await browser.close();
    for (const server of servers) server.close();
  }
}

/* A script exits when its work is done — a browser and two servers leave the
   loop alive, and so does anything else this ever grows to hold. The exit moved
   out of the `finally` and onto the call so that BOTH arms are visible in one
   statement: the happy one carries the verdict `main` recorded, and a throw
   before the `try` (a browser that will not launch) still ends the process. */
main().then(
  () => process.exit(process.exitCode ?? 0),
  (error) => {
    console.error("[cors] failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
