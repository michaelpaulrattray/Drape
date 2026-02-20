/**
 * Migrate console.* calls to structured pino logger.
 * 
 * Strategy:
 * - For each file, determine the module name from the file path
 * - Add `import { createModuleLogger } from "../logging/logger";` (adjusted for depth)
 * - Add `const log = createModuleLogger("moduleName");`
 * - Replace console.log → log.info
 * - Replace console.warn → log.warn
 * - Replace console.error → log.error
 * 
 * Skips: _core/ files (framework plumbing), test files, logging/ itself
 */
import fs from "fs";
import path from "path";

const SERVER_DIR = path.resolve("server");
const SKIP_DIRS = ["_core", "logging"];
const SKIP_PATTERNS = [".test.ts", "node_modules"];

function getModuleName(filePath) {
  const rel = path.relative(SERVER_DIR, filePath);
  const parts = rel.replace(/\.ts$/, "").split(path.sep);
  // Use the directory name or file name as module
  if (parts.length === 1) return parts[0];
  return parts.slice(0, 2).join("/");
}

function getRelativeImportPath(filePath) {
  const dir = path.dirname(filePath);
  let rel = path.relative(dir, path.join(SERVER_DIR, "logging/logger"));
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel.replace(/\\/g, "/");
}

function shouldSkip(filePath) {
  const rel = path.relative(SERVER_DIR, filePath);
  if (SKIP_PATTERNS.some(p => filePath.includes(p))) return true;
  if (SKIP_DIRS.some(d => rel.startsWith(d + path.sep) || rel.startsWith(d + "/"))) return true;
  return false;
}

function findTsFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findTsFiles(full));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      results.push(full);
    }
  }
  return results;
}

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, "utf-8");
  
  // Check if file has any console.* calls
  if (!/console\.(log|warn|error)\s*\(/.test(content)) return false;
  
  const moduleName = getModuleName(filePath);
  const importPath = getRelativeImportPath(filePath);
  
  // Check if already migrated
  if (content.includes("createModuleLogger")) return false;
  
  // Add import at the top (after existing imports)
  const importLine = `import { createModuleLogger } from "${importPath}";\n`;
  const loggerLine = `const log = createModuleLogger("${moduleName}");\n`;
  
  // Find the last import statement
  const lines = content.split("\n");
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ") || lines[i].startsWith("} from ")) {
      lastImportIdx = i;
    }
    // Stop at first non-import, non-empty, non-comment line after imports
    if (lastImportIdx >= 0 && i > lastImportIdx + 1 && 
        lines[i].trim() && !lines[i].startsWith("import ") && 
        !lines[i].startsWith("} from ") && !lines[i].startsWith("//") &&
        !lines[i].startsWith(" *") && !lines[i].startsWith("/*")) {
      break;
    }
  }
  
  if (lastImportIdx === -1) {
    // No imports found, add at top
    content = importLine + loggerLine + "\n" + content;
  } else {
    lines.splice(lastImportIdx + 1, 0, importLine.trimEnd(), loggerLine.trimEnd());
    content = lines.join("\n");
  }
  
  // Replace console.log with log.info
  // Handle multi-line console calls by matching balanced parens
  content = content.replace(/console\.log\(/g, "log.info(");
  content = content.replace(/console\.warn\(/g, "log.warn(");
  content = content.replace(/console\.error\(/g, "log.error(");
  
  fs.writeFileSync(filePath, content, "utf-8");
  return true;
}

// Main
const files = findTsFiles(SERVER_DIR);
let migrated = 0;
let skipped = 0;

for (const f of files) {
  if (shouldSkip(f)) {
    skipped++;
    continue;
  }
  if (migrateFile(f)) {
    migrated++;
    console.log(`✓ ${path.relative(SERVER_DIR, f)}`);
  }
}

console.log(`\nDone: ${migrated} files migrated, ${skipped} files skipped`);
