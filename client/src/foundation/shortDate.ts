/**
 * A date he can read at a glance. Never a relative "2 hours ago" — a ruling's
 * date is a fact and relative time makes it a moving one.
 *
 * ⚠ **24-HOUR, FORCED — AND THIS IS THE SECOND INSTANCE OF A CLASS THE PAGE
 * HAD ALREADY RULED ON.** `CrewWorkingNow`'s `clockTime` carries the ruling in
 * its own docblock: *"the locale default here is `03:48 pm` … every other time
 * in his world is 24-hour — the runner's close-stamps, the shift rows, his own
 * #295 report quoting `19:46` and `20:17` — so the one clock he would be
 * comparing against was the one written differently."*
 *
 * That fix reached one of the three formatters on the Crew page. This one and
 * `CrewNextUp`'s `readStamp` were its siblings and were missed, so his own
 * confirming quote read *"— you, 25 Aug, 07:17 pm"* directly above a shift
 * strip printing `20:17`. Found by LOOKING at the rendered page during brief
 * 08's drive, which is how the first instance was found too.
 *
 * ⚠ **`readStamp` IS GONE — it was byte-identical to this and is now a call to
 * it (#329's sweep).** Three formatters is what let one fix reach one of them;
 * a page that renders a date in two places from two copies will disagree in
 * one of them eventually, and this one already had. **TWO remain on that page
 * and they answer different questions**: this (day + time, for anything DATED)
 * and `CrewWorkingNow`'s `clockTime` (time only, for a live strip whose rows
 * are all today). That is a difference of purpose, not a duplicate —
 * collapsing it would put a date on every row of a strip that is minutes old.
 *
 * ⚠ **AND IT IS NOT THE ONLY `shortDate` IN THE TREE — THE OTHER IS A
 * DIFFERENT FUNCTION WEARING THE SAME NAME, WHICH IS WHY THIS ONE DID NOT
 * TAKE THE BARE NAME'S PLACE WITHOUT THE CHECK BEING WRITTEN DOWN.**
 * `features/casting/components/CastStateHistory.tsx` declares a file-local
 * `shortDate` that formats **day + month + YEAR and no time**, and returns the
 * empty string rather than the input when the date will not parse. It is not a
 * duplicate of this and must not be collapsed into it: a cast's state history
 * is dated across months, while this page's rows are hours old and need the
 * clock. The promotion pass's rule is *"when two implementations collide, the
 * one with REAL CUSTOMERS wins"* — this one has six importers and that one has
 * a single use inside its own file, so this is the one that moved.
 *
 * **Promoted here from `features/admin/components/crew/CrewProgramBanner.tsx`
 * (#898), where it was a pure formatter in a component file with six
 * importers** — the promotion pass's shape, against its bar of two. The body
 * is byte-identical to the one that moved; the move is the whole change.
 */
export function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
