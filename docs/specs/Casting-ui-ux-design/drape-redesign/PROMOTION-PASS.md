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

## What this pass is not

- Not a refactor. If a promotion needs the component rewritten to be general, it is not ready — leave it and log it.
- Not a chance to tidy the original. Move it as it is.
- Not optional because the section was small. A two-component section takes ten minutes.
