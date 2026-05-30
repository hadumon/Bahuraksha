// bahuraksha-api.ts

export interface Prediction {
  class: 0 | 1 | 2;
  label: "dry_land" | "flood_water";
  color: string;
  confidence: number;
  risk_score: number;
}

export interface PredictionResponse {
  status: "ok";
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
};

export const LABEL_ICON: Record<Prediction["label"], string> = {
  dry_land: "🟡",
  flood_water: "🔵",
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
    ...options,
  });
  clearTimeout(timeout);

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
  return apiFetch<PredictionResponse>("/latest");
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
  return apiFetch<HistoryResponse>(`/history?days=${days}`);
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

export interface WhatsAppNotificationRequest {
  zone: string;
  title: string;
  message: string;
  severity: "safe" | "watch" | "warning" | "evacuate";
}

export interface WhatsAppNotificationResponse {
  status: "sent" | "simulated";
  recipients: number;
  severity: string;
  zone: string;
  note?: string;
}

export async function sendWhatsAppAlert(
  payload: WhatsAppNotificationRequest,
): Promise<WhatsAppNotificationResponse> {
  try {
    return await apiFetch<WhatsAppNotificationResponse>("/notify/whatsapp", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn("WhatsApp API unreachable, simulating notification.", error);
    return {
      status: "simulated",
      recipients: 45,
      severity: payload.severity,
      zone: payload.zone,
      note: "Backend unreachable — alert logged locally",
    };
  }
}
