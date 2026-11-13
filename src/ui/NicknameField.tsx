import { checkNickname, NICKNAME_MESSAGES, NICK_MAX, NICK_MIN } from '../platform/nickname';

/** 이름 입력 칸 + 10칸 글자 슬롯 + 실시간 규칙 표시 */
export default function NicknameField({ value, onChange, onEnter, autoFocus }: { value: string; onChange: (v: string) => void; onEnter?: () => void; autoFocus?: boolean }) {
  const chk = checkNickname(value);
  const chars = [...value.normalize('NFC')];
  const touched = value.length > 0;
  return (
    <div className="p-field">
      <label className="p-muted" htmlFor="gp-nick">
        닉네임 · 한글·영문·숫자 {NICK_MIN}~{NICK_MAX}자
      </label>
      <input
        id="gp-nick"
        className={touched && !chk.ok ? 'bad' : ''}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="next"
        maxLength={20}
        placeholder="이름 입력"
        autoFocus={autoFocus}
        aria-invalid={touched && !chk.ok}
        aria-describedby="gp-nick-err"
      />
      <div className="p-slots" aria-hidden>
        {Array.from({ length: NICK_MAX }, (_, i) => (
          <i key={i} className={i === chars.length ? 'cur' : ''}>
            {chars[i] ?? ''}
          </i>
        ))}
      </div>
      <p id="gp-nick-err" className="p-error" role="alert">
        {touched && !chk.ok ? NICKNAME_MESSAGES[chk.error!] : ''}
      </p>
      <div className="p-hint">
        <i className={chk.length >= NICK_MIN && chk.length <= NICK_MAX ? 'ok' : touched ? 'bad' : ''}>
          {chk.length}/{NICK_MAX}자
        </i>
        <i>중복 닉네임 가능</i>
      </div>
    </div>
  );
}
