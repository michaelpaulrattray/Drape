/**
 * THE ROSTER'S SCOPES, SEARCH AND PAGES AGAINST A REAL DATABASE (card #2250).
 *
 * The route suite (`server/castingRosterRoute.test.ts`) proves the door. This
 * file proves the STATEMENTS, driven through the real router:
 *
 *  - Unfiled is a correlated `NOT EXISTS`, and a mis-bound correlation (#119's
 *    measured drizzle defect) reads as every cast filed or none — so the arms
 *    below hold one filed and one unfiled cast side by side;
 *  - a cast in two campaigns appears under both;
 *  - ⚠ owner isolation on both sides of the member join — a forged member row
 *    pointing across accounts moves nothing, and somebody else's campaign or
 *    cursor is NOT_FOUND;
 *  - ⚠ the sixty-first cast is reachable, and search finds a cast that is not
 *    on the first page — the brief's named refusal is search that only
 *    searches what has loaded;
 *  - LIKE's own wildcards in what the customer typed are matched literally.
 *
 * Skips unless TEST_DATABASE_URL points at a disposable database. Run it with
 * `npx tsx scripts/drive-casting-v2-segment-store-disposable.mts --suite
 * server/castingRoster-db.test.ts`.
 */
import { randomUUID } from "node:crypto";
import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("roster scopes (disposable DB)", () => {
  let connection: Connection;
  let castingV2Router: typeof import("./routes/castingV2")["castingV2Router"];

  const customer = (id: number) => ({ id, role: "user", approved: true, suspendedAt: null, lockedUntil: null });
  const callerFor = (id: number) => castingV2Router.createCaller({ user: customer(id) } as never);

  async function newUser(name: string): Promise<number> {
    const [row] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, ?, 1, 1)",
      [`roster-${randomUUID()}`, name],
    );
    return row.insertId;
  }

  /** A signed, live cast in the roster's shape, named `name`. Returns its public id. */
  async function newCast(userId: number, name: string): Promise<string> {
    const agencyId = `KI-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
    await connection.execute(
      "INSERT INTO models (userId, agencyId, name, masterPrompt, technicalSchema, preferences, status, sourceCandidateId)"
        + " VALUES (?, ?, ?, 'prompt', '{}', '{}', 'active', 1)",
      [userId, agencyId, name],
    );
    return agencyId;
  }

  async function internalId(agencyId: string): Promise<number> {
    const [rows] = await connection.execute<RowDataPacket[]>("SELECT id FROM models WHERE agencyId = ?", [agencyId]);
    return Number(rows[0].id);
  }

  const ids = (casts: Array<{ castId: string }>) => casts.map((cast) => cast.castId);

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl!;
    process.env.CASTING_V2_SCOPE = "all";
    connection = await mysql.createConnection(testDatabaseUrl!);
    const [tables] = await connection.query<RowDataPacket[]>("SHOW TABLES LIKE 'cast_campaign%'");
    if (tables.length !== 2) throw new Error("Disposable database must have migration 0080 applied");
    ({ castingV2Router } = await import("./routes/castingV2"));
  });

  afterAll(async () => {
    await connection?.end();
  });

  it("All, Unfiled and a campaign, side by side — and a cast in two campaigns is in both", async () => {
    const owner = await newUser("Roster Owner");
    const call = callerFor(owner);
    const filedTwice = await newCast(owner, "Ines");
    const filedOnce = await newCast(owner, "Jericho");
    const unfiled = await newCast(owner, "Kit");
    const summer = await call.createCampaign({ name: "Summer" });
    const autumn = await call.createCampaign({ name: "Autumn" });
    await call.addCastsToCampaign({ campaignId: summer.campaignId, castIds: [filedTwice, filedOnce] });
    await call.addCastsToCampaign({ campaignId: autumn.campaignId, castIds: [filedTwice] });

    expect(ids(await call.roster({}))).toEqual([unfiled, filedOnce, filedTwice]);
    expect(ids(await call.roster({ scope: "all" }))).toEqual([unfiled, filedOnce, filedTwice]);
    /* POSITIVE AND NEGATIVE in one list: the unfiled cast is there and the two
       filed ones are not. A correlation bound to the member row's own id
       would return all three or none. */
    expect(ids(await call.roster({ scope: "unfiled" }))).toEqual([unfiled]);
    expect(ids(await call.roster({ scope: "campaign", campaignId: summer.campaignId }))).toEqual([filedOnce, filedTwice]);
    expect(ids(await call.roster({ scope: "campaign", campaignId: autumn.campaignId }))).toEqual([filedTwice]);

    expect(await call.rosterCounts({})).toEqual({ all: 3, unfiled: 1, matching: 3 });
    expect(await call.rosterCounts({ scope: "unfiled" })).toEqual({ all: 3, unfiled: 1, matching: 1 });
    expect(await call.rosterCounts({ scope: "campaign", campaignId: summer.campaignId }))
      .toEqual({ all: 3, unfiled: 1, matching: 2 });

    /* Taking the last cast out of every campaign makes it Unfiled again. */
    await call.removeCastsFromCampaign({ campaignId: summer.campaignId, castIds: [filedOnce] });
    expect(ids(await call.roster({ scope: "unfiled" }))).toEqual([unfiled, filedOnce]);
  });

  it("search is case-insensitive, scoped to the chip, and matches wildcards literally", async () => {
    const owner = await newUser("Search Owner");
    const call = callerFor(owner);
    const ines = await newCast(owner, "Ines Moreau");
    const inesToo = await newCast(owner, "INESSA");
    const percent = await newCast(owner, "50% Off");
    const digits = await newCast(owner, "5000");
    const campaign = await call.createCampaign({ name: "Only Ines" });
    await call.addCastsToCampaign({ campaignId: campaign.campaignId, castIds: [ines] });

    expect(ids(await call.roster({ search: "ines" }))).toEqual([inesToo, ines]);
    expect(ids(await call.roster({ scope: "campaign", campaignId: campaign.campaignId, search: "ines" }))).toEqual([ines]);
    expect(ids(await call.roster({ scope: "unfiled", search: "ines" }))).toEqual([inesToo]);
    expect(ids(await call.roster({ search: "50%" }))).toEqual([percent]);
    expect(ids(await call.roster({ search: "5_0" }))).toEqual([]);
    expect(ids(await call.roster({ search: "500" }))).toEqual([digits]);
    expect(await call.rosterCounts({ scope: "unfiled", search: "ines" })).toEqual({ all: 4, unfiled: 3, matching: 1 });
  });

  it("⚠ the sixty-first cast is reachable, and search finds a cast past the first page", async () => {
    const owner = await newUser("Big Roster");
    const call = callerFor(owner);
    /* The OLDEST cast — the one the old cap of sixty hid — carries the name. */
    const oldest = await newCast(owner, "Zelda");
    const rest: string[] = [];
    for (let index = 0; index < 64; index += 1) rest.push(await newCast(owner, `Cast ${index}`));

    const first = await call.roster({});
    expect(first).toHaveLength(60);
    expect(ids(first)).not.toContain(oldest);
    const second = await call.roster({ cursor: first[first.length - 1].castId });
    expect(second).toHaveLength(5);
    expect(ids(second)).toContain(oldest);
    /* Every cast exactly once, in order, across the two pages. */
    expect([...ids(first), ...ids(second)]).toEqual([...rest].reverse().concat(oldest));
    expect((await call.rosterCounts({})).all).toBe(65);

    /* The search reaches it on the FIRST page, because it is a query and not a filter over what loaded. */
    expect(ids(await call.roster({ search: "zelda" }))).toEqual([oldest]);
  });

  it("⚠ OWNER ISOLATION — another account's campaign and cursor are NOT_FOUND; a forged member row moves nothing", async () => {
    const owner = await newUser("Isolated Owner");
    const stranger = await newUser("Stranger");
    const ownerCast = await newCast(owner, "Mine");
    const strangerCast = await newCast(stranger, "Theirs");
    const strangers = await callerFor(stranger).createCampaign({ name: "Theirs" });
    await callerFor(stranger).addCastsToCampaign({ campaignId: strangers.campaignId, castIds: [strangerCast] });
    /* POSITIVE CONTROL: the stranger's own scope works for the stranger. */
    expect(ids(await callerFor(stranger).roster({ scope: "campaign", campaignId: strangers.campaignId }))).toEqual([strangerCast]);

    const call = callerFor(owner);
    await expect(call.roster({ scope: "campaign", campaignId: strangers.campaignId }))
      .rejects.toMatchObject({ code: "NOT_FOUND", message: "Campaign not found" });
    await expect(call.rosterCounts({ scope: "campaign", campaignId: strangers.campaignId }))
      .rejects.toMatchObject({ code: "NOT_FOUND", message: "Campaign not found" });
    await expect(call.roster({ cursor: strangerCast })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(ids(await call.roster({}))).toEqual([ownerCast]);

    /* Forged rows the doors would never write: the owner's cast "filed" by the
       stranger, and "filed" into the stranger's campaign under the owner's id. */
    const [campaignRow] = await connection.execute<RowDataPacket[]>(
      "SELECT id FROM cast_campaigns WHERE publicId = ?",
      [strangers.campaignId],
    );
    const ownerModel = await internalId(ownerCast);
    await connection.execute(
      "INSERT INTO cast_campaign_members (campaignId, modelId, userId) VALUES (?, ?, ?)",
      [campaignRow[0].id, ownerModel, stranger],
    );
    /* A stranger's member row is not the owner's filing: still Unfiled. */
    expect(ids(await call.roster({ scope: "unfiled" }))).toEqual([ownerCast]);
    /* And the stranger's campaign does not draw the owner's cast. */
    expect(ids(await callerFor(stranger).roster({ scope: "campaign", campaignId: strangers.campaignId }))).toEqual([strangerCast]);
    expect(ids(await callerFor(stranger).roster({}))).toEqual([strangerCast]);
  });
});
