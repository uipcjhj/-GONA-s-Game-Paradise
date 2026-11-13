import { useEffect, useState } from 'react';
import { AVATARS, DEFAULT_AVATAR_ID, getAvatar, isKnownAvatar } from '../platform/avatars';
import { KEYS } from '../platform/keys';
import { checkNickname } from '../platform/nickname';
import { usePlayer } from '../platform/PlayerContext';
import { useBackLayer } from '../platform/useBackLayer';
import Avatar from '../ui/Avatar';
import AvatarSelector from '../ui/AvatarSelector';
import NicknameField from '../ui/NicknameField';
import PixelButton from '../ui/PixelButton';

interface Draft {
  step: 1 | 2;
  nick: string;
  av: string;
}
function readDraft(): Draft {
  try {
    const d = JSON.parse(sessionStorage.getItem(KEYS.draft) ?? 'null');
    if (d && (d.step === 1 || d.step === 2) && typeof d.nick === 'string' && typeof d.av === 'string') {
      return { step: d.step === 2 && checkNickname(d.nick).ok ? 2 : 1, nick: d.nick.slice(0, 20), av: isKnownAvatar(d.av) ? d.av : DEFAULT_AVATAR_ID };
    }
  } catch {
    /* 초안 없음/손상: 처음부터 */
  }
  return { step: 1, nick: '', av: DEFAULT_AVATAR_ID };
}

const Steps = ({ n }: { n: number }) => (
  <div className="p-steps" aria-label={`${n}/3 단계`}>
    {[1, 2, 3].map((i) => (
      <i key={i} className={i <= n ? 'on' : ''}>
        {i}
      </i>
    ))}
  </div>
);

/** 첫 방문 플레이어 등록 3단계: 이름 → 캐릭터 선택 → 환영. 새로고침해도 초안(sessionStorage)으로 이어짐 */
export default function Register({ onEnter }: { onEnter: () => void }) {
  const { player, register, persistent } = usePlayer();
  const [draft, setDraft] = useState<Draft>(readDraft);
  const [done, setDone] = useState(false); // 3단계(환영)
  const { step, nick, av } = draft;

  useEffect(() => {
    if (done) return;
    try {
      sessionStorage.setItem(KEYS.draft, JSON.stringify(draft));
    } catch {
      /* 무시 */
    }
  }, [draft, done]);

  const goBack = () => (done ? onEnter() : setDraft((d) => ({ ...d, step: 1 })));
  useBackLayer(step === 2 || done, goBack);

  const next = () => checkNickname(nick).ok && setDraft((d) => ({ ...d, step: 2 }));
  const finish = () => {
    if (register(nick, av)) setDone(true);
  };
  const a = getAvatar(av);

  if (done && player) {
    return (
      <div className="p-reg p-screen">
        <div className="p-scroll" style={{ justifyContent: 'center', alignItems: 'stretch' }}>
          <Steps n={3} />
          <div className="p-ribbon">WELCOME!</div>
          <div className="p-hero" style={{ justifyContent: 'center' }}>
            <div className="p-stagebox lg">
              <Avatar id={player.avatarId} size={96} className="p-hop" />
              <i />
            </div>
          </div>
          <div className="p-bubble">
            어서 와, <b>{player.nickname}</b>!<br />
            고나 게임천국에 온 걸 환영해!
          </div>
          <div className="p-idcard">
            <Avatar id={player.avatarId} size={44} />
            <div>
              <b>{player.nickname}</b> <span className="p-chip blue">#{player.publicCode}</span>
              <p className="p-muted">
                {getAvatar(player.avatarId).name} · LV {player.playerLevel} · 코인 {player.coinBalance}
              </p>
            </div>
          </div>
          <PixelButton big block onClick={onEnter}>
            ▶ 게임천국 입장!
          </PixelButton>
          <p className="p-muted">{persistent ? '이 기기에 저장돼요. 기기를 바꾸거나 브라우저 데이터를 지우면 기록이 사라질 수 있어요. 설정 > 백업에서 파일로 보관하세요.' : '이 브라우저에서는 저장이 막혀 있어 닫으면 기록이 사라져요. (사생활 보호 모드일 수 있어요)'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-reg p-screen">
      <div className="p-scroll">
        <Steps n={step} />
        {step === 1 ? (
          <>
            <div className="p-ribbon">NEW PLAYER</div>
            <div className="p-hero">
              <div className="p-stagebox">
                <img src="./assets/gona.png" alt="" draggable={false} />
                <i />
              </div>
              <div className="p-bubble">
                처음 왔구나!
                <br />
                이름을 알려줄래?
              </div>
            </div>
            <NicknameField value={nick} onChange={(v) => setDraft((d) => ({ ...d, nick: v }))} onEnter={next} />
            <section className="p-panel">
              <p className="p-muted">같은 닉네임도 괜찮아요. 내 기록은 내부 ID로 구분해요. 이메일·비밀번호는 필요 없어요.</p>
            </section>
            <PixelButton big block disabled={!checkNickname(nick).ok} onClick={next}>
              다음 ▶
            </PixelButton>
          </>
        ) : (
          <>
            <div className="p-ribbon">CHARACTER SELECT</div>
            <div className="p-preview-row">
              <div className="p-pick">
                <div className="p-preview">
                  <div className="frame">
                    <img src={a.src} alt={a.name} draggable={false} />
                  </div>
                  <b>{a.name}</b>
                </div>
                <div>
                  <b style={{ fontSize: 15 }}>{nick}</b>
                  <p className="p-muted">{a.desc}</p>
                  <p className="p-muted">아바타는 나중에 프로필에서 바꿀 수 있어요.</p>
                </div>
              </div>
            </div>
            <AvatarSelector value={av} onChange={(id) => setDraft((d) => ({ ...d, av: id }))} />
            <div className="p-row">
              <PixelButton variant="sub" onClick={goBack}>
                ◀ 이전
              </PixelButton>
              <PixelButton big className="fill" onClick={finish}>
                이걸로 결정!
              </PixelButton>
            </div>
            <p className="p-muted" aria-hidden>
              선택 가능 {AVATARS.length}명
            </p>
          </>
        )}
      </div>
    </div>
  );
}
