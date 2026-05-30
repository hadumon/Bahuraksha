const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) throw new Error("Set SUPABASE_ACCESS_TOKEN env var");
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "pzofgoiaittsmlqaeexg";
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

async function q(sql) {
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function main() {
  const tables = await q(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
  );
  console.log("Tables (" + tables.length + "):");
  for (const t of tables) {
    const cnt = await q("SELECT count(*) as c FROM " + t.table_name);
    console.log("  " + t.table_name + ": " + cnt[0].c + " rows");
  }

  const policies = await q(
    "SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname",
  );
  console.log("\nRLS policies (" + policies.length + "):");
  for (const p of policies) console.log("  " + p.tablename + " -> " + p.policyname);

  const triggers = await q(
    "SELECT event_object_table AS table_name, trigger_name FROM information_schema.triggers WHERE trigger_schema = 'public' ORDER BY event_object_table, trigger_name",
  );
  console.log("\nTriggers:");
  for (const t of triggers) console.log("  " + t.table_name + " -> " + t.trigger_name);
}

main().catch((e) => console.error("Error:", e.message));
