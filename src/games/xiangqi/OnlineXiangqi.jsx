import OnlineRoomPanel from '../../components/OnlineRoomPanel.jsx'
import XiangqiGame from './XiangqiGame.jsx'
import useOnlineRoom from './useOnlineRoom.js'
import { playerSide } from './online.js'
import { isInCheck, sideNames } from './xiangqi.js'

export default function OnlineXiangqi({ onBack, onLocal }) {
  const online = useOnlineRoom()
  const side = playerSide(online.room, online.user?.id)
  const ready = online.connection === 'connected' && !online.busy && online.room?.status === 'playing'
  const canMove = ready && side === online.game.currentPlayer
  const offer = online.room?.draw_offered_by
  const ownOffer = offer === online.user?.id
  let status = '创建房间或输入邀请码加入'
  if (online.roomId) {
    if (online.connection !== 'connected') status = '连接恢复中，暂时不能走棋'
    else if (online.room?.status === 'waiting') status = '等待朋友加入'
    else if (online.game.winner) status = online.game.winner === 'draw' ? '双方同意，本局和棋' : `${sideNames[online.game.winner]}获胜 · ${online.game.reason === 'checkmate' ? '将死' : '困毙'}`
    else if (online.busy) status = '正在提交操作'
    else status = side === online.game.currentPlayer ? (isInCheck(online.game.board, side) ? '轮到你应将' : '轮到你走棋') : '等待对方走棋'
  }
  const draw = (action) => online.submit('xiangqi_draw', { action })
  return (
    <XiangqiGame onBack={() => { online.leave(); onBack() }} online={{ ...online, canMove, status }}>
      <OnlineRoomPanel online={online} side={side} names={sideNames} onLocal={() => { online.leave(); onLocal() }} />
      {online.room?.status === 'playing' && <section className="room-panel" aria-label="和棋协商">
        <h2>和棋协商</h2>
        <p role="status">{offer ? ownOffer ? '已向对方请求和棋，等待答复。' : '对方请求和棋，你可以同意或拒绝。' : '需要双方同意才能记为和棋。继续走棋会撤销当前请求。'}</p>
        <div className="room-buttons">
          {!offer && <button className="control-button" disabled={!ready} onClick={() => draw('offer')}>请求和棋</button>}
          {offer && ownOffer && <button className="control-button" disabled={!ready} onClick={() => draw('cancel')}>撤回和棋请求</button>}
          {offer && !ownOffer && <>
            <button className="control-button control-button--primary" disabled={!ready} onClick={() => draw('accept')}>同意和棋</button>
            <button className="control-button" disabled={!ready} onClick={() => draw('decline')}>继续对弈</button>
          </>}
        </div>
      </section>}
    </XiangqiGame>
  )
}
