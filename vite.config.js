import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { configurationError } from './src/services/config.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const error = configurationError(env.VITE_SUPABASE_URL?.trim(), env.VITE_SUPABASE_ANON_KEY?.trim())
  if (error) throw new Error(error)
  return {
    // 相对路径让构建产物同时适用于 username.github.io 和项目子路径。
    base: './',
    plugins: [react()],
  }
})

