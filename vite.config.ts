import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' → GitHub Pages(프로젝트 페이지)의 하위 경로에서도 그대로 동작
// 다중 페이지: 게임천국(index.html) + 독립 모듈 Mini Game Land(/mini-game-land/)
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        miniGameLand: fileURLToPath(new URL('./mini-game-land/index.html', import.meta.url)),
      },
    },
  },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
