/**
 * 뒤로가기 처리: 열린 화면/팝업(레이어)마다 히스토리 항목을 하나 쌓고,
 * 브라우저 뒤로가기 1회 = 가장 위 레이어 1개 닫기. 앱을 벗어나거나 오류가 나지 않게 함.
 */
type Handler = () => void;
const stack: { id: number; fn: Handler }[] = [];
let seq = 0;
let ignore = 0;
let bound = false;

function onPop(): void {
  if (ignore > 0) {
    ignore -= 1;
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
  const id = ++seq;
  stack.push({ id, fn });
  try {
    history.pushState({ gpLayer: id }, '');
  } catch {
    /* 히스토리 사용 불가: 뒤로가기 연동만 생략 */
  }
  return () => {
    const i = stack.findIndex((l) => l.id === id);
    if (i === -1) return; // 뒤로가기로 이미 닫힘
    stack.splice(i, 1);
    ignore += 1;
    try {
      history.back();
    } catch {
      ignore -= 1;
    }
  };
}
