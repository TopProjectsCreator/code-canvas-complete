declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }
  interface Database {
    run(sql: string): void;
    exec(sql: string): QueryResult[];
    export(): Uint8Array;
    close(): void;
  }
  interface QueryResult {
    columns: string[];
    values: any[][];
  }
  const initSqlJs: (config?: any) => Promise<SqlJsStatic>;
  export default initSqlJs;
}

declare module 'mammoth/mammoth.browser' {
  interface MammothOptions {
    arrayBuffer: ArrayBuffer;
  }
  interface MammothResult {
    value: string;
    messages: any[];
  }
  export function convertToHtml(options: MammothOptions): Promise<MammothResult>;
}

declare module 'hot-formula-parser' {
  interface ParserResult {
    result: any;
    error: string | null;
  }
  export class Parser {
    parse(expression: string): ParserResult;
    evaluate(expression: string): ParserResult;
  }
}
