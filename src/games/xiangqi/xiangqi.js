export const RED = 'red'
export const BLACK = 'black'
export const sideNames = { red: '红方', black: '黑方' }
export const pieceNames = {
  red: { king: '帅', advisor: '仕', elephant: '相', horse: '马', rook: '车', cannon: '炮', pawn: '兵' },
  black: { king: '将', advisor: '士', elephant: '象', horse: '马', rook: '车', cannon: '炮', pawn: '卒' },
}
const other = (side) => side === RED ? BLACK : RED
const row = (index) => Math.floor(index / 9)
const column = (index) => index % 9
const valid = (index) => Number.isInteger(index) && index >= 0 && index < 90
const palace = (side, r, c) => c >= 3 && c <= 5 && (side === RED ? r >= 7 && r <= 9 : r >= 0 && r <= 2)

export function createGame() {
  const board = Array(90).fill(null)
  const back = ['rook', 'horse', 'elephant', 'advisor', 'king', 'advisor', 'elephant', 'horse', 'rook']
  for (const side of [BLACK, RED]) {
    const r = side === RED ? 9 : 0
    back.forEach((type, c) => { board[r * 9 + c] = { side, type } })
    for (const c of [1, 7]) board[(side === RED ? 7 : 2) * 9 + c] = { side, type: 'cannon' }
    for (const c of [0, 2, 4, 6, 8]) board[(side === RED ? 6 : 3) * 9 + c] = { side, type: 'pawn' }
  }
  return { board, currentPlayer: RED, winner: null, reason: null, history: [] }
}

// Counts screens between aligned intersections, excluding both endpoints.
function screens(board, from, to) {
  const dr = row(to) - row(from)
  const dc = column(to) - column(from)
  if (dr && dc) return -1
  const step = dr ? Math.sign(dr) * 9 : Math.sign(dc)
  let count = 0
  for (let i = from + step; i !== to; i += step) if (board[i]) count++
  return count
}

function reaches(board, from, to) {
  if (!valid(from) || !valid(to) || from === to) return false
  const piece = board[from]
  const target = board[to]
  if (!piece || target?.side === piece.side) return false
  const r = row(from), c = column(from)
  const dr = row(to) - r, dc = column(to) - c
  const ar = Math.abs(dr), ac = Math.abs(dc)
  switch (piece.type) {
    case 'rook': return screens(board, from, to) === 0
    case 'cannon': return screens(board, from, to) === (target ? 1 : 0)
    case 'horse':
      return (ar === 2 && ac === 1 && !board[(r + Math.sign(dr)) * 9 + c])
        || (ar === 1 && ac === 2 && !board[r * 9 + c + Math.sign(dc)])
    case 'elephant':
      return ar === 2 && ac === 2 && (piece.side === RED ? row(to) >= 5 : row(to) <= 4)
        && !board[(r + dr / 2) * 9 + c + dc / 2]
    case 'advisor': return ar === 1 && ac === 1 && palace(piece.side, row(to), column(to))
    case 'king':
      if (target?.type === 'king' && dc === 0 && screens(board, from, to) === 0) return true
      return ar + ac === 1 && palace(piece.side, row(to), column(to))
    case 'pawn':
      return (dc === 0 && dr === (piece.side === RED ? -1 : 1))
        || (dr === 0 && ac === 1 && (piece.side === RED ? r <= 4 : r >= 5))
    default: return false
  }
}

export function isInCheck(board, side) {
  const king = board.findIndex((piece) => piece?.side === side && piece.type === 'king')
  if (king < 0) return true
  return board.some((piece, index) => piece?.side === other(side) && reaches(board, index, king))
}

function movedBoard(board, from, to) {
  const next = board.slice()
  next[to] = next[from]
  next[from] = null
  return next
}

export function legalMoves(board, from) {
  if (!valid(from) || !board[from]) return []
  const side = board[from].side
  return board.flatMap((piece, to) => piece?.type !== 'king' && reaches(board, from, to)
    && !isInCheck(movedBoard(board, from, to), side) ? [to] : [])
}

export function hasLegalMove(board, side) {
  return board.some((piece, index) => piece?.side === side && legalMoves(board, index).length > 0)
}

export function playMove(game, from, to) {
  if (game.winner || !valid(from) || !valid(to) || game.board[from]?.side !== game.currentPlayer
    || !legalMoves(game.board, from).includes(to)) return game
  const board = movedBoard(game.board, from, to)
  const currentPlayer = other(game.currentPlayer)
  const ended = !hasLegalMove(board, currentPlayer)
  return {
    board, currentPlayer,
    winner: ended ? game.currentPlayer : null,
    reason: ended ? (isInCheck(board, currentPlayer) ? 'checkmate' : 'stalemate') : null,
    history: [...game.history, { board: game.board, currentPlayer: game.currentPlayer, from, to, captured: game.board[to] }],
  }
}

export function undoMove(game) {
  const last = game.history.at(-1)
  if (!last) return game
  return { board: last.board, currentPlayer: last.currentPlayer, winner: null, reason: null, history: game.history.slice(0, -1) }
}

export function agreeDraw(game) {
  return game.winner ? game : { ...game, winner: 'draw', reason: 'agreed' }
}
