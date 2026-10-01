import { createGame } from './xiangqi.js'

// Stable identities let CSS move the same DOM element across intersections and through undo.
export function piecesForGame(game) {
  const pieces = new Map(createGame().board.flatMap((piece, index) => piece ? [[index, { id: index, ...piece }]] : []))
  for (const { from, to } of game.history) {
    const piece = pieces.get(from)
    pieces.delete(from)
    pieces.delete(to)
    if (piece) pieces.set(to, piece)
  }
  return [...pieces].map(([index, piece]) => ({ ...piece, index }))
}
