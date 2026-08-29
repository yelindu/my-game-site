import { useState } from 'react'
import { games } from './gameCatalog.js'
import GomokuGame from './games/gomoku/GomokuGame.jsx'

const previewStones = [
  ['black', 2, 2],
  ['white', 3, 2],
  ['black', 3, 3],
  ['white', 2, 3],
  ['black', 4, 4],
  ['white', 4, 3],
  ['black', 5, 5],
]

function BoardPreview() {
  return (
    <div className="board" aria-label="五子棋棋盘预览">
      {previewStones.map(([color, column, row], index) => (
        <span
          className={`stone stone--${color}`}
          key={`${color}-${column}-${row}`}
          style={{ '--column': column, '--row': row }}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

function App() {
  const [activeGame, setActiveGame] = useState(null)

  return (
    <div className="site-shell">
      <header className="topbar">
        <button className="brand brand--button" type="button" onClick={() => setActiveGame(null)} aria-label="返回首页">
          <span className="brand__mark" aria-hidden="true">棋</span>
          <span>我的游戏小站</span>
        </button>
        {activeGame ? (
          <button className="nav-back" type="button" onClick={() => setActiveGame(null)}>返回大厅</button>
        ) : (
          <nav aria-label="主要导航">
            <a href="#games">游戏大厅</a>
            <a href="#about">关于本站</a>
          </nav>
        )}
      </header>

      {activeGame === 'gomoku' ? (
        <main>
          <GomokuGame onBack={() => setActiveGame(null)} />
        </main>
      ) : (
      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__copy">
            <p className="eyebrow">随时开局 · 轻松对弈</p>
            <h1 id="hero-title">来一盘，<br />把日常放慢一点。</h1>
            <p className="hero__intro">
              这里会收集适合和朋友一起玩的棋类小游戏。第一站，从五子棋开始。
            </p>
            <a className="primary-button" href="#games">看看游戏</a>
          </div>
          <div className="hero__visual">
            <BoardPreview />
            <p>黑方落子 · 对局预览</p>
          </div>
        </section>

        <section className="games-section" id="games" aria-labelledby="games-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">游戏大厅</p>
              <h2 id="games-title">选择一场对局</h2>
            </div>
            <p>五子棋本地双人版已经开放，叫上身边的朋友来一局。</p>
          </div>

          <div className="game-grid">
            {games.map((game, index) => (
              <article className={`game-card game-card--${game.accent}`} key={game.id}>
                <div className="game-card__number">0{index + 1}</div>
                <div>
                  <span className="status">{game.status}</span>
                  <h3>{game.name}</h3>
                  <p>{game.description}</p>
                </div>
                <button
                  type="button"
                  disabled={!game.available}
                  onClick={() => game.available && setActiveGame(game.id)}
                >
                  {game.available ? '开始游戏 →' : '等待开放'}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="about" id="about" aria-labelledby="about-title">
          <p className="eyebrow">关于本站</p>
          <h2 id="about-title">一个持续生长的个人游戏空间</h2>
          <p>
            先把一款游戏做好，再逐步增加在线房间、对局记录和更多棋类游戏。
            网站会保持简单、好用，并兼顾手机和电脑。
          </p>
        </section>
      </main>
      )}

      <footer>
        <span>© {new Date().getFullYear()} 我的游戏小站</span>
        <span>Built for GitHub Pages</span>
      </footer>
    </div>
  )
}

export default App
