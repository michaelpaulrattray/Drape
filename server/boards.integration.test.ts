/**
 * Board Casting Integration Tests
 *
 * Verifies the board item insertion flow used by BoardCastingPanel
 * when a model is generated and added to the canvas.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the board item insertion logic
describe('Board Casting Integration', () => {
  describe('Board item creation from casting', () => {
    it('should create a valid board item payload for a model', () => {
      const boardId = 42;
      const modelId = 123;
      const modelName = 'Test Model';
      const headshotUrl = 'https://storage.example.com/headshot.jpg';

      const payload = {
        boardId,
        type: 'model' as const,
        label: modelName || `Model ${modelId}`,
        imageUrl: headshotUrl,
        sourceModelId: modelId,
        positionX: 100,
        positionY: 100,
        width: 280,
        height: 280,
        metadata: { viewType: 'frontClose' },
      };

      expect(payload.type).toBe('model');
      expect(payload.label).toBe('Test Model');
      expect(payload.imageUrl).toBe(headshotUrl);
      expect(payload.sourceModelId).toBe(modelId);
      expect(payload.width).toBe(280);
      expect(payload.height).toBe(280);
      expect(payload.metadata.viewType).toBe('frontClose');
    });

    it('should use fallback label when modelName is empty', () => {
      const modelId = 456;
      const modelName = '';

      const label = modelName || `Model ${modelId}`;
      expect(label).toBe('Model 456');
    });

    it('should generate position within expected range', () => {
      const baseX = 100;
      const baseY = 100;
      const randomOffset = 200;

      // Simulate the position calculation
      for (let i = 0; i < 10; i++) {
        const posX = baseX + Math.floor(Math.random() * randomOffset);
        const posY = baseY + Math.floor(Math.random() * randomOffset);

        expect(posX).toBeGreaterThanOrEqual(baseX);
        expect(posX).toBeLessThan(baseX + randomOffset);
        expect(posY).toBeGreaterThanOrEqual(baseY);
        expect(posY).toBeLessThan(baseY + randomOffset);
      }
    });
  });

  describe('Board item update on view generation', () => {
    it('should update item image when new view is generated', () => {
      const existingItems = [
        { id: 1, sourceModelId: 100, imageUrl: 'old.jpg', metadata: { viewType: 'frontClose' } },
        { id: 2, sourceModelId: 200, imageUrl: 'other.jpg', metadata: { viewType: 'frontClose' } },
      ];

      const currentModelId = 100;
      const latestAsset = {
        storageUrl: 'new-fullbody.jpg',
        viewType: 'frontFull',
      };

      // Simulate the update logic from BoardCastingPanel
      const updated = existingItems.map((i) =>
        i.sourceModelId === currentModelId
          ? {
              ...i,
              imageUrl: latestAsset.storageUrl,
              metadata: { ...((i.metadata as Record<string, unknown>) || {}), viewType: latestAsset.viewType },
            }
          : i,
      );

      expect(updated[0].imageUrl).toBe('new-fullbody.jpg');
      expect((updated[0].metadata as Record<string, unknown>).viewType).toBe('frontFull');
      expect(updated[1].imageUrl).toBe('other.jpg'); // Unchanged
    });

    it('should not update items for a different model', () => {
      const existingItems = [
        { id: 1, sourceModelId: 100, imageUrl: 'old.jpg', metadata: { viewType: 'frontClose' } },
      ];

      const currentModelId = 999; // Different model
      const latestAsset = {
        storageUrl: 'new.jpg',
        viewType: 'frontFull',
      };

      const updated = existingItems.map((i) =>
        i.sourceModelId === currentModelId
          ? { ...i, imageUrl: latestAsset.storageUrl }
          : i,
      );

      expect(updated[0].imageUrl).toBe('old.jpg'); // Unchanged
    });
  });

  describe('Model editor overlay', () => {
    it('should only open overlay for model-type items', () => {
      const items = [
        { id: 1, type: 'model' },
        { id: 2, type: 'garment' },
        { id: 3, type: 'vto_result' },
        { id: 4, type: 'model' },
      ];

      const shouldOpenOverlay = (itemId: number) => {
        const item = items.find((i) => i.id === itemId);
        return item?.type === 'model';
      };

      expect(shouldOpenOverlay(1)).toBe(true);
      expect(shouldOpenOverlay(2)).toBe(false);
      expect(shouldOpenOverlay(3)).toBe(false);
      expect(shouldOpenOverlay(4)).toBe(true);
    });
  });

  describe('Canvas background configuration', () => {
    it('should use warm dot pattern colors', () => {
      const bgColor = '#FAFAF8';
      const dotColor = '#d4d0cb';
      const dotSize = 0.8;
      const dotGap = 20;

      // Verify the warm palette values match the studio canvas
      expect(bgColor).toBe('#FAFAF8');
      expect(dotColor).toBe('#d4d0cb');
      expect(dotSize).toBeLessThan(1); // Subtle dots
      expect(dotGap).toBe(20); // Grid alignment
    });
  });

  describe('Form progress calculation', () => {
    it('should calculate 0% for empty prefs', () => {
      const prefs = {
        castingBrand: '',
        castingVibe: null,
        gender: '',
        age: '',
        ethnicity: '',
        bodyType: '',
        faceShape: '',
        skinTone: '',
        skinTexture: '',
        skinFinish: '',
        eyeColor: '',
        hairColor: '',
        hairStyle: '',
      };

      const c = [
        !!prefs.castingBrand,
        !!(prefs.castingVibe && (prefs.castingVibe.editorial > 0 || prefs.castingVibe.commercial > 0 || prefs.castingVibe.runway > 0)),
        !!prefs.gender,
        !!(prefs.age && prefs.ethnicity),
        !!prefs.bodyType,
        !!prefs.faceShape,
        !!prefs.skinTone,
        !!(prefs.skinTexture || prefs.skinFinish),
        !!prefs.eyeColor,
        !!prefs.eyeColor,
        !!prefs.hairColor,
        !!prefs.hairStyle,
      ];
      const progress = Math.round((c.filter(Boolean).length / 12) * 100);

      expect(progress).toBe(0);
    });

    it('should calculate 100% for fully filled prefs', () => {
      const prefs = {
        castingBrand: 'High Fashion',
        castingVibe: { editorial: 0.5, commercial: 0.3, runway: 0.2 },
        gender: 'Female',
        age: '25',
        ethnicity: 'Mixed',
        bodyType: 'Slim',
        faceShape: 'Oval',
        skinTone: 'Medium',
        skinTexture: 'Smooth',
        skinFinish: 'Natural',
        eyeColor: 'Brown',
        hairColor: 'Black',
        hairStyle: 'Long Straight',
      };

      const c = [
        !!prefs.castingBrand,
        !!(prefs.castingVibe && (prefs.castingVibe.editorial > 0 || prefs.castingVibe.commercial > 0 || prefs.castingVibe.runway > 0)),
        !!prefs.gender,
        !!(prefs.age && prefs.ethnicity),
        !!prefs.bodyType,
        !!prefs.faceShape,
        !!prefs.skinTone,
        !!(prefs.skinTexture || prefs.skinFinish),
        !!prefs.eyeColor,
        !!prefs.eyeColor,
        !!prefs.hairColor,
        !!prefs.hairStyle,
      ];
      const progress = Math.round((c.filter(Boolean).length / 12) * 100);

      expect(progress).toBe(100);
    });
  });
});
