/**
 * WHICH CHILD ROWS A PURGE MAY TAKE — the one place the rule lives (#1959).
 *
 * # The defect this exists to make structurally impossible
 *
 * Every casting child store is reached through `candidateId`, and until this
 * module every `listPurgeable*In` / `delete*RowsIn` pair said so in its own
 * words: `inArray(table.candidateId, ids)`, nine times over. That is correct
 * for the ids it was written for — an account's OWN candidate rows, read by
 * `listAccountCandidatesIn(tx, userId)`, where the candidate is the proof of
 * ownership and the child row's own `userId` column adds nothing.
 *
 * ⚠ **#1948 L1 then fed those same helpers a second kind of id and the
 * difference was invisible at the call site.** The orphan sweep hands over
 * every candidate id the deleting account's child rows POINT AT and that is
 * not one of her own candidates. Nothing proves such an id is hers — it is
 * read off a row, and the row is by definition evidence that something went
 * wrong. If one of her child rows carries her `userId` while pointing at
 * another customer's LIVE candidate, a delete keyed on candidate id alone
 * takes that customer's refinements, segments, references, scans and ink
 * work, and their objects, with her account.
 *
 * So an id arriving here now carries the terms on which it may be used:
 *
 * - {@link PurgeCandidateScope.candidateIds} — ids whose ownership is already
 *   proven by the statement that produced them. Every child row under them
 *   goes, whatever `userId` the row carries, because a child row carrying the
 *   wrong owner under a candidate that IS hers is precisely the litter the
 *   purge exists to collect. Scoping these by owner would strand it.
 * - {@link PurgeCandidateScope.ownerScoped} — ids read off a row, which prove
 *   nothing. The row's own `userId` must match in the SAME statement
 *   (invariant 1), so the sweep is structurally unable to reach a row that is
 *   not the deleting account's, whatever the id turns out to point at.
 *
 * **Both halves travel in ONE predicate and therefore ONE statement**, which
 * is what keeps `accountCastingPurge`'s header promise that there is no second
 * walk and no second list of key columns to drift.
 *
 * # Why it refuses rather than returning nothing
 *
 * {@link purgeScopeWhere} THROWS on an empty selector. A `where` that renders
 * to nothing on a `DELETE` is the whole table, so the one failure mode worth
 * designing against is a caller that forgets its own emptiness check —
 * invariant 7's direction: refuse, never allow, when the input is missing.
 * Callers keep their early returns; this is the backstop under them.
 */
import { and, eq, inArray, or, type SQL } from "drizzle-orm";
import type { MySqlColumn } from "drizzle-orm/mysql-core";

/** Candidate ids read off a child row, usable only against that row's owner. */
export type OwnerScopedCandidateIds = {
  readonly candidateIds: readonly number[];
  /** The account being erased — the owner the row must carry to be taken. */
  readonly userId: number;
};

export type PurgeCandidateScope = {
  /**
   * Ids whose ownership the producing statement already proved.
   *
   * Optional, because an account whose candidate rows are ALL gone is exactly
   * the account most likely to be carrying orphans — a scope that is nothing
   * but an owner-scoped half is the normal shape there, not a malformed one.
   */
  readonly candidateIds?: readonly number[];
  /** Ids that prove nothing on their own. */
  readonly ownerScoped?: OwnerScopedCandidateIds;
};

/**
 * What a purge helper takes.
 *
 * A bare array is the proven-ownership case and is the shape every caller
 * outside the account purge passes — candidate retention and
 * `finalCastDeletion` both start from a candidate row they have already
 * scoped — so widening these helpers cost those call sites nothing.
 */
export type PurgeCandidateSelector = readonly number[] | PurgeCandidateScope;

export function purgeScopeOf(selector: PurgeCandidateSelector): PurgeCandidateScope {
  return Array.isArray(selector)
    ? { candidateIds: selector as readonly number[] }
    : (selector as PurgeCandidateScope);
}

/** Every id the scope names, for a caller that only needs to know if there is work. */
export function purgeScopeIsEmpty(selector: PurgeCandidateSelector): boolean {
  const scope = purgeScopeOf(selector);
  return (scope.candidateIds?.length ?? 0) === 0
    && (scope.ownerScoped?.candidateIds.length ?? 0) === 0;
}

/**
 * The predicate selecting exactly the rows this purge may read or delete.
 *
 * @param candidateIdColumn the column carrying the parent candidate's id —
 *   `castingInkPlates` has none of its own, so the plate reader passes the
 *   DESIGN's column and its own `userId` beside it.
 * @param ownerIdColumn the `userId` of the row being collected, never the
 *   parent's: it is that row whose deletion must be refused.
 */
export function purgeScopeWhere(
  candidateIdColumn: MySqlColumn,
  ownerIdColumn: MySqlColumn,
  selector: PurgeCandidateSelector,
): SQL {
  const scope = purgeScopeOf(selector);
  const terms: SQL[] = [];
  const proven = scope.candidateIds ?? [];
  if (proven.length > 0) {
    terms.push(inArray(candidateIdColumn, [...proven]));
  }
  const owned = scope.ownerScoped;
  if (owned && owned.candidateIds.length > 0) {
    terms.push(
      and(
        inArray(candidateIdColumn, [...owned.candidateIds]),
        eq(ownerIdColumn, owned.userId),
      ) as SQL,
    );
  }
  if (terms.length === 0) {
    /* Never a bare `where` on a DELETE. See the header. */
    throw new Error(
      "[purgeScopeWhere] refused an empty candidate scope — a predicate matching nothing"
        + " would render as no WHERE clause at all and take the whole table",
    );
  }
  return terms.length === 1 ? terms[0]! : (or(...terms) as SQL);
}
