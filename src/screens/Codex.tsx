import { useEffect, useState } from 'react';
import PixelIcon from '../components/PixelIcon';
import { CODEX, type CodexCategory } from '../platform/content';
import { usePlayer } from '../platform/PlayerContext';
import PixelPanel from '../ui/PixelPanel';
import { fmtDate } from './Profile';

const CATS: CodexCategory[] = ['가족', '몬스터', '보스', '간식', '특별'];

export default function Codex({ onBack }: { onBack: () => void }) {
  const { player, visit } = usePlayer();
  const [cat, setCat] = useState<CodexCategory>('가족');
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => visit('codex'), []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!player) return null;
  const list = CODEX.filter((c) => c.category === cat);
  const got = CODEX.filter((c) => player.codex[c.id]).length;
  const cur = CODEX.find((c) => c.id === sel);
  const curGot = cur && player.codex[cur.id];
  return (
    <div className="p-screen">
      <div className="p-bar"><button type="button" className="p-back" onClick={onBack} aria-label="뒤로">‹</button><h2>도감 CODEX</h2></div>
      <div className="p-scroll">
        <section className="p-panel p-row"><b style={{ flex: 1, fontSize: 13 }}>수집 {got} / {CODEX.length}</b><span className="p-bar-xp" style={{ flex: 2 }}><i style={{ width: `${(got / CODEX.length) * 100}%` }} /></span></section>
        <div className="p-tabs" role="tablist">
          {CATS.map((c) => <button key={c} type="button" role="tab" aria-selected={cat === c} className={cat === c ? 'on' : ''} onClick={() => { setCat(c); setSel(null); }}>{c} {CODEX.filter((x) => x.category === c && player.codex[x.id]).length}/{CODEX.filter((x) => x.category === c).length}</button>)}
        </div>
        <div className="p-codex">
          {list.map((c) => {
            const d = !!player.codex[c.id];
            return (
              <button key={c.id} type="button" className={`p-cx${d ? '' : ' lock'}${sel === c.id ? ' on' : ''}`} onClick={() => setSel(c.id)} aria-label={d ? c.name : '미발견'}>
                <span className="im">{d ? (c.image ? <img src={c.image} alt="" className={c.image.includes('snacks') ? 'px' : ''} draggable={false} /> : <PixelIcon name="star" size={4} />) : <PixelIcon name="question" size={4} />}</span>
                <span className="nm">{d ? c.name : '???'}</span>
              </button>
            );
          })}
        </div>
        <PixelPanel title={cur ? (curGot ? cur.name : '???') : '도감 카드'}>
          {cur ? (
            <>
              <p className="p-muted">{curGot ? cur.desc : '아직 발견하지 못했어요.'}</p>
              <p className="p-muted" style={{ marginTop: 4 }}><b>발견 조건</b> · {cur.condition}</p>
              {curGot ? <p className="p-muted" style={{ marginTop: 4 }}>발견한 날 {fmtDate(curGot.at)}</p> : <span className="p-chip soon" style={{ marginTop: 6 }}>미발견</span>}
              {curGot && !cur.image && <p className="p-muted" style={{ marginTop: 4 }}>대표 이미지는 정식 에셋이 준비되면 추가돼요.</p>}
            </>
          ) : <p className="p-muted">카드를 눌러 설명과 발견 조건을 확인하세요. 모든 항목은 실제 플레이 기록으로만 발견돼요.</p>}
        </PixelPanel>
      </div>
    </div>
  );
}
