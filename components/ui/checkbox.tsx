"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<"input">
>(({ className, ...props }, ref) => (
  <span className="relative inline-flex h-4 w-4 shrink-0">
    <input
      type="checkbox"
      ref={ref}
      className={cn(
        "peer h-4 w-4 cursor-pointer appearance-none rounded-sm border border-input bg-transparent shadow-sm transition-colors",
        "checked:bg-primary checked:border-primary",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
    <svg
      className="pointer-events-none absolute inset-0 h-4 w-4 text-primary-foreground opacity-0 transition-opacity peer-checked:opacity-100"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3,8.5 6.5,12 13,4" />
    </svg>
  </span>
));
Checkbox.displayName = "Checkbox";

export { Checkbox };
