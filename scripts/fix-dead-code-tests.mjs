/**
 * Fix test files that reference removed dead code functions.
 * Strategy: Remove specific describe/it blocks that test removed functions,
 * and clean up imports of removed functions.
 */
import fs from "fs";

const removals = [
  // auditLog.test.ts — remove 3 tests in "Query Helpers" describe
  {
    file: "server/auditLog.test.ts",
    removeDescribes: ["Query Helpers"],
    removeImports: ["getUserAuditLogs", "getAuditLogsByAction", "getCriticalAuditLogs"],
  },
  // batch2-hardening.test.ts — remove tests that use getQueueConfig
  {
    file: "server/batch2-hardening.test.ts",
    removeDescribes: [],
    removeImports: ["getQueueConfig"],
    removeIts: [],
    // Need to remove the specific it() blocks that use getQueueConfig
    removePatterns: [
      /it\("reads IMAGE_CONCURRENCY[\s\S]*?\n  \}\);/gm,
      /it\("reads TEXT_CONCURRENCY[\s\S]*?\n  \}\);/gm,
      /it\("getQueueStats returns[\s\S]*?\n  \}\);/gm,
    ],
  },
  // batch3-hardening.test.ts — uses resetCircuitBreaker and getCircuitBreakerStats extensively
  // The entire file is about circuit breaker testing — need to remove those specific tests
  {
    file: "server/batch3-hardening.test.ts",
    removeImports: ["getCircuitBreakerStats", "resetCircuitBreaker"],
  },
  // aiService.test.ts — remove calculateCreditCost tests
  {
    file: "server/casting/aiService.test.ts",
    removeDescribes: ["Credit Costs"],
    removeImports: ["calculateCreditCost"],
  },
  // ipBlockingSlack.test.ts — remove checkIpBlocked tests
  {
    file: "server/ipBlockingSlack.test.ts",
    removeDescribes: ["checkIpBlocked"],
    removeImports: ["checkIpBlocked"],
  },
  // load-test-queue.test.ts — uses resetCircuitBreaker and getQueueConfig
  {
    file: "server/load-test-queue.test.ts",
    removeImports: ["resetCircuitBreaker", "getQueueConfig"],
  },
  // phase-a-quota.test.ts — uses getDailyLimit and getQueueConfig
  {
    file: "server/phase-a-quota.test.ts",
    removeDescribes: ["Configurable Queue Limits"],
    removeImports: ["getDailyLimit", "getQueueConfig"],
  },
  // adminSecurity.test.ts — remove verifyImmutableLogChain tests
  {
    file: "server/security/adminSecurity.test.ts",
    removeDescribes: ["Immutable Log"],
    removeImports: ["verifyImmutableLogChain"],
  },
  // slackApproval.test.ts — remove getPendingActionCount and getAdminPendingActions tests
  {
    file: "server/slack/slackApproval.test.ts",
    removeDescribes: ["getAdminPendingActions"],
    removeImports: ["getPendingActionCount", "getAdminPendingActions"],
  },
  // slackThreeChannel.test.ts — remove sendToChannel tests
  {
    file: "server/slack/slackThreeChannel.test.ts",
    removeDescribes: ["sendToChannel"],
    removeImports: ["sendToChannel"],
  },
];

function removeImportSymbol(content, symbol) {
  // Remove from destructured imports: import { a, symbol, b } from ...
  // Handle multiline imports too
  const patterns = [
    // Single line: import { ..., symbol, ... } from
    new RegExp(`\\b${symbol}\\b,?\\s*`, "g"),
    // Also handle leading comma: , symbol
    new RegExp(`,\\s*\\b${symbol}\\b`, "g"),
  ];
  
  // Simple approach: just remove the symbol from import lines
  const lines = content.split("\n");
  const result = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Check if this line is part of an import that contains the symbol
    if (line.includes(symbol) && (line.includes("import") || line.trim().startsWith(symbol))) {
      // Remove the symbol from the line
      line = line.replace(new RegExp(`\\b${symbol}\\b,?\\s*`), "");
      // Clean up trailing/leading commas
      line = line.replace(/,(\s*[}\)])/, "$1");
      line = line.replace(/\{\s*,/, "{");
      // If the line is now just whitespace or empty braces, skip it
      if (line.trim() === "" || line.trim() === "," || line.trim() === "{}") continue;
    }
    
    result.push(line);
  }
  
  return result.join("\n");
}

function removeDescribeBlock(content, describeName) {
  // Find the describe block and remove it entirely
  const regex = new RegExp(
    `(\\s*describe\\(["'\`]${describeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'\`].*?\\{)`,
    "s"
  );
  
  const match = content.match(regex);
  if (!match) return content;
  
  const startIdx = content.indexOf(match[0]);
  if (startIdx === -1) return content;
  
  // Find the matching closing brace
  let braceCount = 0;
  let endIdx = startIdx;
  let foundFirst = false;
  
  for (let i = startIdx; i < content.length; i++) {
    if (content[i] === "{") {
      braceCount++;
      foundFirst = true;
    } else if (content[i] === "}") {
      braceCount--;
      if (foundFirst && braceCount === 0) {
        // Find the end of the line (including );)
        let lineEnd = content.indexOf("\n", i);
        if (lineEnd === -1) lineEnd = content.length;
        // Check if there's a ); on this or next line
        const rest = content.substring(i, lineEnd + 3);
        if (rest.includes(");")) {
          endIdx = content.indexOf(");", i) + 2;
        } else {
          endIdx = lineEnd;
        }
        break;
      }
    }
  }
  
  // Remove the block
  return content.substring(0, startIdx) + content.substring(endIdx);
}

for (const removal of removals) {
  const filePath = removal.file;
  let content = fs.readFileSync(filePath, "utf-8");
  
  // Remove imports
  if (removal.removeImports) {
    for (const sym of removal.removeImports) {
      content = removeImportSymbol(content, sym);
    }
  }
  
  // Remove describe blocks
  if (removal.removeDescribes) {
    for (const desc of removal.removeDescribes) {
      content = removeDescribeBlock(content, desc);
    }
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed: ${filePath}`);
}

console.log("Done!");
