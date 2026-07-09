/**
 * Vitest global setup — loads .env so tests see the same configuration the
 * server does (API keys, OAuth client IDs, etc.).
 *
 * DATABASE_URL is deliberately stripped: .env points at the live Railway
 * database, and unit tests must never read from or write to it. Suites that
 * need a database skip themselves when DATABASE_URL is absent. To run them,
 * provide a disposable database via TEST_DATABASE_URL.
 */
import "dotenv/config";

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else {
  delete process.env.DATABASE_URL;
}
