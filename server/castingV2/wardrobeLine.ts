/**
 * WHAT THIS PERSON IS WEARING — one owner, and every reader derives from it
 * (design `docs/specs/CASTING_V2_TWO_PATHS_DESIGN.md` §3.3, and CONDITION (v)
 * of the countersign, fable-1334 §2).
 *
 * # The gap this closes
 *
 * Nothing in this product owns that sentence today. The roll prompt hard-codes
 * one wardrobe line inside a framing constant, the six signed views hard-code a
 * different one, the sheet's notice describes a third, and the refine recipe
 * names FIVE nouns of which clothing is not one. Measured at the frames (§2): a
 * removal re-render turned a grey tee BLACK, unasked, because no part of the
 * recipe ever said the tee was grey — and it had gone unseen only because the
 * step before it happened to carry an ink crop cut from the sleeve, so a
 * picture spoke for the garment. **A fact nothing names is a fact the engine is
 * free to reinterpret.**
 *
 * # CONDITION (v) — why this is a function and not a column read
 *
 * Three sentences of the design implied a fourth nobody had written: the roll's
 * line is snapshotted at Sign, a wardrobe edit rewrites the stored line, and a
 * Follow inherits the BORN line. Together those imply a Cast **signed after a
 * wardrobe edit** whose six views would be judged against the born line it is
 * no longer wearing — six views, the wardrobe axis, **refunded slices**, which
 * is exactly how the crew-neck chest design already cost money.
 *
 * So there is one answer and everything reads it: the recipe derives from it,
 * Sign snapshots ITS answer, the judge judges against ITS answer, the sheet
 * shows ITS answer.
 *
 * ⚠ **EXACTLY ONE CALLER IN THE PRODUCT MAY READ THE BORN COLUMN BY NAME, AND
 * IT IS THE FOLLOW** (§3.1). A Follow casts a fresh eight and deliberately
 * wants the SHEET's outfit rather than this person's — dressing eight strangers
 * in one person's mid-session outfit change is *a momentary choice made
 * permanent for eight strangers*, which is the sentence `refineSubjects.ts`
 * already uses about `expression`, for the same reason. Anything else reaching
 * past this function for `casting_rolls.wardrobeLine` is the parallel-copy
 * shape (working law 4) with a refund attached.
 *
 * # It is PURE, and that is deliberate
 *
 * It takes facts already read and returns a resolution. No database, no
 * transaction, no flag check — so the six readers in §3.3 can all call it
 * wherever they already are, and the resolution can be driven exhaustively
 * without a fixture. Whether this ACCOUNT has the paths at all is
 * `captureCastingTwoPathsEnabled`'s question, asked once at the write, and the
 * answer is already in the row by the time anything here runs.
 */
import type { CastingPath } from "../../shared/castingPaths";

/**
 * Where the answer came from. `edited` beats `born` — that IS condition (v).
 */
export type WardrobeLineSource = "edited" | "born";

/**
 * ⚠ THREE CASES, AND THE THIRD IS THE ONE THE DESIGN IMPLIES WITHOUT NAMING.
 *
 * `line`       this person is wearing a known, complete outfit.
 * `unpathed`   the roll predates the paths, or was cast with the flag off.
 *              **This is not an error and never becomes one**: `NULL` on those
 *              columns means *cast before the paths existed*, and a reader's
 *              correct response is to behave exactly as the product does today.
 *              It is the state of all 206 production rolls as this lands.
 * `incoherent` the roll IS on a path and carries no line.
 *
 * The third case cannot be produced by the write path — a path and a line are
 * stamped in one insert — and it is given a name anyway rather than folded into
 * `unpathed`, because the two demand opposite behaviour. `unpathed` says *paint
 * what you always painted*. `incoherent` says *this roll claims a path and
 * cannot say what it is wearing*, and on the Basics path painting the default
 * grey tee would put a shirt on a cast whose whole purpose is a bare chest —
 * silently, in the one place the customer would notice last.
 *
 * A branch that comes back `incoherent` is refused free, before the claim. It
 * is not folded in here for the same reason `INK_CUT_ROUTES` refuses to make
 * the absence a member: a corner declared unreachable and then quietly
 * defaulted is a corner with no test, and this campaign has paid for that one.
 */
export type WardrobeResolution =
  | { kind: "line"; line: string; source: WardrobeLineSource; path: CastingPath }
  | { kind: "unpathed" }
  | { kind: "incoherent"; path: CastingPath };

/**
 * The facts a resolution needs, all of them already on rows the caller has.
 *
 * `editedLine` is `undefined` everywhere in the product today: the WARDROBE
 * subject that writes it is the REFINE slice, and it is named here first so
 * that when it arrives there is one place it can land rather than six.
 */
export type WardrobeBranch = {
  /** `casting_rolls.path` of the roll this branch descends from. */
  rollPath: CastingPath | null;
  /** `casting_rolls.wardrobeLine` — the BORN outfit of the sheet. */
  rollLine: string | null;
  /** This branch's own wardrobe edit, if one has been made. */
  editedLine?: string | null;
};

/** A stored line that is present but blank is no line at all. */
function stated(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * WHAT THIS BRANCH IS WEARING RIGHT NOW.
 *
 * The edited line if this branch has one, else the roll's born line. Every
 * reader in §3.3 goes through here; the Follow is the one exception and it is
 * documented at its own call site as well as in this file's header.
 */
export function currentWardrobeLine(branch: WardrobeBranch): WardrobeResolution {
  const path = branch.rollPath;
  const born = stated(branch.rollLine);
  const edited = stated(branch.editedLine);

  if (path === null) {
    /*
      ⚠ AND A LINE WITHOUT A PATH IS STILL UNPATHED, deliberately.

      It cannot happen — the two columns are written together — but if it ever
      did, the honest reading is that nobody chose a path for this roll, and a
      line nobody chose a path for is not something to dress a paid render in.
      Falling through to "use the line anyway" would be the more helpful answer
      and the wrong one: it would make a half-written row indistinguishable
      from a whole one at every reader downstream.
    */
    return { kind: "unpathed" };
  }

  if (edited !== null) return { kind: "line", line: edited, source: "edited", path };
  if (born !== null) return { kind: "line", line: born, source: "born", path };
  return { kind: "incoherent", path };
}

/**
 * TODAY'S PICTURE, WRITTEN DOWN — case (c) of §4, and the default the Wardrobe
 * path falls back to for any brief that names no outfit.
 *
 * ⚠ **The latitude is removed on purpose, and removing it is half the point of
 * storing a line at all.** The roll prompt says *"neutral grey OR off-white"*
 * and the signed-view spec deliberately names no colour BECAUSE of that or —
 * so a Cast signed in off-white had a package whose contract it could not
 * satisfy, and **the customer paid for our inconsistency** (`castViewPackage.ts`,
 * first real Sign, 2026-08-02). A stored exact line is what makes generator and
 * judge able to agree.
 *
 * ⚠ **It is COMPLETE — top, bottoms, footwear — and the bottoms are the part
 * that looks like invention.** They are not visible on the master: the sheet is
 * waist-up (`castingFrame.ts` pins that premise). They exist because the three
 * full-length signed views are not, and today those views are told the opposite
 * — `CAST_PACKAGE_WARDROBE_SPEC` instructs the judge that *"anything below the
 * frame of the reference CANNOT be compared to it and must not fail this
 * check"*, which is an honest answer to having nothing written down and a
 * wasteful one once something is.
 *
 * Kept as close to the existing wording as completeness allows: this line must
 * reproduce TODAY'S PICTURE, not improve on it. The one place a taste eye
 * belongs is here.
 */
export const HOUSE_WARDROBE_LINE =
  "a plain unbranded crew-neck tee in neutral grey, plain straight-leg trousers in the same "
  + "neutral grey, and plain unbranded low shoes";

/**
 * THE BASICS OUTFIT — §5's spec, and the third case its two forms do not cover.
 *
 * The spec is two forms: men shirtless with plain black fitted shorts; women a
 * plain black sports top with black fitted shorts, *cut low enough to show a
 * chest piece*. Adults only is already the product's rule.
 *
 * ⚠ **`SEXES` HAS THREE MEMBERS AND THE SPEC HAS TWO FORMS**, and a brief that
 * names no sex at all makes a fourth case. This is the same shape as
 * `casting_ink_form_demand`'s own gap, which CLAUDE.md names in as many words —
 * so it is answered here rather than discovered at a customer.
 *
 * **The answer is the COVERED form for anything that is not `male`, and it
 * costs the customer nothing.** Two grounds, in order:
 *
 *  1. **It loses no capability.** What Basics actually unlocks is `upperChest`
 *     (§5.1) — one placement, the one whose vocabulary entry already says
 *     `skin: "dependsOnGarment"`. The spec's own words are that the top is cut
 *     low enough to show a chest piece, so the covered form delivers the whole
 *     point of the path. This is not a lesser option; it is the same option
 *     with a top on.
 *  2. **The two failures are not symmetrical.** Rendering somebody shirtless
 *     who did not ask to be is a failure a customer feels; rendering somebody
 *     in a plain black top who would have been happy either way is not. When
 *     one branch of a default is unrecoverable and the other is a shrug, the
 *     shrug is the default.
 *
 * The alternative — refusing Basics for a cast whose sex is unstated — is
 * D-180's dead end wearing a toggle: a control the product offers and then
 * declines to honour.
 */
export function basicsWardrobeLine(sex: string | null | undefined): string {
  if (sex === "male") {
    return "shirtless, in plain black fitted shorts, barefoot";
  }
  return "a plain black sports top scooped low at the chest, plain black fitted shorts, barefoot";
}

/**
 * THE LINE A ROLL IS BORN WITH, before anybody has edited anything.
 *
 * This is the WRITE side's owner and `currentWardrobeLine` is the READ side's;
 * they are in one file so that the sentence a roll is stamped with and the
 * sentence every reader derives cannot come from two places.
 *
 * Case (a) — *her words win* — and case (b) — *the engine picks one per sheet*
 * — are the PICK, and they arrive with the brief stage. `named` is the seam
 * they land on: when it is present it is already the resolved, complete,
 * door-checked outfit, and this function's only job is to prefer it.
 */
export function bornWardrobeLine(input: {
  path: CastingPath;
  sex?: string | null;
  /** A resolved outfit from the brief — cases (a) and (b) of §4. */
  named?: string | null;
}): string {
  if (input.path === "basics") {
    /*
      ⚠ THE BASICS SPEC IS NOT NEGOTIABLE BY A BRIEF, and that is the ruling
      rather than an omission. The path IS the outfit — "born and signed in
      plain black basics" is what the customer chose when she chose it, and a
      brief that also names a red apron has asked for the other path. Letting a
      named outfit through here would make the two paths one path with a
      confusing name, and it would break the promise the Basics toggle makes
      about the chest being bare.
    */
    return basicsWardrobeLine(input.sex);
  }
  return stated(input.named) ?? HOUSE_WARDROBE_LINE;
}
