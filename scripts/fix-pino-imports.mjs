/**
 * Fix broken pino imports that were inserted inside multi-line import blocks.
 * 
 * Strategy:
 * 1. Remove the incorrectly placed import and const lines
 * 2. Find the actual end of all import statements
 * 3. Re-insert them in the correct position
 */
import fs from "fs";
import path from "path";

const SERVER_DIR = path.resolve("server");

function getModuleName(filePath) {
  const rel = path.relative(SERVER_DIR, filePath);
  const parts = rel.replace(/\.ts$/, "").split(path.sep);
  if (parts.length === 1) return parts[0];
  return parts.slice(0, 2).join("/");
}

function getRelativeImportPath(filePath) {
  const dir = path.dirname(filePath);
  let rel = path.relative(dir, path.join(SERVER_DIR, "logging/logger"));
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel.replace(/\\/g, "/");
}

function findTsFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      results.push(...findTsFiles(full));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      results.push(full);
    }
  }
  return results;
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, "utf-8");
  
  if (!content.includes("createModuleLogger")) return false;
  // Skip the logger module itself
  if (filePath.includes("logging/")) return false;
  
  const moduleName = getModuleName(filePath);
  const importPath = getRelativeImportPath(filePath);
  
  // Remove existing logger import and const lines
  const lines = content.split("\n");
  const filtered = lines.filter(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('import { createModuleLogger }')) return false;
    if (trimmed.startsWith('const log = createModuleLogger(')) return false;
    return true;
  });
  
  // Find the correct insertion point: after the last complete import block
  // An import block ends when we see a line that:
  // - Is not part of an import statement
  // - Is not a comment
  // - Is not empty
  let insertIdx = 0;
  let inImportBlock = false;
  let braceDepth = 0;
  
  for (let i = 0; i < filtered.length; i++) {
    const line = filtered[i];
    const trimmed = line.trim();
    
    // Track brace depth for multi-line imports
    if (trimmed.startsWith("import ") || inImportBlock) {
      inImportBlock = true;
      for (const ch of trimmed) {
        if (ch === "{") braceDepth++;
        if (ch === "}") braceDepth--;
      }
      if (trimmed.includes(" from ") && braceDepth <= 0) {
        inImportBlock = false;
        braceDepth = 0;
        insertIdx = i + 1;
      } else if (trimmed.endsWith(";") && braceDepth <= 0) {
        inImportBlock = false;
        braceDepth = 0;
        insertIdx = i + 1;
      }
    }
    
    // Also handle: } from "..." lines
    if (trimmed.startsWith("} from ")) {
      inImportBlock = false;
      braceDepth = 0;
      insertIdx = i + 1;
    }
    
    // Stop searching after we hit non-import code
    if (!inImportBlock && insertIdx > 0 && trimmed && 
        !trimmed.startsWith("import ") && !trimmed.startsWith("//") && 
        !trimmed.startsWith("/*") && !trimmed.startsWith("*") &&
        !trimmed.startsWith("} from ") && trimmed !== "") {
      break;
    }
  }
  
  // Insert the import and const at the correct position
  const importLine = `import { createModuleLogger } from "${importPath}";`;
  const constLine = `const log = createModuleLogger("${moduleName}");`;
  
  filtered.splice(insertIdx, 0, importLine, constLine);
  
  const newContent = filtered.join("\n");
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, "utf-8");
    return true;
  }
  return false;
}

const files = findTsFiles(SERVER_DIR);
let fixed = 0;

for (const f of files) {
  if (fixFile(f)) {
    fixed++;
    console.log(`✓ Fixed: ${path.relative(SERVER_DIR, f)}`);
  }
}

console.log(`\nDone: ${fixed} files fixed`);
