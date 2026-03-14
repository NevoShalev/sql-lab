"use client";

import {
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  Download,
  FileJson,
  FileText,
  Table2,
  BarChart3,
  PieChart,
  Clock,
  Rows2,
  X,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { QueryResult } from "@/lib/types";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) {
    const m = Math.floor(ms / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

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
  showAggregate: boolean;
  onToggleAggregate: () => void;
  viewMode: "table" | "bar" | "pie";
  onViewModeChange: (v: "table" | "bar" | "pie") => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  isMobile?: boolean;
}

export function QueryActionBar({
  isRunning,
  hasSql,
  onRun,
  onCancel,
  bottomTab,
  onBottomTabChange,
  latestResult,
  historyCount,
  onExportCSV,
  onExportJSON,
  showAggregate,
  onToggleAggregate,
  viewMode,
  onViewModeChange,
  hasActiveFilters,
  onClearFilters,
  isMobile,
}: QueryActionBarProps) {
  const hasSuccessResult = latestResult && !latestResult.error && !isRunning;
  const hasError = latestResult?.error && !isRunning;
  const hasExportableRows =
    hasSuccessResult && latestResult.rows.length > 0 && latestResult.fields.length > 0;

  // Clicking the active view closes the panel; clicking a new view opens it on that view
  const handleViewClick = (v: "table" | "bar" | "pie") => {
    if (showAggregate && viewMode === v) {
      onToggleAggregate();
    } else {
      if (!showAggregate) onToggleAggregate();
      onViewModeChange(v);
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-y border-border bg-card/40 shrink-0 overflow-x-auto whitespace-nowrap">

      {/* ── Run / Stop ── */}
      {isRunning ? (
        <button
          className="h-7 px-3 text-xs rounded-md transition-colors flex items-center gap-1.5 bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/30"
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

      {/* ── Status ── */}
      {hasSuccessResult && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
          <span>{formatDuration(latestResult.duration)}</span>
        </div>
      )}
      {hasError && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Error</span>
        </div>
      )}

      {/* ── Tab group ── */}
      <div className="flex items-center gap-1">
        <div className="flex items-center bg-muted/50 rounded-lg px-0.5 py-0.5 gap-0.5">
          {isMobile ? (
            /* Mobile: 5 icon-only tabs */
            (
              [
                { tab: "results",   Icon: Rows2,    badge: latestResult && !latestResult.error ? latestResult.rowCount : null },
                { tab: "history",   Icon: Clock,    badge: historyCount > 0 ? historyCount : null },
                { tab: "agg_table", Icon: Table2,   badge: null },
                { tab: "agg_bar",   Icon: BarChart3,badge: null },
                { tab: "agg_pie",   Icon: PieChart, badge: null },
              ] as const
            ).map(({ tab, Icon, badge }) => (
              <button
                key={tab}
                onClick={() => onBottomTabChange(tab)}
                className={cn(
                  "h-7 w-7 rounded-md flex items-center justify-center transition-all",
                  bottomTab === tab
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {badge !== null && (
                  <span className="sr-only">{badge}</span>
                )}
              </button>
            ))
          ) : (
            /* Desktop: Results | History with text + badge */
            (["results", "history"] as const).map((tab) => {
              const badge =
                tab === "results"
                  ? latestResult && !latestResult.error ? latestResult.rowCount : null
                  : historyCount > 0 ? historyCount : null;
              return (
                <button
                  key={tab}
                  onClick={() => onBottomTabChange(tab)}
                  className={cn(
                    "h-7 px-2.5 text-xs rounded-md flex items-center gap-1.5 transition-all",
                    bottomTab === tab
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span>{tab === "results" ? "Results" : "History"}</span>
                  {badge !== null && (
                    <span className={cn(
                      "text-[10px] leading-none px-1 py-0.5 rounded-full tabular-nums",
                      bottomTab === tab ? "bg-muted text-muted-foreground" : "bg-muted/60 text-muted-foreground/60"
                    )}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
        {hasActiveFilters && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onClearFilters}
                className="h-6 w-6 rounded flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Clear filters</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── View mode: Table | Bar | Pie (desktop only — mobile uses the 5-tab segmented control) ── */}
      {hasExportableRows && !isMobile && (
        <>
          <div className="w-px h-4 bg-border/60 shrink-0" />
          <div className="flex items-center gap-0.5">
            {(
              [
                { v: "table", Icon: Table2,   label: "Table" },
                { v: "bar",   Icon: BarChart3, label: "Bar chart" },
                { v: "pie",   Icon: PieChart,  label: "Pie chart" },
              ] as const
            ).map(({ v, Icon, label }) => {
              const active = showAggregate && viewMode === v;
              return (
                <Tooltip key={v}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleViewClick(v)}
                      className={cn(
                        "h-7 w-7 rounded-md transition-colors flex items-center justify-center",
                        active
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </>
      )}

      {/* ── Export ── */}
      {hasExportableRows && (
        <>
          <div className="w-px h-4 bg-border/60 shrink-0" />
          <Tooltip>
            <DropdownMenu>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button className="h-7 w-7 rounded-md transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/50">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
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
            <TooltipContent>Export</TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
}
