-- WHICH CREDITS EXPIRE, AND WHEN — five additive columns (#2185, his ruling
-- 2026-10-10, verbatim: "promo and signup bonuses after 90 days? Expire after
-- 90 days." and "the free plan credits can last forever sure").
--
-- ============================================================================
-- THE RULE THEY CARRY
-- ============================================================================
--
--   Top-ups            never expire (`purchasedBalance`, unchanged)
--   Referral credits   never expire                      -> keptBalance
--   Staff goodwill     never expires                     -> keptBalance
--   Starting credits   never expire while on Free; 90 days after a move to a
--                      paid plan, what is left expires   -> signupBalance,
--                                                          signupCreditsExpireAt
--   Promo bonuses      expire 90 days after the grant    -> promoBalance,
--                                                          promoCreditsExpireAt
--   Plan credits       unchanged: what is left of the balance
--
-- Each `…Balance` is an upper bound read the way `purchasedBalance` is: the
-- balance spends plan -> promo -> signup -> kept -> purchased, so a bucket's
-- remaining credits are the lesser of its bound and what the later buckets
-- leave over. Nothing is written on the spend path.
--
-- ============================================================================
-- DEFAULTS — AND WHAT THAT MEANS FOR THE ROWS THAT EXIST
-- ============================================================================
--
-- Every existing row gets 0 and NULL. That reads exactly as before this
-- migration: those credits stay in the plan's part. No row is rewritten — a
-- backfill of existing accounts' starting credits would be a row rewrite and is
-- named in the PR as the founder's call, not done here.
--
-- PURELY ADDITIVE. Five columns, no index, no existing column changes.
ALTER TABLE `points` ADD COLUMN `keptBalance` int NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `points` ADD COLUMN `signupBalance` int NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `points` ADD COLUMN `signupCreditsExpireAt` timestamp NULL;
--> statement-breakpoint
ALTER TABLE `points` ADD COLUMN `promoBalance` int NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `points` ADD COLUMN `promoCreditsExpireAt` timestamp NULL;
