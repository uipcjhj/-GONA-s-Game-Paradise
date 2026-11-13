/** 이전 Food Adventure 최고 기록을 읽기 전용으로 조회(정식 빌드 키). Food 데이터는 절대 쓰지 않음 */
export function importFoodBest(): { score: number; stage?: number } | null {
  try {
    const score = parseInt(localStorage.getItem('dino-snack-adventure.best') ?? '', 10);
    if (!Number.isInteger(score) || score <= 0 || score > 5_000_000) return null;
    const st = parseInt(localStorage.getItem('dino-snack-adventure.bestStage') ?? '', 10);
    return { score, stage: Number.isInteger(st) && st >= 1 && st <= 4 ? st : undefined };
  } catch {
    return null;
  }
}
