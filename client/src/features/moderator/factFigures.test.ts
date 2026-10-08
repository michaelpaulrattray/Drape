import fs from "node:fs";
import path from "node:path";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { withoutComments } from "../../../../server/testing/withoutComments";

import { creditRowText } from "./creditRowText";
import { factFigures, staffFacts } from "./factFigures";

/**
 * #2035 — an opened credit row's AMOUNT and BALANCE AFTER wrap at the ` · `
 * and never inside a number or the word "ledger".
 *
 * Driven on the real road: `creditRowText` (the strings the row shows) →
 * `staffFacts` (what `CreditsSubTab` hands the table) → rendered markup. Each
 * arm has a negative control, and the text a reader copies is pinned equal to
 * the string `creditRowText` returned, so the fix cannot change a word.
 */

const HERE = __dirname;
const CSS = fs.readFileSync(path.join(HERE, "investigations.css"), "utf8");
const CREDITS = withoutComments(fs.readFileSync(path.join(HERE, "CreditsSubTab.tsx"), "utf8"));

const html = (node: unknown) => renderToStaticMarkup(createElement(Fragment, null, node as never));
const textOf = (markup: string) => markup.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'");
const figures = (markup: string) =>
  [...markup.matchAll(/<span class="dp-inv__figure">([^<]*)<\/span>/g)].map((m) => m[1]);

/* A top-up large enough that both figures are long — the frames' own shape. */
const tx = { id: 41, type: "topup", amount: 187_330, balanceAfter: 8_340, description: null, referenceId: "cs_x" };

describe("#2035 — a two-figure credit fact holds each figure whole", () => {
  const facts = staffFacts(creditRowText(tx, "8 Oct, 14:00").facts);
  const byLabel = (label: string) => facts.find((f) => f.label === label)!;
  const source = (label: string) => creditRowText(tx, "8 Oct, 14:00").facts.find((f) => f.label === label)!.value;

  for (const label of ["AMOUNT", "BALANCE AFTER"]) {
    it(`${label}: each figure is its own nowrap span, and the words are unchanged`, () => {
      const markup = html(byLabel(label).value);
      const held = figures(markup);
      expect(held).toHaveLength(2);
      expect(held[0]).toMatch(/ credits ·$/);
      expect(held[1]).toMatch(/ ledger$/);
      expect(textOf(markup)).toBe(source(label));
      /* The one wrap opportunity is the space between the spans. */
      expect(markup).toContain('</span> <span class="dp-inv__figure">');
    });
  }

  it("negative control: a one-figure fact passes through as plain text, no span", () => {
    const markup = html(byLabel("TRANSACTION").value);
    expect(figures(markup)).toEqual([]);
    expect(markup).toBe("#41");
    expect(factFigures("cs_live_abc")).toBe("cs_live_abc");
  });

  it("the span's class is a nowrap rule in the sheet it imports", () => {
    expect(CSS).toMatch(/\.dp-inv__figure\s*\{\s*white-space:\s*nowrap;\s*\}/);
  });

  it("CreditsSubTab hands the table its facts through staffFacts", () => {
    expect(CREDITS).toContain("facts: staffFacts(text.facts)");
    expect(CREDITS).not.toContain("facts: [...text.facts]");
  });
});
