/**
 * 메인 로비(GONA'S BASE CAMP)용 계산: 새 보상(확인 안 한 것) · 확인 기록 · 다음 목표
 *  - 보상은 얻는 순간 이미 저장됨(records.ts). 여기서는 '확인했는지'만 따로 저장 → 확인해도 사진·배지는 그대로
 *  - 처음 로비를 열 때는 지금까지 얻은 것을 모두 '확인함'으로 시작 (예전 기록이 전부 NEW 로 뜨지 않게)
 */
import { NS } from './ns';
import { profileKey } from './profile';
import { photos, achievements, missions, type Achievement, type Mission } from './records';

const KEY = (): string => profileKey(`${NS}.lobbyAck`);
interface Ack { photo: string[]; ach: string[]; mis: string[] }
function snapshot(): Ack {
  return { photo: Object.keys(photos()), ach: achievements().filter((a) => a.done).map((a) => a.id), mis: missions().filter((m) => m.done).map((m) => m.id) };
}
function loadAck(): Ack {
  try {
    const raw = localStorage.getItem(KEY());
    if (raw) return JSON.parse(raw) as Ack;
  } catch { /* 무시 */ }
  const s = snapshot();
  try { localStorage.setItem(KEY(), JSON.stringify(s)); } catch { /* 무시 */ }
  return s;
}
export interface NewRewards { photos: string[]; ach: Achievement[]; mis: Mission[]; total: number }
/** 아직 확인하지 않은 새 보상 */
export function newRewards(): NewRewards {
  const ack = loadAck();
  const ph = Object.keys(photos()).filter((k) => !ack.photo.includes(k));
  const ach = achievements().filter((a) => a.done && !ack.ach.includes(a.id));
  const mis = missions().filter((m) => m.done && !ack.mis.includes(m.id));
  return { photos: ph, ach, mis, total: ph.length + ach.length + mis.length };
}
/** 확인함으로 표시 (기록 자체는 건드리지 않음) */
export function ackRewards(kind: 'photo' | 'ach' | 'mis' | 'all'): void {
  const ack = loadAck();
  const s = snapshot();
  if (kind === 'photo' || kind === 'all') ack.photo = s.photo;
  if (kind === 'ach' || kind === 'all') ack.ach = s.ach;
  if (kind === 'mis' || kind === 'all') ack.mis = s.mis;
  try { localStorage.setItem(KEY(), JSON.stringify(ack)); } catch { /* 무시 */ }
}
