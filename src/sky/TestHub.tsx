/**
 * 테스트 허브 (응가 테스트판 전용) — 주소 끝에 #hub (또는 ?hub)
 *  타이틀 · 오프닝 장면별 · 캐릭터 선택 · STAGE 1~6 (시작/중간보스/보스 바로) · 엔딩 장면별 · 크레딧 · 새 그림 갤러리
 *  어느 화면에서든 왼쪽 위 '◀ 테스트 목록' 으로 돌아옴 (SkyGame 이 sky-hub 이벤트를 받음)
 */
import { useState } from 'react';
import { packPath } from './artpack';
import { SCENES } from './OpeningCinematic';
import { STAGES } from './stages';
import { THEME } from './theme';

export const HUB = location.hash === '#hub' || /[?&]hub\b/.test(location.search);
const BASE = `${import.meta.env.BASE_URL}assets/sky/`;

export type HubGo =
  | { to: 'title' | 'select' | 'credits' }
  | { to: 'opening'; at: number }
  | { to: 'ending'; scene: number }
  | { to: 'stage'; stage: number; jump: '' | 'midboss' | 'boss' };

const ENDING_SCENES = ['마왕성 붕괴 · 응가 열차 출발', '하얀 전환', '현실 귀환 · 다시 힘주기', '뿡! · 안도', '가족들의 환호', '최종 가족 포옹'];

/** 갤러리: 이번 리마스터·업데이트로 들어간 그림 */
const GALLERY: [string, string[]][] = [
  ['타이틀', ['title/keyart-tall.jpg', 'title/logo.png']],
  ['오프닝 배경', ['opening3/room-eve.jpg', 'opening3/room-night.jpg', 'opening3/room-morn.jpg', 'opening3/dream.jpg', 'opening3/castle.jpg']],
  ['오프닝 고나 동작', ['a-bite', 'a-chew', 'n-eat2', 'a-full', 'a-pat', 'n-startle', 'a-clutch', 'b-strain0', 'n-strain', 'n-strain2', 'n-cry', 'a-drowsy', 'b-sleep', 'b-wake', 'b-fly', 'b-rub', 'b-giggle'].map((n) => `opening3/${n}.png`)],
  ['빌런', ['villain/duo.png', ...['v-soldier', 'v-ghost', 'v-golem', 'v-knight', 'v-king', 'v-king2'].map((n) => `opening2/${n}.png`)]],
  ['엔딩', ['ending/collapse.jpg', 'ending/family.jpg', 'ending/hug2.jpg', 'ending/gona-relief.png', 'ending/gona-cheer.png']],
  ...STAGES.map((st): [string, string[]] => {
    const d = st.art;
    return [`STAGE ${st.id} · ${THEME.stages[st.id - 1]?.name ?? st.name}`, [`${d}/bg-backdrop.png`, `${d}/boss.png`, `${d}/midboss.png`, ...['drone', 'fighter', 'wyvern', 'orb', 'gunship'].map((n) => `${d}/enemy-${n}.png`)]];
  }),
];

export function TestHub({ go }: { go: (g: HubGo) => void }) {
  const [view, setView] = useState<string | null>(null);
  const [tab, setTab] = useState<'play' | 'art'>('play');
  return (
    <div className="sky hub">
      <header className="hub-head">
        <img src={`${BASE}${packPath('title/logo.png')}`} alt="GONA's SKY ADVENTURE" />
        <p>테스트 목록 · 원하는 장면으로 바로 가기</p>
        <nav>
          <button type="button" className={tab === 'play' ? 'on' : ''} onClick={() => setTab('play')}>장면 바로 가기</button>
          <button type="button" className={tab === 'art' ? 'on' : ''} onClick={() => setTab('art')}>새 그림 갤러리</button>
        </nav>
      </header>
      {tab === 'play' ? (
        <div className="hub-body">
          <section>
            <h2>타이틀 · 메뉴</h2>
            <div className="hub-grid">
              <button type="button" onClick={() => go({ to: 'title' })}>타이틀 화면</button>
              <button type="button" onClick={() => go({ to: 'select' })}>캐릭터 선택</button>
              <button type="button" onClick={() => go({ to: 'credits' })}>크레딧</button>
            </div>
          </section>
          <section>
            <h2>오프닝 (약 41초)</h2>
            <div className="hub-grid">
              <button type="button" className="wide" onClick={() => go({ to: 'opening', at: 0 })}>▶ 처음부터 전체 재생</button>
              {SCENES.map((s) => (
                <button type="button" key={s.id} onClick={() => go({ to: 'opening', at: s.t })}><b>{s.id}</b> {s.name}<small>{s.t.toFixed(1)}초~</small></button>
              ))}
            </div>
          </section>
          <section>
            <h2>스테이지 (무적 · 보스 바로 가기)</h2>
            {STAGES.map((st) => (
              <div className="hub-stage" key={st.id}>
                <span><b>STAGE {st.id}</b> {THEME.stages[st.id - 1]?.name ?? st.name}</span>
                <div>
                  <button type="button" onClick={() => go({ to: 'stage', stage: st.id, jump: '' })}>처음</button>
                  <button type="button" onClick={() => go({ to: 'stage', stage: st.id, jump: 'midboss' })}>중간보스</button>
                  <button type="button" onClick={() => go({ to: 'stage', stage: st.id, jump: 'boss' })}>보스</button>
                </div>
              </div>
            ))}
          </section>
          <section>
            <h2>엔딩</h2>
            <div className="hub-grid">
              <button type="button" className="wide" onClick={() => go({ to: 'ending', scene: 0 })}>▶ 처음부터 전체 재생</button>
              {ENDING_SCENES.map((n, i) => (
                <button type="button" key={n} onClick={() => go({ to: 'ending', scene: i })}><b>{i + 1}</b> {n}</button>
              ))}
            </div>
          </section>
          <p className="hub-note">어느 화면에서든 왼쪽 위 ‘◀ 테스트 목록’으로 돌아와요 · 보스 바로 가기는 무적·최대 파워로 시작</p>
        </div>
      ) : (
        <div className="hub-body">
          {GALLERY.map(([title, files]) => (
            <section key={title}>
              <h2>{title}</h2>
              <div className="hub-gal">
                {files.map((f) => (
                  <button type="button" key={f} onClick={() => setView(f)}>
                    <img
                      src={`${BASE}v3-poop/thumbs/${f.replace(/\.(png|jpe?g)$/, '.webp')}`}
                      alt={f}
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        // 미리보기가 없으면 원본 → 원본도 없으면 칸 숨김
                        const im = e.currentTarget;
                        if (!im.dataset.full) { im.dataset.full = '1'; im.src = `${BASE}${packPath(f)}`; }
                        else (im.parentElement as HTMLElement).style.display = 'none';
                      }}
                    />
                    <small>{f.replace(/^.*\//, '')}</small>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {view && (
        <div className="hub-view" onClick={() => setView(null)}>
          <img src={`${BASE}${packPath(view)}`} alt={view} />
          <p>{view} · 터치하면 닫기</p>
        </div>
      )}
    </div>
  );
}

/** 어느 화면에서든 허브로 돌아가는 버튼 (허브 화면에서는 CSS 로 숨김) */
let lastBack = 0;
/** 허브로 (터치·포인터·클릭 중 먼저 오는 한 번만) */
function back(): void {
  const now = Date.now();
  if (now - lastBack < 400) return;
  lastBack = now;
  window.dispatchEvent(new Event('sky-hub'));
}
export function HubBack() {
  return (
    <button
      type="button"
      className="hub-back"
      onPointerDown={(e) => { e.stopPropagation(); back(); }}
      onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); back(); }}
      onClick={(e) => { e.stopPropagation(); back(); }}
    >
      ◀ 테스트 목록
    </button>
  );
}
