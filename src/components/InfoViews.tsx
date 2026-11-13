import PixelIcon from './PixelIcon';

/** 프로필 · 랭킹: 서버가 없는 1차 버전이므로 가짜 데이터 없이 '준비 중'만 정직하게 안내 */
export function ProfileView() {
  return (
    <div className="view">
      <div className="card">
        <img className="portrait" src="./assets/gona.png" alt="고나" />
        <h2>고나</h2>
        <p className="muted">게임천국의 아기 공룡 안내원</p>
      </div>
      <div className="card list">
        <Row k="닉네임 · 플레이어 ID" v="준비 중" />
        <Row k="게임별 최고 점수" v="준비 중" />
        <Row k="업적 · 배지" v="준비 중" />
      </div>
      <p className="note">로그인과 기록 저장은 다음 업데이트에서 만나요.</p>
    </div>
  );
}

export function RankingView() {
  return (
    <div className="view">
      <div className="card">
        <PixelIcon name="trophy" size={8} />
        <h2>랭킹은 준비 중이에요</h2>
        <p className="muted">온라인 점수 서버가 열리면 여기에서 친구들과 겨룰 수 있어요.</p>
      </div>
      <div className="chips" aria-hidden>
        <span className="chip chip-soon">주간</span>
        <span className="chip chip-soon">역대</span>
        <span className="chip chip-soon">통합</span>
      </div>
      <p className="note">아직 아무도 기록하지 않았기 때문에 순위를 보여주지 않아요.</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="row">
      <span>{k}</span>
      <b>{v}</b>
    </div>
  );
}
