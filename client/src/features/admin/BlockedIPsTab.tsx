import {
  Globe,
  Ban,
  Unlock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "./adminConstants";

interface BlockedIP {
  id: number;
  ipAddress: string;
  reason: string;
  blockedBy: number;
  expiresAt: string | null;
  createdAt: string;
}

interface BlockedIPsTabProps {
  ips: BlockedIP[];
  isLoading: boolean;
  onBlockIp: () => void;
  onUnblockIp: (ipAddress: string) => void;
  unblockPending: boolean;
}

export function BlockedIPsTab({
  ips,
  isLoading,
  onBlockIp,
  onUnblockIp,
  unblockPending,
}: BlockedIPsTabProps) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[#0A0A0A] font-semibold flex items-center gap-2">
          <Globe className="w-5 h-5 text-red-600" />
          Blocked IP Addresses
        </h3>
        <Button
          size="sm"
          onClick={onBlockIp}
          variant="destructive"
        >
          <Ban className="w-4 h-4 mr-2" />
          Block IP
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full bg-[#E5E5E5]" />
          ))}
        </div>
      ) : ips.length === 0 ? (
        <div className="text-center py-12 text-[#999]">
          <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No blocked IP addresses</p>
          <p className="text-sm mt-1">Block malicious IPs from the audit logs or manually add them here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ips.map((ip) => (
            <div
              key={ip.id}
              className="flex items-center justify-between p-4 rounded-lg bg-[#FAFAFA] hover:bg-[#F0F0F0] transition-colors border border-[#E5E5E5]"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[#0A0A0A]">{ip.ipAddress}</span>
                  {ip.expiresAt ? (
                    new Date(ip.expiresAt) > new Date() ? (
                      <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                        Expires {formatDate(new Date(ip.expiresAt))}
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-[#999] border-gray-200">Expired</Badge>
                    )
                  ) : (
                    <Badge className="bg-red-50 text-red-700 border-red-200">Permanent</Badge>
                  )}
                </div>
                <p className="text-sm text-[#666] mt-1">{ip.reason}</p>
                <p className="text-xs text-[#999] mt-1">
                  Blocked {formatDate(new Date(ip.createdAt))} by Admin #{ip.blockedBy}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onUnblockIp(ip.ipAddress)}
                disabled={unblockPending}
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                {unblockPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
