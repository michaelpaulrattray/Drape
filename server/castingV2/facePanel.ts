/**
 * THE FACE PANEL — panel v2's rows, derived from the catalogue and the library.
 *
 * Panel v1 (`segmentsOnFace.ts`) lists what a version is KEEPING: one row per
 * segment the undo store holds, which means a face that has never been edited
 * has no panel at all. The founder's v2 ruling is the opposite shape —
 * *"everything editable by default, even on the untouched original"* — so the
 * rows are the **catalogue**, and the library says what each one currently is.
 *
 * Two sources, each answering the thing it owns:
 *
 *   the catalogue   which slots exist, their group, their noun, their plural
 *   the library     what has been said about a slot, and the crop it minted
 *
 * # A ROW WITH NO BOX IS NOT GIVEN ONE
 *
 * Hovering a row highlights its region on the picture, and the founder's own
 * spec (fable-200) makes the picture clickable by feature. Both need geometry,
 * and geometry exists only where a crop was actually minted — everything else
 * has never been read on this face. So a row without geometry has **no box and
 * no click target**, and the panel draws nothing for it rather than a rectangle
 * placed by proportion. The mock could invent boxes because it labelled them
 * INVENTED in a column beside themselves; a product cannot, because a box drawn
 * over the wrong pixels is a promise that clicking there edits that thing.
 *
 * **That day has arrived for a scanned face** (fable-373/374). A `scan` handed
 * in says where each feature is ON THIS FRAME, so a face nobody has edited gets
 * its boxes and its cutouts from what the picture already contains rather than
 * from what an edit minted. The rule above is unchanged and is why the scan is
 * a READING and not a proportion: without one, the rows are still tappable —
 * which is what scopes the ask — and the image is still clickable only where it
 * has been measured.
 *
 * # A ROW WITH NOTHING IN IT DOES NOT EXIST
 *
 * The founder, looking at his own face on the shipped panel (fable-382 §1):
 * *"i dont think eyelashes really needs to be there · cheekbones or jaw or
 * chin"* — against his earlier ruling that only the rows real pictures have
 * should be listed. Two rules, and they are different rules:
 *
 *   the catalogue says a slot has NO ROW      structure is words (fable-360),
 *                                             lashes are read on the eyes
 *   this file says a row has NO CONTENT       nothing pictured, nothing said
 *
 * The first is a decision about the product's shape and lives in the catalogue
 * beside the slot it is about. The second is a fact about THIS face, so it is
 * computed here, per face, every time: a row appears when it has a thumbnail or
 * something said about it, and otherwise it is not on screen at all. An empty
 * square with a label is a promise of a picture that does not exist.
 *
 * **What that costs, said out loud**: on a face with no scan and an empty
 * library the panel is EMPTY rather than a list of everything askable. The ask
 * box under the picture still reaches every slot, including the ones with no row
 * (his facial structure), so nothing became unaskable — the panel stopped being
 * a menu and became a description.
 *
 * # A PAIR IS ONE ROW UNTIL IT ISN'T
 *
 * Stored as instances, spoken as pairs, split on divergence (fable-167) — and
 * the split is DERIVED from the words every time, never a flag (`presentPair`).
 * Two matched earrings are "her earrings"; make one bigger and the row becomes
 * two, and make them match again and it becomes one, because there was never a
 * flag to clear.
 *
 * # It is a pure projection
 *
 * Rows in, rows out: no database, no storage, no clock. The panel's copy and its
 * grouping are testable without a face, which is what made v1's pronoun defect
 * (a man's eyes called "hers") catchable in a unit test rather than in front of
 * the founder.
 */
import { capitalize, type CastPronouns } from "./castPronouns";
import { onTheFace, type FaceExtent } from "./faceExtent";
import type { FeatureKind } from "./faceDiscovery";
import { catalogueWordsOf, isPlainAnatomy, normalisedName, type NamedNotCut } from "./pointerCut";
import type { FeatureSlot } from "./recipeAssembler";
import { liveReferences, type StoredReference } from "./referenceLibrary";
import {
  catalogueSlots,
  slotDefinition,
  type SlotDefinition,
  type SlotGroup,
} from "./referenceSlotCatalogue";
import {
  INSTANCES,
  type Instance,
  openKindOfSlot,
  pairHasDiverged,
  slotKey,
} from "./referenceSlots";

/**
 * A PANEL SECTION — the catalogue's four groups, and the one that is not a
 * catalogue group at all.
 *
 * `SlotGroup` is a fact about the CATALOGUE: which part of a face a courted
 * slot belongs to. `open` is a fact about this PANEL: a place for the things
 * this cast has that the catalogue has no word for. Widening `SlotGroup` to
 * hold it would put a value in the closed vocabulary that no catalogue entry
 * can ever carry, so the widening lives here, where the concept does.
 *
 * ⚠ **THERE WAS A SECOND ONE — `wardrobe` — AND IT IS RETIRED WITH THE PATHS
 * (#203 slice 2, 2026-09-24).** Its rows came from the stored wardrobe LINE
 * rather than from any slot, and they existed only on a cast born on the
 * Wardrobe path, which slice 1 made unbuyable. No account has ever seen the
 * heading: a section with no rows is filtered out below. The decomposition and
 * the garment-crop court that explains why those rows carried no picture are
 * kept in `wardrobeCards.ts`, and `#1148` is where a customer getting her
 * clothes back is decided.
 *
 * ⚠ **AND THE PANEL'S OTHER PATH READING WENT WITH IT THE SAME WEEK — the
 * *"as dressed"* label (§6.1, ruled fable-1467 as §8.2's part (b), retired
 * #203 slice 2 step (b)).** It was a third channel beside a row's words and
 * its absence: `build` and `skin` are measured through a garment, so on a cast
 * born on the Wardrobe path those two rows said which world their picture came
 * from. **Nobody has ever seen it.** It was drawn on that path alone —
 * deliberately not on Basics, where the row is still unmeasured, and
 * deliberately not on an unpathed cast, where the sentence would have been
 * TRUE (they all wear the house crew tee) and drawing it would have changed a
 * live surface for accounts that had never met the feature. With the paths
 * unbuyable the label's one state is unreachable, so the field, the catalogue's
 * `pathProvenance`, the span and its class are gone rather than left returning
 * null forever. **The honesty problem it made visible is not fixed and was
 * never fixed by it**: a below-head crop is still a dressed torso and `skin`'s
 * 11.5–12.5% was still read on frames of people in a crew tee — the catalogue
 * still says so at both slots, in the paragraphs the label used to end.
 */
/**
 * ⚠ **AND THERE IS A THIRD ONE NOW — `outfit` (#2566 slice 2's grouping
 * design, rule 5).**
 *
 * Like `open` it is a fact about this PANEL rather than about the catalogue, so
 * it lives here for the same reason: no catalogue entry can ever carry it. It
 * differs from `open` in what it holds — `open` is *things this cast has that
 * the catalogue has no word for*, one row each, and `outfit` is **one row**
 * holding the whole look, however many pieces the reading found.
 *
 * His own complaint is why it exists: six garment nouns became six sibling
 * rows, and *"the outfit is ONE row"* is the design's answer. A customer
 * looking at their cast does not have a list of garments in mind, they have an
 * outfit — law 8, the stylist's ontology over the reader's.
 */
export type PanelSection = SlotGroup | "open" | "outfit";

/**
 * The panel's sections, in the order they are read on a face.
 *
 * # AND THE LAST ONE IS NOT A PART OF A FACE (design opus-1041 §4, heading
 * ruled fable-1397 §2)
 *
 * An open kind carries an `anchorRegion` read off the KIND, and grouping by it
 * was measured wrong on the only two specimens there are: the store says the
 * orb's region is `wholeBody` while her own sentence says *"embedded in the
 * centre of her forehead"*, so grouped by the store it files under **Body**,
 * where nobody would look for a forehead. That is law 8's ontology failure
 * produced by trusting a reader on a question the customer already answered.
 *
 * So it is a section of its own, and the heading claims nothing about anatomy:
 * it says these are also on this cast, which is the only thing we know.
 */
export const PANEL_GROUPS: readonly { group: PanelSection; heading: string }[] = [
  { group: "face", heading: "Face" },
  { group: "hair", heading: "Hair" },
  { group: "body", heading: "Body" },
  /*
    BETWEEN BODY AND ACCESSORIES, which is the design's own placement and reads
    the way a person describes somebody: the face, the hair, the build, then
    what they are wearing, then what they are wearing ON it.

    An empty section already filters out below, so a close-cropped or undressed
    cast simply has no Outfit heading — there is no "no outfit" state to design
    and none was.
  */
  { group: "outfit", heading: "Outfit" },
  { group: "accessories", heading: "Accessories" },
  { group: "open", heading: "Also on this character" },
];

/**
 * THE ONE OUTFIT ROW'S KEY.
 *
 * ⚠ **It cannot collide with a found row's key and that is STRUCTURAL rather
 * than lucky**: `discoveredSlotOf` always ends `#<instance>`, from 1, so a
 * reading that found a thing it called *outfit* keys it `discovered:outfit#1`
 * and this stays the row nobody found. `pointerCut.test.ts` holds the same
 * non-collision for the catalogue and the open lane.
 *
 * ⚠ **AND NOTHING MAY READ A WORD OUT OF IT.** The heading is authored above —
 * *Outfit* is the PRODUCT's word for the collection, not any customer's and not
 * any reading's, because there is no single noun the reading gave for *all of
 * these pieces together*. Each piece keeps its own noun as a child.
 */
export const OUTFIT_SLOT = "discovered:outfit" as FeatureSlot;

export type PanelBox = {
  /** In the frame's own pixels — the frame it was measured on travels with it,
   *  because a box without its frame is a rectangle in an unknown space. */
  x: number;
  y: number;
  width: number;
  height: number;
  frame: { width: number; height: number };
};

/**
 * WHAT A SCAN CONTRIBUTES — the frame, and a shape per feature on it.
 *
 * A scan mints nothing (fable-373 ruling 4a), so a scan-born thumbnail is the
 * frame the viewer is already showing, cut by the box and stencilled by the
 * mask. One picture, eight shapes, no objects.
 */
export type PanelScan = {
  frameUrl: string;
  slots: ReadonlyMap<FeatureSlot, { box: PanelBox; maskUrl: string }>;
  /**
   * WHAT THE SCAN COULD ONLY SAY — one line for a row that can never be
   * pictured (fable-388 §1, fable-389 §1).
   *
   * A separate channel from `slots` because it answers a different question:
   * `slots` is geometry and this is prose. Both rows now have geometry too —
   * her build's is composed and her skin's is drawn from a region it may never
   * be cut from (fable-428) — and that is what puts them on the panel at all
   * under the box rule. This is what they SAY once they are there.
   *
   * It is DISPLAY either way: a description read off the frame is not a library
   * row, so it is never carried into a recipe or checked in a render.
   */
  words?: ReadonlyMap<FeatureSlot, readonly string[]>;
  /**
   * WHAT THE SCAN ASKED ABOUT AND FOUND NOTHING OF (founder ruling fable-889,
   * `PANEL_ABSENT_STATE_DESIGN.md`).
   *
   * A third channel because it is a third fact, and the whole ruling turns on
   * telling it from the other two: a slot missing from `slots` used to be one
   * thing from this side — nothing — whether the reader asked and got a clean
   * nothing, errored on that question, or never ran at all. FOUND-NOTHING is
   * what a bald head produces, and it is the only one of the three a row may
   * speak about.
   *
   * Derived in `panelScanOf` from the scan's own `empty`, never accumulated
   * beside it. Absent (rather than empty) on a panel built without a scan, so
   * "nobody looked" cannot be read as "nothing is there".
   */
  absent?: ReadonlySet<FeatureSlot>;
  /**
   * WHAT THE READING FOUND THAT NO CATALOGUE QUESTION COVERS — a jacket, a
   * sash, a third eye, a mole (#2566 slice 2's pointer road).
   *
   * A FOURTH channel, and a LIST rather than a map, for the one reason this
   * could not be folded into `slots`: **the noun is the customer's own and
   * arrives as data.** Every other row on this panel gets its name from the
   * catalogue, and nobody catalogued these — so the geometry cannot travel
   * keyed by slot with the word left to be reconstructed. `found:`-style keys
   * cannot say whether the reading wrote *cat ears* or *cat-ears*, which is the
   * open lane's own binding condition arriving again.
   *
   * Absent on a panel built without a scan and empty on a reading that found
   * nothing off the list; both draw no such rows, which is today's panel.
   */
  discovered?: readonly {
    slot: FeatureSlot;
    noun: string;
    instance: number;
    /**
     * WHAT THE READING SAID IT IS AND WHAT IT SITS ON — the only two facts this
     * panel groups by (#2566 slice 2's grouping design).
     *
     * `kind: "clothing"` is the ONLY thing that may enter the Outfit row,
     * `kind: "accessory"` lists under Accessories (his ruling of 2026-10-29,
     * #2789), and `on` is what chains a buckle to its strap. (A worn thing
     * whose `on` chain ends at a garment is inside the outfit too, and since
     * #2862 it draws no row there: only `clothing` is a piece row.) Both are the
     * reading's own
     * answer about the picture, which is the whole point: his ⚠ on the finding
     * was that the body implants were labelled *Collar*, so any rule keyed on
     * the WORD sweeps hardware into clothing. The measured reader put body
     * hardware in `anatomy` 4 of 4 times, and its one miss landed in
     * `accessory` — neither of which can enter it.
     */
    kind: FeatureKind;
    on: string;
    box: PanelBox;
    maskUrl: string;
    /**
     * DOES THIS SHAPE LIE OVER THE FACE'S OWN CUTS — his check 1 (#2856,
     * 2026-10-30), measured at the pixels by `faceScanService` and carried.
     *
     * ⚠ **This panel cannot ask it and that is why the fact travels.** A
     * `facePanel` is a pure projection — *"rows in, rows out: no database, no
     * storage, no clock"* — and by the time a row reaches here its shape is a
     * base64 PNG. The one moment both this shape and the scan's face cuts are
     * raw bytes is inside the scan service, so that is where it is answered.
     *
     * ⚠ **And it is the BOX that is not the question, which is his own
     * correction**: *"im not worried about the box covering the neck that sort
     * of normal if its the outfit or whatever"*. A rag cloth or a high collar
     * has a rectangle reaching the chin and is still outfit.
     *
     * Optional, and absent means *not covering* — a reading kept before the
     * check existed, and the live preview a scan serves while it is still
     * running, both arrive without it and both draw today's panel exactly.
     */
    coversFace?: boolean;
  }[];
  /**
   * WHAT THE READING NAMED AND NOTHING CUT — words with no picture (#2566
   * slice 2's grouping design, rules 2 and 4).
   *
   * A FIFTH channel, and the first one that carries no geometry at all. It
   * exists because the design sends these words somewhere rather than dropping
   * them, and WHERE depends on which rows this panel has: freckles sitting on
   * skin belong on the Skin row's words line, and freckles sitting on nothing a
   * row can carry belong to the current description instead. Only this function
   * knows which rows exist, so only this function can answer it.
   *
   * ⚠ **A `makeup` entry never reaches a row, whatever it sits on** — his
   * ruling: makeup is something you change with words, not a thing in the list.
   *
   * Absent on a panel built without a scan, and empty on a reading that cut
   * everything it named. Both route nothing, which is today's panel.
   */
  /* ⚠ THE READER'S OWN TYPE, imported rather than restated — unlike
     `discovered` above, which deliberately declares a SUBSET of what the store
     holds. The panel wants every field of this one and nothing else, so a
     second copy here would be the mirror working law 4 is about, and the Atlas
     says so: an inline copy raised a `redeclared-shape` finding of its own. */
  namedNotCut?: readonly NamedNotCut[];
};

/**
 * ONE PICTURE OF ONE INSTANCE.
 *
 * A MINTED crop is its own picture and `crop` is null: the content URL is the
 * cutout, the way the library has always served it. A SCAN-BORN one is the whole
 * frame with a window on it, so `crop` says which window — the browser cuts the
 * picture it already has, and no object was written to show it.
 */
export type PanelCutout = {
  contentUrl: string;
  /**
   * THE STENCIL, or NULL when the picture is already the cutout.
   *
   * ⚠ The mask is read by LUMINANCE (`mask-mode: luminance` in the tile's own
   * CSS), which is correct for a library stencil — a white-on-black shape — and
   * catastrophic for a picture that is its own shape. A delivered tattoo is
   * black linework on transparency: used as a luminance mask it MASKS ITSELF
   * OUT, and the tile draws nothing. Found at the frame; every unit assertion
   * about `cutouts` passed while the row rendered blank.
   *
   * So null is a real third state and not an empty string standing in for one:
   * `""` would be `url("")`, a mask matching nothing, which is the same blank
   * tile by a different route. Null means DO NOT MASK — the PNG's own alpha is
   * the shape and the tile's background shows through around it.
   */
  maskUrl: string | null;
  crop: PanelBox | null;
};

/**
 * ONE DELIVERED TATTOO, as the panel needs it.
 *
 * Deliberately NOT the store's own row type: this is the subset a row is built
 * from, so a column added to `casting_ink_delivery_crops` does not silently
 * become something the panel is assumed to have been given. The names match the
 * columns exactly (migration 0049) so the mapping needs no translation table.
 */
export type PanelInkWorn = {
  /** The ink slot key — `ink:neck`, `ink:upperArm@left`. */
  slot: string;
  /** OUR copy of the tattoo as it sits on her, under the candidate's purge path. */
  storageKey: string;
  bboxX: number;
  bboxY: number;
  bboxW: number;
  bboxH: number;
  frameWidth: number;
  frameHeight: number;
};

/**
 * ONE RECTANGLE ON THE PHOTOGRAPH, and what it actually covers.
 *
 * `name` is null on almost every one, and null is not an omission — it means the
 * rectangle covers what the row says it does, so the row's own name is the
 * label. It is a name when the row is a PAIR: the row still speaks the person's
 * ontology (*"Her eyes"*, one row, an edit to it means both) and each rectangle
 * says which eye it is, because clicking a rectangle is a promise about those
 * pixels (fable-378 (c)).
 */
export type PanelRegion = {
  /** BARE, because a tag is a label (founder, fable-451): "Left eye", never
   *  "Her left eye". The side stays — the side is the information. */
  box: PanelBox;
  name: string | null;
  /** How the product SPEAKS about this one — "her left eye" — for the sentences
   *  a label is not. Non-null exactly when {@link PanelRegion.name} is. */
  spoken: string | null;
  /**
   * THE ONE INSTANCE THESE PIXELS ARE (fable-444, ruling C).
   *
   * The ROW's `slots` is what an edit to the row means — both eyes, because
   * that is what "her eyes" means to a stylist. This is what the RECTANGLE is,
   * and on a pair the two are deliberately different: clicking her left eye is
   * a sentence about her left eye, and the ask goes out scoped to it.
   *
   * Always present, never derived from the region's ORDER: the regions are
   * sorted as the photograph reads them (left to right), which is the opposite
   * of the side words on a mirrored frame — an index into a sorted list is
   * exactly the guess this program has already paid for once.
   */
  slot: FeatureSlot;
  /**
   * MAY AN ASK BE NARROWED TO THESE PIXELS — the SERVER's answer, never the
   * browser's guess (working law 4).
   *
   * The picture used to decide this itself, from the shape of the key: a slot
   * with an `@` in it was one of a pair and therefore scopable. That was true
   * of every key that existed when it was written, and it stops being true the
   * moment the panel draws an OPEN kind: `open:wings@left` has the `@` and is
   * refused by `refineService`'s scope door on purpose (`scope_unknown`, three
   * rulings holding it there — `ZONE_SCOPE` is `fullFrame`, an uncatalogued
   * kind has no promoted instance, and the one-of-a-pair ask refuses into the
   * refund rather than guessing). A rectangle that scopes into that wall is a
   * tap that dead-ends, which is the entrance-before-the-road class with the
   * entrance drawn by us.
   *
   * So the fact travels from the side that knows it. It answers ONE half of the
   * question — *are these pixels one instance the product can narrow to* — and
   * the row-level half (are both of the pair drawn) stays where it was, because
   * that one is about what this face's read found rather than about the key.
   */
  scopable: boolean;
  /**
   * The opening of their sentence for THIS rectangle, when it differs from the
   * row's — non-null exactly when {@link PanelRegion.name} is, and for the same
   * reason. Written here rather than composed in the browser from the name: how
   * a prefill reads is one decision, and a second copy of it in the client is
   * the mirror working law 4 is about.
   */
  prefill: string | null;
  /**
   * DOES THIS RECTANGLE COVER THE WHOLE ROW, RATHER THAN ONE THING IN IT
   * (his word, 2026-10-30, #2845).
   *
   * His complaint, verbatim: *"why cant i select his outfit box as a whole its
   * selecting individual pieces? like shouldnt there be a box for the whole
   * outfit with the individual pieces inside it"* — and, again, *"also outfit
   * should be selectablke as a whole"*.
   *
   * ⚠ **WHAT WAS WRONG WAS THE PICTURE, NOT THE EDIT — read at the code before
   * anything moved.** The Outfit row's `slots` has carried every piece since
   * #2566 slice 2, so tapping it already meant the whole outfit. What it DREW
   * was one rectangle per PIECE and none for the outfit, so the photograph said
   * *"these five separate things"* while the ask said *"all of it"*. That is
   * the rule {@link FaceRegions} already states in the other direction — *the
   * picture may never claim what the ask does not say* — and this is its
   * mirror: the ask meant everything and the picture claimed less.
   *
   * So a `whole` rectangle is the row's own extent, and the pieces stay real
   * underneath it. `false` on every instance rectangle, which is what every
   * rectangle before this one was.
   *
   * ⚠ **IT IS A FIELD AND NOT A KEY TEST IN THE BROWSER, for the reason its
   * siblings here already carry twice over**: the client would otherwise ask
   * whether a slot `=== "discovered:outfit"`, which is a second copy of a
   * server fact and wrong the first time a second collection row exists
   * (working law 4). The side that knows the fact states it.
   */
  whole: boolean;
};

export type PanelRow = {
  /**
   * WHETHER THIS ROW IS THIS VERSION'S ANSWER, OR A PLACE FOR ONE
   * (founder-ratified, fable-521).
   *
   * `settled` — read from THIS version, full strength, tappable.
   * `pending` — the scan is still running and this row has nothing yet: a
   * placeholder square where the cutout will sit and a bar where the words
   * will, in the panel's normal layout, so a fresh cast does not look like a
   * product doing nothing. A pending row that settles with no box removes
   * itself; no-box-no-row still governs the final state.
   *
   * The rule is one rule across the panel: **full strength means this
   * version's confirmed reading.** Anything in progress — or carried from
   * another version while this one is fetched — is drawn as a placeholder, and
   * a row asserting a specific reading about a version that never had it may
   * not render full strength.
   */
  state: "settled" | "pending";
  /** How the product speaks about this row — "her eyes". The possessive lives
   *  here and in {@link PanelRow.prefill}, and on no label (fable-450/451). */
  spoken: string;
  /**
   * What tapping this row is about. A matched pair carries BOTH instance keys:
   * one row, and an edit to it means both sides.
   */
  slots: readonly FeatureSlot[];
  group: PanelSection;
  /** How the row reads: "Her lips", "Her earrings", "Her left earring". */
  name: string;
  /** Everything ever accepted about it, oldest first. Empty until something is. */
  words: readonly string[];
  /**
   * WHAT THIS ROW STATES INSTEAD OF DISAPPEARING — *"bald"* (founder ruling,
   * fable-889: **"yes show bald"**).
   *
   * Non-null only when all four hold: the scan finished, it asked about this
   * feature, it found nothing, and the catalogue admits a stated absence for it
   * (`whenAbsent` — hair and facial hair, and nothing else today). Null on
   * every other row, which is almost all of them.
   *
   * It is the PANEL's statement about the photograph, deliberately not
   * {@link PanelRow.words}: her words are what she asked for and what the
   * library filed, and a reading of nothing is neither. Keeping the two
   * channels apart is what stops "bald" travelling into a recipe as though
   * somebody had asked for it.
   */
  absent: string | null;
  /** "she came with it", "from an edit" — null when nothing has happened to it. */
  from: string | null;
  /** The opening of their own sentence, written into the ask box on a tap. */
  prefill: string;
  /**
   * THE PICTURES OF IT — none, one, or one per instance.
   *
   * A matched pair carries BOTH, drawn side by side in the one tile, and that is
   * measured rather than chosen (`bench-pair-tile`): the union of two eye boxes
   * fitted into a 34px tile is 34 × 5.7 pixels of content in an empty square,
   * and two ears union into a tile that is 85% background. Abutted, each
   * instance keeps its own boundary and the gap between them — which is her
   * face, not her eyes — is simply not in the picture.
   *
   * Ordered as the PHOTOGRAPH reads, left to right, and derived from the boxes
   * rather than from the side words: `left` means HER left, which is the image's
   * right (`falRegionReader`).
   */
  cutouts: readonly PanelCutout[];
  /**
   * WHERE IT IS ON THE PICTURE — none, one, or one per instance.
   *
   * Empty when this face has never been read there, and a rectangle is never
   * placed by proportion. A pair with both instances read draws two, because a
   * single rectangle on a two-eyed face is the same "only showing one eye" the
   * founder read in the tile — same class, one surface across (law 7).
   */
  regions: readonly PanelRegion[];
  /**
   * THE TWO SIDES OF A PAIR, WHEN THIS ROW IS ONE (founder, fable-452).
   *
   * Empty on every row there is only one of. On a pair it holds both instances,
   * whether or not they agree — the row is the pair and these are its children,
   * so *"Eyes ▾ → Left eye · Right eye"*, collapsed until she opens it.
   *
   * # A diverged pair stopped changing the panel's SHAPE
   *
   * It used to become two top-level rows, so the list re-arranged itself to
   * report a fact about her face. Now the structure is constant and the WORDS
   * carry the fact: the parent says the derived sentence ("left green, right
   * brown") and each child says its own. That is fable-444 condition 1
   * unchanged — the panel may never claim what the rows do not agree on — said
   * in one row's words instead of by splitting the list.
   *
   * Ordered LEFT then RIGHT, from the catalogue, and deliberately not in the
   * photograph's order the way {@link PanelRow.cutouts} is: a picture is placed
   * where the eye finds it, and a list is read in the words it is written in.
   */
  instances: readonly PanelInstance[];
};

/**
 * ONE SIDE OF A PAIR, as a row of its own inside its parent.
 *
 * Everything here already existed per instance — the library's rows, the scan's
 * boxes, the mint's crops. Nothing is fetched to open a pair and nothing new is
 * stored to close one.
 */
export type PanelInstance = {
  /** What tapping it edits — and it is the SAME wire a click on that instance's
   *  rectangle sends (`scope`), so there is one scoping mechanism with two
   *  entrances (fable-444 ruling C, fable-452). */
  slot: FeatureSlot;
  /**
   * MAY AN ASK BE NARROWED TO THIS CHILD — the SERVER's answer, exactly as
   * {@link PanelRegion.scopable} is for a rectangle (#2566 slice 2).
   *
   * ⚠ **IT IS ADDED BECAUSE THE GROUPING GIVES A ROW CHILDREN THAT THE SCOPE
   * DOOR REFUSES, AND THE CLIENT HAD NO WAY TO KNOW.** Every child here used to
   * be one side of a catalogued pair, so the browser could send `scope:
   * <child>` unconditionally and be right every time. A folded found row breaks
   * that: a charm under its chain, a jacket under Outfit, keyed `discovered:…`,
   * which `refineService`'s door answers `scope_unknown` on — driven at the
   * code, `slotDefinition("discovered:lip-ring#1")` is `null`. A tap that
   * dead-ends with a BAD_REQUEST is the entrance-before-the-road class with the
   * entrance drawn by us, which is the exact failure the sibling field on
   * `PanelRegion` was added to prevent on the photograph's side.
   *
   * True on a catalogued pair's sides, which is what it has always been.
   * False on every child the reading found.
   */
  scopable: boolean;
  /** Bare, like every label: "Left eye" (fable-450/451). */
  name: string;
  /** How the product speaks about this one — "her left eye". */
  spoken: string;
  /** The opening of her sentence about this one. */
  prefill: string;
  /** What this side alone carries. Empty is a real answer, not a gap. */
  words: readonly string[];
  /** Its own picture, when it has one. */
  cutout: PanelCutout | null;
  /** Its own place on the photograph, when it has been read there. */
  box: PanelBox | null;
};

export type FacePanel = {
  possessive: string;
  groups: readonly { group: PanelSection; heading: string; rows: readonly PanelRow[] }[];
  /**
   * A READING IS RUNNING, AND THE PLACES IT KEEPS HAVE NO NAMES (#2566 slice 3).
   *
   * True exactly while `scanning` and `discovering` both hold: the panel has
   * drawn no named placeholder row, so the browser keeps the places itself — a
   * short unnamed strip under the working line, picture square and bar, no noun.
   * False on every other panel, including the catalogue road, where the named
   * `pending` rows are the places and this strip would be a second loader.
   *
   * A fact about the READING, never a list: it says nothing about how many rows
   * are coming or what they are, because nobody knows yet.
   */
  pendingUnnamed: boolean;
};

type SlotState = {
  words: readonly string[];
  from: string | null;
  thumb: { contentUrl: string; maskUrl: string; crop: PanelBox | null } | null;
  box: PanelBox | null;
};

const EMPTY: SlotState = { words: [], from: null, thumb: null, box: null };

/**
 * What the library currently says about one slot.
 *
 * The newest live row of either role carries the state (`referenceLibrary`'s own
 * rule); the CROP comes from the carry row, because that is the role that holds
 * a minted one. A slot the library has never held gets {@link EMPTY}, which is
 * not an error state — it is most of a new face.
 */
function stateOfSlot(
  rows: readonly StoredReference[],
  urls: { contentUrl: (key: string) => string; maskUrl: (key: string) => string },
  pronouns: CastPronouns,
): SlotState {
  if (rows.length === 0) return EMPTY;
  const newest = rows.reduce((held, row) => (row.version > held.version ? row : held));
  /*
    A MAINTAINED ABSENCE IS NOT DISPLAYED — the founder, in as many words
    (fable-401: *"do not display it"*).

    A vacancy row's words are the sentence the RECIPE needs — "no glasses — her
    face uncovered, no frames, no lenses and no rim shadow on her cheeks or
    brows" — and they are load-bearing there: the master wears her glasses
    forever, so every later render re-says the absence or paints them back on.
    Read onto the panel they became a row describing something that is not on
    her face, in the voice of something that is.

    So the fact keeps working and stops speaking here. The row falls to EMPTY,
    and a row with no cutout and no words does not render at all (`hasContent`)
    — which is the ruling exactly: the row leaves the panel, the fact persists
    underneath untouched.

    Deliberately NOT filtered out of `rows` upstream: the vacancy must stay the
    newest state, or a retired carry underneath it would surface as this slot's
    current answer and the panel would show her the glasses she took off.
  */
  if (newest.role === "vacancy") return EMPTY;
  const carry = rows.filter((row) => row.role === "carry")
    .reduce<StoredReference | null>((held, row) => (held === null || row.version > held.version ? row : held), null);

  const image = carry !== null && carry.storageKey !== null && carry.maskKey !== null
    ? { contentUrl: urls.contentUrl(carry.storageKey), maskUrl: urls.maskUrl(carry.maskKey), crop: null }
    : null;
  const geometry = carry?.geometry ?? null;

  return {
    words: newest.words,
    /*
      WHERE IT CAME FROM, and the two answers are genuinely different to a
      customer. A row minted from the master is something the face arrived with;
      a row minted by a render is something they asked for. `variantId === null`
      is the master's own mark (§2.6), so this is read rather than tracked.
    */
    from: newest.variantId === null ? `${pronouns.subject} came with it` : "from an edit",
    thumb: image,
    box: geometry === null
      ? null
      : { ...geometry.bbox, frame: geometry.frame },
  };
}

function nounOf(definition: SlotDefinition, paired: boolean): string {
  return paired ? definition.pairNoun ?? definition.noun : definition.noun;
}

/**
 * THE LABEL — bare, because a list is labels (founder, fable-450/451).
 *
 * *"The 'their' beside every feature is unnecessary"*, and then, on the
 * rectangles: *"even on hover it's too long — just 'Left eye'."* So the
 * possessive comes off everything that NAMES a thing, and the side stays,
 * because the side is the information the pronoun never was.
 *
 * It is the same distinction the recipe assembler already draws between an
 * article and a possessive, moved one surface over: the panel is a list of
 * her features, and a list does not need to say whose face it is on every line.
 */
function labelOf(definition: SlotDefinition, paired: boolean): string {
  return capitalize(nounOf(definition, paired));
}

/**
 * EVERY WORD A READING MIGHT USE FOR A CATALOGUED ROW (#2566 slice 2's
 * grouping design, rule 3).
 *
 * The same five fields `pointerCut`'s `catalogueVocabulary` reads, and for a
 * reason one step further on: that function asks *does the catalogue already
 * buy a question for this name*, and this asks *is this name a row a found
 * thing can sit UNDER*. Both questions are answered by the catalogue's own
 * words, so both read the same five rather than keeping a list each.
 *
 * ⚠ **The displayed label alone is not enough and `skin` is why**: its row
 * draws as *Skin*, its `display` is *face skin*, and the design's own worked
 * example is freckles sitting on **skin**. A pair is the mirror case — the row
 * draws as *Eyes* and the reading says *eye* or *eyes*, both of which reach it
 * through `feature` and `question`.
 */
function catalogueHostWords(definition: SlotDefinition): readonly string[] {
  /* Read in ONE place since #2796: the pointer road's host check asks the same
     question of the same five words (which drawn row does a reading's `on`
     name), and a third copy of the list is the drift working law 4 names. */
  return catalogueWordsOf(definition);
}

/**
 * HOW THE PRODUCT SPEAKS ABOUT IT — and the possessive lives on here.
 *
 * Everywhere the product says a sentence rather than a name — the ask box's
 * opening words, the delivery and refusal messages — it is still talking to
 * the person whose face this is. The pronoun machinery is unchanged; it simply
 * stopped being stamped on labels.
 */
function spokenOf(definition: SlotDefinition, possessive: string, paired: boolean): string {
  return `${possessive} ${nounOf(definition, paired)}`;
}

/** The opening of their sentence, from the words the product speaks in. */
function prefillFor(spoken: string): string {
  return `${spoken} — `;
}

/**
 * WHAT A PAIR SAYS WHEN ITS TWO SIDES DISAGREE (fable-444 condition 1).
 *
 * "left green, right brown" — each side's own words, attributed to the side
 * that carries them, so the row can be about both eyes without claiming
 * anything of either. A side with nothing to say is left out rather than
 * described as empty: silence about an eye nobody has edited is true, and
 * "right nothing" is not.
 */
function attributedWords(
  left: { noun: string; words: readonly string[] },
  right: { noun: string; words: readonly string[] },
): readonly string[] {
  const said = [left, right]
    .filter((side) => side.words.length > 0)
    .map((side) => `${side.noun} ${distinguishing(side.words)}`);
  /*
    ONE SENTENCE, COMPOSED — never the two stacks concatenated (fable-475 §2).

    The founder's own row read *"left A pale grey-blue iris with a dark, dilated
    pupil, and a small bright…"* — truncated mid-thought, with a mid-sentence
    capital, because both sides' FULL descriptions were being poured into a line
    that has room for about eight words. The ruling was the derived short form
    from the start: each side compressed to what tells it apart, the whole
    description living on the child row that opens beneath.

    Joined here rather than in the browser because the row's words are rendered
    with a comma between them, and a comma is what separates the items of ONE
    side's stack. The two sides are not two items; they are two answers.
  */
  return said.length > 0 ? [said.join(" · ")] : [];
}

/**
 * THE FEW WORDS THAT TELL THIS SIDE FROM THE OTHER.
 *
 * A library row says *"a pale icy blue iris"* and fits; a scan-born description
 * says *"A pale grey-blue iris with a dark, dilated pupil, and a small bright
 * specular highlight"* and does not. The head of the phrase is what
 * distinguishes it — every clause after the first `with`, `and` or comma is the
 * detail the child row exists to hold.
 *
 * Code-owned and deterministic on purpose: a model asked to summarise here
 * would be a second author of her words, and D-172 keeps the words hers. The
 * cap is words rather than characters because a cut mid-word is exactly the
 * truncation this replaces.
 */
function distinguishing(words: readonly string[]): string {
  const first = words.find((word) => word.trim().length > 0) ?? "";
  const head = first.split(/,| with | and /i)[0] ?? first;
  /*
    HER ARTICLE STAYS. An earlier draft stripped "a" and read "left gold hoop",
    which is tidier and is not what she typed — D-172 keeps the words hers, and
    the thing that actually went wrong on his screen was the CASE, not the
    article.
  */
  const capped = head.trim().split(/\s+/).filter(Boolean).slice(0, 5).join(" ");
  /* Her sentence continues the row's own, so it starts in lower case — "left A
     pale grey-blue iris" is the mid-sentence capital he saw. */
  return capped.charAt(0).toLowerCase() + capped.slice(1);
}

/**
 * The panel, for one branch of one face.
 *
 * `rows` is the lineage walk the library read returns — every row along this
 * variant's ancestry, oldest first. The fold to what is LIVE happens here
 * through the library's own function, so the panel and the recipe cannot
 * disagree about what this face is holding.
 */
export function facePanel(input: {
  rows: readonly StoredReference[];
  pronouns: CastPronouns;
  contentUrl: (key: string) => string;
  /** Stencils are fetched under CORS and crops are not — see `maskFetchUrl`. */
  maskUrl: (key: string) => string;
  /**
   * What this frame was READ to contain, when it has been read.
   *
   * Null is the ordinary case and the panel is exactly what it was: rows from
   * the catalogue, content from the library. Present, it fills the rows the
   * library has nothing for — which on a face nobody has edited is all of them.
   */
  scan?: PanelScan | null;
  /**
   * IS A READ STILL RUNNING FOR THIS VERSION?
   *
   * True while the scan is in flight, and it changes exactly one thing: a row
   * with nothing yet keeps its place as a placeholder instead of leaving the
   * panel. Nothing about a SETTLED row depends on it.
   */
  scanning?: boolean;
  /**
   * DOES THIS READING ASK THE PICTURE WHAT IS ON IT (#2566 slice 3 — the
   * discovery road, `CASTING_FACE_DISCOVERY_SCOPE`)?
   *
   * It changes one thing, and only while `scanning` is true: the places kept
   * for rows not answered yet are NOT NAMED. His words on the first look,
   * verbatim: *"loader is still showing the default list"* — a placeholder row
   * called Horns or Nose stud over a cast who has neither is a promise about a
   * feature nobody has seen, and the approved design already ruled it: *"Rows
   * appear whole or not at all … There is no word-only placeholder that fills
   * in later."* So no catalogue row is held open here, and the panel says
   * {@link FacePanel.pendingUnnamed} instead.
   *
   * ⚠ **Every catalogue question is still asked** — the gate the relay's second
   * #2570 finding deleted stays deleted. Absent or false is today's panel byte
   * for byte.
   *
   * ⚠ **AND IT CHANGES ONE SETTLED THING TOO, SINCE #2752 — this paragraph said
   * *"only the loader changes"* until then.** His eye on the live grouping,
   * verbatim: *"its still picking up build, build runs in words alone remember
   * and same with skin not neccesary to pick up"*. On this road a catalogue
   * slot that authors `noRowOnDiscovery` (build and skin, and no other) draws
   * no row, scanning or settled. Its slot, its words and every ask that files
   * to it are untouched; only the row goes, and only here.
   */
  discovering?: boolean;
  /**
   * THE TATTOOS THIS CAST IS WEARING, from the delivery-crop store.
   *
   * Absent is the ordinary case and means she wears none — not that the read
   * failed, because a caller that could not read them has nothing to pass and a
   * Cast with no ink has nothing either, and the panel's answer is the same
   * empty list for both. The rows are built at the bottom of this function, and
   * the comment there is where the source is argued.
   */
  ink?: readonly PanelInkWorn[];
  /**
   * WHERE A CARRIED FEATURE IS ON *THIS* VERSION'S FRAME (fable-1443/1445).
   *
   * A library crop's geometry describes the frame it was minted from and no
   * other, so on every later version its rectangle sits over the wrong pixels —
   * the founder's "Right horn" box floating over background after a regenerate
   * moved the horns. The render re-reads those boxes as it delivers and files
   * them per version; this is that reading, and it OVERRIDES the library's.
   *
   * Empty or absent is the ordinary case for every version rendered before this
   * landed, and the panel is then exactly what it was.
   */
  carriedGeometry?: ReadonlyMap<string, PanelBox>;
}): FacePanel {
  const live = liveReferences(input.rows);
  const bySlot = new Map<FeatureSlot, StoredReference[]>();
  for (const row of live) {
    const held = bySlot.get(row.slot);
    if (held) held.push(row);
    else bySlot.set(row.slot, [row]);
  }

  /**
   * THE LIBRARY WINS WHERE IT HAS MINTED, and the scan fills the rest.
   *
   * The two answer different questions and the difference is the founder's own
   * (*"she came with it"* vs *"from an edit"*): a minted crop is what an edit
   * MADE, cut from the frame that delivered it, and it stays the picture of
   * that feature even when a scan of today's frame could also find one. The
   * scan is what the picture already contains, and it is the only answer for a
   * face nobody has touched.
   *
   * Box and thumbnail are filled INDEPENDENTLY. A slot can have a minted crop
   * from an ancestor version and no geometry on this one — the row keeps its
   * cutout and gains a click target, rather than choosing one and losing the
   * other.
   */
  const scan = input.scan ?? null;
  /**
   * THE ONE BOX THAT IS ABOUT THE FRAME ON SCREEN.
   *
   * A library row's geometry is a measurement of the frame its crop was cut
   * from, and a carried row's crop was cut on an earlier version — measured 9
   * of 9 on production, a median of four versions ago. This reading was taken
   * by the render that delivered the version being looked at, so where it
   * exists it is simply better, and it replaces rather than fills a gap.
   *
   * Applied here — to the state, before any row is composed — so it reaches
   * every surface that draws a rectangle at once: a catalogued row, a child of
   * a pair, an open kind's row and the photograph order those rows are sorted
   * in. A merge written per row would be four merges to keep in step.
   *
   * ⚠ **A ROW WITH NO BOX STAYS WITHOUT ONE**, and that clause is load-bearing
   * rather than defensive. `liveReferences` keys on (slot, ROLE), so a slot she
   * has emptied can hold a live vacancy AND a live carry underneath it — the
   * vacancy makes the row EMPTY here (*"do not display it"*, fable-401) while a
   * geometry reader would still find the thing. Filling a box in would put a
   * rectangle back on what she took off.
   */
  const fresher = (slot: FeatureSlot, state: SlotState): SlotState => {
    const box = input.carriedGeometry?.get(slot);
    return box === undefined || state.box === null ? state : { ...state, box };
  };
  /* Three steps, in this order and for a reason: the library and the scan merge
     (`stateOfRaw`), the render's own geometry replaces a stale box (`fresher`),
     and only then is a text-only row's tile dropped (`textOnly`, #1341) — last,
     so it cannot be undone by a later fill, and after `fresher` so the box it
     keeps is the freshest one. */
  const stateOf = (slot: FeatureSlot): SlotState =>
    textOnly(slot, fresher(slot, stateOfRaw(slot)));
  const stateOfRaw = (slot: FeatureSlot): SlotState => {
    const held = stateOfSlot(
      bySlot.get(slot) ?? [],
      { contentUrl: input.contentUrl, maskUrl: input.maskUrl },
      input.pronouns,
    );
    if (!scan) return held;
    const found = scan.slots.get(slot);
    /*
      WORDS MERGE THE SAME WAY THE PICTURES DO: whatever the library holds wins
      whole, and the scan fills a row that has nothing. It is never blended —
      a described line under a sentence the customer's own edit filed would be
      the reader arguing with her purchase.

      `from` stays null for a described row, deliberately. "She came with it"
      and "from an edit" are facts about a library row's provenance, and a
      description is neither: it is what this photograph shows.
    */
    const described = held.words.length === 0 ? scan.words?.get(slot) ?? [] : held.words;
    if (!found) return described === held.words ? held : { ...held, words: described };
    return {
      ...held,
      words: described,
      thumb: held.thumb ?? { contentUrl: scan.frameUrl, maskUrl: found.maskUrl, crop: found.box },
      box: held.box ?? found.box,
    };
  };

  /**
   * A ROW THE CATALOGUE DRAWS WITHOUT A TILE — founder ruling, 2026-09-26
   * (#1341): *"build should carry as text only"*.
   *
   * # ONE PLACE, AND IT IS AFTER BOTH SOURCES HAVE BEEN MERGED
   *
   * A thumbnail reaches a row two ways — the library's minted crop (`held.thumb`)
   * and the scan-born window on today's frame — and *text only* has to mean
   * neither. Applied HERE, on the state, so both are already resolved and there
   * is one line to read rather than a condition at each source. Every surface
   * that draws a tile reads this state: a catalogued row, a child of a pair, an
   * open kind's row, and the photograph order rows are sorted in.
   *
   * ⚠ **THE BOX SURVIVES ON PURPOSE.** fable-414 requires every panel row to
   * have a bounding box, and it is satisfied: only the tile goes. A row with no
   * box would leave the panel entirely (the rule two hundred lines down), which
   * is the opposite of what he asked for — he asked for the row to carry TEXT,
   * not to disappear.
   *
   * ⚠ **AND THE CONSEQUENCE WORTH SAYING OUT LOUD: a row with no tile and no
   * words does not render at all** (`hasContent`). For `build` that is the
   * honest reading of his ruling rather than a gap — a build row with nothing
   * said about it and nothing but a crop of a crew tee to show was the tile
   * pretending to be content. It is named here so the next reader meets it as a
   * decision instead of finding it as a bug.
   *
   * Derived from the catalogue, never a list here: a second roster of
   * picture-less slots is working law 4's copy, and this one would go stale the
   * first time a slot's rule changed — which the enumeration paragraph further
   * down this file has already been bitten by twice.
   */
  const textOnly = (slot: FeatureSlot, state: SlotState): SlotState =>
    slotDefinition(slot)?.noThumbnail === undefined || state.thumb === null
      ? state
      : { ...state, thumb: null };

  /**
   * WHAT THIS ROW STATES WHEN THE SCAN FOUND NOTHING — or null, which is almost
   * always (founder ruling fable-889, `PANEL_ABSENT_STATE_DESIGN.md`).
   *
   * Four conditions, and each removes a different way of being wrong:
   *
   *   the catalogue admits it   `whenAbsent`, authored per slot beside the
   *                             reason. Hair and facial hair today, because the
   *                             crown and the jaw are in frame on every casting
   *                             framing and nothing hides them. An empty EAR
   *                             read is a fact about her hair or her pose, and
   *                             painting "ears: none" onto it is the product
   *                             asserting something false from a blank
   *   the scan says so          `absent` is asked-and-answered-nothing, told
   *                             apart from errored and from never-ran in
   *                             `panelScanOf`. A partial scan carries none, so
   *                             a row in flight stays a place for something
   *   the library has nothing   whatever she has bought or been described wins
   *                             whole, exactly as the words and the pictures
   *                             already merge. A face with hair words does not
   *                             get told it is bald because today's frame read
   *                             thin
   *   nothing is pictured       a crop or a box means the feature IS on this
   *                             frame, whatever the region-level answer said
   */
  const absentSays = (
    definition: SlotDefinition,
    words: readonly string[],
    state: SlotState,
  ): string | null => {
    const says = definition.whenAbsent?.says;
    if (says === undefined) return null;
    if (scan === null || scan.absent?.has(definition.slot) !== true) return null;
    if (words.length > 0 || state.thumb !== null || state.box !== null) return null;
    return says;
  };

  const definitions = catalogueSlots();

  /**
   * THE WORDS OF THE SLOTS THAT HAVE NO ROW OF THEIR OWN, by the row that reads
   * them.
   *
   * A folded slot still stores everything ever said about it — "longer lashes"
   * lands in `lashes@left`/`lashes@right` exactly as before — and this is the
   * only place those words become visible. Deduplicated by the sentence itself,
   * because a pair asked as a pair files one sentence on both sides and the row
   * would otherwise say it twice.
   */
  const foldedWords = new Map<string, string[]>();
  for (const definition of definitions) {
    if (definition.panel.row !== "foldedInto") continue;
    const held = foldedWords.get(definition.panel.feature) ?? [];
    for (const word of stateOf(definition.slot).words) {
      if (!held.includes(word)) held.push(word);
    }
    foldedWords.set(definition.panel.feature, held);
  }
  /** Its own words first, then what it is reading for a slot with no row. */
  const wordsFor = (feature: string, own: readonly string[]): readonly string[] => {
    const folded = foldedWords.get(feature);
    if (folded === undefined || folded.length === 0) return own;
    return [...own, ...folded.filter((word) => !own.includes(word))];
  };

  const spoken = new Set<FeatureSlot>();
  const rowsOf = new Map<PanelSection, PanelRow[]>();
  /**
   * WHAT A FOUND THING MAY SAY IT SITS ON, PER ROW (#2566 slice 2's grouping
   * design, rule 3).
   *
   * Recorded as each row is pushed rather than re-derived afterwards, and that
   * is working law 4 in the one place it would bite hardest: the only other
   * road to this is a second walk of `catalogueSlots()` down here, which would
   * be a parallel copy of the enumeration above and would drift from it the
   * first time a slot's words changed.
   *
   * ⚠ **The DEFAULT is the row's own displayed label and that is deliberate** —
   * a row the reading itself named, or an open kind the customer named, has
   * exactly one word and it is the one drawn on screen. The catalogue rows pass
   * their five, because a catalogue row's displayed label is not always the
   * word a reading would use for it (`skin` draws as *Skin* and its `display`
   * is *face skin*; the pair rows draw as *Eyes* and their question is *eyes*).
   */
  const hostNounsOfRow = new Map<PanelRow, readonly string[]>();
  const push = (row: PanelRow, hostNouns?: readonly (string | null | undefined)[]) => {
    const held = rowsOf.get(row.group);
    if (held) held.push(row);
    else rowsOf.set(row.group, [row]);
    const words = (hostNouns ?? [row.name])
      .filter((word): word is string => typeof word === "string" && word.trim() !== "")
      .map((word) => normalisedName(word));
    if (words.length > 0) hostNounsOfRow.set(row, words);
  };

  for (const definition of definitions) {
    if (spoken.has(definition.slot)) continue;
    /* No row of its own, by the catalogue's own account — the words of a folded
       slot are already gathered above, and a `none` slot is words the ask box
       reaches and the panel does not draw. */
    if (definition.panel.row !== "own") {
      spoken.add(definition.slot);
      continue;
    }
    /*
      WORDS ALONE ON THE DISCOVERY ROAD (#2752) — build and skin, authored on
      the catalogue beside his ruling, never listed here.

      ⚠ **It goes BEFORE `push`, and that is the part that matters**: a row
      that is never pushed records no host words, so nothing found can fold
      under a Skin row that is not there and no scattered thing's words can be
      written onto it. A found thing sitting `on: "skin"` keeps its own row, and
      freckles on skin keep their words on the reading's `namedNotCut` — kept
      with the scan, dropped by nothing (the words pass below says where).
    */
    if (input.discovering === true && definition.noRowOnDiscovery !== undefined) {
      spoken.add(definition.slot);
      continue;
    }
    const state = stateOf(definition.slot);

    if (definition.instance === null) {
      spoken.add(definition.slot);
      const spokenName = spokenOf(definition, input.pronouns.possessive, false);
      const words = wordsFor(definition.feature, state.words);
      push({
        state: "settled",
        slots: [definition.slot],
        group: definition.group,
        name: labelOf(definition, false),
        spoken: spokenName,
        words,
        absent: absentSays(definition, words, state),
        from: state.from,
        prefill: prefillFor(spokenName),
        cutouts: state.thumb ? [state.thumb] : [],
        /* The row is one thing and the rectangle covers it, so it needs no name
           of its own — the row's is the label. */
        regions: state.box
          ? [{
            box: state.box,
            name: null,
            spoken: null,
            prefill: null,
            slot: definition.slot,
            /* There is only one of it, so there is nothing to narrow to — a
               scope naming the whole face is the silent whole-face render the
               server's door refuses. */
            scopable: definition.instance !== null,
            whole: false,
          }]
          : [],
        /* There is only one of it, so there is nothing to open. */
        instances: [],
      }, catalogueHostWords(definition));
      continue;
    }

    /* ---- a bilateral feature: one row while it matches, two after ---- */

    const otherSide = definition.instance === "left" ? "right" : "left";
    const sibling = definitions.find(
      (candidate) => candidate.feature === definition.feature && candidate.instance === otherSide,
    );
    const left = definition.instance === "left" ? definition : sibling;
    const right = definition.instance === "left" ? sibling : definition;
    if (left === undefined || right === undefined) continue;
    spoken.add(left.slot);
    spoken.add(right.slot);

    const leftState = stateOf(left.slot);
    const rightState = stateOf(right.slot);
    const diverged = pairHasDiverged({
      feature: definition.feature,
      left: { words: leftState.words },
      right: { words: rightState.words },
    });

    {
      const spokenName = spokenOf(left, input.pronouns.possessive, true);
      /*
        BOTH INSTANCES, IN THE ORDER THE PHOTOGRAPH READS THEM.

        The founder, on his own face: *"its only showing one eye"* — and the
        court proved the reader had found both (opus-303). The tile was drawing
        `left ?? right` under a comment written about EARRINGS, where showing one
        of a matched pair is exactly right. Two eyes are not two earrings.

        The order is derived from where the boxes ARE, never from the side word:
        `left` is HER left, which is the image's right, so ordering by the word
        would mirror every pair tile on the panel.
      */
      const sides = [
        { definition: left, state: leftState },
        { definition: right, state: rightState },
      ]
        .map((side) => ({
          ...side,
          at: side.state.thumb?.crop?.x ?? side.state.box?.x ?? null,
        }))
        .sort((a, b) => (a.at === null || b.at === null ? 0 : a.at - b.at));
      const pictured = sides.filter((side) => side.state.thumb !== null);
      const measured = sides.filter((side) => side.state.box !== null);
      push({
        state: "settled",
        slots: [left.slot, right.slot],
        group: left.group,
        name: labelOf(left, true),
        spoken: spokenName,
        /*
          AND THE PARENT NEVER CLAIMS WHAT THE TWO SIDES DO NOT AGREE ON
          (fable-444 condition 1, now said in this row's own words).

          While they match, this is what both of them say — exactly as it always
          was. The moment they diverge it becomes the derived sentence, "left
          green, right brown", attributed side by side rather than picking one
          and calling it her eyes. Derived from the two instances every render,
          never a stored summary: a summary beside its own source is the mirror
          working law 4 is about, and it would be the half that goes stale.
        */
        words: diverged
          ? attributedWords(
            { noun: left.instance!, words: wordsFor(left.feature, leftState.words) },
            { noun: right.instance!, words: wordsFor(right.feature, rightState.words) },
          )
          : wordsFor(left.feature, leftState.words),
        /*
          AND A PAIR NEVER STATES AN ABSENCE.

          Not an omission: every bilateral feature in the catalogue is one the
          design note excludes by name — eyes, brows, ears, lashes are routinely
          hidden by hair or by pose, so an empty read of one is a fact about the
          photograph rather than about her. The catalogue is where that is
          decided, and `referenceSlotCatalogue.test.ts` drives that no
          per-side slot carries `whenAbsent` — so this null cannot quietly
          swallow an admission somebody meant to make.
        */
        absent: null,
        /* And where it came from is only sayable when both sides came from the
           same place. Two different provenances is not a fact about the pair. */
        from: leftState.from === rightState.from ? leftState.from : null,
        prefill: prefillFor(spokenName),
        /* One tile, both of them — and one of them when that is all this face
           has. A pair is matched by its WORDS and never by its pixels (two
           crops of two ears are never byte-identical), so the pictures do not
           have to agree for the row to be one row. */
        cutouts: pictured.map((side) => side.state.thumb!),
        /*
          AND EVERY RECTANGLE SAYS WHICH ONE IT IS (fable-378 (c), swept).

          The row stays "Her eyes" because that is what an edit to it means; each
          rectangle says "Her left eye" / "Her right eye" because that is what
          those pixels are. The stylist's promise above, the pixels below — and
          neither has to lie for the other. This is also the fix for the case
          that could not happen: a pair read on one side only used to show a
          cutout and NO click target at all.
        */
        regions: measured.map((side) => ({
          box: side.state.box!,
          name: labelOf(side.definition, false),
          spoken: spokenOf(side.definition, input.pronouns.possessive, false),
          prefill: prefillFor(spokenOf(side.definition, input.pronouns.possessive, false)),
          /* The instance this rectangle IS, beside the name that says so. The
             row's `slots` still carries both: one row, and an edit to the ROW
             means both, while an edit to this RECTANGLE means this one. */
          slot: side.definition.slot,
          /* A catalogued instance, which is exactly what the scope door
             admits. */
          scopable: side.definition.instance !== null,
          whole: false,
        })),
        /*
          THE TWO CHILDREN (founder, fable-452) — both, whether or not they
          agree, because the pair is the row and these are its sides.
          Everything here already exists per instance, so opening a pair fetches
          nothing and closing one stores nothing.

          ⚠ **A SIDE NOTHING FOUND IS NOT DRAWN (#2800, his eye round 6).** This
          read *"always both"* and drew a side with no picture and no place on
          the photograph: "Right ear" and "Left earring" on his panel, which a
          tap filled into the ask box while nothing lit on the picture. That is
          fable-414's rule failing one level down — *"everything in the right
          panel should have a bounding box"* — so a child keeps its place by the
          same measure the row does: a place on the picture, or a picture of
          it. The parent row is untouched and still means the pair.

          Left then right, from the catalogue: a list is read in the words it is
          written in, while the tile above is ordered by where the eye finds
          each picture.
        */
        instances: [
          { definition: left, state: leftState },
          { definition: right, state: rightState },
        ].filter(({ state }) => state.box !== null || state.thumb !== null).map(({ definition: side, state }) => ({
          slot: side.slot,
          name: labelOf(side, false),
          spoken: spokenOf(side, input.pronouns.possessive, false),
          prefill: prefillFor(spokenOf(side, input.pronouns.possessive, false)),
          words: wordsFor(side.feature, state.words),
          cutout: state.thumb,
          box: state.box,
          /* A catalogued instance, which is exactly what the scope door admits
             — the same answer this row's rectangles give, for the same reason,
             because a child and its rectangle send one wire. */
          scopable: side.instance !== null,
        })),
      }, catalogueHostWords(left));
      continue;
    }

  }

  /**
   * A ROW APPEARS WHEN IT HAS A PLACE ON THE PHOTOGRAPH — founder ruling,
   * fable-414: *"nothing should ride words alone in the right panel — everything
   * in the right panel should have a bounding box."*
   *
   * It used to be *a picture of the feature, or something said about it*
   * (fable-382 §1), and the second half is what he overruled. Words are welcome
   * ON a row and may not BE the row: a row with no rectangle is a name with
   * nowhere to point, and the panel is a picture of her face rather than a list
   * about it.
   *
   * WHAT THIS COSTS, said plainly rather than discovered: a row whose feature
   * nothing can locate on the frame leaves the panel until something can. Her
   * build and her skin were both in that state three days ago and neither is
   * now — build's region is composed (`belowHeadMask`) and skin's is drawn from
   * a region it may never be CUT from (`display`). What stays out stays out
   * honestly: the ask box still reaches it, the words are still kept, and the
   * panel does not offer a picture of something it cannot point at.
   *
   * **AND WHICH ROWS ARE IN THAT STATE IS NOT WRITTEN HERE** (shift 91), which
   * is the third version of this paragraph and the last one that needs a shift.
   *
   * Shift 78 named `teeth` alone. Shift 79 corrected it to *"TWO rows, not
   * one"* — teeth and EARRINGS — and wrote, in this comment, that an
   * enumeration in a comment always becomes stale. It then became stale in both
   * halves within two days, in the direction nobody checks: teeth gained a
   * region (`display: "all the teeth"`, fable-463/619 §2) and earrings gained a
   * detector (the per-side court passed, `deferArming` came off), so BOTH rows
   * now have rectangles and the paragraph was describing a panel that no longer
   * existed. It was one of four prose sites carrying the same dead roster.
   *
   * The rule is what belongs here, and it is above: a row appears when
   * something measured where it is. WHICH rows those are on any given face is
   * an outcome of the catalogue, the scan and the library — read it from
   * `catalogueSlots()` and `armedBornWornClasses()`, or from the panel itself
   * on a real cast, never from a list in a comment.
   *
   * A group whose rows all fell away disappears with them, which the filter
   * below already did for the group with no rows at all.
   */
  /**
   * AND A STATED ABSENCE IS THE ONE ROW WITH NOTHING TO POINT AT (founder
   * ruling, fable-889: **"yes show bald"**).
   *
   * It reads as an exception to the rule above and it is one, so it is written
   * here rather than discovered: a bald head has no hair to draw a rectangle
   * around, and the row's whole content is saying so. fable-414's rule exists
   * because *"nothing should ride words alone"* — a name with nowhere to point
   * is a promise of a picture that does not exist. This row makes no such
   * promise: it is not offering a picture of her hair, it is telling her there
   * is none.
   *
   * Its bound is `whenAbsent`'s: two slots, authored, each beside the argument
   * that an empty read there cannot mean "hidden". Everything else still leaves
   * the panel exactly as it did.
   */
  /*
    ⚠ A SECOND CLAUSE STOOD HERE AND IT IS RETIRED WITH THE WARDROBE SECTION
    (#203 slice 2, 2026-09-24) — NAMED RATHER THAN QUIETLY DROPPED, because it
    carried a founder ruling and the ruling is still his.

    A wardrobe row was content by construction: it had no rectangle, claimed
    none, and its content was its own phrase off a stored line. That is an
    EXCEPTION to fable-414 — *everything in the right panel should have a
    bounding box* — and ✅ **he ratified it by name** (2026-08-23, relayed
    fable-1465 §3, from *"framing is fine and so is everything else"* shown
    against this question). **Outfit rows live boxless, by his word.**

    What removes the clause is not a change of mind about it: no wardrobe row
    can exist any more, because the section that drew them is retired with the
    paths. **His ruling stands and is what B of #1148 would be rebuilt on** — if
    a customer gets her clothes back, outfit rows come back boxless, and the
    garment-crop court in `wardrobeCards.ts` is still the reason (WHICH piece a
    segmenter returns is not controllable, so there may be no crop for a card
    ever).
  */
  const hasContent = (row: PanelRow): boolean =>
    row.regions.length > 0 || row.absent !== null;

  /*
    WHILE THE SCAN IS STILL RUNNING, A ROW WITH NOTHING IS A PLACE FOR SOMETHING
    (founder-ratified, fable-521).
    
    The founder's words were *"it looks like nothing is even happening"*. A
    fresh cast has no library rows and no scan yet, so the panel was empty —
    and an empty panel and a product doing nothing look identical. So while
    `scanning` is true, a row the catalogue draws keeps its place as a
    PENDING row: its name, its layout, and a placeholder where the picture and
    the words will be.
    
    The moment the scan settles, `scanning` is false and the rule below is
    exactly what it always was — a row nothing can locate on the frame leaves
    the panel (fable-414), so a pending row that finds nothing removes itself
    rather than leaving a husk.
  */
  /*
    AND THE GRACE IS THE SCAN'S, so it does not reach an open row.

    A pending row is a place kept for an answer that is COMING: the scan walks
    the catalogue, so every row it holds open will be answered or will remove
    itself when the read settles. The scan never asks about an open kind — the
    catalogue it walks has no definition for one, and buying a segmenter read
    for an uncatalogued word is the thing the rung ladder measured as answering
    nothing. So an open row kept open by `scanning` would be a placeholder for
    a read that is not running, which is fable-521's own warning: a working
    state that can outlive its work.
  */
  /*
    AND ON THE DISCOVERY ROAD THE GRACE KEEPS NO NAMED PLACE AT ALL (#2566
    slice 3) — see `discovering`. The places are kept unnamed in the browser,
    from `pendingUnnamed` below, so the panel never names what nobody has seen.
  */
  /*
    AND THE OUTFIT SECTION IS OUTSIDE THE GRACE FOR THE SAME REASON `open` IS
    (#2566 slice 2).

    The grace keeps a place for an answer the CATALOGUE walk is certainly going
    to give. There is no catalogue walk behind an Outfit row — it exists only
    because the reading found clothing — so a contentless one held open by
    `scanning` would be a placeholder for a read that is not running, which is
    fable-521's own warning about a working state outliving its work.

    ⚠ **It cannot fire today and is written anyway**: an Outfit row is built
    only from pieces that have boxes, so it always has content. The clause is
    here so that the day a piece can arrive without one, this does not quietly
    start drawing an empty Outfit heading over a face.
  */
  const namedGrace = input.scanning === true && input.discovering !== true;
  const FOUND_SECTIONS: readonly PanelSection[] = ["open", "outfit"];
  const keep = (row: PanelRow): boolean => hasContent(row)
    || (namedGrace && !FOUND_SECTIONS.includes(row.group));
  const stateOfRow = (row: PanelRow): PanelRow => (
    hasContent(row) ? row : { ...row, state: "pending" }
  );

  /*
    ---- THE TATTOOS SHE IS WEARING, DERIVED PER CAST (his 1246 and 1248,
    shape ruled fable-1259 §2, countersigned fable-1261) ----

    ⚠ **THIS IS THE ONE ROW THE CATALOGUE DOES NOT ENUMERATE, and that
    asymmetry is deliberate.** Every loop above walks `catalogueSlots()` — a
    closed, hand-authored vocabulary — and then drops whatever has no content.
    Ink cannot work that way: a Cast may wear a tattoo at `neck`, at
    `upperArm@left`, at a placement nobody has catalogued, or nowhere at all,
    and none of that is knowable before the Cast exists.

    **The failure mode this comment exists to prevent** is a later hand
    "tidying" it by adding ink to `catalogueSlots()`. That enumeration is what
    the face SCAN walks, so an ink slot inside it would have the segmenter
    hunting a tattoo on every face in the product, at $0.005 a question, on
    faces that have never had one. `referenceSlotCatalogue.test.ts` has an arm
    that proves it does not.

    # Where they come from, and why it is the only source that can answer

    The delivery crops — `casting_ink_delivery_crops`, migration 0049 — whose
    six geometry columns ARE this panel's `PanelBox`. The other pointer a chain
    carries, `inkApplied`, names the DESIGN, and a design row's width and height
    are the size of the ARTWORK: they say nothing about where it landed on her.
    A box derived from that would be a measurement of the wrong thing, which is
    a class this program has already paid for.

    Deriving from the crops has a second property worth more than the geometry:
    it is **the same expression the carry reads**, so the panel shows what the
    next render would actually carry. Panel and carry cannot disagree, because
    there is nothing for them to disagree about (law 4 answered by
    construction rather than by discipline).

    And the words road needs no branch here: `designId` is nullable and the
    store's join is LEFT, so a tattoo painted from her own sentence — with no
    design row anywhere — arrives with its box exactly as a picture-born one
    does.
  */
  for (const worn of input.ink ?? []) {
    const definition = slotDefinition(worn.slot);
    /* An unreadable slot is SKIPPED rather than drawn under a made-up name: the
       string crossed a JSON boundary to get here, and a row is a promise that
       tapping it edits that thing. */
    if (definition === null || definition.panel.row !== "own") continue;
    const spokenName = spokenOf(definition, input.pronouns.possessive, false);
    push({
      state: "settled",
      slots: [definition.slot],
      group: definition.group,
      name: labelOf(definition, false),
      spoken: spokenName,
      /*
        NO WORDS, AND THAT IS THE HONEST ANSWER RATHER THAN A GAP.

        Every other row's words are a DESCRIPTION the library or the scan wrote
        for it. Nothing describes a tattoo: what we hold is the picture of it as
        it sits on her, which is the row's thumbnail and its rectangle. Putting
        the placement here — "neck" under a row already called "Neck tattoo" —
        would be the row's own name pretending to be a reading of the frame.
      */
      words: [],
      absent: null,
      from: null,
      prefill: prefillFor(spokenName),
      /*
        THE CROP IS ITS OWN STENCIL, and passing no mask is not an option.

        `cutoutStyle` applies `mask-image: url(...)` unconditionally, so an
        empty string there is `url("")` — a mask that matches nothing, which
        renders the thumbnail INVISIBLE. Found at the frame rather than in an
        arm: the row drew with no picture beside it while every unit assertion
        about `cutouts` passed, because the defect was in what the browser did
        with the value and not in the value.

        A library cutout is two objects, a crop and a separate stencil. A
        delivery crop is ONE object either way, so no stencil is passed.

        ⚠ **WHAT THAT ONE OBJECT IS CHANGED ON 2026-08-21** (ruled fable-1273
        §2 / fable-1284 §2), and this paragraph used to state the old fact as
        the reason. It said *the tattoo is already cut out and its alpha is the
        shape*. That was true while the mint asked `tattooed skin` and wrote an
        alpha; the mint now asks the SLOT'S OWN word and stores **an opaque
        RECTANGLE of the surface**, because the convicted word returned one mark
        of seven on a scattered piece (`inkDeliveryCrop.ts`'s header).

        So the tile draws a rectangle of him with the whole piece on it, rather
        than a floating cutout — and rows minted before that change still carry
        their alpha, so a Cast can legitimately show one of each. No stencil is
        still the right answer for BOTH: masking a black tattoo by its own
        luminance renders an empty tile, and a rectangle has no shape to mask
        to.

        `crop` stays null for the reason it always does: this is a minted
        picture, not a window onto a bigger one.
      */
      cutouts: [{
        contentUrl: input.contentUrl(worn.storageKey),
        /* NO STENCIL — see above: neither shape wants one. */
        maskUrl: null,
        crop: null,
      }],
      regions: [{
        /*
          WHERE IT IS ON *THIS* FRAME, and the crop's own columns only when
          nothing better exists (ruled fable-1448 §4).

          A delivery crop is minted ONCE from the frame that first delivered
          it and never re-cut, so on every later version these six columns
          describe a picture nobody is looking at — measured on production,
          5 of 6 crops are drift-exposed and one adjacent pair puts the same
          slot 834px apart. The render re-reads a worn tattoo's surface as it
          delivers and files it beside the library's carried boxes, under the
          ink SLOT'S own key, so this is the same lookup every other row does.

          `upperChest` is deliberately never in that map — its surface is
          under the roll prompt's crew tee on an ordinary frame — so its card
          keeps the crop's own geometry and the reason is in the render's log.
        */
        box: input.carriedGeometry?.get(definition.slot) ?? {
          x: worn.bboxX,
          y: worn.bboxY,
          width: worn.bboxW,
          height: worn.bboxH,
          frame: { width: worn.frameWidth, height: worn.frameHeight },
        },
        /* One thing, one rectangle — so the row's own label names it, exactly
           as every other unpaired row does. */
        name: null,
        spoken: null,
        prefill: null,
        slot: definition.slot,
        /* The placement vocabulary decides: `upperArm` is per-side and the
           other two are one-of-it, so a sided ink rectangle narrows and a
           sideless one has nothing to narrow to (fable-1291 §3). */
        scopable: definition.instance !== null,
        whole: false,
      }],
      instances: [],
    });
  }

  /*
    ---- THE KINDS NOBODY HAS CATALOGUED (the founder on his own cast, 1394:
    "the orb isnt showing up in the features panel"; design opus-1041 §5,
    countersigned fable-1397 §1) ----

    A THIRD SOURCE, and like the ink rows above it is one the catalogue cannot
    enumerate — for the opposite reason. Ink is a design at a PLACE the
    catalogue has never had a slot for; an open kind is a thing the catalogue
    has never had a WORD for. Both are facts about this cast that only this
    cast's own rows can answer, so both are built here rather than walked.

    **Nothing is fetched and nothing is invented.** The data was already inside
    this function: `input.rows` is the branch's library, `liveReferences` keeps
    the open rows, `bySlot` holds `open:orb` — and the enumeration above simply
    walks past it, because `catalogueSlots()` has no definition to yield. That
    is the whole of his first sentence.

    # HER WORD, AND ONLY HER WORD

    The catalogue supplies `name`, `pairNoun` and a plural for a courted slot.
    An open kind has none of those, so the row is named from the library row's
    own noun and **no plural and no singular is ever composed from it**. A naive
    `+s` on a customer's noun — or a `wing` cut out of her `wings` — is the same
    class as a rectangle placed by proportion, one grammar down: the product
    asserting a form of her word that she never used.

    That is also why a distributed kind's row opens no children. A pair of
    catalogued eyes has "Left eye" to put on each child, and her wings have
    nothing the product may call one of them. `referenceSlots` already ruled the
    surface this way — *"the panel says her wings and derives its boxes from the
    two rows … the panel still draws no per-side row"* — so the sides are
    storage and the row is the kind.

    # AND THE ROW LEAVES WHEN THE KIND DOES

    Nothing here checks for a prune (fable-1397 §1's condition). A pruned kind's
    library rows retire, `liveReferences` drops a retired row, and the kind is
    simply not in `bySlot` — so the row disappears by the same mechanism that
    makes it appear, rather than by a second rule that could disagree with the
    first. Driven in the suite, because a behaviour with no code of its own is
    the one that breaks silently.
  */
  const openFiled = new Map<string, { slot: FeatureSlot; side: Instance | null }[]>();
  for (const slot of Array.from(bySlot.keys())) {
    const parsed = openKindOfSlot(slot);
    if (parsed === null) continue;
    const held = openFiled.get(parsed.kind) ?? [];
    held.push({ slot, side: parsed.side });
    openFiled.set(parsed.kind, held);
  }

  /** The noun the LIBRARY recorded for this slot — never one derived from the
   *  key. `cat ears` and `cat-ears` both key as `open:cat-ears`, so the key
   *  cannot say which she typed and nothing a customer reads may come from it
   *  (`openLaneKind`'s own binding condition). */
  const openNounOf = (slot: FeatureSlot): string | null => {
    const rows = bySlot.get(slot) ?? [];
    if (rows.length === 0) return null;
    return rows.reduce((held, row) => (row.version > held.version ? row : held)).noun;
  };

  /* An open rectangle is never scopable — see {@link PanelRegion.scopable}. */
  const openRegion = (slot: FeatureSlot, box: PanelBox): PanelRegion => ({
    box,
    /* One row, whatever the library filed underneath it, so the row's own label
       names every rectangle — and on a distributed kind that is a deliberate
       silence rather than an omission: naming one of her wings needs a singular
       of her word, and composing one is the invention this row refuses. */
    name: null,
    spoken: null,
    prefill: null,
    slot,
    scopable: false,
    whole: false,
  });

  for (const filed of Array.from(openFiled.values())) {
    /* THE SIDELESS KEY IS THE WHOLE KIND when the library filed one — a
       `single` or `coLocated` kind files exactly there, and the per-side keys
       are the distributed class's alone. A kind holding both is two grammars
       disagreeing rather than two features, so the whole kind wins and the row
       is one row either way. */
    const sideless = filed.find((one) => one.side === null) ?? null;
    if (sideless !== null) {
      const noun = openNounOf(sideless.slot);
      if (noun === null || noun.trim() === "") continue;
      const state = stateOf(sideless.slot);
      const spokenName = `${input.pronouns.possessive} ${noun}`;
      push({
        state: "settled",
        slots: [sideless.slot],
        group: "open",
        name: capitalize(noun),
        spoken: spokenName,
        words: state.words,
        /* A stated absence is `whenAbsent`'s, authored per catalogued slot
           beside the argument that an empty read there cannot mean "hidden".
           Nobody has catalogued this thing, so nobody has made that argument
           about it. */
        absent: null,
        from: state.from,
        prefill: prefillFor(spokenName),
        cutouts: state.thumb ? [state.thumb] : [],
        regions: state.box ? [openRegion(sideless.slot, state.box)] : [],
        /* One of it, so there is nothing to open. */
        instances: [],
      });
      continue;
    }

    /* ---- a distributed kind: one row, its pixels filed one side each ---- */

    const sides: { slot: FeatureSlot; side: Instance; state: SlotState; noun: string | null }[] = [];
    for (const side of INSTANCES) {
      const one = filed.find((entry) => entry.side === side);
      if (one === undefined) continue;
      sides.push({ slot: one.slot, side, state: stateOf(one.slot), noun: openNounOf(one.slot) });
    }
    if (sides.length === 0) continue;
    const noun = sides.map((side) => side.noun).find((word) => word !== null && word.trim() !== "");
    if (noun === undefined || noun === null) continue;
    const spokenName = `${input.pronouns.possessive} ${noun}`;
    const left = sides.find((side) => side.side === "left") ?? null;
    const right = sides.find((side) => side.side === "right") ?? null;
    /* Derived every time from the words themselves, never a flag — the same
       rule a matched pair of earrings has always followed. */
    const diverged = left !== null && right !== null && pairHasDiverged({
      feature: noun,
      left: { words: left.state.words },
      right: { words: right.state.words },
    });
    /* Ordered as the PHOTOGRAPH reads them, from where the boxes ARE: `left` is
       HER left, which is the image's right, so ordering by the side word would
       mirror every tile on the panel. */
    const pictured = [...sides]
      .map((side) => ({ ...side, at: side.state.thumb?.crop?.x ?? side.state.box?.x ?? null }))
      .sort((a, b) => (a.at === null || b.at === null ? 0 : a.at - b.at));
    push({
      state: "settled",
      slots: sides.map((side) => side.slot),
      group: "open",
      name: capitalize(noun),
      spoken: spokenName,
      words: diverged && left !== null && right !== null
        ? attributedWords(
          { noun: "left", words: left.state.words },
          { noun: "right", words: right.state.words },
        )
        : sides.find((side) => side.state.words.length > 0)?.state.words ?? [],
      absent: null,
      /* Sayable only when both sides came from the same place; two provenances
         is not a fact about the kind. */
      from: sides.every((side) => side.state.from === sides[0]!.state.from) ? sides[0]!.state.from : null,
      prefill: prefillFor(spokenName),
      cutouts: pictured.filter((side) => side.state.thumb !== null).map((side) => side.state.thumb!),
      regions: pictured
        .filter((side) => side.state.box !== null)
        .map((side) => openRegion(side.slot, side.state.box!)),
      /* No children — see the block comment: the product has no word for one of
         her wings and will not compose one. */
      instances: [],
    });
  }

  /*
    ---- THE GROUPING: WHERE EACH FOUND THING ACTUALLY GOES (#2566 slice 2,
    the grouping design of 2026-10-28) ----

    Slice 1 made the reading DECLARE what each thing is (`kind`) and what it
    sits on (`on`), judged from the picture, per cast. This is where the panel
    reads them, and the three destinations are exhaustive:

      the one OUTFIT row    a `clothing` find, plus anything whose `on` chain
                            ends at one. Single pieces become its children.
      ACCESSORIES           every worn thing that is not on a garment — a
                            septum ring, a lip piercing, a choker — one row
                            each, never folded under a body part (his ruling of
                            2026-10-29, #2789; quoted at `placedHomeOf`).
      a CHILD of a row      an `on` that resolves to a row this panel already
                            has, where that is allowed: a charm under its chain,
                            a body feature under the body row it belongs to.
      its OWN row in `open` everything else — the third eye, the jaw hardware,
                            the neck tattoo, the mole.

    # WHY THERE IS NO WORD LIST ANYWHERE IN HERE

    His binding sentence: *"nothing should be confined to a set list thats the
    old way of doing things the new way is the image is analyzed and features
    are determined that way."* Every relation below comes out of the reading.
    ⚠ **And his own ⚠ on the finding is why `kind` and not the noun decides
    Outfit**: the body implants were labelled *Collar*, so a rule keyed on the
    WORD sweeps hardware into clothing. `kind: "clothing"` is the only key to
    that row, and the measured reader put body hardware in `anatomy` 4 of 4
    times with its single miss landing in `accessory` — neither of which can
    enter it.
  */
  /*
    ⚠ **THE TWO FACTS ARE NORMALISED AT THE ONE DOOR THEY COME IN BY, and that
    is belt-on-braces rather than distrust of the type.** Both are REQUIRED on
    {@link PanelScan}, and the one road that can lack them narrows at its own
    boundary (`keptFaceScan`, for a row written between slice 2's two landings).
    What this line buys is that a row arriving without them degrades to TODAY'S
    PANEL — a hostless `anatomy`, so a top-level row in *Also on this character*
    — instead of throwing inside `trim()` and taking the whole panel with it.
    A customer surface should not have one unreadable field as a single point of
    failure for every row on it.
  */
  /*
    ⚠ **AND THE ORDINARY BODY NEVER COMES IN AT ALL (#2840, his word of
    2026-10-30).** *"no idea why collarbone is showing up?"* and *"Her shoulders
    were picked up randomly no idea why."* A body part every person has, named
    as plain anatomy, is where things sit and not a thing on this cast:
    {@link isPlainAnatomy} says which, and its block says why it is a noun
    test and why a narrow one. It is dropped HERE, at the door, so it is
    neither a row nor a host: a body feature the reading put on a shoulder —
    a creature's spikes there — is placed as if it sat on nothing and keeps a
    row of its own, rather than being hung under a row that is not drawn. (A
    tattoo, a scar or a strap on it never folded under a body part at all, by
    his ruling of 2026-10-29: marks and worn things keep their own row. That
    is the half of his word that says marks on a shoulder still list, and an
    arm holds it.)
  */
  const foundRows = (input.scan?.discovered ?? [])
    .filter((found) => typeof found.noun === "string" && found.noun.trim() !== "")
    .map((found) => ({
      ...found,
      kind: found.kind ?? "anatomy",
      on: typeof found.on === "string" ? found.on : "",
    }))
    .filter((found) => !isPlainAnatomy(found));

  /**
   * THE ROW ONE HOST NOUN NAMES, or null.
   *
   * Read off the rows this panel has actually BUILT — `hostNounsOfRow` is
   * filled by `push` — so a row that was never drawn is not a host, and nothing
   * here has to know which loop above produced it.
   */
  const rowHosting = (word: string): PanelRow | null => {
    const key = normalisedName(word);
    for (const [row, words] of Array.from(hostNounsOfRow.entries())) {
      if (words.includes(key)) return row;
    }
    return null;
  };

  /** The found thing one host noun names, or null — the chain's own step. */
  const foundHosting = (word: string): (typeof foundRows)[number] | null => {
    const key = normalisedName(word);
    return foundRows.find((one) => normalisedName(one.noun) === key) ?? null;
  };

  /** The thing the reading named and nothing cut that one host noun names, or
   *  null — read for the Outfit destination only (see `homeOfAnyKind`). Makeup
   *  is never a host: it is a refine subject, not a thing on the cast. */
  const uncutHosting = (word: string): { noun: string; kind: FeatureKind; on: string } | null => {
    const key = normalisedName(word);
    return (input.scan?.namedNotCut ?? []).find(
      (one) => one.why !== "makeup" && normalisedName(one.noun) === key,
    ) ?? null;
  };

  type FoundHome =
    | { home: "outfit" }
    | { home: "child"; parent: PanelRow }
    /* A child of ANOTHER FOUND THING's row — resolved in a second pass, once
       that thing's own row has been drawn. See `homeOf`'s own paragraph. */
    | { home: "underFound"; host: (typeof foundRows)[number] }
    | { home: "own" };

  /**
   * WHERE ONE FOUND THING BELONGS — the whole of rules 3 and 5.
   *
   * ⚠ **THE CHAIN IS FOLLOWED TO ITS TOP HOST AND NOT READ ONE HOP DEEP**,
   * which is the design's own *"chains followed to the top host (buckle on
   * strap, strap on coat → the coat's destination)"*. It is not hypothetical:
   * cast 2556 reads `buckle on=strap`, `strap on=coat` and `coat` clothing, so
   * a one-hop reader puts the buckle in *Also on this character* beside an
   * Outfit row holding the strap it is buckled to.
   *
   * ⚠ **IT IS RECURSIVE RATHER THAN A LOOP OVER `rowHosting`, AND THE REASON
   * IS AN ORDERING THAT BIT THE FIRST VERSION OF THIS BLOCK: a found thing's
   * row does not exist yet while the homes are being decided.** So a `stud on
   * third eye` asked *is there a Third eye row* and was told no — because the
   * Third eye row is pushed by the loop BELOW this one — and got its own row
   * beside its host. The host's own home is the answer instead, which needs no
   * row to exist and gives the same reply whatever order things are drawn in.
   *
   * ⚠ **A CYCLE IS HOSTLESS, not a hang.** A reading that answers `strap
   * on=buckle` and `buckle on=strap` is answering nothing, and the `seen` set
   * is what makes that an answer rather than a loop. Driven directly, because
   * a model that usually behaves is no test of a guard (working law 3).
   */
  /*
    ⚠ **ANATOMY NEVER ENTERS THE OUTFIT, BY ANY ROAD — #2752's sweep of his
    round-1 ⚠, closing a door slice 2 left open.** The guard was written as
    *"only `kind: clothing` may enter the Outfit row"*, and the chain below let
    anything whose `on` led to a garment in after it — so a reading that said
    `jaw hardware on=collar`, with the collar read as clothing, would have swept
    body hardware into the outfit through the side door, which is precisely the
    case his ⚠ named. The bench's 4-of-4 measured the KIND; it never measured
    the `on`. So the bar is on the destination, whatever led there: an anatomy find
    whose chain ends in the outfit keeps its own row, and anything sitting on IT
    folds under that row rather than following it in.
  */
  const homeOf = (
    found: { noun: string; kind: FeatureKind; on: string },
    seen: ReadonlySet<string> = new Set(),
  ): FoundHome => {
    const home = homeOfAnyKind(found, seen);
    return home.home === "outfit" && found.kind === "anatomy" ? { home: "own" } : home;
  };

  const homeOfAnyKind = (
    found: { noun: string; kind: FeatureKind; on: string },
    seen: ReadonlySet<string>,
  ): FoundHome => {
    if (found.kind === "clothing") return { home: "outfit" };
    const host = found.on.trim();
    if (host === "") return { home: "own" };
    const key = normalisedName(host);
    /* A cycle, or a thing pointing at itself: the reading has said nothing
       about where this sits, so it is hostless and keeps its own row. */
    if (key === normalisedName(found.noun) || seen.has(key)) return { home: "own" };
    const step = foundHosting(host);
    if (step !== null) {
      /* The host's OWN destination is this one's — that is what *to the top
         host* means. A host in the outfit takes its lodgers with it; a host
         that folded under a row takes them to the same row, because a child
         has no children of its own. */
      const deeper = new Set(Array.from(seen));
      deeper.add(key);
      deeper.add(normalisedName(found.noun));
      const above = homeOf(step, deeper);
      if (above.home === "own") return { home: "underFound", host: step };
      return above;
    }
    const parent = rowHosting(host);
    if (parent !== null) return { home: "child", parent };
    /*
      HARDWARE ON A GARMENT THAT HAS NO PICTURE IS STILL PART OF THE OUTFIT
      (#2801, his eye on the first creature).

      His words, verbatim: *"buckle and ring and just the strap across his chest
      apart of the outfit called eccesories"*. Read on his picture: the reading
      calls the strap `harness`, a garment, and the buckle and ring worn things
      on it. The strap is a diagonal in a huge box, so its fill sits ON the fill
      floor (0.204–0.205 on three readings); on the reading where it had no cut,
      the buckle and ring had nothing drawn to sit on and were listed as
      accessories.

      So an UNCUT host is consulted for the one destination that needs no row
      to exist: if the reading says it is a garment (or sits on one), what sits
      on it is part of the Outfit. ~~and keeps its own picture there as a
      piece~~ — since #2862 only a garment is a piece row there (his word on
      drawstrings, quoted at the Outfit block), so a buckle and a ring on an
      uncut harness are in the outfit and draw nothing of their own.
      ⚠ **Only the Outfit, never a fold under the uncut thing**: a child of a
      thing with no picture would hang a visible row under an invisible one,
      and the design says a thing that cannot be cut gets no row. Anything else
      on an uncut host keeps its own row, exactly as before.
    */
    const uncut = uncutHosting(host);
    if (uncut !== null) {
      const deeper = new Set(Array.from(seen));
      deeper.add(key);
      deeper.add(normalisedName(found.noun));
      if (homeOf(uncut, deeper).home === "outfit") return { home: "outfit" };
    }
    /* A name nothing drew and nothing found — `forehead`, `jaw`, `neck`,
       `shoulder` on the real fixtures. It keeps its own row, which is exactly
       where the third eye and the jaw hardware belong. */
    return { home: "own" };
  };

  /*
    ---- A WORN THING IS AN ACCESSORY, AND A BODY ROW HOLDS THE BODY ALONE (his
    ruling, 2026-10-29, #2789) ----

    His word, verbatim, on the relay's recommendation: *"go with your
    reccomendation"*. The recommendation accepted:

      every worn thing — earrings, a septum ring, a lip piercing, eyebrow bars,
      glasses, any piercing or jewellery — is a row under ACCESSORIES and never
      folds under a body part; the body rows (Eyes, Brows, Nose, Lips, Ears)
      hold the body alone; marks on the skin (tattoos, scars) stay in *Also on
      this character*; clothing stays in the Outfit.

    It reverses his earlier sentence, which this block used to apply and which
    is kept here struck rather than deleted, because a later hand reading the
    old frames needs to know it was his and that he changed it:
    ~~*"a lip ring goes under Lips, an ear piercing under Ears"*~~.

    So the chain above still decides where a thing SITS, and this decides where
    it LISTS. Three things do not move, each for a reason:

      ON A GARMENT   a worn thing whose chain ends in the outfit stays there — a
                     buckle on a strap on a coat is part of the coat (#2752), and
                     *"clothing stays in the Outfit"* is the same sentence. Since
                     #2862 it is IN the outfit without a row of its own: only a
                     garment is a piece row (his round 11: the chain on her
                     harness *"is apart of her outfit"*).
      ON A WORN ROW  a charm on a chain, a chain on a choker, a charm on the
                     catalogue's Earrings: a worn thing on a worn thing is not
                     on a body part, so it stays that thing's child.
      ANATOMY        a body feature on a body row is the body, and stays where
                     it was.

    ⚠ **The two-instance rule is untouched (#2565 §6)**: each cut instance is
    its own row here exactly as it was its own child there, so two piercings are
    two rows.
  */
  const BODY_SECTIONS: readonly PanelSection[] = ["face", "hair", "body"];
  const placedHomeOf = (found: { noun: string; kind: FeatureKind; on: string }): FoundHome => {
    const home = homeOf(found);
    if (found.kind !== "accessory" && found.kind !== "marking") return home;
    if (home.home === "child" && BODY_SECTIONS.includes(home.parent.group)) return { home: "own" };
    if (home.home === "underFound" && home.host.kind === "anatomy") return { home: "own" };
    return home;
  };

  /**
   * THE FACE THIS SCAN ITSELF DREW — the span of the catalogue face rows it
   * actually cut, or null when it cut none.
   *
   * This is the measuring stick for *is a found body part on the face*, and it
   * is the scan's OWN answer rather than a list of face words: whatever the
   * catalogue groups as `face` (eye, brow, lashes, nose, lips, teeth,
   * cheekbone, jaw, chin, ear, horns), and only those of them this cast turned
   * out to have. A creature whose single drawn face row is its horns is
   * measured by its horns — the right answer for that creature, and one no word
   * list could give. That is N3's own principle (*"we really cannot be working
   * from fixed lists in a fluid editing application"*).
   *
   * ⚠ **Only boxes sharing the asking thing's frame are unioned.** *A box
   * without its frame is a rectangle in an unknown space* ({@link PanelBox}'s
   * own header), so a slot measured on another frame is skipped rather than
   * mixed into the span. Memoised per frame because every found row on one scan
   * asks the same question.
   */
  const faceExtents = new Map<string, FaceExtent | null>();
  const faceExtentOn = (frame: PanelBox["frame"]): FaceExtent | null => {
    const key = `${frame.width}x${frame.height}`;
    const held = faceExtents.get(key);
    if (held !== undefined) return held;
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    const drawnSlots = input.scan?.slots;
    if (drawnSlots !== undefined) {
      drawnSlots.forEach((drawn, slot) => {
        if (slotDefinition(slot)?.group !== "face") return;
        if (drawn.box.frame.width !== frame.width || drawn.box.frame.height !== frame.height) return;
        left = Math.min(left, drawn.box.x);
        right = Math.max(right, drawn.box.x + drawn.box.width);
        top = Math.min(top, drawn.box.y);
        bottom = Math.max(bottom, drawn.box.y + drawn.box.height);
      });
    }
    /* The centre of what was drawn is the honest midline here. The reader's own
       comes off the face read the side-splitting already used; a span built
       from rectangles has no better answer, and {@link FaceExtent} says so. */
    const extent = left <= right && top <= bottom
      ? { left, right, top, bottom, midline: (left + right) / 2, middle: (top + bottom) / 2 }
      : null;
    faceExtents.set(key, extent);
    return extent;
  };

  /**
   * The section a found thing's OWN row lists in: a worn thing is an
   * accessory, by his ruling above; a mark on the skin is also on this
   * character; a BODY PART lists under Face when it is ON the face, and under
   * Body when it is not.
   *
   * ⚠ **Body parts moved out of *Also on this character* on 2026-10-29 (#2801)**,
   * on his eye on the first creature: a found *Tusks* row sat beside the
   * tattoos. His ruling above puts marks in that section; a tusk, a snout or a
   * third eye is the body.
   *
   * ⚠ **AND FACE IS NO LONGER WHERE EVERY BODY PART LANDS — #2840, his eye
   * rounds 9 and 10.** This docblock used to close *"a body part that is not on
   * the face (a tail, a wing) also lists under Face, because nothing on the
   * reading says which is which without a word list; that limit is declared on
   * the card"*, and #2807 part 1 named the day that limit would end: *"a
   * reading holding a body part the scan's face cuts do not touch is the day
   * this becomes one branch plus one frame for his eye"*. His round 9 drew
   * **two Shoulders rows under Face**, and his round 10 a **Collarbone** —
   * *"no idea why collarbone is showing up?"*. Those are the instance.
   *
   * **The branch reads PLACE, not words**: a found body part whose box is not
   * centred on {@link faceExtentOn}'s span lists under Body. `Body` is already
   * declared in {@link PANEL_GROUPS} between Hair and Outfit, and an empty
   * section filters itself out — so this needs no panel design and adds no
   * heading to a cast that has no body rows. His own placement ruling (#2789)
   * is what it serves: *"the body rows hold the body alone"*.
   *
   * ⚠ **It fails toward today's panel.** A scan that drew no face row at all
   * has no span to measure against, and every body part stays under Face
   * exactly as it does now — a missing measurement never moves a row.
   *
   * ⚠ **AND THE TWO ROWS THAT OPENED THIS BRANCH ARE NO ROWS AT ALL NOW** —
   * the second half of #2840, his word of 2026-10-30: *no* to collarbone and
   * shoulders being rows, *yes* to a Body section for real features. They are
   * dropped at the door ({@link isPlainAnatomy}), so what lists under Body is
   * what he agreed it is for: a tail, wings, an implant off the face. His
   * lizard's tail is the measured one — named, boxed and cut on his account's
   * road, and drawn here.
   */
  const ownSectionOf = (found: { kind: FeatureKind; box: PanelBox }): PanelSection => {
    if (found.kind === "accessory") return "accessories";
    if (found.kind !== "anatomy") return "open";
    const face = faceExtentOn(found.box.frame);
    if (face === null) return "face";
    const centreX = found.box.x + found.box.width / 2;
    const centreY = found.box.y + found.box.height / 2;
    return onTheFace(centreX, centreY, face) ? "face" : "body";
  };

  /** One found thing as a child of whatever it sits on. */
  const foundChild = (found: (typeof foundRows)[number]): PanelInstance => {
    const noun = found.noun.trim();
    const spokenName = `${input.pronouns.possessive} ${noun}`;
    return {
      slot: found.slot,
      name: capitalize(noun),
      spoken: spokenName,
      prefill: prefillFor(spokenName),
      /* What the reading SAID about it is prose for the current description,
         not a line under its own picture — the found row's own rule, and a
         child is that same row one level in. */
      words: [],
      cutout: {
        contentUrl: input.scan?.frameUrl ?? "",
        maskUrl: found.maskUrl,
        crop: found.box,
      },
      box: found.box,
      /* NEVER — `refineService`'s scope door answers `scope_unknown` on a
         `discovered:` key, driven at the code. See
         {@link PanelInstance.scopable}. */
      scopable: false,
    };
  };

  /** Its rectangle on the photograph, named, the way a pair's sides are. */
  const foundChildRegion = (found: (typeof foundRows)[number]): PanelRegion => {
    const noun = found.noun.trim();
    const spokenName = `${input.pronouns.possessive} ${noun}`;
    return {
      box: found.box,
      /* NAMED, exactly as a pair's rectangles are and for the identical reason:
         the row above speaks the person's ontology ("their lips") while this
         rectangle is a promise about these pixels, so it says which thing it
         is. Bare, because a tag is a label (founder, fable-451). */
      name: capitalize(noun),
      spoken: spokenName,
      prefill: prefillFor(spokenName),
      slot: found.slot,
      scopable: false,
      /* A PIECE, never the collection — the Outfit row's own whole rectangle is
         built beside the row itself (#2845). */
      whole: false,
    };
  };

  /* ---- the folds and the outfit's pieces, decided before anything is drawn ---- */
  const outfitPieces: (typeof foundRows)[number][] = [];
  const foldedUnder = new Map<PanelRow, (typeof foundRows)[number][]>();
  /* The lodgers of a found thing, keyed by that thing's own row-to-be. They
     cannot be attached until the own-row loop below has drawn it. */
  const foldedUnderFound = new Map<(typeof foundRows)[number], (typeof foundRows)[number][]>();
  const ownRows: (typeof foundRows)[number][] = [];
  for (const found of foundRows) {
    const home = placedHomeOf(found);
    if (home.home === "outfit") { outfitPieces.push(found); continue; }
    if (home.home === "child") {
      const held = foldedUnder.get(home.parent) ?? [];
      held.push(found);
      foldedUnder.set(home.parent, held);
      continue;
    }
    if (home.home === "underFound") {
      const held = foldedUnderFound.get(home.host) ?? [];
      held.push(found);
      foldedUnderFound.set(home.host, held);
      continue;
    }
    ownRows.push(found);
  }

  /**
   * ONE ROW REPLACED IN PLACE, keeping its host words with it.
   *
   * ⚠ **The host-word entry has to MOVE or the next write to the same row finds
   * nothing.** `hostNounsOfRow` is keyed on the row OBJECT, and both the fold
   * below and the words pass further down replace that object — so a second
   * fold onto one parent, or a words line onto a row that already took a child,
   * would silently land nowhere. It is one line and it is the only thing about
   * this helper that is not obvious.
   */
  const replaceRow = (row: PanelRow, fresh: PanelRow): void => {
    const held = rowsOf.get(row.group);
    if (held === undefined) return;
    const at = held.indexOf(row);
    if (at < 0) return;
    held[at] = fresh;
    const words = hostNounsOfRow.get(row);
    if (words !== undefined) {
      hostNounsOfRow.delete(row);
      hostNounsOfRow.set(fresh, words);
    }
  };

  /**
   * ONE LINE OF WORDS ONTO A ROW, deduplicated by the sentence itself.
   *
   * The same rule `foldedWords` already follows for a folded catalogue slot:
   * two crops of one face can report the same scattered thing, and a row that
   * said it twice would read as the product repeating itself.
   */
  const wordsOnto = (row: PanelRow, said: string): void => {
    if (row.words.includes(said)) return;
    replaceRow(row, { ...row, words: [...row.words, said] });
  };

  /*
    ---- A FOUND THING FOLDS UNDER THE ROW IT SITS ON (rule 3) ----

    ~~His own sentence: a lip ring goes under Lips, an ear piercing under
    Ears.~~ ⚠ **Reversed by his ruling of 2026-10-29 (#2789), quoted in full at
    `placedHomeOf` above: every worn thing is a row under Accessories and the
    body rows hold the body alone.** What still folds here is a body feature
    under the body row it belongs to, and anything worn on a worn row (a charm
    under the catalogue's Earrings). The grammar is already here — the pair
    rows' children — so it is REUSED rather than invented, which is the
    design's instruction in its own words.

    ⚠ **THE TWO-INSTANCE RULE SURVIVES THE FOLD**: two of a thing are two
    children with two cuts, never a union (#2565 §6). They arrive from the
    pointer road as two rows already, so nothing here has to preserve it — what
    this paragraph prevents is a later hand merging them *because they share a
    noun*.

    ⚠ **AND THE PARENT'S OWN `slots` DOES NOT GROW.** Tapping Lips is an ask
    about the lips, not about a ring on them, and a row whose `slots` quietly
    included its lodgers would send an edit meaning both. The child carries its
    own tap and its rectangle carries its own name.
  */
  /*
    ---- HAIR IS ONE ROW AND ONE OUTLINE (his ruling, #2862, 2026-10-31) ----

    His eye, round 11, verbatim: *"why is the hair compartmantizilied? even if
    i make an edit to her right bun by selecting it (i tested this) it edits her
    whole hair anyway. Should hair just be one whole box?"* The panel drew
    `Bun`, `Bun` and `Fringe` as children of Hair, each with its own outline,
    and every one of them promised an edit the product does not make. The noun
    also wandered between his scans — `fringe` on one, `bangs` on the next —
    which one row hides and sub-rows put on show.

    So a body part the reading says sits ON a hair row becomes part of that
    row: no child, no rectangle of its own, and the row keeps the one outline
    the scan cut for the hair. A bun is changed the way his ruling says, by
    words ("shorter bangs", "make the buns bigger") on the Hair row.

    ⚠ **THIS IS NOT THE TWO-INSTANCE RULE BEING BROKEN, AND THE DIFFERENCE IS
    HIS OWN TEST.** The paragraph above forbids merging two of a thing *because
    they share a noun*, and two buns share one. That rule protects things that
    are each an item in their own right and can each be edited as themselves —
    the two earrings of a pair, whose sides the scope door narrows to, or two
    piercings, each its own row. A bun is not an item: it is the hairstyle, and
    the product edits the whole hair whichever bun is tapped. A sub-row there
    is a promise the product cannot keep, which is a different defect from the
    one #2565 §6 guards. **Everything else keeps the rule exactly**: two
    dimples on Lips are still two children, two piercings still two rows, a
    charm on the catalogue's Earrings still its child.

    ⚠ **WHICH ROWS, AND WHY IT IS NOT A WORD LIST.** A row that holds no parts
    is one the CATALOGUE declares as a single slot in its `hair` group — its
    hair and its facial hair today, read off `slotDefinition` every time. The
    horns share that heading and are deliberately outside it: they are a
    left-and-right pair whose sides are scopable, which is the two-instance
    rule's own population. Facial hair is the one sibling this sweep took in
    (law 7) — the same single-slot hair edit, so a goatee on a beard is the
    beard — and it is named here so the next reader meets it as a decision.

    ⚠ **WHAT IT DOES NOT CATCH, declared.** It reads the reading's own `on`. On
    every reading kept on disk for his casts every hair part — bangs, bun,
    buns, fringe, hair bun, space buns — is `kind: anatomy, on: hair`, so the
    rule reaches all of them; a part the reading ever files `on: head` instead
    would still draw its own row, because nothing here judges by pixels. The
    cut for each part is still bought by the pointer road: a found thing sitting
    on a bun is judged against the bun's own cut there, so the cut is evidence
    even where the panel draws no row from it.
  */
  const holdsNoParts = (row: PanelRow): boolean =>
    row.slots.length > 0 && row.slots.every((slot) => {
      const definition = slotDefinition(slot);
      return definition !== null && definition.group === "hair" && definition.instance === null;
    });
  for (const [parent, children] of Array.from(foldedUnder.entries())) {
    if (holdsNoParts(parent)) {
      /* The scan cut the hair, so its own outline is the hair's and the parts
         add nothing to the picture. */
      if (parent.regions.length > 0) continue;
      /*
        AND WHEN THE SCAN CUT NO HAIR BUT THE READING CUT ITS PARTS, the parts
        give the one row its one outline rather than taking the hair off the
        panel: the union of their boxes, a window on the frame with no stencil
        — the Outfit row's own shape, for the same reason. Without this the
        rule above would delete a Hair row that today shows its buns.

        `absent` is cleared because a box means the hair IS on this frame,
        which is `absentSays`'s own fourth condition: a row may not say
        *bald* over an outline of somebody's buns.
      */
      const boxes = children.map((child) => child.box);
      const union: PanelBox = {
        x: Math.min(...boxes.map((box) => box.x)),
        y: Math.min(...boxes.map((box) => box.y)),
        width: Math.max(...boxes.map((box) => box.x + box.width)) - Math.min(...boxes.map((box) => box.x)),
        height: Math.max(...boxes.map((box) => box.y + box.height)) - Math.min(...boxes.map((box) => box.y)),
        frame: boxes[0]!.frame,
      };
      replaceRow(parent, {
        ...parent,
        absent: null,
        cutouts: parent.cutouts.length > 0
          ? parent.cutouts
          : [{ contentUrl: input.scan?.frameUrl ?? "", maskUrl: null, crop: union }],
        regions: [{
          box: union,
          name: null,
          spoken: null,
          prefill: null,
          slot: parent.slots[0]!,
          scopable: false,
          whole: false,
        }],
      });
      continue;
    }
    replaceRow(parent, {
      ...parent,
      regions: [...parent.regions, ...children.map(foundChildRegion)],
      instances: [...parent.instances, ...children.map(foundChild)],
    });
  }

  /*
    ---- THE OUTFIT IS ONE ROW (rule 5) ----

    ⚠ **HIS COMPLAINT WAS SIX ROWS FOR ONE OUTFIT, and the answer is not fewer
    garments, it is one row.** A customer looking at their cast has an outfit in
    mind, not a list of garments — law 8, the stylist's ontology over the
    reader's.

    The picture is the frame cropped to the UNION of the pieces' boxes: the
    dressed figure, no stencil, which is the ink rows' own `maskUrl: null`
    shape. Each piece stays real underneath as a child with its own cut, so
    *"change the strap"* is one tap deeper and the edit still names the strap in
    words.

    ⚠ **The row's `slots` DOES hold every piece, unlike a folded parent's**, and
    the difference is the noun: *outfit* IS the collection, so tapping it is an
    ask about all of it and lighting every piece on the photograph is the truth.
    *Lips* is not a collection of a lip and a ring.
  */
  /*
    ---- ONLY A GARMENT IS A PIECE OF THE OUTFIT ON THE PANEL (his word,
    #2862, 2026-10-31) ----

    His question on round 11, verbatim: *"the outfit picked up draw strings
    which is fine but is it neccesary?"* — and, answering the relay's
    recommendation of garments only, *"on your question about drawstrings
    yes"*. The same round: *"it thought the chain which is apart of her outfit
    was a necklace"*.

    So under Outfit a piece row is a GARMENT's — what the reading itself calls
    `clothing`: a hoodie, a top, a harness, a jacket. Anything else whose chain
    ends in the outfit — a chain, a buckle, a zip, a stud, a drawstring the
    reading calls a worn thing — is part of the Outfit and draws no row and no
    rectangle of its own. It is still IN the outfit: its slot rides on the row's
    `slots` (tapping Outfit is an ask about all of it), the scattered words of
    it still land on this row, and it is changed by words ("remove the chain").

    ⚠ **The line is the reading's `kind`, never the noun**, which is the same
    reason `kind` and not the word decides what may enter this row at all (his
    ⚠ about the implants labelled *Collar*). That has a cost said out loud: a
    strap the reading calls an accessory gets no row here, and a drawstring it
    calls clothing still gets one. Telling a garment's built-in part from a
    second garment worn over it (a collar of a top against a corset over it)
    is a question about the picture, and it is #2856's boxes, not this rule.

    ⚠ **AND THE OUTLINE AND THE THUMBNAIL ARE THE GARMENTS'.** A row whose only
    pieces were trims would outline a buckle and call it the outfit, so there
    is no Outfit row unless a garment was cut — the trims are then edited by
    words, which is #2856's cautious panel: a missing row costs nothing, a
    wrong outline costs a paid edit painted on the wrong thing.
  */
  const garments = outfitPieces.filter((piece) => piece.kind === "clothing");
  if (garments.length > 0) {
    /*
      THE OUTLINE IS BUILT FROM THE PASSING PIECES ONLY — his ruling of
      2026-10-30 (#2856, point 4): *"The whole-Outfit outline must never be
      built from a failed piece."*

      ⚠ **A PIECE THAT FAILS STILL KEEPS ITS OWN RECTANGLE AND ITS OWN ROW
      HERE, and that is deliberately NOT the whole of his ruling.** Point 3
      says a failed piece gets no row at all; that is #2845's defect 2 and sits
      beside his other three checks (a shared box, its own place, a real
      feature), none of which this panel can answer yet. Taking one of the four
      and dropping rows on it would hide pieces for one reason while the other
      three still drew theirs — so what moves here is exactly what the relay's
      finding asked for: **the WHOLE-outfit outline is protected**, and the
      failing piece is lit only when it is itself the subject.

      ⚠ **AND WHEN NO PIECE PASSES, THE ROW DRAWS NO WHOLE RECTANGLE AT ALL**
      rather than inventing one: `whole` is simply absent, which is the branch
      every other row on the panel takes, and the picture falls back to one
      rectangle per piece — the panel as it was before this card. A row with
      nothing to outline must not outline the wrong thing.
    */
    const outlined = garments.filter((piece) => piece.coversFace !== true);
    /* The thumbnail still needs a window even when nothing may be outlined, and
       the honest window is the one this row has always had — every garment. It
       is the only value in this block that is ever taken from a failing piece,
       and no rectangle is drawn from it. */
    const boxes = (outlined.length > 0 ? outlined : garments).map((piece) => piece.box);
    const union: PanelBox = {
      x: Math.min(...boxes.map((box) => box.x)),
      y: Math.min(...boxes.map((box) => box.y)),
      width: Math.max(...boxes.map((box) => box.x + box.width)) - Math.min(...boxes.map((box) => box.x)),
      height: Math.max(...boxes.map((box) => box.y + box.height)) - Math.min(...boxes.map((box) => box.y)),
      /* Every box on a reading was measured on the one frame the reading was
         taken from, so the first piece's frame is the union's frame — a box
         without its frame is a rectangle in an unknown space. */
      frame: boxes[0]!.frame,
    };
    const spokenName = `${input.pronouns.possessive} outfit`;
    push({
      state: "settled",
      slots: [OUTFIT_SLOT, ...outfitPieces.map((piece) => piece.slot)],
      group: "outfit",
      /* The PRODUCT's word for the collection, authored here and in
         {@link PANEL_GROUPS}'s heading. No reading gave a noun for *all of
         these pieces together*, so there is none of anybody's to use. */
      name: "Outfit",
      spoken: spokenName,
      /* Filled by the words pass below: a scattered piece — rough stitching,
         fraying, a leather patch — contributes words here rather than a child. */
      words: [],
      absent: null,
      from: null,
      prefill: prefillFor(spokenName),
      cutouts: [{
        contentUrl: input.scan?.frameUrl ?? "",
        /* NO STENCIL: the picture is the dressed figure in a window, not a
           shape cut out of it. A union of several masks would be several
           disconnected islands with the body showing between them, which is
           not what anybody means by an outfit. */
        maskUrl: null,
        crop: union,
      }],
      /*
        THE WHOLE OUTFIT FIRST, THEN ITS PIECES — his word, 2026-10-30 (#2845):
        *"also outfit should be selectablke as a whole"*, and *"shouldnt there
        be a box for the whole outfit with the individual pieces inside it"*.

        ⚠ **THE CLAUSE THAT STOOD HERE IS STRUCK RATHER THAN DELETED, because
        its reasoning is exactly what he overruled and the next hand should see
        what it cost:** ~~"One rectangle per PIECE rather than the union: a
        union rectangle over a dressed figure is the whole figure, which points
        at nothing."~~ The sentence is true of a rectangle drawn ALONE — and
        drawn alone was never what he asked for. What he saw instead was five
        lit rectangles and read it, correctly, as the panel editing pieces one
        at a time: *"why cant i select his outfit box as a whole its selecting
        individual pieces?"*

        ⚠ **AND THE EDIT ALREADY MEANT ALL OF IT — only the picture disagreed.**
        `slots` above has carried every piece since #2566 slice 2, so a tap on
        this row has always sent one ask about the whole outfit. So nothing
        about what an edit MEANS moves here; what moves is that the photograph
        now says the same thing the ask says.

        The union is the row's extent and is the same rectangle the thumbnail
        above is already cropped to — so it is one value used twice rather than
        a second measurement that can disagree with the picture beside it. The
        pieces stay real underneath, each with its own rectangle and its own
        child row, which is his *"with the individual pieces inside it"*.

        Largest-first paint order (`FaceRegions`'s own smallest-wins rule) puts
        this rectangle UNDERNEATH every piece it was built from, because a
        union can never be smaller than what it unions — so a point over such a
        piece still belongs to that piece and nothing had to be told about
        z-order.

        ⚠ **THAT SENTENCE READ *"underneath every piece"* UNTIL #2856's CHECK 1
        LANDED, AND IT IS NARROWED RATHER THAN LEFT STANDING.** A piece left
        OUT of the union is not bounded by it, so a failing piece bigger than
        the passing ones paints first and the whole rectangle sits on top of
        the part of it they overlap. That is the right way round and not a
        regression: a garment whose shape lies over the face is exactly the one
        that must not swallow the points inside the outfit's own outline, and
        it is still reachable on every pixel of itself the outline does not
        cover, plus its own child row in the panel.
      */
      regions: [
        ...(outlined.length > 0 ? [{
          box: union,
          /* NAMED NOTHING, which on this panel means *it covers what the row
             says it does* — the row says Outfit and this is the outfit. A name
             here would be the product inventing a noun for all-of-these-pieces
             that no reading gave, which {@link OUTFIT_SLOT} forbids. */
          name: null,
          spoken: null,
          prefill: null,
          slot: OUTFIT_SLOT,
          /* Not a narrowing: tapping the whole outfit is the ROW's ask, which
             is every piece. A scope would say the opposite of what it is. */
          scopable: false,
          whole: true,
        }] : []),
        /* The garments' own rectangles, and nothing else's — see the block
           above this one: a trim is in the outfit and draws no rectangle. */
        ...garments.map(foundChildRegion),
      ],
      instances: garments.map(foundChild),
    }, ["outfit"]);
  }

  /*
    ---- WHAT THE READING FOUND THAT NOBODY CATALOGUED (#2566 slice 2's pointer
    road, under the design he approved on #2532) ----

    ⚠ **A THIRD SOURCE OF ROWS, BESIDE THE CATALOGUE AND THE LIBRARY, and it is
    the first one that is a READING.** Every loop above this walks either
    `catalogueSlots()` — a closed, hand-authored vocabulary — or `bySlot`, which
    is what the customer's own edits filed. Neither can hold a jacket, a sash or
    a third eye, and that is #30's whole complaint and his own: *"n3 is meant to
    be bringing in the ability to detect all/any features right rather than from
    a list?"*

    # Why it lands in the OPEN section rather than a new one

    `open` already means *also on this character* and already carries rows
    nobody catalogued. A fourth section would be a second heading for one idea,
    and a customer looking at their cast has no use for the distinction between
    *a thing you introduced by editing* and *a thing we found by looking* — that
    is our bookkeeping, which is the disappearing-technology law's clause 6.

    # The rules it inherits rather than restates

    **His picture rule** (*"no features should ride in the image analyzer on the
    right panel unless it has an image to go with it"*): `hasContent` below
    already drops a row with no rectangle, and the reader upstream already
    refuses a cut with no pixels — so a name that could not be cut has no row
    here, with nothing to add. **The scan's pending grace is not extended to
    these** for the same reason it is not extended to an open kind: the grace
    keeps a place for an answer the catalogue walk is certainly going to give,
    and there is no catalogue walk behind a found row (`keep`'s own clause,
    `row.group !== "open"`).

    **A found rectangle is never scopable**, exactly as an open one is not: the
    scope door admits a catalogued instance and nothing else, so offering a
    narrow edit on *the jacket* would be an affordance the server refuses.

    # And the noun comes from the reading, never from the key

    `openNounOf` reads the library's recorded noun for the same reason, in the
    same words: `cat ears` and `cat-ears` slug alike, so a key cannot say which
    was written. These rows carry theirs as data.

    Rows of ONE noun stay distinct rather than merging into a pair: two straps
    are two items (#2565 §6), the reading counted them, and composing a singular
    of somebody's word to label one of them is the invention the distributed-kind
    row above refuses by name. So each instance is its own row, and its label is
    the noun it was found under.
  */
  /*
    ---- AND SINCE SLICE 2'S GROUPING, NOT EVERY FOUND THING COMES HERE ----

    ⚠ **UNTIL THE GROUPING LANDED THIS LOOP DREW EVERY FOUND THING AS A
    TOP-LEVEL SIBLING, and his eye found five separate defects in that one
    fact.** The panel knew WHAT the reading had named and nothing about what
    each named thing IS, so the only grouping instrument on the road was a
    spelling test (`coveredByCatalogue`): "lip ring" became a sibling of Lips,
    "eye makeup" became a row at all, six garment nouns became six rows.

    Slice 1 answered it at the source — the reading DECLARES `kind` and `on` per
    feature, judged from the picture, per cast. The grouping block above reads
    them and this loop now draws only what is left: the third eye, the jaw
    hardware, the neck tattoo, the mole. Everything in the paragraphs below
    still holds of those rows, word for word.
  */
  /* The row each own-row found thing became, so its lodgers can be attached
     once it exists — see `foldedUnderFound`. */
  const rowOfFound = new Map<(typeof foundRows)[number], PanelRow>();
  for (const found of ownRows) {
    const noun = found.noun.trim();
    const spokenName = `${input.pronouns.possessive} ${noun}`;
    const row: PanelRow = {
      state: "settled",
      slots: [found.slot],
      group: ownSectionOf(found),
      name: capitalize(noun),
      spoken: spokenName,
      /*
        NO WORDS, and that is the honest answer rather than a gap. What the
        reading said ABOUT this thing is prose for the current description
        (#2565 §2), not a line under its own picture: the row's name is the
        reading's own noun already, so a description beside it would be the
        reader talking about its own answer.
      */
      words: [],
      /* A stated absence is `whenAbsent`'s, authored per catalogued slot beside
         the argument that an empty read there cannot mean hidden. Nobody has
         catalogued this thing, so nobody has made that argument about it. */
      absent: null,
      /* Neither "they came with it" nor "from an edit": this is what the
         photograph shows, which is what a described row answers too. */
      from: null,
      prefill: prefillFor(spokenName),
      cutouts: [{
        contentUrl: input.scan?.frameUrl ?? "",
        maskUrl: found.maskUrl,
        crop: found.box,
      }],
      regions: [openRegion(found.slot, found.box)],
      /* One cut instance of ITSELF; anything the reading said sits on it is
         attached by the pass below. */
      instances: [],
    };
    push(row);
    rowOfFound.set(found, row);
  }

  /*
    ---- AND A FOUND THING THAT SITS ON ANOTHER FOUND THING, once that one has
    a row (#2566 slice 2) ----

    A stud on the third eye, a charm on a strap that is not clothing. It is a
    second pass for one reason and the reason is ordering: the homes are decided
    before any found row is drawn, so there is nothing to fold under yet.
    `homeOf` answers `underFound` there and this is where that answer is spent.
  */
  for (const [host, children] of Array.from(foldedUnderFound.entries())) {
    const parent = rowOfFound.get(host);
    /* A host that resolved to its own row is in `ownRows`, so this cannot miss
       — but a host that somehow never drew leaves its lodgers where they were
       rather than dropping them, which is a row each in `open`. */
    if (parent === undefined) {
      for (const child of children) {
        const noun = child.noun.trim();
        const spokenName = `${input.pronouns.possessive} ${noun}`;
        push({
          state: "settled",
          slots: [child.slot],
          group: ownSectionOf(child),
          name: capitalize(noun),
          spoken: spokenName,
          words: [],
          absent: null,
          from: null,
          prefill: prefillFor(spokenName),
          cutouts: [{
            contentUrl: input.scan?.frameUrl ?? "",
            maskUrl: child.maskUrl,
            crop: child.box,
          }],
          regions: [openRegion(child.slot, child.box)],
          instances: [],
        });
      }
      continue;
    }
    replaceRow(parent, {
      ...parent,
      regions: [...parent.regions, ...children.map(foundChildRegion)],
      instances: [...parent.instances, ...children.map(foundChild)],
    });
  }

  /*
    ---- THE WORDS WITH NO PICTURE (#2566 slice 2's rules 2 and 4) ----

    ⚠ **A SCATTERED THING IS NEVER CUT AND IS NOT THEREBY FORGOTTEN.** Freckles
    are scattered across skin and rough stitching across a coat; the detector is
    never asked for a thing that has no outline — which removes the
    freckles-cut-to-the-tattoo class at its source — and the words go to the row
    it sits on. Here is where *the row it sits on* is answered, because this is
    the only place that knows which rows exist.

    ⚠ **MAKEUP GETS NO ROW AND NO WORDS ON ONE, whatever it sits on** — his
    ruling, and the one entry here that is skipped rather than routed. Eyeliner
    on eyes must not write a line onto the Eyes row: a row's words line is a
    description of the feature the row IS, and makeup is something you change
    with words rather than a thing in the list.

    ⚠ **AND WHAT IS NOT BUILT IS DECLARED: THE CURRENT DESCRIPTION IS NOT
    WRITTEN FROM HERE.** The design sends a hostless scattered thing, and every
    makeup, to the current description (#2565 §2) — and that paragraph is
    written at REFINE time from the previous description plus the one edit being
    made (`currentDescription.ts`), with no entrance from a scan at all. Wiring
    one is a new road and #2565's rather than this slice's, and folding it in
    here is exactly the *half-built feature shipping under another card's name*
    his ruling of 2026-09-24 forbids. **What this slice does instead is stop
    throwing the words away**: they ride on {@link PanelScan.namedNotCut} and
    are KEPT with the reading, so the consumer #2565 builds will have them for
    every frame already read, with no re-scan and no second reading bought.
  */
  const outfitRow = (): PanelRow | null => (rowsOf.get("outfit") ?? [])[0] ?? null;
  for (const said of input.scan?.namedNotCut ?? []) {
    /* His ruling: makeup is a refine subject, not a feature of the cast. */
    if (said.why === "makeup") continue;
    /*
      A thing the detector WAS asked about and could not find has no host
      question to answer: what is missing is its own row, not a line on
      somebody else's, and writing its words onto the host would describe the
      host with a sentence about something that is not drawn. It travels on the
      channel and nowhere else, and the next edit to that area asks again.

      ⚠ **AND A NAME WHOSE CALL DROPPED IS TREATED IDENTICALLY (#2805), WHICH
      IS THE WHOLE OF WHAT THAT CARD CHANGES ON THIS SURFACE.** The two are
      told apart in the kept reading because `uncut` asserts an ask that a
      dropped call never made — but the panel's question is *can any row carry
      these words*, and the answer is no either way. So nothing a customer sees
      moves, and no retry hangs off the new word: the second ask this card asks
      for is refused on measurement and stays refused.
    */
    if (said.why === "uncut" || said.why === "dropped") continue;
    const about = said.about.trim();
    if (about === "" || said.on.trim() === "") continue;
    /* The same question `homeOf` answers for a region, asked the same way: a
       scattered PIECE OF CLOTHING, and anything sitting on one, says its words
       on the Outfit row. `kind` is the thing's own, which is why a scattered
       garment reaches the outfit with no special case here. */
    /* A worn thing's words follow its ROW's placement, so a scattered piercing
       does not describe itself on the Ears row his ruling emptied of worn
       things (#2789). A mark's words still describe the skin of the part they
       sit on, which is the body — freckles across the nose. */
    const home = said.kind === "accessory"
      ? placedHomeOf({ noun: said.noun, kind: said.kind, on: said.on })
      : homeOf({ noun: said.noun, kind: said.kind, on: said.on });
    if (home.home === "outfit") {
      const row = outfitRow();
      if (row !== null) wordsOnto(row, about);
      continue;
    }
    if (home.home === "child") { wordsOnto(home.parent, about); continue; }
    /* `underFound` and `own` alike: nothing on this panel can carry it, so it
       stays on the channel for the current description and the panel is silent
       about it.

       ⚠ **On the discovery road this is where freckles on skin land now
       (#2752)** — there is no Skin row to say them on, by his word, so the host
       does not resolve and they stay on `namedNotCut`, which the scan KEEPS.
       That is not a loss against yesterday: the Skin row's words line was
       display, and no edit ever read it. */
  }

  return {
    possessive: input.pronouns.possessive,
    groups: PANEL_GROUPS
      .map((section) => ({
        ...section,
        rows: (rowsOf.get(section.group) ?? []).filter(keep).map(stateOfRow),
      }))
      .filter((section) => section.rows.length > 0),
    pendingUnnamed: input.scanning === true && input.discovering === true,
  };
}

/** The key a pair's row edits when it is spoken as one — both instances. */
export function pairSlots(feature: string): FeatureSlot[] {
  return [slotKey(feature, "left"), slotKey(feature, "right")];
}

/**
 * THE STENCIL IS FETCHED UNDER CORS AND THE CROP IS NOT, so they cannot come
 * from the same place.
 *
 * A CSS `mask-image` is a CORS-mode fetch; a `background-image` is not. The R2
 * public bucket sends no `Access-Control-Allow-Origin` — by default, in both
 * worlds — so a mask served straight off the bucket is BLOCKED, and an element
 * whose mask failed to load renders nothing at all. Not a degraded thumbnail:
 * an empty box, silently, with every stylesheet assertion still true.
 *
 * Found by looking at the running app (D-101) after twelve green tests and a
 * browser check that read the computed style and passed on a blank panel.
 *
 * The proxy is the product's own established answer to this exact sentence —
 * `client/src/features/boards/canvas/imageActions.ts` has said "R2 bucket URLs
 * are cross-origin and CORS-less" since boards was written. It is
 * authenticated, rate-limited, SSRF-allowlisted and privately cached, and a
 * mask is a few hundred bytes.
 *
 * Built on the SERVER rather than in the client because the reason is a
 * property of the bytes, not of the surface: any future reader of a stencil
 * inherits the same constraint, and a rule that lives in one component is a
 * rule the second component gets wrong.
 *
 * ⚠ **It lived in `segmentsOnFace.ts` until #1160 slice 2 retired that module**
 * and it is the one thing in it that was never about the segment store: its
 * only caller is the FACE PANEL's own stencil wire, which is why it moved here
 * rather than dying with its neighbours. The `maskUrl` field above is the
 * contract it satisfies.
 */
export function maskFetchUrl(publicUrl: string): string {
  return `/api/image-proxy?url=${encodeURIComponent(publicUrl)}`;
}
