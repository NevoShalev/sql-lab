export interface SavedConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  connectionString: string;
}

export interface QueryField {
  name: string;
  dataTypeID: number;
}

export interface QueryResult {
  id: string;
  sql: string;
  rows: Record<string, unknown>[];
  fields: QueryField[];
  rowCount: number;
  duration: number;
  timestamp: Date;
  error?: string;
  errorPosition?: number;
  errorDetail?: string;
  errorHint?: string;
}

export interface QueryTab {
  id: string;
  name: string;
  sql: string;
  connectionId?: string;
  showAggregate?: boolean;
  aggregateView?: "table" | "bar" | "pie";
}

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
}

export interface SchemaTable {
  type: string;
  columns: SchemaColumn[];
}

export type SchemaData = Record<string, Record<string, SchemaTable>>;
