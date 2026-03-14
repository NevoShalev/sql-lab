"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
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
  X,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QueryResult, SchemaData } from "@/lib/types";
import { cn } from "@/lib/utils";

const INITIAL_DISPLAY_ROWS = 1000;
const LOAD_MORE_STEP = 1000;

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

// ── Filter types & helpers ─────────────────────────────────────────────────

type ColKind = "text" | "number" | "date" | "boolean" | "other";

type FilterOp =
  | "contains" | "not_contains" | "starts_with" | "ends_with" | "equals" | "not_equals"
  | "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "between"
  | "before" | "after" | "date_between"
  | "bool_true" | "bool_false"
  | "is_null" | "is_not_null" | "is_empty" | "is_not_empty";

interface ActiveFilter {
  op: FilterOp;
  value: string;
  value2?: string;
}

const NUMERIC_OIDS = new Set([20, 21, 23, 26, 700, 701, 1700, 790]);
const DATE_OIDS    = new Set([1082, 1083, 1114, 1184, 1186]);
const BOOL_OIDS    = new Set([16]);

function getColKind(oid: number): ColKind {
  if (NUMERIC_OIDS.has(oid)) return "number";
  if (DATE_OIDS.has(oid))    return "date";
  if (BOOL_OIDS.has(oid))    return "boolean";
  return "text";
}

const NO_VALUE_OPS = new Set<FilterOp>([
  "is_null", "is_not_null", "is_empty", "is_not_empty", "bool_true", "bool_false",
]);

function isFilterActive(f: ActiveFilter): boolean {
  if (NO_VALUE_OPS.has(f.op)) return true;
  if (f.op === "between" || f.op === "date_between")
    return f.value.trim() !== "" && (f.value2 ?? "").trim() !== "";
  return f.value.trim() !== "";
}

const OPS_BY_KIND: Record<ColKind, { op: FilterOp; label: string }[]> = {
  text: [
    { op: "equals",       label: "Equals" },
    { op: "not_equals",   label: "Not equals" },
    { op: "contains",     label: "Contains" },
    { op: "not_contains", label: "Does not contain" },
    { op: "starts_with",  label: "Starts with" },
    { op: "ends_with",    label: "Ends with" },
    { op: "is_empty",     label: "Is empty" },
    { op: "is_not_empty", label: "Is not empty" },
    { op: "is_null",      label: "Is null" },
    { op: "is_not_null",  label: "Is not null" },
  ],
  number: [
    { op: "eq",           label: "= Equals" },
    { op: "neq",          label: "≠ Not equals" },
    { op: "gt",           label: "> Greater than" },
    { op: "gte",          label: "≥ Greater or equal" },
    { op: "lt",           label: "< Less than" },
    { op: "lte",          label: "≤ Less or equal" },
    { op: "between",      label: "Between" },
    { op: "is_null",      label: "Is null" },
    { op: "is_not_null",  label: "Is not null" },
  ],
  date: [
    { op: "after",        label: "After" },
    { op: "before",       label: "Before" },
    { op: "date_between", label: "Between" },
    { op: "is_null",      label: "Is null" },
    { op: "is_not_null",  label: "Is not null" },
  ],
  boolean: [
    { op: "bool_true",    label: "Is true" },
    { op: "bool_false",   label: "Is false" },
    { op: "is_null",      label: "Is null" },
    { op: "is_not_null",  label: "Is not null" },
  ],
  other: [
    { op: "contains",     label: "Contains" },
    { op: "equals",       label: "Equals" },
    { op: "is_null",      label: "Is null" },
    { op: "is_not_null",  label: "Is not null" },
  ],
};

const DEFAULT_OP: Record<ColKind, FilterOp> = {
  text:    "equals",
  number:  "eq",
  date:    "after",
  boolean: "bool_true",
  other:   "contains",
};

function applyFilter(cellVal: unknown, filter: ActiveFilter): boolean {
  const { op, value, value2 } = filter;

  if (op === "is_null")      return cellVal === null || cellVal === undefined;
  if (op === "is_not_null")  return cellVal !== null && cellVal !== undefined;
  if (op === "bool_true")    return cellVal === true;
  if (op === "bool_false")   return cellVal === false;

  const str      = formatCellValue(cellVal);
  const strLower = str.toLowerCase();

  if (op === "is_empty")     return str === "" || cellVal === null || cellVal === undefined;
  if (op === "is_not_empty") return str !== "" && cellVal !== null && cellVal !== undefined;

  const val = value.toLowerCase().trim();
  if (!val) return true;

  if (op === "contains")     return strLower.includes(val);
  if (op === "not_contains") return !strLower.includes(val);
  if (op === "starts_with")  return strLower.startsWith(val);
  if (op === "ends_with")    return strLower.endsWith(val);
  if (op === "equals")       return strLower === val;
  if (op === "not_equals")   return strLower !== val;

  const num       = Number(str);
  const filterNum = Number(value);
  if (!isNaN(num) && !isNaN(filterNum)) {
    if (op === "eq")  return num === filterNum;
    if (op === "neq") return num !== filterNum;
    if (op === "gt")  return num > filterNum;
    if (op === "gte") return num >= filterNum;
    if (op === "lt")  return num < filterNum;
    if (op === "lte") return num <= filterNum;
    if (op === "between" && value2) {
      const num2 = Number(value2);
      return !isNaN(num2) && num >= filterNum && num <= num2;
    }
  }

  const dateVal    = new Date(str);
  const filterDate = new Date(value);
  if (!isNaN(dateVal.getTime()) && !isNaN(filterDate.getTime())) {
    if (op === "before") return dateVal < filterDate;
    if (op === "after")  return dateVal > filterDate;
    if (op === "date_between" && value2) {
      const date2 = new Date(value2);
      return !isNaN(date2.getTime()) && dateVal >= filterDate && dateVal <= date2;
    }
  }

  return true;
}

// ── ColumnFilterPopover ────────────────────────────────────────────────────

function ColumnFilterPopover({
  field,
  dataTypeID,
  filter,
  onFilterChange,
  rows,
}: {
  field: string;
  dataTypeID: number;
  filter: ActiveFilter | undefined;
  onFilterChange: (f: ActiveFilter | null) => void;
  rows: Record<string, unknown>[];
}) {
  const [open, setOpen]             = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const [distinctSearch, setDistinctSearch] = useState("");
  const ref      = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const kind       = getColKind(dataTypeID);
  const ops        = OPS_BY_KIND[kind];
  const currentOp  = filter?.op ?? DEFAULT_OP[kind];
  const curVal     = filter?.value  ?? "";
  const curVal2    = filter?.value2 ?? "";
  const isActive   = filter ? isFilterActive(filter) : false;
  const needsValue = !NO_VALUE_OPS.has(currentOp);
  const needsTwo   = currentOp === "between" || currentOp === "date_between";
  const inputType  = kind === "number" ? "number" : kind === "date" ? "date" : "text";

  // Distinct values for text equals/not_equals dropdown
  const showDistinctSelect =
    kind === "text" && (currentOp === "equals" || currentOp === "not_equals");
  const distinctValues = useMemo(() => {
    if (!showDistinctSelect) return [];
    return [...new Set(
      rows.map((r) => formatCellValue(r[field])).filter((v) => v !== "")
    )].sort();
  }, [showDistinctSelect, rows, field]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredDistinctValues = useMemo(() => {
    if (!distinctSearch.trim()) return distinctValues;
    const q = distinctSearch.toLowerCase();
    return distinctValues.filter((v) => v.toLowerCase().includes(q));
  }, [distinctValues, distinctSearch]);

  // Close popover on outside click — but not while the Select dropdown is open
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (selectOpen) return;
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, selectOpen]);

  useEffect(() => {
    if (open && needsValue) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open, needsValue]);

  const set = (patch: Partial<ActiveFilter>) =>
    onFilterChange({ op: currentOp, value: curVal, value2: curVal2, ...patch });

  const inputCls = "block w-full h-7 text-xs bg-muted/40 border border-border rounded px-2 focus:outline-none focus:bg-background focus:ring-1 focus:ring-primary/40";

  return (
    <div ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        title={isActive ? "Filter active" : `Filter ${field}`}
        className={cn(
          "h-4 w-4 rounded flex items-center justify-center transition-colors",
          isActive ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"
        )}
      >
        <Filter className="h-3 w-3" />
      </button>

      {open && (
        <div
          className={cn(
            "absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-lg p-2.5 flex flex-col gap-2",
            showDistinctSelect && distinctValues.length > 0 ? "w-72" : "w-56"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] font-medium text-muted-foreground">{field}</p>

          {/* Operator — shadcn Select */}
          <Select
            value={currentOp}
            onValueChange={(val) => set({ op: val as FilterOp, value: curVal, value2: curVal2 })}
            onOpenChange={setSelectOpen}
          >
            <SelectTrigger className="h-7 text-xs px-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ops.map(({ op, label }) => (
                <SelectItem key={op} value={op} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Primary value */}
          {needsValue && (
            showDistinctSelect && distinctValues.length > 0 ? (
              <div className="flex flex-col gap-1">
                <input
                  autoFocus
                  type="text"
                  value={distinctSearch}
                  onChange={(e) => setDistinctSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
                  placeholder="Search values…"
                  className={inputCls}
                />
                <div className="max-h-40 overflow-y-auto rounded border border-border bg-muted/20 flex flex-col">
                  {filteredDistinctValues.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground px-2 py-1.5">No matches</p>
                  ) : (
                    filteredDistinctValues.map((v) => (
                      <button
                        key={v}
                        onClick={() => set({ value: v })}
                        className={cn(
                          "text-left text-xs px-2 py-1 hover:bg-accent transition-colors text-foreground break-words",
                          curVal === v && "bg-primary/10 text-primary font-medium"
                        )}
                      >
                        {v}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <input
                ref={inputRef}
                type={inputType}
                value={curVal}
                onChange={(e) => set({ value: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Escape" || e.key === "Enter") setOpen(false); }}
                placeholder={needsTwo ? "from…" : "value…"}
                className={inputCls}
              />
            )
          )}

          {/* Secondary value (between) */}
          {needsTwo && (
            <input
              type={inputType}
              value={curVal2}
              onChange={(e) => set({ value2: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Escape" || e.key === "Enter") setOpen(false); }}
              placeholder="to…"
              className={inputCls}
            />
          )}

          {/* Clear */}
          {isActive && (
            <button
              onClick={() => { onFilterChange(null); setOpen(false); }}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors border-t border-border/50 pt-1.5 mt-0.5"
            >
              <X className="h-3 w-3" /> Clear filter
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface QueryResultsProps {
  result: QueryResult | null;
  isRunning: boolean;
  schema?: SchemaData | null;
  onApplyFix?: (sql: string) => void;
  onHasActiveFiltersChange?: (has: boolean) => void;
  clearFiltersRef?: React.MutableRefObject<() => void>;
}


export function QueryResults({ result, isRunning, schema, onApplyFix, onHasActiveFiltersChange, clearFiltersRef }: QueryResultsProps) {
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(0);
  const [displayLimit, setDisplayLimit] = useState(INITIAL_DISPLAY_ROWS);
  const [filters, setFilters] = useState<Record<string, ActiveFilter>>({});
  const PAGE_SIZE = 200;

  // Reset everything when a new result arrives
  useEffect(() => {
    setDisplayLimit(INITIAL_DISPLAY_ROWS);
    setPage(0);
    setFilters({});
  }, [result?.id]);

  const hasActiveFilters = Object.values(filters).some(isFilterActive);

  const clearFilters = () => setFilters({});

  // Expose clear function and notify parent of active filter state
  if (clearFiltersRef) clearFiltersRef.current = clearFilters;
  useEffect(() => {
    onHasActiveFiltersChange?.(hasActiveFilters);
  }, [hasActiveFilters]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleLoadMore = () => {
    setDisplayLimit((l) => l + LOAD_MORE_STEP);
  };

  // Filter runs on ALL rows (before displayLimit) so hidden rows are still matched
  const filteredRows = useMemo(() => {
    if (!result?.rows) return [];
    const active = Object.entries(filters).filter(([, f]) => isFilterActive(f));
    if (active.length === 0) return result.rows;
    return result.rows.filter((row) =>
      active.every(([col, filter]) => applyFilter(row[col], filter))
    );
  }, [result, filters]);

  const sortedRows = useMemo(() => {
    const rows = filteredRows.slice(0, displayLimit);
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sort.col];
      const bv = b[sort.col];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [filteredRows, sort, displayLimit]);

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
        <>
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
                      className="relative text-left px-3 py-2 border-b border-border font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground hover:bg-accent/50 transition-colors select-none"
                      onClick={() => handleSort(field.name)}
                    >
                      <div className="flex items-center gap-1 group">
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
                        <ColumnFilterPopover
                          field={field.name}
                          dataTypeID={field.dataTypeID}
                          filter={filters[field.name]}
                          rows={result.rows}
                          onFilterChange={(f) => {
                            setFilters((prev) => {
                              if (!f) { const next = { ...prev }; delete next[field.name]; return next; }
                              return { ...prev, [field.name]: f };
                            });
                            setPage(0);
                          }}
                        />
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
          </div>

          {/* Footer: always outside scroll so it stays pinned */}
          {(totalPages > 1 || filteredRows.length > displayLimit || hasActiveFilters) && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-card shrink-0">
              <span className="text-xs text-muted-foreground">
                {hasActiveFilters && filteredRows.length > displayLimit
                  ? `Showing ${displayLimit.toLocaleString()} of ${filteredRows.length.toLocaleString()} filtered rows`
                  : hasActiveFilters
                  ? `${filteredRows.length.toLocaleString()} of ${result.rows.length.toLocaleString()} rows match`
                  : filteredRows.length > displayLimit
                  ? `Showing ${displayLimit.toLocaleString()} of ${result.rows.length.toLocaleString()} rows`
                  : `Page ${page + 1} of ${totalPages} (${sortedRows.length.toLocaleString()} rows)`}
              </span>
              <div className="flex gap-1">
                {totalPages > 1 && (
                  <>
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
                  </>
                )}
                {filteredRows.length > displayLimit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={handleLoadMore}
                  >
                    Load 1,000 more
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
