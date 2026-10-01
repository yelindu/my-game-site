import { useState } from 'react'
import { onlineConfigured } from '../../services/supabase.js'
import GomokuGame from './GomokuGame.jsx'
import { playerSide } from './online.js'
import useOnlineRoom from './useOnlineRoom.js'

const names = { black: '黑方', white: '白方', draw: '平局' }

export default function OnlineGomoku({ onBack, onLocal }) {
  const online = useOnlineRoom()
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get('room') || '')
  const [copyMessage, setCopyMessage] = useState('')
  const side = playerSide(online.room, online.user?.id)
  const canMove = online.connection === 'connected' && !online.busy
    && online.room?.status === 'playing' && side === online.room.current_turn
  let status = '创建房间或输入邀请码加入'
  if (online.roomId) {
    if (online.connection !== 'connected') status = '连接恢复中，暂时不能落子'
    else if (online.room?.status === 'waiting') status = '等待朋友加入'
    else if (online.game.winner) status = online.game.winner === 'draw' ? '本局平局' : `${names[online.game.winner]}获胜`
    else if (online.busy) status = '正在提交落子'
    else status = side === online.game.currentPlayer ? '轮到你落子' : '等待对方落子'
  }

  function backToLocal() {
    online.leave()
    onLocal()
  }

  function backToLobby() {
    online.leave()
    onBack()
  }

  async function copyInvitation() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopyMessage('邀请链接已复制，发给朋友即可。')
    } catch {
      setCopyMessage('请选中下方链接并复制。')
    }
  }

  return (
    <GomokuGame onBack={backToLobby} online={{ ...online, canMove, status }}>
      <section className="room-panel" aria-label="在线房间">
        <div className="room-panel__heading">
          <h2>{online.roomId ? `房间 ${online.room?.code || code || '连接中'}` : '和朋友开一局'}</h2>
          <button className="text-button" type="button" onClick={backToLocal} disabled={online.busy}>切换本地双人</button>
        </div>
        {!onlineConfigured && <p role="status">在线对战暂未开放，可以先玩本地双人。</p>}
        {!online.roomId ? (
          <div className="room-entry">
            <button className="control-button control-button--primary" type="button" disabled={!onlineConfigured || online.busy} onClick={() => online.enterRoom()}>
              {online.busy ? '连接中…' : '创建房间'}
            </button>
            <form className="room-join" onSubmit={(event) => { event.preventDefault(); void online.enterRoom(code) }}>
              <label htmlFor="room-code">房间邀请码</label>
              <div className="room-join__controls">
                <input id="room-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={8} minLength={8} pattern="[A-Za-z0-9]{8}" autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="8 位邀请码" required disabled={online.busy} />
                <button className="control-button" type="submit" disabled={!onlineConfigured || online.busy}>加入 / 恢复房间</button>
              </div>
            </form>
          </div>
        ) : (
          <>
            <p className="room-summary">
              {side ? `你是${names[side]}。` : '正在读取房间。'}
              {online.connection === 'connected' ? '连接正常。' : '正在重新连接。'}
              {online.room?.status === 'waiting' ? '请将邀请发给另一台设备上的朋友。' : ''}
            </p>
            <div className="room-buttons">
              <button className="control-button" type="button" onClick={copyInvitation}>复制邀请链接</button>
              <button className="control-button" type="button" onClick={online.reconnect} disabled={online.busy}>重新连接</button>
              <button className="control-button" type="button" onClick={online.leave} disabled={online.busy}>返回房间入口</button>
            </div>
            <label className="room-share" htmlFor="room-link">邀请链接
              <input id="room-link" readOnly value={window.location.href} onFocus={(event) => event.target.select()} />
            </label>
            <p className="room-hint">刷新后可用当前邀请恢复。新一局请创建新房间。</p>
          </>
        )}
        {copyMessage && <p role="status">{copyMessage}</p>}
        {online.error && <p className="room-error" role="alert">{online.error}</p>}
      </section>
    </GomokuGame>
  )
}
