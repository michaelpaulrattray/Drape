import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const source = resolve(
  process.cwd(),
  "server",
  "casting",
  "evidence",
  "poseModels",
);
const destination = resolve(process.cwd(), "dist", "poseModels");

await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true, force: true });
