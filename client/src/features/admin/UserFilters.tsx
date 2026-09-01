/**
 * Admin → Users, the section head and its filter cluster (brief 06 §3).
 *
 * ⚠ **THE SEARCH IS REAL AND STAYS REAL.** His §3, verbatim: *"The prototype
 * draws search as a grey chip because the prototype has no data. Admin search
 * works today — `onSearch`, Enter-to-submit, server-side. Keep it working. Do
 * not copy the topbar's stub treatment into a surface where the feature
 * exists."*
 *
 * What went: the separate **Search** button. It was a filled `bg-[#0A0A0A]` —
 * the app's one primary-action treatment — spent on submitting a search box.
 * Enter still submits; typing filters after 300ms.
 *
 * Status has five options and stays a select. Role has four and is segmented.
 * That decision is `TableFilter`'s, not this file's.
 */
import { TableFilter, TableHead, TableSearch, TableSort } from "@/foundation";

interface UserFiltersProps {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearch: (value: string) => void;
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
    <TableHead eyebrow="Users">
      <TableSearch
        label="Search users by name, email or id"
        placeholder="Name, email or id"
        value={searchInput}
        onChange={(value) => {
          onSearchInputChange(value);
          onSearch(value);
        }}
      />
      <TableFilter
        label="Status"
        value={statusFilter}
        onChange={(value) => onStatusFilterChange(value as UserFiltersProps["statusFilter"])}
        /* ⚠ "All statuses", not "All". Five options makes this a SELECT, and a
           closed select shows only its current value — so a bare "All" sat in
           the filter row saying nothing about what it filtered. Caught at the
           frame, not by an assertion (founder law 6). The segmented Role filter
           beside it needs no such help: it shows every option at once, which is
           the whole reason four-or-fewer is segmented. */
        options={[
          { value: "all", label: "All statuses" },
          { value: "active", label: "Active" },
          { value: "suspended", label: "Suspended" },
          { value: "frozen", label: "Frozen" },
          { value: "locked", label: "Locked" },
        ]}
      />
      <TableFilter
        label="Role"
        value={roleFilter}
        onChange={(value) => onRoleFilterChange(value as UserFiltersProps["roleFilter"])}
        options={[
          { value: "all", label: "All" },
          { value: "user", label: "Users" },
          { value: "moderator", label: "Moderators" },
          { value: "admin", label: "Admins" },
        ]}
      />
      <TableSort
        value={sortBy}
        onChange={(value) => onSortByChange(value as UserFiltersProps["sortBy"])}
        direction={sortOrder}
        onDirectionChange={onSortOrderChange}
        options={[
          { value: "createdAt", label: "Joined" },
          { value: "lastSignedIn", label: "Last active" },
          { value: "name", label: "Name" },
        ]}
      />
    </TableHead>
  );
}
