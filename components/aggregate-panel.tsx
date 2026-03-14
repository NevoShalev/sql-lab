"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { ChevronDown, GripVertical } from "lucide-react";
import { QueryResult, QueryField } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── PostgreSQL type map ──────────────────────────────────────────────────────

type TypeCategory = "text" | "numeric" | "date" | "bool" | "other";

const PG_TYPES: Record<number, { label: string; category: TypeCategory }> = {
  16:   { label: "bool",        category: "bool"    },
  18:   { label: "char",        category: "text"    },
  19:   { label: "name",        category: "text"    },
  20:   { label: "int8",        category: "numeric" },
  21:   { label: "int2",        category: "numeric" },
  23:   { label: "int4",        category: "numeric" },
  25:   { label: "text",        category: "text"    },
  26:   { label: "oid",         category: "other"   },
  700:  { label: "float4",      category: "numeric" },
  701:  { label: "float8",      category: "numeric" },
  1042: { label: "char",        category: "text"    },
  1043: { label: "varchar",     category: "text"    },
  1082: { label: "date",        category: "date"    },
  1114: { label: "timestamp",   category: "date"    },
  1184: { label: "timestamptz", category: "date"    },
  1700: { label: "numeric",     category: "numeric" },
  2950: { label: "uuid",        category: "other"   },
};

function typeInfo(f: QueryField) {
  return PG_TYPES[f.dataTypeID] ?? { label: "?", category: "other" as TypeCategory };
}

function smartGroupDefault(fields: QueryField[]): string {
  // Prefer text field that's not an ID column
  const textNotId = fields.find(
    (f) => typeInfo(f).category === "text" && !f.name.toLowerCase().includes("id")
  );
  if (textNotId) return textNotId.name;
  // Any text field
  const text = fields.find((f) => typeInfo(f).category === "text");
  if (text) return text.name;
  return fields[0]?.name ?? "";
}

function smartValueDefault(fields: QueryField[]): string {
  const num = fields.find((f) => typeInfo(f).category === "numeric");
  return num?.name ?? fields[0]?.name ?? "";
}

// ─── Aggregate computation ────────────────────────────────────────────────────

type AggFunc = "COUNT" | "SUM" | "AVG" | "MIN" | "MAX" | "COUNT_DISTINCT";
const NEEDS_VALUE: AggFunc[] = ["SUM", "AVG", "MIN", "MAX", "COUNT_DISTINCT"];

function computeAggregate(
  rows: Record<string, unknown>[],
  groupByField: string | null,
  aggFunc: AggFunc,
  valueField: string | null
): { group: string; value: number | string }[] {
  if (!rows.length) return [];
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const key = groupByField ? String(row[groupByField] ?? "(null)") : "(all)";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  const result: { group: string; value: number | string }[] = [];
  for (const [group, gr] of groups) {
    let value: number | string = 0;
    switch (aggFunc) {
      case "COUNT": value = gr.length; break;
      case "COUNT_DISTINCT":
        value = valueField ? new Set(gr.map((r) => String(r[valueField]))).size : gr.length; break;
      case "SUM":
        value = valueField ? gr.reduce((a, r) => a + (Number(r[valueField]) || 0), 0) : 0; break;
      case "AVG": {
        if (!valueField) break;
        const s = gr.reduce((a, r) => a + (Number(r[valueField]) || 0), 0);
        value = gr.length ? Number((s / gr.length).toFixed(4)) : 0; break;
      }
      case "MIN":
        value = valueField
          ? String(gr.map((r) => r[valueField]).filter((v) => v != null).reduce((a, b) => (a < b ? a : b)) ?? "")
          : ""; break;
      case "MAX":
        value = valueField
          ? String(gr.map((r) => r[valueField]).filter((v) => v != null).reduce((a, b) => (a > b ? a : b)) ?? "")
          : ""; break;
    }
    result.push({ group, value });
  }
  if (["COUNT", "COUNT_DISTINCT", "SUM"].includes(aggFunc))
    return result.sort((a, b) => Number(b.value) - Number(a.value));
  return result.sort((a, b) => String(a.group).localeCompare(String(b.group)));
}

function aggLabel(fn: AggFunc, vf: string | null) {
  if (fn === "COUNT") return "COUNT";
  if (fn === "COUNT_DISTINCT") return `DISTINCT(${vf ?? "?"})`;
  return `${fn}(${vf ?? "?"})`;
}

// ─── Chart colors ─────────────────────────────────────────────────────────────

const COLORS = [
  "hsl(153 70% 53%)",
  "hsl(210 70% 60%)",
  "hsl(40 90% 58%)",
  "hsl(280 65% 65%)",
  "hsl(0 68% 60%)",
  "hsl(180 58% 48%)",
  "hsl(320 60% 62%)",
  "hsl(60 70% 52%)",
];

// ─── Bar chart ────────────────────────────────────────────────────────────────

function BarChartView({ rows }: { rows: { group: string; value: number | string }[] }) {
  const top = rows.slice(0, 20);
  const maxVal = Math.max(...top.map((r) => Number(r.value)), 1);
  return (
    <div className="p-3 space-y-1.5">
      {top.map((row, i) => (
        <div key={i} className="flex items-center gap-2 min-w-0">
          <div className="w-20 text-[11px] text-muted-foreground truncate text-right shrink-0">
            {row.group}
          </div>
          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            <div
              className="h-4 rounded-sm shrink-0 transition-all"
              style={{
                width: `${(Number(row.value) / maxVal) * 100}%`,
                backgroundColor: COLORS[i % COLORS.length],
                opacity: 0.85,
              }}
            />
            <span className="text-[11px] font-mono tabular-nums text-foreground shrink-0">
              {typeof row.value === "number" ? row.value.toLocaleString() : row.value}
            </span>
          </div>
        </div>
      ))}
      {rows.length > 20 && (
        <p className="text-[10px] text-muted-foreground text-center pt-1">
          +{rows.length - 20} more
        </p>
      )}
    </div>
  );
}

// ─── Pie chart ────────────────────────────────────────────────────────────────

function PieChartView({ rows }: { rows: { group: string; value: number | string }[] }) {
  const top8 = rows.slice(0, 8);
  const othersVal = rows.slice(8).reduce((s, r) => s + Number(r.value), 0);
  const segments = othersVal > 0 ? [...top8, { group: "Others", value: othersVal }] : top8;
  const total = segments.reduce((s, r) => s + Number(r.value), 0) || 1;

  const cx = 80, cy = 80, r = 58, strokeWidth = 11;
  const circumference = 2 * Math.PI * r;
  // Each segment is shortened by gapSize so rounded caps don't overlap neighbors.
  // The extra 3 creates a small visible gap between segments.
  const gapSize = strokeWidth + 3;

  let cumulativeFrac = 0;
  const slices = segments.map((row, i) => {
    const frac = Number(row.value) / total;
    const dashLength = Math.max(0, frac * circumference - gapSize);
    const dashOffset = circumference * (1 - cumulativeFrac) - gapSize / 2;
    cumulativeFrac += frac;
    return { ...row, frac, dashLength, dashOffset, color: COLORS[i % COLORS.length] };
  });

  return (
    <div className="p-3 space-y-3">
      <svg viewBox="0 0 160 160" className="w-full max-w-[180px] mx-auto">
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={strokeWidth} opacity={0.2} />
        {slices.map((s, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${s.dashLength} ${circumference - s.dashLength}`}
            strokeDashoffset={s.dashOffset}
            strokeLinecap="round"
            opacity={0.9}
            transform={`rotate(-90, ${cx}, ${cy})`}
          />
        ))}
      </svg>
      {/* Legend */}
      <div className="space-y-1">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-[11px] text-muted-foreground truncate flex-1">{s.group}</span>
            <span className="text-[11px] font-mono tabular-nums text-muted-foreground shrink-0">
              {typeof s.value === "number" ? s.value.toLocaleString() : s.value}
            </span>
            <span className="text-[11px] font-mono tabular-nums text-foreground shrink-0 w-10 text-right">
              {(s.frac * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Table view ───────────────────────────────────────────────────────────────

function TableView({ rows }: { rows: { group: string; value: number | string }[] }) {
  const total = rows.reduce((s, r) => s + Number(r.value), 0);
  const allNumeric = rows.every((r) => typeof r.value === "number" || !isNaN(Number(r.value)));
  return (
    <table className="w-full text-xs table-fixed">
      <colgroup>
        <col className="w-2/3" />
        <col className="w-1/3" />
      </colgroup>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={i}
            className={cn(
              "border-b border-border/40 hover:bg-accent/30 transition-colors",
              i % 2 !== 0 && "bg-muted/20"
            )}
          >
            <td className="px-2 py-1.5 truncate text-foreground/80" title={row.group}>{row.group}</td>
            <td className="px-2 py-1.5 text-right font-mono tabular-nums text-foreground truncate">
              {typeof row.value === "number" ? row.value.toLocaleString() : row.value}
            </td>
          </tr>
        ))}
        {allNumeric && rows.length > 1 && (
          <tr className="border-t-2 border-border bg-muted/30 font-medium">
            <td className="px-2 py-1.5 text-foreground/60 text-[11px]">Total</td>
            <td className="px-2 py-1.5 text-right font-mono tabular-nums text-foreground">
              {total.toLocaleString()}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export type ViewMode = "table" | "bar" | "pie";

const MIN_WIDTH = 200;
const MAX_WIDTH = 520;
const DEFAULT_WIDTH = 260;

interface AggregatePanelProps {
  result: QueryResult;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  fullWidth?: boolean;
}

export function AggregatePanel({ result, view, onViewChange, fullWidth = false }: AggregatePanelProps) {
  const fields = result.fields;

  const [groupByField, setGroupByField] = useState(() => smartGroupDefault(fields));
  const [aggFunc, setAggFunc] = useState<AggFunc>("COUNT");
  const [valueField, setValueField] = useState(() => smartValueDefault(fields));
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      dragStartX.current = e.clientX;
      dragStartWidth.current = width;
      const onMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = dragStartX.current - ev.clientX;
        setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartWidth.current + delta)));
      };
      const onUp = () => {
        isDragging.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [width]
  );

  const needsValueField = NEEDS_VALUE.includes(aggFunc);

  const rows = useMemo(
    () =>
      computeAggregate(
        result.rows,
        groupByField || null,
        aggFunc,
        needsValueField ? valueField || null : null
      ),
    [result.rows, groupByField, aggFunc, valueField, needsValueField]
  );

  const colAggLabel = aggLabel(aggFunc, needsValueField ? valueField : null);

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-card/40 relative",
        fullWidth ? "flex-1 min-w-0" : "shrink-0 border-l border-border"
      )}
      style={fullWidth ? undefined : { width }}
    >
      {/* Drag handle — desktop only */}
      {!fullWidth && (
        <div
          onMouseDown={handleDragStart}
          className="absolute left-0 top-0 bottom-0 w-3 cursor-col-resize z-10 flex items-center justify-center hover:bg-primary/10 transition-colors"
        >
          <div className="flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
            <GripVertical className="h-2.5 w-2.5" />
          </div>
        </div>
      )}

      {/* Column header pickers — always visible */}
      <div className="flex items-center border-b border-border bg-card/60 px-2 gap-2 shrink-0 h-[32.5px]">
        {/* Group by */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors min-w-0 flex-1">
              <span className="truncate">{groupByField || "Group by"}</span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
            <DropdownMenuLabel className="text-[10px]">Group by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {fields.map((f) => {
              const info = typeInfo(f);
              return (
                <DropdownMenuItem
                  key={f.name}
                  className={cn("text-xs", groupByField === f.name && "bg-accent")}
                  onSelect={() => setGroupByField(f.name)}
                >
                  <span className="flex-1">{f.name}</span>
                  <span className="ml-2 text-[10px] text-muted-foreground font-mono">{info.label}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-3.5 bg-border shrink-0" />

        {/* Aggregate */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors min-w-0 shrink-0">
              <span className="truncate max-w-[90px]">{colAggLabel}</span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-[10px]">Function</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={cn("text-xs", aggFunc === "COUNT" && "bg-accent")}
              onSelect={() => setAggFunc("COUNT")}
            >
              COUNT
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {(["COUNT_DISTINCT", "SUM", "AVG", "MIN", "MAX"] as AggFunc[]).map((fn) => (
              <DropdownMenuSub key={fn}>
                <DropdownMenuSubTrigger className={cn("text-xs", aggFunc === fn && "bg-accent")}>
                  {fn === "COUNT_DISTINCT" ? "COUNT DISTINCT" : fn}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                  <DropdownMenuLabel className="text-[10px]">Field</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {fields.map((f) => {
                    const info = typeInfo(f);
                    return (
                      <DropdownMenuItem
                        key={f.name}
                        className={cn("text-xs", aggFunc === fn && valueField === f.name && "bg-accent")}
                        onSelect={() => { setAggFunc(fn); setValueField(f.name); }}
                      >
                        <span className="flex-1">{f.name}</span>
                        <span className="ml-2 text-[10px] text-muted-foreground font-mono">{info.label}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6 px-3">No results</p>
        ) : view === "table" ? (
          <TableView rows={rows} />
        ) : view === "bar" ? (
          <BarChartView rows={rows} />
        ) : (
          <PieChartView rows={rows} />
        )}
      </div>

      {/* Footer */}
      {rows.length > 0 && (
        <>
          <Separator />
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground shrink-0">
            {rows.length} group{rows.length !== 1 ? "s" : ""}
          </div>
        </>
      )}
    </div>
  );
}
