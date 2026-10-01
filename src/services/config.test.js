import assert from 'node:assert/strict'
import test from 'node:test'
import { configurationError } from './config.js'

test('构建前拒绝服务端密钥和不完整配置，接受两种公开客户端密钥', () => {
  const url = 'https://example.supabase.co'
  const jwt = (role) => `eyJ.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`
  assert.equal(configurationError('', ''), '')
  assert.equal(configurationError(url, 'sb_publishable_example'), '')
  assert.equal(configurationError(url, jwt('anon')), '')
  assert.match(configurationError(url, jwt('service_role')), /只能使用/)
  assert.match(configurationError(url, 'sb_secret_example'), /只能使用/)
  assert.match(configurationError(url, ''), /同时填写/)
  assert.match(configurationError('http://example.com', 'sb_publishable_example'), /HTTPS/)
})
