// 계정 삭제: 로그인한 본인만 · 저장·세션·점수는 auth.users 삭제에 따라 cascade 로 함께 지워짐
import { cors, json, requireUser } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const u = await requireUser(req);
  if (u instanceof Response) return u;
  const b = await req.json().catch(() => ({}));
  if (b.confirm !== 'DELETE') return json({ error: 'confirm' }, 400);
  const { error } = await u.admin.auth.admin.deleteUser(u.userId);
  if (error) return json({ error: 'db' }, 500);
  return json({ deleted: true });
});
