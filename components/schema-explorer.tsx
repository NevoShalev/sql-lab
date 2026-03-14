"use client";

import { useState } from "react";
import {
  ChevronRight,
  Table2,
  Eye,
  Columns,
  AlertCircle,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SchemaData, SchemaTable } from "@/lib/types";

interface SchemaExplorerProps {
  schema: SchemaData | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onTableClick: (schema: string, table: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  integer: "text-blue-400",
  bigint: "text-blue-400",
  smallint: "text-blue-400",
  numeric: "text-blue-400",
  decimal: "text-blue-400",
  real: "text-blue-400",
  "double precision": "text-blue-400",
  text: "text-green-400",
  varchar: "text-green-400",
  "character varying": "text-green-400",
  char: "text-green-400",
  boolean: "text-yellow-400",
  bool: "text-yellow-400",
  timestamp: "text-purple-400",
  "timestamp without time zone": "text-purple-400",
  "timestamp with time zone": "text-purple-400",
  date: "text-purple-400",
  time: "text-purple-400",
  uuid: "text-orange-400",
  json: "text-pink-400",
  jsonb: "text-pink-400",
  bytea: "text-red-400",
};

function getTypeColor(type: string): string {
  return TYPE_COLORS[type.toLowerCase()] ?? "text-muted-foreground";
}

function shortType(type: string): string {
  const map: Record<string, string> = {
    "character varying": "varchar",
    "timestamp without time zone": "timestamp",
    "timestamp with time zone": "timestamptz",
    "double precision": "float8",
  };
  return map[type.toLowerCase()] ?? type;
}

function TableNode({
  schemaName,
  tableName,
  table,
  onTableClick,
}: {
  schemaName: string;
  tableName: string;
  table: SchemaTable;
  onTableClick: (schema: string, table: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isView = table.type === "VIEW";

  return (
    <div className="select-none">
      <div
        className="flex items-center gap-1 px-2 py-1 rounded-sm cursor-pointer hover:bg-accent group overflow-hidden"
        onClick={() => setOpen(!open)}
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
        {isView ? (
          <Eye className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <Table2 className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <span
          className="text-xs flex-1 truncate hover:text-primary transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onTableClick(schemaName, tableName);
          }}
          title={`SELECT * FROM ${schemaName}.${tableName} LIMIT 100`}
        >
          {tableName}
        </span>
        {isView && (
          <Badge
            variant="outline"
            className="text-[9px] h-3.5 px-1 py-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            view
          </Badge>
        )}
        <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums min-w-[1.25rem] text-right opacity-0 group-hover:opacity-100 transition-opacity">
          {table.columns.length}
        </span>
      </div>

      {open && table.columns.length > 0 && (
        <div className="ml-5 border-l border-border/50">
          {table.columns.map((col) => (
            <div
              key={col.name}
              className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-accent/50 rounded-sm group/col overflow-hidden"
            >
              <Columns className="h-2.5 w-2.5 shrink-0 text-muted-foreground/50" />
              <span className="text-xs text-foreground/80 flex-1 truncate font-mono">
                {col.name}
              </span>
              <span
                className={cn(
                  "text-[10px] font-mono truncate max-w-[5rem]",
                  getTypeColor(col.type)
                )}
                title={col.type}
              >
                {shortType(col.type)}
              </span>
              {!col.nullable && (
                <span className="text-[9px] text-red-400 opacity-0 group-hover/col:opacity-100">
                  !null
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SchemaExplorer({
  schema,
  loading,
  error,
  onRefresh,
  onTableClick,
}: SchemaExplorerProps) {
  const [expandedSchemas, setExpandedSchemas] = useState<Set<string>>(
    new Set(["public"])
  );

  const toggleSchema = (schemaName: string) => {
    setExpandedSchemas((prev) => {
      const next = new Set(prev);
      if (next.has(schemaName)) next.delete(schemaName);
      else next.add(schemaName);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="p-2">
          {error && (
            <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!schema && !loading && !error && (
            <p className="text-xs text-muted-foreground text-center py-8 px-4">
              Connect to a database to explore the schema
            </p>
          )}

          {schema &&
            Object.entries(schema).map(([schemaName, tables]) => {
              const isExpanded = expandedSchemas.has(schemaName);
              const tableCount = Object.keys(tables).length;

              return (
                <div key={schemaName} className="mb-1">
                  <div
                    className="flex items-center gap-1 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent"
                    onClick={() => toggleSchema(schemaName)}
                  >
                    <ChevronRight
                      className={cn(
                        "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
                        isExpanded && "rotate-90"
                      )}
                    />
                    <span className="text-xs font-semibold text-foreground/90 flex-1 min-w-0 truncate">
                      {schemaName}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums min-w-[1.25rem] text-right">
                      {tableCount}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="ml-2">
                      {Object.entries(tables).map(([tableName, table]) => (
                        <TableNode
                          key={tableName}
                          schemaName={schemaName}
                          tableName={tableName}
                          table={table}
                          onTableClick={onTableClick}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </ScrollArea>
    </div>
  );
}
