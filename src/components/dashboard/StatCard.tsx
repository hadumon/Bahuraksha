import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "default" | "primary" | "danger" | "success";
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

const variants = {
  default: "border-border/50 hover:border-border",
  primary: "border-ocean-400/30 shadow-glow hover:border-ocean-400/50",
  danger: "border-risk-evacuate/30 shadow-glow-danger hover:border-risk-evacuate/50",
  success: "border-risk-safe/30 shadow-glow-safe hover:border-risk-safe/50",
};

const iconBgColors = {
  default: "bg-secondary/50",
  primary: "bg-ocean-400/15 text-ocean-300",
  danger: "bg-risk-evacuate/15 text-risk-evacuate",
  success: "bg-risk-safe/15 text-risk-safe",
};

const trendColors = {
  up: "text-risk-safe",
  down: "text-risk-evacuate",
  neutral: "text-muted-foreground",
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  trend,
  trendValue,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card to-secondary/30 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated",
        variants[variant]
      )}
    >
      {/* Background glow effect */}
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-3xl transition-all group-hover:bg-primary/10" />

      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wider">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-bold tracking-tight text-foreground">
              {value}
            </p>
            {trend && trendValue && (
              <span
                className={cn(
                  "text-xs font-medium flex items-center gap-0.5",
                  trendColors[trend]
                )}
              >
                {trend === "up" && "↑"}
                {trend === "down" && "↓"}
                {trend === "neutral" && "→"}
                {trendValue}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 hover:scale-110",
            iconBgColors[variant]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {/* Bottom accent line */}
      <div
        className={cn(
          "absolute bottom-0 left-0 h-0.5 w-12 rounded-full transition-all duration-300 group-hover:w-full",
          variant === "default" && "bg-border",
          variant === "primary" && "bg-ocean-400",
          variant === "danger" && "bg-risk-evacuate",
          variant === "success" && "bg-risk-safe"
        )}
      />
    </motion.div>
  );
}
