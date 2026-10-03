/**
 * ForkRecastPopover — the rerun gesture on a cast is an explicit choice
 * (DS §7.4, foundations 3f), amended by D-43: minted identities are
 * immutable, so on a minted cast the Recast row is sealed with an
 * explanation and Fork is the only live path. No red anywhere — D-43
 * scoped red to delete-cascade alone. This is a popover, not a dialog:
 * a choice, not a warning. Costs are plan-derived (D-15).
 */
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
/* #1785 — the SAME compiled constant the server's refusal reads
   (`server/lib/canvasCastDoor.ts`), so the row a customer sees and the refusal
   a request would meet cannot disagree (working law 4). */
import { CANVAS_CAST_OPEN } from "@shared/canvasCastDoor";
import { CostLabel } from "./CostLabel";

interface ForkRecastPopoverContentProps {
  boardId: number;
  itemId: number;
  /** Display name — falls back to "this cast" for unnamed drafts. */
  name: string | null;
  /** Minted (non-draft library cast) — recast is sealed (D-43). */
  isMinted: boolean;
  onFork: () => void;
  onRecast: () => void;
}

export function ForkRecastPopoverContent({
  boardId,
  itemId,
  name,
  isMinted,
  onFork,
  onRecast,
}: ForkRecastPopoverContentProps) {
  const { data: plan } = trpc.boardOps.applyModelEdit.plan.useQuery(
    { boardId, itemId },
    { enabled: itemId > 0, staleTime: 60_000 },
  );
  const recastCost = plan?.estimatedCreditCost ?? null;
  const forkCost = plan?.forkCreditCost ?? null;
  const who = name || "this cast";

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-canvas-md font-medium text-canvas-ink">Fork or recast</p>
        <p className="text-canvas-xs text-canvas-ink-soft mt-0.5">
          Fork keeps this person. Recast creates someone new.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <ChoiceRow
          autoFocus
          title="Fork to edit"
          description={`Create an independent editable copy of ${who}. The original stays unchanged.`}
          cost={forkCost}
          onClick={onFork}
        />
        {isMinted ? (
          <ChoiceRow
            disabled
            title="Recast this cast"
            description={`${who} is minted — identity is sealed. Fork instead.`}
            cost={null}
          />
        ) : !CANVAS_CAST_OPEN ? (
          /* #1785 — the canvas casting door, his word: "seal". Recast is the
             paid new-person engine, and the server refuses it at the mouth, so
             the row is sealed HERE rather than left to quote a price for a road
             that cannot be walked. D-43's minted branch above is the precedent,
             clause for clause: the row stays visible, disabled, carrying its
             reason and no cost, and Fork — free, untouched, still working — is
             the live path beside it. Checked AFTER `isMinted` so a minted cast
             keeps its own, more durable sentence unchanged. */
          <ChoiceRow
            disabled
            title="Recast this cast"
            description="Making new pictures on the canvas is unavailable while we rebuild it. Fork instead."
            cost={null}
          />
        ) : (
          <ChoiceRow
            title="Recast this cast"
            description="Replace this draft's identity in place."
            cost={recastCost}
            onClick={onRecast}
          />
        )}
      </div>
    </div>
  );
}

function ChoiceRow({
  title,
  description,
  cost,
  onClick,
  disabled,
  autoFocus,
}: {
  title: string;
  description: string;
  cost: number | null;
  onClick?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <button
      type="button"
      autoFocus={autoFocus}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-canvas-md border-hairline border-canvas-border-strong p-3 transition-colors",
        disabled
          ? "opacity-40 cursor-default"
          : "hover:border-canvas-ink/40 focus-visible:border-canvas-ink/40 outline-none cursor-pointer",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-canvas-sm font-medium text-canvas-ink">{title}</span>
        <CostLabel credits={cost} />
      </div>
      <p className="text-canvas-xs text-canvas-ink-soft mt-0.5 leading-relaxed">{description}</p>
    </button>
  );
}
