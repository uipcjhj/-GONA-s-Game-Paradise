/**
 * 스킨(겉모습) 계약. 최종 픽셀아트 UI 는 이 계약만 구현해서 통째로(또는 슬롯 하나씩) 교체합니다.
 *
 *  · 기반(base)  = 동작·판정·터치 영역·레이아웃(styles.css, sort.css)  → 스킨이 건드리지 않음
 *  · 스킨(skin)  = 보이는 모양(색·도트·프레임·캐릭터)               → 슬롯 컴포넌트 + 토큰 + CSS
 */
import type { ComponentType, ReactNode } from 'react';
import type { SortSlots } from '../games/sort/slots';
import type { TowerSlots } from '../games/tower/slots';
import type { ToyRoomSlots } from '../games/toyroom/slots';

export type Scene = 'menu' | 'play' | 'result';
export type ButtonVariant = 'normal' | 'primary' | 'card';
export type ButtonSize = 'md' | 'lg' | 'sm' | 'icon';
export type PanelTone = 'card' | 'popup' | 'board';
export type MascotPose = 'idle' | 'happy' | 'oops';
export type HeadingRole = 'screen' | 'result' | 'intro-round' | 'intro-title';
export type CalloutTone = 'ready' | 'count' | 'clear' | 'fail';
export type CaptionRole = 'sub' | 'note' | 'centered' | 'stepper' | 'loading';

/** 점수판에 그릴 값(계산은 기반이 끝냄 — 스킨은 보여주기만) */
export interface ScoreboardView {
  /** 누적 점수(이번 라운드 포함) */
  score: number;
  combo: number;
  /** 남은 초. 무제한이면 null */
  timeSec: number | null;
  /** 0~100 남은 시간 비율 (무제한이면 100) */
  timePct: number;
  /** 5초 이하 경고 */
  timeWarn: boolean;
  /** 왼쪽 아래 작은 글씨(예: ROUND 3 · 편가르기 대소동) */
  label: string;
  /** 챌린지: 목숨 */
  lives?: number;
  maxLives?: number;
  /** 자유 플레이: 레벨 */
  level?: number;
}

export interface UiSlots {
  /** 화면 뒤에 깔리는 배경 (입력 없음) */
  Background: ComponentType<{ scene: Scene }>;
  /** 버튼 겉모습. <button>(크기 최소 44px·터치·접근성)은 기반이 렌더하고 안쪽만 그림 */
  ButtonFace: ComponentType<{ variant: ButtonVariant; size: ButtonSize; disabled?: boolean; children?: ReactNode }>;
  /** 카드/팝업/기록판 같은 판(패널) */
  Panel: ComponentType<{ tone: PanelTone; className?: string; children?: ReactNode }>;
  /** 상단 점수판(HUD). 일시정지 버튼은 기반이 만들어 넘겨줌(pauseButton) */
  Scoreboard: ComponentType<{ view: ScoreboardView; pauseButton: ReactNode }>;
  Lives: ComponentType<{ lives: number; max: number }>;
  /** 고나 마스코트 / 심판. scale = 도트 정수 배율 */
  Mascot: ComponentType<{ pose: MascotPose; scale?: number; className?: string }>;
  /** 화면 제목 · 결과 머리글 · 인트로 문구 */
  Heading: ComponentType<{ role: HeadingRole; tone?: 'clear' | 'fail'; children?: ReactNode }>;
  /** 화면 가운데 큰 문구(READY · 카운트다운 · CLEAR! · MISS · TIME UP) — 입력 없음 */
  Callout: ComponentType<{ tone: CalloutTone; children?: ReactNode }>;
  /** 작은 강조 딱지(NEW RECORD · 목숨 +1) */
  Badge: ComponentType<{ children?: ReactNode }>;
  /** 작은 보조 글씨(설명 · 안내 · 로딩) */
  Caption: ComponentType<{ role: CaptionRole; children?: ReactNode }>;
  /** 개발용/임시 표시 딱지 */
  Tag: ComponentType<{ children?: ReactNode }>;
  /** 홈 로고(타이틀 블록) */
  Logo: ComponentType<{ lines: string[]; subtitle: string }>;
  /** 결과 점수 내역(라벨 · 값) */
  StatList: ComponentType<{ lines: { label: string; value: string; strong?: boolean }[] }>;
  /** 하는 방법 목록 */
  HowTo: ComponentType<{ steps: string[] }>;
}

export interface Skin {
  id: string;
  name: string;
  /** 임시/점검용 스킨 표시 */
  temporary?: boolean;
  /** 다른 스킨을 바탕으로 일부 슬롯만 덮어쓸 때 */
  extends?: string;
  /** CSS 변수(예: '--sc-card-w': '96px') — 프레임에 적용 */
  tokens?: Record<string, string>;
  ui?: Partial<UiSlots>;
  sort?: Partial<SortSlots>;
  tower?: Partial<TowerSlots>;
  toyroom?: Partial<ToyRoomSlots>;
}

export interface ResolvedSkin {
  id: string;
  name: string;
  temporary: boolean;
  tokens: Record<string, string>;
  ui: UiSlots;
  sort: SortSlots;
  tower: TowerSlots;
  toyroom: ToyRoomSlots;
}

export const UI_SLOT_KEYS: (keyof UiSlots)[] = ['Background', 'ButtonFace', 'Panel', 'Scoreboard', 'Lives', 'Mascot', 'Heading', 'Callout', 'Badge', 'Caption', 'Tag', 'Logo', 'StatList', 'HowTo'];
