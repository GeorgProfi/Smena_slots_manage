// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbResult<T = any> = { data: T | null; error: DbError | null; count?: number | null };

export class DbError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "DbError";
    this.code = code;
  }
}
