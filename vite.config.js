import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  base: '/',
  publicDir: 'public',
  build: {
    outDir: '../dist',
  },
  // 絶対パスか、`root` からの相対パスで指定する
  envDir: '../',
});