import test from 'node:test'
import assert from 'node:assert/strict'
import { BLACK, createGame, playMove, undoMove, WHITE } from './gomoku.js'

function play(sequence) {
  return sequence.reduce(
    (game, [row, column]) => playMove(game, row, column),
    createGame(),
  )
}

test('黑方先手、双方轮换，并拒绝重复或越界落子', () => {
  const started = createGame()
  const firstMove = playMove(started, 7, 7)

  assert.equal(firstMove.board[7 * 15 + 7], BLACK)
  assert.equal(firstMove.currentPlayer, WHITE)
  assert.equal(playMove(firstMove, 7, 7), firstMove)
  assert.equal(playMove(firstMove, -1, 7), firstMove)
})

test('识别横、竖和两个方向的五连', () => {
  const cases = [
    [[7, 3], [0, 0], [7, 4], [0, 1], [7, 5], [0, 2], [7, 6], [0, 3], [7, 7]],
    [[3, 7], [0, 0], [4, 7], [0, 1], [5, 7], [0, 2], [6, 7], [0, 3], [7, 7]],
    [[3, 3], [0, 0], [4, 4], [0, 1], [5, 5], [0, 2], [6, 6], [0, 3], [7, 7]],
    [[3, 11], [0, 0], [4, 10], [0, 1], [5, 9], [0, 2], [6, 8], [0, 3], [7, 7]],
  ]

  for (const sequence of cases) assert.equal(play(sequence).winner, BLACK)
})

test('胜负确定后禁止继续落子', () => {
  const finished = play([
    [7, 3], [0, 0], [7, 4], [0, 1], [7, 5], [0, 2], [7, 6], [0, 3], [7, 7],
  ])

  assert.equal(playMove(finished, 8, 8), finished)
})

test('悔棋移除最后一步并把回合交还落子方', () => {
  const game = play([[7, 7], [7, 8]])
  const undone = undoMove(game)

  assert.equal(undone.board[7 * 15 + 8], null)
  assert.equal(undone.currentPlayer, WHITE)
  assert.equal(undone.history.length, 1)
})

