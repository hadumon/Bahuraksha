import { supabase } from "@/integrations/supabase/client";
import type { CompositeRiskZone } from "@/lib/riskEngine";

export type PersistRiskAssessmentResult = {
  attempted: number;
  inserted: number;
  error?: string;
};

export async function persistRiskAssessments(
  zones: CompositeRiskZone[],
): Promise<PersistRiskAssessmentResult> {
  if (!zones.length) return { attempted: 0, inserted: 0 };

  const rows = zones.map((zone) => ({
    zone_id: zone.id,
    zone_name: zone.name,
    computed_risk_level: zone.computedRiskLevel,
    composite_score: zone.compositeScore,
    computed_flood_probability: zone.computedFloodProb,
    data_quality: zone.dataQuality,
    nearest_station_name: zone.nearestStationName ?? null,
    drivers: zone.drivers,
    explanation: { bullets: zone.explanation },
    model_versions: {
      risk_engine: "frontend-v1",
      hecras: "bagmati-scaffold-v1",
      rainfall: "open-meteo-or-local-seasonal-v1",
      xgboost: "bahuraksha-api-v1",
    },
    source: "frontend-risk-engine",
  }));

  const { error } = await supabase.from("risk_zone_assessments" as never).insert(rows as never);

  if (error) {
    return { attempted: rows.length, inserted: 0, error: error.message };
  }

  return { attempted: rows.length, inserted: rows.length };
}
