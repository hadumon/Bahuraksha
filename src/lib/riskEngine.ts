import type {
  LiveRainfallForecast,
  LiveRiskZone,
  LiveRiverStation,
  RiskLevel,
} from "@/lib/operationalData";
import type { PredictionResponse } from "@/lib/bahuraksha-api";
import { hecRasScenarioResults } from "@/lib/hecrasModel";

export type RainfallRiskLevel = "light" | "moderate" | "heavy" | "extreme";

export type RainfallForecastPoint = LiveRainfallForecast & {
  intensity: RainfallRiskLevel;
  source: "database" | "local-model";
};

export type RainfallSummary = {
  total7DayMm: number;
  maxDailyMm: number;
  maxProbability: number;
  peakDay: string;
  intensity: RainfallRiskLevel;
  riskScore: number;
  source: "database" | "local-model";
};

export type CompositeRiskZone = LiveRiskZone & {
  computedRiskLevel: RiskLevel;
  computedFloodProb: number;
  compositeScore: number;
  drivers: {
    storedFlood: number;
    rainfall: number;
    nearestStation: number;
    xgboost: number;
    hecRas: number;
    landslide: number;
  };
  nearestStationName?: string;
  dataQuality: "seeded" | "computed";
};

const KATHMANDU_MONSOON_NORMAL_MM = [4, 5, 8, 18, 64, 236, 363, 331, 200, 51, 8, 3];

export function classifyRainfallIntensity(mm: number): RainfallRiskLevel {
  if (mm >= 100) return "extreme";
  if (mm >= 50) return "heavy";
  if (mm >= 10) return "moderate";
  return "light";
}

export function rainfallIntensityToRiskScore(intensity: RainfallRiskLevel, probability = 1) {
  const base = {
    light: 0.15,
    moderate: 0.35,
    heavy: 0.68,
    extreme: 0.92,
  }[intensity];

  return clamp01(base * (0.55 + 0.45 * probability));
}

export function generateLocalRainfallForecast(date = new Date()): RainfallForecastPoint[] {
  const month = date.getMonth();
  const monthlyNormal = KATHMANDU_MONSOON_NORMAL_MM[month] ?? 25;
  const dailyNormal = monthlyNormal / 30;

  return Array.from({ length: 7 }, (_, i) => {
    const forecastDate = new Date(date);
    forecastDate.setDate(date.getDate() + i);

    const seasonalWave = 0.85 + 0.35 * Math.sin((forecastDate.getDate() + month * 3) / 4);
    const eventPulse = i >= 2 && i <= 4 ? 1.55 : 1;
    const rainfall = Math.max(0, dailyNormal * seasonalWave * eventPulse);
    const probability = clamp01(0.45 + rainfall / 120);
    const intensity = classifyRainfallIntensity(rainfall);

    return {
      day: forecastDate.toLocaleDateString([], { weekday: "short" }),
      rainfall: Number(rainfall.toFixed(1)),
      probability: Number(probability.toFixed(2)),
      forecastDate: forecastDate.toISOString().slice(0, 10),
      intensity,
      source: "local-model",
    };
  });
}

export function normalizeRainfallForecasts(data: LiveRainfallForecast[]): RainfallForecastPoint[] {
  if (!data.length) return generateLocalRainfallForecast();

  return data.map((point) => ({
    ...point,
    intensity: classifyRainfallIntensity(point.rainfall),
    source: "database",
  }));
}

export function summarizeRainfall(points: RainfallForecastPoint[]): RainfallSummary {
  const forecasts = points.length ? points : generateLocalRainfallForecast();
  const peak = forecasts.reduce((max, item) => (item.rainfall > max.rainfall ? item : max));
  const total7DayMm = forecasts.reduce((sum, item) => sum + item.rainfall, 0);
  const maxProbability = Math.max(...forecasts.map((item) => item.probability));
  const intensity = classifyRainfallIntensity(peak.rainfall);

  return {
    total7DayMm: Number(total7DayMm.toFixed(1)),
    maxDailyMm: peak.rainfall,
    maxProbability,
    peakDay: peak.day,
    intensity,
    riskScore: rainfallIntensityToRiskScore(intensity, maxProbability),
    source: forecasts.some((item) => item.source === "database") ? "database" : "local-model",
  };
}

export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 0.78) return "evacuate";
  if (score >= 0.58) return "warning";
  if (score >= 0.32) return "watch";
  return "safe";
}

export function computeCompositeRiskZones(params: {
  zones: LiveRiskZone[];
  stations: LiveRiverStation[];
  rainfall: RainfallForecastPoint[];
  xgboostPrediction?: PredictionResponse;
}): CompositeRiskZone[] {
  const rainfallSummary = summarizeRainfall(params.rainfall);
  const xgboostRisk = clamp01((params.xgboostPrediction?.prediction.risk_score ?? 0) / 100);

  return params.zones.map((zone) => {
    const nearestStation = findNearestStation(zone, params.stations);
    const stationRisk = nearestStation
      ? clamp01(nearestStation.currentLevel / nearestStation.dangerLevel)
      : 0;
    const hecRasRisk = hecRasRiskForNearestStation(zone);
    const landslideRainCoupling = clamp01(zone.landslideProb * rainfallSummary.riskScore);

    const compositeScore = clamp01(
      zone.floodProb * 0.26 +
        rainfallSummary.riskScore * 0.24 +
        stationRisk * 0.2 +
        xgboostRisk * 0.14 +
        hecRasRisk * 0.11 +
        landslideRainCoupling * 0.05,
    );

    return {
      ...zone,
      computedFloodProb: compositeScore,
      computedRiskLevel: riskLevelFromScore(compositeScore),
      compositeScore,
      nearestStationName: nearestStation?.name,
      dataQuality: "computed",
      drivers: {
        storedFlood: zone.floodProb,
        rainfall: rainfallSummary.riskScore,
        nearestStation: stationRisk,
        xgboost: xgboostRisk,
        hecRas: hecRasRisk,
        landslide: landslideRainCoupling,
      },
    };
  });
}

function findNearestStation(zone: LiveRiskZone, stations: LiveRiverStation[]) {
  if (!stations.length) return undefined;

  return stations.reduce((nearest, station) => {
    const stationDistance = distanceKm(zone.coordinates, station.location);
    const nearestDistance = distanceKm(zone.coordinates, nearest.location);
    return stationDistance < nearestDistance ? station : nearest;
  });
}

function hecRasRiskForNearestStation(zone: LiveRiskZone) {
  if (!hecRasScenarioResults.length) return 0;

  const nearest = hecRasScenarioResults.reduce((closest, result) => {
    const resultDistance = distanceKm(zone.coordinates, result.location);
    const closestDistance = distanceKm(zone.coordinates, closest.location);
    return resultDistance < closestDistance ? result : closest;
  });

  return clamp01(nearest.waterSurfaceM / nearest.dangerLevelM);
}

function distanceKm(a: [number, number], b: [number, number]) {
  const [lat1, lng1] = a;
  const [lat2, lng2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
