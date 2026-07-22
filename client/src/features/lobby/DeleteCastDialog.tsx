import { LoaderCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClientRequestId } from '@shared/clientRequestId';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import { publishCastDeleted } from '@/features/operations/castDeletionSync';

export interface DeleteCastTarget {
  modelId: number;
  name: string;
}

interface DeleteCastDialogProps {
  target: DeleteCastTarget | null;
  onClose: () => void;
  onDeleted?: (modelId: number) => void;
}

export function DeleteCastDialog({ target, onClose, onDeleted }: DeleteCastDialogProps) {
  const utils = trpc.useUtils();
  const plan = trpc.models.deletePlan.useQuery(
    { modelId: target?.modelId ?? 0 },
    { enabled: target !== null, retry: 1, staleTime: 0 },
  );
  const deletion = trpc.models.delete.useMutation();

  const close = () => {
    if (!deletion.isPending) onClose();
  };

  const invalidateDeletionTruth = async (modelId: number) => {
    await Promise.allSettled([
      utils.models.list.invalidate(),
      utils.models.get.invalidate({ modelId }),
      utils.wardrobe.model.listMinted.invalidate(),
      utils.wardrobe.model.listDrafts.invalidate(),
      utils.lobby.recentWork.invalidate(),
      utils.boardOps.listCastableModels.invalidate(),
      utils.boards.getItems.invalidate(),
      utils.boards.list.invalidate(),
      utils.generation.packageState.invalidate({ modelId }),
      utils.generation.activeOperations.invalidate(),
      utils.wardrobe.sessions.getRecent.invalidate(),
      utils.wardrobe.looks.listAll.invalidate(),
    ]);
  };

  const confirmDelete = async () => {
    if (!target || !plan.data || deletion.isPending) return;
    try {
      await deletion.mutateAsync({
        clientRequestId: createClientRequestId(),
        modelId: target.modelId,
      });
      await invalidateDeletionTruth(target.modelId);
      publishCastDeleted(target.modelId);
      onDeleted?.(target.modelId);
      onClose();
      toast.success('Cast deleted');
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't delete this Cast";
      toast.error(message);
    }
  };

  const rows = plan.data ? [
    { label: 'Cast views', value: plan.data.castViews },
    { label: 'Canvas placements', value: plan.data.canvasPlacements },
    { label: 'Affected canvases', value: plan.data.affectedBoards },
    { label: 'Wardrobe sessions', value: plan.data.wardrobeSessions },
    { label: 'Saved looks', value: plan.data.wardrobeLooks },
  ].filter((row) => row.value > 0) : [];

  return (
    <Dialog open={target !== null} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent
        className="max-w-[430px] gap-0 overflow-hidden border-black/10 bg-white p-0 text-[#0A0A0A] shadow-2xl"
        showCloseButton={!deletion.isPending}
        onEscapeKeyDown={(event) => { if (deletion.isPending) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (deletion.isPending) event.preventDefault(); }}
      >
        <DialogHeader className="gap-3 px-6 pb-5 pt-6 text-left">
          <div className="flex size-9 items-center justify-center rounded-full bg-black/[0.045]">
            <Trash2 className="size-4 text-[#52524B]" strokeWidth={1.7} />
          </div>
          <DialogTitle className="text-[19px] tracking-[-0.02em]">
            Delete {target?.name || 'this Cast'}?
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-5 text-[#71716A]">
            Delete this Cast permanently? Its Cast views and linked Canvas/Wardrobe placements will be removed. Other images and videos you created stay.
          </DialogDescription>
        </DialogHeader>

        <div className="mx-6 border-y border-black/[0.07] py-3">
          {plan.isLoading || plan.isFetching ? (
            <div className="flex items-center gap-2 py-2 text-[12px] text-[#71716A]">
              <LoaderCircle className="size-3.5 animate-spin" />
              Checking what will be removed…
            </div>
          ) : plan.isError ? (
            <div className="flex items-center justify-between gap-4 py-1.5">
              <p className="text-[12px] leading-5 text-[#71716A]">Couldn’t check what will be removed.</p>
              <Button variant="ghost" size="sm" onClick={() => plan.refetch()} className="text-[12px]">
                Try again
              </Button>
            </div>
          ) : rows.length ? (
            <dl className="space-y-2">
              {rows.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-6 text-[12px]">
                  <dt className="text-[#71716A]">{row.label}</dt>
                  <dd className="font-medium tabular-nums text-[#1A1A1A]">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="py-1 text-[12px] text-[#71716A]">No linked views or placements were found.</p>
          )}
        </div>

        <DialogFooter className="gap-2 px-6 py-5 sm:justify-between">
          <Button variant="ghost" onClick={close} disabled={deletion.isPending} className="text-[#52524B]">
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={confirmDelete}
            disabled={!plan.data || plan.isFetching || deletion.isPending}
            className="min-w-[112px]"
          >
            {deletion.isPending ? <><LoaderCircle className="animate-spin" /> Deleting…</> : 'Delete Cast'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
