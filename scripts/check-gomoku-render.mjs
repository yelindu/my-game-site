import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

const originalWindow = globalThis.window
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
try {
  globalThis.window = { location: { href: 'https://example.com/my-game-site/', search: '' } }
  const { default: App } = await server.ssrLoadModule('/src/App.jsx')
  const { default: Local } = await server.ssrLoadModule('/src/games/gomoku/GomokuGame.jsx')
  assert.match(renderToStaticMarkup(createElement(App)), /游戏合集/)
  const local = renderToStaticMarkup(createElement(Local, { onBack() {}, onOnline() {} }))
  assert.equal((local.match(/role="gridcell"/g) || []).length, 225)
  assert.equal((local.match(/role="gridcell"[^>]*disabled/g) || []).length, 0)
  assert.match(local, /与朋友在线对战/)
  globalThis.window.location.search = '?room=AB12CD34'
  const invited = renderToStaticMarkup(createElement(App))
  assert.match(invited, /value="AB12CD34"/)
  assert.match(invited, /加入 \/ 恢复房间/)
  assert.equal((invited.match(/role="gridcell"[^>]*disabled/g) || []).length, 225)
  assert.ok(!invited.includes('悔棋一步'))
  const { default: Xiangqi } = await server.ssrLoadModule('/src/games/xiangqi/XiangqiGame.jsx')
  const xiangqi = renderToStaticMarkup(createElement(Xiangqi, { onBack() {}, onOnline() {} }))
  assert.equal((xiangqi.match(/role="gridcell"/g) || []).length, 90)
  assert.match(xiangqi, /与朋友在线对战/)
  globalThis.window.location.search = '?room=AB12CD34&game=xiangqi'
  const xiangqiInvite = renderToStaticMarkup(createElement(App))
  assert.match(xiangqiInvite, /中国象棋/)
  assert.match(xiangqiInvite, /value="AB12CD34"/)
  assert.equal((xiangqiInvite.match(/role="gridcell"[^>]*disabled/g) || []).length, 90)
  assert.ok(!xiangqiInvite.includes('悔棋一步'))
  console.log('PASS: lobby, both local boards, game-specific invitations, online boards locked before joining, online undo hidden.')
} finally {
  globalThis.window = originalWindow
  await server.close()
}
