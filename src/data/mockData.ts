export type RiskLevel = 'safe' | 'watch' | 'warning' | 'evacuate';

export interface RiverStation {
  id: string;
  name: string;
  location: [number, number];
  currentLevel: number;
  dangerLevel: number;
  warningLevel: number;
  trend: 'rising' | 'falling' | 'stable';
  riskLevel: RiskLevel;
  lastUpdated: string;
}

export interface ZoneRisk {
  id: string;
  name: string;
  district: string;
  riskLevel: RiskLevel;
  floodProb: number;
  landslideProb: number;
  population: number;
  coordinates: [number, number];
}

export interface Alert {
  id: string;
  type: 'flood' | 'landslide' | 'glof';
  severity: RiskLevel;
  title: string;
  message: string;
  zone: string;
  timestamp: string;
  isActive: boolean;
}

export interface CitizenReport {
  id: string;
  type: 'rising_water' | 'cracks' | 'blocked_drain' | 'landslide_signs' | 'other';
  description: string;
  location: [number, number];
  locationName: string;
  timestamp: string;
  verified: boolean;
  trustScore: number;
  imageUrl?: string;
}

export interface RiverLevelDataPoint {
  time: string;
  actual: number;
  predicted: number;
  dangerLevel: number;
  warningLevel: number;
}

export const riverStations: RiverStation[] = [
  { id: 'st-1', name: 'Chovar Station', location: [27.6600, 85.2900], currentLevel: 4.2, dangerLevel: 5.5, warningLevel: 4.8, trend: 'rising', riskLevel: 'watch', lastUpdated: '2026-03-28T14:30:00Z' },
  { id: 'st-2', name: 'Sundarijal Station', location: [27.7700, 85.4200], currentLevel: 3.1, dangerLevel: 4.5, warningLevel: 3.8, trend: 'stable', riskLevel: 'safe', lastUpdated: '2026-03-28T14:25:00Z' },
  { id: 'st-3', name: 'Gokarna Station', location: [27.7300, 85.3700], currentLevel: 5.1, dangerLevel: 5.5, warningLevel: 4.8, trend: 'rising', riskLevel: 'warning', lastUpdated: '2026-03-28T14:28:00Z' },
  { id: 'st-4', name: 'Teku Station', location: [27.6950, 85.3050], currentLevel: 5.8, dangerLevel: 5.5, warningLevel: 4.8, trend: 'rising', riskLevel: 'evacuate', lastUpdated: '2026-03-28T14:32:00Z' },
  { id: 'st-5', name: 'Pashupati Station', location: [27.7100, 85.3500], currentLevel: 4.5, dangerLevel: 5.5, warningLevel: 4.8, trend: 'rising', riskLevel: 'watch', lastUpdated: '2026-03-28T14:20:00Z' },
];

export const zoneRisks: ZoneRisk[] = [
  { id: 'z-1', name: 'Kathmandu Metro', district: 'Kathmandu', riskLevel: 'warning', floodProb: 0.72, landslideProb: 0.15, population: 1442271, coordinates: [27.7172, 85.3240] },
  { id: 'z-2', name: 'Lalitpur Sub-Metro', district: 'Lalitpur', riskLevel: 'watch', floodProb: 0.45, landslideProb: 0.30, population: 284922, coordinates: [27.6588, 85.3247] },
  { id: 'z-3', name: 'Bhaktapur Municipality', district: 'Bhaktapur', riskLevel: 'safe', floodProb: 0.12, landslideProb: 0.08, population: 81748, coordinates: [27.6710, 85.4298] },
  { id: 'z-4', name: 'Kirtipur Municipality', district: 'Kathmandu', riskLevel: 'evacuate', floodProb: 0.88, landslideProb: 0.22, population: 65602, coordinates: [27.6783, 85.2775] },
  { id: 'z-5', name: 'Budhanilkantha', district: 'Kathmandu', riskLevel: 'watch', floodProb: 0.35, landslideProb: 0.55, population: 97042, coordinates: [27.7800, 85.3600] },
  { id: 'z-6', name: 'Tokha Municipality', district: 'Kathmandu', riskLevel: 'warning', floodProb: 0.62, landslideProb: 0.40, population: 126286, coordinates: [27.7500, 85.3100] },
];

export const alerts: Alert[] = [
  { id: 'a-1', type: 'flood', severity: 'evacuate', title: 'CRITICAL: Flood Warning — Kirtipur', message: 'Water level at Teku Station has exceeded danger level. Immediate evacuation recommended for low-lying areas.', zone: 'Kirtipur Municipality', timestamp: '2026-03-28T14:32:00Z', isActive: true },
  { id: 'a-2', type: 'flood', severity: 'warning', title: 'Flood Warning — Kathmandu Metro', message: 'Gokarna Station water level approaching danger threshold. Predicted to exceed in 6 hours.', zone: 'Kathmandu Metro', timestamp: '2026-03-28T13:45:00Z', isActive: true },
  { id: 'a-3', type: 'landslide', severity: 'watch', title: 'Landslide Watch — Budhanilkantha', message: 'Heavy rainfall combined with steep terrain increases landslide risk. Monitor conditions.', zone: 'Budhanilkantha', timestamp: '2026-03-28T12:00:00Z', isActive: true },
  { id: 'a-4', type: 'flood', severity: 'watch', title: 'Flood Watch — Chovar', message: 'Rising water levels detected. Situation under monitoring.', zone: 'Kathmandu Metro', timestamp: '2026-03-28T10:30:00Z', isActive: true },
  { id: 'a-5', type: 'flood', severity: 'safe', title: 'All Clear — Bhaktapur', message: 'Flood risk has subsided. Normal conditions restored.', zone: 'Bhaktapur Municipality', timestamp: '2026-03-28T08:00:00Z', isActive: false },
];

export const citizenReports: CitizenReport[] = [
  { id: 'cr-1', type: 'rising_water', description: 'Bagmati river visibly rising near Teku bridge. Water is close to road level.', location: [27.6950, 85.3050], locationName: 'Teku Bridge', timestamp: '2026-03-28T14:15:00Z', verified: true, trustScore: 0.92 },
  { id: 'cr-2', type: 'blocked_drain', description: 'Major drainage blocked with debris near Rani Pokhari.', location: [27.7100, 85.3150], locationName: 'Rani Pokhari', timestamp: '2026-03-28T13:30:00Z', verified: true, trustScore: 0.85 },
  { id: 'cr-3', type: 'cracks', description: 'New cracks appearing on hillside road near Budhanilkantha temple.', location: [27.7800, 85.3600], locationName: 'Budhanilkantha', timestamp: '2026-03-28T12:45:00Z', verified: false, trustScore: 0.68 },
  { id: 'cr-4', type: 'landslide_signs', description: 'Small rocks falling on the road, tilting trees visible on the slope.', location: [27.7500, 85.3100], locationName: 'Tokha Hill Road', timestamp: '2026-03-28T11:20:00Z', verified: true, trustScore: 0.78 },
  { id: 'cr-5', type: 'rising_water', description: 'Water seeping into basement of houses near Bishnumati river.', location: [27.7150, 85.3050], locationName: 'Bishnumati Corridor', timestamp: '2026-03-28T10:00:00Z', verified: false, trustScore: 0.55 },
];

export const riverLevelHistory: RiverLevelDataPoint[] = Array.from({ length: 48 }, (_, i) => {
  const hour = i;
  const isPredicted = i > 24;
  const baseLevel = 3.5 + Math.sin(i / 6) * 0.8 + (i > 12 ? (i - 12) * 0.08 : 0);
  return {
    time: `${Math.floor(hour % 24).toString().padStart(2, '0')}:00`,
    actual: isPredicted ? baseLevel : baseLevel + (Math.random() - 0.5) * 0.3,
    predicted: baseLevel + (Math.random() - 0.5) * 0.2,
    dangerLevel: 5.5,
    warningLevel: 4.8,
  };
});

export const rainfallForecast = Array.from({ length: 7 }, (_, i) => ({
  day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
  rainfall: [25, 42, 68, 85, 55, 30, 15][i],
  probability: [0.6, 0.75, 0.9, 0.95, 0.7, 0.5, 0.3][i],
}));

export interface GlacialLake {
  id: string;
  name: string;
  location: [number, number];
  area: number;
  volume: number;
  elevation: number;
  damType: string;
  trend: 'expanding' | 'stable' | 'shrinking';
  riskLevel: RiskLevel;
  district: string;
  region: string;
  downstreamPopulation: number;
}

export interface GlofAlert {
  id: string;
  severity: RiskLevel;
  title: string;
  message: string;
  lake: string;
  timestamp: string;
  isActive: boolean;
}

export const glacialLakes: GlacialLake[] = [
  { id: 'gl-1', name: 'Imja Tsho', location: [27.9020, 86.9300], area: 1.28, volume: 35.8, elevation: 5010, damType: 'Moraine', trend: 'expanding', riskLevel: 'warning', district: 'Solukhumbu', region: 'Koshi', downstreamPopulation: 12500 },
  { id: 'gl-2', name: 'Tsho Rolpa', location: [27.8600, 86.4800], area: 1.55, volume: 80.0, elevation: 4580, damType: 'Moraine', trend: 'expanding', riskLevel: 'evacuate', district: 'Dolakha', region: 'Janakpur', downstreamPopulation: 18200 },
  { id: 'gl-3', name: 'Thulagi Lake', location: [28.4900, 84.4200], area: 0.94, volume: 31.0, elevation: 4020, damType: 'Moraine', trend: 'stable', riskLevel: 'watch', district: 'Manang', region: 'Gandaki', downstreamPopulation: 5800 },
  { id: 'gl-4', name: 'Lower Barun', location: [27.8200, 87.0800], area: 0.63, volume: 23.5, elevation: 4550, damType: 'Moraine', trend: 'expanding', riskLevel: 'watch', district: 'Sankhuwasabha', region: 'Koshi', downstreamPopulation: 8400 },
  { id: 'gl-5', name: 'Dig Tsho', location: [27.8700, 86.5800], area: 0.38, volume: 6.2, elevation: 4365, damType: 'Ice-cored Moraine', trend: 'stable', riskLevel: 'safe', district: 'Solukhumbu', region: 'Koshi', downstreamPopulation: 3200 },
  { id: 'gl-6', name: 'Chamlang South', location: [27.7600, 86.9900], area: 0.72, volume: 18.4, elevation: 4940, damType: 'Moraine', trend: 'expanding', riskLevel: 'warning', district: 'Sankhuwasabha', region: 'Koshi', downstreamPopulation: 6700 },
];

export const glofAlerts: GlofAlert[] = [
  { id: 'ga-1', severity: 'evacuate', title: 'CRITICAL: Tsho Rolpa Dam Instability', message: 'Satellite imagery shows accelerated moraine erosion on the dam face. Seepage detected at multiple points. Downstream communities on high alert.', lake: 'Tsho Rolpa', timestamp: '2026-03-28T10:00:00Z', isActive: true },
  { id: 'ga-2', severity: 'warning', title: 'Imja Tsho Expansion Alert', message: 'Lake area has increased 3.2% in past 3 months. Glacial retreat rate exceeding model predictions. Monitoring frequency increased.', lake: 'Imja Tsho', timestamp: '2026-03-27T16:30:00Z', isActive: true },
  { id: 'ga-3', severity: 'warning', title: 'Chamlang South — Rapid Volume Increase', message: 'Meltwater inflow accelerating due to above-average temperatures. Volume up 8% this season.', lake: 'Chamlang South', timestamp: '2026-03-26T08:15:00Z', isActive: true },
  { id: 'ga-4', severity: 'watch', title: 'Thulagi Lake Monitoring Update', message: 'Regular monitoring shows stable conditions but satellite shows minor calving events from adjacent glacier.', lake: 'Thulagi Lake', timestamp: '2026-03-25T14:00:00Z', isActive: false },
];

export const systemStats = {
  activeSensors: 23,
  totalStations: 5,
  activeAlerts: 4,
  citizenReports: 47,
  lastSatellitePass: '2026-03-28T12:00:00Z',
  modelAccuracy: 87.3,
  predictionHorizon: '48h',
  coverageArea: 'Bagmati Basin',
};
