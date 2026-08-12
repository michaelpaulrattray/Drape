/**
 * WHAT THIS BRANCH'S FACE CURRENTLY IS — the reference library's fold.
 *
 * The database layer walks a branch's ancestry and hands back every row it
 * finds, in order (`db/castingV2ReferenceLibrary.ts`). This is where those rows
 * become the answer: which of them are LIVE, and what the recipe assembler
 * receives as its library.
 *
 * It is a pure function of rows on purpose. The rules below are the ones a
 * fork-edit gets wrong — this codebase has already shipped a fork from B
 * carrying D's glasses (fable-091) — and a rule that needs a database to
 * exercise is a rule that gets exercised once.
 *
 * # The two rules
 *
 * 1. **Newest version per (slot, role) wins.** A slot's history is its
 *    versions; the branch's answer is its latest one.
 * 2. **A retired NEWEST means gone from this branch. A retired older one means
 *    nothing.** She takes the earring off on this branch: the branch's own row
 *    is retired, and if the fold simply skipped retired rows it would find the
 *    ANCESTOR's older earring and put it straight back on — the undo visibly
 *    not working, with an older pair coming back. A fork taken before the
 *    removal still finds its own newest live and keeps it.
 * 3. **A `disputedDelivery` row is evidence, not a version** (fable-220 §3). It
 *    holds pixels a human must look at to settle whether the reader or the
 *    painter was wrong, and until somebody does, this render has said nothing
 *    about what the feature IS. Counting it would make it the newest carry row —
 *    a row with no `storageKey` — and the crop that had been riding into every
 *    prompt would silently stop. A disputed ask must not change what the painter
 *    sees on the next paid render.
 *
 * # Where a slot's STATE comes from
 *
 * `tier`, `noun` and `words` are on every row, whatever its role, so the state
 * is read from **the newest live row of either role**. Rows written by one
 * render for one slot carry the same state by construction (they are one
 * render's account of one feature), so the two roles cannot disagree except
 * across renders — where the newer one is simply right.
 */
import { REFUSAL_THAT_IS_EVIDENCE_ONLY } from "./referenceCompleteness";
import type {
  FeatureSlot,
  FeatureTier,
  LibraryEntry,
  ReferenceImage,
} from "./recipeAssembler";

/** Which IMAGE a row's key holds — the frozen introduction, or the minted crop. */
export type ReferenceRole = "anchor" | "carry";

export type ReferenceGeometry = {
  bbox: { x: number; y: number; width: number; height: number };
  frame: { width: number; height: number };
};

/** What the completeness guard read when a crop was minted (§2.4), in basis
 *  points. Evidence for trends; under D-246 it gates nothing after the fact. */
export type ReferenceGuardReading = {
  kind: string;
  coverage: number;
  spill: number;
  threshold: number;
};

/**
 * THE CROP THE GUARD TURNED AWAY, and why (migration 0029).
 *
 * On a row that has one, this is the whole of what the refusal left behind: the
 * reason, the specimen family it was judged against, the number it read if a
 * reading happened, and — for the refusals a human settles, whichever those are
 * today (`REFUSALS_THAT_KEEP_THEIR_CROP`) — the pixels themselves.
 *
 * It is deliberately a group of its own rather than fields beside
 * {@link StoredReference.storageKey}: those keys are what make a crop ride into
 * the next render's prompt, and this picture is by definition uncertified.
 * `deriveLibrary` below builds its entries from `storageKey` only, so a refused
 * crop cannot reach the assembler even by mistake — structural, not remembered.
 */
export type ReferenceRefusal = {
  reason: string;
  /** The specimen family the reading belongs to — `hair`, `earring`. NOT the
   *  slot: a coverage adopted under the wrong family is the wrong-boundary
   *  class, and `earring@left` is not a family. */
  kind: string;
  /** Basis points of the region. NULL when the refusal recorded no reading. */
  coverage: number | null;
  /** The refused crop and its mask. Present for the refusals a human settles,
   *  which are `REFUSALS_THAT_KEEP_THEIR_CROP` and nothing this comment
   *  restates — the set was two when the column group landed and is four now,
   *  and a comment that counts them is a copy that drifts. Null for the rest. */
  contentKey: string | null;
  maskKey: string | null;
  /** Where that crop sat on the frame it was cut from. Present exactly when the
   *  keys are: the stored mask is crop-local, so without this the pixels can be
   *  looked at and never placed back on her face. */
  geometry: ReferenceGeometry | null;
};

/** One library row, as stored. The shape the fold reasons about. */
export type StoredReference = {
  id: number;
  publicId: string;
  candidateId: number;
  /** NULL — minted from the candidate's master, so it belongs to every branch. */
  variantId: number | null;
  role: ReferenceRole;
  slot: FeatureSlot;
  tier: FeatureTier;
  noun: string;
  words: readonly string[];
  storageKey: string | null;
  maskKey: string | null;
  digest: string | null;
  geometry: ReferenceGeometry | null;
  guard: ReferenceGuardReading | null;
  /** What was turned away at the door, on a row that carries no crop because of
   *  it. NULL on every delivered row and on every words-only row that was never
   *  guarded at all (a surface, or a slot with no question). */
  refusal: ReferenceRefusal | null;
  version: number;
  retiredAt: Date | null;
  createdAt: Date;
};

/**
 * The live rows of a lineage walk — rules 1, 2 and 3, and nothing else.
 *
 * Input order is preserved: the walk returns oldest first, and that order is
 * the user's own edit order, which is the order the panel and the assembler
 * both want.
 */
export function liveReferences(rows: readonly StoredReference[]): StoredReference[] {
  const newest = new Map<string, StoredReference>();
  for (const row of rows) {
    /* Rule 3, before the version comparison rather than after it: a disputed row
       must not even be a candidate for newest, or it would displace the crop it
       has no verdict about. */
    if (row.refusal?.reason === REFUSAL_THAT_IS_EVIDENCE_ONLY) continue;
    const key = `${row.slot} ${row.role}`;
    const held = newest.get(key);
    if (!held || row.version > held.version) newest.set(key, row);
  }
  return Array.from(newest.values()).filter((row) => row.retiredAt === null);
}

function imageOf(row: StoredReference): ReferenceImage | undefined {
  if (row.storageKey === null) return undefined;
  return row.digest === null
    ? { key: row.storageKey }
    : { key: row.storageKey, sha: row.digest };
}

/**
 * The library the recipe assembler is handed, for one branch.
 *
 * Slots come out in the order they were first written, which is the order the
 * face acquired them — the assembler emits references in library order, so this
 * is what decides "reference 3 is her hair".
 *
 * A slot whose newest live row carries no image at all still produces an entry:
 * a SURFACE has words and never a crop, and an anatomy slot can hold words
 * before anything has delivered it. Those are the entries the assembler turns
 * into standing sentences, and dropping them here would silently lose
 * everything ever said about her tan.
 */
/**
 * The library a RENDER may see: the derived library with the edited slots'
 * minted crops removed.
 *
 * D-244 line 2 — a feature's own crop never rides in its own edit. The recipe
 * assembler refuses such a recipe outright (`carriesItsOwnEdit`) rather than
 * dropping the crop for the caller, on the stated grounds that a caller
 * building one is a defect. Nothing was stopping the caller: `refineService`
 * passed `deriveLibrary`'s output through whole, and every live production row
 * is a carry row, so the SECOND edit of any slot refused and refunded — the
 * founder's own *"wear her hair down"*, on both his faces (opus-238).
 *
 * ONLY the crop goes. The WORDS stay, because an edit regenerates from its
 * anchor plus the feature's FULL word stack and the stack lives here; the
 * ANCHOR stays, because an introduced item regenerates FROM its frozen
 * introduction reference (D-244 line 3) — that is the reference the edit needs
 * most, and dropping it would repaint a tattoo from the master that never had
 * one. Dropping the entry entirely would lose both.
 *
 * The assembler's refusal stays where it is, as the backstop that says so if
 * this is ever removed.
 */
export function libraryWithoutEditedCrops(
  library: readonly LibraryEntry[],
  editedSlots: ReadonlySet<FeatureSlot>,
): LibraryEntry[] {
  return library.map((entry) => {
    if (!editedSlots.has(entry.slot) || entry.carry === undefined) return entry;
    const { carry: _dropped, ...kept } = entry;
    return kept;
  });
}

export function deriveLibrary(rows: readonly StoredReference[]): LibraryEntry[] {
  const live = liveReferences(rows);
  const order: FeatureSlot[] = [];
  const bySlot = new Map<FeatureSlot, {
    state: StoredReference;
    anchor?: StoredReference;
    carry?: StoredReference;
  }>();

  for (const row of live) {
    const held = bySlot.get(row.slot);
    if (!held) {
      order.push(row.slot);
      bySlot.set(row.slot, { state: row, [row.role]: row });
      continue;
    }
    held[row.role] = row;
    /* The newer render's account of the feature is the current one. Ties (one
       render writing both roles) resolve to the same state either way. */
    if (row.version > held.state.version
      || row.createdAt.getTime() > held.state.createdAt.getTime()) {
      held.state = row;
    }
  }

  return order.map((slot) => {
    const held = bySlot.get(slot)!;
    const anchor = held.anchor ? imageOf(held.anchor) : undefined;
    const carry = held.carry ? imageOf(held.carry) : undefined;
    const entry: LibraryEntry = {
      slot,
      tier: held.state.tier,
      words: held.state.words,
      noun: held.state.noun,
    };
    if (anchor) entry.anchor = anchor;
    if (carry) entry.carry = carry;
    return entry;
  });
}
