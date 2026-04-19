import { useEffect, useRef, useState } from "react";

export interface Telemetry {
  /** 0..1 normalized water level — drives river intensity */
  level: number;
  /** 0..1 normalized flow rate */
  flow: number;
  /** discharge m³/s */
  discharge: number;
  /** velocity m/s */
  velocity: number;
  /** turbidity NTU */
  turbidity: number;
  /** temp °C */
  tempC: number;
  /** rainfall mm/h */
  rainfall: number;
  /** sensors online */
  sensorsOnline: number;
  /** seconds since last update */
  lastUpdateSec: number;
  /** monotonic tick counter */
  tick: number;
  /** rolling window of recent discharge values (oldest → newest) */
  history: number[];
  /** active flood event, null if none */
  event: FloodEvent | null;
  /** completed events log (newest first), capped at 10 */
  alertLog: FloodAlert[];
}

export interface FloodEvent {
  id: number;
  startedAt: number; // performance.now()
  durationMs: number;
  /** 0..1 progress through event */
  progress: number;
  /** 0..1 current surge boost being applied */
  surge: number;
  severity: "WATCH" | "WARNING" | "CRITICAL";
  basin: string;
}

export interface FloodAlert {
  id: number;
  /** Date.now() when event peaked (or completed) */
  timestamp: number;
  basin: string;
  severity: FloodEvent["severity"];
  /** 0..1 peak surge reached during event */
  peakSurge: number;
}

const HISTORY_LEN = 40;
const BASINS = ["Mississippi · St. Louis", "Kerala · Periyar", "Bangkok · Chao Phraya", "Rhine · Cologne", "Mekong · Phnom Penh"];

function walk(prev: number, min: number, max: number, vol: number) {
  const next = prev + (Math.random() - 0.5) * vol;
  if (next < min) return min + (min - next) * 0.5;
  if (next > max) return max - (next - max) * 0.5;
  return next;
}

const initial: Telemetry = {
  level: 0.32,
  flow: 0.45,
  discharge: 215,
  velocity: 1.45,
  turbidity: 270,
  tempC: 14.6,
  rainfall: 1.2,
  sensorsOnline: 4218,
  lastUpdateSec: 0,
  tick: 0,
  history: Array.from({ length: HISTORY_LEN }, () => 215),
  event: null,
  alertLog: [],
};

/**
 * Simulated live telemetry. Every ~30s a flood event triggers, ramping up
 * water level/flow/turbidity/rainfall over ~6s, then decaying.
 */
export function useTelemetry(intervalMs = 1500): Telemetry {
  const [data, setData] = useState<Telemetry>(initial);
  const ref = useRef<Telemetry>(initial);
  const lastUpdate = useRef<number>(performance.now());
  const eventRef = useRef<FloodEvent | null>(null);
  const peakSurgeRef = useRef<number>(0);
  const nextEventAt = useRef<number>(performance.now() + 12000); // first event in 12s

  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now();

      // Trigger new flood event?
      if (!eventRef.current && now >= nextEventAt.current) {
        const sevRoll = Math.random();
        const severity: FloodEvent["severity"] =
          sevRoll < 0.5 ? "WATCH" : sevRoll < 0.85 ? "WARNING" : "CRITICAL";
        eventRef.current = {
          id: Math.floor(now),
          startedAt: now,
          durationMs: severity === "CRITICAL" ? 9000 : severity === "WARNING" ? 7000 : 5500,
          progress: 0,
          surge: 0,
          severity,
          basin: BASINS[Math.floor(Math.random() * BASINS.length)],
        };
      }

      // Update event progress / surge envelope (ease-in then ease-out)
      let surge = 0;
      let event: FloodEvent | null = null;
      let completedAlert: FloodAlert | null = null;
      if (eventRef.current) {
        const e = eventRef.current;
        const p = (now - e.startedAt) / e.durationMs;
        if (p >= 1) {
          // Event finished — emit alert entry
          completedAlert = {
            id: e.id,
            timestamp: Date.now(),
            basin: e.basin,
            severity: e.severity,
            peakSurge: peakSurgeRef.current,
          };
          eventRef.current = null;
          peakSurgeRef.current = 0;
          // Schedule next event 25-40s out
          nextEventAt.current = now + 25000 + Math.random() * 15000;
        } else {
          // bell curve envelope
          const env = Math.sin(p * Math.PI);
          const peak = e.severity === "CRITICAL" ? 0.55 : e.severity === "WARNING" ? 0.35 : 0.2;
          surge = env * peak;
          if (surge > peakSurgeRef.current) peakSurgeRef.current = surge;
          event = { ...e, progress: p, surge };
          eventRef.current = event;
        }
      }

      const prev = ref.current;
      const microSurge = Math.random() < 0.04 ? 0.06 : 0;
      const level = walk(prev.level + microSurge + surge * 0.15, 0.08, 0.98, 0.04);
      const flow = walk(prev.flow + microSurge * 0.5 + surge * 0.18, 0.15, 0.99, 0.05);
      // smooth blend toward surge target so event is visible
      const blendedLevel = THREE_lerp(prev.level, Math.min(0.98, level + surge), 0.35);
      const blendedFlow = THREE_lerp(prev.flow, Math.min(0.99, flow + surge * 0.9), 0.35);

      const discharge = Math.round(80 + blendedFlow * 720 + (Math.random() - 0.5) * 12);
      const history = prev.history.length >= HISTORY_LEN
        ? [...prev.history.slice(1), discharge]
        : [...prev.history, discharge];

      const next: Telemetry = {
        level: blendedLevel,
        flow: blendedFlow,
        discharge,
        velocity: +(0.4 + blendedFlow * 3.1 + (Math.random() - 0.5) * 0.05).toFixed(2),
        turbidity: Math.round(60 + blendedLevel * 920 + (Math.random() - 0.5) * 25),
        tempC: +walk(prev.tempC, 11, 18, 0.08).toFixed(1),
        rainfall: +walk(prev.rainfall + surge * 4, 0, 18, 0.5).toFixed(1),
        sensorsOnline: 4218 + Math.floor((Math.random() - 0.5) * 6),
        lastUpdateSec: 0,
        tick: prev.tick + 1,
        history,
        event,
        alertLog: completedAlert
          ? [completedAlert, ...prev.alertLog].slice(0, 10)
          : prev.alertLog,
      };
      ref.current = next;
      lastUpdate.current = now;
      setData(next);
    }, intervalMs);

    const tickId = setInterval(() => {
      setData((d) => ({ ...d, lastUpdateSec: Math.floor((performance.now() - lastUpdate.current) / 1000) }));
    }, 1000);

    return () => {
      clearInterval(id);
      clearInterval(tickId);
    };
  }, [intervalMs]);

  return data;
}

function THREE_lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
