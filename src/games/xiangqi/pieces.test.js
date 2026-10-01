import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, playMove, undoMove } from './xiangqi.js'
import { piecesForGame } from './pieces.js'

test('piece identities follow movement, captures and undo without replacing the moving piece', () => {
  let game = createGame()
  const pawn = piecesForGame(game).find(p => p.index === 54)
  game = playMove(game, 54, 45)
  assert.equal(piecesForGame(game).find(p => p.index === 45).id, pawn.id)
  game = playMove(game, 27, 36)
  game = playMove(game, 45, 36)
  const pieces = piecesForGame(game)
  assert.equal(pieces.length, 31)
  assert.equal(pieces.find(p => p.index === 36).id, pawn.id)
  const previous = piecesForGame(undoMove(game))
  assert.equal(previous.length, 32)
  assert.equal(previous.find(p => p.index === 45).id, pawn.id)
  assert.equal(previous.find(p => p.index === 36).id, 27)
})
