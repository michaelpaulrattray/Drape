/**
 * When THIS browser last opened the Desk (#1193) — read once on mount, then
 * overwritten with now, so the value the page compares against is the
 * previous visit and never this one.
 *
 * `localStorage`, deliberately: "where was he" is a fact about one viewer on
 * one machine, not about the product, and it must never reach the server or
 * another admin. Every read and write is wrapped, because a private window
 * or cleared site data makes the accessor throw, and the page must render
 * exactly the same with no memory — nothing marked, everything listed.
 */
import { useState } from "react";

export const LAST_SEEN_KEY = "drape_crew_last_seen";

export function readLastSeen(storage: Pick<Storage, "getItem"> | null): number | null {
  try {
    const raw = storage?.getItem(LAST_SEEN_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function useLastSeen(): number | null {
  const [lastSeen] = useState<number | null>(() => {
    let storage: Storage | null = null;
    try {
      storage = typeof window === "undefined" ? null : window.localStorage;
    } catch {
      storage = null;
    }
    const previous = readLastSeen(storage);
    try {
      storage?.setItem(LAST_SEEN_KEY, String(Date.now()));
    } catch {
      /* no memory — the page renders unmarked, which is the honest state */
    }
    return previous;
  });
  return lastSeen;
}
