import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const r = (p: string) => resolve(import.meta.dirname, p);

// 크롬 확장은 페이지(HTML) 3개 + 백그라운드 서비스워커 1개를 엔트리로 빌드한다.
// manifest.json 과 아이콘은 public/ 에서 그대로 복사된다.
export default defineConfig({
  root: r('src'),
  publicDir: r('public'),
  resolve: { alias: { '@': r('src') } },
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  build: {
    outDir: r('dist'),
    emptyOutDir: true,
    target: 'es2022',
    modulePreload: false,
    rollupOptions: {
      input: {
        newtab: r('src/newtab/index.html'),
        options: r('src/options/index.html'),
        offscreen: r('src/offscreen/index.html'),
        background: r('src/background/index.ts'),
      },
      output: {
        entryFileNames: (chunk: { name: string }) =>
          chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
      },
    },
  },
  test: {
    root: import.meta.dirname,
    environment: 'jsdom',
  },
} as never);
