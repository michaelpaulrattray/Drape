import "dotenv/config";
import { sweepStaleGenerationOperations } from "../server/casting/operationRecovery";

if (!process.argv.includes("--execute")) {
  throw new Error("Refusing to adjudicate operations without the explicit --execute flag");
}
const limitArg = Number(process.argv.find((arg) => arg.startsWith("--limit="))?.split("=")[1] ?? 25);
const result = await sweepStaleGenerationOperations({ limit: limitArg });
process.stdout.write(`${JSON.stringify(result)}\n`);
