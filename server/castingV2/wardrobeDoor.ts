/**
 * THE DOOR OVER AN ENGINE-PICKED OUTFIT — design
 * `docs/specs/CASTING_V2_TWO_PATHS_DESIGN.md` §4.1, item 4 of §10's build.
 *
 * # Why a door exists here at all
 *
 * Every free value in this product must appear in the customer's own sentence
 * (D-172). **An engine-picked outfit cannot** — that is the whole point of case
 * (b): *"a caveman"* names no clothes and the picker answers with a
 * one-shoulder hide. So the exception is declared rather than smuggled, and
 * §4.1's price for it is that the picked line meets a **code-owned door that
 * refuses by ACTING and not by absence** — the `STAGE_WORDS`/open-lane lesson
 * (`refineDelta.ts`'s three-wall audit), where a wall that exists only as a
 * sentence in a prompt is not a wall.
 *
 * # It guards the OVERRIDE amendment, so it runs on BOTH cases
 *
 * §3.4 amends `cohortPhotorealHuman.OVERRIDE` in exactly one place: the
 * WARDROBE line becomes the one thing a description may set, *because it is no
 * longer the description setting it — it is a code-owned field the code
 * composed*. **Location, activity, props and text keep absolute authority.**
 *
 * That is a fact about the FIELD, not about who filled it. A prop reaching the
 * prompt inside the wardrobe line is a prop that walked past the override
 * whether the customer typed it or the picker invented it — so the door runs on
 * case (a) as well, and rejecting a customer-named outfit costs her nothing she
 * has today: every stated wardrobe is ignored on the current product, and a
 * rejection here falls back to §4(c), which is today's picture exactly.
 *
 * # It REJECTS, it does not repair — one exception, and it is the house rule
 *
 * The garment guard's founder ruling stands: *never patch a language model's
 * output with code, and never fail a roll over it*. A refused line becomes
 * `null`, `bornWardrobeLine` falls back to the house line, and the roll runs.
 *
 * The one thing that is EDITED rather than refused is a brand mark, because
 * `scrubBrands` is the product's standing answer to that class and it keeps the
 * sentence: *"a Nike hoodie"* becomes *"a hoodie"*, which is a perfectly good
 * outfit, where a refusal would throw away a good pick over one token.
 *
 * # The word lists, and the two lessons written into how they were chosen
 *
 * This repo has paid twice for a list aimed at the wrong field. `GARMENT_WORDS`
 * contains "collar", correctly for a composed DIRECTION, and it deleted the
 * whole hair axis of a paid roll that said *"collar-length hair"*. The same
 * list, reused on the accessory field, deleted *"small gold hoop earrings"* —
 * the one category that field exists to carry. So these lists are written for
 * THIS field, and every word that could plausibly name part of a plain outfit
 * was left out on purpose:
 *
 *   - **"bow"** is absent from the weapons. A bow tie and a silk bow are
 *     clothing, and a caveman's bow is not worth them.
 *   - **"blade"** is absent for the same reason: a shoulder blade is anatomy,
 *     and *"cut low at the shoulder blades"* is a sentence the Basics spec
 *     could plausibly produce.
 *   - **"hood" / "hooded"** are absent from the headwear. A hoodie is an
 *     ordinary garment this picker should be free to choose, and rejecting
 *     *"a hooded sweatshirt"* while accepting *"a hoodie"* is a distinction
 *     nobody could defend.
 *   - **"print" / "printed"** are absent from the text class. §4.1 names
 *     *printed text and logos*; a floral print is neither, and banning the word
 *     would refuse an ordinary dress.
 *   - **"patch"** is absent: patch pockets are a real garment detail.
 *
 * Two words stay in despite a near-miss, and each is protected by a PHRASE
 * rather than dropped — see `PROTECTED_PHRASES`.
 *
 * # ⚠ A LIMIT, STATED RATHER THAN QUIETLY CLOSED
 *
 * §4.1 enumerates five reject classes and this door implements those five and
 * nothing else. **A SETTING or an ACTIVITY inside a wardrobe line is the same
 * shape of leak and is NOT refused here** — *"a barista's apron behind an
 * espresso machine"* would pass. The prompt instruction tells the picker not to
 * (`interpreter.ts`), and an instruction is a tendency rather than a guarantee,
 * which is this module's own opening argument. It is left open deliberately:
 * the five classes are a ruling, and quietly adding a sixth list is a design
 * change wearing a diff. Filed for the design's next sitting.
 */
import { containsBrand, scrubBrands } from "./brandScrub";

/**
 * The reason a pick was refused — enumerated, and carried out of the door.
 *
 * ⚠ **An arm asserts its own reason.** Five rehearsal arms in this repo once
 * all refused on the same unrelated `missing columns` and the summary read
 * REHEARSED over two checks that were doing nothing. A boolean door cannot tell
 * "rejected the weapon" from "rejected because the string was 300 characters",
 * so the verdict names the class AND the word that fired it.
 */
export type WardrobePickRefusal =
  /* `blank` rather than the obvious `empty`, and it is not a taste choice.
     `empty` is a DECLARED refusal id in the capability census, and that census
     records which test files pin each id by naming it — so a suite asserting
     this door's own `empty` filed itself as a pinner of the interpreter's,
     which is a false entry in an instrument other people read. A private
     vocabulary does not get to squat on a product-wide one. */
  | "blank"
  | "too_long"
  | "digits"
  | "brand"
  | "prop"
  | "weapon"
  | "headwear"
  | "text";

export type WardrobePickVerdict =
  | { ok: true; line: string }
  | { ok: false; reason: WardrobePickRefusal; word: string | null };

/**
 * THE REASON AN ENGINE-PICKED OUTFIT NEVER REACHED A SHEET — one string, so the
 * count is one grep.
 *
 *     grep wardrobePickRefused <the service log>
 *
 * counts every pick this door threw out, and each line carries the CLASS and
 * the WORD that fired it.
 *
 * ⚠ **It exists because the picker got bolder in the same commit** (the founder
 * order relayed fable-1595; design
 * `docs/specs/CASTING_V2_WARDROBE_PICKER_DESIGN.md` §5, ruled fable-1609 ruling
 * 1). A pick that names fabric, cut and colour is a LONGER pick against
 * {@link WARDROBE_PICK_MAX}, and a costume designer reaches for a *badge*, a
 * *beret*, a *holster* — each a correct refusal by one of the lists below, and
 * each one costing the whole outfit and falling back to `HOUSE_WARDROBE_LINE`,
 * **which is the greyest sentence in the product and therefore the exact defect
 * that commit removes, reinstated silently.**
 *
 * Before this constant the refusal logged and NOTHING counted it: no counter,
 * no census row, no operation, no ledger line — so a door tripping on one pick
 * in four would have looked exactly like production looked the day before. The
 * two-paths design's own §9 is the argument in its own words: *a refusal nobody
 * counts is a demand signal thrown away.*
 *
 * ⚠ **The line names the class and never the LINE ITSELF.** A refused pick is
 * still a model's sentence about a customer's brief, and the discipline that
 * keeps `masterPrompt` out of a projection keeps a wardrobe sentence out of a
 * log nobody scoped. The class and the offending word are what a reader can act
 * on; the outfit is not.
 *
 * It lives HERE rather than beside `COHORT_WALL_RETRIED` in `interpreter.ts`,
 * whose shape it copies, for a mechanical reason worth stating: `interpreter.ts`
 * imports `castingIntent.ts`, and `castingIntent.ts` is where this token is
 * logged — so the obvious home would have been an import cycle. The door that
 * produces the refusal owns its name.
 */
export const WARDROBE_PICK_REFUSED = "wardrobePickRefused";

/**
 * The cap, and it REFUSES rather than truncating — unlike every other free-text
 * field in `castingIntent.ts`.
 *
 * Those fields are captions and notes, where `cleanFreeText`'s `slice` costs a
 * clipped tail. This one is stored in `casting_rolls.wardrobeLine` as the
 * durable contract that six signed views are composed from and a judge compares
 * them against — so a line cut mid-word ("…plain straight-leg trou") would be
 * an outfit no render can satisfy and no judge can pass, kept for the life of
 * the Cast. Well inside the column's own 240.
 */
export const WARDROBE_PICK_MAX = 180;

/**
 * Phrases that contain a listed word and are not the thing it names.
 *
 * Removed before the word match, so the word can stay on its list and the
 * garment can stay in the outfit. Each earns its place by being a real term a
 * plain outfit could use — this is the "collar-length" lesson applied BEFORE
 * the list is written rather than after a paid roll finds it.
 */
const PROTECTED_PHRASES = [
  /* A cap-sleeve top is a top. "cap" stays on the headwear list because a
     baseball cap is the single most likely thing a picker reaches for. */
  "cap sleeve",
  "cap sleeves",
  "cap-sleeve",
  "cap-sleeves",
  /* A club collar is a dress-shirt collar. "club" stays because the design's
     own worked example is *the caveman gets a hide, not a club*. */
  "club collar",
];

/**
 * HELD OBJECTS. Not worn, therefore not wardrobe, and the override keeps them.
 *
 * A prop also moves the POSE, which the frame owns outright — the M3 defect
 * that started all of this was an invented mug, captioned, inherited by all
 * eight candidates, whose text then beat the framing block's own no-text rule.
 */
const PROP_WORDS = [
  "holding", "holds", "carrying", "carries", "prop", "props",
  "mug", "cup", "bottle", "flask", "phone", "smartphone", "laptop", "tablet",
  "camera", "guitar", "microphone", "umbrella", "briefcase", "clipboard",
  "tray", "cigarette", "bouquet", "skateboard", "broom", "shovel",
];

/**
 * WEAPONS. The design's own worked bound: *"The caveman gets a one-shoulder
 * hide and bare feet, not a club."*
 */
const WEAPON_WORDS = [
  "weapon", "weapons", "sword", "katana", "knife", "dagger", "axe", "club",
  "spear", "gun", "rifle", "pistol", "revolver", "shotgun", "holster",
  "grenade", "shield", "baton", "machete",
];

/**
 * HEADWEAR. Banned because the sheet's whole job is eight faces and their hair:
 * the roll varies hair across the eight, and a hat is a lid on the axis the
 * sheet exists to show.
 *
 * ⚠ **The cost is named rather than hidden**: a brief whose outfit genuinely
 * includes a head covering — a hijab, a chef's toque — is refused into the
 * house line. That is today's picture, since today no stated wardrobe reaches
 * the frame at all, so it is a capability not yet gained rather than one lost.
 */
const HEADWEAR_WORDS = [
  "hat", "hats", "cap", "caps", "beanie", "helmet", "headband", "headscarf",
  "bandana", "turban", "veil", "crown", "tiara", "headdress", "fedora",
  "beret", "visor", "balaclava", "hijab", "niqab",
];

/**
 * PRINTED TEXT AND LOGOS — the class that has already cost this product a roll.
 *
 * A trademark went to the provider on every candidate of one roll and the
 * provider refused five of eight. Image models also render lettering as
 * artefacts, which is why the sheet's frame says *plain unbranded* twice.
 */
const TEXT_WORDS = [
  "logo", "logos", "logotype", "monogram", "brand", "branded", "slogan",
  "slogans", "text", "lettering", "wordmark", "typography", "graphic",
  "graphics", "emblem", "insignia", "badge", "banner", "signage",
];

const CLASSES: readonly { reason: WardrobePickRefusal; words: readonly string[] }[] = [
  { reason: "prop", words: PROP_WORDS },
  { reason: "weapon", words: WEAPON_WORDS },
  { reason: "headwear", words: HEADWEAR_WORDS },
  { reason: "text", words: TEXT_WORDS },
];

/**
 * Whole words only, the same matcher shape `statedWardrobe.ts` uses and for the
 * same reason: a stemming match would fire on ordinary English about clothes.
 * "unbranded" is not "brand", and the house line says it twice.
 */
function wordsOf(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/[^a-z]+/).filter(Boolean));
}

function withoutProtectedPhrases(text: string): string {
  let stripped = text.toLowerCase();
  for (const phrase of PROTECTED_PHRASES) stripped = stripped.split(phrase).join(" ");
  return stripped;
}

/**
 * Does this line describe an outfit the studio frame can actually photograph?
 *
 * Pure, and it logs nothing: the reason is RETURNED so the one call site can
 * log it where the field is dropped. A door that swallowed its own reason would
 * make every refusal look alike in the record, which is the thing the verdict
 * type exists to prevent.
 */
export function wardrobePickDoor(raw: unknown): WardrobePickVerdict {
  if (typeof raw !== "string") return { ok: false, reason: "blank", word: null };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, reason: "blank", word: null };
  if (trimmed.length > WARDROBE_PICK_MAX) return { ok: false, reason: "too_long", word: null };
  /* Digits render as text artefacts in the picture — the same refusal every
     other free-text field in `castingIntent.ts` makes, for the same reason. */
  if (/[0-9]/.test(trimmed)) return { ok: false, reason: "digits", word: null };

  /* Scrubbed, not refused: the standing answer to a mark, and it keeps the
     outfit. Everything below reads the scrubbed line, so a house name cannot
     be what satisfies one of the word lists either. */
  const scrubbed = scrubBrands(trimmed);
  if (!scrubbed) return { ok: false, reason: "brand", word: null };
  /* Belt and braces: `scrubBrands` removes every mark it knows, so this can
     only fire if that ever stops being true. It is cheap and it is the reason
     the class has a name. */
  if (containsBrand(scrubbed)) return { ok: false, reason: "brand", word: null };

  const words = wordsOf(withoutProtectedPhrases(scrubbed));
  for (const { reason, words: list } of CLASSES) {
    const hit = list.find((word) => words.has(word));
    if (hit) return { ok: false, reason, word: hit };
  }

  return { ok: true, line: scrubbed };
}
