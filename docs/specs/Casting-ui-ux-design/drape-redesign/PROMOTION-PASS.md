# The promotion pass

**Run at the end of every section from 02 onward. Half an hour, written, before the section is called done.**

This is the step that makes page-by-page safe. Building each page alone is right — it stops us predicting components nobody needs — but without this pass it produces what casting produced: a surface with 148KB of vocabulary only it understands.

The model is the audit filed as #262. It read the code, counted consumers, and was right about everything. Copy its method exactly.

## The method

**1. List what this section built.** Every component, hook and stylesheet block it added.

**2. For each one, count real consumers in the codebase.** Not planned surfaces. Not "the design shows it three times". Files that import it today.

**3. Anything at two or more gets promoted.** Move it to `client/src/foundation/`, have the original importer import it back, change nothing about how it behaves.

**4. Anything at one stays where it is.** It has not earned a place, and it may never — the next page that needs something similar may need it differently. Casting's viewer and Create's viewer look identical and do different jobs.

**5. Check for collisions before adding anything.** Grep the foundation for what you are about to promote. Three popover implementations existed simultaneously because section 00 built one without checking that `Popover.tsx` was already there.

**6. When two implementations collide, the one with real customers wins.** Not the newer one, not the tidier one. Fold in anything the loser has that the winner lacks, then delete it — never leave both alive as options.

## Naming

**Rename on the way in, not after.** A component that lands in the shared kit still called `BriefField` carries casting's vocabulary with it, and the next page inherits a word that means nothing there. Give promoted parts names that make sense to a page which has never heard of the section they came from.

## Output

A written list, filed as a card, before any code moves:

- what moves, with its consumer count
- what stays, and why
- any collision found, and which side wins
- any naming accident that should be fixed first

Then one PR. No behaviour changes. **The thing you should see afterwards is nothing at all.**

## ⚠ THE PASS IS AN ITEM ON THE SECTION'S CARD, AND THE CARD CANNOT CLOSE WITHOUT IT

**Founder, 2026-09-01, verbatim (#366):**

> "i think the components page is important so we are not designing 50 different
> styles of the same components and can easily look at our designs and make
> improvements etc. **so we have to ensure promotion passes run on ui
> improvements.**"

He asked because it had not been running. The pass was written on 2026-08-30
and ran ONCE, for section 02, because that card happened to say so — and the
instruction to run it lived only inside this document, which nothing reads.
Its sibling `BRIEF-RECONCILIATION.md` was wired into the standing orders and
this was not, so the check BEFORE a section was automatic and the check AFTER
was not. That is invariant 7 — *a control that is not invoked does not exist* —
and the fourth instance in one week.

**The rule, and it binds every UI section from here:**

- **A UI section card carries the promotion pass as an explicit item**, written
  on the card when the card is filed, not remembered at the end.
- **The card cannot close with that item undischarged.** "Nothing was
  promotable" is a discharge; silence is not.
- **The pass's written output is linked from the card**, as
  `PROMOTION_PASS_SECTION_02.md` already is.

**Two copies of this rule exist on purpose** — the standing orders (§2c) make it
happen, the card makes it checkable. Two copies of a rule usually drift, and
that is accepted here for one reason: **`.agents/` is gitignored, so no test can
ever assert that §2c still says what it says.** A shift that edited the
paragraph away would turn the pass off silently and nothing would go red. The
card is a GitHub issue — not gitignored, not local, and visible to him — so the
requirement lives somewhere its absence can be seen.

**And the measure of whether it is working is the specimen page** (`/admin/foundation`,
#261): one place he can open and see every shared part at once. The pass feeds
that page; the page is how he judges the pass. Neither is worth much alone.

**The evidence it was already needed, from one week of this codebase:** three
popover implementations alive at once, one of them built three days before the
audit found it; a rename dialog carrying its own scrim and portal and therefore
no focus trap at all; Create and Assets rendering as the same picture four rows
apart on the same rail; `campaign` and `tryon` byte-identical. Every one is a
component built twice because nobody counted.

## What this pass is not

- Not a refactor. If a promotion needs the component rewritten to be general, it is not ready — leave it and log it.
- Not a chance to tidy the original. Move it as it is.
- Not optional because the section was small. A two-component section takes ten minutes.
