import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 相对路径让构建产物同时适用于 username.github.io 和项目子路径。
  base: './',
  plugins: [react()],
})

