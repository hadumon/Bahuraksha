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
  isMock?: boolean;
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
    const fallback = fallbackPrediction(input, timeHorizonHours);
    fallback.isMock = true;
    return fallback;
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
    return inputs.map((input) => ({
      ...fallbackPrediction(input, timeHorizonHours),
      isMock: true,
      id: input.id,
      name: input.name,
      district: input.district,
    }));
  }
}

function fallbackPrediction(input: LandslideInput, timeHorizonHours: number): LandslidePrediction {
  const slopeFactor = Math.min(input.slopeAngleDeg / 45, 1) * 0.25;
  const moistureFactor = (input.soilMoisturePct / 100) * 0.20;
  const rainFactor = Math.min(input.rainfall7DayMm / 300, 1) * 0.20;
  const rainTodayFactor = Math.min(input.rainfallTodayMm / 60, 1) * 0.10;
  const seismicFactor = Math.min(input.seismicActivityMg / 0.05, 1) * 0.10;
  const vegetationFactor = (1 - input.vegetationCoverPct / 100) * 0.08;
  const roadFactor = Math.max(0, 1 - input.distanceToRoadKm / 2) * 0.07;

  const probability = Math.min(
    1,
    slopeFactor + moistureFactor + rainFactor + rainTodayFactor + seismicFactor + vegetationFactor + roadFactor,
  );

  let riskLevel: RiskLevel = "safe";
  if (probability >= 0.78) riskLevel = "evacuate";
  else if (probability >= 0.58) riskLevel = "warning";
  else if (probability >= 0.32) riskLevel = "watch";

  const drivers = [
    { name: "Slope angle", value: slopeFactor },
    { name: "Soil moisture", value: moistureFactor },
    { name: "7-day rainfall", value: rainFactor },
    { name: "Today's rainfall", value: rainTodayFactor },
    { name: "Seismic activity", value: seismicFactor },
    { name: "Vegetation cover", value: vegetationFactor },
    { name: "Road proximity", value: roadFactor },
  ].sort((a, b) => b.value - a.value);

  return {
    susceptibilityScore: probability,
    probability,
    riskLevel,
    primaryDriver: drivers[0]?.name ?? "Unknown",
    secondaryDrivers: drivers.slice(1, 4).map((d) => d.name),
    confidence: 0.75,
    timeHorizonHours,
  };
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
