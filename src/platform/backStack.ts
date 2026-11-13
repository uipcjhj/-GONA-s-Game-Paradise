/**
 * 뒤로가기 처리: 열린 화면/팝업(레이어)마다 히스토리 항목을 하나 쌓고,
 * 브라우저 뒤로가기 1회 = 가장 위 레이어 1개 닫기. 앱을 벗어나거나 오류가 나지 않게 함.
 *
 * 주의: history.back() 은 호출 시점의 '목표 항목'을 정해 두고 비동기로 이동한다.
 * 이동이 끝나기 전에 pushState 를 하면 엉뚱한 항목으로 가서 뒤로가기가 한 번 더 나간다(앱 밖으로 이탈).
 * 그래서 진행 중인 되돌아가기가 있으면 새 레이어의 pushState 는 완료(popstate) 후로 미룬다.
 */
type Handler = () => void;
interface Layer {
  id: number;
  fn: Handler;
  pushed: boolean;
}
const stack: Layer[] = [];
let deferred: Layer[] = [];
let seq = 0;
let ignore = 0; // 아직 끝나지 않은 프로그램 되돌아가기 수
let bound = false;

function doPush(l: Layer): void {
  try {
    history.pushState({ gpLayer: l.id }, '');
    l.pushed = true;
  } catch {
    /* 히스토리 사용 불가: 뒤로가기 연동만 생략 */
  }
}
function flush(): void {
  const list = deferred;
  deferred = [];
  for (const l of list) if (stack.includes(l)) doPush(l);
}

function onPop(): void {
  if (ignore > 0) {
    ignore -= 1;
    if (ignore === 0) flush();
    return;
  }
  const top = stack.pop();
  top?.fn();
}

export function pushLayer(fn: Handler): () => void {
  if (!bound) {
    window.addEventListener('popstate', onPop);
    bound = true;
  }
  const layer: Layer = { id: ++seq, fn, pushed: false };
  stack.push(layer);
  if (ignore === 0) doPush(layer);
  else deferred.push(layer);
  return () => {
    const i = stack.indexOf(layer);
    if (i === -1) return; // 뒤로가기로 이미 닫힘
    stack.splice(i, 1);
    if (!layer.pushed) {
      deferred = deferred.filter((d) => d !== layer);
      return; // 아직 히스토리에 쌓지 않았으니 되돌아갈 것도 없음
    }
    ignore += 1;
    try {
      history.back();
    } catch {
      ignore -= 1;
    }
  };
}
