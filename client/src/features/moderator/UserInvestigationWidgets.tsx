/**
 * The user list and the subject band for Moderation → User investigation.
 *
 * ## ⚠ THE LIST WAS A HAND-ROLLED TABLE ONE BRIEF AFTER THAT WAS BANNED, AND
 * THE ARM THAT SHOULD HAVE HELD IT COULD NOT SEE IT
 *
 * Brief 06 §8 bans three things by name: a surface drawing its own `<table>`,
 * an `overflow-x-auto` scroller, and an Actions column. **This file had all
 * three, still, one brief later** — and not because #396 skipped it.
 *
 * `section06-guard.test.ts` derives its population as *files that mount
 * `<DataTable` or `<TableHead`*. This file mounted neither, so it was in no
 * population at all. Its own docblock claims *"a file that draws rows without
 * mounting `DataTable` is caught by the hand-rolling arm"* — **and that arm
 * iterates the same population.** An absence assertion over a set that cannot
 * contain the offender is green for the same reason an empty one is.
 *
 * The guard's population is widened in this PR to every `.tsx` under
 * `features/admin` and `features/moderator`, with this file's previous shape as
 * the positive control.
 *
 * ## The Actions column is gone, not moved
 *
 * Its only control was an eye icon that did what clicking the row already did.
 *
 * ## The freeze dialog is the promoted one now
 *
 * It was a fifth hand-rolled `Dialog` with `bg-emerald-600` and `bg-red-600`
 * confirms — his §4 on the green: *"a green primary on a security action, and
 * the only place in the product that would be green."* `ConfirmDialog` gained
 * an optional required-notes block in this PR precisely so this and the
 * unfreeze in `ReconciliationSubTab` could both stop drawing their own.
 *
 * ⚠ **`FREEZE_OR_UNFREEZE_MAX_LENGTH` survives the move and still must.** One
 * box submits to whichever procedure the button chose, so its room has to
 * satisfy both schemas; the dialog takes the number as a prop and derives its
 * counter from the same value, so the two cannot drift.
 */
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { RolePill, RowId, RowStack, StatePill, pageRange } from "@/features/staff";
import { Button, ConfirmDialog, DataTable } from "@/foundation";
import type { DataRow } from "@/foundation";
import { trpc } from "@/lib/trpc";
import { FREEZE_REASON_MAX_LENGTH, UNFREEZE_NOTES_MAX_LENGTH } from "@shared/inputLimits";

import { formatDate, type OpenChangeRequestOptions } from "./moderatorConstants";
import "./investigations.css";

/**
 * This dialog's single box submits to whichever procedure the button chose,
 * so the room it gives must satisfy BOTH schemas. Derived rather than picked:
 * on the day one of them moves, the narrower one wins without anybody editing
 * this line.
 */
const FREEZE_OR_UNFREEZE_MAX_LENGTH = Math.min(
  FREEZE_REASON_MAX_LENGTH,
  UNFREEZE_NOTES_MAX_LENGTH,
);

const PAGE_SIZE = 20;

// ── The list ──

export function UserTable({
  usersQuery,
  selectedUserId,
  onSelectUser,
  userPage,
  setUserPage,
  userTotalPages,
  subTabs,
  subTab,
  onSubTab,
  panel,
}: {
  usersQuery: any;
  selectedUserId: number | null;
  /** `null` closes the open investigation — never a sentinel number. */
  onSelectUser: (id: number | null) => void;
  userPage: number;
  setUserPage: (fn: (p: number) => number) => void;
  userTotalPages: number;
  /** The investigation's four sub-tabs, carried by the OPEN row only. */
  subTabs: { value: string; label: string }[];
  subTab: string;
  onSubTab: (value: string) => void;
  panel: ReactNode;
}) {
  const users: any[] = usersQuery.data?.users ?? [];
  /*
    ⚠ The REAL total, not `userTotalPages * PAGE_SIZE`. `pageRange`'s own
    docblock bans exactly that: *"rather than inventing a total from the page
    size."* The procedure returns one; the page count above it is derived from
    the same field.
  */
  const total: number | undefined = usersQuery.data?.total;

  const rows: DataRow[] = users.map((u) => ({
    id: String(u.id),
    /*
      ⚠ **THE INVESTIGATION IS THE ROW'S OWN EXPANSION, and that is brief 06's
      pattern rather than a workaround.** `DataRow` already carries `subTabs` /
      `subTab` / `panel` — *"sub-tabs inside the expansion, only where the
      record has them"* — which is precisely what an investigation is.

      It also answers the one place brief 09's picture and the tree disagreed:
      §4 draws Reconciliation as a working pane at 1240px, and it was living in
      a `lg:col-span-1` sidebar about 380px wide. `.dp-table__panel` is the full
      table width, so the discrepancy finally has room to be the largest figure
      on screen — and the founder's own words about this pattern hold:
      *"click a person, act, close — the next person is still where they were."*

      ⚠ Carried by the OPEN row only. Handing every row a rendered
      investigation would mount twenty copies of four queries.
    */
    ...(selectedUserId === u.id ? { subTabs, subTab, onSubTab, panel } : {}),
    /*
      ⚠ **EVERY ROW CARRIES ITS FACTS, AND THAT IS WHAT MAKES IT CLICKABLE AT
      ALL.** `ExpandableRow` computes `expandable` from `facts || evidence ||
      actions || panel`, and a row with none of them renders as plain markup
      with no click handler. The first shape of this table gave the panel to the
      open row only — so a closed row had nothing, and nothing could ever open.
      It drew perfectly and was inert; the browser found it, no source read
      could have.

      These five come from the LIST query and nothing else. Credits and plan
      live on the detail query and appear in the subject band once it is open —
      a fact drawn from a reader this row does not have would be a number no
      server produces.
    */
    facts: [
      { label: "ACCOUNT", value: `#${u.id}` },
      { label: "EMAIL", value: u.email || "—" },
      { label: "ROLE", value: u.role },
      { label: "JOINED", value: u.createdAt ? formatDate(new Date(u.createdAt)) : "—" },
      {
        label: "LAST ACTIVE",
        value: u.lastSignedIn ? formatDate(new Date(u.lastSignedIn)) : "Never",
      },
    ],
    cells: [
      <RowStack
        key="who"
        name={u.name || "Unnamed"}
        meta={
          <>
            <RowId>#{u.id}</RowId> {u.email}
          </>
        }
      />,
      <RolePill key="role" role={u.role} />,
      u.suspendedAt ? (
        <StatePill key="state" label="Suspended" attention />
      ) : u.frozenAt ? (
        <StatePill key="state" label="Frozen" attention />
      ) : (
        <StatePill key="state" label="Active" />
      ),
      /*
        ⚠ **`lastSignedIn`, NOT `lastLoginAt` — the one displayed value in this
        PR that changes, and it changes from a wrong one.** `moderator.listUsers`
        returns `lastSignedIn` (`server/routes/moderator.ts:153`); nothing has
        ever returned `lastLoginAt`, so this column read **"Never" for every
        account, always**, including accounts that signed in the same day.

        His §8 asks that every number be identical to before. This one is the
        stated exception rather than a quiet correction: a column headed *Last
        active* that cannot say anything but "Never" is not a number to
        preserve. Found by driving the surface, not by reading it.
      */
      <span key="seen">{u.lastSignedIn ? formatDate(new Date(u.lastSignedIn)) : "Never"}</span>,
    ],
  }));

  return (
    <DataTable
      columns={[
        { label: "User", width: "1 1 0" },
        { label: "Role", width: "0 0 104px" },
        { label: "State", width: "0 0 104px" },
        { label: "Last active", width: "0 0 148px" },
      ]}
      rows={rows}
      loading={usersQuery.isLoading}
      openId={selectedUserId === null ? null : String(selectedUserId)}
      onOpenChange={(id) => onSelectUser(id === null ? null : Number(id))}
      empty={{
        title: "No users match that search.",
        body: "Try a different name, email or id.",
      }}
      footer={{
        meta: pageRange({
          offset: userPage * PAGE_SIZE,
          count: users.length,
          total,
        }),
        onBack: () => setUserPage((p) => Math.max(0, p - 1)),
        onNext: () => setUserPage((p) => p + 1),
        backDisabled: userPage === 0,
        nextDisabled: userPage + 1 >= userTotalPages,
      }}
    />
  );
}

// ── Freeze / unfreeze, through the promoted dialog ──

function FreezeAction({
  userId,
  isFrozen,
  isAdmin,
  userName,
}: {
  userId: number;
  isFrozen: boolean;
  isAdmin: boolean;
  userName?: string;
}) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();

  const done = (message: string) => {
    toast.success(message);
    setOpen(false);
    utils.moderator.getUserDetails.invalidate({ userId });
    utils.moderatorReconciliation.getFlaggedUsers.invalidate();
  };

  const freezeMutation = trpc.moderatorReconciliation.freezeAccount.useMutation({
    onSuccess: () => done("Account frozen"),
    onError: (err) => toast.error(err.message || "Failed to freeze account"),
  });

  const unfreezeMutation = trpc.moderatorReconciliation.unfreezeAccount.useMutation({
    onSuccess: () => done("Account unfrozen"),
    onError: (err) => toast.error(err.message || "Failed to unfreeze account"),
  });

  if (isAdmin) return null;

  const busy = freezeMutation.isPending || unfreezeMutation.isPending;
  const displayName = userName || `User #${userId}`;

  return (
    <>
      <Button variant="secondary" size="small" destructive={!isFrozen} onClick={() => setOpen(true)}>
        {isFrozen ? "Unfreeze account" : "Freeze account"}
      </Button>
      {open && (
        <ConfirmDialog
          title={isFrozen ? "Unfreeze this account?" : "Freeze this account?"}
          body={
            isFrozen
              ? `${displayName} will be able to generate and spend credits again immediately.`
              : `${displayName} will be blocked from generating and from spending credits, and will see a frozen notice, until someone unfreezes them.`
          }
          notes={{
            label: isFrozen ? "Review notes (required)" : "Reason for freezing (required)",
            placeholder: isFrozen
              ? "Explain why the account is being unfrozen…"
              : "Explain why this account should be frozen…",
            maxLength: FREEZE_OR_UNFREEZE_MAX_LENGTH,
          }}
          cancelLabel="Cancel"
          confirmLabel={isFrozen ? "Unfreeze account" : "Freeze account"}
          busyLabel={isFrozen ? "Unfreezing…" : "Freezing…"}
          busy={busy}
          onCancel={() => setOpen(false)}
          onConfirm={(text) => {
            if (isFrozen) unfreezeMutation.mutate({ userId, notes: text });
            else freezeMutation.mutate({ userId, reason: text });
          }}
        />
      )}
    </>
  );
}

// ── The subject band (§5: "Subject first … one band, not repeated in three widgets") ──

export function UserDetailCard({
  userDetailsQuery,
  selectedUserId,
  onOpenChangeRequest,
}: {
  userDetailsQuery: any;
  selectedUserId: number;
  onOpenChangeRequest: (options?: OpenChangeRequestOptions) => void;
}) {
  if (userDetailsQuery.isLoading || !userDetailsQuery.data) return null;

  const user = userDetailsQuery.data.user;
  const credits = userDetailsQuery.data.credits;

  /*
    ⚠ **NO NAME, NO AVATAR, NO JOINED DATE HERE — the row above IS the
    subject.** His §5: *"Subject first. Who this account is, its state, when it
    joined, what it is on. One band, NOT REPEATED IN THREE WIDGETS."* The row's
    own cells and facts already say who and when; what this band adds is the two
    figures only the detail query knows, the states that need saying, and the
    actions.
  */
  return (
    <div className="dp-inv__stack">
      <div className="dp-inv__subjecthead">
        <div className="dp-inv__subjectfacts">
          <span className="dp-inv__fact">
            <span className="dp-inv__eyebrow">Credits</span>
            <span className="dp-inv__factvalue">{credits?.balance?.toLocaleString() ?? "—"}</span>
          </span>
          <span className="dp-inv__fact">
            <span className="dp-inv__eyebrow">Plan</span>
            <span className="dp-inv__factvalue">{credits?.planTier || "free"}</span>
          </span>
        </div>
      </div>

      {/*
        A state band only when there IS a state. His §4a: *"When the account is
        not frozen, no band. Do not add an 'account in good standing' card."*
      */}
      {user.suspendedAt && (
        <div className="dp-inv__subject">
          <div className="dp-inv__subjectbody">
            <p className="dp-inv__subjecttitle">Account suspended</p>
            <p className="dp-inv__subjectreason">{user.suspendedReason || "No reason recorded"}</p>
          </div>
        </div>
      )}
      {user.frozenAt && (
        <div className="dp-inv__subject">
          <div className="dp-inv__subjectbody">
            <p className="dp-inv__subjecttitle">Account frozen</p>
            <p className="dp-inv__subjectreason">{user.frozenReason || "No reason recorded"}</p>
          </div>
        </div>
      )}

      <div className="dp-inv__actions">
        <FreezeAction
          userId={selectedUserId}
          isFrozen={!!user.frozenAt}
          isAdmin={user.role === "admin"}
          userName={user.name || user.email}
        />
        <Button
          variant="secondary"
          size="small"
          onClick={() =>
            onOpenChangeRequest({
              type: "flag_account",
              targetUserId: selectedUserId.toString(),
              targetUserName: user.name || user.email || undefined,
            })
          }
        >
          Submit change request
        </Button>
      </div>
    </div>
  );
}
