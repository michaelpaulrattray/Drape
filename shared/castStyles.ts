/**
 * THE CAST STYLE — which locked bundle the studio photographs a cast with
 * (#142, the minimal settings modal; the founder's ruling is
 * `PROMPT_AUTHOR_RULING_2026-08-26.md` §3, verbatim there).
 *
 * A style is a BUNDLE (rule 11a): every style carries its own default framing,
 * background, lighting and quality clause, appended by code as the locked house
 * block on every roll. Settings are DEFAULTS and the prompt overrides them
 * (rule 8, his words: *"anything in the settings outlined in the prompt is
 * overriden by the user prompt"*). Today there is ONE style — photoreal — and
 * it is the default; this list exists so the selector has a real shape and so
 * a second style is a compile error everywhere the block is chosen until its
 * preset is written, declared and courted (`houseBlockForStyle`).
 *
 * Shared because the client draws the selector and the server chooses the
 * block by it — a second copy of a one-member list is still a second copy
 * (working law 4), and the day it has two members is the day that matters.
 */
export const CAST_STYLES = ["photoreal"] as const;
export type CastStyle = (typeof CAST_STYLES)[number];
export const DEFAULT_CAST_STYLE: CastStyle = "photoreal";

/** The word on the pill. */
export const CAST_STYLE_NAMES: Readonly<Record<CastStyle, string>> = {
  photoreal: "Photoreal",
};

/**
 * The line under the selected style — what its bundle does TODAY, in the
 * customer's words. Honest about the block as it stands (chest-up, studio
 * light, grey seamless, photoreal finish) and about the override rule; it
 * promises no control the modal does not have.
 */
export const CAST_STYLE_LINES: Readonly<Record<CastStyle, string>> = {
  photoreal:
    "A photographic casting portrait: chest-up, studio light, grey seamless. Anything your brief says about the look, light or setting overrides it.",
};

/**
 * STYLES NAMED BUT NOT LIVE — the "coming soon" rows (settings-modal design
 * §10b, his word: *"you can design these all into the modal and coming soon
 * features so the modal stays true"*). A labelled, non-interactive
 * announcement is not a dead control (D-180 is engaged by neither); a promise
 * on a customer surface is governed the way `KNOWN_DEBTS` is: a row appears
 * only for a style genuinely on his list, is DESCRIBED and never named after
 * an IP (rule 9, the copyright guard), and leaves only by going live or by his
 * word — never by silent deletion.
 *
 * His list, verbatim (rule 9): *"photoreal, painted-illustrative realism,
 * glossy anime-poster, more later"*.
 */
export const COMING_CAST_STYLES: ReadonlyArray<{ readonly name: string; readonly line: string }> = [
  { name: "Painted realism", line: "Illustrative realism with visible brushwork." },
  { name: "Glossy poster", line: "A high-gloss animated-poster finish." },
];
