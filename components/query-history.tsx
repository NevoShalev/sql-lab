"use client";

import { useState } from "react";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  Copy,
  RotateCcw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { QueryResult } from "@/lib/types";

interface QueryHistoryProps {
  history: QueryResult[];
  onRestore: (sql: string) => void;
  onClear: () => void;
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function truncateSql(sql: string, max = 80): string {
  const oneline = sql.replace(/\s+/g, " ").trim();
  return oneline.length > max ? oneline.slice(0, max) + "…" : oneline;
}

export function QueryHistory({
  history,
  onRestore,
  onClear,
}: QueryHistoryProps) {
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = search.trim()
    ? history.filter((h) =>
        h.sql.toLowerCase().includes(search.toLowerCase())
      )
    : history;

  const handleCopy = async (sql: string, id: string) => {
    await navigator.clipboard.writeText(sql);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          History ({history.length})
        </span>
        {history.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-muted-foreground hover:text-destructive gap-1"
            onClick={onClear}
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {history.length > 0 && (
        <div className="px-2 py-1.5 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              className="h-7 pl-6 text-xs"
              placeholder="Search history..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <Clock className="h-8 w-8 opacity-20" />
              <p className="text-xs">
                {history.length === 0 ? "No queries yet" : "No matches"}
              </p>
            </div>
          )}

          {filtered.map((item) => (
            <div
              key={item.id}
              className={cn(
                "group relative rounded-md border p-2.5 cursor-pointer transition-colors",
                item.error
                  ? "border-destructive/20 bg-destructive/5 hover:bg-destructive/10"
                  : "border-border bg-card/50 hover:bg-accent/50"
              )}
              onClick={() => onRestore(item.sql)}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.error ? (
                    <XCircle className="h-3 w-3 text-destructive" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3 text-green-400" />
                  )}
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {formatTime(new Date(item.timestamp))}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!item.error && (
                    <>
                      <Badge
                        variant="secondary"
                        className="text-[9px] h-4 px-1"
                      >
                        {item.rowCount} rows
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[9px] h-4 px-1"
                      >
                        {formatDuration(item.duration)}
                      </Badge>
                    </>
                  )}
                </div>
              </div>

              <p className="text-xs font-mono text-foreground/80 leading-relaxed break-all">
                {truncateSql(item.sql)}
              </p>

              {item.error && (
                <p className="text-[10px] text-destructive mt-1 truncate">
                  {item.error}
                </p>
              )}

              {/* Action buttons */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="h-5 w-5 rounded flex items-center justify-center bg-accent hover:bg-accent/80"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(item.sql, item.id);
                      }}
                    >
                      {copied === item.id ? (
                        <CheckCircle2 className="h-3 w-3 text-green-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Copy SQL</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="h-5 w-5 rounded flex items-center justify-center bg-accent hover:bg-accent/80"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestore(item.sql);
                      }}
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Restore to editor</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
