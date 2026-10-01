import { useEffect, useState } from 'react'
import { agreeDraw, createGame, isInCheck, legalMoves, pieceNames, playMove, sideNames, undoMove } from './xiangqi.js'
import { piecesForGame } from './pieces.js'
import './xiangqi.css'

function BoardLines() {
  return <svg className="xiangqi-lines" viewBox="0 0 900 1000" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="2">
      {Array.from({ length: 10 }, (_, r) => <path key={`r${r}`} d={`M50 ${50 + r * 100}H850`} />)}
      {[50, 850].map(x => <path key={x} d={`M${x} 50V950`} />)}
      {Array.from({ length: 7 }, (_, c) => <path key={`c${c}`} d={`M${150 + c * 100} 50V450 M${150 + c * 100} 550V950`} />)}
      <path d="M350 50L550 250 M550 50L350 250 M350 750L550 950 M550 750L350 950" />
    </g>
    <g className="xiangqi-river" textAnchor="middle"><text x="250" y="516">楚 河</text><text x="650" y="516">汉 界</text></g>
  </svg>
}

export default function XiangqiGame({ onBack, online, children, headerActions }) {
  const [localGame, setGame] = useState(createGame)
  const game = online ? online.game : localGame
  const [selected, setSelected] = useState(null)
  const [message, setMessage] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  useEffect(() => { setSelected(null); setMessage('') }, [game.history.length, game.winner, online?.connection, online?.roomId])
  const destinations = selected === null ? [] : legalMoves(game.board, selected)
  const checked = !game.winner && isInCheck(game.board, game.currentPlayer)
  const last = game.history.at(-1)
  const selectedPiece = game.board[selected]
  let status = `轮到${sideNames[game.currentPlayer]}${checked ? '应将' : '走棋'}`
  if (game.winner === 'draw') status = '本局和棋'
  else if (game.winner) status = `${sideNames[game.winner]}获胜 · ${game.reason === 'checkmate' ? '将死' : '困毙'}`
  if (online) status = online.status
  function choose(index) {
    if (game.winner || (online && !online.canMove)) return
    setConfirmation(null); setMessage('')
    if (game.board[index]?.side === game.currentPlayer) setSelected(index === selected ? null : index)
    else if (selected !== null) {
      const next = playMove(game, selected, index)
      if (next === game) setMessage('这步不能走，请选择标记的位置。')
      else {
        if (online) void online.move(selected, index)
        else setGame(next)
        setSelected(null)
      }
    } else setMessage('请先选择自己的棋子。')
  }
  function replace(next) { setGame(next); setSelected(null); setMessage(''); setConfirmation(null) }
  return <section className="xiangqi-match" aria-label="中国象棋对局">
    <header className="xiangqi-mini-header">
      <button className="xiangqi-button xiangqi-button--small" onClick={onBack}>返回主页</button>
      <div><h1>象棋</h1><small>{online ? `房间号：${online.room?.code}` : '本地对战'}</small></div>
      {headerActions || <span />}
    </header>
    <p className="xiangqi-match-status" role="status">{status}</p>
    {online && <p className="xiangqi-player-names">红方：{online.room?.red_name || '棋友'} <span>对</span> 黑方：{online.room?.black_name || '棋友'}</p>}
    <div className="xiangqi-board-wrap">
      <div className="xiangqi-board" role="grid" aria-label="九路十行中国象棋棋盘">
        <BoardLines />
        {game.board.map((piece, index) => <button type="button" role="gridcell" key={index}
          disabled={Boolean(game.winner) || Boolean(online && !online.canMove)}
          className={`xiangqi-cell${index === selected ? ' xiangqi-cell--selected' : ''}${destinations.includes(index) ? ' xiangqi-cell--legal' : ''}${index === last?.to || index === last?.from ? ' xiangqi-cell--last' : ''}`}
          aria-label={`第 ${Math.floor(index / 9) + 1} 行，第 ${index % 9 + 1} 列，${piece ? sideNames[piece.side] + pieceNames[piece.side][piece.type] : '空位'}${destinations.includes(index) ? '，可走' : ''}`}
          aria-selected={index === selected} onClick={() => choose(index)}>
          {destinations.includes(index) && <span className="xiangqi-destination" aria-hidden="true" />}
        </button>)}
        <div className="xiangqi-piece-layer" aria-hidden="true">
          {piecesForGame(game).map(piece => <span key={piece.id} data-piece-id={piece.id}
            className={`xiangqi-piece xiangqi-piece--${piece.side}${piece.index === selected ? ' xiangqi-piece--selected' : ''}${checked && piece.side === game.currentPlayer && piece.type === 'king' ? ' xiangqi-piece--check' : ''}`}
            style={{ left: `${(piece.index % 9 + .5) * 100 / 9}%`, top: `${(Math.floor(piece.index / 9) + .5) * 10}%` }}>
            {pieceNames[piece.side][piece.type]}
          </span>)}
        </div>
      </div>
    </div>
    <p className="xiangqi-selection" role="status">{message || (selectedPiece ? `已选择${sideNames[selectedPiece.side]}${pieceNames[selectedPiece.side][selectedPiece.type]}` : '\u00a0')}</p>
    {!online && <div className="xiangqi-controls">
      <button className="xiangqi-button" disabled={!game.history.length} onClick={() => replace(undoMove(game))}>悔棋</button>
      <button className="xiangqi-button" onClick={() => game.history.length ? setConfirmation('restart') : replace(createGame())}>重新开始</button>
      <button className="xiangqi-button" disabled={Boolean(game.winner)} onClick={() => setConfirmation('draw')}>和棋</button>
      {confirmation && <div className="xiangqi-confirmation" role="group" aria-label={confirmation === 'draw' ? '确认和棋' : '确认重开'}>
        <p>{confirmation === 'draw' ? '双方都同意和棋吗？' : '确定重新开始吗？'}</p>
        <button className="xiangqi-button" onClick={() => replace(confirmation === 'draw' ? agreeDraw(game) : createGame())}>{confirmation === 'draw' ? '确认和棋' : '确认重开'}</button>
        <button className="xiangqi-button" onClick={() => setConfirmation(null)}>取消</button>
      </div>}
    </div>}
    {children}
  </section>
}
