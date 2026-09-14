import { useState } from 'react'
import { games } from './gameCatalog.js'
import GomokuGame from './games/gomoku/GomokuGame.jsx'

function Lobby({ onSelectGame }) {
  return (
    <main className="lobby">
      <header className="lobby__header">
        <span className="lobby__mark" aria-hidden="true">游</span>
        <h1>游戏合集</h1>
      </header>

      <p className="lobby__notice">
        欢迎来到我的游戏小站，点击下方游戏即可开始。
      </p>

      <div className="collections">
        <section className="collection" aria-labelledby="board-games-title">
          <h2 id="board-games-title">桌游合集</h2>
          <div className="game-list">
            {games.map((game) => (
              <button
                className="game-link"
                type="button"
                key={game.id}
                disabled={!game.available}
                onClick={() => onSelectGame(game.id)}
              >
                <span className={`game-link__icon game-link__icon--${game.accent}`} aria-hidden="true">
                  {game.name[0]}
                </span>
                <span>{game.name}</span>
                {!game.available && <small>开发中</small>}
              </button>
            ))}
          </div>
        </section>

        <section className="collection" aria-labelledby="trial-games-title">
          <h2 id="trial-games-title">试玩合集</h2>
          <div className="game-list">
            <a className="game-link" href="./trials/catch-fish-kill-bears/index.html">
              <span className="game-link__icon game-link__icon--blue" aria-hidden="true">捕</span>
              <span>捕鱼杀熊</span>
            </a>
          </div>
        </section>
      </div>
    </main>
  )
}

function App() {
  const [activeGame, setActiveGame] = useState(null)

  if (!activeGame) {
    return <Lobby onSelectGame={setActiveGame} />
  }

  return (
    <div className="site-shell">
      <header className="topbar">
        <button className="brand brand--button" type="button" onClick={() => setActiveGame(null)} aria-label="返回首页">
          <span className="brand__mark" aria-hidden="true">游</span>
          <span>游戏合集</span>
        </button>
        <button className="nav-back" type="button" onClick={() => setActiveGame(null)}>返回大厅</button>
      </header>

      <main>
        {activeGame === 'gomoku' && <GomokuGame onBack={() => setActiveGame(null)} />}
      </main>

      <footer>
        <span>© {new Date().getFullYear()} 我的游戏小站</span>
        <span>Built for GitHub Pages</span>
      </footer>
    </div>
  )
}

export default App
