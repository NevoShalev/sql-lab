"use client";

import {
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  Download,
  FileJson,
  FileText,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
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
  onExportCSV: () => void;
  onExportJSON: () => void;
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
  onExportCSV,
  onExportJSON,
}: QueryActionBarProps) {
  const hasSuccessResult = latestResult && !latestResult.error && !isRunning;
  const hasError = latestResult?.error && !isRunning;
  const hasExportableRows = hasSuccessResult && latestResult.rows.length > 0 && latestResult.fields.length > 0;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 border-y border-border bg-card/40 shrink-0 overflow-x-auto whitespace-nowrap">
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


      {/* Inline status */}
      {hasSuccessResult && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground ml-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
          <span>
            {latestResult.rowCount} row{latestResult.rowCount !== 1 ? "s" : ""}
          </span>
          <span className="opacity-50">·</span>
          <span>{latestResult.duration}ms</span>
        </div>
      )}
      {hasError && (
        <div className="flex items-center gap-1.5 text-xs text-destructive ml-1">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Error</span>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

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

      {/* Export icon */}
      {hasExportableRows && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="h-7 w-7 rounded-md transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50 ml-1"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExportCSV}>
              <FileText className="h-4 w-4 mr-2" />
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportJSON}>
              <FileJson className="h-4 w-4 mr-2" />
              Export as JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
