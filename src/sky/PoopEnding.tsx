/**
 * 응가 대탈출 최종 엔딩 (응가 테마 전용 · 케이크 테마는 기존 슬라이드 엔딩 그대로)
 *  응가 열차 출발 → 화면 하얗게 → 현실 복귀 → 고나 힘주기 → 방귀 "뿡!" → 응가 성공 → 가족 환호 → 포옹 → 크레딧
 *  - 그림: 승인된 고나·가족 원화 + 타이틀 키아트 + 응가 열차 스프라이트(팩에 있을 때) · 단순 이펙트(흔들림·김·하트)는 CSS
 *  - 대사: 대화창(TalkBox) 재사용 · 자동 넘김(터치하면 바로) · '엔딩 건너뛰기'
 */
import { useState } from 'react';
import type { FamilyId } from './engine';
import { TalkBox, type TalkLine } from './TalkBox';
import { packPath, hasPack } from './artpack';
import { CHARACTERS } from './data/characters';
import { sfx } from './audio';

const BASE = `${import.meta.env.BASE_URL}assets/sky/`;
const FAMILY: FamilyId[] = ['mom', 'dad', 'imo', 'halmeoni', 'halabeoji', 'samchon'];
const nm = (f: FamilyId | 'gona') => (f === 'samchon' ? '삼촌' : CHARACTERS[f].name);
const L = (who: FamilyId | 'gona' | 'narr' | 'train', text: string): TalkLine =>
  who === 'narr' ? { who: 'narr', name: '', text } : who === 'train' ? { who: 'train', name: '응가 열차', text } : { who, name: nm(who), text, fam: who };

type SceneId = 'train' | 'white' | 'strain' | 'fart' | 'success' | 'hug';
const SCENES: { id: SceneId; lines: TalkLine[] }[] = [
  { id: 'train', lines: [
    L('narr', '변비마왕 꽉막혀가 쓰러지자, 마지막 성문이 활짝 열렸다!'),
    L('train', '뿌우우우~!! 응가 열차, 출발합니다!'),
    L('narr', '막혀 있던 소화왕국의 길이 하나로 이어지고, 왕국 전체가 환호한다.'),
    L('gona', '해냈고나!'),
  ] },
  { id: 'white', lines: [L('narr', '……')] },
  { id: 'strain', lines: [
    L('narr', '현실. 잠들어 있던 고나가 눈을 번쩍 떴다.'),
    L('gona', '끄으으응……'),
    L('gona', '끄으으으으으응……!!'),
  ] },
  { id: 'fart', lines: [L('narr', '뿡!'), L('narr', '…… (잠깐의 정적)')] },
  { id: 'success', lines: [
    L('mom', '어머! 고나 응가했어!!'),
    L('dad', '만세! 우리 고나 최고다!'),
    L('imo', '(코 막고) 푸핫, 대단한데?'),
    L('halmeoni', '아이고 우리 강아지, 장하다~'),
    L('halabeoji', '허허, 역시 내 손주로구나!'),
    L('samchon', '유산균 작전 대성공이다!'),
    L('gona', '아부부! 해냈고나!'),
  ] },
  { id: 'hug', lines: [
    L('narr', '온 가족이 고나를 꼭 안아 주었다.'),
    L('narr', '세상에서 가장 작은 영웅의, 가장 위대한 탈출.'),
  ] },
];

if (location.search.includes('skytest')) Object.assign(window, { __skyEndingExpected: SCENES.flatMap((s) => s.lines.map((l) => l.text)) });

export function PoopEnding({ onDone }: { onDone: () => void }) {
  const [sc, setSc] = useState(0);
  const [who, setWho] = useState<string>('');
  const scene = SCENES[sc];
  const nextScene = () => {
    if (sc + 1 >= SCENES.length) onDone();
    else {
      const n = SCENES[sc + 1].id;
      // 장면 효과음 (기존 합성 효과음 재사용)
      if (n === 'white') sfx('cutin', 0.8);
      if (n === 'fart') { sfx('boomS', 0.9); sfx('shotHeavy', 0.6); }
      if (n === 'success') sfx('gaugeFull', 0.9);
      if (n === 'hug') sfx('heal', 0.8);
      setSc(sc + 1);
      setWho('');
    }
  };
  const gonaImg = `${BASE}${packPath('chars/gona/illust.png')}`;
  const train = hasPack('ending/train.png') ? `${BASE}${packPath('ending/train.png')}` : null;
  return (
    <div className={`sky end pe pes-${scene.id}`}>
      <div className="pe-stage" key={scene.id}>
        {scene.id === 'train' && (
          <>
            <img className="pe-bg" src={`${BASE}${packPath('title/keyart.jpg')}`} alt="" />
            {train && <img className="pe-train" src={train} alt="응가 열차" />}
            <div className="pe-cheer">{FAMILY.map((f) => <img key={f} src={`${BASE}${packPath(`chars/${f}/face.png`)}`} alt="" />)}</div>
          </>
        )}
        {scene.id === 'white' && <div className="pe-white" />}
        {(scene.id === 'strain' || scene.id === 'fart') && (
          <div className="pe-room">
            <img className={`pe-gona${scene.id === 'strain' && who.includes('끄으으으으') ? ' hard' : ''}`} src={gonaImg} alt="고나" />
            {scene.id === 'fart' && (
              <>
                <b className="pe-boom">뿡!</b>
                {['a', 'b', 'c'].map((k) => <i key={k} className={`pe-puff ${k}`} style={{ backgroundImage: `url(${BASE}${packPath('fx/steam-puff.png')})` }} />)}
              </>
            )}
          </div>
        )}
        {(scene.id === 'success' || scene.id === 'hug') && (
          <div className={`pe-family${scene.id === 'hug' ? ' hug' : ''}`}>
            {FAMILY.map((f, i) => (
              <img key={f} className={`pe-f f${i}${who.startsWith(`${nm(f)}|`) ? ' talk' : ''}`} src={`${BASE}${packPath(`chars/${f}/illust.png`)}`} alt={nm(f)} />
            ))}
            <img className={`pe-f pe-center${who.startsWith('고나|') ? ' talk' : ''}`} src={gonaImg} alt="고나" />
            {scene.id === 'hug' && <div className="pe-hearts">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ left: `${8 + i * 10}%`, animationDelay: `${(i % 4) * 0.35}s`, backgroundImage: `url(${BASE}${packPath('fx/heal-heart.png', 'v2/fx/heart-p.png')})` }} />)}</div>}
          </div>
        )}
      </div>
      <TalkBox
        key={sc}
        lines={scene.lines}
        st={null}
        art={null}
        auto={scene.id === 'white' ? 700 : scene.id === 'fart' ? 1300 : scene.id === 'success' ? 1400 : 1800}
        onLine={(l, i) => {
          setWho(`${l.name}|${l.text}`);
          // 줄마다 작은 효과음: 열차 기적 · 힘주기 · 가족 반응
          if (scene.id === 'train' && i === 1) sfx('start', 0.8);
          if (scene.id === 'strain' && i === 2) sfx('chargeUp', 0.7);
          if (scene.id === 'success' && i > 0) sfx('item', 0.6);
        }}
        onDone={nextScene}
        skipLabel="다음 장면 ▶▶"
      />
      <button type="button" className="pe-skipall" onPointerDown={(e) => { e.stopPropagation(); onDone(); }}>엔딩 건너뛰기</button>
    </div>
  );
}
