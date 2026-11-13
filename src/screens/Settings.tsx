import { useRef, useState } from 'react';
import { BACKUP_ERROR_MESSAGES, BACKUP_MAX_BYTES, parseBackup } from '../platform/backup';
import { usePlayer } from '../platform/PlayerContext';
import type { PlayerData } from '../platform/types';
import { muted, setMuted } from '../sfx';
import ConfirmDialog from '../ui/ConfirmDialog';
import PixelButton from '../ui/PixelButton';
import PixelPanel from '../ui/PixelPanel';
import { AvatarEditor, NicknameEditor } from './Profile';
import { canVibrate } from '../platform/haptics';
import { DEV_SIM, simulateResult } from '../platform/devsim';

type Dlg =
  | { t: 'nick' }
  | { t: 'avatar' }
  | { t: 'info'; title: string; text: string }
  | { t: 'restore'; player: PlayerData }
  | { t: 'reset1' }
  | { t: 'reset2' };

export default function Settings({ onBack, onToast, onReset }: { onBack: () => void; onToast: (t: string) => void; onReset: () => void }) {
  const { player, restore, reset, exportText, persistent, updateSettings, storage, consume } = usePlayer();
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
          <div className="p-setrow">
            <span>
              진동 {!canVibrate() && <span className="p-chip">미지원 기기</span>}
            </span>
            <button type="button" className={`p-toggle${player.settings.vibration && canVibrate() ? ' on' : ''}`} role="switch" aria-checked={player.settings.vibration && canVibrate()} aria-label="진동" disabled={!canVibrate()} onClick={() => updateSettings({ vibration: !player.settings.vibration })} />
          </div>
          <div className="p-setrow">
            <span>모션 줄이기</span>
            <button type="button" className={`p-toggle${player.settings.reduceMotion ? ' on' : ''}`} role="switch" aria-checked={player.settings.reduceMotion} aria-label="모션 줄이기" onClick={() => updateSettings({ reduceMotion: !player.settings.reduceMotion })} />
          </div>
          <p className="p-muted">iPhone Safari는 화면을 한 번 터치한 뒤에 소리가 나요. 배경음은 아직 없어서 나중에 켜져요. 진동은 지원하는 기기에서만 동작해요.</p>
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
        <PixelPanel title="데이터 초기화">
          <p className="p-muted">닉네임·플레이어 기록을 모두 지우고 처음부터 시작해요. 소리 설정과 오프닝 기록은 그대로 남아요.</p>
          <PixelButton small variant="danger" block style={{ marginTop: 8 }} onClick={() => setDlg({ t: 'reset1' })}>
            초기화
          </PixelButton>
        </PixelPanel>
        {DEV_SIM && (
          <PixelPanel title="개발용 시뮬레이터 (운영 빌드에는 없음)">
            <p className="p-muted">Food 패치가 적용되기 전에 결과 수신·보상 흐름을 확인하는 도구예요. 실제 게임과 똑같은 방식으로 결과를 inbox 에 넣어요.</p>
            <div className="p-row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
              <PixelButton small variant="sub" onClick={() => { simulateResult(storage, player, { score: 3200 + Math.floor(Math.random() * 3000), stage: 2, cleared: false }); void consume(); }}>게임 오버 결과</PixelButton>
              <PixelButton small variant="sub" onClick={() => { simulateResult(storage, player, { score: 21000, stage: 4, cleared: true, durationSec: 540 }); void consume(); }}>클리어 결과</PixelButton>
            </div>
          </PixelPanel>
        )}
        <PixelPanel title="게임 정보">
          <p className="p-muted">고나 게임천국 · 플레이어 데이터 v2 · {player.publicCode}. 기록은 이 기기의 로컬 저장소에만 있고 온라인 검증·조작 방지는 적용되지 않아요.</p>
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
