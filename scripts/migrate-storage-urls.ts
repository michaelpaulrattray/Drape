/**
 * Rewrite legacy Manus storage/CDN URLs in database records to their R2
 * equivalents. Intended for the production cutover.
 *
 * DRY-RUN BY DEFAULT — prints per-column match counts and sample rewrites
 * without touching the database. Pass --execute to apply.
 *
 * Usage:
 *   npx tsx scripts/migrate-storage-urls.ts \
 *     --old-prefix https://files.manuscdn.com/user_upload_by_module/session_file/310519663296068708/ \
 *     --old-prefix https://d2xsxph8kpxj0f.cloudfront.net/310519663296068708/ \
 *     [--new-base https://pub-xxx.r2.dev] [--database-url mysql://...] [--execute]
 *
 * The rewrite maps `<old-prefix><path>[?query]` → `<new-base>/<path>` (query
 * string dropped — presigned-URL signatures are meaningless on R2). Each
 * --old-prefix must therefore include everything up to the storage-key root,
 * so that the remainder of the path IS the R2 object key. Run the dry-run
 * first and eyeball the samples to confirm the mapping is right; objects must
 * already exist in R2 under those keys (see the asset re-hosting step).
 *
 * --new-base defaults to R2_PUBLIC_URL from the environment.
 * --database-url defaults to DATABASE_URL from the environment.
 */
import "dotenv/config";
import mysql from "mysql2/promise";

/** Every column that stores a full storage/CDN URL. Key columns are relative
 * keys and are unaffected by the host change, so they are not listed. */
const URL_COLUMNS: Array<{ table: string; column: string }> = [
  { table: "users", column: "avatarUrl" },
  { table: "users", column: "bannerUrl" },
  { table: "model_assets", column: "storageUrl" },
  { table: "generations", column: "resultUrl" },
  { table: "change_request_attachments", column: "url" },
  { table: "wardrobe_garments", column: "originalImageUrl" },
  { table: "wardrobe_garments", column: "isolatedImageUrl" },
  { table: "wardrobe_garments", column: "sourceImageUrl" },
  { table: "wardrobe_outfits", column: "resultThumbUrl" },
  { table: "wardrobe_sessions", column: "modelImageUrl" },
  { table: "wardrobe_looks", column: "imageUrl" },
  { table: "boards", column: "thumbnailUrl" },
  { table: "board_items", column: "imageUrl" },
  { table: "board_item_versions", column: "imageUrl" },
];

const SAMPLES_PER_COLUMN = 3;

function parseArgs(argv: string[]) {
  const oldPrefixes: string[] = [];
  let newBase = process.env.R2_PUBLIC_URL ?? "";
  let databaseUrl = process.env.DATABASE_URL ?? "";
  let execute = false;

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case "--old-prefix":
        oldPrefixes.push(argv[++i]);
        break;
      case "--new-base":
        newBase = argv[++i];
        break;
      case "--database-url":
        databaseUrl = argv[++i];
        break;
      case "--execute":
        execute = true;
        break;
      default:
        throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }

  if (oldPrefixes.length === 0) {
    throw new Error(
      "At least one --old-prefix is required (include everything up to the storage-key root)"
    );
  }
  if (!newBase) throw new Error("--new-base or R2_PUBLIC_URL is required");
  if (!databaseUrl) throw new Error("--database-url or DATABASE_URL is required");

  return { oldPrefixes, newBase: newBase.replace(/\/+$/, ""), databaseUrl, execute };
}

/** Map an old URL to its R2 equivalent, or null if no prefix matches. */
function rewriteUrl(url: string, oldPrefixes: string[], newBase: string): string | null {
  for (const prefix of oldPrefixes) {
    if (!url.startsWith(prefix)) continue;
    const rest = url.slice(prefix.length).split("?")[0].replace(/^\/+/, "");
    return `${newBase}/${rest}`;
  }
  return null;
}

async function main() {
  const { oldPrefixes, newBase, databaseUrl, execute } = parseArgs(process.argv);

  console.log(execute ? "MODE: EXECUTE — rows will be updated\n" : "MODE: dry-run (pass --execute to apply)\n");
  console.log(`New base: ${newBase}`);
  for (const p of oldPrefixes) console.log(`Old prefix: ${p}`);
  console.log("");

  const conn = await mysql.createConnection(databaseUrl);
  let totalMatched = 0;
  let totalUpdated = 0;

  try {
    for (const { table, column } of URL_COLUMNS) {
      // Fetch candidate rows for any of the old prefixes
      const likeClauses = oldPrefixes.map(() => `\`${column}\` LIKE ?`).join(" OR ");
      const likeParams = oldPrefixes.map((p) => `${p}%`);
      const [rows] = await conn.execute<mysql.RowDataPacket[]>(
        `SELECT id, \`${column}\` AS url FROM \`${table}\` WHERE ${likeClauses}`,
        likeParams
      );

      if (rows.length === 0) {
        console.log(`${table}.${column}: 0 rows`);
        continue;
      }
      totalMatched += rows.length;
      console.log(`${table}.${column}: ${rows.length} row(s)`);

      for (const [i, row] of rows.entries()) {
        const newUrl = rewriteUrl(row.url, oldPrefixes, newBase);
        if (!newUrl) continue; // LIKE matched but prefix check didn't — shouldn't happen

        if (i < SAMPLES_PER_COLUMN) {
          console.log(`  ${row.url}`);
          console.log(`    → ${newUrl}`);
        } else if (i === SAMPLES_PER_COLUMN) {
          console.log(`  … and ${rows.length - SAMPLES_PER_COLUMN} more`);
        }

        if (execute) {
          await conn.execute(
            `UPDATE \`${table}\` SET \`${column}\` = ? WHERE id = ?`,
            [newUrl, row.id]
          );
          totalUpdated++;
        }
      }
    }
  } finally {
    await conn.end();
  }

  console.log(`\n${totalMatched} row(s) matched across ${URL_COLUMNS.length} columns.`);
  console.log(execute ? `${totalUpdated} row(s) updated.` : "No rows updated (dry-run).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
