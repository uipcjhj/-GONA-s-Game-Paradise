/**
 * 응가 대탈출 신규 그래픽 팩 (public/assets/sky/v3-poop/)
 *
 *  - manifest.json 에 적힌 파일만 새 그림으로 쓰고, 없는 것은 기존(v2) 그림을 그대로 쓴다
 *    → 새 그림을 한 장씩 받아서 넣어도 게임이 깨지지 않음 (임시/최종이 섞인 상태도 안전)
 *  - 케이크 테마(기본)에서는 manifest 를 아예 읽지 않음 → 기존 버전과 100% 같은 파일을 사용
 *  - 파일 추가는 tools/sky-art-import.py 가 규격 변환 · 검사 · manifest 갱신까지 한 번에 처리
 *
 * manifest 예
 *   { "version": 1, "files": {
 *       "chars/mom/illust.png": { "final": true },
 *       "stage1/boss.png":      { "frames": 3, "k": 0.5 },
 *       "stage1/midboss.png":   { "frames": 2, "k": 0.5 },
 *       "stage1/bg-backdrop.png": { "tint": 0.3 } } }
 */
import { THEME_ID } from './theme';
import type { StageDef } from './stages';

export interface PackMeta {
  /** 가로로 이어 붙인 프레임 수 (보스 페이즈 · 중간보스 상태) */
  frames?: number;
  /** 게임 표시 배율 (보스·중간보스 원본은 2배로 그려 k=0.5) */
  k?: number;
  /** 배경 어둡게 덮는 정도 (1 = 기존 케이크 버전과 같음 · 0 = 덮지 않음) */
  tint?: number;
  /** 보스 부품(포탑) 위치 · 약점 위치 재지정 (새 보스 그림에 맞춤, 논리 픽셀) */
  partDx?: number;
  partDy?: number;
  weakDy?: number;
  /** 배경 그림에 이미 건물·지형이 그려져 있어 기존 소품(성·시계탑 등)을 끔 */
  noProps?: boolean;
  /** 보스 탄 모양 (새 보스 그림에 맞춤) */
  bullet?: StageDef['boss']['bullet'];
  /** 최종 승인 그림인지 (false/없음 = 신규 시안 · 임시) */
  final?: boolean;
}
interface Manifest {
  version: number;
  files: Record<string, PackMeta>;
}

export const PACK_DIR = 'v3-poop/';
let manifest: Manifest = { version: 1, files: {} };
let loading: Promise<Manifest> | null = null;

/** 응가 테마일 때만 manifest 를 읽음 (없거나 깨져 있으면 빈 목록 → 전부 기존 그림) */
export function loadArtPack(base: string): Promise<Manifest> {
  loading ??= (async () => {
    if (THEME_ID !== 'poop') return manifest;
    // 잠깐 503 이 나도 기존 그림으로 바뀌지 않게 몇 번 다시 받아 봄 (404 = 팩 없음 → 바로 기존 그림)
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetch(`${base}${PACK_DIR}manifest.json`, { cache: 'no-cache' });
        if (r.ok) {
          const m = (await r.json()) as Manifest;
          if (m && typeof m.files === 'object') manifest = m;
          break;
        }
        if (r.status === 404) break;
      } catch {
        /* 네트워크 오류 → 다시 시도 */
      }
      await new Promise((ok) => setTimeout(ok, [500, 1500, 3000][i] ?? 0));
    }
    return manifest;
  })();
  return loading;
}

export function hasPack(rel: string): boolean {
  return Object.prototype.hasOwnProperty.call(manifest.files, rel);
}
export function packMeta(rel: string): PackMeta | undefined {
  return manifest.files[rel];
}
/** 'chars/mom/illust.png' 같은 상대 경로 → 팩에 있으면 v3-poop 경로, 없으면 fallback (기본: v2 경로) */
export function packPath(rel: string, fallback = `v2/${rel}`): string {
  return hasPack(rel) ? `${PACK_DIR}${rel}` : fallback;
}
/** 스테이지 그림 폴더 이름 (팩 안에서는 stage1 · s2 … s6) */
export function stageDir(art: StageDef['art']): string {
  return art;
}

/** 팩에 들어온 보스·중간보스·배경 정보를 스테이지 정의에 반영 (그림이 없으면 아무것도 바꾸지 않음) */
export function applyPackToStages(stages: StageDef[]): void {
  if (THEME_ID !== 'poop') return;
  for (const st of stages) {
    const dir = stageDir(st.art);
    const mid = packMeta(`${dir}/midboss.png`);
    if (mid) {
      st.midboss.art = 'midboss';
      st.midboss.frames = mid.frames ?? 1;
      st.midboss.k = mid.k ?? 0.5;
    }
    const boss = packMeta(`${dir}/boss.png`);
    if (boss) {
      st.boss.frames = boss.frames ?? st.boss.frames;
      if (boss.k) st.boss.k = boss.k;
      for (const p of st.boss.parts) {
        if (typeof boss.partDx === 'number') p.dx = Math.sign(p.dx) * boss.partDx;
        if (typeof boss.partDy === 'number') p.dy = boss.partDy;
      }
      if (boss.bullet) st.boss.bullet = boss.bullet;
      if (typeof boss.weakDy === 'number' && st.boss.weak) st.boss.weak = { ...st.boss.weak, dy: boss.weakDy };
    }
    const bg = packMeta(`${dir}/bg-backdrop.png`);
    if (bg && typeof bg.tint === 'number') st.tint = bg.tint;
    if (bg?.noProps) st.props = [];
    // 배경·중간보스·보스가 모두 새 그림이면 '임시 그래픽' 표시를 끔
    if (bg && mid && boss) st.temp = false;
  }
}
