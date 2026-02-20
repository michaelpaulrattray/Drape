#!/bin/bash
# Dead code audit: find exported symbols with 0 references outside their own file
cd /home/ubuntu/formastudio

echo "=== SERVER DB LAYER ==="
for f in server/db/*.ts; do
  [ "$f" = "server/db/index.ts" ] && continue
  [ "$f" = "server/db/connection.ts" ] && continue
  grep -oP '(?<=^export (async )?function )\w+|(?<=^export const )\w+|(?<=^export type )\w+|(?<=^export interface )\w+' "$f" 2>/dev/null | while read name; do
    count=$(grep -rn "\b${name}\b" server/ client/ shared/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "^${f}:" | grep -v "\.test\.ts:" | wc -l)
    if [ "$count" -eq 0 ]; then
      echo "  DEAD [$f]: $name"
    fi
  done
done

echo ""
echo "=== SERVER CASTING LAYER ==="
for f in server/casting/*.ts; do
  grep -oP '(?<=^export (async )?function )\w+|(?<=^export const )\w+|(?<=^export type )\w+|(?<=^export interface )\w+' "$f" 2>/dev/null | while read name; do
    count=$(grep -rn "\b${name}\b" server/ client/ shared/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "^${f}:" | grep -v "\.test\.ts:" | wc -l)
    if [ "$count" -eq 0 ]; then
      echo "  DEAD [$f]: $name"
    fi
  done
done

echo ""
echo "=== SERVER ROUTES ==="
for f in server/routes/*.ts server/routes/**/*.ts; do
  [ ! -f "$f" ] && continue
  grep -oP '(?<=^export (async )?function )\w+|(?<=^export const )\w+' "$f" 2>/dev/null | while read name; do
    count=$(grep -rn "\b${name}\b" server/ client/ shared/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "^${f}:" | grep -v "\.test\.ts:" | wc -l)
    if [ "$count" -eq 0 ]; then
      echo "  DEAD [$f]: $name"
    fi
  done
done

echo ""
echo "=== SERVER SECURITY ==="
for f in server/security/*.ts; do
  [ "$(basename $f)" = "*.ts" ] && continue
  grep -oP '(?<=^export (async )?function )\w+|(?<=^export const )\w+' "$f" 2>/dev/null | while read name; do
    count=$(grep -rn "\b${name}\b" server/ client/ shared/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "^${f}:" | grep -v "\.test\.ts:" | wc -l)
    if [ "$count" -eq 0 ]; then
      echo "  DEAD [$f]: $name"
    fi
  done
done

echo ""
echo "=== SERVER SLACK ==="
for f in server/slack/*.ts; do
  grep -oP '(?<=^export (async )?function )\w+|(?<=^export const )\w+' "$f" 2>/dev/null | while read name; do
    count=$(grep -rn "\b${name}\b" server/ client/ shared/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "^${f}:" | grep -v "\.test\.ts:" | wc -l)
    if [ "$count" -eq 0 ]; then
      echo "  DEAD [$f]: $name"
    fi
  done
done

echo ""
echo "=== SERVER STRIPE ==="
for f in server/stripe/*.ts; do
  grep -oP '(?<=^export (async )?function )\w+|(?<=^export const )\w+' "$f" 2>/dev/null | while read name; do
    count=$(grep -rn "\b${name}\b" server/ client/ shared/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "^${f}:" | grep -v "\.test\.ts:" | wc -l)
    if [ "$count" -eq 0 ]; then
      echo "  DEAD [$f]: $name"
    fi
  done
done

echo ""
echo "=== SERVER ROOT FILES ==="
for f in server/auditLog.ts server/health.ts server/heroProxy.ts server/klaviyo.ts server/storage.ts; do
  [ ! -f "$f" ] && continue
  grep -oP '(?<=^export (async )?function )\w+|(?<=^export const )\w+' "$f" 2>/dev/null | while read name; do
    count=$(grep -rn "\b${name}\b" server/ client/ shared/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "^${f}:" | grep -v "\.test\.ts:" | wc -l)
    if [ "$count" -eq 0 ]; then
      echo "  DEAD [$f]: $name"
    fi
  done
done

echo ""
echo "=== SERVER MONITORING/LOGGING ==="
for f in server/monitoring/*.ts server/logging/*.ts; do
  [ ! -f "$f" ] && continue
  [ "$(basename $f)" = "index.ts" ] && continue
  grep -oP '(?<=^export (async )?function )\w+|(?<=^export const )\w+' "$f" 2>/dev/null | while read name; do
    count=$(grep -rn "\b${name}\b" server/ client/ shared/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "^${f}:" | grep -v "\.test\.ts:" | wc -l)
    if [ "$count" -eq 0 ]; then
      echo "  DEAD [$f]: $name"
    fi
  done
done
