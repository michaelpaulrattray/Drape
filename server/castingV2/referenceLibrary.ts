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
 *
 * # Where a slot's STATE comes from
 *
 * `tier`, `noun` and `words` are on every row, whatever its role, so the state
 * is read from **the newest live row of either role**. Rows written by one
 * render for one slot carry the same state by construction (they are one
 * render's account of one feature), so the two roles cannot disagree except
 * across renders — where the newer one is simply right.
 */
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
  digest: string | null;
  geometry: ReferenceGeometry | null;
  guard: ReferenceGuardReading | null;
  version: number;
  retiredAt: Date | null;
  createdAt: Date;
};

/**
 * The live rows of a lineage walk — rule 1 and rule 2, and nothing else.
 *
 * Input order is preserved: the walk returns oldest first, and that order is
 * the user's own edit order, which is the order the panel and the assembler
 * both want.
 */
export function liveReferences(rows: readonly StoredReference[]): StoredReference[] {
  const newest = new Map<string, StoredReference>();
  for (const row of rows) {
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
