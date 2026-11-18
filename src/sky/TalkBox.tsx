/**
 * 스토리 대화창 (응가 테마) — 90년대 아케이드 슈팅식 픽셀 대화창
 *  - 엔진이 talk(key) 로 전투를 멈추면 SkyGame 이 이 창을 띄움 → 끝나면 onDone → engine.endTalk()
 *  - 글자가 한 자씩 찍힘(타이핑) · 화면 터치: 찍는 중이면 한 번에 다 보이기, 다 보이면 다음 줄
 *  - SKIP: 이번 대화 전체 건너뛰기 · 키보드 Enter/Space/Z = 다음, Esc = 건너뛰기
 *  - 초상화: 가족·고나 = 얼굴 아이콘, 뽀글이·꾸덕이 = 표정 3종, 중간보스·보스 = 지금 스테이지의 보스 그림
 */
import { useEffect, useRef, useState } from 'react';
import type { FamilyId } from './engine';
import type { StageDef } from './stages';
import type { StageArt } from './assets';
import type { Line, Speaker } from './story';
import { CHARACTERS } from './data/characters';
import { packPath, hasPack } from './artpack';
import { sfx } from './audio';

const BASE = `${import.meta.env.BASE_URL}assets/sky/`;
const FAM_NAME = (f: FamilyId | 'gona'): string => (f === 'samchon' ? '삼촌' : CHARACTERS[f].name);

export interface TalkLine { who: Speaker; name: string; text: string; face?: number; fam?: FamilyId | 'gona'; /** 보스 초상화 프레임 (페이즈) */ frame?: number }

/** 대사 데이터 → 화면용 (동료별 대사 고르기 · 이름 붙이기) */
export function resolveLines(lines: Line[], fam: FamilyId, st: StageDef, key = ''): TalkLine[] {
  // 보스·중간보스 초상화는 그 순간의 모습 (2페이즈 · 최종 형태 · 격파)
  const bf = key === 'bossP2' ? 1 : key === 'bossP3' || key === 'bossDown' ? 2 : 0;
  const mf = key === 'midDown' ? 1 : 0;
  const out: TalkLine[] = [];
  for (const l of lines) {
    if (l.who === 'partner') {
      const t = l.by?.[fam];
      if (t) out.push({ who: fam, name: FAM_NAME(fam), text: t, fam });
      continue;
    }
    const text = l.text ?? '';
    switch (l.who) {
      case 'gona': out.push({ who: 'gona', name: '고나', text, fam: 'gona' }); break;
      case 'bbo': out.push({ who: 'bbo', name: '뽀글이', text, face: l.face ?? 0 }); break;
      case 'kku': out.push({ who: 'kku', name: '꾸덕이', text, face: l.face ?? 0 }); break;
      case 'mid': out.push({ who: 'mid', name: st.midboss.name, text, frame: Math.min(mf, st.midboss.frames - 1) }); break;
      case 'boss': out.push({ who: 'boss', name: st.boss.name, text, frame: Math.min(bf, st.boss.frames - 1) }); break;
      case 'train': out.push({ who: 'train', name: '응가 열차', text }); break;
      case 'narr': out.push({ who: 'narr', name: '', text }); break;
      default: out.push({ who: l.who, name: FAM_NAME(l.who), text, fam: l.who });
    }
  }
  return out;
}

/** 보스 그림 첫 프레임을 초상화 칸에 맞춰 그림 */
function BossPortrait({ img, frames, frame = 0 }: { img: HTMLImageElement | undefined; frames: number; frame?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !img) return;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height);
    const fw = img.width / frames;
    const k = Math.min(c.width / fw, c.height / img.height);
    const w = fw * k;
    const h = img.height * k;
    g.drawImage(img, fw * frame, 0, fw, img.height, (c.width - w) / 2, (c.height - h) / 2, w, h);
  }, [img, frames, frame]);
  return <canvas ref={ref} width={96} height={96} className="talk-face" />;
}

/** 초상화 (없으면 null → 초상화 칸 자체를 숨김) */
function portrait(line: TalkLine, st: StageDef | null, art: StageArt | null) {
  if (line.fam) return <span className="talk-face" style={{ backgroundImage: `url(${BASE}${packPath(`chars/${line.fam}/face.png`)})` }} />;
  if ((line.who === 'bbo' || line.who === 'kku') && hasPack(`villain/${line.who}-face.png`)) {
    return <span className="talk-face sheet3" style={{ backgroundImage: `url(${BASE}${packPath(`villain/${line.who}-face.png`)})`, backgroundPosition: `${(line.face ?? 0) * 50}% 0` }} />;
  }
  if (line.who === 'train' && hasPack('ending/train.png')) return <span className="talk-face train" style={{ backgroundImage: `url(${BASE}${packPath('ending/train.png')})` }} />;
  if (!st) return null;
  if (line.who === 'mid') return <BossPortrait img={art?.[st.midboss.art]} frames={st.midboss.frames} frame={line.frame} />;
  if (line.who === 'boss') return <BossPortrait img={art?.[st.boss.art]} frames={st.boss.frames} frame={line.frame} />;
  return null;
}

export function TalkBox({ lines, st, art, onDone, auto, onLine, skipLabel = 'SKIP ▶▶' }: {
  lines: TalkLine[]; st: StageDef | null; art: StageArt | null; onDone: () => void;
  /** 글자가 다 찍힌 뒤 자동으로 넘기는 시간(ms) — 엔딩 연출용 */
  auto?: number;
  /** 지금 줄이 바뀔 때 (엔딩에서 말하는 사람 강조) */
  onLine?: (l: TalkLine, i: number) => void;
  skipLabel?: string;
}) {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(0);
  const line = lines[Math.min(i, lines.length - 1)];
  const full = line ? [...line.text].length : 0;
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };
  const next = () => {
    if (shown < full) { setShown(full); return; }
    sfx('menuMove', 0.5);
    if (i + 1 >= lines.length) finish();
    else { setI(i + 1); setShown(0); }
  };

  useEffect(() => { if (line) onLine?.(line, i); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  // 자동 넘김 (엔딩)
  useEffect(() => {
    if (!auto || !line || shown < full) return;
    const id = window.setTimeout(next, auto);
    return () => window.clearTimeout(id);
  });
  // 타이핑 (한 글자 32ms · 몇 글자마다 작은 소리)
  useEffect(() => {
    if (!line || shown >= full) return;
    const id = window.setTimeout(() => {
      setShown((n) => n + 1);
      if (shown % 3 === 0 && line.text[shown] !== ' ') sfx('menuMove', 0.12);
    }, 32);
    return () => window.clearTimeout(id);
  }, [shown, full, line]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'Z') { e.preventDefault(); next(); }
      else if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  // 자동 검수용 (?skytest)
  useEffect(() => {
    if (!location.search.includes('skytest')) return;
    Object.assign(window, { __skyTalk: { i, n: lines.length, who: line?.who, name: line?.name, text: line?.text, typing: shown < full, next, skip: finish } });
    return () => { delete (window as unknown as { __skyTalk?: unknown }).__skyTalk; };
  });

  if (!line) return null;
  const villain = line.who === 'bbo' || line.who === 'kku' || line.who === 'mid' || line.who === 'boss';
  const pic = portrait(line, st, art);
  return (
    <div className="sky-talk" onPointerDown={(e) => { e.preventDefault(); next(); }}>
      <div className={`talk-win${villain ? ' foe' : ''}${line.who === 'narr' || line.who === 'train' ? ' plain' : ''}`}>
        {pic && <div className="talk-pic">{pic}</div>}
        <div className="talk-body">
          {line.name && <b className="talk-name">{line.name}</b>}
          <p className="talk-text">
            {[...line.text].slice(0, shown).join('')}
            {shown >= full && <span className="talk-more">{i + 1 < lines.length ? '▼' : '■'}</span>}
          </p>
        </div>
        <button type="button" className="talk-skip" onPointerDown={(e) => { e.stopPropagation(); finish(); }}>{skipLabel}</button>
      </div>
    </div>
  );
}
