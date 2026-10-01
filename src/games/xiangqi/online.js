import { createGame, playMove } from './xiangqi.js'

export function playerSide(room, userId) {
  if (!room || !userId) return null
  if (room.red_player_id === userId) return 'red'
  if (room.black_player_id === userId) return 'black'
  return null
}

export function gameFromSnapshot({ room, moves }) {
  let game = createGame()
  const invalid = () => { throw new Error('对局数据异常，请重新连接。') }
  if (!room || !Array.isArray(moves) || moves.length !== room.move_number) invalid()
  for (const [index, move] of moves.entries()) {
    if (move.move_number !== index + 1 || playerSide(room, move.player_id) !== game.currentPlayer) invalid()
    const next = playMove(game, move.from_index, move.to_index)
    if (next === game) invalid()
    game = next
  }
  if (!Array.isArray(room.board) || room.board.length !== 90 || game.board.some((piece, i) =>
    piece ? piece.side !== room.board[i]?.side || piece.type !== room.board[i]?.type : room.board[i] !== null)
    || room.current_turn !== game.currentPlayer) invalid()
  if (room.winner === 'draw' && room.reason === 'agreed' && !game.winner) {
    game = { ...game, winner: 'draw', reason: 'agreed' }
  }
  if (game.winner !== room.winner || game.reason !== room.reason) invalid()
  return game
}
