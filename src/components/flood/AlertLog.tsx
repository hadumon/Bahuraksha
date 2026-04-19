import { AnimatePresence, motion } from "framer-motion";
import { ScrollText } from "lucide-react";
import type { FloodAlert } from "@/hooks/useTelemetry";

const sevTone: Record<FloodAlert["severity"], { dot: string; text: string }> = {
  WATCH: { dot: "bg-flood-safe", text: "text-flood-safe" },
  WARNING: { dot: "bg-flood-warn", text: "text-flood-warn" },
  CRITICAL: { dot: "bg-flood-danger", text: "text-flood-danger" },
};

function fmtTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export function AlertLog({ alerts }: { alerts: FloodAlert[] }) {
  return (
    <div className="fixed top-24 right-6 z-30 hidden lg:block">
      <div className="glass-strong rounded-2xl w-[300px] font-mono">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-foreground/10">
          <div className="flex items-center gap-2">
            <ScrollText className="h-3.5 w-3.5 text-foreground/60" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/60">Alert Log</span>
          </div>
          <span className="text-[9px] text-foreground/40 tabular-nums">
            {alerts.length}/10
          </span>
        </div>
        <div className="max-h-[320px] overflow-y-auto p-2">
          {alerts.length === 0 ? (
            <div className="px-2 py-6 text-center text-[10px] text-foreground/40 uppercase tracking-wider">
              No events recorded
            </div>
          ) : (
            <ul className="space-y-1.5">
              <AnimatePresence initial={false}>
                {alerts.map((a) => {
                  const tone = sevTone[a.severity];
                  return (
                    <motion.li
                      key={a.id}
                      layout
                      initial={{ opacity: 0, x: 20, height: 0 }}
                      animate={{ opacity: 1, x: 0, height: "auto" }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ type: "spring", stiffness: 260, damping: 26 }}
                      className="rounded-lg bg-foreground/5 border border-foreground/10 px-2.5 py-2"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot} shrink-0`} />
                          <span className={`text-[9px] font-bold tracking-[0.15em] ${tone.text} shrink-0`}>
                            {a.severity}
                          </span>
                        </div>
                        <span className="text-[9px] text-foreground/45 tabular-nums">
                          {fmtTime(a.timestamp)}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[10px] text-foreground/75 truncate">{a.basin}</span>
                        <span className={`text-[10px] font-bold tabular-nums ${tone.text} shrink-0`}>
                          +{Math.round(a.peakSurge * 100)}%
                        </span>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
