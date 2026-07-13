import React from "react";
import { cn } from "@/lib/utils";

export function AppLoader({
  label = "Loading...",
  fullscreen = false,
  size = "md",
  className,
}) {
  const sizeClasses = {
    sm: "h-8 w-8 border-[3px]",
    md: "h-12 w-12 border-4",
    lg: "h-16 w-16 border-[5px]",
  };

  return (
    <div
      className={cn(
        fullscreen ? "min-h-screen" : "w-full",
        "flex items-center justify-center bg-muted/30 p-6",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div
            className={cn(
              "rounded-full border-muted/30 border-t-primary animate-spin",
              sizeClasses[size] || sizeClasses.md,
            )}
          />
          <div className="absolute inset-0 rounded-full border border-primary/15" />
        </div>
        {label ? <div className="text-sm text-muted-foreground">{label}</div> : null}
      </div>
    </div>
  );
}
