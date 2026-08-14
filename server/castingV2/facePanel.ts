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
  type SlotDefinition,
  type SlotGroup,
} from "./referenceSlotCatalogue";
import { pairHasDiverged, slotKey } from "./referenceSlots";

/** The panel's sections, in the order they are read on a face. */
export const PANEL_GROUPS: readonly { group: SlotGroup; heading: string }[] = [
  { group: "face", heading: "Face" },
  { group: "hair", heading: "Hair" },
  { group: "body", heading: "Body" },
  { group: "accessories", heading: "Accessories" },
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
};

/**
 * ONE PICTURE OF ONE INSTANCE.
 *
 * A MINTED crop is its own picture and `crop` is null: the content URL is the
 * cutout, the way the library has always served it. A SCAN-BORN one is the whole
 * frame with a window on it, so `crop` says which window — the browser cuts the
 * picture it already has, and no object was written to show it.
 */
export type PanelCutout = { contentUrl: string; maskUrl: string; crop: PanelBox | null };

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
  group: SlotGroup;
  /** How the row reads: "Her lips", "Her earrings", "Her left earring". */
  name: string;
  /** Everything ever accepted about it, oldest first. Empty until something is. */
  words: readonly string[];
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
  groups: readonly { group: SlotGroup; heading: string; rows: readonly PanelRow[] }[];
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
  const stateOf = (slot: FeatureSlot): SlotState => {
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
  const rowsOf = new Map<SlotGroup, PanelRow[]>();
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
      push({
        state: "settled",
        slots: [definition.slot],
        group: definition.group,
        name: labelOf(definition, false),
        spoken: spokenName,
        words: wordsFor(definition.feature, state.words),
        from: state.from,
        prefill: prefillFor(spokenName),
        cutouts: state.thumb ? [state.thumb] : [],
        /* The row is one thing and the rectangle covers it, so it needs no name
           of its own — the row's is the label. */
        regions: state.box ? [{ box: state.box, name: null, spoken: null, prefill: null, slot: definition.slot }] : [],
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
   * **TWO rows are in that state, not one** (shift 79 — this sentence named
   * `teeth` alone and was read as the complete list, which is what an
   * enumeration in a comment always becomes):
   *
   *   teeth      no region, and no ask can produce one — the honest case
   *   EARRINGS   the expensive one. Earring DETECTION is deliberately unarmed
   *              (`bornWornDetector`'s `deferArming`, fable-340: a site may be
   *              called bare only when it is VISIBLY bare, and the court that
   *              proves that has not been run). So the scan never asks where
   *              they are, they never get a rectangle, and this filter takes
   *              the row off the panel — on a face WEARING them, with the
   *              customer's own edit words on file for both sides. Driven on
   *              the dev fixture, which wears gold hoops and has no earrings
   *              row (opus-336 §3). Arming the earring court closes it; nothing
   *              here should be loosened to paper over it.
   *
   * A group whose rows all fell away disappears with them, which the filter
   * below already did for the group with no rows at all.
   */
  const hasContent = (row: PanelRow): boolean => row.regions.length > 0;

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
  const keep = (row: PanelRow): boolean => hasContent(row) || (input.scanning === true);
  const stateOfRow = (row: PanelRow): PanelRow => (
    hasContent(row) ? row : { ...row, state: "pending" }
  );

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
