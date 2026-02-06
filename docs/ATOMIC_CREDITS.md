# Atomic Credit Deduction Pattern

This guide explains the atomic credit deduction pattern used in FormaStudio to prevent race condition attacks on the credit system. Every developer implementing credit-consuming features must understand and apply this pattern.

## The Problem: Race Condition Vulnerability

Without atomic credit deduction, a malicious user can exploit the timing gap between balance checking and credit deduction to generate more content than their balance allows.

Consider this vulnerable implementation:

```typescript
// ❌ VULNERABLE PATTERN - DO NOT USE
const balance = await getUserCredits(userId);
if (balance < cost) {
  throw new Error("Insufficient credits");
}

// Expensive AI generation takes 5-20 seconds
const result = await generateCastingImage(prompt);

// Credits deducted AFTER generation completes
await deductCredits(userId, cost, "generation", "Casting image");
```

The attack works as follows. A user with 10 credits sends 5 simultaneous requests for a feature costing 5 credits each. All 5 requests check the balance and see 10 credits available, so all pass validation. All 5 requests begin the expensive AI generation process. When generation completes, all 5 requests deduct 5 credits, resulting in a negative balance or failed deductions. The user receives 5 generations but only had credits for 2.

## The Solution: Atomic Credit Deduction

The `withAtomicCredits` helper solves this by deducting credits **before** the expensive operation and automatically refunding if the operation fails.

```typescript
// ✅ SECURE PATTERN - ALWAYS USE THIS
import { withAtomicCredits } from "./atomicCredits";

const result = await withAtomicCredits(
  {
    userId: ctx.user.id,
    amount: POINT_COSTS.castingImage,
    description: "Casting image generation",
    referenceId: `gen-${generationId}`,
  },
  async () => {
    // Expensive operation runs AFTER credits are deducted
    return await generateCastingImage(prompt);
  }
);
```

With this pattern, the same attack scenario plays out differently. A user with 10 credits sends 5 simultaneous requests. Request 1 atomically deducts 5 credits, leaving a balance of 5. Request 2 atomically deducts 5 credits, leaving a balance of 0. Requests 3, 4, and 5 fail immediately because the balance of 0 is less than the required 5 credits. The user receives exactly 2 generations as their balance allows.

## How It Works

The `withAtomicCredits` function follows a three-step process that ensures credits are always properly accounted for.

**Step 1: Atomic Deduction** occurs before any expensive work begins. The function calls `deductCredits` which uses a database transaction to atomically check the balance and deduct in a single operation. If the balance is insufficient, the function throws immediately without starting the expensive operation.

**Step 2: Execute Operation** happens only after credits are successfully deducted. The expensive operation (AI generation, upscaling, etc.) runs with the assurance that credits have already been reserved.

**Step 3: Handle Outcome** depends on whether the operation succeeds or fails. On success, the credits remain deducted and the user receives their result. On failure, the function automatically calls `addCredits` to refund the deducted amount before re-throwing the error.

## Implementation Checklist

When implementing a new credit-consuming feature, follow this checklist:

| Step | Action | Verification |
|------|--------|--------------|
| 1 | Import the helper | `import { withAtomicCredits } from "./atomicCredits"` |
| 2 | Define the credit cost | Use constants from `POINT_COSTS` or `CREDIT_COSTS` |
| 3 | Validate inputs first | Check ownership, existence before deducting credits |
| 4 | Wrap expensive operation | All AI calls inside `withAtomicCredits` callback |
| 5 | Handle the result | Process returned data after the wrapper completes |
| 6 | Write tests | Verify insufficient balance throws, refunds on failure |

## Code Examples

### Basic Generation Endpoint

```typescript
generateHeadshot: protectedProcedure
  .input(z.object({ modelId: z.number() }))
  .mutation(async ({ ctx, input }) => {
    // Validate ownership BEFORE deducting credits (cheap operation)
    const model = await getModelById(input.modelId);
    if (!model || model.userId !== ctx.user.id) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    // Wrap the expensive operation with atomic credits
    const result = await withAtomicCredits(
      {
        userId: ctx.user.id,
        amount: POINT_COSTS.castingImage,
        description: "Headshot generation",
        referenceId: `headshot-${input.modelId}`,
      },
      async () => {
        return await generateCastingImage(model.masterPrompt);
      }
    );

    return { imageUrl: result.imageUrl };
  }),
```

### Multiple Operations in One Request

When a single endpoint performs multiple credit-consuming operations, calculate the total cost upfront:

```typescript
generateAllViews: protectedProcedure
  .input(z.object({ modelId: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const totalCost = POINT_COSTS.multiView * 3; // 3 views

    const results = await withAtomicCredits(
      {
        userId: ctx.user.id,
        amount: totalCost,
        description: "All views generation (side, walk, back)",
        referenceId: `allviews-${input.modelId}`,
      },
      async () => {
        // All three generations run in parallel
        const [side, walk, back] = await Promise.all([
          generateRemainingViews(prompt, ref, gender, 'side'),
          generateRemainingViews(prompt, ref, gender, 'walk'),
          generateRemainingViews(prompt, ref, gender, 'back'),
        ]);
        return { side, walk, back };
      }
    );

    return results;
  }),
```

### With Rate Limiting

For endpoints that need both rate limiting and atomic credits, use the combined helper:

```typescript
import { withAtomicCreditsAndRateLimit } from "./atomicCredits";

const result = await withAtomicCreditsAndRateLimit(
  {
    userId: ctx.user.id,
    amount: POINT_COSTS.iterate,
    description: "Model iteration",
    referenceId: `iter-${modelId}`,
    rateLimitKey: `generation:${ctx.user.id}`,
  },
  checkRateLimit,
  rateLimitError,
  async () => {
    return await iterateModel(prompt, imageUrl, feedback);
  }
);
```

## Anti-Patterns to Avoid

### Checking Balance Separately

```typescript
// ❌ WRONG: Separate check creates race condition window
const balance = await getUserCredits(ctx.user.id);
if (balance < cost) throw new Error("Insufficient");

const result = await withAtomicCredits(...); // Redundant check
```

The `withAtomicCredits` helper already checks the balance atomically. Adding a separate check before it creates unnecessary database queries and does not improve security.

### Deducting After Generation

```typescript
// ❌ WRONG: Deducting after allows race condition exploit
const result = await generateImage(prompt);
await deductCredits(ctx.user.id, cost, ...);
```

This is the exact vulnerability the atomic pattern prevents. Never deduct credits after the expensive operation.

### Catching and Swallowing Errors

```typescript
// ❌ WRONG: Swallowing errors prevents automatic refund
try {
  const result = await withAtomicCredits(options, async () => {
    return await generateImage(prompt);
  });
} catch (error) {
  console.log("Generation failed, continuing anyway");
  return { success: false }; // User lost credits!
}
```

The `withAtomicCredits` helper handles refunds in its own catch block. If you catch the error outside and don't re-throw, the refund still happens, but swallowing errors can mask other issues.

## Testing Credit Deduction

Every credit-consuming endpoint should have tests verifying:

```typescript
describe("generateHeadshot", () => {
  it("should deduct credits on successful generation", async () => {
    // Setup user with known balance
    // Call endpoint
    // Verify balance decreased by expected amount
  });

  it("should throw when insufficient credits", async () => {
    // Setup user with balance < cost
    // Call endpoint
    // Verify TRPCError with BAD_REQUEST code
  });

  it("should refund credits when generation fails", async () => {
    // Setup user with sufficient balance
    // Mock generation to fail
    // Call endpoint (expect error)
    // Verify balance unchanged (deducted then refunded)
  });
});
```

## Related Documentation

For additional security context, see [AUTHENTICATION.md](./AUTHENTICATION.md) for protecting endpoints with `protectedProcedure`, [RATE_LIMITING.md](./RATE_LIMITING.md) for preventing API abuse, and [AUDIT_LOGGING.md](./AUDIT_LOGGING.md) for logging credit-related events.
