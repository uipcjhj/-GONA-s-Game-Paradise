import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' → GitHub Pages(프로젝트 페이지)의 하위 경로에서도 그대로 동작
export default defineConfig({
  base: './',
  plugins: [react()],
});
