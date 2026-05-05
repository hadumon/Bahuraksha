import type { RiskLevel } from "@/lib/operationalData";

export type HecRasStationResult = {
  stationId: string;
  stationName: string;
  riverKm: number;
  location: [number, number];
  scenario: "monsoon_watch" | "q2" | "q10" | "q25" | "q50";
  flowCms: number;
  waterSurfaceM: number;
  channelInvertM: number;
  depthM: number;
  velocityMs: number;
  warningLevelM: number;
  dangerLevelM: number;
  riskLevel: RiskLevel;
  arrivalTimeHours: number;
};

export type HecRasCrossSection = {
  id: string;
  riverKm: number;
  stationName: string;
  bankfullWidthM: number;
  leftOverbankN: number;
  channelN: number;
  rightOverbankN: number;
  notes: string;
};

export const hecRasModelMetadata = {
  river: "Bagmati River",
  reach: "Sundarijal/Gokarna to Chovar outlet",
  modelType: "HEC-RAS 1D unsteady scaffold",
  status: "Design scaffold, awaiting survey calibration",
  verticalDatum: "Local project datum, replace with surveyed datum",
  lastUpdated: "2026-05-05T00:00:00Z",
  disclaimer:
    "Planning scaffold only. Replace placeholder geometry, roughness, boundary conditions, and thresholds before operational use.",
};

export const hecRasCrossSections: HecRasCrossSection[] = [
  {
    id: "xs-sundarijal-01",
    riverKm: 20.4,
    stationName: "Sundarijal",
    bankfullWidthM: 22,
    leftOverbankN: 0.07,
    channelN: 0.04,
    rightOverbankN: 0.075,
    notes: "Steeper upstream reach, verify bed slope and boulder roughness.",
  },
  {
    id: "xs-gokarna-01",
    riverKm: 15.8,
    stationName: "Gokarna",
    bankfullWidthM: 30,
    leftOverbankN: 0.065,
    channelN: 0.038,
    rightOverbankN: 0.07,
    notes: "Urbanizing corridor, add bridges/encroachments during calibration.",
  },
  {
    id: "xs-pashupati-01",
    riverKm: 10.9,
    stationName: "Pashupati",
    bankfullWidthM: 34,
    leftOverbankN: 0.06,
    channelN: 0.036,
    rightOverbankN: 0.065,
    notes: "High exposure area, survey embankments and crossings.",
  },
  {
    id: "xs-teku-01",
    riverKm: 5.4,
    stationName: "Teku",
    bankfullWidthM: 42,
    leftOverbankN: 0.075,
    channelN: 0.04,
    rightOverbankN: 0.08,
    notes: "Critical urban flood reporting point, calibrate to gauge records.",
  },
  {
    id: "xs-chovar-01",
    riverKm: 0.8,
    stationName: "Chovar",
    bankfullWidthM: 45,
    leftOverbankN: 0.07,
    channelN: 0.038,
    rightOverbankN: 0.075,
    notes: "Downstream control/outlet, replace normal-depth BC with rating curve if available.",
  },
];

export const hecRasScenarioResults: HecRasStationResult[] = [
  {
    stationId: "st-2",
    stationName: "Sundarijal Station",
    riverKm: 20.4,
    location: [27.77, 85.42],
    scenario: "q10",
    flowCms: 210,
    waterSurfaceM: 3.92,
    channelInvertM: 0.85,
    depthM: 3.07,
    velocityMs: 2.1,
    warningLevelM: 3.8,
    dangerLevelM: 4.5,
    riskLevel: "warning",
    arrivalTimeHours: 0,
  },
  {
    stationId: "st-3",
    stationName: "Gokarna Station",
    riverKm: 15.8,
    location: [27.73, 85.37],
    scenario: "q10",
    flowCms: 255,
    waterSurfaceM: 4.98,
    channelInvertM: 1.08,
    depthM: 3.9,
    velocityMs: 2.35,
    warningLevelM: 4.8,
    dangerLevelM: 5.5,
    riskLevel: "warning",
    arrivalTimeHours: 1.4,
  },
  {
    stationId: "st-5",
    stationName: "Pashupati Station",
    riverKm: 10.9,
    location: [27.71, 85.35],
    scenario: "q10",
    flowCms: 285,
    waterSurfaceM: 5.12,
    channelInvertM: 1.05,
    depthM: 4.07,
    velocityMs: 2.55,
    warningLevelM: 4.8,
    dangerLevelM: 5.5,
    riskLevel: "warning",
    arrivalTimeHours: 2.3,
  },
  {
    stationId: "st-4",
    stationName: "Teku Station",
    riverKm: 5.4,
    location: [27.695, 85.305],
    scenario: "q10",
    flowCms: 325,
    waterSurfaceM: 5.74,
    channelInvertM: 1.16,
    depthM: 4.58,
    velocityMs: 2.72,
    warningLevelM: 4.8,
    dangerLevelM: 5.5,
    riskLevel: "evacuate",
    arrivalTimeHours: 3.1,
  },
  {
    stationId: "st-1",
    stationName: "Chovar Station",
    riverKm: 0.8,
    location: [27.66, 85.29],
    scenario: "q10",
    flowCms: 340,
    waterSurfaceM: 5.21,
    channelInvertM: 0.78,
    depthM: 4.43,
    velocityMs: 2.68,
    warningLevelM: 4.8,
    dangerLevelM: 5.5,
    riskLevel: "warning",
    arrivalTimeHours: 4.0,
  },
];

export function getPeakHecRasResult() {
  return hecRasScenarioResults.reduce((peak, item) =>
    item.waterSurfaceM / item.dangerLevelM > peak.waterSurfaceM / peak.dangerLevelM ? item : peak,
  );
}

export function getHecRasSummary() {
  const peak = getPeakHecRasResult();
  const evacuationCount = hecRasScenarioResults.filter(
    (result) => result.riskLevel === "evacuate",
  ).length;
  const warningCount = hecRasScenarioResults.filter(
    (result) => result.riskLevel === "warning",
  ).length;

  return {
    peak,
    evacuationCount,
    warningCount,
    stationCount: hecRasScenarioResults.length,
    maxArrivalTimeHours: Math.max(
      ...hecRasScenarioResults.map((result) => result.arrivalTimeHours),
    ),
  };
}
