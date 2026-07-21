import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nextThumbnail } from '../client/src/features/boards/BoardPage';

const db = vi.hoisted(() => ({
  createBoard: vi.fn(),
  getBoardById: vi.fn().mockResolvedValue({ id: 41, userId: 7 }),
  getUserBoards: vi.fn(),
  updateBoard: vi.fn().mockResolvedValue(undefined),
  archiveBoard: vi.fn(),
  deleteBoard: vi.fn(),
  getUserBoardCount: vi.fn(),
  addBoardItem: vi.fn(),
  addBoardItems: vi.fn(),
  getBoardItems: vi.fn(),
  getBoardItemById: vi.fn(),
  updateBoardItem: vi.fn(),
  batchUpdateBoardItemPositions: vi.fn(),
  deleteBoardItem: vi.fn(),
  deleteBoardItems: vi.fn(),
  getModelById: vi.fn(),
  getModelAssets: vi.fn(),
  getModelStatusesIn: vi.fn(),
  addBoardItemVersion: vi.fn(),
  getBoardItemVersions: vi.fn(),
  getLatestVersionNumber: vi.fn(),
  getVersionCount: vi.fn(),
}));

vi.mock('./db', () => db);

import { boardsRouter } from './routes/boards';

const read = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8');

describe('W6-E board thumbnail lifecycle', () => {
  it('chooses the newest image-bearing item and otherwise clears or no-ops', () => {
    const items = [
      { id: 3, imageUrl: 'https://example.com/older.png' },
      { id: 8, imageUrl: null },
      { id: 6, imageUrl: 'https://example.com/newest.png' },
      { id: -1, imageUrl: 'https://example.com/optimistic.png' },
    ];

    expect(nextThumbnail(items, 'https://example.com/older.png')).toEqual({
      set: 'https://example.com/newest.png',
    });
    expect(nextThumbnail(items, 'https://example.com/newest.png')).toBeNull();
    expect(nextThumbnail([], 'https://example.com/stale.png')).toEqual({ clear: true });
    expect(nextThumbnail([], null)).toBeNull();
    expect(nextThumbnail(undefined, 'https://example.com/stale.png')).toBeNull();
  });

  it('accepts null and passes it through to the database update', async () => {
    db.getBoardById.mockResolvedValueOnce({ id: 41, userId: 7 });
    db.updateBoard.mockClear();
    const caller = boardsRouter.createCaller({ user: { id: 7 } } as never);

    await caller.update({ boardId: 41, thumbnailUrl: null });

    expect(db.updateBoard).toHaveBeenCalledWith(41, { thumbnailUrl: null });
  });

  it('resets local thumbnail truth when the retained board page changes boards', () => {
    const source = read('client/src/features/boards/BoardPage.tsx');
    expect(source).toContain('if (thumbnailBoardIdRef.current !== boardId)');
    expect(source).toContain('lastThumbnailRef.current = undefined');
  });

  it('flushes only a pending clear when leaving, without weakening item-change cancellation', () => {
    const source = read('client/src/features/boards/BoardPage.tsx');
    expect(source).toContain('if (!pending || pending.thumbnailUrl !== null) return');
    expect(source).toContain('thumbnailWriteRef.current(pending)');
    expect(source).toContain('utils.lobby.recentWork.setData');
    expect(source).toContain('utils.lobby.recentWork.cancel()');
    expect(source).toContain('utils.lobby.recentWork.refetch()');
    expect(source).toContain('pendingThumbnailRef.current = null');
  });
});

describe('W6-F restore refusal visibility', () => {
  it('shows server refusals and re-syncs the version strip after every outcome', () => {
    const source = read('client/src/features/casting/components/SlotVersionHistory.tsx');
    const start = source.indexOf('const restoreMutation');
    const end = source.indexOf('\n\n  return {', start);
    const mutation = source.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(mutation).toContain('onError: (error) => toast.error(error.message)');
    expect(mutation).toContain('onSettled:');
    expect(mutation).toContain('utils.generation.slotVersions.invalidate');
    expect(mutation).toContain('modelId: variables.modelId');
    expect(mutation).toContain('angle: variables.angle');
  });
});
