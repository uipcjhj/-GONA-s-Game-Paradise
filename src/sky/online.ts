/**
 * 온라인 계정 · 클라우드 저장 · 공유 랭킹 (Supabase · 패키지 없이 REST)
 *
 *  - 빌드할 때 VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY 가 있어야 켜짐 (없으면 ONLINE=false → 게스트·로컬 저장만)
 *  - 계정은 '지금 고른 모험가(프로필)' 하나에만 연결 — 다른 프로필 기록과 섞지 않음 (닉네임이 같아도)
 *  - 저장은 rev(버전)로 충돌 감지: 다른 기기가 먼저 저장했으면 받아서 mergeBundle 후 다시 저장 (덮어쓰기 금지)
 *  - 점수는 서버(Edge Function)가 세션·시간·보너스를 다시 계산해 통과한 것만 공식 랭킹
 *  - 설정 방법: docs/sky-online/SETUP.md
 */
import { NS, PREVIEW } from './ns';
import { activeProfile, profileKey } from './profile';
import { backupBeforeLogin, mergeBundle, type SaveBundle } from './sync';
import type { Difficulty } from './stages';
import type { FamilyId } from './engine';
import type { Rank } from './rank';

/** 설정 위치 (먼저 있는 것): ① 배포 폴더의 online-config.js (다시 빌드 없이 켜기) ② 빌드 환경변수 VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY */
const RT = (typeof window !== 'undefined' ? (window as unknown as { SKY_ONLINE?: { url?: string; anonKey?: string } }).SKY_ONLINE : undefined) ?? {};
const URL_ = (RT.url || (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '').trim().replace(/\/$/, '');
const RAW_KEY = (RT.anonKey || (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '').trim();
/** 비밀 키(service_role · sb_secret_)가 실수로 들어오면 온라인을 켜지 않음 — 공개 화면에는 공개 키(anon · sb_publishable_)만 */
export function isSecretKey(k: string): boolean {
  if (k.startsWith('sb_secret_')) return true;
  const part = k.split('.')[1];
  if (!part) return false;
  try { return /"role"\s*:\s*"service_role"/.test(atob(part.replace(/-/g, '+').replace(/_/g, '/'))); } catch { return false; }
}
const KEY_ = isSecretKey(RAW_KEY) ? '' : RAW_KEY;
if (RAW_KEY && !KEY_) console.warn('[sky-online] 비밀 키가 설정되어 온라인 기능을 껐어요. 공개(anon/publishable) 키만 넣어 주세요.');
const URL_OK = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(URL_) || /^https:\/\/[\w.-]+$/.test(URL_);
/** 서버 설정이 들어간 빌드인지 */
export const ONLINE = !!(URL_ && URL_OK && KEY_) && !PREVIEW; // 컷신 미리보기 탭은 온라인 제출·동기화 없음
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
  if (!r.ok) return /already|registered|exists/i.test(`${j.msg ?? ''}${j.error_code ?? ''}`) ? '이미 가입한 이메일이에요 · 로그인해 주세요' : /rate|limit/i.test(`${j.msg ?? ''}${j.error_code ?? ''}`) ? '잠시 뒤 다시 시도해 주세요 (가입 요청이 많아요)' : (j.msg ?? j.error_description ?? '가입하지 못했어요');
  if (!j.access_token) return '메일함의 확인 링크를 누른 뒤 로그인해 주세요';
  await afterLogin(j, email);
  return '';
}
export async function signIn(email: string, password: string): Promise<string> {
  const r = await req('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return /not confirmed/i.test(`${j.error_description ?? j.msg ?? ''} ${j.error_code ?? ''}`) ? '메일함의 확인 링크를 먼저 눌러 주세요' : /invalid/i.test(`${j.error_description ?? ''}${j.error_code ?? ''}`) ? '이메일 또는 비밀번호가 맞지 않아요' : (j.error_description ?? j.msg ?? '로그인하지 못했어요');
  await afterLogin(j, email);
  return '';
}
/** 가입 확인 메일의 링크로 돌아왔을 때 (주소 #access_token=…) → 자동 로그인 · 주소에서 토큰 지움 · 실패해도 게임은 그대로 */
export async function handleAuthRedirect(): Promise<string> {
  if (!ONLINE || typeof location === 'undefined' || !/access_token=/.test(location.hash)) return '';
  const h = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname + location.search);
  const access = h.get('access_token'); const refresh = h.get('refresh_token') ?? '';
  if (!access) return '';
  try {
    const r = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: KEY_, Authorization: `Bearer ${access}` } });
    if (!r.ok) return '';
    const u = (await r.json()) as { id: string; email?: string };
    await afterLogin({ access_token: access, refresh_token: refresh, expires_in: +(h.get('expires_in') ?? 3600), user: { id: u.id } }, u.email ?? '');
    return '메일 확인 완료! 로그인했어요';
  } catch { return ''; }
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
const DATA = { rec2: `${NS}.rec2`, records: `${NS}.records`, story: `${NS}.story` };
function localBundle(): SaveBundle {
  const rd = (k: string) => { try { return JSON.parse(localStorage.getItem(profileKey(k)) ?? 'null'); } catch { return null; } };
  return { schema: 3, rec2: rd(DATA.rec2), records: rd(DATA.records), story: rd(DATA.story) };
}
function writeLocal(b: SaveBundle): void {
  if (b.rec2) localStorage.setItem(profileKey(DATA.rec2), JSON.stringify(b.rec2));
  if (b.records) localStorage.setItem(profileKey(DATA.records), JSON.stringify(b.records));
  if (b.story) { const j = JSON.stringify(b.story); localStorage.setItem(profileKey(`${DATA.story}.bak`), j); localStorage.setItem(profileKey(DATA.story), j); }
}
let syncT = 0;
/** 체크포인트 저장 · 로비 진입 때 조용히 동기화 (로그인했을 때만 · 3초 모아서 한 번 · 실패해도 기기 기록 그대로) */
export function syncSoon(): void {
  if (!ONLINE || !account()) return;
  window.clearTimeout(syncT);
  syncT = window.setTimeout(() => { void sync().catch(() => {}); }, 3000);
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
