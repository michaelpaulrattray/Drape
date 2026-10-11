import { useEffect, useRef, useState } from "react";

import { ModalScrim } from "@/foundation/CastingModal";
import { CAMPAIGN_NAME_MAX_LENGTH, campaignNameReady } from "@/features/castingV2/rosterChips";

/**
 * NAME A NEW CAMPAIGN (card #2250, rung N2c — his Desk reply #273: *"N2c —
 * Campaigns"*).
 *
 * The library's **+** chip opens this. It is the rename dialog's weight on
 * purpose — one field, a text edit, nothing paid and nothing permanent — and it
 * runs on the same `ModalScrim` shell, so focus, Escape and the scrim are the
 * shell's and not a second copy of them.
 *
 * A refusal from the server (a name this customer already uses) is shown
 * under the field in the server's own words and the dialog stays open, so the
 * customer edits the name rather than starting again.
 *
 * Kept free of the library page so the cast room's "Cast into a new campaign"
 * row (#2252) can open the same control — one control, two doors.
 *
 * **Given `currentName`, it renames instead (card #2273)** — the same box, the
 * name already in it and selected, and Save inert until the name has actually
 * changed. One naming control for a campaign, not a second copy of it.
 */
export function NewCampaignDialog({
  busy,
  error,
  onCancel,
  onCreate,
  currentName,
}: {
  busy: boolean;
  /** The last refusal, in words the customer can act on, or null. */
  error: string | null;
  onCancel: () => void;
  onCreate: (name: string) => void;
  /** Present = rename this campaign rather than make a new one (card #2273). */
  currentName?: string;
}) {
  const renaming = currentName !== undefined;
  const [name, setName] = useState(currentName ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = name.trim();
  const ready = campaignNameReady(name, currentName);

  useEffect(() => {
    inputRef.current?.focus();
    // Selected, so typing replaces the old name rather than appending to it.
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  const create = () => {
    if (!ready || busy) return;
    onCreate(trimmed);
  };

  return (
    <ModalScrim
      label={renaming ? "Rename campaign" : "New campaign"}
      cardClassName="dpc-renamem"
      busy={busy}
      onDismiss={onCancel}
    >
      <div>
        <span className="dpc-modal__eyebrow">{renaming ? "Campaign" : "New campaign"}</span>
        <h2 className="dpc-renamem__title">{renaming ? "Rename the campaign" : "Name the campaign"}</h2>
      </div>

      <div>
        <div className="dpc-modal__field">
          <input
            ref={inputRef}
            value={name}
            maxLength={CAMPAIGN_NAME_MAX_LENGTH}
            placeholder={currentName || "Campaign name"}
            disabled={busy}
            autoComplete="off"
            aria-label="Campaign name"
            aria-invalid={error ? true : undefined}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") create();
            }}
          />
        </div>
        {error ? (
          <p className="dpc-renamem__helper dpc-newcampaign__error" role="alert">{error}</p>
        ) : (
          <p className="dpc-renamem__helper">
            {renaming
              ? "Only the name changes. The cast members in it stay as they are."
              : "A cast member can be in more than one campaign."}
          </p>
        )}
      </div>

      <div className="dpc-modal__actions">
        <button type="button" className="dpc-renamem__secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={ready ? "dpc-renamem__primary is-ready" : "dpc-renamem__primary"}
          disabled={busy || !ready}
          onClick={create}
        >
          {renaming ? (busy ? "Saving…" : "Save name") : (busy ? "Creating…" : "Create campaign")}
        </button>
      </div>
    </ModalScrim>
  );
}
