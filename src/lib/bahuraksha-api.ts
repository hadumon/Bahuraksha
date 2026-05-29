// bahuraksha-api.ts

export interface Prediction {
  class: 0 | 1 | 2;
  label: "dry_land" | "flood_water" | "snow_glacier";
  color: string;
  confidence: number; // 0–1
  risk_score: number; // 0–100
}

export interface PredictionResponse {
  status: "ok";
  isMock?: boolean;
  request: {
    date: string;
    bbox: number[];
  };
  prediction: Prediction;
}

export interface HistoryEntry {
  date: string;
  label: Prediction["label"];
  risk_score: number;
  confidence: number;
  error?: string;
}

export interface HistoryResponse {
  history: HistoryEntry[];
  isMock?: boolean;
}

export interface HealthResponse {
  status: "healthy" | "model_missing";
  model_loaded: boolean;
  model_type: string;
}

export interface ReadyResponse {
  status: "ready";
  model_loaded: boolean;
  feature_count: number;
}

export interface VersionResponse {
  api_version: string;
  model_path: string;
  model_loaded: boolean;
  xgboost_version: string;
  feature_schema: string[];
}

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE = "https://bahuraksha.onrender.com";

// Human-readable labels for UI display
export const LABEL_TEXT: Record<Prediction["label"], string> = {
  dry_land: "Dry Land",
  flood_water: "Flood / Water Detected",
  snow_glacier: "Snow / Glacier",
};

export const LABEL_ICON: Record<Prediction["label"], string> = {
  dry_land: "🟡",
  flood_water: "🔵",
  snow_glacier: "⚪",
};

export const RISK_LEVEL = (score: number): "LOW" | "MODERATE" | "HIGH" | "CRITICAL" => {
  if (score < 25) return "LOW";
  if (score < 50) return "MODERATE";
  if (score < 75) return "HIGH";
  return "CRITICAL";
};

export const RISK_COLOR: Record<ReturnType<typeof RISK_LEVEL>, string> = {
  LOW: "#22c55e",
  MODERATE: "#f59e0b",
  HIGH: "#ef4444",
  CRITICAL: "#7f1d1d",
};

// ── API Client ────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `API error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Get today's flood/glacier prediction for Bahuraksha AOI.
 * Use this for your main dashboard status card.
 */
export async function getLatest(): Promise<PredictionResponse> {
  try {
    return await apiFetch<PredictionResponse>("/latest");
  } catch (error) {
    console.warn("API /latest timed out or failed, falling back to mock data.", error);
    return {
      status: "ok",
      isMock: true,
      request: { date: new Date().toISOString().split("T")[0], bbox: [86.0, 27.7, 86.6, 28.1] },
      prediction: { class: 1, label: "flood_water", color: "#1a6faf", confidence: 0.89, risk_score: 82.5 }
    };
  }
}

/**
 * Get prediction for a specific date.
 * @param date - Format: "YYYY-MM-DD"
 * @param lookbackDays - How many days back to search for satellite scenes (default 60)
 * @param cloudMax - Max cloud cover % (default 80)
 */
export async function getPrediction(
  date: string,
  lookbackDays: number = 60,
  cloudMax: number = 80,
): Promise<PredictionResponse> {
  return apiFetch<PredictionResponse>("/predict", {
    method: "POST",
    body: JSON.stringify({
      date,
      lookback_days: lookbackDays,
      cloud_max: cloudMax,
    }),
  });
}

/**
 * Get predictions for the last N days.
 * Use this for your time-series chart or history table.
 * @param days - Number of days (default 7)
 */
export async function getHistory(days: number = 7): Promise<HistoryResponse> {
  try {
    return await apiFetch<HistoryResponse>(`/history?days=${days}`);
  } catch (error) {
    console.warn("API /history timed out or failed, falling back to mock data.", error);
    
    // Generate realistic looking mock history
    const history: HistoryEntry[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      // Create a curve that spikes recently
      const baseRisk = 30;
      const spike = i < 3 ? (3 - i) * 15 : 0;
      const noise = Math.random() * 10;
      
      history.push({
        date: d.toISOString().split("T")[0],
        label: i < 2 ? "flood_water" : "dry_land",
        risk_score: Math.min(100, Math.round(baseRisk + spike + noise)),
        confidence: 0.85 + (Math.random() * 0.1),
      });
    }
    return { history: history.reverse(), isMock: true };
  }
}

/**
 * Check if the API and model are healthy.
 * Use this for a status indicator in your UI.
 */
export async function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health");
}

export async function getReady(): Promise<ReadyResponse> {
  return apiFetch<ReadyResponse>("/ready");
}

export async function getVersion(): Promise<VersionResponse> {
  return apiFetch<VersionResponse>("/version");
}
