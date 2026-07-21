interface ChangeIdentityDoorProps {
  onClick: () => void;
}

/** The only ordinary-draft door from refinement back into identity casting. */
export function ChangeIdentityDoor({ onClick }: ChangeIdentityDoorProps) {
  return (
    <button
      type="button"
      data-change-identity-door
      onClick={onClick}
      className="mt-3 w-full rounded-canvas-md border-hairline border-canvas-border-strong bg-canvas-surface px-3 py-2.5 text-left transition-colors hover:bg-canvas-surface-inset focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-canvas-ink"
    >
      <span className="block text-canvas-md font-medium text-canvas-ink">Change identity</span>
      <span className="mt-0.5 block text-canvas-sm text-canvas-ink-faint">
        Casts a separate draft person. This one stays unchanged.
      </span>
    </button>
  );
}
