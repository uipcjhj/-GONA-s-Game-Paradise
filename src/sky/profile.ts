/**
 * 모험가(닉네임) 프로필 — 이 기기 안에서 '누구 기록인지' 구분
 *  저장: `${NS}.profiles` = { v: 1, active, list: [{ id, nick, created }] }
 *  기록·수집은 프로필마다 따로 (첫 프로필은 예전 저장 키를 그대로 이어받아 기존 기록이 사라지지 않음)
 *  나중에 계정 연동: id 를 서버 사용자 id 와 묶으면 됨 (records.ts 의 ScoreBackend 교체)
 */
import { NS } from './ns';

export interface Profile { id: string; nick: string; created: string }
interface Store { v: 1; active: string; list: Profile[] }
const KEY = `${NS}.profiles`;

function load(): Store {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Store | null;
    if (s && s.v === 1 && Array.isArray(s.list)) return s;
  } catch {
    /* 무시 */
  }
  return { v: 1, active: '', list: [] };
}
function save(s: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 무시 */
  }
}
const newId = (): string => `p${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

export function profiles(): Profile[] {
  return load().list;
}
export function activeProfile(): Profile | null {
  const s = load();
  return s.list.find((p) => p.id === s.active) ?? null;
}
export function cleanNick(n: string): string {
  return n.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 10);
}
export function createProfile(nick: string): Profile {
  const s = load();
  const p: Profile = { id: newId(), nick: cleanNick(nick) || '모험가', created: new Date().toISOString().slice(0, 10) };
  s.list.push(p);
  s.active = p.id;
  save(s);
  return p;
}
export function switchProfile(id: string): void {
  const s = load();
  if (s.list.some((p) => p.id === id)) { s.active = id; save(s); }
}
export function renameProfile(nick: string): void {
  const s = load();
  const p = s.list.find((x) => x.id === s.active);
  if (p) { p.nick = cleanNick(nick) || p.nick; save(s); }
}
/** 프로필별 저장 키: 첫 프로필은 예전 키 그대로 (기존 기록 이어받기) */
export function profileKey(base: string): string {
  const s = load();
  if (!s.active || s.list[0]?.id === s.active) return base;
  return `${base}.${s.active}`;
}

// ───────── 기기 옮기기 (백업 코드) ─────────
// 서버 없이 다른 기기·브라우저로 옮기는 방법: 지금 모험가의 기록 전체를 문자열(백업 코드)로 내보내고, 다른 기기에서 붙여 넣으면 새 모험가로 들어옴.
// 나중에 서버 동기화를 붙일 때도 이 묶음(JSON)을 그대로 업로드 단위로 쓰면 됨.
const DATA_KEYS = (): string[] => [`${NS}.rec2`, `${NS}.records`, `${NS}.story`]; // story = 스토리 체크포인트 (없던 백업 코드도 그대로 불러옴)
export function exportProfile(): string {
  const p = activeProfile();
  const data: Record<string, string | null> = {};
  for (const k of DATA_KEYS()) data[k] = localStorage.getItem(profileKey(k));
  const json = JSON.stringify({ v: 1, game: 'gona-sky-adventure', nick: p?.nick ?? '모험가', at: new Date().toISOString().slice(0, 10), data });
  return `GONA1:${btoa(unescape(encodeURIComponent(json)))}`;
}
export function importProfile(code: string): Profile | null {
  try {
    const raw = code.trim().replace(/^GONA1:/, '');
    const o = JSON.parse(decodeURIComponent(escape(atob(raw)))) as { v: number; game: string; nick: string; data: Record<string, string | null> };
    if (o.game !== 'gona-sky-adventure' || !o.data) return null;
    const p = createProfile(o.nick);
    for (const [k, v] of Object.entries(o.data)) if (v && DATA_KEYS().includes(k)) localStorage.setItem(profileKey(k), v);
    return p;
  } catch {
    return null;
  }
}
