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
  const local = renderToStaticMarkup(createElement(Local, { onBack() {} }))
  assert.equal((local.match(/role="gridcell"/g) || []).length, 225)
  assert.equal((local.match(/role="gridcell"[^>]*disabled/g) || []).length, 0)
  assert.ok(!local.includes('游戏规则'))
  globalThis.window.location.search = '?room=AB12CD34'
  const invited = renderToStaticMarkup(createElement(App))
  assert.match(invited, /房间号：AB12CD34/)
  assert.equal((invited.match(/role="gridcell"/g) || []).length, 0)
  assert.ok(!invited.includes('悔棋'))
  const observer = renderToStaticMarkup(createElement(Local, { online: { game: { size: 15, board: Array(225).fill(null), history: [], currentPlayer: 'black', winner: null }, canMove: false, room: { code: 'AB12CD34' }, status: '观战中' } }))
  assert.equal((observer.match(/role="gridcell"[^>]*disabled/g) || []).length, 225)
  const { default: Xiangqi } = await server.ssrLoadModule('/src/games/xiangqi/XiangqiGame.jsx')
  const xiangqi = renderToStaticMarkup(createElement(Xiangqi, { onBack() {} }))
  assert.equal((xiangqi.match(/role="gridcell"/g) || []).length, 90)
  assert.ok(!xiangqi.includes('走棋规则'))
  assert.equal((xiangqi.match(/data-piece-id=/g) || []).length, 32)
  const { default: Hub } = await server.ssrLoadModule('/src/components/GameHub.jsx')
  const { default: RoomLobby } = await server.ssrLoadModule('/src/components/RoomLobby.jsx')
  for (const [name, sides, names] of [['五子棋', ['black','white'], { black: '黑方', white: '白方' }], ['象棋', ['red','black'], { red: '红方', black: '黑方' }]]) {
    const menu = renderToStaticMarkup(createElement(Hub, { name, onBack() {} }))
    assert.match(menu, /本地对战/)
    assert.match(menu, /创建房间/)
    assert.ok(!menu.includes('role="gridcell"'))
    const online = { room: { creator_id: 'host' }, user: { id: 'host' }, connection: 'connected', busy: false }
    const waiting = renderToStaticMarkup(createElement(RoomLobby, { online, name, sides, names, onAction() {} }))
    assert.match(waiting, /观战中/)
    assert.ok(waiting.includes(`${names[sides[0]]}座位，加入`))
    assert.match(waiting, /disabled="">开始游戏/)
    assert.ok(!waiting.includes('微信') && !waiting.includes('QQ') && !waiting.includes('role="gridcell"'))
    sides.forEach((side, i) => { online.room[`${side}_player_id`] = i ? 'guest' : 'host' })
    assert.match(renderToStaticMarkup(createElement(RoomLobby, { online, name, sides, names })), /(?<!disabled="")>开始游戏/)
    online.user.id = 'guest'
    assert.match(renderToStaticMarkup(createElement(RoomLobby, { online, name, sides, names })), /disabled="">开始游戏/)
  }
  globalThis.window.location.search = '?room=AB12CD34&game=xiangqi'
  const xiangqiInvite = renderToStaticMarkup(createElement(App))
  assert.match(xiangqiInvite, /房间号：AB12CD34/)
  assert.equal((xiangqiInvite.match(/role="gridcell"/g) || []).length, 0)
  assert.ok(!xiangqiInvite.includes('悔棋一步'))
  console.log('PASS: both simple menus, lobbies without boards, host-only start, locked spectator board, invitations and stable xiangqi pieces.')
} finally {
  globalThis.window = originalWindow
  await server.close()
}
