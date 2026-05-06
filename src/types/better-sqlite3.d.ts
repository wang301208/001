declare module "better-sqlite3" {
  type Statement = {
    run: (...params: unknown[]) => unknown;
    get: (...params: unknown[]) => unknown;
    all: (...params: unknown[]) => unknown[];
  };

  class Database {
    constructor(filename: string);
    pragma(source: string): unknown;
    exec(source: string): unknown;
    prepare(source: string): Statement;
    close(): void;
  }

  export default Database;
}
