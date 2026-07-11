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
  const cost = plan?.estimatedCreditCost ?? null;
  const who = name || "this cast";

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-canvas-md font-medium text-canvas-ink">Rerun this cast</p>
        <p className="text-canvas-xs text-canvas-ink-soft mt-0.5">
          A rerun casts a different person.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <ChoiceRow
          autoFocus
          title="Fork new cast"
          description={`Keep ${who}; add another candidate beside them.`}
          cost={cost}
          onClick={onFork}
        />
        {isMinted ? (
          <ChoiceRow
            disabled
            title="Recast this cast"
            description={`${who} is minted — identity is sealed. Fork instead.`}
            cost={null}
          />
        ) : (
          <ChoiceRow
            title="Recast this cast"
            description="Replace this draft's identity in place."
            cost={cost}
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
