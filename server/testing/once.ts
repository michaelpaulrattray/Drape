/**
 * COMPUTE A DETERMINISTIC ANSWER ONCE (#2172).
 *
 * The gate's unit suite has no broad cost problem — it has a handful of files
 * that do the same expensive deterministic thing many times and throw the
 * answer away (#2172's reading: ten files were 50% of the suite's `tests`
 * seconds, and four of them were this shape). The repair in each is the same:
 * a tree listing, a file read, a comment strip, a parse or an image encode is
 * computed once per run and shared by the arms that ask for it.
 *
 * ⚠ **WHAT THIS IS FOR, AND THE ONE THING IT MUST NOT BE USED ON.** It is for
 * work whose answer cannot change during a run: a pure function of the tree on
 * disk, or of a constant. **It is NOT a cache for anything a test mutates, and
 * it is not a way to make an arm depend on an earlier arm having run.** A
 * shared value that any arm can write to is how a suite starts passing for the
 * wrong reason — the memo would carry one arm's mutation into the next, and
 * both would be green.
 *
 * ⚠ **AND A MEMO GOES SILENTLY INERT, so every use of it is sabotaged.** The
 * failure direction is the quiet one: a memo that returns a stale or empty
 * answer makes absence arms pass vacuously. Each caller's own suite therefore
 * has a case where the shared value is made WRONG and the arms that read it go
 * red — proving the memo is on the path rather than decoration.
 *
 * A thrown computation is NOT remembered: the next call tries again, which is
 * the same thing the un-memoised code did. Nothing here catches anything.
 */
export function once<T>(compute: () => T): () => T {
  let value: T;
  let computed = false;
  return () => {
    if (!computed) {
      value = compute();
      computed = true;
    }
    return value;
  };
}
