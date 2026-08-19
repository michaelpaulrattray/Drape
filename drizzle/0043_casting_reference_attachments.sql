-- THE ATTACHED REFERENCE — build two's door, the picture a customer hands us
-- before she has said what to do with it (design `UNIVERSAL_REFERENCE_ROAD_
-- DESIGN.md` §2, countersigned fable-1063 §1–§2).
--
-- One row is: **a photograph a customer attached to one of her Casts, and where
-- OUR copy of it lives.**
--
-- ============================================================================
-- WHY THIS IS A TABLE AND NOT A ROW IN EITHER STORE THAT ALREADY EXISTS
-- ============================================================================
--
-- Two candidates, and each is refused by a NOT NULL column rather than by
-- taste:
--
--   casting_ink_designs      requires `placement` and `side` — WHERE ON HER the
--                            design goes. The universal attach is one `+` and
--                            one sentence; she attaches a picture BEFORE she has
--                            said anything about it, and the interpreter reads
--                            the placement out of the sentence later. There is
--                            nothing to put in those columns at attach time, and
--                            a guessed placement on the ink road is the value
--                            that cost 300 credits twice for the wrong
--                            anatomical side.
--   casting_reference_crops  holds a CUT and says so in its own docblock —
--                            "OUR copy of the CUT, under the candidate's purge
--                            path. Never the upload." An attachment is the
--                            uncut picture, which is the one thing that row is
--                            defined not to be.
--
-- ============================================================================
-- ⚠ THE PHOTOGRAPH IS KEPT, AND THAT IS A CHANGE — ruled fable-1063 §2
-- ============================================================================
--
-- 0040's docblock says the uploaded picture is *"read once and dropped"* and
-- that *"no rectangle of a stranger's face exists anywhere in this product."*
-- Both sentences were true of the crop road when they were written, and the
-- second stops being true of the product on the day this table gains a row.
--
-- The KEEP was ruled deliberately and for two stated reasons: a crop minted
-- from an attachment becomes a library carrier that must be RE-DERIVABLE, and
-- *"attach it again"* is the exact friction the founder was complaining about
-- when he asked for this build. It is not a quiet convenience.
--
-- What bounds it is written into the row rather than promised beside it:
--
--   * the object lives under the candidate's own purge path and dies with her
--     Cast, unconditionally and NOT gated on any flag — same terms as the ink
--     design and the crop, and the sweep clause lands with this migration
--     rather than with the writer;
--   * ONE SHARED per-Cast cap with the ink door's 8, counted across both
--     stores, not 8 + 8 (the rider on the KEEP), so the purge surface stays
--     bounded;
--   * `provenance` is NOT NULL and has no default. Either we made the picture
--     or somebody agreed to it; there is no third kind and a picture that is
--     neither does not get a quieter label, it does not get in. The column
--     rides from the first commit for fable-922 §3a's reason — provenance added
--     afterwards has to be back-filled with a guess, and a guessed provenance is
--     exactly the value the fence cannot tolerate.
--
-- ============================================================================
-- THE TWO LINES THAT CONTAIN THE KEEP (ordered fable-1071 §4)
-- ============================================================================
--
-- A kept photograph is only as safe as what may be done with it, so the bounds
-- are stated where the row is defined rather than in a design note:
--
--   1. THE KEPT PICTURE NEVER RIDES WHOLE TO ANY ENGINE. CROPS ONLY. A feature
--      travels as its own segmented cutout — the fence is met by the FORM,
--      which is the founder's own ruling and the reason a rectangle containing
--      a face is the named fidelity violation. `storageKey` is an input to a
--      cutter and to nothing else.
--   2. NO STAFF PROJECTION EVER SELECTS THIS ROW. Not the moderator surface,
--      not the admin one, not an export. A customer's cast is her work and her
--      reference photograph is more private than the cast.
--
-- ============================================================================
-- WHAT IS ABSENT, AND THE ABSENCE IS THE DESIGN
-- ============================================================================
--
-- No `instruction`, no `sentence`, no reader's prose, no description of who is
-- in the picture. An attachment is bytes and their provenance; what a customer
-- ASKS of it belongs to the refine that spends, and a description of a person
-- read off her photograph is the field this program is most careful never to
-- persist. The short column list is the boundary (invariant 8), and it is
-- absent from the row rather than omitted from a projection.
--
-- No `placement` and no `side`, per the reasoning above: this row cannot claim
-- anything about a body, so it cannot be wrong about one.
--
-- ============================================================================
-- THE ENUMS ARE DERIVED, AND THIS FILE IS THE COPY THAT GETS CHECKED
-- ============================================================================
--
-- `provenance` is the ink road's own two words, compared against the constant by
-- `referenceAttachSchema.test.ts` on every commit, and by the ceremony against
-- what the DATABASE actually accepted — a file can be right about a table that
-- was created from an older copy of it.
--
-- ============================================================================
-- AND THERE IS NO `intents` COLUMN, WHICH IS THE OTHER HALF OF THE SAME POINT
-- ============================================================================
--
-- The ink design row carries one, because that door is reached by a customer
-- who has already said what she is taking and where it goes. **This door is
-- reached before she has typed anything at all** — the box is one `+` and one
-- sentence, and the sentence comes after (design §2: the interpreter, told an
-- image is attached, answers what is being taken).
--
-- fable-937's rule is *no extraction without intent*, and it is honoured where
-- the extraction happens rather than here: nothing is taken from an attachment
-- at attach time — no read, no cut, no money — so there is nothing yet for an
-- intent to authorise. A NOT NULL column here would have to be filled with a
-- guess about an ask that does not exist, and a guessed value in a fence column
-- is precisely what this road cannot tolerate. The demand tally fable-937 asked
-- for is fed by the extraction, which is the event that knows the answer.
--
-- ============================================================================
-- PURELY ADDITIVE
-- ============================================================================
--
-- One new table. No column of any existing table changes. It lands ahead of its
-- writer for the standing reason — a new table is in every INSERT the moment its
-- writer ships, so there is no dark landing for one — and ahead of its sweep
-- clause for the sharper one: a row-driven purge that gains its clause when the
-- writer lands is a purge that was missing for however long the writer shipped
-- first, and the objects it would have missed are photographs of real people.
CREATE TABLE `casting_reference_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`candidateId` int NOT NULL,
	`provenance` enum('synthetic','consented') NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`digest` varchar(64) NOT NULL,
	`mime` varchar(64) NOT NULL,
	`byteSize` int NOT NULL,
	`width` int NOT NULL,
	`height` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `casting_reference_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ix_casting_reference_attachments_candidate` ON `casting_reference_attachments` (`candidateId`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_casting_reference_attachments_publicId` ON `casting_reference_attachments` (`publicId`);
