/**
 * THE CUSTOMER'S OWN EXPORT STATES CREDITS ON THE CUSTOMER'S SCALE — the
 * driven arms for #2475.
 *
 * The defect: Settings → Security → *Export my data* downloads a JSON copy of
 * the account, and every credit figure in it was the LEDGER figure — five
 * times what the same account's balance chip shows the same person
 * (`formatCredits(displayBalance(creditsBalance))`,
 * `client/src/components/UserCard.tsx`). Nine fields plus the STORED
 * transaction sentence, which says the internal number in words: an account
 * reading 9,290 credits on screen downloaded `"balance": 46450` and, a line
 * below, *"Monthly credit refresh (180000 credits + 0 rollover)"* on a plan
 * whose card says 36,000 a month.
 *
 * Nobody was charged wrongly and no screen was wrong. What was wrong is the
 * one document a customer keeps a copy of.
 *
 * What these arms hold:
 *   1. the INSTRUMENT first — the sentinel scan finds every ledger figure in a
 *      hand-built object, so a verdict of "none in the export" is a reading
 *      rather than a reader that stopped working (working law 2);
 *   2. all nine fields carry the DISPLAY figure, each by its own meaning — a
 *      balance down, a charge up, a signed history row by its sign — driven
 *      through the real `account.exportData` procedure;
 *   3. no ledger figure survives anywhere in the serialized file;
 *   4. the stored sentence never leaves, proved twice: its markers are absent
 *      from the file, AND the statement on the wire does not select the column
 *      at all (working law 5 — the contract is proved on the outgoing request,
 *      not on a comment beside it);
 *   5. the composed sentence's vocabulary is held equal to the column's own
 *      enum, read off the schema rather than restated here;
 *   6. NEGATIVE CONTROL — another account's credit rows never appear, and every
 *      credit statement carries the caller as owner.
 *
 * WHY A FAKE CLIENT: `vitest.setup.ts` strips `DATABASE_URL`, so a row-level
 * suite would SKIP in CI and prove nothing while reading green. The harness is
 * `gdprExportCampaigns.test.ts`'s — real drizzle renders real statements onto a
 * client that answers from in-memory tables and honours each owner predicate by
 * reading the bound parameter, so dropping one hands back every account's rows
 * exactly as a real database would.
 */
import { drizzle } from "drizzle-orm/mysql2";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { creditTransactions } from "../drizzle/schema";
import {
  customerCreditKind,
  customerCreditNote,
  displayMovement,
} from "../shared/creditDisplay";

import { CONTENDED_TEST_TIMEOUT_MS } from "./testing/contendedTestTimeout";

vi.setConfig({ testTimeout: CONTENDED_TEST_TIMEOUT_MS });

type Row = Record<string, unknown>;

const tables: Record<string, Row[]> = {};
const sent: Array<{ table: string; sql: string; params: unknown[] }> = [];

function columnsOf(sql: string): string[] {
  const list = sql.slice("select ".length, sql.indexOf(" from `"));
  return list.split(", ").map((part) => {
    const names = [...part.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    return names[names.length - 1];
  });
}

/** The owner predicate each credit-bearing table must carry, as drizzle renders it. */
const OWNER_PREDICATE: Record<string, string> = {
  points: "`points`.`userId` = ?",
  point_transactions: "`point_transactions`.`userId` = ?",
  generations: "`generations`.`userId` = ?",
  referrals: "`referrals`.`referrerUserId` = ?",
};

const fakeClient = {
  async query(q: { sql: string } | string, params: unknown[] = []) {
    const sql = typeof q === "string" ? q : q.sql;
    const table = /from `([^`]+)`/.exec(sql)?.[1] ?? "?";
    sent.push({ table, sql, params });
    let rows = tables[table] ?? [];
    const predicate = OWNER_PREDICATE[table];
    if (predicate && sql.includes(predicate)) {
      rows = rows.filter((row) => row.userId === params[0] || row.referrerUserId === params[0]);
    }
    /* The profile read is keyed on the id, not on a `userId` column. */
    if (table === "users" && sql.includes("`users`.`id` = ?")) {
      rows = rows.filter((row) => row.id === params[0]);
    }
    const cols = columnsOf(sql);
    return [rows.map((row) => cols.map((c) => row[c] ?? null)), []];
  },
};

const fakeDb = drizzle({ client: fakeClient as never });

vi.mock("./db/connection", () => ({
  getDb: async () => fakeDb,
}));
vi.mock("./auditLog", () => ({ logAuditEvent: async () => undefined }));
vi.mock("./casting/evidence/evidenceDeliveryRuntime", () => ({
  getEvidenceDeliveryAdapter: () => null,
}));

const { accountRouter } = await import("./routes/account");

const STAMP = "2026-01-01 00:00:00";
/*
  The export's rate limit is in memory and shared across arms, so every arm
  takes a fresh pair of accounts.
*/
let OWNER = 24_750;
let STRANGER = 24_751;

/**
 * THE LEDGER FIGURES THE FIXTURE STORES, and the display figure each must
 * become. Chosen so no ledger value equals another's display value, and so
 * each conversion exercises its own rounding:
 *
 *   - `balance` 46,450 → 9,290 is the card's own worked example;
 *   - `rolloverCredits` 7,333 → 1,466 is the figure `wholeDisplayLedger`'s own
 *     docblock uses, down from 1,466.6;
 *   - `creditsPurchased` 61,237 → 12,247 rounds DOWN (12,247.4);
 *   - `creditsUsed` 30,013 → 6,003 rounds UP (6,002.6) — a charge is never
 *     stated as less than it was;
 *   - the spend −8,756 → −1,752 rounds its MAGNITUDE up (1,751.2) while its
 *     `balanceAfter` 217,694 → 43,538 rounds down (43,538.8), so the two
 *     roundings on one row are proved to differ.
 */
const LEDGER = {
  balance: 46_450,
  creditsPurchased: 61_237,
  creditsUsed: 30_013,
  rolloverCredits: 7_333,
  refreshAmount: 180_000,
  refreshBalanceAfter: 226_450,
  spendAmount: -8_756,
  spendBalanceAfter: 217_694,
  genCostA: 1_753,
  genCostB: 2_002,
  referralAward: 12_500,
} as const;

const DISPLAY = {
  balance: 9_290,
  creditsPurchased: 12_247,
  creditsUsed: 6_003,
  rolloverCredits: 1_466,
  refreshAmount: 36_000,
  refreshBalanceAfter: 45_290,
  spendAmount: -1_752,
  spendBalanceAfter: 43_538,
  genCostA: 351,
  genCostB: 401,
  referralAward: 2_500,
} as const;

/** Every stored sentence in the fixture carries one, so its escape is visible. */
const STORED_MARKERS = [
  "STORED-SENTENCE-2475-refresh",
  "STORED-SENTENCE-2475-spend",
  "STORED-SENTENCE-2475-zero",
] as const;

/**
 * Does `text` state `figure` as a standalone number?
 *
 * A bare `includes` would match `1753` inside a timestamp or an id, and `234`
 * inside a grouped `1,234,567`. Both spellings are tried, because the composed
 * sentence formats with `toLocaleString` while the fields are raw JSON numbers.
 *
 * ⚠ **THE BOUNDARY CANNOT SIMPLY REJECT AN ADJACENT COMMA, WHICH IS WHAT THE
 * FIRST SHAPE DID — and its own positive control caught it.** In compact JSON
 * every figure but the last is followed by the separator comma, so
 * `"balance":46450,` matched nothing and the scan reported a clean file while
 * reading the defect. A grouping comma is one followed by exactly three digits,
 * or preceded by a digit; a separator comma is neither. Needles are digits and
 * commas only, so nothing needs escaping.
 */
function statesFigure(text: string, figure: number): boolean {
  const magnitude = Math.abs(figure);
  const LEFT = "(?<!\\d)(?<!\\d,)(?<!\\d\\.)";
  const RIGHT = "(?!\\d)(?!,\\d{3})(?!\\.\\d)";
  const bounded = (needle: string) => new RegExp(`${LEFT}${needle}${RIGHT}`).test(text);
  return bounded(String(magnitude)) || bounded(magnitude.toLocaleString("en-US"));
}

function seed(): void {
  tables.users = [
    { id: OWNER, name: "Owner", role: "user", createdAt: STAMP, lastSignedIn: STAMP },
    { id: STRANGER, name: "Stranger", role: "user", createdAt: STAMP, lastSignedIn: STAMP },
  ];
  tables.points = [
    {
      id: 1,
      userId: OWNER,
      planTier: "pro",
      balance: LEDGER.balance,
      creditsPurchased: LEDGER.creditsPurchased,
      creditsUsed: LEDGER.creditsUsed,
      rolloverCredits: LEDGER.rolloverCredits,
      subscriptionStatus: "active",
      currentPeriodStart: null,
      currentPeriodEnd: null,
    },
    {
      id: 2,
      userId: STRANGER,
      planTier: "free",
      balance: 999_999,
      creditsPurchased: 0,
      creditsUsed: 0,
      rolloverCredits: 0,
      subscriptionStatus: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
    },
  ];
  tables.point_transactions = [
    {
      id: 11,
      userId: OWNER,
      amount: LEDGER.refreshAmount,
      type: "subscription",
      description: `Monthly credit refresh (${LEDGER.refreshAmount} credits + 0 rollover) ${STORED_MARKERS[0]}`,
      balanceAfter: LEDGER.refreshBalanceAfter,
      createdAt: STAMP,
    },
    {
      id: 12,
      userId: OWNER,
      amount: LEDGER.spendAmount,
      type: "generation",
      description: `Model iteration ${STORED_MARKERS[1]}`,
      balanceAfter: LEDGER.spendBalanceAfter,
      createdAt: STAMP,
    },
    {
      id: 13,
      userId: OWNER,
      amount: 0,
      type: "refund",
      description: `Nothing to return ${STORED_MARKERS[2]}`,
      balanceAfter: LEDGER.spendBalanceAfter,
      createdAt: STAMP,
    },
    {
      id: 14,
      userId: STRANGER,
      amount: 777_777,
      type: "bonus",
      description: "STRANGER-transaction",
      balanceAfter: 777_777,
      createdAt: STAMP,
    },
  ];
  tables.models = [];
  tables.model_assets = [];
  tables.model_reference_plates = [];
  tables.model_evidence_crops = [];
  tables.cast_campaigns = [];
  tables.cast_campaign_members = [];
  tables.cast_creation_records = [];
  tables.generations = [
    {
      id: 21,
      userId: OWNER,
      type: "castingImage",
      status: "completed",
      pointsCost: LEDGER.genCostA,
      resultUrl: null,
      createdAt: STAMP,
      completedAt: STAMP,
    },
    {
      id: 22,
      userId: OWNER,
      type: "iterate",
      status: "completed",
      pointsCost: LEDGER.genCostB,
      resultUrl: null,
      createdAt: STAMP,
      completedAt: STAMP,
    },
    {
      id: 23,
      userId: STRANGER,
      type: "castingImage",
      status: "completed",
      pointsCost: 888_888,
      resultUrl: null,
      createdAt: STAMP,
      completedAt: STAMP,
    },
  ];
  tables.referrals = [
    {
      id: 31,
      referrerUserId: OWNER,
      referredEmail: "friend@example.com",
      status: "subscribed",
      creditsAwarded: LEDGER.referralAward,
      createdAt: STAMP,
    },
    {
      id: 32,
      referrerUserId: OWNER,
      referredEmail: "pending@example.com",
      status: "pending",
      creditsAwarded: 0,
      createdAt: STAMP,
    },
    {
      id: 33,
      referrerUserId: STRANGER,
      referredEmail: "stranger@example.com",
      status: "subscribed",
      creditsAwarded: 666_666,
      createdAt: STAMP,
    },
  ];
  tables.change_requests = [];
}

function callerFor(userId: number) {
  return accountRouter.createCaller({
    user: { id: userId, approved: true, suspendedAt: null, lockedUntil: null },
  } as never);
}

beforeEach(() => {
  sent.length = 0;
  OWNER += 10;
  STRANGER += 10;
  seed();
});

describe("#2475 — the instrument, before any verdict of it counts", () => {
  it("POSITIVE CONTROL — the sentinel scan finds every ledger figure when one is there", () => {
    /*
      The export as it stood: the ledger figures straight into the object. If
      the scan cannot see them here it cannot see them anywhere, and its
      "none found" verdict on the real export would mean nothing.
    */
    const asItShipped = JSON.stringify({
      subscription: {
        balance: LEDGER.balance,
        creditsPurchased: LEDGER.creditsPurchased,
        creditsUsed: LEDGER.creditsUsed,
        rolloverCredits: LEDGER.rolloverCredits,
      },
      creditHistory: [
        {
          amount: LEDGER.refreshAmount,
          description: `Monthly credit refresh (${LEDGER.refreshAmount} credits + 0 rollover)`,
          balanceAfter: LEDGER.refreshBalanceAfter,
        },
        { amount: LEDGER.spendAmount, balanceAfter: LEDGER.spendBalanceAfter },
      ],
      generations: [{ pointsCost: LEDGER.genCostA }, { pointsCost: LEDGER.genCostB }],
      referrals: { sent: [{ creditsAwarded: LEDGER.referralAward }] },
    });
    const missed = Object.entries(LEDGER).filter(([, figure]) => !statesFigure(asItShipped, figure));
    expect(missed, "the scan cannot see a ledger figure it is pointed at").toEqual([]);
  });

  it("POSITIVE CONTROL — and it does not mistake a display figure for its ledger one", () => {
    const converted = JSON.stringify({ balance: DISPLAY.balance, rollover: DISPLAY.rolloverCredits });
    expect(statesFigure(converted, LEDGER.balance)).toBe(false);
    expect(statesFigure(converted, LEDGER.rolloverCredits)).toBe(false);
    /* …and a figure inside a longer grouped one is not a match either. */
    expect(statesFigure("1,234,567", 234)).toBe(false);
  });
});

describe("#2475 — every credit figure in the export is the figure the customer is shown", () => {
  it("the four account totals, each by its own meaning", async () => {
    const data = await callerFor(OWNER).exportData();
    expect(data.subscription).toMatchObject({
      planTier: "pro",
      balance: DISPLAY.balance,
      creditsPurchased: DISPLAY.creditsPurchased,
      creditsUsed: DISPLAY.creditsUsed,
      rolloverCredits: DISPLAY.rolloverCredits,
    });
  });

  it("each credit-history row: the signed amount, the balance after it, and a sentence composed here", async () => {
    const data = await callerFor(OWNER).exportData();
    expect(data.creditHistory).toHaveLength(3);
    const byType = new Map(data.creditHistory.map((row) => [row.type, row]));

    expect(byType.get("subscription")).toMatchObject({
      amount: DISPLAY.refreshAmount,
      balanceAfter: DISPLAY.refreshBalanceAfter,
      description: "Plan credits — added 36,000 credits",
    });
    expect(byType.get("generation")).toMatchObject({
      amount: DISPLAY.spendAmount,
      balanceAfter: DISPLAY.spendBalanceAfter,
      description: "Studio work — used 1,752 credits",
    });
    expect(byType.get("refund")).toMatchObject({
      amount: 0,
      description: "Refund — no credits moved",
    });
  });

  it("⚠ the sentence and the amount can never disagree — one conversion, read twice", async () => {
    const data = await callerFor(OWNER).exportData();
    for (const row of data.creditHistory) {
      expect(row.description, `row ${row.type} states a second figure`).toBe(
        customerCreditNote(row.type, row.amount),
      );
    }
  });

  it("a generation's cost rounds UP, and a referral award rounds DOWN", async () => {
    const data = await callerFor(OWNER).exportData();
    expect(data.generations.map((g) => g.pointsCost)).toEqual([DISPLAY.genCostA, DISPLAY.genCostB]);
    expect(data.referrals.sent.map((r) => r.creditsAwarded)).toEqual([DISPLAY.referralAward, 0]);
  });

  it("NO LEDGER FIGURE SURVIVES ANYWHERE IN THE FILE — the whole serialized download", async () => {
    const data = await callerFor(OWNER).exportData();
    const file = JSON.stringify(data, null, 2);
    const leaked = Object.entries(LEDGER).filter(([, figure]) => statesFigure(file, figure));
    expect(leaked, "a ledger credit figure reached the customer's file").toEqual([]);
  });
});

describe("#2475 — the stored transaction sentence never leaves the building", () => {
  it("not one marker reaches the file, and nor does the prose around it", async () => {
    /* Instrument check: the fixture really does store the sentences. */
    expect(tables.point_transactions[0].description).toContain(STORED_MARKERS[0]);

    const data = await callerFor(OWNER).exportData();
    const file = JSON.stringify(data);
    for (const marker of STORED_MARKERS) {
      expect(file, `the export replayed a stored sentence (${marker})`).not.toContain(marker);
    }
    expect(file).not.toContain("Monthly credit refresh");
    expect(file).not.toContain("Model iteration");
  });

  it("⚠ AND THE COLUMN IS NOT ON THE WIRE — proved on the outgoing statement, not beside it", async () => {
    await callerFor(OWNER).exportData();
    const reads = sent.filter((s) => s.table === "point_transactions");
    expect(reads).toHaveLength(1);
    expect(columnsOf(reads[0].sql).sort()).toEqual(
      ["amount", "balanceAfter", "createdAt", "type"].sort(),
    );
  });
});

describe("#2475 — the composed sentence's vocabulary is derived, never transcribed", () => {
  it("every value the column's own enum declares has a kind word of its own", () => {
    const kinds = creditTransactions.type.enumValues;
    expect(kinds.length).toBeGreaterThanOrEqual(9);
    const unnamed = kinds.filter((kind) => customerCreditKind(kind) === "Credit movement");
    expect(unnamed, "a transaction kind has no customer word — add one to CUSTOMER_CREDIT_KIND").toEqual([]);
  });

  it("an unknown kind still exports, as a plain movement rather than a throw", () => {
    expect(customerCreditNote("some_future_kind", displayMovement(-8_756))).toBe(
      "Credit movement — used 1,752 credits",
    );
  });

  it("no kind word states a cause the row does not carry", () => {
    /*
      `subscription` is both the monthly refresh AND the plan-credit expiry 30
      days after a plan ends; `bonus` is the welcome bonus, the referral bonus,
      goodwill credits and the 90-day promo expiry. A word naming one of those
      would be a new WRONG statement in place of a wrongly-scaled one.
    */
    for (const kind of creditTransactions.type.enumValues) {
      expect(customerCreditKind(kind).toLowerCase(), `${kind} claims a cause`).not.toMatch(
        /refresh|expir|monthly|welcome|referral|goodwill|chargeback/,
      );
    }
  });
});

describe("#2475 — NEGATIVE CONTROL: the stranger's credit rows never appear", () => {
  it("every credit read is scoped to the caller, and the stranger's figures are absent", async () => {
    /* Instrument check: the fake holds the stranger's rows and would hand them back unscoped. */
    expect(tables.points.some((row) => row.userId === STRANGER)).toBe(true);

    const data = await callerFor(OWNER).exportData();
    const file = JSON.stringify(data);
    for (const figure of [999_999, 777_777, 888_888, 666_666]) {
      expect(statesFigure(file, figure), `the stranger's ${figure} reached the owner's file`).toBe(false);
    }
    expect(file).not.toContain("STRANGER-");
    expect(file).not.toContain("stranger@example.com");

    for (const [table, predicate] of Object.entries(OWNER_PREDICATE)) {
      const reads = sent.filter((s) => s.table === table);
      expect(reads.length, `no statement read ${table}`).toBeGreaterThan(0);
      for (const read of reads) {
        expect(read.sql, `${table} is not scoped to the owner`).toContain(predicate);
        expect(read.params[0]).toBe(OWNER);
      }
    }
  });

  it("and the mirror: the stranger's own export carries only the stranger's figures", async () => {
    const theirs = await callerFor(STRANGER).exportData();
    expect(theirs.profile.name).toBe("Stranger");
    expect(theirs.subscription?.balance).toBe(199_999);
    expect(theirs.creditHistory).toHaveLength(1);
    expect(theirs.creditHistory[0].description).toBe("Bonus — added 155,555 credits");
  });
});
