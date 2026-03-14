"use client";

import { Play, Square, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { QueryResult } from "@/lib/types";

interface QueryActionBarProps {
  isRunning: boolean;
  hasSql: boolean;
  onRun: () => void;
  onCancel: () => void;
  onClear: () => void;
  bottomTab: string;
  onBottomTabChange: (tab: string) => void;
  latestResult: QueryResult | null;
  historyCount: number;
}

export function QueryActionBar({
  isRunning,
  hasSql,
  onRun,
  onCancel,
  onClear,
  bottomTab,
  onBottomTabChange,
  latestResult,
  historyCount,
}: QueryActionBarProps) {
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-y border-border bg-card/40 shrink-0">
      {/* Run / Stop */}
      {isRunning ? (
        <button
          className={cn(
            "h-7 px-3 text-xs rounded-md transition-colors flex items-center gap-1.5",
            "bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/30"
          )}
          onClick={onCancel}
        >
          <Square className="h-3 w-3 fill-current" />
          Stop
        </button>
      ) : (
        <button
          className={cn(
            "h-7 px-3 text-xs rounded-md transition-colors flex items-center gap-1.5",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
          onClick={onRun}
          disabled={!hasSql}
        >
          <Play className="h-3.5 w-3.5" />
          Run
        </button>
      )}

      {/* Clear */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(
              "h-7 w-7 rounded-md transition-colors flex items-center justify-center",
              "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              "disabled:pointer-events-none disabled:opacity-50"
            )}
            onClick={onClear}
            disabled={!hasSql}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Clear editor</TooltipContent>
      </Tooltip>

      {/* Spacer */}
      <div className="flex-1" />

      {/* ⌘+Enter hint */}
      <span className="text-[10px] text-muted-foreground flex items-center gap-1 mr-2">
        <kbd className="px-1.5 py-0.5 rounded border border-border font-mono">⌘↵</kbd>
      </span>

      {/* Results / History tab switcher */}
      <div className="flex items-center gap-0.5">
        <button
          className={cn(
            "h-7 px-3 text-xs rounded-md transition-colors",
            bottomTab === "results"
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
          onClick={() => onBottomTabChange("results")}
        >
          Results
          {latestResult && !latestResult.error && (
            <span className="ml-1.5 text-[10px] opacity-60">
              {latestResult.rowCount}
            </span>
          )}
        </button>
        <button
          className={cn(
            "h-7 px-3 text-xs rounded-md transition-colors",
            bottomTab === "history"
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
          onClick={() => onBottomTabChange("history")}
        >
          History
          {historyCount > 0 && (
            <span className="ml-1.5 text-[10px] opacity-60">{historyCount}</span>
          )}
        </button>
      </div>

      {/* Duration */}
      {latestResult && latestResult.duration > 0 && !latestResult.error && (
        <span className="ml-2 text-[10px] text-muted-foreground">
          {latestResult.duration}ms
        </span>
      )}
    </div>
  );
}
