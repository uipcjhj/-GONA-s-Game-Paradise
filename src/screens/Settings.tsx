import { useRef, useState } from 'react';
import { importFoodBest } from '../platform/importFood';
import { BACKUP_ERROR_MESSAGES, BACKUP_MAX_BYTES, parseBackup } from '../platform/backup';
import { usePlayer } from '../platform/PlayerContext';
import type { PlayerData } from '../platform/types';
import { muted, setMuted } from '../sfx';
import ConfirmDialog from '../ui/ConfirmDialog';
import PixelButton from '../ui/PixelButton';
import PixelPanel from '../ui/PixelPanel';
import { AvatarEditor, NicknameEditor } from './Profile';

type Dlg =
  | { t: 'nick' }
  | { t: 'avatar' }
  | { t: 'info'; title: string; text: string }
  | { t: 'restore'; player: PlayerData }
  | { t: 'import'; score: number; stage?: number }
  | { t: 'reset1' }
  | { t: 'reset2' };

export default function Settings({ onBack, onToast, onReset }: { onBack: () => void; onToast: (t: string) => void; onReset: () => void }) {
  const { player, restore, reset, exportText, persistent, updateSettings, importPrevious, pendingInbox, rejectedCount } = usePlayer();
  const [sfxOff, setSfxOff] = useState(muted());
  const [dlg, setDlg] = useState<Dlg | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!player) return null;

  const doBackup = () => {
    const b = exportText();
    if (!b) return;
    const url = URL.createObjectURL(new Blob([b.text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = b.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    onToast('백업 파일을 만들었어요');
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > BACKUP_MAX_BYTES) return setDlg({ t: 'info', title: '복원할 수 없어요', text: BACKUP_ERROR_MESSAGES['too-large'] });
    let text = '';
    try {
      text = await f.text();
    } catch {
      return setDlg({ t: 'info', title: '복원할 수 없어요', text: '파일을 읽지 못했어요.' });
    }
    const r = parseBackup(text);
    if (!r.ok) return setDlg({ t: 'info', title: '복원할 수 없어요', text: BACKUP_ERROR_MESSAGES[r.error] });
    setDlg({ t: 'restore', player: r.player });
  };

  return (
    <div className="p-screen">
      <div className="p-bar">
        <button type="button" className="p-back" onClick={onBack} aria-label="뒤로">
          ‹
        </button>
        <h2>설정</h2>
      </div>
      <div className="p-scroll">
        <PixelPanel title="소리">
          <div className="p-setrow">
            <span>효과음</span>
            <button type="button" className={`p-toggle${sfxOff ? '' : ' on'}`} role="switch" aria-checked={!sfxOff} aria-label="효과음" onClick={() => { setMuted(!sfxOff); setSfxOff(!sfxOff); }} />
          </div>
          <div className="p-setrow">
            <span>
              BGM <span className="p-chip soon">준비 중</span>
            </span>
            <button type="button" className={`p-toggle${player.settings.bgm ? ' on' : ''}`} role="switch" aria-checked={player.settings.bgm} aria-label="배경음 (준비 중)" disabled />
          </div>
          <p className="p-muted">iPhone Safari는 화면을 한 번 터치한 뒤에 소리가 나요. 배경음은 아직 없어서 나중에 켜져요.</p>
        </PixelPanel>
        <PixelPanel title="화면 · 조작">
          <div className="p-setrow">
            <span>진동</span>
            <button type="button" className={`p-toggle${player.settings.vibration ? ' on' : ''}`} role="switch" aria-checked={player.settings.vibration} aria-label="진동" data-testid="set-vibration" onClick={() => updateSettings({ vibration: !player.settings.vibration })} />
          </div>
          <div className="p-setrow">
            <span>움직임 줄이기</span>
            <button type="button" className={`p-toggle${player.settings.reduceMotion ? ' on' : ''}`} role="switch" aria-checked={player.settings.reduceMotion} aria-label="움직임 줄이기" data-testid="set-motion" onClick={() => updateSettings({ reduceMotion: !player.settings.reduceMotion })} />
          </div>
          <p className="p-muted">게임 안의 진동은 각 게임 설정을 따라요. 게임천국이 직접 쓰는 진동은 아직 없어서 선택만 저장해 둬요.</p>
        </PixelPanel>
        <PixelPanel title="내 정보">
          <div className="p-row">
            <PixelButton small variant="sub" className="fill" onClick={() => setDlg({ t: 'nick' })}>
              닉네임 변경
            </PixelButton>
            <PixelButton small variant="sub" className="fill" onClick={() => setDlg({ t: 'avatar' })}>
              아바타 변경
            </PixelButton>
          </div>
        </PixelPanel>
        <PixelPanel title="데이터 백업 · 복원">
          <p className="p-muted">기기를 바꾸거나 브라우저 데이터를 지우면 기록이 사라질 수 있어요. 파일로 보관해 두세요. {persistent ? '' : '(지금은 이 브라우저에 저장이 막혀 있어요.)'}</p>
          <div className="p-row" style={{ marginTop: 8 }}>
            <PixelButton small variant="sub" className="fill" onClick={doBackup}>
              파일로 백업
            </PixelButton>
            <PixelButton small variant="sub" className="fill" onClick={() => fileRef.current?.click()}>
              파일로 복원
            </PixelButton>
          </div>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </PixelPanel>
        <PixelPanel title="게임 기록 연동">
          <p className="p-muted" data-testid="sync-info">
            연동 대기 중인 결과 {pendingInbox()}개 · 이번에 걸러진 결과 {rejectedCount}개
          </p>
          <PixelButton
            small
            variant="sub"
            block
            style={{ marginTop: 8 }}
            data-testid="import-food"
            onClick={() => {
              const f = importFoodBest();
              if (!f) return setDlg({ t: 'info', title: '가져올 기록이 없어요', text: '이 기기에서 GONA’s Food Adventure 의 이전 최고 기록을 찾지 못했어요.' });
              if (player.stats['import:food-island']) return setDlg({ t: 'info', title: '이미 가져왔어요', text: '이전 기록 가져오기는 한 번만 할 수 있어요.' });
              setDlg({ t: 'import', score: f.score, stage: f.stage });
            }}
          >
            이전 Food 최고 기록 가져오기
          </PixelButton>
          <p className="p-muted">Food 의 기록은 읽기만 하고 그대로 두어요. 가져온 기록은 ‘가져옴’으로 표시돼요.</p>
        </PixelPanel>
        <PixelPanel title="데이터 초기화">
          <p className="p-muted">닉네임·플레이어 기록을 모두 지우고 처음부터 시작해요. 소리 설정과 오프닝 기록은 그대로 남아요.</p>
          <PixelButton small variant="danger" block style={{ marginTop: 8 }} onClick={() => setDlg({ t: 'reset1' })}>
            초기화
          </PixelButton>
        </PixelPanel>
        <PixelPanel title="게임 정보">
          <p className="p-muted">고나 게임천국 · 플레이어 데이터 v1 · {player.publicCode}</p>
        </PixelPanel>
      </div>
      {dlg?.t === 'nick' && <NicknameEditor player={player} onClose={() => setDlg(null)} onSaved={() => { setDlg(null); onToast('닉네임을 바꿨어요'); }} />}
      {dlg?.t === 'avatar' && <AvatarEditor player={player} onClose={() => setDlg(null)} onSaved={() => { setDlg(null); onToast('아바타를 바꿨어요'); }} />}
      {dlg?.t === 'info' && <ConfirmDialog title={dlg.title} text={dlg.text} cancelLabel={null} onOk={() => setDlg(null)} onCancel={() => setDlg(null)} />}
      {dlg?.t === 'restore' && (
        <ConfirmDialog
          title="백업으로 덮어쓸까요?"
          text={`지금 기록(${player.nickname} #${player.publicCode})이 백업의 기록(${dlg.player.nickname} #${dlg.player.publicCode})으로 바뀌어요. 이 작업은 되돌릴 수 없어요.`}
          okLabel="덮어쓰기"
          danger
          onCancel={() => setDlg(null)}
          onOk={() => {
            restore(dlg.player);
            setDlg(null);
            onToast('백업을 복원했어요');
          }}
        />
      )}
      {dlg?.t === 'import' && (
        <ConfirmDialog
          title="이전 기록을 가져올까요?"
          text={`Food Adventure 최고 ${dlg.score.toLocaleString('ko-KR')}점${dlg.stage ? ` (단계 ${dlg.stage})` : ''}을 내 기록으로 한 번만 가져와요. Food 의 원래 기록은 바뀌지 않아요.`}
          okLabel="가져오기"
          onCancel={() => setDlg(null)}
          onOk={() => {
            const ok = importPrevious('food-island', dlg.score, dlg.stage);
            setDlg(null);
            onToast(ok ? '이전 기록을 가져왔어요' : '가져올 수 없어요');
          }}
        />
      )}
      {dlg?.t === 'reset1' && <ConfirmDialog title="정말 초기화할까요?" text="닉네임과 모든 플레이어 기록이 삭제돼요." okLabel="계속" danger onCancel={() => setDlg(null)} onOk={() => setDlg({ t: 'reset2' })} />}
      {dlg?.t === 'reset2' && (
        <ConfirmDialog
          title="마지막 확인"
          text="삭제하면 되돌릴 수 없어요. 백업 파일이 없다면 기록을 복구할 수 없어요. 정말 삭제할까요?"
          okLabel="모두 삭제"
          danger
          onCancel={() => setDlg(null)}
          onOk={() => {
            reset();
            setDlg(null);
            onReset();
          }}
        />
      )}
    </div>
  );
}
