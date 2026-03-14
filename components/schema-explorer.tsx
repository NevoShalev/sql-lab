"use client";

import { useState } from "react";
import {
  ChevronRight,
  Table2,
  Eye,
  AlertCircle,
  Hash,
  Type,
  ToggleLeft,
  Clock,
  Fingerprint,
  Braces,
  Binary,
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

type TypeInfo = { icon: React.ComponentType<{ className?: string }>; color: string };

const NUMERIC_TYPE: TypeInfo = { icon: Hash, color: "text-blue-400" };
const TEXT_TYPE: TypeInfo = { icon: Type, color: "text-green-400" };
const BOOL_TYPE: TypeInfo = { icon: ToggleLeft, color: "text-yellow-400" };
const TIME_TYPE: TypeInfo = { icon: Clock, color: "text-purple-400" };
const UUID_TYPE: TypeInfo = { icon: Fingerprint, color: "text-orange-400" };
const JSON_TYPE: TypeInfo = { icon: Braces, color: "text-pink-400" };
const BINARY_TYPE: TypeInfo = { icon: Binary, color: "text-red-400" };
const DEFAULT_TYPE: TypeInfo = { icon: Hash, color: "text-muted-foreground" };

const TYPE_MAP: Record<string, TypeInfo> = {
  integer: NUMERIC_TYPE, bigint: NUMERIC_TYPE, smallint: NUMERIC_TYPE,
  numeric: NUMERIC_TYPE, decimal: NUMERIC_TYPE, real: NUMERIC_TYPE,
  "double precision": NUMERIC_TYPE,
  text: TEXT_TYPE, varchar: TEXT_TYPE, "character varying": TEXT_TYPE, char: TEXT_TYPE,
  boolean: BOOL_TYPE, bool: BOOL_TYPE,
  timestamp: TIME_TYPE, "timestamp without time zone": TIME_TYPE,
  "timestamp with time zone": TIME_TYPE, date: TIME_TYPE, time: TIME_TYPE,
  uuid: UUID_TYPE,
  json: JSON_TYPE, jsonb: JSON_TYPE,
  bytea: BINARY_TYPE,
};

function getTypeInfo(type: string): TypeInfo {
  return TYPE_MAP[type.toLowerCase()] ?? DEFAULT_TYPE;
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
        <div className="ml-5 border-l border-border/50 min-w-0 overflow-hidden">
          {table.columns.map((col) => (
            <div
              key={col.name}
              className="flex items-center gap-1.5 px-2 py-0.5 hover:bg-accent/50 rounded-sm group/col overflow-hidden"
            >
              {(() => {
                const typeInfo = getTypeInfo(col.type);
                const TypeIcon = typeInfo.icon;
                return <TypeIcon className={cn("h-3 w-3 shrink-0", typeInfo.color)} />;
              })()}
              <span className="text-xs text-foreground/80 flex-1 truncate font-mono min-w-0" title={col.type}>
                {col.name}
              </span>
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
        <div className="p-2 overflow-hidden">
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
                    <div className="ml-2 overflow-hidden">
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
