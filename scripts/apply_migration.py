"""Apply SQL migration via Supabase Management API or direct PostgreSQL."""
import os, sys, requests, json

env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            v = v.strip('"').strip("'")
            if k not in os.environ:
                os.environ[k] = v

url = os.environ.get("VITE_SUPABASE_URL") or os.environ.get("SUPABASE_URL", "")
key = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not url or not key:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY required")
    sys.exit(1)

if len(sys.argv) < 2:
    print("Usage: python apply_migration.py <sql_file>")
    sys.exit(1)

sql_file = sys.argv[1]
with open(sql_file, "r") as f:
    sql = f.read()

print(f"Migration: {sql_file} ({len(sql)} chars)")
print(f"Target: {url}")
host = url.replace("https://", "").split("/")[0]
project = host.split(".")[0]

# Method 1: Supabase Management API (runs SQL via REST)
mgmt_url = f"https://api.supabase.com/v1/projects/{project}/database/query"
headers = {
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json",
}

# Management API expects array of query objects
queries = []
for stmt in sql.split(";"):
    stmt = stmt.strip()
    if stmt and not stmt.startswith("--"):
        queries.append({"query": stmt + ";"})

print(f"Sending {len(queries)} statements via Management API...")

try:
    resp = requests.post(mgmt_url, headers=headers, json=queries, timeout=30)
    if resp.status_code < 300:
        print("Migration applied successfully!")
        sys.exit(0)
    else:
        print(f"Management API returned {resp.status_code}: {resp.text[:300]}")
except Exception as e:
    print(f"Management API failed: {e}")

# Method 2: Try SQL API endpoint
print("\nTrying SQL API endpoint...")
sql_url = f"https://{host}/rest/v1/rpc/"
try:
    resp = requests.post(sql_url, headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }, json={}, timeout=10)
    print(f"SQL API check: {resp.status_code}")
except Exception as e:
    print(f"SQL API failed: {e}")

print("\nCould not apply migration automatically.")
print(f"Please paste the SQL into: https://{project}.supabase.co/project/{project}/sql/new")
