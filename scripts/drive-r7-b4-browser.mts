/** Guarded real-app browser gate for R7-7B4 selected-package consumers. */
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import mysql from 'mysql2/promise';

const PREFIX = 'drape_r7_b4_browser_';
const PORT = 3017;

async function applyMigrations(connection: mysql.Connection) {
  const files = (await readdir('drizzle'))
    .filter((file) => /^\d{4}_.+\.sql$/.test(file) && Number(file.slice(0, 4)) <= 10)
    .sort();
  for (const file of files) {
    const sql = await readFile(`drizzle/${file}`, 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim()) await connection.query(statement);
    }
    console.log(`[browser-disposable] applied ${file}`);
  }
}

function runTsx(script: string, args: string[], env: NodeJS.ProcessEnv, capture = false) {
  const command = ['pnpm.cmd', 'exec', 'tsx', script, ...args].join(' ');
  const result = spawnSync('cmd.exe', ['/d', '/s', '/c', command], {
    env,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: capture ? 'utf8' : undefined,
  });
  if (result.status !== 0) {
    const detail = capture ? `\n${String(result.stderr || result.stdout)}` : '';
    throw new Error(`${script} failed with exit ${result.status}${detail}`);
  }
  return capture ? String(result.stdout) : '';
}

async function waitForHealth(baseUrl: string, dev: ChildProcess, logs: string[]) {
  // A cold Windows/pnpm/tsx start on this machine can spend over a minute
  // loading the server graph even though the child remains healthy.
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (dev.exitCode !== null) {
      throw new Error(`Dev server exited ${dev.exitCode}\n${logs.slice(-20).join('')}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Vite/server startup is still in progress.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Dev server did not become healthy\n${logs.slice(-20).join('')}`);
}

async function dropDatabase(serverUrl: URL, databaseName: string, safeName: RegExp) {
  if (!safeName.test(databaseName)) throw new Error('Cleanup guard refused database name');
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    let cleanup: mysql.Connection | undefined;
    try {
      cleanup = await mysql.createConnection({
        uri: serverUrl.toString(),
        connectTimeout: 15_000,
        enableKeepAlive: true,
      });
      await cleanup.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
      console.log(`[browser-disposable] dropped ${databaseName}`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    } finally {
      await cleanup?.end().catch(() => undefined);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Browser disposable cleanup failed');
}

async function main() {
  if (process.argv.length !== 2) throw new Error('This browser gate accepts no arguments');
  const configured = process.env.DATABASE_URL;
  const appId = process.env.VITE_APP_ID ?? '';
  if (!configured) throw new Error('DATABASE_URL is required (development DB only)');
  if (appId.toLowerCase().includes('production')) {
    throw new Error('Refusing browser verification under a production app id');
  }
  const sourceUrl = new URL(configured);
  if (sourceUrl.protocol !== 'mysql:' || sourceUrl.pathname.replace(/^\//, '') !== 'railway') {
    throw new Error('Refusing: configured development URL must target the railway MySQL database');
  }

  const databaseName = `${PREFIX}${Date.now()}_${randomBytes(3).toString('hex')}`;
  const safeName = new RegExp(`^${PREFIX}[0-9]+_[a-f0-9]{6}$`);
  if (!safeName.test(databaseName)) throw new Error('Unsafe browser disposable database name');
  const serverUrl = new URL(sourceUrl);
  serverUrl.pathname = '/';
  const testUrl = new URL(sourceUrl);
  testUrl.pathname = `/${databaseName}`;

  const admin = await mysql.createConnection({ uri: serverUrl.toString(), connectTimeout: 15_000 });
  let created = false;
  let dev: ChildProcess | undefined;
  const logs: string[] = [];
  try {
    const [databaseRows] = await admin.query('SHOW DATABASES');
    const stale = (databaseRows as Array<Record<string, string>>)
      .flatMap((row) => Object.values(row))
      .filter((name) => name.startsWith(PREFIX));
    if (stale.length > 0) {
      throw new Error(`Refusing: stale browser databases require review (${stale.join(', ')})`);
    }

    await admin.query(`CREATE DATABASE \`${databaseName}\``);
    created = true;
    console.log(`[browser-disposable] created ${databaseName} on ${sourceUrl.host}`);
    const migrated = await mysql.createConnection({ uri: testUrl.toString(), connectTimeout: 15_000 });
    try {
      await applyMigrations(migrated);
    } finally {
      await migrated.end();
    }

    const env = {
      ...process.env,
      DATABASE_URL: testUrl.toString(),
      PORT: String(PORT),
    };
    const seedOutput = runTsx('scripts/r7-b4-browser-seed.mts', [], env, true);
    const seedLine = seedOutput.trim().split(/\r?\n/).at(-1);
    const fixture = JSON.parse(seedLine ?? '{}') as {
      userId?: number;
      modelId?: number;
      boardId?: number;
    };
    if (!fixture.userId || !fixture.modelId || !fixture.boardId) {
      throw new Error(`Fixture output was incomplete: ${seedLine}`);
    }

    const baseUrl = `http://localhost:${PORT}`;
    dev = spawn('cmd.exe', ['/d', '/s', '/c', 'pnpm.cmd dev'], {
      cwd: process.cwd(),
      env: {
        ...env,
        R7_SNAPSHOT_READ_SCOPE: `users:${fixture.userId}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    dev.stdout?.on('data', (chunk) => logs.push(String(chunk)));
    dev.stderr?.on('data', (chunk) => logs.push(String(chunk)));
    await waitForHealth(baseUrl, dev, logs);

    runTsx(
      'scripts/r7-b4-browser-drive.mts',
      [String(fixture.modelId), String(fixture.boardId)],
      { ...env, VERIFY_BASE_URL: baseUrl },
    );
    console.log('[browser-disposable] R7-7B4 two-tab, Profile, chooser and Canvas drive passed');
  } catch (error) {
    if (dev) {
      console.error('[browser-disposable] dev tail:', logs.slice(-30).join(''));
    }
    throw error;
  } finally {
    if (dev?.pid) {
      spawnSync('taskkill.exe', ['/pid', String(dev.pid), '/t', '/f'], { stdio: 'ignore' });
    }
    await admin.end().catch(() => undefined);
    if (created) await dropDatabase(serverUrl, databaseName, safeName);
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error('[browser-disposable] failed:', error);
    process.exit(1);
  },
);
