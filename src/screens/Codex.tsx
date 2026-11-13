import { useState } from 'react';
import PixelIcon from '../components/PixelIcon';
import { CODEX, CODEX_CATEGORIES, type CodexDef } from '../platform/codex';
import { usePlayer } from '../platform/PlayerContext';
import Avatar from '../ui/Avatar';
import PixelModal from '../ui/PixelModal';
import SubBar from '../ui/SubBar';
import { fmtDate } from '../ui/format';

export default function Codex({ onBack }: { onBack: () => void }) {
  const { player } = usePlayer();
  const [cat, setCat] = useState<string>(CODEX_CATEGORIES[0]);
  const [sel, setSel] = useState<CodexDef | null>(null);
  if (!player) return null;
  const have = (c: CodexDef) => !!player.codex[c.id] || c.unlocked(player);
  const list = CODEX.filter((c) => c.category === cat);
  const total = CODEX.filter(have).length;
  return (
    <div className="p-screen">
      <SubBar title="도감" onBack={onBack} right={`${total}/${CODEX.length}`} />
      <div className="p-scroll">
        <div className="p-tabs" role="tablist">
          {CODEX_CATEGORIES.map((c) => {
            const all = CODEX.filter((x) => x.category === c);
            return (
              <button key={c} type="button" role="tab" aria-selected={cat === c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>
                {c} {all.filter(have).length}/{all.length}
              </button>
            );
          })}
        </div>
        <div className="p-codex" data-testid="codex-grid">
          {list.map((c) => {
            const ok = have(c);
            return (
              <button key={c.id} type="button" className={`p-cx${ok ? '' : ' lock'}`} data-state={ok ? 'open' : 'locked'} data-testid={`codex-${c.id}`} onClick={() => setSel(c)}>
                <span className="p-cx-img">{c.avatar ? <Avatar id={c.avatar} size={52} /> : <PixelIcon name={ok ? 'book' : 'lock'} size={4} />}</span>
                <b>{ok ? c.name : '???'}</b>
              </button>
            );
          })}
        </div>
      </div>
      {sel && (
        <PixelModal title={have(sel) ? sel.name : '???'} onClose={() => setSel(null)}>
          <p className="p-muted">{have(sel) ? sel.desc : `아직 발견하지 못했어요. ${sel.hint}`}</p>
          {have(sel) && player.codex[sel.id] && <p className="p-muted">등록일 {fmtDate(player.codex[sel.id])}</p>}
        </PixelModal>
      )}
    </div>
  );
}
