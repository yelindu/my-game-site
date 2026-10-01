import { useState } from 'react'
import { createGame, DRAW, playMove, undoMove } from './gomoku.js'
import './gomoku.css'

const names = { black: '黑方', white: '白方' }

export default function GomokuGame({ onBack, online, children, headerActions }) {
  const [localGame, setGame] = useState(createGame)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const game = online?.game || localGame
  const lastMove = game.history.at(-1)
  const status = online?.status || (game.winner === DRAW ? '棋盘已满，本局平局' : game.winner ? `${names[game.winner]}获胜` : `轮到${names[game.currentPlayer]}落子`)
  return <section className="gomoku-match" aria-label="五子棋对局">
    <header className="boardgame-mini-header">
      <button className="boardgame-button boardgame-button--small" onClick={onBack}>返回主页</button>
      <div><h1>五子棋</h1><small>{online ? `房间号：${online.room?.code}` : '本地对战'}</small></div>
      {headerActions || <span />}
    </header>
    <p className="boardgame-match-status" role="status">{status}</p>
    {online && <p className="boardgame-player-names">黑方：{online.room?.black_name || '棋友'} <span>对</span> 白方：{online.room?.white_name || '棋友'}</p>}
    <div className="gomoku-board-wrap">
      <div className="gomoku-board" data-player={game.currentPlayer} role="grid" aria-label="十五乘十五五子棋棋盘">
        {game.board.map((cell, index) => {
          const row = Math.floor(index / game.size), column = index % game.size
          const isLastMove = lastMove?.row === row && lastMove?.column === column
          return <button className="gomoku-cell" type="button" role="gridcell" key={index}
            disabled={Boolean(cell) || Boolean(game.winner) || Boolean(online && !online.canMove)}
            onClick={() => { setConfirmRestart(false); online ? void online.move(row, column) : setGame(current => playMove(current, row, column)) }}
            aria-label={`第 ${row + 1} 行，第 ${column + 1} 列${cell ? `，${names[cell]}棋子` : '，空位'}`}>
            {cell && <span className={`gomoku-stone gomoku-stone--${cell}${isLastMove ? ' gomoku-stone--last' : ''}`} aria-hidden="true" />}
          </button>
        })}
      </div>
    </div>
    {!online && <div className="boardgame-controls">
      <button className="boardgame-button" disabled={!game.history.length} onClick={() => { setGame(undoMove); setConfirmRestart(false) }}>悔棋</button>
      <button className="boardgame-button" onClick={() => game.history.length ? setConfirmRestart(true) : setGame(createGame())}>重新开始</button>
      {confirmRestart && <div className="boardgame-confirmation" role="group" aria-label="确认重开">
        <p>确定重新开始吗？</p>
        <button className="boardgame-button" onClick={() => { setGame(createGame()); setConfirmRestart(false) }}>确认重开</button>
        <button className="boardgame-button" onClick={() => setConfirmRestart(false)}>取消</button>
      </div>}
    </div>}
    {children}
  </section>
}
