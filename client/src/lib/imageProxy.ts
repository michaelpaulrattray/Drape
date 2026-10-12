/**
 * THE SAME-ORIGIN ROAD TO A STORED PICTURE (#2369).
 *
 * Stored pictures sit at public bucket URLs on another origin, and a browser
 * IGNORES the `download` attribute on a cross-origin link: the click becomes an
 * ordinary navigation, so the tab leaves the product for a bare picture and
 * nothing is saved. `/api/image-proxy` (`server/routes/imageProxy.ts`) serves
 * the same bytes from the app's own origin, behind the session, so the
 * attribute is honoured again.
 *
 * One builder, read by every surface that saves or copies a stored picture —
 * the canvas's image actions and the casting downloads alike — so the road is
 * spelled once rather than once per surface.
 */

/**
 * A same-origin proxy URL for a stored picture.
 *
 * `filename` matters whenever `download` is set: the proxy's
 * `Content-Disposition` names the file, and a browser lets that header win over
 * the anchor's `download` attribute (#2407). Without it the saved file is
 * named after its storage key.
 */
export function imageProxyUrl(
  originalUrl: string,
  options: { download?: boolean; filename?: string } = {},
): string {
  const params = new URLSearchParams({ url: originalUrl });
  if (options.download) {
    params.set("download", "1");
    if (options.filename) params.set("filename", options.filename);
  }
  return `/api/image-proxy?${params.toString()}`;
}

/**
 * The href a download link should carry so a press SAVES the file and the tab
 * stays where it is.
 *
 * A URL already on the page's own origin (the character sheet's route) is left
 * as it is — it is not a stored picture and the proxy would refuse it. Anything
 * on another origin goes through the proxy, carrying the name to save it under.
 */
export function sameOriginDownloadHref(url: string, pageOrigin: string, filename: string): string {
  let resolved: URL;
  try {
    resolved = new URL(url, pageOrigin);
  } catch {
    return url;
  }
  if (resolved.origin === new URL(pageOrigin).origin) return url;
  return imageProxyUrl(url, { download: true, filename });
}
