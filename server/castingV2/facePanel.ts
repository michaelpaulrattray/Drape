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

    if (!diverged) {
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
        slots: [left.slot, right.slot],
        group: left.group,
        name: labelOf(left, true),
        spoken: spokenName,
        words: wordsFor(left.feature, leftState.words),
        from: leftState.from,
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
      });
      continue;
    }

    for (const side of [left, right]) {
      const state_ = stateOf(side.slot);
      const spokenName = spokenOf(side, input.pronouns.possessive, false);
      push({
        slots: [side.slot],
        group: side.group,
        name: labelOf(side, false),
        spoken: spokenName,
        /* A diverged host is two rows, and a folded slot's words are read on
           BOTH of them: they are about both sides and nothing in the stack says
           which side a lash sentence was about. Said twice beats vanishing. */
        words: wordsFor(side.feature, state_.words),
        from: state_.from,
        prefill: prefillFor(spokenName),
        cutouts: state_.thumb ? [state_.thumb] : [],
        /* A diverged pair is already two rows, each about one instance, so the
           rectangle covers exactly what its row names. */
        regions: state_.box ? [{ box: state_.box, name: null, spoken: null, prefill: null, slot: side.slot }] : [],
      });
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

  return {
    possessive: input.pronouns.possessive,
    groups: PANEL_GROUPS
      .map((section) => ({ ...section, rows: (rowsOf.get(section.group) ?? []).filter(hasContent) }))
      .filter((section) => section.rows.length > 0),
  };
}

/** The key a pair's row edits when it is spoken as one — both instances. */
export function pairSlots(feature: string): FeatureSlot[] {
  return [slotKey(feature, "left"), slotKey(feature, "right")];
}
