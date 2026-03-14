"use client";

import { useRef, useCallback, useEffect, memo } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { SchemaData } from "@/lib/types";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-background text-muted-foreground text-sm">
      <Loader2 className="h-4 w-4 animate-spin mr-2" />
      Loading editor...
    </div>
  ),
});

const EDITOR_THEME = "sql-lab-dark";

// Module-level ref so the completion provider always reads current schema
let _schemaRef: SchemaData | null = null;
let _completionDisposable: { dispose: () => void } | null = null;

const SQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "IN", "EXISTS",
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
  "CREATE", "ALTER", "DROP", "TABLE", "VIEW", "INDEX",
  "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "OUTER", "CROSS", "ON",
  "GROUP", "BY", "ORDER", "ASC", "DESC", "HAVING",
  "LIMIT", "OFFSET", "DISTINCT", "AS", "CASE", "WHEN", "THEN", "ELSE", "END",
  "NULL", "IS", "LIKE", "ILIKE", "BETWEEN", "UNION", "ALL", "INTERSECT", "EXCEPT",
  "COUNT", "SUM", "AVG", "MIN", "MAX", "COALESCE", "NULLIF", "CAST",
  "TRUE", "FALSE", "DEFAULT", "PRIMARY", "KEY", "FOREIGN", "REFERENCES",
  "CONSTRAINT", "UNIQUE", "CHECK", "WITH", "RECURSIVE", "RETURNING",
  "BEGIN", "COMMIT", "ROLLBACK", "TRANSACTION", "EXPLAIN", "ANALYZE",
  "GRANT", "REVOKE", "TRUNCATE", "CASCADE", "RESTRICT",
];

// Keywords after which we should suggest table names
const TABLE_CONTEXT_KEYWORDS = new Set([
  "FROM", "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "CROSS",
  "INTO", "UPDATE", "TABLE", "TRUNCATE",
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function registerCompletionProvider(monaco: any) {
  // Dispose previous if exists
  _completionDisposable?.dispose();

  _completionDisposable = monaco.languages.registerCompletionItemProvider("sql", {
    triggerCharacters: [".", " "],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provideCompletionItems(model: any, position: any) {
      const schema = _schemaRef;
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      // Get the text before cursor to detect context
      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);

      // Check if we're after a dot (schema.table or table.column)
      const dotMatch = textBeforeCursor.match(/(\w+)\.\s*$/);
      if (dotMatch) {
        const prefix = dotMatch[1].toLowerCase();
        const suggestions: unknown[] = [];

        if (schema) {
          // Check if prefix is a schema name → suggest tables
          for (const [schemaName, tables] of Object.entries(schema)) {
            if (schemaName.toLowerCase() === prefix) {
              for (const [tableName, table] of Object.entries(tables)) {
                suggestions.push({
                  label: tableName,
                  kind: table.type === "VIEW"
                    ? monaco.languages.CompletionItemKind.Interface
                    : monaco.languages.CompletionItemKind.Class,
                  detail: table.type === "VIEW" ? "view" : "table",
                  insertText: tableName,
                  range,
                });
              }
            }
          }

          // Check if prefix is a table name → suggest columns
          for (const tables of Object.values(schema)) {
            for (const [tableName, table] of Object.entries(tables)) {
              if (tableName.toLowerCase() === prefix) {
                for (const col of table.columns) {
                  suggestions.push({
                    label: col.name,
                    kind: monaco.languages.CompletionItemKind.Field,
                    detail: `${col.type}${col.nullable ? " (nullable)" : ""}`,
                    insertText: col.name,
                    range,
                  });
                }
              }
            }
          }
        }

        return { suggestions };
      }

      // Detect if we're in a "table context" (after FROM, JOIN, etc.)
      const upperText = textBeforeCursor.toUpperCase().trim();
      const lastKeyword = upperText.split(/\s+/).pop() || "";
      const isTableContext = TABLE_CONTEXT_KEYWORDS.has(lastKeyword);

      const suggestions: unknown[] = [];

      // SQL keywords (lower priority in table context)
      for (const kw of SQL_KEYWORDS) {
        suggestions.push({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          range,
          sortText: isTableContext ? "3_" + kw : "1_" + kw,
        });
      }

      if (schema) {
        // Schema names
        for (const schemaName of Object.keys(schema)) {
          suggestions.push({
            label: schemaName,
            kind: monaco.languages.CompletionItemKind.Module,
            detail: "schema",
            insertText: schemaName,
            range,
            sortText: isTableContext ? "0_" + schemaName : "2_" + schemaName,
          });
        }

        // Table/view names (with and without schema qualification)
        for (const [schemaName, tables] of Object.entries(schema)) {
          for (const [tableName, table] of Object.entries(tables)) {
            const isView = table.type === "VIEW";
            const kind = isView
              ? monaco.languages.CompletionItemKind.Interface
              : monaco.languages.CompletionItemKind.Class;
            const detail = `${schemaName} · ${isView ? "view" : "table"}`;

            // Unqualified table name
            suggestions.push({
              label: tableName,
              kind,
              detail,
              insertText: tableName,
              range,
              sortText: isTableContext ? "1_" + tableName : "2_" + tableName,
            });

            // Schema-qualified name (schema.table)
            if (schemaName !== "public") {
              suggestions.push({
                label: `${schemaName}.${tableName}`,
                kind,
                detail: isView ? "view" : "table",
                insertText: `${schemaName}.${tableName}`,
                range,
                sortText: isTableContext ? "1_" + schemaName + "." + tableName : "2_" + schemaName + "." + tableName,
              });
            }

            // Column names (lower priority in table context)
            if (!isTableContext) {
              for (const col of table.columns) {
                suggestions.push({
                  label: col.name,
                  kind: monaco.languages.CompletionItemKind.Field,
                  detail: `${tableName}.${col.name} · ${col.type}`,
                  insertText: col.name,
                  range,
                  sortText: "2_" + col.name,
                });
              }
            }
          }
        }
      }

      // Deduplicate by label
      const seen = new Set<string>();
      const deduped = suggestions.filter((s) => {
        const label = (s as { label: string }).label;
        if (seen.has(label)) return false;
        seen.add(label);
        return true;
      });

      return { suggestions: deduped };
    },
  });
}

function defineSqlLabDarkTheme(monaco: { editor: { defineTheme: (name: string, data: unknown) => void } }) {
  monaco.editor.defineTheme(EDITOR_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword",           foreground: "569cd6", fontStyle: "bold" },
      { token: "keyword.sql",       foreground: "569cd6", fontStyle: "bold" },
      { token: "operator.sql",      foreground: "569cd6" },
      { token: "string",            foreground: "ce9178" },
      { token: "string.sql",        foreground: "ce9178" },
      { token: "string.escape.sql", foreground: "d7ba7d" },
      { token: "comment",           foreground: "57a64a", fontStyle: "italic" },
      { token: "comment.sql",       foreground: "57a64a", fontStyle: "italic" },
      { token: "number",            foreground: "b5cea8" },
      { token: "number.sql",        foreground: "b5cea8" },
      { token: "predefined",        foreground: "4ec9b0" },
      { token: "predefined.sql",    foreground: "4ec9b0" },
      { token: "type",              foreground: "4ec9b0" },
      { token: "delimiter",         foreground: "808080" },
      { token: "identifier",        foreground: "d4d4d4" },
    ],
    colors: {
      "editor.background": "#141414",
      "editor.foreground": "#d4d4d4",
      "editorLineNumber.foreground": "#3d3d3d",
      "editorLineNumber.activeForeground": "#858585",
      "editorCursor.foreground": "#d4d4d4",
      "editor.selectionBackground": "#264f7866",
      "editor.inactiveSelectionBackground": "#26303a66",
      "editor.lineHighlightBackground": "#1e1e1e",
      "editorWidget.background": "#1e1e1e",
      "editorWidget.border": "#2a2a2a",
      "editorIndentGuide.background1": "#2a2a2a",
      "editorIndentGuide.activeBackground1": "#404040",
      "editorSuggestWidget.background": "#1e1e1e",
      "editorSuggestWidget.border": "#2a2a2a",
      "editorSuggestWidget.selectedBackground": "#264f78",
    },
  });
}

interface SqlEditorProps {
  sql: string;
  isRunning: boolean;
  schema: SchemaData | null;
  onSqlChange: (sql: string) => void;
  onRunQuery: (sql: string) => void;
}

export const SqlEditor = memo(function SqlEditor({ sql, isRunning, schema, onSqlChange, onRunQuery }: SqlEditorProps) {
  const editorRef = useRef<unknown>(null);

  // Keep module-level schema ref in sync
  useEffect(() => {
    _schemaRef = schema;
  }, [schema]);

  // Use refs for the keyboard shortcut so the closure never goes stale
  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;
  const sqlRef = useRef(sql);
  sqlRef.current = sql;
  const onRunQueryRef = useRef(onRunQuery);
  onRunQueryRef.current = onRunQuery;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBeforeMount = useCallback((monaco: any) => {
    defineSqlLabDarkTheme(monaco);
    registerCompletionProvider(monaco);
  }, []);

  const handleEditorDidMount = useCallback((editor: unknown) => {
    editorRef.current = editor;
    const editorInstance = editor as {
      addCommand: (keybinding: number, handler: () => void) => void;
    };
    // ⌘+Enter — reads from refs so it's always current
    editorInstance.addCommand(2048 | 3, () => {
      if (isRunningRef.current) return;
      const ed = editorRef.current as {
        getSelection: () => unknown;
        getModel: () => { getValueInRange: (sel: unknown) => string };
        getValue: () => string;
      } | null;
      if (ed) {
        const selection = ed.getSelection();
        const model = ed.getModel();
        const selectedText = model?.getValueInRange(
          selection as Parameters<typeof model.getValueInRange>[0]
        );
        const query = selectedText?.trim() || ed.getValue();
        if (query) onRunQueryRef.current(query);
      } else if (sqlRef.current) {
        onRunQueryRef.current(sqlRef.current);
      }
    });
  }, []);

  return (
    <div className="h-full bg-background">
      <MonacoEditor
        height="100%"
        language="sql"
        theme={EDITOR_THEME}
        value={sql}
        onChange={(value) => onSqlChange(value ?? "")}
        beforeMount={handleBeforeMount}
        onMount={handleEditorDidMount}
        options={{
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          fontLigatures: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: "off",
          lineNumbers: "on",
          lineNumbersMinChars: 3,
          renderLineHighlight: "line",
          cursorBlinking: "smooth",
          smoothScrolling: true,
          padding: { top: 12, bottom: 12 },
          tabSize: 2,
          insertSpaces: true,
          folding: true,
          automaticLayout: true,
          quickSuggestions: { strings: false, comments: false, other: true },
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnEnter: "smart",
          bracketPairColorization: { enabled: true },
          accessibilitySupport: "off",
        }}
      />
    </div>
  );
});
