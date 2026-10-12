/**
 * AN ACCESS CODE ADMITS NO MORE PEOPLE THAN ITS LIMIT (#2373).
 *
 * `redeemInviteCode` read the code, checked `currentUses >= maxUses` OUTSIDE
 * the transaction, then ran `UPDATE invite_codes … WHERE currentUses < maxUses`
 * — the right guard — and never read how many rows it changed. Two sign-ups
 * racing for a code's last use both passed the read; the second increment
 * matched nothing; and the account was approved anyway, with the counter still
 * reading inside the limit on the admin page.
 *
 * What this file holds, driven at the helper with the database faked:
 *
 *   1. AT THE WIRE — the two guarded UPDATEs carry their guards in their own
 *      WHERE clauses, rendered by drizzle's real MySQL dialect.
 *   2. THE ANSWER IS READ — an increment that changed no row, or an approval
 *      that changed no row, refuses the redeem and rolls the transaction back.
 *   3. THE RACE — two redeems of a one-use code, both past the pre-reads
 *      before either writes, admit exactly one person.
 *
 * ⚠ The fake decides how many rows an UPDATE changes by reading the rendered
 * WHERE for the guard it is about, and applies that guard to its own state; an
 * UPDATE whose WHERE lacks the guard matches the row, as MySQL would. That is a
 * small interpreter of two predicates, declared here rather than passed off as
 * a database. The real-database proof of the same race is
 * `server/inviteCodeRedeem-db.test.ts`, which runs on a disposable database.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
import { inviteCodes, users } from "../../drizzle/schema";

const mockGetDb = vi.fn();
const mockWithTransaction = vi.fn();
vi.mock("./connection", () => ({
  getDb: () => mockGetDb(),
  withTransaction: (cb: unknown) => mockWithTransaction(cb),
}));

import { redeemInviteCode } from "./inviteCodes";

const dialect = new MySqlDialect();
const render = (where: SQL) => dialect.sqlToQuery(where).sql;

const USED_UP = "This access code has reached its usage limit.";
const ALREADY_APPROVED = "Your account is already approved.";

interface World {
  code: { id: number; code: string; currentUses: number; maxUses: number; isActive: boolean; expiresAt: Date | null };
  approved: Map<number, boolean>;
  /** Every UPDATE's rendered WHERE, by table. */
  wheres: { invite_codes: string[]; users: string[] };
  /** How many redeems must reach the transaction before any may write. */
  barrier: number;
}

function makeWorld(over: Partial<World["code"]> = {}, barrier = 1): World {
  return {
    code: { id: 5, code: "DRAPE-LAST", currentUses: 0, maxUses: 1, isActive: true, expiresAt: null, ...over },
    approved: new Map(),
    wheres: { invite_codes: [], users: [] },
    barrier,
  };
}

/** Wire one world into the mocked connection: the pre-reads see the world as
 *  it stands, and the transaction serialises writers the way the row lock on
 *  `invite_codes` does, rolling the world back when its callback throws. */
function install(world: World) {
  /* The pre-read of the user goes through `select({ approved })`, whose `from`
     is `users`; route it to the world's map. */
  mockGetDb.mockImplementation(async () => ({
    select: () => ({
      from: (table: unknown) => ({
        where: (cond: SQL) => ({
          limit: async () => {
            if (table === inviteCodes) return [{ ...world.code }];
            const params = dialect.sqlToQuery(cond).params;
            const id = Number(params[0]);
            return [{ approved: world.approved.get(id) ?? false }];
          },
        }),
      }),
    }),
  }));

  let entered = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let lock: Promise<unknown> = Promise.resolve();

  mockWithTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
    entered += 1;
    if (entered >= world.barrier) release();
    await gate;

    const run = lock.then(async () => {
      const snapshot = { uses: world.code.currentUses, approved: new Map(world.approved) };
      const tx = {
        update: (table: unknown) => ({
          set: (_values: unknown) => ({
            where: async (cond: SQL) => {
              const text = render(cond);
              const params = dialect.sqlToQuery(cond).params;
              if (table === inviteCodes) {
                world.wheres.invite_codes.push(text);
                const guarded = text.includes("`invite_codes`.`currentUses` < `invite_codes`.`maxUses`");
                const activeGuarded = text.includes("`invite_codes`.`isActive` = ?");
                if (guarded && world.code.currentUses >= world.code.maxUses) return [{ affectedRows: 0 }, []];
                if (activeGuarded && !world.code.isActive) return [{ affectedRows: 0 }, []];
                world.code.currentUses += 1;
                return [{ affectedRows: 1 }, []];
              }
              if (table === users) {
                world.wheres.users.push(text);
                const id = Number(params[0]);
                const guarded = text.includes("`users`.`approved` = ?");
                if (guarded && world.approved.get(id)) return [{ affectedRows: 0 }, []];
                world.approved.set(id, true);
                return [{ affectedRows: 1 }, []];
              }
              throw new Error("unexpected table");
            },
          }),
        }),
      };
      try {
        return await callback(tx);
      } catch (error) {
        world.code.currentUses = snapshot.uses;
        world.approved = snapshot.approved;
        throw error;
      }
    });
    lock = run.catch(() => undefined);
    return run;
  });
}

beforeEach(() => {
  mockGetDb.mockReset();
  mockWithTransaction.mockReset();
});

describe("redeemInviteCode — the guarded writes decide (#2373)", () => {
  it("CONTROL — a free code approves the person and spends one use", async () => {
    const world = makeWorld({ maxUses: 3 });
    install(world);

    await expect(redeemInviteCode(11, " drape-last ")).resolves.toEqual({ success: true });
    expect(world.code.currentUses).toBe(1);
    expect(world.approved.get(11)).toBe(true);
  });

  it("AT THE WIRE — the increment's WHERE carries the limit, active and expiry guards; the approval's carries approved = false", async () => {
    const world = makeWorld({ maxUses: 3 });
    install(world);
    await redeemInviteCode(11, "DRAPE-LAST");

    const [spend] = world.wheres.invite_codes;
    expect(spend).toContain("`invite_codes`.`id` = ?");
    expect(spend).toContain("`invite_codes`.`isActive` = ?");
    expect(spend).toContain("`invite_codes`.`expiresAt` is null");
    expect(spend).toContain("`invite_codes`.`expiresAt` > ?");
    expect(spend).toContain("`invite_codes`.`currentUses` < `invite_codes`.`maxUses`");
    const [approve] = world.wheres.users;
    expect(approve).toContain("`users`.`id` = ?");
    expect(approve).toContain("`users`.`approved` = ?");
  });

  it("an increment that changed NO row refuses, and the person is NOT approved", async () => {
    /* The pre-read sees a free use; by the time the write takes the lock the
       last use is gone. Staged by spending it inside the transaction's gate. */
    const world = makeWorld({ maxUses: 1 });
    install(world);
    const original = mockWithTransaction.getMockImplementation()!;
    mockWithTransaction.mockImplementation(async (cb: never) => {
      world.code.currentUses = 1; // someone else's redeem landed first
      return original(cb);
    });

    await expect(redeemInviteCode(11, "DRAPE-LAST")).resolves.toEqual({ success: false, error: USED_UP });
    expect(world.approved.get(11)).not.toBe(true);
    expect(world.code.currentUses).toBe(1);
  });

  it("THE RACE — two people redeem a one-use code at once: exactly one is let in, and the counter reads 1", async () => {
    const world = makeWorld({ maxUses: 1 }, 2);
    install(world);

    const [a, b] = await Promise.all([
      redeemInviteCode(21, "DRAPE-LAST"),
      redeemInviteCode(22, "DRAPE-LAST"),
    ]);

    const outcomes = [a, b];
    expect(outcomes.filter((r) => r.success)).toHaveLength(1);
    expect(outcomes.filter((r) => !r.success)).toEqual([{ success: false, error: USED_UP }]);
    expect(world.code.currentUses).toBe(1);
    expect([21, 22].filter((id) => world.approved.get(id))).toHaveLength(1);
  });

  it("ONE PERSON RACING THEMSELVES on a two-use code spends one use, not two", async () => {
    const world = makeWorld({ maxUses: 2 }, 2);
    install(world);

    const outcomes = await Promise.all([
      redeemInviteCode(31, "DRAPE-LAST"),
      redeemInviteCode(31, "DRAPE-LAST"),
    ]);

    expect(outcomes.filter((r) => r.success)).toHaveLength(1);
    expect(outcomes.filter((r) => !r.success)).toEqual([{ success: false, error: ALREADY_APPROVED }]);
    /* The refused approval rolled its own increment back. */
    expect(world.code.currentUses).toBe(1);
  });

  it("a code deactivated between the read and the write admits nobody", async () => {
    const world = makeWorld({ maxUses: 5 });
    install(world);
    const original = mockWithTransaction.getMockImplementation()!;
    mockWithTransaction.mockImplementation(async (cb: never) => {
      world.code.isActive = false; // an admin pressed Deactivate in between
      return original(cb);
    });

    const result = await redeemInviteCode(41, "DRAPE-LAST");
    expect(result.success).toBe(false);
    expect(world.approved.get(41)).not.toBe(true);
    expect(world.code.currentUses).toBe(0);
  });
});
