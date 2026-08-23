/**
 * EVERY STATIC ASSET THE CLIENT NAMES, AND WHETHER THE BUCKET HOLDS IT.
 *
 * `ASSETS_BASE_URL` (`shared/const.ts`) is the base for logos, swatches and
 * textures, and the client builds URLs off it as plain template literals. A
 * reference added without the upload is a BROKEN IMAGE in production — visible
 * to a customer, invisible to the type checker, and invisible to the whole test
 * suite, because the bytes live in a bucket rather than in the repository.
 *
 * That is the same shape as the flag positions and the database schema: state
 * this repo cannot hold, so the only honest check is to ask the thing itself at
 * the one moment something is already asking it (fable-1433 §2).
 *
 * # What it read on the day it was written (2026-08-23)
 *
 * 24 referenced paths, every one a literal — no `${ASSETS_BASE_URL}/${variable}`
 * anywhere in the tree, which is the one shape this reader cannot follow and is
 * therefore checked for explicitly rather than hoped about. All 24 answered 200
 * from the production bucket. Production sets `VITE_ASSETS_BASE_URL` to its own
 * bucket rather than falling back to the dev default baked into `shared/const.ts`
 * — also read rather than assumed, because that fallback is exactly the kind of
 * thing that works locally and serves a developer's bucket to customers.
 *
 * # Why a miss is not fatal to the rite
 *
 * Same rule as the OpenRouter and fal balance lines beside it: an unreachable
 * bucket is reported as UNREAD, never as conforming, and does not cost the run
 * its verdict. A 404 from a bucket that ANSWERED is a different thing and does.
 */

/** A reference the reader found, and the file it was found in. */
export type AssetReference = { readonly path: string; readonly file: string };

/**
 * Paths referenced through `ASSETS_BASE_URL`, read as literals.
 *
 * ⚠ **AND THE ONE SHAPE IT CANNOT FOLLOW IS RETURNED, NOT SWALLOWED.** A
 * reference built from a variable — `` `${ASSETS_BASE_URL}/${slug}.png` `` —
 * names a file this reader cannot know, so it comes back in `dynamic` and the
 * caller says so out loud. A scanner that silently skipped those would report a
 * complete-looking list of a subset, which is this repository's most-repeated
 * defect.
 */
export function assetReferencesIn(
  files: ReadonlyArray<{ path: string; text: string }>,
): { references: AssetReference[]; dynamic: AssetReference[] } {
  const references = new Map<string, string>();
  const dynamic: AssetReference[] = [];

  for (const file of files) {
    for (const hit of file.text.matchAll(/\$\{ASSETS_BASE_URL\}\/([^`"']*)/g)) {
      const tail = hit[1]!;
      if (tail.includes("${")) {
        dynamic.push({ path: tail, file: file.path });
        continue;
      }
      const cleaned = tail.trim();
      if (!cleaned || !/^[A-Za-z0-9._/-]+$/.test(cleaned)) continue;
      if (!references.has(cleaned)) references.set(cleaned, file.path);
    }
  }

  return {
    references: [...references]
      .map(([path, file]) => ({ path, file }))
      .sort((a, b) => a.path.localeCompare(b.path)),
    dynamic,
  };
}

export type AssetVerdict = {
  readonly line: string;
  readonly problems: string[];
};

/**
 * Fold the fetched statuses into a verdict.
 *
 * `statuses` is path to HTTP status, or `null` where the request itself failed.
 * A null is UNREAD and never a problem; a real non-200 from a bucket that
 * answered is.
 */
export function assetVerdict(
  references: ReadonlyArray<AssetReference>,
  dynamic: ReadonlyArray<AssetReference>,
  statuses: ReadonlyMap<string, number | null>,
): AssetVerdict {
  if (references.length === 0) {
    return {
      line: "(unread — no asset reference found, which cannot be right)",
      problems: [
        "the static-asset reader found no reference at all — re-point it rather than letting an empty scan read as a clean bucket",
      ],
    };
  }

  const unread = references.filter((reference) => statuses.get(reference.path) == null);
  const missing = references.filter((reference) => {
    const status = statuses.get(reference.path);
    return status != null && status !== 200;
  });

  const problems = [
    ...missing.map(
      (reference) =>
        `${reference.path}: referenced in ${reference.file} and the bucket answered ${statuses.get(reference.path)} — a broken image on a customer's screen`,
    ),
    ...dynamic.map(
      (reference) =>
        `${reference.file} builds an asset URL from a VARIABLE (…/${reference.path}) — this reader cannot follow it, so that asset is unchecked and the count above is not the whole list`,
    ),
  ];

  const read = references.length - unread.length;
  return {
    line:
      `${references.length} referenced · ${read} read · ${unread.length} unread`
      + (dynamic.length ? ` · ${dynamic.length} DYNAMIC and unfollowable` : ""),
    problems,
  };
}
