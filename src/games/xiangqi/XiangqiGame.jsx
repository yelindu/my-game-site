import { useEffect, useState } from 'react'
import { agreeDraw, createGame, isInCheck, legalMoves, pieceNames, playMove, sideNames, undoMove } from './xiangqi.js'
import './xiangqi.css'

function BoardLines() {
  return (
    <svg className="xiangqi-lines" viewBox="0 0 900 1000" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2">
        {Array.from({ length: 10 }, (_, r) => <path key={`r${r}`} d={`M50 ${50 + r * 100}H850`} />)}
        {[50, 850].map((x) => <path key={x} d={`M${x} 50V950`} />)}
        {Array.from({ length: 7 }, (_, c) => <path key={`c${c}`} d={`M${150 + c * 100} 50V450 M${150 + c * 100} 550V950`} />)}
        <path d="M350 50L550 250 M550 50L350 250 M350 750L550 950 M550 750L350 950" />
      </g>
      <g className="xiangqi-river" textAnchor="middle">
        <text x="250" y="516">楚 河</text><text x="650" y="516">汉 界</text>
      </g>
    </svg>
  )
}

export default function XiangqiGame({ onBack, onOnline, online, children }) {
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
  if (game.winner === 'draw') status = '双方同意，本局和棋'
  else if (game.winner) status = `${sideNames[game.winner]}获胜 · ${game.reason === 'checkmate' ? '将死' : '困毙'}`
  if (online) status = online.status

  function choose(index) {
    if (game.winner || (online && !online.canMove)) return
    setConfirmation(null)
    setMessage('')
    if (game.board[index]?.side === game.currentPlayer) {
      setSelected(index === selected ? null : index)
    } else if (selected !== null) {
      const next = playMove(game, selected, index)
      if (next === game) setMessage('这步不能走：请按棋子的走法移动，并确保己方将帅安全。')
      else {
        if (online) void online.move(selected, index)
        else setGame(next)
        setSelected(null)
      }
    } else setMessage('请先选择当前一方的棋子。')
  }
  function replace(next) { setGame(next); setSelected(null); setMessage(''); setConfirmation(null) }

  return (
    <section className="game-screen" aria-labelledby="xiangqi-title">
      <div className="game-screen__heading">
        <div>
          <button className="text-button" type="button" onClick={onBack}>← 返回游戏大厅</button>
          <p className="eyebrow">{online ? '在线双人' : '本地双人'} · 红方先行</p>
          <h1 id="xiangqi-title">中国象棋</h1>
        </div>
        <p>{online ? '邀请朋友在各自设备上对弈。' : '两人使用同一台设备轮流走棋。'}先点自己的棋子，再点标记的位置移动或吃子。</p>
      </div>
      <div className="game-stage">
        <div className="xiangqi-board-wrap">
          <div className="xiangqi-board" role="grid" aria-label="九路十行中国象棋棋盘">
            <BoardLines />
            {game.board.map((piece, index) => {
              const canMove = destinations.includes(index)
              return (
                <button type="button" role="gridcell" key={index} disabled={Boolean(game.winner) || Boolean(online && !online.canMove)}
                  className={`xiangqi-cell${index === selected ? ' xiangqi-cell--selected' : ''}${canMove ? ' xiangqi-cell--legal' : ''}${index === last?.to || index === last?.from ? ' xiangqi-cell--last' : ''}`}
                  aria-label={`第 ${Math.floor(index / 9) + 1} 行，第 ${index % 9 + 1} 列，${piece ? sideNames[piece.side] + pieceNames[piece.side][piece.type] : '空位'}${canMove ? '，可走' : ''}`}
                  aria-selected={index === selected} onClick={() => choose(index)}>
                  {piece && <span className={`xiangqi-piece xiangqi-piece--${piece.side}${checked && piece.side === game.currentPlayer && piece.type === 'king' ? ' xiangqi-piece--check' : ''}`} aria-hidden="true">{pieceNames[piece.side][piece.type]}</span>}
                  {!piece && canMove && <span className="xiangqi-destination" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
          <p className="xiangqi-selection" role="status">{message || (game.winner ? status : selectedPiece ? `已选择${sideNames[selectedPiece.side]}${pieceNames[selectedPiece.side][selectedPiece.type]}，有 ${destinations.length} 个可走位置。` : '点击棋子查看可走位置。红方在下，黑方在上。')}</p>
        </div>
        <aside className="game-panel" aria-label="象棋对局信息与控制">
          <div className={`turn-card turn-card--${game.winner || game.currentPlayer}`}>
            <span className="turn-card__stone" aria-hidden="true" />
            <div><span>当前状态</span><strong aria-live="polite">{status}</strong></div>
          </div>
          <dl className="game-stats">
            <div><dt>已走</dt><dd>{game.history.length} 步</dd></div>
            <div><dt>红方剩余</dt><dd>{game.board.filter((p) => p?.side === 'red').length} 子</dd></div>
            <div><dt>黑方剩余</dt><dd>{game.board.filter((p) => p?.side === 'black').length} 子</dd></div>
          </dl>
          {!online && <div className="game-actions">
            {onOnline && <button className="control-button control-button--primary" type="button" onClick={onOnline}>与朋友在线对战</button>}
            <button className="control-button control-button--primary" type="button" disabled={!game.history.length} onClick={() => replace(undoMove(game))}>悔棋一步</button>
            <button className="control-button" type="button" onClick={() => game.history.length ? setConfirmation('restart') : replace(createGame())}>重新开始</button>
            <button className="control-button" type="button" disabled={Boolean(game.winner)} onClick={() => setConfirmation('draw')}>双方同意和棋</button>
            {confirmation && <div className="xiangqi-confirmation" role="group" aria-label={confirmation === 'draw' ? '确认和棋' : '确认重开'}>
              <p>{confirmation === 'draw' ? '双方都同意结束本局并记为和棋吗？' : '重新开始会清空本局走棋记录，确定继续吗？'}</p>
              <button className="control-button" type="button" onClick={() => replace(confirmation === 'draw' ? agreeDraw(game) : createGame())}>{confirmation === 'draw' ? '确认和棋' : '确认重开'}</button>
              <button className="control-button" type="button" onClick={() => setConfirmation(null)}>取消</button>
            </div>}
          </div>}
          {children}
          <div className="rule-note">
            <strong>走棋规则</strong>
            <p>车走直线；马走日、象走田，注意马腿与象眼；炮隔一子吃子；兵卒过河后可横走，不能后退。士与将帅不出九宫，象不过河。</p>
            <p>被将军时必须应将，不能送将或让将帅照面。将死或无合法走法（困毙）判负。</p>
            <p>休闲对局，长将、长捉和重复局面由双方协商，可{online ? '请求和棋，由对方确认' : '选择“双方同意和棋”'}。</p>
            <p>{online ? '对局自动保存，刷新后可通过当前邀请恢复。联机暂不支持悔棋，新一局请创建新房间。' : '本局保存在当前页面，刷新或返回大厅后会重新开局。'}</p>
          </div>
        </aside>
      </div>
    </section>
  )
}
