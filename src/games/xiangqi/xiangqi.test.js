import test from 'node:test'
import assert from 'node:assert/strict'
import { agreeDraw, createGame, hasLegalMove, isInCheck, legalMoves, playMove, undoMove } from './xiangqi.js'

const at = (r, c) => r * 9 + c
function position(entries = []) {
  const board = Array(90).fill(null)
  for (const [r, c, side, type] of [[9, 4, 'red', 'king'], [0, 4, 'black', 'king'], [5, 4, 'red', 'pawn'], ...entries]) board[at(r, c)] = type ? { side, type } : null
  return board
}
const can = (board, r, c, nr, nc) => legalMoves(board, at(r, c)).includes(at(nr, nc))

test('标准开局32子、红方先行，拒绝错方、越界和原地移动；悔棋恢复棋盘与吃子', () => {
  const initial = createGame()
  assert.equal(initial.board.filter(Boolean).length, 32)
  assert.equal(initial.currentPlayer, 'red')
  assert.equal(initial.board[at(9, 4)].type, 'king')
  assert.equal(playMove(initial, at(3, 0), at(4, 0)), initial)
  assert.equal(playMove(initial, -1, 0), initial)
  assert.equal(playMove(initial, at(6, 0), at(6, 0)), initial)
  const moved = playMove(initial, at(6, 0), at(5, 0))
  assert.equal(moved.currentPlayer, 'black')
  assert.equal(moved.history.length, 1)
  assert.deepEqual(undoMove(moved), initial)
  const capture = { ...initial, board: position([[5, 0, 'red', 'rook'], [3, 0, 'black', 'pawn']]) }
  const eaten = playMove(capture, at(5, 0), at(3, 0))
  assert.equal(eaten.history[0].captured.side, 'black')
  assert.deepEqual(undoMove(eaten), capture)
})

test('车不能越子或斜走，炮吃子必须恰有一个炮架，不能越架走空位', () => {
  const rook = position([[5, 0, 'red', 'rook'], [3, 0, 'black', 'pawn']])
  assert.equal(can(rook, 5, 0, 3, 0), true)
  assert.equal(can(rook, 5, 0, 2, 0), false)
  assert.equal(can(rook, 5, 0, 4, 1), false)
  const cannon = position([[7, 1, 'red', 'cannon'], [5, 1, 'red', 'pawn'], [2, 1, 'black', 'horse']])
  assert.equal(can(cannon, 7, 1, 2, 1), true)
  assert.equal(can(cannon, 7, 1, 4, 1), false)
  cannon[at(5, 1)] = null
  assert.equal(can(cannon, 7, 1, 2, 1), false)
  cannon[at(5, 1)] = { side: 'red', type: 'pawn' }
  cannon[at(4, 1)] = { side: 'black', type: 'pawn' }
  assert.equal(can(cannon, 7, 1, 2, 1), false)
})

test('马腿与象眼阻挡生效，红黑象均不能过河', () => {
  const horse = position([[7, 1, 'red', 'horse']])
  assert.equal(can(horse, 7, 1, 5, 2), true)
  horse[at(6, 1)] = { side: 'black', type: 'pawn' }
  assert.equal(can(horse, 7, 1, 5, 2), false)
  assert.equal(can(horse, 7, 1, 6, 3), true)
  horse[at(7, 2)] = { side: 'red', type: 'pawn' }
  assert.equal(can(horse, 7, 1, 6, 3), false)
  const elephant = position([[7, 2, 'red', 'elephant'], [4, 2, 'black', 'elephant'], [5, 6, 'red', 'elephant']])
  assert.equal(can(elephant, 7, 2, 5, 0), true)
  elephant[at(6, 1)] = { side: 'black', type: 'pawn' }
  assert.equal(can(elephant, 7, 2, 5, 0), false)
  assert.equal(can(elephant, 4, 2, 6, 0), false)
  assert.equal(can(elephant, 5, 6, 3, 8), false)
})

test('士将不出九宫，将帅不能斜走，兵卒过河后可横走但不能后退', () => {
  const board = position([[9, 3, 'red', 'advisor'], [2, 3, 'black', 'advisor'], [6, 0, 'red', 'pawn'], [4, 2, 'red', 'pawn'], [5, 6, 'black', 'pawn'], [3, 8, 'black', 'pawn']])
  assert.equal(can(board, 9, 3, 8, 4), true)
  assert.equal(can(board, 9, 3, 8, 2), false)
  assert.equal(can(board, 2, 3, 3, 4), false)
  assert.equal(can(board, 9, 4, 8, 5), false)
  assert.equal(can(board, 0, 4, 0, 5), true)
  assert.equal(can(board, 6, 0, 6, 1), false)
  assert.equal(can(board, 6, 0, 5, 0), true)
  assert.equal(can(board, 4, 2, 4, 3), true)
  assert.equal(can(board, 4, 2, 5, 2), false)
  assert.equal(can(board, 5, 6, 5, 7), true)
  assert.equal(can(board, 5, 6, 4, 6), false)
  assert.equal(can(board, 3, 8, 3, 7), false)
})

test('禁止将帅照面、移动挡将子后送将；被将军时只能解除威胁', () => {
  const face = position([[5, 4, 'red', 'rook']])
  assert.equal(can(face, 5, 4, 5, 3), false)
  assert.equal(can(face, 5, 4, 4, 4), true)
  const pinned = position([[9, 0, 'black', 'rook'], [9, 2, 'red', 'rook']])
  assert.equal(can(pinned, 9, 2, 8, 2), false)
  assert.equal(can(pinned, 9, 2, 9, 0), true)
  const check = position([[8, 0, 'black', 'rook'], [7, 0, 'red', 'rook'], [9, 4, null, null], [8, 4, 'red', 'king']])
  assert.equal(isInCheck(check, 'red'), true)
  assert.equal(can(check, 7, 0, 7, 1), false)
  assert.equal(can(check, 7, 0, 8, 0), true)
  assert.equal(can(check, 8, 4, 9, 4), true)
})

test('将死与困毙均判负，结束后不能走子，悔棋可撤回结算；和棋需双方同意', () => {
  const initial = createGame()
  const mate = { ...initial, board: position([[1, 3, 'red', 'rook'], [1, 5, 'red', 'rook'], [9, 5, 'red', 'rook']]) }
  const won = playMove(mate, at(1, 5), at(0, 5))
  assert.equal(won.winner, 'red')
  assert.equal(won.reason, 'checkmate')
  assert.equal(playMove(won, at(0, 4), at(1, 4)), won)
  assert.deepEqual(undoMove(won), mate)
  const stalemate = { ...initial, board: position([[2, 3, 'red', 'rook'], [1, 5, 'red', 'rook']]) }
  const trapped = playMove(stalemate, at(2, 3), at(1, 3))
  assert.equal(isInCheck(trapped.board, 'black'), false)
  assert.equal(hasLegalMove(trapped.board, 'black'), false)
  assert.equal(trapped.winner, 'red')
  assert.equal(trapped.reason, 'stalemate')
  const drawn = agreeDraw(initial)
  assert.equal(drawn.winner, 'draw')
  assert.equal(playMove(drawn, at(6, 0), at(5, 0)), drawn)
})
