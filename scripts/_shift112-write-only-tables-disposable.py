# DISPOSABLE (foreman-112) - the CLASS sweep behind the bug_reports finding.
# Which declared tables does product code WRITE and never READ?
# Code-only, no network, no database.
#
# Instrument checks, before any verdict is believed (working law 2):
#   * the extractor must account for EVERY mysqlTable( call in the schema,
#     or it throws - the first shape of this reader silently held 53 of 61
#     because eight declarations put the table name on the next line.
#   * `users` is the positive control: it must show writes AND reads.
#   * `bug_reports` is the known specimen: it must appear in the write-only
#     list, or the reader has stopped being able to find the thing it was
#     written to find.
import re, os, io, collections

root = os.getcwd()
schema = io.open(os.path.join(root, "drizzle", "schema.ts"), encoding="utf-8").read()
tables = re.findall(r'export const (\w+) = mysqlTable\(\s*"([^"]+)"', schema)
declared_calls = schema.count("mysqlTable(")
assert len(tables) == declared_calls, "extractor holds %d of %d mysqlTable declarations" % (len(tables), declared_calls)
print("declared tables: %d (all %d declarations accounted for)" % (len(tables), declared_calls))

targets = []
for base in ("server", "shared", "client/src"):
    for dirpath, dirnames, filenames in os.walk(os.path.join(root, base)):
        if "node_modules" in dirpath:
            continue
        for f in filenames:
            if not f.endswith((".ts", ".tsx")):
                continue
            if ".test." in f or f.endswith(".d.ts"):
                continue
            targets.append(os.path.join(dirpath, f))
print("non-test source files scanned: %d" % len(targets))

src = {}
for p in targets:
    try:
        src[p] = io.open(p, encoding="utf-8").read()
    except Exception:
        pass

rows = []
for sym, tbl in tables:
    w = collections.Counter()
    r = collections.Counter()
    where = []
    for p, s in src.items():
        rel = os.path.relpath(p, root).replace("\\", "/")
        wi = len(re.findall(r'\.insert\(\s*%s\b' % sym, s))
        wu = len(re.findall(r'\.update\(\s*%s\b' % sym, s))
        wd = len(re.findall(r'\.delete\(\s*%s\b' % sym, s))
        rf = len(re.findall(r'\.from\(\s*%s\b' % sym, s))
        rq = len(re.findall(r'\.query\.%s\b' % sym, s))
        rj = len(re.findall(r'Join\(\s*%s\b' % sym, s))
        w["insert"] += wi; w["update"] += wu; w["delete"] += wd
        r["from"] += rf; r["query"] += rq; r["join"] += rj
        if wi or wu or wd or rf or rq or rj:
            where.append(rel)
    rows.append((tbl, sym, sum(w.values()), sum(r.values()), dict(w), dict(r), where))

by_name = dict((x[0], x) for x in rows)
ctl = by_name["users"]
print("positive control  users: writes=%d reads=%d" % (ctl[2], ctl[3]))
assert ctl[2] > 0 and ctl[3] > 0, "control failed: users must be both written and read"

writeonly = [x for x in rows if x[2] > 0 and x[3] == 0]
assert any(x[0] == "bug_reports" for x in writeonly), "specimen control failed: bug_reports is not in the write-only list"

unused = [x for x in rows if x[2] == 0 and x[3] == 0]
print("")
print("=== WRITTEN, NEVER READ (%d) ===" % len(writeonly))
for tbl, sym, wn, rn, w, r, where in sorted(writeonly):
    print("  %-34s writes=%s" % (tbl, w))
    for f in sorted(where):
        print("      %s" % f)
print("")
print("=== NEITHER WRITTEN NOR READ by non-test source (%d) ===" % len(unused))
for tbl, sym, wn, rn, w, r, where in sorted(unused):
    print("  %s" % tbl)
