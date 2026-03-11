import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Netlify: 상대경로 사용, 로컬: OneDrive 문제 시 C:/simulator_build_v2로 수동 변경
    outDir: process.env.NETLIFY ? 'dist' : 'C:/simulator_build_v2',
    emptyOutDir: true,
  },
})
