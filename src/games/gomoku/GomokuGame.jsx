import { useState } from 'react'
import {
  BLACK,
  createGame,
  DRAW,
  playMove,
  undoMove,
  WHITE,
} from './gomoku.js'

const playerNames = {
  [BLACK]: '黑方',
  [WHITE]: '白方',
}

function gameStatus(game) {
  if (game.winner === DRAW) return '棋盘已满，本局平局'
  if (game.winner) return `${playerNames[game.winner]}获胜`
  return `轮到${playerNames[game.currentPlayer]}落子`
}

function GomokuGame({ onBack, onOnline, online = null, children }) {
  const [localGame, setGame] = useState(createGame)
  const game = online?.game || localGame
  const lastMove = game.history.at(-1)

  function restart() {
    if (!game.history.length || window.confirm('确定重新开始这局游戏吗？')) {
      setGame(createGame())
    }
  }

  return (
    <section className="game-screen" aria-labelledby="gomoku-title">
      <div className="game-screen__heading">
        <div>
          <button className="text-button" type="button" onClick={onBack}>← 返回游戏大厅</button>
          <p className="eyebrow">{online ? '在线对战' : '本地双人'}</p>
          <h1 id="gomoku-title">五子棋</h1>
        </div>
        <p>{online ? '分享房间邀请，与朋友各用一台设备对战。黑方先手，率先连成五子者获胜。' : '双方使用同一台设备轮流落子，率先连成五子者获胜。'}</p>
      </div>

      {!online && <button className="control-button mode-button" type="button" onClick={onOnline}>与朋友在线对战 →</button>}

      {children}

      <div className="game-stage">
        <div className="gomoku-board-wrap">
          <div
            className="gomoku-board"
            data-player={game.currentPlayer}
            role="grid"
            aria-label="十五乘十五五子棋棋盘"
          >
            {game.board.map((cell, index) => {
              const row = Math.floor(index / game.size)
              const column = index % game.size
              const isLastMove = lastMove?.row === row && lastMove?.column === column

              return (
                <button
                  className="gomoku-cell"
                  type="button"
                  role="gridcell"
                  key={index}
                  disabled={Boolean(cell) || Boolean(game.winner) || Boolean(online && !online.canMove)}
                  onClick={() => online ? online.move(row, column) : setGame((current) => playMove(current, row, column))}
                  aria-label={`第 ${row + 1} 行，第 ${column + 1} 列${cell ? `，${playerNames[cell]}棋子` : '，空位'}`}
                >
                  {cell && (
                    <span
                      className={`gomoku-stone gomoku-stone--${cell}${isLastMove ? ' gomoku-stone--last' : ''}`}
                      aria-hidden="true"
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <aside className="game-panel" aria-label="对局信息与控制">
          <div className={`turn-card turn-card--${game.winner || game.currentPlayer}`}>
            <span className="turn-card__stone" aria-hidden="true" />
            <div>
              <span>当前状态</span>
              <strong aria-live="polite">{online ? online.status : gameStatus(game)}</strong>
            </div>
          </div>

          <dl className="game-stats">
            <div>
              <dt>棋盘</dt>
              <dd>15 × 15</dd>
            </div>
            <div>
              <dt>已走</dt>
              <dd>{game.history.length} 步</dd>
            </div>
            <div>
              <dt>规则</dt>
              <dd>自由五子棋</dd>
            </div>
          </dl>

          {!online && <div className="game-actions">
            <button
              className="control-button control-button--primary"
              type="button"
              disabled={!game.history.length}
              onClick={() => setGame(undoMove)}
            >
              悔棋一步
            </button>
            <button className="control-button" type="button" onClick={restart}>
              重新开始
            </button>
          </div>}

          <div className="rule-note">
            <strong>游戏规则</strong>
            <p>黑方先手。横、竖或斜线连续出现五颗或更多同色棋子即获胜。</p>
          </div>
        </aside>
      </div>
    </section>
  )
}

export default GomokuGame

