#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const API_BASE = "https://flood-api.open-meteo.com/v1/flood";

const STATIONS = [
  { name: "Chovar Station",  lat: 27.660, lng: 85.290, dangerLevel: 5.5, warningLevel: 4.8 },
  { name: "Sundarijal Station", lat: 27.770, lng: 85.420, dangerLevel: 4.5, warningLevel: 3.8 },
  { name: "Gokarna Station", lat: 27.730, lng: 85.370, dangerLevel: 5.5, warningLevel: 4.8 },
  { name: "Teku Station",    lat: 27.695, lng: 85.305, dangerLevel: 5.5, warningLevel: 4.8 },
  { name: "Pashupati Station", lat: 27.710, lng: 85.350, dangerLevel: 5.5, warningLevel: 4.8 },
];

function dischargeToLevel(discharge, dangerLevel, warningLevel) {
  const warningMid = (dangerLevel + warningLevel) / 2;
  if (discharge <= 0) return 1.5;
  return Math.min(discharge * 0.45 + 1.0, dangerLevel * 1.2);
}

function trendFromValues(values) {
  if (values.length < 2) return "stable";
  const recent = values.slice(0, 3);
  const older = values.slice(-3);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  const diff = recentAvg - olderAvg;
  if (diff > 0.15) return "rising";
  if (diff < -0.15) return "falling";
  return "stable";
}

function riskLevelFromLevel(current, dangerLevel, warningLevel) {
  if (current >= dangerLevel) return "evacuate";
  if (current >= warningLevel) return "warning";
  if (current >= warningLevel * 0.8) return "watch";
  if (current <= 0) return "safe";
  return "safe";
}

async function fetchDischarge(lat, lng) {
  const url = new URL(API_BASE);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("daily", "river_discharge");
  url.searchParams.set("past_days", "3");
  url.searchParams.set("forecast_days", "3");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo Flood API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function main() {
  console.log("=== Bahuraksha River Level Ingestion ===\n");

  const results = [];

  for (const station of STATIONS) {
    try {
      const data = await fetchDischarge(station.lat, station.lng);
      const dates = data.daily?.time ?? [];
      const discharges = data.daily?.river_discharge ?? [];

      if (dates.length === 0) {
        console.log(`[${station.name}] No data returned.`);
        results.push({ station: station.name, status: "no data" });
        continue;
      }

      const levels = discharges.map((d) =>
        dischargeToLevel(d, station.dangerLevel, station.warningLevel),
      );

      const currentLevel = levels[0] ?? 0;
      const trend = trendFromValues(levels);
      const riskLevel = riskLevelFromLevel(currentLevel, station.dangerLevel, station.warningLevel);

      const { data: existingStations, error: lookupErr } = await supabase
        .from("river_stations")
        .select("id, current_level, trend, risk_level")
        .eq("name", station.name)
        .limit(1);

      if (lookupErr) {
        console.error(`[${station.name}] Lookup error:`, lookupErr.message);
        results.push({ station: station.name, status: "lookup error" });
        continue;
      }

      if (existingStations && existingStations.length > 0) {
        const stationId = existingStations[0].id;
        const { error: updateErr } = await supabase
          .from("river_stations")
          .update({
            current_level: currentLevel,
            trend,
            risk_level: riskLevel,
            last_updated: new Date().toISOString(),
            source: "open-meteo-flood",
          })
          .eq("id", stationId);

        if (updateErr) {
          console.error(`[${station.name}] Update error:`, updateErr.message);
          results.push({ station: station.name, status: "update error" });
          continue;
        }

        const observations = dates.map((date, i) => ({
          station_id: stationId,
          observed_at: `${date}T12:00:00.000Z`,
          actual_level: i < Math.ceil(dates.length / 2) ? levels[i] : null,
          predicted_level: levels[i],
          danger_level: station.dangerLevel,
          warning_level: station.warningLevel,
          source: "open-meteo-flood",
        }));

        const { error: obsErr } = await supabase
          .from("river_level_observations")
          .insert(observations);

        if (obsErr) {
          console.error(`[${station.name}] Observation insert error:`, obsErr.message);
          results.push({ station: station.name, status: "obs error" });
          continue;
        }

        console.log(
          `[${station.name}] ✓ Level: ${currentLevel.toFixed(2)}m, ${riskLevel}, ${trend} — ${observations.length} obs`,
        );
        results.push({
          station: station.name,
          status: "ok",
          level: currentLevel,
          riskLevel,
          trend,
          observations: observations.length,
        });
      } else {
        console.log(`[${station.name}] ✗ Not found in river_stations table. Skipping.`);
        results.push({ station: station.name, status: "not found in DB" });
      }
    } catch (err) {
      console.error(`[${station.name}] Fatal error:`, err.message);
      results.push({ station: station.name, status: "error", error: err.message });
    }
  }

  console.log("\n=== Run Summary ===");
  console.table(results);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
