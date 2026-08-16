import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Download, KeyRound } from "lucide-react";
import { logRawFailure, readableFailure } from "@/lib/failureSentence";

interface SecurityTabProps {
  user: {
    name?: string | null;
    email?: string | null;
    authProvider?: string | null;
  } | null;
  profileEmail?: string | null;
}

export function SecurityTab({ user, profileEmail }: SecurityTabProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const deleteAccountMutation = trpc.auth.deleteAccount.useMutation();
  const exportDataQuery = trpc.account.exportData.useQuery(undefined, { enabled: false });
  const providerLabel =
    user?.authProvider === "google"
      ? "Google"
      : user?.authProvider === "email"
        ? "Email & password"
        : "Drape account";

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const result = await exportDataQuery.refetch();
      if (result.data) {
        const json = JSON.stringify(result.data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const date = new Date().toISOString().split("T")[0];
        a.download = `drape-data-export-${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Data export downloaded successfully");
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to export data";
      if (msg.includes("Rate limit")) {
        toast.error("Please wait 5 minutes between data exports");
      } else {
        toast.error(msg);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setIsDeletingAccount(true);
    try {
      await deleteAccountMutation.mutateAsync({ confirmation: "DELETE" });
      toast.success("Account deleted. Redirecting...");
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    } catch (err: any) {
      logRawFailure('profile.deleteAccount', err);
      toast.error(readableFailure(err, "Failed to delete account"));
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-[#4D4D4D] mb-3">
          Sign-in method
        </label>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200">
          <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
            <KeyRound className="w-5 h-5 text-[#4D4D4D]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-[#0A0A0A]">{providerLabel}</p>
            <p className="text-xs text-[#757575] truncate">{profileEmail || user?.email}</p>
          </div>
        </div>
      </div>

      {/* Data Export (GDPR Article 20) */}
      <div>
        <label className="block text-sm font-medium text-[#4D4D4D] mb-3">
          Your Data
        </label>
        <div className="p-5 rounded-xl bg-gray-50 border border-gray-200">
          <p className="text-sm text-[#4D4D4D] mb-3">
            Download a copy of all your data including your profile, models, generations, credit history, and account activity.
          </p>
          <button
            onClick={handleExportData}
            disabled={isExporting}
            className="px-4 py-2.5 rounded-xl bg-[#0A0A0A] text-white text-sm font-medium hover:bg-[#0A0A0A]/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isExporting ? "Preparing export..." : "Download My Data"}
          </button>
          <p className="text-xs text-[#757575] mt-2">
            Limited to one export every 5 minutes. File is downloaded as JSON.
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[#4D4D4D] mb-3">
          Danger Zone
        </label>
        <div className="p-5 rounded-xl bg-red-50 border border-red-200">
          <p className="text-sm text-red-600 mb-3">Delete your account and all associated data. This action cannot be undone.</p>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2.5 rounded-xl bg-red-100 border border-red-200 text-red-600 text-sm font-medium hover:bg-red-200 transition-all"
            >
              Delete Account
            </button>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-red-700 font-medium">
                This will permanently delete your account, cancel any active subscription, and remove all your models and generated content. Type <span className="font-mono font-bold">DELETE</span> to confirm.
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full px-3 py-2 rounded-lg border border-red-300 bg-white text-red-900 placeholder-red-300 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== "DELETE" || isDeletingAccount}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isDeletingAccount && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isDeletingAccount ? "Deleting..." : "Permanently Delete"}
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                  disabled={isDeletingAccount}
                  className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-all disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
