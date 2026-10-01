import RoomLobby from '../../components/RoomLobby.jsx'
import useRoomEntry from '../../components/useRoomEntry.jsx'
import XiangqiGame from './XiangqiGame.jsx'
import useOnlineRoom from './useOnlineRoom.js'
import { playerSide } from './online.js'
import { isInCheck, sideNames } from './xiangqi.js'

const sides = ['red', 'black']

export default function OnlineXiangqi({ onBack, inviteCode }) {
  const online = useOnlineRoom()
  const { back, inviteButton, notice } = useRoomEntry(online, inviteCode, onBack)
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
  const draw = value => online.submit('xiangqi_draw', { action: value })
  if (online.room?.status === 'playing' || online.room?.status === 'finished') {
    return <XiangqiGame onBack={back} headerActions={inviteButton} online={{ ...online, canMove, status }}>
      {notice}
      {side && online.room.status === 'playing' && <div className="boardgame-draw-controls">
        {offer && <span role="status">{ownOffer ? '等待对方同意和棋' : '对方请求和棋'}</span>}
        {!offer && <button className="boardgame-button" disabled={!ready} onClick={() => draw('offer')}>请求和棋</button>}
        {offer && ownOffer && <button className="boardgame-button" disabled={!ready} onClick={() => draw('cancel')}>撤回请求</button>}
        {offer && !ownOffer && <><button className="boardgame-button" disabled={!ready} onClick={() => draw('accept')}>同意和棋</button><button className="boardgame-button" disabled={!ready} onClick={() => draw('decline')}>继续对弈</button></>}
      </div>}
    </XiangqiGame>
  }
  return <RoomLobby online={online} name="象棋" sides={sides} names={sideNames} onBack={back} inviteCode={inviteCode}
    inviteButton={inviteButton} notice={notice} onAction={(action, parameters = {}) => online.submit('xiangqi_lobby_action', { action, ...parameters })} />
}
