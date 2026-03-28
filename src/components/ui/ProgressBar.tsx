import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ProgressBar({
  value,
  max = 100,
  className,
  showLabel = false,
  size = "md",
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const sizeClasses = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  };

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "w-full rounded-full bg-accent/40 overflow-hidden",
          sizeClasses[size],
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out relative",
            percentage >= 100
              ? "bg-success"
              : "bg-gradient-to-r from-primary via-primary/90 to-primary/70",
          )}
          style={{ width: `${percentage}%` }}
        >
          {percentage > 0 && percentage < 100 && (
            <div
              className="absolute inset-0 rounded-full"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
                backgroundSize: "200% 100%",
                animation: "progressBarShimmer 2s ease-in-out infinite",
              }}
            />
          )}
        </div>
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
          <span>
            {value} of {max}
          </span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
    </div>
  );
}
