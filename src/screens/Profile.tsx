import { useEffect, useState } from 'react';
import PixelIcon from '../components/PixelIcon';
import { ACHIEVEMENTS, TITLES, isTitleUnlocked, unlockedTitles } from '../platform/content';
import { getAvatar } from '../platform/avatars';
import { GAMES } from '../platform/games';
import { checkNickname } from '../platform/nickname';
import { usePlayer } from '../platform/PlayerContext';
import { xpProgress } from '../platform/progression';
import type { GameRecord, PlayerData } from '../platform/types';
import Avatar from '../ui/Avatar';
import AvatarSelector from '../ui/AvatarSelector';
import { NamePlate, Portrait, TitlePlate, equippedStyle } from '../ui/Cosmetics';
import NicknameField from '../ui/NicknameField';
import PixelButton from '../ui/PixelButton';
import PixelModal from '../ui/PixelModal';
import PixelPanel from '../ui/PixelPanel';

export const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};
export const fmtTime = (sec: number): string => (sec >= 3600 ? `${Math.floor(sec / 3600)}시간 ${Math.floor((sec % 3600) / 60)}분` : sec >= 60 ? `${Math.floor(sec / 60)}분 ${sec % 60}초` : `${sec}초`);

/** 닉네임 변경 모달 (저장/취소 · 취소하면 기존 정보 유지) */
export function NicknameEditor({ player, onClose, onSaved }: { player: PlayerData; onClose: () => void; onSaved: () => void }) {
  const { updateProfile } = usePlayer();
  const [v, setV] = useState(player.nickname);
  const ok = checkNickname(v).ok;
  const save = () => {
    if (ok && updateProfile({ nickname: v })) onSaved();
  };
  return (
    <PixelModal title="닉네임 변경" onClose={onClose}>
      <NicknameField value={v} onChange={setV} onEnter={save} autoFocus />
      <p className="p-muted">닉네임을 바꿔도 기록과 식별코드(#{player.publicCode})는 그대로예요.</p>
      <div className="p-row">
        <PixelButton variant="sub" className="fill" onClick={onClose}>취소</PixelButton>
        <PixelButton className="fill" disabled={!ok || v === player.nickname} onClick={save}>저장</PixelButton>
      </div>
    </PixelModal>
  );
}

export function AvatarEditor({ player, onClose, onSaved }: { player: PlayerData; onClose: () => void; onSaved: () => void }) {
  const { updateProfile } = usePlayer();
  const [v, setV] = useState(player.avatarId);
  const a = getAvatar(v);
  return (
    <PixelModal title="아바타 변경" onClose={onClose}>
      <div className="p-row">
        <Avatar id={v} size={56} />
        <div><b style={{ fontSize: 15 }}>{a.name}</b><p className="p-muted">{a.desc}</p></div>
      </div>
      <AvatarSelector value={v} onChange={setV} unlocked={player.unlockedAvatarIds} />
      <div className="p-row">
        <PixelButton variant="sub" className="fill" onClick={onClose}>취소</PixelButton>
        <PixelButton className="fill" disabled={v === player.avatarId} onClick={() => updateProfile({ avatarId: v }) && onSaved()}>저장</PixelButton>
      </div>
    </PixelModal>
  );
}

/** 칭호 변경: 획득한 칭호만 선택 가능, 미획득은 잠금 + 조건 표시 */
export function TitleEditor({ player, onClose, onSaved }: { player: PlayerData; onClose: () => void; onSaved: () => void }) {
  const { setTitle } = usePlayer();
  return (
    <PixelModal title="칭호 변경" onClose={onClose}>
      <div className="p-list" style={{ maxHeight: 330, overflowY: 'auto' }}>
        {TITLES.map((t) => {
          const ok = isTitleUnlocked(player, t);
          return (
            <button key={t.id} type="button" disabled={!ok} className={`p-item${ok ? '' : ' lock'}`} style={{ textAlign: 'left', opacity: ok ? 1 : 0.8, cursor: ok ? 'pointer' : 'not-allowed' }} aria-pressed={player.titleId === t.id} onClick={() => ok && setTitle(t.id) && onSaved()}>
              <span className="ic"><PixelIcon name={ok ? 'star' : 'lock'} size={3} /></span>
              <div><b>{t.name}{player.titleId === t.id ? ' ✔' : ''}</b><p>{ok ? t.desc : `🔒 ${t.desc}`}</p></div>
              <span className={`p-chip ${ok ? 'ok' : ''}`}>{ok ? (player.titleId === t.id ? '장착중' : '장착') : '잠금'}</span>
            </button>
          );
        })}
      </div>
      <PixelButton variant="sub" block onClick={onClose}>닫기</PixelButton>
    </PixelModal>
  );
}

function PinPicker({ player, onClose }: { player: PlayerData; onClose: () => void }) {
  const { pinAchievement } = usePlayer();
  const got = ACHIEVEMENTS.filter((a) => player.achievements[a.id]);
  return (
    <PixelModal title="대표 업적 선택" onClose={onClose}>
      {got.length === 0 ? <p className="p-muted">아직 달성한 업적이 없어요.</p> : (
        <div className="p-list" style={{ maxHeight: 300, overflowY: 'auto' }}>
          {got.map((a) => (
            <button key={a.id} type="button" className="p-item" style={{ textAlign: 'left' }} onClick={() => { pinAchievement(a.id); onClose(); }}>
              <span className="ic"><PixelIcon name="star" size={3} /></span>
              <div><b>{a.name}</b><p>{a.desc}</p></div>
              <span className="p-chip">{player.pinnedAchievement === a.id ? '대표' : '선택'}</span>
            </button>
          ))}
        </div>
      )}
      <div className="p-row">
        {player.pinnedAchievement && <PixelButton variant="sub" className="fill" onClick={() => { pinAchievement(undefined); onClose(); }}>대표 해제</PixelButton>}
        <PixelButton variant="sub" className="fill" onClick={onClose}>닫기</PixelButton>
      </div>
    </PixelModal>
  );
}

function RecordRow({ rec, name }: { rec: GameRecord; name: string }) {
  return (
    <div className="p-panel" style={{ padding: 8, boxShadow: 'var(--notch)', background: '#fff' }}>
      <b style={{ fontSize: 12 }}>{name}</b>
      <div className="p-grid4" style={{ marginTop: 6 }}>
        <div className="p-stat"><b>{rec.bestScore.toLocaleString('ko-KR')}</b><span>최고 점수</span></div>
        <div className="p-stat"><b>{rec.plays}회</b><span>플레이</span></div>
        <div className="p-stat"><b>{rec.clears}회</b><span>클리어</span></div>
        <div className="p-stat"><b>{rec.bestStage ? `${rec.bestStage}단계` : '—'}</b><span>최고 단계</span></div>
      </div>
      <p className="p-muted" style={{ marginTop: 6 }}>{rec.bestStageLabel ? `${rec.bestStageLabel} · ` : ''}총 {fmtTime(rec.totalPlayTimeSec)} · 첫 플레이 {fmtDate(rec.firstPlayedAt)} · 마지막 {fmtDate(rec.lastPlayedAt)}</p>
    </div>
  );
}

export default function Profile({ onToast, onOpenMore }: { onToast: (t: string) => void; onOpenMore: (id: 'achievements' | 'shop' | 'codex') => void }) {
  const { player, persistent, visit } = usePlayer();
  const [edit, setEdit] = useState<'nick' | 'avatar' | 'title' | 'pin' | null>(null);
  useEffect(() => visit('profile'), []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!player) return null;
  const xp = xpProgress(player.playerLevel, player.totalXP);
  const recs = GAMES.map((g) => ({ g, rec: player.gameRecords[g.gameId] }));
  const pinned = ACHIEVEMENTS.find((a) => a.id === player.pinnedAchievement);
  const achCount = Object.keys(player.achievements).length;
  return (
    <div className="p-screen">
      <div className="p-scroll">
        <div className={`p-pcard sh-background-${equippedStyle(player, 'background')}`}>
          <Portrait p={player} size={76} />
          <div className="p-info">
            <div className="p-nameplate"><NamePlate p={player} /><span className="p-chip blue">#{player.publicCode}</span></div>
            <TitlePlate p={player} />
            <div className="p-xp">
              <span className="p-bar-xp" role="progressbar" aria-valuenow={xp.into} aria-valuemax={xp.need} aria-label="경험치"><i style={{ width: `${Math.round(xp.ratio * 100)}%` }} /></span>
              <small>LV {player.playerLevel} · XP {xp.into} / {xp.need}</small>
            </div>
            <div className="p-coinline"><PixelIcon name="coin" size={1.5} />{player.coinBalance.toLocaleString('ko-KR')}<small>고나 코인</small></div>
          </div>
        </div>
        <div className="p-row">
          <PixelButton small variant="sub" className="fill" onClick={() => setEdit('title')}>칭호</PixelButton>
          <PixelButton small variant="sub" className="fill" onClick={() => setEdit('nick')}>닉네임</PixelButton>
          <PixelButton small variant="sub" className="fill" onClick={() => setEdit('avatar')}>아바타</PixelButton>
          <PixelButton small variant="sub" className="fill" onClick={() => onOpenMore('shop')}>꾸미기</PixelButton>
        </div>
        <PixelPanel title="대표 업적" right={<PixelButton small variant="sub" onClick={() => setEdit('pin')}>변경</PixelButton>}>
          {pinned ? (
            <div className="p-item" style={{ background: '#fff7c8' }}>
              <span className="ic"><PixelIcon name="star" size={3} /></span>
              <div><b>{pinned.name}</b><p>{pinned.desc}</p></div>
              <span className="p-chip ok">달성</span>
            </div>
          ) : <p className="p-muted">대표 업적을 아직 정하지 않았어요. 달성한 업적 중에서 고를 수 있어요.</p>}
        </PixelPanel>
        <PixelPanel title="게임 기록">
          <div className="p-list">
            {recs.map(({ g, rec }) =>
              rec ? <RecordRow key={g.gameId} rec={rec} name={g.name} /> : (
                <div key={g.gameId} className="p-row" style={{ background: '#fff', border: '2px solid var(--ink)', padding: '7px 8px' }}>
                  <b style={{ flex: 1, fontSize: 11 }}>{g.name}</b>
                  {g.status === 'soon' ? <span className="p-chip soon">COMING SOON</span> : <span className="p-muted">아직 기록 없음{g.link === 'pending' ? ' · 연동 준비 중' : ''}</span>}
                </div>
              ),
            )}
          </div>
        </PixelPanel>
        <PixelPanel title="내 활동">
          <div className="p-grid3">
            <div className="p-stat"><b>{player.stats.totalPlayCount}회</b><span>누적 플레이</span></div>
            <div className="p-stat"><b>{Object.values(player.gameRecords).reduce((a, r) => a + r.clears, 0)}회</b><span>클리어</span></div>
            <div className="p-stat"><b>{fmtTime(player.stats.totalPlayTimeSec)}</b><span>총 플레이 시간</span></div>
            <div className="p-stat"><b>{achCount} / {ACHIEVEMENTS.length}</b><span>업적</span></div>
            <div className="p-stat"><b>{unlockedTitles(player).length} / {TITLES.length}</b><span>칭호</span></div>
            <div className="p-stat"><b>{Object.keys(player.codex).length}</b><span>도감</span></div>
          </div>
          <div className="p-row" style={{ marginTop: 8 }}>
            <PixelButton small variant="sub" className="fill" onClick={() => onOpenMore('achievements')}>업적 보기</PixelButton>
            <PixelButton small variant="sub" className="fill" onClick={() => onOpenMore('codex')}>도감 보기</PixelButton>
          </div>
        </PixelPanel>
        <PixelPanel title="내 정보">
          <p className="p-muted">가입일 {fmtDate(player.createdAt)} · {persistent ? '이 기기에 저장돼 있어요 (온라인 미연결).' : '이 브라우저에서는 저장이 막혀 있어요.'}</p>
        </PixelPanel>
      </div>
      {edit === 'nick' && <NicknameEditor player={player} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); onToast('닉네임을 바꿨어요'); }} />}
      {edit === 'avatar' && <AvatarEditor player={player} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); onToast('아바타를 바꿨어요'); }} />}
      {edit === 'title' && <TitleEditor player={player} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); onToast('칭호를 바꿨어요'); }} />}
      {edit === 'pin' && <PinPicker player={player} onClose={() => setEdit(null)} />}
    </div>
  );
}
