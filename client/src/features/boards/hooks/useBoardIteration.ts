/**
 * useBoardIteration — Bridge between board items and the casting iterate endpoint.
 *
 * Handles:
 * - Calling generation.iterate with the board item's sourceModelId
 * - Saving each iteration as a version in board_item_versions
 * - Updating the board item's imageUrl in-place
 * - Tracking loading/error state
 *
 * Does NOT use the casting generation stores — this is a standalone hook
 * for the board canvas context.
 */
import { useCallback, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface UseBoardIterationParams {
  boardId: number;
}

interface IterationState {
  isGenerating: boolean;
  currentStep: string;
  error: string | null;
  /** The item currently being iterated */
  activeItemId: number | null;
}

export function useBoardIteration({ boardId }: UseBoardIterationParams) {
  const [state, setState] = useState<IterationState>({
    isGenerating: false,
    currentStep: "",
    error: null,
    activeItemId: null,
  });

  const utils = trpc.useUtils();

  // Mutations
  const iterateMutation = trpc.generation.iterate.useMutation();
  const addVersionMutation = trpc.boards.addItemVersion.useMutation();
  const updateItemMutation = trpc.boards.updateItem.useMutation();

  /**
   * Perform an iteration on a board item.
   * 1. Calls generation.iterate with the item's model
   * 2. Saves the result as a new version
   * 3. Updates the board item's imageUrl
   */
  const iterate = useCallback(
    async (params: {
      itemId: number;
      sourceModelId: number;
      currentAssetId: number;
      prompt: string;
      maskBase64?: string;
      tool?: "chat" | "surgical" | "eraser";
    }) => {
      const { itemId, sourceModelId, currentAssetId, prompt, maskBase64, tool = "chat" } = params;

      setState({
        isGenerating: true,
        currentStep: maskBase64 ? "Applying edit..." : "Iterating...",
        error: null,
        activeItemId: itemId,
      });

      try {
        // 1. Call the iterate endpoint
        const result = await iterateMutation.mutateAsync({
          modelId: sourceModelId,
          feedback: prompt,
          assetId: currentAssetId,
          maskBase64,
        });

        if (!result.success || !result.imageUrl) {
          throw new Error("Iteration failed — no image returned");
        }

        // 2. Save version snapshot
        await addVersionMutation.mutateAsync({
          itemId,
          imageUrl: result.imageUrl,
          prompt,
          tool,
        });

        // 3. Update the board item's imageUrl in-place
        await updateItemMutation.mutateAsync({
          itemId,
          imageUrl: result.imageUrl,
        });

        // 4. Invalidate queries so UI updates
        utils.boards.getItems.invalidate({ boardId });
        utils.boards.getItemVersions.invalidate({ itemId });
        utils.boards.getItemVersionCount.invalidate({ itemId });
        utils.credits.getBalance.invalidate();

        setState({
          isGenerating: false,
          currentStep: "",
          error: null,
          activeItemId: null,
        });

        return {
          success: true,
          imageUrl: result.imageUrl,
          assetId: result.assetId,
          masterPrompt: result.masterPrompt,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Iteration failed";
        setState({
          isGenerating: false,
          currentStep: "",
          error: message,
          activeItemId: null,
        });
        toast.error(message);
        return { success: false };
      }
    },
    [boardId, iterateMutation, addVersionMutation, updateItemMutation, utils]
  );

  /**
   * Save the initial version for a board item (called when first opening the editor).
   * This ensures the original image is preserved as version 1.
   */
  const saveInitialVersion = useCallback(
    async (itemId: number, imageUrl: string) => {
      try {
        await addVersionMutation.mutateAsync({
          itemId,
          imageUrl,
          tool: "initial",
        });
        utils.boards.getItemVersionCount.invalidate({ itemId });
      } catch {
        // Silent fail — initial version save is best-effort
        console.warn("[BoardIteration] Failed to save initial version");
      }
    },
    [addVersionMutation, utils]
  );

  /**
   * Revert a board item to a specific version.
   */
  const revertToVersion = useCallback(
    async (itemId: number, versionId: number) => {
      try {
        const result = await utils.client.boards.revertItemVersion.mutate({
          itemId,
          versionId,
        });
        if (result.success) {
          utils.boards.getItems.invalidate({ boardId });
          utils.boards.getItemVersions.invalidate({ itemId });
          toast.success("Reverted to selected version");
        }
      } catch {
        toast.error("Failed to revert version");
      }
    },
    [boardId, utils]
  );

  return {
    ...state,
    iterate,
    saveInitialVersion,
    revertToVersion,
  };
}
