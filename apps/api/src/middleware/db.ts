import type { Database } from '@nuit-one/db';
import { createDb } from '@nuit-one/db';
import { createMiddleware } from 'hono/factory';

declare module 'hono' {
  interface ContextVariableMap {
    db: Database;
  }
}

let _db: Database;

export const dbMiddleware = createMiddleware(async (c, next) => {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL environment variable is required');
    _db = createDb(url);
  }
  c.set('db', _db);
  await next();
});
