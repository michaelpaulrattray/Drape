import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserFiltersProps {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearch: () => void;
  statusFilter: "all" | "active" | "suspended" | "locked" | "frozen";
  onStatusFilterChange: (value: "all" | "active" | "suspended" | "locked" | "frozen") => void;
  roleFilter: "all" | "user" | "admin" | "moderator";
  onRoleFilterChange: (value: "all" | "user" | "admin" | "moderator") => void;
  sortBy: "createdAt" | "lastSignedIn" | "name";
  onSortByChange: (value: "createdAt" | "lastSignedIn" | "name") => void;
  sortOrder: "asc" | "desc";
  onSortOrderChange: (value: "asc" | "desc") => void;
}

export function UserFilters({
  searchInput,
  onSearchInputChange,
  onSearch,
  statusFilter,
  onStatusFilterChange,
  roleFilter,
  onRoleFilterChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
}: UserFiltersProps) {
  return (
    <div className="bg-white rounded-xl p-4 border border-[#E5E5E5]">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
            <Input
              placeholder="Search by name, email, or ID..."
              value={searchInput}
              onChange={(e) => onSearchInputChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              className="pl-10 bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A] placeholder:text-[#999]"
            />
          </div>
          <Button onClick={onSearch} className="bg-[#0A0A0A] hover:bg-[#222] text-white">
            Search
          </Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as typeof statusFilter)}>
            <SelectTrigger className="w-[130px] bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="frozen">Frozen</SelectItem>
              <SelectItem value="locked">Locked</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={(v) => onRoleFilterChange(v as typeof roleFilter)}>
            <SelectTrigger className="w-[120px] bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A]">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="user">Users</SelectItem>
              <SelectItem value="moderator">Moderators</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => onSortByChange(v as typeof sortBy)}>
            <SelectTrigger className="w-[140px] bg-[#F8F8F8] border-[#E5E5E5] text-[#0A0A0A]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">Join Date</SelectItem>
              <SelectItem value="lastSignedIn">Last Active</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")}
            className="border-[#E5E5E5] text-[#666] hover:bg-[#F0F0F0]"
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </Button>
        </div>
      </div>
    </div>
  );
}
