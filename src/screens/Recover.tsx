import { useRef, useState } from 'react';
import { BACKUP_ERROR_MESSAGES, BACKUP_MAX_BYTES, parseBackup } from '../platform/backup';
import { usePlayer } from '../platform/PlayerContext';
import ConfirmDialog from '../ui/ConfirmDialog';
import PixelButton from '../ui/PixelButton';

/** 저장 데이터가 손상됐을 때의 안내 화면 */
export default function Recover({ newer, onDone }: { newer: boolean; onDone: () => void }) {
  const { restore, discardCorrupt } = usePlayer();
  const fileRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [askNew, setAskNew] = useState(false);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > BACKUP_MAX_BYTES) return setErr(BACKUP_ERROR_MESSAGES['too-large']);
    const r = parseBackup(await f.text());
    if (!r.ok) return setErr(BACKUP_ERROR_MESSAGES[r.error]);
    restore(r.player);
    onDone();
  };

  return (
    <div className="p-reg p-screen">
      <div className="p-scroll" style={{ justifyContent: 'center' }}>
        <div className="p-ribbon">SAVE ERROR</div>
        <section className="p-panel">
          <h3>{newer ? '더 새로운 버전의 기록이에요' : '저장된 기록을 읽을 수 없어요'}</h3>
          <p className="p-muted">
            {newer
              ? '이 기기의 기록은 더 새로운 버전의 게임천국에서 만들어졌어요. 새로 시작하면 이 기기의 기존 기록이 삭제돼요. 백업 파일이 있으면 복원할 수 있어요.'
              : '이 기기에 저장된 플레이어 정보가 손상됐어요. 백업 파일이 있으면 복원할 수 있고, 없으면 새로 시작할 수 있어요. (손상된 원본은 지우지 않고 보관해요)'}
          </p>
        </section>
        {err && <div className="p-notice">{err}</div>}
        <PixelButton big block onClick={() => fileRef.current?.click()}>
          백업 파일로 복원
        </PixelButton>
        <PixelButton variant="sub" block onClick={() => setAskNew(true)}>
          새로 시작하기
        </PixelButton>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {askNew && (
        <ConfirmDialog
          title="새로 시작할까요?"
          text="손상된 기록은 사용할 수 없어요. 새 플레이어를 만들어요."
          okLabel="새로 시작"
          onCancel={() => setAskNew(false)}
          onOk={() => {
            discardCorrupt();
            onDone();
          }}
        />
      )}
    </div>
  );
}
