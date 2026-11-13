/** Cloudflare Workers 진입점 (배포하지 않음 — 승인 후 wrangler 로 배포) */
import { createApp } from './app.ts';
import type { Env } from './types.ts';

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    return createApp(env)(req);
  },
};
