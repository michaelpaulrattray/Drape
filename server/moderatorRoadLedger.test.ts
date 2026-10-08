/**
 * #2027 — NO UNLABELLED LEDGER FIGURE ON THE MODERATOR ROAD, DRIVEN.
 *
 * Since #2010 the moderator's request form takes the CUSTOMER's figure. Every
 * ledger figure a moderator reads on the same road is therefore one copy away
 * from granting five times what was meant, unless it is converted or says
 * "ledger". This suite drives the road's pure producers with SENTINEL ledger
 * figures and reads everything they return with the census's rendered-text
 * reader (`unlabelledLedgerFigures`, `server/testing/creditDisplaySites.ts`):
 *
 * - the Credits tab's row (`creditRowText`) — cells, facts, evidence;
 * - the credit-history and generation-history CSVs (`moderatorExports.ts`);
 * - the reconciliation pane (`reconciliationView`) and its CSV;
 * - the server-written summary sentence both of those carry (`buildSummary`).
 *
 * Every arm asserts the sentinels REACHED the output before asserting they are
 * labelled — a producer that dropped a figure would otherwise pass as labelled.
 * The source half (names, the `cr` abbreviation) and the stored-description
 * templates are in `creditDisplayGuard.test.ts`.
 */
import { describe, expect, it } from "vitest";

import { creditRowText } from "@/features/moderator/creditRowText";
import { buildReconciliationCsv } from "@/features/moderator/reconciliation-csv";
import { reconciliationView } from "@/features/moderator/reconciliationView";

import { computeDiscrepancy, type DiscrepancyInputs } from "./db/discrepancyQueries";
import { creditHistoryCsv, generationHistoryCsv } from "./routes/moderatorExports";
import { buildSummary } from "./routes/moderatorReconciliation";
import { unlabelledLedgerFigures } from "./testing/creditDisplaySites";

const ZERO: DiscrepancyInputs = {
  grossDeductions: 0,
  totalRefunds: 0,
  completedCost: 0,
  pendingCost: 0,
  failedCost: 0,
  unlinkedCost: 0,
  operationCost: 0,
};

/** Distinct, large, not multiples of five, and none a display of another. */
const S = Array.from({ length: 16 }, (_, index) => 700_003 + index * 10_007);

/** Every sentinel shows up somewhere in these texts — the positive control. */
function reached(texts: readonly string[], figures: readonly number[]): number[] {
  const all = texts.join("\n");
  return figures.filter(
    (figure) => !all.includes(figure.toLocaleString("en-US")) && !all.includes(String(figure)),
  );
}

/** A minimal CSV reader — quoted cells may hold commas. */
function csvRows(csv: string): string[][] {
  return csv
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const cells: string[] = [];
      let cell = "";
      let quoted = false;
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (quoted) {
          if (ch === '"' && line[i + 1] === '"') {
            cell += '"';
            i += 1;
          } else if (ch === '"') quoted = false;
          else cell += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ",") {
          cells.push(cell);
          cell = "";
        } else cell += ch;
      }
      cells.push(cell);
      return cells;
    });
}

describe("the reader itself — controls before any verdict counts", () => {
  it("flags a bare ledger figure, grouped or not, signed or not", () => {
    expect(unlabelledLedgerFigures("Credit top-up: 700003 credits", [700_003])).toEqual([700_003]);
    expect(unlabelledLedgerFigures("+700,003", [700_003])).toEqual([700_003]);
    expect(unlabelledLedgerFigures("−700,003 credits", [700_003])).toEqual([700_003]);
  });

  it("accepts a figure the word ledger follows, or a context that says ledger", () => {
    expect(unlabelledLedgerFigures("140,000 credits · 700,003 ledger", [700_003])).toEqual([]);
    expect(unlabelledLedgerFigures("700003", [700_003], "Amount (ledger)")).toEqual([]);
  });

  it("does not see a sentinel inside a longer number", () => {
    expect(unlabelledLedgerFigures("17,000,031 and 7000035", [700_003])).toEqual([]);
  });

  it("⚠ one label excuses only the figure it follows", () => {
    expect(unlabelledLedgerFigures("700,003 ledger charged, 710,010 recorded", [700_003, 710_010])).toEqual([
      710_010,
    ]);
  });
});

describe("the Credits tab's row — `creditRowText`", () => {
  const tx = {
    id: 9,
    type: "topup",
    amount: S[0],
    balanceAfter: S[1],
    description: `Credit top-up: ${S[2]} credits`,
    referenceId: "cs_test",
  };
  const text = creditRowText(tx, "8 Oct, 13:00");
  const strings = [text.amount, text.kind, text.what, text.balance, text.evidence ?? ""];

  it("every ledger figure reaches the row, and each is labelled where it lands", () => {
    const facts = text.facts.map((fact) => fact.value);
    expect(reached([...strings, ...facts], [S[0], S[1], S[2]])).toEqual([]);
    for (const value of [...strings, ...facts]) {
      expect(unlabelledLedgerFigures(value, [S[0], S[1], S[2]]), value).toEqual([]);
    }
  });

  it("NEGATIVE CONTROL — the description as stored would have been caught", () => {
    expect(unlabelledLedgerFigures(tx.description, [S[2]])).toEqual([S[2]]);
  });

  it("a staff member's reason is left as typed, and the row's facts still carry the truth", () => {
    const reasoned = creditRowText(
      { ...tx, type: "bonus", description: "Credits added via change request #12: promised 100 credits" },
      "8 Oct, 13:00",
    );
    expect(reasoned.what).toBe("Credits added via change request #12: promised 100 credits");
  });
});

describe("the credit-history CSV — `creditHistoryCsv`", () => {
  const csv = creditHistoryCsv([
    {
      id: 1,
      createdAt: new Date("2026-10-08T00:00:00Z"),
      type: "subscription",
      amount: S[3],
      balanceAfter: S[4],
      description: `Monthly credit refresh (${S[5]} credits + ${S[6]} rollover)`,
      referenceId: null,
      engineUsed: null,
    },
    {
      id: 2,
      createdAt: "2026-10-08T00:00:00Z",
      type: "generation",
      amount: -S[7],
      balanceAfter: S[8],
      description: null,
    },
  ]);

  it("every ledger figure reaches the file under a heading or a word that says ledger", () => {
    const [header, ...rows] = csvRows(csv);
    const figures = [S[3], S[4], S[5], S[6], S[7], S[8]];
    expect(reached([csv], figures)).toEqual([]);
    for (const row of rows) {
      row.forEach((cell, index) => {
        expect(unlabelledLedgerFigures(cell, figures, header[index]), `${header[index]}: ${cell}`).toEqual([]);
      });
    }
  });

  it("NEGATIVE CONTROL — the header this file had would have been caught", () => {
    expect(unlabelledLedgerFigures(String(S[3]), [S[3]], "Amount")).toEqual([S[3]]);
  });
});

describe("the generation-history CSV — `generationHistoryCsv`", () => {
  it("the cost reaches the file under a heading that says ledger", () => {
    const csv = generationHistoryCsv([
      {
        id: 1,
        createdAt: "2026-10-08T00:00:00Z",
        type: "castingImage",
        status: "completed",
        pointsCost: S[9],
        hasResult: true,
      },
    ]);
    const [header, ...rows] = csvRows(csv);
    expect(reached([csv], [S[9]])).toEqual([]);
    for (const row of rows) {
      row.forEach((cell, index) => {
        expect(unlabelledLedgerFigures(cell, [S[9]], header[index]), `${header[index]}: ${cell}`).toEqual([]);
      });
    }
  });
});

describe("the reconciliation summary — `buildSummary`, every branch", () => {
  const branches = [
    /* no discrepancy, with failures (unrefunded) */
    { reading: { grossDeductions: S[0], totalRefunds: 0, completedCost: S[0], failedCost: S[1], unlinkedCost: S[0] }, failedCount: 2, pendingCount: 0 },
    /* failures fully refunded */
    { reading: { grossDeductions: S[2], totalRefunds: S[3], completedCost: S[2], failedCost: S[3], unlinkedCost: S[2] - S[3] }, failedCount: 1, pendingCount: 0 },
    /* a discrepancy, pending, refund anomaly, windowed */
    { reading: { grossDeductions: S[4], totalRefunds: S[5] + S[4], completedCost: S[6], unlinkedCost: S[6] }, failedCount: 0, pendingCount: 2, windowed: true },
    /* the anomaly, all time */
    { reading: { grossDeductions: S[7], totalRefunds: S[8] + S[7], unlinkedCost: S[7] - S[9] }, failedCount: 0, pendingCount: 0 },
  ];

  it("every credit figure in every branch says ledger", () => {
    for (const branch of branches) {
      const reading = computeDiscrepancy({ ...ZERO, ...branch.reading });
      const summary = buildSummary({ ...branch, reading });
      const figures = [
        reading.grossDeductions,
        reading.totalRefunds,
        reading.expectedCost,
        reading.failedCost,
        reading.unrefundedFailureCost,
        Math.abs(reading.discrepancy),
      ].filter((figure) => figure > 999);
      expect(reached([summary], [reading.grossDeductions])).toEqual([]);
      expect(unlabelledLedgerFigures(summary, figures), summary).toEqual([]);
    }
  });
});

describe("the reconciliation pane and its CSV", () => {
  const reading = computeDiscrepancy({
    ...ZERO,
    grossDeductions: S[0],
    totalRefunds: S[1],
    completedCost: S[2],
    pendingCost: S[3],
    unlinkedCost: S[4],
  });
  const data = {
    credits: {
      totalEarned: S[5],
      totalSpent: S[6],
      grossGenerationDeductions: S[0],
      totalRefunds: S[1],
      netGenerationCost: S[7],
      byType: { topup: { count: 3, totalAmount: S[8] }, generation: { count: 4, totalAmount: -S[9] } },
    },
    generations: {
      total: 61,
      completed: 60,
      failed: 1,
      pending: 0,
      creditsOnCompleted: S[2],
      creditsOnFailed: S[10],
      creditsOnPending: S[3],
      failureRate: 1.6,
      byType: [{ type: "castingImage", totalCount: 43, totalCost: S[11] }],
    },
    reconciliation: {
      grossGenerationDeductions: S[0],
      totalRefunds: S[1],
      netGenerationCost: S[7],
      completedGenerationCost: S[2],
      pendingGenerationCost: S[3],
      expectedCost: S[4],
      discrepancy: S[12],
      hasDiscrepancy: true,
      summary: buildSummary({ reading, failedCount: 1, pendingCount: 0 }),
    },
  };
  const figures = S.slice(0, 13);

  it("the pane — every figure reaches it, under an eyebrow or beside a word that says ledger", () => {
    const view = reconciliationView(data);
    const placed: { text: string; context: string }[] = [
      { text: view.headline, context: "" },
      { text: view.summary, context: "" },
      { text: view.discrepancyValue, context: view.discrepancyEyebrow },
      ...[view.credits, view.generations, view.workings].flatMap((card) =>
        [...card.rows, ...(card.byType ?? [])].map((row) => ({ text: row.value, context: card.eyebrow })),
      ),
    ];
    const missing = reached(
      placed.map((entry) => entry.text),
      figures.filter((figure) => figure !== S[10]), // creditsOnFailed is the CSV's alone
    );
    expect(missing).toEqual([]);
    for (const entry of placed) {
      expect(unlabelledLedgerFigures(entry.text, figures, entry.context), entry.text).toEqual([]);
    }
  });

  it("the headline names the customer's figure first", () => {
    expect(reconciliationView(data).headline).toBe(
      `${Math.floor(S[12] / 5).toLocaleString()} credits · ${S[12].toLocaleString()} ledger unaccounted for.`,
    );
  });

  it("the CSV — every figure reaches it under a heading or a row label that says ledger", () => {
    const csv = buildReconciliationCsv(data, 42);
    expect(reached([csv], figures)).toEqual([]);
    let header: string[] = [];
    let expectHeader = false;
    for (const row of csvRows(csv)) {
      if (row.length === 1 && /^[A-Z ]+$/.test(row[0])) {
        /* A section title; every section but the assessment has a header row next. */
        header = [];
        expectHeader = row[0] !== "ASSESSMENT";
        continue;
      }
      if (expectHeader) {
        header = row;
        expectHeader = false;
        continue;
      }
      row.forEach((cell, index) => {
        /* A row's own label is context for its VALUES, never for itself. */
        const context = `${header[index] ?? ""} ${index > 0 ? row[0] : ""}`;
        expect(unlabelledLedgerFigures(cell, figures, context), `${context}: ${cell}`).toEqual([]);
      });
    }
  });
});
