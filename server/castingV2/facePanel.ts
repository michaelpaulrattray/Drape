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
import type { FeatureSlot } from "./recipeAssembler";
import { liveReferences, type StoredReference } from "./referenceLibrary";
import {
  catalogueSlots,
  slotDefinition,
  type SlotDefinition,
  type SlotGroup,
} from "./referenceSlotCatalogue";
import { wardrobePanelPieces } from "./wardrobeCards";
import type { WardrobeResolution } from "./wardrobeLine";
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
 * `wardrobe` is the second of those and it is the furthest from the catalogue
 * of any of them: **it is not part of the person at all** (§8.1, from
 * fable-1312 — *never mixed with body features*). Its rows come from the stored
 * wardrobe LINE rather than from any slot, they mint nothing, and they exist
 * only on a cast born on the Wardrobe path.
 */
export type PanelSection = SlotGroup | "open" | "wardrobe";

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
  { group: "accessories", heading: "Accessories" },
  { group: "open", heading: "Also on this cast" },
  /*
    ⚠ LAST, AND NOT BECAUSE IT MATTERS LEAST — because it is not the person.

    Every section above is something this cast IS; this one is something she is
    WEARING, and fable-1312's condition is that garment pieces are never mixed
    in with body features. Reading order is the cheapest way to say that, and
    the heading says the rest: a customer scanning a face chart should reach the
    end of the person before the clothes begin.

    The heading is the plain noun and not "Her wardrobe": a section heading is a
    LABEL, and the possessive lives on the row and the prefill (fable-450/451).
  */
  { group: "wardrobe", heading: "Wardrobe" },
];

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
  /**
   * WHAT THIS BRANCH IS WEARING — the resolution, never a bare line (§8.1).
   *
   * Absent is the ordinary case and draws no wardrobe section at all: it is
   * every roll cast before the paths existed and every account outside
   * `CASTING_TWO_PATHS_SCOPE`, and for those the panel is exactly what it was.
   *
   * ⚠ **The RESOLUTION and not the line**, for `classifyInkPlacement`'s reason
   * one surface over: `unpathed`, `incoherent` and a real line do not flatten,
   * and a bare string cannot say which of the three this is. Only a `line` on
   * the Wardrobe path draws anything, and that argument lives at
   * `wardrobePanelPieces` rather than here.
   */
  wardrobe?: WardrobeResolution | null;
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
  const stateOf = (slot: FeatureSlot): SlotState => fresher(slot, stateOfRaw(slot));
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
  const push = (row: PanelRow) => {
    const held = rowsOf.get(row.group);
    if (held) held.push(row);
    else rowsOf.set(row.group, [row]);
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
          }]
          : [],
        /* There is only one of it, so there is nothing to open. */
        instances: [],
      });
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
        })),
        /*
          THE TWO CHILDREN (founder, fable-452) — always both, whether or not
          they agree, because the pair is the row and these are its sides.
          Everything here already exists per instance, so opening a pair fetches
          nothing and closing one stores nothing.

          Left then right, from the catalogue: a list is read in the words it is
          written in, while the tile above is ordered by where the eye finds
          each picture.
        */
        instances: [
          { definition: left, state: leftState },
          { definition: right, state: rightState },
        ].map(({ definition: side, state }) => ({
          slot: side.slot,
          name: labelOf(side, false),
          spoken: spokenOf(side, input.pronouns.possessive, false),
          prefill: prefillFor(spokenOf(side, input.pronouns.possessive, false)),
          words: wordsFor(side.feature, state.words),
          cutout: state.thumb,
          box: state.box,
        })),
      });
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
    ⚠ AND A WARDROBE ROW IS CONTENT BY CONSTRUCTION (§8.1).

    The rule this predicate encodes is *no box, no row* — a row is a promise
    that clicking those pixels edits that thing, so a row with no measured
    rectangle is not drawn. **A wardrobe row makes no such promise.** It has no
    rectangle, claims none, and its content is its own phrase, read off a line
    this cast is stored as wearing rather than off any reading of the frame.

    Left to the rule above it would be dropped for lacking a geometry it was
    never going to have — and then `stateOfRow` would call it `pending`, which
    is a placeholder for a read that is not running: fable-521's own warning
    about a working state that outlives its work.

    ⚠ **When 8B gives a piece a crop, this clause does NOT become dead.** A
    garment the scan cannot find still has a phrase, and the phrase is still
    worth drawing — losing the row would be the panel forgetting what she is
    wearing because it could not photograph it.
  */
  const hasContent = (row: PanelRow): boolean => row.group === "wardrobe"
    || row.regions.length > 0 || row.absent !== null;

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
  const keep = (row: PanelRow): boolean => hasContent(row)
    || (input.scanning === true && row.group !== "open");
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
    ---- WHAT SHE IS WEARING (design §8.1, from fable-1312; the split rule and
    the path condition ruled fable-1459 ASK 1 and ASK 3) ----

    ⚠ **THE THIRD SOURCE THE CATALOGUE DOES NOT ENUMERATE, and the only one
    that is not part of the person.** The ink rows above are a fact about her
    skin; these are a fact about a stored SENTENCE — one line, decomposed on the
    separator its own composer joins with, and nothing else. There is no rule
    here about what counts as a garment, because inventing one is a taxonomy and
    the cases this path exists for defeat it (*"bare legs"*, *"surgical scrubs
    and plain white clogs"*, a dress).

    # It is DISPLAY, and the wire is where that is proven

    No piece is stored, sent or judged. The LINE is the one owner: the roll
    prompt, the refine recipe, the six signed views, the wardrobe judge and the
    sheet all read it whole, and an edit to a card rewrites the whole line
    (§7.1's rewrite rule, which is why the wardrobe subject is `plural: false`).
    `wardrobeCardsAreDisplayOnly.test.ts` asserts that on the strings a render
    is actually handed rather than on a comment.

    # ⚠ NOTHING IS DRAWN ON `basics` OR ON `unpathed`

    Decided by `wardrobePanelPieces`, off the subject card's own
    `bornPathsServing` — and the three values are argued at that function
    because two of them agree with the prompt question while one disagrees with
    the refusal question. Every roll in both worlds is `unpathed` today, so this
    section is dark by construction rather than by a flag read here.

    # The row's identity is its POSITION, and that is deliberate

    `wardrobe:0` names no library slot, no facet and no region. It exists so a
    list of rows has stable keys and so hovering one lights one — and it is
    spelled from the INDEX rather than from her phrase, because a key spelled
    out of a customer's words would look exactly like a key that meant
    something. Nothing sends it as a scope: a row click carries no scope (only a
    rectangle or a paired child does), and there is no rectangle here.
  */
  for (const piece of wardrobePanelPieces(input.wardrobe)) {
    /*
      HER WORDS, WITH THE LIST'S OWN GRAMMAR TAKEN OFF THE FRONT.

      The line enumerates — *"a rough hide wrap …, a plain hide loincloth, bare
      feet"* — so the indefinite article belongs to the ENUMERATION and not to
      the piece. Removing it is de-listing rather than re-wording, and it cannot
      mis-classify anything the way a garment rule could: it looks at the first
      word and at nothing else.

      No possessive, and that is fable-1312's *never mixed with body features*
      reaching the grammar. Every other row on this panel says *her* something,
      because every other row IS her. This is what she has on.
    */
    const phrase = piece.phrase.replace(/^(?:an?)\s+/i, "");
    const label = capitalize(phrase);
    push({
      state: "settled",
      slots: [`wardrobe:${piece.index}` as FeatureSlot],
      group: "wardrobe",
      name: label,
      spoken: phrase,
      /*
        NO WORDS, for the ink row's reason exactly. Every other row's words are
        a DESCRIPTION something wrote for it; here the phrase IS the row, and
        repeating it underneath the label would be the row's own name pretending
        to be a second reading.
      */
      words: [],
      /* A stated absence is authored per catalogued slot beside the argument
         that an empty read there cannot mean "hidden". Nobody has catalogued a
         garment, and nothing has read this frame for one. */
      absent: null,
      from: null,
      /* The same shape as every other row — "Her eyes — " — so a wardrobe ask
         opens the way every other ask on this panel opens. */
      prefill: prefillFor(label),
      /* ⚠ 8B is the crop, and it is not built: nothing has read this frame for
         a garment, and drawing a picture here from anything else would be a
         rectangle placed by proportion under a different name. */
      cutouts: [],
      regions: [],
      instances: [],
    });
  }

  return {
    possessive: input.pronouns.possessive,
    groups: PANEL_GROUPS
      .map((section) => ({
        ...section,
        rows: (rowsOf.get(section.group) ?? []).filter(keep).map(stateOfRow),
      }))
      .filter((section) => section.rows.length > 0),
  };
}

/** The key a pair's row edits when it is spoken as one — both instances. */
export function pairSlots(feature: string): FeatureSlot[] {
  return [slotKey(feature, "left"), slotKey(feature, "right")];
}
