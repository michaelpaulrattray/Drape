/**
 * useImagePreloader — Preloads an array of image URLs into the browser cache.
 *
 * Returns `ready: true` once every URL has been loaded (or failed).
 * Skips empty arrays and null/undefined entries.
 * Re-runs when the URL set changes (compared by sorted join).
 *
 * Used to prevent janky image pop-in when switching between studio tools —
 * gate panel reveals on `ready` so images are already painted when the
 * transition animation fires.
 */
import { useState, useEffect, useRef } from 'react';

export function useImagePreloader(urls: (string | null | undefined)[]): { ready: boolean } {
  const [ready, setReady] = useState(false);
  const prevKeyRef = useRef('');

  // Deduplicate and filter
  const validUrls = Array.from(new Set(urls.filter((u): u is string => !!u)));
  const cacheKey = validUrls.sort().join('|');

  useEffect(() => {
    // No URLs → immediately ready
    if (validUrls.length === 0) {
      setReady(true);
      return;
    }

    // Same set of URLs → keep current state
    if (cacheKey === prevKeyRef.current) return;
    prevKeyRef.current = cacheKey;

    setReady(false);
    let cancelled = false;

    const promises = validUrls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve(); // Don't block on failures
          img.src = url;
        }),
    );

    Promise.all(promises).then(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [cacheKey]);

  return { ready };
}
