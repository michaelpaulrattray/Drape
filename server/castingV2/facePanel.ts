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
 * Every anatomy row gets its box the day the region read is cached at scan time
 * (roadmap §5 / the mock's own note). Until then the rows are tappable — which
 * is what scopes the ask — and the image is clickable only where it has been
 * measured.
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
  /** The cutout, when this slot has a minted crop. Null is the common case. */
  thumb: { contentUrl: string; maskUrl: string } | null;
  /** Where it is on the picture — null when this face has never been read there. */
  box: PanelBox | null;
};

export type FacePanel = {
  possessive: string;
  groups: readonly { group: SlotGroup; heading: string; rows: readonly PanelRow[] }[];
};

type SlotState = {
  words: readonly string[];
  from: string | null;
  thumb: { contentUrl: string; maskUrl: string } | null;
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
    ? { contentUrl: urls.contentUrl(carry.storageKey), maskUrl: urls.maskUrl(carry.maskKey) }
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
}): FacePanel {
  const live = liveReferences(input.rows);
  const bySlot = new Map<FeatureSlot, StoredReference[]>();
  for (const row of live) {
    const held = bySlot.get(row.slot);
    if (held) held.push(row);
    else bySlot.set(row.slot, [row]);
  }

  const stateOf = (slot: FeatureSlot): SlotState => stateOfSlot(
    bySlot.get(slot) ?? [],
    { contentUrl: input.contentUrl, maskUrl: input.maskUrl },
    input.pronouns,
  );

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
        box: leftState.box,
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
