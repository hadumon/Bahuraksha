import { describe, it, expect } from "vitest";
import { computeCompositeRiskZones } from "@/lib/riskEngine";
import type { LiveRiskZone } from "@/lib/operationalData";
import type { PredictionResponse } from "@/lib/bahuraksha-api";

const testZone: LiveRiskZone = {
  id: "zone-1",
  name: "Test Zone",
  district: "Kathmandu",
  riskLevel: "watch",
  floodProb: 0.3,
  landslideProb: 0.1,
  population: 50000,
  coordinates: [27.7, 85.3],
};

const mockPrediction: PredictionResponse = {
  status: "ok",
  isMock: true,
  request: { date: "2026-05-30", bbox: [86.0, 27.7, 86.6, 28.1] },
  prediction: { class: 1, label: "flood_water", color: "#1a6faf", confidence: 0.89, risk_score: 82.5 },
};

const realPrediction: PredictionResponse = {
  status: "ok",
  request: { date: "2026-05-30", bbox: [86.0, 27.7, 86.6, 28.1] },
  prediction: { class: 0, label: "dry_land", color: "#22c55e", confidence: 0.92, risk_score: 15.0 },
};

describe("computeCompositeRiskZones", () => {
  it("excludes mocked XGBoost prediction from composite score", () => {
    const result = computeCompositeRiskZones({
      zones: [testZone],
      stations: [],
      rainfall: [],
      xgboostPrediction: mockPrediction,
    });

    expect(result[0].drivers.xgboost).toBe(0);
  });

  it("includes real XGBoost prediction in composite score", () => {
    const result = computeCompositeRiskZones({
      zones: [testZone],
      stations: [],
      rainfall: [],
      xgboostPrediction: realPrediction,
    });

    expect(result[0].drivers.xgboost).toBeGreaterThan(0);
  });

  it("sets data quality to low when only mocked XGBoost available", () => {
    const result = computeCompositeRiskZones({
      zones: [testZone],
      stations: [],
      rainfall: [],
      xgboostPrediction: mockPrediction,
    });

    expect(result[0].dataQuality).toBe("low");
  });
});
