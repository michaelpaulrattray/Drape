# Admin Pages Split Analysis

## AdminAuditLogs.tsx (1,025 lines)
- Lines 1-89: imports + constants (SEVERITY_CONFIG, CATEGORY_CONFIG, ACTION_LABELS, formatDate)
- Lines 90-147: Sub-components (SeverityBadge, CategoryBadge, ActionLabel)
- Lines 148-280: Main component state, queries, handlers
- Lines 280-520: Header + filters + summary cards JSX
- Lines 520-900: Log table + log detail modal
- Lines 900-1025: Pagination + closing

Split plan:
- adminConstants.ts: shared types, configs, formatDate (shared with AdminChangeRequests)
- AuditLogsFilters.tsx: filter bar + summary cards
- AuditLogTable.tsx: table rows + detail modal
- AdminAuditLogs.tsx: thin shell

## AdminUserManagement.tsx (947 lines)
- Lines 1-60: imports + helpers (StatusBadge, RoleBadge, formatDate)
- Lines 60-200: Main component state, queries, mutations, handlers
- Lines 200-510: Header + filters + user table + pagination
- Lines 510-777: User detail dialog (profile/credits/activity tabs)
- Lines 779-944: Suspend modal + credit modal + role change modal

Split plan:
- UserTable.tsx: user list table with filters + pagination
- UserDetailDialog.tsx: user detail dialog with 3 tabs
- UserActionModals.tsx: suspend + credit + role change modals
- AdminUserManagement.tsx: thin shell

## AdminChangeRequests.tsx (847 lines)
- Lines 1-88: imports + constants (TYPE_CONFIG, STATUS_CONFIG, PRIORITY_CONFIG)
- Lines 89-145: Sub-components (StatusBadge, PriorityBadge, TypeIcon, formatDate, formatRelativeTime)
- Lines 147-270: Main component state, queries, mutations, effects
- Lines 270-470: Header + summary cards + filters + request list
- Lines 470-760: Detail panel (header, body, credit/stripe/IP details, review info)
- Lines 764-847: Review confirmation dialog

Split plan:
- RequestList.tsx: request list with filters + pagination
- RequestDetailPanel.tsx: detail panel with all sections
- ReviewDialog.tsx: review confirmation dialog
- AdminChangeRequests.tsx: thin shell
