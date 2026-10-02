import { BLACK, WHITE, createGame } from './gomoku.js'

export function normalizeRoomCode(value) {
  const code = value.trim().toUpperCase()
  if (!/^[A-Z0-9]{8}$/.test(code)) throw new Error('请输入 8 位房间邀请码。')
  return code
}

export function invitationUrl(href, code, game = 'gomoku') {
  const url = new URL(href)
  url.searchParams.set('room', normalizeRoomCode(code))
  if (game !== 'gomoku') url.searchParams.set('game', game)
  else url.searchParams.delete('game')
  url.hash = ''
  return url.href
}

export function playerSide(room, userId) {
  if (!room || !userId) return null
  if (room?.black_player_id === userId) return BLACK
  if (room?.white_player_id === userId) return WHITE
  return null
}

export function gameFromSnapshot({ room, moves }) {
  const game = createGame()
  for (const move of moves) {
    const row = move.position_y
    const column = move.position_x
    const side = playerSide(room, move.player_id)
    if (!side || !Number.isInteger(row) || !Number.isInteger(column)
      || row < 0 || row >= game.size || column < 0 || column >= game.size
      || game.board[row * game.size + column]) {
      throw new Error('对局数据异常，请重新连接。')
    }
    game.board[row * game.size + column] = side
    game.history.push({ row, column, player: side })
  }
  game.currentPlayer = room.current_turn
  game.winner = room.winner
  return game
}

export function onlineError(error) {
  const message = error?.message || String(error)
  if (/room is unavailable/.test(message)) return '房间不存在或已满。已有玩家请使用原浏览器重新加入。'
  if (/it is not your turn/.test(message)) return '还没轮到你，请等待对方落子。'
  if (/already occupied/.test(message)) return '这个位置已经有棋子，请选择空位。'
  if (/not playable/.test(message)) return '对局尚未开始或已经结束。'
  if (/illegal xiangqi move/.test(message)) return '这步不能走，请按棋子的走法移动并确保将帅安全。'
  if (/stale position/.test(message)) return '棋盘已经更新，请重新连接后再走棋。'
  if (/draw offer|draw action/.test(message)) return '和棋请求已变化，请按最新对局状态操作。'
  if (/seat is occupied/.test(message)) return '这个座位已有人，请选择另一个位置。'
  if (/leave your seat/.test(message)) return '请先离开当前座位再换位置。'
  if (/both seats/.test(message)) return '两位玩家都入座后才能开始。'
  if (/three seats/.test(message)) return '三位玩家都入座后才能开始。'
  if (/not your turn/.test(message)) return '还没轮到你，请等待其他玩家。'
  if (/invalid bid/.test(message)) return '请选择更高的叫分，或不叫。'
  if (/invalid cards|invalid combination/.test(message)) return '这些牌不能组成有效牌型，请重新选牌。'
  if (/cards not owned/.test(message)) return '手牌已经变化，请按最新手牌重新选牌。'
  if (/cannot beat/.test(message)) return '需要出相同牌型且更大的牌，或炸弹、王炸。'
  if (/cannot pass/.test(message)) return '这一轮由你先出牌，不能不出。'
  if (/stale game/.test(message)) return '对局已经更新，请等待同步后再操作。'
  if (/only host/.test(message)) return '请等待房主开始游戏。'
  if (/lobby already started/.test(message)) return '对局已经开始，请刷新房间状态。'
  if (/invalid nickname/.test(message)) return '名字请填写 1 到 12 个字。'
  if (/anonymous.*disabled/i.test(message)) return '在线服务尚未开启游客登录，请联系站点管理员。'
  if (/PGRST20[25]|42P01/.test(error?.code || '')) return '在线服务尚未完成初始化，请联系站点管理员。'
  if (/fetch|network|timeout|abort/i.test(message)) return '网络连接中断或超时。提交可能已完成，请重新连接核实棋盘后再操作。'
  if (/JWT|token|session/i.test(message)) return '登录状态已失效，请重新连接。'
  return '在线操作失败，请稍后重试。'
}
