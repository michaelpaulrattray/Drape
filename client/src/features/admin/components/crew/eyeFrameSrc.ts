/**
 * The only address eye frames load from — the briefing key's basename on the
 * enumerated `/api/crew/eye-frame/:frameName` route. Its own module because
 * both the gallery (thumbnails) and the viewer (the judging surface) need it,
 * and neither should import the other for a one-liner.
 */
export function eyeFrameSrc(key: string): string {
  return `/api/crew/eye-frame/${key.split("/").pop() ?? ""}`;
}
