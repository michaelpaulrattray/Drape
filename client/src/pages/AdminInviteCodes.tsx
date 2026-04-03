import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Redirect } from "wouter";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { AdminHeader } from "@/features/admin/AdminHeader";
import {
  Copy,
  Check,
  Ban,
  Shuffle,
  Plus,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ─── helpers ─── */

type CodeStatus = "active" | "used_up" | "expired" | "deactivated";

const STATUS_STYLES: Record<CodeStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  used_up: "bg-amber-50 text-amber-700 border-amber-200",
  expired: "bg-gray-100 text-gray-500 border-gray-200",
  deactivated: "bg-red-50 text-red-600 border-red-200",
};

const STATUS_LABELS: Record<CodeStatus, string> = {
  active: "Active",
  used_up: "Used up",
  expired: "Expired",
  deactivated: "Deactivated",
};

function generateRandomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `DRAPE-${seg()}-${seg()}`;
}

function formatDate(d: string | Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ─── page ─── */

export default function AdminInviteCodes() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  /* ─── form state ─── */
  const [code, setCode] = useState(generateRandomCode);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const isAdmin = isAuthenticated && user?.role === "admin";

  /* ─── queries / mutations ─── */
  const codesQuery = trpc.admin.listInviteCodes.useQuery(undefined, {
    enabled: isAdmin,
    staleTime: 10_000,
  });

  const utils = trpc.useUtils();

  const createMutation = trpc.admin.createInviteCode.useMutation({
    onSuccess: () => {
      toast.success("Invite code created");
      utils.admin.listInviteCodes.invalidate();
      setCode(generateRandomCode());
      setMaxUses(1);
      setExpiresInDays(null);
      setNote("");
    },
    onError: (err) => toast.error(err.message),
  });

  const deactivateMutation = trpc.admin.deactivateInviteCode.useMutation({
    onSuccess: () => {
      toast.success("Code deactivated");
      utils.admin.listInviteCodes.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreate = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!code.trim()) return;
      createMutation.mutate({
        code: code.trim(),
        maxUses,
        expiresInDays,
        note: note.trim() || null,
      });
    },
    [code, maxUses, expiresInDays, note, createMutation]
  );

  const handleCopy = useCallback((id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  /* ─── auth guards ─── */
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#EBEBEB] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0A0A0A]" />
      </div>
    );
  }
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (user?.role !== "admin") {
    toast.error("Access denied. Admin privileges required.");
    return <Redirect to="/studio" />;
  }

  const codes = codesQuery.data ?? [];

  return (
    <div className="min-h-screen bg-[#EBEBEB] text-[#0A0A0A]">
      <AdminHeader title="Invite Codes" />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ─── Generate form ─── */}
        <section className="bg-white rounded-2xl border border-[#E5E5E5] p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-[#0A0A0A] mb-4">
            Generate new code
          </h2>

          <form onSubmit={handleCreate} className="space-y-4">
            {/* Row 1: code + randomize */}
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="DRAPE-XXXX-XXXX"
                className="flex-1 h-10 px-3 rounded-full border border-[#D5D5D5] bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20"
                required
                maxLength={32}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full border-[#D5D5D5] h-10 px-3"
                onClick={() => setCode(generateRandomCode())}
              >
                <Shuffle className="w-4 h-4" />
              </Button>
            </div>

            {/* Row 2: max uses + expiry + note */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[#999] mb-1">Max uses</label>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={maxUses}
                  onChange={(e) => setMaxUses(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-full border border-[#D5D5D5] bg-white text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20"
                />
              </div>
              <div>
                <label className="block text-xs text-[#999] mb-1">
                  Expires in (days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={expiresInDays ?? ""}
                  onChange={(e) =>
                    setExpiresInDays(e.target.value ? Number(e.target.value) : null)
                  }
                  placeholder="Never"
                  className="w-full h-9 px-3 rounded-full border border-[#D5D5D5] bg-white text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20"
                />
              </div>
              <div>
                <label className="block text-xs text-[#999] mb-1">Note</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. For @mike"
                  maxLength={256}
                  className="w-full h-9 px-3 rounded-full border border-[#D5D5D5] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={createMutation.isPending || !code.trim()}
              className="bg-[#0A0A0A] hover:bg-[#222] text-white rounded-full h-10 px-5 text-sm"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Create code
            </Button>
          </form>
        </section>

        {/* ─── Table ─── */}
        <section className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0A0A0A]">
              All codes{" "}
              <span className="text-[#999] font-normal">({codes.length})</span>
            </h2>
            {codesQuery.isRefetching && (
              <Loader2 className="w-4 h-4 animate-spin text-[#999]" />
            )}
          </div>

          {/* Loading */}
          {codesQuery.isLoading && (
            <div className="p-10 text-center text-[#999] text-sm">
              Loading codes...
            </div>
          )}

          {/* Empty */}
          {!codesQuery.isLoading && codes.length === 0 && (
            <div className="p-10 text-center text-[#999] text-sm">
              No invite codes yet. Create one above.
            </div>
          )}

          {/* Table */}
          {codes.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-[#999] border-b border-[#E5E5E5]">
                    <th className="px-5 py-2.5 font-medium">Code</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium text-center">Uses</th>
                    <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Created</th>
                    <th className="px-3 py-2.5 font-medium hidden md:table-cell">Expires</th>
                    <th className="px-3 py-2.5 font-medium hidden lg:table-cell">Note</th>
                    <th className="px-3 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => {
                    const status = c.status as CodeStatus;
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-[#F0F0F0] last:border-b-0 hover:bg-[#FAFAFA] transition-colors"
                      >
                        {/* Code */}
                        <td className="px-5 py-3 font-mono text-xs tracking-wide">
                          {c.code}
                        </td>

                        {/* Status badge */}
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_STYLES[status]}`}
                          >
                            {STATUS_LABELS[status]}
                          </span>
                        </td>

                        {/* Uses */}
                        <td className="px-3 py-3 text-center tabular-nums text-xs">
                          {c.currentUses}/{c.maxUses}
                        </td>

                        {/* Created */}
                        <td className="px-3 py-3 text-xs text-[#999] hidden sm:table-cell">
                          {formatDate(c.createdAt)}
                        </td>

                        {/* Expires */}
                        <td className="px-3 py-3 text-xs text-[#999] hidden md:table-cell">
                          {formatDate(c.expiresAt)}
                        </td>

                        {/* Note */}
                        <td className="px-3 py-3 text-xs text-[#999] hidden lg:table-cell max-w-[180px] truncate">
                          {c.note || "—"}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {/* Copy */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-[#999] hover:text-[#0A0A0A]"
                              onClick={() => handleCopy(c.id, c.code)}
                              title="Copy code"
                            >
                              {copiedId === c.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </Button>

                            {/* Deactivate */}
                            {status === "active" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-[#999] hover:text-red-600"
                                onClick={() =>
                                  deactivateMutation.mutate({ codeId: c.id })
                                }
                                disabled={deactivateMutation.isPending}
                                title="Deactivate code"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
