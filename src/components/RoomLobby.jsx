import { useEffect, useState } from 'react'

export default function RoomLobby({ online, name, sides, names, onAction, onBack, inviteButton, notice, inviteCode, minPlayers = sides.length, defaultNickname = '棋友' }) {
  const [nickname, setNickname] = useState(defaultNickname)
  useEffect(() => { if (online.nickname) setNickname(online.nickname) }, [online.nickname])
  const side = online.user?.id && sides.find(seat => online.room?.[`${seat}_player_id`] === online.user.id)
  const ready = online.connection === 'connected' && !online.busy
  const host = online.room?.creator_id === online.user?.id
  const seated = sides.filter(seat => online.room?.[`${seat}_player_id`]).length
  const bothSeated = seated >= minPlayers
  return <>
    <header className="boardgame-mini-header">
      <button className="boardgame-button boardgame-button--small" onClick={onBack}>返回主页</button>
      <div><h1>{name}</h1><small>房间号：{online.room?.code || inviteCode || '创建中…'}</small></div>
      {inviteButton}
    </header>
    {notice}
    {!online.room ? <p className="boardgame-room-status" role="status">{online.error ? '暂时无法进入房间' : '正在进入房间…'}</p>
      : <section className="boardgame-room-lobby" aria-label={`${name}房间等候区`}>
        <div className="boardgame-seats">
          {sides.map((seat, index) => {
            const occupant = online.room[`${seat}_player_id`]
            const mine = occupant && occupant === online.user?.id
            const displayName = online.room[`${seat}_name`] || '棋友'
            return <div className="boardgame-seat-wrap" key={seat}>
              <button className={`boardgame-seat boardgame-seat--${seat}`} aria-label={`${names[seat]}座位${occupant ? `：${displayName}${mine ? '，我' : ''}` : '，加入'}`}
                disabled={!ready || Boolean(occupant) || Boolean(side)} onClick={() => onAction('seat', { seat })}>
                {occupant ? <span>{Array.from(displayName)[0]}</span> : '加入'}
                <small className="boardgame-seat-number">{index + 1}</small>
                {occupant === online.room.creator_id && <small className="boardgame-host-badge">房主</small>}
                {mine && <small className="boardgame-me-badge">我</small>}
              </button>
              <small>{names[seat]}{occupant ? ` · ${displayName}` : ''}</small>
            </div>
          })}
        </div>
        <p className="boardgame-room-status" role="status">{online.connection !== 'connected' ? '正在连接房间…' : side ? `你已加入${names[side]}` : '观战中'}</p>
        {side ? <button className="boardgame-button boardgame-button--small" disabled={!ready} onClick={() => onAction('leave')}>离开座位，观战</button>
          : <p className="boardgame-room-hint">选择座位加入游戏</p>}
        <form className="boardgame-nickname" onSubmit={event => { event.preventDefault(); void onAction('name', { nickname }) }}>
          <span className="boardgame-avatar" aria-hidden="true">{Array.from(nickname.trim() || '棋友')[0]}</span>
          <input aria-label="你的名字" placeholder="新的名字" value={nickname} onChange={event => setNickname(event.target.value)} maxLength={12} required disabled={!ready} />
          <button className="boardgame-button boardgame-button--small" disabled={!ready || !nickname.trim()}>改名</button>
        </form>
        <button className="boardgame-button boardgame-start" disabled={!ready || !host || !bothSeated} onClick={() => onAction('start')}>开始游戏</button>
        <p className="boardgame-room-hint">{minPlayers !== sides.length ? `${seated}/${sides.length} 人已入座，至少 ${minPlayers} 人可开始` : bothSeated ? host ? sides.length === 2 ? '双方已入座，可以开始' : '三位玩家已入座，可以开始' : '等待房主开始游戏' : sides.length === 2 ? '等待另一位棋友入座' : '等待三位玩家入座'}</p>
      </section>}
  </>
}
