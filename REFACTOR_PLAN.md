# Router Refactor Plan — `server/routers.ts`

## Overview

The file `server/routers.ts` currently stands at **4,209 lines** containing 14 tRPC router sections, a 594-line helper function, and all associated imports. This plan breaks it into feature-based modules where no single file exceeds 400 lines.

## Current State

| Section | Lines | Range | Procedures |
|---|---|---|---|
| Imports + `executeApprovedAdminAction` | 594 | 1–655 | (helper fn) |
| `auth` | 33 | 659–691 | me, logout, deleteAccount |
| `credits` | 101 | 692–792 | getBalance, getTransactions, deduct, add, checkBalance, getCosts |
| `points` (legacy alias) | 35 | 793–827 | getBalance, getTransactions, checkBalance |
| `waitlist` | 58 | 828–885 | join, getStats |
| `models` | 178 | 886–1063 | create, list, get, update, delete |
| `generation` | 779 | 1064–1842 | castingImage, fullBody, multiView, generateAllViews, iterate, history, costs, upscale, proxyImage, enhance, generatePdf, mint |
| `profile` | 170 | 1843–2012 | get, update, uploadAvatar, uploadBanner, storageInfo |
| `registry` | 69 | 2013–2081 | lookup, verify |
| `billing` | 513 | 2082–2594 | getPlans, getStatus, createSubscriptionCheckout, createTopupCheckout, createPortalSession, cancelSubscription, reactivateSubscription, previewPlanChange, getInvoices, getAllInvoices, getSubscriptionDetails, changePlan |
| `usage` | 38 | 2595–2632 | getHistory, getStats, getDailyUsage |
| `newsletter` | 46 | 2633–2678 | subscribe, testConnection |
| `admin` | 1,124 | 2679–3802 | 25 procedures across 6 sub-sections |
| `moderator` | 407 | 3803–4209 | 14 procedures across 2 sub-sections |
| **Total** | **4,209** | | |

### Admin Sub-Sections

| Sub-Section | Lines | Range | Procedures |
|---|---|---|---|
| Slack Approval Flow | 108 | 2680–2787 | requestApproval, checkApprovalStatus, executeApproved |
| Audit Logs | 258 | 2788–3045 | getAuditLogs, getAbuseAlerts, getAuditStats, getAuditLogById, suspendUser, unsuspendUser, getUserDetails, exportAuditLogs |
| Role Management | 86 | 3046–3131 | changeUserRole |
| IP Blocking | 145 | 3132–3276 | blockIP, unblockIP, listBlockedIPs |
| User Management | 159 | 3277–3435 | listUsers, getUserStats, getUserFullDetails, adjustCredits, getUserActivity |
| Change Request Review | 366 | 3436–3801 | listChangeRequests, getChangeRequest, reviewChangeRequest, checkChangeRequestSlackStatus, executeChangeRequestAfterSlack |

## Target Structure

```
server/
├── routers.ts              (~60 lines — combines all sub-routers, exports appRouter + AppRouter)
├── routes/
│   ├── auth.ts             (~35 lines)
│   ├── credits.ts          (~140 lines — includes points legacy alias)
│   ├── waitlist.ts         (~60 lines)
│   ├── models.ts           (~180 lines)
│   ├── generation.ts       (~780 lines → will need further split)
│   ├── profile.ts          (~175 lines)
│   ├── registry.ts         (~70 lines)
│   ├── billing.ts          (~515 lines → over limit, see note)
│   ├── usage.ts            (~40 lines)
│   ├── newsletter.ts       (~50 lines)
│   ├── moderator.ts        (~410 lines)
│   └── admin/
│       ├── index.ts         (~50 lines — combines admin sub-routers)
│       ├── slackApproval.ts (~110 lines)
│       ├── auditLogs.ts     (~260 lines)
│       ├── roles.ts         (~90 lines)
│       ├── ipBlocking.ts    (~150 lines)
│       ├── users.ts         (~160 lines)
│       └── changeRequests.ts(~370 lines)
└── lib/
    └── adminActions.ts      (~595 lines → will need further split)
```

### Files That Exceed 500 Lines

Two files will still be over the 500-line hard limit after the initial split. These will be addressed in a follow-up pass:

1. **`routes/generation.ts`** (~780 lines) — can be split into `generation/casting.ts`, `generation/views.ts`, `generation/tools.ts`, and `generation/index.ts`.
2. **`server/lib/adminActions.ts`** (~595 lines) — can be split by action type (suspend, credits, IP, refund).
3. **`routes/billing.ts`** (~515 lines) — close to limit, acceptable for now.

For this refactor, the primary goal is to break the monolith. The secondary split of generation and adminActions can be a follow-up task.

## Consumers of `routers.ts`

These files import from `server/routers.ts` and must continue to work:

| File | Import |
|---|---|
| `server/_core/index.ts` | `appRouter` |
| `client/src/lib/trpc.ts` | `type AppRouter` |
| `server/auth.logout.test.ts` | `appRouter` |
| `server/credits.test.ts` | `appRouter` |
| `server/waitlist.test.ts` | `appRouter` |

Since `routers.ts` will still export `appRouter` and `AppRouter` from the same path, **no consumer changes are needed**.

## Execution Order

Each step is a checkpoint. After each step: typecheck passes, all 589 tests pass, no regressions.

| Step | Action | Files Changed | Risk |
|---|---|---|---|
| 1 | Create `server/routes/` directory, extract `adminActions` to `server/lib/adminActions.ts` | 2 new, 1 edited | Low |
| 2 | Extract `auth`, `credits` (+ points alias), `waitlist`, `newsletter` | 4 new, 1 edited | Low |
| 3 | Extract `models`, `profile`, `registry` | 3 new, 1 edited | Low |
| 4 | Extract `generation` | 1 new, 1 edited | Medium |
| 5 | Extract `billing`, `usage` | 2 new, 1 edited | Medium |
| 6 | Extract `admin` (split into sub-modules) | 7 new, 1 edited | High |
| 7 | Extract `moderator`, finalize `routers.ts` as index | 1 new, 1 rewritten | High |

## Import Pattern for Each Route File

Every route file will follow this pattern:

```ts
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
// ... feature-specific imports from ../db, ../stripeService, etc.

export const featureRouter = router({
  // procedures...
});
```

The main `routers.ts` becomes:

```ts
import { router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";
import { authRouter } from "./routes/auth";
import { creditsRouter, pointsRouter } from "./routes/credits";
// ... all other route imports

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  credits: creditsRouter,
  points: pointsRouter,
  // ...
});

export type AppRouter = typeof appRouter;
```
