/**
 * Settings → Security (brief §5).
 *
 * The brief's three rows are **Password**, **Two-factor authentication** and
 * **Active sessions**, with the instruction: *"Anything without a backend ships
 * inert with the stub treatment. A security section that omits 2FA reads as
 * `we don't have it`; a greyed row reads as `not yet`, which is the truth."*
 *
 * BRIEF-RECONCILIATION Q3, measured: **all three are unbuilt.** There is no
 * password-change procedure on any router, no two-factor column or table in
 * `drizzle/schema.ts`, and no sessions table — a session is a signed JWT in a
 * cookie, so there is nothing to list and nothing to revoke. All three are
 * stubs.
 *
 * ## ⚠ TWO ROWS ARE KEPT THAT THE BRIEF DOES NOT NAME, AND DROPPING THEM WOULD
 * HAVE BEEN A SILENT CAPABILITY LOSS
 *
 * The modal this replaces already carried **Export your data**
 * (`account.exportData`) and **Delete account** (`auth.deleteAccount`), both
 * live and both reachable only from here. The brief lists what the section
 * SHOULD gain, not what it may lose, and §8's own stub rules say *"never stub
 * something that already exists"* — so the two real controls stay, below the
 * three that are coming, with their behaviour unchanged (§1: the diff is where
 * and how, never what).
 *
 * The sign-in method row is kept for the same reason: it is read off
 * `authProvider`, which is real, and it answers the question the password row
 * raises for a Google account.
 *
 * ## ⚠ EVERY ROW IS ITS OWN BORDERED CARD, AND DELETE IS THE ACCENT ONE (#381)
 *
 * The prototype draws each action row as a card — `padding: 13px 15px; border:
 * 1px solid var(--borderCard); border-radius: 10px` — and draws the destructive
 * one differently: `--accentLine` border on `--accentWash`, with its label and
 * note in `--accentInk`. The brief's hairline grammar flattened all five into
 * one undivided column, so the one row you must not mis-click looked exactly
 * like the four you may. His ruling: the prototype wins on form.
 */
import { useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { Button, Field, Input } from "@/foundation";
import { ModalScrim } from "@/foundation/CastingModal";
import { logRawFailure, readableFailure } from "@/lib/failureSentence";

import { SettingsCard, SettingsGroup, StubControl, StubNote } from "../parts";

export function SecuritySection({
  user,
}: {
  user: { email?: string | null; authProvider?: string | null } | null;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [exporting, setExporting] = useState(false);

  const exportData = trpc.account.exportData.useQuery(undefined, { enabled: false });
  const deleteAccount = trpc.auth.deleteAccount.useMutation();

  const providerLabel =
    user?.authProvider === "google"
      ? "Google"
      : user?.authProvider === "email"
        ? "Email and password"
        : "Drape account";

  const runExport = async () => {
    setExporting(true);
    try {
      const result = await exportData.refetch();
      if (!result.data) return;
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `drape-data-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Your data has downloaded.");
    } catch (error) {
      logRawFailure("account.exportData", error);
      toast.error(readableFailure(error, "That export could not be made."));
    } finally {
      setExporting(false);
    }
  };

  const runDelete = async () => {
    try {
      await deleteAccount.mutateAsync({ confirmation: "DELETE" });
      toast.success("Account deleted.");
      window.setTimeout(() => {
        window.location.href = "/";
      }, 1200);
    } catch (error) {
      logRawFailure("auth.deleteAccount", error);
      toast.error(readableFailure(error, "That account could not be deleted."));
      setConfirmingDelete(false);
    }
  };

  return (
    <>
      <SettingsGroup title="Security">
        <SettingsCard label="Sign-in method" note={user?.email ?? ""}>
          <span className="dp-set__value">{providerLabel}</span>
        </SettingsCard>

        <SettingsCard label="Password" note="Changing your password from here is coming.">
          <StubControl reason="Changing a password from here is not built yet">
            <StubNote>CHANGE</StubNote>
          </StubControl>
        </SettingsCard>

        <SettingsCard
          label="Two-factor authentication"
          note="Not enabled — recommended for owners."
        >
          <StubControl reason="Two-factor authentication is not built yet">
            <StubNote>ENABLE</StubNote>
          </StubControl>
        </SettingsCard>

        <SettingsCard
          label="Active sessions"
          note="Seeing where you are signed in, and signing those places out, is coming."
        >
          <StubControl reason="Reviewing active sessions is not built yet">
            <StubNote>REVIEW</StubNote>
          </StubControl>
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup title="Your data">
        <SettingsCard
          label="Export your data"
          note="Everything on this account, as one JSON file."
        >
          <Button variant="secondary" size="small" onClick={runExport} disabled={exporting}>
            {exporting ? "Preparing…" : "Export"}
          </Button>
        </SettingsCard>

        <SettingsCard
          tone="accent"
          label="Delete account"
          note="Permanent. Your casts, boards and wardrobe go with it."
        >
          <Button
            variant="secondary"
            size="small"
            destructive
            onClick={() => setConfirmingDelete(true)}
          >
            Delete
          </Button>
        </SettingsCard>
      </SettingsGroup>

      {confirmingDelete ? (
        <DeleteAccountDialog
          busy={deleteAccount.isPending}
          onConfirm={runDelete}
          onDismiss={() => setConfirmingDelete(false)}
        />
      ) : null}
    </>
  );
}

/**
 * ⚠ **THE TYPED GATE IS CARRIED OVER DELIBERATELY.** The modal this section
 * replaces made you type `DELETE` before it would delete an account, and
 * §1 excludes what the mutations do — dropping the gate to reuse
 * `ConfirmDialog`, which has no input, would have weakened a destructive
 * confirmation while the diff claimed to be about where things live.
 *
 * `DestructiveConfirm` is the foundation's typed gate and it is cast-shaped: it
 * takes a portrait and matches a FIRST NAME, which is right in front of a
 * person and wrong in front of an account. So this is the same gate on the same
 * promoted SHELL — his #262 ruling, *"built on the promoted shell, not beside
 * it"* — with the word the old flow used.
 */
function DeleteAccountDialog({
  busy,
  onConfirm,
  onDismiss,
}: {
  busy: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const [typed, setTyped] = useState("");
  const armed = typed.trim().toUpperCase() === "DELETE";
  return (
    <ModalScrim
      label="Delete account"
      cardClassName="dp-topup__card"
      busy={busy}
      onDismiss={onDismiss}
    >
      <div className="dp-topup__pane">
        <p className="dp-topup__eyebrow">DELETE ACCOUNT</p>
        <h2 className="dp-topup__title">This cannot be undone</h2>
        <p className="dp-topup__reason">
          Your casts, boards and wardrobe are deleted with the account. Type DELETE to
          confirm.
        </p>
        <div style={{ marginTop: "var(--s-7)" }}>
          <Field compact>
            <Input
              autoFocus
              value={typed}
              aria-label="Type DELETE to confirm"
              placeholder="DELETE"
              onChange={(event) => setTyped(event.target.value)}
            />
          </Field>
        </div>
      </div>
      <div className="dp-topup__foot">
        <span className="dp-set__spacer" />
        <Button variant="quiet" size="small" onClick={onDismiss} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          size="small"
          destructive
          disabled={!armed || busy}
          onClick={onConfirm}
        >
          {busy ? "Deleting…" : "Delete account"}
        </Button>
      </div>
    </ModalScrim>
  );
}
