/**
 * Blocked IPs tab — table of blocked IP addresses.
 */
import { Globe } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "./moderatorConstants";

interface BlockedIPsTabProps {
  blockedIpsQuery: any;
}

export function BlockedIPsTab({ blockedIpsQuery }: BlockedIPsTabProps) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
              <th className="px-4 py-3 text-left text-[10px] font-medium text-[#999] uppercase tracking-wider">IP Address</th>
              <th className="px-4 py-3 text-left text-[10px] font-medium text-[#999] uppercase tracking-wider">Reason</th>
              <th className="px-4 py-3 text-left text-[10px] font-medium text-[#999] uppercase tracking-wider">Blocked By</th>
              <th className="px-4 py-3 text-left text-[10px] font-medium text-[#999] uppercase tracking-wider">Expires</th>
              <th className="px-4 py-3 text-left text-[10px] font-medium text-[#999] uppercase tracking-wider">Blocked At</th>
            </tr>
          </thead>
          <tbody>
            {blockedIpsQuery.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-[#F0F0F0]">
                  <td className="px-4 py-3" colSpan={5}>
                    <Skeleton className="h-6 w-full bg-[#E5E5E5]" />
                  </td>
                </tr>
              ))
            ) : blockedIpsQuery.data?.ips.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[#999]">
                  <Globe className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No blocked IPs
                </td>
              </tr>
            ) : (
              blockedIpsQuery.data?.ips.map((ip: any) => (
                <tr key={ip.id} className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors">
                  <td className="px-4 py-3 font-mono text-sm text-[#0A0A0A]">{ip.ipAddress}</td>
                  <td className="px-4 py-3 text-sm text-[#666]">{ip.reason}</td>
                  <td className="px-4 py-3 text-sm text-[#666]">Admin #{ip.blockedBy}</td>
                  <td className="px-4 py-3 text-sm text-[#666]">
                    {ip.expiresAt ? formatDate(new Date(ip.expiresAt)) : "Permanent"}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#666]">
                    {formatDate(new Date(ip.createdAt))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
