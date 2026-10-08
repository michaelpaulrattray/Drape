/**
 * A fact that states one amount twice — `+37,466 credits · +187,330 ledger` —
 * may wrap only at its ` · `, never inside a figure or a word (#2035).
 *
 * The foundation's fact value was `word-break: break-all` when this was
 * written: those cells carry ids, hashes and user agents, and one unbroken
 * 64-character value would otherwise blow the grid open. A two-figure credit
 * fact is the one value that rule mangled — PR #2034's frames read
 * `+187,3 / 30 ledger` and `8,340 le / dger` in a 168px column. #2043 moved
 * the foundation to `overflow-wrap: anywhere`, which tries a space first and
 * so fixes every fact cell at once; this helper stays because it is stricter —
 * it keeps a number and its unit together, so the break lands at the ` · `
 * rather than between `+37,466` and `credits`. So each figure goes in its own
 * `white-space: nowrap` span (`investigations.css`), the separator stays in the
 * text, and the cell's words are exactly the string `creditRowText` returns:
 * nothing a reader of the row's text — the census, a copy-paste — can tell apart.
 */
import type { ReactNode } from "react";

import type { DataFact } from "@/foundation";

import "./investigations.css";

const SEPARATOR = " · ";

/** One fact value, its figures held whole. A value with no separator is returned as it came. */
export function factFigures(value: string): ReactNode {
  const parts = value.split(SEPARATOR);
  if (parts.length < 2) return value;
  /*
    The space after each ` ·` sits OUTSIDE the spans, in the cell's own flow:
    a space inside a `nowrap` span is not a wrap opportunity, so that is the
    one place the line may break.
  */
  return parts.flatMap((part, index) => {
    const last = index === parts.length - 1;
    const figure = (
      <span key={`f${index}`} className="dp-inv__figure">
        {last ? part : `${part} ·`}
      </span>
    );
    return last ? [figure] : [figure, " "];
  });
}

/** The row's facts as the table draws them — every value through `factFigures`. */
export function staffFacts(facts: readonly { readonly label: string; readonly value: string }[]): DataFact[] {
  return facts.map((fact) => ({ label: fact.label, value: factFigures(fact.value) }));
}
