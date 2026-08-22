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
/* The panel's own divergence instrument, borrowed rather than re-stated: one
   definition of "this pair is two things now", read by the row that draws it
   and by the question that must not claim both (working law 4). */
import { pairHasDiverged } from "./referenceSlots";
import type {
  FeatureSlot,
  FeatureTier,
  LibraryEntry,
  ReferenceImage,
} from "./recipeAssembler";

/**
 * Which IMAGE a row's key holds — the frozen introduction, or the minted crop.
 *
 * And `vacancy`, which holds none, because the slot is EMPTY: she took the thing
 * off. It is a role rather than a flag on a carry for the reason the migration
 * states — every reader on the recipe path either asks for `carry` or merges by
 * role, so a vacancy is invisible to all of them until something is taught to
 * read it, and the row that would otherwise be picked up carries a picture of
 * the very thing she removed.
 */
export type ReferenceRole = "anchor" | "carry" | "vacancy";

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

/**
 * SLOTS WHOSE NEWEST WORD ON THE SUBJECT HAS NO PIXELS (fable-318 R2).
 *
 * Rule 3 above skips a disputed row so it cannot displace the crop it has no
 * verdict about, and that is right — but it leaves the caller believing the
 * older crop is the branch's current answer, and it is not. Shift 61's walk is
 * the specimen: step 2 delivered cross earrings, the door refused both v2 crops
 * as disputed, and step 3 — an unrelated ask about her hair — carried v1's plain
 * hoops with every digest agreeing. The frame came back without the crosses the
 * branch had been told she was wearing, the reader said so, and the innocent
 * step took the refusal. The face could not be edited again.
 *
 * So the same rule is read for its other consequence: these are the slots whose
 * carry the branch has moved past. The caller must not send their crop, and
 * must say the feature in WORDS instead — see `RepaintAsksInput.restore`.
 *
 * A slot with no older crop at all is in this set too, and for the same reason:
 * an ITEM the recipe cannot picture and does not describe is a feature the next
 * render paints away.
 */
export function supersededCarrySlots(rows: readonly StoredReference[]): FeatureSlot[] {
  const newest = new Map<FeatureSlot, StoredReference>();
  for (const row of rows) {
    if (row.role !== "carry" || row.retiredAt !== null) continue;
    const held = newest.get(row.slot);
    if (!held || row.version > held.version) newest.set(row.slot, row);
  }
  return Array.from(newest.entries())
    /* The bytes are the test, not the refusal reason: a row holding no crop
       cannot be carried whatever the door's reason for it was, and a reason
       list here would be a second copy of the door's vocabulary. */
    .filter(([, row]) => row.storageKey === null)
    .map(([slot]) => slot);
}

/**
 * WHICH ONE OF A PAIR THE LAST EDIT OF IT ACTUALLY TOUCHED — the library
 * answering the question the chain cannot (fable-444 condition 1).
 *
 * Ruling C put the per-side memory HERE: the delta goes on saying *"green
 * eyes"* because that is what she typed, and these rows are what remember that
 * only one of them is green. So these rows are also the only honest answer to
 * *"may a later render still ask whether her eyes are green"* — and the answer
 * is no, because one of them is brown and a reader told to judge both will
 * honestly say the picture fails. `eye.colour` is a GUARANTEED axis, so that
 * answer is binding: it refuses and refunds a render that delivered exactly
 * what was asked, on every later edit, for as long as the chain lives. **A
 * per-eye edit would brick the chain it belongs to** — measured on the court's
 * own frames, where today's whole-face question disputes 4 of 16 correct
 * one-eye renders (`bench-scoped-verification`).
 *
 * TWO CONDITIONS, and each one alone would be wrong:
 *
 *   the rows DISAGREE          a matched pair is one thing and is asked about
 *                              as one thing. Divergence is read from the words
 *                              every time (`pairHasDiverged`), never a flag —
 *                              the same instrument the panel splits its row on,
 *                              so the picture and the question cannot disagree
 *                              about whether she has one pair of eyes or two
 *   ONE of them is newest      the version that last wrote this feature. Both
 *                              at the newest version means the last edit wrote
 *                              both, whatever their words say, and the question
 *                              is whole-face again
 *
 * Returns null for everything else, which is nearly everything: a face with no
 * library, a matched pair, a feature that is not bilateral. Narrowing is the
 * exception and it has to earn itself.
 */
export function instanceLastWritten(
  rows: readonly StoredReference[],
  slots: readonly FeatureSlot[],
): FeatureSlot | null {
  if (slots.length !== 2) return null;
  const newest = new Map<FeatureSlot, StoredReference>();
  for (const row of liveReferences(rows)) {
    if (!slots.includes(row.slot)) continue;
    const held = newest.get(row.slot);
    if (!held || row.version > held.version) newest.set(row.slot, row);
  }
  if (newest.size === 0) return null;
  const [first, second] = slots as [FeatureSlot, FeatureSlot];
  const words = (slot: FeatureSlot) => newest.get(slot)?.words ?? [];
  /* A row the library never wrote is an empty stack, and an empty stack beside
     a written one is a disagreement — that is exactly the state a scoped edit
     leaves behind on a face whose other side nobody has touched. */
  const diverged = pairHasDiverged({
    feature: "", left: { words: words(first) }, right: { words: words(second) },
  });
  if (!diverged) return null;
  const at = (slot: FeatureSlot) => newest.get(slot)?.version ?? -1;
  if (at(first) === at(second)) return null;
  return at(first) > at(second) ? first : second;
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
      bySlot.set(row.slot, { state: row, ...(row.role === "vacancy" ? {} : { [row.role]: row }) });
      continue;
    }
    /* A vacancy holds no image, so it claims neither image role — it competes
       only for `state`, below, which is where it wins or loses. */
    if (row.role !== "vacancy") held[row.role] = row;
    /* The newer render's account of the feature is the current one. Ties (one
       render writing both roles) resolve to the same state either way. */
    if (row.version > held.state.version
      || row.createdAt.getTime() > held.state.createdAt.getTime()) {
      held.state = row;
    }
  }

  return order.map((slot) => {
    const held = bySlot.get(slot)!;
    /*
      A VACATED SLOT SENDS NOTHING, WHATEVER ELSE IS STILL LIVE (fable-326/327).

      The rows do not go away when she takes her earrings off: the carry from the
      render that PUT them there is still the newest carry, and it holds a
      perfectly good picture of the thing she has just removed. Attaching it
      beside the vacancy's words would build the one recipe this whole change
      exists to prevent — *"no earrings"* in the sentence and a photograph of her
      earrings in the references, on the same render.
      Re-adding later needs no special case: the new carry is newer, so it wins
      `state`, and its crop attaches again by the ordinary rule.
    */
    const vacated = held.state.role === "vacancy";
    const anchor = vacated || !held.anchor ? undefined : imageOf(held.anchor);
    const carry = vacated || !held.carry ? undefined : imageOf(held.carry);
    const entry: LibraryEntry = {
      slot,
      tier: held.state.tier,
      words: held.state.words,
      noun: held.state.noun,
      ...(vacated ? { vacant: true as const } : {}),
    };
    if (anchor) entry.anchor = anchor;
    if (carry) entry.carry = carry;
    return entry;
  });
}

/**
 * EVERY WORD A BRANCH HOLDS PER SLOT, oldest first — the ASKING stack
 * (fable-1419 §1(a)).
 *
 * The library keeps one row per (slot, role) version and each carries the stack
 * as it stood then, so a slot's declarations across a lineage are the union of
 * its live rows read in version order. This is what an open kind's segmenter
 * question is keyed on: her first sentence describes the thing, and a later
 * refinement — *"make it brighter"* — amends it and does not describe it.
 *
 * ⚠ **It is for the QUESTION and never for a ROW.** `SlotSpec.words` is this
 * render's own precisely so a filed row cannot re-assert a feature the render
 * just changed, and nothing here weakens that: this string is handed to a
 * segmenter to find pixels with, and is never written anywhere.
 *
 * Lives here, beside `liveReferences`, because it is the same fold over the same
 * rows — a caller composing it from a second walk is the parallel copy working
 * law 4 is about.
 */
export function priorWordsBySlot(
  rows: readonly StoredReference[],
): Map<FeatureSlot, readonly string[]> {
  const byslot = new Map<FeatureSlot, { version: number; words: readonly string[] }[]>();
  for (const row of rows) {
    /* ⚠ ARRAY-CHECKED, and this is not belt-and-braces: these rows crossed a
       database boundary, this fold runs on the PAID refine path, and a throw
       here would take the whole mint down with it — losing every crop the
       render earned to a malformed `words` column. Caught by the suite before
       it shipped, on a fixture that carried no words at all. */
    if (!Array.isArray(row.words) || row.words.length === 0) continue;
    const held = byslot.get(row.slot) ?? [];
    held.push({ version: row.version, words: row.words });
    byslot.set(row.slot, held);
  }
  const said = new Map<FeatureSlot, readonly string[]>();
  for (const [slot, versions] of Array.from(byslot.entries())) {
    const ordered = [...versions].sort((a, b) => a.version - b.version);
    const words: string[] = [];
    for (const one of ordered) {
      for (const word of one.words) {
        const trimmed = word.trim();
        if (trimmed === "" || words.includes(trimmed)) continue;
        words.push(trimmed);
      }
    }
    if (words.length > 0) said.set(slot, words);
  }
  return said;
}
