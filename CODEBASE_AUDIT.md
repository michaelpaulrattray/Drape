# FormaStudio Codebase Audit

**Date:** February 7, 2026
**Scope:** Full codebase — server, client, shared, config, docs
**Totals:** ~15,000 server source lines | ~10,000 test lines | ~30,000 client lines | 72 server source files | 33 test files | ~85 client files

---

## 1. Executive Summary

The codebase has grown organically from a single-app prototype into a multi-role platform (user, moderator, admin) with billing, Slack integrations, and AI generation. While the recent router refactor brought `routers.ts` under control, several structural problems remain:

- **5 server files and 8 client files exceed the 500-line hard limit**, with `db.ts` at 2,531 lines being the worst offender.
- **Server files are grouped by type** (all services flat in `server/`), not by domain — making it hard to understand which files belong to which feature.
- **Client pages are monolithic** — `CastingStudio.tsx` (2,299 lines), `ModeratorDashboard.tsx` (1,988 lines), and `Home.tsx` (1,614 lines) each contain multiple responsibilities.
- **Test files are orphaned** from their source — 33 test files sit flat in `server/` with no co-location to the code they test.
- **Root directory is cluttered** with 12+ markdown files that are research artifacts, not project documentation.

---

## 2. Files Over 500 Lines (Hard Limit Violations)

### Server Source Files

| File | Lines | Issue |
|---|---|---|
| `server/db.ts` | 2,531 | **72 exported functions** spanning 8+ domains (users, credits, models, billing, security, admin, change requests, waitlist). Single largest file in the codebase. |
| `server/geminiService.ts` | 1,035 | AI prompt construction + API calls + image processing all in one file. |
| `server/pdfService.ts` | 790 | PDF generation with inline layout/styling constants mixed with business logic. |
| `server/slackDispatcher.ts` | 719 | Centralized Slack message formatting + dispatch for all event types. |
| `server/stripeService.ts` | 675 | Checkout, subscriptions, refunds, customer management, webhook helpers all mixed. |
| `server/slackNotification.ts` | 674 | Three-channel notification routing + message builders. |
| `server/auditLog.ts` | 589 | Audit event types + logging + query helpers. |
| `server/webhooks.ts` | 504 | Stripe webhook handler with inline event processing. |
| `server/slackInteractions.ts` | 492 | Slack interactive message handler (just under limit but growing). |
| `server/routes/billing.ts` | 541 | Checkout + subscription + invoices + plan management in one router. |

### Client Files

| File | Lines | Issue |
|---|---|---|
| `pages/CastingStudio.tsx` | 2,299 | The entire Casting app page — form, generation, image viewer, export all in one component. |
| `pages/ModeratorDashboard.tsx` | 1,988 | 5+ tab panels (users, logs, change requests, credits, generations) in one file. |
| `pages/Home.tsx` | 1,614 | Landing page with 10+ sections, navigation, animations, all inline. |
| `pages/ComponentShowcase.tsx` | 1,437 | Dev-only showcase — not production code but still bloated. |
| `components/ProfileSettingsModal.tsx` | 1,147 | Profile editing + billing + credits + account deletion in one modal. |
| `pages/AdminAuditLogs.tsx` | 1,025 | Audit log viewer with inline filtering, pagination, detail modals. |
| `pages/AdminUserManagement.tsx` | 947 | User list + detail panel + actions all in one file. |
| `pages/AdminChangeRequests.tsx` | 847 | Change request list + review + approval flow in one file. |
| `components/DNAHelix.tsx` | 703 | WebGL animation component — complex but single-purpose (acceptable for graphics). |
| `pages/Dashboard.tsx` | 688 | Dashboard with stats, models, credits, quick actions. |

### Test Files Over 500 Lines

| File | Lines | Note |
|---|---|---|
| `server/changeRequests.test.ts` | 1,826 | Largest test file — covers the full CR lifecycle. |
| `server/webhookSecurity.test.ts` | 603 | Webhook security edge cases. |
| `server/moderator.test.ts` | 564 | Moderator role tests. |
| `server/slackApproval.test.ts` | 527 | Slack approval flow tests. |

---

## 3. Naming Issues

### Inconsistent Naming Conventions

| Issue | Examples |
|---|---|
| **camelCase vs. kebab-case** | `slackDispatcher.ts` vs `adminActions/` directory, `castingStudio.test.ts` vs `auth.logout.test.ts` |
| **Test file naming** | Some use `feature.test.ts` (e.g., `billing.test.ts`), others use `featureAction.test.ts` (e.g., `auth.logout.test.ts`), others use `featureNoun.test.ts` (e.g., `slackThreeChannel.test.ts`) |
| **Vague names** | `db.ts` (2,531 lines of everything), `aiService.ts` (wrapper) vs `geminiService.ts` (actual implementation) — unclear which to use |
| **Redundant prefixes** | `slackApproval.ts`, `slackDispatcher.ts`, `slackInteractions.ts`, `slackNotification.ts` — 4 files with `slack` prefix that could be in a `slack/` directory |
| **Legacy files** | `HomeOld.tsx` still in pages (347 lines of dead code) |

### Unclear Responsibility Boundaries

| File | Claimed Purpose | Actual Content |
|---|---|---|
| `server/aiService.ts` | "AI Service" | Thin wrapper that calls `geminiService.ts` — unclear why both exist |
| `server/heroProxy.ts` | "Hero proxy" | CORS proxy for 3D hero textures — infrastructure concern mixed with features |
| `client/src/components/ProfileSettingsModal.tsx` | "Profile settings" | Profile + billing + credits + account deletion — 4 features in 1 modal |
| `client/src/lib/motion.ts` | "Motion" | 407 lines of animation utilities — belongs with design system |

---

## 4. Mixed Responsibilities

### `server/db.ts` — The God File (2,531 lines, 72 exports)

This is the most critical issue. Every domain's database queries live in one file:

| Domain | Functions | Approx Lines |
|---|---|---|
| User management | `upsertUser`, `getUserById`, `getUserByOpenId`, `listAllUsers`, `getUserFullDetails`, `getUserStatistics` | ~400 |
| Credits/Points | `getUserCredits`, `addCredits`, `deductCredits`, `getCreditTransactions`, `adjustUserCredits`, `getDetailedCreditHistory` | ~350 |
| Models | `createModel`, `getModelById`, `getUserModels`, `updateModel`, `mintModel`, `deleteModel` | ~200 |
| Model Assets | `createModelAsset`, `getModelAssets`, `getModelAssetByView`, `getModelAssetsForCleanup`, `deleteModelWithAssetKeys` | ~150 |
| Generations | `createGeneration`, `updateGeneration`, `getUserGenerations`, `getGenerationById`, `getDetailedGenerationHistory` | ~250 |
| Billing/Subscriptions | `updateUserSubscription`, `getUserByStripeCustomerId`, `refreshMonthlyCredits`, `addTopupCredits`, `getSubscriptionByUserId`, `getCreditHistory` | ~250 |
| Waitlist | `addToWaitlist`, `getWaitlistPosition`, `getWaitlistCount`, `checkEmailOnWaitlist` | ~100 |
| Security | `suspendUser`, `unsuspendUser`, `recordFailedLogin`, `resetFailedLogins`, `isAccountLocked` | ~200 |
| IP Blocking | `isIpBlocked`, `blockIp`, `unblockIp`, `getBlockedIps` | ~100 |
| Profile | `updateUserProfile`, `getUserStorageInfo`, `updateUserStorageUsed` | ~100 |
| Usage Stats | `getUsageStats`, `getDailyUsage` | ~150 |
| Change Requests | `createChangeRequest`, `getChangeRequestById`, `listChangeRequests`, `updateChangeRequestStatus`, `getChangeRequestsByModerator` | ~250 |
| Emergency Tokens | `createEmergencyToken`, `consumeEmergencyToken` | ~100 |
| Roles | `updateUserRole` | ~50 |

### Slack Files — Scattered Across 5 Files (3,347 lines total)

Five Slack-related files sit flat in `server/` with no grouping:
- `slackApproval.ts` (462) — approval flow state machine
- `slackDispatcher.ts` (719) — message formatting + dispatch
- `slackInteractions.ts` (492) — interactive message handler
- `slackNotification.ts` (674) — three-channel notification routing
- `routes/admin/slackApproval.ts` (119) — tRPC procedures for Slack

Plus 4 test files (1,417 lines). These are all part of the same "Slack integration" domain.

### Client `components/` — Mixed Concerns

The flat `components/` directory contains:
- **Feature-specific components**: `BillingModal.tsx`, `CreditTopupModal.tsx`, `LowBalanceWarning.tsx` (billing domain)
- **App-specific components**: `HairColorWheel.tsx`, `TriBlendSelector.tsx`, `DNAHelix.tsx` (casting domain)
- **Layout components**: `DashboardLayout.tsx`, `AppLayout.tsx`, `Navigation.tsx` (infrastructure)
- **Generic UI**: `ErrorBoundary.tsx`, `Tooltip.tsx`, `ManusDialog.tsx` (shared)
- **Template components**: `AIChatBox.tsx`, `Map.tsx` (unused template components)

---

## 5. Poor Grouping — Current vs. Proposed

### Current Server Structure (Flat)

```
server/
├── _core/                    # Framework (don't touch)
├── lib/adminActions/         # ✅ Recently refactored
├── routes/                   # ✅ Recently refactored
│   ├── admin/
│   ├── generation/
│   ├── auth.ts, billing.ts, credits.ts, models.ts, moderator.ts,
│   │   newsletter.ts, profile.ts, registry.ts, usage.ts, waitlist.ts
├── db.ts                     # ❌ 2,531 lines — GOD FILE
├── geminiService.ts          # ❌ 1,035 lines
├── pdfService.ts             # ❌ 790 lines
├── slackDispatcher.ts        # ❌ 719 lines — scattered Slack
├── stripeService.ts          # ❌ 675 lines
├── slackNotification.ts      # ❌ 674 lines — scattered Slack
├── auditLog.ts               # ❌ 589 lines
├── webhooks.ts               # ❌ 504 lines
├── slackInteractions.ts      # ❌ 492 lines — scattered Slack
├── slackApproval.ts          # ❌ 462 lines — scattered Slack
├── rateLimit.ts              # 357 lines
├── aiService.ts              # 349 lines (wrapper for geminiService)
├── adminSecurity.ts          # 334 lines
├── deleteUserData.ts         # 277 lines
├── klaviyo.ts                # 253 lines
├── atomicCredits.ts          # 172 lines
├── storage.ts                # 124 lines
├── stripeProducts.ts         # 85 lines
├── heroProxy.ts              # 81 lines
├── securityHeaders.ts        # 71 lines
├── *.test.ts (x33)           # ❌ All tests flat, no co-location
```

### Proposed Server Structure (Domain-Based)

```
server/
├── _core/                          # Framework (unchanged)
├── routes/                         # tRPC routers (already refactored ✅)
│   ├── admin/
│   ├── generation/
│   ├── auth.ts, billing.ts, credits.ts, models.ts, moderator.ts,
│   │   newsletter.ts, profile.ts, registry.ts, usage.ts, waitlist.ts
├── db/                             # ← SPLIT db.ts into domain modules
│   ├── index.ts                    # Re-exports everything (backward compat)
│   ├── connection.ts               # getDb(), shared drizzle instance
│   ├── users.ts                    # User CRUD, profile, storage
│   ├── credits.ts                  # Credits/points operations
│   ├── models.ts                   # Model + asset CRUD
│   ├── generations.ts              # Generation CRUD + history
│   ├── billing.ts                  # Subscription, topup, credit history
│   ├── waitlist.ts                 # Waitlist operations
│   ├── security.ts                 # Suspend, lock, failed logins
│   ├── ipBlocking.ts               # IP block/unblock
│   ├── changeRequests.ts           # Change request CRUD
│   └── admin.ts                    # listAllUsers, getUserFullDetails, stats
├── slack/                          # ← GROUP all Slack files
│   ├── approval.ts                 # Slack approval flow
│   ├── dispatcher.ts               # Message formatting + dispatch
│   ├── interactions.ts             # Interactive message handler
│   ├── notification.ts             # Three-channel routing
│   └── __tests__/                  # Co-located tests
│       ├── approval.test.ts
│       ├── dispatcher.test.ts
│       ├── interactions.test.ts
│       └── notification.test.ts
├── stripe/                         # ← GROUP all Stripe files
│   ├── service.ts                  # Core Stripe operations
│   ├── webhooks.ts                 # Webhook handler
│   ├── products.ts                 # Product/price config
│   └── __tests__/
│       ├── billing.test.ts
│       ├── webhookSecurity.test.ts
│       └── stripeRefund.test.ts
├── casting/                        # ← GROUP casting-specific services
│   ├── geminiService.ts            # Gemini API integration
│   ├── aiService.ts                # tRPC wrapper (or merge into gemini)
│   ├── pdfService.ts               # PDF generation
│   └── __tests__/
│       ├── gemini.test.ts
│       ├── aiService.test.ts
│       ├── pdfService.test.ts
│       └── castingStudio.test.ts
├── security/                       # ← GROUP security concerns
│   ├── adminSecurity.ts            # Immutable logs, emergency tokens
│   ├── rateLimit.ts                # Rate limiting middleware
│   ├── securityHeaders.ts          # HTTP security headers
│   ├── deleteUserData.ts           # Account deletion
│   └── __tests__/
│       ├── adminSecurity.test.ts
│       ├── rateLimit.test.ts
│       ├── securityHeaders.test.ts
│       └── deleteUserData.test.ts
├── integrations/                   # ← External service integrations
│   ├── klaviyo.ts                  # Klaviyo email marketing
│   └── __tests__/
│       └── klaviyo.test.ts
├── lib/                            # ← Shared utilities
│   ├── adminActions/               # (already refactored ✅)
│   ├── atomicCredits.ts            # Atomic credit deduction
│   ├── auditLog.ts                 # Audit logging system
│   └── heroProxy.ts                # CORS proxy for hero textures
├── storage.ts                      # S3 helpers (framework-adjacent)
├── routers.ts                      # Router index (already slim ✅)
```

### Current Client Structure

```
client/src/
├── _core/hooks/useAuth.ts
├── components/
│   ├── ui/                         # shadcn/ui (fine as-is)
│   ├── design-system/              # Custom design system (fine as-is)
│   ├── hero3d/                     # 3D hero animation
│   ├── CastingStudio/              # ✅ Already partially extracted
│   ├── ProfileSettingsModal.tsx     # ❌ 1,147 lines — 4 features in 1
│   ├── BillingModal.tsx            # ❌ Billing-specific, not in billing/
│   ├── CreditTopupModal.tsx        # ❌ Billing-specific, not in billing/
│   ├── LowBalanceWarning.tsx       # ❌ Billing-specific, not in billing/
│   ├── DNAHelix.tsx                # ❌ Casting-specific, not in casting/
│   ├── HairColorWheel.tsx          # ❌ Casting-specific, not in casting/
│   ├── TriBlendSelector.tsx        # ❌ Casting-specific, not in casting/
│   ├── DashboardLayout.tsx         # Layout (fine here)
│   ├── Navigation.tsx              # Layout (fine here)
│   └── ...
├── pages/
│   ├── CastingStudio.tsx           # ❌ 2,299 lines — entire app in one file
│   ├── ModeratorDashboard.tsx      # ❌ 1,988 lines — 5 tabs in one file
│   ├── Home.tsx                    # ❌ 1,614 lines — 10+ sections inline
│   ├── ComponentShowcase.tsx       # ❌ 1,437 lines — dev-only, consider removing
│   ├── AdminAuditLogs.tsx          # ❌ 1,025 lines
│   ├── AdminUserManagement.tsx     # ❌ 947 lines
│   ├── AdminChangeRequests.tsx     # ❌ 847 lines
│   ├── Dashboard.tsx               # 688 lines
│   ├── HomeOld.tsx                 # ❌ 347 lines of dead code
│   ├── Login.tsx                   # 292 lines (fine)
│   └── NotFound.tsx                # 52 lines (fine)
├── hooks/                          # ❌ Mixed — casting hooks + generic hooks
├── stores/                         # ❌ All casting-specific, should be in features/casting/
├── constants/                      # ❌ Only casting.ts — should be in features/casting/
├── types/                          # ❌ Only castingStudio.ts — should be in features/casting/
├── contexts/                       # 1 file (ThemeContext) — fine
├── styles/                         # 2 files (tokens, animations) — fine
├── lib/                            # trpc.ts, motion.ts, imageUtils.ts, utils.ts
```

### Proposed Client Structure (Feature-Based)

```
client/src/
├── _core/hooks/useAuth.ts          # (unchanged)
├── features/                       # ← NEW: feature-based grouping
│   ├── casting/                    # Everything for the Casting app
│   │   ├── CastingStudioPage.tsx   # Page shell (imports sub-components)
│   │   ├── CastingForm.tsx         # Form section (extracted from page)
│   │   ├── GenerationPanel.tsx     # Generation controls (extracted)
│   │   ├── ImageViewer/            # (move from components/CastingStudio/ImageViewer)
│   │   ├── BrandSelector.tsx       # (move from components/CastingStudio/)
│   │   ├── FaceSection.tsx         # (move from components/CastingStudio/)
│   │   ├── HairSection.tsx         # (move from components/CastingStudio/)
│   │   ├── EyeSection.tsx          # (move from components/CastingStudio/)
│   │   ├── SkinSection.tsx         # (move from components/CastingStudio/)
│   │   ├── PhysiqueSelector.tsx    # (move from components/CastingStudio/)
│   │   ├── DirectorsNote.tsx       # (move from components/CastingStudio/)
│   │   ├── DNAHelix.tsx            # (move from components/)
│   │   ├── HairColorWheel.tsx      # (move from components/)
│   │   ├── TriBlendSelector.tsx    # (move from components/)
│   │   ├── hooks/
│   │   │   ├── useCastingForm.ts
│   │   │   ├── useGenerationState.ts
│   │   │   └── useComposition.ts
│   │   ├── stores/
│   │   │   ├── useCastingFormStore.ts
│   │   │   ├── useCastingGenerationStore.ts
│   │   │   └── useCastingUIStore.ts
│   │   ├── constants.ts            # (move from constants/casting.ts)
│   │   └── types.ts                # (move from types/castingStudio.ts)
│   ├── billing/                    # Everything for billing/credits
│   │   ├── BillingModal.tsx
│   │   ├── CreditTopupModal.tsx
│   │   └── LowBalanceWarning.tsx
│   ├── admin/                      # Admin panel pages
│   │   ├── AdminDashboard.tsx      # (rename from Dashboard.tsx admin section)
│   │   ├── AuditLogs.tsx           # (move + split from pages/)
│   │   ├── UserManagement.tsx      # (move + split from pages/)
│   │   └── ChangeRequests.tsx      # (move + split from pages/)
│   ├── moderator/                  # Moderator panel
│   │   ├── ModeratorDashboard.tsx  # Page shell
│   │   ├── UserReview.tsx          # (extracted tab)
│   │   ├── CreditLogs.tsx          # (extracted tab)
│   │   ├── GenerationLogs.tsx      # (extracted tab)
│   │   └── ChangeRequestForm.tsx   # (extracted tab)
│   ├── home/                       # Landing page sections
│   │   ├── HomePage.tsx            # Page shell
│   │   ├── HeroSection.tsx
│   │   ├── FeaturesSection.tsx
│   │   ├── WorkSection.tsx
│   │   ├── PricingSection.tsx
│   │   ├── ProcessSection.tsx
│   │   └── FooterSection.tsx
│   └── profile/                    # Profile & settings
│       ├── ProfileSettingsModal.tsx # Shell
│       ├── ProfileTab.tsx          # (extracted from modal)
│       ├── BillingTab.tsx          # (extracted from modal)
│       └── AccountTab.tsx          # (extracted from modal)
├── components/                     # ← ONLY truly shared/reusable components
│   ├── ui/                         # shadcn/ui (unchanged)
│   ├── design-system/              # Custom design system (unchanged)
│   ├── hero3d/                     # 3D hero (could move to features/home/)
│   ├── DashboardLayout.tsx         # Shared layout
│   ├── DashboardLayoutSkeleton.tsx
│   ├── AppLayout.tsx
│   ├── Navigation.tsx
│   ├── ErrorBoundary.tsx
│   ├── ManusDialog.tsx
│   └── Tooltip.tsx
├── pages/                          # ← Thin route entry points only
│   ├── Home.tsx                    # → features/home/HomePage
│   ├── CastingStudio.tsx           # → features/casting/CastingStudioPage
│   ├── Dashboard.tsx               # → features/admin/AdminDashboard (or keep)
│   ├── Login.tsx
│   └── NotFound.tsx
├── hooks/                          # ← ONLY truly shared hooks
│   ├── useMobile.tsx
│   └── usePersistFn.ts
├── contexts/ThemeContext.tsx
├── styles/
├── lib/
│   ├── trpc.ts
│   ├── motion.ts
│   ├── imageUtils.ts
│   └── utils.ts
├── App.tsx
├── main.tsx
└── index.css
```

---

## 6. Root Directory Cleanup

### Current Root Files (Non-Config)

| File | Lines | Recommendation |
|---|---|---|
| `todo.md` | 145K | Keep (project tracking) |
| `REFACTOR_PLAN.md` | 6,433 | Move to `docs/` — completed refactor reference |
| `DESIGN_SYSTEM_PROPOSAL.md` | 21,478 | Move to `docs/` |
| `STYLE_GUIDE.md` | 16,508 | Move to `docs/` |
| `SECURITY_AUDIT.md` | 10,226 | Move to `docs/` |
| `DNAHelix-component.md` | 24,618 | Move to `docs/archive/` or delete — research artifact |
| `3d-hero-proposal.md` | 15,606 | Move to `docs/archive/` or delete — research artifact |
| `casting-studio-audit.md` | 9,304 | Move to `docs/archive/` or delete — research artifact |
| `security-audit.md` | 11,033 | Duplicate of `SECURITY_AUDIT.md`? Delete one. |
| `dna-animation-research.md` | 2,093 | Move to `docs/archive/` or delete |
| `dna-helix-inspection.md` | 720 | Move to `docs/archive/` or delete |
| `dna-helix-verification.md` | 876 | Move to `docs/archive/` or delete |
| `dna-reference-comparison.md` | 980 | Move to `docs/archive/` or delete |
| `ui-inspection-notes.md` | 1,266 | Move to `docs/archive/` or delete |
| `HomeOld.tsx` (in pages/) | 347 | Delete — dead code |

---

## 7. Priority Ranking

The following table ranks all identified issues by impact and effort, to help decide execution order:

| Priority | Issue | Impact | Effort | Files Affected |
|---|---|---|---|---|
| **P0** | Split `server/db.ts` (2,531 lines) | Critical — blocks all server work | High (72 exports, many consumers) | ~30 importers |
| **P1** | Group Slack files into `server/slack/` | High — 5 scattered files, 3,347 lines | Medium (move + update imports) | 5 source + 4 test |
| **P1** | Group Stripe files into `server/stripe/` | High — 3 scattered files, 1,264 lines | Low-Medium | 3 source + 3 test |
| **P2** | Split `CastingStudio.tsx` (2,299 lines) | High — largest client file | High (extract components) | 1 page + new files |
| **P2** | Split `ModeratorDashboard.tsx` (1,988 lines) | High | Medium (tab extraction) | 1 page + new files |
| **P2** | Split `Home.tsx` (1,614 lines) | Medium-High | Medium (section extraction) | 1 page + new files |
| **P2** | Split `ProfileSettingsModal.tsx` (1,147 lines) | Medium | Medium (tab extraction) | 1 component + new files |
| **P3** | Move casting components to `features/casting/` | Medium — improves discoverability | Low (move + update imports) | ~15 files |
| **P3** | Move billing components to `features/billing/` | Medium | Low | 3 files |
| **P3** | Co-locate test files with source | Medium — improves DX | Low-Medium (move files) | 33 test files |
| **P3** | Split admin pages (AuditLogs, UserMgmt, ChangeReqs) | Medium | Medium | 3 pages |
| **P4** | Clean root markdown files | Low — cosmetic | Very Low | 12 files |
| **P4** | Delete `HomeOld.tsx` | Low — dead code | Very Low | 1 file |
| **P4** | Merge or clarify `aiService.ts` vs `geminiService.ts` | Low | Low | 2 files |
| **P4** | Group security files into `server/security/` | Low-Medium | Low | 4 files |

---

## 8. Recommended Execution Plan

Given the incremental delivery requirement (max 1-2 files per step, checkpoint after each), here is the suggested order:

**Phase 1: Server `db.ts` Split (P0)** — 10-12 steps
Split into `server/db/` with domain modules. This is the highest-impact change and unblocks future feature work. Use the same pattern as the router refactor: create `db/index.ts` that re-exports everything for backward compatibility, then extract one domain at a time.

**Phase 2: Server Domain Grouping (P1)** — 4-6 steps
Move Slack files into `server/slack/`, Stripe files into `server/stripe/`, casting services into `server/casting/`, security files into `server/security/`. Co-locate their tests.

**Phase 3: Client Feature Extraction (P2)** — 8-12 steps
Split the 4 largest client files by extracting sub-components into `features/` directories. Start with `CastingStudio.tsx` since it already has partial extraction in `components/CastingStudio/`.

**Phase 4: Client Reorganization (P3)** — 4-6 steps
Move feature-specific components from `components/` to their feature directories. Move casting hooks/stores/constants/types to `features/casting/`.

**Phase 5: Cleanup (P4)** — 2-3 steps
Clean root markdown files, delete dead code, resolve naming inconsistencies.

---

## 9. Key Principles for the Restructure

1. **Backward compatibility first** — use index re-exports so existing imports don't break.
2. **One domain at a time** — never mix domains in a single step.
3. **Tests follow source** — co-locate `__tests__/` directories with the code they test.
4. **Feature folders own their dependencies** — hooks, stores, constants, types live inside the feature, not in global directories.
5. **Shared means shared** — only code used by 2+ features belongs in `components/`, `hooks/`, or `lib/`.
6. **No file over 500 lines** — hard limit enforced at every step.
