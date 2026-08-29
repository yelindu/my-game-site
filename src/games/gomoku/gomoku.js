export const BOARD_SIZE = 15
export const BLACK = 'black'
export const WHITE = 'white'
export const DRAW = 'draw'

export function createGame(size = BOARD_SIZE) {
  return {
    size,
    board: Array(size * size).fill(null),
    currentPlayer: BLACK,
    winner: null,
    history: [],
  }
}

export function playMove(game, row, column) {
  const { board, currentPlayer, size, winner } = game
  const insideBoard = Number.isInteger(row)
    && Number.isInteger(column)
    && row >= 0
    && row < size
    && column >= 0
    && column < size
  const index = row * size + column

  if (winner || !insideBoard || board[index]) return game

  const nextBoard = board.slice()
  nextBoard[index] = currentPlayer
  const history = [...game.history, { row, column, player: currentPlayer }]
  const result = hasFive(nextBoard, row, column, currentPlayer, size)
    ? currentPlayer
    : history.length === board.length
      ? DRAW
      : null

  return {
    ...game,
    board: nextBoard,
    currentPlayer: result ? currentPlayer : otherPlayer(currentPlayer),
    winner: result,
    history,
  }
}

export function undoMove(game) {
  const lastMove = game.history.at(-1)
  if (!lastMove) return game

  const board = game.board.slice()
  board[lastMove.row * game.size + lastMove.column] = null

  return {
    ...game,
    board,
    currentPlayer: lastMove.player,
    winner: null,
    history: game.history.slice(0, -1),
  }
}

function otherPlayer(player) {
  return player === BLACK ? WHITE : BLACK
}

function hasFive(board, row, column, player, size) {
  return [[1, 0], [0, 1], [1, 1], [1, -1]].some(([rowStep, columnStep]) => (
    1
    + count(board, row, column, rowStep, columnStep, player, size)
    + count(board, row, column, -rowStep, -columnStep, player, size)
    >= 5
  ))
}

function count(board, row, column, rowStep, columnStep, player, size) {
  let total = 0
  let nextRow = row + rowStep
  let nextColumn = column + columnStep

  while (
    nextRow >= 0
    && nextRow < size
    && nextColumn >= 0
    && nextColumn < size
    && board[nextRow * size + nextColumn] === player
  ) {
    total += 1
    nextRow += rowStep
    nextColumn += columnStep
  }

  return total
}

