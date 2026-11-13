/**
 * 로컬 모의 서버: 실제 Worker 코드(app.ts)를 Node http 로 띄우고 SQLite(메모리/파일)에 연결한다. 외부 연결 없음.
 *   node backend/scripts/dev-server.ts            (포트 8787, 메모리 DB)
 *   PORT=8787 DB_FILE=/tmp/gona.db ALLOWED_ORIGINS=* ALLOW_TEST_GAMES=1 node backend/scripts/dev-server.ts
 */
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.ts';
import { createSqliteD1 } from '../src/node-sqlite-d1.ts';

const dir = fileURLToPath(new URL('../migrations', import.meta.url));
const db = createSqliteD1(dir, process.env.DB_FILE || ':memory:');
const handler = createApp({ DB: db, TOKEN_PEPPER: process.env.TOKEN_PEPPER || 'dev-only-pepper-change-me', ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || '*', ALLOW_TEST_GAMES: process.env.ALLOW_TEST_GAMES ?? '1', MIN_PARTICIPANTS: process.env.MIN_PARTICIPANTS });
const port = Number(process.env.PORT || 8787);
createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const body = Buffer.concat(chunks);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(',') : v);
  const r = await handler(new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : body }));
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(port, () => console.log(`mock ranking server on http://localhost:${port}  (test games: ${process.env.ALLOW_TEST_GAMES ?? '1'})`));
