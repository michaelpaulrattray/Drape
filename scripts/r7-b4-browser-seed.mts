import 'dotenv/config';
import mysql from 'mysql2/promise';
import { bootstrapModelSnapshot } from '../server/casting/snapshotBootstrap';
import { getDb } from '../server/db/connection';

const DATABASE_URL = process.env.DATABASE_URL;
const APP_ID = process.env.VITE_APP_ID ?? '';
const FIXTURE_NAME = 'R7-B4 Verify Cast';
const BOARD_NAME = 'R7-B4 Verify Board';
const OPEN_ID = 'verify-bot-local';

if (!DATABASE_URL) throw new Error('DATABASE_URL is required');
if (APP_ID.toLowerCase().includes('production')) {
  throw new Error('Refusing to seed browser verification under a production app id');
}
const parsed = new URL(DATABASE_URL);
const databaseName = parsed.pathname.replace(/^\//, '');
if (
  parsed.protocol !== 'mysql:'
  || (
    databaseName !== 'railway'
    && !/^drape_r7_b4_browser_[0-9]+_[a-f0-9]{6}$/.test(databaseName)
  )
) {
  throw new Error('Browser verification requires the guarded Railway development MySQL database');
}

const connection = await mysql.createConnection(DATABASE_URL);

async function fixtureUserId(): Promise<number> {
  await connection.execute(
    `INSERT INTO users
       (openId, name, displayName, role, approved, approvedAt, emailVerified, authProvider, canvasIntroSeen)
     VALUES (?, 'Verify Bot', 'Verify Bot', 'user', 1, NOW(), 1, 'email', 1)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       displayName = VALUES(displayName),
       approved = 1,
       approvedAt = COALESCE(approvedAt, NOW()),
       emailVerified = 1,
       canvasIntroSeen = 1`,
    [OPEN_ID],
  );
  const [rows] = await connection.query<mysql.RowDataPacket[]>(
    'SELECT id FROM users WHERE openId = ? LIMIT 1',
    [OPEN_ID],
  );
  if (!rows[0]) throw new Error('Verify Bot user was not created');
  return Number(rows[0].id);
}

async function cleanup(userId: number) {
  const [models] = await connection.query<mysql.RowDataPacket[]>(
    'SELECT id FROM models WHERE userId = ? AND masterPrompt = ?',
    [userId, 'R7-B4 browser verification prompt'],
  );
  const modelIds = models.map((row) => Number(row.id));
  const [boards] = await connection.query<mysql.RowDataPacket[]>(
    'SELECT id FROM boards WHERE userId = ? AND name = ?',
    [userId, BOARD_NAME],
  );
  const boardIds = boards.map((row) => Number(row.id));

  if (boardIds.length > 0) {
    const marks = boardIds.map(() => '?').join(',');
    const [items] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT id FROM board_items WHERE boardId IN (${marks})`,
      boardIds,
    );
    const itemIds = items.map((row) => Number(row.id));
    if (itemIds.length > 0) {
      const itemMarks = itemIds.map(() => '?').join(',');
      await connection.execute(
        `DELETE FROM board_edges WHERE sourceItemId IN (${itemMarks}) OR targetItemId IN (${itemMarks})`,
        [...itemIds, ...itemIds],
      );
      await connection.execute(`DELETE FROM board_item_versions WHERE itemId IN (${itemMarks})`, itemIds);
      await connection.execute(`DELETE FROM board_items WHERE id IN (${itemMarks})`, itemIds);
    }
    await connection.execute(`DELETE FROM boards WHERE id IN (${marks})`, boardIds);
  }

  if (modelIds.length > 0) {
    const marks = modelIds.map(() => '?').join(',');
    const [snapshotTables] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT TABLE_NAME
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN (
           'model_package_snapshot_slots',
           'model_package_snapshots',
           'model_identity_snapshots'
         )`,
    );
    const existing = new Set(snapshotTables.map((row) => String(row.TABLE_NAME)));
    if (existing.has('model_package_snapshot_slots') && existing.has('model_package_snapshots')) {
      await connection.execute(
        `DELETE FROM model_package_snapshot_slots
         WHERE packageSnapshotId IN (
           SELECT id FROM model_package_snapshots WHERE modelId IN (${marks})
         )`,
        modelIds,
      );
    }
    if (existing.has('model_package_snapshots')) {
      await connection.execute(`DELETE FROM model_package_snapshots WHERE modelId IN (${marks})`, modelIds);
    }
    if (existing.has('model_identity_snapshots')) {
      await connection.execute(`DELETE FROM model_identity_snapshots WHERE modelId IN (${marks})`, modelIds);
    }
    await connection.execute(`DELETE FROM model_assets WHERE modelId IN (${marks})`, modelIds);
    await connection.execute(`DELETE FROM models WHERE id IN (${marks})`, modelIds);
  }
}

const userId = await fixtureUserId();
await cleanup(userId);

if (process.argv.includes('--cleanup')) {
  await connection.end();
  console.log(JSON.stringify({ cleaned: true, userId }));
  process.exit(0);
}

const agencyId = `MOD-26-${Date.now().toString(16).toUpperCase().slice(-6)}`;
const [modelInsert] = await connection.execute<mysql.ResultSetHeader>(
  `INSERT INTO models
     (userId, agencyId, name, masterPrompt, technicalSchema, preferences, status, mintedAt)
   VALUES (?, ?, ?, ?, ?, ?, 'active', NOW())`,
  [
    userId,
    agencyId,
    FIXTURE_NAME,
    'R7-B4 browser verification prompt',
    JSON.stringify({ gender: 'editorial', age: '30' }),
    JSON.stringify({ gender: 'editorial', age: '30' }),
  ],
);
const modelId = Number(modelInsert.insertId);

const svg = (label: string, color: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="100%" height="100%" fill="${color}"/><text x="20" y="200" fill="white" font-size="24">${label}</text></svg>`,
  )}`;
const urls = {
  frontClose: svg('frontClose', '#111111'),
  frontFull: svg('frontFull', '#444444'),
  sideClose: svg('sideClose', '#777777'),
};
for (const [viewType, storageUrl] of Object.entries(urls)) {
  await connection.execute(
    `INSERT INTO model_assets
       (modelId, viewType, resolution, storageUrl, pointsCost, pinned, status, provenance)
     VALUES (?, ?, '1K', ?, 0, 0, NULL, NULL)`,
    [modelId, viewType, storageUrl],
  );
}

const bootstrap = await bootstrapModelSnapshot({ userId, modelId });
if (bootstrap.status === 'headless') throw new Error('Browser verification fixture unexpectedly bootstrapped headless');

const [boardInsert] = await connection.execute<mysql.ResultSetHeader>(
  `INSERT INTO boards (userId, name, startedWith, status, viewportX, viewportY, viewportZoom)
   VALUES (?, ?, 'casting', 'active', 0, 0, 100)`,
  [userId, BOARD_NAME],
);
const boardId = Number(boardInsert.insertId);
const [itemInsert] = await connection.execute<mysql.ResultSetHeader>(
  `INSERT INTO board_items
     (boardId, type, kind, label, imageUrl, positionX, positionY, width, height, zIndex, sourceModelId, metadata)
   VALUES (?, 'model', 'cast_config', ?, ?, 80, 80, 280, 420, 1, ?, ?)`,
  [
    boardId,
    FIXTURE_NAME,
    urls.frontClose,
    modelId,
    JSON.stringify({
      provenance: {
        type: 'library_cast',
        modelId,
        viewAngle: 'frontClose',
      },
    }),
  ],
);

await connection.end();
const db = await getDb();
await db?.$client.end();
console.log(JSON.stringify({
  userId,
  modelId,
  boardId,
  itemId: Number(itemInsert.insertId),
  agencyId,
  name: FIXTURE_NAME,
}));
