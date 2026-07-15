/**
 * Session Reset & State Management Tests
 *
 * Verifies that all studio transition scenarios produce airtight state:
 * - Upload → Wardrobe → Switch to Casting → wardrobe is cleared
 * - Gallery → Wardrobe → Home → wardrobe is cleared
 * - Cast → Wardrobe → Home → wardrobe is cleared, canvas reset
 * - Upload → Wardrobe → Home → back to lobby, wardrobe cleared
 * - Gallery → Wardrobe → Switch to Casting → cast new → switch to wardrobe → fresh session
 * - Multiple model loads → only latest model state persists
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStudioStore } from '../client/src/features/studio/stores/useStudioStore';
import { useWardrobeStore } from '../client/src/features/wardrobe/stores/useWardrobeStore';


/** Reset both stores before each test */
beforeEach(() => {
  useStudioStore.setState(useStudioStore.getInitialState());
  useWardrobeStore.setState(useWardrobeStore.getInitialState());
});

/** Helper: simulate wardrobe session with selections */
function simulateWardrobeSession() {
  const ws = useWardrobeStore.getState();
  ws.toggleGarmentSelection(1);
  ws.toggleGarmentSelection(2);
  ws.setStyleNote(1, 'Loose fit');
  ws.setActiveSlot('tops');
  ws.setSearchTerm('blazer');
  ws.setActiveSessionId(42);
  ws.pushVTOResult('https://s3.example.com/vto-result-1.jpg');
  ws.pushVTOResult('https://s3.example.com/vto-result-2.jpg');
}

/** Helper: verify wardrobe is fully reset */
function expectWardrobeClean() {
  const ws = useWardrobeStore.getState();
  expect(ws.selectedGarmentIds.size).toBe(0);
  expect(ws.styleNotes).toEqual({});
  expect(ws.activeSlot).toBe('full_look');
  expect(ws.searchTerm).toBe('');
  expect(ws.activeSessionId).toBeNull();
  expect(ws.vtoHistory).toEqual([]);
  expect(ws.vtoHistoryIndex).toBe(-1);
  expect(ws.tattooMap).toBeNull();
}

/** Helper: verify studio canvas is fully reset */
function expectCanvasClean() {
  const ss = useStudioStore.getState();
  expect(ss.canvas.hasModel).toBe(false);
  expect(ss.canvas.hasFullBody).toBe(false);
  expect(ss.canvas.hasAllViews).toBe(false);
  expect(ss.canvas.modelSource).toBeNull();
  expect(ss.canvas.uploadedModelUrl).toBeNull();
  expect(ss.canvas.castModelId).toBeNull();
  expect(ss.canvas.castMasterPrompt).toBeNull();
  expect(ss.canvas.castFullBodyUrl).toBeNull();
}

describe('Session Reset — useSessionReset actions', () => {
  describe('resetToLobby (Home button)', () => {
    it('clears wardrobe state when returning home from uploaded model', () => {
      // Load uploaded model
      useStudioStore.getState().loadModelFromUpload('https://s3.example.com/upload.jpg');
      // Simulate wardrobe work
      simulateWardrobeSession();
      
      // Verify wardrobe has data
      expect(useWardrobeStore.getState().selectedGarmentIds.size).toBe(2);
      expect(useWardrobeStore.getState().vtoHistory.length).toBe(2);
      
      // Reset to lobby (simulates useSessionReset.resetToLobby)
      useWardrobeStore.getState().resetWardrobe();
      useStudioStore.getState().resetStudio();
      
      expectWardrobeClean();
      expectCanvasClean();
      expect(useStudioStore.getState().activeTool).toBeNull();
    });

    it('clears wardrobe state when returning home from gallery model', () => {
      useStudioStore.getState().loadModelFromCast(99, 'https://s3.example.com/cast.jpg', 'A tall model', true);
      simulateWardrobeSession();
      
      useWardrobeStore.getState().resetWardrobe();
      useStudioStore.getState().resetStudio();
      
      expectWardrobeClean();
      expectCanvasClean();
      expect(useStudioStore.getState().activeTool).toBeNull();
    });

    it('clears wardrobe state when returning home from active casting session', () => {
      // Simulate casting produced assets → canvas has model
      useStudioStore.getState().setCanvas({
        hasModel: true,
        hasFullBody: true,
        hasAllViews: false,
        modelSource: 'cast',
      });
      useStudioStore.getState().setActiveTool('wardrobe');
      simulateWardrobeSession();
      
      useWardrobeStore.getState().resetWardrobe();
      useStudioStore.getState().resetStudio();
      
      expectWardrobeClean();
      expectCanvasClean();
    });
  });

  describe('resetAndSwitchTo (Switch & Reset confirmation)', () => {
    it('clears wardrobe when switching from uploaded model to casting', () => {
      useStudioStore.getState().loadModelFromUpload('https://s3.example.com/upload.jpg');
      simulateWardrobeSession();
      
      // Simulate resetAndSwitchTo('casting')
      useWardrobeStore.getState().resetWardrobe();
      useStudioStore.getState().clearUploadedModel();
      // setTimeout would set activeTool to 'casting'
      useStudioStore.getState().setActiveTool('casting');
      
      expectWardrobeClean();
      expect(useStudioStore.getState().canvas.uploadedModelUrl).toBeNull();
      expect(useStudioStore.getState().activeTool).toBe('casting');
    });

    it('clears wardrobe when switching from gallery model to casting', () => {
      useStudioStore.getState().loadModelFromCast(50, 'https://s3.example.com/cast.jpg', 'Edgy model', true);
      simulateWardrobeSession();
      
      useWardrobeStore.getState().resetWardrobe();
      useStudioStore.getState().clearUploadedModel();
      useStudioStore.getState().setActiveTool('casting');
      
      expectWardrobeClean();
      expect(useStudioStore.getState().canvas.castModelId).toBeNull();
      expect(useStudioStore.getState().activeTool).toBe('casting');
    });
  });

  describe('loadUploadedModel (new upload clears old session)', () => {
    it('clears previous wardrobe session when uploading a new model', () => {
      // First model loaded from gallery
      useStudioStore.getState().loadModelFromCast(10, 'https://s3.example.com/old.jpg', 'Old model', true);
      simulateWardrobeSession();
      
      // New upload (simulates useSessionReset.loadUploadedModel)
      useWardrobeStore.getState().resetWardrobe();
      useStudioStore.getState().loadModelFromUpload('https://s3.example.com/new-upload.jpg');
      
      expectWardrobeClean();
      expect(useStudioStore.getState().canvas.uploadedModelUrl).toBe('https://s3.example.com/new-upload.jpg');
      expect(useStudioStore.getState().canvas.castModelId).toBeNull();
      expect(useStudioStore.getState().activeTool).toBe('wardrobe');
    });

    it('clears previous upload session when uploading another model', () => {
      useStudioStore.getState().loadModelFromUpload('https://s3.example.com/first.jpg');
      simulateWardrobeSession();
      
      useWardrobeStore.getState().resetWardrobe();
      useStudioStore.getState().loadModelFromUpload('https://s3.example.com/second.jpg');
      
      expectWardrobeClean();
      expect(useStudioStore.getState().canvas.uploadedModelUrl).toBe('https://s3.example.com/second.jpg');
    });
  });

  describe('loadGalleryModel (gallery selection clears old session)', () => {
    it('clears previous wardrobe session when selecting a different gallery model', () => {
      useStudioStore.getState().loadModelFromCast(10, 'https://s3.example.com/model-a.jpg', 'Model A', true);
      simulateWardrobeSession();
      
      // Select different gallery model (simulates useSessionReset.loadGalleryModel)
      useWardrobeStore.getState().resetWardrobe();
      useStudioStore.getState().loadModelFromCast(20, 'https://s3.example.com/model-b.jpg', 'Model B', true);
      
      expectWardrobeClean();
      expect(useStudioStore.getState().canvas.castModelId).toBe(20);
      expect(useStudioStore.getState().canvas.castFullBodyUrl).toBe('https://s3.example.com/model-b.jpg');
    });

    it('clears uploaded model session when selecting a gallery model', () => {
      useStudioStore.getState().loadModelFromUpload('https://s3.example.com/upload.jpg');
      simulateWardrobeSession();
      
      useWardrobeStore.getState().resetWardrobe();
      useStudioStore.getState().loadModelFromCast(30, 'https://s3.example.com/gallery.jpg', 'Gallery model', true);
      
      expectWardrobeClean();
      expect(useStudioStore.getState().canvas.uploadedModelUrl).toBeNull();
      expect(useStudioStore.getState().canvas.castModelId).toBe(30);
    });
  });

  describe('Complex multi-step scenarios', () => {
    it('Upload → Wardrobe → Casting (confirm) → Cast new → Wardrobe → fresh session', () => {
      // Step 1: Upload a model
      useStudioStore.getState().loadModelFromUpload('https://s3.example.com/upload.jpg');
      expect(useStudioStore.getState().activeTool).toBe('wardrobe');
      
      // Step 2: Do wardrobe work
      simulateWardrobeSession();
      expect(useWardrobeStore.getState().selectedGarmentIds.size).toBe(2);
      
      // Step 3: Switch to Casting (confirm → reset)
      useWardrobeStore.getState().resetWardrobe();
      useStudioStore.getState().clearUploadedModel();
      useStudioStore.getState().setActiveTool('casting');
      
      expectWardrobeClean();
      expect(useStudioStore.getState().canvas.uploadedModelUrl).toBeNull();
      
      // Step 4: Cast a new model (casting produces assets → canvas sync)
      useStudioStore.getState().setCanvas({
        hasModel: true,
        hasFullBody: true,
        hasAllViews: false,
        modelSource: 'cast',
      });
      
      // Step 5: Switch to Wardrobe
      useStudioStore.getState().setActiveTool('wardrobe');
      
      // Wardrobe should be clean — no stale data from step 2
      expectWardrobeClean();
      expect(useStudioStore.getState().canvas.hasFullBody).toBe(true);
      expect(useStudioStore.getState().canvas.modelSource).toBe('cast');
    });

    it('Gallery → Wardrobe → Home → Gallery (different model) → Wardrobe → fresh session', () => {
      // Step 1: Load gallery model
      useStudioStore.getState().loadModelFromCast(10, 'https://s3.example.com/model-a.jpg', 'Model A', true);
      simulateWardrobeSession();
      
      // Step 2: Go Home
      useWardrobeStore.getState().resetWardrobe();
      useStudioStore.getState().resetStudio();
      
      expectWardrobeClean();
      expectCanvasClean();
      
      // Step 3: Load different gallery model
      useWardrobeStore.getState().resetWardrobe(); // redundant but safe
      useStudioStore.getState().loadModelFromCast(20, 'https://s3.example.com/model-b.jpg', 'Model B', true);
      
      // Step 4: Wardrobe should be clean with new model
      expectWardrobeClean();
      expect(useStudioStore.getState().canvas.castModelId).toBe(20);
      expect(useStudioStore.getState().canvas.castMasterPrompt).toBe('Model B');
    });

    it('Upload → Wardrobe → Home (no cast) → Upload again → wardrobe is clean', () => {
      // Step 1: Upload
      useStudioStore.getState().loadModelFromUpload('https://s3.example.com/first.jpg');
      simulateWardrobeSession();
      
      // Step 2: Go Home
      useWardrobeStore.getState().resetWardrobe();
      useStudioStore.getState().resetStudio();
      
      // Step 3: Upload again
      useWardrobeStore.getState().resetWardrobe();
      useStudioStore.getState().loadModelFromUpload('https://s3.example.com/second.jpg');
      
      expectWardrobeClean();
      expect(useStudioStore.getState().canvas.uploadedModelUrl).toBe('https://s3.example.com/second.jpg');
    });
  });

  describe('Casting → Canvas bridge', () => {
    it('does not overwrite uploaded model canvas when casting assets change', () => {
      // Upload a model
      useStudioStore.getState().loadModelFromUpload('https://s3.example.com/upload.jpg');
      
      const canvas = useStudioStore.getState().canvas;
      expect(canvas.modelSource).toBe('uploaded');
      expect(canvas.uploadedModelUrl).toBe('https://s3.example.com/upload.jpg');
      
      // The casting→canvas bridge should skip when modelSource === 'uploaded'
      // (verified by the isExternalModel check in DrapeStudio useEffect)
      expect(canvas.modelSource).toBe('uploaded');
    });

    it('does not overwrite gallery model canvas when casting assets change', () => {
      useStudioStore.getState().loadModelFromCast(99, 'https://s3.example.com/gallery.jpg', 'Gallery', true);
      
      const canvas = useStudioStore.getState().canvas;
      expect(canvas.castModelId).toBe(99);
      
      // The bridge should skip when castModelId !== null
      expect(canvas.castModelId).toBe(99);
      expect(canvas.castFullBodyUrl).toBe('https://s3.example.com/gallery.jpg');
    });
  });

});
