import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSheetTiles, type SheetSlotState } from '../client/src/features/boards/canvas/nodes/useSheetController';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('R7-7B4 live selected-package consumer closure', () => {
  it('renders the Canvas root and comp card from packageState slots', () => {
    const controller = source('client/src/features/boards/canvas/nodes/useSheetController.ts');
    const node = source('client/src/features/boards/canvas/nodes/CastNode.tsx');
    const board = source('client/src/features/boards/BoardPage.tsx');

    expect(controller).toContain('trpc.generation.packageState.useQuery');
    expect(controller).toContain('const slots = (packageQuery.data?.slots ?? [])');
    expect(controller).toContain('slots.find((s) => s.angle === "frontClose")?.url');
    expect(node).toContain('(modelReady && !isView ? sheet.headshotUrl : null) ?? data.imageUrl');
    expect(node).toContain('<CharacterSheetImageArea');
    expect(node).toContain('tiles={sheet.tiles}');
    expect(board).toContain('utils.generation.packageState.prefetch({ modelId })');
  });

  it('keeps the spawn menu and library chooser on the same packageState cache', () => {
    const spawn = source('client/src/features/boards/canvas/SpawnMenu.tsx');
    const chooser = source('client/src/features/lobby/ModelCardChooser.tsx');

    expect(spawn).toContain('trpc.generation.packageState.useQuery({ modelId }');
    expect(spawn).toContain('(data?.slots ?? []).map');
    expect(chooser).toContain('trpc.generation.packageState.useQuery');
    expect(chooser).toContain('(packageQuery.data?.slots ?? []).map');
    expect(chooser).toContain('<CharacterSheetImageArea');
  });

  it('keeps Profile identity and package presentation on the adopted queries', () => {
    const profile = source('client/src/features/casting/components/CastProfilePanel.tsx');
    expect(profile).toContain('trpc.models.get.useQuery');
    expect(profile).toContain('trpc.generation.packageState.useQuery');
    expect(profile).toContain("currentAssets.find((asset) => asset.viewType === 'frontClose')");
    expect(profile).toContain('const slots = packageQuery.data?.slots ?? []');
  });

  it('invalidates every warm B4 projection in other tabs without carrying authority', () => {
    const bridge = source('client/src/features/operations/GenerationOperationBridge.tsx');
    const sync = source('client/src/features/operations/castProjectionSync.ts');
    const history = source('client/src/features/casting/components/SlotVersionHistory.tsx');
    const profile = source('client/src/features/casting/components/CastProfilePanel.tsx');
    const studio = source('client/src/pages/DrapeStudio.tsx');
    const takeover = source('client/src/features/studio/takeover/CastingTakeover.tsx');

    expect(bridge).toContain('publishCastProjectionChanged(operation.modelId)');
    expect(bridge).toContain('subscribeCastProjectionChanged');
    for (const key of [
      'models.list',
      'models.get',
      'wardrobe.model.listMinted',
      'wardrobe.model.listDrafts',
      'lobby.recentWork',
      'boardOps.listCastableModels',
      'boards.getItems',
      'boards.getItemModelInfo',
      'generation.packageState',
      'generation.refreshSlotsPlan',
      'generation.mintPackagePlan',
      'generation.exportPlan',
    ]) {
      expect(bridge).toContain(`${key}.invalidate`);
    }
    expect(history).toContain('publishCastProjectionChanged(result.modelId)');
    expect(profile).toContain('publishCastProjectionChanged(currentModelId)');
    expect(studio).toContain('publishCastProjectionChanged(currentModelId)');
    expect(takeover).toContain('publishCastProjectionChanged(currentModelId)');
    expect(sync).toContain("type: 'cast-projection-changed'");
    expect(sync).not.toMatch(/storageUrl|storageKey|prompt|preferences|technicalSchema|agencyId/);
  });

  it('keeps the cross-tab publisher and subscriber caller set closed', () => {
    const clientRoot = resolve(process.cwd(), 'client/src');
    const callers = readdirSync(clientRoot, { recursive: true })
      .map((path) => String(path).replaceAll('\\', '/'))
      .filter((path) => /\.[jt]sx?$/.test(path))
      .filter((path) => source(`client/src/${path}`).includes('castProjectionSync'))
      .sort();

    expect(callers).toEqual([
      'features/casting/components/CastProfilePanel.tsx',
      'features/casting/components/SlotVersionHistory.tsx',
      'features/operations/GenerationOperationBridge.tsx',
      'features/studio/takeover/CastingTakeover.tsx',
      'pages/DrapeStudio.tsx',
    ]);
  });

  it('derives comp-card tiles from the supplied selected slots without ledger fallback', () => {
    const slots: SheetSlotState[] = [
      {
        angle: 'frontClose',
        label: 'Headshot',
        filled: true,
        url: 'https://example.invalid/selected-head.png',
        pinned: false,
        stale: false,
        version: 2,
        failed: null,
      },
      {
        angle: 'sideClose',
        label: 'Side',
        filled: false,
        url: null,
        pinned: false,
        stale: false,
        version: 0,
        failed: { reason: 'failed', refunded: 350 },
      },
    ];

    expect(buildSheetTiles(slots, new Set(), new Set())).toEqual([
      expect.objectContaining({
        angle: 'frontClose',
        url: 'https://example.invalid/selected-head.png',
        filled: true,
      }),
      expect.objectContaining({
        angle: 'sideClose',
        url: null,
        filled: false,
        failed: { reason: 'failed', refunded: 350 },
      }),
    ]);
  });

  it('keeps the real-browser gate bounded to one guarded disposable database', () => {
    const runner = source('scripts/drive-r7-b4-browser.mts');
    const seed = source('scripts/r7-b4-browser-seed.mts');
    const browser = source('scripts/r7-b4-browser-drive.mts');

    expect(runner).toContain("const PREFIX = 'drape_r7_b4_browser_'");
    expect(runner).toContain("if (process.argv.length !== 2)");
    expect(runner).toContain("appId.toLowerCase().includes('production')");
    expect(runner).toContain("sourceUrl.pathname.replace(/^\\//, '') !== 'railway'");
    expect(runner).toContain('Refusing: stale browser databases require review');
    expect(runner).toContain('Number(file.slice(0, 4)) <= 10');
    expect(runner).toContain('R7_SNAPSHOT_READ_SCOPE: `users:${fixture.userId}`');
    expect(runner).toContain("spawnSync('taskkill.exe', ['/pid', String(dev.pid), '/t', '/f']");
    expect(runner).toContain('if (created) await dropDatabase(serverUrl, databaseName, safeName)');

    expect(seed).toContain("const OPEN_ID = 'verify-bot-local'");
    expect(seed).toContain("APP_ID.toLowerCase().includes('production')");
    expect(seed).toContain('bootstrapModelSnapshot({ userId, modelId })');
    expect(browser).toContain("openId: 'verify-bot-local'");
    expect(browser).toContain("appId.toLowerCase().includes('production')");
    expect(browser).toContain('crossTabRename: true');
    expect(browser).toContain('chooserSelectedViews');
    expect(browser).toContain('canvasSelectedViews');
  });
});
