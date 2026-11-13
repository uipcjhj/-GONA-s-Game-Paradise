/** 닉네임 규칙: 한글·영문·숫자 2~10자, 공백·특수문자 불가, 중복 허용(playerId 로 구분). */
export const NICK_MIN = 2;
export const NICK_MAX = 10;

/** 초기 금지어 목록(소문자 비교). 운영하면서 보강 — 오탐·미탐 가능 */
const BANNED = ['씨발', '시발', '병신', '지랄', '개새끼', '좆', '섹스', '자살', 'fuck', 'shit', 'bitch', 'sex'];
/** 운영진 사칭 방지 */
const RESERVED = ['운영자', '관리자', '관리인', 'admin', 'system', 'gm'];

export type NicknameError = 'empty' | 'length' | 'space' | 'chars' | 'banned' | 'reserved';
export interface NicknameCheck {
  ok: boolean;
  length: number;
  error?: NicknameError;
}

export const NICKNAME_MESSAGES: Record<NicknameError, string> = {
  empty: '닉네임을 입력해 주세요',
  length: `닉네임은 ${NICK_MIN}~${NICK_MAX}자로 입력해 주세요`,
  space: '공백은 사용할 수 없어요',
  chars: '한글·영문·숫자만 사용할 수 있어요',
  banned: '사용할 수 없는 표현이에요',
  reserved: '사용할 수 없는 닉네임이에요',
};

export function nicknameLength(s: string): number {
  return [...s.normalize('NFC')].length;
}

const ALLOWED = /^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]+$/;

export function checkNickname(raw: string): NicknameCheck {
  const s = raw.normalize('NFC');
  const length = nicknameLength(s);
  if (length === 0) return { ok: false, length, error: 'empty' };
  if (/\s/u.test(s)) return { ok: false, length, error: 'space' };
  if (!ALLOWED.test(s)) return { ok: false, length, error: 'chars' };
  if (length < NICK_MIN || length > NICK_MAX) return { ok: false, length, error: 'length' };
  const low = s.toLowerCase();
  if (BANNED.some((w) => low.includes(w))) return { ok: false, length, error: 'banned' };
  if (RESERVED.includes(low)) return { ok: false, length, error: 'reserved' };
  return { ok: true, length };
}
