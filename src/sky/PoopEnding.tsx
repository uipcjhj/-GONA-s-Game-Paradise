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

type SceneId = 'train' | 'white' | 'strain' | 'fart' | 'success' | 'hug' | 'epi';
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
  // 에필로그 (그림이 있을 때만): 노을 지는 아기방 · 편히 잠든 고나 → 크레딧
  { id: 'epi', lines: [
    L('narr', '그날 밤, 고나는 세상에서 가장 편안한 잠에 들었다.'),
    L('narr', '배 속 소화왕국에도 다시 평화가 찾아왔다. …다음 이유식이 오기 전까지는.'),
  ] },
];

if (location.search.includes('skytest')) Object.assign(window, { __skyEndingExpected: SCENES.flatMap((s) => s.lines.map((l) => l.text)) });

export function PoopEnding({ onDone, startScene = 0 }: { onDone: () => void; startScene?: number }) {
  const [sc, setSc] = useState(startScene);
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
      if (n === 'epi' && !hasPack('ending/epilogue.jpg')) { onDone(); return; }
      setSc(sc + 1);
      setWho('');
    }
  };
  const gonaImg = `${BASE}${packPath('chars/gona/illust.png')}`;
  const train = hasPack('ending/train.png') ? `${BASE}${packPath('ending/train.png')}` : null;
  // 엔딩 전용 그림 (있으면 사용): 마왕성 붕괴 · 힘주기(오프닝 표정) · 시원한 고나 · 만세 고나 · 가족 포옹
  const P = (rel: string): string | null => (hasPack(rel) ? `${BASE}${packPath(rel)}` : null);
  const castleBg = P('ending/castle.jpg');
  const strainImg = P('opening2/gona-strain.png');
  const strain2Img = P('opening2/gona-strain2.png');
  const reliefImg = P('ending/gona-relief.png');
  const cheerImg = P('ending/gona-cheer.png');
  const hugImg = P('ending/hug.jpg');
  const hard = scene.id === 'strain' && who.includes('끄으으으으');
  const roomImg = scene.id === 'fart' ? reliefImg ?? gonaImg : (hard ? strain2Img : strainImg) ?? gonaImg;
  // 리마스터 그림 (있으면 우선): 마왕성 붕괴+열차 · 아침 아기방 · 고나 연속동작 · 가족 환호 · 최종 포옹
  const collapse = P('ending/collapse.jpg');
  const morn = P('opening3/room-morn.jpg');
  const family = P('ending/family.jpg');
  const hug2 = P('ending/hug2.jpg');
  const wake = who.startsWith('|현실');
  const kidImg = scene.id === 'fart' ? reliefImg : wake || !who ? P('opening3/b-rub.png') : hard ? P('opening3/n-strain2.png') : P('opening3/n-strain.png');
  const lastLine = scene.id === 'hug' && who.includes('가장 위대한 탈출');
  // 아케이드 업그레이드 일러스트 (있으면 우선): 힘주기 클로즈업 · 뿡! 성공의 순간
  const strainArt = P('ending/strain.jpg');
  const reliefArt = P('ending/relief.jpg');
  const wakeArt = P('ending/wake.jpg');
  const ill = scene.id === 'strain' && wake && wakeArt ? wakeArt : scene.id === 'strain' && !wake && strainArt ? strainArt : scene.id === 'fart' && reliefArt ? reliefArt : null;
  return (
    <div className={`sky end pe pes-${scene.id}`}>
      <div className="pe-stage" key={scene.id}>
        {scene.id === 'train' && collapse && (
          <div className="pe-full pe-pan-up"><img className="pe-bg" src={collapse} alt="무너지는 변비마왕성과 성문을 뚫고 출발하는 응가 열차" /><i className="pe-sparkle" /></div>
        )}
        {scene.id === 'train' && !collapse && (
          <>
            <img className="pe-bg" src={castleBg ?? `${BASE}${packPath('title/keyart.jpg')}`} alt="" />
            {train && <img className="pe-train" src={train} alt="응가 열차" />}
            <div className="pe-cheer">{FAMILY.map((f) => <img key={f} src={`${BASE}${packPath(`chars/${f}/face.png`)}`} alt="" />)}</div>
          </>
        )}
        {scene.id === 'white' && <div className="pe-white" />}
        {ill && (
          <div className={`pe-full pe-ill${scene.id === 'fart' ? ' fart' : ''}`}>
            <img className={`pe-bg${hard ? ' hard' : ''}`} src={ill} alt={scene.id === 'fart' ? '뿡! 해낸 고나' : '있는 힘껏 힘주는 고나'} />
            {scene.id === 'fart' && (
              <>
                <b className="pe-boom">뿡!</b>
                {['a', 'b', 'c'].map((k) => <i key={k} className={`pe-puff ${k}`} style={{ backgroundImage: `url(${BASE}${packPath('fx/steam-puff.png')})` }} />)}
              </>
            )}
          </div>
        )}
        {!ill && (scene.id === 'strain' || scene.id === 'fart') && morn && kidImg && (
          <div className="pe-full pe-real">
            <img className="pe-bg" src={morn} alt="아침 햇살이 드는 아기방" />
            <img className={`pe-kid${hard ? ' hard' : ''}${scene.id === 'fart' ? ' relief' : ''}`} src={kidImg} alt="고나" />
            {scene.id === 'fart' && (
              <>
                <b className="pe-boom">뿡!</b>
                {['a', 'b', 'c'].map((k) => <i key={k} className={`pe-puff ${k}`} style={{ backgroundImage: `url(${BASE}${packPath('fx/steam-puff.png')})` }} />)}
              </>
            )}
          </div>
        )}
        {!ill && (scene.id === 'strain' || scene.id === 'fart') && !(morn && kidImg) && (
          <div className="pe-room">
            <img className={`pe-gona${hard ? ' hard' : ''}${roomImg !== gonaImg ? ' px' : ''}`} src={roomImg} alt="고나" />
            {scene.id === 'fart' && (
              <>
                <b className="pe-boom">뿡!</b>
                {['a', 'b', 'c'].map((k) => <i key={k} className={`pe-puff ${k}`} style={{ backgroundImage: `url(${BASE}${packPath('fx/steam-puff.png')})` }} />)}
              </>
            )}
          </div>
        )}
        {scene.id === 'success' && family && (
          <div className="pe-full pe-pan-x"><img className="pe-bg" src={family} alt="가족 여섯 명이 고나의 성공에 저마다 환호하는 그림" /></div>
        )}
        {scene.id === 'epi' && P('ending/epilogue.jpg') && (
          <div className="pe-full pe-epi"><img className="pe-bg" src={P('ending/epilogue.jpg')!} alt="노을 지는 아기방에서 편히 잠든 고나" /><i className="pe-sparkle" /></div>
        )}
        {scene.id === 'hug' && hug2 && (
          <div className={`pe-full pe-hug2${lastLine ? ' framed' : ''}`}>
            <img className="pe-bg" src={hug2} alt="온 가족이 고나를 가운데 두고 꼭 끌어안은 그림" />
            <div className="pe-hearts">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ left: `${8 + i * 10}%`, animationDelay: `${(i % 4) * 0.35}s`, backgroundImage: `url(${BASE}${packPath('fx/heal-heart.png', 'v2/fx/heart-p.png')})` }} />)}</div>
          </div>
        )}
        {scene.id === 'hug' && hugImg && !hug2 && (
          <div className="pe-family hug pe-hugart">
            <img className="pe-bg" src={hugImg} alt="온 가족이 고나를 꼭 안아 주는 그림" />
            <div className="pe-hearts">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ left: `${8 + i * 10}%`, animationDelay: `${(i % 4) * 0.35}s`, backgroundImage: `url(${BASE}${packPath('fx/heal-heart.png', 'v2/fx/heart-p.png')})` }} />)}</div>
          </div>
        )}
        {((scene.id === 'success' && !family) || (scene.id === 'hug' && !hugImg && !hug2)) && (
          <div className={`pe-family${scene.id === 'hug' ? ' hug' : ''}`}>
            {FAMILY.map((f, i) => (
              <img key={f} className={`pe-f f${i}${who.startsWith(`${nm(f)}|`) ? ' talk' : ''}`} src={`${BASE}${packPath(`chars/${f}/illust.png`)}`} alt={nm(f)} />
            ))}
            <img className={`pe-f pe-center${who.startsWith('고나|') ? ' talk' : ''}${cheerImg ? ' px' : ''}`} src={cheerImg ?? gonaImg} alt="고나" />
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
