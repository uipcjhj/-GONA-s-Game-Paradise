// @ts-nocheck — 이 파일은 소스 파일을 직접 읽기 위해 node:fs 를 씀(프로젝트가 @types/node 를 두지 않으므로 타입 검사에서 제외)
/**
 * 구조 원칙 자동 검사 — "게임 로직과 시각 디자인의 완전 분리"가 코드 변경으로 슬그머니 깨지지 않게 지킵니다.
 *  · 로직 파일은 React·스킨·CSS 를 모름
 *  · 기반(base) 코드는 색·그림을 직접 갖지 않음(전부 스킨 슬롯)
 *  · 효과 시간은 한 곳(core/fx.ts)에서만 정함
 *  · 승인된 에셋(고나 · 월드맵)은 임의로 바뀌지 않음
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(process.cwd(), 'src/mini-game-land');
const REPO = process.cwd();
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const all = walk(ROOT);
const rel = (p: string) => relative(ROOT, p);
const read = (p: string) => readFileSync(p, 'utf8');
const games = readdirSync(join(ROOT, 'games'));

/** 로직(규칙·물리·생성·난이도) 파일 = 화면과 무관해야 하는 파일 */
const LOGIC_NAMES = ['engine', 'game', 'logic', 'physics', 'pieces', 'generator', 'solver', 'tuning', 'bot'];
const logicFiles = all.filter((p) => {
  if (!p.endsWith('.ts') || p.endsWith('.test.ts')) return false;
  const r = rel(p);
  if (r.startsWith('core/')) return !['types.ts', 'registry.ts'].includes(r.slice(5)); // 계약·등록부는 예외
  const m = r.match(/^games\/([^/]+)\/([^/]+)\.ts$/);
  return !!m && LOGIC_NAMES.includes(m[2].replace(/\.ts$/, ''));
});

describe('구조 원칙: 게임 로직 ⟂ 시각 디자인', () => {
  it('검사 대상 로직 파일이 충분히 잡힘(검사가 비어 있지 않음)', () => {
    expect(logicFiles.length).toBeGreaterThan(20);
    for (const g of ['sort', 'tower', 'toyroom']) expect(logicFiles.some((p) => rel(p).startsWith(`games/${g}/`)), g).toBe(true);
  });

  it('로직 파일은 React · 스킨 · CSS · TSX 를 import 하지 않음', () => {
    const bad: string[] = [];
    for (const p of logicFiles) {
      const src = read(p);
      for (const m of src.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/gm)) {
        const spec = m[1];
        if (spec === 'react' || spec.startsWith('react/') || spec === 'react-dom' || /(^|\/)skin(\/|$)/.test(spec) || spec.endsWith('.css') || spec.endsWith('.tsx') || spec.endsWith('/View') || spec === './View') bad.push(`${rel(p)} → ${spec}`);
      }
      if (/\bdocument\.|\bwindow\./.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''))) {
        // DOM 직접 접근 허용 목록: 엔진은 탭 숨김 감지를 위해 주입 가능한 doc/win 을 씀(기본값만 전역)
        if (!/core\/(engine|clock|audio|storage|lifecycle)\.ts$/.test(rel(p))) bad.push(`${rel(p)} → DOM 직접 접근`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('matter-js 는 physics.ts 한 파일에만 있음(물리 엔진을 화면이 모름)', () => {
    const users = all.filter((p) => /\.(ts|tsx)$/.test(p) && !p.endsWith('.test.ts') && /from\s+['"]matter-js['"]/.test(read(p))).map(rel);
    expect(users).toEqual(['games/tower/physics.ts']);
  });

  it('물리 충돌 모양(pieces.ts)은 스킨이 접근할 수 없는 로직 영역이고, 스킨은 읽기 전용 표시 데이터만 받음', () => {
    const skinSrc = all.filter((p) => rel(p).startsWith('skin/') && /\.tsx?$/.test(p)).map(read).join('\n');
    expect(skinSrc).not.toMatch(/from\s+['"][^'"]*games\/tower\/(physics|game)['"]/);
    expect(skinSrc).not.toMatch(/from\s+['"][^'"]*games\/toyroom\/(engine|game|generator)['"]/);
    expect(skinSrc).not.toMatch(/matter-js/);
  });
});

describe('구조 원칙: 기반(base)은 색·그림을 갖지 않음', () => {
  const baseCss = ['styles.css', ...games.flatMap((g) => readdirSync(join(ROOT, 'games', g)).filter((f) => f.endsWith('.css')).map((f) => `games/${g}/${f}`))];
  it('기반 CSS 에 색상 리터럴이 없음(사용자 정의 속성 정의 줄 제외)', () => {
    expect(baseCss.length).toBeGreaterThanOrEqual(4);
    const bad: string[] = [];
    for (const f of baseCss) {
      read(join(ROOT, f)).split('\n').forEach((line, i) => {
        if (/^\s*--[\w-]+\s*:/.test(line)) return; // 토큰 기본값 정의는 허용
        if (/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\b(white|black|red|green|blue|yellow|orange|pink|gray|grey)\b/.test(line.replace(/\/\*.*?\*\//g, ''))) bad.push(`${f}:${i + 1} ${line.trim().slice(0, 70)}`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('기반 CSS 의 애니메이션 길이는 리터럴이 아니라 효과 변수(--mgl-fx-*)를 씀', () => {
    const bad: string[] = [];
    for (const f of baseCss) read(join(ROOT, f)).split('\n').forEach((line, i) => { if (/\banimation\s*:/.test(line) && !/var\(--mgl-fx-/.test(line)) bad.push(`${f}:${i + 1}`); });
    expect(bad).toEqual([]);
  });

  it('기반 TSX(화면·모드·공통 UI)는 색을 직접 쓰지 않고 시각 클래스(mgl-big 등)도 직접 쓰지 않음', () => {
    const baseTsx = all.filter((p) => p.endsWith('.tsx') && !rel(p).startsWith('skin/'));
    expect(baseTsx.length).toBeGreaterThan(8);
    const VISUAL = /(?<![\w-])(mgl-(big|badge|h|result-head|intro-round|intro-title|title|sub|note|how|lines|center-text|temp|hud|time|score|label|combo|lives)|sc-(card|chip|dot|rule|judge|eyes|mouth|hat|ribbon|glasses|fb|announce)|tf-[\w-]*)(?![\w-])/;
    const bad: string[] = [];
    for (const p of baseTsx) {
      const src = read(p).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      if (/#[0-9a-fA-F]{3,8}\b['"`]/.test(src)) bad.push(`${rel(p)} 색 리터럴`);
      for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) if (VISUAL.test(m[1] ?? m[2] ?? '')) bad.push(`${rel(p)} 시각 클래스: ${(m[1] ?? m[2]).slice(0, 40)}`);
    }
    expect(bad).toEqual([]);
  });

  it('레이아웃 토큰이 기본값과 함께 정의되어 있음(스킨이 크기를 바꿀 수 있음)', () => {
    const css = baseCss.map((f) => read(join(ROOT, f))).join('\n');
    for (const t of ['--mgl-tap-min', '--mgl-btn-h-lg', '--mgl-screen-pad', '--sc-card-w', '--sc-card-h', '--sc-bin-min-h', '--tr-shelf-h-3', '--tr-shelf-h-6', '--tr-toy-max', '--tw-controls-pad']) expect(css, t).toMatch(new RegExp(`${t}\\s*:`));
    expect(css).toMatch(/--mgl-tap-min:\s*44px/); // 모바일 터치 최소 크기
  });
});

describe('구조 원칙: 효과 시간 단일 출처 (core/fx.ts)', () => {
  it('화면 코드의 타이머 숫자가 FX 에서 오고 리터럴이 아님', () => {
    const views = all.filter((p) => /games\/[^/]+\/View\.tsx$|ui\/Round\.tsx$|modes\/\w+\.tsx$/.test(rel(p)));
    expect(views.length).toBeGreaterThanOrEqual(5);
    const bad: string[] = [];
    for (const p of views) read(p).split('\n').forEach((line, i) => { if (/setTimeout\([^)]*,\s*\d{3,}\s*\)/.test(line) || /\}\s*,\s*\d{3,}\s*\);\s*$/.test(line) && /setTimeout/.test(line)) bad.push(`${rel(p)}:${i + 1}`); });
    expect(bad).toEqual([]);
  });
});

describe('승인된 에셋 보호 — 고나 외형과 게임천국 월드맵은 임의로 바뀌지 않음', () => {
  const sha = (p: string) => createHash('sha256').update(readFileSync(join(REPO, p))).digest('hex');
  it('gona.png · gona-world-map.png 가 승인된 원본 그대로(변경하려면 이 해시를 의도적으로 갱신)', () => {
    expect(sha('public/assets/gona.png')).toMatch(/^a6706206bafc938e/);
    expect(sha('public/assets/gona-world-map.png')).toMatch(/^7eb6f10b0e8efd81/);
  });
  it('고나 스프라이트 크기 27×34 (PNG 헤더)', () => {
    const b = readFileSync(join(REPO, 'public/assets/gona.png'));
    expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual([27, 34]);
  });
  it('미니게임 모듈은 승인된 에셋을 assets.ts 한 곳에서만 가져오고, 마스코트는 정수 배율로만 그림', () => {
    const importers = all.filter((p) => /\.(ts|tsx)$/.test(p) && !p.endsWith('.test.ts') && /public\/assets\//.test(read(p))).map(rel);
    expect(importers).toEqual(['assets.ts']);
    expect(existsSync(join(REPO, 'public/assets/gona.png'))).toBe(true);
    const temp = read(join(ROOT, 'skin/temp/index.tsx'));
    expect(temp).toMatch(/27 \* scale/);
    expect(temp).toMatch(/34 \* scale/);
    expect(temp).toMatch(/scale = 3/); // 기본 배율은 정수
  });
});
