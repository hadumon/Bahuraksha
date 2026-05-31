import { supabase } from "@/integrations/supabase/client";
import type { RiskLevel } from "@/lib/operationalData";

function parseSecondaryDrivers(val: unknown): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
}

export type LandslidePredictionRecord = {
  id?: string;
  zone_id: string;
  zone_name: string;
  district: string;
  coordinates: [number, number];
  probability: number;
  risk_level: RiskLevel;
  susceptibility_score: number;
  primary_driver: string;
  secondary_drivers: string[];
  confidence: number;
  time_horizon_hours: number;
  model_source: "ml-api" | "heuristic";
  feature_contributions?: Record<string, number>;
  created_at?: string;
};

export async function fetchLatestLandslidePredictions(limit = 50) {
  const { data, error } = await supabase
    .from("landslide_predictions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data?.length) {
    return [] as LandslidePredictionRecord[];
  }

  return data
    .filter((row) => row.latitude != null && row.longitude != null)
    .map((row: Record<string, unknown>) => ({
      id: row.id as string,
      zone_id: row.zone_id as string,
      zone_name: row.zone_name as string,
      district: row.district as string,
      coordinates: [row.latitude as number, row.longitude as number] as [number, number],
      probability: row.probability as number,
      risk_level: row.risk_level as RiskLevel,
      susceptibility_score: row.susceptibility_score as number,
      primary_driver: row.primary_driver as string,
      secondary_drivers: parseSecondaryDrivers(row.secondary_drivers),
      confidence: row.confidence as number,
      time_horizon_hours: row.time_horizon_hours as number,
      model_source: (row.model_source as "ml-api" | "heuristic") ?? "heuristic",
      feature_contributions: (row.feature_contributions as Record<string, number>) ?? undefined,
      created_at: row.created_at as string,
    }));
}

export async function fetchLandslidePredictionHistory(
  zoneId: string,
  limit = 100,
) {
  const { data, error } = await supabase
    .from("landslide_predictions")
    .select("*")
    .eq("zone_id", zoneId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data?.length) {
    return [] as LandslidePredictionRecord[];
  }

  return data
    .filter((row) => row.latitude != null && row.longitude != null)
    .map((row: Record<string, unknown>) => ({
      id: row.id as string,
      zone_id: row.zone_id as string,
      zone_name: row.zone_name as string,
      district: row.district as string,
      coordinates: [row.latitude as number, row.longitude as number] as [number, number],
      probability: row.probability as number,
      risk_level: row.risk_level as RiskLevel,
      susceptibility_score: row.susceptibility_score as number,
      primary_driver: row.primary_driver as string,
      secondary_drivers: parseSecondaryDrivers(row.secondary_drivers),
      confidence: row.confidence as number,
      time_horizon_hours: row.time_horizon_hours as number,
      model_source: (row.model_source as "ml-api" | "heuristic") ?? "heuristic",
      feature_contributions: (row.feature_contributions as Record<string, number>) ?? undefined,
      created_at: row.created_at as string,
    }));
}
