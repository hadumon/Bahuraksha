#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BASIN = process.env.RAINFALL_BASIN ?? "Bagmati Basin";
const LAT = Number(process.env.RAINFALL_LAT ?? 27.7172);
const LNG = Number(process.env.RAINFALL_LNG ?? 85.324);
const SOURCE_URL = "https://api.open-meteo.com/v1/forecast";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

function probabilityFromRainfall(mm) {
  if (mm >= 100) return 0.95;
  if (mm >= 50) return 0.82;
  if (mm >= 20) return 0.62;
  if (mm >= 10) return 0.42;
  return 0.22;
}

async function main() {
  const url = new URL(SOURCE_URL);
  url.searchParams.set("latitude", String(LAT));
  url.searchParams.set("longitude", String(LNG));
  url.searchParams.set("daily", "precipitation_sum,precipitation_probability_max");
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("timezone", "UTC");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const dates = payload.daily?.time ?? [];
  const rain = payload.daily?.precipitation_sum ?? [];
  const probs = payload.daily?.precipitation_probability_max ?? [];
  const issuedAt = new Date().toISOString();

  const rows = dates.map((date, index) => {
    const rainfallMm = Number(rain[index] ?? 0);
    const apiProbability = probs[index];
    const probability =
      typeof apiProbability === "number"
        ? Math.max(0, Math.min(1, apiProbability / 100))
        : probabilityFromRainfall(rainfallMm);

    return {
      basin: BASIN,
      forecast_date: date,
      rainfall_mm: rainfallMm,
      probability,
      model: "open-meteo-gfs",
      source: "open-meteo",
      issued_at: issuedAt,
      valid_at: `${date}T12:00:00.000Z`,
      confidence: probability,
      source_url: url.toString(),
    };
  });

  const { error } = await supabase.from("rainfall_forecasts").upsert(rows, {
    onConflict: "basin,forecast_date,model",
  });

  if (error) throw error;

  console.log(`Ingested ${rows.length} rainfall forecast rows for ${BASIN}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
