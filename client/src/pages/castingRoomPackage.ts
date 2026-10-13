/**
 * THE CHARACTER'S PACKAGE AS ONE FILE (#2463).
 *
 * His word, 2026-10-13: *"when downloading the images it should be a package
 * not 5 individual downloads"*. The room's Download used to click one link per
 * picture, so a press left five or more files in the downloads folder and some
 * browsers asked permission for each. One press now saves one .zip named after
 * the character.
 *
 * It is built IN THE BROWSER from the same requests the links made, so the
 * zip adds no server surface: every picture is fetched through
 * `sameOriginDownloadHref` (the stored ones through the authenticated image
 * proxy, the sheet from its own owner-only route), with the session cookie and
 * nothing else. Each file keeps the name it was saved under before — the one
 * the server's `Content-Disposition` gives it, which is the name a browser
 * honoured over the link's own — so the files inside read exactly as they did
 * loose.
 *
 * ALL OR NOTHING. If any one picture cannot be fetched, the whole build
 * throws and nothing is saved: a zip quietly missing the sheet would look like
 * the whole package and be less than it.
 */
import { productFilename } from "@shared/brand";
import { sameOriginDownloadHref } from "@/lib/imageProxy";

export type PackageFile = { url: string; name: string };

/** The one sentence a failed build shows. Nothing was saved, and it says so. */
export const PACKAGE_DOWNLOAD_FAILED =
  "The download couldn't be prepared, so nothing was saved. Try again in a moment.";

/** What the button says while the zip is being put together. */
export const PACKAGE_DOWNLOAD_WORKING = "Preparing…";

/** The files a package holds: the character sheet first (D-104), then every landed view. */
export function packageFiles(
  frames: readonly { url: string; downloadName: string }[],
  castId: string,
): PackageFile[] {
  return [
    // JPEG: the sheet is bounded to the envelope external tools accept.
    { url: `/api/cast/${encodeURIComponent(castId)}/sheet`, name: "character-sheet.jpg" },
    ...frames.map((frame) => ({ url: frame.url, name: productFilename(`${frame.downloadName}.png`) })),
  ];
}

/**
 * The zip's own name: the product's prefix and the character's name, with
 * only the characters a desktop refuses in a filename taken out — an accented
 * name stays accented. A name with nothing left falls back to "character".
 */
export function packageZipFilename(castName: string | null | undefined): string {
  const stem = (castName ?? "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/^[\s.-]+|[\s.-]+$/g, "")
    .slice(0, 80);
  return productFilename(`${stem || "character"}.zip`);
}

/** The filename a `Content-Disposition` header names, if it names one. */
function dispositionFilename(header: string | null): string | null {
  const match = /filename="([^"]+)"/.exec(header ?? "");
  return match?.[1] ?? null;
}

/**
 * Fetch every file and pack them. Throws on the first file that does not come
 * back whole; the caller saves nothing in that case.
 */
export async function buildPackageZip(
  files: readonly PackageFile[],
  pageOrigin: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ bytes: Uint8Array; names: string[] }> {
  const fetched = await Promise.all(files.map(async (file) => {
    const response = await fetchImpl(sameOriginDownloadHref(file.url, pageOrigin, file.name), {
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error(`package file ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0) throw new Error("package file empty");
    return { name: dispositionFilename(response.headers.get("content-disposition")) ?? file.name, bytes };
  }));

  /* Loaded on the press, never on first paint: the archive library is ~30 kB
     gzipped and this page sits in the entry chunk (bundle budget, preflight). */
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const taken = new Set<string>();
  const names: string[] = [];
  for (const { name, bytes } of fetched) {
    // Two files can never overwrite each other inside the archive.
    let unique = name;
    for (let n = 2; taken.has(unique); n++) unique = name.replace(/(\.[^.]+)?$/, `-${n}$1`);
    taken.add(unique);
    names.push(unique);
    zip.file(unique, bytes);
  }
  // Pictures are already compressed; storing them is as small and much faster.
  return { bytes: await zip.generateAsync({ type: "uint8array", compression: "STORE" }), names };
}
