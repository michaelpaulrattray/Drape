/**
 * Board Casting Integration Tests
 *
 * ⚠ THIS FILE'S OWN PREMISE NAMED A COMPONENT THAT HAS BEEN DELETED. Its
 * header read *"Verifies the board item insertion flow used by
 * BoardCastingPanel"* and its arms were commented *"Simulate the update logic
 * from BoardCastingPanel"*. `client/src/features/boards/panels/
 * BoardCastingPanel.tsx` was removed in `b9238535`; `castingBindings.ts` even
 * records the reason — *"Dies with /studio (decision log D-24)"*.
 *
 * This is 3g's A-class at its far end: not a copy that drifted from its
 * source, but a copy that OUTLIVED it. Nothing failed when the component was
 * deleted, because nothing here had ever been connected to it — the arms
 * built object literals and asserted the literals back. The file went on
 * reading as coverage of a board flow for as long as it took someone to open
 * it.
 *
 * WHAT SURVIVES AND WHAT DOES NOT, decided by asking what still has a subject:
 *
 *  - The PAYLOAD arms do. The board-item contract is alive and is
 *    `boards.addItem`'s input schema (`server/routes/boards.ts:185`), so they
 *    now parse through the REAL schema off the running router rather than
 *    asserting the shape of a literal — the technique `wardrobe.test.ts` uses.
 *    That is worth more than the originals: the schema has bounds the literals
 *    never mentioned (width and height are 50..2000, label is max 256), and
 *    those are asserted now.
 *
 *  - The UPDATE-LOGIC arms do not. They re-implemented a `.map` from the
 *    deleted panel; there is no successor in `BoardPage.tsx` with that shape,
 *    so there is nothing to point them at. They are gone, and this block is
 *    where they stood.
 *
 *  - The POSITION arm was deleted in the C1 commit (`ede0a914`) for a
 *    different reason: it asserted `Math.random`'s range.
 *
 * Filed under 3g's A. Working law 4: derive, never mirror.
 */
import { describe, it, expect } from 'vitest';
import type { ZodTypeAny } from 'zod';
import { boardsRouter } from './routes/boards';

/** The real `boards.addItem` input schema, off the running router. */
function addItemSchema(): ZodTypeAny {
  const procedures = (boardsRouter as unknown as {
    _def: { procedures: Record<string, { _def: { inputs: unknown[] } }> };
  })._def.procedures;
  const procedure = procedures.addItem;
  if (!procedure) throw new Error('no procedure "addItem" on boardsRouter');
  const inputs = procedure._def.inputs;
  if (inputs.length !== 1) throw new Error(`expected one input schema, got ${inputs.length}`);
  return inputs[0] as ZodTypeAny;
}

describe('Board Casting Integration', () => {
  describe('Board item creation from casting', () => {
    it('should create a valid board item payload for a model', () => {
      const modelId = 123;
      const parsed = addItemSchema().safeParse({
        boardId: 42,
        type: 'model',
        label: 'Test Model',
        imageUrl: 'https://storage.example.com/headshot.jpg',
        sourceModelId: modelId,
        positionX: 100,
        positionY: 100,
        width: 280,
        height: 280,
        metadata: { viewType: 'frontClose' },
      });
      expect(parsed.success).toBe(true);
      if (!parsed.success) return;
      const data = parsed.data as Record<string, unknown>;
      expect(data.type).toBe('model');
      expect(data.sourceModelId).toBe(modelId);
      expect((data.metadata as Record<string, unknown>).viewType).toBe('frontClose');
    });

    it('should apply the schema defaults the caller relies on', () => {
      // The panel that used to pass these explicitly is gone; anything adding
      // a cast to a board now leans on the schema's own defaults.
      const parsed = addItemSchema().safeParse({ boardId: 42, type: 'model' });
      expect(parsed.success).toBe(true);
      if (!parsed.success) return;
      const data = parsed.data as Record<string, number>;
      expect(data.width).toBe(280);
      expect(data.height).toBe(280);
      expect(data.positionX).toBe(0);
      expect(data.positionY).toBe(0);
      expect(data.zIndex).toBe(0);
    });

    /*
     * FROM THE DIFF — the bounds. The literals these replaced carried
     * `width: 280` and asserted it back, so no arm had ever said what the
     * product does with a size outside its own range.
     */

    it('FROM THE DIFF — refuses a size outside the 50..2000 the schema declares', () => {
      const schema = addItemSchema();
      for (const bad of [{ width: 49 }, { width: 2001 }, { height: 49 }, { height: 2001 }]) {
        expect(schema.safeParse({ boardId: 42, type: 'model', ...bad }).success).toBe(false);
      }
      // Positive control: the boundaries themselves are accepted, so the arm
      // above is not rejecting everything.
      expect(schema.safeParse({ boardId: 42, type: 'model', width: 50, height: 2000 }).success).toBe(true);
    });

    it('FROM THE DIFF — refuses a label past 256 characters', () => {
      const schema = addItemSchema();
      expect(schema.safeParse({ boardId: 42, type: 'model', label: 'x'.repeat(256) }).success).toBe(true);
      expect(schema.safeParse({ boardId: 42, type: 'model', label: 'x'.repeat(257) }).success).toBe(false);
    });

    it('FROM THE DIFF — refuses a non-positive sourceModelId', () => {
      const schema = addItemSchema();
      expect(schema.safeParse({ boardId: 42, type: 'model', sourceModelId: 0 }).success).toBe(false);
      expect(schema.safeParse({ boardId: 42, type: 'model', sourceModelId: -1 }).success).toBe(false);
      expect(schema.safeParse({ boardId: 42, type: 'model', sourceModelId: 1 }).success).toBe(true);
    });
  });
});
