/**
 * THE TWO PATHS — which one a cast was born on (founder ruling 2026-08-21,
 * *"this is the way foward 100%"*; relayed fable-1311 with fable-1312's
 * addendum; design `docs/specs/CASTING_V2_TWO_PATHS_DESIGN.md` §0/§3.1,
 * countersigned fable-1334; migration `0051`).
 *
 * `wardrobe`   born and signed in an outfit — hers if she named one, otherwise
 *              one the engine picks to match the cast type, otherwise the plain
 *              grey tee. Ink lands only where that outfit leaves skin.
 * `basics`     born and signed in plain black basics — a clean body record,
 *              and the chest is bare.
 * *(absent)*   **CAST BEFORE THE PATHS EXISTED.** Not a third path and not a
 *              defaulted one.
 *
 * # Why the vocabulary lives in `shared/` rather than beside the roll
 *
 * Two consumers that cannot import each other need the same two words: the
 * column (`drizzle/schema.ts` cannot import from `server/`) and the toggle
 * (§6 — the client control that chooses the path before the roll is bought).
 * Two spellings of a closed, code-owned vocabulary is working law 4's copy, and
 * it would drift the first time anything moved. So there is one list, and
 * `twoPathsMigration.test.ts` is the arm that reddens if the column, this
 * constant and the migration text ever stop agreeing.
 *
 * # THE ABSENCE IS NOT A MEMBER, AND MUST NEVER BECOME ONE
 *
 * The same rule `INK_CUT_ROUTES` states about `notLookedAt`, and here it is
 * load-bearing enough that the migration argues it at length: `ADD COLUMN …
 * NULL DEFAULT 'wardrobe'` would have MySQL stamp every historical roll with a
 * claim that it was cast on a path that did not exist when it was cast. There
 * is no repair afterwards, because the distinction destroyed is the only
 * evidence of which rolls predate the feature — and the resulting table looks
 * entirely healthy.
 *
 * So `null` is the honest shape of *"this question was not asked"*. What a
 * reader DOES about it is a behaviour decision and does not belong here; it
 * belongs to the one owner (`server/castingV2/wardrobeLine.ts`, condition (v)),
 * so that "how a pre-paths roll behaves" is answered in one place rather than
 * spelled at every call site as `?? "wardrobe"`.
 */

export const CASTING_PATHS = ["wardrobe", "basics"] as const;

export type CastingPath = (typeof CASTING_PATHS)[number];

export function isCastingPath(value: unknown): value is CastingPath {
  return typeof value === "string" && (CASTING_PATHS as readonly string[]).includes(value);
}

/**
 * The toggle's default (§6), and ONLY the toggle's default.
 *
 * It is deliberately not named `FALLBACK` or reached for by readers of a roll:
 * a stored `null` means nobody was asked, while this is the answer the control
 * shows when nobody has touched it yet. Conflating the two is how the absence
 * above quietly becomes a member.
 */
export const DEFAULT_CASTING_PATH: CastingPath = "wardrobe";

/**
 * `casting_rolls.wardrobeLine`'s width, named once so the column, the door that
 * validates a composed line, and any UI that shows it cannot disagree about
 * where the truncation is.
 */
export const WARDROBE_LINE_MAX_LENGTH = 240;
