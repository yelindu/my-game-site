import { useEffect, useState } from 'react'
import { bid, beats, cardLabel, classify, computerAction, createGame, findPlays, play, playerSeat, shapeNames, sortCards } from './doudizhu.js'
import './doudizhu.css'

function Card({ card, selected = false, disabled = false, onClick }) {
  const red = card === 53 || card < 52 && [1, 3].includes(card % 4)
  return <button type="button" className={`ddz-card${red ? ' ddz-card--red' : ''}${selected ? ' ddz-card--selected' : ''}`} aria-label={cardLabel(card)} aria-pressed={onClick ? selected : undefined} disabled={disabled || !onClick} onClick={onClick}>
    <span>{card >= 52 ? card === 52 ? '小' : '大' : cardLabel(card).slice(1)}</span><span>{card >= 52 ? '王' : cardLabel(card)[0]}</span>
  </button>
}

export default function DoudizhuGame({ onBack, online, headerActions, children }) {
  const [local, setLocal] = useState(createGame)
  const [selected, setSelected] = useState([])
  const [error, setError] = useState('')
  const [hintIndex, setHintIndex] = useState(0)
  const game = online ? online.game : local
  const seat = online ? playerSeat(online.room, online.user?.id) : 0
  const hand = sortCards(online ? game.hand || [] : game.hands[0])
  const names = online ? [0, 1, 2].map(s => online.room?.[`seat${s}_name`] || '牌友') : ['你', '电脑一', '电脑二']
  const counts = online ? game.remaining : game.hands.map(h => h.length)
  const canAct = seat !== null && game.turn === seat && (!online || online.connection === 'connected' && !online.busy)
  const shape = classify(selected)
  useEffect(() => { setSelected([]); setError(''); setHintIndex(0) }, [game.version])
  useEffect(() => {
    if (online || local.turn === 0 || local.phase === 'finished') return
    const timer = setTimeout(() => setLocal(current => {
      const action = computerAction(current)
      return current.phase === 'bidding' ? bid(current, action.bid) : play(current, action.cards)
    }), 850)
    return () => clearTimeout(timer)
  }, [local, online])
  async function act(action, value) {
    setError('')
    try {
      if (online) await online.submit('doudizhu_game_action', { action, expected_version: game.version, bid_value: action === 'bid' ? value : null, played_cards: action === 'play' ? value : [] })
      else setLocal(action === 'bid' ? bid(local, value) : play(local, value))
    } catch (failure) { setError(failure.message) }
  }
  function hint() {
    const choices = findPlays(hand, game.lastPlay?.shape)
    if (!choices.length) { setSelected([]); setError('没有能压过的牌，可以选择不出'); return }
    setSelected(choices[hintIndex % choices.length].cards); setHintIndex(hintIndex + 1); setError('')
  }
  let status = game.phase === 'bidding' ? `轮到${names[game.turn]}叫分` : `轮到${names[game.turn]}出牌`
  if (game.phase === 'finished') status = `${game.winner === 'landlord' ? '地主获胜' : '农民获胜'}${game.spring ? ' · 春天' : ''}`
  else if (online && online.connection !== 'connected') status = '连接恢复中，请稍候…'
  else if (canAct) status = game.phase === 'bidding' ? '轮到你叫分' : '轮到你出牌'
  return <div className="ddz-game">
    <header className="boardgame-mini-header">
      <button className="boardgame-button boardgame-button--small" onClick={onBack}>返回主页</button>
      <div><h1>♠ 斗地主</h1><small>{online ? `房间号：${online.room?.code}` : '本地对战 · 两位电脑陪你玩'}</small></div>
      {headerActions}
    </header>
    {children}
    <div className="ddz-table">
      <div className="ddz-opponents">
        {[0, 1, 2].filter(s => s !== seat).map(s => <div className={`ddz-player${game.turn === s && game.phase !== 'finished' ? ' ddz-player--active' : ''}`} key={s}>
          <span className="ddz-player__avatar">{game.phase === 'bidding' ? s + 1 : game.landlord === s ? '地' : '农'}</span>
          <strong>{names[s]}</strong><span>{counts?.[s] || 0} 张</span>
          {game.bids?.[s] !== null && game.bids?.[s] !== undefined && <small>{game.bids[s] ? `叫 ${game.bids[s]} 分` : '不叫'}</small>}
          {game.passed?.[s] && <small>不出</small>}
        </div>)}
      </div>
      <div className="ddz-bottom" aria-label="地主底牌">
        <span>底牌</span>{game.phase === 'bidding' ? <span className="ddz-hidden-bottom">▧ ▧ ▧</span> : game.bottom?.map(c => <Card key={c} card={c} />)}
        <small>{game.phase === 'bidding' ? '最高叫分决定地主' : `${game.multiplier} 倍`}</small>
      </div>
      <p className="ddz-status" role="status">{status}{seat === null ? ' · 观战中' : ''}</p>
      <div className="ddz-trick" aria-label="上一手出牌" key={`${game.lastPlay?.seat}:${game.lastPlay?.cards?.join(',')}`}>
        {game.lastPlay ? <><small>{names[game.lastPlay.seat]} · {shapeNames[game.lastPlay.shape.type]}</small><div className="ddz-played-cards">{game.lastPlay.cards.map(c => <Card key={c} card={c} />)}</div></>
          : <small>{game.phase === 'bidding' ? '叫分后，地主先出牌' : game.phase === 'finished' ? '本局结束' : '这一轮可以出任意合法牌型'}</small>}
      </div>
      <div className="ddz-actions">
        {game.phase === 'bidding' && <>{[0, 1, 2, 3].map(v => <button className={`boardgame-button${v === 3 ? ' boardgame-button--primary' : ''}`} key={v} disabled={!canAct || v > 0 && v <= game.highestBid} onClick={() => act('bid', v)}>{v ? `叫 ${v} 分` : '不叫'}</button>)}</>}
        {game.phase === 'playing' && <>
          <button className="boardgame-button" disabled={!canAct || !game.lastPlay} onClick={() => act('play', [])}>不出</button>
          <button className="boardgame-button" disabled={!canAct} onClick={hint}>提示</button>
          <button className="boardgame-button" disabled={!selected.length} onClick={() => setSelected([])}>取消选牌</button>
          <button className="boardgame-button boardgame-button--primary" disabled={!canAct || !beats(shape, game.lastPlay?.shape)} onClick={() => act('play', selected)}>出牌</button>
        </>}
        {game.phase === 'finished' && <button className="boardgame-button boardgame-button--primary" disabled={online && (online.room.creator_id !== online.user?.id || online.busy || online.connection !== 'connected')} onClick={() => online ? online.submit('doudizhu_lobby_action', { action: 'restart' }) : setLocal(createGame())}>再来一局</button>}
      </div>
      <p className="ddz-selection" role={error ? 'alert' : undefined}>{error || (shape ? `${shapeNames[shape.type]} · ${selected.length} 张${beats(shape, game.lastPlay?.shape) ? '' : ' · 压不过上一手'}` : selected.length ? `已选 ${selected.length} 张` : seat === null ? '观战仅显示公开出牌和剩余张数' : '点击手牌选中，再点击出牌')}</p>
      {seat !== null && <div className="ddz-self"><strong>{names[seat]}</strong><span>{game.phase === 'bidding' ? '等待叫分' : game.landlord === seat ? '地主' : '农民'} · {hand.length} 张</span></div>}
      <div className="ddz-hand" aria-label="你的手牌">{hand.map(card => <Card key={card} card={card} selected={selected.includes(card)} disabled={!canAct || game.phase !== 'playing'} onClick={() => { setError(''); setSelected(cards => cards.includes(card) ? cards.filter(c => c !== card) : [...cards, card]) }} />)}</div>
    </div>
  </div>
}
