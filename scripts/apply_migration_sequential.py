"""Apply migration SQL sequentially, one statement at a time via temp files."""
import os
import re
import sys
import subprocess
import tempfile
import time
import urllib.parse

env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            v = v.strip('"').strip("'")
            if k not in os.environ:
                os.environ[k] = v

if len(sys.argv) < 2:
    print("Usage: python apply_migration_sequential.py <sql_file>")
    sys.exit(1)

sql_file = sys.argv[1]
with open(sql_file, "r") as f:
    full_sql = f.read()

# Split SQL into individual statements, keeping $$ function bodies intact
statements = []
current = []
dollar_depth = 0
paren_depth = 0

for line in full_sql.split("\n"):
    stripped = line.strip()
    
    # Track dollar-quote depth (for PL/pgSQL function bodies)
    if "$$" in stripped:
        count = stripped.count("$$")
        dollar_depth += count if count % 2 == 1 else 0
        dollar_depth = dollar_depth % 2  # toggle for odd counts
    
    current.append(line)
    
    if dollar_depth == 0 and stripped.endswith(";"):
        stmt = "\n".join(current).strip()
        # Skip pure comment lines
        if stmt and not all(l.strip().startswith("--") for l in stmt.split("\n")):
            statements.append(stmt)
        current = []

# Don't forget trailing statement
if current:
    stmt = "\n".join(current).strip()
    if stmt and not all(l.strip().startswith("--") for l in stmt.split("\n")):
        statements.append(stmt)

print(f"Split into {len(statements)} statements")

passwd = os.environ.get("DB_PASSWORD", "CLB3570C@90")
encoded_pass = urllib.parse.quote(passwd, safe='')
db_url = f"postgresql://postgres:{encoded_pass}@db.pzofgoiaittsmlqaeexg.supabase.co:5432/postgres?sslmode=require&connect_timeout=10"
workdir = os.path.dirname(os.path.dirname(__file__))

success = 0
failed = 0
skipped = 0

for i, stmt in enumerate(statements):
    stmt_preview = stmt[:100].replace("\n", " ")
    print(f"[{i+1}/{len(statements)}] {stmt_preview}...")

    # Write to temp file to avoid shell quoting issues
    with tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False, encoding="utf-8") as f:
        f.write(stmt)
        tmp_path = f.name

    try:
        supabase_bin = r"C:\Users\Lenovo\AppData\Roaming\npm\node_modules\supabase\node_modules\@supabase\cli-windows-x64\bin\supabase.exe"
        result = subprocess.run(
            [supabase_bin, "db", "query", "--db-url", db_url, "-f", tmp_path],
            capture_output=True, text=True, timeout=30,
            env={**os.environ, "NODE_OPTIONS": ""},
            cwd=workdir,
        )

        if result.returncode == 0:
            print(f"  ✓ OK")
            success += 1
        else:
            err = (result.stderr or result.stdout or "").strip()
            err_lower = err.lower()
            if "already exists" in err_lower or "duplicate" in err_lower:
                print(f"  ~ Already exists (OK)")
                success += 1
            elif "does not exist" in err_lower and ("trigger" in err_lower or "policy" in err_lower):
                print(f"  ~ Skipped (not needed): {err[:150]}")
                skipped += 1
                success += 1
            else:
                print(f"  ✗ {err[:200]}")
                failed += 1
    except subprocess.TimeoutExpired:
        print(f"  ⏱ Timeout")
        failed += 1
    finally:
        try:
            os.unlink(tmp_path)
        except:
            pass
    
    time.sleep(0.2)

print(f"\nResult: {success} succeeded, {failed} failed, {skipped} skipped")
if failed > 0:
    print("Some statements failed — check above for details")
    sys.exit(1)
