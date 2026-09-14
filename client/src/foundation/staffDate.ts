/**
 * THE STAFF WORLD'S DATES — one declaration per shape, for every staff surface.
 *
 * ⚠ **#902 ASKED FOR TWO FUNCTIONS IN TWO FILES. THE SWEEP FOUND ELEVEN
 * DECLARATIONS OF FIVE SHAPES IN ELEVEN FILES, AND EVERY ONE OF THEM PASSED
 * `"en-US"` AS A LITERAL** — which is working law 7 (*fix the class, not the
 * instance*) earning its place, because his *"Day first everywhere"* ruling
 * would otherwise have been applied to two of eleven and left the admin
 * Overview's chart axes reading `Sep 14` beside a table reading `14 Sept`.
 *
 * **THE CARD EXISTS BECAUSE THE DUPLICATION HAD ALREADY COST A SHIFT.** #900
 * had to make one identical one-property change **twice**, and #912 then made
 * it twice more in another pair. *"A rule that has to be applied in two files
 * will eventually be applied in one of them"* — which is what #903 item 1 is:
 * the Moderation console reading `03/09/2026` beside its own `Sep 13, 11:08`.
 *
 * ## The census, and what it did with each shape
 *
 * | shape | renders | was declared in | outcome |
 * |---|---|---|---|
 * | `staffDateTime` | `14 Sept, 23:08` | `adminConstants.formatDate`, `moderatorConstants.formatDate` | promoted — **12** consumer files |
 * | `staffDateTimeWithYear` | `14 Sept 2026, 23:08` | `UserBadges.formatDate`, `ChangeRequestConstants.formatDate` | promoted — 2 |
 * | `staffFullDateTime` | `14 September 2026 at 23:08:12` | `adminConstants.formatFullDate`, `moderatorConstants.formatFullDate` | promoted — 4 |
 * | `staffDateOnly` | `14 Sept` | `UserTable.shortTime`, `ChangeRequestConstants.formatRelativeTime`'s tail, and `formatDateLabel` in **three** Overview cards | promoted — 5 |
 *
 * **TWO STAYED WHERE THEY WERE, ON THE PASS'S OWN BAR OF TWO**, and both now
 * draw `STAFF_LOCALE` from here so the notation is still one rule:
 *
 * - `pages/AdminInviteCodes.formatDate` — `14 Sept 2026`, date-only with a
 *   year. **One declaration, one consumer.**
 * - `pages/AdminBugReports.formatWhen` — a NEAR-MISS of `staffDateTimeWithYear`
 *   that asks `hour: "numeric"` where every other staff clock asks
 *   `"2-digit"`, so it renders `9:08` where they render `09:08`. ⚠ **It is
 *   named here rather than folded in**: collapsing it would change what that
 *   page prints, which is not what a promotion is for.
 *
 * ## Why these are separate functions rather than one with options
 *
 * The promotion pass's rule is *"if a promotion needs a rewrite to be general
 * it is not ready"*. An options object would be that rewrite: these are four
 * answers to four different questions — a row in a dense table, a row that
 * spans years, a fact panel where the second matters, and a chart axis — and a
 * caller choosing between them by passing flags is a worse reader than a caller
 * choosing a name.
 *
 * **`staffFullDateTime` is promoted EXACTLY as it stood**, long month and all.
 * Whether the staff world wants one full-date shape or two is a design question
 * and #902 reserved it: *"the promotion must NOT be the place it gets answered."*
 *
 * ## The house rule that rides in these bodies, and it is his
 *
 * **24-HOUR, FORCED** — `CrewWorkingNow`'s `clockTime` carries the ruling:
 *
 * > *"every other time in his world is 24-hour — the runner's close-stamps, the
 * > shift rows, his own #295 report quoting `19:46` and `20:17` — so the one
 * > clock he would be comparing against was the one written differently."*
 *
 * It took five instances to land everywhere (#329, #900, #903, #912) for the
 * one reason this module removes: it had to be applied once per copy.
 *
 * ## The parameter type
 *
 * `Date | string`, the union #902 asked to have decided in the card rather than
 * slipped in. The moderator pair took `Date` and the admin pair took
 * `Date | string`; every call site already satisfies the union, and the
 * narrower type was the thing forcing `formatDate(new Date(x))` at eleven call
 * sites that already held a string.
 *
 * ⚠ **`staffDateTimeWithYear` KEEPS `ChangeRequestConstants`' NULL GUARD and
 * `UserBadges` HAD NONE — the guard is a strict superset, not a behaviour
 * change.** `UserBadges.formatDate` is typed `string | Date`, so no caller can
 * reach the new branch without a type error first; what the guard prevents is
 * the next caller rendering `Jan 1, 1970, 10:00` for a null, which is what that
 * copy does today if it is ever handed one.
 *
 * @see foundation/staffClock.test.ts — the guard over the house rules
 */

/**
 * ⚠ **THE ONE LINE THAT DECIDES THE NOTATION ON EVERY STAFF SCREEN, AND IT IS
 * HOISTED HERE DELIBERATELY RATHER THAN REPEATED IN THREE BODIES.**
 *
 * ✅ **HIS RULING, 2026-09-13 23:16:09Z — Crew reply #182, verbatim and entire:**
 *
 * > **Day first everywhere**
 *
 * Answering *"Your admin pages write `Sep 14` and your Crew page writes
 * `14 Sept` — the same fact, two ways, on two of your own screens. Which one
 * wins?"* **`14 Sept` wins, and this line is where it wins.**
 *
 * All eleven declarations #902 replaced passed `"en-US"` as a literal, which is
 * why #900's fix and #912's fix each had to be made twice and why #903 is a
 * card at all. **His two words are one character change here because that card
 * landed first** — which is exactly what it recommended: *"promote first, then
 * apply his notation once, in the promoted formatter."*
 *
 * ## Why `en-GB`, and why the choice is not load-bearing
 *
 * Driven rather than reasoned, at all four shapes:
 *
 * ```
 * en-US  Sep 14, 23:08   Sep 14, 2026, 23:08   September 14, 2026 at 23:08:12
 * en-GB  14 Sept, 23:08  14 Sept 2026, 23:08   14 September 2026 at 23:08:12
 * en-AU  — identical to en-GB —        en-IE  — identical to en-GB —
 * ```
 *
 * Three day-first English locales render these shapes to the same character, so
 * `en-GB` is the conventional one rather than the decisive one. What matters is
 * that it is **PINNED**: a locale is now a house decision and not a property of
 * whichever machine has the page open.
 *
 * ⚠ **THE ONE THING HIS TWO WORDS DO NOT SETTLE, SAID RATHER THAN ASSUMED
 * (law 7b): THIS IS THE STAFF WORLD ONLY.** He answered the staff-notation card
 * with *"Day first everywhere"* and then, **three minutes later**, answered the
 * CUSTOMER-clock card (#903 item 2) with *"Leave it"* — so the later, narrower
 * word governs its own subject and `features/boards`' `VersionHistoryModal`
 * keeps the reader's own machine notation. `staffClock.test.ts` carries that
 * boundary as a negative control, and it is **founder-backed now rather than
 * cautious**.
 *
 * **Exported** so that the two formatters the promotion bar correctly left in
 * their own files still take the notation from here. A shape may stay local;
 * the RULE may not be written twice.
 */
export const STAFF_LOCALE = "en-GB";

/**
 * A staff timestamp inside the current year: `14 Sept, 23:08`.
 *
 * The densest of the three and the one most tables use — a WHEN column, a
 * BLOCKED cell, a last-signed-in. No year, because a row in an audit log is
 * being read against the rows above it rather than against a calendar.
 */
export function staffDateTime(date: Date | string): string {
  return new Date(date).toLocaleString(STAFF_LOCALE, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * A staff timestamp that spans years: `14 Sept 2026, 23:08`.
 *
 * The admin Users table and the change-request fact rows, where a JOINED date
 * or a RAISED date is routinely years old and the year is the fact being read.
 *
 * Returns `—` for a missing date rather than the epoch — see the module
 * docblock for why that guard travels with this shape and not the others.
 */
export function staffDateTimeWithYear(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString(STAFF_LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * The unabbreviated one, for a fact panel rather than a row:
 * `14 September 2026 at 23:08:12`.
 *
 * Its seconds are the point — an audit row's expanded detail is where someone
 * is reconstructing an order of events, which is the one place a staff surface
 * needs them.
 */
export function staffFullDateTime(date: Date | string): string {
  return new Date(date).toLocaleString(STAFF_LOCALE, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * A staff date with no clock and no year: `14 Sept`.
 *
 * ⚠ **THE MOST-COPIED SHAPE IN THE STAFF WORLD — FIVE DECLARATIONS, AND THREE
 * OF THEM WERE THE SAME FUNCTION UNDER THE SAME NAME IN THREE SIBLING FILES**
 * (`formatDateLabel` in `overview/CreditEconomyCard`, `overview/HealthMetrics`
 * and `overview/UserGrowthCard`). The other two are `UserTable.shortTime` and
 * the tail of `ChangeRequestConstants.formatRelativeTime`, where it is what an
 * "Xd ago" turns into once a month has passed.
 *
 * It has no clock because its callers are axes and dense cells: a chart tick
 * that carried a time would be unreadable, and a relative time that has aged
 * out of hours is being read as a day.
 */
export function staffDateOnly(date: Date | string): string {
  return new Date(date).toLocaleDateString(STAFF_LOCALE, {
    month: "short",
    day: "numeric",
  });
}
