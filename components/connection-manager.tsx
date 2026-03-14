"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  TestTube,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  const [form, setForm] = useState(defaultForm);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [testMessage, setTestMessage] = useState("");

  const activeConn = connections.find((c) => c.id === selectedConnectionId);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setTestMessage("");
    try {
      const connectionString = buildConnectionString(form);
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
    const connectionString = buildConnectionString(form);
    const conn: SavedConnection = {
      id: generateId(),
      name: form.name || `${form.user}@${form.host}/${form.database}`,
      host: form.host,
      port: Number(form.port),
      database: form.database,
      user: form.user,
      password: form.password,
      ssl: form.ssl,
      connectionString,
    };
    onConnectionsChange([...connections, conn]);
    onConnectionChange(conn);
    setDialogOpen(false);
    setForm(defaultForm);
    setTestResult(null);
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              New Connection
            </DialogTitle>
            <DialogDescription>
              Configure a PostgreSQL database connection.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-2">
            <FieldSet>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name">Display Name</FieldLabel>
                  <Input
                    id="name"
                    placeholder="My Database"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field className="col-span-2">
                    <FieldLabel htmlFor="host">Host</FieldLabel>
                    <Input
                      id="host"
                      value={form.host}
                      onChange={(e) => setForm({ ...form, host: e.target.value })}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="port">Port</FieldLabel>
                    <Input
                      id="port"
                      value={form.port}
                      onChange={(e) => setForm({ ...form, port: e.target.value })}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="database">Database</FieldLabel>
                  <Input
                    id="database"
                    value={form.database}
                    onChange={(e) => setForm({ ...form, database: e.target.value })}
                  />
                </Field>
              </FieldGroup>
            </FieldSet>

            <FieldSeparator />

            <FieldSet>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="user">Username</FieldLabel>
                  <Input
                    id="user"
                    value={form.user}
                    onChange={(e) => setForm({ ...form, user: e.target.value })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </Field>
                <Field orientation="horizontal">
                  <Checkbox
                    id="ssl"
                    checked={form.ssl}
                    onChange={(e) => setForm({ ...form, ssl: (e.target as HTMLInputElement).checked })}
                  />
                  <FieldLabel htmlFor="ssl" className="font-normal cursor-pointer">
                    Require SSL
                  </FieldLabel>
                </Field>
              </FieldGroup>
            </FieldSet>

            {testResult && (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm",
                  testResult === "success"
                    ? "bg-green-950 text-green-400"
                    : "bg-red-950 text-red-400"
                )}
              >
                {testResult === "success" ? (
                  <CheckCircle className="h-4 w-4 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0" />
                )}
                <span className="truncate">{testMessage}</span>
              </div>
            )}
          </FieldGroup>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4" />
              )}
              Test
            </Button>
            <Button onClick={handleSave}>
              Save & Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
