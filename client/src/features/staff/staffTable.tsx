/**
 * The staff table's shared vocabulary (brief 06).
 *
 * `DataTable` owns the SHAPE — head, rows, expansion, footer. This file owns
 * the two things every one of the eleven surfaces needs and no foundation
 * primitive can decide for them: **what a state looks like**, and **how a page
 * of rows is described in words.**
 *
 * ⚠ **It is not a second table.** Nothing here draws a row. His §8 bar —
 * *"one shared table component serves all eleven; no surface hand-rolls
 * rows"* — is about `DataTable`, and adding a wrapper around it would be the
 * fork that bar exists to prevent.
 */
import type { ReactNode } from "react";

import { StatusPill } from "@/foundation";

/**
 * THE COLOUR RULE, in one function, so eleven surfaces cannot each decide it
 * differently (§4).
 *
 * > *"Status is a state, so it may carry accent. Role is a category, so it may
 * > not."*
 *
 * `attention` is the whole of it: `suspended`, `frozen`, `locked`, `failed`,
 * `critical` — the things a moderator is scanning a 300-row list to FIND. A
 * resting state is greyscale, because a page where everything is coloured has
 * nothing coloured.
 */
export function StatePill({
  label,
  attention,
}: {
  label: ReactNode;
  /** True only for a state someone needs to act on. */
  attention?: boolean;
}) {
  return <StatusPill tone={attention ? "accent" : "neutral"}>{label}</StatusPill>;
}

/**
 * A role is what someone IS, never something needing attention — so a role pill
 * is greyscale. ⚠ **`admin` IS THE ONE NAMED EXCEPTION, AND IT IS THE FOUNDER'S,
 * NOT AN OVERSIGHT** (#422, 2026-09-02, his ruling on the staff frames).
 *
 * His reason, and it is the whole boundary: **who has the keys is worth
 * spotting fast.** That is a security-legibility argument, not an attention
 * one, which is exactly why it does not reopen brief 06 §4 for anything else —
 * `user` and `moderator` stay grey, and every resting STATE stays grey.
 *
 * ⚠ **`admin` is the first thing in the product to wear the accent that is not
 * a state someone must act on.** `StatusPill` has three tones — there is no
 * greyscale-with-emphasis — so this pill wears the SAME accent as `suspended`,
 * `frozen` and `locked`, which sit one line away in every row that has both.
 * That collision is known and was put in front of him at the frames rather
 * than discovered later; it is the cost of the carve-out, not a bug in it.
 *
 * The rule still lives in ONE function on purpose. This stays separate from
 * `StatePill` for the original reason: a shared component with an `attention`
 * prop is how a caller re-tints `moderator` in good faith. The exception is
 * decided HERE, by value, and a caller cannot pass it.
 */
export function RolePill({ role }: { role: string }) {
  return <StatusPill tone={role === "admin" ? "accent" : "neutral"}>{role}</StatusPill>;
}

/** `#4417` — a mono id at `--faint`, never `#CCC` grey sans (§4). */
export function RowId({ children }: { children: ReactNode }) {
  return <span className="dp-table__id">{children}</span>;
}

/** Two facts stacked — a name over its email — on the flexible column (§4). */
export function RowStack({ name, meta }: { name: ReactNode; meta: ReactNode }) {
  return (
    <span className="dp-table__stack">
      <span className="dp-table__stackname">{name}</span>
      <span className="dp-table__stackmeta">{meta}</span>
    </span>
  );
}

/**
 * `Showing 1–25 of 312` (§6).
 *
 * ⚠ **It says what it KNOWS.** Where a procedure returns no total — three of
 * the eleven do — the range is `Showing 1–25` and the sentence simply stops,
 * rather than inventing a total from the page size. A number no server
 * produces is the founder's own standing objection (his 00b frames ruling).
 */
export function pageRange({
  offset,
  count,
  total,
}: {
  offset: number;
  count: number;
  total?: number;
}): string {
  if (count === 0) return total === undefined ? "Nothing to show" : `0 of ${total}`;
  const from = offset + 1;
  const to = offset + count;
  const span = from === to ? `${from}` : `${from}–${to}`;
  return total === undefined ? `Showing ${span}` : `Showing ${span} of ${total}`;
}

/**
 * A consequence two surfaces both need, written ONCE.
 *
 * ⚠ **This constant exists because a guard caught the copy.** Suspending an
 * account is reachable from Admin → Users and from an audit entry, and both
 * expansions said the same sentence in their own words — a second list
 * shadowing a source of truth, which working law 4 says always drifts. The
 * arm in `section06-guard.test.ts` refuses two destructive actions sharing one
 * note, and the right answer to it was to stop having two.
 */
export const SUSPEND_CONSEQUENCE =
  "Suspending signs this person out and blocks every sign-in until it is lifted. Their casts and credits are untouched.";

/** A JSON payload inside an expansion's evidence block — wrapped, never scrolled. */
export function RawPayload({ value }: { value: unknown }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}
