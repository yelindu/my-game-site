import test from 'node:test'
import assert from 'node:assert/strict'
import { gameFromSnapshot, playerSide } from './online.js'
import { createGame, playMove } from './xiangqi.js'
import { invitationUrl } from '../gomoku/online.js'

test('xiangqi snapshots replay moves, verify board and player, and accept agreed draw', () => {
  const game = playMove(createGame(), 54, 45)
  const room = { red_player_id: 'r', black_player_id: 'b', move_number: 1, board: game.board.map(p => p ? { type: p.type, side: p.side } : null), current_turn: 'black', winner: null, reason: null }
  const moves = [{ move_number: 1, player_id: 'r', from_index: 54, to_index: 45 }]
  assert.deepEqual(gameFromSnapshot({ room, moves }), game)
  assert.equal(playerSide(room, 'b'), 'black')
  assert.equal(playerSide(room, 'outsider'), null)
  assert.throws(() => gameFromSnapshot({ room, moves: [{ ...moves[0], player_id: 'b' }] }), /数据异常/)
  assert.throws(() => gameFromSnapshot({ room: { ...room, board: createGame().board }, moves }), /数据异常/)
  assert.throws(() => gameFromSnapshot({ room: { ...room, move_number: 2 }, moves }), /数据异常/)
  assert.equal(gameFromSnapshot({ room: { ...room, winner: 'draw', reason: 'agreed' }, moves }).winner, 'draw')
})
test('invitations select the right game while preserving the Pages path', () => {
  const url = invitationUrl('https://example.com/my-game-site/?room=00000000#board', 'ab12cd34', 'xiangqi')
  assert.equal(url, 'https://example.com/my-game-site/?room=AB12CD34&game=xiangqi')
  assert.equal(invitationUrl(url, '1234abcd'), 'https://example.com/my-game-site/?room=1234ABCD')
})
