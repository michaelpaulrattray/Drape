/**
 * Blocked IPs tab — table of blocked IP addresses.
 */
import { Globe } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "./moderatorConstants";

interface BlockedIPsTabProps {
  blockedIpsQuery: any;
}

export function BlockedIPsTab({ blockedIpsQuery }: BlockedIPsTabProps) {
  return (
    <Card className="bg-white/5 border-white/10 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">IP Address</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">Reason</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">Blocked By</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">Expires</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase">Blocked At</th>
            </tr>
          </thead>
          <tbody>
            {blockedIpsQuery.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="px-4 py-3" colSpan={5}>
                    <Skeleton className="h-6 w-full bg-white/10" />
                  </td>
                </tr>
              ))
            ) : blockedIpsQuery.data?.ips.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-white/40">
                  <Globe className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No blocked IPs
                </td>
              </tr>
            ) : (
              blockedIpsQuery.data?.ips.map((ip: any) => (
                <tr key={ip.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 font-mono text-sm text-white">{ip.ipAddress}</td>
                  <td className="px-4 py-3 text-sm text-white/60">{ip.reason}</td>
                  <td className="px-4 py-3 text-sm text-white/60">Admin #{ip.blockedBy}</td>
                  <td className="px-4 py-3 text-sm text-white/60">
                    {ip.expiresAt ? formatDate(new Date(ip.expiresAt)) : "Permanent"}
                  </td>
                  <td className="px-4 py-3 text-sm text-white/60">
                    {formatDate(new Date(ip.createdAt))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
