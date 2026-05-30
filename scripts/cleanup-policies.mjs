const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) throw new Error("Set SUPABASE_ACCESS_TOKEN env var");
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "pzofgoiaittsmlqaeexg";
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

const oldPolicies = [
  'DROP POLICY IF EXISTS "Alerts are publicly readable" ON public.alerts',
  'DROP POLICY IF EXISTS "Reports are publicly readable" ON public.citizen_reports',
  'DROP POLICY IF EXISTS "Anyone can submit reports" ON public.citizen_reports',
  'DROP POLICY IF EXISTS "Data sources are publicly readable" ON public.data_sources',
  'DROP POLICY IF EXISTS "Risk zones are publicly readable" ON public.risk_zones',
  'DROP POLICY IF EXISTS "River stations are publicly readable" ON public.river_stations',
  'DROP POLICY IF EXISTS "River level observations are publicly readable" ON public.river_level_observations',
  'DROP POLICY IF EXISTS "Rainfall forecasts are publicly readable" ON public.rainfall_forecasts',
  'DROP POLICY IF EXISTS "Satellite products are publicly readable" ON public.satellite_products',
  'DROP POLICY IF EXISTS "Sentinel scenes are publicly readable" ON public.sentinel_scenes',
  'DROP POLICY IF EXISTS "Glacial lakes are publicly readable" ON public.glacial_lakes',
  'DROP POLICY IF EXISTS "Risk zone assessments are publicly readable" ON public.risk_zone_assessments',
  'DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles',
  'DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles',
];

async function run() {
  for (const sql of oldPolicies) {
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify({ query: sql }),
      });
      const text = await res.text();
      if (res.ok) console.log("OK: " + sql);
      else if (text.includes('does not exist')) console.log("SKIP (nonexistent): " + sql.slice(0, 50));
      else console.log("FAIL: " + text.slice(0, 100));
    } catch (e) {
      console.log("ERROR: " + e.message);
    }
  }
  console.log("Done");
}

run();
