#!/bin/bash
# Dead code audit v2: find exported symbols with 0 references outside their own file
cd /home/ubuntu/formastudio

check_file() {
  local f="$1"
  # Extract exported function/const/type/interface names
  grep -E "^export " "$f" | sed -E 's/^export (async )?function ([a-zA-Z0-9_]+).*/\2/;s/^export const ([a-zA-Z0-9_]+).*/\1/;s/^export type ([a-zA-Z0-9_]+).*/\1/;s/^export interface ([a-zA-Z0-9_]+).*/\1/;s/^export enum ([a-zA-Z0-9_]+).*/\1/' | grep -E '^[a-zA-Z]' | while read name; do
    # Skip very short names that would false-positive
    [ ${#name} -lt 3 ] && continue
    # Count references outside the file (excluding tests)
    count=$(grep -rn "\b${name}\b" server/ client/ shared/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "^${f}:" | grep -v "\.test\.ts:" | wc -l)
    if [ "$count" -eq 0 ]; then
      echo "  DEAD [$f]: $name"
    fi
  done
}

echo "=== SERVER DB LAYER ==="
for f in server/db/*.ts; do
  [ "$f" = "server/db/index.ts" ] && continue
  [ "$f" = "server/db/connection.ts" ] && continue
  check_file "$f"
done

echo ""
echo "=== SERVER CASTING LAYER ==="
for f in server/casting/*.ts; do
  check_file "$f"
done

echo ""
echo "=== SERVER ROUTES ==="
for f in $(find server/routes -name "*.ts"); do
  check_file "$f"
done

echo ""
echo "=== SERVER SECURITY ==="
for f in server/security/*.ts; do
  check_file "$f"
done

echo ""
echo "=== SERVER SLACK ==="
for f in server/slack/*.ts; do
  check_file "$f"
done

echo ""
echo "=== SERVER STRIPE ==="
for f in server/stripe/*.ts; do
  check_file "$f"
done

echo ""
echo "=== SERVER ROOT FILES ==="
for f in server/auditLog.ts server/health.ts server/heroProxy.ts server/klaviyo.ts server/storage.ts; do
  [ ! -f "$f" ] && continue
  check_file "$f"
done

echo ""
echo "=== SERVER MONITORING/LOGGING ==="
for f in server/monitoring/*.ts server/logging/*.ts; do
  [ ! -f "$f" ] && continue
  [ "$(basename $f)" = "index.ts" ] && continue
  check_file "$f"
done

echo ""
echo "=== SERVER LIB ==="
for f in $(find server/lib -name "*.ts" 2>/dev/null); do
  [ "$(basename $f)" = "index.ts" ] && continue
  check_file "$f"
done

echo ""
echo "=== SHARED ==="
for f in $(find shared -name "*.ts" 2>/dev/null); do
  [ "$(basename $f)" = "index.ts" ] && continue
  check_file "$f"
done

echo ""
echo "=== CLIENT PAGES ==="
for f in client/src/pages/*.tsx; do
  check_file "$f"
done

echo ""
echo "=== CLIENT COMPONENTS ==="
for f in client/src/components/*.tsx; do
  check_file "$f"
done

echo ""
echo "=== CLIENT FEATURES ==="
for f in $(find client/src/features -name "*.tsx" -o -name "*.ts" 2>/dev/null); do
  check_file "$f"
done

echo ""
echo "=== CLIENT HOOKS ==="
for f in $(find client/src/hooks -name "*.ts" -o -name "*.tsx" 2>/dev/null); do
  check_file "$f"
done

echo ""
echo "=== CLIENT CONTEXTS ==="
for f in $(find client/src/contexts -name "*.tsx" -o -name "*.ts" 2>/dev/null); do
  check_file "$f"
done

echo ""
echo "DONE"
