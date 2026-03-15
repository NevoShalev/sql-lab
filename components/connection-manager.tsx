"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { SavedConnection } from "@/lib/types";

interface ConnectionManagerProps {
  connections: SavedConnection[];
  selectedConnectionId: string | null | undefined;
  onConnectionChange: (conn: SavedConnection | null) => void;
  onConnectionsChange: (conns: SavedConnection[]) => void;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function buildConnectionString(form: {
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}): string {
  const encodedUser = encodeURIComponent(form.user);
  const encodedPass = encodeURIComponent(form.password);
  const sslParam = form.ssl ? "?sslmode=require" : "";
  return `postgresql://${encodedUser}:${encodedPass}@${form.host}:${form.port}/${form.database}${sslParam}`;
}

function parseConnectionString(str: string): Partial<{
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
}> {
  try {
    const url = new URL(str.replace(/^postgres:\/\//, "postgresql://"));
    return {
      host: url.hostname || "localhost",
      port: url.port || "5432",
      database: url.pathname.replace(/^\//, "") || "postgres",
      user: decodeURIComponent(url.username) || "postgres",
      password: decodeURIComponent(url.password) || "",
      ssl: url.searchParams.get("sslmode") === "require",
    };
  } catch {
    return {};
  }
}

const defaultForm = {
  name: "",
  host: "localhost",
  port: "5432",
  database: "postgres",
  user: "postgres",
  password: "",
  ssl: false,
};

function getConnectionLabel(conn: SavedConnection, connections: SavedConnection[]): string {
  const sameNameCount = connections.filter((c) => c.name === conn.name).length;
  return sameNameCount > 1 ? `${conn.name} (${conn.database})` : conn.name;
}

export function ConnectionManager({
  connections,
  selectedConnectionId,
  onConnectionChange,
  onConnectionsChange,
}: ConnectionManagerProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inputMode, setInputMode] = useState<"fields" | "string">("fields");
  const [form, setForm] = useState(defaultForm);
  const [connString, setConnString] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [testMessage, setTestMessage] = useState("");

  const activeConn = connections.find((c) => c.id === selectedConnectionId);

  const resetTest = () => {
    setTestResult(null);
    setTestMessage("");
  };

  const updateForm = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    const connectionKeys: (keyof typeof form)[] = ["host", "port", "database", "user", "password", "ssl"];
    if (connectionKeys.some((k) => k in patch)) resetTest();
  };

  const switchMode = (mode: "fields" | "string") => {
    if (mode === "string" && inputMode === "fields") {
      setConnString(buildConnectionString(form));
    } else if (mode === "fields" && inputMode === "string") {
      const parsed = parseConnectionString(connString);
      setForm((f) => ({ ...f, ...parsed }));
    }
    setInputMode(mode);
    resetTest();
  };

  const getEffectiveConnectionString = () =>
    inputMode === "string" ? connString.replace(/[\r\n]+/g, '').trim() : buildConnectionString(form);

  const handleTest = async () => {
    setTesting(true);
    resetTest();
    try {
      const connectionString = getEffectiveConnectionString();
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString, sql: "SELECT 1" }),
      });
      const data = await res.json();
      if (data.error) {
        setTestResult("error");
        setTestMessage(data.error);
      } else {
        setTestResult("success");
        setTestMessage("Connection successful!");
      }
    } catch {
      setTestResult("error");
      setTestMessage("Network error — is the server running?");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const connectionString = getEffectiveConnectionString();
    const parsed = inputMode === "string" ? parseConnectionString(connString) : null;
    const conn: SavedConnection = {
      id: generateId(),
      name:
        form.name ||
        (parsed
          ? `${parsed.user ?? "postgres"}@${parsed.host ?? "localhost"}/${parsed.database ?? "postgres"}`
          : `${form.user}@${form.host}/${form.database}`),
      host: parsed?.host ?? form.host,
      port: Number(parsed?.port ?? form.port),
      database: parsed?.database ?? form.database,
      user: parsed?.user ?? form.user,
      password: parsed?.password ?? form.password,
      ssl: parsed?.ssl ?? form.ssl,
      connectionString,
    };
    onConnectionsChange([...connections, conn]);
    onConnectionChange(conn);
    setDialogOpen(false);
    setForm(defaultForm);
    setConnString("");
    setInputMode("fields");
    resetTest();
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    onConnectionsChange(connections.filter((c) => c.id !== id));
    if (selectedConnectionId === id) onConnectionChange(null);
    setDropdownOpen(false);
  };

  return (
    <div className="min-w-0 w-full">
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full min-w-0 h-8 text-xs justify-between font-normal"
          >
            <span className="flex items-center gap-2 min-w-0 truncate">
              {activeConn ? (
                <>
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="truncate">{activeConn.name}</span>
                </>
              ) : (
                <span className="text-muted-foreground">Select connection</span>
              )}
            </span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="min-w-[var(--radix-dropdown-menu-trigger-width)]"
        >
          {connections.map((conn) => (
            <DropdownMenuItem
              key={conn.id}
              onSelect={() => {
                onConnectionChange(conn);
                setDropdownOpen(false);
              }}
              className="flex items-center gap-2 cursor-pointer pr-1"
            >
              <span
                className={cn(
                  "shrink-0 w-1.5 h-1.5 rounded-full",
                  conn.id === selectedConnectionId
                    ? "bg-green-400"
                    : "bg-transparent border border-border"
                )}
              />
              <span className="flex-1 truncate text-left">
                {getConnectionLabel(conn, connections)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive [&_svg]:pointer-events-auto"
                onClick={(e) => handleDelete(e, conn.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              setDropdownOpen(false);
              setDialogOpen(true);
            }}
            className="cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            Add connection
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px] flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>New Connection</DialogTitle>
            <DialogDescription>
              Configure a PostgreSQL database connection.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 -mx-6 px-6">
            <FieldGroup className="py-2">

              {/* Name */}
              <Field>
                <FieldLabel htmlFor="conn-name" className="font-semibold">
                  Name <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="conn-name"
                  placeholder="My Database"
                  value={form.name}
                  onChange={(e) => updateForm({ name: e.target.value })}
                  className="h-8 rounded-xl text-sm"
                />
              </Field>

              {/* Mode toggle */}
              <div className="inline-flex h-9 w-full rounded-xl border border-input bg-muted/40 p-0.5">
                <button
                  type="button"
                  onClick={() => switchMode("fields")}
                  className={cn(
                    "flex-1 rounded-lg text-sm font-medium transition-all",
                    inputMode === "fields"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Input Credentials
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("string")}
                  className={cn(
                    "flex-1 rounded-lg text-sm font-medium transition-all",
                    inputMode === "string"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Connection String
                </button>
              </div>

              {inputMode === "fields" ? (
                <FieldGroup>
                  {/* Host + Port */}
                  <div className="grid grid-cols-[1fr_88px] gap-3">
                    <Field>
                      <FieldLabel htmlFor="conn-host" className="font-semibold">Host</FieldLabel>
                      <Input
                        id="conn-host"
                        value={form.host}
                        onChange={(e) => updateForm({ host: e.target.value })}
                        className="h-8 rounded-xl text-sm"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="conn-port" className="font-semibold">Port</FieldLabel>
                      <Input
                        id="conn-port"
                        value={form.port}
                        onChange={(e) => updateForm({ port: e.target.value })}
                        className="h-8 rounded-xl text-sm"
                      />
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="conn-database" className="font-semibold">Database</FieldLabel>
                    <Input
                      id="conn-database"
                      value={form.database}
                      onChange={(e) => updateForm({ database: e.target.value })}
                      className="h-8 rounded-xl text-sm"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="conn-user" className="font-semibold">Username</FieldLabel>
                    <Input
                      id="conn-user"
                      value={form.user}
                      onChange={(e) => updateForm({ user: e.target.value })}
                      className="h-8 rounded-xl text-sm"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="conn-password" className="font-semibold">Password</FieldLabel>
                    <Input
                      id="conn-password"
                      type="password"
                      value={form.password}
                      onChange={(e) => updateForm({ password: e.target.value })}
                      className="h-8 rounded-xl text-sm"
                    />
                  </Field>

                  <Field orientation="horizontal">
                    <Checkbox
                      id="conn-ssl"
                      checked={form.ssl}
                      onChange={(e) =>
                        updateForm({ ssl: (e.target as HTMLInputElement).checked })
                      }
                    />
                    <FieldLabel htmlFor="conn-ssl" className="font-normal cursor-pointer">
                      Require SSL
                    </FieldLabel>
                  </Field>
                </FieldGroup>
              ) : (
                <Field>
                  <FieldLabel htmlFor="conn-string" className="font-semibold">Connection String</FieldLabel>
                  <textarea
                    id="conn-string"
                    rows={3}
                    spellCheck={false}
                    placeholder="postgresql://user:password@localhost:5432/mydb"
                    value={connString}
                    onChange={(e) => {
                      setConnString(e.target.value.replace(/[\r\n]+/g, '').trim());
                      resetTest();
                    }}
                    className="flex w-full rounded-xl border border-input bg-muted/60 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-none"
                  />
                  <FieldDescription>
                    postgresql://user:password@host:port/database
                  </FieldDescription>
                </Field>
              )}


            </FieldGroup>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-border flex items-center gap-3">
            {testResult === "success" ? (
              <Button
                onClick={handleSave}
                disabled={!form.name.trim()}
                className="w-36"
                title={!form.name.trim() ? "Name is required" : undefined}
              >
                Save & Connect
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={testing}
                  className="w-36"
                >
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {testing ? "Testing…" : "Test Connection"}
                </Button>
                {testResult === "error" && (
                  <span className="flex items-center gap-1.5 text-xs text-red-400 truncate">
                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                    {testMessage}
                  </span>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
