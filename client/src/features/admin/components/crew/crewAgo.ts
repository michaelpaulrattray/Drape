/**
 * "14 min ago" — one relative-time reader for the whole Desk (#1193).
 *
 * It lived privately inside `CrewBackgroundWork.tsx`; the live page stamps
 * four more blocks with the same sentence, and five copies of one rule is
 * the drift working law 4 is about. Seconds are drawn under a minute because
 * the live read is thirty seconds old at most, and "just now" for half a
 * minute reads as a page that has stopped.
 */
export function ago(value: Date | string, now: number): string {
  const then = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(then)) return "unknown";
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}
