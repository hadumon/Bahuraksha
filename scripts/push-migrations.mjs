import { readFileSync, readdirSync } from "fs";
import { join, resolve } from "path";

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) throw new Error("Set SUPABASE_ACCESS_TOKEN env var");
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "pzofgoiaittsmlqaeexg";
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

const migrationsDir = resolve("supabase/migrations");

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

async function runSql(sql) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function main() {
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf-8").trim();
    if (!sql) continue;

    // Split by semicolons, but preserve $$...$$ dollar-quoted blocks
    const stmts = [];
    let current = "";
    let inDollar = false;
    let dollarTag = "";
    for (let i = 0; i < sql.length; i++) {
      const ch = sql[i];
      if (!inDollar && ch === "$" && i + 1 < sql.length && sql[i + 1] === "$") {
        inDollar = true;
        dollarTag = "$$";
        current += "$$";
        i++;
        continue;
      }
      if (inDollar && dollarTag === "$$" && ch === "$" && i + 1 < sql.length && sql[i + 1] === "$") {
        inDollar = false;
        current += "$$";
        i++;
        continue;
      }
      if (!inDollar && ch === "$") {
        // Check for $tag$ style
        let tag = "$";
        let j = i + 1;
        while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) { tag += sql[j]; j++; }
        if (j < sql.length && sql[j] === "$") {
          inDollar = true;
          dollarTag = tag + "$";
          current += dollarTag;
          i = j;
          continue;
        }
      }
      if (inDollar && ch === "$") {
        let endTag = "$";
        let j = i + 1;
        while (j < sql.length && /[a-zA-Z0-9_]/.test(sql[j])) { endTag += sql[j]; j++; }
        if (j < sql.length && sql[j] === "$" && endTag + "$" === dollarTag) {
          inDollar = false;
          current += dollarTag;
          i = j;
          continue;
        }
      }

      if (!inDollar && ch === ";") {
        const trimmed = current.trim();
        if (trimmed) stmts.push(trimmed);
        current = "";
      } else {
        current += ch;
      }
    }
    const trimmed = current.trim();
    if (trimmed) stmts.push(trimmed);

    console.log(`\n--- ${file} (${stmts.length} statements) ---`);
    for (let i = 0; i < stmts.length; i++) {
      const stmt = stmts[i];
      try {
        // Skip COMMENT ON and empty
        if (stmt.startsWith("--") || stmt === "") continue;
        const short = stmt.slice(0, 80).replace(/\n/g, " ") + (stmt.length > 80 ? "..." : "");
        await runSql(stmt);
        console.log(`  [${i + 1}/${stmts.length}] OK: ${short}`);
      } catch (err) {
        console.error(`  [${i + 1}/${stmts.length}] FAIL: ${err.message}`);
        console.error(`    SQL: ${stmt.slice(0, 150)}`);
      }
    }
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
