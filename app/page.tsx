"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { RefreshCw, Loader2, Plus, ChevronDown, PanelLeftClose, PanelLeftOpen, Sun, Moon, Monitor, Pencil, Trash2, TriangleAlert } from "lucide-react";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConnectionManager } from "@/components/connection-manager";
import { SchemaExplorer } from "@/components/schema-explorer";
import { SqlEditor } from "@/components/sql-editor";
import { QueryResults } from "@/components/query-results";
import { QueryHistory } from "@/components/query-history";
import { QueryActionBar } from "@/components/query-action-bar";
import { AggregatePanel } from "@/components/aggregate-panel";
import { cn } from "@/lib/utils";
import { QueryResult, QueryTab, SavedConnection, SchemaData } from "@/lib/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const STORAGE_KEY = "sql-lab-connections";
const TABS_STORAGE_KEY = "sql-lab-tabs";
const ACTIVE_TAB_STORAGE_KEY = "sql-lab-active-tab";
const SIDEBAR_COLLAPSED_KEY = "sql-lab-sidebar-collapsed";
const AI_ANALYSIS_CACHE_KEY = "sql-lab-ai-analysis-cache";

function loadSidebarCollapsed(): boolean {
  try {
    return typeof window !== "undefined" && localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

const _initSidebarCollapsed = loadSidebarCollapsed();

// Session-level caches (survive HMR / soft reloads)
const SCHEMA_CACHE_KEY = "sql-lab-schema-cache"; // keyed by connectionId
const RESULTS_CACHE_KEY = "sql-lab-results-cache";
const HISTORY_CACHE_KEY = "sql-lab-history-cache";
const BOTTOM_TAB_KEY = "sql-lab-bottom-tab";

function loadSchemaCache(connectionId: string | undefined): SchemaData | null {
  if (!connectionId) return null;
  try {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem(SCHEMA_CACHE_KEY) : null;
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed.connectionId === connectionId ? parsed.schema : null;
  } catch { return null; }
}

function saveSchemaCache(connectionId: string, schema: SchemaData) {
  try { sessionStorage.setItem(SCHEMA_CACHE_KEY, JSON.stringify({ connectionId, schema })); } catch { /* ignore */ }
}

function loadResultsCache(): Record<string, QueryResult> {
  try {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem(RESULTS_CACHE_KEY) : null;
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    // Handle legacy single-result format
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.id) {
      return { [_initActiveTabId]: parsed };
    }
    return parsed ?? {};
  } catch { return {}; }
}

function loadHistoryCache(): QueryResult[] {
  try {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem(HISTORY_CACHE_KEY) : null;
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function loadBottomTab(): string {
  try {
    return (typeof window !== "undefined" && sessionStorage.getItem(BOTTOM_TAB_KEY)) || "results";
  } catch { return "results"; }
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function loadConnections(): SavedConnection[] {
  try {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

const DEFAULT_SQL = `-- Welcome to SQL Lab!
-- Connect to a PostgreSQL database to get started.
-- Press ⌘+Enter (or Ctrl+Enter) to run the current query.

SELECT version();`;

const _initConns = loadConnections();
const _fallbackTabId = generateId();
const _fallbackTab: QueryTab = {
  id: _fallbackTabId,
  name: "Query 1",
  sql: DEFAULT_SQL,
  connectionId: _initConns[0]?.id,
};

function loadTabs(): QueryTab[] {
  try {
    const stored = typeof window !== "undefined" ? localStorage.getItem(TABS_STORAGE_KEY) : null;
    const parsed: QueryTab[] = stored ? JSON.parse(stored) : [];
    return parsed.length > 0 ? parsed : [_fallbackTab];
  } catch {
    return [_fallbackTab];
  }
}

function loadActiveTabId(tabs: QueryTab[]): string {
  try {
    const stored = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) : null;
    if (stored && tabs.find((t) => t.id === stored)) return stored;
  } catch { /* ignore */ }
  return tabs[0].id;
}

function loadAiAnalysisCache(): Record<string, object> {
  try {
    const stored = typeof window !== "undefined" ? localStorage.getItem(AI_ANALYSIS_CACHE_KEY) : null;
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

const _initTabs = loadTabs();
const _initActiveTabId = loadActiveTabId(_initTabs);
const _initActiveConnectionId = _initTabs.find((t) => t.id === _initActiveTabId)?.connectionId;
const _initSchemaCache = loadSchemaCache(_initActiveConnectionId);
const _initTabResults = loadResultsCache();
const _initHistoryCache = loadHistoryCache();
const _initBottomTab = loadBottomTab();
const _initAiAnalysisCache = loadAiAnalysisCache();

export default function Home() {
  // Connections — source of truth
  const [connections, setConnections] = useState<SavedConnection[]>(_initConns);

  const saveConnections = useCallback((conns: SavedConnection[]) => {
    setConnections(conns);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conns));
  }, []);

  // Tabs — each has its own connectionId, persisted to localStorage
  const [tabs, setTabs] = useState<QueryTab[]>(_initTabs);
  const [activeTabId, setActiveTabId] = useState(_initActiveTabId);

  // Persist tabs and activeTabId whenever they change
  useEffect(() => {
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(tabs));
  }, [tabs]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTabId);
  }, [activeTabId]);
  const [mounted, setMounted] = useState(false);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);
  const clearFiltersRef = useRef<() => void>(() => {});
  const [isRunning, setIsRunning] = useState(false);
  const [runningTabId, setRunningTabId] = useState<string | null>(null);
  const [lastRunResultId, setLastRunResultId] = useState<string | null>(null);
  const [analysisCache, setAnalysisCache] = useState<Record<string, object>>(_initAiAnalysisCache);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sidebarRef = useRef<ImperativePanelHandle>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(_initSidebarCollapsed);
  const isMobile = useIsMobile();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // Mark as mounted (fixes hydration mismatch from localStorage reads)
  useEffect(() => setMounted(true), []);

  // Collapse sidebar on mount if it was saved as collapsed
  useEffect(() => {
    if (_initSidebarCollapsed && sidebarRef.current) {
      sidebarRef.current.collapse();
    }
  }, []);

  const handleCancelQuery = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  // Inline tab rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Tab drag-to-reorder state
  const [dragTabId, setDragTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);

  const handleTabDragStart = (e: React.DragEvent, id: string) => {
    setDragTabId(id);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleTabDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (id !== dragTabId) setDragOverTabId(id);
  };
  const handleTabDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragTabId || dragTabId === targetId) return;
    const from = tabs.findIndex((t) => t.id === dragTabId);
    const to = tabs.findIndex((t) => t.id === targetId);
    const reordered = [...tabs];
    reordered.splice(to, 0, reordered.splice(from, 1)[0]);
    setTabs(reordered);
    setDragTabId(null);
    setDragOverTabId(null);
  };
  const handleTabDragEnd = () => {
    setDragTabId(null);
    setDragOverTabId(null);
  };

  const startRename = (e: React.MouseEvent, tab: QueryTab) => {
    e.stopPropagation();
    setRenamingId(tab.id);
    setRenameValue(tab.name);
  };

  const commitRename = (tab: QueryTab) => {
    const name = renameValue.trim();
    if (name && name !== tab.name) {
      setTabs((prev) => prev.map((t) => (t.id === tab.id ? { ...t, name } : t)));
    }
    setRenamingId(null);
  };

  // Derived
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeConnectionId = activeTab?.connectionId;
  const activeConnection = connections.find((c) => c.id === activeConnectionId) ?? null;

  // Stable refs so handleRunQuery doesn't recreate on every render
  const activeConnectionRef = useRef<SavedConnection | null>(null);
  activeConnectionRef.current = activeConnection;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  // Schema state — initialized from sessionStorage cache
  const [schema, setSchema] = useState<SchemaData | null>(_initSchemaCache);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  // Results state — per-tab map, initialized from sessionStorage cache
  const [tabResults, setTabResults] = useState<Record<string, QueryResult>>(_initTabResults);
  const latestResult = tabResults[activeTabId] ?? null;
  const [history, setHistory] = useState<QueryResult[]>(_initHistoryCache);
  const [bottomTab, setBottomTab] = useState(_initBottomTab);
  const showAggregate = activeTab?.showAggregate ?? false;
  const aggregateView = activeTab?.aggregateView ?? "table";

  const setShowAggregate = useCallback((updater: boolean | ((prev: boolean) => boolean)) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabId) return t;
        const next = typeof updater === "function" ? updater(t.showAggregate ?? false) : updater;
        return { ...t, showAggregate: next };
      })
    );
  }, [activeTabId]);

  const setAggregateView = useCallback((v: "table" | "bar" | "pie") => {
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, aggregateView: v } : t))
    );
  }, [activeTabId]);

  const fetchSchema = useCallback(async (conn: SavedConnection) => {
    // Only show loading spinner if we don't have cached schema
    const cached = loadSchemaCache(conn.id);
    if (!cached) setSchemaLoading(true);
    setSchemaError(null);
    try {
      const res = await fetch("/api/schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString: conn.connectionString }),
      });
      const data = await res.json();
      if (data.error) {
        setSchemaError(data.error);
        if (!cached) setSchema(null);
      } else {
        setSchema(data.schema);
        saveSchemaCache(conn.id, data.schema);
      }
    } catch {
      setSchemaError("Failed to fetch schema");
      if (!cached) setSchema(null);
    } finally {
      setSchemaLoading(false);
    }
  }, []);

  // Persist results/history/bottomTab to sessionStorage
  useEffect(() => {
    try {
      const toCache: Record<string, QueryResult> = {};
      for (const [tabId, result] of Object.entries(tabResults)) {
        if (result) toCache[tabId] = { ...result, rows: result.rows.slice(0, 200) };
      }
      sessionStorage.setItem(RESULTS_CACHE_KEY, JSON.stringify(toCache));
    } catch { /* ignore quota errors */ }
  }, [tabResults]);

  useEffect(() => {
    try {
      const toCache = history.slice(0, 50).map((r) => ({ ...r, rows: r.rows.slice(0, 50) }));
      sessionStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(toCache));
    } catch { /* ignore */ }
  }, [history]);

  useEffect(() => {
    sessionStorage.setItem(BOTTOM_TAB_KEY, bottomTab);
  }, [bottomTab]);

  // Re-fetch schema when active tab's connection changes
  useEffect(() => {
    if (activeConnection) {
      fetchSchema(activeConnection);
    } else {
      setSchema(null);
      setSchemaError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConnectionId]);

  const handleTabConnectionChange = useCallback(
    (conn: SavedConnection | null) => {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId ? { ...t, connectionId: conn?.id } : t
        )
      );
    },
    [activeTabId]
  );

  const handleRunQuery = useCallback(
    async (sql: string) => {
      const conn = activeConnectionRef.current;
      const tabId = activeTabIdRef.current;
      if (!conn) {
        setTabResults((prev) => ({
          ...prev,
          [tabId]: {
            id: generateId(),
            sql,
            rows: [],
            fields: [],
            rowCount: 0,
            duration: 0,
            timestamp: new Date(),
            error: "No database connection. Select a connection in the left panel.",
          },
        }));
        setBottomTab("results");
        return;
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      setIsRunning(true);
      setRunningTabId(tabId);
      setBottomTab("results");

      try {
        const res = await fetch("/api/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            connectionString: conn.connectionString,
            sql,
          }),
          signal: abortController.signal,
        });
        const data = await res.json();
        const result: QueryResult = {
          id: generateId(),
          sql,
          rows: data.rows ?? [],
          fields: data.fields ?? [],
          rowCount: data.rowCount ?? 0,
          duration: data.duration ?? 0,
          timestamp: new Date(),
          error: data.error,
          errorPosition: data.position ? parseInt(data.position, 10) : undefined,
          errorDetail: data.detail,
          errorHint: data.hint,
        };
        setTabResults((prev) => ({ ...prev, [tabId]: result }));
        setLastRunResultId(result.id);
        setHistory((prev) => [result, ...prev].slice(0, 200));
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          setTabResults((prev) => ({
            ...prev,
            [tabId]: {
              id: generateId(),
              sql,
              rows: [],
              fields: [],
              rowCount: 0,
              duration: 0,
              timestamp: new Date(),
              error: "Query cancelled.",
            },
          }));
        } else {
          const result: QueryResult = {
            id: generateId(),
            sql,
            rows: [],
            fields: [],
            rowCount: 0,
            duration: 0,
            timestamp: new Date(),
            error: "Network error — could not reach the server",
          };
          setTabResults((prev) => ({ ...prev, [tabId]: result }));
          setLastRunResultId(result.id);
          setHistory((prev) => [result, ...prev]);
        }
      } finally {
        abortControllerRef.current = null;
        setIsRunning(false);
        setRunningTabId(null);
      }
    },
    [] // stable — reads conn and tabId via refs at call time
  );

  const handleTableClick = useCallback(
    (schemaName: string, tableName: string) => {
      const sql = `SELECT *\nFROM ${schemaName}.${tableName}\nLIMIT 100;`;
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, sql } : t))
      );
      setMobileSheetOpen(false);
    },
    [activeTabId]
  );

  const handleTabAdd = () => {
    const newTab: QueryTab = {
      id: generateId(),
      name: `Query ${tabs.length + 1}`,
      sql: "",
      connectionId: activeConnectionId,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleTabClose = (id: string) => {
    const remaining = tabs.filter((t) => t.id !== id);
    setTabs(remaining);
    if (activeTabId === id) {
      setActiveTabId(remaining[remaining.length - 1].id);
    }
    setTabResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleSqlChange = useCallback((sql: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, sql } : t))
    );
  }, [activeTabId]);

  const handleRestoreHistory = useCallback((sql: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, sql } : t))
    );
    setBottomTab("results");
  }, [activeTabId]);

  const downloadFile = useCallback((content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportCSV = useCallback(() => {
    if (!latestResult) return;
    const headers = latestResult.fields.map((f) => f.name).join(",");
    const rows = latestResult.rows
      .map((row) =>
        latestResult.fields
          .map((f) => {
            const val = row[f.name];
            const str = val === null || val === undefined ? "" : typeof val === "object" ? JSON.stringify(val) : String(val);
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(",")
      )
      .join("\n");
    downloadFile(`${headers}\n${rows}`, "query-results.csv", "text/csv");
  }, [latestResult, downloadFile]);

  const handleExportJSON = useCallback(() => {
    if (!latestResult) return;
    downloadFile(JSON.stringify(latestResult.rows, null, 2), "query-results.json", "application/json");
  }, [latestResult, downloadFile]);

  if (!mounted) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]" style={{ height: "100dvh" }}>
        {/* Header */}
        <header className="flex items-center h-10 border-b border-border bg-card/80 backdrop-blur shrink-0">
          {/* Sidebar toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 mx-1 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  if (isMobile) {
                    setMobileSheetOpen((prev) => !prev);
                  } else {
                    const panel = sidebarRef.current;
                    if (panel) {
                      if (panel.isCollapsed()) {
                        panel.expand();
                      } else {
                        panel.collapse();
                      }
                    }
                  }
                }}
              >
                {(isMobile ? !mobileSheetOpen : sidebarCollapsed) ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{(isMobile ? !mobileSheetOpen : sidebarCollapsed) ? "Show sidebar" : "Hide sidebar"}</TooltipContent>
          </Tooltip>

          {/* Full-width tab bar */}
          <div className="flex items-center flex-1 min-w-0 overflow-x-auto self-stretch">
            {tabs.map((tab, index) => (
              <div
                key={tab.id}
                draggable={renamingId !== tab.id}
                onDragStart={(e) => handleTabDragStart(e, tab.id)}
                onDragOver={(e) => handleTabDragOver(e, tab.id)}
                onDrop={(e) => handleTabDrop(e, tab.id)}
                onDragEnd={handleTabDragEnd}
                className={cn(
                  "group flex items-center px-3 self-stretch text-xs cursor-pointer border-r border-border shrink-0 max-w-[180px] transition-colors",
                  "border-b-2",
                  index === 0 && "border-l border-border",
                  tab.id === activeTabId
                    ? "bg-background text-foreground border-b-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/40 border-b-transparent",
                  dragTabId === tab.id && "opacity-40",
                  dragOverTabId === tab.id && "border-l-2 border-l-primary",
                )}
                onClick={() => {
                  if (renamingId !== tab.id) setActiveTabId(tab.id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setOpenDropdownId(tab.id);
                }}
              >
                {renamingId === tab.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => commitRename(tab)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); commitRename(tab); }
                      if (e.key === "Escape") { e.preventDefault(); setRenamingId(null); }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-transparent outline-none text-xs text-foreground min-w-0"
                    style={{ width: `${Math.max(renameValue.length, 4)}ch` }}
                  />
                ) : (
                  <span className="flex items-center gap-1.5 flex-1 min-w-0">
                    {(() => {
                      const isTabRunning = runningTabId === tab.id;
                      const result = tabResults[tab.id];
                      if (isTabRunning) return <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0 animate-pulse" />;
                      if (!result) return <span className="w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0" />;
                      if (result.error) return <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />;
                      return <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />;
                    })()}
                    <span
                      className="truncate select-none"
                      onDoubleClick={(e) => startRename(e, tab)}
                      title="Double-click to rename"
                    >
                      {tab.name}
                    </span>
                  </span>
                )}
                {renamingId !== tab.id && (
                  <DropdownMenu
                    open={openDropdownId === tab.id}
                    onOpenChange={(open) => {
                      if (!open) {
                        setConfirmingDeleteId(null);
                        setOpenDropdownId(null);
                      }
                    }}
                  >
                    <DropdownMenuTrigger asChild>
                      <button
                        className="ml-1.5 shrink-0 opacity-60 hover:opacity-100 transition-opacity md:opacity-0 md:pointer-events-none md:w-0 md:overflow-hidden md:ml-0"
                        onClick={(e) => { e.stopPropagation(); setOpenDropdownId(tab.id); }}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[140px]">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          startRename(e, tab);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Rename
                      </DropdownMenuItem>
                      {tabs.length > 1 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-400 focus:text-red-400"
                            onSelect={(e) => {
                              e.preventDefault();
                              if (confirmingDeleteId === tab.id) {
                                handleTabClose(tab.id);
                                setConfirmingDeleteId(null);
                              } else {
                                setConfirmingDeleteId(tab.id);
                              }
                            }}
                          >
                            {confirmingDeleteId === tab.id
                              ? <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                              : <Trash2 className="h-3.5 w-3.5 shrink-0" />
                            }
                            {confirmingDeleteId === tab.id ? "Confirm" : "Delete"}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 mx-1 shrink-0 self-center"
              onClick={handleTabAdd}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Theme toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 mx-1 shrink-0 self-center text-muted-foreground hover:text-foreground"
              >
                {resolvedTheme === "dark" ? (
                  <Moon className="h-3.5 w-3.5" />
                ) : (
                  <Sun className="h-3.5 w-3.5" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme("light")} className={cn("text-xs gap-2", theme === "light" && "bg-accent")}>
                <Sun className="h-3.5 w-3.5" /> Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")} className={cn("text-xs gap-2", theme === "dark" && "bg-accent")}>
                <Moon className="h-3.5 w-3.5" /> Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")} className={cn("text-xs gap-2", theme === "system" && "bg-accent")}>
                <Monitor className="h-3.5 w-3.5" /> System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

        </header>

        {/* Mobile sidebar sheet */}
        {isMobile && (
          <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
            <SheetContent className="flex flex-col">
              <div className="border-b border-border shrink-0 px-2 py-2 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <ConnectionManager
                    connections={connections}
                    selectedConnectionId={activeConnectionId}
                    onConnectionChange={handleTabConnectionChange}
                    onConnectionsChange={saveConnections}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground"
                  onClick={() => activeConnection && fetchSchema(activeConnection)}
                  disabled={!activeConnection || schemaLoading}
                  title="Refresh schema"
                >
                  {schemaLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <SchemaExplorer
                  schema={schema}
                  loading={schemaLoading}
                  error={schemaError}
                  onRefresh={() => activeConnection && fetchSchema(activeConnection)}
                  onTableClick={handleTableClick}
                />
              </div>
            </SheetContent>
          </Sheet>
        )}

        {/* Main layout */}
        <ResizablePanelGroup
          direction="horizontal"
          className="flex-1 min-h-0"
          autoSaveId="sql-lab-horizontal"
        >
          {/* Left: Connection (per-tab) + Schema — hidden on mobile */}
          {!isMobile && (
            <>
              <ResizablePanel
                ref={sidebarRef}
                defaultSize={18}
                minSize={12}
                maxSize={35}
                collapsible
                collapsedSize={0}
                onCollapse={() => { setSidebarCollapsed(true); localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true"); }}
                onExpand={() => { setSidebarCollapsed(false); localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "false"); }}
                className="bg-card/30 flex flex-col min-w-0"
              >
                <div className="border-b border-border shrink-0 px-2 py-2 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <ConnectionManager
                      connections={connections}
                      selectedConnectionId={activeConnectionId}
                      onConnectionChange={handleTabConnectionChange}
                      onConnectionsChange={saveConnections}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground"
                    onClick={() => activeConnection && fetchSchema(activeConnection)}
                    disabled={!activeConnection || schemaLoading}
                    title="Refresh schema"
                  >
                    {schemaLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <SchemaExplorer
                    schema={schema}
                    loading={schemaLoading}
                    error={schemaError}
                    onRefresh={() => activeConnection && fetchSchema(activeConnection)}
                    onTableClick={handleTableClick}
                  />
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />
            </>
          )}

          {/* Right: Editor + Results */}
          <ResizablePanel defaultSize={isMobile ? 100 : 82} minSize={50}>
            <ResizablePanelGroup
              direction="vertical"
              autoSaveId="sql-lab-vertical"
            >
              {/* Editor */}
              <ResizablePanel defaultSize={55} minSize={25}>
                <SqlEditor
                  sql={activeTab?.sql ?? ""}
                  isRunning={isRunning}
                  schema={schema}
                  onSqlChange={handleSqlChange}
                  onRunQuery={handleRunQuery}
                />
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Results */}
              <ResizablePanel defaultSize={45} minSize={20}>
                <div className="flex flex-col h-full bg-card/20">
                  <QueryActionBar
                    isRunning={isRunning}
                    hasSql={!!activeTab?.sql?.trim()}
                    onRun={() => activeTab?.sql?.trim() && handleRunQuery(activeTab.sql)}
                    onCancel={handleCancelQuery}
                    onClear={() => handleSqlChange("")}
                    bottomTab={bottomTab}
                    onBottomTabChange={setBottomTab}
                    latestResult={latestResult}
                    historyCount={history.length}
                    onExportCSV={handleExportCSV}
                    onExportJSON={handleExportJSON}
                    showAggregate={showAggregate}
                    onToggleAggregate={() => setShowAggregate((v) => !v)}
                    viewMode={aggregateView}
                    onViewModeChange={setAggregateView}
                    hasActiveFilters={hasActiveFilters}
                    onClearFilters={() => clearFiltersRef.current()}
                    isMobile={isMobile}
                  />
                  <div className="flex-1 min-h-0 flex overflow-hidden">
                    {/* On mobile, aggregate tabs replace the side panel. On desktop, it's a side panel. */}
                    {isMobile && (bottomTab === "agg_table" || bottomTab === "agg_bar" || bottomTab === "agg_pie") && latestResult && !latestResult.error && latestResult.fields.length > 0 ? (
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <AggregatePanel
                          result={latestResult}
                          view={bottomTab.replace("agg_", "") as "table" | "bar" | "pie"}
                          onViewChange={(v) => setBottomTab(`agg_${v}`)}
                          fullWidth
                        />
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0 overflow-hidden">
                        {bottomTab === "results" ? (
                          <QueryResults
                            result={latestResult}
                            isRunning={isRunning}
                            schema={schema}
                            onApplyFix={(sql) => {
                              setTabs((prev) =>
                                prev.map((t) => (t.id === activeTabId ? { ...t, sql } : t))
                              );
                            }}
                            onHasActiveFiltersChange={setHasActiveFilters}
                            clearFiltersRef={clearFiltersRef}
                            lastRunResultId={lastRunResultId}
                            analysisCache={analysisCache}
                            onAnalysisCacheUpdate={(id, a) => {
                              setAnalysisCache((prev) => {
                                const next = { ...prev, [id]: a };
                                localStorage.setItem(AI_ANALYSIS_CACHE_KEY, JSON.stringify(next));
                                return next;
                              });
                            }}
                          />
                        ) : (
                          <QueryHistory
                            history={history}
                            onRestore={handleRestoreHistory}
                            onClear={() => setHistory([])}
                          />
                        )}
                      </div>
                    )}
                    {!isMobile && showAggregate && latestResult && !latestResult.error && latestResult.fields.length > 0 && (
                      <AggregatePanel
                        result={latestResult}
                        view={aggregateView}
                        onViewChange={setAggregateView}
                      />
                    )}
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  );
}
