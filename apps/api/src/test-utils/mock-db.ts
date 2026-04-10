import { createMiddleware } from 'hono/factory';
import { vi } from 'vitest';

export interface MockDbOverrides {
  /** Override return value for `db.query.<table>.findFirst()` */
  findFirst?: unknown;
  /** Override return value for `db.query.<table>.findMany()` */
  findMany?: unknown;
  /** Override return value for `db.select().from().where()...` chains */
  selectChain?: unknown;
  /** Override return value for `db.insert().values().returning()` chains */
  insertReturning?: unknown;
  /** Override return value for `db.insert().values()` (no returning) */
  insertPlain?: unknown;
  /** Override return value for `db.update().set().where()` chains */
  updateChain?: unknown;
}

/**
 * Creates a mock Database object that satisfies the Drizzle query patterns
 * used in Nuit One API routes without requiring a real database connection.
 *
 * Query patterns mocked:
 *  - db.query.<table>.findFirst({ where })      -> null (or overrides.findFirst)
 *  - db.query.<table>.findMany({ where })        -> []   (or overrides.findMany)
 *  - db.select().from(t).where(w).orderBy(o)     -> []   (or overrides.selectChain)
 *  - db.insert(t).values(v).returning()           -> [{ id: 'mock-id' }] (or overrides.insertReturning)
 *  - db.insert(t).values(v)                       -> undefined (or overrides.insertPlain)
 *  - db.update(t).set(s).where(w)                 -> undefined (or overrides.updateChain)
 */
export function createMockDb(overrides: MockDbOverrides = {}) {
  const findFirstResult = overrides.findFirst ?? null;
  const findManyResult = overrides.findMany ?? [];
  const selectChainResult = overrides.selectChain ?? [];
  const insertReturningResult = overrides.insertReturning ?? [{ id: 'mock-id' }];
  const insertPlainResult = overrides.insertPlain ?? undefined;
  const updateChainResult = overrides.updateChain ?? undefined;

  // db.query.<table>.findFirst / findMany
  const queryTableHandler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'findFirst') return vi.fn().mockResolvedValue(findFirstResult);
      if (prop === 'findMany') return vi.fn().mockResolvedValue(findManyResult);
      return vi.fn();
    },
  };

  const queryProxy = new Proxy(
    {},
    {
      get() {
        // Any table name (tracks, stems, performances, etc.) returns a proxy with findFirst/findMany
        return new Proxy({}, queryTableHandler);
      },
    },
  );

  // db.select().from(table).where(cond).orderBy(col) -> selectChainResult
  const selectFn = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn().mockResolvedValue(selectChainResult),
        // If .where() is awaited directly (no orderBy)
        // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock for Drizzle ORM
        then: (resolve: (v: unknown) => void) => resolve(selectChainResult),
      })),
      // If .from() is awaited directly
      // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock for Drizzle ORM
      then: (resolve: (v: unknown) => void) => resolve(selectChainResult),
    })),
  }));

  // db.insert(table).values(data).returning() -> insertReturningResult
  // db.insert(table).values(data) -> insertPlainResult
  const insertFn = vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn().mockResolvedValue(insertReturningResult),
      // If awaited without .returning()
      // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock for Drizzle ORM
      then: insertPlainResult !== undefined ? (resolve: (v: unknown) => void) => resolve(insertPlainResult) : undefined,
    })),
  }));

  // db.update(table).set(data).where(cond) -> updateChainResult
  const updateFn = vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(updateChainResult),
      // If .set() is awaited directly
      // biome-ignore lint/suspicious/noThenProperty: intentional thenable mock for Drizzle ORM
      then: (resolve: (v: unknown) => void) => resolve(updateChainResult),
    })),
  }));

  return {
    query: queryProxy,
    select: selectFn,
    insert: insertFn,
    update: updateFn,
  };
}

/**
 * Hono middleware that injects a mock DB into `c.set('db', mockDb)`.
 * Use in test app setup to decouple route handlers from a real database.
 *
 * @example
 * ```ts
 * const app = new Hono();
 * app.use('/*', createMockDbMiddleware());
 * app.route('/', myRoutes);
 * ```
 */
export function createMockDbMiddleware(overrides: MockDbOverrides = {}) {
  const mockDb = createMockDb(overrides);
  return createMiddleware(async (c, next) => {
    c.set('db', mockDb as never);
    await next();
  });
}
