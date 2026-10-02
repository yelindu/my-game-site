import { useEffect, useState } from 'react'
import { createGame, playerSeat, speak, undercoverCount, vote } from './undercover.js'
import './undercover.css'

const roleNames = { civilian: '平民', undercover: '卧底' }

export default function UndercoverGame({ online, onBack, headerActions, children }) {
  const [count, setCount] = useState(6)
  const [names, setNames] = useState(Array.from({ length: 8 }, (_, i) => `玩家${i + 1}`))
  const [local, setLocal] = useState(null)
  const [dealSeat, setDealSeat] = useState(0)
  const [handed, setHanded] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [text, setText] = useState('')
  const [target, setTarget] = useState(null)
  const [error, setError] = useState('')
  const game = online ? online.game : local
  const seat = online ? playerSeat(online.room, online.user?.id) : !game || game.phase === 'finished' ? null : game.phase === 'dealing' ? dealSeat : game.phase === 'speaking' ? game.turn : game.alive.find(s => !game.voted.includes(s)) ?? null
  const word = online ? game.word : game?.assignments[seat]?.word
  useEffect(() => { setHanded(false); setRevealed(false); setText(''); setTarget(null); setError('') }, [seat, game?.ballotId, game?.gameNo, game?.round, game?.phase])
  const ready = !online || online.connection === 'connected' && !online.busy
  const playing = seat !== null && game?.alive.includes(seat)
  const canSpeak = ready && playing && game.phase === 'speaking' && game.turn === seat
  const canVote = ready && playing && game.phase === 'voting' && !game.voted.includes(seat)
  function start() {
    try { setLocal({ ...createGame(names.slice(0, count)), phase: 'dealing' }); setDealSeat(0); setHanded(false); setRevealed(false); setError('') }
    catch (failure) { setError(failure.message) }
  }
  async function action(command) {
    setError('')
    try {
      if (online) await online.submit('undercover_game_action', { action: command, expected_version: game.version, description: text, target_seat: target, expected_ballot: game.ballotId })
      else {
        const next = command === 'vote' ? vote(local, seat, target) : speak(local, seat, text, command === 'skip')
        setHanded(false); setRevealed(false); setLocal(next)
      }
    } catch (failure) { setError(failure.message) }
  }
  function nextWord() {
    setRevealed(false); setHanded(false)
    if (dealSeat + 1 < game.players.length) setDealSeat(dealSeat + 1)
    else setLocal({ ...local, phase: 'speaking', version: local.version + 1 })
  }
  const header = <header className="boardgame-mini-header">
    <button className="boardgame-button boardgame-button--small" onClick={onBack}>返回主页</button>
    <div><h1>谁是卧底</h1><small>{online ? `房间号：${online.room?.code}` : '本地聚会 · 轮流传递设备'}</small></div>{headerActions}
  </header>
  if (!game) return <div className="uc-game">{header}<section className="uc-setup">
    <label>玩家人数<select aria-label="玩家人数" value={count} onChange={e => setCount(Number(e.target.value))}>{[4,5,6,7,8].map(n => <option key={n} value={n}>{n} 人</option>)}</select></label>
    <div className="uc-name-inputs">{names.slice(0,count).map((name,i) => <input key={i} aria-label={`玩家${i+1}名字`} maxLength={12} value={name} onChange={e => setNames(names.map((n,s) => s === i ? e.target.value : n))} />)}</div>
    <p className="boardgame-room-hint">{count} 人 · {undercoverCount(count)} 位卧底</p>
    <button className="boardgame-button boardgame-button--primary" onClick={start}>开始分词</button>{error && <p role="alert">{error}</p>}
  </section></div>
  if (!online && game.phase !== 'finished' && !handed) return <div className="uc-game">{header}<section className="uc-handoff">
    <span className="uc-avatar">{seat + 1}</span><h2>请将设备交给 {game.players[seat].name}</h2>
    <p>其他玩家请暂时移开视线</p><button className="boardgame-button boardgame-button--primary" onClick={() => setHanded(true)}>我已接过设备</button>
  </section></div>
  const name = s => game.players[s]?.name || `${s + 1} 号`
  const occupied = game.players.flatMap((p,s) => p ? [s] : [])
  let status = game.phase === 'dealing' ? '查看词语后，交给下一位玩家' : game.phase === 'speaking' ? `第 ${game.round} 轮 · ${name(game.turn)} 发言` : game.phase === 'voting' ? `第 ${game.round} 轮 · ${game.revotes ? '平票重投' : '投票'}（${game.voted.length}/${game.alive.length}）` : `${roleNames[game.winner]}获胜`
  if (online && online.connection !== 'connected') status = '连接恢复中，请稍候…'
  const assignments = game.phase === 'finished' ? online ? game.result : game.assignments : null
  return <div className="uc-game">{header}{children}<p className="uc-status" role="status">{status}</p>
    {word && game.phase !== 'finished' && <section className="uc-secret" aria-label="你的秘密词语">
      <small>{name(seat)}，只有你能查看</small><div className={revealed ? 'uc-word uc-word--revealed' : 'uc-word'}>{revealed ? word : '••••'}</div>
      <button className="boardgame-button boardgame-button--small" onClick={() => setRevealed(!revealed)}>{revealed ? '隐藏词语' : '查看我的词语'}</button>
    </section>}
    {game.phase === 'dealing' ? <div className="boardgame-controls"><button className="boardgame-button boardgame-button--primary" onClick={nextWord}>{dealSeat + 1 === game.players.length ? '词语查看完毕，开始描述' : '隐藏并交给下一位'}</button></div> : <>
      <div className="uc-players" aria-label="玩家座位">{occupied.map(s => {
        const out = game.eliminated.find(p => p.seat === s)
        return <button key={s} className={`uc-player${game.turn === s && game.phase === 'speaking' ? ' uc-player--active' : ''}${target === s ? ' uc-player--selected' : ''}${out ? ' uc-player--out' : ''}`} disabled={!canVote || s === seat || !game.candidates.includes(s)} aria-pressed={game.phase === 'voting' ? target === s : undefined} aria-label={`选择${s+1}号${name(s)}${out ? '，已出局' : ''}`} onClick={() => setTarget(s)}>
          <span className="uc-avatar">{s+1}</span><strong>{name(s)}{s === seat ? '（我）' : ''}</strong>
          <small>{assignments ? roleNames[assignments[s]?.role] : out ? `已出局 · ${roleNames[out.role]}` : game.phase === 'voting' ? game.voted.includes(s) ? '已投票' : '等待投票' : game.spoken.includes(s) ? '已发言' : '在场'}</small>
          {assignments && <span className="uc-result-word">{assignments[s]?.word}</span>}
        </button>
      })}</div>
      {canSpeak && <form className="uc-description" onSubmit={e => { e.preventDefault(); void action('speak') }}>
        <label htmlFor="uc-clue">用一句话描述你的词语，不要直接写出词语</label><textarea id="uc-clue" aria-label="你的描述" placeholder="例如：它常出现在早餐里" maxLength={120} value={text} onChange={e => setText(e.target.value)} required />
        <div className="boardgame-controls"><button className="boardgame-button" type="button" onClick={() => action('skip')}>跳过发言</button><button className="boardgame-button boardgame-button--primary" disabled={!text.trim()}>提交描述</button></div>
      </form>}
      {game.phase === 'speaking' && online && online.room.creator_id === online.user?.id && game.turn !== seat && <div className="boardgame-controls"><button className="boardgame-button boardgame-button--small" disabled={!ready} onClick={() => action('skip')}>跳过当前发言</button></div>}
      {game.phase === 'voting' && <div className="uc-vote-actions">{canVote ? <><p>选择一位可疑玩家，再确认投票</p><button className="boardgame-button boardgame-button--primary" disabled={target === null} onClick={() => action('vote')}>{target === null ? '确认投票' : `投给 ${name(target)}`}</button></> : <p>{playing ? game.myVote != null ? `你已投给 ${name(game.myVote)}，等待其他玩家` : '你已投票，等待其他玩家' : '观战中，等待投票结果'}</p>}</div>}
      {game.lastVote && <p className="uc-round-result">{game.lastVote.eliminated !== null ? `${name(game.lastVote.eliminated)} 出局` : game.lastVote.tied ? game.revotes ? '出现平票，请在平票玩家中重新选择' : '再次平票，本轮无人出局' : ''} · {Object.entries(game.lastVote.counts).map(([s,n]) => `${name(Number(s))} ${n}票`).join('，')}</p>}
      {game.speeches.length > 0 && <section className="uc-speeches" aria-label="玩家描述"><h2>本局描述</h2>{game.speeches.map((speech,i) => <p key={i}><small>第{speech.round}轮 · {name(speech.seat)}</small><span>{speech.text}</span></p>)}</section>}
      {game.phase === 'finished' && <div className="boardgame-controls"><button className="boardgame-button boardgame-button--primary" disabled={online && (online.room.creator_id !== online.user?.id || !ready)} onClick={() => online ? online.submit('undercover_lobby_action',{action:'reset'}) : setLocal(null)}>再来一局</button></div>}
    </>}
    {seat === null && game.phase !== 'finished' && <p className="boardgame-room-hint uc-center">观战中，只显示公开描述和投票结果</p>}
    {error && <p className="boardgame-notice boardgame-error" role="alert">{error}</p>}
  </div>
}
