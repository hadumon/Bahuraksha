import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import type { FloodEvent } from "@/hooks/useTelemetry";

const tone: Record<FloodEvent["severity"], { ring: string; bar: string; text: string }> = {
  WATCH: { ring: "border-flood-safe/40", bar: "bg-flood-safe", text: "text-flood-safe" },
  WARNING: { ring: "border-flood-warn/50", bar: "bg-flood-warn", text: "text-flood-warn" },
  CRITICAL: { ring: "border-flood-danger/60", bar: "bg-flood-danger", text: "text-flood-danger" },
};

export function FloodEventBanner({ event }: { event: FloodEvent | null }) {
  return (
    <AnimatePresence>
      {event && (
        <motion.div
          key={event.id}
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
          className="fixed left-1/2 top-20 z-40 -translate-x-1/2"
        >
          <div className={`glass-strong rounded-2xl border ${tone[event.severity].ring} px-5 py-3 flex items-center gap-4 min-w-[420px]`}>
            <div className="relative">
              <AlertTriangle className={`h-5 w-5 ${tone[event.severity].text}`} />
              <span className={`pulse-dot absolute -top-1 -right-1 h-2 w-2 rounded-full ${tone[event.severity].bar}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold tracking-[0.2em] ${tone[event.severity].text}`}>
                  FLOOD {event.severity}
                </span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/50">·</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/70 font-mono">{event.basin}</span>
              </div>
              <div className="text-sm font-semibold text-foreground mt-0.5">
                Surge detected · discharge climbing
              </div>
              {/* progress */}
              <div className="mt-2 h-1 w-full rounded-full bg-foreground/10 overflow-hidden">
                <div
                  className={`h-full ${tone[event.severity].bar} transition-all duration-300`}
                  style={{ width: `${Math.min(100, event.progress * 100)}%` }}
                />
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-foreground/50">Surge</div>
              <div className={`text-lg font-bold tabular-nums ${tone[event.severity].text}`}>
                +{Math.round(event.surge * 100)}%
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
