/**
 * 온라인 랭킹 클라이언트 (Cloudflare Workers + D1 서버와 통신). **빌드에 VITE_RANKING_API 가 없으면 완전히 꺼져 있고(로컬 모드)**,
 * 서버가 없거나 끊겨도 앱의 모든 기능은 로컬로 동작한다. 다른 플레이어 순위는 서버 응답으로만 표시한다(가짜 순위 금지).
 *
 * 보안/정직한 원칙
 *  - 서버가 발급한 비밀 토큰은 이 기기의 localStorage(`gp.v1.online`)에만 있다. 공개 식별코드/playerId 와 별개이며 백업 파일에 넣지 않는다.
 *  - 온라인 기록은 **서버가 시작 시각을 직접 잰 세션**을 통해서만 제출한다. 이전에 쌓인 로컬 기록은 자동으로 올리지 않는다.
 *  - 제출 실패(오프라인·서버 오류)는 대기열(outbox)에 남겨 서버가 복구되면 같은 resultId 로 다시 보낸다(서버가 중복을 막음).
 */
import { ONLINE_KEYS } from '../platform/keys';
import type { KV, PlayerData } from '../platform/types';

export const ONLINE_API: string | null = ((import.meta.env.VITE_RANKING_API as string | undefined) || '').replace(/\/+$/, '') || null;

export interface OnlineIdentity {
  apiBase: string;
  playerId: string;
  /** 서버가 발급한 비밀 인증 토큰 — 화면·로그·백업에 노출하지 않음 */
  token: string;
  publicCode: string;
  /** 마지막으로 서버에 동기화한 프로필 스냅샷(변경 감지용) */
  synced?: string;
}
export interface OutboxItem {
  resultId: string;
  serverSessionId: string;
  body: Record<string, unknown>;
  tries: number;
  createdAt: number;
  nextAt: number;
}
export type OnlineStatus = 'off' | 'connecting' | 'online' | 'offline';

const MAX_OUTBOX = 50;
const MAX_TRIES = 12;

const readJson = <T,>(kv: KV, key: string): T | null => {
  try {
    const raw = kv.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const writeJson = (kv: KV, key: string, v: unknown): boolean => {
  try {
    kv.setItem(key, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
};

export class OnlineClient {
  status: OnlineStatus = 'connecting';
  constructor(private kv: KV, readonly base: string, private fetchImpl: typeof fetch = (...a) => fetch(...a), private now: () => number = Date.now, private timeoutMs = 6000) {}

  identity(): OnlineIdentity | null {
    const id = readJson<OnlineIdentity>(this.kv, ONLINE_KEYS.identity);
    return id && id.apiBase === this.base && typeof id.token === 'string' && typeof id.playerId === 'string' ? id : null;
  }
  outbox(): OutboxItem[] {
    const o = readJson<OutboxItem[]>(this.kv, ONLINE_KEYS.outbox);
    return Array.isArray(o) ? o.filter((x) => x && typeof x.resultId === 'string' && typeof x.serverSessionId === 'string') : [];
  }
  private saveOutbox(items: OutboxItem[]): void {
    if (!writeJson(this.kv, ONLINE_KEYS.outbox, items.slice(-MAX_OUTBOX))) this.status = 'offline';
  }

  private async req(method: string, path: string, body?: unknown, auth = true): Promise<{ status: number; json: Record<string, any> } | null> { // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      const id = auth ? this.identity() : null;
      const res = await this.fetchImpl(this.base + path, {
        method,
        headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(id ? { authorization: `Bearer ${id.token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      let json: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
      try {
        json = (await res.json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      } catch {
        /* 본문 없음 */
      }
      this.status = res.status >= 500 || res.status === 429 ? 'offline' : 'online';
      return { status: res.status, json };
    } catch {
      this.status = 'offline';
      return null;
    }
  }

  /** 처음 연결할 때 익명 플레이어를 등록한다(닉네임·아바타만 전송 — 개인정보 최소화). 이미 등록돼 있으면 그대로 */
  async ensureRegistered(player: PlayerData): Promise<OnlineIdentity | null> {
    const existing = this.identity();
    if (existing) return existing;
    const r = await this.req('POST', '/v1/players', { nickname: player.nickname, avatarId: player.avatarId }, false);
    if (!r || r.status !== 201) return null;
    const id: OnlineIdentity = { apiBase: this.base, playerId: String(r.json.playerId), token: String(r.json.token), publicCode: String(r.json.publicCode), synced: this.snapshot(player) };
    return writeJson(this.kv, ONLINE_KEYS.identity, id) ? id : null;
  }
  private snapshot = (p: PlayerData): string => JSON.stringify([p.nickname, p.avatarId, p.titleId]);

  /** 닉네임·아바타·칭호가 바뀌었으면 서버에 반영(기록은 서버 playerId 에 그대로 연결) */
  async syncProfile(player: PlayerData): Promise<void> {
    const id = this.identity();
    if (!id || id.synced === this.snapshot(player)) return;
    const r = await this.req('PATCH', '/v1/players/me', { nickname: player.nickname, avatarId: player.avatarId, titleId: player.titleId });
    if (r && r.status === 200) writeJson(this.kv, ONLINE_KEYS.identity, { ...id, synced: this.snapshot(player) });
  }

  /** PLAY 전에 서버 세션을 만든다(서버가 시작 시각을 잰다). 실패하면 null → 그 판은 로컬 기록만 */
  async createSession(gameId: string): Promise<string | null> {
    if (!this.identity()) return null;
    const r = await this.req('POST', '/v1/sessions', { gameId });
    return r && r.status === 201 ? String(r.json.sessionId) : null;
  }

  /** 제출 대기열에 넣는다(이미 있으면 무시). 실제 전송은 flush() */
  enqueue(item: Omit<OutboxItem, 'tries' | 'createdAt' | 'nextAt'>): void {
    const box = this.outbox();
    if (box.some((x) => x.resultId === item.resultId)) return;
    this.saveOutbox([...box, { ...item, tries: 0, createdAt: this.now(), nextAt: 0 }]);
  }

  /** 대기열 전송. 성공/영구 거부는 제거, 네트워크·서버 오류는 남겨 나중에 재시도(서버는 resultId 로 중복을 막음) */
  async flush(): Promise<{ sent: number; dropped: number; pending: number }> {
    let sent = 0;
    let dropped = 0;
    const keep: OutboxItem[] = [];
    for (const it of this.outbox()) {
      if (it.nextAt > this.now()) { keep.push(it); continue; }
      const r = await this.req('POST', `/v1/sessions/${it.serverSessionId}/finish`, it.body);
      if (r && r.status === 200) { sent += 1; continue; }
      const permanent = r && r.status >= 400 && r.status < 500 && r.status !== 429 && r.status !== 401; // 검증 실패 등은 다시 보내도 소용없음
      if (permanent || it.tries + 1 >= MAX_TRIES) { dropped += 1; continue; }
      keep.push({ ...it, tries: it.tries + 1, nextAt: this.now() + Math.min(3600_000, 30_000 * 2 ** it.tries) });
      if (!r) { // 오프라인이면 나머지는 지금 시도하지 않음
        const rest = this.outbox().slice(this.outbox().findIndex((x) => x.resultId === it.resultId) + 1);
        keep.push(...rest);
        break;
      }
    }
    this.saveOutbox(keep);
    return { sent, dropped, pending: keep.length };
  }
}
