"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Rows,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QueryResult, SchemaData } from "@/lib/types";

const MAX_DISPLAY_ROWS = 1000;

interface AiAnalysis {
  explanation: string;
  suggestion: string;
  fixedSql: string | null;
}

// Get SQL snippet around the error position with the error highlighted
function getErrorContext(sql: string, position: number): { before: string; errorChar: string; after: string; line: number; col: number } | null {
  if (!position || position < 1) return null;
  const pos = position - 1; // 0-indexed

  // Calculate line and column
  const textBefore = sql.substring(0, pos);
  const lines = textBefore.split("\n");
  const line = lines.length;
  const col = (lines[lines.length - 1]?.length ?? 0) + 1;

  // Get a window around the error
  const start = Math.max(0, pos - 40);
  const end = Math.min(sql.length, pos + 40);

  return {
    before: (start > 0 ? "\u2026" : "") + sql.substring(start, pos),
    errorChar: sql.substring(pos, Math.min(pos + 10, end)).split(/\s/)[0] || sql[pos] || "",
    after: sql.substring(pos + (sql.substring(pos, Math.min(pos + 10, end)).split(/\s/)[0]?.length || 1), end) + (end < sql.length ? "\u2026" : ""),
    line,
    col,
  };
}

// Build a compact schema context string for the AI
function buildSchemaContext(schema: SchemaData | null): string {
  if (!schema) return "";
  const parts: string[] = [];
  for (const [schemaName, tables] of Object.entries(schema)) {
    for (const [tableName, table] of Object.entries(tables)) {
      const cols = table.columns.map((c) => `${c.name} (${c.type}${c.nullable ? ", nullable" : ""})`).join(", ");
      parts.push(`${schemaName}.${tableName} [${table.type}]: ${cols}`);
    }
  }
  // Limit to avoid huge payloads — send first 3000 chars
  const full = parts.join("\n");
  return full.length > 3000 ? full.substring(0, 3000) + "\n..." : full;
}

type SortState = { col: string; dir: "asc" | "desc" } | null;

function formatCellValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function CellValue({ val }: { val: unknown }) {
  if (val === null || val === undefined) {
    return (
      <span className="text-muted-foreground/60 italic text-[11px]">NULL</span>
    );
  }
  if (typeof val === "boolean") {
    return (
      <Badge
        variant={val ? "secondary" : "outline"}
        className="text-[10px] h-4 px-1"
      >
        {val ? "true" : "false"}
      </Badge>
    );
  }
  if (typeof val === "object") {
    return (
      <span className="font-mono text-xs text-pink-400 truncate max-w-[200px] block">
        {JSON.stringify(val)}
      </span>
    );
  }
  return (
    <span className="font-mono text-xs max-w-[300px] block truncate" title={String(val)}>
      {String(val)}
    </span>
  );
}

// AI Error Analysis component
function AiErrorSuggestion({
  result,
  schema,
  onApplyFix,
}: {
  result: QueryResult;
  schema: SchemaData | null;
  onApplyFix?: (sql: string) => void;
}) {
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch AI analysis when the result changes
  useEffect(() => {
    if (!result.error || !result.sql) return;

    let cancelled = false;
    setLoading(true);
    setAnalysis(null);
    setError(null);

    const schemaContext = buildSchemaContext(schema);

    fetch("/api/analyze-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sql: result.sql,
        error: result.error,
        errorPosition: result.errorPosition,
        errorDetail: result.errorDetail,
        errorHint: result.errorHint,
        schemaContext,
      }),
    })
      .then(async (res) => {
        if (cancelled) return;
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          setAnalysis(data);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to get AI analysis");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [result.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopyFix = useCallback(() => {
    if (analysis?.fixedSql) {
      navigator.clipboard.writeText(analysis.fixedSql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [analysis?.fixedSql]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
        <Loader2 className="h-4 w-4 text-violet-400 shrink-0 animate-spin" />
        <p className="text-sm text-muted-foreground">Analyzing error with AI...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
        <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
        <Sparkles className="h-4 w-4 text-violet-400 shrink-0" />
        <div className="space-y-2 min-w-0 flex-1">
          <p className="text-xs font-medium text-violet-400">AI Error Assist</p>
          {analysis.explanation && (
            <p className="text-sm text-foreground/90">{analysis.explanation}</p>
          )}
          {analysis.suggestion && (
            <p className="text-sm text-foreground/70">{analysis.suggestion}</p>
          )}
          {analysis.fixedSql && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Suggested fix:</p>
              <pre className="text-xs font-mono bg-card/80 rounded p-2 overflow-x-auto border border-border text-violet-300 whitespace-pre-wrap">
                {analysis.fixedSql}
              </pre>
              <div className="flex gap-2">
                {onApplyFix && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs gap-1.5 text-violet-400 border-violet-500/30 hover:bg-violet-500/10"
                    onClick={() => onApplyFix(analysis.fixedSql!)}
                  >
                    Apply Fix
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs gap-1.5"
                  onClick={handleCopyFix}
                >
                  {copied ? (
                    <><Check className="h-3 w-3" /> Copied</>
                  ) : (
                    <><Copy className="h-3 w-3" /> Copy</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
    </div>
  );
}

interface QueryResultsProps {
  result: QueryResult | null;
  isRunning: boolean;
  schema?: SchemaData | null;
  onApplyFix?: (sql: string) => void;
}


export function QueryResults({ result, isRunning, schema, onApplyFix }: QueryResultsProps) {
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 200;

  const handleSort = (col: string) => {
    setSort((prev) => {
      if (prev?.col === col) {
        if (prev.dir === "asc") return { col, dir: "desc" };
        return null;
      }
      return { col, dir: "asc" };
    });
    setPage(0);
  };

  const sortedRows = useMemo(() => {
    if (!result?.rows) return [];
    const rows = result.rows.slice(0, MAX_DISPLAY_ROWS);
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sort.col];
      const bv = b[sort.col];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [result, sort]);

  const pagedRows = sortedRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(sortedRows.length / PAGE_SIZE);

  if (isRunning) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <div className="relative">
          <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
        <span className="text-sm">Executing query...</span>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
        <Rows className="h-8 w-8 opacity-20" />
        <p className="text-sm">Run a query to see results</p>
        <p className="text-xs opacity-50">Press ⌘+Enter or click Run</p>
      </div>
    );
  }

  if (result.error) {
    const context = result.errorPosition ? getErrorContext(result.sql, result.errorPosition) : null;

    return (
      <div className="p-4 space-y-3 overflow-auto h-full">
        {/* Error message + location */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <div className="space-y-2 min-w-0 flex-1">
            <p className="text-xs font-medium text-destructive">Query Error</p>
            <p className="text-sm text-foreground/80 font-mono">{result.error}</p>
            {result.errorDetail && (
              <p className="text-xs text-muted-foreground font-mono">Detail: {result.errorDetail}</p>
            )}
            {result.errorHint && (
              <p className="text-xs text-muted-foreground font-mono">Hint: {result.errorHint}</p>
            )}
            {context && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Line {context.line}, column {context.col}:
                </p>
                <pre className="text-xs font-mono overflow-x-auto whitespace-pre bg-card/80 rounded p-2 border border-border">
                  <span className="text-foreground/60">{context.before}</span>
                  <span className="text-destructive bg-destructive/20 rounded px-0.5 font-bold">{context.errorChar}</span>
                  <span className="text-foreground/60">{context.after}</span>
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* AI-powered suggestion */}
        <AiErrorSuggestion
          result={result}
          schema={schema ?? null}
          onApplyFix={onApplyFix}
        />
      </div>
    );
  }

  const isModifyQuery = result.fields.length === 0;

  return (
    <div className="flex flex-col h-full">
      {isModifyQuery ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
          <CheckCircle2 className="h-8 w-8 text-green-400" />
          <p className="text-sm">Query executed successfully</p>
          <p className="text-xs">{result.rowCount} row{result.rowCount !== 1 ? "s" : ""} affected</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-xs border-collapse min-w-max">
            <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
              <tr>
                <th className="text-center text-muted-foreground/50 font-mono px-2 py-2 border-b border-r border-border w-10 text-[10px]">
                  #
                </th>
                {result.fields.map((field) => (
                  <th
                    key={field.name}
                    className="text-left px-3 py-2 border-b border-border font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground hover:bg-accent/50 transition-colors select-none"
                    onClick={() => handleSort(field.name)}
                  >
                    <div className="flex items-center gap-1">
                      <span className="font-mono">{field.name}</span>
                      {sort?.col === field.name ? (
                        sort.dir === "asc" ? (
                          <ArrowUp className="h-3 w-3 text-primary" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-border/50 hover:bg-accent/30 transition-colors"
                >
                  <td className="text-center text-muted-foreground/40 font-mono px-2 py-1.5 border-r border-border/50 text-[10px]">
                    {page * PAGE_SIZE + i + 1}
                  </td>
                  {result.fields.map((field) => (
                    <td key={field.name} className="px-3 py-1.5 max-w-[300px]">
                      <CellValue val={row[field.name]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-card/50 sticky bottom-0">
              <span className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages} ({sortedRows.length} rows)
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  ← Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                >
                  Next →
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
