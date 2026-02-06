# Authentication and Authorization

This guide covers the authentication flow, protected procedures, and authorization patterns used in FormaStudio. Understanding these concepts is essential for implementing secure API endpoints.

## Authentication Flow Overview

FormaStudio uses Manus OAuth for authentication, which provides a secure, token-based authentication system with support for multiple identity providers including Google, Apple, and email-based login.

The authentication flow works as follows. When a user clicks "Sign In," they are redirected to the Manus OAuth portal where they authenticate with their chosen provider. Upon successful authentication, the OAuth server redirects back to `/api/oauth/callback` with an authorization code. The callback handler exchanges this code for user information and creates a session. A secure HTTP-only cookie containing a JWT token is set in the user's browser. Subsequent requests include this cookie, which is validated on each API call.

## Procedure Types

FormaStudio defines three procedure types in `server/_core/trpc.ts` that determine the authentication requirements for each endpoint.

### publicProcedure

Public procedures do not require authentication. The user context (`ctx.user`) may be `null` or contain user data if the user happens to be logged in.

```typescript
// Example: Anyone can view generation costs
costs: publicProcedure.query(() => POINT_COSTS),
```

Use public procedures for read-only data that should be accessible to everyone, such as pricing information, public content, or health checks.

### protectedProcedure

Protected procedures require a valid authenticated session. If no valid session exists, the request is rejected with an `UNAUTHORIZED` error before your handler code runs.

```typescript
// Example: Only authenticated users can check their balance
getBalance: protectedProcedure.query(async ({ ctx }) => {
  // ctx.user is guaranteed to exist and be valid
  const credits = await getUserCredits(ctx.user.id);
  return { balance: credits.balance };
}),
```

Use protected procedures for any operation that accesses or modifies user-specific data.

### adminProcedure

Admin procedures require both authentication and the `admin` role. Regular users receive a `FORBIDDEN` error even if authenticated.

```typescript
// Example: Only admins can view all users
listAllUsers: adminProcedure.query(async () => {
  return await getAllUsers();
}),
```

Use admin procedures for administrative operations like user management, system configuration, or viewing aggregate data across all users.

## Authorization: Data Scoping

Authentication verifies **who** the user is. Authorization verifies **what** they can access. Even with `protectedProcedure`, you must ensure users can only access their own data.

### The userId Filter Pattern

Every database query that returns user-specific data must include a `userId` filter:

```typescript
// ✅ CORRECT: Scoped to the authenticated user
const models = await db
  .select()
  .from(modelsTable)
  .where(eq(modelsTable.userId, ctx.user.id));

// ❌ WRONG: Returns all users' data
const models = await db.select().from(modelsTable);
```

### Ownership Verification for Mutations

When modifying or deleting resources, verify ownership before performing the operation:

```typescript
deleteModel: protectedProcedure
  .input(z.object({ modelId: z.number() }))
  .mutation(async ({ ctx, input }) => {
    // Fetch the resource
    const model = await getModelById(input.modelId);
    
    // Verify it exists
    if (!model) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });
    }
    
    // Verify ownership
    if (model.userId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
    }
    
    // Safe to delete
    await deleteModel(input.modelId);
    return { success: true };
  }),
```

## Session Management

Sessions are managed through HTTP-only cookies containing JWT tokens. The cookie configuration in `server/_core/cookies.ts` ensures security through several mechanisms.

| Setting | Value | Purpose |
|---------|-------|---------|
| `httpOnly` | `true` | Prevents JavaScript access, mitigating XSS attacks |
| `secure` | `true` (production) | Ensures cookies only sent over HTTPS |
| `sameSite` | `lax` | Prevents CSRF while allowing normal navigation |
| `maxAge` | 7 days | Limits session lifetime |

### Logout Implementation

The logout endpoint clears the session cookie:

```typescript
logout: publicProcedure.mutation(({ ctx }) => {
  const cookieOptions = getSessionCookieOptions(ctx.req);
  ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
  return { success: true };
}),
```

## Frontend Authentication

On the frontend, use the `useAuth` hook to access authentication state:

```typescript
import { useAuth } from "@/contexts/AuthContext";

function MyComponent() {
  const { user, isLoading, isAuthenticated } = useAuth();
  
  if (isLoading) return <LoadingSpinner />;
  
  if (!isAuthenticated) {
    return <LoginPrompt />;
  }
  
  return <div>Welcome, {user.name}!</div>;
}
```

For login redirection, use the `getLoginUrl` helper:

```typescript
import { getLoginUrl } from "@/lib/auth";

function LoginButton() {
  return (
    <a href={getLoginUrl()}>Sign In</a>
  );
}
```

## Security Checklist for New Endpoints

Before deploying any new endpoint, verify these authentication and authorization requirements:

| Requirement | How to Verify |
|-------------|---------------|
| Correct procedure type | Public data uses `publicProcedure`, user data uses `protectedProcedure` |
| Data scoping | All queries include `userId` filter from `ctx.user.id` |
| Ownership verification | Mutations verify `resource.userId === ctx.user.id` |
| Input validation | All inputs validated with Zod schemas |
| Error messages | No sensitive data leaked in error responses |

## Common Mistakes

### Trusting Client-Provided User IDs

```typescript
// ❌ WRONG: User could pass any userId
updateProfile: protectedProcedure
  .input(z.object({ userId: z.number(), name: z.string() }))
  .mutation(async ({ input }) => {
    await updateUser(input.userId, { name: input.name });
  }),

// ✅ CORRECT: Use authenticated user's ID
updateProfile: protectedProcedure
  .input(z.object({ name: z.string() }))
  .mutation(async ({ ctx, input }) => {
    await updateUser(ctx.user.id, { name: input.name });
  }),
```

### Missing Ownership Check

```typescript
// ❌ WRONG: Any user can delete any model
deleteModel: protectedProcedure
  .input(z.object({ modelId: z.number() }))
  .mutation(async ({ input }) => {
    await deleteModel(input.modelId); // No ownership check!
  }),
```

### Leaking Data in Errors

```typescript
// ❌ WRONG: Reveals internal details
if (!model) {
  throw new TRPCError({
    code: "NOT_FOUND",
    message: `Model ${input.modelId} not found in database table 'models'`,
  });
}

// ✅ CORRECT: Generic message
if (!model) {
  throw new TRPCError({
    code: "NOT_FOUND",
    message: "Model not found",
  });
}
```

## Account Suspension

Administrators can suspend user accounts to immediately block access. Suspension is used for confirmed abuse, policy violations, or security incidents. Unlike temporary lockouts, suspensions persist until manually lifted by an admin.

### Database Fields

The `users` table includes these suspension-related fields:

| Field | Type | Description |
|-------|------|-------------|
| `suspendedAt` | timestamp | When the account was suspended (null = active) |
| `suspendedReason` | text | Admin-provided reason for suspension |
| `suspendedBy` | int | User ID of the admin who suspended the account |

### Real-Time Enforcement

Suspension is enforced at two levels to ensure immediate effect:

**At Login:** The OAuth callback checks `suspendedAt` before creating a session. Suspended users are redirected to `/login?error=suspended` with a clear error message.

**At API Calls:** The `protectedProcedure` middleware checks `suspendedAt` on every request. Even if a user was suspended mid-session, their next API call will be blocked immediately with a `FORBIDDEN` error.

```typescript
// In server/_core/trpc.ts - protectedProcedure middleware
if (ctx.user.suspendedAt) {
  throw new TRPCError({ 
    code: "FORBIDDEN", 
    message: "Your account has been suspended. Please contact support for assistance.",
  });
}
```

### Admin Operations

Suspend and unsuspend operations are available through the admin router:

```typescript
// Suspend a user
await trpc.admin.suspendUser.mutate({ 
  userId: 123, 
  reason: "Repeated abuse of generation endpoints" 
});

// Unsuspend a user
await trpc.admin.unsuspendUser.mutate({ userId: 123 });
```

Both operations are logged to the audit system with `admin.account_suspended` and `admin.account_unsuspended` actions.

## Account Lockout

Account lockout is an automatic protection against brute force attacks. After multiple failed login attempts, the account is temporarily locked to prevent further attempts.

### Database Fields

The `users` table includes these lockout-related fields:

| Field | Type | Description |
|-------|------|-------------|
| `failedLoginAttempts` | int | Counter of consecutive failed login attempts |
| `lockedUntil` | timestamp | When the lockout expires (null = not locked) |

### Lockout Configuration

The lockout system uses these thresholds:

| Setting | Value | Description |
|---------|-------|-------------|
| Threshold | 5 attempts | Number of failed logins before lockout |
| Duration | 15 minutes | How long the account remains locked |
| Reset | On success | Counter resets to 0 after successful login |

### How It Works

When a login fails, the system increments `failedLoginAttempts`. If the counter reaches 5, `lockedUntil` is set to 15 minutes in the future. Subsequent login attempts check `lockedUntil` and redirect to `/login?error=locked&minutes=X` if still locked.

On successful login, both `failedLoginAttempts` and `lockedUntil` are reset, allowing normal access.

### Real-Time Enforcement

Like suspension, lockout is enforced at both login and API levels:

```typescript
// In server/_core/trpc.ts - protectedProcedure middleware
if (ctx.user.lockedUntil && new Date(ctx.user.lockedUntil) > new Date()) {
  const remainingMinutes = Math.ceil(
    (new Date(ctx.user.lockedUntil).getTime() - Date.now()) / 60000
  );
  throw new TRPCError({ 
    code: "FORBIDDEN", 
    message: `Your account is temporarily locked. Please try again in ${remainingMinutes} minute(s).`,
  });
}
```

### Audit Events

The following audit events are logged for authentication:

| Event | Description |
|-------|-------------|
| `auth.login` | Successful login |
| `auth.login_failed` | Failed login attempt |
| `auth.login_blocked_suspended` | Login blocked due to suspension |
| `auth.login_blocked_locked` | Login blocked due to lockout |
| `auth.account_lockout` | Account locked after threshold exceeded |

## Related Documentation

For additional security context, see [RATE_LIMITING.md](./RATE_LIMITING.md) for preventing brute force attacks on authentication and distributed attack protection, [ATOMIC_CREDITS.md](./ATOMIC_CREDITS.md) for securing credit-consuming operations, and [AUDIT_LOGGING.md](./AUDIT_LOGGING.md) for logging authentication events.


## Admin Security Hardening

FormaStudio implements multiple layers of security to protect admin functionality from both external attacks and internal threats. These measures ensure that even if one security layer is compromised, others remain in place.

### Admin Allowlist

The admin allowlist is a hardcoded list of user identifiers (open IDs and emails) that are permitted to access admin functionality. This provides defense-in-depth against database tampering—even if an attacker gains write access to the database and sets their role to "admin," they cannot access admin features unless they are on the allowlist.

```typescript
// server/adminSecurity.ts
export const ADMIN_ALLOWLIST: AdminAllowlistEntry[] = [
  { openId: process.env.OWNER_OPEN_ID, email: process.env.OWNER_EMAIL },
  // Add additional trusted admins here with their openId or email
];
```

The allowlist is checked in addition to the database role check. If the allowlist is empty (no entries configured), the system falls back to database-only role checking for backward compatibility.

### Sensitive Action Confirmation

Certain admin actions are classified as "sensitive" and require additional confirmation before execution. This prevents accidental or malicious actions from being executed immediately.

| Sensitive Actions |
|-------------------|
| suspendUser |
| unsuspendUser |
| adjustCredits |
| blockIP |
| unblockIP |
| deleteModel |
| revokeSession |
| modifyPermissions |

When a sensitive action is requested, the system generates a confirmation token that must be provided to complete the action. Tokens are single-use and expire after 5 minutes.

```typescript
// Generate a confirmation token
const token = generateConfirmationToken(adminId, "suspendUser", targetUserId);

// Validate and consume the token
const result = validateConfirmationToken(token, adminId, "suspendUser", targetUserId);
if (!result.valid) {
  throw new Error(result.reason);
}
```

### Admin Activity Alerts

All admin actions are logged and sent to Slack for real-time monitoring. This provides visibility into admin activity and enables rapid response to suspicious behavior.

| Alert Type | Trigger |
|------------|---------|
| Admin Action | Any admin operation (listUsers, getAuditLogs, etc.) |
| Sensitive Admin Action | High-risk operations (suspend, credit adjustment, IP blocking) |
| Unauthorized Access | Attempt to access admin features without proper authorization |

Slack alerts include the admin's name, the action performed, the target resource, and additional context to help security teams assess the activity.

### Immutable Audit Log

Critical security events are written to an immutable, append-only log that cannot be modified or deleted. This provides forensic evidence that survives even if the primary database is compromised.

The immutable log uses a blockchain-like structure where each entry contains a hash of the previous entry, creating a tamper-evident chain. Any modification to historical entries breaks the chain and is immediately detectable.

```typescript
// Write to immutable log
const entry = await writeImmutableLog("admin.suspend_user", {
  adminId: 1,
  targetUserId: 123,
  reason: "Policy violation"
});

// Verify chain integrity
const { valid, entries, brokenAt } = verifyImmutableLogChain();
if (!valid) {
  console.error(`Chain broken at entry ${brokenAt}`);
}
```

Events written to the immutable log include:

| Event Type | Description |
|------------|-------------|
| admin.suspend_user | User account suspended |
| admin.unsuspend_user | User account unsuspended |
| admin.adjust_credits | Credit balance modified |
| admin.block_ip | IP address blocked |
| admin.unblock_ip | IP address unblocked |
| security.unauthorized_admin_access | Unauthorized admin access attempt |

### Implementation Checklist

When adding new admin functionality, ensure these security measures are in place:

| Requirement | Implementation |
|-------------|----------------|
| Allowlist check | Use `validateAdminAccess()` before any admin operation |
| Sensitive action check | Use `isSensitiveAction()` to determine if confirmation is needed |
| Confirmation token | Generate and validate tokens for sensitive actions |
| Slack notification | Call `logAdminAction()` for all admin operations |
| Immutable logging | Write critical events to `writeImmutableLog()` |
| Unauthorized access logging | Call `logUnauthorizedAdminAccess()` for denied attempts |
