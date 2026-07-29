import { useEffect, useRef, useState, type DragEvent } from "react";
import { ImagePlus, Loader2, RotateCcw, X } from "lucide-react";
import type { useInkAddWorkflow } from "./useInkAddWorkflow";
import { inkCandidateIsExpired } from "./inkAddUxPolicy";

type InkWorkflow = ReturnType<typeof useInkAddWorkflow>;

function expiryLabel(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function ActionError({ workflow }: { workflow: InkWorkflow }) {
  if (!workflow.actionError) return null;
  return (
    <div className="mt-2 flex items-start justify-between gap-3 rounded-canvas-md border-hairline border-canvas-border-strong bg-canvas-surface-inset px-3 py-2">
      <p className="text-canvas-sm leading-normal text-canvas-ink-soft">
        {workflow.actionError}
      </p>
      <button
        type="button"
        onClick={workflow.clearActionError}
        className="mt-0.5 flex-shrink-0 text-canvas-ink-faint hover:text-canvas-ink"
        aria-label="Dismiss tattoo preview error"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function InkAddComposer({
  workflow,
  externallyBusy = false,
}: {
  workflow: InkWorkflow;
  externallyBusy?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confirmSafeActionRef = useRef<HTMLButtonElement>(null);
  const retryTriggerRef = useRef<HTMLButtonElement>(null);
  const cancelTriggerRef = useRef<HTMLButtonElement>(null);
  const lastConfirmationActionRef = useRef<"retry" | "cancel" | null>(null);
  const restoreConfirmationFocusRef = useRef(false);
  const active = workflow.activeSubject;
  const [confirmAction, setConfirmAction] = useState<"retry" | "cancel" | null>(null);
  const [, refreshExpiry] = useState(0);
  const controlsBusy = workflow.action !== null || externallyBusy;
  const hasAttachedReference = Boolean(active?.referenceDeliveryUrl);
  const priceCredits =
    workflow.activeSubject?.priceCredits ?? workflow.capability?.priceCredits;
  const priceLabel = priceCredits
    ? `${priceCredits} credits`
    : "Loading quote…";
  const canGenerate = Boolean(active && !active.candidateId);

  useEffect(() => {
    if (confirmAction) {
      confirmSafeActionRef.current?.focus();
      return;
    }
    if (!restoreConfirmationFocusRef.current) return;
    restoreConfirmationFocusRef.current = false;
    const target = lastConfirmationActionRef.current === "retry"
      ? retryTriggerRef.current
      : cancelTriggerRef.current;
    lastConfirmationActionRef.current = null;
    target?.focus();
  }, [confirmAction]);

  useEffect(() => {
    if (active?.candidateStatus !== "ready" || !active.expiresAt) return;
    const expiresAt = Date.parse(active.expiresAt);
    if (!Number.isFinite(expiresAt)) return;
    let timer: number | null = null;
    const scheduleExpiryCheck = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        refreshExpiry((value) => value + 1);
        return;
      }
      timer = window.setTimeout(
        scheduleExpiryCheck,
        Math.min(remaining + 50, 2_147_483_647),
      );
    };
    scheduleExpiryCheck();
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [active?.candidateStatus, active?.expiresAt]);

  const openConfirmation = (action: "retry" | "cancel") => {
    lastConfirmationActionRef.current = action;
    restoreConfirmationFocusRef.current = false;
    setConfirmAction(action);
  };
  const dismissConfirmation = () => {
    restoreConfirmationFocusRef.current = true;
    setConfirmAction(null);
  };
  const commitConfirmation = (action: "retry" | "cancel") => {
    restoreConfirmationFocusRef.current = false;
    lastConfirmationActionRef.current = null;
    setConfirmAction(null);
    if (action === "retry") void workflow.retry();
    else void workflow.cancel();
  };

  const acceptFile = (file: File | undefined) => {
    if (!file || hasAttachedReference) return;
    workflow.setReferenceFile(file);
  };
  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    acceptFile(event.dataTransfer.files[0]);
  };

  if (active?.candidateStatus === "processing" || workflow.action === "generate") {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-canvas-lg border-hairline border-canvas-border bg-canvas-surface px-4 py-3">
        <div className="flex items-center gap-3">
          <Loader2 size={14} className="animate-spin text-canvas-ink-soft" />
          <div>
            <p className="text-canvas-md font-medium text-canvas-ink">Generating tattoo preview</p>
            <p className="mt-0.5 text-canvas-sm text-canvas-ink-soft">
              The current Cast stays unchanged until you accept.
            </p>
          </div>
        </div>
        <ActionError workflow={workflow} />
      </div>
    );
  }

  if (active?.candidateStatus === "ready") {
    const expires = expiryLabel(active.expiresAt);
    const expired = inkCandidateIsExpired(active.expiresAt);
    return (
      <div className="mx-auto w-full max-w-2xl rounded-canvas-lg border-hairline border-canvas-border bg-canvas-surface px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-canvas-xs font-medium uppercase tracking-[0.12em] text-canvas-ink">
                Preview
              </span>
              <span className="text-canvas-sm text-canvas-ink-faint">Not part of this Cast yet</span>
            </div>
            <p className="mt-1 truncate text-canvas-md font-medium text-canvas-ink">
              {active.description} · {active.locationLabel}
            </p>
            {expires && (
              <p className="mt-0.5 text-canvas-sm text-canvas-ink-soft">
                {expired ? "Expired" : `Available until ${expires}`}
              </p>
            )}
          </div>

          {confirmAction === null && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => void workflow.accept()}
                disabled={
                  expired
                  || controlsBusy
                  || workflow.candidateImage.phase !== "loaded"
                }
                className="rounded-canvas-pill bg-canvas-ink px-4 py-2 text-canvas-sm font-medium text-canvas-surface disabled:cursor-not-allowed disabled:opacity-35"
              >
                {workflow.action === "accept" ? "Accepting…" : "Accept"}
              </button>
              <button
                ref={retryTriggerRef}
                type="button"
                onClick={() => openConfirmation("retry")}
                disabled={expired || controlsBusy}
                className="rounded-canvas-pill border-hairline border-canvas-border-strong px-3.5 py-2 text-canvas-sm font-medium text-canvas-ink disabled:opacity-35"
              >
                Retry · {priceLabel}
              </button>
              <button
                ref={cancelTriggerRef}
                type="button"
                onClick={() => openConfirmation("cancel")}
                disabled={controlsBusy}
                className="px-2 py-2 text-canvas-sm font-medium text-canvas-ink-soft hover:text-canvas-ink disabled:opacity-35"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {workflow.candidateImage.phase === "loading" && (
          <p className="mt-2 text-canvas-sm text-canvas-ink-soft">
            Loading the private preview…
          </p>
        )}
        {workflow.candidateImage.phase === "unavailable" && (
          <div className="mt-2 flex items-center gap-2 text-canvas-sm text-canvas-ink-soft">
            <span>The private preview could not load. Nothing changed.</span>
            <button
              type="button"
              onClick={workflow.candidateImage.retry}
              className="font-medium text-canvas-ink underline underline-offset-2"
            >
              Try image again
            </button>
          </div>
        )}

        {confirmAction === "retry" && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t-hairline border-canvas-border pt-3">
            <p className="max-w-md text-canvas-sm leading-normal text-canvas-ink-soft">
              Retrying permanently replaces this preview, even if the next attempt fails.
            </p>
            <div className="flex items-center gap-2">
              <button
                ref={confirmSafeActionRef}
                type="button"
                onClick={dismissConfirmation}
                className="px-2 py-1.5 text-canvas-sm font-medium text-canvas-ink-soft"
              >
                Keep preview
              </button>
              <button
                type="button"
                onClick={() => commitConfirmation("retry")}
                disabled={expired || controlsBusy}
                className="inline-flex items-center gap-1.5 rounded-canvas-pill bg-canvas-ink px-3.5 py-1.5 text-canvas-sm font-medium text-canvas-surface disabled:opacity-35"
              >
                <RotateCcw size={11} />
                Retry · {priceLabel}
              </button>
            </div>
          </div>
        )}

        {confirmAction === "cancel" && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t-hairline border-canvas-border pt-3">
            <p className="max-w-md text-canvas-sm leading-normal text-canvas-ink-soft">
              The Cast stays unchanged. This removes the private preview and does not refund its completed generation.
            </p>
            <div className="flex items-center gap-2">
              <button
                ref={confirmSafeActionRef}
                type="button"
                onClick={dismissConfirmation}
                className="px-2 py-1.5 text-canvas-sm font-medium text-canvas-ink-soft"
              >
                Keep preview
              </button>
              <button
                type="button"
                onClick={() => commitConfirmation("cancel")}
                disabled={controlsBusy}
                className="rounded-canvas-pill border-hairline border-canvas-border-strong px-3.5 py-1.5 text-canvas-sm font-medium text-canvas-ink disabled:opacity-35"
              >
                Cancel preview
              </button>
            </div>
          </div>
        )}
        <ActionError workflow={workflow} />
      </div>
    );
  }

  if (!active) {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-canvas-lg border-hairline border-canvas-border bg-canvas-surface px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-canvas-md font-medium text-canvas-ink">
              {workflow.action === "plan"
                ? "Reading tattoo request"
                : "Tattoo request"}
            </p>
            <p className="mt-0.5 text-canvas-sm text-canvas-ink-soft">
              {workflow.action === "plan"
                ? "Checking the body location before any paid generation."
                : "Nothing was generated or charged."}
            </p>
          </div>
          {workflow.action !== "plan" && (
            <button
              type="button"
              onClick={workflow.closePanel}
              className="text-canvas-ink-faint hover:text-canvas-ink"
              aria-label="Close tattoo request"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {workflow.action === "plan" && (
          <Loader2
            size={14}
            className="mt-3 animate-spin text-canvas-ink-soft"
          />
        )}
        <ActionError workflow={workflow} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl rounded-canvas-lg border-hairline border-canvas-border bg-canvas-surface px-4 py-3">
      <div>
        <div>
          <p className="text-canvas-md font-medium text-canvas-ink">
            Review tattoo preview
          </p>
          <p className="mt-0.5 text-canvas-sm text-canvas-ink-soft">
            {active.description}
          </p>
          <p className="mt-1 text-canvas-xs font-medium uppercase tracking-[0.1em] text-canvas-ink-faint">
            {active.locationLabel}
          </p>
          {active.kind === "authoring" && (
            <p className="mt-1 text-canvas-xs text-canvas-ink-faint">
              Using {active.sourceViewLabel}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3">
        <div>
          <span className="mb-1.5 block text-canvas-xs font-medium text-canvas-ink-soft">
            Reference <span className="font-normal text-canvas-ink-faint">Optional</span>
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => acceptFile(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => {
              if (!hasAttachedReference) fileInputRef.current?.click();
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
            disabled={hasAttachedReference || controlsBusy}
            className="flex w-full items-center gap-3 rounded-canvas-md border-hairline border-dashed border-canvas-border-strong px-3 py-2 text-left disabled:cursor-default"
          >
            {workflow.referenceUrl ? (
              <img
                src={workflow.referenceUrl}
                alt=""
                className="h-10 w-10 flex-shrink-0 rounded-canvas-sm border-hairline border-canvas-border object-cover"
              />
            ) : (
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-canvas-sm bg-canvas-surface-inset text-canvas-ink-faint">
                <ImagePlus size={15} />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-canvas-sm font-medium text-canvas-ink">
                {hasAttachedReference
                  ? "Reference attached"
                  : workflow.referenceFile?.name ?? "Drop or choose an image"}
              </span>
              <span className="mt-0.5 block text-canvas-xs text-canvas-ink-faint">
                JPEG, PNG or WebP · up to 10 MB
              </span>
            </span>
          </button>
          {workflow.referenceError && (
            <p className="mt-1 text-canvas-xs text-canvas-ink-soft">
              {workflow.referenceError}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 border-t-hairline border-canvas-border pt-3">
        <p className="mb-3 text-canvas-xs leading-normal text-canvas-ink-soft">
          Generation creates a private 1K preview. Your Cast changes only after
          you accept it; affected views are listed before any later spend.
        </p>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void workflow.cancel()}
            disabled={controlsBusy}
            className="text-canvas-sm font-medium text-canvas-ink-soft hover:text-canvas-ink disabled:opacity-35"
          >
            Cancel request
          </button>
          <button
            type="button"
            onClick={() => void workflow.generate()}
            disabled={
              !workflow.capability
              || !canGenerate
              || controlsBusy
              || Boolean(workflow.referenceError)
            }
            className="rounded-canvas-pill bg-canvas-ink px-4 py-2 text-canvas-sm font-medium text-canvas-surface disabled:cursor-not-allowed disabled:opacity-35"
          >
            Generate preview · {priceLabel}
          </button>
        </div>
        {externallyBusy && workflow.action === null && (
          <p className="mt-2 text-right text-canvas-xs text-canvas-ink-faint">
            Finishing this request in another tab…
          </p>
        )}
        <ActionError workflow={workflow} />
      </div>
    </div>
  );
}
