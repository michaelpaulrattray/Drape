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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "./moderatorConstants";

interface GenerationsSubTabProps {
  generationHistoryQuery: any;
  genStatusFilter: string;
  setGenStatusFilter: (v: string) => void;
  genTypeFilter: string;
  setGenTypeFilter: (v: string) => void;
  genPage: number;
  setGenPage: (fn: (p: number) => number) => void;
}

export function GenerationsSubTab({
  generationHistoryQuery,
  genStatusFilter,
  setGenStatusFilter,
  genTypeFilter,
  setGenTypeFilter,
  genPage,
  setGenPage,
}: GenerationsSubTabProps) {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-white">
          <Image className="w-4 h-4 text-violet-400" />
          Generation History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Generation Summary */}
        {generationHistoryQuery.data?.summary && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-center">
              <p className="text-xs text-emerald-400/60">Completed</p>
              <p className="text-sm font-bold text-emerald-400">{generationHistoryQuery.data.summary.completedCount}</p>
            </div>
            <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-center">
              <p className="text-xs text-red-400/60">Failed</p>
              <p className="text-sm font-bold text-red-400">{generationHistoryQuery.data.summary.failedCount}</p>
            </div>
            <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20 text-center">
              <p className="text-xs text-blue-400/60">Credits Used</p>
              <p className="text-sm font-bold text-blue-400">{generationHistoryQuery.data.summary.totalCreditsUsed}</p>
            </div>
          </div>
        )}

        {/* Generation Filters */}
        <div className="flex gap-2 mb-3">
          <Select value={genStatusFilter} onValueChange={(v) => { setGenStatusFilter(v); setGenPage(() => 0); }}>
            <SelectTrigger className="w-1/2 bg-white/5 border-white/10 text-white text-xs h-8">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
            </SelectContent>
          </Select>
          <Select value={genTypeFilter} onValueChange={(v) => { setGenTypeFilter(v); setGenPage(() => 0); }}>
            <SelectTrigger className="w-1/2 bg-white/5 border-white/10 text-white text-xs h-8">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="headshot">Headshot</SelectItem>
              <SelectItem value="full_body">Full Body</SelectItem>
              <SelectItem value="creative">Creative</SelectItem>
              <SelectItem value="background_swap">BG Swap</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Generation List */}
        {generationHistoryQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full bg-white/10" />
            ))}
          </div>
        ) : generationHistoryQuery.data?.generations.length === 0 ? (
          <p className="text-white/40 text-sm text-center py-4">No generations found</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {generationHistoryQuery.data?.generations.map((gen: any) => (
              <div key={gen.id} className="p-2.5 rounded bg-white/5 border border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {gen.status === "completed" ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    ) : gen.status === "failed" ? (
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <ClockIcon className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span className="text-sm text-white/80">#{gen.id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={
                      gen.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                      gen.status === "failed" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                      gen.status === "processing" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                      "bg-gray-500/10 text-gray-400 border-gray-500/20"
                    }>
                      {gen.status}
                    </Badge>
                    {gen.pointsCost > 0 && (
                      <span className="text-xs text-white/40">{gen.pointsCost} cr</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20 text-xs">
                    {(gen.type || "unknown").replace("_", " ")}
                  </Badge>
                  {gen.modelName && (
                    <span className="text-xs text-white/40 truncate">Model: {gen.modelName}</span>
                  )}
                </div>
                {gen.errorMessage && (
                  <p className="text-xs text-red-400/80 mt-1 truncate">Error: {gen.errorMessage}</p>
                )}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-white/30">{formatDate(new Date(gen.createdAt))}</span>
                  {gen.completedAt && gen.createdAt && (
                    <span className="text-xs text-white/30">{((new Date(gen.completedAt).getTime() - new Date(gen.createdAt).getTime()) / 1000).toFixed(1)}s</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Generation Pagination */}
        {(generationHistoryQuery.data?.total || 0) > 20 && (
          <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-3">
            <span className="text-xs text-white/40">
              Page {genPage + 1} of {Math.ceil((generationHistoryQuery.data?.total || 0) / 20)}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGenPage(p => Math.max(0, p - 1))}
                disabled={genPage === 0}
                className="border-white/20 text-white h-7 w-7 p-0"
              >
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGenPage(p => p + 1)}
                disabled={(genPage + 1) * 20 >= (generationHistoryQuery.data?.total || 0)}
                className="border-white/20 text-white h-7 w-7 p-0"
              >
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
