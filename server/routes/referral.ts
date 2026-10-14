import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  getOrCreateReferralCode,
  claimReferral,
  redeemReferralCode,
  getReferralStats,
  getReferralHistory,
  getUserByReferralCode,
  recordEmailInvite,
  hasInvitedEmail,
  isValidReferralCodeFormat,
} from "../db";
import { ALREADY_INVITED_MESSAGE } from "../db/referrals";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { REFERRAL_REWARD_CREDITS } from "../../drizzle/schema";
import { displayBalance } from "@shared/creditDisplay";
import { waitPhrase } from "@shared/waitPhrase";
import { REFERRAL_CODE_FORMAT_MESSAGE } from "../../shared/referralCodeFormat";
import { checkRateLimit, getClientIp } from "../security/rateLimit";
import { isDisposableEmail } from "../security/disposableEmails";
import { sendReferralInviteEmail } from "../mail";
import { spokenError } from "../_core/spokenError";
import { appBaseUrl } from "../_core/appOrigin";
import { createModuleLogger } from "../logging/logger";
const log = createModuleLogger("routes/referral");

/** Rate limit configs */
const INVITE_RATE = { maxRequests: 10, windowMs: 24 * 60 * 60 * 1000, keyPrefix: "ref-invite" };
const REDEEM_RATE = { maxRequests: 5, windowMs: 60 * 60 * 1000, keyPrefix: "ref-redeem" };
/**
 * `validate` is public and answers whether a code exists, so it is a guessing
 * surface: per address, the same budget `access.validate` gives an invite code
 * (10 in 5 minutes) — plenty for a person typing a code, useless for a sweep (#2375).
 */
/**
 * What the customer reads when the invite did not go (#2481). It says what
 * happened and what to do, and offers the road that needs no email at all.
 */
export const INVITE_NOT_SENT_SENTENCE =
  "That invitation didn't go out. Try again in a moment, or copy your link and send it yourself.";

export const VALIDATE_RATE = { maxRequests: 10, windowMs: 5 * 60 * 1000, keyPrefix: "ref-validate" };

export const referralRouter = router({
  /**
   * Get the current user's referral code and link.
   * Auto-generates a code if one doesn't exist.
   */
  getMyCode: protectedProcedure.query(async ({ ctx }) => {
    const ip = getClientIp(ctx.req);
    const code = await getOrCreateReferralCode(ctx.user.id, ip);
    if (!code) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate referral code",
      });
    }

    const baseUrl = ctx.req.headers.origin || appBaseUrl();
    const referralLink = `${baseUrl}?ref=${code}`;

    return {
      code,
      referralLink,
      rewardCredits: REFERRAL_REWARD_CREDITS,
    };
  }),

  /**
   * Get referral statistics for the current user.
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const stats = await getReferralStats(ctx.user.id);
    return {
      ...stats,
      rewardCredits: REFERRAL_REWARD_CREDITS,
    };
  }),

  /**
   * Get referral history (invitation list) for the current user.
   * Scoped to current user only (authorization enforced).
   */
  getHistory: protectedProcedure.query(async ({ ctx }) => {
    const history = await getReferralHistory(ctx.user.id);
    return history;
  }),

  /**
   * Send an email invitation.
   * Rate limited: 10/day per user.
   *
   * ⚠ **`{ sent: true }` MEANS THE EMAIL WENT — #2481, his ruling 2026-10-14.**
   * Until then the send was a fire-and-forget Klaviyo event, production had no
   * Klaviyo key, and this answered `{ sent: true }` regardless, which the
   * client turned into "Invitation sent." over an email that could never leave
   * the building. Now: the duplicate check runs first, the email is sent and
   * AWAITED through Resend, and the invite is recorded only once it has gone —
   * so a failed send refuses out loud and leaves no row behind to answer the
   * retry with "Already invited".
   */
  sendInvite: protectedProcedure
    .input(
      z.object({
        email: z.string().email().max(320),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ip = getClientIp(ctx.req);

      // Rate limit: 10 invites per day
      const rateCheck = checkRateLimit(`${ctx.user.id}`, INVITE_RATE);
      if (!rateCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Invite limit reached. Try again ${waitPhrase(rateCheck.resetIn)}.`,
        });
      }

      // Block self-invite
      if (ctx.user.email && input.email.toLowerCase() === ctx.user.email.toLowerCase()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot invite yourself",
        });
      }

      // Block disposable email domains
      if (isDisposableEmail(input.email)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Please use a permanent email address",
        });
      }

      // A duplicate never becomes a second email (the rule is the writer's own).
      if (await hasInvitedEmail(ctx.user.id, input.email)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: ALREADY_INVITED_MESSAGE });
      }

      /* The link is built on the product's OWN address, never the request's
         `Origin`: this one goes out in an email from our sending domain to a
         stranger, so a header the caller controls must not choose where its
         button leads. (`getMyCode` still shows the referrer their link on the
         origin they are using; that one is read by the person who asked.) */
      const code = await getOrCreateReferralCode(ctx.user.id, ip);
      const referralLink = code ? `${appBaseUrl()}?ref=${code}` : appBaseUrl();

      const sent = await sendReferralInviteEmail({
        to: input.email,
        referrerName: ctx.user.name || null,
        referralLink,
        /* #2478: the display figure, converted HERE and only here. The other
           three uses of this constant in this file (getMyCode, getStats,
           redeem) stay on the ledger scale because their readers
           (ReferralBlock and RedeemCodeModal) convert at the render, so
           converting the constant itself would make those screens say 500.
           An email has no client to convert for it, so the router does. */
        rewardCredits: displayBalance(REFERRAL_REWARD_CREDITS),
      });

      if (!sent.success) {
        log.error({ err: sent.error }, "[Referral] invite email was not sent");
        throw spokenError({
          code: "INTERNAL_SERVER_ERROR",
          message: INVITE_NOT_SENT_SENTENCE,
        });
      }

      /* Recorded only now that it has gone. A refusal HERE is the duplicate
         race (two sends of one address at once) or a database outage — the
         email has already gone either way, so the answer is still the truth:
         it was sent. */
      const result = await recordEmailInvite(ctx.user.id, input.email, ip);
      if (!result.success) {
        log.warn({ err: result.error }, "[Referral] invite sent but not recorded");
      }

      return { sent: true as const };
    }),

  /**
   * Redeem a referral code (explicit action from Redeem modal).
   * Rate limited: 5/hour per user.
   * Validation: code format, self-referral, one-time per user.
   */
  redeem: protectedProcedure
    .input(
      z.object({
        code: z.string().min(1).max(20).transform((v) => v.toUpperCase()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ip = getClientIp(ctx.req);

      // Rate limit: 5 redemptions per hour
      const rateCheck = checkRateLimit(`${ctx.user.id}`, REDEEM_RATE);
      if (!rateCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many attempts. Try again ${waitPhrase(rateCheck.resetIn)}.`,
        });
      }

      // Validate code format
      if (!isValidReferralCodeFormat(input.code)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          // DERIVED, never typed. This line read "Expected: FORMA-XXXXXX" from
          // `bf184b0b` until 2026-08-25 — a prefix retired by `06585f07`, the
          // rebrand commit that edited three OTHER lines of this same file.
          message: REFERRAL_CODE_FORMAT_MESSAGE,
        });
      }

      const result = await redeemReferralCode(ctx.user.id, input.code, ip);
      if (!result.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error || "Failed to redeem code",
        });
      }

      return { redeemed: true, rewardCredits: REFERRAL_REWARD_CREDITS };
    }),

  /**
   * Claim a referral code during/after signup.
   * Called by the frontend after login when a ?ref= param was captured on
   * landing — `useReferralClaim`, mounted at the app root by
   * `ReferralClaimBridge` (#1010: it had no mount for five months).
   */
  claim: protectedProcedure
    // .strict() — invariant 4 on a money-adjacent surface. The ONE caller is the
    // hook above and it sends `{ referralCode }` alone; proven at the parser in
    // publicInputStrictness.test.ts, positive control first.
    .input(z.object({ referralCode: z.string().min(1).max(20) }).strict())
    .mutation(async ({ ctx, input }) => {
      // The SAME bucket as `redeem` above, on purpose: both procedures are one
      // road (`redeemReferralCode` is `claimReferral` plus an audit row), so a
      // per-procedure bucket would hand a code-guesser ten tries an hour
      // instead of five. Until #1010 re-mounted the hook this procedure had no
      // caller, so its missing limiter cost nothing; this is the commit that
      // opens it to live traffic, and the limiter lands in the same one.
      const rateCheck = checkRateLimit(`${ctx.user.id}`, REDEEM_RATE);
      if (!rateCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many attempts. Try again ${waitPhrase(rateCheck.resetIn)}.`,
        });
      }

      const ip = getClientIp(ctx.req);
      const result = await claimReferral(ctx.user.id, input.referralCode, ip);
      return { claimed: result.success };
    }),

  /**
   * Validate a referral code (public — used on landing page before signup).
   */
  validate: publicProcedure
    // .strict() — invariant 4 on a public surface (ruled fable-1435 §2). Safe at
    // the wire, checked rather than assumed: this endpoint has no client caller
    // at all, so no shipped bundle can be sending a field it does not declare.
    .input(z.object({ code: z.string().min(1).max(20) }).strict())
    .query(async ({ input, ctx }) => {
      const rateCheck = checkRateLimit(getClientIp(ctx.req), VALIDATE_RATE);
      if (!rateCheck.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many attempts. Try again ${waitPhrase(rateCheck.resetIn)}.`,
        });
      }
      // Whether the code is real, and nothing about whose it is (#2375): this
      // used to hand any stranger the referrer's first name. No client reads
      // the answer, so no shipped screen loses anything.
      const user = await getUserByReferralCode(input.code);
      return { valid: !!user };
    }),
});
