import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";
import { SchemaData } from "@/lib/types";

export async function POST(req: NextRequest) {
  let body: { connectionString?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { connectionString } = body;

  if (!connectionString) {
    return NextResponse.json(
      { error: "Missing connectionString" },
      { status: 400 }
    );
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();

    const [tablesResult, columnsResult] = await Promise.all([
      client.query(`
        SELECT table_schema, table_name, table_type
        FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          AND table_type IN ('BASE TABLE', 'VIEW')
        ORDER BY table_schema, table_name
      `),
      client.query(`
        SELECT
          c.table_schema,
          c.table_name,
          c.column_name,
          c.data_type,
          c.udt_name,
          c.is_nullable,
          c.column_default,
          c.ordinal_position
        FROM information_schema.columns c
        WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY c.table_schema, c.table_name, c.ordinal_position
      `),
    ]);

    const schema: SchemaData = {};

    for (const row of tablesResult.rows) {
      const { table_schema, table_name, table_type } = row;
      if (!schema[table_schema]) schema[table_schema] = {};
      schema[table_schema][table_name] = {
        type: table_type,
        columns: [],
      };
    }

    for (const row of columnsResult.rows) {
      const { table_schema, table_name, column_name, data_type, udt_name, is_nullable } = row;
      const resolvedType = data_type === "USER-DEFINED" ? udt_name : data_type;
      if (schema[table_schema]?.[table_name]) {
        schema[table_schema][table_name].columns.push({
          name: column_name,
          type: resolvedType,
          nullable: is_nullable === "YES",
        });
      }
    }

    return NextResponse.json({ schema });
  } catch (err: unknown) {
    const pgErr = err as { message?: string };
    return NextResponse.json(
      { error: pgErr.message ?? "Failed to fetch schema" },
      { status: 400 }
    );
  } finally {
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}
