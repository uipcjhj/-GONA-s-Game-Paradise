/**
 * 온라인 계정 · 클라우드 저장 · 공유 랭킹 (Supabase · 패키지 없이 REST)
 *
 *  - 빌드할 때 VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY 가 있어야 켜짐 (없으면 ONLINE=false → 게스트·로컬 저장만)
 *  - 계정은 '지금 고른 모험가(프로필)' 하나에만 연결 — 다른 프로필 기록과 섞지 않음 (닉네임이 같아도)
 *  - 저장은 rev(버전)로 충돌 감지: 다른 기기가 먼저 저장했으면 받아서 mergeBundle 후 다시 저장 (덮어쓰기 금지)
 *  - 점수는 서버(Edge Function)가 세션·시간·보너스를 다시 계산해 통과한 것만 공식 랭킹
 *  - 설정 방법: docs/sky-online/SETUP.md
 */
import { NS } from './ns';
import { activeProfile, profileKey } from './profile';
import { backupBeforeLogin, mergeBundle, type SaveBundle } from './sync';
import type { Difficulty } from './stages';
import type { FamilyId } from './engine';
import type { Rank } from './rank';

const URL_ = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const KEY_ = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';
/** 서버 설정이 들어간 빌드인지 */
export const ONLINE = !!(URL_ && KEY_);
const SESSION_KEY = `${NS}.online`;

interface Session { access: string; refresh: string; exp: number; userId: string; email: string; profileId: string; rev: number }
function getSession(): Session | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as Session | null; } catch { return null; }
}
function setSession(s: Session | null): void {
  try { if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY); } catch { /* 무시 */ }
}
/** 지금 모험가에 연결된 계정 (다른 모험가로 바꾸면 연결 안 된 것으로 봄) */
export function account(): { email: string } | null {
  const s = getSession();
  const p = activeProfile();
  return s && p && s.profileId === p.id ? { email: s.email } : null;
}

async function req(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<Response> {
  const h: Record<string, string> = { apikey: KEY_, 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) };
  if (init.auth) {
    const s = await fresh();
    if (!s) throw new Error('로그인이 필요해요');
    h.Authorization = `Bearer ${s.access}`;
  }
  return fetch(`${URL_}${path}`, { ...init, headers: h });
}
/** 토큰이 곧 끝나면 새로 받음 */
async function fresh(): Promise<Session | null> {
  const s = getSession();
  if (!s) return null;
  if (Date.now() < s.exp - 60_000) return s;
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: KEY_, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: s.refresh }) });
  if (!r.ok) { setSession(null); return null; }
  const j = await r.json();
  const n = { ...s, access: j.access_token, refresh: j.refresh_token, exp: Date.now() + j.expires_in * 1000 };
  setSession(n);
  return n;
}

// ───────── 계정 ─────────
export async function signUp(email: string, password: string): Promise<string> {
  const r = await req('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return j.msg ?? j.error_description ?? '가입하지 못했어요';
  if (!j.access_token) return '메일함의 확인 링크를 누른 뒤 로그인해 주세요';
  await afterLogin(j, email);
  return '';
}
export async function signIn(email: string, password: string): Promise<string> {
  const r = await req('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return j.error_description ?? j.msg ?? '로그인하지 못했어요';
  await afterLogin(j, email);
  return '';
}
async function afterLogin(j: { access_token: string; refresh_token: string; expires_in: number; user: { id: string } }, email: string): Promise<void> {
  const p = activeProfile();
  backupBeforeLogin(); // 처음 로그인 전 기기 기록을 따로 보관
  setSession({ access: j.access_token, refresh: j.refresh_token, exp: Date.now() + j.expires_in * 1000, userId: j.user.id, email, profileId: p?.id ?? '', rev: 0 });
  await req('/rest/v1/sky_players', { method: 'POST', auth: true, headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ user_id: j.user.id, nickname: (p?.nick ?? '모험가').slice(0, 10) }) });
  await sync();
}
export async function signOut(): Promise<void> {
  try { await req('/auth/v1/logout', { method: 'POST', auth: true }); } catch { /* 무시 */ }
  setSession(null); // 기기 기록은 그대로 둠
}
export async function deleteAccount(): Promise<string> {
  const r = await req('/functions/v1/delete-account', { method: 'POST', auth: true, body: JSON.stringify({ confirm: 'DELETE' }) });
  if (!r.ok) return '계정을 지우지 못했어요';
  setSession(null);
  return '';
}
export async function setNickname(nick: string): Promise<void> {
  const s = getSession();
  if (!s) return;
  await req(`/rest/v1/sky_players?user_id=eq.${s.userId}`, { method: 'PATCH', auth: true, body: JSON.stringify({ nickname: nick.slice(0, 10), updated_at: new Date().toISOString() }) });
}

// ───────── 클라우드 저장 ─────────
const DATA = { rec2: `${NS}.rec2`, records: `${NS}.records` };
function localBundle(): SaveBundle {
  const rd = (k: string) => { try { return JSON.parse(localStorage.getItem(profileKey(k)) ?? 'null'); } catch { return null; } };
  return { schema: 3, rec2: rd(DATA.rec2), records: rd(DATA.records) };
}
function writeLocal(b: SaveBundle): void {
  if (b.rec2) localStorage.setItem(profileKey(DATA.rec2), JSON.stringify(b.rec2));
  if (b.records) localStorage.setItem(profileKey(DATA.records), JSON.stringify(b.records));
}
/** 받기 → 병합 → 기기에 저장 → 올리기 (충돌이면 최대 3번 다시) · 실패해도 기기 기록은 그대로 */
export async function sync(): Promise<string> {
  if (!account()) return '로그인한 모험가가 아니에요';
  for (let i = 0; i < 3; i++) {
    const r = await req('/rest/v1/sky_saves?select=bundle,rev', { auth: true });
    if (!r.ok) return '서버에 닿지 않아요 (기기 기록은 안전해요)';
    const rows = (await r.json()) as { bundle: SaveBundle; rev: number }[];
    const remote = rows[0] ?? null;
    const merged = mergeBundle(localBundle(), remote?.bundle ?? null);
    writeLocal(merged);
    const put = await req('/rest/v1/rpc/sky_save_put', { method: 'POST', auth: true, body: JSON.stringify({ p_bundle: merged, p_rev: remote?.rev ?? 0 }) });
    const rev = put.ok ? Number(await put.json()) : -1;
    if (rev > 0) { const s = getSession(); if (s) setSession({ ...s, rev }); return ''; }
  }
  return '다른 기기와 동시에 저장 중이라 잠시 뒤 다시 시도해 주세요';
}

// ───────── 랭킹 ─────────
export interface StageReport { stage: number; time: number; hits: number; bombsUsed: number; bombsLeft: number; hp: number; maxCombo: number; partsBroken: number; partsTotal: number; stageScore: number; rank: Rank }
let play: { session: string; stages: StageReport[]; total: number } | null = null;
/** 출격할 때 (로그인했으면) 서버 세션 받기 — 실패해도 게임은 그대로 */
export async function startPlay(mode: 'story' | 'hunt' | 'daily', stage: number, diff: Difficulty, fam: FamilyId, date?: string): Promise<void> {
  play = null;
  if (!ONLINE || !account()) return;
  try {
    const r = await req('/functions/v1/start-play', { method: 'POST', auth: true, body: JSON.stringify({ mode, stage, diff, fam, date }) });
    if (r.ok) play = { session: (await r.json()).session, stages: [], total: 0 };
  } catch { /* 오프라인 */ }
}
/** 스테이지 클리어 보고 (stageTotal = 그 스테이지 점수 + 보너스) */
export function reportStage(s: StageReport, stageTotal: number): void { if (play) { play.stages.push(s); play.total += stageTotal; } }
export function hasPlay(): boolean { return !!play; }
/** 이어하기를 쓰면 점수가 0부터 다시 → 그 판은 온라인 제출하지 않음 */
export function voidPlay(): void { play = null; }
export async function submitPlay(): Promise<{ verified: boolean; place?: number; reason?: string } | null> {
  const p = play;
  play = null;
  if (!p || !p.stages.length) return null;
  try {
    const r = await req('/functions/v1/submit-score', { method: 'POST', auth: true, body: JSON.stringify({ session: p.session, stages: p.stages, total: p.total }) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
export interface BoardRow { user_id: string; nickname: string; fam: FamilyId; diff: Difficulty; stage: number; score: number; rank: Rank | null; time_s: number | null; created_at: string }
export async function topBoard(board: string, weekly: boolean, fam?: FamilyId): Promise<BoardRow[] | null> {
  if (!ONLINE) return null;
  const q = `board=eq.${encodeURIComponent(board)}${fam ? `&fam=eq.${fam}` : ''}&order=score.desc&limit=100`;
  try {
    const r = await req(`/rest/v1/${weekly ? 'sky_leaderboard_weekly' : 'sky_leaderboard'}?select=*&${q}`);
    return r.ok ? ((await r.json()) as BoardRow[]) : null;
  } catch { return null; }
}
export function myUserId(): string { return getSession()?.userId ?? ''; }
