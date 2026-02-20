/**
 * Fix pino argument order.
 * 
 * Pino API:
 *   log.info("message")                    → OK (single string)
 *   log.info({ key: val }, "message")      → OK (object + string)
 *   log.info("message", value)             → WRONG (string + value)
 *   log.error("message", error)            → WRONG (string + error)
 *
 * This script finds patterns like:
 *   log.error("some message", someVar)
 *   log.error("some message:", someVar)
 *   log.warn("some message", someVar)
 *   log.info("some message", someVar)
 *
 * And converts them to:
 *   log.error({ err: someVar }, "some message")
 *   log.warn({ err: someVar }, "some message")
 *   log.info({ data: someVar }, "some message")
 *
 * For template literals with embedded vars, leave as single-arg calls.
 */
import fs from "fs";
import path from "path";

const SERVER_DIR = path.resolve("server");

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

/**
 * Match log.{level}("string", variable) patterns and fix argument order.
 * This handles the common case where the first arg is a string literal
 * and the second arg is a variable or expression.
 */
function fixFile(filePath) {
  let content = fs.readFileSync(filePath, "utf-8");
  if (!content.includes("log.")) return false;
  
  let changed = false;
  
  // Pattern: log.error("message", variable)
  // Captures: level, message string (with quotes), variable name
  // We need to handle both single and double quotes, and backtick strings
  
  // Strategy: line-by-line processing for simple single-line cases
  const lines = content.split("\n");
  const newLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Match: log.{error|warn|info}("string literal", someExpression)
    // But NOT: log.{error|warn|info}({ ... }, "string")  (already correct)
    // And NOT: log.{error|warn|info}("string")  (single arg, fine)
    // And NOT: log.{error|warn|info}(`template ${var}`)  (single arg, fine)
    
    const match = line.match(
      /^(\s*)log\.(error|warn|info)\(("[^"]*"|'[^']*'|`[^`]*`),\s*(.+)\);?\s*$/
    );
    
    if (match) {
      const [, indent, level, msgStr, secondArg] = match;
      const trimmedSecondArg = secondArg.replace(/\);?\s*$/, "").trim();
      
      // Skip if second arg is already an object literal (rare edge case)
      if (trimmedSecondArg.startsWith("{")) {
        newLines.push(line);
        continue;
      }
      
      // Clean the message string (remove trailing colon if present)
      let cleanMsg = msgStr;
      
      // Determine the context key based on level
      const ctxKey = level === "info" ? "data" : "err";
      
      // Check if the line ends with );
      const hasSemicolon = line.trimEnd().endsWith(";");
      const suffix = hasSemicolon ? ";" : "";
      
      newLines.push(`${indent}log.${level}({ ${ctxKey}: ${trimmedSecondArg} }, ${cleanMsg})${suffix}`);
      changed = true;
    } else {
      newLines.push(line);
    }
  }
  
  if (changed) {
    fs.writeFileSync(filePath, newLines.join("\n"), "utf-8");
  }
  return changed;
}

const files = findTsFiles(SERVER_DIR);
let fixed = 0;

for (const f of files) {
  if (f.includes("logging/")) continue;
  if (fixFile(f)) {
    fixed++;
    console.log(`✓ ${path.relative(SERVER_DIR, f)}`);
  }
}

console.log(`\nDone: ${fixed} files fixed`);
