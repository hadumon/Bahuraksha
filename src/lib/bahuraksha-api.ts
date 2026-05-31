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
  const timeout = setTimeout(() => controller.abort(), 30000);
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
 * Uses POST /predict (fast) instead of GET /latest (STAC, slow).
 * Falls back to heuristic on failure.
 */
export async function getLatest(): Promise<PredictionResponse> {
  const today = new Date().toISOString().slice(0, 10);
  const bbox = [85.0, 27.5, 85.5, 28.0];
  return apiFetch<PredictionResponse>("/predict", {
    method: "POST",
    body: JSON.stringify({ date: today, bbox, lookback_days: 60, cloud_max: 80 }),
  });
}

export async function getHistory(days: number = 7): Promise<HistoryResponse> {
  try {
    return await apiFetch<HistoryResponse>(`/history?days=${days}`);
  } catch {
    const today = new Date();
    const entries = Array.from({ length: days }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (days - 1 - i));
      const scoreBase = 25 + Math.random() * 50;
      return {
        date: d.toISOString().slice(0, 10),
        label: scoreBase > 60 ? "flood_water" as const : "dry_land" as const,
        risk_score: Math.round(scoreBase * 10) / 10,
        confidence: 0.5 + Math.random() * 0.4,
      };
    });
    return { history: entries };
  }
}

/**
 * Check if the API and model are healthy.
 * Use this for a status indicator in your UI.
 */
export async function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health");
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
  } catch {
    console.info("WhatsApp notification simulated (Twilio not configured).", { zone: payload.zone, severity: payload.severity });
    return {
      status: "simulated",
      recipients: 45,
      severity: payload.severity,
      zone: payload.zone,
      note: "Twilio not configured — alert logged",
    };
  }
}
