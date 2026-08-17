-- THE KIND-PROPERTY STORE (`OPEN_KIND_PROPERTIES_DESIGN.md` §5, ordered
-- fable-872 §2 + fable-868 §4 as ONE design, opened for build by fable-895 §4).
--
-- One row is: **a fact about a KIND that the catalogue would have held, which
-- nobody has catalogued.** Two of them, answered once per noun ever:
--
--   paired              does the noun denote a matched SET — wings, antlers
--   extendsOutOfFrame   anchored outside this framing, does it present inside it
--
-- PURELY ADDITIVE. One new table. No column of any existing table changes, and
-- **nothing reads or writes it in this commit** — the reader is its own step and
-- the mint gate is the step after that. The migration lands first anyway,
-- because a new table is in every INSERT the moment its writer ships and there
-- is no dark landing for one; this program has the scar that named the rule.
--
-- ============================================================================
-- WHY IT IS A TABLE AND NOT A COLUMN ON `casting_open_lane_demand`
-- ============================================================================
--
-- The demand table is per-ASK and these are per-KIND. A property written onto
-- every ask row is the same fact stored N times waiting to disagree with itself
-- — the parallel-copy violation (working law 4) with a model's answer inside it.
-- And it would put a *judgement about a word* into the one table whose column
-- list is a privacy boundary.
--
-- The privacy shape here is different and simpler: **a row of this table is
-- about the ENGLISH LANGUAGE, not about a person.** `wings are a pair` is not a
-- fact about whoever asked for wings. There is no userId to leave out, no
-- candidate, no image key, and no timestamp correlation worth naming, because
-- one row is written the first time a noun is ever seen and never again.
--
-- ============================================================================
-- ONE ROW PER KIND, AND THE UNIQUE KEY IS ON `kind` ALONE
-- ============================================================================
--
-- The tempting key is (kind, promptVersion), so a re-ask under a better prompt
-- can land beside the old answer. That is the wrong shape and the reason is the
-- one this campaign keeps paying for: two rows for one kind is two answers to
-- one question, and every reader then needs a rule for picking — a rule that can
-- differ between readers, which is how a property that must be stable per kind
-- starts wobbling per caller.
--
-- So the key is the kind, the answering model and prompt travel ON the row as
-- provenance, and a re-ask under a new prompt is an UPDATE by a build that has
-- decided to re-ask. Declared here so that build finds this paragraph rather
-- than a second unique index.
--
-- ============================================================================
-- BOTH PROPERTIES ARE NOT NULL, AND THE ABSENCE OF A ROW IS THE THIRD STATE
-- ============================================================================
--
-- A reader that declined has produced no fact, so it writes NO ROW. It does not
-- write a row with nulls in it. Two meanings of "we do not know" one field apart
-- is the `whenAbsent` defect from the bald row, and here it would be worse: a
-- nullable `paired` read by a gate that treats null as false would mint a crop
-- of one wing under the name of two — precisely the thing fable-872 §2 forbade.
--
-- The cost of that choice, stated: while the text transport is down, every ask
-- for a kind with no row re-buys the read and gets nothing. That is bounded by
-- the render itself needing the same transport, and it is cheaper than a
-- persisted "unknown" that a later reader mistakes for an answer.
--
-- ============================================================================
-- RETENTION
-- ============================================================================
--
-- Nothing here is personal data and nothing points at an object in storage, so
-- this table is NOT swept with a candidate and must not be — the point of paying
-- for a per-kind read once is that it is answered once, forever, for everybody.
CREATE TABLE `casting_open_kind_properties` (
	`id` int AUTO_INCREMENT NOT NULL,
	-- The NORMALIZED key the open lane minted — a single lowercase token. 64 to
	-- match `kind` on the demand table and `noun` on the reference library, which
	-- are the same word in the same ontology.
	`kind` varchar(64) NOT NULL,
	-- P1. Does the noun denote a matched set? NOT the question of whether THIS
	-- render produced two of them, which is a fact about a frame (D1) and lives
	-- with the delivery.
	`paired` boolean NOT NULL,
	-- P2. Anchored outside this product's framing, does the thing present inside
	-- it? `tail` yes, `nails` on a waist-up frame no.
	`extendsOutOfFrame` boolean NOT NULL,
	-- Provenance, so a later reading is a delta rather than an anecdote: WHICH
	-- model answered and WHICH prompt asked. A property whose answer changed
	-- because the question changed is otherwise indistinguishable from a property
	-- that was never stable.
	`model` varchar(128) NOT NULL,
	`promptVersion` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `casting_open_kind_properties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
-- The bound: one row per kind, ever. The read is keyed on exactly this.
CREATE UNIQUE INDEX `uq_casting_open_kind_properties_kind` ON `casting_open_kind_properties` (`kind`);
