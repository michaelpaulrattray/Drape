-- GOOGLE SIGN-IN MATCHES THE PERSON, NOT THE ADDRESS — card #2389.
-- One nullable column on `users` and its unique index. Nothing else.
--
-- `googleSub` holds Google's stable account id (the ID token's `sub`) for an
-- account that FIRST signed up with an email and password and later linked
-- Google. An account Google created already carries the same fact in its
-- openId (`google_<sub>`), so it is never written there and nothing is copied.
--
-- The unique index is what stops one Google account being bound to two
-- accounts here. MySQL allows any number of NULLs under a unique index, so
-- every existing row is untouched.
--
-- ZERO BACKFILL. No existing row is read or written.
--
-- PURELY ADDITIVE. One ALTER TABLE … ADD and one CREATE UNIQUE INDEX, so
-- scripts/lib/ceremonyAutoApply.mts recognises every statement and no
-- ceremony reaches the founder.
ALTER TABLE `users` ADD COLUMN `googleSub` varchar(255);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_googleSub_unique` ON `users` (`googleSub`);
