import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface SecurityTabProps {
  user: {
    name?: string | null;
    email?: string | null;
  } | null;
  profileEmail?: string | null;
}

export function SecurityTab({ user, profileEmail }: SecurityTabProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const deleteAccountMutation = trpc.auth.deleteAccount.useMutation();

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
      toast.error(err.message || "Failed to delete account");
      setIsDeletingAccount(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-[#4D4D4D] mb-3">
          Connected Accounts
        </label>
        <div className="space-y-3">
          {[
            { provider: "Google", connected: true, email: profileEmail || user?.email },
            { provider: "Apple", connected: false, email: null },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                  {item.provider === "Google" ? (
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-[#0A0A0A]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-sm text-[#0A0A0A]">{item.provider}</p>
                  {item.connected ? (
                    <p className="text-xs text-[#757575]">{item.email}</p>
                  ) : (
                    <p className="text-xs text-[#757575]">Not connected</p>
                  )}
                </div>
              </div>
              <button
                className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                  item.connected
                    ? "bg-white border border-gray-200 text-[#4D4D4D] hover:bg-gray-50"
                    : "bg-[#0A0A0A] text-white hover:bg-[#0A0A0A]/90"
                }`}
              >
                {item.connected ? "Disconnect" : "Connect"}
              </button>
            </div>
          ))}
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
