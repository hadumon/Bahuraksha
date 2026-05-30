import type { RiskLevel } from "@/lib/operationalData";

const API_BASE = import.meta.env.VITE_LANDSLIDE_API_URL || "http://localhost:8000";

export type LandslideInput = {
  slopeAngleDeg: number;
  soilMoisturePct: number;
  rainfall7DayMm: number;
  rainfallTodayMm: number;
  seismicActivityMg: number;
  vegetationCoverPct: number;
  elevationM: number;
  distanceToRoadKm: number;
  distanceToRiverKm?: number;
  curvature?: number;
  aspectDeg?: number;
  ndvi?: number;
  lithologyCode?: number;
  landUseCode?: number;
};

export type LandslidePrediction = {
  susceptibilityScore: number;
  probability: number;
  riskLevel: RiskLevel;
  primaryDriver: string;
  secondaryDrivers: string[];
  confidence: number;
  timeHorizonHours: number;
};

export type LandslideZoneInput = LandslideInput & {
  id: string;
  name: string;
  district: string;
  coordinates: [number, number];
};

function toApiInput(input: LandslideInput) {
  return {
    slope_angle_deg: input.slopeAngleDeg,
    soil_moisture_pct: input.soilMoisturePct,
    rainfall_7d_mm: input.rainfall7DayMm,
    rainfall_today_mm: input.rainfallTodayMm,
    seismic_activity_mg: input.seismicActivityMg,
    vegetation_cover_pct: input.vegetationCoverPct,
    elevation_m: input.elevationM,
    distance_to_road_km: input.distanceToRoadKm,
    distance_to_river_km: input.distanceToRiverKm ?? 1.0,
    curvature: input.curvature ?? 0.0,
    aspect_deg: input.aspectDeg ?? 180.0,
    ndvi: input.ndvi ?? 0.5,
    lithology_code: input.lithologyCode ?? 3.0,
    land_use_code: input.landUseCode ?? 3.0,
  };
}

function fromApiPrediction(resp: {
  probability: number;
  risk_level: string;
  susceptibility_score: number;
  primary_driver: string;
  secondary_drivers: string[];
  confidence: number;
  time_horizon_hours: number;
}): LandslidePrediction {
  return {
    susceptibilityScore: resp.susceptibility_score,
    probability: resp.probability,
    riskLevel: resp.risk_level as RiskLevel,
    primaryDriver: resp.primary_driver,
    secondaryDrivers: resp.secondary_drivers,
    confidence: resp.confidence,
    timeHorizonHours: resp.time_horizon_hours,
  };
}

export async function predictLandslideRisk(
  input: LandslideInput,
  timeHorizonHours = 72,
): Promise<LandslidePrediction> {
  try {
    const response = await fetch(`${API_BASE}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toApiInput(input)),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return fromApiPrediction(data);
  } catch {
    throw new Error("Landslide ML API unreachable");
  }
}

export async function predictBatchLandslideRisk(
  inputs: LandslideZoneInput[],
  timeHorizonHours = 72,
): Promise<(LandslidePrediction & { id: string; name: string; district: string })[]> {
  try {
    const response = await fetch(`${API_BASE}/predict/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locations: inputs.map(toApiInput) }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.predictions.map((pred: Record<string, unknown>, i: number) => ({
      ...fromApiPrediction(pred as Parameters<typeof fromApiPrediction>[0]),
      id: inputs[i].id,
      name: inputs[i].name,
      district: inputs[i].district,
    }));
  } catch {
    throw new Error("Landslide ML API unreachable");
  }
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
