import { BLACK, WHITE, createGame } from './gomoku.js'

export function normalizeRoomCode(value) {
  const code = value.trim().toUpperCase()
  if (!/^[A-Z0-9]{8}$/.test(code)) throw new Error('请输入 8 位房间邀请码。')
  return code
}

export function invitationUrl(href, code) {
  const url = new URL(href)
  url.searchParams.set('room', normalizeRoomCode(code))
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
  if (/anonymous.*disabled/i.test(message)) return '在线服务尚未开启游客登录，请联系站点管理员。'
  if (/PGRST20[25]|42P01/.test(error?.code || '')) return '在线服务尚未完成初始化，请联系站点管理员。'
  if (/fetch|network|timeout|abort/i.test(message)) return '网络连接中断或超时。提交可能已完成，请重新连接核实棋盘后再操作。'
  if (/JWT|token|session/i.test(message)) return '登录状态已失效，请重新连接。'
  return '在线操作失败，请稍后重试。'
}
