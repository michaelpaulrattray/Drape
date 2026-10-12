/**
 * EVERY WORD THE PUBLIC CHECK PAGE AND ITS TOGGLE SAY — N2d-3 (#2313).
 *
 * One module so the guard (`client/src/features/castingV2/creationCheck/creationCheck.test.ts`)
 * reads every customer string in one place.
 *
 * The rules these strings keep, from the design
 * (`docs/specs/N2D_RECORD_OF_CREATION_DESIGN_2026-10-12.md`):
 *  - *evidence of creation*, never "proof of ownership", never "verified owner",
 *    never any ownership claim (settled before the design; prompts alone earn no
 *    copyright, so promising ownership would promise what cannot be delivered);
 *  - customer vocabulary only (§2 Q3): *independently timestamped*, *fingerprint
 *    of the master picture* — no vendor, no algorithm, no token;
 *  - the toggle's sentence says the WHOLE consequence, the maker's display name
 *    included, because the page shows it (card #2331, from counsel's review the
 *    founder shared 2026-10-12; it replaces the design's §2 Q2 sentence, which
 *    left the name out);
 *  - the page's own footer denies ownership in so many words and never says
 *    "nothing else" — the page also shows the name and the fingerprint (#2331).
 */

/** The whole consequence of turning the page on — card #2331's words, verbatim. */
export const PUBLIC_CHECK_CONSEQUENCE =
  "Anyone with this ID can see that it is real, when this character was made, and your display name. They never see the picture, your brief, or your account. You can turn this off at any time.";

/** The one answer for an ID with no public page — literally true of every such ID. */
export const NO_PUBLIC_RECORD_TEXT = "No public record for this ID";

export const NO_PUBLIC_RECORD_BODY =
  "Either this ID doesn't exist, or the person who made the character hasn't made its record public.";

export const PUBLIC_CHECK_HEADING = "Evidence of creation";
export const PUBLIC_CHECK_REAL_LINE = "This ID is real. This character was made in Klieg.";
/** Card #2331's words, verbatim: it says what the page is, and what it is not. */
export const PUBLIC_CHECK_FOOTNOTE =
  "This page is evidence of creation. It is not a registration of ownership.";

export const PUBLIC_CHECK_LABELS = {
  madeBy: "Made by",
  created: "Created",
  recorded: "Recorded",
  fingerprint: "Fingerprint of the master picture",
} as const;

/** The record date, said honestly: stamped by someone else, or only recorded so far. */
export function recordedLine(date: string, stamped: boolean): string {
  return stamped ? `${date}, independently timestamped` : date;
}

export const PUBLIC_CHECK_TOGGLE = {
  label: "PUBLIC CHECK PAGE",
  switchName: "Public check page",
  off: "Off",
  on: "On",
  previewIntro: "This is what anyone with the ID will see.",
  previewLoading: "Preparing the page…",
  turnOn: "Turn on",
  cancel: "Cancel",
  copyLink: "Copy link",
  copied: "Link copied",
  copyFailed: "Couldn't copy the link. Select it and copy it by hand.",
  failedPreview: "The page couldn't be prepared. Try again in a moment.",
  failedSwitch: "That didn't change. Try again in a moment.",
} as const;

export const PUBLIC_CHECK_TOO_MANY = "Too many checks from here. Try again in a few minutes.";
export const PUBLIC_CHECK_CHECKING = "Checking…";
export const PUBLIC_CHECK_UNAVAILABLE = "This page couldn't be checked right now. Try again in a moment.";

/** The page's own address for a Klieg ID. */
export function publicCheckPath(kliegId: string): string {
  return `/check/${encodeURIComponent(kliegId)}`;
}

/**
 * THE ONE CALENDAR DATE A CAST'S DATES ARE SAID IN — always UTC (#2360).
 *
 * The room's header (`server/castingV2/castProjection.ts`, *"Created on 3
 * October"*) and this page's preview (*"Created 3 October 2026"*) sit on one
 * screen. The header used to format with no `timeZone`, so it said whatever day
 * the SERVER's clock was on while this page said the UTC day: on a UTC+10 bench
 * the same cast read "4 October" above "3 October". Both now read this one
 * function, so the zone is pinned in exactly one place and the two cannot drift
 * again (working law 4). The forms differ only in whether the year is said.
 */
export function castCalendarDate(at: Date, form: "day-month" | "day-month-year"): string {
  if (Number.isNaN(at.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    ...(form === "day-month-year" ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(at);
}

/** "3 September 2026" — the long British form the design's own example uses, in UTC so every reader sees one date. */
export function publicCheckDate(iso: string): string {
  return castCalendarDate(new Date(iso), "day-month-year");
}
