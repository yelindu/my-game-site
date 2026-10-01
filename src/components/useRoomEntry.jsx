import { useEffect, useRef, useState } from 'react'

export default function useRoomEntry(online, inviteCode, onBack) {
  const entered = useRef(false)
  const [message, setMessage] = useState('')
  const [showLink, setShowLink] = useState(false)
  useEffect(() => {
    if (!entered.current) { entered.current = true; void online.enterRoom(inviteCode || undefined) }
  }, [inviteCode, online.enterRoom])
  async function invite() {
    try { await navigator.clipboard.writeText(window.location.href); setMessage('邀请链接已复制') }
    catch { setShowLink(true); setMessage('请复制下方链接发给朋友') }
  }
  return {
    back: () => { online.leave(); onBack() },
    inviteButton: <button className="boardgame-button boardgame-button--small" disabled={!online.roomId} onClick={invite}>邀请好友</button>,
    notice: <>
      {message && <p className="boardgame-notice" role="status">{message}</p>}
      {showLink && <input className="boardgame-invite-link" aria-label="邀请链接" readOnly value={window.location.href} onFocus={event => event.target.select()} />}
      {online.error && <p className="boardgame-notice boardgame-error" role="alert">{online.error} <button className="boardgame-button boardgame-button--small" onClick={online.roomId ? online.reconnect : () => online.enterRoom(inviteCode || undefined)} disabled={online.busy}>重试</button></p>}
    </>,
  }
}
