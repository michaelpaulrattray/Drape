import { ChevronLeft, ChevronRight, ClipboardList, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TYPE_CONFIG,
  StatusBadge,
  PriorityBadge,
  TypeIcon,
  formatRelativeTime,
} from "./ChangeRequestConstants";

interface ChangeRequest {
  id: number;
  type: string;
  title: string;
  status: string;
  priority: string;
  submittedByName?: string | null;
  submittedById: number;
  createdAt: string | Date | null;
}

interface ChangeRequestListProps {
  requests: ChangeRequest[];
  isLoading: boolean;
  selectedRequestId: number | null;
  onSelect: (id: number) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function ChangeRequestList({
  requests,
  isLoading,
  selectedRequestId,
  onSelect,
  page,
  totalPages,
  onPageChange,
}: ChangeRequestListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#999]" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12 text-[#999]">
        <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p>No change requests found</p>
        <p className="text-sm mt-1">Adjust your filters or check back later</p>
      </div>
    );
  }

  return (
    <>
      {requests.map((req) => {
        const typeConf = TYPE_CONFIG[req.type] || TYPE_CONFIG.other;
        const isSelected = selectedRequestId === req.id;
        return (
          <button
            key={req.id}
            onClick={() => onSelect(req.id)}
            className={`w-full text-left p-4 rounded-lg border transition-all ${
              isSelected
                ? "bg-white border-blue-400 ring-1 ring-blue-200"
                : "bg-white border-[#E5E5E5] hover:border-[#CCC] hover:shadow-sm"
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <TypeIcon type={req.type} />
                <span className="text-sm font-medium text-[#0A0A0A] truncate">{req.title}</span>
              </div>
              <span className="text-xs text-[#CCC] whitespace-nowrap">#{req.id}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={req.status} />
              <PriorityBadge priority={req.priority} />
              <Badge variant="outline" className="text-[10px] border-[#E5E5E5] text-[#999]">
                {typeConf.label}
              </Badge>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-[#999]">
              <span>by {req.submittedByName || `User ${req.submittedById}`}</span>
              <span>{formatRelativeTime(req.createdAt)}</span>
            </div>
          </button>
        );
      })}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={page === 0}
            onClick={() => onPageChange(Math.max(0, page - 1))}
            className="text-[#999] hover:text-[#0A0A0A]"
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Prev
          </Button>
          <span className="text-xs text-[#999]">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => onPageChange(page + 1)}
            className="text-[#999] hover:text-[#0A0A0A]"
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </>
  );
}
