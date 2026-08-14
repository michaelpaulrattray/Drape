/**
 * THE BRIDGE THAT MAY ONLY CROSS ONE FACE (fable-491).
 *
 * # What it is for
 *
 * The panel's reads are keyed on (candidate, version), so a landing is a NEW
 * KEY — and a new key has no data, which unmounted the whole column while the
 * answer was fetched. The founder watched it vanish and come back. Holding the
 * previous answer while the next one loads is the fix, and it shipped as a
 * plain `keepPreviousData` (da750081).
 *
 * # What it did next, and it is the same defect one boundary over
 *
 * The founder, the same evening: open cast A, let the panel fill, click out and
 * quickly into cast B — and until B's scan lands, **A's rows and A's bounding
 * boxes are drawn on B's face.** `keepPreviousData` keeps the previous answer
 * whatever changed in the key, and the previous answer belonged to another
 * woman.
 *
 * opus-368 wrote the rule it then broke: *"rows from another frame shown
 * silently would be the quieter version of the same lie."* Across VERSIONS of
 * one face the bridge is true — it is her face either way, and the working line
 * says a read is in flight. Across CASTS it asserts one woman's features on
 * another's photograph, which the panel may never do.
 *
 * # The rule
 *
 * Bridge only when the answer being held was about the SAME candidate. On a
 * candidate change the panel starts empty, with the working line — the honest
 * cold state, which is what a face nobody has read yet looks like.
 *
 * The candidate is read from the query's own key rather than from a variable
 * beside it: the key is what TanStack actually matched on, and a second record
 * of "which face was that answer about" is the copy that drifts.
 */

/** The shape tRPC's query keys take: `[[path], { input, type }]`. */
type TrpcQueryKey = readonly [unknown, { input?: { candidateId?: unknown } } | undefined];

/**
 * The candidate a cached answer was about, or null when the key does not say.
 *
 * Null is deliberately unbridgeable: a key this cannot read is a key this
 * cannot vouch for, and the cold state is the safe answer.
 */
export function candidateOfQueryKey(key: unknown): string | null {
  if (!Array.isArray(key) || key.length < 2) return null;
  const meta = (key as unknown as TrpcQueryKey)[1];
  const candidateId = meta?.input?.candidateId;
  return typeof candidateId === "string" && candidateId.length > 0 ? candidateId : null;
}

/**
 * `placeholderData` for a panel read: the previous answer, but only if it was
 * about this face.
 */
export function bridgeWithinCandidate<T>(candidateId: string | null) {
  return (previous: T | undefined, previousQuery?: { queryKey?: unknown }): T | undefined => {
    if (previous === undefined) return undefined;
    if (candidateId === null) return undefined;
    return candidateOfQueryKey(previousQuery?.queryKey) === candidateId ? previous : undefined;
  };
}
