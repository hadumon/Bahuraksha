import { describe, it, expect, vi, beforeEach } from "vitest";
import { predictLandslideRisk, predictBatchLandslideRisk, checkApiHealth } from "@/lib/landslideModel";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("landslideModel (API client)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("predictLandslideRisk", () => {
    it("calls API and returns prediction", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          probability: 0.82,
          risk_level: "evacuate",
          susceptibility_score: 0.82,
          primary_driver: "slope_vegetation_interaction",
          secondary_drivers: ["road_slope_interaction", "rainfall_soil_coupling"],
          confidence: 0.91,
          time_horizon_hours: 72,
        }),
      });

      const result = await predictLandslideRisk({
        slopeAngleDeg: 45,
        soilMoisturePct: 80,
        rainfall7DayMm: 200,
        rainfallTodayMm: 40,
        seismicActivityMg: 0.01,
        vegetationCoverPct: 30,
        elevationM: 1500,
        distanceToRoadKm: 0.5,
      });

      expect(result.riskLevel).toBe("evacuate");
      expect(result.probability).toBe(0.82);
      expect(result.primaryDriver).toBe("slope_vegetation_interaction");
    });

    it("throws when API fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(predictLandslideRisk({
        slopeAngleDeg: 45,
        soilMoisturePct: 80,
        rainfall7DayMm: 200,
        rainfallTodayMm: 40,
        seismicActivityMg: 0.01,
        vegetationCoverPct: 30,
        elevationM: 1500,
        distanceToRoadKm: 0.5,
      })).rejects.toThrow("Landslide ML API unreachable");
    });
  });

  describe("predictBatchLandslideRisk", () => {
    it("calls batch API and returns predictions", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          predictions: [
            {
              probability: 0.75,
              risk_level: "warning",
              susceptibility_score: 0.75,
              primary_driver: "rainfall_soil_coupling",
              secondary_drivers: ["slope_angle_deg"],
              confidence: 0.85,
              time_horizon_hours: 72,
            },
            {
              probability: 0.25,
              risk_level: "safe",
              susceptibility_score: 0.25,
              primary_driver: "vegetation_cover_pct",
              secondary_drivers: ["elevation_m"],
              confidence: 0.80,
              time_horizon_hours: 72,
            },
          ],
          count: 2,
        }),
      });

      const zones = [
        { id: "1", name: "Zone A", district: "District 1", coordinates: [27.7, 85.3] as [number, number], slopeAngleDeg: 30, soilMoisturePct: 50, rainfall7DayMm: 100, rainfallTodayMm: 10, seismicActivityMg: 0.002, vegetationCoverPct: 60, elevationM: 1000, distanceToRoadKm: 2 },
        { id: "2", name: "Zone B", district: "District 2", coordinates: [27.8, 85.4] as [number, number], slopeAngleDeg: 45, soilMoisturePct: 80, rainfall7DayMm: 200, rainfallTodayMm: 30, seismicActivityMg: 0.01, vegetationCoverPct: 30, elevationM: 1500, distanceToRoadKm: 0.5 },
      ];

      const results = await predictBatchLandslideRisk(zones);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("1");
      expect(results[1].id).toBe("2");
    });

    it("throws when API fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const zones = [
        { id: "1", name: "Zone A", district: "District 1", coordinates: [27.7, 85.3] as [number, number], slopeAngleDeg: 30, soilMoisturePct: 50, rainfall7DayMm: 100, rainfallTodayMm: 10, seismicActivityMg: 0.002, vegetationCoverPct: 60, elevationM: 1000, distanceToRoadKm: 2 },
      ];

      await expect(predictBatchLandslideRisk(zones)).rejects.toThrow("Landslide ML API unreachable");
    });
  });

  describe("checkApiHealth", () => {
    it("returns true when API is healthy", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      expect(await checkApiHealth()).toBe(true);
    });

    it("returns false when API is down", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));
      expect(await checkApiHealth()).toBe(false);
    });
  });
});
