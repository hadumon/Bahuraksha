import { cn } from "@/lib/utils";

type RiskLevel = "safe" | "watch" | "warning" | "evacuate";

interface RiskLevelBadgeProps {
  level: RiskLevel;
  size?: "sm" | "md" | "lg";
}

const levelConfig: Record<
  RiskLevel,
  {
    label: string;
    dot: string;
    bg: string;
    text: string;
    border: string;
  }
> = {
  safe: {
    label: "Safe",
    dot: "bg-risk-safe",
    bg: "bg-risk-safe/10",
    text: "text-risk-safe",
    border: "border-risk-safe/30",
  },
  watch: {
    label: "Watch",
    dot: "bg-risk-watch",
    bg: "bg-risk-watch/10",
    text: "text-risk-watch",
    border: "border-risk-watch/30",
  },
  warning: {
    label: "Warning",
    dot: "bg-risk-warning",
    bg: "bg-risk-warning/10",
    text: "text-risk-warning",
    border: "border-risk-warning/30",
  },
  evacuate: {
    label: "Evacuate",
    dot: "bg-risk-evacuate",
    bg: "bg-risk-evacuate/10",
    text: "text-risk-evacuate",
    border: "border-risk-evacuate/30",
  },
};

const sizeConfig = {
  sm: {
    badge: "text-[10px] px-1.5 py-0.5 gap-1",
    dot: "w-1.5 h-1.5",
  },
  md: {
    badge: "text-xs px-2 py-0.5 gap-1.5",
    dot: "w-2 h-2",
  },
  lg: {
    badge: "text-sm px-2.5 py-1 gap-2",
    dot: "w-2.5 h-2.5",
  },
};

export default function RiskLevelBadge({ level, size = "md" }: RiskLevelBadgeProps) {
  const config = levelConfig[level];
  const sizes = sizeConfig[size];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium transition-all",
        sizes.badge,
        config.bg,
        config.text,
        config.border
      )}
    >
      <span
        className={cn(
          "rounded-full",
          sizes.dot,
          config.dot,
          level === "evacuate" && "animate-pulse"
        )}
      />
      {config.label}
    </span>
  );
}
