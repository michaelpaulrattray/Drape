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
 *  - the toggle's one sentence is the design's §2 Q2 sentence, VERBATIM.
 */

/** Design §2 Q2, verbatim — the whole consequence of turning the page on. */
export const PUBLIC_CHECK_CONSEQUENCE =
  "Anyone with this ID can confirm it is real and when this character was made. They never see the picture, your brief, or your account.";

/** The one answer for an ID with no public page — literally true of every such ID. */
export const NO_PUBLIC_RECORD_TEXT = "No public record for this ID";

export const NO_PUBLIC_RECORD_BODY =
  "Either this ID doesn't exist, or the person who made the character hasn't made its record public.";

export const PUBLIC_CHECK_HEADING = "Evidence of creation";
export const PUBLIC_CHECK_REAL_LINE = "This ID is real. This character was made in Klieg.";
export const PUBLIC_CHECK_FOOTNOTE =
  "This page is evidence of creation. It shows when this character was made, and nothing else.";

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

/** "3 September 2026" — the long British form the design's own example uses, in UTC so every reader sees one date. */
export function publicCheckDate(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(at);
}
