/**
 * CAMPAIGNS AGAINST A REAL DATABASE (migration 0080; card #2249).
 *
 * The route suite (`server/castCampaignsRoute.test.ts`) proves the doors —
 * which inputs are refused, which refusal each outcome becomes. This file
 * proves the STATEMENTS, which is the only place owner isolation can actually
 * be shown: a second account, driven through the real router, gets
 * `NOT_FOUND` rather than somebody else's campaign, and every write re-anchors
 * its child ids to the owner by itself.
 *
 * Skips unless TEST_DATABASE_URL points at a disposable database. Run it with
 * `npx tsx scripts/drive-casting-v2-segment-store-disposable.mts --suite
 * server/castCampaigns-db.test.ts`, which creates one, replays the
 * migrations into it, runs this file, and drops it.
 */
import { randomUUID } from "node:crypto";
import mysql, { type Connection, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/* The database is a hosted one across the network; 5s is a local-disk number. */
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase("campaigns (disposable DB)", () => {
  let connection: Connection;
  let owner: number;
  let stranger: number;
  let store: typeof import("./db/castCampaigns");
  let castingV2Router: typeof import("./routes/castingV2")["castingV2Router"];

  const customer = (id: number) => ({ id, role: "user", approved: true, suspendedAt: null, lockedUntil: null });
  const callerFor = (id: number) => castingV2Router.createCaller({ user: customer(id) } as never);

  async function newUser(name: string): Promise<number> {
    const [row] = await connection.execute<ResultSetHeader>(
      "INSERT INTO users (openId, name, approved, emailVerified) VALUES (?, ?, 1, 1)",
      [`campaign-${randomUUID()}`, name],
    );
    return row.insertId;
  }

  /** A models row in the shape the roster draws, or deliberately not. */
  async function newCast(userId: number, shape: "signed" | "unsigned" | "deleted" = "signed"): Promise<string> {
    const agencyId = `KI-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
    await connection.execute(
      "INSERT INTO models (userId, agencyId, name, masterPrompt, technicalSchema, preferences, status, sourceCandidateId, deletedAt)"
        + " VALUES (?, ?, 'A cast', 'prompt', '{}', '{}', ?, ?, ?)",
      [
        userId,
        agencyId,
        shape === "unsigned" ? "draft" : "active",
        shape === "unsigned" ? null : 1,
        shape === "deleted" ? new Date() : null,
      ],
    );
    return agencyId;
  }

  async function memberRows(campaignId: string): Promise<number> {
    const [rows] = await connection.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM cast_campaign_members m JOIN cast_campaigns c ON c.id = m.campaignId WHERE c.publicId = ?",
      [campaignId],
    );
    return Number(rows[0].n);
  }

  async function liveModelRows(agencyIds: string[]): Promise<number> {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM models WHERE agencyId IN (?) AND deletedAt IS NULL",
      [agencyIds],
    );
    return Number(rows[0].n);
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl!;
    process.env.CASTING_V2_SCOPE = "all";
    connection = await mysql.createConnection(testDatabaseUrl!);
    const [tables] = await connection.query<RowDataPacket[]>("SHOW TABLES LIKE 'cast_campaign%'");
    if (tables.length !== 2) {
      throw new Error("Disposable database must have migration 0080 applied");
    }
    owner = await newUser("Campaign Owner");
    stranger = await newUser("Campaign Stranger");
    store = await import("./db/castCampaigns");
    ({ castingV2Router } = await import("./routes/castingV2"));
  });

  afterAll(async () => {
    await connection?.end();
  });

  it("creates, lists oldest first with a derived count, and never hands out an internal id", async () => {
    const caller = callerFor(owner);
    const first = await caller.createCampaign({ name: "  Summer drop  " });
    const second = await caller.createCampaign({ name: "Autumn" });
    expect(first).toEqual({ campaignId: expect.stringMatching(/^[0-9a-f]{32}$/), name: "Summer drop", castCount: 0 });

    const listed = await caller.listCampaigns({});
    expect(listed.map((row) => row.name)).toEqual(["Summer drop", "Autumn"]);
    for (const row of listed) expect(Object.keys(row).sort()).toEqual(["campaignId", "castCount", "name"]);
    expect(listed.map((row) => row.campaignId)).toEqual([first.campaignId, second.campaignId]);
  });

  it("⚠ OWNER ISOLATION — a second account gets NOT_FOUND on every door, never the owner's campaign", async () => {
    const mine = await callerFor(owner).createCampaign({ name: `Private ${randomUUID().slice(0, 8)}` });
    const myCast = await newCast(owner);
    await callerFor(owner).addCastsToCampaign({ campaignId: mine.campaignId, castIds: [myCast] });

    const theirs = callerFor(stranger);
    /* POSITIVE CONTROL: the stranger's doors work on the stranger's own campaign,
       so the refusals below are about ownership, not a broken caller. */
    const own = await theirs.createCampaign({ name: "Stranger's own" });
    await expect(theirs.renameCampaign({ campaignId: own.campaignId, name: "Renamed" })).resolves.toBeTruthy();

    expect((await theirs.listCampaigns({})).map((row) => row.campaignId)).not.toContain(mine.campaignId);
    for (const attempt of [
      () => theirs.renameCampaign({ campaignId: mine.campaignId, name: "Stolen" }),
      () => theirs.deleteCampaign({ campaignId: mine.campaignId }),
      () => theirs.addCastsToCampaign({ campaignId: mine.campaignId, castIds: [myCast] }),
      () => theirs.removeCastsFromCampaign({ campaignId: mine.campaignId, castIds: [myCast] }),
    ]) {
      await expect(attempt()).rejects.toMatchObject({ code: "NOT_FOUND", message: "Campaign not found" });
    }

    /* And nothing moved: the owner's campaign kept its name and its member. */
    const after = (await callerFor(owner).listCampaigns({})).find((row) => row.campaignId === mine.campaignId);
    expect(after).toEqual({ campaignId: mine.campaignId, name: mine.name, castCount: 1 });
    expect(await memberRows(mine.campaignId)).toBe(1);
  });

  it("⚠ a CHILD id is re-anchored — the stranger cannot file the owner's cast into the stranger's own campaign", async () => {
    const ownersCast = await newCast(owner);
    const own = await callerFor(stranger).createCampaign({ name: `Mine ${randomUUID().slice(0, 8)}` });
    await expect(callerFor(stranger).addCastsToCampaign({ campaignId: own.campaignId, castIds: [ownersCast] }))
      .rejects.toMatchObject({ code: "NOT_FOUND", message: "Cast not found" });
    expect(await memberRows(own.campaignId)).toBe(0);

    /* The statement itself, below the refusal: the INSERT … SELECT anchors the
       casts to the caller, so even reached directly it files nothing. */
    const strangersCast = await newCast(stranger);
    await expect(store.addCastsToCampaign(stranger, own.campaignId, [strangersCast])).resolves.toEqual({ kind: "added", added: 1 });
    await expect(store.removeCastsFromCampaign(stranger, own.campaignId, [ownersCast])).resolves.toEqual({ kind: "removed", removed: 0 });
    expect(await memberRows(own.campaignId)).toBe(1);
  });

  it("adding the same cast twice is one row", async () => {
    const campaign = await callerFor(owner).createCampaign({ name: `Twice ${randomUUID().slice(0, 8)}` });
    const cast = await newCast(owner);
    const first = await callerFor(owner).addCastsToCampaign({ campaignId: campaign.campaignId, castIds: [cast] });
    const second = await callerFor(owner).addCastsToCampaign({ campaignId: campaign.campaignId, castIds: [cast, cast] });
    expect(first).toEqual({ campaignId: campaign.campaignId, added: 1 });
    expect(second).toEqual({ campaignId: campaign.campaignId, added: 0 });
    expect(await memberRows(campaign.campaignId)).toBe(1);
  });

  it("refuses an unsigned or a deleted cast, all or nothing", async () => {
    const campaign = await callerFor(owner).createCampaign({ name: `Strict ${randomUUID().slice(0, 8)}` });
    const good = await newCast(owner);
    for (const bad of [await newCast(owner, "unsigned"), await newCast(owner, "deleted"), "KI-NEVER-ANYTHING"]) {
      await expect(callerFor(owner).addCastsToCampaign({ campaignId: campaign.campaignId, castIds: [good, bad] }))
        .rejects.toMatchObject({ code: "NOT_FOUND", message: "Cast not found" });
    }
    /* The good cast was not filed alongside the refused one. */
    expect(await memberRows(campaign.campaignId)).toBe(0);
  });

  it("a cast in two campaigns counts in both; a deleted cast drops out of the count", async () => {
    const a = await callerFor(owner).createCampaign({ name: `Both A ${randomUUID().slice(0, 8)}` });
    const b = await callerFor(owner).createCampaign({ name: `Both B ${randomUUID().slice(0, 8)}` });
    const shared = await newCast(owner);
    const later = await newCast(owner);
    await callerFor(owner).addCastsToCampaign({ campaignId: a.campaignId, castIds: [shared, later] });
    await callerFor(owner).addCastsToCampaign({ campaignId: b.campaignId, castIds: [shared] });
    const count = async (id: string) =>
      (await callerFor(owner).listCampaigns({})).find((row) => row.campaignId === id)?.castCount;
    expect(await count(a.campaignId)).toBe(2);
    expect(await count(b.campaignId)).toBe(1);

    await connection.execute("UPDATE models SET deletedAt = NOW() WHERE agencyId = ?", [later]);
    expect(await count(a.campaignId)).toBe(1);
  });

  it("deleting a campaign removes its members and keeps every cast", async () => {
    const campaign = await callerFor(owner).createCampaign({ name: `Gone ${randomUUID().slice(0, 8)}` });
    const casts = [await newCast(owner), await newCast(owner)];
    await callerFor(owner).addCastsToCampaign({ campaignId: campaign.campaignId, castIds: casts });
    expect(await memberRows(campaign.campaignId)).toBe(2);

    await expect(callerFor(owner).deleteCampaign({ campaignId: campaign.campaignId }))
      .resolves.toEqual({ campaignId: campaign.campaignId });
    const [left] = await connection.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM cast_campaign_members m WHERE m.userId = ? AND m.modelId IN (SELECT id FROM models WHERE agencyId IN (?, ?))",
      [owner, casts[0], casts[1]],
    );
    expect(Number(left[0].n)).toBe(0);
    expect(await liveModelRows(casts)).toBe(2);
    /* Gone means gone: a second delete is NOT_FOUND, and the name is free again. */
    await expect(callerFor(owner).deleteCampaign({ campaignId: campaign.campaignId }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(callerFor(owner).createCampaign({ name: campaign.name })).resolves.toMatchObject({ name: campaign.name });
  });

  it("names are unique per customer, not across customers; renaming to its own name is fine", async () => {
    const name = `Shared ${randomUUID().slice(0, 8)}`;
    const mine = await callerFor(owner).createCampaign({ name });
    await expect(callerFor(owner).createCampaign({ name })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(callerFor(stranger).createCampaign({ name })).resolves.toMatchObject({ name });

    const other = await callerFor(owner).createCampaign({ name: `${name} two` });
    await expect(callerFor(owner).renameCampaign({ campaignId: other.campaignId, name }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    await expect(callerFor(owner).renameCampaign({ campaignId: mine.campaignId, name }))
      .resolves.toEqual({ campaignId: mine.campaignId, name });
  });

  it("removing takes a cast out and leaves the cast alone", async () => {
    const campaign = await callerFor(owner).createCampaign({ name: `Out ${randomUUID().slice(0, 8)}` });
    const [keep, drop] = [await newCast(owner), await newCast(owner)];
    await callerFor(owner).addCastsToCampaign({ campaignId: campaign.campaignId, castIds: [keep, drop] });
    await expect(callerFor(owner).removeCastsFromCampaign({ campaignId: campaign.campaignId, castIds: [drop] }))
      .resolves.toEqual({ campaignId: campaign.campaignId, removed: 1 });
    expect(await memberRows(campaign.campaignId)).toBe(1);
    expect(await liveModelRows([keep, drop])).toBe(2);
  });
  it("the cast page's read (#2252) lists the campaigns ONE cast is in, oldest first, and nothing else", async () => {
    const tag = randomUUID().slice(0, 8);
    const first = await callerFor(owner).createCampaign({ name: `Page A ${tag}` });
    const second = await callerFor(owner).createCampaign({ name: `Page B ${tag}` });
    const notThisOne = await callerFor(owner).createCampaign({ name: `Page C ${tag}` });
    const cast = await newCast(owner);
    const neighbour = await newCast(owner);
    await callerFor(owner).addCastsToCampaign({ campaignId: second.campaignId, castIds: [cast] });
    await callerFor(owner).addCastsToCampaign({ campaignId: first.campaignId, castIds: [cast, neighbour] });
    await callerFor(owner).addCastsToCampaign({ campaignId: notThisOne.campaignId, castIds: [neighbour] });

    const listed = await callerFor(owner).listCastCampaigns({ castId: cast });
    expect(listed).toEqual([
      { campaignId: first.campaignId, name: first.name },
      { campaignId: second.campaignId, name: second.name },
    ]);
    /* And it follows a removal at once — the panel and the library are one store. */
    await callerFor(owner).removeCastsFromCampaign({ campaignId: second.campaignId, castIds: [cast] });
    expect((await callerFor(owner).listCastCampaigns({ castId: cast })).map((row) => row.campaignId))
      .toEqual([first.campaignId]);
    /* A cast filed nowhere reads an empty list. */
    expect(await callerFor(owner).listCastCampaigns({ castId: await newCast(owner) })).toEqual([]);
  });

  it("⚠ OWNER ISOLATION on the cast page's read — another account's cast id answers an empty list", async () => {
    const tag = randomUUID().slice(0, 8);
    const ownersCampaign = await callerFor(owner).createCampaign({ name: `Iso ${tag}` });
    const ownersCast = await newCast(owner);
    await callerFor(owner).addCastsToCampaign({ campaignId: ownersCampaign.campaignId, castIds: [ownersCast] });

    /* POSITIVE CONTROL: the stranger's own filed cast is listed for the stranger. */
    const strangersCampaign = await callerFor(stranger).createCampaign({ name: `Iso own ${tag}` });
    const strangersCast = await newCast(stranger);
    await callerFor(stranger).addCastsToCampaign({ campaignId: strangersCampaign.campaignId, castIds: [strangersCast] });
    expect(await callerFor(stranger).listCastCampaigns({ castId: strangersCast }))
      .toEqual([{ campaignId: strangersCampaign.campaignId, name: strangersCampaign.name }]);

    expect(await callerFor(stranger).listCastCampaigns({ castId: ownersCast })).toEqual([]);

    /*
      A member row no door can write — the stranger's campaign holding the
      OWNER's cast, planted by hand — is still invisible from both sides: the
      stranger fails the cast's owner clause, and the owner fails the
      campaign's and the member's.
    */
    await connection.execute(
      "INSERT INTO cast_campaign_members (campaignId, modelId, userId)"
        + " SELECT c.id, m.id, ? FROM cast_campaigns c JOIN models m ON m.agencyId = ? WHERE c.publicId = ?",
      [stranger, ownersCast, strangersCampaign.campaignId],
    );
    expect(await callerFor(stranger).listCastCampaigns({ castId: ownersCast })).toEqual([]);
    expect(await callerFor(owner).listCastCampaigns({ castId: ownersCast }))
      .toEqual([{ campaignId: ownersCampaign.campaignId, name: ownersCampaign.name }]);

    /*
      Two more hand-planted rows, one per remaining owner clause, so each of
      the three is the ONLY thing standing between a row and the answer:
      - a row stamped with the OWNER's id inside the STRANGER's campaign — only
        the campaign's owner clause keeps the stranger's campaign name out;
      - a row stamped with the STRANGER's id inside another of the OWNER's
        campaigns — only the member's owner clause keeps a row the owner never
        wrote out of the owner's answer.
    */
    const strangersOther = await callerFor(stranger).createCampaign({ name: `Iso other ${tag}` });
    const ownersOther = await callerFor(owner).createCampaign({ name: `Iso planted ${tag}` });
    await connection.execute(
      "INSERT INTO cast_campaign_members (campaignId, modelId, userId)"
        + " SELECT c.id, m.id, ? FROM cast_campaigns c JOIN models m ON m.agencyId = ? WHERE c.publicId = ?",
      [owner, ownersCast, strangersOther.campaignId],
    );
    await connection.execute(
      "INSERT INTO cast_campaign_members (campaignId, modelId, userId)"
        + " SELECT c.id, m.id, ? FROM cast_campaigns c JOIN models m ON m.agencyId = ? WHERE c.publicId = ?",
      [stranger, ownersCast, ownersOther.campaignId],
    );
    expect(await callerFor(owner).listCastCampaigns({ castId: ownersCast }))
      .toEqual([{ campaignId: ownersCampaign.campaignId, name: ownersCampaign.name }]);
  });

  it("a deleted cast is in no campaign as far as the page is concerned", async () => {
    const campaign = await callerFor(owner).createCampaign({ name: `Del ${randomUUID().slice(0, 8)}` });
    const cast = await newCast(owner);
    await callerFor(owner).addCastsToCampaign({ campaignId: campaign.campaignId, castIds: [cast] });
    expect(await callerFor(owner).listCastCampaigns({ castId: cast })).toHaveLength(1);
    await connection.execute("UPDATE models SET deletedAt = NOW() WHERE agencyId = ?", [cast]);
    expect(await callerFor(owner).listCastCampaigns({ castId: cast })).toEqual([]);
  });
});
