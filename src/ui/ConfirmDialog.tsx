import PixelButton from './PixelButton';
import PixelModal from './PixelModal';

export default function ConfirmDialog({ title, text, okLabel = '확인', cancelLabel = '취소', danger, onOk, onCancel }: { title: string; text: string; okLabel?: string; cancelLabel?: string | null; danger?: boolean; onOk: () => void; onCancel: () => void }) {
  return (
    <PixelModal title={title} onClose={onCancel}>
      <p className="p-muted" style={{ fontSize: 12 }}>
        {text}
      </p>
      <div className="p-row">
        {cancelLabel !== null && (
          <PixelButton variant="sub" className="fill" onClick={onCancel}>
            {cancelLabel}
          </PixelButton>
        )}
        <PixelButton variant={danger ? 'danger' : 'primary'} className="fill" onClick={onOk}>
          {okLabel}
        </PixelButton>
      </div>
    </PixelModal>
  );
}
