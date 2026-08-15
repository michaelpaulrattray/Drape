/**
 * ONE CHIP PER EDIT, NEWEST WINS — the rail's live takes, derived.
 * (Founder ruling 2026-08-15, design note `V4_REGENERATE_IN_PLACE_DESIGN.md`,
 * ratified in fable-573.)
 *
 * > *"Just allow a refresh or regeneration of the same edit which essentially
 * > produces no extra version and just regenerates the same thumbnail."*
 *
 * and, on the trade:
 *
 * > *"If you don't like how the generation landed you can regenerate it without
 * > causing extra clutter."*
 *
 * # Why this is a derivation and not a column
 *
 * Rows are immutable and the live view is derived — the library's own rule, and
 * the reason a fork survives its parent. So a regeneration mints an ORDINARY
 * row, and the rail groups: two rows that describe the same chain are two TAKES
 * of one version, and the newest is the one on screen. The older take becomes
 * **invisible, not absent** — nothing is deleted or rewritten, so a fork made
 * from it still resolves its own chain (fable-091's class stays shut).
 *
 * A supersession column would have been a second answer to a question the rows
 * already answer, and the copies drift (law 4).
 *
 * # What "the same chain" means, and what it must not mean
 *
 * Not string equality on what they typed. *"give her gold hoop earrings"* and
 * *"gold hoop earrings please"* are one edit; *"give her silver hoops"* is not,
 * and no amount of shared text decides that. So the comparison is on the parsed
 * DELTAS — the thing a render is actually made from.
 *
 * **And NOT through `namesSameThing`, which the design note proposed and this
 * module's own test refuted.** That predicate answers the DEPARTURE lane's
 * question — "does this ask name the thing that left" — through the accessory
 * KIND table, so "gold hoop earrings" and "silver hoop earrings" are the same
 * thing to it: both are earrings. True for a departure, catastrophic here. It
 * would fold a paid REPLACEMENT into the version it replaced and take a picture
 * the customer bought off the rail.
 *
 * Its other half, symmetric stemmed containment, fails the opposite way: it
 * calls "gold hoop earrings" and "gold hoops" two different edits, because
 * containment in both directions is a word-set equality with extra steps.
 *
 * # So the rule is normalised equality, and the BIAS is deliberate
 *
 * The values being compared are the interpreter's PARSED values, not the user's
 * sentences — "give her gold hoop earrings" and "gold hoop earrings please"
 * both file `gold hoop earrings` — so wording noise is already gone by the time
 * it reaches here, and what remains is punctuation, case and an article.
 *
 * The two mistakes are not the same size:
 *
 * ```
 * FALSE MERGE   two different edits judged one → a version she PAID for leaves
 *               the rail. Severe, silent, and unrecoverable from the UI.
 * FALSE SPLIT   a regeneration judged different → one extra chip, which is
 *               exactly today's behaviour and what the founder asked to reduce.
 * ```
 *
 * So this errs toward splitting: an ask whose parsed value differs at all is a
 * different edit. The named limit that follows is real — if the interpreter
 * files two different wordings for one ask, the user gets two chips — and it is
 * the safe direction to be wrong in.
 *
 * # Why the chain and not the parent id
 *
 * `parentVariantId` is only recorded while the segment store is armed, so it is
 * null on most rows and cannot key anything universal. The chain is on every
 * row that was ever written, and "same chain" IS "same edit on the same parent"
 * said in the data everybody has.
 */
import { itemsOf, type FreeValue, type RefineDelta } from "./refineDelta";

/** Every axis a delta touches, as `axis → value`. `free` is flattened so two
 *  deltas that name different subjects can never look like one edit. */
function axesOf(delta: RefineDelta): Map<string, unknown> {
  const axes = new Map<string, unknown>();
  for (const [key, value] of Object.entries(delta)) {
    if (value === undefined || value === null) continue;
    if (key === "free") {
      for (const [subject, item] of Object.entries(value as Record<string, FreeValue>)) {
        if (item === undefined || item === null) continue;
        axes.set(`free.${subject}`, item);
      }
      continue;
    }
    axes.set(key, value);
  }
  return axes;
}

/**
 * The same value, once punctuation, case and a leading article are gone.
 *
 * Deliberately crude and deliberately strict — see the header on which way this
 * is biased and why.
 */
function sameWords(left: string, right: string): boolean {
  const plain = (value: string) => value
    .toLowerCase()
    .replace(/[.,!?;:'"()]/g, " ")
    .replace(/^\s*(a|an|the)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain(left) === plain(right);
}

function sameValue(left: unknown, right: unknown): boolean {
  if (typeof left === "string" && typeof right === "string") return sameWords(left, right);
  if (Array.isArray(left) || Array.isArray(right)) {
    const a = itemsOf(left as FreeValue);
    const b = itemsOf(right as FreeValue);
    if (a.length !== b.length) return false;
    /* Their order is theirs (`itemsOf` never sorts), so position matters: a
       pair asked "hoops then studs" is not the pair asked "studs then hoops". */
    return a.every((item, at) => sameWords(item, b[at]!));
  }
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Do these two steps name the same change? */
export function sameStep(left: RefineDelta, right: RefineDelta): boolean {
  const a = axesOf(left);
  const b = axesOf(right);
  if (a.size !== b.size) return false;
  for (const [axis, value] of Array.from(a.entries())) {
    if (!b.has(axis)) return false;
    if (!sameValue(value, b.get(axis))) return false;
  }
  return true;
}

/** And the whole chain — same length, same steps, in order. */
export function sameChain(left: readonly RefineDelta[], right: readonly RefineDelta[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((step, at) => sameStep(step, right[at]!));
}

export type Take = {
  /** The row's own public id. */
  readonly publicId: string;
  /** Its parsed chain, oldest step first. */
  readonly steps: readonly RefineDelta[];
};

/**
 * THE RAIL'S OWN VIEW: the newest take of each distinct chain, in the order the
 * takes arrived, plus the map from a superseded take to the one that replaced
 * it.
 *
 * Input is oldest-first, which is what `listCandidateVariants` returns and what
 * makes "newest wins" a last-writer rule rather than a sort.
 *
 * **A chain that will not re-read is its own take.** `readStepDeltas` returns
 * an empty list for a hole in the chain, and two unreadable rows are not
 * thereby the same edit — an empty chain groups with nothing, including other
 * empty ones, because a row we cannot read is a row we cannot claim anything
 * about.
 */
export function liveTakes<T extends Take>(rows: readonly T[]): {
  live: T[];
  supersededBy: Map<string, string>;
} {
  const live: T[] = [];
  const supersededBy = new Map<string, string>();
  for (const row of rows) {
    const at = row.steps.length === 0
      ? -1
      : live.findIndex((kept) => kept.steps.length > 0 && sameChain(kept.steps, row.steps));
    if (at === -1) {
      live.push(row);
      continue;
    }
    /* The older take keeps its place in the rail's order — a regeneration is
       the same version again, not a new one at the end — and every id that ever
       pointed at it can still be resolved through the map. */
    const replaced = live[at]!;
    live[at] = row;
    supersededBy.set(replaced.publicId, row.publicId);
    /* And anything that had already been superseded BY the replaced take now
       points at the newest, so a chain of three takes resolves in one hop. */
    for (const [older, newer] of Array.from(supersededBy.entries())) {
      if (newer === replaced.publicId) supersededBy.set(older, row.publicId);
    }
  }
  return { live, supersededBy };
}

/** The take a given version resolves to now — itself, or whatever replaced it. */
export function takeShownFor(
  publicId: string | null,
  supersededBy: ReadonlyMap<string, string>,
): string | null {
  if (publicId === null) return null;
  return supersededBy.get(publicId) ?? publicId;
}
