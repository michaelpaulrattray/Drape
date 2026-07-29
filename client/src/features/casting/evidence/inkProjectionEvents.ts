import type { CanonicalViewAngle } from "@shared/boardTypes";

const REQUEST_INK_PROJECTION = "casting-request-ink-projection";

export function requestInkProjection(angle: CanonicalViewAngle): void {
  window.dispatchEvent(new CustomEvent(REQUEST_INK_PROJECTION, {
    detail: { angle },
  }));
}

export function subscribeInkProjectionRequests(
  listener: (angle: CanonicalViewAngle) => void,
): () => void {
  const handle = (event: Event) => {
    const angle = (
      event as CustomEvent<{ angle?: CanonicalViewAngle }>
    ).detail?.angle;
    if (angle) listener(angle);
  };
  window.addEventListener(REQUEST_INK_PROJECTION, handle);
  return () => window.removeEventListener(REQUEST_INK_PROJECTION, handle);
}
