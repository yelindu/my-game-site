import { useState } from 'react'
import XiangqiGame from './XiangqiGame.jsx'
import OnlineXiangqi from './OnlineXiangqi.jsx'
import './xiangqi.css'

export default function XiangqiHub({ onBack, initialOnline = false }) {
  const [view, setView] = useState(initialOnline ? 'online' : 'menu')
  const [code, setCode] = useState('')
  const [invite, setInvite] = useState(() => new URLSearchParams(window.location.search).get('room') || null)
  function menu() {
    const url = new URL(window.location.href)
    url.searchParams.delete('room'); url.searchParams.delete('game')
    window.history.replaceState(null, '', url)
    setInvite(null); setView('menu')
  }
  return (
    <main className="xiangqi-shell">
      {view === 'local' ? <XiangqiGame onBack={menu} />
        : view === 'online' ? <OnlineXiangqi onBack={menu} inviteCode={invite} />
          : <section className="xiangqi-menu" aria-label="象棋玩法入口">
            <button className="xiangqi-back" onClick={onBack}>返回大厅</button>
            <h1><span aria-hidden="true">♜</span> 象棋</h1>
            <div className="xiangqi-menu__buttons">
              <button className="xiangqi-button" onClick={() => setView('local')}>本地对战</button>
              <button className="xiangqi-button xiangqi-button--primary" onClick={() => { setInvite(null); setView('online') }}>创建房间</button>
            </div>
            <form className="xiangqi-join" onSubmit={event => { event.preventDefault(); setInvite(code.trim().toUpperCase()); setView('online') }}>
              <input aria-label="房间号" placeholder="输入房间号，进入指定房间" value={code} onChange={event => setCode(event.target.value.toUpperCase())} maxLength={8} minLength={8} pattern="[A-Za-z0-9]{8}" autoCapitalize="characters" autoComplete="off" required />
              <button className="xiangqi-button" disabled={!/^[A-Z0-9]{8}$/.test(code.trim())}>进入房间</button>
            </form>
          </section>}
    </main>
  )
}
