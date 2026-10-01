import { useEffect, useRef, useState } from 'react'
import XiangqiGame from './XiangqiGame.jsx'
import useOnlineRoom from './useOnlineRoom.js'
import { playerSide } from './online.js'
import { isInCheck, sideNames } from './xiangqi.js'

export function RoomLobby({ online, onAction }) {
  const [name, setName] = useState('棋友')
  useEffect(() => { if (online.nickname) setName(online.nickname) }, [online.nickname])
  const side = playerSide(online.room, online.user?.id)
  const ready = online.connection === 'connected' && !online.busy
  const host = online.room?.creator_id === online.user?.id
  const bothSeated = online.room?.red_player_id && online.room?.black_player_id
  return <section className="xiangqi-room-lobby" aria-label="象棋房间等候区">
    <div className="xiangqi-seats">
      {['red', 'black'].map((seat, index) => {
        const occupant = online.room?.[`${seat}_player_id`]
        const mine = occupant && occupant === online.user?.id
        const displayName = online.room?.[`${seat}_name`] || '棋友'
        return <div className="xiangqi-seat-wrap" key={seat}>
          <button className={`xiangqi-seat xiangqi-seat--${seat}`} aria-label={`${sideNames[seat]}座位${occupant ? `：${displayName}${mine ? '，我' : ''}` : '，加入'}`}
            disabled={!ready || Boolean(occupant) || Boolean(side)} onClick={() => onAction('seat', { seat })}>
            {occupant ? <span>{Array.from(displayName)[0]}</span> : '加入'}
            <small className="xiangqi-seat-number">{index + 1}</small>
            {occupant === online.room?.creator_id && <small className="xiangqi-host-badge">房主</small>}
            {mine && <small className="xiangqi-me-badge">我</small>}
          </button>
          <small>{sideNames[seat]}{occupant ? ` · ${displayName}` : ''}</small>
        </div>
      })}
    </div>
    <p className="xiangqi-room-status" role="status">{online.connection !== 'connected' ? '正在连接房间…' : side ? `你已加入${sideNames[side]}` : '观战中'}</p>
    {side ? <button className="xiangqi-button xiangqi-button--small" disabled={!ready} onClick={() => onAction('leave')}>离开座位，观战</button>
      : <p className="xiangqi-room-hint">选择座位加入游戏</p>}
    <form className="xiangqi-nickname" onSubmit={event => { event.preventDefault(); void onAction('name', { nickname: name }) }}>
      <span className="xiangqi-avatar" aria-hidden="true">{Array.from(name.trim() || '棋友')[0]}</span>
      <input aria-label="你的名字" placeholder="新的名字" value={name} onChange={event => setName(event.target.value)} maxLength={12} required disabled={!ready} />
      <button className="xiangqi-button xiangqi-button--small" disabled={!ready || !name.trim()}>改名</button>
    </form>
    <button className="xiangqi-button xiangqi-start" disabled={!ready || !host || !bothSeated} onClick={() => onAction('start')}>开始游戏</button>
    <p className="xiangqi-room-hint">{bothSeated ? host ? '双方已入座，可以开始' : '等待房主开始游戏' : '等待另一位棋友入座'}</p>
  </section>
}

export default function OnlineXiangqi({ onBack, inviteCode }) {
  const online = useOnlineRoom()
  const entered = useRef(false)
  const [copyMessage, setCopyMessage] = useState('')
  const [showLink, setShowLink] = useState(false)
  useEffect(() => {
    if (!entered.current) { entered.current = true; void online.enterRoom(inviteCode || undefined) }
  }, [inviteCode, online.enterRoom])
  const side = playerSide(online.room, online.user?.id)
  const ready = online.connection === 'connected' && !online.busy && online.room?.status === 'playing'
  const canMove = ready && side === online.game.currentPlayer
  const offer = online.room?.draw_offered_by
  const ownOffer = offer === online.user?.id
  let status = '正在连接房间…'
  if (online.room) {
    if (online.connection !== 'connected') status = '连接恢复中，暂时不能走棋'
    else if (online.game.winner) status = online.game.winner === 'draw' ? '本局和棋' : `${sideNames[online.game.winner]}获胜 · ${online.game.reason === 'checkmate' ? '将死' : '困毙'}`
    else if (online.busy) status = '正在提交操作'
    else if (!side) status = `观战中 · ${sideNames[online.game.currentPlayer]}走棋`
    else status = canMove ? (isInCheck(online.game.board, side) ? '轮到你应将' : '轮到你走棋') : '等待对方走棋'
  }
  const action = (value, parameters = {}) => online.submit('xiangqi_lobby_action', { action: value, ...parameters })
  const draw = value => online.submit('xiangqi_draw', { action: value })
  const back = () => { online.leave(); onBack() }
  async function invite() {
    try { await navigator.clipboard.writeText(window.location.href); setCopyMessage('邀请链接已复制') }
    catch { setShowLink(true); setCopyMessage('请复制下方链接发给朋友') }
  }
  const inviteButton = <button className="xiangqi-button xiangqi-button--small" disabled={!online.roomId} onClick={invite}>邀请好友</button>
  const notice = <>
    {copyMessage && <p className="xiangqi-notice" role="status">{copyMessage}</p>}
    {showLink && <input className="xiangqi-invite-link" aria-label="邀请链接" readOnly value={window.location.href} onFocus={event => event.target.select()} />}
    {online.error && <p className="xiangqi-notice xiangqi-error" role="alert">{online.error} <button className="xiangqi-button xiangqi-button--small" onClick={online.roomId ? online.reconnect : () => online.enterRoom(inviteCode || undefined)} disabled={online.busy}>重试</button></p>}
  </>
  if (online.room?.status === 'playing' || online.room?.status === 'finished') {
    return <XiangqiGame onBack={back} headerActions={inviteButton} online={{ ...online, canMove, status }}>
      {notice}
      {side && online.room.status === 'playing' && <div className="xiangqi-draw-controls">
        {offer && <span role="status">{ownOffer ? '等待对方同意和棋' : '对方请求和棋'}</span>}
        {!offer && <button className="xiangqi-button" disabled={!ready} onClick={() => draw('offer')}>请求和棋</button>}
        {offer && ownOffer && <button className="xiangqi-button" disabled={!ready} onClick={() => draw('cancel')}>撤回请求</button>}
        {offer && !ownOffer && <><button className="xiangqi-button" disabled={!ready} onClick={() => draw('accept')}>同意和棋</button><button className="xiangqi-button" disabled={!ready} onClick={() => draw('decline')}>继续对弈</button></>}
      </div>}
    </XiangqiGame>
  }
  return <>
    <header className="xiangqi-mini-header">
      <button className="xiangqi-button xiangqi-button--small" onClick={back}>返回主页</button>
      <div><h1>象棋</h1><small>房间号：{online.room?.code || inviteCode || '创建中…'}</small></div>
      {inviteButton}
    </header>
    {notice}
    {online.room ? <RoomLobby online={online} onAction={action} /> : <p className="xiangqi-room-status" role="status">{online.error ? '暂时无法进入房间' : '正在进入房间…'}</p>}
  </>
}
