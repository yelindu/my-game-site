import { createClient } from '@supabase/supabase-js'
import { configurationError } from './config.js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const onlineConfigured = Boolean(url && key)
let client
let signingIn

export function getSupabase() {
  if (!onlineConfigured) throw new Error('在线对战暂未开放。')
  if (!client) {
    const error = configurationError(url, key)
    if (error) throw new Error(error)
    client = createClient(url, key, {
      global: {
        fetch: async (input, options = {}) => {
          const controller = new AbortController()
          const abort = () => controller.abort()
          if (options.signal?.aborted) abort()
          options.signal?.addEventListener('abort', abort, { once: true })
          const timer = setTimeout(abort, 15000)
          try {
            return await fetch(input, { ...options, signal: controller.signal })
          } finally {
            clearTimeout(timer)
            options.signal?.removeEventListener('abort', abort)
          }
        },
      },
    })
  }
  return client
}

export async function ensureUser() {
  const supabase = getSupabase()
  if (!signingIn) {
    signingIn = (async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      if (data.session) return data.session.user
      const result = await supabase.auth.signInAnonymously()
      if (result.error) throw result.error
      return result.data.user
    })().finally(() => { signingIn = null })
  }
  return signingIn
}
