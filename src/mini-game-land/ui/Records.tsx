import { GAMES } from '../core/registry';
import { gameRecord } from '../core/storage';
import { store } from '../services';

export default function Records({ back }: { back: () => void }) {
  const save = store.get();
  return (
    <div className="mgl-screen" data-testid="records">
      <h2 className="mgl-h">내 기록</h2>
      <div className="mgl-list">
        <section className="mgl-card">
          <h3>랜덤 챌린지</h3>
          <p>
            최고 점수 <b>{save.challenge.bestScore.toLocaleString('en-US')}</b> · 최고 라운드 <b>{save.challenge.bestRound}</b>
          </p>
        </section>
        {GAMES.map((g) => {
          const r = gameRecord(save, g.id);
          return (
            <section key={g.id} className="mgl-card">
              <h3>
                {g.meta.title}
                {g.meta.temporary && <em className="mgl-temp">임시</em>}
              </h3>
              <p>
                최고 점수 <b>{r.bestScore.toLocaleString('en-US')}</b> · 클리어 레벨 <b>{r.bestLevel}</b>
              </p>
            </section>
          );
        })}
      </div>
      {!store.persistent && <p className="mgl-note">이 브라우저에서는 기록이 저장되지 않아요.</p>}
      <div className="mgl-actions">
        <button type="button" className="mgl-btn" onClick={back}>
          돌아가기
        </button>
      </div>
    </div>
  );
}
