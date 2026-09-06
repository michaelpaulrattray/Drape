/**
 * FETCH A PICTURE, OR SAY WHAT YOU GOT INSTEAD — never both quietly.
 *
 * # The mistake this exists to make impossible
 *
 * The glasses sweep fetched each candidate's master from the public bucket,
 * checked `response.ok`, and handed the body to the segmenter with
 * `absentIsAnswer: true`. Every key came back **HTTP 200 carrying the app's own
 * HTML index** — and a 200 passes `response.ok`. The reading failed, the
 * caller's `.catch(() => null)` turned the failure into a coverage of zero, and
 * zero coverage means *this face wears no glasses*. Thirty faces were reported
 * bare on the strength of thirty error pages, and the report read clean.
 *
 * Nothing threw. Nothing was down. The instrument completed on a document.
 *
 * # The rule
 *
 *   > An instrument that can complete with nothing must fail on nothing —
 *   > and bytes may only answer a question about pictures if they are
 *   > provably a picture.
 *
 * Magic bytes rather than the `content-type` header: the header is the server's
 * claim, the bytes are the fact. (In this specimen the header was honest —
 * `text/html` — and nobody read it, which is the other half of the argument for
 * checking the thing you are about to use rather than the thing beside it.)
 *
 * `supportedImageMime` is the product's own sniffer, imported rather than
 * re-implemented, so a script and the server never disagree about what an image
 * is.
 *
 *   npx tsx scripts/lib/imageBytes.mts --prove   # drives both controls
 */
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { assertImageBytes, supportedImageMime } from "../../server/security/trustedImageFetch";

export type FetchedImage = {
  bytes: Buffer;
  mime: NonNullable<ReturnType<typeof supportedImageMime>>;
  /** The URL it came from, so a caller printing a table need not carry it. */
  url: string;
};

/**
 * The one way these scripts should read an image off a URL.
 *
 * It throws rather than returning null on every failure, including a 404 — a
 * script that wants "absent is fine" must say so at its own call site, in
 * sight of the reader, rather than inheriting it from a helper.
 */
export async function fetchImageBytes(url: string): Promise<FetchedImage> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} — HTTP ${response.status} ${response.statusText}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const declared = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "none";
  const mime = assertImageBytes(bytes, `fetched ${url} (server said ${declared})`);
  return { bytes, mime, url };
}

/* ---------------------------------------------------------------- controls */

/*
  ITS CONTROLS RUN ONLY WHEN THIS FILE IS THE ONE THAT WAS INVOKED (#345, the
  class sweep behind PR #587's reviewer finding 2).

  A module-scope argv read is the IMPORTER's argv. So `npx tsx
  scripts/drive-self-walk.mts --prove --spend` ran THIS module's self-controls
  and exited before the driver's own strict parse ever saw the unknown word -
  the driver neither walked nor refused. One word bypassing a refusal, which is
  the class the strict parse exists to close. Five modules in `scripts/lib`
  carried it; `server/spendingScriptArguments.test.ts` now pins all five.
*/
const invokedDirectly = process.argv[1] !== undefined
  && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly && process.argv.includes("--prove")) {
  const realFetch = globalThis.fetch;
  const cases: { name: string; body: BodyInit; status: number; type: string; expect: "pass" | "refuse" }[] = [
    {
      name: "POSITIVE — the real mistake: 200 carrying the app's HTML index",
      body: '<!DOCTYPE html>\n<html lang="en"><head><title>Drape</title></head>',
      status: 200,
      type: "text/html",
      expect: "refuse",
    },
    {
      name: "POSITIVE — a 200 carrying nothing at all",
      body: "",
      status: 200,
      type: "application/octet-stream",
      expect: "refuse",
    },
    {
      name: "POSITIVE — an honest 404",
      body: "not found",
      status: 404,
      type: "text/plain",
      expect: "refuse",
    },
    {
      name: "POSITIVE — a lying header: text/html over real PNG bytes still passes (bytes rule)",
      body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"),
      status: 200,
      type: "text/html",
      expect: "pass",
    },
    {
      name: "NEGATIVE — a real PNG, served as one",
      body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"),
      status: 200,
      type: "image/png",
      expect: "pass",
    },
  ];

  let failures = 0;
  for (const testCase of cases) {
    globalThis.fetch = (async () => new Response(testCase.body, {
      status: testCase.status,
      headers: { "content-type": testCase.type },
    })) as typeof fetch;
    let outcome: "pass" | "refuse" = "pass";
    let detail = "";
    try {
      const image = await fetchImageBytes("https://pub-example.r2.dev/casting/head.png");
      detail = image.mime;
    } catch (error) {
      outcome = "refuse";
      detail = (error as Error).message.slice(0, 110);
    }
    const ok = outcome === testCase.expect;
    if (!ok) failures += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${testCase.name}\n        → ${outcome}: ${detail}`);
  }
  globalThis.fetch = realFetch;

  console.log(failures === 0
    ? "\nThe guard refuses the error page that once answered \"no glasses\", and lets real pictures through."
    : `\n${failures} control(s) failed — the guard is not trustworthy.`);
  process.exit(failures === 0 ? 0 : 1);
}
