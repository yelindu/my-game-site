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
  const { default: Doudizhu } = await server.ssrLoadModule('/src/games/doudizhu/DoudizhuGame.jsx')
  const poker = renderToStaticMarkup(createElement(Doudizhu, { onBack() {} }))
  assert.equal((poker.match(/class="ddz-card/g) || []).length, 17)
  assert.match(poker, /轮到你叫分/)
  const watched = renderToStaticMarkup(createElement(Doudizhu, { online: { room: { code: 'AB12CD34' }, user: { id: 'observer' }, connection: 'connected', game: { phase: 'playing', hand: [], remaining: [20,17,17], landlord: 0, turn: 0, bottom: [0,1,2], multiplier: 1 } } }))
  assert.match(watched, /观战中/)
  assert.equal((watched.match(/class="ddz-card/g) || []).length, 3)
  globalThis.window.location.search = '?room=AB12CD34&game=doudizhu'
  assert.match(renderToStaticMarkup(createElement(App)), /斗地主/)
  const { default: Undercover } = await server.ssrLoadModule('/src/games/undercover/UndercoverGame.jsx')
  const setup = renderToStaticMarkup(createElement(Undercover, { onBack() {} }))
  assert.match(setup, /开始分词/)
  assert.equal((setup.match(/aria-label="玩家\d名字"/g) || []).length, 6)
  const undercover = { room: { code:'AB12CD34',creator_id:'host',players:[{id:'host',name:'房主'},{id:'guest',name:'朋友'},null,null] },user:{id:'host'},connection:'connected',game:{phase:'speaking',players:[{name:'房主'},{name:'朋友'},null,null],alive:[0,1],turn:0,round:1,ballotId:1,spoken:[],speeches:[],voted:[],candidates:[0,1],eliminated:[],word:'机密测试甲'} }
  const privateView = renderToStaticMarkup(createElement(Undercover,{online:undercover}))
  assert.match(privateView,/查看我的词语/); assert.ok(!privateView.includes('机密测试甲'))
  undercover.user.id='observer'; undercover.game.word=null
  const spectating = renderToStaticMarkup(createElement(Undercover,{online:undercover}))
  assert.match(spectating,/观战中/); assert.ok(!spectating.includes('查看我的词语')&&!spectating.includes('你的描述'))
  const eightSides=Array.from({length:8},(_,i)=>`seat${i}`)
  const eightNames=Object.fromEntries(eightSides.map((s,i)=>[s,`${i+1}号位`]))
  const lobbyOnline={room:{creator_id:'host',seat0_player_id:'host',seat1_player_id:'a',seat2_player_id:'b'},user:{id:'host'},connection:'connected'}
  const ucLobby=()=>renderToStaticMarkup(createElement(RoomLobby,{online:lobbyOnline,name:'谁是卧底',sides:eightSides,names:eightNames,minPlayers:4}))
  assert.match(ucLobby(),/3\/8 人已入座/); assert.match(ucLobby(),/disabled="">开始游戏/)
  lobbyOnline.room.seat7_player_id='c'
  assert.match(ucLobby(),/(?<!disabled="")>开始游戏/)
  globalThis.window.location.search='?room=AB12CD34&game=undercover'
  assert.match(renderToStaticMarkup(createElement(App)),/谁是卧底/)
  const {default:Go}=await server.ssrLoadModule('/src/games/go/GoGame.jsx')
  const {createGame:goInitial,apply:goApply}=await server.ssrLoadModule('/src/games/go/go.js')
  const goLocal=renderToStaticMarkup(createElement(Go,{onBack(){}}))
  assert.equal((goLocal.match(/role="gridcell"/g)||[]).length,81)
  assert.match(goLocal,/停一手/);assert.match(goLocal,/白方贴 7.5 目/)
  const goOnline={room:{code:'AB12CD34',creator_id:'host'},user:{id:'observer'},player:null,connection:'connected',game:goInitial()}
  const goObserver=()=>renderToStaticMarkup(createElement(Go,{online:goOnline}))
  assert.equal((goObserver().match(/role="gridcell"[^>]*disabled/g)||[]).length,81)
  goOnline.game=goApply(goApply(goApply(goInitial(),'place',1,40),'pass',2),'pass',1)
  assert.match(goObserver(),/观战中/);assert.ok(!goObserver().includes('确认终局</button>'))
  goOnline.player=1
  assert.match(goObserver(),/黑方确认终局/);assert.ok(!goObserver().includes('白方确认终局</button>'))
  globalThis.window.location.search='?room=AB12CD34&game=go'
  const goInvite=renderToStaticMarkup(createElement(App))
  assert.match(goInvite,/围棋/);assert.equal((goInvite.match(/role="gridcell"/g)||[]).length,0)
  console.log('PASS: both simple menus, lobbies without boards, host-only start, locked spectator board, invitations and stable xiangqi pieces.')
} finally {
  globalThis.window = originalWindow
  await server.close()
}
