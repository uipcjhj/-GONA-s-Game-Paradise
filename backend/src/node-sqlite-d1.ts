/**
 * 로컬 테스트/개발용 D1 에뮬레이터 — Node 내장 SQLite(node:sqlite, 실험적)로 D1 과 같은 호출 모양(prepare/bind/first/all/run/batch)을 흉내 낸다.
 * 실제 migrations/*.sql 을 그대로 실행하므로 스키마·쿼리를 실제 DB 없이 검증할 수 있다. Cloudflare 와 무관하다.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { D1Like, D1Stmt } from './types.ts';

export function createSqliteD1(migrationsDir: string, file = ':memory:'): D1Like & { raw: DatabaseSync } {
  const db = new DatabaseSync(file);
  for (const f of readdirSync(migrationsDir).filter((x) => x.endsWith('.sql')).sort()) db.exec(readFileSync(`${migrationsDir}/${f}`, 'utf8'));
  const mk = (sql: string, args: unknown[] = []): D1Stmt => ({
    bind: (...v: unknown[]) => mk(sql, v),
    first: async <T>() => ((db.prepare(sql).get(...(args as never[])) as T | undefined) ?? null),
    all: async <T>() => ({ results: db.prepare(sql).all(...(args as never[])) as T[] }),
    run: async () => {
      const r = db.prepare(sql).run(...(args as never[]));
      return { meta: { changes: Number(r.changes) } };
    },
  });
  return {
    raw: db,
    prepare: (sql) => mk(sql),
    // D1 batch 는 하나의 트랜잭션 — 하나라도 실패하면 모두 롤백
    batch: async (stmts) => {
      db.exec('BEGIN');
      try {
        const out: unknown[] = [];
        for (const s of stmts) out.push(await s.run());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    exec: async (sql) => db.exec(sql),
  };
}
