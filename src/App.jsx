import { useState } from 'react'
import { games } from './gameCatalog.js'
import GomokuGame from './games/gomoku/GomokuGame.jsx'
import OnlineGomoku from './games/gomoku/OnlineGomoku.jsx'
import XiangqiGame from './games/xiangqi/XiangqiGame.jsx'
import OnlineXiangqi from './games/xiangqi/OnlineXiangqi.jsx'
import GameHub from './components/GameHub.jsx'
import DoudizhuGame from './games/doudizhu/DoudizhuGame.jsx'
import OnlineDoudizhu from './games/doudizhu/OnlineDoudizhu.jsx'
import UndercoverGame from './games/undercover/UndercoverGame.jsx'
import OnlineUndercover from './games/undercover/OnlineUndercover.jsx'
import GoGame from './games/go/GoGame.jsx'
import OnlineGo from './games/go/OnlineGo.jsx'

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
              <span>营地捕鱼</span>
            </a>
            <a className="game-link" href="./trials/gatling-pameng/index.html">
              <span className="game-link__icon game-link__icon--red" aria-hidden="true">萌</span>
              <span>加特林帕萌</span>
            </a>
            <a className="game-link" href="./trials/forge-sword-kill-bears/index.html">
              <span className="game-link__icon game-link__icon--blue" aria-hidden="true">铸</span>
              <span>铸剑战大熊</span>
            </a>
            <a className="game-link" href="./trials/jian-yu/index.html">
              <span className="game-link__icon game-link__icon--blue" aria-hidden="true">捡</span>
              <span>捡鱼</span>
            </a>
            <a className="game-link" href="./trials/xiaoche-yunmu/index.html">
              <span className="game-link__icon game-link__icon--red" aria-hidden="true">车</span>
              <span>小车运木</span>
            </a>
            <a className="game-link" href="./trials/bu-yu-sha-xiong/index.html">
              <span className="game-link__icon game-link__icon--red" aria-hidden="true">鱼</span>
              <span>捕鱼杀熊</span>
            </a>
            <a className="game-link" href="./trials/yu-chuan-qie-rou-bu-yu/index.html">
              <span className="game-link__icon game-link__icon--blue" aria-hidden="true">渔</span>
              <span>渔船切肉捕鱼</span>
            </a>
          </div>
        </section>
      </div>
    </main>
  )
}

function App() {
  const [activeGame, setActiveGame] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const game = ['xiangqi', 'doudizhu', 'undercover', 'go'].includes(params.get('game')) ? params.get('game') : 'gomoku'
    return params.has('room') ? `${game}-online` : null
  })

  function returnToLobby() {
    const url = new URL(window.location.href)
    url.searchParams.delete('room')
    url.searchParams.delete('game')
    window.history.replaceState(null, '', url)
    setActiveGame(null)
  }

  if (!activeGame) {
    return <Lobby onSelectGame={setActiveGame} />
  }

  if (activeGame === 'undercover' || activeGame === 'undercover-online') {
    return <GameHub name="谁是卧底" mark="？" LocalGame={UndercoverGame} OnlineGame={OnlineUndercover} onBack={returnToLobby} initialOnline={activeGame === 'undercover-online'} localLabel="本地聚会" />
  }
  if (activeGame === 'go' || activeGame === 'go-online') {
    return <GameHub name="围棋" mark="⚫" LocalGame={GoGame} OnlineGame={OnlineGo} onBack={returnToLobby} initialOnline={activeGame === 'go-online'} />
  }
  if (activeGame === 'doudizhu' || activeGame === 'doudizhu-online') {
    return <GameHub name="斗地主" mark="♠" LocalGame={DoudizhuGame} OnlineGame={OnlineDoudizhu} onBack={returnToLobby} initialOnline={activeGame === 'doudizhu-online'} localLabel="本地对战（电脑）" />
  }
  if (activeGame === 'xiangqi' || activeGame === 'xiangqi-online') {
    return <GameHub name="象棋" mark="♜" LocalGame={XiangqiGame} OnlineGame={OnlineXiangqi} onBack={returnToLobby} initialOnline={activeGame === 'xiangqi-online'} />
  }
  return <GameHub name="五子棋" mark="●" LocalGame={GomokuGame} OnlineGame={OnlineGomoku} onBack={returnToLobby} initialOnline={activeGame === 'gomoku-online'} />
}

export default App
