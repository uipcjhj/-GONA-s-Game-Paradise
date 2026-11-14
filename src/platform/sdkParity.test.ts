import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('SDK 사본 일치', () => {
  it('src/platform/sdk 와 docs/platform/sdk(다른 저장소로 복사해 쓰는 배포본)가 같은 내용', () => {
    expect(readFileSync('docs/platform/sdk/gp-sdk.js', 'utf8')).toBe(readFileSync('src/platform/sdk/gp-sdk.js', 'utf8'));
    expect(readFileSync('docs/platform/sdk/gp-sdk.d.ts', 'utf8')).toBe(readFileSync('src/platform/sdk/gp-sdk.d.ts', 'utf8'));
  });
});
