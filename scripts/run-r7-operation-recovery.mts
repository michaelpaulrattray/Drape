import "dotenv/config";
import { sweepStaleGenerationOperations } from "../server/casting/operationRecovery";

if (!process.argv.includes("--execute")) {
  throw new Error("Refusing to adjudicate operations without the explicit --execute flag");
}
const limitArg = Number(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? 25);
const result = await sweepStaleGenerationOperations({ limit: limitArg });
process.stdout.write(`${JSON.stringify(result)}\n`);

/* A script exits when its work is done — an app service leaves the loop alive (fable-127/246). */
process.exit(0);
