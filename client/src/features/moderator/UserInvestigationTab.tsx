/**
 * USER INVESTIGATION — *"What has this account actually been doing?"*
 *
 * Brief 09 §5 gives this surface a pattern rather than a spec, and says so:
 * *"Without reading all 37KB I will not pretend to specify them row by row —
 * apply the pattern."* The pattern is §2's: **subject → verdict → evidence →
 * action.**
 *
 * ## ⚠ THE ONE PLACE HIS PICTURE AND THE TREE GENUINELY DISAGREED
 *
 * §4 describes Reconciliation as a working pane at 1240px. **It was not a pane
 * — it was the fourth sub-tab of a `lg:col-span-1` sidebar**, roughly 380px
 * wide, beside a two-thirds user list. That is *why* the discrepancy ended up
 * at 12px at the bottom of a six-row table: there was never room for it to be
 * anything else, and a brief drawn on a blank canvas could not know that.
 *
 * So the investigation opens **inside the account's own row**, using the
 * expansion `DataRow` already carries for exactly this — `subTabs`, `subTab`,
 * `panel`, described in the primitive as *"sub-tabs inside the expansion, only
 * where the record has them."* `.dp-table__panel` is the full table width, so
 * the discrepancy finally has room to be the largest figure on screen.
 *
 * That is not an invention: it is §5's own *"Subject first … one band, not
 * repeated in three widgets"*, plus brief 06's established behaviour — which
 * the founder himself picked out of that shift — *"click a person, act, close
 * — the next person is still where they were."*
 *
 * ⚠ **The first shape of this put the investigation in a panel BELOW the
 * table, and the browser is what found the fault**: `ExpandableRow` makes a row
 * clickable only when it has an expansion, so with the panel elsewhere the rows
 * had none and a click did nothing at all. The surface drew perfectly and was
 * inert. No source read could have caught it; law 6 did, on the first drive.
 *
 * **Every query, filter, export and mutation is untouched by the move.** The
 * same four sub-tabs mount the same four components with the same props.
 *
 * ## The search is the table's, not a second one
 *
 * It was a bespoke rounded input with its own magnifier. `TableSearch` is the
 * staff pattern and it already debounces; a second search box on a staff
 * surface is the thing brief 06 spent a shift removing.
 */
import { useState } from "react";

import { TableHead, TableSearch } from "@/foundation";

import { ActivitySubTab } from "./ActivitySubTab";
import { CreditsSubTab } from "./CreditsSubTab";
import { GenerationsSubTab } from "./GenerationsSubTab";
import { ReconciliationSubTab } from "./ReconciliationSubTab";
import { UserDetailCard, UserTable } from "./UserInvestigationWidgets";
import { type OpenChangeRequestOptions } from "./moderatorConstants";
import "./investigations.css";

interface UserInvestigationTabProps {
  usersQuery: any;
  userDetailsQuery: any;
  userActivityQuery: any;
  creditHistoryQuery: any;
  generationHistoryQuery: any;
  userSearchQuery: string;
  setUserSearchQuery: (v: string) => void;
  userPage: number;
  setUserPage: (fn: (p: number) => number) => void;
  selectedUserId: number | null;
  setSelectedUserId: (id: number | null) => void;
  userTotalPages: number;
  onOpenChangeRequest: (options?: OpenChangeRequestOptions) => void;
  creditTypeFilter: string;
  setCreditTypeFilter: (v: string) => void;
  creditPage: number;
  setCreditPage: (fn: (p: number) => number) => void;
  genStatusFilter: string;
  setGenStatusFilter: (v: string) => void;
  genTypeFilter: string;
  setGenTypeFilter: (v: string) => void;
  genPage: number;
  setGenPage: (fn: (p: number) => number) => void;
  creditStartDate: string;
  setCreditStartDate: (v: string) => void;
  creditEndDate: string;
  setCreditEndDate: (v: string) => void;
  genStartDate: string;
  setGenStartDate: (v: string) => void;
  genEndDate: string;
  setGenEndDate: (v: string) => void;
}

type DetailTab = "overview" | "credits" | "generations" | "reconciliation";

const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: "overview", label: "Activity" },
  { key: "credits", label: "Credits" },
  { key: "generations", label: "Generations" },
  { key: "reconciliation", label: "Reconciliation" },
];

export function UserInvestigationTab({
  usersQuery,
  userDetailsQuery,
  userActivityQuery,
  creditHistoryQuery,
  generationHistoryQuery,
  userSearchQuery,
  setUserSearchQuery,
  userPage,
  setUserPage,
  selectedUserId,
  setSelectedUserId,
  userTotalPages,
  onOpenChangeRequest,
  creditTypeFilter,
  setCreditTypeFilter,
  creditPage,
  setCreditPage,
  genStatusFilter,
  setGenStatusFilter,
  genTypeFilter,
  setGenTypeFilter,
  genPage,
  setGenPage,
  creditStartDate,
  setCreditStartDate,
  creditEndDate,
  setCreditEndDate,
  genStartDate,
  setGenStartDate,
  genEndDate,
  setGenEndDate,
}: UserInvestigationTabProps) {
  const [userDetailTab, setUserDetailTab] = useState<DetailTab>("overview");
  const [reconStartDate, setReconStartDate] = useState("");
  const [reconEndDate, setReconEndDate] = useState("");

  /*
    Every filter and page in the investigation resets when the subject changes.
    Unchanged from before the restructure — a moderator opening a second account
    on the first one's date range is reading the wrong numbers.
  */
  const handleSelectUser = (id: number | null) => {
    setSelectedUserId(id);
    setUserDetailTab("overview");
    setCreditPage(() => 0);
    setGenPage(() => 0);
    setCreditTypeFilter("all");
    setGenStatusFilter("all");
    setGenTypeFilter("all");
    setReconStartDate("");
    setReconEndDate("");
    setCreditStartDate("");
    setCreditEndDate("");
    setGenStartDate("");
    setGenEndDate("");
  };

  /*
    THE INVESTIGATION, built once and handed to the OPEN row (§5's four-part
    shape: subject → verdict → evidence → action). It lives inside the row's
    own expansion, which is brief 06's pattern and gives it the full table
    width — the reason the discrepancy can finally be the largest figure on
    screen instead of 12px at the bottom of a 380px sidebar.
  */
  const panel =
    selectedUserId === null ? null : (
      <div className="dp-inv__stack">
        <UserDetailCard
          userDetailsQuery={userDetailsQuery}
          selectedUserId={selectedUserId}
          onOpenChangeRequest={onOpenChangeRequest}
        />
        {userDetailTab === "overview" && (
          <ActivitySubTab
            userActivityQuery={userActivityQuery}
            onOpenChangeRequest={onOpenChangeRequest}
          />
        )}
        {userDetailTab === "credits" && (
          <CreditsSubTab
            creditHistoryQuery={creditHistoryQuery}
            userDetailsQuery={userDetailsQuery}
            creditTypeFilter={creditTypeFilter}
            setCreditTypeFilter={setCreditTypeFilter}
            creditPage={creditPage}
            setCreditPage={setCreditPage}
            startDate={creditStartDate}
            setStartDate={setCreditStartDate}
            endDate={creditEndDate}
            setEndDate={setCreditEndDate}
            selectedUserId={selectedUserId}
            onOpenChangeRequest={onOpenChangeRequest}
          />
        )}
        {userDetailTab === "generations" && (
          <GenerationsSubTab
            generationHistoryQuery={generationHistoryQuery}
            genStatusFilter={genStatusFilter}
            setGenStatusFilter={setGenStatusFilter}
            genTypeFilter={genTypeFilter}
            setGenTypeFilter={setGenTypeFilter}
            genPage={genPage}
            setGenPage={setGenPage}
            startDate={genStartDate}
            setStartDate={setGenStartDate}
            endDate={genEndDate}
            setEndDate={setGenEndDate}
            userId={selectedUserId}
          />
        )}
        {userDetailTab === "reconciliation" && (
          <ReconciliationSubTab
            userId={selectedUserId}
            startDate={reconStartDate}
            setStartDate={setReconStartDate}
            endDate={reconEndDate}
            setEndDate={setReconEndDate}
          />
        )}
      </div>
    );

  return (
    <div className="dp-inv__frame">
      <TableHead eyebrow="Accounts">
        <TableSearch
          value={userSearchQuery}
          onChange={(value) => {
            setUserSearchQuery(value);
            setUserPage(() => 0);
          }}
          label="Search accounts"
          /*
            ⚠ **"or id" IS NOT OFFERED, BECAUSE THE SERVER DOES NOT DO IT.**
            `listUsers` matches `name`, `email` and `openId` and never the
            numeric id (`server/db/admin.ts`) — the old placeholder read
            *"Search users by name, email, or ID…"* and typing an id returned
            nothing. A placeholder is a claim about a capability; this one was
            false before this PR and is not carried forward. The gap itself is
            filed as #420 rather than fixed here, because widening a query is a
            server change and this is a surface brief.
          */
          placeholder="Name or email"
        />
      </TableHead>

      <UserTable
        usersQuery={usersQuery}
        selectedUserId={selectedUserId}
        onSelectUser={handleSelectUser}
        userPage={userPage}
        setUserPage={setUserPage}
        userTotalPages={userTotalPages}
        subTabs={DETAIL_TABS.map(({ key, label }) => ({ value: key, label }))}
        subTab={userDetailTab}
        onSubTab={(value) => setUserDetailTab(value as DetailTab)}
        panel={panel}
      />
    </div>
  );
}
