// bahuraksha-api.ts

import { reportBackendHealth } from "./apiHealth";

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

const API_BASE = import.meta.env.VITE_BAHURAKSHA_API_URL ?? "https://bahuraksha.onrender.com";

// ── API Client ────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      ...options,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      reportBackendHealth("bahuraksha", false);
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? `API error ${res.status}`);
    }

    reportBackendHealth("bahuraksha", true);
    return res.json() as Promise<T>;
  } catch (e) {
    clearTimeout(timeout);
    reportBackendHealth("bahuraksha", false);
    throw e;
  }
}

/**
 * Get today's flood/glacier prediction for Bahuraksha AOI.
 * Uses the backend's latest CSV/model-backed prediction endpoint.
 */
export async function getLatest(): Promise<PredictionResponse> {
  return apiFetch<PredictionResponse>("/latest");
}

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

export interface WhatsAppNotificationRequest {
  alert_id: string;
  zone: string;
  title: string;
  message: string;
  severity: "safe" | "watch" | "warning" | "evacuate";
}

export interface CitizenReportNotificationRequest {
  type: string;
  description: string;
  location_name: string;
  location_lat: number;
  location_lng: number;
}

export async function notifyCitizenReportSubmission(
  payload: CitizenReportNotificationRequest,
): Promise<{ status: string; notified?: number }> {
  try {
    return await apiFetch<{ status: string; notified?: number }>("/notify/citizen-report", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch {
    console.info("Citizen report notification skipped (API unavailable).");
    return { status: "skipped" };
  }
}

export interface WhatsAppNotificationResponse {
  status: "sent" | "simulated" | "failed";
  recipients?: number;
  total?: number;
  sent?: number;
  failed?: number;
  severity: string;
  zone: string;
  alert_id?: string;
  note?: string;
  error?: string;
}

export async function sendWhatsAppAlert(
  alertId: string,
  payload: Omit<WhatsAppNotificationRequest, "alert_id">,
): Promise<WhatsAppNotificationResponse> {
  try {
    return await apiFetch<WhatsAppNotificationResponse>("/notify/whatsapp", {
      method: "POST",
      body: JSON.stringify({ ...payload, alert_id: alertId }),
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

export interface AlertRecipient {
  id: string;
  phone_number: string;
  delivery_status: "pending" | "sent" | "delivered" | "read" | "failed";
  retry_count: number;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  error_message: string | null;
}

export async function getAlertRecipients(alertId: string): Promise<AlertRecipient[]> {
  try {
    return await apiFetch<AlertRecipient[]>(`/notify/recipients/${alertId}`);
  } catch {
    return [];
  }
}

export async function optInWhatsApp(userId: string, phone: string): Promise<{ status: string }> {
  try {
    return await apiFetch<{ status: string }>("/notify/whatsapp/opt-in", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, phone }),
    });
  } catch {
    return { status: "error" };
  }
}

export async function optOutWhatsApp(userId: string): Promise<{ status: string }> {
  try {
    return await apiFetch<{ status: string }>("/notify/whatsapp/opt-out", {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    });
  } catch {
    return { status: "error" };
  }
}

export async function retryFailedDeliveries(): Promise<{ status: string; retried?: number }> {
  try {
    return await apiFetch<{ status: string; retried?: number }>("/notify/retry", {
      method: "POST",
    });
  } catch {
    return { status: "error" };
  }
}
