/**
 * User Investigation tab — user list, detail sidebar with activity/credits/generations sub-tabs.
 */
import { useState } from "react";
import {
  Search,
  User,
  Activity,
  Coins,
  Image,
  ArrowRightLeft,
} from "lucide-react";
import {
  AuditLog,
  type OpenChangeRequestOptions,
} from "./moderatorConstants";
import { ActivitySubTab } from "./ActivitySubTab";
import { CreditsSubTab } from "./CreditsSubTab";
import { GenerationsSubTab } from "./GenerationsSubTab";
import { ReconciliationSubTab } from "./ReconciliationSubTab";
import { UserTable } from "./UserInvestigationWidgets";
import { UserDetailCard } from "./UserInvestigationWidgets";

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
  onSelectLog: (log: AuditLog) => void;
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

const DETAIL_TABS: { key: DetailTab; label: string; icon: typeof Activity }[] = [
  { key: "overview", label: "Activity", icon: Activity },
  { key: "credits", label: "Credits", icon: Coins },
  { key: "generations", label: "Generations", icon: Image },
  { key: "reconciliation", label: "Reconciliation", icon: ArrowRightLeft },
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
  onSelectLog,
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

  const handleSelectUser = (id: number) => {
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

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
        <input
          type="text"
          placeholder="Search users by name, email, or ID..."
          value={userSearchQuery}
          onChange={(e) => { setUserSearchQuery(e.target.value); setUserPage(() => 0); }}
          className="w-full pl-10 pr-4 py-2 bg-white border border-[#E5E5E5] rounded-xl text-sm text-[#0A0A0A] placeholder:text-[#CCC]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* User List */}
        <div className="lg:col-span-2">
          <UserTable
            usersQuery={usersQuery}
            selectedUserId={selectedUserId}
            onSelectUser={handleSelectUser}
            userPage={userPage}
            setUserPage={setUserPage}
            userTotalPages={userTotalPages}
          />
        </div>

        {/* User Detail Sidebar */}
        <div className="space-y-3">
          {selectedUserId ? (
            <>
              <UserDetailCard
                userDetailsQuery={userDetailsQuery}
                selectedUserId={selectedUserId}
                onOpenChangeRequest={onOpenChangeRequest}
              />

              {/* Sub-Tab Navigation */}
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-1 flex gap-0.5">
                {DETAIL_TABS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setUserDetailTab(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-1 justify-center ${
                      userDetailTab === key
                        ? "bg-[#0A0A0A] text-white"
                        : "text-[#999] hover:text-[#0A0A0A] hover:bg-[#F5F5F5]"
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                ))}
              </div>

              {userDetailTab === "overview" && (
                <ActivitySubTab userActivityQuery={userActivityQuery} onSelectLog={onSelectLog} />
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
                  userId={selectedUserId!}
                />
              )}
              {userDetailTab === "reconciliation" && selectedUserId && (
                <ReconciliationSubTab
                  userId={selectedUserId}
                  startDate={reconStartDate}
                  setStartDate={setReconStartDate}
                  endDate={reconEndDate}
                  setEndDate={setReconEndDate}
                />
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl border border-[#E5E5E5] py-12 text-center">
              <User className="w-8 h-8 mx-auto mb-3 text-[#CCC]" />
              <p className="text-[#999] text-sm">Select a user to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
