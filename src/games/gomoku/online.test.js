import assert from 'node:assert/strict'
import test from 'node:test'
import { gameFromSnapshot, invitationUrl, normalizeRoomCode, onlineError, playerSide } from './online.js'

const room = {
  black_player_id: 'black-user', white_player_id: 'white-user',
  current_turn: 'black', winner: null,
}

test('邀请链接保留 Pages 子路径，规范邀请码并拒绝非法输入', () => {
  assert.equal(normalizeRoomCode(' ab12cd34 '), 'AB12CD34')
  assert.equal(invitationUrl('https://yelindu.github.io/my-game-site/?other=1#old', 'ab12cd34'), 'https://yelindu.github.io/my-game-site/?other=1&room=AB12CD34')
  assert.throws(() => normalizeRoomCode('bad'), /8 位/)
  assert.throws(() => normalizeRoomCode('<script>'), /8 位/)
})

test('重建服务端棋盘，正确对应横纵坐标与玩家，保留服务端胜负', () => {
  const snapshot = {
    room: { ...room, winner: 'white' },
    moves: [
      { position_x: 12, position_y: 3, player_id: 'black-user' },
      { position_x: 4, position_y: 11, player_id: 'white-user' },
    ],
  }
  const game = gameFromSnapshot(snapshot)
  assert.equal(game.board[3 * 15 + 12], 'black')
  assert.equal(game.board[11 * 15 + 4], 'white')
  assert.equal(game.history.at(-1).row, 11)
  assert.equal(game.history.at(-1).column, 4)
  assert.equal(game.winner, 'white')
  assert.equal(game.currentPlayer, 'black')
  assert.equal(playerSide(room, 'outsider'), null)
  assert.equal(playerSide(null, undefined), null)
})

test('拒绝越界、重复位置及非成员棋子，防止错误棋盘继续落子', () => {
  const move = { position_x: 2, position_y: 3, player_id: 'black-user' }
  assert.throws(() => gameFromSnapshot({ room, moves: [{ ...move, position_y: 15 }] }))
  assert.throws(() => gameFromSnapshot({ room, moves: [move, move] }))
  assert.throws(() => gameFromSnapshot({ room, moves: [{ ...move, player_id: 'outsider' }] }))
})

test('网络超时明确提示提交可能完成，权限与初始化错误可区分', () => {
  assert.match(onlineError({ message: 'AbortError timeout' }), /提交可能已完成/)
  assert.match(onlineError({ message: 'room is unavailable' }), /不存在或已满/)
  assert.match(onlineError({ code: 'PGRST202', message: 'function not found' }), /初始化/)
  assert.match(onlineError({ message: 'it is not your turn' }), /没轮到你/)
})
