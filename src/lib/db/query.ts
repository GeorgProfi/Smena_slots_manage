import { query as runQuery } from "./pool";
import { DbError, type DbResult } from "./types";

const ALLOWED_TABLES = new Set([
  "profiles",
  "events",
  "sub_shifts",
  "shift_assignments",
  "swap_requests",
  "audit_logs",
  "organization_settings",
  "user_preferences",
  "user_notification_preferences",
  "auth_users",
]);

type Filter =
  | { op: "eq"; col: string; val: unknown }
  | { op: "neq"; col: string; val: unknown }
  | { op: "in"; col: string; vals: unknown[] }
  | { op: "not"; col: string; val: unknown };

type OrderBy = { column: string; ascending: boolean };

type SelectOptions = { count?: "exact"; head?: boolean };

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new DbError(`Invalid identifier: ${name}`);
  }
  return `"${name}"`;
}

function parseColumns(select: string): string {
  const trimmed = select.trim();
  if (trimmed === "*") {
    return "*";
  }
  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.map((p) => {
    const base = p.split("(")[0]?.trim() ?? p;
    if (base === "*") return "*";
    return quoteIdent(base);
  }).join(", ");
}

export class TableQuery {
  private table: string;
  private filters: Filter[] = [];
  private orderBy: OrderBy | null = null;
  private limitOne = false;
  private rowLimit: number | null = null;
  private selectOpts: SelectOptions | null = null;
  private pendingColumns = "*";
  private pendingInsert: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private pendingUpdate: Record<string, unknown> | null = null;
  private pendingDelete = false;
  private pendingUpsert: { row: Record<string, unknown>; onConflict: string } | null = null;
  private returnColumns: string | null = null;

  constructor(table: string) {
    if (!ALLOWED_TABLES.has(table)) {
      throw new DbError(`Table not allowed: ${table}`);
    }
    this.table = table;
  }

  select(columns = "*", options?: SelectOptions) {
    if (this.pendingInsert || this.pendingUpdate || this.pendingUpsert) {
      this.returnColumns = columns;
    } else {
      this.pendingColumns = columns;
      this.selectOpts = options ?? null;
    }
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ op: "eq", col: column, val: value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ op: "neq", col: column, val: value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ op: "in", col: column, vals: values });
    return this;
  }

  not(column: string, _op: string, value: unknown) {
    this.filters.push({ op: "not", col: column, val: value });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: opts?.ascending !== false };
    return this;
  }

  limit(n: number) {
    this.rowLimit = n;
    return this;
  }

  single() {
    this.limitOne = true;
    return this;
  }

  maybeSingle() {
    this.limitOne = true;
    return this;
  }

  insert(row: Record<string, unknown> | Record<string, unknown>[]) {
    this.pendingInsert = row;
    return this;
  }

  update(row: Record<string, unknown>) {
    this.pendingUpdate = row;
    return this;
  }

  delete() {
    this.pendingDelete = true;
    return this;
  }

  upsert(row: Record<string, unknown>, opts: { onConflict: string }) {
    this.pendingUpsert = { row, onConflict: opts.onConflict };
    return this;
  }

  private buildWhere(startIdx: number): { sql: string; params: unknown[] } {
    const params: unknown[] = [];
    const clauses: string[] = [];
    let idx = startIdx;

    for (const f of this.filters) {
      const col = quoteIdent(f.col);
      if (f.op === "eq") {
        clauses.push(`${col} = $${idx++}`);
        params.push(f.val);
      } else if (f.op === "neq") {
        clauses.push(`${col} <> $${idx++}`);
        params.push(f.val);
      } else if (f.op === "in") {
        if (!f.vals.length) {
          clauses.push("FALSE");
        } else {
          clauses.push(`${col} = ANY($${idx++})`);
          params.push(f.vals);
        }
      } else if (f.op === "not") {
        if (f.val === null) {
          clauses.push(`${col} IS NOT NULL`);
        } else {
          clauses.push(`${col} IS NOT $${idx++}`);
          params.push(f.val);
        }
      }
    }

    const sql = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    return { sql, params };
  }

  async then<TResult1 = DbResult, TResult2 = never>(
    onfulfilled?: ((value: DbResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    try {
      const value = await this.execute();
      return onfulfilled ? onfulfilled(value) : (value as TResult1);
    } catch (reason) {
      if (onrejected) {
        return onrejected(reason);
      }
      throw reason;
    }
  }

  async execute(): Promise<DbResult> {
    const table = quoteIdent(this.table);

    try {
      if (this.pendingDelete) {
        const start = 1;
        const { sql: whereSql, params } = this.buildWhere(start);
        const { rowCount } = await runQuery(`DELETE FROM ${table}${whereSql}`, params);
        return { data: null, error: null, count: rowCount };
      }

      if (this.pendingUpsert) {
        const { row, onConflict } = this.pendingUpsert;
        const cols = Object.keys(row);
        const vals = Object.values(row);
        const colList = cols.map(quoteIdent).join(", ");
        const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
        const updates = cols
          .filter((c) => c !== onConflict)
          .map((c) => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`)
          .join(", ");
        const returning = this.returnColumns ?? this.pendingColumns;
        const sql = `INSERT INTO ${table} (${colList}) VALUES (${placeholders})
          ON CONFLICT (${quoteIdent(onConflict)}) DO UPDATE SET ${updates}
          RETURNING ${parseColumns(returning)}`;
        const { rows } = await runQuery(sql, vals);
        const data = this.limitOne ? rows[0] ?? null : rows;
        return { data, error: null };
      }

      if (this.pendingInsert) {
        const rows = Array.isArray(this.pendingInsert) ? this.pendingInsert : [this.pendingInsert];
        if (!rows.length) {
          return { data: [], error: null };
        }
        const cols = Object.keys(rows[0]);
        const colList = cols.map(quoteIdent).join(", ");
        const allParams: unknown[] = [];
        const valueGroups: string[] = [];
        let idx = 1;
        for (const row of rows) {
          const vals = cols.map((c) => row[c]);
          valueGroups.push(`(${vals.map(() => `$${idx++}`).join(", ")})`);
          allParams.push(...vals);
        }
        const returning = this.returnColumns ?? this.pendingColumns;
        const sql = `INSERT INTO ${table} (${colList}) VALUES ${valueGroups.join(", ")} RETURNING ${parseColumns(returning)}`;
        const { rows: inserted } = await runQuery(sql, allParams);
        const data = this.limitOne ? inserted[0] ?? null : inserted;
        return { data, error: null };
      }

      if (this.pendingUpdate) {
        const cols = Object.keys(this.pendingUpdate);
        const setParts: string[] = [];
        const params: unknown[] = [];
        let idx = 1;
        for (const c of cols) {
          setParts.push(`${quoteIdent(c)} = $${idx++}`);
          params.push(this.pendingUpdate[c]);
        }
        const { sql: whereSql, params: whereParams } = this.buildWhere(idx);
        params.push(...whereParams);
        const returning = this.returnColumns ?? this.pendingColumns;
        const sql = `UPDATE ${table} SET ${setParts.join(", ")}${whereSql} RETURNING ${parseColumns(returning)}`;
        const { rows } = await runQuery(sql, params);
        const data = this.limitOne ? rows[0] ?? null : rows;
        return { data, error: null };
      }

      if (this.selectOpts?.head && this.selectOpts.count === "exact") {
        const { sql: whereSql, params } = this.buildWhere(1);
        const { rows: countRows } = await runQuery<{ c: number }>(
          `SELECT COUNT(*)::int AS c FROM ${table}${whereSql}`,
          params
        );
        return { data: null, error: null, count: countRows[0]?.c ?? 0 };
      }

      const columns = parseColumns(this.pendingColumns);
      const { sql: whereSql, params } = this.buildWhere(1);
      let sql = `SELECT ${columns} FROM ${table}${whereSql}`;
      if (this.orderBy) {
        sql += ` ORDER BY ${quoteIdent(this.orderBy.column)} ${this.orderBy.ascending ? "ASC" : "DESC"}`;
      }
      if (this.limitOne) {
        sql += " LIMIT 1";
      } else if (this.rowLimit !== null) {
        sql += ` LIMIT ${this.rowLimit}`;
      }
      const { rows } = await runQuery(sql, params);
      const data = this.limitOne ? rows[0] ?? null : rows;
      return { data, error: null };
    } catch (e: unknown) {
      const err = e as { message?: string; code?: string };
      return {
        data: null,
        error: new DbError(err.message ?? "Database error", err.code),
      };
    }
  }
}

export function from(table: string) {
  return new TableQuery(table);
}

export function asRows<T>(data: unknown): T[] {
  return (Array.isArray(data) ? data : []) as T[];
}
