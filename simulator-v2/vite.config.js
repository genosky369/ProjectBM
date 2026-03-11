import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // OneDrive 경로(한글/공백)에서 Rollup 쓰기 실패 방지: 짧은 임시 경로로 빌드
    outDir: 'C:/simulator_build_v2',
    emptyOutDir: true,
  },
})
