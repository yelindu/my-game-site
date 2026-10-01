export function configurationError(url, key) {
  if (!url && !key) return ''
  if (!url || !key) return 'Supabase 项目 URL 和客户端公开密钥必须同时填写。'
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) {
      return 'Supabase 项目 URL 必须使用 HTTPS。'
    }
  } catch {
    return 'Supabase 项目 URL 格式错误。'
  }
  if (key.startsWith('sb_publishable_')) return ''
  try {
    const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.role === 'anon') return ''
  } catch { /* Non-JWT keys are rejected below. */ }
  return '前端只能使用 publishable 或 anon key，不能使用 secret 或 service_role 密钥。'
}
