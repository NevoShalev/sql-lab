import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";

export async function POST(req: NextRequest) {
  let body: { connectionString?: string; sql?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { connectionString, sql } = body;

  if (!connectionString) {
    return NextResponse.json(
      { error: "Missing connectionString" },
      { status: 400 }
    );
  }
  if (!sql || !sql.trim()) {
    return NextResponse.json({ error: "Missing SQL query" }, { status: 400 });
  }

  const client = new Client({ connectionString });

  try {
    await client.connect();
    const start = Date.now();
    const result = await client.query(sql);
    const duration = Date.now() - start;

    return NextResponse.json({
      rows: result.rows,
      fields: result.fields?.map((f) => ({
        name: f.name,
        dataTypeID: f.dataTypeID,
      })) ?? [],
      rowCount: result.rowCount ?? result.rows?.length ?? 0,
      duration,
    });
  } catch (err: unknown) {
    const pgErr = err as {
      message?: string;
      position?: string;
      detail?: string;
      hint?: string;
      where?: string;
    };
    return NextResponse.json(
      {
        error: pgErr.message ?? "Query failed",
        position: pgErr.position,
        detail: pgErr.detail,
        hint: pgErr.hint,
      },
      { status: 400 }
    );
  } finally {
    try {
      await client.end();
    } catch {
      // ignore cleanup errors
    }
  }
}
