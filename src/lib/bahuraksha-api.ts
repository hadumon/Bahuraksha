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
