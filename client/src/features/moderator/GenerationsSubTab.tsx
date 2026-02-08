/**
 * Generations sub-tab within User Investigation — shows generation history with filters.
 */
import {
  Image,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock as ClockIcon,
  Calendar,
  X,
  Download,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "./moderatorConstants";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface GenerationsSubTabProps {
  generationHistoryQuery: any;
  genStatusFilter: string;
  setGenStatusFilter: (v: string) => void;
  genTypeFilter: string;
  setGenTypeFilter: (v: string) => void;
  genPage: number;
  setGenPage: (fn: (p: number) => number) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  userId: number;
}

export function GenerationsSubTab({
  generationHistoryQuery,
  genStatusFilter,
  setGenStatusFilter,
  genTypeFilter,
  setGenTypeFilter,
  genPage,
  setGenPage,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  userId,
}: GenerationsSubTabProps) {
  const exportQuery = trpc.moderatorExports.exportUserGenerationHistoryCsv.useQuery(
    {
      userId,
      status: genStatusFilter as any,
      type: genTypeFilter as any,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    },
    { enabled: false }
  );

  const handleExportCsv = async () => {
    const result = await exportQuery.refetch();
    if (result.data) {
      const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `generation-history-user-${userId}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${result.data.total} generation records (${result.data.summary.failedCount} failed, ${result.data.summary.totalCreditsUsed} credits used)`);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image className="w-4 h-4 text-violet-600" />
          <h4 className="text-sm font-semibold text-[#0A0A0A]">Generation History</h4>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          disabled={exportQuery.isFetching}
          className="h-7 text-xs border-[#E5E5E5] text-[#666] hover:text-[#0A0A0A] hover:bg-[#F5F5F5]"
        >
          {exportQuery.isFetching ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
          Export CSV
        </Button>
      </div>

      {/* Generation Summary */}
      {generationHistoryQuery.data?.summary && (
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
            <p className="text-[10px] text-emerald-600">Completed</p>
            <p className="text-sm font-bold text-emerald-700">{generationHistoryQuery.data.summary.completedCount}</p>
          </div>
          <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-center">
            <p className="text-[10px] text-red-600">Failed</p>
            <p className="text-sm font-bold text-red-700">{generationHistoryQuery.data.summary.failedCount}</p>
          </div>
          <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-center">
            <p className="text-[10px] text-blue-600">Credits Used</p>
            <p className="text-sm font-bold text-blue-700">{generationHistoryQuery.data.summary.totalCreditsUsed}</p>
          </div>
        </div>
      )}

      {/* Generation Filters */}
      <div className="flex gap-2">
        <Select value={genStatusFilter} onValueChange={(v) => { setGenStatusFilter(v); setGenPage(() => 0); }}>
          <SelectTrigger className="w-1/2 bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A] text-xs h-8">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select value={genTypeFilter} onValueChange={(v) => { setGenTypeFilter(v); setGenPage(() => 0); }}>
          <SelectTrigger className="w-1/2 bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A] text-xs h-8">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="masterPrompt">Master Prompt</SelectItem>
            <SelectItem value="castingImage">Casting Image</SelectItem>
            <SelectItem value="fullBody">Full Body</SelectItem>
            <SelectItem value="multiView">Multi View</SelectItem>
            <SelectItem value="iteration">Iteration</SelectItem>
            <SelectItem value="upscale">Upscale</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date Range Filter */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#999] pointer-events-none" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setGenPage(() => 0); }}
            className="w-full h-8 pl-7 pr-2 rounded-lg bg-[#F8F8F8] border border-[#E5E5E5] text-[#0A0A0A] text-xs"
            placeholder="From"
          />
        </div>
        <span className="text-[#CCC] text-xs">–</span>
        <div className="relative flex-1">
          <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#999] pointer-events-none" />
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setGenPage(() => 0); }}
            className="w-full h-8 pl-7 pr-2 rounded-lg bg-[#F8F8F8] border border-[#E5E5E5] text-[#0A0A0A] text-xs"
            placeholder="To"
          />
        </div>
        {(startDate || endDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setStartDate(""); setEndDate(""); setGenPage(() => 0); }}
            className="h-8 w-8 p-0 text-[#999] hover:text-[#0A0A0A]"
            title="Clear dates"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Generation List */}
      {generationHistoryQuery.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full bg-[#E5E5E5]" />
          ))}
        </div>
      ) : generationHistoryQuery.data?.generations.length === 0 ? (
        <p className="text-[#999] text-sm text-center py-4">No generations found</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {generationHistoryQuery.data?.generations.map((gen: any) => (
            <div key={gen.id} className="p-2.5 rounded-lg bg-[#F8F8F8] border border-[#E5E5E5]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {gen.status === "completed" ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  ) : gen.status === "failed" ? (
                    <XCircle className="w-3.5 h-3.5 text-red-600" />
                  ) : (
                    <ClockIcon className="w-3.5 h-3.5 text-amber-600" />
                  )}
                  <span className="text-sm text-[#0A0A0A]">#{gen.id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={
                    gen.status === "completed" ? "bg-emerald-50 text-emerald-700" :
                    gen.status === "failed" ? "bg-red-50 text-red-700" :
                    gen.status === "processing" ? "bg-amber-50 text-amber-700" :
                    "bg-gray-100 text-gray-600"
                  }>
                    {gen.status}
                  </Badge>
                  {gen.pointsCost > 0 && (
                    <span className="text-xs text-[#999]">{gen.pointsCost} cr</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-violet-50 text-violet-700 text-xs">
                  {(gen.type || "unknown").replace("_", " ")}
                </Badge>
                {gen.modelName && (
                  <span className="text-xs text-[#999] truncate">Model: {gen.modelName}</span>
                )}
              </div>
              {gen.errorMessage && (
                <p className="text-xs text-red-600 mt-1 truncate">Error: {gen.errorMessage}</p>
              )}
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-[#CCC]">{formatDate(new Date(gen.createdAt))}</span>
                {gen.completedAt && gen.createdAt && (
                  <span className="text-[10px] text-[#CCC]">{((new Date(gen.completedAt).getTime() - new Date(gen.createdAt).getTime()) / 1000).toFixed(1)}s</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generation Pagination */}
      {(generationHistoryQuery.data?.total || 0) > 20 && (
        <div className="flex items-center justify-between pt-3 border-t border-[#E5E5E5]">
          <span className="text-xs text-[#999]">
            Page {genPage + 1} of {Math.ceil((generationHistoryQuery.data?.total || 0) / 20)}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGenPage(p => Math.max(0, p - 1))}
              disabled={genPage === 0}
              className="border-[#E5E5E5] text-[#666] h-7 w-7 p-0"
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGenPage(p => p + 1)}
              disabled={(genPage + 1) * 20 >= (generationHistoryQuery.data?.total || 0)}
              className="border-[#E5E5E5] text-[#666] h-7 w-7 p-0"
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
