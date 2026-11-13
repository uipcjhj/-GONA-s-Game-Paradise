import { useState } from 'react';
import PixelIcon from '../components/PixelIcon';
import { getAvatar } from '../platform/avatars';
import { checkNickname } from '../platform/nickname';
import { usePlayer } from '../platform/PlayerContext';
import { xpProgress } from '../platform/progression';
import { GAMES } from '../platform/registry';
import { portraitStyle, titleName } from '../ui/cosmetics';
import { fmtDate, fmtDuration, fmtScore } from '../ui/format';
import type { PlayerData } from '../platform/types';
import Avatar from '../ui/Avatar';
import AvatarSelector from '../ui/AvatarSelector';
import NicknameField from '../ui/NicknameField';
import PixelButton from '../ui/PixelButton';
import PixelModal from '../ui/PixelModal';
import PixelPanel from '../ui/PixelPanel';

export { fmtDate };

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
        <PixelButton variant="sub" className="fill" onClick={onClose}>
          취소
        </PixelButton>
        <PixelButton className="fill" disabled={!ok || v === player.nickname} onClick={save}>
          저장
        </PixelButton>
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
        <div>
          <b style={{ fontSize: 15 }}>{a.name}</b>
          <p className="p-muted">{a.desc}</p>
        </div>
      </div>
      <AvatarSelector value={v} onChange={setV} unlocked={player.unlockedAvatarIds} />
      <div className="p-row">
        <PixelButton variant="sub" className="fill" onClick={onClose}>
          취소
        </PixelButton>
        <PixelButton
          className="fill"
          disabled={v === player.avatarId}
          onClick={() => {
            if (updateProfile({ avatarId: v })) onSaved();
          }}
        >
          저장
        </PixelButton>
      </div>
    </PixelModal>
  );
}

export default function Profile({ onToast }: { onToast: (t: string) => void }) {
  const { player, persistent } = usePlayer();
  const [edit, setEdit] = useState<'nick' | 'avatar' | null>(null);
  if (!player) return null;
  const xp = xpProgress(player.playerLevel, player.totalXP);
  const recorded = GAMES.filter((g) => (player.gameRecords[g.gameId]?.plays ?? 0) > 0 || (player.gameRecords[g.gameId]?.bestScore ?? 0) > 0);
  return (
    <div className="p-screen">
      <div className="p-scroll">
        <div className="p-pcard">
          <div className="p-portrait" style={portraitStyle(player)} data-testid="portrait">
            <Avatar id={player.avatarId} size={76} className="" />
            <span className="p-lvbadge">
              LV<b>{player.playerLevel}</b>
            </span>
          </div>
          <div className="p-info">
            <div className="p-nameplate">
              <b>{player.nickname}</b>
              <span className="p-chip blue">#{player.publicCode}</span>
            </div>
            {titleName(player) && (
              <span className="p-chip gold" data-testid="title-chip">
                {titleName(player)}
              </span>
            )}
            <div className="p-xp">
              <span className="p-bar-xp" role="progressbar" aria-valuenow={xp.into} aria-valuemax={xp.need} aria-label="경험치">
                <i style={{ width: `${Math.round(xp.ratio * 100)}%` }} />
              </span>
              <small>
                XP {xp.into} / {xp.need}
              </small>
            </div>
            <div className="p-coinline">
              <PixelIcon name="coin" size={1.5} />
              {player.coinBalance.toLocaleString('ko-KR')}
              <small>고나 코인</small>
            </div>
          </div>
        </div>
        <div className="p-row">
          <PixelButton small variant="sub" className="fill" onClick={() => setEdit('nick')}>
            닉네임 변경
          </PixelButton>
          <PixelButton small variant="sub" className="fill" onClick={() => setEdit('avatar')}>
            아바타 변경
          </PixelButton>
        </div>
        <PixelPanel title="내 정보">
          <p className="p-muted">가입일 {fmtDate(player.createdAt)}</p>
          <p className="p-muted">{persistent ? '이 기기에 저장돼 있어요 (온라인 미연결).' : '이 브라우저에서는 저장이 막혀 있어요.'}</p>
        </PixelPanel>
        <PixelPanel title="통계">
          <div className="p-stats" data-testid="stats">
            <div className="p-stat">
              <b>{player.totalPlayCount}</b>
              <span>총 플레이</span>
            </div>
            <div className="p-stat">
              <b>{player.stats.clears ?? 0}</b>
              <span>클리어</span>
            </div>
            <div className="p-stat">
              <b>{fmtDuration(player.totalPlayTimeSec)}</b>
              <span>플레이 시간</span>
            </div>
            <div className="p-stat">
              <b>
                {Object.keys(player.achievements).length}
              </b>
              <span>업적</span>
            </div>
          </div>
        </PixelPanel>
        <PixelPanel title="게임 기록">
          {recorded.length === 0 ? (
            <p className="p-muted" data-testid="no-records">
              아직 기록이 없어요. 게임을 끝까지 하면 여기에 쌓여요.
            </p>
          ) : (
            recorded.map((g) => <RecordRows key={g.gameId} gameId={g.gameId} name={g.name} player={player} />)
          )}
        </PixelPanel>
      </div>
      {edit === 'nick' && (
        <NicknameEditor
          player={player}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            onToast('닉네임을 바꿨어요');
          }}
        />
      )}
      {edit === 'avatar' && (
        <AvatarEditor
          player={player}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            onToast('아바타를 바꿨어요');
          }}
        />
      )}
    </div>
  );
}

/** 게임 한 개의 기록 줄(하위 게임이 있으면 각각) */
export function RecordRows({ gameId, name, player }: { gameId: string; name: string; player: PlayerData }) {
  const rec = player.gameRecords[gameId];
  if (!rec) return null;
  const subs = rec.subGames ? Object.entries(rec.subGames) : [];
  const line = (key: string, label: string, r: typeof rec) => (
    <div key={key} className="p-recrow" data-testid={`rec-${key}`}>
      <b>{label}</b>
      <span>
        {r.bestScore > 0 ? `최고 ${fmtScore(r.bestScore)}${r.bestScoreSource === 'import' ? ' (가져옴)' : ''}` : '최고 -'} · {r.plays}판 · 클리어 {r.clears}
        {r.bestStage ? ` · ${r.bestStageLabel ?? '단계'} ${r.bestStage}` : ''}
      </span>
    </div>
  );
  return (
    <div className="p-recgroup">
      {subs.length === 0 ? line(gameId, name, rec) : (
        <>
          <p className="p-muted">
            <b>{name}</b> · 총 {rec.plays}판
          </p>
          {subs.map(([id, r]) => line(`${gameId}-${id}`, SUB_NAMES[id] ?? id, r))}
        </>
      )}
    </div>
  );
}
const SUB_NAMES: Record<string, string> = { sort: '편가르기', tower: '아슬아슬 탑', toyroom: '장난감방', challenge: '랜덤 챌린지' };
