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
  const xiangqi = renderToStaticMarkup(createElement(Xiangqi, { onBack() {} }))
  assert.equal((xiangqi.match(/role="gridcell"/g) || []).length, 90)
  assert.ok(!xiangqi.includes('走棋规则'))
  assert.equal((xiangqi.match(/data-piece-id=/g) || []).length, 32)
  const { default: Hub } = await server.ssrLoadModule('/src/games/xiangqi/XiangqiHub.jsx')
  const menu = renderToStaticMarkup(createElement(Hub, { onBack() {} }))
  assert.match(menu, /本地对战/)
  assert.match(menu, /创建房间/)
  assert.ok(!menu.includes('role="gridcell"'))
  const { RoomLobby } = await server.ssrLoadModule('/src/games/xiangqi/OnlineXiangqi.jsx')
  const waiting = renderToStaticMarkup(createElement(RoomLobby, {
    online: { room: { creator_id: 'host', red_player_id: null, black_player_id: null }, user: { id: 'host' }, connection: 'connected', busy: false }, onAction() {},
  }))
  assert.match(waiting, /观战中/)
  assert.match(waiting, /红方座位，加入/)
  assert.match(waiting, /disabled="">开始游戏/)
  assert.ok(!waiting.includes('微信') && !waiting.includes('QQ') && !waiting.includes('role="gridcell"'))
  globalThis.window.location.search = '?room=AB12CD34&game=xiangqi'
  const xiangqiInvite = renderToStaticMarkup(createElement(App))
  assert.match(xiangqiInvite, /房间号：AB12CD34/)
  assert.equal((xiangqiInvite.match(/role="gridcell"/g) || []).length, 0)
  assert.ok(!xiangqiInvite.includes('悔棋一步'))
  console.log('PASS: both games, simple xiangqi menu, lobby without board, seat/start controls, game-specific invitations and stable piece layer.')
} finally {
  globalThis.window = originalWindow
  await server.close()
}
