import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import regular from 'galmuri/dist/Galmuri11.woff2?url';
import bold from 'galmuri/dist/Galmuri11-Bold.woff2?url';
import Shell from './Shell';
import './styles.css';

// 도트 한글 폰트(Galmuri, OFL) — 게임천국과 같은 폰트
const font = document.createElement('style');
font.textContent = `
@font-face{font-family:Galmuri11;font-weight:400;font-display:swap;src:url(${regular}) format('woff2')}
@font-face{font-family:Galmuri11;font-weight:700;font-display:swap;src:url(${bold}) format('woff2')}`;
document.head.appendChild(font);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
);
