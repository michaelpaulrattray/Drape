/**
 * WHAT THIS PERSON IS WEARING — one owner, and every reader derives from it
 * (design `docs/specs/CASTING_V2_TWO_PATHS_DESIGN.md` §3.3, and CONDITION (v)
 * of the countersign, fable-1334 §2).
 *
 * # The gap this closes
 *
 * Nothing in this product owns that sentence today. The roll prompt hard-codes
 * one wardrobe line inside a framing constant, the five signed views hard-code a
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
 * wardrobe edit** whose five views would be judged against the born line it is
 * no longer wearing — five views, the wardrobe axis, **refunded slices**, which
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

/**
 * Where the answer came from. `edited` beats the other — that IS condition (v).
 * `brief` is the line the customer's own brief stated (#1222), recorded on a
 * roll that has no path because the paths are retired (#203).
 *
 * Exported with #1222 because the ink readers branch on it: a `brief` line
 * DRESSES AND JUDGES the five views and deliberately does NOT move ink
 * coverage — see `wardrobeCoversSurface`'s brief arm for the declared reason.
 *
 * ⚠ **IT HAD A THIRD MEMBER, `born`, AND IT IS RETIRED — #1577 slice 2 (item
 * B1), 2026-10-15.** It meant *the outfit one of the two retired paths stamped
 * on this roll*, and it was told apart from `brief` by the only thing that ever
 * distinguished them: a non-null `path` column beside the line. With the path
 * no longer read (see {@link WardrobeBranch}), this function cannot make that
 * distinction and must not pretend to — so every stored line now resolves
 * `brief`, which is what every line a fresh roll can write actually is.
 *
 * **Measured in both worlds before the member went, because the SNAPSHOT reader
 * below hands this type back off a stored blob:** production holds **zero**
 * signed casts whose `technicalSchema.wardrobe.source` is `born` (and zero with
 * a non-null `wardrobe.path`); dev holds **four**, the verify-bot signed
 * fixtures. ⚠ **And it changes the reading of neither, which is a property of
 * the consumers rather than of the counts:** every snapshot-side reader is typed
 * `string | null` and branches on `"brief"` ALONE —
 * `coverageOfSnapshotWardrobe` through `placementRideCoverage`, whose own
 * docblock already says *"Absent means not brief"* — so `born`, `edited`, `null`
 * and absent were always one answer there. A row holding `born` reads `null`
 * now and takes the same arm it took yesterday.
 */
export type WardrobeLineSource = "edited" | "brief";

/**
 * TWO CASES, AND IT HELD THREE UNTIL #1577 SLICE 2.
 *
 * `line`     this person is wearing a known outfit — the brief's own stated
 *            one (`source: "brief"`), or an edit, which beats it
 *            (`source: "edited"`).
 * `unpathed` no line at all: the roll predates the paths, was cast before
 *            #1222, or its brief named no outfit. **This is not an error and
 *            never becomes one** — a reader's correct response is to behave
 *            exactly as the product always has. ⚠ The NAME is the retired
 *            road's and is kept deliberately (the audit's item B2: *current
 *            machinery under an old-lane name; a rename is cosmetic and not
 *            proposed*).
 *
 * ⚠ **THE THIRD CASE WAS `incoherent` — *this roll claims a path and cannot say
 * what it is wearing* — AND IT IS RETIRED WITH THE PATHS (#1577 slice 2, item
 * B1, 2026-10-15).** It was never producible by the write path (a path and a
 * line were stamped in one insert) and was given a name anyway, because it and
 * `unpathed` demanded opposite behaviour: `unpathed` says *paint what you always
 * painted*, while `incoherent` had to refuse rather than paint the default grey
 * tee onto a cast whose whole purpose might be a bare chest.
 *
 * **It is gone because its input is gone, not because it was judged
 * unreachable** — with the `path` no longer read there is no claim left for a
 * roll to make. Read at the rows on the way out: of the thirteen pathed rolls
 * production holds, **zero** are in that shape (every one carries a line), and
 * none of the thirteen holds a candidate, so no refine or Sign could have
 * reached one anyway.
 *
 * ⚠ **The `path` FIELD went with it, and `casting_rolls.path` the COLUMN did
 * not** — #203's ruling keeps the column as the record of which rolls predate
 * the author road. What this slice retires is the THREADING of it into this
 * resolution, which is the audit's item B1 exactly.
 */
export type WardrobeResolution =
  | { kind: "line"; line: string; source: WardrobeLineSource }
  | { kind: "unpathed" };

/**
 * The facts a resolution needs, all of them already on rows the caller has.
 *
 * `editedLine` is `undefined` everywhere in the product today: the WARDROBE
 * subject that writes it is the REFINE slice, and it is named here first so
 * that when it arrives there is one place it can land rather than six.
 */
export type WardrobeBranch = {
  /**
   * `casting_rolls.wardrobeLine` — the stored outfit of the sheet.
   *
   * ⚠ **THIS TYPE CARRIED `rollPath` BESIDE IT UNTIL #1577 SLICE 2 (item B1),
   * and that field is what this slice retires.** It was `casting_rolls.path`,
   * threaded in from refine's two call sites and Sign's, and it did exactly two
   * jobs: it told a `born` line from a `brief` one, and it made `incoherent`
   * expressible. Both are gone with it, and the reasoning is at
   * {@link WardrobeLineSource} and {@link WardrobeResolution}.
   *
   * **The column is untouched** (#203's ruling), and so is the SELECT that
   * reads `wardrobeLine` beside it; what went is the four places that carried
   * the path into this function.
   */
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
  const stored = stated(branch.rollLine);
  const edited = stated(branch.editedLine);

  /*
    ⚠ A LINE WITHOUT A PATH WAS `unpathed` UNTIL #1222, THEN THE PATH STOPPED
    BEING READ AT ALL — #1577 slice 2. The history is kept because the arm here
    has now inverted twice, and the second inversion is this one.

    The arm that first stood here DISCARDED a line nobody chose a path for, on
    the grounds that in the two-paths world the columns were stamped together so
    line-without-path could only mean a torn write. #203 retired the paths — the
    column is a constant `null` on every fresh roll — and #1222 made the author
    road record the brief's own stated outfit on exactly that shape. So
    line-without-path became the ONLY form a fresh roll's line can take, and
    that first arm was the reason his Sifr views could never have read the dress
    even once the column held it.

    What this slice removes is the LAST READER of the column here. A stored line
    is a stored line, and the one thing the path still decided — whether to call
    it `born` or `brief` — is a distinction no reachable row can make: the
    thirteen pathed rolls production holds carry no candidate, so neither a
    refine nor a Sign can reach one.

    The order is condition (v)'s and is untouched by any of that: an EDIT is
    what this person is wearing now and beats what they were born in — a Cast
    signed after a wardrobe edit judged against its born line is refunded
    slices, and that argument never depended on the path column.
  */
  if (edited !== null) return { kind: "line", line: edited, source: "edited" };
  if (stored !== null) return { kind: "line", line: stored, source: "brief" };
  return { kind: "unpathed" };
}

/**
 * THE BRANCH'S OWN WARDROBE EDIT, READ OFF ITS COMPOSED DELTA — the seam
 * {@link WardrobeBranch.editedLine} was named for (item 8, ruled fable-1455 Q2).
 *
 * # Why the delta and not a column
 *
 * The composed delta is already the per-branch, per-fork, removal-arithmetic
 * owner of every free subject, and the wardrobe card is `plural: false` — which
 * IS §7.1's rule (*an edit REWRITES the stored line rather than appending to
 * it*) rather than a coincidence that happens to match it. A column would be a
 * second copy of a fact the delta holds, on a written table, needing a
 * migration to say what is already said.
 *
 * # It takes the COMPOSED delta, and the difference is the whole of D-163
 *
 * Hand it one step's own delta and it answers about that step rather than about
 * the branch, which is how a stack quietly loses its earlier edits. Callers
 * pass what `readStoredDelta` gives them.
 *
 * `joinItems` rather than a cast: a free value is a string OR a list of them
 * across the eras this column spans, and one owner reads that shape everywhere.
 */
export function editedWardrobeLine(delta: { free?: Partial<Record<string, unknown>> } | null | undefined): string | null {
  const value = delta?.free?.wardrobe;
  if (value === undefined || value === null) return null;
  const items = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : typeof value === "string" ? [value] : [];
  const joined = items.join(", ").trim();
  return joined.length > 0 ? joined : null;
}

/**
 * WHAT A SIGNED CAST IS WEARING — read back off its own snapshot.
 *
 * Sign stores the RESOLVED answer in `technicalSchema.wardrobe` (§3.1), and the
 * five views and their judge are composed from what this returns. It lives here
 * rather than beside the package because there is one owner of this sentence
 * and a second reader written elsewhere is the parallel-copy shape.
 *
 * ⚠ **It answers `null` for anything it does not recognise, and that is the
 * safe direction.** `technicalSchema` is an unstructured JSON column written
 * across several eras: every Cast signed before the paths existed has no
 * `wardrobe` key at all, and `null` means *compose and judge exactly as the
 * product always has*. The alternative — throwing, or inventing the house line
 * — would either break a room that renders today or dress a Cast in an outfit
 * nobody chose for it. Same reasoning, same column, as `castPronouns`.
 */
export function castWardrobeLine(technicalSchema: unknown): string | null {
  if (!technicalSchema || typeof technicalSchema !== "object") return null;
  const wardrobe = (technicalSchema as { wardrobe?: unknown }).wardrobe;
  if (!wardrobe || typeof wardrobe !== "object") return null;
  return stated((wardrobe as { line?: unknown }).line as string | null | undefined);
}

/**
 * WHERE A SIGNED CAST'S LINE CAME FROM — the snapshot's other half (#1222).
 *
 * The ink readers need it: a `brief`-sourced line dresses and judges the five
 * views and deliberately does NOT move ink coverage (see
 * `coverageOfSnapshotWardrobe`), so a reader holding only the string cannot
 * make that call. `null` for anything unrecognised, the same safe direction as
 * `castWardrobeLine` above — an old snapshot with a line and no source reads
 * as a non-brief line, which keeps the pre-#1222 semantics for pre-#1222 rows.
 */
export function castWardrobeSource(technicalSchema: unknown): WardrobeLineSource | null {
  if (!technicalSchema || typeof technicalSchema !== "object") return null;
  const wardrobe = (technicalSchema as { wardrobe?: unknown }).wardrobe;
  if (!wardrobe || typeof wardrobe !== "object") return null;
  const source = (wardrobe as { source?: unknown }).source;
  /* ⚠ `"born"` LEFT THIS SET WITH #1577 SLICE 2 AND THE READING DID NOT MOVE.
     A stored `born` now answers `null`, and `null` takes the same arm `born`
     took: every consumer of this value is typed `string | null` and branches on
     `"brief"` alone (`coverageOfSnapshotWardrobe`, reached through
     `placementRideCoverage`, whose docblock says *"Absent means not brief"*).
     Measured before the member went — production holds zero such snapshots,
     dev holds four — but the counts are the second reason and not the first:
     the consumers make it a no-op whatever any row holds. */
  return source === "edited" || source === "brief" ? source : null;
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
 *
 * # WHY THIS SURVIVES THE RETIREMENT, AND THE RULING IT CARRIES
 *
 * ⚠ **Nothing WRITES a basics sentence any more** — #203 slice 2 step (e)
 * deleted the born road. This function stays because it is still the one
 * declaration of what those sentences SAY, and `inkSurfaceCoverage.ts` derives
 * its `BASICS_LINES` coverage rows from it so that a historical basics cast
 * refined today gets its chest read correctly rather than from copied strings.
 *
 * ⚠ **AND IT CARRIES THE RULING THE RETIRED BRANCH USED TO HOLD, because a
 * ruling outlives the code that obeyed it.** *The Basics spec is not negotiable
 * by a brief:* the path IS the outfit — *"born and signed in plain black
 * basics"* is what the customer chose when she chose it, and a brief that also
 * names a red apron has asked for the other path. Letting a named outfit
 * through would make the two paths one path with a confusing name, and it would
 * break the promise Basics makes about the chest being bare. **Anybody
 * re-opening a born-outfit road meets that here, before writing it.**
 */
export function basicsWardrobeLine(sex: string | null | undefined): string {
  if (sex === "male") {
    /*
      ⚠ IT SAID `shirtless` UNTIL 2026-08-25, AND THE WORD WAS COSTING HIM ONE
      SLICE IN FOUR — swapped on the FOUNDER'S OWN wording test (relayed
      fable-1659 §1), which is the same construction the legacy VTO road has
      made for a year: **rename the flagged NOUN, change nothing about the
      object.**

      His test, his account, his words: *"shirtless is a genuine NSFW flag for
      gpt image 2 so i tried 'bare chested' and it seemed to work for 4/4 where
      as shirtless was a 2/4."* n=4 each, and it is quoted as a DIRECTION rather
      than a rate.

      Our own isolation, on his rolls, arrived at the same door independently:

        basics    "shirtless, …"          4 refused / 16   25.0%  (Wilson 10-50%)
        wardrobe  six clothed lines        0 refused / 48    0%
        unpathed  house crew tee           0 refused / 31    0%
        Fisher exact, two-tailed                            p = 0.00286

      Every refusal was `content_policy` with the provider naming
      `["body","prompt"]` — the PROMPT checker, before any image existed. Same
      brief family, same account, inside fifteen hours; Two Paths put him on
      Basics and the refusals started with the line.

      **This preserves the trade rather than reversing it.** The picture is
      identical — same body, same coverage, `BASICS_COVERAGE.upperChest` stays
      `bare`, the chest-ink road untouched. It is strictly narrower than the
      alternative on the table (swap the garment for a fitted tank), which would
      have covered the chest and taken the path's whole point with it.

      **The confirming read costs nothing and is already wired**: the refusal
      counter by wardrobe line gives the real rate free on his future Basics
      rolls. If `bare chested` still refuses materially, the garment question
      re-opens with numbers rather than with a hunch.

      ⚠ **The retired sentence does NOT disappear from the product** — two
      production rolls (#215, #216) are stamped with it, and
      `inkSurfaceCoverage.ts` derives its known-Basics set from THIS function.
      See `RETIRED_BASICS_LINES` there: dropping the old string would silently
      turn those two casts' chest, neck and arm from `bare` to `unknown`.
    */
    return "bare chested, in plain black fitted shorts, barefoot";
  }
  /*
    ⚠ THE SCOOP WENT LOWER ON 2026-08-23, AND IT WAS THE FOUNDER'S CALL ON A
    MEASUREMENT RATHER THAN A TASTE PREFERENCE (FQ-b, relayed fable-1460).

    The old sentence was *"a plain black sports top scooped low at the chest"*,
    and it was written from this design's own §5 rather than from a photograph.
    The Two Paths court then rolled eight of them and read the chest with the
    mint's own word: **`upper chest` returned 0 px on 4 of 4**, and so did
    `chest skin` and `chest`. The skin is plainly visible in the frames — his
    eyes, and mine — and the reader will not name it, which is the state that
    decides whether a chest piece can be cropped and CARRIED. A tattoo painted
    there would be delivered and then lost on her next edit, which is the one
    thing this product promises never to sell.

    So the card went to him with the alternative stated: lower the top, or say
    Basics does not serve chest ink and lose most of the reason for the path.
    His answer, verbatim: *"if it can be less without hitting any safety
    restrictions do it."*

    **It is still a sports top and it is still a body record.** What changed is
    that the sentence now says WHERE the neckline sits and WHAT is bare, instead
    of saying "low" and leaving the engine to decide how low — the same
    latitude-removal `HOUSE_WARDROBE_LINE` above exists for, one garment over. A
    word like "low" is a comparative with no referent, and an image model
    resolves those toward the ordinary.

    ✅ **THE RE-COURT REPORTED AND THE CHEST READS** — 12 of 12 across three
    sheets and two wordings, against 0 of 4 before. `BASICS_COVERAGE.upperChest`
    is `bare` with those courts as its provenance, and that value moved in the
    commit that carried his answer rather than in the one that carried the
    court.

    ⚠ **AND THIS SENTENCE COSTS ABOUT ONE SLICE IN FOUR, WHICH IS THE PART A
    READER MUST NOT DISCOVER.** The lowered neckline trips the image provider's
    PROMPT content checker: 6 refused of 24 slices across the three sheets,
    every one `content_policy` with the provider naming `body.prompt`, against 0
    of 8 on the original wording. On that n the true rate could honestly be one
    in ten or one in two.

    **It is not a wording problem and that was measured, not assumed.** A
    deliberately milder sentence — no *bare*, no *sternum*, no *upper chest* —
    refused MORE often (3 of 8 against 3 of 16). Two phrasings as different as
    could be written while keeping the neckline produced the same outcome, so
    there is no third sentence to try with a story behind it.

    **The founder was shown that number and kept the lower top** (*"framing is
    fine and so is everything else"*, relayed fable-1465). The trade he took: a
    missing face on a sheet is visible, recoverable and honestly refunded — she
    is charged for what she receives — while a tattoo that renders and then
    vanishes on the next edit is the one thing this product promises never to
    sell. **Do not "fix" this by raising the neckline; that is the decision
    being reversed, not a defect being repaired.**
  */
  return "a plain black scoop-neck sports top cut well below the collarbones so the whole "
    + "upper chest and sternum are bare, plain black fitted shorts, barefoot";
}

/*
  ⚠ **THE WRITE SIDE STOOD HERE AND IS GONE — #203 slice 2, step (e), the
  retirement's LAST step.** `bornWardrobeLine` (which path a new roll is born
  wearing) and `sheetBasicsSex` (which of the two Basics forms a whole sheet
  resolves to) are deleted, and this file is now a READ side alone:
  `currentWardrobeLine` over the stored pair, plus the two constants the stored
  sentences are made of.

  **They were UNREACHABLE, not merely unused, and that is why they went.** Slice
  1 (`67f422b9`) made the compiler's `path` a named constant `null`; step (d)
  removed the `named` seam; so from slice 1 onward `bornWardrobeLine` was called
  only from a ternary arm that `null` could never take, and `sheetBasicsSex` had
  no caller but that arm. A function whose only road is a dead branch reads to
  the next person as live machinery.

  # WHAT IS DELIBERATELY KEPT, AND WHY EACH ONE STAYS

  - **`basicsWardrobeLine`** — it still has a live non-test consumer.
    `inkSurfaceCoverage.ts` DERIVES `BASICS_LINES` from it, because a stored
    basics sentence on one of the thirteen historical pathed rolls must still
    have its coverage read when that cast is refined today. Deriving it there
    rather than copying the strings is working law 4 and outlives the writer.
  - **`HOUSE_WARDROBE_LINE`** — the sentence every unpathed cast wears, read on
    every road.
  - **The Basics spec's own argument** — *the path IS the outfit, and a brief
    naming a red apron has asked for the other path* — is not lost with the
    branch that carried it: it lives in `basicsWardrobeLine`'s own docblock,
    where anybody re-opening a born road meets it before writing, not after.
  - **`CASTING_PATHS` and the columns** — see `shared/castingPaths.ts`. The
    vocabulary is a PREREQUISITE of the retained columns, not a remnant of the
    retired road.

  # AND THE READ SIDE'S OWN TWO-PATHS HALF WENT 2026-10-15 — #1577 SLICE 2

  The audit's item B1. What this file lost, and each one is reasoned at its own
  declaration above rather than only here: **`WardrobeBranch.rollPath`** (the
  threading), **`WardrobeResolution`'s `path` field and its `incoherent`
  arm**, and **`WardrobeLineSource`'s `born` member**. The four call sites that
  carried the path — refine's door, refine's variant landing, Sign, and the
  two db projections that selected it — carry it no longer.

  **WHAT WAS MEASURED BEFORE ANY OF IT WAS CUT**, because a read path is the
  one thing this file is not allowed to break:

  - Production holds **13 pathed rolls and every one has ZERO candidates**, so
    no refine and no Sign can reach a pathed branch. Re-read 2026-10-15; the
    audit measured the same on 2026-09-23.
  - **Zero of those thirteen are in the `incoherent` shape** — every one
    carries a line — so the kind was unreachable from the DATA as well as
    from the code.
  - **Zero signed casts anywhere hold `wardrobe.source: "born"` on production**
    (and zero hold a non-null `wardrobe.path`). **Dev holds four**, the
    verify-bot fixtures.
  - ⚠ **And those four do not change their reading, which is a property of
    the CONSUMERS rather than of the counts** — the whole snapshot chain is
    typed `string | null` and branches on `"brief"` ALONE, so `born`, `edited`,
    `null` and absent were always one answer there. That is the argument that
    made this safe; the row counts are its second witness.

  ⚠ **TWO THINGS THE SLICE TURNED UP AND DELIBERATELY DID NOT FIX**, because
  folding a second retirement into a retirement is the thing his 2026-09-24
  ruling forbids. Both are filed:

  1. **The ink-form demand counter now has no reachable road at all.** Its
     guard wanted a non-`brief` source; `born` was the one that reached it, and
     the only survivor is `edited`, which needs the `wardrobe` free subject —
     and `refineSubjects.ts` says in as many words that it *"is served to
     nobody"*. It was already unreachable before this slice (a `born` branch
     needs a pathed roll with a candidate: none exists), and
     `casting_ink_form_demand` holds **zero rows in both worlds, all time**.
     What changed is only HOW it is shut.
  2. ~~**`HOUSE_WARDROBE_LINE` cannot be stored as a wardrobe edit.** It is 132
     characters and `MAX_FREE_LENGTH` is 120, and an over-long free value makes
     the strict reader reject the WHOLE delta rather than that one key — so
     the branch reads `unpathed`. It is the only line whose upper chest reads
     `covered`, which is why the demand table's `surfaceCovered` kind has no
     road either. Measured at the reader while re-pointing the arms.~~

     ✅ **FIXED — #2552, 2026-10-27.** `wardrobe` has its own cap of 245 now,
     derived in `FREE_SUBJECT_MAX_LENGTH`'s own docblock from the longest
     outfit sentence this file composes. **All four of this file's sentences
     store as edits** — the guard is `refineDelta.test.ts` › *"⚠ THE CLASS —
     every outfit sentence the product writes can be stored under
     `wardrobe`"*, and its population is DERIVED from these functions, so a
     fifth sentence or a reworded one is measured the day it lands.

     ⚠ **It was raised because the subject went LIVE, not to feed the demand
     table.** #2544 slice 1 serves `wardrobe` to a flagged account, so the
     over-long case stopped being latent: a customer's own five-part outfit
     sentence was losing the whole edit and being told it *"didn't come
     through clearly"*. The `surfaceCovered` road opening is a consequence of
     that and is **#2551**'s to judge, not this file's.

     ⚠ **And what is NOT fixed: a value past the NEW cap behaves exactly as
     before** — whole delta dropped, three model samplings, the same untrue
     sentence. That is **#2714**, filed rather than folded in.
*/
