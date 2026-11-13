/**
 * 신규 아트(ChatGPT 제작 → 승인 후 납품) 에셋 규격과 선택 로더.
 * ※ 지금은 어떤 화면에서도 호출하지 않음 — 에셋이 도착해 승인되기 전까지 현재 그래픽을 그대로 유지.
 * 규격 문서: docs/sky-art/03-asset-delivery-spec.md · 납품 검수: python3 tools/check-sky-assets.py
 */
import type { CharId } from './characters';

const BASE = `${import.meta.env.BASE_URL}assets/sky/v2/`;

/** 스프라이트 시트: 가로 = 프레임, 세로 = 애니메이션 행 (행 순서 고정). 셀 크기는 캐릭터별(기본 96×96) */
export const SPRITE_ROWS = [
  { name: 'fly', frames: 4, fps: 10, loop: true },
  { name: 'bankL', frames: 2, fps: 8, loop: true },
  { name: 'bankR', frames: 2, fps: 8, loop: true },
  { name: 'shoot', frames: 3, fps: 12, loop: false },
  { name: 'charge', frames: 3, fps: 10, loop: true },
  { name: 'bomb', frames: 3, fps: 10, loop: false },
  { name: 'hurt', frames: 2, fps: 10, loop: false },
  { name: 'win', frames: 2, fps: 6, loop: true },
] as const;
export type SpriteRowName = (typeof SPRITE_ROWS)[number]['name'];

export interface CharArtFiles {
  /** 선택 화면 전신 일러스트 (세로 1024×1536 이상, 투명 PNG) */
  illust: string;
  /** 필살기 컷인 (가로 1200×600, 투명 또는 단색 배경 PNG) */
  cutin: string;
  /** 얼굴 아이콘 (128×128) */
  portrait: string;
  /** 게임용 스프라이트 시트 */
  sprite: string;
}

export function charArtFiles(id: CharId): CharArtFiles {
  const d = `${BASE}chars/${id}/`;
  return { illust: `${d}illust.png`, cutin: `${d}cutin.png`, portrait: `${d}portrait.png`, sprite: `${d}sprite.png` };
}

export interface CharArt {
  id: CharId;
  illust: HTMLImageElement;
  cutin: HTMLImageElement | null;
  portrait: HTMLImageElement | null;
  sprite: HTMLImageElement;
  cell: { w: number; h: number };
}

function tryLoad(url: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = url;
  });
}

/** 신규 아트가 없으면 null → 호출 쪽은 현재(기존) 그래픽을 그대로 사용 */
export async function loadCharArt(id: CharId, cell = { w: 96, h: 96 }): Promise<CharArt | null> {
  const f = charArtFiles(id);
  const [illust, sprite, cutin, portrait] = await Promise.all([tryLoad(f.illust), tryLoad(f.sprite), tryLoad(f.cutin), tryLoad(f.portrait)]);
  if (!illust || !sprite) return null;
  return { id, illust, sprite, cutin, portrait, cell };
}
