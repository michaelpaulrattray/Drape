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
};

export type PanelRow = {
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
   * The cutout, from one of two places.
   *
   * A MINTED crop is its own picture and `crop` is null: the content URL is the
   * cutout, the way the library has always served it. A SCAN-BORN one is the
   * whole frame with a window on it, so `crop` says which window — the browser
   * cuts the picture it already has, and no object was written to show it.
   */
  thumb: { contentUrl: string; maskUrl: string; crop: PanelBox | null } | null;
  /** Where it is on the picture — null when this face has never been read there. */
  box: PanelBox | null;
  /**
   * WHAT THE RECTANGLE ITSELF COVERS, when that is narrower than the row.
   *
   * Null on almost every row, and null is not an omission — it means the box
   * covers what the row says it does, so the row's own name is the label.
   *
   * It is not null when a matched pair has geometry for ONE instance. The row
   * still speaks the person's ontology — *"Her eyes"*, one row, an edit to it
   * means both — but the rectangle on the photograph is a fact about pixels,
   * and those pixels are one eye. Labelling them "Her eyes" would promise that
   * clicking there edits the pair *there*, which is the wrong-boundary class
   * with a rectangle on it (fable-378 ruling (c)).
   */
  boxName: string | null;
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

function nameOf(definition: SlotDefinition, possessive: string, paired: boolean): string {
  const noun = paired ? definition.pairNoun ?? definition.noun : definition.noun;
  /*
    THE POSSESSIVE, FOR A WORN THING TOO. The recipe assembler gives a worn item
    an article — "the left earring" — because it is talking to a painter about an
    object. The panel is talking to the person whose face it is, and the founder's
    own mock says "Her glasses". Same distinction the product already draws, read
    the other way round.
  */
  return `${capitalize(possessive)} ${noun}`;
}

/** The opening of their sentence: lowercased, because it is theirs. */
function prefillFor(name: string): string {
  return `${name.charAt(0).toLowerCase()}${name.slice(1)} — `;
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
    const found = scan?.slots.get(slot);
    if (!scan || !found) return held;
    return {
      ...held,
      thumb: held.thumb ?? { contentUrl: scan.frameUrl, maskUrl: found.maskUrl, crop: found.box },
      box: held.box ?? found.box,
    };
  };

  const definitions = catalogueSlots();
  const spoken = new Set<FeatureSlot>();
  const rowsOf = new Map<SlotGroup, PanelRow[]>();
  const push = (row: PanelRow) => {
    const held = rowsOf.get(row.group);
    if (held) held.push(row);
    else rowsOf.set(row.group, [row]);
  };

  for (const definition of definitions) {
    if (spoken.has(definition.slot)) continue;
    const state = stateOf(definition.slot);

    if (definition.instance === null) {
      spoken.add(definition.slot);
      const name = nameOf(definition, input.pronouns.possessive, false);
      push({
        slots: [definition.slot],
        group: definition.group,
        name,
        words: state.words,
        from: state.from,
        prefill: prefillFor(name),
        thumb: state.thumb,
        box: state.box,
        /* The row is one thing and the box covers it. */
        boxName: null,
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
      const name = nameOf(left, input.pronouns.possessive, true);
      push({
        slots: [left.slot, right.slot],
        group: left.group,
        name,
        words: leftState.words,
        from: leftState.from,
        prefill: prefillFor(name),
        /*
          ONE THUMBNAIL FOR A MATCHED PAIR, and it is the left instance's own
          crop rather than a composite of two. The row says "her earrings" and
          shows one of them, which is what a matched pair looks like anyway.
          Two crops of two ears are never byte-identical (different light,
          different occlusion), so a pair is matched by its WORDS and never by
          its pixels.
        */
        thumb: leftState.thumb ?? rightState.thumb,
        /*
          AND THE BOX FALLS BACK THE SAME WAY, BUT SAYS SO (fable-378 (c)).

          A pair with geometry for one instance used to show a cutout and no
          click target at all — the thumbnail fell back and the box did not. The
          founder's own reading was the one that could not happen: an eye you can
          see in the list and cannot click on the picture.

          So the rectangle is drawn, and where it covers ONE of the two it is
          labelled as that one. The row stays "Her eyes" because that is what an
          edit to it means; the rectangle says "Her right eye" because that is
          what those pixels are. The stylist's promise above, the pixels below —
          and neither has to lie for the other.
        */
        box: leftState.box ?? rightState.box,
        boxName: leftState.box
          ? null
          : rightState.box
            ? nameOf(right, input.pronouns.possessive, false)
            : null,
      });
      continue;
    }

    for (const side of [left, right]) {
      const state_ = stateOf(side.slot);
      const name = nameOf(side, input.pronouns.possessive, false);
      push({
        slots: [side.slot],
        group: side.group,
        name,
        words: state_.words,
        from: state_.from,
        prefill: prefillFor(name),
        thumb: state_.thumb,
        box: state_.box,
        /* A diverged pair is already two rows, each about one instance, so the
           rectangle covers exactly what its row names. */
        boxName: null,
      });
    }
  }

  return {
    possessive: input.pronouns.possessive,
    groups: PANEL_GROUPS
      .map((section) => ({ ...section, rows: rowsOf.get(section.group) ?? [] }))
      .filter((section) => section.rows.length > 0),
  };
}

/** The key a pair's row edits when it is spoken as one — both instances. */
export function pairSlots(feature: string): FeatureSlot[] {
  return [slotKey(feature, "left"), slotKey(feature, "right")];
}
