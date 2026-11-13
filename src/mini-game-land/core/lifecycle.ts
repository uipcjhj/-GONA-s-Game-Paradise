/** 리스너·타이머를 모아 두었다가 한 번에 해제 → 이벤트 중복 등록·누수 방지 */
export class Disposer {
  private fns = new Set<() => void>();

  get size() {
    return this.fns.size;
  }

  add(fn: () => void): () => void {
    this.fns.add(fn);
    return () => {
      if (this.fns.delete(fn)) fn();
    };
  }

  listen(target: EventTarget, type: string, handler: EventListener, opts?: AddEventListenerOptions): () => void {
    target.addEventListener(type, handler, opts);
    return this.add(() => target.removeEventListener(type, handler, opts));
  }

  /** 멱등 */
  dispose() {
    const all = [...this.fns];
    this.fns.clear();
    for (const fn of all) fn();
  }
}
